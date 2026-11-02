import { signOut, unstable_update } from "@/auth"
import { cookies } from "next/headers"
import type { BackendCredentials } from "@/lib/auth/refresh-coordinator"
import { backendCredentialsMatch } from "@/lib/auth/token-update"
import { refreshManager } from "@/lib/server/refresh-manager"
import {
  backendCredentialsFromRequest,
  backendCredentialsFromHeaders,
  signedBackendCredentialUpdate,
} from "@/lib/server/auth-session"
import { getServerEnv } from "@/lib/server/env"
import {
  BffBodyTooLargeError,
  isAllowedBffPath,
  NestResponseTooLargeError,
  proxyNestRequest,
  readBffRequestBody,
} from "@/lib/server/nest-api"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ path: string[] }>
}

async function endFrontendSession(
  credentials: BackendCredentials,
): Promise<void> {
  refreshManager.invalidate(credentials.authSessionId)

  try {
    await signOut({ redirect: false })
  } catch {
    // The protected response still fails closed if Auth.js cookie cleanup fails.
  }
}

function sessionExpiredResponse(): Response {
  return Response.json(
    {
      statusCode: 401,
      code: "SESSION_EXPIRED",
      message: "Your session has expired. Please sign in again.",
    },
    { status: 401 },
  )
}

function replacedSessionResponse(): Response {
  return Response.json(
    { statusCode: 409, code: "SESSION_REPLACED", message: "Session changed" },
    { status: 409 },
  )
}

function upstreamUnavailableResponse(): Response {
  return Response.json(
    { statusCode: 503, code: "BACKEND_UNAVAILABLE", message: "Service unavailable" },
    { status: 503 },
  )
}

async function persistBackendCredentials(
  next: BackendCredentials,
): Promise<boolean> {
  try {
    if (!refreshManager.isActive(next.authSessionId)) return false
    const cookieStore = await cookies()
    const current = await backendCredentialsFromHeaders(new Headers({ Cookie: cookieStore.toString() }))
    if (!current || current.authSessionId !== next.authSessionId) return false
    if (!backendCredentialsMatch(current, next)) {
      if (current.tokenVersion + 1 !== next.tokenVersion) return false
      const session = await unstable_update({
        backendTokenUpdate: signedBackendCredentialUpdate(current, next),
      } as never)
      if (!session) return false
    }
    const persisted = await backendCredentialsFromHeaders(new Headers({ Cookie: cookieStore.toString() }))
    if (!refreshManager.isActive(next.authSessionId)) {
      await signOut({ redirect: false })
      return false
    }
    return backendCredentialsMatch(persisted, next)
  } catch {
    return false
  }
}

async function getStableCredentials(
  credentials: BackendCredentials,
): Promise<BackendCredentials | null> {
  try {
    return await refreshManager.resolve(credentials)
  } catch {
    return null
  }
}

async function handle(
  request: Request,
  { params }: RouteContext,
): Promise<Response> {
  if (
    !["GET", "HEAD"].includes(request.method.toUpperCase()) &&
    request.headers.get("origin") !== getServerEnv().FRONTEND_ORIGIN
  ) {
    return Response.json(
      { statusCode: 403, code: "FORBIDDEN", message: "Forbidden" },
      { status: 403 },
    )
  }

  const { path } = await params
  if (!isAllowedBffPath(path, request.method)) {
    return Response.json(
      { statusCode: 404, code: "NOT_FOUND", message: "Not found" },
      { status: 404 },
    )
  }

  const authCredentials = await backendCredentialsFromRequest(request)

  if (!authCredentials) {
    return Response.json(
      { statusCode: 401, code: "UNAUTHORIZED", message: "Unauthorized" },
      { status: 401 },
    )
  }

  let credentials = await getStableCredentials(authCredentials)
  if (!credentials) return replacedSessionResponse()

  let body: ArrayBuffer | undefined
  try {
    body = await readBffRequestBody(request)
  } catch (error) {
    if (error instanceof BffBodyTooLargeError) {
      return Response.json(
        { statusCode: 413, code: "PAYLOAD_TOO_LARGE", message: "Request too large" },
        { status: 413 },
      )
    }

    return Response.json(
      { statusCode: 400, code: "INVALID_REQUEST", message: "Invalid request body" },
      { status: 400 },
    )
  }

  const requestTokenVersion = credentials.tokenVersion
  let response: Response

  try {
    response = await proxyNestRequest(request, path, credentials, body)
  } catch (error) {
    if (error instanceof NestResponseTooLargeError) {
      return Response.json(
        { statusCode: 502, code: "BACKEND_RESPONSE_TOO_LARGE", message: "Backend response too large" },
        { status: 502 },
      )
    }

    return upstreamUnavailableResponse()
  }

  const latestAfterRequest = await getStableCredentials(credentials)
  if (!latestAfterRequest) return replacedSessionResponse()
  credentials = latestAfterRequest

  if (response.status === 401) {
    if (credentials.tokenVersion === requestTokenVersion) {
      try {
        const refreshed = await refreshManager.refresh(credentials)
        if (!refreshed) return replacedSessionResponse()
        credentials = refreshed
      } catch {
        await endFrontendSession(credentials)
        return sessionExpiredResponse()
      }
    }

    const retryTokenVersion = credentials.tokenVersion
    try {
      response = await proxyNestRequest(request, path, credentials, body)
    } catch (error) {
      if (error instanceof NestResponseTooLargeError) {
        return Response.json(
          { statusCode: 502, code: "BACKEND_RESPONSE_TOO_LARGE", message: "Backend response too large" },
          { status: 502 },
        )
      }

      return upstreamUnavailableResponse()
    }

    const latestAfterRetry = await getStableCredentials(credentials)
    if (!latestAfterRetry) return replacedSessionResponse()
    credentials = latestAfterRetry

    if (response.status === 401) {
      if (credentials.tokenVersion > retryTokenVersion) return replacedSessionResponse()
      await endFrontendSession(credentials)
      return sessionExpiredResponse()
    }
  }

  if (credentials.tokenVersion > authCredentials.tokenVersion + 1) {
    // The operation already ran: do not turn a successful mutation into a retryable error.
    // Its old cookie will be rejected locally on the next request.
    return response.ok ? response : replacedSessionResponse()
  }

  if (credentials.tokenVersion > authCredentials.tokenVersion) {
    if (!await persistBackendCredentials(credentials)) {
      if (!refreshManager.isActive(credentials.authSessionId)) return replacedSessionResponse()
      await endFrontendSession(credentials)
      return sessionExpiredResponse()
    }
  }

  return response
}

export const GET = handle
export const HEAD = handle
export const POST = handle
export const PUT = handle
export const PATCH = handle
export const DELETE = handle

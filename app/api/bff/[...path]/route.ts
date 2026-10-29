import { signOut, unstable_update } from "@/auth"
import {
  AUTH_SESSION_MAX_AGE_MS,
  type BackendCredentials,
} from "@/lib/auth/refresh-coordinator"
import { refreshManager } from "@/lib/server/refresh-manager"
import {
  backendCredentialsFromRequest,
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
  if (refreshManager.isInvalidated(credentials.authSessionId)) return

  refreshManager.invalidate(
    credentials.authSessionId,
    Date.now() + AUTH_SESSION_MAX_AGE_MS,
  )

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
  current: BackendCredentials,
  next: BackendCredentials,
): Promise<boolean> {
  try {
    const session = await refreshManager.runSessionTransition(
      current.authSessionId,
      async () => {
        if (refreshManager.isInvalidated(current.authSessionId)) return null

        return unstable_update({
          backendTokenUpdate: signedBackendCredentialUpdate(current, next),
        } as never)
      },
      current,
    )

    return session !== null
  } catch {
    return false
  }
}

async function getStableCredentials(
  credentials: BackendCredentials,
): Promise<BackendCredentials | null> {
  try {
    return await refreshManager.waitForTransition(credentials)
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

  if (latestAfterRequest.tokenVersion > credentials.tokenVersion) {
    const persisted = await persistBackendCredentials(credentials, latestAfterRequest)

    if (!persisted) {
      if (refreshManager.isInvalidated(credentials.authSessionId)) {
        return replacedSessionResponse()
      }

      await endFrontendSession(credentials)
      return sessionExpiredResponse()
    }

    const latestAfterPersistence = await getStableCredentials(latestAfterRequest)
    if (!latestAfterPersistence) return replacedSessionResponse()
    credentials = latestAfterPersistence
  } else {
    credentials = latestAfterRequest
  }

  if (
    response.status === 401 &&
    credentials.tokenVersion > requestTokenVersion
  ) {
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

    const afterLateRetry = await getStableCredentials(credentials)
    if (!afterLateRetry) return replacedSessionResponse()

    if (response.status === 401) {
      if (afterLateRetry.tokenVersion > credentials.tokenVersion) {
        return replacedSessionResponse()
      }

      await endFrontendSession(afterLateRetry)
      return sessionExpiredResponse()
    }

    return response
  }

  if (response.status !== 401) return response

  let refreshed: BackendCredentials

  try {
    refreshed =
      refreshManager.getRecent(
        credentials.authSessionId,
        credentials.tokenVersion,
      ) ?? (await refreshManager.refresh(credentials))
  } catch {
    if (
      refreshManager.isInvalidated(credentials.authSessionId) ||
      refreshManager.isTransitioning(credentials.authSessionId)
    ) {
      return replacedSessionResponse()
    }

    await endFrontendSession(credentials)
    return sessionExpiredResponse()
  }

  const persisted = await persistBackendCredentials(credentials, refreshed)

  if (!persisted) {
    if (refreshManager.isInvalidated(credentials.authSessionId)) {
      return replacedSessionResponse()
    }

    await endFrontendSession(credentials)
    return sessionExpiredResponse()
  }

  let retryResponse: Response

  try {
    retryResponse = await proxyNestRequest(request, path, refreshed, body)
  } catch (error) {
    if (error instanceof NestResponseTooLargeError) {
      return Response.json(
        { statusCode: 502, code: "BACKEND_RESPONSE_TOO_LARGE", message: "Backend response too large" },
        { status: 502 },
      )
    }

    return upstreamUnavailableResponse()
  }

  const latestAfterRetry = await getStableCredentials(refreshed)
  if (!latestAfterRetry) return replacedSessionResponse()

  if (retryResponse.status === 401) {
    if (latestAfterRetry.tokenVersion > refreshed.tokenVersion) {
      return replacedSessionResponse()
    }

    await endFrontendSession(latestAfterRetry)
    return sessionExpiredResponse()
  }

  return retryResponse
}

export const GET = handle
export const HEAD = handle
export const POST = handle
export const PUT = handle
export const PATCH = handle
export const DELETE = handle

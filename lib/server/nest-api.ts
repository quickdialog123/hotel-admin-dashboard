import "server-only"

import {
  accessTokenResponseSchema,
  currentUserSchema,
  type CurrentUser,
  type LoginInput,
} from "@/lib/api/auth-schemas"
import { extractRefreshToken } from "@/lib/auth/token-update"
import type { BackendCredentials } from "@/lib/auth/refresh-coordinator"
import { getServerEnv } from "@/lib/server/env"

const REQUEST_TIMEOUT_MS = 12_000
const MAX_BFF_BODY_BYTES = 10 * 1024 * 1024
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

export class NestApiError extends Error {
  constructor(public readonly status: number) {
    super(`Backend request failed with status ${status}`)
    this.name = "NestApiError"
  }
}

function backendUrl(path: string): URL {
  const { BACKEND_API_URL, API_PREFIX } = getServerEnv()
  const origin = BACKEND_API_URL.replace(/\/+$/, "")
  const prefix = API_PREFIX.replace(/^\/+|\/+$/g, "")

  return new URL(`${origin}/${prefix}/${path.replace(/^\/+/, "")}`)
}

function backendHeaders(headers?: HeadersInit, setJsonAccept = true): Headers {
  const result = new Headers(headers)
  result.set("Origin", getServerEnv().FRONTEND_ORIGIN)
  if (setJsonAccept) result.set("Accept", "application/json")
  return result
}

export function readSetCookieHeaders(headers: Headers): string[] {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] })
    .getSetCookie

  if (typeof getSetCookie === "function") {
    return getSetCookie.call(headers)
  }

  const singleCookie = headers.get("set-cookie")
  return singleCookie ? [singleCookie] : []
}

async function fetchNest(
  path: string,
  init: RequestInit = {},
  setJsonAccept = true,
): Promise<Response> {
  return fetch(backendUrl(path), {
    ...init,
    headers: backendHeaders(init.headers, setJsonAccept),
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new Error("Backend returned an invalid JSON response")
  }
}

function accessTokenExpiresAt(accessToken: string): number {
  const payload = accessToken.split(".")[1]

  if (!payload) throw new Error("Backend access token is malformed")

  let claims: unknown

  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
  } catch {
    throw new Error("Backend access token is malformed")
  }

  if (
    typeof claims !== "object" ||
    claims === null ||
    !("exp" in claims) ||
    typeof claims.exp !== "number"
  ) {
    throw new Error("Backend access token is missing an expiry")
  }

  // exp is only used as a refresh hint; Nest validates the token on every request.
  return claims.exp * 1000
}

async function fetchCurrentUser(accessToken: string): Promise<CurrentUser> {
  const response = await fetchNest("auth/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) throw new NestApiError(response.status)

  return currentUserSchema.parse(await parseJson(response))
}

export async function revokeNestTokens(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  const response = await fetchNest("auth/logout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Cookie: `refresh_token=${refreshToken}`,
    },
  })

  if (!response.ok) throw new NestApiError(response.status)
}

export async function loginWithNest(
  input: LoginInput,
  authSessionId: string,
): Promise<BackendCredentials> {
  const loginResponse = await fetchNest("auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })

  if (!loginResponse.ok) throw new NestApiError(loginResponse.status)

  const { accessToken } = accessTokenResponseSchema.parse(
    await parseJson(loginResponse),
  )
  const refreshToken = extractRefreshToken(readSetCookieHeaders(loginResponse.headers))

  if (!refreshToken) {
    throw new Error("Backend login did not issue a refresh cookie")
  }

  let currentUser: CurrentUser
  let expiresAt: number
  try {
    expiresAt = accessTokenExpiresAt(accessToken)
    currentUser = await fetchCurrentUser(accessToken)
  } catch (error) {
    try {
      await revokeNestTokens(accessToken, refreshToken)
    } catch (cleanupError) {
      console.error("Could not revoke backend session after login initialization failed", {
        status: cleanupError instanceof NestApiError ? cleanupError.status : undefined,
      })
    }

    throw error
  }

  return {
    authSessionId,
    tokenVersion: 0,
    backendSessionId: currentUser.sessionId,
    userId: currentUser.userId,
    hotelId: currentUser.hotelId,
    role: currentUser.role,
    accessToken,
    refreshToken,
    accessTokenExpiresAt: expiresAt,
  }
}

export async function refreshWithNest(
  current: BackendCredentials,
): Promise<BackendCredentials> {
  const response = await fetchNest("auth/refresh", {
    method: "POST",
    headers: { Cookie: `refresh_token=${current.refreshToken}` },
  })

  if (!response.ok) throw new NestApiError(response.status)

  const refreshToken = extractRefreshToken(readSetCookieHeaders(response.headers))

  if (!refreshToken) {
    throw new Error("Backend refresh did not rotate the refresh cookie")
  }

  let accessToken: string
  try {
    const data = accessTokenResponseSchema.parse(await parseJson(response))
    accessToken = data.accessToken
  } catch (error) {
    try {
      await revokeNestTokens(current.accessToken, refreshToken)
    } catch (cleanupError) {
      console.error("Could not revoke backend session after malformed refresh response", {
        status: cleanupError instanceof NestApiError ? cleanupError.status : undefined,
      })
    }

    throw error
  }

  const refreshedCredentials = {
    ...current,
    tokenVersion: current.tokenVersion + 1,
    accessToken,
    refreshToken,
  }

  let currentUser: CurrentUser
  let expiresAt: number
  try {
    expiresAt = accessTokenExpiresAt(accessToken)
    currentUser = await fetchCurrentUser(accessToken)
  } catch (error) {
    try {
      await revokeNestTokens(accessToken, refreshToken)
    } catch (cleanupError) {
      console.error("Could not revoke rotated backend session after refresh validation failed", {
        status: cleanupError instanceof NestApiError ? cleanupError.status : undefined,
      })
    }

    throw error
  }

  return {
    ...refreshedCredentials,
    backendSessionId: currentUser.sessionId,
    userId: currentUser.userId,
    hotelId: currentUser.hotelId,
    role: currentUser.role,
    accessToken,
    refreshToken,
    accessTokenExpiresAt: expiresAt,
  }
}

export async function logoutWithNest(
  credentials: BackendCredentials,
): Promise<void> {
  await revokeNestTokens(credentials.accessToken, credentials.refreshToken)
}

const FORWARDED_REQUEST_HEADERS = ["accept", "content-type"] as const

export class BffBodyTooLargeError extends Error {
  constructor() {
    super("Request body exceeds the BFF size limit")
    this.name = "BffBodyTooLargeError"
  }
}

export class NestResponseTooLargeError extends Error {
  constructor() {
    super("Backend response exceeds the BFF size limit")
    this.name = "NestResponseTooLargeError"
  }
}

async function readLimitedBody(
  stream: ReadableStream<Uint8Array>,
  sizeError: Error,
): Promise<ArrayBuffer> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    totalBytes += value.byteLength
    if (totalBytes > MAX_BFF_BODY_BYTES) {
      try {
        await reader.cancel()
      } catch {
        // Preserve the body-size error if stream cancellation also fails.
      }
      throw sizeError
    }

    chunks.push(value)
  }

  const body = new Uint8Array(totalBytes)
  let offset = 0

  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }

  return body.buffer
}

export function isAllowedBffPath(
  pathSegments: string[],
  method: string,
): boolean {
  const normalized = pathSegments.map((segment) => segment.toLowerCase())
  const normalizedMethod = method.toUpperCase()

  if (
    pathSegments.length === 0 ||
    pathSegments.some((segment) => segment === "." || segment === "..")
  ) {
    return false
  }

  if (normalized.length === 2 && normalized[0] === "auth" && normalized[1] === "me") {
    return normalizedMethod === "GET"
  }

  if (normalized.length === 1 && normalized[0] === "hotels") {
    return normalizedMethod === "GET" || normalizedMethod === "POST"
  }

  if (
    normalized.length === 2 &&
    normalized[0] === "hotels" &&
    UUID_PATTERN.test(normalized[1])
  ) {
    return normalizedMethod === "GET" || normalizedMethod === "PATCH"
  }

  if (
    normalized.length === 3 &&
    normalized[0] === "hotels" &&
    UUID_PATTERN.test(normalized[1]) &&
    normalized[2] === "deactivate"
  ) {
    return normalizedMethod === "POST"
  }

  return false
}

export async function readBffRequestBody(
  request: Request,
): Promise<ArrayBuffer | undefined> {
  const stream = request.body
  if (["GET", "HEAD"].includes(request.method.toUpperCase()) || !stream) {
    return undefined
  }

  const declaredLength = Number(request.headers.get("content-length"))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BFF_BODY_BYTES) {
    try {
      await stream.cancel()
    } catch {
      // Preserve the body-size error if stream cancellation also fails.
    }
    throw new BffBodyTooLargeError()
  }

  return readLimitedBody(stream, new BffBodyTooLargeError())
}

async function readNestResponseBody(response: Response): Promise<ArrayBuffer | null> {
  if (!response.body) return null

  const declaredLength = Number(response.headers.get("content-length"))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BFF_BODY_BYTES) {
    try {
      await response.body.cancel()
    } catch {
      // Preserve the body-size error if stream cancellation also fails.
    }
    throw new NestResponseTooLargeError()
  }

  return readLimitedBody(response.body, new NestResponseTooLargeError())
}

export async function proxyNestRequest(
  request: Request,
  pathSegments: string[],
  credentials: BackendCredentials,
  requestBody?: ArrayBuffer,
): Promise<Response> {
  if (!isAllowedBffPath(pathSegments, request.method)) {
    return Response.json({ message: "Not found" }, { status: 404 })
  }

  const method = request.method.toUpperCase()
  const encodedPath = pathSegments.map(encodeURIComponent).join("/")
  const query = new URL(request.url).search

  const headers = new Headers()
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }
  headers.set("Authorization", `Bearer ${credentials.accessToken}`)

  const body = ["GET", "HEAD"].includes(method)
    ? undefined
    : requestBody ?? (await readBffRequestBody(request)) ?? new ArrayBuffer(0)

  if (body && body.byteLength > MAX_BFF_BODY_BYTES) {
    throw new BffBodyTooLargeError()
  }

  const upstream = await fetchNest(`${encodedPath}${query}`, {
    method,
    headers,
    body,
  }, false)

  if (upstream.status >= 300 && upstream.status < 400) {
    await upstream.body?.cancel()
    return Response.json(
      { statusCode: 502, code: "BACKEND_REDIRECT_REJECTED", message: "Unexpected backend redirect" },
      { status: 502 },
    )
  }

  const responseHeaders = new Headers(upstream.headers)
  for (const name of [
    "connection",
    "content-encoding",
    "content-length",
    "keep-alive",
    "set-cookie",
    "transfer-encoding",
    "upgrade",
  ]) {
    responseHeaders.delete(name)
  }
  responseHeaders.set("Cache-Control", "private, no-store")

  const responseBody = [204, 205, 304].includes(upstream.status)
    ? null
    : await readNestResponseBody(upstream)

  return new Response(responseBody, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  })
}

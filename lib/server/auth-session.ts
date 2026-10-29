import "server-only"

import { getToken } from "next-auth/jwt"
import type { JWT } from "next-auth/jwt"
import { z } from "zod"

import { getServerEnv } from "@/lib/server/env"
import type { BackendCredentials } from "@/lib/auth/refresh-coordinator"
import { signBackendTokenUpdate } from "@/lib/auth/token-update"

const privateBackendClaimsSchema = z.object({
  authSessionId: z.string().uuid(),
  backendTokenVersion: z.number().int().nonnegative(),
  backendSessionId: z.string().uuid(),
  userId: z.string().uuid(),
  hotelId: z.string().uuid().nullable(),
  role: z.enum(["SUPER_ADMIN", "OWNER", "STAFF", "CLIENT", "AUTHORITY"]),
  backendAccessToken: z.string().min(1),
  backendRefreshToken: z.string().min(1),
  backendAccessTokenExpiresAt: z.number().int().positive(),
})

export function backendCredentialsFromJwt(
  jwt: JWT | Record<string, unknown> | null,
): BackendCredentials | null {
  const parsed = privateBackendClaimsSchema.safeParse(jwt)
  if (!parsed.success) return null

  return {
    authSessionId: parsed.data.authSessionId,
    tokenVersion: parsed.data.backendTokenVersion,
    backendSessionId: parsed.data.backendSessionId,
    userId: parsed.data.userId,
    hotelId: parsed.data.hotelId,
    role: parsed.data.role,
    accessToken: parsed.data.backendAccessToken,
    refreshToken: parsed.data.backendRefreshToken,
    accessTokenExpiresAt: parsed.data.backendAccessTokenExpiresAt,
  }
}

export async function backendCredentialsFromRequest(
  request: Request,
): Promise<BackendCredentials | null> {
  const { AUTH_SECRET, FRONTEND_ORIGIN } = getServerEnv()
  const jwt = await getToken({
    req: request,
    secret: AUTH_SECRET,
    secureCookie: new URL(FRONTEND_ORIGIN).protocol === "https:",
  })

  return backendCredentialsFromJwt(jwt)
}

export async function backendCredentialsFromHeaders(
  requestHeaders: Headers,
): Promise<BackendCredentials | null> {
  const { FRONTEND_ORIGIN } = getServerEnv()
  return backendCredentialsFromRequest(
    new Request(FRONTEND_ORIGIN, { headers: requestHeaders }),
  )
}

export function signedBackendCredentialUpdate(
  current: BackendCredentials,
  next: BackendCredentials,
) {
  return signBackendTokenUpdate(
    {
      authSessionId: current.authSessionId,
      expectedVersion: current.tokenVersion,
      nextVersion: next.tokenVersion,
      backendSessionId: next.backendSessionId,
      userId: next.userId,
      hotelId: next.hotelId,
      role: next.role,
      accessToken: next.accessToken,
      refreshToken: next.refreshToken,
      accessTokenExpiresAt: next.accessTokenExpiresAt,
    },
    getServerEnv().AUTH_SECRET,
  )
}

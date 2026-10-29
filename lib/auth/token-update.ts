import { createHmac, timingSafeEqual } from "node:crypto"
import { z } from "zod"

const backendTokenUpdateSchema = z.object({
  authSessionId: z.string().min(1),
  expectedVersion: z.number().int().nonnegative(),
  nextVersion: z.number().int().positive(),
  backendSessionId: z.string().uuid(),
  userId: z.string().uuid(),
  hotelId: z.string().uuid().nullable(),
  role: z.enum(["SUPER_ADMIN", "OWNER", "STAFF", "CLIENT", "AUTHORITY"]),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  accessTokenExpiresAt: z.number().int().positive(),
})

export type BackendTokenUpdate = z.infer<typeof backendTokenUpdateSchema>

export type SignedBackendTokenUpdate = {
  update: BackendTokenUpdate
  signature: string
}

function updatePayload(update: BackendTokenUpdate): string {
  return JSON.stringify({
    authSessionId: update.authSessionId,
    expectedVersion: update.expectedVersion,
    nextVersion: update.nextVersion,
    backendSessionId: update.backendSessionId,
    userId: update.userId,
    hotelId: update.hotelId,
    role: update.role,
    accessToken: update.accessToken,
    refreshToken: update.refreshToken,
    accessTokenExpiresAt: update.accessTokenExpiresAt,
  })
}

function signatureFor(update: BackendTokenUpdate, secret: string): string {
  const key = createHmac("sha256", secret)
    .update("hotel-admin/backend-token-update/v1")
    .digest()

  return createHmac("sha256", key)
    .update(updatePayload(update))
    .digest("hex")
}

export function signBackendTokenUpdate(
  input: BackendTokenUpdate,
  secret: string,
): SignedBackendTokenUpdate {
  const update = backendTokenUpdateSchema.parse(input)

  if (update.nextVersion !== update.expectedVersion + 1) {
    throw new Error("Backend token version must advance exactly once")
  }

  return {
    update,
    signature: signatureFor(update, secret),
  }
}

export function verifyBackendTokenUpdate(
  input: unknown,
  secret: string,
  expected: { authSessionId: string; tokenVersion: number },
): BackendTokenUpdate | null {
  if (typeof input !== "object" || input === null) return null

  const candidate = input as Partial<SignedBackendTokenUpdate>
  const parsed = backendTokenUpdateSchema.safeParse(candidate.update)

  if (!parsed.success || typeof candidate.signature !== "string") return null

  const update = parsed.data

  if (
    update.authSessionId !== expected.authSessionId ||
    update.expectedVersion !== expected.tokenVersion ||
    update.nextVersion !== expected.tokenVersion + 1
  ) {
    return null
  }

  const expectedSignature = Buffer.from(signatureFor(update, secret), "hex")
  const receivedSignature = Buffer.from(candidate.signature, "hex")

  if (
    expectedSignature.length !== receivedSignature.length ||
    !timingSafeEqual(expectedSignature, receivedSignature)
  ) {
    return null
  }

  return update
}

export function applyBackendTokenUpdate(
  token: Record<string, unknown>,
  input: unknown,
  secret: string,
  sessionInvalidated = false,
): Record<string, unknown> | null {
  if (sessionInvalidated) return null

  const authSessionId = token.authSessionId
  const tokenVersion = token.backendTokenVersion

  if (typeof authSessionId !== "string" || typeof tokenVersion !== "number") {
    return token
  }

  const update = verifyBackendTokenUpdate(input, secret, {
    authSessionId,
    tokenVersion,
  })

  if (!update) return token

  return {
    ...token,
    userId: update.userId,
    hotelId: update.hotelId,
    role: update.role,
    backendSessionId: update.backendSessionId,
    backendTokenVersion: update.nextVersion,
    backendAccessToken: update.accessToken,
    backendRefreshToken: update.refreshToken,
    backendAccessTokenExpiresAt: update.accessTokenExpiresAt,
  }
}

export function extractRefreshToken(
  setCookieHeaders: readonly string[],
): string | null {
  const matches: string[] = []

  for (const header of setCookieHeaders) {
    const cookiePair = header.split(";", 1)[0]
    const separator = cookiePair.indexOf("=")

    if (separator < 0 || cookiePair.slice(0, separator).trim() !== "refresh_token") {
      continue
    }

    const value = cookiePair.slice(separator + 1).trim()

    if (!value) return null
    matches.push(value)
  }

  return matches.length === 1 ? matches[0] : null
}

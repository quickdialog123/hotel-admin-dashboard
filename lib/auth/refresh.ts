import { getSession, signIn, signOut } from "next-auth/react"

import { accessTokenResponseSchema, currentUserSchema } from "@/lib/api/auth-schemas"
import { clientEnv } from "@/lib/env/client"

const authLockName = "qd-auth-session"
const authGenerationKey = "qd-auth-generation"
const initialGeneration = "initial"

type SessionSnapshot = {
  accessToken: string
  userId: string
  sessionId: string
}

type RefreshResult =
  | { status: "ready"; session: SessionSnapshot }
  | { status: "invalid" | "uncertain" | "superseded" }
type LockedRefresh = (
  original: SessionSnapshot,
  generation: string,
) => Promise<RefreshResult>

type CleanupResult = "cleared" | "failed" | "superseded"
type RefreshFlight = { key: string; promise: Promise<RefreshResult> }

let refreshInFlight: RefreshFlight | undefined

function authUrl(endpoint: "refresh" | "logout"): string {
  const base = clientEnv.NEXT_PUBLIC_API_BASE_URL.replace(/\/+$/, "")
  return `${base}/auth/${endpoint}`
}

export function getAuthGeneration(): string | null {
  try {
    const existing = window.localStorage.getItem(authGenerationKey)
    if (existing) return existing
    window.localStorage.setItem(authGenerationKey, initialGeneration)
    return initialGeneration
  } catch {
    return null
  }
}

export function beginAuthTransition(): string | null {
  try {
    const transition = typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`
    window.localStorage.setItem(authGenerationKey, transition)
    return transition
  } catch {
    // Refresh fails closed if cross-tab lifecycle state is unavailable.
    return null
  }
}

export class AuthLockUnavailableError extends Error {
  constructor(readonly allowLocalSignOut: boolean) {
    super("Cross-tab authentication coordination is unavailable")
    this.name = "AuthLockUnavailableError"
  }
}

export async function withAuthLock<T>(operation: (refresh: LockedRefresh) => Promise<T>): Promise<T> {
  if (typeof navigator === "undefined" || !navigator.locks) {
    throw new AuthLockUnavailableError(true)
  }

  const run = () => operation(async (original, generation) => {
    if (
      typeof navigator === "undefined" ||
      !navigator.locks ||
      getAuthGeneration() !== generation
    ) {
      return { status: "superseded" }
    }

    return refreshLocked(original, generation)
  })

  let operationStarted = false
  try {
    return await navigator.locks.request(authLockName, { mode: "exclusive" }, () => {
      operationStarted = true
      return run()
    })
  } catch (error) {
    if (operationStarted) throw error
    throw new AuthLockUnavailableError(false)
  }
}

function parseSession(value: unknown): SessionSnapshot | null {
  if (typeof value !== "object" || value === null) return null
  const session = value as { accessToken?: unknown; user?: unknown }
  const user = currentUserSchema.safeParse(session.user)
  if (typeof session.accessToken !== "string" || !user.success) return null

  return {
    accessToken: session.accessToken,
    userId: user.data.userId,
    sessionId: user.data.sessionId,
  }
}

async function currentSession(): Promise<SessionSnapshot | null> {
  try {
    return parseSession(await getSession({ broadcast: false }))
  } catch {
    return null
  }
}

function matchesRefreshSession(
  current: SessionSnapshot | null,
  original: SessionSnapshot,
  refreshedToken?: string,
): boolean {
  if (!current || current.userId !== original.userId) return false
  const sameOriginal = current.accessToken === original.accessToken && current.sessionId === original.sessionId
  const refreshed = Boolean(
    refreshedToken && current.accessToken === refreshedToken && current.sessionId !== original.sessionId,
  )
  return sameOriginal || refreshed
}

function isRotatedSession(current: SessionSnapshot, original: SessionSnapshot): boolean {
  return current.userId === original.userId &&
    current.accessToken !== original.accessToken &&
    current.sessionId !== original.sessionId
}

async function clearRefreshSession(
  original: SessionSnapshot,
  generation: string,
  refreshedToken?: string,
): Promise<CleanupResult> {
  const current = await currentSession()
  const generationMatches = getAuthGeneration() === generation
  if (current && !matchesRefreshSession(current, original, refreshedToken)) return "superseded"
  if (!generationMatches && (!refreshedToken || !matchesRefreshSession(current, original, refreshedToken))) {
    return "superseded"
  }
  if (!refreshedToken && !matchesRefreshSession(current, original)) return "superseded"

  let backendCleanupConfirmed = false
  if (refreshedToken) {
    try {
      const response = await fetch(authUrl("logout"), {
        method: "POST",
        credentials: "include",
        headers: { Authorization: `Bearer ${refreshedToken}` },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(8_000),
      })
      backendCleanupConfirmed = response.status === 204
    } catch {
      backendCleanupConfirmed = false
    }
  }

  if (getAuthGeneration() !== generation) return "superseded"
  const beforeSignOut = await currentSession()
  if (getAuthGeneration() !== generation) return "superseded"
  if (!matchesRefreshSession(beforeSignOut, original, refreshedToken)) return "superseded"
  if (getAuthGeneration() !== generation) return "superseded"

  try {
    await signOut({ redirect: false })
    if (getAuthGeneration() !== generation) return "superseded"
    const remainingSession = await getSession({ broadcast: false })
    if (getAuthGeneration() !== generation) return "superseded"
    return remainingSession === null && (!refreshedToken || backendCleanupConfirmed)
      ? "cleared"
      : "failed"
  } catch {
    return "failed"
  }
}

async function refreshLocked(
  original: SessionSnapshot,
  generation: string,
): Promise<RefreshResult> {
  if (getAuthGeneration() !== generation) return { status: "superseded" }

  const current = await currentSession()
  if (getAuthGeneration() !== generation) return { status: "superseded" }
  if (!current) return { status: "superseded" }

  if (current.accessToken !== original.accessToken || current.sessionId !== original.sessionId) {
    return isRotatedSession(current, original)
      ? { status: "ready", session: current }
      : { status: "superseded" }
  }

  let response: Response
  try {
    response = await fetch(authUrl("refresh"), {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    })
  } catch {
    return { status: getAuthGeneration() === generation ? "uncertain" : "superseded" }
  }

  if (getAuthGeneration() !== generation) return { status: "superseded" }
  if (response.status === 401) {
    const cleanup = await clearRefreshSession(original, generation)
    return cleanup === "cleared"
      ? { status: "invalid" }
      : { status: cleanup === "superseded" ? "superseded" : "uncertain" }
  }
  if (!response.ok) return { status: "uncertain" }

  let responseBody: unknown
  try {
    responseBody = await response.json()
  } catch {
    const cleanup = await clearRefreshSession(original, generation)
    return { status: cleanup === "superseded" ? "superseded" : "uncertain" }
  }
  const parsedResponse = accessTokenResponseSchema.safeParse(responseBody)
  if (!parsedResponse.success) {
    const cleanup = await clearRefreshSession(original, generation)
    return { status: cleanup === "superseded" ? "superseded" : "uncertain" }
  }
  const refreshedToken = parsedResponse.data.accessToken

  if (getAuthGeneration() !== generation) {
    await clearRefreshSession(original, generation, refreshedToken)
    return { status: "superseded" }
  }

  const beforeSync = await currentSession()
  if (getAuthGeneration() !== generation) {
    await clearRefreshSession(original, generation, refreshedToken)
    return { status: "superseded" }
  }
  if (
    !beforeSync ||
    beforeSync.accessToken !== original.accessToken ||
    beforeSync.sessionId !== original.sessionId ||
    beforeSync.userId !== original.userId
  ) {
    await clearRefreshSession(original, generation, refreshedToken)
    return { status: "superseded" }
  }

  try {
    const result = await signIn("credentials", { accessToken: refreshedToken, redirect: false })
    if (getAuthGeneration() !== generation) {
      await clearRefreshSession(original, generation, refreshedToken)
      return { status: "superseded" }
    }

    const verified = await currentSession()
    if (getAuthGeneration() !== generation) {
      await clearRefreshSession(original, generation, refreshedToken)
      return { status: "superseded" }
    }
    if (
      !result?.ok || result.error ||
      !verified ||
      verified.accessToken !== refreshedToken ||
      verified.userId !== original.userId ||
      verified.sessionId === original.sessionId
    ) {
      const cleanup = await clearRefreshSession(original, generation, refreshedToken)
      return { status: cleanup === "superseded" ? "superseded" : "uncertain" }
    }

    return { status: "ready", session: verified }
  } catch {
    const cleanup = await clearRefreshSession(original, generation, refreshedToken)
    return { status: cleanup === "superseded" ? "superseded" : "uncertain" }
  }
}

export async function refreshSession(
  original: SessionSnapshot,
  generation: string,
): Promise<RefreshResult> {
  const key = JSON.stringify([generation, original.accessToken, original.userId, original.sessionId])
  if (refreshInFlight) {
    if (refreshInFlight.key === key) return refreshInFlight.promise
    await refreshInFlight.promise
    return refreshSession(original, generation)
  }

  if (typeof navigator === "undefined" || !navigator.locks) {
    return Promise.resolve({ status: "superseded" })
  }

  const operation = withAuthLock(async (refresh) => {
    // A missing generation means local storage is unavailable; cross-tab safety
    // cannot be established, so do not rotate the one-time refresh cookie.
    if (getAuthGeneration() !== generation) return { status: "superseded" } as const
    return refresh(original, generation)
  })
  const promise = operation.finally(() => {
    if (refreshInFlight?.key === key) refreshInFlight = undefined
  })
  refreshInFlight = { key, promise }
  return promise
}

export type { SessionSnapshot, RefreshResult }

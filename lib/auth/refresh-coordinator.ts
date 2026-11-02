export const AUTH_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

export type BackendCredentials = {
  authSessionId: string
  tokenVersion: number
  backendSessionId: string
  userId: string
  hotelId: string | null
  role: "SUPER_ADMIN" | "OWNER" | "STAFF" | "CLIENT" | "AUTHORITY"
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: number
}

type SessionState = {
  status: "active" | "ending" | "invalid"
  flight?: Promise<BackendCredentials>
  recent?: { credentials: BackendCredentials; expiresAt: number }
  version: number
  expiresAt: number
}

export function createRefreshCoordinator(
  refreshBackend: (current: BackendCredentials) => Promise<BackendCredentials>,
  options: { recentResultTtlMs?: number; now?: () => number } = {},
) {
  const now = options.now ?? Date.now
  const recentTtl = options.recentResultTtlMs ?? 60_000
  const sessions = new Map<string, SessionState>()

  function cleanup() {
    for (const [id, state] of sessions) {
      if (state.recent && state.recent.expiresAt <= now()) state.recent = undefined
      if (state.expiresAt <= now() && !state.flight && state.status !== "ending") {
        sessions.delete(id)
      }
    }
  }
  const timer = setInterval(cleanup, 60_000)
  timer.unref()

  function getState(current: BackendCredentials): SessionState {
    cleanup()
    let state = sessions.get(current.authSessionId)
    if (!state) {
      state = { status: "active", version: current.tokenVersion, expiresAt: 0 }
      sessions.set(current.authSessionId, state)
    }
    state.expiresAt = now() + AUTH_SESSION_MAX_AGE_MS + 60_000
    return state
  }

  function isActive(id: string): boolean {
    cleanup()
    return !sessions.has(id) || sessions.get(id)?.status === "active"
  }

  function invalidate(id: string): void {
    const state = sessions.get(id) ?? { status: "invalid", version: 0, expiresAt: 0 }
    state.status = "invalid"
    state.recent = undefined
    state.expiresAt = now() + AUTH_SESSION_MAX_AGE_MS + 60_000
    sessions.set(id, state)
  }

  // Only the immediately previous cookie can recover from the single cached result.
  function latest(state: SessionState, current: BackendCredentials) {
    if (current.tokenVersion >= state.version) {
      state.version = current.tokenVersion
      return current
    }
    const cached = state.recent
    return cached && cached.expiresAt > now() &&
      current.tokenVersion + 1 === state.version &&
      cached.credentials.tokenVersion === state.version
      ? cached.credentials
      : null
  }

  async function resolve(current: BackendCredentials): Promise<BackendCredentials | null> {
    const state = getState(current)
    if (state.status !== "active") return null
    if (state.flight) await state.flight
    return state.status === "active" ? latest(state, current) : null
  }

  async function refresh(current: BackendCredentials): Promise<BackendCredentials | null> {
    const state = getState(current)
    if (state.status !== "active") return null
    if (state.flight) {
      await state.flight
      return refresh(current)
    }
    const credentials = latest(state, current)
    if (!credentials || credentials.tokenVersion > current.tokenVersion) return credentials

    state.flight = Promise.resolve()
      .then(() => {
        if (state.status === "invalid") throw new Error("Session invalidated during refresh")
        return refreshBackend(credentials)
      })
      .then((next) => {
        if (state.status === "invalid") throw new Error("Session invalidated during refresh")
        if (next.authSessionId !== current.authSessionId ||
          next.tokenVersion !== current.tokenVersion + 1) {
          throw new Error("Invalid refresh result")
        }
        state.version = next.tokenVersion
        state.recent = { credentials: next, expiresAt: now() + recentTtl }
        return next
      })
      .catch((error) => {
        invalidate(current.authSessionId)
        throw error
      })
      .finally(() => { state.flight = undefined })

    const next = await state.flight
    return state.status === "active" ? next : null
  }

  async function end(
    current: BackendCredentials,
    revoke: (latest: BackendCredentials) => Promise<void>,
  ): Promise<boolean> {
    const state = getState(current)
    if (state.status !== "active") return false
    if (!latest(state, current)) return false
    state.status = "ending"
    try {
      const credentials = state.flight ? await state.flight : latest(state, current)
      if (sessions.get(current.authSessionId)?.status === "invalid") return false
      if (!credentials) return false
      await revoke(credentials)
      return true
    } finally {
      // Never restore stale credentials after failed or uncertain revocation.
      invalidate(current.authSessionId)
    }
  }

  return { resolve, refresh, end, invalidate, isActive }
}

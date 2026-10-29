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

type RefreshCoordinatorOptions = {
  recentResultTtlMs?: number
  now?: () => number
}

export function createRefreshCoordinator(
  refreshBackend: (current: BackendCredentials) => Promise<BackendCredentials>,
  options: RefreshCoordinatorOptions = {},
) {
  const recentResultTtlMs = options.recentResultTtlMs ?? 60_000
  const now = options.now ?? Date.now
  const invalidationTtlMs = AUTH_SESSION_MAX_AGE_MS + 60_000
  const pending = new Map<string, Promise<BackendCredentials>>()
  const activeBySession = new Map<string, Promise<BackendCredentials>>()
  const recent = new Map<
    string,
    { credentials: BackendCredentials; expiresAt: number }
  >()
  const invalidated = new Map<string, number>()
  const transitioning = new Set<string>()
  const transitionCounts = new Map<string, number>()
  const transitionQueues = new Map<string, Promise<unknown>>()

  const refreshKey = (sessionId: string, version: number) =>
    `${sessionId}:${version}`

  function isInvalidated(sessionId: string): boolean {
    const expiresAt = invalidated.get(sessionId)

    if (expiresAt === undefined) return false
    if (expiresAt > now()) return true

    invalidated.delete(sessionId)
    return false
  }

  function getRecent(sessionId: string, version: number): BackendCredentials | null {
    for (const [key, cached] of recent) {
      if (cached.expiresAt <= now()) recent.delete(key)
    }

    if (isInvalidated(sessionId)) return null

    const key = refreshKey(sessionId, version)
    const cached = recent.get(key)

    if (!cached) return null

    if (cached.expiresAt <= now()) {
      recent.delete(key)
      return null
    }

    return cached.credentials
  }

  function refresh(
    current: BackendCredentials,
    allowDuringTransition = false,
  ): Promise<BackendCredentials> {
    const { authSessionId, tokenVersion } = current

    if (
      isInvalidated(authSessionId) ||
      (transitioning.has(authSessionId) && !allowDuringTransition)
    ) {
      return Promise.reject(new Error("Authentication session is invalidated"))
    }

    const key = refreshKey(authSessionId, tokenVersion)
    const cached = getRecent(authSessionId, tokenVersion)

    if (cached) return Promise.resolve(cached)

    const currentFlight = pending.get(key)

    if (currentFlight) return currentFlight

    const operation = Promise.resolve()
      .then(() => refreshBackend(current))
      .then((next) => {
        if (isInvalidated(authSessionId)) {
          throw new Error("Authentication session was invalidated during refresh")
        }

        if (
          next.authSessionId !== authSessionId ||
          next.tokenVersion !== tokenVersion + 1
        ) {
          throw new Error("Backend returned an invalid token version")
        }

        recent.set(key, {
          credentials: next,
          expiresAt: now() + recentResultTtlMs,
        })

        return next
      })
      .finally(() => {
        pending.delete(key)
        if (activeBySession.get(authSessionId) === operation) {
          activeBySession.delete(authSessionId)
        }
      })

    pending.set(key, operation)
    activeBySession.set(authSessionId, operation)

    return operation
  }

  async function getLatest(
    current: BackendCredentials,
  ): Promise<BackendCredentials> {
    if (isInvalidated(current.authSessionId)) {
      throw new Error("Authentication session is invalidated")
    }

    const active = activeBySession.get(current.authSessionId)

    if (active) {
      try {
        return await active
      } catch {
        // Use the supplied credentials only if no completed rotation is available.
      }
    }

    return getRecent(current.authSessionId, current.tokenVersion) ?? current
  }

  async function waitForTransition(
    current: BackendCredentials,
  ): Promise<BackendCredentials> {
    const transition = transitionQueues.get(current.authSessionId)

    if (transition) {
      try {
        await transition
      } catch {
        // Read the current session state below and fail closed if invalidated.
      }
    }

    return getLatest(current)
  }

  async function runSessionTransition<T>(
    sessionId: string,
    operation: (latest: BackendCredentials | null) => Promise<T>,
    current?: BackendCredentials,
  ): Promise<T> {
    const previous = transitionQueues.get(sessionId) ?? Promise.resolve()
    transitioning.add(sessionId)
    transitionCounts.set(sessionId, (transitionCounts.get(sessionId) ?? 0) + 1)

    const result = previous
      .catch(() => undefined)
      .then(async () => {
        const active = activeBySession.get(sessionId)

        if (active) {
          try {
            await active
          } catch {
            // The caller can still revoke with its last known credentials.
          }
        }

        const latest =
          current && !isInvalidated(sessionId)
            ? await getLatest(current)
            : null
        return operation(latest)
      })

    transitionQueues.set(sessionId, result)

    try {
      return await result
    } finally {
      if (transitionQueues.get(sessionId) === result) {
        transitionQueues.delete(sessionId)
      }

      const remainingTransitions = (transitionCounts.get(sessionId) ?? 1) - 1

      if (remainingTransitions <= 0) {
        transitionCounts.delete(sessionId)
        transitioning.delete(sessionId)
      } else {
        transitionCounts.set(sessionId, remainingTransitions)
      }
    }
  }

  function invalidate(sessionId: string, expiresAt?: number): void {
    for (const [id, expiry] of invalidated) {
      if (expiry <= now()) invalidated.delete(id)
    }

    invalidated.set(
      sessionId,
      Math.max(expiresAt ?? 0, now() + invalidationTtlMs),
    )

    for (const key of recent.keys()) {
      if (key.startsWith(`${sessionId}:`)) recent.delete(key)
    }
  }

  return {
    refresh,
    getLatest,
    waitForTransition,
    getRecent,
    runSessionTransition,
    invalidate,
    isInvalidated,
    isTransitioning: (sessionId: string) => transitioning.has(sessionId),
  }
}

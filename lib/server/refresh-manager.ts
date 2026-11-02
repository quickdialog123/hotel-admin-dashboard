import "server-only"

import { createRefreshCoordinator, type BackendCredentials } from "@/lib/auth/refresh-coordinator"
import { logoutWithNest, NestApiError, refreshWithNest } from "@/lib/server/nest-api"

export const refreshManager = createRefreshCoordinator(refreshWithNest, {
  recentResultTtlMs: 60_000,
})

export function endBackendSession(credentials: BackendCredentials): Promise<boolean> {
  return refreshManager.end(credentials, async (current) => {
    // The coordinator has blocked new refreshes and waited for any active one.
    let refreshed = false
    if (current.accessTokenExpiresAt <= Date.now() + 30_000) {
      current = await refreshWithNest(current)
      refreshed = true
    }
    try {
      await logoutWithNest(current)
    } catch (error) {
      if (refreshed || !(error instanceof NestApiError) || error.status !== 401) throw error
      await logoutWithNest(await refreshWithNest(current))
    }
  })
}

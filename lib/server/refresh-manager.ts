import "server-only"

import { createRefreshCoordinator } from "@/lib/auth/refresh-coordinator"
import { refreshWithNest } from "@/lib/server/nest-api"

export const refreshManager = createRefreshCoordinator(refreshWithNest, {
  recentResultTtlMs: 60_000,
})

import type { QueryClient } from "@tanstack/react-query"

export function clearAuthQueryCache(queryClient: QueryClient): void {
  queryClient.clear()
}

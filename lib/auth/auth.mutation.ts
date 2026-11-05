import type { QueryClient, UseMutationOptions } from "@tanstack/react-query"

import {
  AuthFlowError,
  logoutUser,
} from "./auth.api"
import type { LogoutResult } from "./auth.api"
import { authKeys } from "./auth.keys"

const privateQueryPrefixes = [["whatsapp"]] as const

async function clearPrivateQueryCache(queryClient: QueryClient) {
  await Promise.all(
    privateQueryPrefixes.map((queryKey) =>
      queryClient.cancelQueries({ queryKey }),
    ),
  )

  for (const queryKey of privateQueryPrefixes) {
    queryClient.removeQueries({ queryKey })
  }
}

export function loginMutationOptions(
  queryClient: QueryClient,
): Omit<UseMutationOptions<void, AuthFlowError, void>, "mutationFn" | "onSettled"> {
  return {
    mutationKey: [...authKeys.all, "login"],
    onSuccess: () => clearPrivateQueryCache(queryClient),
  }
}

export function logoutMutationOptions(
  queryClient: QueryClient,
): UseMutationOptions<LogoutResult, AuthFlowError, void> {
  return {
    mutationKey: [...authKeys.all, "logout"],
    mutationFn: logoutUser,
    onSettled: async (data, error) => {
      if (data?.frontendSignedOut || error?.frontendSignedOut) {
        await clearPrivateQueryCache(queryClient)
      }
    },
  }
}

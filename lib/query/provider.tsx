"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"

export function QueryProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [queryClient] =
    useState(
      () =>
        new QueryClient({
          defaultOptions: {
            queries: {
              staleTime: 30_000,
              refetchOnWindowFocus: false,
              retry: ( failureCount, error) => {
                const status = typeof error === "object" && error !== null && "status" in error
                    ? Number(
                        error.status,
                      )
                    : 0

                if (status >= 400 && status < 500) return false

                return failureCount < 2
              },
            },

            mutations: {
              retry: false,
            },
          },
        }),
    )

  return (
    <QueryClientProvider
      client={queryClient}
    >
      {children}
    </QueryClientProvider>
  )
}
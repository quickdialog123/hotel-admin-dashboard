"use client"

import { useCallback, useRef } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import type { LoginCredentials } from "@/lib/api/auth-schemas"
import { AuthFlowError, loginUser } from "./auth.api"
import { loginMutationOptions, logoutMutationOptions } from "./auth.mutation"

export function useLogin() {
  const queryClient = useQueryClient()
  const credentialsRef = useRef<LoginCredentials | null>(null)
  const submissionLock = useRef(false)

  const mutation = useMutation({
    ...loginMutationOptions(queryClient),
    mutationFn: () => {
      const credentials = credentialsRef.current
      if (!credentials) throw new AuthFlowError("LOGIN_FAILED")
      return loginUser(credentials)
    },
    onSettled: () => {
      credentialsRef.current = null
      submissionLock.current = false
    },
  })
  const { isPending, mutate } = mutation

  const submitCredentials = useCallback(
    (credentials: LoginCredentials) => {
      if (submissionLock.current || isPending) return

      submissionLock.current = true
      credentialsRef.current = credentials
      mutate()
    },
    [isPending, mutate],
  )

  return {
    ...mutation,
    submitCredentials,
    cleanupFailed: mutation.error?.code === "LOGIN_CLEANUP_FAILED",
  }
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation(logoutMutationOptions(queryClient))
}

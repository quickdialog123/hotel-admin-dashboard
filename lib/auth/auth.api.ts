import { HTTPError } from "ky"
import { signIn, signOut } from "next-auth/react"
import { z } from "zod"

import { apiClient } from "@/lib/api/client"
import {
  accessTokenResponseSchema,
  currentUserSchema,
  loginCredentialsSchema,
} from "@/lib/api/auth-schemas"
import type { LoginCredentials } from "@/lib/api/auth-schemas"
import {
  AuthLockUnavailableError,
  beginAuthTransition,
  getAuthGeneration,
  withAuthLock,
} from "./refresh"
import type { RefreshResult, SessionSnapshot } from "./refresh"

export type AuthFlowErrorCode =
  | "INVALID_CREDENTIALS"
  | "LOGIN_FAILED"
  | "LOGIN_CLEANUP_FAILED"
  | "BACKEND_LOGOUT_FAILED"
  | "FRONTEND_LOGOUT_FAILED"
  | "LOGOUT_FAILED"

export class AuthFlowError extends Error {
  constructor(
    readonly code: AuthFlowErrorCode,
    readonly frontendSignedOut = false,
  ) {
    super(code)
    this.name = "AuthFlowError"
  }
}

export type LogoutResult = {
  backendRequestAccepted: boolean
  frontendSignedOut: true
}

const sessionTokenSchema = z.object({
  accessToken: z.string().min(1),
  user: currentUserSchema,
})

async function readFrontendSession() {
  const response = await fetch("/api/auth/session", {
    cache: "no-store",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  })
  if (!response.ok) throw new Error("Session check failed")

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new Error("Session check failed")
  }

  if (
    typeof body === "object" &&
    body !== null &&
    !Array.isArray(body) &&
    Object.keys(body).length === 0
  ) {
    return null
  }

  const session = sessionTokenSchema.safeParse(body)
  if (!session.success) throw new Error("Session check failed")
  return {
    accessToken: session.data.accessToken,
    userId: session.data.user.userId,
    sessionId: session.data.user.sessionId,
  }
}

async function revokeBackendSession(accessToken: string) {
  const response = await apiClient.post("auth/logout", {
    headers: { Authorization: `Bearer ${accessToken}` },
    redirect: "error",
  })
  if (response.status !== 204) throw new Error("Logout request failed")
}

async function signOutFrontend() {
  try {
    await signOut({ redirect: false })
    return (await readFrontendSession()) === null
  } catch {
    return false
  }
}

async function signOutFrontendForTransition(generation: string | null) {
  if (!isAuthTransitionCurrent(generation)) return false
  return signOutFrontend()
}

function isAuthTransitionCurrent(generation: string | null) {
  return generation === null || getAuthGeneration() === generation
}

async function clearPartialLogin(accessToken: string): Promise<void> {
  await Promise.allSettled([
    revokeBackendSession(accessToken),
    signOutFrontend(),
  ])
}

async function loginUserLocked(credentials: LoginCredentials): Promise<void> {
  const validatedCredentials = loginCredentialsSchema.safeParse(credentials)
  if (!validatedCredentials.success) throw new AuthFlowError("LOGIN_FAILED")

  let accessToken: string | undefined

  try {
    const response = await apiClient
      .post("auth/login", {
        json: validatedCredentials.data,
        context: { skipAuth: true },
        redirect: "error",
      })
      .json()
    accessToken = accessTokenResponseSchema.parse(response).accessToken

    const result = await signIn("credentials", {
      accessToken,
      redirect: false,
    })

    if (!result?.ok || result.error) {
      throw new AuthFlowError("LOGIN_FAILED")
    }

    const session = await readFrontendSession()
    if (!session?.accessToken || session.accessToken !== accessToken) {
      throw new AuthFlowError("LOGIN_FAILED")
    }
  } catch (error) {
    if (error instanceof HTTPError && error.response.status === 401 && !accessToken) {
      throw new AuthFlowError("INVALID_CREDENTIALS")
    }

    if (!accessToken) {
      await signOutFrontend()
      throw new AuthFlowError("LOGIN_CLEANUP_FAILED")
    }

    await clearPartialLogin(accessToken)
    // Logout's 204 cannot prove that a refresh cookie existed or was revoked.
    throw new AuthFlowError("LOGIN_CLEANUP_FAILED")
  }
}

export async function loginUser(credentials: LoginCredentials): Promise<void> {
  try {
    return await withAuthLock(async () => {
      beginAuthTransition()
      return loginUserLocked(credentials)
    })
  } catch (error) {
    if (error instanceof AuthLockUnavailableError) {
      throw new AuthFlowError("LOGIN_FAILED")
    }
    throw error
  }
}

async function logoutUserLocked(
  generation: string | null,
  refresh: (original: SessionSnapshot, generation: string) => Promise<RefreshResult>,
): Promise<LogoutResult> {
  let session: SessionSnapshot | null
  try {
    session = await readFrontendSession()
  } catch {
    const frontendSignedOut = await signOutFrontendForTransition(generation)
    throw new AuthFlowError("LOGOUT_FAILED", frontendSignedOut)
  }

  if (!isAuthTransitionCurrent(generation)) {
    throw new AuthFlowError("LOGOUT_FAILED")
  }

  if (!session) {
    return { backendRequestAccepted: false, frontendSignedOut: true }
  }

  let backendRequestAccepted = false
  try {
    await revokeBackendSession(session.accessToken)
    backendRequestAccepted = true
  } catch (error) {
    if (error instanceof HTTPError && error.response.status === 401 && generation) {
      try {
        const refreshed = await refresh(session, generation)
        const refreshedSession = refreshed.status === "ready" ? refreshed.session : undefined

        if (
          refreshedSession &&
          refreshedSession.userId === session.userId &&
          refreshedSession.accessToken !== session.accessToken &&
          refreshedSession.sessionId !== session.sessionId &&
          getAuthGeneration() === generation
        ) {
          await revokeBackendSession(refreshedSession.accessToken)
          backendRequestAccepted = true
        }
      } catch {
        // Refresh failure must not prevent the local sign-out below.
      }
    }
  }

  const frontendSignedOut = await signOutFrontendForTransition(generation)
  if (!backendRequestAccepted) {
    throw new AuthFlowError("BACKEND_LOGOUT_FAILED", frontendSignedOut)
  }
  if (!frontendSignedOut) throw new AuthFlowError("FRONTEND_LOGOUT_FAILED")

  // A successful 204 only confirms the request was accepted, not that a cookie existed.
  return { backendRequestAccepted: true, frontendSignedOut: true }
}

export async function logoutUser(): Promise<LogoutResult> {
  try {
    return await withAuthLock((refresh) => {
      const generation = beginAuthTransition()
      return logoutUserLocked(generation, refresh)
    })
  } catch (error) {
    if (!(error instanceof AuthLockUnavailableError)) throw error
    if (!error.allowLocalSignOut) throw new AuthFlowError("LOGOUT_FAILED")

    // Login and refresh fail closed without Web Locks; only local cleanup is safe here.
    const frontendSignedOut = await signOutFrontend()
    if (!frontendSignedOut) throw new AuthFlowError("FRONTEND_LOGOUT_FAILED")
    throw new AuthFlowError("BACKEND_LOGOUT_FAILED", true)
  }
}

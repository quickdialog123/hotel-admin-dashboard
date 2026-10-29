import "server-only"

import NextAuth, { CredentialsSignin } from "next-auth"
import type { DefaultSession } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { randomUUID } from "node:crypto"

import {
  currentUserSchema,
  loginInputSchema,
} from "@/lib/api/auth-schemas"
import { publicSessionUser } from "@/lib/auth/session-projection"
import {
  AUTH_SESSION_MAX_AGE_MS,
  type BackendCredentials,
} from "@/lib/auth/refresh-coordinator"
import { applyBackendTokenUpdate } from "@/lib/auth/token-update"
import {
  backendCredentialsFromJwt,
  backendCredentialsFromRequest,
} from "@/lib/server/auth-session"
import { getServerEnv } from "@/lib/server/env"
import { NestApiError, loginWithNest, logoutWithNest } from "@/lib/server/nest-api"
import { refreshManager } from "@/lib/server/refresh-manager"

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  useSecureCookies:
    process.env.FRONTEND_ORIGIN?.startsWith("https://") ??
    process.env.NODE_ENV === "production",
  session: {
    strategy: "jwt",
    maxAge: AUTH_SESSION_MAX_AGE_MS / 1000,
  },
  providers: [
    Credentials({
      credentials: {
        email: { type: "email", label: "Email" },
        password: { type: "password", label: "Password" },
      },
      async authorize(credentials, request) {
        const parsed = loginInputSchema.safeParse(credentials)
        if (!parsed.success) return null

        const previousCredentials = await backendCredentialsFromRequest(request)
        let backendCredentials: BackendCredentials

        try {
          backendCredentials = await loginWithNest(parsed.data, randomUUID())
        } catch (error) {
          if (error instanceof NestApiError && error.status === 401) return null

          console.error("Nest login request failed", {
            status: error instanceof NestApiError ? error.status : undefined,
          })
          throw new CredentialsSignin()
        }

        if (
          previousCredentials &&
          !refreshManager.isInvalidated(previousCredentials.authSessionId)
        ) {
          try {
            await refreshManager.runSessionTransition(
              previousCredentials.authSessionId,
              async (latest) => {
                let previous = latest ?? previousCredentials

                if (previous.accessTokenExpiresAt <= Date.now() + 30_000) {
                  previous = await refreshManager.refresh(previous, true)
                }

                await logoutWithNest(previous)
                refreshManager.invalidate(
                  previousCredentials.authSessionId,
                  previous.accessTokenExpiresAt + 60_000,
                )
              },
              previousCredentials,
            )
          } catch (error) {
            try {
              await logoutWithNest(backendCredentials)
            } catch (cleanupError) {
              // The uncommitted backend session expires under Nest's session policy.
              console.error("Could not revoke the uncommitted backend login session", {
                status:
                  cleanupError instanceof NestApiError
                    ? cleanupError.status
                    : undefined,
              })
            }

            throw error
          }
        }

        const currentUser = currentUserSchema.parse({
          userId: backendCredentials.userId,
          sessionId: backendCredentials.backendSessionId,
          hotelId: backendCredentials.hotelId,
          role: backendCredentials.role,
        })

        return {
          id: currentUser.userId,
          email: parsed.data.email,
          ...currentUser,
          authSessionId: backendCredentials.authSessionId,
          tokenVersion: backendCredentials.tokenVersion,
          backendSessionId: backendCredentials.backendSessionId,
          accessToken: backendCredentials.accessToken,
          refreshToken: backendCredentials.refreshToken,
          accessTokenExpiresAt: backendCredentials.accessTokenExpiresAt,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        const credentials = user as typeof user & BackendCredentials

        return {
          ...token,
          sub: credentials.userId,
          userId: credentials.userId,
          hotelId: credentials.hotelId,
          role: credentials.role,
          authSessionId: credentials.authSessionId,
          backendSessionId: credentials.backendSessionId,
          backendTokenVersion: credentials.tokenVersion,
          backendAccessToken: credentials.accessToken,
          backendRefreshToken: credentials.refreshToken,
          backendAccessTokenExpiresAt: credentials.accessTokenExpiresAt,
        }
      }

      if (!backendCredentialsFromJwt(token)) return null

      if (
        typeof token.authSessionId === "string" &&
        refreshManager.isInvalidated(token.authSessionId)
      ) {
        return null
      }

      if (trigger === "update") {
        return applyBackendTokenUpdate(
          token as Record<string, unknown>,
          session?.backendTokenUpdate,
          getServerEnv().AUTH_SECRET,
        ) as typeof token | null
      }

      return token
    },
    async session({ session, token }) {
      if (
        typeof token.userId === "string" &&
        (token.hotelId === null || typeof token.hotelId === "string") &&
        typeof token.role === "string"
      ) {
        session.user = {
          ...session.user,
          ...publicSessionUser({
            userId: token.userId,
            hotelId: token.hotelId,
            role: token.role as BackendCredentials["role"],
          }),
        }
      }

      return session
    },
  },
})

declare module "next-auth" {
  interface User extends BackendCredentials {
    email?: string | null
  }

  interface Session {
    user: DefaultSession["user"] & {
      id: string
      userId: string
      hotelId: string | null
      role: BackendCredentials["role"]
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT extends Partial<BackendCredentials> {
    userId?: string
  }
}

import "server-only"

import CredentialsProvider from "next-auth/providers/credentials"
import type { NextAuthOptions } from "next-auth"
import { z } from "zod"
import { clientEnv } from "./env/client"
import { serverEnv } from "./env/server"
import { currentUserSchema } from "./api/auth-schemas"

const accessTokenSchema = z
  .string()
  .max(8192)
  .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)

async function authorizeAccessToken(value: unknown) {
  const parsedToken = accessTokenSchema.safeParse(value)
  if (!parsedToken.success) return null

  let response: Response
  try {
    const apiBaseUrl = clientEnv.NEXT_PUBLIC_API_BASE_URL.replace(/\/+$/, "")
    response = await fetch(`${apiBaseUrl}/auth/me`, {
      headers: {
        Authorization: `Bearer ${parsedToken.data}`,
        Origin: serverEnv.FRONTEND_ORIGIN,
      },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    })
  } catch {
    throw new Error("Backend authentication service is unavailable")
  }

  if (response.status === 401 || response.status === 403) return null
  if (!response.ok) {
    throw new Error("Backend authentication service is unavailable")
  }

  let responseBody: unknown
  try {
    responseBody = await response.json()
  } catch {
    throw new Error("Backend authentication service returned invalid data")
  }

  const parsedUser = currentUserSchema.safeParse(responseBody)
  if (!parsedUser.success) return null

  return {
    id: parsedUser.data.userId,
    ...parsedUser.data,
    accessToken: parsedToken.data,
  }
}

export const authOptions: NextAuthOptions = {
  secret: serverEnv.AUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: "Backend access token",
      credentials: {
        accessToken: { label: "Access token", type: "password" },
      },
      authorize: async (credentials) =>
        authorizeAccessToken(credentials?.accessToken),
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (trigger === "update") {
        // Token updates are ignored until the refresh flow can validate them.
        return token
      }

      if (user) {
        token.backendAccessToken = user.accessToken
        token.backendUser = {
          userId: user.userId,
          sessionId: user.sessionId,
          hotelId: user.hotelId,
          role: user.role,
        }
      }

      return token
    },
    async session({ session, token }) {
      if (!token.backendAccessToken || !token.backendUser) {
        throw new Error("Auth.js session is missing verified backend identity")
      }

      session.accessToken = token.backendAccessToken
      session.user = token.backendUser
      return session
    },
  },
}

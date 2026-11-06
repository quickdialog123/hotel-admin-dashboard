
import "server-only"

import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { z } from "zod"

import { currentUserSchema } from "@/lib/api/auth-schemas"
import { clientEnv } from "@/lib/env/client"
import { serverEnv } from "@/lib/env/server"

const accessTokenSchema = z
  .string()
  .max(8192)
  .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)

export const authOptions: NextAuthOptions = {
  secret: serverEnv.AUTH_SECRET,

  session: {
    strategy: "jwt",
  },

  pages: {
    signIn: "/login",
  },

  providers: [
    CredentialsProvider({
      name: "Credentials",

      credentials: {
        accessToken: { type: "text" },
      },

      async authorize(credentials) {
        const parsed = accessTokenSchema.safeParse(
          credentials?.accessToken
        )

        if (!parsed.success) return null

        const response = await fetch(
          `${clientEnv.NEXT_PUBLIC_API_BASE_URL}/auth/me`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${parsed.data}`,
              Origin: serverEnv.FRONTEND_ORIGIN,
            },
            cache: "no-store",
            signal: AbortSignal.timeout(8_000),
          }
        )

        if (!response.ok) return null

        const user = currentUserSchema.safeParse(
          await response.json()
        )

        if (!user.success) return null

        return {
          ...user.data,
          id: user.data.userId,
          accessToken: parsed.data,
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.backendAuth = {
          accessToken: user.accessToken,
          user: {
            userId: user.userId,
            sessionId: user.sessionId,
            hotelId: user.hotelId,
            role: user.role,
          },
        }
      }

      return token
    },

    async session({ session, token }) {
      if (!token.backendAuth) {
        throw new Error("Invalid authentication session")
      }

      return {
        ...session,
        accessToken: token.backendAuth.accessToken,
        user: token.backendAuth.user,
      }
    },
  },
}

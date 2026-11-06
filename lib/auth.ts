import "server-only";

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";

import { currentUserSchema } from "@/lib/api/auth-schemas";
import { clientEnv } from "@/lib/env/client";
import { serverEnv } from "@/lib/env/server";

const accessTokenSchema = z
  .string()
  .max(8192)
  .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

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
          credentials?.accessToken,
        );

        console.log("authOptions authorize parsed:", parsed);

        if (!parsed.success) return null;

        const response = await fetch(
          `${clientEnv.NEXT_PUBLIC_API_BASE_URL}/auth/me`,
          {
            headers: {
              Authorization: `Bearer ${parsed.data}`,
              "Content-Type": "application/json",
              "origin": serverEnv.FRONTEND_ORIGIN,
            },
        
            cache: "no-store",
            signal: AbortSignal.timeout(8_000),
          },
        );


        console.log("Authorize status:", response.status);

if (!response.ok) {
  console.error(
    "Authorize response:",
    await response.text(),
  );

  return null;
}

        const user = currentUserSchema.parse(
          await response.json(),
        );

        return {
          id: user.userId,
          ...user,
          accessToken: parsed.data,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.backendAccessToken = user.accessToken;

        token.backendUser = {
          userId: user.userId,
          sessionId: user.sessionId,
          hotelId: user.hotelId,
          role: user.role,
        };
      }

      return token;
    },

    async session({ session, token }) {
      if (!token.backendAccessToken || !token.backendUser) {
        throw new Error("Invalid authentication session");
      }

      session.accessToken = token.backendAccessToken;
      session.user = token.backendUser;

      return session;
    },
  },
};
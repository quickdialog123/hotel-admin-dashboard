import ky from "ky";
import { getSession, signIn, signOut } from "next-auth/react";

import { clientEnv } from "@/lib/env/client";
import {
  loginCredentialsSchema,
  accessTokenResponseSchema,
  type LoginCredentials,
} from "@/lib/api/auth-schemas";

const authClient = ky.create({
  prefix: clientEnv.NEXT_PUBLIC_API_BASE_URL,
  credentials: "include",
  retry: { limit: 0 },
});

export async function loginUser(credentials: LoginCredentials) {
  const input = loginCredentialsSchema.parse(credentials);

  const data = await authClient
    .post("auth/login", { json: input })
    .json();

  const { accessToken } = accessTokenResponseSchema.parse(data);

  const result = await signIn("credentials", {
    accessToken,
    redirect: false,
  });

  if (!result?.ok || result.error) {
    throw new Error("Unable to create session");
  }
}

let refreshPromise: Promise<string> | null = null;

export function refreshAccessToken(oldToken: string): Promise<string> {
  if (refreshPromise) return refreshPromise;

  if (!navigator.locks) {
    return Promise.reject(new Error("Secure refresh unavailable"));
  }

  refreshPromise = navigator.locks
    .request("qd-auth-refresh", async () => {
      const session = await getSession({ broadcast: false });

      if (!session?.accessToken) {
        throw new Error("Not authenticated");
      }

      // Another tab may have refreshed already.
      if (session.accessToken !== oldToken) {
        return session.accessToken;
      }

      const data = await authClient.post("auth/refresh").json();
      const { accessToken } = accessTokenResponseSchema.parse(data);

      const result = await signIn("credentials", {
        accessToken,
        redirect: false,
      });

      if (!result?.ok || result.error) {
        await signOut({ redirect: false });
        throw new Error("Session refresh failed");
      }

      return accessToken;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

export async function logoutUser() {
  try {
    const session = await getSession();

    if (session?.accessToken) {
      await authClient.post("auth/logout", {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      });
    }
  } finally {
    await signOut({ redirect: false });
  }
}
import ky, { HTTPError } from "ky";
import { getSession, signOut } from "next-auth/react";
import type { z } from "zod";

import { clientEnv } from "@/lib/env/client";
import { refreshAccessToken } from "@/lib/auth/auth.api";

let sessionEndPromise: Promise<unknown> | null = null;

function endSession() {
  if (!sessionEndPromise) {
    sessionEndPromise = signOut({
      callbackUrl: new URL("/login", clientEnv.NEXT_PUBLIC_FRONTEND_ORIGIN).href,
    }).finally(() => {
      sessionEndPromise = null;
    });
  }

  return sessionEndPromise;
}

export const apiClient = ky.create({
prefix: clientEnv.NEXT_PUBLIC_API_BASE_URL,
credentials: "include",
timeout: 15_000,

retry: {
limit: 1,
methods: ["get"],
statusCodes: [408, 429, 500, 502, 503, 504],
},

hooks: {
beforeError: [
({ error }) => {
  if (
    "data" in error &&
    typeof error.data === "object" &&
    error.data !== null &&
    "message" in error.data &&
    typeof error.data.message === "string"
  ) {
    error.message = error.data.message;
  }

  return error;
},
],

beforeRequest: [
async ({ request, options }) => {
const session = await getSession({ broadcast: false });

    if (!session?.accessToken) {
      await endSession();
      throw new Error("Your session has ended. Sign in again.");
    }

    request.headers.set(
      "Authorization",
      `Bearer ${session.accessToken}`,
    );

    // Prevent retrying a request under another user's session.
    options.context.userId = session.user.userId;
  },
],

afterResponse: [
  async ({ request, options, response, retryCount }) => {
    if (
      response.status !== 401 ||
      retryCount > 0
    ) {
      return;
    }

    const previousToken = request.headers
      .get("Authorization")
      ?.replace(/^Bearer /, "");

    const userId = options.context.userId;

    if (!previousToken || typeof userId !== "string") {
      await endSession();
      return;
    }

    try {
      const accessToken = await refreshAccessToken(previousToken);
      const session = await getSession({ broadcast: false });

      if (session?.user.userId !== userId) {
        await endSession();
        return;
      }

      request.headers.set(
        "Authorization",
        `Bearer ${accessToken}`,
      );

      const retriedResponse = await ky(request, {
        retry: { limit: 0 },
        throwHttpErrors: false,
      });
      if (retriedResponse.status === 401) await endSession();
      return retriedResponse;
    } catch (error) {
      if (
        (error instanceof HTTPError && [401, 403].includes(error.response.status)) ||
        (error instanceof Error && ["Not authenticated", "Session refresh failed"].includes(error.message))
      ) {
        await endSession();
        throw new Error("Your session has ended. Sign in again.");
      }
      throw error;
    }
  },
],

},
});

export async function getJson<T>(
url: string,
schema: z.ZodType<T>,
searchParams?: Record<string, string>,
): Promise<T> {
const data = await apiClient
.get(url, { searchParams })
.json();

return schema.parse(data);
}

export async function postJson<TResponse, TBody>(
url: string,
body: TBody,
responseSchema: z.ZodType<TResponse>,
inputSchema?: z.ZodType<TBody>,
): Promise<TResponse> {
const json = inputSchema ? inputSchema.parse(body) : body;

const data = await apiClient
.post(url, { json })
.json();

return responseSchema.parse(data);
}

export async function patchJson<
  TResponse,
  TBody,
>(
  url: string,
  body: TBody,
  responseSchema: z.ZodType<TResponse>,
  inputSchema?: z.ZodType<TBody>,
): Promise<TResponse> {
  const json =
    inputSchema
      ? inputSchema.parse(body)
      : body

  const data = await apiClient
    .patch(url, { json })
    .json()

  return responseSchema.parse(data)
}

export async function deleteJson<TResponse>(
  url: string,
  responseSchema: z.ZodType<TResponse>,
): Promise<TResponse> {
  const data = await apiClient
    .delete(url)
    .json()

  return responseSchema.parse(data)
}

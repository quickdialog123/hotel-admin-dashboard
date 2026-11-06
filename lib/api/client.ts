import ky from "ky";
import { getSession } from "next-auth/react";
import type { z } from "zod";

import { clientEnv } from "@/lib/env/client";
import { refreshAccessToken } from "@/lib/auth/auth.api";

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
beforeRequest: [
async ({ request, options }) => {
const session = await getSession({ broadcast: false });

    if (!session?.accessToken) return;

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
      retryCount > 0 ||
      request.method !== "GET"
    ) {
      return;
    }

    const previousToken = request.headers
      .get("Authorization")
      ?.replace(/^Bearer /, "");

    const userId = options.context.userId;

    if (!previousToken || typeof userId !== "string") {
      return;
    }

    try {
      const accessToken = await refreshAccessToken(previousToken);
      const session = await getSession({ broadcast: false });

      if (
        session?.user.userId !== userId ||
        session.accessToken !== accessToken
      ) {
        return;
      }

      request.headers.set(
        "Authorization",
        `Bearer ${accessToken}`,
      );

      return ky(request, {
        retry: { limit: 0 },
      });
    } catch {
      // Leave the original 401 response unchanged.
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
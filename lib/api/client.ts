import ky from "ky"
import type { z } from "zod"

function getBffPrefix(): string {
  const origin =
    typeof window === "undefined"
      ? process.env.NEXT_PUBLIC_APP_ORIGIN ?? "http://localhost:3000"
      : window.location.origin

  return new URL("/api/bff", origin).toString()
}

export const apiClient = ky.create({
  prefix: getBffPrefix(),
  credentials: "same-origin",
  timeout: 15_000,
  headers: {
    "Content-Type": "application/json",
  },
  retry: {
    limit: 1,
    methods: ["get"],
    statusCodes: [408, 429, 500, 502, 503, 504],
  },
  hooks: {
    afterResponse: [async ({ response }) => {
      if (response.status === 401 && typeof window !== "undefined") {
        window.location.replace("/login")
        return
      }

      if (response.status === 409 && typeof window !== "undefined") {
        const body: unknown = await response.clone().json().catch(() => null)

        if (
          typeof body === "object" &&
          body !== null &&
          "code" in body &&
          body.code === "SESSION_REPLACED"
        ) {
          window.location.replace("/login")
        }
      }
    }],
  },
})

export async function getJson<T>(
  url: string,
  schema: z.ZodType<T>,
  searchParams?: Record<string, string>,
): Promise<T> {
  const data: unknown = await apiClient
    .get(url, { searchParams })
    .json()

  return schema.parse(data)
}

export async function postJson<TResponse, TBody>(
  url: string,
  body: TBody,
  responseSchema: z.ZodType<TResponse>,
  inputSchema?: z.ZodType<TBody>,
): Promise<TResponse> {
  const json = inputSchema ? inputSchema.parse(body) : body
  const data: unknown = await apiClient.post(url, { json }).json()

  return responseSchema.parse(data)
}

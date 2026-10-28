import ky from "ky"
import type { z } from "zod"
import { env } from "@/lib/env"


export const apiClient = ky.create({
  prefix: env.NEXT_PUBLIC_API_URL,
  credentials: "include",
  timeout: 15_000,
  headers: {
    "Content-Type": "application/json",
  },
  retry: {
    limit: 1,
    methods: ["get"],
    statusCodes: [
      408,
      429,
      500,
      502,
      503,
      504,
    ],
  },
  hooks: {
    afterResponse: [
      // TODO(QD-60):
      // Keep auth lifecycle centralized here.
      // Later handle 401 -> refresh session -> retry once.
    ],
  },
})


export async function getJson<T>(
  url: string,
  schema: z.ZodType<T>,
  searchParams?: Record< string, string >
) {
  const data = await apiClient.get(url, { searchParams }).json()

  return schema.parse(data)
}

export async function postJson<
  TResponse,
  TBody,
>(
  url: string,
  body: TBody,
  responseSchema: z.ZodType<TResponse>,
  inputSchema?: z.ZodType<TBody>
) {
  const json =
    inputSchema
      ? inputSchema.parse(body)
      : body

  const data = await apiClient.post(url, { json }).json()

  return responseSchema.parse(data)
}

import ky from "ky"
import type { z } from "zod"
import { getSession } from "next-auth/react"
import { clientEnv } from "@/lib/env/client"
import { currentUserSchema } from "@/lib/api/auth-schemas"
import { getAuthGeneration, refreshSession } from "@/lib/auth/refresh"

type AutomaticAuth = {
  marker: object
  accessToken: string
  userId: string
  sessionId: string
  generation: string
}

const automaticAuthContextKey = "__qdAutomaticAuth"
const automaticAuthMarker = Object.freeze({})

const apiBaseUrl = new URL(clientEnv.NEXT_PUBLIC_API_BASE_URL)
const apiBasePath = apiBaseUrl.pathname.replace(/\/+$/, "")

function targetsConfiguredApi(requestUrl: string) {
  const url = new URL(requestUrl)
  return url.origin === apiBaseUrl.origin &&
    (!apiBasePath || url.pathname === apiBasePath || url.pathname.startsWith(`${apiBasePath}/`))
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
    beforeRequest: [
      async ({ request, options }) => {
        const requestContext = options.context as Record<string, unknown>
        delete requestContext[automaticAuthContextKey]

        if (!targetsConfiguredApi(request.url)) return

        if (options.context.skipAuth === true) {
          request.headers.delete("Authorization")
          return
        }

        if (typeof window === "undefined") return
        if (request.headers.has("Authorization")) return

        try {
          const generationBeforeLookup = getAuthGeneration()
          const session = await getSession({ broadcast: false })
          const generation = getAuthGeneration()
          if (generation !== generationBeforeLookup) return

          const accessToken = session?.accessToken
          const user = currentUserSchema.safeParse(session?.user)
          if (typeof accessToken === "string" && accessToken.length > 0 && user.success) {
            request.headers.set("Authorization", `Bearer ${accessToken}`)
            if (generation) {
              requestContext[automaticAuthContextKey] = {
                marker: automaticAuthMarker,
                accessToken,
                userId: user.data.userId,
                sessionId: user.data.sessionId,
                generation,
              } satisfies AutomaticAuth
            }
          }
        } catch {
          request.headers.delete("Authorization")
        }
      },
    ],
    afterResponse: [
      async ({ request, options, response, retryCount }) => {
        if (
          response.status !== 401 || retryCount > 0 ||
          !["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase()) ||
          typeof window === "undefined" ||
          !targetsConfiguredApi(request.url) ||
          /\/auth\//.test(new URL(request.url).pathname)
        ) return

        const authContext = options.context[automaticAuthContextKey] as AutomaticAuth | undefined
        if (authContext?.marker !== automaticAuthMarker) return
        const original = authContext
        if (getAuthGeneration() !== original.generation) return

        try {
          const result = await refreshSession(original, original.generation)
          if (
            result.status !== "ready" ||
            result.session.userId !== original.userId ||
            result.session.accessToken === original.accessToken ||
            result.session.sessionId === original.sessionId ||
            getAuthGeneration() !== original.generation
          ) return

          request.headers.set("Authorization", `Bearer ${result.session.accessToken}`)
          return ky.retry()
        } catch {
          // A refresh failure is not grounds to replay with stale credentials.
        }
      },
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

import { z } from "zod"

const clientEnvSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url(),
  NEXT_PUBLIC_META_APP_ID: z.string().min(1),
  NEXT_PUBLIC_META_CONFIG_ID: z.string().min(1),
  NEXT_PUBLIC_META_GRAPH_VERSION: z.string().min(1).default("v26.0"),
})

const parsed = clientEnvSchema.safeParse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_META_APP_ID: process.env.NEXT_PUBLIC_META_APP_ID,
  NEXT_PUBLIC_META_CONFIG_ID: process.env.NEXT_PUBLIC_META_CONFIG_ID,
  NEXT_PUBLIC_META_GRAPH_VERSION: process.env.NEXT_PUBLIC_META_GRAPH_VERSION,
})

if (!parsed.success) {
  throw new Error(
    `Invalid client environment variables: ${parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ")}`,
  )
}

export const clientEnv = parsed.data

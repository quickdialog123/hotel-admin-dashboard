import { z } from "zod"

const envSchema = z.object({
  NEXT_PUBLIC_META_APP_ID: z.string().min(1),
  NEXT_PUBLIC_META_CONFIG_ID: z.string().min(1),
  NEXT_PUBLIC_META_GRAPH_VERSION: z.string().min(1).default("v26.0"),
})

const parsed = envSchema.safeParse({
  NEXT_PUBLIC_META_APP_ID: process.env.NEXT_PUBLIC_META_APP_ID,
  NEXT_PUBLIC_META_GRAPH_VERSION: process.env.NEXT_PUBLIC_META_GRAPH_VERSION,
  NEXT_PUBLIC_META_CONFIG_ID: process.env.NEXT_PUBLIC_META_CONFIG_ID,
})

if (!parsed.success) {
  console.error(
    "Invalid environment variables:",
    parsed.error.flatten().fieldErrors,
  )

  throw new Error(
    "Invalid environment variables",
  )
}

export const env = parsed.data

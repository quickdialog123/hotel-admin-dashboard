import "server-only"

import { z } from "zod"

const serverEnvSchema = z.object({
  AUTH_SECRET: z.string().min(32),
  FRONTEND_ORIGIN: z.string().url().refine((value) => {
    const url = new URL(value)
    return url.origin === value
  }, "Must be an origin without a path, query, or fragment"),
})

const parsed = serverEnvSchema.safeParse({
  AUTH_SECRET: process.env.AUTH_SECRET,
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN,
})

if (!parsed.success) {
  throw new Error(
    `Invalid server environment variables: ${parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ")}`,
  )
}

export const serverEnv = parsed.data

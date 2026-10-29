import { z } from "zod"

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  AUTH_SECRET: z.string().min(32),
  BACKEND_API_URL: z.string().url(),
  API_PREFIX: z.string().min(1).default("api"),
  FRONTEND_ORIGIN: z.string().url(),
}).superRefine((env, context) => {
  const frontendUrl = new URL(env.FRONTEND_ORIGIN)
  const backendUrl = new URL(env.BACKEND_API_URL)
  const isLoopback = (hostname: string) =>
    ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname)
  const allowLocalHttp = isLoopback(frontendUrl.hostname)

  if (
    frontendUrl.pathname !== "/" ||
    frontendUrl.search ||
    frontendUrl.hash
  ) {
    context.addIssue({
      code: "custom",
      path: ["FRONTEND_ORIGIN"],
      message: "FRONTEND_ORIGIN must contain only the origin",
    })
  }

  if (backendUrl.pathname !== "/" || backendUrl.search || backendUrl.hash) {
    context.addIssue({
      code: "custom",
      path: ["BACKEND_API_URL"],
      message: "BACKEND_API_URL must contain only the origin",
    })
  }

  if (env.NODE_ENV === "production" && !allowLocalHttp && frontendUrl.protocol !== "https:") {
    context.addIssue({
      code: "custom",
      path: ["FRONTEND_ORIGIN"],
      message: "FRONTEND_ORIGIN must use HTTPS in production",
    })
  }

  if (
    env.NODE_ENV === "production" &&
    !isLoopback(backendUrl.hostname) &&
    backendUrl.protocol !== "https:"
  ) {
    context.addIssue({
      code: "custom",
      path: ["BACKEND_API_URL"],
      message: "BACKEND_API_URL must use HTTPS in production",
    })
  }
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

let cachedEnv: ServerEnv | undefined

export function getServerEnv(): ServerEnv {
  if (cachedEnv) return cachedEnv

  const parsed = serverEnvSchema.safeParse({
    AUTH_SECRET: process.env.AUTH_SECRET,
    BACKEND_API_URL: process.env.BACKEND_API_URL,
    API_PREFIX: process.env.API_PREFIX,
    FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN,
    NODE_ENV: process.env.NODE_ENV,
  })

  if (!parsed.success) {
    throw new Error(
      `Invalid server environment: ${Object.keys(parsed.error.flatten().fieldErrors).join(", ")}`,
    )
  }

  cachedEnv = parsed.data
  return cachedEnv
}

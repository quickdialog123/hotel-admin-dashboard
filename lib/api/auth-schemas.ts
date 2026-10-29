import { z } from "zod"

export const loginInputSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
})

export const accessTokenResponseSchema = z.object({
  accessToken: z.string().min(1),
})

export const currentUserSchema = z.object({
  userId: z.string().uuid(),
  sessionId: z.string().uuid(),
  hotelId: z.string().uuid().nullable(),
  role: z.enum(["SUPER_ADMIN", "OWNER", "STAFF", "CLIENT", "AUTHORITY"]),
})

export type LoginInput = z.infer<typeof loginInputSchema>
export type AccessTokenResponse = z.infer<typeof accessTokenResponseSchema>
export type CurrentUser = z.infer<typeof currentUserSchema>

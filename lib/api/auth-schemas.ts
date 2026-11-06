import { z } from "zod"

export const loginCredentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
})

export type LoginCredentials = z.infer<typeof loginCredentialsSchema>

export const accessTokenResponseSchema = z.object({
  accessToken: z.string().min(1),
})

export type AccessTokenResponse = z.infer<typeof accessTokenResponseSchema>

export const currentUserSchema = z.object({
  userId: z.uuid(),
  sessionId: z.uuid(),
  hotelId: z.uuid().nullable(),
  role: z.string().min(1),
})

export type CurrentUser = z.infer<typeof currentUserSchema>

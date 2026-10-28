import { delay } from "./_mock"

import { z } from "zod"

import {
  getJson,
  postJson,
} from "./client"

export const wabaConnectionSchema =
  z.object({
    status: z.enum([
      "connected",
      "not_connected",
      "error",
    ]),
    wabaId: z.string().nullable(),
    phoneNumber: z.string().nullable(),
    displayName: z.string().nullable(),
    wabaStatus: z
        .enum([
          "APPROVED",
          "PENDING",
          "RESTRICTED",
        ])
        .nullable(),
    qualityRating: z
        .enum([
          "GREEN",
          "YELLOW",
          "RED",
        ])
        .nullable(),
    connectedAt: z.string().nullable(),
    errorMessage: z.string().nullable(),
  })

export type WabaConnection = z.infer<typeof wabaConnectionSchema>
export type WabaConnectionStatus = WabaConnection["status"]

export const embeddedSignupInputSchema = z.object({
  code: z.string().min(1),
  wabaId: z.string().min(1),
  phoneNumberId: z.string().min(1),
})

export type CompleteSignupInput = z.infer<typeof embeddedSignupInputSchema>

export type WabaDashboardStats = {
  conversationsThisWeek: number
  messagesThisWeek: number
  activeGuests: number
  ordersToday: number
}

export function getWabaConnection() {
  return getJson(
    "whatsapp/status",
    wabaConnectionSchema,
  )
}

export function disconnectWaba() {
  return postJson(
    "whatsapp/disconnect",
    {},
    wabaConnectionSchema,
  )
}

export function completeWabaSignup(
  input: CompleteSignupInput,
) {
  return postJson(
    "whatsapp/embedded-signup/complete",
    input,
    wabaConnectionSchema,
    embeddedSignupInputSchema,
  )
}

export async function getDashboardStats(): Promise<WabaDashboardStats> {
  return delay({
    conversationsThisWeek: 184,
    messagesThisWeek: 2317,
    activeGuests: 46,
    ordersToday: 19,
  })
}

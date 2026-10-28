import { clone, delay } from "./_mock"

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

export const completeSignupSchema = z.object({
  code: z.string().min(1),
  wabaId: z.string().min(1),
  phoneNumberId: z.string().min(1),
})

export type CompleteSignupInput = z.infer<typeof completeSignupSchema>

export type WabaDashboardStats = {
  conversationsThisWeek: number
  messagesThisWeek: number
  activeGuests: number
  ordersToday: number
}

let connection: WabaConnection = {
  status: "connected",
  wabaId: "104928374650192",
  phoneNumber: "+44 20 7946 0958",
  displayName: "The Harbour House",
  wabaStatus: "APPROVED",
  qualityRating: "GREEN",
  connectedAt: "2026-06-02T09:14:00.000Z",
  errorMessage: null,
}


export function getWabaConnection() {
  return getJson(
    "whatsapp/status",
    wabaConnectionSchema,
  )
}

export async function disconnectWaba(): Promise<WabaConnection> {
  connection = {
    status: "not_connected",
    wabaId: null,
    phoneNumber: null,
    displayName: null,
    wabaStatus: null,
    qualityRating: null,
    connectedAt: null,
    errorMessage: null,
  }
  return delay(clone(connection))
}

export function completeWabaSignup(
  input: CompleteSignupInput,
) {
  return postJson(
    "whatsapp/embedded-signup/complete",
    input,
    wabaConnectionSchema,
    completeSignupSchema,
  )
}

/** Mock-only helper so the error state can be demoed from the UI. */
export async function simulateWabaError(): Promise<WabaConnection> {
  connection = {
    ...connection,
    status: "error",
    errorMessage:
      "Meta rejected the access token (code 190). The token has expired — reconnect to restore your receptionist.",
  }
  return delay(clone(connection))
}

export async function getDashboardStats(): Promise<WabaDashboardStats> {
  return delay({
    conversationsThisWeek: 184,
    messagesThisWeek: 2317,
    activeGuests: 46,
    ordersToday: 19,
  })
}

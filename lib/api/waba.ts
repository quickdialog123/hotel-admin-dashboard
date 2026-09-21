import { clone, delay } from "./_mock"

export type WabaConnectionStatus = "connected" | "not_connected" | "error"

/** Mirrors the shape of a Meta WhatsApp Business Account + phone number. */
export type WabaConnection = {
  status: WabaConnectionStatus
  /** WhatsApp Business Account ID (Meta `waba_id`) */
  wabaId: string | null
  /** Display phone number, E.164 formatted */
  phoneNumber: string | null
  displayName: string | null
  /** Meta account review status */
  wabaStatus: "APPROVED" | "PENDING" | "RESTRICTED" | null
  qualityRating: "GREEN" | "YELLOW" | "RED" | null
  connectedAt: string | null
  /** Human-readable reason when status === "error" */
  errorMessage: string | null
}

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

export async function getWabaConnection(): Promise<WabaConnection> {
  return delay(clone(connection))
}

// TODO(backend): replace with Meta Embedded Signup — the real flow returns a
// code that the backend exchanges for a WABA + phone number.
export async function connectWaba(): Promise<WabaConnection> {
  connection = {
    status: "connected",
    wabaId: "104928374650192",
    phoneNumber: "+44 20 7946 0958",
    displayName: "The Harbour House",
    wabaStatus: "APPROVED",
    qualityRating: "GREEN",
    connectedAt: new Date().toISOString(),
    errorMessage: null,
  }
  await delay(null)
  await delay(null)
  return clone(connection)
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

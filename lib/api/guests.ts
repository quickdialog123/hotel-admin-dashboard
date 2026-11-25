import { z } from "zod"

import { apiClient } from "@/lib/api/client"
import { guestInputSchema, guestListSchema, guestSchema, guestUpdateSchema, type Guest, type GuestInput } from "@/lib/api/guest-schemas"

export { guestInputSchema, guestListSchema, guestSchema, guestUpdateSchema }
export type { Guest, GuestInput }

export const guestKeys = {
  all: ["guests"] as const,
  list: (hotelId: string) => [...guestKeys.all, hotelId] as const,
  detail: (hotelId: string, guestId: string) => [...guestKeys.list(hotelId), guestId] as const,
}

export async function listGuests(): Promise<Guest[]> {
  return guestListSchema.parse(await apiClient.get("guests").json())
}

export async function getGuest(id: string): Promise<Guest> {
  return guestSchema.parse(await apiClient.get(`guests/${id}`).json())
}

export async function createGuest(input: GuestInput): Promise<Guest> {
  const body = guestInputSchema.parse(input)
  return guestSchema.parse(await apiClient.post("guests", { json: body }).json())
}

export async function createGuests(inputs: GuestInput[]): Promise<{ count: number }> {
  const guests = z.array(guestInputSchema).min(1).max(500).parse(inputs)
  return z.object({ count: z.number().int().nonnegative() }).parse(
    await apiClient.post("guests/bulk", { json: { guests } }).json(),
  )
}

export async function updateGuest(id: string, input: Partial<GuestInput>): Promise<Guest> {
  const body = guestUpdateSchema.parse(input)
  return guestSchema.parse(await apiClient.patch(`guests/${id}`, { json: body }).json())
}

export async function deleteGuest(id: string): Promise<void> {
  await apiClient.delete(`guests/${id}`)
}

export async function deleteGuests(ids: string[]): Promise<{ count: number }> {
  const body = z.object({ ids: z.array(z.uuid()).min(1).max(500) }).parse({ ids })
  return z.object({ count: z.number().int().nonnegative() }).parse(
    await apiClient.delete("guests/bulk", { json: body }).json(),
  )
}

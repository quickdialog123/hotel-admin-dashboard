import { z } from "zod"

import { apiClient } from "@/lib/api/client"

export const guestSchema = z.object({
  id: z.uuid(),
  hotelId: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.email().nullable().optional(),
  address: z.string().nullable().optional(),
  phoneNumber: z.string(),
  checkInDate: z.iso.date(),
  checkOutDate: z.iso.date(),
  roomNumber: z.number().int().positive(),
  floorNumber: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
}).refine((guest) => guest.checkOutDate > guest.checkInDate, {
  path: ["checkOutDate"],
  message: "Check-out must be after check-in.",
})

export type Guest = z.infer<typeof guestSchema>

export const guestInputSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.union([z.email().trim(), z.literal(""), z.null()]).transform((value) => value || null),
  address: z.union([z.string().trim(), z.null()]).transform((value) => value || null),
  phoneNumber: z.string().trim().min(1).max(32),
  checkInDate: z.iso.date(),
  checkOutDate: z.iso.date(),
  roomNumber: z.number().int().positive(),
  floorNumber: z.number().int(),
}).refine((guest) => !guest.checkInDate || !guest.checkOutDate || guest.checkOutDate > guest.checkInDate, {
  path: ["checkOutDate"],
  message: "Check-out must be after check-in.",
})

export type GuestInput = z.infer<typeof guestInputSchema>

export const guestListSchema = z.array(guestSchema)

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
  const body = guestInputSchema.partial().refine((value) => Object.keys(value).length > 0).parse(input)
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

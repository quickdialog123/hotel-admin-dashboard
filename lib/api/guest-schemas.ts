import { z } from "zod"

const guestDateSchema = z
  .union([z.iso.date(), z.iso.datetime()])
  .transform((date) => date.slice(0, 10))

export const guestSchema = z.object({
  id: z.uuid(),
  hotelId: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.email().nullable().optional(),
  address: z.string().nullable().optional(),
  phoneNumber: z.string(),
  checkInDate: guestDateSchema,
  checkOutDate: guestDateSchema,
  roomNumber: z.number().int().positive(),
  floorNumber: z.number().int(),
  marketingConsent: z.boolean().default(false),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
}).refine((guest) => guest.checkOutDate > guest.checkInDate, {
  path: ["checkOutDate"],
  message: "Check-out must be after check-in.",
})

export type Guest = z.infer<typeof guestSchema>

const guestInputFieldsSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.union([z.email().trim(), z.literal(""), z.null()]).transform((value) => value || null),
  address: z.union([z.string().trim(), z.null()]).transform((value) => value || null),
  phoneNumber: z.string().trim().min(1).max(32),
  checkInDate: guestDateSchema,
  checkOutDate: guestDateSchema,
  roomNumber: z.number().int().positive(),
  floorNumber: z.number().int(),
  marketingConsent: z.boolean(),
})

export const guestInputSchema = guestInputFieldsSchema.extend({
  marketingConsent: z.boolean().default(false),
}).refine(
  (guest) => guest.checkOutDate > guest.checkInDate,
  {
    path: ["checkOutDate"],
    message: "Check-out must be after check-in.",
  },
)

export type GuestInput = z.infer<typeof guestInputSchema>

export const guestUpdateSchema = guestInputFieldsSchema.partial()
  .refine((guest) => Object.keys(guest).length > 0, "At least one guest field is required")
  .refine(
    (guest) => !guest.checkInDate || !guest.checkOutDate || guest.checkOutDate > guest.checkInDate,
    {
      path: ["checkOutDate"],
      message: "Check-out must be after check-in.",
    },
  )

export const guestListSchema = z.array(guestSchema)

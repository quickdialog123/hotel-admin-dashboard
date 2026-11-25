import { z } from "zod"

export const campaignStatusSchema = z.enum(["DRAFT", "SENDING", "COMPLETED", "FAILED", "CANCELLED"])

const productRetailerIdsSchema = z.array(z.string().trim().min(1).max(100))
  .max(100)
  .refine((ids) => new Set(ids).size === ids.length, "Product retailer IDs must be unique.")

const guestIdsSchema = z.array(z.uuid())
  .max(500)
  .refine((ids) => new Set(ids).size === ids.length, "Guest IDs must be unique.")

export const campaignCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  templateName: z.string().regex(/^[a-z0-9_]+$/),
  templateLanguage: z.string().trim().min(2).max(10),
  guestIds: guestIdsSchema.optional(),
  productRetailerIds: productRetailerIdsSchema.optional(),
})

export const campaignUpdateSchema = campaignCreateSchema.partial()
  .refine((input) => Object.keys(input).length > 0, "At least one field is required.")

export const campaignGuestSchema = z.object({
  status: z.enum(["PENDING", "RECEIVED", "FAILED"]).nullable(),
  guest: z.object({
    id: z.uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().nullable().optional(),
    phoneNumber: z.string(),
    roomNumber: z.number().int().nullable().optional(),
  }),
})

const campaignFieldsSchema = z.object({
  id: z.uuid(),
  hotelId: z.uuid(),
  name: z.string(),
  templateName: z.string(),
  templateLanguage: z.string(),
  productRetailerIds: productRetailerIdsSchema.default([]),
  status: campaignStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  guestCount: z.number().int().nonnegative().optional(),
  productCount: z.number().int().nonnegative().optional(),
})

export const campaignListItemSchema = campaignFieldsSchema
export const campaignDetailSchema = campaignFieldsSchema.extend({
  guests: z.array(campaignGuestSchema).optional().default([]),
})

export const campaignStartResponseSchema = z.object({
  campaignId: z.uuid(),
  status: z.literal("SENDING"),
})

export const campaignPreviewSchema = z.object({
  campaignId: z.uuid(),
  template: z.object({
    id: z.string(),
    name: z.string(),
    language: z.string(),
    category: z.string(),
    status: z.string(),
    components: z.array(z.record(z.string(), z.unknown())),
  }),
})

export type CampaignStatus = z.infer<typeof campaignStatusSchema>
export type CampaignCreateInput = z.infer<typeof campaignCreateSchema>
export type CampaignUpdateInput = z.infer<typeof campaignUpdateSchema>
export type CampaignListItem = z.infer<typeof campaignListItemSchema>
export type Campaign = z.infer<typeof campaignDetailSchema>

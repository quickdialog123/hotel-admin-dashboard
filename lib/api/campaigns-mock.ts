import { z } from "zod"

// Temporary browser-only campaign store. Replace these functions when the CRUD contract is available.
const mappingSourceSchema = z.enum(["guestFirstName", "guestLastName", "hotelName", "custom"])
const campaignInputSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string(),
  templateId: z.string(),
  templateName: z.string(),
  templateCategory: z.string(),
  templateLanguage: z.string(),
  accountName: z.string(),
  accountPhone: z.string(),
  wabaId: z.string(),
  mappings: z.record(z.string(), mappingSourceSchema.or(z.literal(""))),
  customSamples: z.record(z.string(), z.string()),
  audience: z.object({
    guestIds: z.array(z.string()).refine((ids) => new Set(ids).size === ids.length, "Select each guest once."),
    referenceDate: z.union([z.iso.date(), z.literal("")]),
    inHouse: z.boolean(),
  }).default({ guestIds: [], referenceDate: "", inHouse: false }),
  // Provisional selection only; the backend has not defined MPM retailer IDs or sections.
  productSelection: z.object({
    templateId: z.string().min(1),
    catalogId: z.string().min(1),
    productIds: z.array(z.string().trim().min(1)).max(30).refine((ids) => new Set(ids).size === ids.length, "Select each product once."),
  }).nullable().optional(),
  status: z.enum(["DRAFT", "READY"]),
})
const campaignSchema = campaignInputSchema.extend({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type CampaignInput = z.infer<typeof campaignInputSchema>
export type Campaign = z.infer<typeof campaignSchema>
export const campaignKeys = {
  all: ["mock-campaigns"] as const,
  list: (hotelId: string) => ["mock-campaigns", hotelId] as const,
  detail: (hotelId: string, id: string) => ["mock-campaigns", hotelId, id] as const,
}

function storageKey(hotelId: string) {
  if (!hotelId) throw new Error("No hotel is assigned to your account.")
  return `qd-mock-campaigns:${hotelId}`
}

export function listCampaigns(hotelId: string): Campaign[] {
  const stored = localStorage.getItem(storageKey(hotelId))
  if (!stored) return []
  try {
    return z.array(campaignSchema).parse(JSON.parse(stored))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  } catch {
    throw new Error("Saved local campaign data could not be read.")
  }
}

export function getCampaign(hotelId: string, id: string): Campaign | null {
  return listCampaigns(hotelId).find((campaign) => campaign.id === id) ?? null
}

export function saveCampaign(hotelId: string, input: CampaignInput, id?: string): Campaign {
  const data = campaignInputSchema.parse(input)
  const campaigns = listCampaigns(hotelId)
  const previous = id ? campaigns.find((campaign) => campaign.id === id) : null
  if (id && !previous) throw new Error("Campaign no longer exists in this browser.")
  const now = new Date().toISOString()
  const campaign = campaignSchema.parse({ ...data, id: previous?.id ?? crypto.randomUUID(), createdAt: previous?.createdAt ?? now, updatedAt: now })
  localStorage.setItem(storageKey(hotelId), JSON.stringify([campaign, ...campaigns.filter((item) => item.id !== campaign.id)]))
  return campaign
}

export function deleteCampaign(hotelId: string, id: string): void {
  const campaigns = listCampaigns(hotelId)
  if (!campaigns.some((campaign) => campaign.id === id)) throw new Error("Campaign no longer exists in this browser.")
  localStorage.setItem(storageKey(hotelId), JSON.stringify(campaigns.filter((campaign) => campaign.id !== id)))
}

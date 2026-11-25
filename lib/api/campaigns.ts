import { HTTPError } from "ky"
import { z } from "zod"

import { apiClient, getJson, patchJson, postJson } from "@/lib/api/client"
import {
  campaignCreateSchema,
  campaignDetailSchema,
  campaignListItemSchema,
  campaignPreviewSchema,
  campaignStartResponseSchema,
  campaignUpdateSchema,
  type Campaign,
  type CampaignCreateInput,
  type CampaignListItem,
  type CampaignUpdateInput,
} from "@/lib/api/campaign-schemas"

export {
  campaignCreateSchema,
  campaignDetailSchema,
  campaignListItemSchema,
  campaignPreviewSchema,
  campaignStartResponseSchema,
  campaignUpdateSchema,
} from "@/lib/api/campaign-schemas"
export type { Campaign, CampaignCreateInput, CampaignListItem, CampaignStatus, CampaignUpdateInput } from "@/lib/api/campaign-schemas"

export const campaignKeys = {
  all: ["broadcast-campaigns"] as const,
  list: (hotelId: string) => [...campaignKeys.all, hotelId] as const,
  detail: (hotelId: string, id: string) => [...campaignKeys.list(hotelId), id] as const,
}

export async function listCampaigns(): Promise<CampaignListItem[]> {
  return getJson("broadcast-campaigns", z.array(campaignListItemSchema))
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  try {
    return await getJson(`broadcast-campaigns/${encodeURIComponent(id)}`, campaignDetailSchema)
  } catch (error) {
    if (error instanceof HTTPError && error.response.status === 404) return null
    throw error
  }
}

export async function createCampaign(input: CampaignCreateInput): Promise<Campaign> {
  return postJson("broadcast-campaigns", input, campaignDetailSchema, campaignCreateSchema)
}

export async function updateCampaign(id: string, input: CampaignUpdateInput): Promise<Campaign> {
  return patchJson(
    `broadcast-campaigns/${encodeURIComponent(id)}`,
    input,
    campaignDetailSchema,
    campaignUpdateSchema,
  )
}

export async function deleteCampaign(id: string): Promise<void> {
  await apiClient.delete(`broadcast-campaigns/${encodeURIComponent(id)}`)
}

export async function previewCampaign(id: string) {
  const response: unknown = await apiClient.post(`broadcast-campaigns/${encodeURIComponent(id)}/preview`).json()
  return campaignPreviewSchema.parse(response)
}

export async function startCampaign(id: string) {
  const response: unknown = await apiClient.post(`broadcast-campaigns/${encodeURIComponent(id)}/start`).json()
  return campaignStartResponseSchema.parse(response)
}

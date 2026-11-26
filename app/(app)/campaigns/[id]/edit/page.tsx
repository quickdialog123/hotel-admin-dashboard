"use client"

import { useParams } from "next/navigation"
import { CampaignWizard } from "@/components/campaigns/campaign-wizard"

export default function EditCampaignPage() {
  const { id } = useParams<{ id: string }>()
  return <CampaignWizard campaignId={id} />
}

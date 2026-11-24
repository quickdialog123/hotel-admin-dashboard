"use client"

import { useParams } from "next/navigation"
import CampaignWizard from "@/app/(app)/campaigns/new/page"

export default function EditCampaignPage() {
  const { id } = useParams<{ id: string }>()
  return <CampaignWizard campaignId={id} />
}

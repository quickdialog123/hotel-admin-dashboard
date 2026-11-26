"use client"

import Link from "next/link"
import { useState } from "react"
import { useSession } from "next-auth/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, Search } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/app/confirm-dialog"
import { PageHeader } from "@/components/app/page-header"
import { PillSelect } from "@/components/app/pill-select"
import { SearchBar } from "@/components/app/search-bar"
import { StatusPill } from "@/components/app/status-pill"
import { EmptyState, ErrorState, ListSkeleton } from "@/components/app/states"
import { Button, buttonVariants } from "@/components/ui/button"
import { campaignKeys, deleteCampaign, listCampaigns, type CampaignListItem, type CampaignStatus } from "@/lib/api/campaigns"
import { formatDateTime } from "@/lib/format"

const filters = [
  { value: "ALL", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "SENDING", label: "Sending" },
  { value: "COMPLETED", label: "Completed" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELLED", label: "Cancelled" },
] as const

function statusLabel(status: CampaignStatus) {
  return status.charAt(0) + status.slice(1).toLowerCase()
}

export default function CampaignsPage() {
  const { data: session, status } = useSession()
  const hotelId = session?.user.hotelId
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"ALL" | CampaignStatus>("ALL")
  const [deleting, setDeleting] = useState<CampaignListItem | null>(null)
  const campaigns = useQuery({
    queryKey: campaignKeys.list(hotelId ?? ""),
    queryFn: listCampaigns,
    enabled: Boolean(hotelId),
  })
  const rows = (campaigns.data ?? []).filter((campaign) =>
    (filter === "ALL" || campaign.status === filter) && campaign.name.toLowerCase().includes(search.trim().toLowerCase()),
  )

  async function handleDeleteCampaign() {
    if (!hotelId || !deleting) return
    try {
      await deleteCampaign(deleting.id)
      await queryClient.invalidateQueries({ queryKey: campaignKeys.list(hotelId) })
      toast.success("Campaign deleted")
      setDeleting(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete campaign")
    }
  }

  return <>
    <PageHeader title="Campaigns" description="Manage WhatsApp campaigns and prepare broadcasts."
      actions={<Link href="/campaigns/new" className={buttonVariants({ className: "h-9 gap-2 px-4" })}><Plus className="size-4" aria-hidden /> New Campaign</Link>} />
    {status === "loading" ? <ListSkeleton /> : !hotelId ? <ErrorState message="No hotel is assigned to your account." /> : <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Search campaigns..." label="Search campaigns" showSubmit={false} className="w-full max-w-sm flex-1" />
        <PillSelect value={filter} onChange={setFilter} options={[...filters]} label="Filter campaigns by status" />
      </div>
      {campaigns.error ? <ErrorState message={campaigns.error.message} onRetry={() => void campaigns.refetch()} /> : campaigns.isLoading ? <ListSkeleton /> : !campaigns.data?.length ? (
        <EmptyState title="No campaigns yet" description="Create a campaign to configure its Meta template and personalization."
          action={<Link href="/campaigns/new" className={buttonVariants()}>New Campaign</Link>} />
      ) : !rows.length ? (
        <EmptyState icon={<Search className="size-5" />} title="No campaigns match" description="Try another name or status." />
      ) : <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b bg-slate-50 text-xs text-muted-foreground"><tr>
            <th scope="col" className="px-4 py-3 text-left font-medium">Campaign</th>
            <th scope="col" className="px-4 py-3 text-left font-medium">Meta template</th>
            <th scope="col" className="px-4 py-3 text-left font-medium">Status</th>
            <th scope="col" className="px-4 py-3 text-left font-medium">Updated</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
          </tr></thead>
          <tbody>{rows.map((campaign) => <tr key={campaign.id} className="border-b last:border-0 hover:bg-slate-50/70">
            <td className="max-w-72 px-4 py-4"><Link href={`/campaigns/${campaign.id}`} className="font-semibold hover:underline">{campaign.name}</Link></td>
            <td className="px-4 py-4 text-muted-foreground">{campaign.templateName || "Not selected"}</td>
            <td className="px-4 py-4"><StatusPill tone={campaign.status === "DRAFT" ? "warning" : "solid"}>{statusLabel(campaign.status)}</StatusPill></td>
            <td className="whitespace-nowrap px-4 py-4 text-muted-foreground">{formatDateTime(campaign.updatedAt)}</td>
            <td className="px-4 py-4"><div className="flex items-center justify-end gap-1">
              <Link href={`/campaigns/${campaign.id}`} className={buttonVariants({ variant: "ghost" })}>View</Link>
              {campaign.status === "DRAFT" && <>
                <Link href={`/campaigns/${campaign.id}/edit`} className={buttonVariants({ variant: "ghost" })}>Edit</Link>
                <Button variant="ghost" onClick={() => setDeleting(campaign)}>Delete</Button>
                <Link href={`/campaigns/${campaign.id}/start`} className={buttonVariants({ className: "ml-1" })}>Start</Link>
              </>}
            </div></td>
          </tr>)}</tbody>
        </table>
      </div>}
      <ConfirmDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name || "campaign"}?`}
        description="This permanently deletes the draft campaign from the hotel backend. This action cannot be undone."
        confirmLabel="Delete campaign"
        onConfirm={handleDeleteCampaign} />
    </>}
  </>
}

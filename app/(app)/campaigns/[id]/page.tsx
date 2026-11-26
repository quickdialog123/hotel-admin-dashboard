"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft } from "lucide-react"

import { PageHeader } from "@/components/app/page-header"
import { StatusPill } from "@/components/app/status-pill"
import { EmptyState, ErrorState, ListSkeleton } from "@/components/app/states"
import { buttonVariants } from "@/components/ui/button"
import { campaignKeys, getCampaign, type CampaignStatus } from "@/lib/api/campaigns"
import { formatDateTime } from "@/lib/format"

function statusLabel(status: CampaignStatus) {
  return status.charAt(0) + status.slice(1).toLowerCase()
}

export default function CampaignDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session, status } = useSession()
  const hotelId = session?.user.hotelId
  const query = useQuery({
    queryKey: campaignKeys.detail(hotelId ?? "", id),
    queryFn: () => getCampaign(id),
    enabled: Boolean(hotelId && id),
  })
  const campaign = query.data

  return <>
      <PageHeader title={campaign?.name ?? "Campaign"} description="Review the campaign saved for your hotel."
      actions={campaign?.status === "DRAFT" && <Link href={`/campaigns/${campaign.id}/edit`} className={buttonVariants({ className: "h-9 px-4" })}>Edit campaign</Link>} />
    <Link href="/campaigns" className="mb-5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden /> Campaigns</Link>
    {status === "loading" || query.isLoading ? <ListSkeleton rows={4} /> : !hotelId ? <ErrorState message="No hotel is assigned to your account." /> : query.error ? (
      <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
    ) : !campaign ? <EmptyState title="Campaign not found" description="It may have been deleted or is unavailable to your hotel." /> : <>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="min-w-0 rounded-2xl border bg-white p-5"><h2 className="mb-4 font-semibold">Campaign details</h2>
          <dl className="space-y-3 text-sm">
            <div><dt className="text-muted-foreground">Status</dt><dd className="mt-1"><StatusPill tone={campaign.status === "DRAFT" ? "warning" : "solid"}>{statusLabel(campaign.status)}</StatusPill></dd></div>
            <div><dt className="text-muted-foreground">Name</dt><dd className="break-words font-medium">{campaign.name}</dd></div>
            <div><dt className="text-muted-foreground">Last updated</dt><dd>{formatDateTime(campaign.updatedAt)}</dd></div>
          </dl>
        </section>
        <section className="min-w-0 rounded-2xl border bg-white p-5"><h2 className="mb-4 font-semibold">Message setup</h2>
          <dl className="space-y-3 text-sm">
            <div><dt className="text-muted-foreground">Meta template</dt><dd className="break-words font-medium">{campaign.templateName || "Not selected"}</dd></div>
            <div><dt className="text-muted-foreground">Language</dt><dd>{campaign.templateLanguage}</dd></div>
          </dl>
        </section>
        <section className="min-w-0 rounded-2xl border bg-white p-5 md:col-span-2"><h2 className="mb-3 font-semibold">Selected audience</h2>
          <p className="text-sm">{campaign.guestCount ?? campaign.guests.length} guests selected</p>
          {campaign.guests.length > 0 && <ul className="mt-3 divide-y rounded-xl border">{campaign.guests.map(({ guest }) => <li key={guest.id} className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm"><span className="font-medium">{guest.firstName} {guest.lastName}</span><span className="text-muted-foreground">{guest.phoneNumber}</span></li>)}</ul>}
        </section>
        {campaign.productRetailerIds.length > 0 && <section className="min-w-0 rounded-2xl border bg-white p-5 md:col-span-2"><h2 className="mb-2 font-semibold">Selected catalog products</h2>
          <p className="mb-3 text-xs text-muted-foreground">{campaign.productCount ?? campaign.productRetailerIds.length} product retailer IDs saved. The current sender does not yet include these products in Meta messages.</p>
          <ul className="flex flex-wrap gap-2 text-sm">{campaign.productRetailerIds.map((id) => <li key={id} className="max-w-full break-all rounded-lg border bg-slate-50 px-3 py-1.5">{id}</li>)}</ul>
        </section>}
      </div>
      {campaign.status === "DRAFT" && <div className="mt-5 flex flex-wrap items-center gap-3"><Link href={`/campaigns/${campaign.id}/start`} className={buttonVariants()}>Review & start</Link><p className="text-sm text-muted-foreground">Starting changes the campaign status to Sending.</p></div>}
    </>}
  </>
}

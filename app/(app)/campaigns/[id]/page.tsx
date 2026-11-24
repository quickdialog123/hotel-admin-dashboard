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
import { campaignKeys, getCampaign } from "@/lib/api/campaigns-mock"
import { formatDateTime } from "@/lib/format"

const sources: Record<string, string> = {
  guestFirstName: "Guest first name",
  guestLastName: "Guest last name",
  hotelName: "Hotel name",
  custom: "Custom static text",
}

export default function CampaignDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session, status } = useSession()
  const hotelId = session?.user.hotelId
  const query = useQuery({
    queryKey: campaignKeys.detail(hotelId ?? "", id),
    queryFn: () => getCampaign(hotelId!, id),
    enabled: Boolean(hotelId && id),
  })
  const campaign = query.data

  return <>
    <PageHeader title={campaign?.name ?? "Campaign"} description="Review this locally saved campaign."
      actions={campaign && <Link href={`/campaigns/${campaign.id}/edit`} className={buttonVariants({ className: "h-9 px-4" })}>Edit campaign</Link>} />
    <Link href="/campaigns" className="mb-5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden /> Campaigns</Link>
    {status === "loading" || query.isLoading ? <ListSkeleton rows={4} /> : !hotelId ? <ErrorState message="No hotel is assigned to your account." /> : query.error ? (
      <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
    ) : !campaign ? <EmptyState title="Campaign not found" description="It may have been removed from this browser." /> : <>
      <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">This is a local frontend campaign. No backend campaign has been created.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="min-w-0 rounded-2xl border bg-white p-5"><h2 className="mb-4 font-semibold">Campaign details</h2>
          <dl className="space-y-3 text-sm">
            <div><dt className="text-muted-foreground">Status</dt><dd className="mt-1"><StatusPill tone={campaign.status === "READY" ? "solid" : "warning"}>{campaign.status === "READY" ? "Ready" : "Draft"}</StatusPill></dd></div>
            <div><dt className="text-muted-foreground">Name</dt><dd className="break-words font-medium">{campaign.name}</dd></div>
            {campaign.description && <div><dt className="text-muted-foreground">Description</dt><dd className="whitespace-pre-wrap break-words">{campaign.description}</dd></div>}
            <div><dt className="text-muted-foreground">Last updated</dt><dd>{formatDateTime(campaign.updatedAt)}</dd></div>
          </dl>
        </section>
        <section className="min-w-0 rounded-2xl border bg-white p-5"><h2 className="mb-4 font-semibold">Message setup</h2>
          <dl className="space-y-3 text-sm">
            <div><dt className="text-muted-foreground">Meta template</dt><dd className="break-words font-medium">{campaign.templateName || "Not selected"}</dd></div>
            {campaign.templateId && <><div><dt className="text-muted-foreground">Category</dt><dd>{campaign.templateCategory}</dd></div><div><dt className="text-muted-foreground">Language</dt><dd>{campaign.templateLanguage}</dd></div></>}
            <div><dt className="text-muted-foreground">WhatsApp account</dt><dd className="break-words">{campaign.accountName || "Not connected"}{campaign.accountPhone && ` · ${campaign.accountPhone}`}</dd></div>
          </dl>
        </section>
        <section className="min-w-0 rounded-2xl border bg-white p-5 md:col-span-2"><h2 className="mb-3 font-semibold">Selected audience</h2>
          <p className="text-sm">{campaign.audience.guestIds.length} guests selected</p>
          <p className="mt-1 text-sm text-muted-foreground">Currently In-House: {campaign.audience.inHouse ? "Yes" : "No"} · Reference date: {campaign.audience.referenceDate || "Not saved"}</p>
        </section>
        <section className="min-w-0 rounded-2xl border bg-white p-5 md:col-span-2"><h2 className="mb-4 font-semibold">Personalization mappings</h2>
          {Object.entries(campaign.mappings).filter(([, source]) => source).length ? <dl className="space-y-2 text-sm">{Object.entries(campaign.mappings).filter(([, source]) => source).map(([key, source]) => <div key={key} className="flex flex-wrap justify-between gap-2 border-b pb-2 last:border-0">
            <dt className="break-all font-medium">{key}</dt><dd className="break-words text-muted-foreground">{sources[source] ?? source}{source === "custom" && campaign.customSamples[key] ? ` · ${campaign.customSamples[key]}` : ""}</dd>
          </div>)}</dl> : <p className="text-sm text-muted-foreground">No mappings saved.</p>}
        </section>
        {campaign.productSelection && <section className="min-w-0 rounded-2xl border bg-white p-5 md:col-span-2"><h2 className="mb-2 font-semibold">Selected catalog products</h2>
          <p className="mb-3 text-xs text-muted-foreground">Provisional local selection · {campaign.productSelection.productIds.length} products. Retailer IDs and sections await the backend contract.</p>
          <ul className="flex flex-wrap gap-2 text-sm">{campaign.productSelection.productIds.map((id) => <li key={id} className="max-w-full break-all rounded-lg border bg-slate-50 px-3 py-1.5">{id}</li>)}</ul>
        </section>}
      </div>
      {campaign.status === "READY" && <div className="mt-5 flex flex-wrap items-center gap-3"><Link href={`/campaigns/${campaign.id}/start`} className={buttonVariants()}>Start campaign</Link><p className="text-sm text-muted-foreground">Review the saved audience before any future send action.</p></div>}
    </>}
  </>
}

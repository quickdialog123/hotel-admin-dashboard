"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft } from "lucide-react"

import { PageHeader } from "@/components/app/page-header"
import { EmptyState, ErrorState, ListSkeleton } from "@/components/app/states"
import { TemplatePreview } from "@/components/broadcasts/template-preview"
import { Button, buttonVariants } from "@/components/ui/button"
import { campaignKeys, getCampaign } from "@/lib/api/campaigns-mock"
import { extractVariables, getTemplate } from "@/lib/api/broadcasts"
import { getCatalogConnection, listCatalogueItems } from "@/lib/api/catalogue"
import { guestKeys, listGuests } from "@/lib/api/guests"
import { getHotelProfile } from "@/lib/api/settings"
import { getTemplateMediaPreview } from "@/lib/api/template-media-cache"
import { audienceIssues } from "@/lib/campaigns/recipients"

export default function StartCampaignPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session, status: sessionStatus } = useSession()
  const hotelId = session?.user.hotelId
  const [previewMode, setPreviewMode] = useState<"mobile" | "web">("mobile")
  const [cachedMedia, setCachedMedia] = useState<{ templateId: string; url: string } | null>(null)

  const campaignQuery = useQuery({
    queryKey: campaignKeys.detail(hotelId ?? "", id),
    queryFn: () => getCampaign(hotelId!, id),
    enabled: Boolean(hotelId && id),
  })
  const campaign = campaignQuery.data
  const guestsQuery = useQuery({
    queryKey: guestKeys.list(hotelId ?? ""),
    queryFn: listGuests,
    enabled: Boolean(hotelId && campaign?.status === "READY"),
  })
  const templateQuery = useQuery({
    queryKey: ["whatsapp", "templates", campaign?.templateId],
    queryFn: () => getTemplate(campaign!.templateId),
    enabled: Boolean(hotelId && campaign?.status === "READY" && campaign.templateId),
  })
  const template = templateQuery.data
  const profileQuery = useQuery({
    queryKey: ["hotel-profile", hotelId],
    queryFn: getHotelProfile,
    enabled: Boolean(hotelId && campaign?.status === "READY"),
  })
  const catalogQuery = useQuery({
    queryKey: ["whatsapp", "catalog", "connection"],
    queryFn: getCatalogConnection,
    enabled: Boolean(template?.buttons.some((button) => button.type === "MPM" || button.type === "CATALOG")),
  })
  const showCatalogProducts = Boolean(template?.buttons.some((button) => button.type === "MPM" || button.type === "CATALOG"))
  const catalogId = catalogQuery.data?.status === "connected" ? catalogQuery.data.catalog?.id : undefined
  const productsQuery = useQuery({
    queryKey: ["whatsapp", "catalog", catalogId, "products"],
    queryFn: async () => {
      let page = await listCatalogueItems(catalogId!)
      const selected = campaign?.productSelection?.productIds ?? []
      const seen = new Set<string>()
      while (selected.some((id) => !page.data.some((product) => product.productId === id)) && page.paging?.cursors?.after && !seen.has(page.paging.cursors.after)) {
        const after = page.paging.cursors.after
        seen.add(after)
        const next = await listCatalogueItems(catalogId!, after)
        page = { data: [...page.data, ...next.data], paging: next.paging }
      }
      return page
    },
    enabled: Boolean(catalogId && showCatalogProducts),
  })

  useEffect(() => {
    const headerType = template?.header?.type
    if (!template || (headerType !== "IMAGE" && headerType !== "VIDEO")) return
    let active = true
    let objectUrl: string | undefined
    getTemplateMediaPreview(template.id).then((blob) => {
      if (!active || !blob || !blob.type.startsWith(headerType === "IMAGE" ? "image/" : "video/")) return
      objectUrl = URL.createObjectURL(blob)
      setCachedMedia({ templateId: template.id, url: objectUrl })
    }).catch(() => { /* Local preview media is optional. */ })
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [template])

  const hotelGuests = [...new Map((guestsQuery.data ?? []).filter((guest) => guest.hotelId === hotelId).map((guest) => [guest.id, guest])).values()]
  const byId = new Map(hotelGuests.map((guest) => [guest.id, guest]))
  const selectedIds = campaign?.audience.guestIds ?? []
  const firstGuest = byId.get(selectedIds[0])
  const selectedProducts = (campaign?.productSelection?.productIds ?? [])
    .map((productId) => productsQuery.data?.data.find((product) => product.productId === productId))
    .filter((product) => product !== undefined)
  const issues = campaign ? [
    ...(campaign.status !== "READY" ? ["Complete this campaign before starting."] : []),
    ...(!campaign.templateId ? ["Select a Meta template."] : []),
    ...(campaign.templateId && templateQuery.isLoading ? ["Checking the saved Meta template."] : []),
    ...(templateQuery.error ? ["The Meta template could not be loaded."] : templateQuery.data === null ? ["The Meta template is no longer available."] : []),
    ...(template && (template.status !== "APPROVED" || !template.broadcastEligible) ? ["The Meta template is no longer approved and eligible."] : []),
    ...(template && (template.name !== campaign.templateName || template.language !== campaign.templateLanguage || template.category !== campaign.templateCategory) ? ["The saved template details changed. Edit the campaign to review them."] : []),
    ...(guestsQuery.error ? ["Guests could not be loaded."] : guestsQuery.data ? audienceIssues(hotelGuests, selectedIds, template?.category ?? campaign.templateCategory, campaign.audience.referenceDate, campaign.audience.inHouse) : ["Checking the saved guests."]),
    ...(Object.values(campaign.mappings).includes("hotelName") ? ["The backend hotel-name source is not confirmed."] : []),
    ...(template?.buttons.some((button) => button.type === "MPM") ? ["Multi-product sending needs a verified retailer ID and section contract."] : []),
    ...(showCatalogProducts && (catalogQuery.error || catalogQuery.data?.status !== "connected") ? ["The connected Meta catalog could not be verified."] : []),
    ...(campaign.productSelection && catalogQuery.data && (catalogQuery.data.status !== "connected" || catalogId !== campaign.productSelection.catalogId) ? ["The selected catalog is no longer connected. Edit the campaign."] : []),
    ...(campaign.productSelection && productsQuery.data && selectedProducts.length !== campaign.productSelection.productIds.length ? ["Some selected products are no longer available in the catalog."] : []),
  ] : []

  function valuesFor(kind: "header" | "body" | "buttonUrl", buttonIndex?: number) {
    if (!campaign || !template) return {}
    const content = kind === "header" ? template.header?.text ?? "" : kind === "body" ? template.body : template.buttons[buttonIndex ?? -1]?.url ?? ""
    return Object.fromEntries(extractVariables(content).map((token) => {
      const key = kind === "buttonUrl" ? `buttonUrl:${buttonIndex}:${token}` : `${kind}:${token}`
      const source = campaign.mappings[key]
      const value = source === "guestFirstName" ? firstGuest?.firstName
        : source === "guestLastName" ? firstGuest?.lastName
          : source === "hotelName" ? profileQuery.data?.name
            : source === "custom" ? campaign.customSamples[key] : undefined
      return [token, value ?? ""]
    }))
  }

  return <>
    <PageHeader title={campaign ? `Review ${campaign.name}` : "Review Campaign"} description="Review the saved audience and message before a future broadcast."
      actions={<Link href="/campaigns" className={buttonVariants({ variant: "outline" })}><ArrowLeft className="size-4" aria-hidden /> Campaigns</Link>} />
    {sessionStatus === "loading" || campaignQuery.isLoading ? <ListSkeleton rows={4} /> : !hotelId ? <ErrorState message="No hotel is assigned to your account." /> : campaignQuery.error ? (
      <ErrorState message={campaignQuery.error.message} onRetry={() => void campaignQuery.refetch()} />
    ) : !campaign ? <EmptyState title="Campaign not found" description="This local campaign may have been removed from this browser." /> : campaign.status !== "READY" ? (
      <EmptyState title="Complete the campaign first" description="Only Ready campaigns can enter broadcast review."
        action={<Link href={`/campaigns/${campaign.id}/edit`} className={buttonVariants()}>Edit campaign</Link>} />
    ) : <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] xl:items-start">
      <div className="min-w-0 space-y-5">
        <section className="rounded-2xl border bg-white p-5 sm:p-6">
          <h2 className="text-xl font-semibold">Selected audience · {selectedIds.length}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{campaign.name} · {campaign.templateName || campaign.templateId}</p>
          <p className="mt-3 text-sm text-muted-foreground">Currently In-House: {campaign.audience.inHouse ? "Yes" : "No"} · Reference date: {campaign.audience.referenceDate || "Not saved"}</p>
          {guestsQuery.isLoading ? <ListSkeleton rows={3} /> : guestsQuery.error ? <ErrorState message={guestsQuery.error.message} onRetry={() => void guestsQuery.refetch()} /> : (
            <ul className="mt-4 divide-y rounded-xl border">{selectedIds.map((guestId) => {
              const guest = byId.get(guestId)
              return <li key={guestId} className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm"><span className="font-medium">{guest ? `${guest.firstName} ${guest.lastName}` : `Guest ${guestId} unavailable`}</span><span className="text-muted-foreground">{guest?.phoneNumber}</span></li>
            })}</ul>
          )}
        </section>
        <section className="rounded-2xl border bg-white p-5 sm:p-6">
          <h2 className="font-semibold">Readiness review</h2>
          {issues.length ? <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-900">{issues.map((issue, index) => <li key={`${index}:${issue}`}>{issue}</li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">The saved audience and template passed the available frontend checks. The backend must revalidate them before sending.</p>}
          <p className="mt-4 text-sm text-muted-foreground">No message is sent from this page. Sending awaits a verified backend contract.</p>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-5"><Link href={`/campaigns/${campaign.id}/edit`} className={buttonVariants({ variant: "outline" })}>Edit campaign</Link><Button type="button" disabled>Confirm Send</Button></div>
        </section>
      </div>
      <aside aria-label="Message preview" className="min-w-0 xl:sticky xl:top-6">
        {templateQuery.isLoading ? <ListSkeleton rows={4} /> : templateQuery.error ? <ErrorState message={templateQuery.error.message} onRetry={() => void templateQuery.refetch()} /> : template ? <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">WhatsApp preview · {template.language}</p><div className="flex rounded-lg border bg-white p-1"><Button type="button" size="sm" variant={previewMode === "mobile" ? "secondary" : "ghost"} onClick={() => setPreviewMode("mobile")}>Mobile</Button><Button type="button" size="sm" variant={previewMode === "web" ? "secondary" : "ghost"} onClick={() => setPreviewMode("web")}>WhatsApp Web</Button></div></div>
          <TemplatePreview category={template.category} header={template.header ? { ...template.header, mediaUrl: template.header.mediaUrl || (cachedMedia?.templateId === template.id ? cachedMedia.url : undefined) } : null} body={template.body} footer={template.footer} buttons={template.buttons} businessName={campaign.accountName || "Business account"} mode={previewMode} showComposer
            headerValues={valuesFor("header")} bodyValues={valuesFor("body")} buttonUrlValues={Object.fromEntries(template.buttons.map((_, index) => [index, valuesFor("buttonUrl", index)]))}
            catalogProducts={campaign.productSelection ? selectedProducts : productsQuery.data?.data}
            catalogStatus={showCatalogProducts ? !catalogId || productsQuery.error ? "error" : productsQuery.isLoading ? "loading" : "ready" : undefined}
            productMode={campaign.productSelection ? "selected" : "catalog"} />
          <p className="mt-3 text-xs text-muted-foreground">Personalized with the first selected guest for preview only. The hotel name comes from a frontend setting and still needs a backend source. This is not a send payload.</p>
        </> : <EmptyState title="Template unavailable" description="Edit the campaign to select an approved Meta template." />}
      </aside>
    </div>}
  </>
}

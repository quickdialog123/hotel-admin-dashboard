"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"

import { PageHeader } from "@/components/app/page-header"
import { EmptyState, ErrorState, ListSkeleton } from "@/components/app/states"
import { TemplatePreview } from "@/components/broadcasts/template-preview"
import { Button, buttonVariants } from "@/components/ui/button"
import { campaignKeys, getCampaign, previewCampaign, startCampaign } from "@/lib/api/campaigns"
import { extractVariables, listTemplates } from "@/lib/api/broadcasts"
import { getCatalogConnection, listCatalogueItems } from "@/lib/api/catalogue"
import { guestKeys, listGuests } from "@/lib/api/guests"
import { getTemplateMediaPreview } from "@/lib/api/template-media-cache"

export default function StartCampaignPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const queryClient = useQueryClient()
  const hotelId = session?.user.hotelId
  const [previewMode, setPreviewMode] = useState<"mobile" | "web">("mobile")
  const [cachedMedia, setCachedMedia] = useState<{ templateId: string; url: string } | null>(null)

  const campaignQuery = useQuery({
    queryKey: campaignKeys.detail(hotelId ?? "", id),
    queryFn: () => getCampaign(id),
    enabled: Boolean(hotelId && id),
  })
  const campaign = campaignQuery.data
  const guestsQuery = useQuery({
    queryKey: guestKeys.list(hotelId ?? ""),
    queryFn: listGuests,
    enabled: Boolean(hotelId && campaign?.status === "DRAFT"),
  })
  const templateQuery = useQuery({
    queryKey: ["whatsapp", "templates", campaign?.templateName, campaign?.templateLanguage],
    queryFn: async () => (await listTemplates()).find((item) => item.name === campaign!.templateName && item.language === campaign!.templateLanguage) ?? null,
    enabled: Boolean(hotelId && campaign?.status === "DRAFT" && campaign.templateName),
  })
  const template = templateQuery.data
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
      const selected = campaign?.productRetailerIds ?? []
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
  const selectedIds = campaign?.guests.map(({ guest }) => guest.id) ?? []
  const selectedProducts = (campaign?.productRetailerIds ?? [])
    .map((productId) => productsQuery.data?.data.find((product) => product.productId === productId))
    .filter((product) => product !== undefined)
  const issues = campaign ? [
    ...(campaign.status !== "DRAFT" ? ["Only draft campaigns can be started."] : []),
    ...(!campaign.templateName ? ["Select a Meta template."] : []),
    ...(campaign.templateName && templateQuery.isLoading ? ["Checking the saved Meta template."] : []),
    ...(templateQuery.error ? ["The Meta template could not be loaded."] : templateQuery.data === null ? ["The Meta template is no longer available."] : []),
    ...(template && (template.status !== "APPROVED" || !template.broadcastEligible) ? ["The Meta template is no longer approved and eligible."] : []),
    ...(template && (template.name !== campaign.templateName || template.language !== campaign.templateLanguage) ? ["The saved template details changed. Edit the campaign to review them."] : []),
    ...(guestsQuery.error ? ["Guests could not be loaded."] : !guestsQuery.data ? ["Checking the saved guests."] : []),
    ...(!selectedIds.length ? ["The campaign has no selected guests."] : []),
    ...(guestsQuery.data && selectedIds.some((guestId) => !byId.has(guestId)) ? ["One or more selected guests are no longer available."] : []),
    ...(template?.buttons.some((button) => button.type === "MPM") ? ["The current backend sender does not include selected products in multi-product messages yet."] : []),
    ...(showCatalogProducts && (catalogQuery.error || catalogQuery.data?.status !== "connected") ? ["The connected Meta catalog could not be verified."] : []),
    ...(campaign.productRetailerIds.length > 0 && productsQuery.data && selectedProducts.length !== campaign.productRetailerIds.length ? ["Some selected products are no longer available in the catalog."] : []),
  ] : []

  const startMutation = useMutation({
    mutationFn: async () => {
      await previewCampaign(id)
      return startCampaign(id)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: campaignKeys.all })
      toast.success("Campaign sending started")
      router.replace(`/campaigns/${id}`)
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not start campaign"),
  })

  function valuesFor(kind: "header" | "body" | "buttonUrl", buttonIndex?: number) {
    if (!campaign || !template) return {}
    const content = kind === "header" ? template.header?.text ?? "" : kind === "body" ? template.body : template.buttons[buttonIndex ?? -1]?.url ?? ""
    return Object.fromEntries(extractVariables(content).map((token) => [token, ""]))
  }

  return <>
    <PageHeader title={campaign ? `Review ${campaign.name}` : "Review Campaign"} description="Review the saved audience and message before starting the campaign."
      actions={<Link href="/campaigns" className={buttonVariants({ variant: "outline" })}><ArrowLeft className="size-4" aria-hidden /> Campaigns</Link>} />
    {sessionStatus === "loading" || campaignQuery.isLoading ? <ListSkeleton rows={4} /> : !hotelId ? <ErrorState message="No hotel is assigned to your account." /> : campaignQuery.error ? (
      <ErrorState message={campaignQuery.error.message} onRetry={() => void campaignQuery.refetch()} />
    ) : !campaign ? <EmptyState title="Campaign not found" description="It may have been deleted or is unavailable to your hotel." /> : campaign.status !== "DRAFT" ? (
      <EmptyState title={`Campaign is ${campaign.status.toLowerCase()}`} description="Only draft campaigns can be started."
        action={<Link href={`/campaigns/${campaign.id}`} className={buttonVariants()}>View campaign</Link>} />
    ) : <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] xl:items-start">
      <div className="min-w-0 space-y-5">
        <section className="rounded-2xl border bg-white p-5 sm:p-6">
          <h2 className="text-xl font-semibold">Selected audience · {selectedIds.length}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{campaign.name} · {campaign.templateName}</p>
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
          <p className="mt-4 text-sm text-muted-foreground">Starting sends the approved template and changes the campaign status to Sending. Variable mappings are not part of this preview.</p>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-5"><Link href={`/campaigns/${campaign.id}/edit`} className={buttonVariants({ variant: "outline" })}>Edit campaign</Link><Button type="button" onClick={() => startMutation.mutate()} disabled={issues.length > 0 || startMutation.isPending}>{startMutation.isPending ? "Starting…" : "Confirm Send"}</Button></div>
        </section>
      </div>
      <aside aria-label="Message preview" className="min-w-0 xl:sticky xl:top-6">
        {templateQuery.isLoading ? <ListSkeleton rows={4} /> : templateQuery.error ? <ErrorState message={templateQuery.error.message} onRetry={() => void templateQuery.refetch()} /> : template ? <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">WhatsApp preview · {template.language}</p><div className="flex rounded-lg border bg-white p-1"><Button type="button" size="sm" variant={previewMode === "mobile" ? "secondary" : "ghost"} onClick={() => setPreviewMode("mobile")}>Mobile</Button><Button type="button" size="sm" variant={previewMode === "web" ? "secondary" : "ghost"} onClick={() => setPreviewMode("web")}>WhatsApp Web</Button></div></div>
           <TemplatePreview category={template.category} header={template.header ? { ...template.header, mediaUrl: template.header.mediaUrl || (cachedMedia?.templateId === template.id ? cachedMedia.url : undefined) } : null} body={template.body} footer={template.footer} buttons={template.buttons} businessName="Business account" mode={previewMode} showComposer
             headerValues={valuesFor("header")} bodyValues={valuesFor("body")} buttonUrlValues={Object.fromEntries(template.buttons.map((_, index) => [index, valuesFor("buttonUrl", index)]))}
             catalogProducts={campaign.productRetailerIds.length > 0 ? selectedProducts : productsQuery.data?.data}
             catalogStatus={showCatalogProducts ? !catalogId || productsQuery.error ? "error" : productsQuery.isLoading ? "loading" : "ready" : undefined}
             productMode={campaign.productRetailerIds.length > 0 ? "selected" : "catalog"} />
           <p className="mt-3 text-xs text-muted-foreground">This is a template preview, not a personalized per-recipient message payload.</p>
        </> : <EmptyState title="Template unavailable" description="Edit the campaign to select an approved Meta template." />}
      </aside>
    </div>}
  </>
}

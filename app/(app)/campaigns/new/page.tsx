"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, type FormEvent } from "react"
import { useSession } from "next-auth/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, ArrowRight, Check, MessageCircle, ShoppingBag, X } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"

import { ConnectionPill } from "@/components/app/connection-pill"
import { PageHeader } from "@/components/app/page-header"
import { EmptyState, ErrorState, ListSkeleton } from "@/components/app/states"
import { PillSelect } from "@/components/app/pill-select"
import { SearchBar } from "@/components/app/search-bar"
import { StatusPill } from "@/components/app/status-pill"
import { Stepper } from "@/components/app/stepper"
import { TemplatePreview } from "@/components/broadcasts/template-preview"
import { GuestSelection } from "@/components/campaigns/guest-selection"
import { Thumb } from "@/components/catalogue/item-form-dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { extractVariables, listTemplates, type MessageTemplate, type TemplateCategory } from "@/lib/api/broadcasts"
import { getCatalogConnection, listCatalogueItems } from "@/lib/api/catalogue"
import { campaignKeys, createCampaign, getCampaign, updateCampaign, type Campaign } from "@/lib/api/campaigns"
import { guestKeys, listGuests } from "@/lib/api/guests"
import { getHotelProfile } from "@/lib/api/settings"
import { audienceIssues, dateInTimeZone } from "@/lib/campaigns/recipients"
import { getTemplateMediaPreview } from "@/lib/api/template-media-cache"
import { getWabaConnection } from "@/lib/api/waba"

const steps = ["Campaign Details", "Select Guests", "Select Meta Template", "Personalization", "Review & WhatsApp Preview"]
const maxMultiProductItems = 30
const categories: { value: TemplateCategory | "ALL"; label: string }[] = [
  { value: "ALL", label: "All categories" },
  { value: "MARKETING", label: "Marketing" },
  { value: "UTILITY", label: "Utility" },
  { value: "AUTHENTICATION", label: "Authentication" },
]

const detailsSchema = z.object({
  name: z.string().trim().min(1, "Enter a campaign name."),
  description: z.string().trim(),
})

const mappingSourceSchema = z.enum(["guestFirstName", "guestLastName", "hotelName", "custom"])
type MappingSource = z.infer<typeof mappingSourceSchema>
// Provisional preview keys; the campaign API has not defined persistent mapping fields.
type TemplateVariable = { key: string; token: string; component: string; kind: "header" | "body" | "buttonUrl"; buttonIndex?: number }

const mappingOptions: { value: MappingSource | ""; label: string }[] = [
  { value: "", label: "Choose a source..." },
  { value: "guestFirstName", label: "Guest first name" },
  { value: "guestLastName", label: "Guest last name" },
  { value: "hotelName", label: "Hotel name (preview only)" },
  { value: "custom", label: "Custom static text" },
]

function templateVariables(template: MessageTemplate): TemplateVariable[] {
  const variables: TemplateVariable[] = []
  if (template.header?.type === "TEXT") {
    for (const token of extractVariables(template.header.text ?? "")) {
      variables.push({ key: `header:${token}`, token, component: "Header", kind: "header" })
    }
  }
  for (const token of extractVariables(template.body)) {
    variables.push({ key: `body:${token}`, token, component: "Body", kind: "body" })
  }
  template.buttons.forEach((button, buttonIndex) => {
    if (button.type !== "URL") return
    for (const token of extractVariables(button.url ?? "")) {
      variables.push({ key: `buttonUrl:${buttonIndex}:${token}`, token, component: `Button ${buttonIndex + 1} URL`, kind: "buttonUrl", buttonIndex })
    }
  })
  return variables
}

function unsupportedVariables(template: MessageTemplate): string[] {
  const unsupported: string[] = []
  if (extractVariables(template.footer ?? "").length) unsupported.push("Footer variables")
  template.buttons.forEach((button, index) => {
    if (extractVariables(button.text).length) unsupported.push(`Button ${index + 1} label variables`)
    if (button.type === "PHONE_NUMBER" && extractVariables(button.phoneNumber ?? "").length) unsupported.push(`Button ${index + 1} phone variables`)
  })
  return unsupported
}

function templateType(template: MessageTemplate) {
  if (template.buttons.some((button) => button.type === "MPM") || template.catalogFormat === "MULTI_PRODUCT_MESSAGE") return "Multi-product catalog"
  if (template.buttons.some((button) => button.type === "CATALOG") || template.catalogFormat === "CATALOG_MESSAGE") return "Catalog"
  if (template.marketingType === "CATALOG") return "Catalog"
  if (template.marketingType === "DEFAULT") return "Standard"
  return null
}

export default function NewCampaignPage({ campaignId }: { campaignId?: string }) {
  const { data: session, status: sessionStatus } = useSession()
  const hotelId = session?.user.hotelId
  const savedCampaign = useQuery({
    queryKey: campaignKeys.detail(hotelId ?? "", campaignId ?? ""),
    queryFn: () => getCampaign(campaignId!),
    enabled: Boolean(hotelId && campaignId),
  })

  if (sessionStatus === "loading" || (campaignId && savedCampaign.isLoading)) return <ListSkeleton rows={5} />
  if (!hotelId) return <ErrorState message="No hotel is assigned to your account." />
  if (campaignId && savedCampaign.error) return <ErrorState message={savedCampaign.error.message} onRetry={() => void savedCampaign.refetch()} />
  if (campaignId && !savedCampaign.data) return <EmptyState title="Campaign not found" description="It may have been deleted or is unavailable to your hotel." />
  if (campaignId && savedCampaign.data?.status !== "DRAFT") return <EmptyState title="Campaign cannot be edited" description="Only draft campaigns can be edited." />
  return <CampaignWizard key={campaignId ?? "new"} campaignId={campaignId} hotelId={hotelId} initialCampaign={savedCampaign.data ?? undefined} />
}

function CampaignWizard({ campaignId, hotelId, initialCampaign }: { campaignId?: string; hotelId: string; initialCampaign?: Campaign }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [step, setStep] = useState(0)
  const [name, setName] = useState(initialCampaign?.name ?? "")
  const [description, setDescription] = useState("")
  const [selectedGuestIds, setSelectedGuestIds] = useState<string[]>(initialCampaign?.guests.map(({ guest }) => guest.id) ?? [])
  const [guestSearch, setGuestSearch] = useState("")
  const [inHouse, setInHouse] = useState(false)
  const [dateOverride, setDateOverride] = useState<string | null>(null)
  const [attempted, setAttempted] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState("")
  const [selectionAttempted, setSelectionAttempted] = useState(false)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<TemplateCategory | "ALL">("ALL")
  const [cachedMedia, setCachedMedia] = useState<{ template: MessageTemplate; url: string } | null>(null)
  const [mappings, setMappings] = useState<Record<string, MappingSource | "">>({})
  const [customSamples, setCustomSamples] = useState<Record<string, string>>({})
  const [examples, setExamples] = useState({ guestFirstName: "Sofia", guestLastName: "Martin", hotelName: "Atlas Horizon" })
  const [mappingAttempted, setMappingAttempted] = useState(false)
  const [previewMode, setPreviewMode] = useState<"mobile" | "web">("mobile")
  const [saveError, setSaveError] = useState("")
  const [productSearch, setProductSearch] = useState("")
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false)
  const [productPageError, setProductPageError] = useState("")
  const [productSelection, setProductSelection] = useState<{ templateId: string; catalogId: string; productIds: string[] } | null>(null)
  const [saving, setSaving] = useState(false)

  const connection = useQuery({
    queryKey: ["whatsapp", "connection"],
    queryFn: getWabaConnection,
  })

  const guests = useQuery({
    queryKey: guestKeys.list(hotelId),
    queryFn: listGuests,
    enabled: step >= 1,
  })
  const profile = useQuery({
    queryKey: ["hotel-profile", hotelId],
    queryFn: getHotelProfile,
    enabled: step >= 1,
  })
  const timeZone = profile.data?.timezone ?? "UTC"
  const referenceDate = dateOverride ?? dateInTimeZone(timeZone)
  const hotelGuests = [...new Map((guests.data ?? []).filter((guest) => guest.hotelId === hotelId).map((guest) => [guest.id, guest])).values()]
  const selectedGuests = hotelGuests.filter((guest) => selectedGuestIds.includes(guest.id))

  const templates = useQuery({
    queryKey: ["whatsapp", "templates"],
    queryFn: listTemplates,
    enabled: step >= 2 && connection.data?.status === "CONNECTED",
  })

  const approvedTemplates = (templates.data ?? []).filter((template) => template.status === "APPROVED")
  const hasCatalogMessages = approvedTemplates.some((template) => template.buttons.some((button) => button.type === "CATALOG" || button.type === "MPM"))
  const catalog = useQuery({
    queryKey: ["whatsapp", "catalog", "connection"],
    queryFn: getCatalogConnection,
    enabled: step >= 2 && connection.data?.status === "CONNECTED" && hasCatalogMessages,
  })

  const savedTemplate = initialCampaign
    ? templates.data?.find((template) => template.name === initialCampaign.templateName && template.language === initialCampaign.templateLanguage)
    : undefined
  const activeTemplateId = selectedTemplateId || savedTemplate?.id || ""
  const selectedTemplate = approvedTemplates.find((template) => template.id === activeTemplateId) ?? null
  const catalogId = catalog.data?.status === "connected" ? catalog.data.catalog?.id : undefined
  const isMultiProduct = selectedTemplate ? templateType(selectedTemplate) === "Multi-product catalog" : false
  const showCatalogProducts = Boolean(selectedTemplate?.buttons.some((button) => button.type === "CATALOG")) || isMultiProduct
  const products = useQuery({
    queryKey: ["whatsapp", "catalog", catalogId, "products"],
    queryFn: () => listCatalogueItems(catalogId!),
    enabled: showCatalogProducts && Boolean(catalogId),
  })
  const availableProducts = [...new Map((products.data?.data ?? []).filter((item) => item.productId.trim()).map((item) => [item.productId, item])).values()]
  const selectedProductIds = isMultiProduct && productSelection?.templateId === activeTemplateId && productSelection.catalogId === catalogId
    ? productSelection.productIds
    : isMultiProduct && !productSelection && initialCampaign && catalogId && initialCampaign.templateName === selectedTemplate?.name && initialCampaign.templateLanguage === selectedTemplate?.language
      ? initialCampaign.productRetailerIds
      : []
  const selectedProducts = selectedProductIds.map((id) => availableProducts.find((item) => item.productId === id)).filter((item) => item !== undefined)
  const visibleProducts = availableProducts.filter((item) => item.name.toLowerCase().includes(productSearch.trim().toLowerCase()))
  const activeVariables = selectedTemplate ? templateVariables(selectedTemplate) : []
  const unsupported = selectedTemplate ? unsupportedVariables(selectedTemplate) : []
  const cachedMediaUrl = cachedMedia?.template === selectedTemplate ? cachedMedia.url : undefined
  const visibleTemplates = approvedTemplates.filter((template) =>
    (category === "ALL" || template.category === category) && template.name.toLowerCase().includes(search.trim().toLowerCase()),
  )

  function selectTemplate(template: MessageTemplate) {
    const keys = new Set(templateVariables(template).map((variable) => variable.key))
    setMappings((current) => Object.fromEntries(Object.entries(current).filter(([key]) => keys.has(key))))
    setCustomSamples((current) => Object.fromEntries(Object.entries(current).filter(([key]) => keys.has(key))))
    setSelectedTemplateId(template.id)
    setSelectionAttempted(false)
    setMappingAttempted(false)
    setProductSearch("")
    setProductPageError("")
  }

  function toggleProduct(productId: string, checked: boolean) {
    if (!selectedTemplate || !catalogId || !productId.trim() || (checked && !availableProducts.some((item) => item.productId === productId))) return
    setProductSelection((current) => {
      const savedIds = !current && initialCampaign?.templateName === selectedTemplate.name && initialCampaign.templateLanguage === selectedTemplate.language
        ? initialCampaign.productRetailerIds
        : []
      const ids = current?.templateId === selectedTemplate.id && current.catalogId === catalogId ? current.productIds : savedIds
      const productIds = checked
        ? (ids.includes(productId) || ids.length >= maxMultiProductItems ? ids : [...ids, productId])
        : ids.filter((id) => id !== productId)
      return { templateId: selectedTemplate.id, catalogId, productIds }
    })
  }

  async function loadMoreProducts() {
    const after = products.data?.paging?.cursors?.after
    if (!catalogId || !after || loadingMoreProducts) return
    setLoadingMoreProducts(true)
    setProductPageError("")
    try {
      const next = await listCatalogueItems(catalogId, after)
      queryClient.setQueryData(["whatsapp", "catalog", catalogId, "products"], (current: typeof products.data) => current ? {
        data: [...current.data, ...next.data], paging: next.paging,
      } : next)
    } catch (error) {
      setProductPageError(error instanceof Error ? error.message : "Could not load more products.")
    } finally {
      setLoadingMoreProducts(false)
    }
  }

  function sampleValue(variable: TemplateVariable): string {
    const source = mappings[variable.key]
    if (source === "guestFirstName") return examples.guestFirstName
    if (source === "guestLastName") return examples.guestLastName
    if (source === "hotelName") return examples.hotelName
    if (source === "custom") return customSamples[variable.key] ?? ""
    return ""
  }

  function valuesFor(kind: TemplateVariable["kind"], buttonIndex?: number): Record<string, string> {
    return Object.fromEntries(activeVariables.filter((variable) => variable.kind === kind && variable.buttonIndex === buttonIndex)
      .map((variable) => [variable.token, sampleValue(variable)]))
  }

  const mappingsValid = activeVariables.every((variable) =>
    mappingSourceSchema.safeParse(mappings[variable.key]).success &&
    (mappings[variable.key] !== "custom" || Boolean(customSamples[variable.key]?.trim())),
  )

  useEffect(() => {
    const headerType = selectedTemplate?.header?.type
    if (!selectedTemplate || (headerType !== "IMAGE" && headerType !== "VIDEO")) return

    let active = true
    let objectUrl: string | undefined
    getTemplateMediaPreview(selectedTemplate.id).then((blob) => {
      if (!active || !blob || !blob.type.startsWith(headerType === "IMAGE" ? "image/" : "video/")) return
      objectUrl = URL.createObjectURL(blob)
      setCachedMedia({ template: selectedTemplate, url: objectUrl })
    }).catch(() => { /* The local preview cache is optional. */ })

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [selectedTemplate])

  function unavailableReason(template: MessageTemplate): string | null {
    const type = templateType(template)
    if (type === "Multi-product catalog") return template.buttons.some((button) => button.type === "MPM") ? null : "Multi-product template details are incomplete."
    if (!template.broadcastEligible) return "Meta does not mark this template as eligible."
    if (!type || type === "Standard") return null
    if (!template.buttons.some((button) => button.type === "CATALOG")) return "Catalog template details are incomplete."
    if (catalog.error) return "Unable to verify the connected catalog."
    if (!catalog.data) return "Checking connected catalog assets…"
    if (catalog.data.status !== "connected" || !catalog.data.catalog) return "Connect a Meta catalog to use this template."
    if (catalog.data.catalog.productCount < 1) return "Add products to the connected catalog first."
    return null
  }

  function productIssue(template: MessageTemplate): string | null {
    if (templateType(template) !== "Multi-product catalog") return null
    if (catalog.error) return "Unable to verify the connected catalog."
    if (!catalog.data) return "Checking connected catalog assets…"
    if (catalog.data.status !== "connected" || !catalog.data.catalog) return "Connect a Meta catalog before selecting products."
    if (catalog.data.catalog.productCount < 1) return "The connected catalog has no products."
    if (productSelection?.templateId === template.id && productSelection.catalogId !== catalog.data.catalog.id) return "The connected catalog changed. Select products from the current catalog."
    if (products.error) return "Unable to load catalog products."
    if (!products.data) return "Loading catalog products…"
    if (!selectedProductIds.length) return "Select at least one product."
    if (selectedProductIds.length > maxMultiProductItems) return `Select no more than ${maxMultiProductItems} products.`
    if (new Set(selectedProductIds).size !== selectedProductIds.length || selectedProducts.length !== selectedProductIds.length) return "Some selected products are missing from the loaded catalog. Load more products or update the selection."
    return null
  }

  const details = detailsSchema.safeParse({ name, description })
  const nameError = attempted && !details.success
    ? details.error.issues.find((issue) => issue.path[0] === "name")?.message
    : undefined
  const audienceProblems = guests.data
    ? audienceIssues(hotelGuests, selectedGuestIds, selectedTemplate?.category ?? "", referenceDate, inHouse)
    : selectedGuestIds.length ? [] : ["Select at least one guest."]
  const reviewIssues = [
    ...(!details.success ? ["Enter a valid campaign name."] : []),
    ...(guests.error ? ["Guests could not be loaded."] : !guests.data ? ["Load guests to verify the audience."] : audienceProblems),
    ...(connection.data?.status !== "CONNECTED" ? ["Connect a WhatsApp Business account."] : []),
    ...(!selectedTemplate ? ["Select an approved Meta template."] : unavailableReason(selectedTemplate) ? [unavailableReason(selectedTemplate)!] : []),
    ...(selectedTemplate && productIssue(selectedTemplate) ? [productIssue(selectedTemplate)!] : []),
    ...(isMultiProduct && selectedTemplate && !selectedTemplate.broadcastEligible ? ["The template API does not mark this Multi-product template as broadcast eligible."] : []),
    ...(isMultiProduct ? ["Product IDs are saved with the draft, but the current sender does not include them in Meta messages yet."] : []),
    ...(!mappingsValid ? ["Complete all supported variable mappings."] : []),
    ...(unsupported.length ? [`Unsupported placeholders: ${unsupported.join(", ")}.`] : []),
  ]

  async function saveDraft() {
    setSaveError("")
    setAttempted(true)
    if (!details.success) {
      setStep(0)
      return
    }
    const templateName = selectedTemplate?.name ?? initialCampaign?.templateName ?? ""
    const templateLanguage = selectedTemplate?.language ?? initialCampaign?.templateLanguage ?? ""
    if (!templateName || !templateLanguage) {
      setSaveError("Select an approved template before saving this draft.")
      setStep(2)
      return
    }
    const keepsSavedTemplate = initialCampaign?.templateName === templateName && initialCampaign.templateLanguage === templateLanguage
    const productRetailerIds = productSelection?.templateId === activeTemplateId
      ? productSelection.productIds
      : keepsSavedTemplate ? initialCampaign.productRetailerIds : []
    try {
      setSaving(true)
      const input = {
        name: details.data.name,
        templateName,
        templateLanguage,
        guestIds: [...new Set(selectedGuestIds)],
        productRetailerIds,
      }
      const saved = campaignId ? await updateCampaign(campaignId, input) : await createCampaign(input)
      await queryClient.invalidateQueries({ queryKey: campaignKeys.all })
      toast.success("Campaign draft saved")
      router.replace(`/campaigns/${saved.id}`)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save the campaign draft.")
    } finally {
      setSaving(false)
    }
  }

  function continueToTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAttempted(true)
    if (!details.success || connection.data?.status !== "CONNECTED") return
    setStep(1)
  }

  function continueToPersonalization() {
    setSelectionAttempted(true)
    if (!selectedTemplate || unavailableReason(selectedTemplate) || productIssue(selectedTemplate) || connection.data?.status !== "CONNECTED") return
    setStep(3)
  }

  function continueToReview() {
    setMappingAttempted(true)
    if (!selectedTemplate || unavailableReason(selectedTemplate) || productIssue(selectedTemplate) || !mappingsValid || unsupported.length || connection.data?.status !== "CONNECTED") return
    setStep(4)
  }

  return (
    <>
      <PageHeader
        title={campaignId ? "Edit Campaign" : "New Campaign"}
        description="Set up the details for a WhatsApp campaign."
        actions={<Button type="button" variant="outline" onClick={() => void saveDraft()} disabled={saving}>{saving ? "Saving…" : "Save Draft"}</Button>}
      />

      <Link href="/campaigns" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Campaigns
      </Link>
      <p className="mb-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-muted-foreground">Campaigns are saved to the hotel backend as drafts. Only the selected guest IDs and product retailer IDs are persisted; preview mappings and filter settings are not saved.</p>
      {saveError && <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{saveError}</p>}

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] xl:items-start">
        <div className="min-w-0 space-y-6">
        <aside aria-label="Campaign creation stages" className="rounded-2xl border bg-white p-5">
          <p className="mb-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Campaign setup</p>
          <Stepper steps={steps} current={step} onStepClick={setStep} />
        </aside>

        {step === 0 ? (
        <form noValidate onSubmit={continueToTemplate} className="min-w-0 space-y-6 rounded-2xl border bg-white p-5 sm:p-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step 1 of 5</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Campaign Details</h2>
            <p className="mt-1 text-sm text-muted-foreground">Give this campaign a name and confirm the WhatsApp account it will use.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="campaign-name">Campaign name <span aria-hidden="true" className="text-destructive">*</span></Label>
            <Input
              id="campaign-name"
              name="name"
              autoComplete="off"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => setAttempted(true)}
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? "campaign-name-error" : undefined}
              placeholder="e.g. Winter welcome offer"
              className="h-10"
            />
            {nameError && <p id="campaign-name-error" role="alert" className="text-sm text-destructive">{nameError}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="campaign-description">Description <span className="font-normal text-muted-foreground">(preview only; not saved)</span></Label>
            <Textarea
              id="campaign-description"
              name="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Add a short note about this campaign"
              rows={4}
              className="min-h-28"
            />
          </div>

          <section aria-labelledby="campaign-account-heading" className="rounded-xl border bg-slate-50 p-4 sm:p-5">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-700">
                <MessageCircle className="size-5" aria-hidden />
              </span>
              <div>
                <h3 id="campaign-account-heading" className="font-semibold">WhatsApp Business account</h3>
                <p className="text-sm text-muted-foreground">The connected account for this hotel.</p>
              </div>
            </div>

            {connection.isLoading || (!connection.data && !connection.error) ? (
              <div className="space-y-3" aria-busy="true" aria-label="Loading WhatsApp account">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-52" />
              </div>
            ) : connection.error ? (
              <ErrorState message={connection.error.message} onRetry={() => void connection.refetch()} />
            ) : connection.data ? (
              <div className="space-y-3">
                <ConnectionPill status={connection.data.status} />
                {connection.data.status === "CONNECTED" ? (
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div><dt className="text-muted-foreground">Display name</dt><dd className="font-medium">{connection.data.displayName || "Not provided"}</dd></div>
                    <div><dt className="text-muted-foreground">Phone number</dt><dd className="font-medium">{connection.data.phoneNumber || "Not provided"}</dd></div>
                    <div className="sm:col-span-2"><dt className="text-muted-foreground">Business account ID</dt><dd className="break-all font-medium">{connection.data.wabaId || "Not provided"}</dd></div>
                  </dl>
                ) : (
                  <div className="space-y-2 text-sm">
                    <p className="text-muted-foreground">
                      {connection.data.status === "UNVERIFIED"
                        ? "Finish verifying this WhatsApp account before continuing."
                        : connection.data.status === "ERROR"
                          ? connection.data.errorMessage || "The WhatsApp connection needs attention before continuing."
                          : "Connect a WhatsApp Business account before continuing."}
                    </p>
                    <Link href="/whatsapp" className="inline-block font-medium underline underline-offset-4">Manage WhatsApp connection</Link>
                  </div>
                )}
              </div>
            ) : null}
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
      <Link href="/campaigns" className={buttonVariants({ variant: "outline", className: "h-9 gap-2 px-4" })}>
              <ArrowLeft className="size-4" aria-hidden /> Back
            </Link>
            <Button type="submit" size="lg" className="rounded-lg" disabled={connection.data?.status !== "CONNECTED"}>
              Continue <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        </form>
        ) : step === 1 ? (
          <section aria-labelledby="campaign-guests-heading" className="min-w-0 space-y-6 rounded-2xl border bg-white p-5 sm:p-7">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step 2 of 5</p>
              <h2 id="campaign-guests-heading" className="mt-1 text-xl font-semibold tracking-tight">Select Guests</h2>
              <p className="mt-1 text-sm text-muted-foreground">Choose the audience for this campaign. You can continue with an empty audience to save a Draft.</p>
            </div>
            <GuestSelection
              guests={hotelGuests}
              loading={guests.isLoading || profile.isLoading}
              error={guests.error?.message ?? null}
              onRetry={() => void guests.refetch()}
              selectedIds={selectedGuestIds}
              onSelectedIdsChange={setSelectedGuestIds}
              search={guestSearch}
              onSearchChange={setGuestSearch}
              inHouse={inHouse}
              onInHouseChange={setInHouse}
              referenceDate={referenceDate}
              onReferenceDateChange={setDateOverride}
              timeZone={profile.error ? "UTC (fallback)" : timeZone}
              category={selectedTemplate?.category ?? ""}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
              <Button type="button" variant="outline" size="lg" onClick={() => setStep(0)}><ArrowLeft className="size-4" aria-hidden /> Back</Button>
              <Button type="button" size="lg" onClick={() => setStep(2)} disabled={guests.isLoading || Boolean(guests.error)}>Continue <ArrowRight className="size-4" aria-hidden /></Button>
            </div>
          </section>
        ) : step === 2 ? (
          <section aria-labelledby="template-step-heading" className="min-w-0 space-y-6 rounded-2xl border bg-white p-5 sm:p-7">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step 3 of 5</p>
              <h2 id="template-step-heading" className="mt-1 text-xl font-semibold tracking-tight">Select a message template</h2>
              <p className="mt-1 text-sm text-muted-foreground">Choose one Meta-approved template for this campaign. Template content is read-only.</p>
            </div>

            {connection.error ? (
              <ErrorState message={connection.error.message} onRetry={() => void connection.refetch()} />
            ) : connection.data?.status !== "CONNECTED" ? (
              connection.isLoading ? <ListSkeleton rows={3} /> : (
                <EmptyState
                  title="WhatsApp account unavailable"
                  description="Connect and verify your WhatsApp Business account to load its templates."
                  action={<Link href="/whatsapp" className={buttonVariants({ variant: "outline" })}>Manage WhatsApp connection</Link>}
                />
              )
            ) : templates.error ? (
              <ErrorState message={templates.error.message} onRetry={() => void templates.refetch()} />
            ) : templates.isLoading || !templates.data ? (
              <ListSkeleton rows={4} />
            ) : approvedTemplates.length === 0 ? (
              <EmptyState
                title="No approved templates"
                description="Meta must approve a template before it can be selected for a campaign."
                action={<Link href="/templates" className={buttonVariants({ variant: "outline" })}>View templates</Link>}
              />
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <SearchBar
                    value={search}
                    onChange={setSearch}
                    placeholder="Search templates..."
                    label="Search approved templates"
                    showSubmit={false}
                    className="min-w-48 flex-1"
                  />
                  <PillSelect label="Filter template category" value={category} onChange={setCategory} options={categories} />
                </div>

                {catalog.error && hasCatalogMessages && (
                  <p className="text-sm text-muted-foreground">
                    Catalog availability could not be checked. <button type="button" className="font-medium underline underline-offset-4" onClick={() => void catalog.refetch()}>Try again</button>
                  </p>
                )}

                {visibleTemplates.length === 0 ? (
                  <EmptyState title="No templates match" description="Try another search or category." />
                ) : (
                  <div role="radiogroup" aria-label="Approved message templates" className="space-y-3">
                    {visibleTemplates.map((template) => {
                      const reason = unavailableReason(template)
                      const selected = activeTemplateId === template.id
                      const type = templateType(template)
                      return (
                        <button
                          key={template.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          disabled={Boolean(reason)}
                          onClick={() => selectTemplate(template)}
                          className={`w-full rounded-xl border p-4 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-slate-900/20 disabled:cursor-not-allowed disabled:opacity-60 ${selected ? "border-slate-900 bg-slate-50" : "hover:bg-slate-50"}`}
                        >
                          <span className="flex items-start justify-between gap-3">
                            <span className="min-w-0">
                              <span className="block break-words font-semibold">{template.name}</span>
                              <span className="mt-1 block text-sm text-muted-foreground">{template.category} · {template.language}{type && ` · ${type}`}</span>
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                              <StatusPill tone="solid">{template.status}</StatusPill>
                              <span className={`flex size-5 items-center justify-center rounded-full border ${selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-400"}`} aria-hidden>
                                {selected && <Check className="size-3" />}
                              </span>
                            </span>
                          </span>
                          {reason && <span className="mt-2 block text-xs text-muted-foreground">{reason}</span>}
                          {type === "Multi-product catalog" && !template.broadcastEligible && <span className="mt-2 block text-xs text-amber-800">Product configuration is available, but this template is not marked broadcast eligible.</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            {selectedTemplate && isMultiProduct && <section aria-labelledby="campaign-products-heading" className="space-y-4 rounded-xl border bg-slate-50 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><h3 id="campaign-products-heading" className="font-semibold">Select products</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Choose 1–{maxMultiProductItems} products from the connected catalog. Their retailer IDs are saved with the draft; message support is still pending.</p>
                </div>
                <StatusPill tone="outline">{selectedProductIds.length} selected</StatusPill>
              </div>
              {catalog.error ? <ErrorState message={catalog.error.message} onRetry={() => void catalog.refetch()} /> : !catalog.data ? <ListSkeleton rows={3} /> : catalog.data.status !== "connected" || !catalogId ? (
                <EmptyState title="Catalog not connected" description="Connect a Meta catalog before choosing products."
                  action={<Link href="/catalogue" className={buttonVariants({ variant: "outline" })}>Manage catalog</Link>} />
              ) : products.error ? <ErrorState message={products.error.message} onRetry={() => void products.refetch()} /> : products.isLoading || !products.data ? <ListSkeleton rows={3} /> : !availableProducts.length ? (
                <EmptyState title="No selectable products" description="The connected catalog did not return products with identifiers." />
              ) : <>
                <SearchBar value={productSearch} onChange={setProductSearch} placeholder="Search loaded products..." label="Search catalog products" showSubmit={false} />
                <p className="text-xs text-muted-foreground">Searching {availableProducts.length} loaded products. Load more to browse the next catalog page.</p>
                {selectedProductIds.length > 0 && <div className="space-y-2 rounded-lg border bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Selected products</p>
                  <div className="flex flex-wrap gap-2">{selectedProductIds.map((id) => {
                    const item = availableProducts.find((product) => product.productId === id)
                    return <Button key={id} type="button" variant="outline" size="sm" onClick={() => toggleProduct(id, false)} aria-label={`Remove ${item?.name ?? id}`} className="max-w-full">
                      <span className="truncate">{item?.name ?? id}</span><X className="size-3" aria-hidden />
                    </Button>
                  })}</div>
                </div>}
                {visibleProducts.length ? <div className="max-h-80 space-y-2 overflow-y-auto pr-1">{visibleProducts.map((item) => {
                  const checked = selectedProductIds.includes(item.productId)
                  return <div key={item.productId} className={`flex min-w-0 items-center gap-3 rounded-lg border bg-white p-3 ${checked ? "border-slate-900" : ""}`}>
                    <Checkbox id={`campaign-product-${item.productId}`} checked={checked} disabled={!checked && selectedProductIds.length >= maxMultiProductItems} onCheckedChange={(value) => toggleProduct(item.productId, Boolean(value))} aria-label={`Select ${item.name}`} />
                    <Thumb url={item.imageUrl} name={item.name} className="size-12 shrink-0 rounded-lg object-cover" />
                    <Label htmlFor={`campaign-product-${item.productId}`} className="min-w-0 flex-1 cursor-pointer"><span className="block truncate font-medium">{item.name}</span><span className="block text-xs font-normal text-muted-foreground">{item.price ?? "Price unavailable"}</span></Label>
                  </div>
                })}</div> : <EmptyState icon={<ShoppingBag className="size-5" />} title="No products match" description="Try another search or load more products." />}
                {products.data.paging?.cursors?.after && <Button type="button" variant="outline" onClick={() => void loadMoreProducts()} disabled={loadingMoreProducts}>{loadingMoreProducts ? "Loading…" : "Load more products"}</Button>}
                {productPageError && <p role="alert" className="text-sm text-destructive">{productPageError}</p>}
              </>}
              {productIssue(selectedTemplate) && <p role="alert" className="text-sm text-amber-900">{productIssue(selectedTemplate)}</p>}
            </section>}

            {selectedTemplate && audienceProblems.length > 0 && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Audience needs attention: {audienceProblems[0]} <Button type="button" variant="link" onClick={() => setStep(1)}>Review guests</Button>
            </p>}

            {selectionAttempted && (!selectedTemplate || unavailableReason(selectedTemplate) || productIssue(selectedTemplate)) && (
              <p role="alert" className="text-sm text-destructive">{selectedTemplate ? unavailableReason(selectedTemplate) || productIssue(selectedTemplate) : "Choose a template to continue."}</p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
              <Button type="button" variant="outline" size="lg" onClick={() => setStep(1)}>
                <ArrowLeft className="size-4" aria-hidden /> Back
              </Button>
              <Button type="button" size="lg" onClick={continueToPersonalization} disabled={connection.data?.status !== "CONNECTED" || !templates.data || Boolean(templates.error)}>
                Continue <ArrowRight className="size-4" aria-hidden />
              </Button>
            </div>
          </section>
        ) : step === 3 ? (
          <section aria-labelledby="personalization-step-heading" className="min-w-0 space-y-6 rounded-2xl border bg-white p-5 sm:p-7">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step 4 of 5</p>
              <h2 id="personalization-step-heading" className="mt-1 text-xl font-semibold tracking-tight">Personalization</h2>
              <p className="mt-1 text-sm text-muted-foreground">Choose a source for each template variable and try example values in the message preview.</p>
            </div>

            {!selectedTemplate ? (
              <ErrorState message="The selected template is no longer available." onRetry={() => setStep(2)} />
            ) : (
              <>
                <p className="rounded-xl border bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
                  These mappings and examples are for preview only. The campaign backend has not confirmed its variable mapping contract or a hotel name source.
                </p>

                {activeVariables.length === 0 ? (
                  <p className="rounded-xl border bg-white px-4 py-5 text-sm text-muted-foreground">This template has no supported variables. You can continue without adding mappings.</p>
                ) : (
                  <div className="space-y-3">
                    <h3 className="font-semibold">Template variables</h3>
                    {activeVariables.map((variable) => {
                      const source = mappings[variable.key] ?? ""
                      const invalid = mappingAttempted && (!mappingSourceSchema.safeParse(source).success || (source === "custom" && !customSamples[variable.key]?.trim()))
                      return (
                        <div key={variable.key} className="space-y-3 rounded-xl border p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-medium">{`{{${variable.token}}}`}</p>
                            <StatusPill tone="outline">{variable.component}</StatusPill>
                          </div>
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Data source</p>
                            <PillSelect
                              label={`Data source for ${variable.component} {{${variable.token}}}`}
                              value={source}
                              onChange={(value) => setMappings((current) => ({ ...current, [variable.key]: value }))}
                              options={mappingOptions}
                              className="max-w-full"
                            />
                          </div>
                          {source === "custom" && (
                            <div className="space-y-2">
                              <Label htmlFor={`custom-${variable.key}`}>Sample custom text</Label>
                              <Input
                                id={`custom-${variable.key}`}
                                value={customSamples[variable.key] ?? ""}
                                onChange={(event) => setCustomSamples((current) => ({ ...current, [variable.key]: event.target.value }))}
                                placeholder="e.g. Special offer"
                                aria-invalid={invalid}
                              />
                            </div>
                          )}
                          <p className="break-words text-sm text-muted-foreground">Preview value: <span className="font-medium text-foreground">{sampleValue(variable) || `{{${variable.token}}}`}</span></p>
                          {invalid && <p role="alert" className="text-sm text-destructive">{source === "custom" ? "Enter sample custom text." : "Choose a valid data source."}</p>}
                        </div>
                      )
                    })}
                  </div>
                )}

                {activeVariables.length > 0 && (
                  <div className="space-y-4 rounded-xl border bg-slate-50 p-4">
                    <div>
                      <h3 className="font-semibold">Preview examples</h3>
                      <p className="mt-1 text-sm text-muted-foreground">Edit these examples to see the message change. They are not guest or hotel records.</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {([
                        { key: "guestFirstName", label: "Sample guest first name" },
                        { key: "guestLastName", label: "Sample guest last name" },
                        { key: "hotelName", label: "Sample hotel name" },
                      ] as const).map((field) => (
                        <div key={field.key} className="space-y-2">
                          <Label htmlFor={`sample-${field.key}`}>{field.label}</Label>
                          <Input id={`sample-${field.key}`} value={examples[field.key]} onChange={(event) => setExamples((current) => ({ ...current, [field.key]: event.target.value }))} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {unsupported.length > 0 && (
                  <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    This template also contains unsupported placeholders in {unsupported.join(", ")}. They cannot be mapped by this preview, so review cannot continue.
                  </p>
                )}
                {unavailableReason(selectedTemplate) && (
                  <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    This template is no longer eligible: {unavailableReason(selectedTemplate)}
                  </p>
                )}
                {productIssue(selectedTemplate) && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Product selection needs attention: {productIssue(selectedTemplate)} <Button type="button" variant="link" onClick={() => setStep(2)}>Review products</Button>
                </p>}
              </>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
              <Button type="button" variant="outline" size="lg" onClick={() => setStep(2)}>
                <ArrowLeft className="size-4" aria-hidden /> Back to templates
              </Button>
              <Button type="button" size="lg" onClick={continueToReview} disabled={!selectedTemplate || Boolean(selectedTemplate && (unavailableReason(selectedTemplate) || productIssue(selectedTemplate))) || unsupported.length > 0 || connection.data?.status !== "CONNECTED"}>
                Continue <ArrowRight className="size-4" aria-hidden />
              </Button>
            </div>
          </section>
        ) : (
          <section aria-labelledby="review-step-heading" className="min-w-0 space-y-6 rounded-2xl border bg-white p-5 sm:p-7">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step 5 of 5</p>
              <h2 id="review-step-heading" className="mt-1 text-xl font-semibold tracking-tight">Review & WhatsApp Preview</h2>
              <p className="mt-1 text-sm text-muted-foreground">Check the campaign setup and message preview before saving this draft to the backend.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <section className="min-w-0 rounded-xl border p-4" aria-label="Campaign details review">
                <h3 className="mb-3 font-semibold">Campaign details</h3>
                <dl className="space-y-3 text-sm">
                  <div><dt className="text-muted-foreground">Name</dt><dd className="break-words font-medium">{name.trim() || "Missing"}</dd></div>
                  {description.trim() && <div><dt className="text-muted-foreground">Description</dt><dd className="whitespace-pre-wrap break-words">{description.trim()}</dd></div>}
                </dl>
              </section>
              <section className="min-w-0 rounded-xl border p-4 sm:col-span-2" aria-label="Selected guest audience">
                <h3 className="mb-3 font-semibold">Selected guests · {selectedGuestIds.length}</h3>
                <p className="mb-3 text-sm text-muted-foreground">Currently In-House: {inHouse ? "Yes" : "No"} · Reference date: {referenceDate}</p>
                {selectedGuestIds.length ? <ul className="space-y-2 text-sm">{selectedGuestIds.map((id) => {
                  const guest = selectedGuests.find((item) => item.id === id)
                  return <li key={id} className="flex flex-wrap justify-between gap-2 border-b pb-2 last:border-0"><span>{guest ? `${guest.firstName} ${guest.lastName}` : `Guest ${id} is unavailable`}</span><span className="text-muted-foreground">{guest?.phoneNumber}</span></li>
                })}</ul> : <p className="text-sm text-muted-foreground">No guests selected. Save a Draft or return to Select Guests.</p>}
                {audienceProblems.length > 0 && <Button type="button" variant="link" className="mt-2 px-0" onClick={() => setStep(1)}>Fix audience</Button>}
              </section>
              <section className="min-w-0 rounded-xl border p-4" aria-label="WhatsApp account review">
                <h3 className="mb-3 font-semibold">WhatsApp account</h3>
                <div className="space-y-2 text-sm">
                  {connection.data && <ConnectionPill status={connection.data.status} />}
                  <p className="break-words font-medium">{connection.data?.displayName || "Business account"}</p>
                  {connection.data?.phoneNumber && <p className="text-muted-foreground">{connection.data.phoneNumber}</p>}
                </div>
              </section>
              <section className="min-w-0 rounded-xl border p-4 sm:col-span-2" aria-label="Template review">
                <h3 className="mb-3 font-semibold">Meta template</h3>
                {selectedTemplate ? <dl className="grid gap-3 text-sm sm:grid-cols-3">
                  <div><dt className="text-muted-foreground">Template</dt><dd className="break-words font-medium">{selectedTemplate.name}</dd></div>
                  <div><dt className="text-muted-foreground">Category</dt><dd>{selectedTemplate.category}</dd></div>
                  <div><dt className="text-muted-foreground">Language</dt><dd>{selectedTemplate.language}</dd></div>
                </dl> : <p className="text-sm text-muted-foreground">No approved template selected.</p>}
              </section>
              <section className="min-w-0 rounded-xl border p-4 sm:col-span-2" aria-label="Personalization review">
                <h3 className="mb-3 font-semibold">Personalization mappings</h3>
                {activeVariables.length ? <dl className="space-y-2 text-sm">{activeVariables.map((variable) => {
                  const source = mappings[variable.key]
                  return <div key={variable.key} className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                    <dt className="break-words">{variable.component} {`{{${variable.token}}}`}</dt>
                    <dd className="break-words text-muted-foreground">{mappingOptions.find((option) => option.value === source)?.label || "Missing"}{source === "custom" && customSamples[variable.key]?.trim() ? ` · ${customSamples[variable.key].trim()}` : ""}</dd>
                  </div>
                })}</dl> : <p className="text-sm text-muted-foreground">No variables in this template.</p>}
                <p className="mt-3 text-xs text-muted-foreground">Example values are for this local preview only.</p>
              </section>
              {isMultiProduct && <section className="min-w-0 rounded-xl border p-4 sm:col-span-2" aria-label="Selected products review">
                <h3 className="mb-2 font-semibold">Selected products · {selectedProductIds.length}</h3>
                <p className="mb-3 text-xs text-muted-foreground">Product retailer IDs are saved with the draft. The current sender does not yet include selected products in Meta messages.</p>
                {selectedProductIds.length ? <ul className="space-y-1 text-sm">{selectedProductIds.map((id) => {
                  const item = availableProducts.find((product) => product.productId === id)
                  return <li key={id} className="flex flex-wrap justify-between gap-2 border-b border-slate-100 py-1 last:border-0"><span className="break-words">{item?.name ?? "Product not loaded"}</span><span className="break-all text-muted-foreground">{id}</span></li>
                })}</ul> : <p className="text-sm text-muted-foreground">No products selected.</p>}
              </section>}
            </div>
            <section aria-label="Campaign readiness" className={`rounded-xl border p-4 text-sm ${reviewIssues.length ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
              <h3 className="font-semibold">{reviewIssues.length ? "Needs attention" : "Configuration complete"}</h3>
              {reviewIssues.length ? <ul className="mt-2 list-disc space-y-1 pl-5">{reviewIssues.map((issue, index) => <li key={`${index}:${issue}`}>{issue}</li>)}</ul> : <p className="mt-1">Available frontend checks pass. Saving stores this campaign as a draft; it does not start sending.</p>}
            </section>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
              <Button type="button" variant="outline" size="lg" onClick={() => setStep(3)}>
                <ArrowLeft className="size-4" aria-hidden /> Back to personalization
              </Button>
              <Button type="button" size="lg" onClick={() => void saveDraft()} disabled={saving}>{saving ? "Saving…" : "Save Draft"}</Button>
            </div>
          </section>
        )}

        </div>
        <aside aria-label="Message preview" className="min-w-0 xl:sticky xl:top-6">
          {selectedTemplate ? (
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">WhatsApp preview <span className="font-normal text-muted-foreground">· {selectedTemplate.language}</span></p>
                <div className="inline-flex rounded-lg border bg-white p-1 text-xs" aria-label="Preview display mode">
                  <Button type="button" variant={previewMode === "mobile" ? "secondary" : "ghost"} size="sm" aria-pressed={previewMode === "mobile"} onClick={() => setPreviewMode("mobile")}>Mobile</Button>
                  <Button type="button" variant={previewMode === "web" ? "secondary" : "ghost"} size="sm" aria-pressed={previewMode === "web"} onClick={() => setPreviewMode("web")}>WhatsApp Web</Button>
                </div>
              </div>
              <TemplatePreview
                category={selectedTemplate.category}
                header={selectedTemplate.header ? { ...selectedTemplate.header, mediaUrl: selectedTemplate.header.mediaUrl || cachedMediaUrl } : null}
                body={selectedTemplate.body}
                footer={selectedTemplate.footer}
                buttons={selectedTemplate.buttons}
                businessName={connection.data?.displayName || "Business account"}
                mode={previewMode}
                showComposer
                catalogProducts={isMultiProduct ? selectedProducts : showCatalogProducts ? products.data?.data : undefined}
                catalogStatus={showCatalogProducts ? !catalogId || products.error ? "error" : products.isLoading ? "loading" : "ready" : undefined}
                productMode={isMultiProduct ? "selected" : "catalog"}
                headerValues={valuesFor("header")}
                bodyValues={valuesFor("body")}
                buttonUrlValues={Object.fromEntries(selectedTemplate.buttons.map((_, index) => [index, valuesFor("buttonUrl", index)]))}
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed bg-white p-5 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">WhatsApp preview</p>
              <p className="mt-2">Choose a Meta template to see a read-only message preview here.</p>
            </div>
          )}
        </aside>
      </div>
    </>
  )
}

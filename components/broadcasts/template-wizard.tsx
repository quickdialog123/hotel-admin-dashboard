"use client"

import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { Loader2, Plus, Trash2, Upload } from "lucide-react"
import { PillSelect } from "@/components/app/pill-select"
import { StatusPill } from "@/components/app/status-pill"
import { Stepper } from "@/components/app/stepper"
import { TemplatePreview } from "@/components/broadcasts/template-preview"
import { ConnectCatalogDialog } from "@/components/catalogue/connect-catalog-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { extractVariables, saveTemplate, uploadTemplateMedia, type ButtonType, type CatalogFormat, type HeaderType, type MarketingTemplateType, type TemplateButton, type TemplateCategory, type TemplateHeader } from "@/lib/api/broadcasts"
import type { TemplateInput } from "@/lib/api/broadcasts"
import { deleteTemplateDraft, saveTemplateDraft } from "@/lib/api/template-drafts"
import { saveTemplateMediaPreview } from "@/lib/api/template-media-cache"

const STEPS = ["Basic Details", "Header", "Body", "Footer", "Buttons", "Review"]
const DEFAULT_STEPS = ["Basic Details", "Content", "Review"]
const CATALOG_STEPS = ["Basic Details", "Body", "Footer", "Review"]
const MULTI_PRODUCT_STEPS = ["Basic Details", "Header", "Body", "Footer", "Review"]
const CATEGORIES: { value: TemplateCategory; label: string }[] = [
  { value: "MARKETING", label: "Marketing" },
  { value: "UTILITY", label: "Utility" },
]
const MARKETING_TYPES: { value: MarketingTemplateType; label: string }[] = [
  { value: "DEFAULT", label: "Default" },
  { value: "CATALOG", label: "Catalog" },
]
const CATALOG_FORMATS: { value: CatalogFormat; label: string }[] = [
  { value: "CATALOG_MESSAGE", label: "Catalog message" },
  { value: "MULTI_PRODUCT_MESSAGE", label: "Multi-product message" },
]
const LANGUAGES = [
  { value: "en_GB", label: "English (UK)" },
  { value: "en_US", label: "English (US)" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
  { value: "de", label: "German" },
]
const HEADER_TYPES: { value: HeaderType | "NONE"; label: string }[] = [
  { value: "NONE", label: "None" },
  { value: "TEXT", label: "Text" },
]
const BUTTON_TYPES: { value: ButtonType | "NONE"; label: string }[] = [
  { value: "NONE", label: "None" },
  { value: "QUICK_REPLY", label: "Quick reply" },
  { value: "URL", label: "Visit website" },
  { value: "PHONE_NUMBER", label: "Call phone number" },
]
const NAME_RE = /^[a-z0-9_]+$/
const MEDIA_TYPES: { value: "NONE" | "IMAGE" | "VIDEO"; label: string }[] = [{ value: "NONE", label: "None" }, { value: "IMAGE", label: "Image" }, { value: "VIDEO", label: "Video" }]

export function TemplateWizard({ initial, draftId }: { initial?: TemplateInput; draftId?: string }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [name, setName] = useState(initial?.name ?? "")
  const [category, setCategory] = useState<TemplateCategory>(initial?.category ?? "MARKETING")
  const [marketingType, setMarketingType] = useState<MarketingTemplateType>(initial?.marketingType ?? (initial?.buttons.some((button) => button.type === "CATALOG" || button.type === "MPM") ? "CATALOG" : "DEFAULT"))
  const [catalogFormat, setCatalogFormat] = useState<CatalogFormat>(initial?.catalogFormat ?? (initial?.buttons.some((button) => button.type === "MPM") ? "MULTI_PRODUCT_MESSAGE" : "CATALOG_MESSAGE"))
  const [language, setLanguage] = useState(initial?.language ?? "en_GB")
  const [headerType, setHeaderType] = useState<HeaderType | "NONE">(initial?.header?.type ?? "NONE")
  const [headerText, setHeaderText] = useState(initial?.header?.text ?? "")
  const [headerFile, setHeaderFile] = useState(initial?.header?.mediaSample ?? "")
  const [mediaFileName, setMediaFileName] = useState("")
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [draggingMedia, setDraggingMedia] = useState(false)
  const mediaInputRef = useRef<HTMLInputElement>(null)
  const [body, setBody] = useState(initial?.body ?? "")
  const [footer, setFooter] = useState(initial?.footer ?? "")
  const [buttonType, setButtonType] = useState<ButtonType | "NONE">(initial?.buttons[0]?.type === "CATALOG" || initial?.buttons[0]?.type === "MPM" ? "NONE" : initial?.buttons[0]?.type ?? "NONE")
  const [buttons, setButtons] = useState<TemplateButton[]>(initial?.buttons.filter((button) => button.type !== "CATALOG" && button.type !== "MPM") ?? [])
  const [examples, setExamples] = useState<Record<string, string>>(initial?.sampleValues ?? {})
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [catalogDialogOpen, setCatalogDialogOpen] = useState(false)

  const isCatalogMessage = category === "MARKETING" && marketingType === "CATALOG" && catalogFormat === "CATALOG_MESSAGE"
  const isMultiProductMessage = category === "MARKETING" && marketingType === "CATALOG" && catalogFormat === "MULTI_PRODUCT_MESSAGE"
  const header: TemplateHeader | null = isCatalogMessage ? null : isMultiProductMessage ? { type: "TEXT", text: headerText } : headerType === "NONE" ? null : headerType === "TEXT" ? { type: "TEXT", text: headerText } : { type: headerType, mediaSample: headerFile }
  const cleanButtons: TemplateButton[] = isCatalogMessage ? [{ type: "CATALOG", text: "View catalog" }] : isMultiProductMessage ? [{ type: "MPM", text: "View items" }] : buttons.filter((b) => b.text.trim())
  const vars = extractVariables(body + " " + (header?.type === "TEXT" ? header.text : ""))
  const sampleValues = Object.fromEntries(vars.map((v) => [v, examples[v] ?? ""]))
  const isDefaultMarketing = category === "MARKETING" && marketingType === "DEFAULT"
  const steps = isDefaultMarketing ? DEFAULT_STEPS : isCatalogMessage ? CATALOG_STEPS : isMultiProductMessage ? MULTI_PRODUCT_STEPS : STEPS
  const reviewStep = steps.length - 1

  const nameOk = NAME_RE.test(name)
  const bodyOk = body.trim().length > 0 && body.length <= 1024
  const headerOk = isMultiProductMessage ? headerText.trim().length > 0 : headerType === "NONE" || (headerType === "TEXT" ? headerText.trim().length > 0 : !!headerFile)
  const variablesOk = vars.every((v) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(v))
  const buttonsOk = buttonType === "NONE" || buttons.every((b) => b.text.trim() && (b.type !== "URL" || /^https?:\/\//.test(b.url ?? "")) && (b.type !== "PHONE_NUMBER" || /^\+?[0-9]{7,}$/.test(b.phoneNumber ?? "")))
  const stepOk = isDefaultMarketing ? [nameOk, headerOk && bodyOk && buttonsOk && variablesOk, true][step] : isCatalogMessage ? [nameOk, bodyOk && variablesOk, true, true][step] : isMultiProductMessage ? [nameOk, headerOk, bodyOk && variablesOk, true, true][step] : [nameOk, headerOk, bodyOk && variablesOk, true, buttonsOk, true][step]

  function next() {
    setTouched(true)
    if (!stepOk) return
    setTouched(false)
    setStep(step + 1)
  }

  function changeButtonType(t: ButtonType | "NONE") {
    setButtonType(t)
    setButtons(t === "NONE" ? [] : [{ type: t, text: "" }])
  }

  function selectMedia(file?: File) {
    if (!file) return
    const allowed = headerType === "IMAGE" ? ["image/jpeg", "image/png"] : ["video/mp4"]
    if (!allowed.includes(file.type)) {
      toast.error(`Choose ${headerType === "IMAGE" ? "an image" : "a video"} file`)
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Choose a file smaller than 15 MB")
      return
    }
    setMediaFile(file)
    const reader = new FileReader()
    reader.onload = () => {
      setHeaderFile(String(reader.result))
      setMediaFileName(file.name)
    }
    reader.onerror = () => toast.error("Couldn't read the selected file")
    reader.readAsDataURL(file)
  }

  function removeMedia() {
    setHeaderFile("")
    setMediaFileName("")
    setMediaFile(null)
    if (mediaInputRef.current) mediaInputRef.current.value = ""
  }

  async function save(submit: boolean) {
    setSaving(true)
    try {
      let submittedHeader = header
      let uploadedFile = mediaFile
      if (submit && header && header.type !== "TEXT") {
        let file = mediaFile
        if (!file && headerFile.startsWith("data:")) {
          const blob = await (await fetch(headerFile)).blob()
          file = new File([blob], mediaFileName || "template-media", { type: blob.type })
        }
        uploadedFile = file
        submittedHeader = { type: header.type, mediaHandle: file ? await uploadTemplateMedia(file) : initial?.header?.mediaHandle }
      }
      const input = { name, category, marketingType: category === "MARKETING" ? marketingType : undefined, catalogFormat: category === "MARKETING" && marketingType === "CATALOG" ? catalogFormat : undefined, variableType: "NAME" as const, language, header: submittedHeader, body: body.trim(), footer: footer.trim() || null, buttons: cleanButtons, sampleValues }
      if (submit) {
        const saved = await saveTemplate(input)
        if (uploadedFile) {
          try { await saveTemplateMediaPreview(saved.id, uploadedFile) } catch { /* Preview cache is optional. */ }
        }
        if (draftId) await deleteTemplateDraft(draftId)
      }
      else await saveTemplateDraft(input, draftId)
      toast.success(submit ? "Template sent to Meta" : "Draft saved in this browser")
      router.push("/templates")
    } catch (e) {
      let message = e instanceof Error ? e.message : "Couldn't save template"
      if (e instanceof Error && "response" in e && (e as { response?: Response }).response) {
        const response = (e as { response: Response }).response
        try {
          const payload: unknown = await response.clone().json()
          if (typeof payload === "object" && payload !== null) {
            const details = payload as { message?: unknown; error?: unknown }
            if (typeof details.message === "string") message = details.message
            else if (typeof details.error === "string") message = details.error
          }
        } catch { /* Keep the HTTP error when the response has no JSON message. */ }
      }
      toast.error(message)
      setSaving(false)
    }
  }

  const invalidAll = !nameOk || !bodyOk || !variablesOk || (!isCatalogMessage && (!headerOk || (!isMultiProductMessage && !buttonsOk))) || vars.some((v) => !sampleValues[v]?.trim())

  return (
    <div className="grid gap-8 lg:grid-cols-[200px_1fr_320px]">
      <ConnectCatalogDialog open={catalogDialogOpen} onOpenChange={setCatalogDialogOpen} />
      <Stepper steps={steps} current={step} onStepClick={setStep} />

      <div className="rounded-2xl border bg-white p-6">
        {step === 0 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="t-name">Template name</Label>
              <Input id="t-name" placeholder="spa_weekend_offer" value={name} disabled={!!initial && "id" in initial} onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, "_"))} aria-invalid={touched && !nameOk} />
              <p className={touched && !nameOk ? "text-sm text-destructive" : "text-xs text-muted-foreground"}>Lowercase letters, numbers and underscores only.</p>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <div><PillSelect label="Category" value={category} onChange={(value) => { setCategory(value); setStep(0) }} options={CATEGORIES} /></div>
            </div>
            {category === "MARKETING" && <div className="space-y-2">
              <Label>Marketing template type</Label>
              <div><PillSelect label="Marketing template type" value={marketingType} onChange={(value) => { setMarketingType(value); setStep(0) }} options={MARKETING_TYPES} /></div>
            </div>}
            {category === "MARKETING" && marketingType === "CATALOG" && <div className="space-y-2">
              <Label>Catalog format</Label>
              <p className="text-xs text-muted-foreground">Choose the message format that best fits your needs.</p>
              <div><PillSelect label="Catalog format" value={catalogFormat} onChange={setCatalogFormat} options={CATALOG_FORMATS} /></div>
              {isMultiProductMessage && <p className="text-xs text-muted-foreground">Include up to 30 products from your catalog. Useful for showcasing a new collection or a specific product category. Specify which products via the API when sending the template.</p>}
              <p className="text-xs text-muted-foreground">Your catalog must be linked to this WhatsApp account. <button type="button" onClick={() => setCatalogDialogOpen(true)} className="font-medium text-foreground underline">Connect a catalog</button></p>
            </div>}
            <div className="space-y-2">
              <Label>Language</Label>
              <div><PillSelect label="Language" value={language} onChange={initial && "id" in initial ? () => {} : setLanguage} options={LANGUAGES} /></div>
              {!!initial && "id" in initial && <p className="text-xs text-muted-foreground">Meta does not allow changing the name or language of an existing template.</p>}
            </div>
          </div>
        )}

        {step === 1 && isDefaultMarketing && <div className="mb-6 space-y-5">
          <h2 className="font-semibold">Content</h2>
          <div className="space-y-2"><Label>Media sample</Label><div><PillSelect label="Media sample" value={headerType === "IMAGE" || headerType === "VIDEO" ? headerType : "NONE"} onChange={(value) => { setHeaderType(value); removeMedia() }} options={MEDIA_TYPES} /></div></div>
        </div>}
        {(step === 1 && !isCatalogMessage) && (
          <div className="space-y-5">
            {isDefaultMarketing && <h3 className="font-medium">Header</h3>}
            <div className="space-y-2">
              <Label>Header type {!isMultiProductMessage && <span className="font-normal text-muted-foreground">(optional)</span>}</Label>
              {isMultiProductMessage ? <p className="text-sm text-muted-foreground">Text</p> : headerType !== "IMAGE" && headerType !== "VIDEO" && <div><PillSelect label="Header type" value={headerType} onChange={setHeaderType} options={HEADER_TYPES} /></div>}
            </div>
            {(headerType === "TEXT" || isMultiProductMessage) && (
              <div className="space-y-2">
                <Label htmlFor="t-htext">Header text</Label>
                <Input id="t-htext" maxLength={60} value={headerText} onChange={(e) => setHeaderText(e.target.value)} aria-invalid={touched && !headerOk} />
                {touched && !headerOk && <p className="text-sm text-destructive">Enter header text.</p>}
              </div>
            )}
            {!isMultiProductMessage && headerType !== "NONE" && headerType !== "TEXT" && (
              <div className="space-y-2">
                <Label htmlFor="t-hfile">Sample {headerType.toLowerCase()}</Label>
                <input ref={mediaInputRef} id="t-hfile" type="file" accept={headerType === "IMAGE" ? "image/jpeg,image/png" : "video/mp4"} className="sr-only" onChange={(e) => { selectMedia(e.target.files?.[0]); e.target.value = "" }} />
                <div role="button" tabIndex={0} aria-label={`Upload sample ${headerType.toLowerCase()}`} onClick={() => mediaInputRef.current?.click()} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); mediaInputRef.current?.click() } }} onDragOver={(e) => { e.preventDefault(); setDraggingMedia(true) }} onDragLeave={() => setDraggingMedia(false)} onDrop={(e) => { e.preventDefault(); setDraggingMedia(false); selectMedia(e.dataTransfer.files[0]) }} className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring ${draggingMedia ? "border-primary bg-primary/5" : "border-slate-300"}`}>
                  <Upload className="size-6 text-muted-foreground" />
                  <span className="text-sm font-medium">Drag and drop to upload</span>
                  <span className="text-xs text-muted-foreground">Or choose {headerType === "IMAGE" ? "an image" : "a video"} on your device</span>
                </div>
                {headerFile && <div className="flex items-center justify-between gap-3 rounded-lg border p-2 text-sm"><span className="truncate">{mediaFileName || `Selected ${headerType.toLowerCase()}`}</span><Button type="button" variant="ghost" size="sm" onClick={removeMedia} aria-label={`Remove sample ${headerType.toLowerCase()}`}><Trash2 className="size-4" /> Remove</Button></div>}
                {touched && !headerOk && <p className="text-sm text-destructive">Choose a sample {headerType.toLowerCase()}.</p>}
              </div>
            )}
          </div>
        )}

        {((step === 2 && !isDefaultMarketing && !isCatalogMessage) || (step === 1 && (isDefaultMarketing || isCatalogMessage))) && (
          <div className="mt-6 space-y-2">
            {isDefaultMarketing && <h3 className="font-medium">Body</h3>}
            <Label htmlFor="t-body">Message body</Label>
            <Textarea id="t-body" rows={8} maxLength={1024} placeholder="Hi {{firstname}}, …" value={body} onChange={(e) => setBody(e.target.value)} aria-invalid={touched && !bodyOk} />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className={touched && !bodyOk ? "text-sm text-destructive" : ""}>{touched && !bodyOk ? "Body is required." : <>Use <code className="rounded bg-slate-100 px-1">{"{{variable}}"}</code> for personalisation.</>}</span>
              <span>{body.length}/1024</span>
            </div>
            {vars.length > 0 && <div className="flex flex-wrap gap-1.5 pt-1">{vars.map((v) => <StatusPill key={v}>{`{{${v}}}`}</StatusPill>)}</div>}
            {vars.map((v) => <div key={v} className="space-y-1"><Label htmlFor={`sample-${v}`}>Example for {`{{${v}}}`}</Label><Input id={`sample-${v}`} value={examples[v] ?? ""} onChange={(e) => setExamples({ ...examples, [v]: e.target.value })} /></div>)}
            {touched && !variablesOk && <p className="text-sm text-destructive">Use named variables such as {"{{guest_name}}"}.</p>}
          </div>
        )}

        {((step === 3 && !isDefaultMarketing && !isCatalogMessage) || (step === 1 && isDefaultMarketing) || (step === 2 && isCatalogMessage)) && (
          <div className="mt-6 space-y-2">
            {isDefaultMarketing && <h3 className="font-medium">Footer</h3>}
            <Label htmlFor="t-footer">Footer <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input id="t-footer" maxLength={60} value={footer} onChange={(e) => setFooter(e.target.value)} />
            <p className="text-xs text-muted-foreground">A short line shown below the message. {footer.length}/60</p>
          </div>
        )}

        {((step === 4 && !isDefaultMarketing && !isCatalogMessage && !isMultiProductMessage) || (step === 1 && isDefaultMarketing)) && (
          <div className="mt-6 space-y-5">
            {isDefaultMarketing && <h3 className="font-medium">Buttons</h3>}
            <div className="space-y-2">
              <Label>Button type <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <div><PillSelect label="Button type" value={buttonType} onChange={changeButtonType} options={BUTTON_TYPES} /></div>
              <p className="text-xs text-muted-foreground">All buttons on a template must be the same type.</p>
            </div>
            {buttonType !== "NONE" && (
              <div className="space-y-3">
                {buttons.map((b, i) => (
                  <div key={i} className="space-y-2 rounded-2xl border p-3">
                    <div className="flex items-center gap-2">
                      <Input aria-label={`Button ${i + 1} label`} placeholder="Button label" maxLength={25} value={b.text} onChange={(e) => setButtons(buttons.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} aria-invalid={touched && !b.text.trim()} />
                      <Button type="button" variant="ghost" size="icon" aria-label={`Remove button ${i + 1}`} onClick={() => { const n = buttons.filter((_, j) => j !== i); setButtons(n); if (!n.length) setButtonType("NONE") }}><Trash2 /></Button>
                    </div>
                    {b.type === "URL" && <Input aria-label={`Button ${i + 1} URL`} placeholder="https://…" value={b.url ?? ""} onChange={(e) => setButtons(buttons.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} aria-invalid={touched && !/^https?:\/\//.test(b.url ?? "")} />}
                    {b.type === "PHONE_NUMBER" && <Input aria-label={`Button ${i + 1} phone`} placeholder="+442079460958" value={b.phoneNumber ?? ""} onChange={(e) => setButtons(buttons.map((x, j) => (j === i ? { ...x, phoneNumber: e.target.value } : x)))} aria-invalid={touched && !/^\+?[0-9]{7,}$/.test(b.phoneNumber ?? "")} />}
                  </div>
                ))}
                {buttons.length < (buttonType === "QUICK_REPLY" ? 3 : 2) && (
                  <Button type="button" variant="outline" onClick={() => setButtons([...buttons, { type: buttonType as ButtonType, text: "" }])}><Plus /> Add button</Button>
                )}
                {touched && !buttonsOk && <p className="text-sm text-destructive">Complete every button (label, plus a valid URL or phone number).</p>}
              </div>
            )}
          </div>
        )}

        {step === reviewStep && (
          <div className="space-y-4">
            <h2 className="font-semibold">Review</h2>
            <dl className="divide-y rounded-2xl border text-sm">
              {[
                ["Name", <span key="n" className="font-mono">{name}</span>],
                ["Category", CATEGORIES.find((c) => c.value === category)?.label],
                ...(category === "MARKETING" ? [["Marketing template type", MARKETING_TYPES.find((t) => t.value === marketingType)?.label]] : []),
                ...(category === "MARKETING" && marketingType === "CATALOG" ? [["Catalog format", CATALOG_FORMATS.find((f) => f.value === catalogFormat)?.label]] : []),
                ["Type of variable", "Name"],
                ...(isDefaultMarketing ? [["Media sample", headerType === "IMAGE" || headerType === "VIDEO" ? headerType.toLowerCase() : "None"]] : []),
                ["Language", LANGUAGES.find((l) => l.value === language)?.label],
                ["Header", header ? (header.type === "TEXT" ? header.text : header.type.toLowerCase()) : "None"],
                ["Footer", footer || "None"],
                ["Buttons", cleanButtons.length ? cleanButtons.map((b) => b.text).join(", ") : "None"],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between gap-4 px-4 py-2.5"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
              ))}
            </dl>
            {invalidAll && <p role="alert" className="text-sm text-destructive">Some steps are incomplete — go back and fix them before submitting.</p>}
            {isMultiProductMessage && <p className="text-sm text-muted-foreground">Select up to 30 products through the API when sending this approved template.</p>}
            <p className="text-sm text-muted-foreground">Submitting sends this template to Meta for review. You can&apos;t broadcast it until it&apos;s Approved.</p>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between gap-2 border-t pt-4">
          <Button variant="ghost" onClick={step === 0 ? () => router.push("/templates") : () => setStep(step - 1)}>{step === 0 ? "Cancel" : "Back"}</Button>
          {step < reviewStep ? (
            <Button className="rounded-xl" onClick={next}>Next</Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" className="rounded-xl" disabled={saving || !nameOk} onClick={() => save(false)}>Save draft locally</Button>
              <Button className="rounded-xl" disabled={saving || invalidAll} onClick={() => save(true)}>{saving && <Loader2 className="animate-spin" />} {initial && "id" in initial ? "Save changes to Meta" : "Submit for approval"}</Button>
            </div>
          )}
        </div>
      </div>

      <aside aria-label="Live preview" className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">Live preview</p>
        <TemplatePreview category={category} header={header} body={body} footer={footer.trim() || null} buttons={cleanButtons} values={sampleValues} />
      </aside>
    </div>
  )
}

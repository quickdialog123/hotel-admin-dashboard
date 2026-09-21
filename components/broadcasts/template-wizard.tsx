"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { PillSelect } from "@/components/app/pill-select"
import { StatusPill } from "@/components/app/status-pill"
import { Stepper } from "@/components/app/stepper"
import { TemplatePreview } from "@/components/broadcasts/template-preview"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { extractVariables, MARKETING_OPT_OUT_LINE, saveTemplate, type ButtonType, type HeaderType, type TemplateButton, type TemplateCategory, type TemplateHeader } from "@/lib/api/broadcasts"

const STEPS = ["Basic Details", "Header", "Body", "Footer", "Buttons", "Review"]
const CATEGORIES: { value: TemplateCategory; label: string }[] = [
  { value: "MARKETING", label: "Marketing" },
  { value: "UTILITY", label: "Utility" },
  { value: "AUTHENTICATION", label: "Authentication" },
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
  { value: "IMAGE", label: "Image" },
  { value: "VIDEO", label: "Video" },
  { value: "DOCUMENT", label: "Document" },
]
const BUTTON_TYPES: { value: ButtonType | "NONE"; label: string }[] = [
  { value: "NONE", label: "None" },
  { value: "QUICK_REPLY", label: "Quick reply" },
  { value: "URL", label: "Visit website" },
  { value: "PHONE_NUMBER", label: "Call phone number" },
]
const NAME_RE = /^[a-z0-9_]+$/

export function TemplateWizard() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [name, setName] = useState("")
  const [category, setCategory] = useState<TemplateCategory>("MARKETING")
  const [language, setLanguage] = useState("en_GB")
  const [headerType, setHeaderType] = useState<HeaderType | "NONE">("NONE")
  const [headerText, setHeaderText] = useState("")
  const [headerFile, setHeaderFile] = useState("")
  const [body, setBody] = useState("")
  const [footer, setFooter] = useState("")
  const [buttonType, setButtonType] = useState<ButtonType | "NONE">("NONE")
  const [buttons, setButtons] = useState<TemplateButton[]>([])
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)

  const header: TemplateHeader | null = headerType === "NONE" ? null : headerType === "TEXT" ? { type: "TEXT", text: headerText } : { type: headerType, mediaSample: headerFile }
  const cleanButtons = buttons.filter((b) => b.text.trim())
  const vars = extractVariables(body + " " + headerText)
  const sampleValues = Object.fromEntries(vars.map((v) => [v, v === "firstname" ? "Amelia" : `[${v}]`]))

  const nameOk = NAME_RE.test(name)
  const bodyOk = body.trim().length > 0 && body.length <= 1024
  const headerOk = headerType === "NONE" || (headerType === "TEXT" ? headerText.trim().length > 0 : true)
  const buttonsOk = buttonType === "NONE" || buttons.every((b) => b.text.trim() && (b.type !== "URL" || /^https?:\/\//.test(b.url ?? "")) && (b.type !== "PHONE_NUMBER" || /^\+?[0-9]{7,}$/.test(b.phoneNumber ?? "")))
  const stepOk = [nameOk, headerOk, bodyOk, true, buttonsOk, true][step]

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

  async function save(submit: boolean) {
    setSaving(true)
    try {
      await saveTemplate({ name, category, language, header, body: body.trim(), footer: footer.trim() || null, buttons: cleanButtons }, { submit })
      toast.success(submit ? "Submitted to Meta for review" : "Draft saved")
      router.push("/broadcasts?tab=templates")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save template")
      setSaving(false)
    }
  }

  const invalidAll = !nameOk || !headerOk || !bodyOk || !buttonsOk

  return (
    <div className="grid gap-8 lg:grid-cols-[200px_1fr_320px]">
      <Stepper steps={STEPS} current={step} onStepClick={setStep} />

      <div className="rounded-2xl border bg-white p-6">
        {step === 0 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="t-name">Template name</Label>
              <Input id="t-name" placeholder="spa_weekend_offer" value={name} onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, "_"))} aria-invalid={touched && !nameOk} />
              <p className={touched && !nameOk ? "text-sm text-destructive" : "text-xs text-muted-foreground"}>Lowercase letters, numbers and underscores only.</p>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <div><PillSelect label="Category" value={category} onChange={setCategory} options={CATEGORIES} /></div>
            </div>
            <div className="space-y-2">
              <Label>Language</Label>
              <div><PillSelect label="Language" value={language} onChange={setLanguage} options={LANGUAGES} /></div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Header type <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <div><PillSelect label="Header type" value={headerType} onChange={setHeaderType} options={HEADER_TYPES} /></div>
            </div>
            {headerType === "TEXT" && (
              <div className="space-y-2">
                <Label htmlFor="t-htext">Header text</Label>
                <Input id="t-htext" maxLength={60} value={headerText} onChange={(e) => setHeaderText(e.target.value)} aria-invalid={touched && !headerOk} />
                {touched && !headerOk && <p className="text-sm text-destructive">Enter header text or choose None.</p>}
              </div>
            )}
            {headerType !== "NONE" && headerType !== "TEXT" && (
              <div className="space-y-2">
                <Label htmlFor="t-hfile">Sample {headerType.toLowerCase()} file name</Label>
                <Input id="t-hfile" placeholder="banner.jpg" value={headerFile} onChange={(e) => setHeaderFile(e.target.value)} />
                <p className="text-xs text-muted-foreground">Meta requires a sample file when a template is submitted for review.</p>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2">
            <Label htmlFor="t-body">Message body</Label>
            <Textarea id="t-body" rows={8} maxLength={1024} placeholder="Hi {{firstname}}, …" value={body} onChange={(e) => setBody(e.target.value)} aria-invalid={touched && !bodyOk} />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className={touched && !bodyOk ? "text-sm text-destructive" : ""}>{touched && !bodyOk ? "Body is required." : <>Use <code className="rounded bg-slate-100 px-1">{"{{variable}}"}</code> for personalisation.</>}</span>
              <span>{body.length}/1024</span>
            </div>
            {vars.length > 0 && <div className="flex flex-wrap gap-1.5 pt-1">{vars.map((v) => <StatusPill key={v}>{`{{${v}}}`}</StatusPill>)}</div>}
            {category === "MARKETING" && <p className="rounded-xl bg-slate-50 p-3 text-xs text-muted-foreground">Marketing templates automatically end with &ldquo;{MARKETING_OPT_OUT_LINE}&rdquo;. This line is required for compliance and can&apos;t be edited.</p>}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-2">
            <Label htmlFor="t-footer">Footer <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input id="t-footer" maxLength={60} value={footer} onChange={(e) => setFooter(e.target.value)} />
            <p className="text-xs text-muted-foreground">A short line shown below the message. {footer.length}/60</p>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
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

        {step === 5 && (
          <div className="space-y-4">
            <h2 className="font-semibold">Review</h2>
            <dl className="divide-y rounded-2xl border text-sm">
              {[
                ["Name", <span key="n" className="font-mono">{name}</span>],
                ["Category", CATEGORIES.find((c) => c.value === category)?.label],
                ["Language", LANGUAGES.find((l) => l.value === language)?.label],
                ["Header", header ? (header.type === "TEXT" ? header.text : header.type.toLowerCase()) : "None"],
                ["Footer", footer || "None"],
                ["Buttons", cleanButtons.length ? cleanButtons.map((b) => b.text).join(", ") : "None"],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between gap-4 px-4 py-2.5"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
              ))}
            </dl>
            {invalidAll && <p role="alert" className="text-sm text-destructive">Some steps are incomplete — go back and fix them before submitting.</p>}
            <p className="text-sm text-muted-foreground">Submitting sends this template to Meta for review. You can&apos;t broadcast it until it&apos;s Approved.</p>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between gap-2 border-t pt-4">
          <Button variant="ghost" onClick={step === 0 ? () => router.push("/broadcasts?tab=templates") : () => setStep(step - 1)}>{step === 0 ? "Cancel" : "Back"}</Button>
          {step < STEPS.length - 1 ? (
            <Button className="rounded-xl" onClick={next}>Next</Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" className="rounded-xl" disabled={saving || !nameOk} onClick={() => save(false)}>Save draft</Button>
              <Button className="rounded-xl" disabled={saving || invalidAll} onClick={() => save(true)}>{saving && <Loader2 className="animate-spin" />} Submit for approval</Button>
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

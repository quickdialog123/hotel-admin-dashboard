"use client"

import { useState } from "react"
import { toast } from "sonner"
import { ArrowLeft, Loader2 } from "lucide-react"
import { PhoneFrame, WaBubble } from "@/components/app/phone-frame"
import { Stepper } from "@/components/app/stepper"
import { ErrorState } from "@/components/app/states"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { listKnowledgeSources } from "@/lib/api/knowledgeBase"
import { createReceptionist, DEFAULT_SYSTEM_PROMPT, updateReceptionist, type Receptionist } from "@/lib/api/receptionist"
import { useAsync } from "@/lib/hooks/use-async"

const HOTEL_NAME = "The Harbour House"
const STEPS = ["Basic Details", "Persona & Prompt", "Knowledge Base"]

export function creativityLabel(t: number) {
  return t <= 0.3 ? "Precise" : t < 0.7 ? "Balanced" : "Creative"
}

export function ReceptionistWizard({ existing, onDone, onCancel }: { existing: Receptionist | null; onDone: () => void; onCancel: () => void }) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState(existing?.name ?? "")
  const [description, setDescription] = useState(existing?.description ?? "")
  const [creativity, setCreativity] = useState(existing?.temperature ?? 0.4)
  const [prompt, setPrompt] = useState(existing?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT)
  const [sources, setSources] = useState<string[]>(existing?.knowledgeSourceIds ?? [])
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const kb = useAsync(listKnowledgeSources)

  const nameOk = name.trim().length > 0
  const promptOk = prompt.trim().length > 0
  const stepOk = step === 0 ? nameOk : step === 1 ? promptOk : true

  function next() {
    setTouched(true)
    if (!stepOk) return
    setTouched(false)
    setStep(step + 1)
  }

  async function save() {
    setSaving(true)
    try {
      const input = { name: name.trim(), description: description.trim(), systemPrompt: prompt, temperature: creativity, knowledgeSourceIds: sources }
      if (existing) await updateReceptionist(existing.id, input)
      else await createReceptionist(input)
      toast.success(existing ? "Receptionist updated" : "Receptionist created")
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save")
      setSaving(false)
    }
  }

  const renderedPrompt = prompt.replaceAll("{{hotel_name}}", HOTEL_NAME)
  const greeting = `Hello, and welcome to ${HOTEL_NAME}! I'm ${name.trim() || "your receptionist"}. ${description.trim() ? description.trim() + " " : ""}How can I help you today?`

  return (
    <div>
      <button type="button" onClick={onCancel} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to AI Receptionist
      </button>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{existing ? "Edit AI Receptionist" : "Create AI Receptionist"}</h1>

      <div className="grid gap-8 lg:grid-cols-[200px_1fr_320px]">
        <Stepper steps={STEPS} current={step} onStepClick={setStep} />

        <div className="rounded-2xl border bg-white p-6">
          {step === 0 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="r-name">Receptionist name</Label>
                <Input id="r-name" placeholder="Oceanview Receptionist" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={touched && !nameOk} />
                {touched && !nameOk && <p className="text-sm text-destructive">Give your receptionist a name.</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="r-desc">Short description</Label>
                <Input id="r-desc" placeholder="Friendly concierge for in-house guests" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <Label id="r-creativity-label">Creativity</Label>
                  <span className="text-sm font-medium tabular-nums">{creativity.toFixed(1)} · {creativityLabel(creativity)}</span>
                </div>
                <Slider aria-labelledby="r-creativity-label" min={0} max={1} step={0.1} value={[creativity]} onValueChange={(v) => setCreativity(Array.isArray(v) ? v[0] : v)} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Precise & consistent</span>
                  <span>Creative & varied</span>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-2">
              <Label htmlFor="r-prompt">System prompt</Label>
              <Textarea id="r-prompt" rows={10} value={prompt} onChange={(e) => setPrompt(e.target.value)} aria-invalid={touched && !promptOk} />
              {touched && !promptOk && <p className="text-sm text-destructive">The prompt can&apos;t be empty.</p>}
              <p className="text-xs text-muted-foreground">
                Use <code className="rounded bg-slate-100 px-1">{"{{hotel_name}}"}</code> to insert your hotel&apos;s name.
              </p>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="font-semibold">What should it draw on?</h2>
              <p className="mb-4 text-sm text-muted-foreground">Select the Knowledge Base sources this receptionist can use.</p>
              {kb.error ? (
                <ErrorState message={kb.error} onRetry={kb.reload} />
              ) : !kb.data ? (
                <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading" />
              ) : kb.data.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sources yet — add some in the Knowledge Base first.</p>
              ) : (
                <ul className="divide-y rounded-2xl border">
                  {kb.data.map((s) => (
                    <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                      <Checkbox id={`src-${s.id}`} checked={sources.includes(s.id)} onCheckedChange={(c) => setSources(c ? [...sources, s.id] : sources.filter((x) => x !== s.id))} />
                      <Label htmlFor={`src-${s.id}`} className="flex-1 cursor-pointer font-medium">{s.name}</Label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="mt-8 flex items-center justify-between border-t pt-4">
            <Button variant="ghost" onClick={step === 0 ? onCancel : () => setStep(step - 1)}>{step === 0 ? "Cancel" : "Back"}</Button>
            {step < STEPS.length - 1 ? (
              <Button className="rounded-xl" onClick={next}>Next</Button>
            ) : (
              <Button className="rounded-xl" onClick={save} disabled={saving}>{saving && <Loader2 className="animate-spin" />} {existing ? "Save changes" : "Create receptionist"}</Button>
            )}
          </div>
        </div>

        <aside aria-label="Live preview" className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">Live preview</p>
          <PhoneFrame title={name.trim() || "Receptionist"} subtitle={HOTEL_NAME}>
            <WaBubble>{greeting}</WaBubble>
            {step === 1 && <WaBubble className="text-slate-500 italic">Behaviour: {renderedPrompt.slice(0, 140)}{renderedPrompt.length > 140 ? "…" : ""}</WaBubble>}
          </PhoneFrame>
        </aside>
      </div>
    </div>
  )
}

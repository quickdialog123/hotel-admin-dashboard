"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { ArrowLeft, Info, Send } from "lucide-react"
import { PillSelect } from "@/components/app/pill-select"
import { EmptyState, ErrorState } from "@/components/app/states"
import { TemplatePreview } from "@/components/broadcasts/template-preview"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/components/app/confirm-dialog"
import { extractVariables, listSegments, listTemplates, sendBroadcast } from "@/lib/api/broadcasts"
import { useAsync } from "@/lib/hooks/use-async"

export default function NewBroadcastPage() {
  const router = useRouter()
  const templates = useAsync(listTemplates)
  const segments = useAsync(listSegments)
  const [templateId, setTemplateId] = useState<string>("")
  const [segmentId, setSegmentId] = useState<string>("")
  const [values, setValues] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const approved = useMemo(() => (templates.data ?? []).filter((t) => t.status === "APPROVED"), [templates.data])
  const template = approved.find((t) => t.id === templateId) ?? null
  const segment = segments.data?.find((s) => s.id === segmentId) ?? null
  const vars = template ? extractVariables(template.body + " " + (template.header?.text ?? "")) : []
  const varsOk = vars.every((v) => values[v]?.trim())
  const canSend = !!template && !!segment && varsOk

  const error = templates.error ?? segments.error
  const back = (
    <Link href="/broadcasts" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" /> Broadcasts
    </Link>
  )

  if (error) return <>{back}<ErrorState message={error} onRetry={() => { templates.reload(); segments.reload() }} /></>
  if (!templates.data || !segments.data) return <>{back}<Skeleton className="h-96 rounded-2xl" /></>
  if (approved.length === 0)
    return <>{back}<EmptyState title="No approved campaigns" description="You need at least one campaign approved by Meta before you can send a broadcast." action={<Link href="/campaigns/new" className={buttonVariants({ className: "rounded-xl" })}>Create a campaign</Link>} /></>

  return (
    <>
      {back}
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">New broadcast</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div className="flex gap-3 rounded-2xl border bg-white p-4 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <p>Broadcasts sent outside a guest&apos;s 24-hour conversation window require an approved message template and marketing opt-in — that&apos;s why only Approved templates are selectable here.</p>
          </div>

          <section className="space-y-3 rounded-2xl border bg-white p-6">
            <h2 className="font-semibold">1. Campaign</h2>
            <div>
              <PillSelect label="Campaign" value={templateId} onChange={(v) => { setTemplateId(v); setValues({}) }} options={[...(templateId ? [] : [{ value: "", label: "Choose an approved campaign…" }]), ...approved.map((t) => ({ value: t.id, label: t.name }))]} />
            </div>
          </section>

          {template && vars.length > 0 && (
            <section className="space-y-4 rounded-2xl border bg-white p-6">
              <h2 className="font-semibold">2. Fill in variables</h2>
              {vars.map((v) => (
                <div key={v} className="space-y-2">
                  <Label htmlFor={`v-${v}`}>{`{{${v}}}`}</Label>
                  <Input id={`v-${v}`} value={values[v] ?? ""} onChange={(e) => setValues({ ...values, [v]: e.target.value })} aria-invalid={touched && !values[v]?.trim()} placeholder={v === "firstname" ? "e.g. there (used when the guest's name is unknown)" : ""} />
                  {touched && !values[v]?.trim() && <p className="text-sm text-destructive">Required.</p>}
                </div>
              ))}
            </section>
          )}

          <section className="space-y-3 rounded-2xl border bg-white p-6">
            <h2 className="font-semibold">{vars.length > 0 ? "3" : "2"}. Recipients</h2>
            <ul className="space-y-2" role="radiogroup" aria-label="Recipient segment">
              {segments.data.map((s) => (
                <li key={s.id}>
                  <button type="button" role="radio" aria-checked={segmentId === s.id} onClick={() => setSegmentId(s.id)} className={`flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-slate-900/20 ${segmentId === s.id ? "border-slate-900 bg-slate-50" : "hover:bg-slate-50"}`}>
                    <span>
                      <span className="block font-medium">{s.name}</span>
                      <span className="block text-sm text-muted-foreground">{s.description}</span>
                    </span>
                    <span className="text-sm font-semibold tabular-nums">{s.recipientCount.toLocaleString()}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => router.push("/broadcasts")}>Cancel</Button>
            <Button
              className="rounded-xl"
              onClick={() => {
                setTouched(true)
                if (canSend) setConfirm(true)
              }}
              disabled={!template || !segment}
            >
              <Send /> Review & send
            </Button>
          </div>
        </div>

        <aside aria-label="Preview" className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">Preview</p>
          {template ? <TemplatePreview category={template.category} header={template.header} body={template.body} footer={template.footer} buttons={template.buttons} values={values} /> : <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">Choose a campaign to see a preview.</div>}
        </aside>
      </div>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Send broadcast?"
        description={`"${template?.name}" will be sent to ${segment?.recipientCount.toLocaleString()} guests in "${segment?.name}". This can't be undone.`}
        confirmLabel="Send now"
        onConfirm={async () => {
          if (!template || !segment) return
          try {
            const b = await sendBroadcast({ templateId: template.id, segmentId: segment.id, variables: values })
            toast.success("Broadcast is sending")
            router.push(`/broadcasts/${b.id}`)
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Couldn't send broadcast")
          }
        }}
      />
    </>
  )
}

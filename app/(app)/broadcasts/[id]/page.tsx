"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { StatusPill } from "@/components/app/status-pill"
import { ErrorState } from "@/components/app/states"
import { TemplatePreview } from "@/components/broadcasts/template-preview"
import { Skeleton } from "@/components/ui/skeleton"
import { getBroadcast, getTemplate } from "@/lib/api/broadcasts"
import { useAsync } from "@/lib/hooks/use-async"
import { formatDateTime } from "@/lib/format"
import { BROADCAST_LABEL, BROADCAST_TONE } from "@/components/broadcasts/status"

export default function BroadcastDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data, error, loading, reload } = useAsync(async () => {
    const b = await getBroadcast(id)
    const t = b ? await getTemplate(b.templateId) : null
    return b ? { b, t } : null
  }, [id])

  const back = (
    <Link href="/broadcasts" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" /> Broadcasts
    </Link>
  )
  if (error) return <>{back}<ErrorState message={error} onRetry={reload} /></>
  if (loading) return <>{back}<Skeleton className="h-80 rounded-2xl" /></>
  if (!data) return <>{back}<p className="rounded-2xl border bg-white p-10 text-center font-medium">Broadcast not found</p></>

  const { b, t } = data
  const pct = b.recipientCount ? Math.round((b.delivered / b.recipientCount) * 100) : 0

  return (
    <>
      {back}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{b.templateName}</h1>
        <StatusPill tone={BROADCAST_TONE[b.status]}>{BROADCAST_LABEL[b.status]}</StatusPill>
      </div>
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {[["Recipients", b.recipientCount], ["Delivered", b.delivered], ["Failed", b.failed]].map(([k, v]) => (
              <div key={k as string} className="rounded-2xl border bg-white p-5">
                <p className="text-sm text-muted-foreground">{k}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">{(v as number).toLocaleString()}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border bg-white p-6">
            <div className="mb-2 flex justify-between text-sm"><span className="font-medium">Delivery</span><span className="text-muted-foreground">{pct}%</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-slate-900" style={{ width: `${pct}%` }} /></div>
            <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-muted-foreground">Segment</dt><dd className="font-medium">{b.segmentName}</dd></div>
              <div><dt className="text-muted-foreground">Sent</dt><dd className="font-medium">{formatDateTime(b.sentAt)}</dd></div>
              {Object.entries(b.variables).map(([k, v]) => (
                <div key={k}><dt className="text-muted-foreground">{`{{${k}}}`}</dt><dd className="font-medium">{v}</dd></div>
              ))}
            </dl>
          </div>
        </div>
        <aside aria-label="Message as sent">
          <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">Message as sent</p>
          {t ? <TemplatePreview category={t.category} header={t.header} body={t.body} footer={t.footer} buttons={t.buttons} values={b.variables} /> : <p className="rounded-2xl border p-6 text-sm">{b.renderedBody}</p>}
        </aside>
      </div>
    </>
  )
}

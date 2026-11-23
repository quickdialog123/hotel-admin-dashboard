"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import { useEffect, useState } from "react"
import { getTemplate } from "@/lib/api/broadcasts"
import { useAsync } from "@/lib/hooks/use-async"
import { ErrorState, ListSkeleton } from "@/components/app/states"
import { TemplateWizard } from "@/components/broadcasts/template-wizard"
import { TemplatePreview } from "@/components/broadcasts/template-preview"
import { getTemplateDraft } from "@/lib/api/template-drafts"
import { getTemplateMediaPreview } from "@/lib/api/template-media-cache"

export default function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>()
  if (!/^\d+$/.test(id)) return <EditDraft id={id} />
  return <MetaTemplateDetail id={id} />
}

function EditDraft({ id }: { id: string }) {
  const { data, error, loading, reload } = useAsync(() => getTemplateDraft(id), [id])
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (loading) return <ListSkeleton />
  if (data === null) return <ErrorState message="Draft not found in this browser" onRetry={reload} />
  return <><h1 className="mb-6 text-2xl font-semibold">Local draft</h1><TemplateWizard key={id} initial={data} draftId={id} /></>
}

function MetaTemplateDetail({ id }: { id: string }) {
  const [cachedMediaUrl, setCachedMediaUrl] = useState<string>()
  const { data, error, loading, reload } = useAsync(() => getTemplate(id), [id])
  useEffect(() => {
    let active = true
    let url: string | undefined
    getTemplateMediaPreview(id).then((blob) => {
      if (active && blob) { url = URL.createObjectURL(blob); setCachedMediaUrl(url) }
    }).catch(() => {})
    return () => { active = false; if (url) URL.revokeObjectURL(url) }
  }, [id])
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (loading) return <ListSkeleton />
  if (data === null) return <ErrorState message="Template not found" onRetry={reload} />
  return <>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div><Link href="/templates" className="text-sm text-muted-foreground hover:underline">← Templates</Link><h1 className="mt-2 text-2xl font-semibold">{data.name}</h1><p className="mt-1 text-sm text-muted-foreground">{data.category} · {data.language} · {data.status}</p></div>
    </div>
    <div className="max-w-sm"><h2 className="mb-3 text-sm font-medium text-muted-foreground">Live preview</h2><TemplatePreview category={data.category} header={data.header ? { ...data.header, mediaUrl: data.header.mediaUrl || cachedMediaUrl } : null} body={data.body} footer={data.footer} buttons={data.buttons} /></div>
  </>
}

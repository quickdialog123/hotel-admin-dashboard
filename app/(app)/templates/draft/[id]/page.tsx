"use client"

import { useParams } from "next/navigation"
import { getTemplateDraft } from "@/lib/api/template-drafts"
import { useAsync } from "@/lib/hooks/use-async"
import { ErrorState, ListSkeleton } from "@/components/app/states"
import { TemplateWizard } from "@/components/broadcasts/template-wizard"

export default function EditDraftPage() {
  const { id } = useParams<{ id: string }>()
  const { data, error, loading, reload } = useAsync(() => getTemplateDraft(id), [id])
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (loading) return <ListSkeleton />
  if (data === null) return <ErrorState message="Draft not found in this browser" onRetry={reload} />
  return <><h1 className="mb-6 text-2xl font-semibold">Local draft</h1><TemplateWizard key={id} initial={data} draftId={id} /></>
}

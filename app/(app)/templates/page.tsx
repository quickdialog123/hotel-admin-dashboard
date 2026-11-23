"use client"

import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { FileText, Plus, Trash2 } from "lucide-react"
import { ConfirmDialog } from "@/components/app/confirm-dialog"
import { PageHeader } from "@/components/app/page-header"
import { StatusPill, type PillTone } from "@/components/app/status-pill"
import { EmptyState, ErrorState, ListSkeleton } from "@/components/app/states"
import { Button, buttonVariants } from "@/components/ui/button"
import { deleteTemplate, listTemplates, type MessageTemplate } from "@/lib/api/broadcasts"
import { deleteTemplateDraft, listTemplateDrafts, type TemplateDraft } from "@/lib/api/template-drafts"
import { useAsync } from "@/lib/hooks/use-async"

function statusTone(status: string): PillTone { return status === "APPROVED" ? "solid" : status === "REJECTED" ? "error" : status === "PENDING" ? "progress" : "neutral" }
const CATEGORY_LABEL = { MARKETING: "Marketing", UTILITY: "Utility", AUTHENTICATION: "Authentication" }

export default function TemplatesPage() {
  const { data, error, reload } = useAsync(listTemplates)
  const drafts = useAsync(listTemplateDrafts)
  const [deleting, setDeleting] = useState<MessageTemplate | TemplateDraft | null>(null)

  return (
    <>
      <PageHeader
        title="Templates"
        description="WhatsApp message templates. Every broadcast needs a template that Meta has approved."
        actions={
          <Link href="/templates/new" className={buttonVariants({ className: "h-9 rounded-lg" })}>
            <Plus /> New template
          </Link>
        }
      />

      {error || drafts.error ? (
        <ErrorState message={error ?? drafts.error ?? "Unable to load templates"} onRetry={() => { reload(); drafts.reload() }} />
      ) : !data || !drafts.data ? (
        <ListSkeleton />
      ) : data.length === 0 && drafts.data.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-5" />}
          title="No templates yet"
          description="WhatsApp requires a Meta-approved template for every broadcast."
          action={<Link href="/templates/new" className={buttonVariants({ className: "rounded-lg" })}>Create template</Link>}
        />
      ) : (
        <ul className="overflow-hidden rounded-2xl border bg-white">
          {[...drafts.data, ...data].map((t) => (
            <li key={"localId" in t ? t.localId : t.id} className="flex items-center gap-4 border-b px-5 py-4 last:border-b-0">
              <Link href={"localId" in t ? `/templates/${t.localId}` : `/templates/${t.id}`} className="min-w-0 flex-1 rounded-md outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                <span className="block truncate font-semibold">{t.name}</span>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {CATEGORY_LABEL[t.category]} · {t.language} · {t.body}
                </p>
                {"rejectionReason" in t && t.rejectionReason && <p className="mt-1 text-sm text-red-700">{t.rejectionReason}</p>}
              </Link>
              <StatusPill tone={"localId" in t ? "neutral" : statusTone(t.status)}>{"localId" in t ? "Local draft" : t.status}</StatusPill>
              <Button variant="ghost" size="icon" aria-label={`Delete ${t.name}`} onClick={() => setDeleting(t)}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this template?"
        description={`"${deleting?.name}" will be deleted${deleting && "localId" in deleting ? " from this browser" : " from Meta"}.`}
        onConfirm={async () => {
          if (!deleting) return
          try {
            if ("localId" in deleting) { await deleteTemplateDraft(deleting.localId); drafts.reload() }
            else { await deleteTemplate(deleting.id); reload() }
            toast.success("Template deleted")
          } catch (error) { toast.error(error instanceof Error ? error.message : "Couldn't delete template"); throw error }
        }}
      />
    </>
  )
}

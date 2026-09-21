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
import { deleteTemplate, listTemplates, type MessageTemplate, type TemplateStatus } from "@/lib/api/broadcasts"
import { useAsync } from "@/lib/hooks/use-async"
import { timeAgo } from "@/lib/format"

const TEMPLATE_TONE: Record<TemplateStatus, PillTone> = { APPROVED: "solid", PENDING: "progress", REJECTED: "error", DRAFT: "neutral" }
const TEMPLATE_LABEL: Record<TemplateStatus, string> = { APPROVED: "Approved", PENDING: "Pending approval", REJECTED: "Rejected", DRAFT: "Draft" }
const CATEGORY_LABEL = { MARKETING: "Marketing", UTILITY: "Utility", AUTHENTICATION: "Authentication" }

export default function CampaignsPage() {
  const { data, error, reload } = useAsync(listTemplates)
  const [deleting, setDeleting] = useState<MessageTemplate | null>(null)

  return (
    <>
      <PageHeader
        title="Campaigns"
        description="WhatsApp message templates. Every broadcast needs a campaign that Meta has approved."
        actions={
          <Link href="/campaigns/new" className={buttonVariants({ className: "h-9 rounded-lg" })}>
            <Plus /> New campaign
          </Link>
        }
      />

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <ListSkeleton />
      ) : data.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-5" />}
          title="No campaigns yet"
          description="WhatsApp requires a Meta-approved template for every broadcast."
          action={<Link href="/campaigns/new" className={buttonVariants({ className: "rounded-lg" })}>Create campaign</Link>}
        />
      ) : (
        <ul className="overflow-hidden rounded-2xl border bg-white">
          {data.map((t) => (
            <li key={t.id} className="flex items-center gap-4 border-b px-5 py-4 last:border-b-0">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{t.name}</p>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {CATEGORY_LABEL[t.category]} · {t.language} · {t.body}
                </p>
                {t.status === "REJECTED" && t.rejectionReason && <p className="mt-1 text-sm text-red-700">{t.rejectionReason}</p>}
              </div>
              <StatusPill tone={TEMPLATE_TONE[t.status]}>{TEMPLATE_LABEL[t.status]}</StatusPill>
              <span className="hidden w-16 text-right text-xs text-muted-foreground sm:block">{timeAgo(t.updatedAt)}</span>
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
        title="Delete this campaign?"
        description={`"${deleting?.name}" will be removed. Past broadcasts that used it are unaffected.`}
        onConfirm={async () => {
          if (!deleting) return
          await deleteTemplate(deleting.id)
          toast.success("Campaign deleted")
          reload()
        }}
      />
    </>
  )
}

"use client"

import Link from "next/link"
import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { FileText, Plus, Radio, Search, Trash2 } from "lucide-react"
import { ConfirmDialog } from "@/components/app/confirm-dialog"
import { ListRow, RowList } from "@/components/app/list-row"
import { PageHeader } from "@/components/app/page-header"
import { SearchBar } from "@/components/app/search-bar"
import { StatusPill, type PillTone } from "@/components/app/status-pill"
import { EmptyState, ErrorState, ListSkeleton } from "@/components/app/states"
import { Button, buttonVariants } from "@/components/ui/button"
import { deleteTemplate, listBroadcasts, listTemplates, type MessageTemplate, type TemplateStatus } from "@/lib/api/broadcasts"
import { BROADCAST_LABEL, BROADCAST_TONE } from "@/components/broadcasts/status"
import { useAsync } from "@/lib/hooks/use-async"
import { cn } from "@/lib/utils"
import { formatDateTime, timeAgo } from "@/lib/format"

const TEMPLATE_TONE: Record<TemplateStatus, PillTone> = { APPROVED: "solid", PENDING: "progress", REJECTED: "error", DRAFT: "neutral" }
const TEMPLATE_LABEL: Record<TemplateStatus, string> = { APPROVED: "Approved", PENDING: "Pending approval", REJECTED: "Rejected", DRAFT: "Draft" }
const CATEGORY_LABEL = { MARKETING: "Marketing", UTILITY: "Utility", AUTHENTICATION: "Authentication" }

function BroadcastsInner() {
  const router = useRouter()
  const params = useSearchParams()
  const tab = params.get("tab") === "templates" ? "templates" : "history"
  const setTab = (t: string) => router.replace(t === "templates" ? "/broadcasts?tab=templates" : "/broadcasts")

  return (
    <>
      <PageHeader
        title="Broadcasts"
        description="Send approved WhatsApp templates to groups of guests and track delivery."
        actions={
          tab === "history" ? (
            <Link href="/broadcasts/new" className={buttonVariants({ className: "h-9 rounded-xl" })}><Plus /> New broadcast</Link>
          ) : (
            <Link href="/broadcasts/templates/new" className={buttonVariants({ className: "h-9 rounded-xl" })}><Plus /> New template</Link>
          )
        }
      />
      <div role="tablist" aria-label="Broadcasts sections" className="mb-5 inline-flex rounded-full border bg-white p-1">
        {[["history", "History"], ["templates", "Message templates"]].map(([k, label]) => (
          <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("rounded-full px-4 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30", tab === k ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900")}>
            {label}
          </button>
        ))}
      </div>
      {tab === "history" ? <History /> : <Templates />}
    </>
  )
}

function History() {
  const [search, setSearch] = useState("")
  const [q, setQ] = useState("")
  useEffect(() => {
    const t = setTimeout(() => setQ(search), 250)
    return () => clearTimeout(t)
  }, [search])
  const { data, error, loading, reload } = useAsync(() => listBroadcasts({ search: q }), [q])

  return (
    <>
      <SearchBar className="mb-4" value={search} onChange={setSearch} placeholder="Search by template or segment..." label="Search broadcasts" />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <ListSkeleton />
      ) : data.length === 0 ? (
        q ? <EmptyState icon={<Search className="size-5" />} title="No broadcasts match" description={`Nothing found for "${q}".`} /> : <EmptyState icon={<Radio className="size-5" />} title="No broadcasts yet" description="Send your first broadcast to a group of guests using an approved template." action={<Link href="/broadcasts/new" className={buttonVariants({ className: "rounded-xl" })}>New broadcast</Link>} />
      ) : (
        <div className={cn(loading && "opacity-60 transition-opacity")}>
          <RowList>
            {data.map((b) => (
              <ListRow
                key={b.id}
                href={`/broadcasts/${b.id}`}
                title={b.templateName}
                subtitle={`${b.segmentName} · ${formatDateTime(b.sentAt)} · ${b.delivered.toLocaleString()} delivered, ${b.failed.toLocaleString()} failed`}
                right={<StatusPill tone={BROADCAST_TONE[b.status]}>{BROADCAST_LABEL[b.status]}</StatusPill>}
              />
            ))}
          </RowList>
        </div>
      )}
    </>
  )
}

function Templates() {
  const { data, error, reload } = useAsync(listTemplates)
  const [deleting, setDeleting] = useState<MessageTemplate | null>(null)

  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data) return <ListSkeleton />
  if (data.length === 0)
    return <EmptyState icon={<FileText className="size-5" />} title="No templates yet" description="WhatsApp requires a Meta-approved template for every broadcast." action={<Link href="/broadcasts/templates/new" className={buttonVariants({ className: "rounded-xl" })}>Create template</Link>} />

  return (
    <>
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
            <Button variant="ghost" size="icon" aria-label={`Delete ${t.name}`} onClick={() => setDeleting(t)}><Trash2 /></Button>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this template?"
        description={`"${deleting?.name}" will be removed. Past broadcasts that used it are unaffected.`}
        onConfirm={async () => {
          if (!deleting) return
          await deleteTemplate(deleting.id)
          toast.success("Template deleted")
          reload()
        }}
      />
    </>
  )
}

export default function BroadcastsPage() {
  return (
    <Suspense>
      <BroadcastsInner />
    </Suspense>
  )
}

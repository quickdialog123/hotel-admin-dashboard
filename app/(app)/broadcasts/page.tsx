"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Plus, Radio, Search } from "lucide-react"
import { ListRow, RowList } from "@/components/app/list-row"
import { PageHeader } from "@/components/app/page-header"
import { SearchBar } from "@/components/app/search-bar"
import { StatusPill } from "@/components/app/status-pill"
import { EmptyState, ErrorState, ListSkeleton } from "@/components/app/states"
import { BROADCAST_LABEL, BROADCAST_TONE } from "@/components/broadcasts/status"
import { buttonVariants } from "@/components/ui/button"
import { listBroadcasts } from "@/lib/api/broadcasts"
import { useAsync } from "@/lib/hooks/use-async"
import { cn } from "@/lib/utils"
import { formatDateTime } from "@/lib/format"

export default function BroadcastsPage() {
  const [search, setSearch] = useState("")
  const [q, setQ] = useState("")
  useEffect(() => {
    const t = setTimeout(() => setQ(search), 250)
    return () => clearTimeout(t)
  }, [search])
  const { data, error, loading, reload } = useAsync(() => listBroadcasts({ search: q }), [q])

  return (
    <>
      <PageHeader
        title="Broadcasts"
        description="Send approved campaigns to groups of guests and track delivery."
        actions={
          <Link href="/broadcasts/new" className={buttonVariants({ className: "h-9 rounded-lg" })}>
            <Plus /> New broadcast
          </Link>
        }
      />
      <SearchBar className="mb-4" value={search} onChange={setSearch} placeholder="Search by campaign or segment..." label="Search broadcasts" />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <ListSkeleton />
      ) : data.length === 0 ? (
        q ? (
          <EmptyState icon={<Search className="size-5" />} title="No broadcasts match" description={`Nothing found for "${q}".`} />
        ) : (
          <EmptyState
            icon={<Radio className="size-5" />}
            title="No broadcasts yet"
            description="Send your first broadcast to a group of guests using an approved campaign."
            action={<Link href="/broadcasts/new" className={buttonVariants({ className: "rounded-lg" })}>New broadcast</Link>}
          />
        )
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

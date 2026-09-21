"use client"

import { useEffect, useState } from "react"
import { MessageSquare, Search } from "lucide-react"
import { ListRow, RowList } from "@/components/app/list-row"
import { PageHeader } from "@/components/app/page-header"
import { SearchBar } from "@/components/app/search-bar"
import { EmptyState, ErrorState, ListSkeleton } from "@/components/app/states"
import { ConversationStatusPill } from "@/components/conversations/status"
import { listConversations } from "@/lib/api/conversations"
import { useAsync } from "@/lib/hooks/use-async"
import { timeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"

export default function ConversationsPage() {
  const [search, setSearch] = useState("")
  const [q, setQ] = useState("")
  useEffect(() => {
    const t = setTimeout(() => setQ(search), 250)
    return () => clearTimeout(t)
  }, [search])
  const { data, error, loading, reload } = useAsync(() => listConversations({ search: q }), [q])

  return (
    <>
      <PageHeader title="Conversations" description="Every guest chat with your AI receptionist. Step in whenever a guest needs a human." />
      <SearchBar className="mb-4" value={search} onChange={setSearch} placeholder="Search by guest, room number..." label="Search conversations" />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <ListSkeleton />
      ) : data.length === 0 ? (
        q ? <EmptyState icon={<Search className="size-5" />} title="No conversations match" description={`Nothing found for "${q}".`} /> : <EmptyState icon={<MessageSquare className="size-5" />} title="No conversations yet" description="When guests message your WhatsApp number, their chats will appear here." />
      ) : (
        <div className={cn(loading && "opacity-60 transition-opacity")}>
          <RowList>
            {data.map((c) => (
              <ListRow key={c.id} href={`/conversations/${c.id}`} title={c.guestLabel} subtitle={`${c.lastMessagePreview} · ${timeAgo(c.lastMessageAt)}`} right={<ConversationStatusPill status={c.status} />} />
            ))}
          </RowList>
        </div>
      )}
    </>
  )
}

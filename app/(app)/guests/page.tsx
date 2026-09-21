"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ArrowDown, ArrowUp, ChevronsUpDown, Download, MessageSquare, MoreHorizontal, Plus, Search, ShieldBan, User, Users } from "lucide-react"
import { ConfirmDialog } from "@/components/app/confirm-dialog"
import { PageHeader } from "@/components/app/page-header"
import { PillSelect } from "@/components/app/pill-select"
import { StatusPill } from "@/components/app/status-pill"
import { EmptyState, ErrorState } from "@/components/app/states"
import { Avatar, GuestStatusPill } from "@/components/guests/guest-bits"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { blockGuest, createGuest, exportGuestConversation, listAllGuestsCount, listGuests, type Guest, type ListGuestsParams } from "@/lib/api/guests"
import { findConversationByGuest } from "@/lib/api/conversations"
import { useAsync } from "@/lib/hooks/use-async"
import { timeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"

type SortKey = NonNullable<ListGuestsParams["sortBy"]>

function pageWindow(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const set = new Set([1, pages, page, page - 1, page + 1].filter((p) => p >= 1 && p <= pages))
  const sorted = [...set].sort((a, b) => a - b)
  const out: (number | "…")[] = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("…")
    out.push(p)
  })
  return out
}

export default function GuestsPage() {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortBy, setSortBy] = useState<SortKey>("lastContactAt")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [blocking, setBlocking] = useState<Guest | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 250)
    return () => clearTimeout(t)
  }, [search])

  const total = useAsync(listAllGuestsCount)
  const { data, error, loading, reload } = useAsync(() => listGuests({ search: debounced, page, pageSize, sortBy, sortDir }), [debounced, page, pageSize, sortBy, sortDir])

  const pages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1
  const neverAnyone = total.data === 0

  function sort(key: SortKey) {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setSortBy(key)
      setSortDir("asc")
    }
    setPage(1)
  }

  async function openConversation(g: Guest) {
    const c = await findConversationByGuest(g.id)
    if (c) router.push(`/conversations/${c.id}`)
    else toast.info(`${g.name} hasn't started a conversation yet`)
  }

  const th = (k: SortKey, label: string) => (
    <th key={k} scope="col" aria-sort={sortBy === k ? (sortDir === "asc" ? "ascending" : "descending") : "none"} className="px-4 py-3 text-left font-medium">
      <button type="button" onClick={() => sort(k)} className="inline-flex items-center gap-1 rounded outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-zinc-900/30">
        {label}
        {sortBy === k ? sortDir === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" /> : <ChevronsUpDown className="size-3.5 opacity-50" />}
      </button>
    </th>
  )

  return (
    <>
      <PageHeader title="Guests" description="Everyone who has messaged your AI receptionist." />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input type="search" aria-label="Search guests" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, room number, phone..." className="h-10 w-full rounded-full border bg-white pr-4 pl-11 text-sm outline-none focus-visible:border-zinc-900 focus-visible:ring-3 focus-visible:ring-zinc-900/15" />
        </div>
        <Button className="h-10 rounded-full px-5" onClick={() => setAddOpen(true)}>
          <Plus /> Add Guest
        </Button>
        <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          Show
          <PillSelect label="Entries per page" value={String(pageSize)} onChange={(v) => { setPageSize(Number(v)); setPage(1) }} options={["10", "25", "50"].map((v) => ({ value: v, label: v }))} />
          Entries
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : neverAnyone ? (
        <EmptyState icon={<Users className="size-5" />} title="No guests yet" description="Guests appear here after they first message your AI receptionist on WhatsApp." />
      ) : !data ? (
        <div className="space-y-2 rounded-3xl border bg-white p-4" aria-busy="true" aria-label="Loading">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : data.total === 0 ? (
        <EmptyState icon={<Search className="size-5" />} title="No guests match your search" description={`Nothing found for "${debounced}".`} action={<Button variant="outline" onClick={() => setSearch("")}>Clear search</Button>} />
      ) : (
        <>
          <div className={cn("overflow-x-auto rounded-3xl border bg-white transition-opacity", loading && "opacity-60")}>
            <table className="w-full min-w-[960px] text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-medium">Profile</th>
                  {th("name", "Name")}
                  <th scope="col" className="px-4 py-3 text-left font-medium">WhatsApp Number</th>
                  {th("roomNumber", "Room")}
                  {th("status", "Status")}
                  {th("lastContactAt", "Last Contact")}
                  <th scope="col" className="px-4 py-3 text-left font-medium">Preferences</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium">Loyalty Tier</th>
                  <th scope="col" className="w-12 px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((g) => (
                  <tr key={g.id} className="border-b last:border-b-0 hover:bg-zinc-50">
                    <td className="px-4 py-3"><Avatar name={g.name} /></td>
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/guests/${g.id}`} className="hover:underline focus-visible:underline focus-visible:outline-none">{g.name}</Link>
                      {g.blocked && <StatusPill tone="error" className="ml-2">Blocked</StatusPill>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground tabular-nums">{g.whatsappNumber}</td>
                    <td className="px-4 py-3 tabular-nums">{g.roomNumber ?? "—"}</td>
                    <td className="px-4 py-3"><GuestStatusPill status={g.status} /></td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{timeAgo(g.lastContactAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {g.preferences.length ? g.preferences.map((p) => <StatusPill key={p} tone="neutral">{p}</StatusPill>) : <span className="text-muted-foreground">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">{g.loyaltyTier ? <StatusPill tone="outline">{g.loyaltyTier}</StatusPill> : <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger aria-label={`Actions for ${g.name}`} className="flex size-8 items-center justify-center rounded-full outline-none hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-900/30 aria-expanded:bg-zinc-100">
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-2xl p-1.5">
                          <DropdownMenuItem className="rounded-xl" onClick={() => router.push(`/guests/${g.id}`)}><User /> View guest profile</DropdownMenuItem>
                          <DropdownMenuItem className="rounded-xl" onClick={() => openConversation(g)}><MessageSquare /> Open conversation</DropdownMenuItem>
                          <DropdownMenuItem className="rounded-xl" onClick={async () => { const r = await exportGuestConversation(g.id); toast.success(`Exported ${r.fileName}`) }}><Download /> Export conversation history</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" className="rounded-xl" onClick={() => setBlocking(g)}><ShieldBan /> Block guest</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, data.total)} of {data.total}
            </span>
            <nav aria-label="Pagination" className="flex items-center gap-1">
              <Button variant="ghost" className="rounded-full" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              {pageWindow(page, pages).map((p, i) =>
                p === "…" ? (
                  <span key={`e${i}`} className="px-2">…</span>
                ) : (
                  <button key={p} type="button" aria-current={p === page ? "page" : undefined} onClick={() => setPage(p)} className={cn("size-8 rounded-full text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/30", p === page ? "bg-zinc-900 text-white" : "hover:bg-zinc-100")}>
                    {p}
                  </button>
                ),
              )}
              <Button variant="ghost" className="rounded-full" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
            </nav>
          </div>
        </>
      )}

      <AddGuestDialog open={addOpen} onOpenChange={setAddOpen} onCreated={() => { total.reload(); reload() }} />

      <ConfirmDialog
        open={!!blocking}
        onOpenChange={(o) => !o && setBlocking(null)}
        title={`Block ${blocking?.name}?`}
        description="The AI receptionist will stop replying to this guest and their messages will be ignored. You can unblock them later."
        confirmLabel="Block guest"
        onConfirm={async () => {
          if (!blocking) return
          await blockGuest(blocking.id)
          toast.success(`${blocking.name} blocked`)
          reload()
        }}
      />
    </>
  )
}

function AddGuestDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const [name, setName] = useState("")
  const [number, setNumber] = useState("")
  const [room, setRoom] = useState("")
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const numberValid = /^\+?[0-9 ()-]{7,}$/.test(number.trim())

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!name.trim() || !numberValid) return
    setBusy(true)
    try {
      await createGuest({ name: name.trim(), whatsappNumber: number.trim(), roomNumber: room.trim() || null })
      toast.success("Guest added")
      setName(""); setNumber(""); setRoom(""); setTouched(false)
      onOpenChange(false)
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add guest")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add guest</DialogTitle>
            <DialogDescription>Manually add a guest so your team can message them.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="g-name">Name</Label>
            <Input id="g-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={touched && !name.trim()} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="g-num">WhatsApp number</Label>
            <Input id="g-num" placeholder="+44 7700 900000" value={number} onChange={(e) => setNumber(e.target.value)} aria-invalid={touched && !numberValid} />
            {touched && !numberValid && <p className="text-sm text-destructive">Enter a valid phone number.</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="g-room">Room number (optional)</Label>
            <Input id="g-room" value={room} onChange={(e) => setRoom(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Adding…" : "Add guest"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { ArrowDown, ArrowUp, ChevronsUpDown, MoreHorizontal, Plus, Search, Trash2, Upload, User, Users } from "lucide-react"
import { ConfirmDialog } from "@/components/app/confirm-dialog"
import { PageHeader } from "@/components/app/page-header"
import { EmptyState, ErrorState } from "@/components/app/states"
import { Avatar, dayAfterGuestDate, formatGuestDate, guestName } from "@/components/guests/guest-bits"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { deleteGuest, createGuest, listGuests, type Guest, type GuestInput } from "@/lib/api/guests"
import { useAsync } from "@/lib/hooks/use-async"
import { cn } from "@/lib/utils"

type SortKey = "firstName" | "email" | "address" | "phoneNumber" | "roomNumber" | "floorNumber" | "checkInDate" | "checkOutDate"

function pageWindow(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const visible = new Set([1, pages, page, page - 1, page + 1].filter((p) => p >= 1 && p <= pages))
  const sorted = [...visible].sort((a, b) => a - b)
  const result: (number | "…")[] = []
  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1] > 1) result.push("…")
    result.push(value)
  })
  return result
}

export default function GuestsPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortBy, setSortBy] = useState<SortKey>("firstName")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [deleting, setDeleting] = useState<Guest | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const { data, error, loading, reload } = useAsync(
    () => session?.user.hotelId ? listGuests() : Promise.resolve([]),
    [session?.user.hotelId],
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search.trim().toLowerCase())
      setPage(1)
    }, 250)
    return () => clearTimeout(timer)
  }, [search])

  const rows = useMemo(() => {
    const guests = (data ?? []).filter((guest) =>
      [guest.firstName, guest.lastName, guest.email ?? "", guest.address ?? "", guest.phoneNumber, String(guest.roomNumber), String(guest.floorNumber), guest.checkInDate, guest.checkOutDate]
        .some((value) => value.toLowerCase().includes(debounced)),
    )
    return guests.sort((a, b) => {
      const left = a[sortBy]
      const right = b[sortBy]
      const comparison = typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left).localeCompare(String(right), undefined, { numeric: true })
      return sortDir === "asc" ? comparison : -comparison
    })
  }, [data, debounced, sortBy, sortDir])

  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const visibleRows = rows.slice((page - 1) * pageSize, page * pageSize)

  function sort(key: SortKey) {
    if (sortBy === key) setSortDir((direction) => direction === "asc" ? "desc" : "asc")
    else {
      setSortBy(key)
      setSortDir("asc")
    }
    setPage(1)
  }

  const heading = (key: SortKey, label: string) => (
    <th key={key} scope="col" aria-sort={sortBy === key ? (sortDir === "asc" ? "ascending" : "descending") : "none"} className="px-4 py-3 text-left font-medium">
      <button type="button" onClick={() => sort(key)} className="inline-flex items-center gap-1 rounded outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-slate-900/30">
        {label}
        {sortBy === key ? sortDir === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" /> : <ChevronsUpDown className="size-3.5 opacity-50" />}
      </button>
    </th>
  )

  if (status === "loading") return <Skeleton className="h-96 rounded-2xl" />
  if (!session?.user.hotelId) {
    return <ErrorState message="No hotel is assigned to your account. Contact your administrator to get access to guest records." />
  }

  return (
    <>
      <PageHeader title="Guests" description="Guest contact details and stay information." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input type="search" aria-label="Search guests" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search guest, room, date, email..." className="h-10 w-full rounded-full border bg-white pr-4 pl-11 text-sm outline-none focus-visible:border-slate-900 focus-visible:ring-3 focus-visible:ring-slate-900/15" />
        </div>
        <Button className="h-10 rounded-full px-5" onClick={() => setAddOpen(true)}><Plus /> Add Guest</Button>
        <Button variant="outline" className="h-10 rounded-full px-5" onClick={() => router.push("/guests/import")}><Upload /> Import CSV</Button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          Show
          <select aria-label="Entries per page" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }} className="h-9 rounded-lg border bg-white px-2 text-foreground">
            {[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
          Entries
        </label>
      </div>

      {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? (
        <div className="space-y-2 rounded-2xl border bg-white p-4" aria-busy="true" aria-label="Loading">
          {Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-11 w-full" />)}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<Users className="size-5" />} title={data?.length ? "No guests match your search" : "No guests yet"} description={data?.length ? `Nothing found for “${search}”.` : "Guest records for your hotel will appear here."} action={data?.length ? <Button variant="outline" onClick={() => setSearch("")}>Clear search</Button> : undefined} />
      ) : (
        <>
          <div className={cn("overflow-x-auto rounded-2xl border bg-white transition-opacity", loading && "opacity-60")}>
            <table className="w-full min-w-[1050px] text-sm">
              <thead className="border-b text-xs text-muted-foreground"><tr>
                {heading("firstName", "Guest")}{heading("roomNumber", "Room")}{heading("floorNumber", "Floor")}
                {heading("email", "Email")}{heading("address", "Address")}{heading("phoneNumber", "Phone")}{heading("checkInDate", "Check-in")}{heading("checkOutDate", "Check-out")}
                <th scope="col" className="w-12 px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr></thead>
              <tbody>{visibleRows.map((guest) => (
                <tr key={guest.id} className="border-b last:border-b-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium"><Link href={`/guests/${guest.id}`} className="inline-flex items-center gap-3 hover:underline focus-visible:underline focus-visible:outline-none"><Avatar name={guestName(guest)} />{guestName(guest)}</Link></td>
                  <td className="px-4 py-3 tabular-nums">{guest.roomNumber}</td>
                  <td className="px-4 py-3 tabular-nums">{guest.floorNumber}</td>
                  <td className="px-4 py-3 text-muted-foreground">{guest.email || "—"}</td>
                  <td className="max-w-64 truncate px-4 py-3 text-muted-foreground" title={guest.address ?? undefined}>{guest.address || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground tabular-nums">{guest.phoneNumber}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatGuestDate(guest.checkInDate)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatGuestDate(guest.checkOutDate)}</td>
                  <td className="px-4 py-3"><DropdownMenu>
                    <DropdownMenuTrigger aria-label={`Actions for ${guestName(guest)}`} className="flex size-8 items-center justify-center rounded-full outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-900/30 aria-expanded:bg-slate-100"><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 rounded-2xl p-1.5">
                      <DropdownMenuItem className="rounded-xl" onClick={() => router.push(`/guests/${guest.id}`)}><User /> View guest</DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" className="rounded-xl" onClick={() => setDeleting(guest)}><Trash2 /> Delete guest</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, rows.length)} of {rows.length}</span>
            <nav aria-label="Pagination" className="flex items-center gap-1">
              <Button variant="ghost" className="rounded-full" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              {pageWindow(page, pages).map((value, index) => value === "…" ? <span key={`ellipsis-${index}`} className="px-2">…</span> : (
                <button key={value} type="button" aria-current={value === page ? "page" : undefined} onClick={() => setPage(value)} className={cn("size-8 rounded-full text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30", value === page ? "bg-slate-900 text-white" : "hover:bg-slate-100")}>{value}</button>
              ))}
              <Button variant="ghost" className="rounded-full" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
            </nav>
          </div>
        </>
      )}

      <AddGuestDialog open={addOpen} onOpenChange={setAddOpen} onCreated={reload} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting ? guestName(deleting) : "guest"}?`}
        description="This permanently deletes this guest record from your hotel’s guest list."
        confirmLabel="Delete guest"
        onConfirm={async () => {
          if (!deleting) return
          await deleteGuest(deleting.id)
          toast.success("Guest deleted")
          setDeleting(null)
          reload()
        }}
      />
    </>
  )
}

function AddGuestDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => void }) {
  const initialValues = { firstName: "", lastName: "", email: "", address: "", phoneNumber: "", checkInDate: "", checkOutDate: "", roomNumber: "", floorNumber: "" }
  const [values, setValues] = useState(initialValues)
  const [busy, setBusy] = useState(false)

  function setField(field: keyof typeof initialValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    try {
      const input: GuestInput = {
        ...values,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim() || null,
        address: values.address.trim() || null,
        phoneNumber: values.phoneNumber.trim(),
        roomNumber: Number(values.roomNumber),
        floorNumber: Number(values.floorNumber),
      }
      await createGuest(input)
      toast.success("Guest added")
      setValues(initialValues)
      onOpenChange(false)
      onCreated()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't add guest")
    } finally {
      setBusy(false)
    }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader><DialogTitle>Add guest</DialogTitle><DialogDescription>Add contact and stay details to your hotel’s records.</DialogDescription></DialogHeader>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="guest-first-name">First name</Label><Input id="guest-first-name" autoComplete="given-name" maxLength={100} value={values.firstName} onChange={(event) => setField("firstName", event.target.value)} required /></div>
        <div className="space-y-2"><Label htmlFor="guest-last-name">Last name</Label><Input id="guest-last-name" autoComplete="family-name" maxLength={100} value={values.lastName} onChange={(event) => setField("lastName", event.target.value)} required /></div>
        <div className="space-y-2"><Label htmlFor="guest-email">Email <span className="text-muted-foreground">(optional)</span></Label><Input id="guest-email" type="email" autoComplete="email" value={values.email} onChange={(event) => setField("email", event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="guest-address">Address <span className="text-muted-foreground">(optional)</span></Label><Input id="guest-address" autoComplete="street-address" value={values.address} onChange={(event) => setField("address", event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="guest-phone">Phone number</Label><Input id="guest-phone" type="tel" autoComplete="tel" maxLength={32} placeholder="+1 555 010 0001" value={values.phoneNumber} onChange={(event) => setField("phoneNumber", event.target.value)} required /></div>
        <div className="space-y-2"><Label htmlFor="guest-check-in">Check-in date</Label><Input id="guest-check-in" type="date" value={values.checkInDate} onChange={(event) => setField("checkInDate", event.target.value)} required /></div>
        <div className="space-y-2"><Label htmlFor="guest-check-out">Check-out date</Label><Input id="guest-check-out" type="date" min={values.checkInDate ? dayAfterGuestDate(values.checkInDate) : undefined} value={values.checkOutDate} onChange={(event) => setField("checkOutDate", event.target.value)} required /></div>
        <div className="space-y-2"><Label htmlFor="guest-room">Room number</Label><Input id="guest-room" type="number" min="1" step="1" value={values.roomNumber} onChange={(event) => setField("roomNumber", event.target.value)} required /></div>
        <div className="space-y-2"><Label htmlFor="guest-floor">Floor number</Label><Input id="guest-floor" type="number" step="1" value={values.floorNumber} onChange={(event) => setField("floorNumber", event.target.value)} required /></div>
      </div>
      <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Adding…" : "Add guest"}</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>
}

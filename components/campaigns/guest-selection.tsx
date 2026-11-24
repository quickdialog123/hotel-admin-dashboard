"use client"

import { Users } from "lucide-react"

import { SearchBar } from "@/components/app/search-bar"
import { EmptyState, ErrorState, ListSkeleton } from "@/components/app/states"
import { Avatar, formatGuestDate, guestName } from "@/components/guests/guest-bits"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Guest } from "@/lib/api/guests"
import { isInHouseOn, recipientIneligibility } from "@/lib/campaigns/recipients"

type Props = {
  guests: Guest[]
  loading: boolean
  error: string | null
  onRetry: () => void
  selectedIds: string[]
  onSelectedIdsChange: (ids: string[]) => void
  search: string
  onSearchChange: (value: string) => void
  inHouse: boolean
  onInHouseChange: (value: boolean) => void
  referenceDate: string
  onReferenceDateChange: (value: string) => void
  timeZone: string
  category: string
}

export function GuestSelection({ guests, loading, error, onRetry, selectedIds, onSelectedIdsChange, search, onSearchChange, inHouse, onInHouseChange, referenceDate, onReferenceDateChange, timeZone, category }: Props) {
  const byId = new Map(guests.map((guest) => [guest.id, guest]))
  const selectedPhones = new Set(selectedIds.map((id) => byId.get(id)?.phoneNumber.replace(/\D/g, "")).filter(Boolean))
  const visible = guests.filter((guest) =>
    (!inHouse || isInHouseOn(guest, referenceDate)) &&
    `${guest.firstName} ${guest.lastName} ${guest.phoneNumber}`.toLowerCase().includes(search.trim().toLowerCase()),
  )
  function reasonFor(guest: Guest) {
    const base = recipientIneligibility(guest, category)
    if (base) return base
    const phone = guest.phoneNumber.replace(/\D/g, "")
    return phone && selectedPhones.has(phone) && !selectedIds.includes(guest.id) ? "Phone number already selected" : null
  }
  const eligible = visible.filter((guest) => !reasonFor(guest))

  function updateStay(nextInHouse: boolean, nextDate: string) {
    const date = nextDate || referenceDate
    onInHouseChange(nextInHouse)
    onReferenceDateChange(date)
    if (nextInHouse) onSelectedIdsChange(selectedIds.filter((id) => {
      const guest = byId.get(id)
      return guest && isInHouseOn(guest, date)
    }))
  }

  function selectAll() {
    const ids = new Set(selectedIds)
    const phones = new Set(selectedPhones)
    for (const guest of visible) {
      const phone = guest.phoneNumber.replace(/\D/g, "")
      if (recipientIneligibility(guest, category) || !phone || phones.has(phone)) continue
      ids.add(guest.id)
      phones.add(phone)
    }
    onSelectedIdsChange([...ids])
  }

  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <SearchBar value={search} onChange={onSearchChange} placeholder="Search name or phone..." label="Search guests" showSubmit={false} />
      <div className="space-y-1.5"><Label htmlFor="campaign-reference-date">Reference date</Label><Input id="campaign-reference-date" type="date" value={referenceDate} onChange={(event) => updateStay(inHouse, event.target.value)} className="h-11 sm:w-44" /></div>
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <Checkbox id="campaign-in-house" checked={inHouse} onCheckedChange={(value) => updateStay(Boolean(value), referenceDate)} />
      <Label htmlFor="campaign-in-house" className="cursor-pointer">Currently In-House</Label>
      <span className="text-xs text-muted-foreground">Check-in &lt; reference date and check-out &gt; reference date</span>
    </div>
    <p className="text-xs text-muted-foreground">Reference date uses {timeZone}. The hotel timezone currently comes from a frontend setting, with UTC as fallback. Changing the stay filter removes selected guests outside the new date. Search keeps your selection.</p>
    {category === "MARKETING" && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">The guest API does not provide marketing consent. Guests cannot qualify for this Marketing template until consent is available.</p>}
    {error ? <ErrorState message={error} onRetry={onRetry} /> : loading ? <ListSkeleton rows={5} /> : <>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p><span className="font-semibold">{visible.length}</span> matching · <span className="font-semibold">{selectedIds.length}</span> selected · <span className="font-semibold">{visible.length - eligible.length}</span> unavailable</p>
        <div className="flex gap-2"><Button type="button" variant="outline" onClick={selectAll} disabled={!eligible.length}>Select All Eligible</Button><Button type="button" variant="ghost" onClick={() => onSelectedIdsChange([])} disabled={!selectedIds.length}>Clear</Button></div>
      </div>
      {selectedIds.length > 0 && <div className="rounded-xl border bg-slate-50 p-3 text-sm"><p className="mb-2 font-medium">Selected guests</p><div className="flex flex-wrap gap-2">{selectedIds.map((id) => <span key={id} className="rounded-lg border bg-white px-2 py-1">{byId.has(id) ? guestName(byId.get(id)!) : `Guest ${id} unavailable`}</span>)}</div></div>}
      {!visible.length ? <EmptyState icon={<Users className="size-5" />} title={guests.length ? "No guests match" : "No guests available"} description={guests.length ? "Try another search or reference date." : "Guest records for this hotel will appear here."} /> : <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[780px] text-sm">
          <thead className="border-b bg-slate-50 text-xs text-muted-foreground"><tr><th scope="col" className="w-12 px-4 py-3"><span className="sr-only">Select</span></th><th scope="col" className="px-4 py-3 text-left font-medium">Guest</th><th scope="col" className="px-4 py-3 text-left font-medium">Phone</th><th scope="col" className="px-4 py-3 text-left font-medium">Check-in</th><th scope="col" className="px-4 py-3 text-left font-medium">Check-out</th><th scope="col" className="px-4 py-3 text-left font-medium">Marketing opt-in</th></tr></thead>
          <tbody>{visible.map((guest) => {
            const selected = selectedIds.includes(guest.id)
            const reason = reasonFor(guest)
            return <tr key={guest.id} className="border-b last:border-0 hover:bg-slate-50">
              <td className="px-4 py-3"><Checkbox checked={selected} disabled={Boolean(reason) && !selected} onCheckedChange={(value) => onSelectedIdsChange(value ? [...new Set([...selectedIds, guest.id])] : selectedIds.filter((id) => id !== guest.id))} aria-label={`Select ${guestName(guest)}`} /></td>
              <td className="px-4 py-3"><div className="flex items-center gap-2"><Avatar name={guestName(guest)} /><span><span className="block font-medium">{guestName(guest)}</span>{reason && <span className="block text-xs text-amber-800">{reason}</span>}</span></div></td>
              <td className="whitespace-nowrap px-4 py-3">{guest.phoneNumber || "—"}</td>
              <td className="whitespace-nowrap px-4 py-3">{formatGuestDate(guest.checkInDate)}</td>
              <td className="whitespace-nowrap px-4 py-3">{formatGuestDate(guest.checkOutDate)}</td>
              <td className="px-4 py-3 text-muted-foreground">Unknown</td>
            </tr>
          })}</tbody>
        </table>
      </div>}
    </>}
  </div>
}

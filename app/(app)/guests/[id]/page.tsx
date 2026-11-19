"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useState } from "react"
import { useSession } from "next-auth/react"
import { ArrowLeft, Save } from "lucide-react"
import { toast } from "sonner"
import { ErrorState } from "@/components/app/states"
import { Avatar, dayAfterGuestDate, formatGuestDate } from "@/components/guests/guest-bits"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { getGuest, updateGuest, type Guest } from "@/lib/api/guests"
import { useAsync } from "@/lib/hooks/use-async"

type GuestEdits = Pick<Guest, "firstName" | "lastName" | "email" | "phoneNumber" | "checkInDate" | "checkOutDate" | "roomNumber" | "floorNumber">

export default function GuestProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { data: session, status } = useSession()
  const { data, error, loading, reload } = useAsync(
    () => session?.user.hotelId ? getGuest(id) : Promise.resolve(null),
    [id, session?.user.hotelId],
  )
  const [edits, setEdits] = useState<GuestEdits | null>(null)
  const [saving, setSaving] = useState(false)
  const form = edits ?? (data ? {
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phoneNumber: data.phoneNumber,
    checkInDate: data.checkInDate,
    checkOutDate: data.checkOutDate,
    roomNumber: data.roomNumber,
    floorNumber: data.floorNumber,
  } : null)

  if (status === "loading" || (loading && !data)) return <Skeleton className="h-96 rounded-2xl" />
  if (!session?.user.hotelId) return <ErrorState message="No hotel is assigned to your account. Contact your administrator to get access to guest records." />
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data || !form) {
    return <div className="rounded-2xl border bg-white p-10 text-center"><p className="font-medium">Guest not found</p><Link href="/guests" className="mt-2 inline-block text-sm underline">Back to guests</Link></div>
  }

  const dirty = edits !== null && Object.keys(edits).some((field) => edits[field as keyof GuestEdits] !== data[field as keyof GuestEdits])
  const setField = (field: "firstName" | "lastName" | "email" | "phoneNumber" | "checkInDate" | "checkOutDate", value: string) => setEdits((current) => ({
    ...(current ?? form),
    [field]: value,
  }))
  const setNumberField = (field: "roomNumber" | "floorNumber", value: string) => setEdits((current) => ({
    ...(current ?? form),
    [field]: Number(value),
  }))

  async function save() {
    if (!edits) return
    setSaving(true)
    try {
      await updateGuest(id, edits)
      toast.success("Guest profile saved")
      setEdits(null)
      reload()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Couldn't save guest")
    } finally {
      setSaving(false)
    }
  }

  return <>
    <Link href="/guests" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Guests</Link>
    <div className="mb-6 flex flex-wrap items-center gap-4">
      <Avatar name={`${form.firstName} ${form.lastName}`} size="lg" />
      <div className="min-w-0 flex-1"><h1 className="text-2xl font-semibold tracking-tight">{form.firstName} {form.lastName}</h1><p className="mt-1 text-sm text-muted-foreground">Guest profile · Added {new Date(data.createdAt).toLocaleDateString()}</p></div>
      <Button className="rounded-xl" disabled={!dirty || saving} onClick={save}><Save /> {saving ? "Saving…" : "Save changes"}</Button>
    </div>
    <section className="max-w-3xl space-y-6 rounded-2xl border bg-white p-6">
      <div>
        <h2 className="font-semibold">Contact details</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="guest-first-name">First name</Label><Input id="guest-first-name" maxLength={100} value={form.firstName} onChange={(event) => setField("firstName", event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="guest-last-name">Last name</Label><Input id="guest-last-name" maxLength={100} value={form.lastName} onChange={(event) => setField("lastName", event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="guest-profile-email">Email</Label><Input id="guest-profile-email" type="email" value={form.email} onChange={(event) => setField("email", event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="guest-profile-phone">Phone number</Label><Input id="guest-profile-phone" type="tel" maxLength={32} value={form.phoneNumber} onChange={(event) => setField("phoneNumber", event.target.value)} /></div>
        </div>
      </div>
      <div className="border-t pt-5">
        <h2 className="font-semibold">Stay details</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="guest-profile-check-in">Check-in date</Label><Input id="guest-profile-check-in" type="date" value={form.checkInDate} onChange={(event) => setField("checkInDate", event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="guest-profile-check-out">Check-out date</Label><Input id="guest-profile-check-out" type="date" min={dayAfterGuestDate(form.checkInDate)} value={form.checkOutDate} onChange={(event) => setField("checkOutDate", event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="guest-profile-room">Room number</Label><Input id="guest-profile-room" type="number" min="1" step="1" value={form.roomNumber} onChange={(event) => setNumberField("roomNumber", event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="guest-profile-floor">Floor number</Label><Input id="guest-profile-floor" type="number" step="1" value={form.floorNumber} onChange={(event) => setNumberField("floorNumber", event.target.value)} /></div>
        </div>
      </div>
      <div className="border-t pt-4 text-sm text-muted-foreground">Stay: {formatGuestDate(form.checkInDate)} – {formatGuestDate(form.checkOutDate)} · Room {form.roomNumber}, floor {form.floorNumber}<br />Last updated {new Date(data.updatedAt).toLocaleString()}</div>
    </section>
  </>
}

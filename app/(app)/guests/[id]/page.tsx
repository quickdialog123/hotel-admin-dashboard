"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useState } from "react"
import { useSession } from "next-auth/react"
import { ArrowLeft, Save } from "lucide-react"
import { toast } from "sonner"
import { ErrorState } from "@/components/app/states"
import { Avatar } from "@/components/guests/guest-bits"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { getGuest, updateGuest, type Guest } from "@/lib/api/guests"
import { useAsync } from "@/lib/hooks/use-async"

type GuestEdits = Pick<Guest, "fullName" | "email" | "phoneNumber">

export default function GuestProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { data: session, status } = useSession()
  const { data, error, loading, reload } = useAsync(
    () => session?.user.hotelId ? getGuest(id) : Promise.resolve(null),
    [id, session?.user.hotelId],
  )
  const [edits, setEdits] = useState<GuestEdits | null>(null)
  const [saving, setSaving] = useState(false)
  const form = edits ?? (data ? { fullName: data.fullName, email: data.email, phoneNumber: data.phoneNumber } : null)

  if (status === "loading" || (loading && !data)) return <Skeleton className="h-96 rounded-2xl" />
  if (!session?.user.hotelId) return <ErrorState message="No hotel is assigned to your account. Contact your administrator to get access to guest records." />
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data || !form) {
    return <div className="rounded-2xl border bg-white p-10 text-center"><p className="font-medium">Guest not found</p><Link href="/guests" className="mt-2 inline-block text-sm underline">Back to guests</Link></div>
  }

  const dirty = edits !== null && (edits.fullName !== data.fullName || edits.email !== data.email || edits.phoneNumber !== data.phoneNumber)
  const setField = (field: keyof GuestEdits, value: string) => setEdits((current) => ({
    fullName: current?.fullName ?? data.fullName,
    email: current?.email ?? data.email,
    phoneNumber: current?.phoneNumber ?? data.phoneNumber,
    [field]: value,
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
      <Avatar name={form.fullName} size="lg" />
      <div className="min-w-0 flex-1"><h1 className="text-2xl font-semibold tracking-tight">{form.fullName}</h1><p className="mt-1 text-sm text-muted-foreground">Guest profile · Added {new Date(data.createdAt).toLocaleDateString()}</p></div>
      <Button className="rounded-xl" disabled={!dirty || saving} onClick={save}><Save /> {saving ? "Saving…" : "Save changes"}</Button>
    </div>
    <section className="max-w-2xl space-y-5 rounded-2xl border bg-white p-6">
      <h2 className="font-semibold">Contact details</h2>
      <div className="space-y-2"><Label htmlFor="guest-full-name">Full name</Label><Input id="guest-full-name" maxLength={200} value={form.fullName} onChange={(event) => setField("fullName", event.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="guest-profile-email">Email</Label><Input id="guest-profile-email" type="email" value={form.email} onChange={(event) => setField("email", event.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="guest-profile-phone">Phone number</Label><Input id="guest-profile-phone" type="tel" maxLength={32} value={form.phoneNumber} onChange={(event) => setField("phoneNumber", event.target.value)} /></div>
      <div className="border-t pt-4 text-sm text-muted-foreground">Last updated {new Date(data.updatedAt).toLocaleString()}</div>
    </section>
  </>
}

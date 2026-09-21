"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { ArrowLeft, MessageSquare, Plus, X } from "lucide-react"
import { PillSelect } from "@/components/app/pill-select"
import { ErrorState } from "@/components/app/states"
import { Avatar, GuestStatusPill, STATUS_OPTIONS } from "@/components/guests/guest-bits"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { findConversationByGuest } from "@/lib/api/conversations"
import { getGuest, updateGuest, type Guest } from "@/lib/api/guests"
import { useAsync } from "@/lib/hooks/use-async"
import { timeAgo } from "@/lib/format"

const TIERS = [
  { value: "none", label: "None" },
  { value: "Silver", label: "Silver" },
  { value: "Gold", label: "Gold" },
  { value: "Platinum", label: "Platinum" },
]

export default function GuestProfilePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data, error, loading, reload } = useAsync(() => getGuest(id), [id])
  const [edits, setEdits] = useState<Guest | null>(null)
  const form = edits ?? data
  const setForm = setEdits
  const [newPref, setNewPref] = useState("")
  const [saving, setSaving] = useState(false)

  if (error) return <ErrorState message={error} onRetry={reload} />
  if (loading && !data) return <Skeleton className="h-96 rounded-3xl" />
  if (!data || !form) {
    return (
      <div className="rounded-3xl border bg-white p-10 text-center">
        <p className="font-medium">Guest not found</p>
        <Link href="/guests" className="mt-2 inline-block text-sm underline">Back to guests</Link>
      </div>
    )
  }

  const dirty = edits !== null && JSON.stringify(edits) !== JSON.stringify(data)

  async function save() {
    if (!form) return
    setSaving(true)
    try {
      const { id: _id, ...rest } = form
      void _id
      await updateGuest(id, rest)
      toast.success("Guest profile saved")
      setEdits(null)
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save")
    } finally {
      setSaving(false)
    }
  }

  async function openConversation() {
    const c = await findConversationByGuest(id)
    if (c) router.push(`/conversations/${c.id}`)
    else toast.info("This guest hasn't started a conversation yet")
  }

  function addPref(e: React.FormEvent) {
    e.preventDefault()
    const v = newPref.trim()
    if (v && form && !form.preferences.includes(v)) setForm({ ...form, preferences: [...form.preferences, v] })
    setNewPref("")
  }

  return (
    <>
      <Link href="/guests" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Guests
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Avatar name={form.name} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{form.name}</h1>
          <div className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
            <GuestStatusPill status={form.status} /> Last contact {timeAgo(form.lastContactAt)}
          </div>
        </div>
        <Button variant="outline" className="rounded-xl" onClick={openConversation}>
          <MessageSquare /> Open conversation
        </Button>
        <Button className="rounded-xl" disabled={!dirty || saving} onClick={save}>{saving ? "Saving…" : "Save changes"}</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-3xl border bg-white p-6">
          <h2 className="font-semibold">Contact & stay</h2>
          <div className="space-y-2">
            <Label htmlFor="p-name">Name</Label>
            <Input id="p-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="p-num">WhatsApp number</Label>
              <Input id="p-num" value={form.whatsappNumber} onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-room">Room number</Label>
              <Input id="p-room" value={form.roomNumber ?? ""} onChange={(e) => setForm({ ...form, roomNumber: e.target.value || null })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-in">Check-in</Label>
              <Input id="p-in" type="date" value={form.checkIn ?? ""} onChange={(e) => setForm({ ...form, checkIn: e.target.value || null })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-out">Check-out</Label>
              <Input id="p-out" type="date" value={form.checkOut ?? ""} onChange={(e) => setForm({ ...form, checkOut: e.target.value || null })} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <div className="space-y-2">
              <Label>Status</Label>
              <div><PillSelect label="Guest status" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={STATUS_OPTIONS} /></div>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch id="p-optin" checked={form.optedInMarketing} onCheckedChange={(v) => setForm({ ...form, optedInMarketing: v })} />
              <Label htmlFor="p-optin">Opted in to marketing</Label>
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-3xl border bg-white p-6">
          <h2 className="font-semibold">Preferences & notes</h2>
          <div className="space-y-2">
            <Label htmlFor="p-pref">Preferences</Label>
            <div className="flex flex-wrap gap-1.5">
              {form.preferences.map((p) => (
                <span key={p} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 py-0.5 pr-1 pl-2.5 text-xs font-medium">
                  {p}
                  <button type="button" aria-label={`Remove ${p}`} className="flex size-4 items-center justify-center rounded-full hover:bg-zinc-300" onClick={() => setForm({ ...form, preferences: form.preferences.filter((x) => x !== p) })}>
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              {form.preferences.length === 0 && <span className="text-sm text-muted-foreground">No preferences recorded</span>}
            </div>
            <form onSubmit={addPref} className="flex gap-2">
              <Input id="p-pref" placeholder="e.g. Vegetarian, High floor" value={newPref} onChange={(e) => setNewPref(e.target.value)} />
              <Button type="submit" variant="outline" aria-label="Add preference"><Plus /></Button>
            </form>
          </div>
          <div className="space-y-2">
            <Label>Loyalty tier</Label>
            <div><PillSelect label="Loyalty tier" value={form.loyaltyTier ?? "none"} onChange={(v) => setForm({ ...form, loyaltyTier: v === "none" ? null : (v as Guest["loyaltyTier"]) })} options={TIERS} /></div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-notes">Staff notes</Label>
            <Textarea id="p-notes" rows={5} placeholder="Internal notes — never shown to the guest" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </section>
      </div>
    </>
  )
}

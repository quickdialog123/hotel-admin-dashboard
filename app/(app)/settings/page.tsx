"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { Bell, Building2, ImagePlus, Plus, Trash2, Users } from "lucide-react"
import { ConfirmDialog } from "@/components/app/confirm-dialog"
import { PageHeader } from "@/components/app/page-header"
import { PillSelect } from "@/components/app/pill-select"
import { StatusPill } from "@/components/app/status-pill"
import { ErrorState } from "@/components/app/states"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  addStaff,
  getHotelProfile,
  getNotificationPreferences,
  listStaff,
  removeStaff,
  TIMEZONES,
  updateHotelProfile,
  updateNotificationPreferences,
  type HotelProfile,
  type NotificationPreferences,
  type StaffRole,
  type StaffUser,
} from "@/lib/api/settings"
import { useAsync } from "@/lib/hooks/use-async"
import { cn } from "@/lib/utils"

const TABS = [
  { key: "profile", label: "Hotel profile", icon: Building2 },
  { key: "staff", label: "Staff users", icon: Users },
  { key: "notifications", label: "Notifications", icon: Bell },
] as const
type TabKey = (typeof TABS)[number]["key"]

export default function SettingsPage() {
  const [tab, setTab] = useState<TabKey>("profile")
  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto md:flex-col">
          {TABS.map((t) => (
            <button key={t.key} type="button" aria-current={tab === t.key ? "page" : undefined} onClick={() => setTab(t.key)} className={cn("flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30", tab === t.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")}>
              <t.icon className="size-4" /> {t.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0">
          {tab === "profile" && <ProfileTab />}
          {tab === "staff" && <StaffTab />}
          {tab === "notifications" && <NotificationsTab />}
        </div>
      </div>
    </>
  )
}

function ProfileTab() {
  const { data, error, reload } = useAsync(getHotelProfile)
  const [edits, setEdits] = useState<HotelProfile | null>(null)
  const form = edits ?? data
  const setForm = setEdits as (v: HotelProfile | ((p: HotelProfile | null) => HotelProfile | null)) => void
  const [saving, setSaving] = useState(false)
  const [touched, setTouched] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!form) return <Skeleton className="h-96 rounded-2xl" />

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ""
    if (!f) return
    // TODO(backend): upload logo to real storage
    const r = new FileReader()
    r.onload = () => setForm({ ...(edits ?? form!), logoUrl: String(r.result) })
    r.readAsDataURL(f)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!form || !form.name.trim()) return
    setSaving(true)
    try {
      await updateHotelProfile(form)
      toast.success("Hotel profile saved")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-5 rounded-2xl border bg-white p-6">
      <h2 className="font-semibold">Hotel profile</h2>
      <div className="flex items-center gap-4">
        {form.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={form.logoUrl} alt="Hotel logo" className="size-16 rounded-2xl border object-cover" />
        ) : (
          <div className="flex size-16 items-center justify-center rounded-2xl bg-slate-100 text-xl font-bold text-slate-500" aria-hidden>{form.name[0] ?? "H"}</div>
        )}
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}><ImagePlus /> {form.logoUrl ? "Replace logo" : "Upload logo"}</Button>
        <input ref={fileRef} type="file" accept="image/*" aria-label="Upload logo" className="sr-only" onChange={onLogo} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="h-name">Hotel name</Label>
        <Input id="h-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-invalid={touched && !form.name.trim()} />
        {touched && !form.name.trim() && <p className="text-sm text-destructive">Hotel name is required.</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="h-addr">Address</Label>
        <Textarea id="h-addr" rows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Timezone</Label>
        <div><PillSelect label="Timezone" value={form.timezone} onChange={(v) => setForm({ ...form, timezone: v })} options={TIMEZONES.map((t) => ({ value: t, label: t }))} /></div>
      </div>
      <Button type="submit" className="rounded-xl" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
    </form>
  )
}

const ROLES: { value: StaffRole; label: string }[] = [
  { value: "Admin", label: "Admin" },
  { value: "Manager", label: "Manager" },
  { value: "Front desk", label: "Front desk" },
]

function StaffTab() {
  const { data, error, reload } = useAsync(listStaff)
  const [open, setOpen] = useState(false)
  const [removing, setRemoving] = useState<StaffUser | null>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<StaffRole>("Front desk")
  const [touched, setTouched] = useState(false)
  const emailOk = /^\S+@\S+\.\S+$/.test(email)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!name.trim() || !emailOk) return
    await addStaff({ name: name.trim(), email: email.trim(), role })
    toast.success("Staff user added")
    setOpen(false); setName(""); setEmail(""); setRole("Front desk"); setTouched(false)
    reload()
  }

  return (
    <div className="rounded-2xl border bg-white">
      <div className="flex items-center justify-between border-b p-5">
        <h2 className="font-semibold">Staff users</h2>
        <Button className="rounded-xl" onClick={() => setOpen(true)}><Plus /> Add user</Button>
      </div>
      {error ? (
        <div className="p-5"><ErrorState message={error} onRetry={reload} /></div>
      ) : !data ? (
        <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : data.length === 0 ? (
        <p className="p-10 text-center text-sm text-muted-foreground">No staff users yet.</p>
      ) : (
        <ul>
          {data.map((u) => (
            <li key={u.id} className="flex items-center gap-4 border-b px-5 py-3.5 last:border-b-0">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{u.name}</p>
                <p className="truncate text-sm text-muted-foreground">{u.email}</p>
              </div>
              <StatusPill tone={u.role === "Admin" ? "solid" : "neutral"}>{u.role}</StatusPill>
              <Button variant="ghost" size="icon" aria-label={`Remove ${u.name}`} onClick={() => setRemoving(u)}><Trash2 /></Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={add} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Add staff user</DialogTitle>
              <DialogDescription>They&apos;ll get an email invitation to join your dashboard.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="s-name">Name</Label>
              <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={touched && !name.trim()} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-email">Email</Label>
              <Input id="s-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={touched && !emailOk} />
              {touched && !emailOk && <p className="text-sm text-destructive">Enter a valid email address.</p>}
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <div><PillSelect label="Role" value={role} onChange={setRole} options={ROLES} /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">Add user</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove ${removing?.name}?`}
        description="They'll lose access to this dashboard immediately."
        confirmLabel="Remove"
        onConfirm={async () => {
          if (!removing) return
          await removeStaff(removing.id)
          toast.success("Staff user removed")
          reload()
        }}
      />
    </div>
  )
}

const PREF_LABELS: { key: keyof NotificationPreferences; title: string; desc: string }[] = [
  { key: "needsAttention", title: "Conversation needs attention", desc: "When the AI flags a guest conversation for a human." },
  { key: "newGuestConversation", title: "New guest conversation", desc: "When a guest messages for the first time." },
  { key: "broadcastFinished", title: "Broadcast finished", desc: "When a broadcast has finished sending, with delivery results." },
  { key: "templateStatusChange", title: "Template status changes", desc: "When Meta approves or rejects a message template." },
  { key: "whatsappDisconnected", title: "WhatsApp disconnected", desc: "Immediately if your receptionist stops working." },
  { key: "dailyDigest", title: "Daily digest", desc: "A morning summary of yesterday's conversations and orders." },
]

function NotificationsTab() {
  const { data, error, reload, setData } = useAsync(getNotificationPreferences)
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data) return <Skeleton className="h-96 rounded-2xl" />
  return (
    <div className="rounded-2xl border bg-white">
      <h2 className="border-b p-5 font-semibold">Notification preferences</h2>
      <ul>
        {PREF_LABELS.map((p) => (
          <li key={p.key} className="flex items-center gap-4 border-b px-5 py-4 last:border-b-0">
            <div className="flex-1">
              <Label htmlFor={`n-${p.key}`} className="font-semibold">{p.title}</Label>
              <p className="text-sm text-muted-foreground">{p.desc}</p>
            </div>
            <Switch
              id={`n-${p.key}`}
              checked={data[p.key]}
              onCheckedChange={async (v) => {
                setData((prev) => prev && { ...prev, [p.key]: v })
                try {
                  await updateNotificationPreferences({ [p.key]: v })
                } catch {
                  toast.error("Couldn't save preference")
                  reload()
                }
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

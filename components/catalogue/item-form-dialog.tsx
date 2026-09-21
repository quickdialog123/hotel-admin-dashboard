"use client"

import { useRef, useState } from "react"
import { ImagePlus, Plus, ShoppingBag, X } from "lucide-react"
import { PhoneFrame } from "@/components/app/phone-frame"
import { PillSelect } from "@/components/app/pill-select"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CATALOGUE_CATEGORIES, SUGGESTED_TAGS, type CatalogueItem, type CatalogueStatus } from "@/lib/api/catalogue"
import { formatPrice } from "@/lib/format"

export type ItemDraft = Omit<CatalogueItem, "id" | "updatedAt">

const emptyDraft: ItemDraft = { name: "", description: "", priceCents: 0, category: "Mains", photoUrl: null, tags: [], status: "active" }
export const STATUS_OPTIONS: { value: CatalogueStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "out_of_stock", label: "Out of stock" },
]

export function Thumb({ url, name, className }: { url: string | null; name: string; className?: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={name} className={className} />
  ) : (
    <div className={`flex items-center justify-center bg-slate-100 text-slate-400 ${className ?? ""}`} aria-hidden>
      <ShoppingBag className="size-8" />
    </div>
  )
}

export function ItemFormDialog({ open, onOpenChange, item, onSave, onDelete }: { open: boolean; onOpenChange: (o: boolean) => void; item: CatalogueItem | null; onSave: (draft: ItemDraft) => Promise<void>; onDelete?: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        {/* Body mounts fresh each time the dialog opens, so its state always starts from `item`. */}
        <ItemFormBody onOpenChange={onOpenChange} item={item} onSave={onSave} onDelete={onDelete} />
      </DialogContent>
    </Dialog>
  )
}

function ItemFormBody({ onOpenChange, item, onSave, onDelete }: { onOpenChange: (o: boolean) => void; item: CatalogueItem | null; onSave: (draft: ItemDraft) => Promise<void>; onDelete?: () => void }) {
  const [draft, setDraft] = useState<ItemDraft>(
    item ? { name: item.name, description: item.description, priceCents: item.priceCents, category: item.category, photoUrl: item.photoUrl, tags: item.tags, status: item.status } : emptyDraft,
  )
  const [price, setPrice] = useState(item ? (item.priceCents / 100).toFixed(2) : "")
  const [newTag, setNewTag] = useState("")
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const priceValid = /^\d+(\.\d{1,2})?$/.test(price) && parseFloat(price) > 0
  const nameValid = draft.name.trim().length > 0
  const valid = priceValid && nameValid
  const priceCents = priceValid ? Math.round(parseFloat(price) * 100) : 0

  function addTag(raw: string) {
    const t = raw.trim()
    if (t && !draft.tags.some((x) => x.toLowerCase() === t.toLowerCase())) setDraft((d) => ({ ...d, tags: [...d.tags, t] }))
    setNewTag("")
  }

  function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    // TODO(backend): upload to real storage; use the returned URL instead of a data URL.
    const reader = new FileReader()
    reader.onload = () => setDraft((d) => ({ ...d, photoUrl: String(reader.result) }))
    reader.readAsDataURL(file)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!valid) return
    setBusy(true)
    try {
      await onSave({ ...draft, name: draft.name.trim(), priceCents })
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  return (
        <form onSubmit={submit} className="grid gap-6 md:grid-cols-[1fr_260px]">
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>{item ? "Edit item" : "Add item"}</DialogTitle>
              <DialogDescription>Items sync to your WhatsApp Catalogue so guests can order from chat.</DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="item-name">Name</Label>
              <Input id="item-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} aria-invalid={touched && !nameValid} />
              {touched && !nameValid && <p className="text-sm text-destructive">Name is required.</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-desc">Description</Label>
              <Textarea id="item-desc" rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="item-price">Price (USD)</Label>
                <Input id="item-price" inputMode="decimal" placeholder="14.00" value={price} onChange={(e) => setPrice(e.target.value)} aria-invalid={touched && !priceValid} />
                {touched && !priceValid && <p className="text-sm text-destructive">Enter a price like 14.00.</p>}
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <div>
                  <PillSelect label="Category" value={draft.category} onChange={(v) => setDraft({ ...draft, category: v })} options={CATALOGUE_CATEGORIES.map((c) => ({ value: c, label: c }))} className="w-full justify-between" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <div>
                <PillSelect label="Status" value={draft.status} onChange={(v) => setDraft({ ...draft, status: v })} options={STATUS_OPTIONS} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-tag">Tags</Label>
              <div className="flex flex-wrap gap-1.5">
                {draft.tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pr-1 pl-2.5 text-xs font-medium">
                    {t}
                    <button type="button" aria-label={`Remove ${t}`} className="flex size-4 items-center justify-center rounded-full hover:bg-slate-300" onClick={() => setDraft({ ...draft, tags: draft.tags.filter((x) => x !== t) })}>
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                {draft.tags.length === 0 && <span className="text-sm text-muted-foreground">No tags yet</span>}
              </div>
              <div className="flex gap-2">
                <Input
                  id="item-tag"
                  placeholder="e.g. Vegetarian, Spicy"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addTag(newTag)
                    }
                  }}
                />
                <Button type="button" variant="outline" aria-label="Add tag" onClick={() => addTag(newTag)}>
                  <Plus />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {SUGGESTED_TAGS.filter((t) => !draft.tags.includes(t)).map((t) => (
                  <button key={t} type="button" onClick={() => addTag(t)} className="rounded-full border border-dashed px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-slate-900 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/30 focus-visible:outline-none">
                    + {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-photo">Photo</Label>
              <div className="flex items-center gap-3">
                <Thumb url={draft.photoUrl} name={draft.name || "Item photo"} className="size-16 rounded-xl object-cover" />
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                  <ImagePlus /> {draft.photoUrl ? "Replace photo" : "Upload photo"}
                </Button>
                {draft.photoUrl && (
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove photo" onClick={() => setDraft({ ...draft, photoUrl: null })}>
                    <X />
                  </Button>
                )}
                <input id="item-photo" ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={onPhoto} />
              </div>
            </div>

            <DialogFooter>
              {item && onDelete && (
                <Button type="button" variant="destructive" className="sm:mr-auto" onClick={onDelete}>
                  Delete item
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : item ? "Save changes" : "Add item"}
              </Button>
            </DialogFooter>
          </div>

          <div aria-label="WhatsApp preview" className="hidden md:block">
            <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">Guest preview</p>
            <PhoneFrame title="The Harbour House" subtitle="Catalogue">
              <div className="overflow-hidden rounded-xl bg-white shadow-sm">
                <Thumb url={draft.photoUrl} name="" className="aspect-square w-full object-cover" />
                <div className="space-y-0.5 p-3">
                  <p className="text-sm font-semibold">{draft.name || "Item name"}</p>
                  <p className="text-xs text-slate-500">{formatPrice(priceCents)}</p>
                  <p className="line-clamp-2 pt-1 text-xs text-slate-600">{draft.description || "Description appears here."}</p>
                  {draft.tags.length > 0 && <p className="pt-1 text-[10px] text-slate-500">{draft.tags.slice(0, 3).join(" · ")}</p>}
                </div>
                <div className="border-t px-3 py-2 text-center text-xs font-semibold text-slate-900">Add to cart</div>
              </div>
            </PhoneFrame>
          </div>
        </form>
  )
}

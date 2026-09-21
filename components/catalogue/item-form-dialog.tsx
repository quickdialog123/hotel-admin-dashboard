"use client"

import { useRef, useState } from "react"
import { ImagePlus, ShoppingBag, X } from "lucide-react"
import { PhoneFrame } from "@/components/app/phone-frame"
import { PillSelect } from "@/components/app/pill-select"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CATALOGUE_CATEGORIES, type CatalogueItem, type CatalogueStatus } from "@/lib/api/catalogue"
import { formatPrice } from "@/lib/format"

export type ItemDraft = Omit<CatalogueItem, "id" | "updatedAt">

const emptyDraft: ItemDraft = { name: "", description: "", priceCents: 0, category: "Mains", photoUrl: null, status: "active" }
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
    <div className={`flex items-center justify-center bg-zinc-100 text-zinc-400 ${className ?? ""}`} aria-hidden>
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
    item ? { name: item.name, description: item.description, priceCents: item.priceCents, category: item.category, photoUrl: item.photoUrl, status: item.status } : emptyDraft,
  )
  const [price, setPrice] = useState(item ? (item.priceCents / 100).toFixed(2) : "")
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const priceValid = /^\d+(\.\d{1,2})?$/.test(price) && parseFloat(price) > 0
  const nameValid = draft.name.trim().length > 0
  const valid = priceValid && nameValid
  const priceCents = priceValid ? Math.round(parseFloat(price) * 100) : 0

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
                  <p className="text-xs text-zinc-500">{formatPrice(priceCents)}</p>
                  <p className="line-clamp-2 pt-1 text-xs text-zinc-600">{draft.description || "Description appears here."}</p>
                </div>
                <div className="border-t px-3 py-2 text-center text-xs font-semibold text-zinc-900">Add to cart</div>
              </div>
            </PhoneFrame>
          </div>
        </form>
  )
}

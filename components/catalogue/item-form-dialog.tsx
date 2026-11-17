"use client"

import { useState } from "react"
import { ShoppingBag } from "lucide-react"
import { PhoneFrame } from "@/components/app/phone-frame"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { catalogueItemInputSchema, catalogueItemUpdateSchema, type CatalogueItem, type CatalogueItemInput, type CatalogueItemUpdate } from "@/lib/api/catalogue"

export type ItemDraft = {
  name: string
  description: string
  productUrl: string
  imageUrl: string
  price: string
  currency: string
  availability: string
  brand: string
  condition: string
}

const emptyDraft: ItemDraft = {
  name: "",
  description: "",
  productUrl: "",
  imageUrl: "",
  price: "",
  currency: "USD",
  availability: "in stock",
  brand: "",
  condition: "new",
}

const AVAILABILITY_OPTIONS = ["in stock", "out of stock", "available for order", "discontinued"] as const
const CONDITION_OPTIONS = ["new", "refurbished", "used"] as const

function itemToDraft(item: CatalogueItem | null): ItemDraft {
  if (!item) return emptyDraft
  const priceMatch = item.price?.match(/^(.+?)\s+([A-Z]{3})$/)
  return {
    name: item.name,
    description: item.description ?? "",
    productUrl: item.productUrl ?? "",
    imageUrl: item.imageUrl ?? "",
    price: priceMatch?.[1] ?? item.price ?? "",
    currency: item.currency ?? priceMatch?.[2] ?? "USD",
    availability: item.availability ?? "in stock",
    brand: item.brand ?? "",
    condition: item.condition ?? "new",
  }
}

function changedFields(item: CatalogueItem, draft: ItemDraft): CatalogueItemUpdate {
  const original = itemToDraft(item)
  const changes: Partial<ItemDraft> = {}
  for (const key of Object.keys(draft) as Array<keyof ItemDraft>) {
    if (draft[key] !== original[key] && draft[key].trim()) changes[key] = draft[key].trim()
  }
  if (draft.price !== original.price || draft.currency !== original.currency) {
    if (draft.price.trim()) changes.price = draft.price.trim()
    if (draft.currency.trim()) changes.currency = draft.currency.trim()
  }
  return changes as CatalogueItemUpdate
}

function fieldError(input: CatalogueItemInput | CatalogueItemUpdate, isCreate: boolean) {
  const schema = isCreate ? catalogueItemInputSchema : catalogueItemUpdateSchema
  const result = schema.safeParse(input)
  return result.success ? null : result.error.issues[0]?.message ?? "Check the product details."
}

export function Thumb({ url, name, className }: { url: string | null | undefined; name: string; className?: string }) {
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
        <ItemFormBody key={`${open}-${item?.productId ?? "new"}`} onOpenChange={onOpenChange} item={item} onSave={onSave} onDelete={onDelete} />
      </DialogContent>
    </Dialog>
  )
}

function ItemFormBody({ onOpenChange, item, onSave, onDelete }: { onOpenChange: (o: boolean) => void; item: CatalogueItem | null; onSave: (draft: ItemDraft) => Promise<void>; onDelete?: () => void }) {
  const [draft, setDraft] = useState<ItemDraft>(() => itemToDraft(item))
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const changes = item ? changedFields(item, draft) : draft
  const validationError = item
    ? fieldError(changes as CatalogueItemUpdate, false)
    : fieldError(draft as CatalogueItemInput, true)

  function update<K extends keyof ItemDraft>(key: K, value: ItemDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
    setError(null)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (validationError) return
    setBusy(true)
    setError(null)
    try {
      await onSave(draft)
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save product")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-6 md:grid-cols-[1fr_260px]">
      <div className="space-y-4">
        <DialogHeader>
          <DialogTitle>{item ? "Edit product" : "Add product"}</DialogTitle>
          <DialogDescription>Products are managed directly in your connected Meta catalogue. Images must use a public URL that Meta can access.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="item-name">Name</Label>
          <Input id="item-name" maxLength={200} value={draft.name} onChange={(e) => update("name", e.target.value)} aria-invalid={touched && !draft.name.trim()} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="item-desc">Description</Label>
          <Textarea id="item-desc" rows={3} maxLength={5000} value={draft.description} onChange={(e) => update("description", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="item-product-url">Product page URL</Label>
          <Input id="item-product-url" type="url" placeholder="https://example.com/product" value={draft.productUrl} onChange={(e) => update("productUrl", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="item-image-url">Public image URL</Label>
          <Input id="item-image-url" type="url" placeholder="https://cdn.example.com/product.jpg" value={draft.imageUrl} onChange={(e) => update("imageUrl", e.target.value)} />
          <p className="text-xs text-muted-foreground">The image must be hosted publicly; uploads aren’t supported here.</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="item-price">Price</Label>
            <Input id="item-price" inputMode="decimal" placeholder="14.00" value={draft.price} onChange={(e) => update("price", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-currency">Currency</Label>
            <Input id="item-currency" maxLength={3} placeholder="USD" value={draft.currency} onChange={(e) => update("currency", e.target.value.toUpperCase())} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="item-availability">Availability</Label>
            <select id="item-availability" value={draft.availability} onChange={(e) => update("availability", e.target.value)} className="h-9 w-full rounded-lg border border-input bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30">
              {AVAILABILITY_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-condition">Condition</Label>
            <select id="item-condition" value={draft.condition} onChange={(e) => update("condition", e.target.value)} className="h-9 w-full rounded-lg border border-input bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30">
              {CONDITION_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="item-brand">Brand</Label>
          <Input id="item-brand" maxLength={100} value={draft.brand} onChange={(e) => update("brand", e.target.value)} />
        </div>

        {touched && validationError && <p role="alert" className="text-sm text-destructive">{validationError}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          {item && onDelete && <Button type="button" variant="destructive" className="sm:mr-auto" disabled={busy} onClick={onDelete}>Delete product</Button>}
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : item ? "Save changes" : "Add product"}</Button>
        </DialogFooter>
      </div>

      <div aria-label="WhatsApp preview" className="hidden md:block">
        <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">Guest preview</p>
        <PhoneFrame title="The Harbour House" subtitle="Catalogue">
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            <Thumb url={draft.imageUrl || null} name="" className="aspect-square w-full object-cover" />
            <div className="space-y-0.5 p-3">
              <p className="text-sm font-semibold">{draft.name || "Product name"}</p>
              <p className="text-xs text-slate-500">{draft.price || "0.00"} {draft.currency}</p>
              <p className="line-clamp-2 pt-1 text-xs text-slate-600">{draft.description || "Description appears here."}</p>
              <p className="pt-1 text-[10px] text-slate-500">{draft.availability}</p>
            </div>
            <div className="border-t px-3 py-2 text-center text-xs font-semibold text-slate-900">Add to cart</div>
          </div>
        </PhoneFrame>
      </div>
    </form>
  )
}

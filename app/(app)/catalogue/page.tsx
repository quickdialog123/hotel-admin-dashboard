"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Check, LayoutGrid, List, Plus, Trash2, Utensils } from "lucide-react"
import { ConfirmDialog } from "@/components/app/confirm-dialog"
import { PageHeader } from "@/components/app/page-header"
import { PillSelect } from "@/components/app/pill-select"
import { StatusPill } from "@/components/app/status-pill"
import { CardGridSkeleton, EmptyState, ErrorState } from "@/components/app/states"
import { ItemFormDialog, STATUS_OPTIONS, Thumb, type ItemDraft } from "@/components/catalogue/item-form-dialog"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  CATALOGUE_CATEGORIES,
  createCatalogueItem,
  deleteCatalogueItems,
  listCatalogueItems,
  updateCatalogueItem,
  updateCatalogueItemsCategory,
  type CatalogueItem,
} from "@/lib/api/catalogue"
import { useAsync } from "@/lib/hooks/use-async"
import { formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"

type Sort = "updated" | "name" | "price"

function StatusBadge({ status }: { status: CatalogueItem["status"] }) {
  if (status === "active") return null
  return <StatusPill tone={status === "draft" ? "neutral" : "error"}>{status === "draft" ? "Draft" : "Out of stock"}</StatusPill>
}

export default function CataloguePage() {
  const { data, error, loading, reload } = useAsync(listCatalogueItems)
  const [category, setCategory] = useState("all")
  const [status, setStatus] = useState("all")
  const [sort, setSort] = useState<Sort>("updated")
  const [view, setView] = useState<"grid" | "list">("grid")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CatalogueItem | null>(null)
  const [deleting, setDeleting] = useState<string[] | null>(null)

  const items = useMemo(() => {
    const rows = (data ?? []).filter((i) => (category === "all" || i.category === category) && (status === "all" || i.status === status))
    return rows.sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : sort === "price" ? a.priceCents - b.priceCents : b.updatedAt.localeCompare(a.updatedAt)))
  }, [data, category, status, sort])

  const selecting = selected.size > 0

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }
  function openAdd() {
    setEditing(null)
    setFormOpen(true)
  }
  function openEdit(item: CatalogueItem) {
    setEditing(item)
    setFormOpen(true)
  }
  async function save(draft: ItemDraft) {
    try {
      if (editing) await updateCatalogueItem(editing.id, draft)
      else await createCatalogueItem(draft)
      toast.success(editing ? "Item updated" : "Item added")
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save item")
      throw e
    }
  }

  const select = (item: CatalogueItem) => (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected.has(item.id)}
      aria-label={`Select ${item.name}`}
      onClick={(e) => {
        e.stopPropagation()
        toggle(item.id)
      }}
      className={cn(
        "absolute top-2.5 right-2.5 flex size-7 items-center justify-center rounded-full border-2 border-white bg-zinc-900 text-white shadow transition-opacity outline-none focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-zinc-900/40",
        selected.has(item.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100",
      )}
    >
      <Check className="size-4" />
    </button>
  )

  return (
    <>
      <PageHeader title="Catalogue" description="Room service items that sync to your WhatsApp Catalogue." />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <PillSelect label="Filter by category" value={category} onChange={setCategory} options={[{ value: "all", label: "All categories" }, ...CATALOGUE_CATEGORIES.map((c) => ({ value: c, label: c }))]} />
        <PillSelect label="Filter by status" value={status} onChange={setStatus} options={[{ value: "all", label: "All statuses" }, ...STATUS_OPTIONS]} />
        <PillSelect<Sort> label="Sort" prefix="Sort: " value={sort} onChange={setSort} options={[{ value: "updated", label: "Last updated" }, { value: "name", label: "Name" }, { value: "price", label: "Price" }]} />
        <div className="ml-auto flex rounded-full border bg-white p-0.5" role="group" aria-label="View">
          {(["grid", "list"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} aria-label={`${v} view`} onClick={() => setView(v)} className={cn("flex size-8 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/30", view === v ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-900")}>
              {v === "grid" ? <LayoutGrid className="size-4" /> : <List className="size-4" />}
            </button>
          ))}
        </div>
      </div>

      {selecting && (
        <div role="region" aria-label="Bulk actions" className="sticky top-20 z-30 mb-4 flex flex-wrap items-center gap-2 rounded-2xl bg-zinc-900 px-4 py-2.5 text-white shadow-lg">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger className="h-8 rounded-full bg-white/10 px-3.5 text-sm font-medium outline-none hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/60">Change category</DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 rounded-2xl p-1.5">
                {CATALOGUE_CATEGORIES.map((c) => (
                  <DropdownMenuItem
                    key={c}
                    className="rounded-xl"
                    onClick={async () => {
                      await updateCatalogueItemsCategory([...selected], c)
                      toast.success(`Moved ${selected.size} item${selected.size > 1 ? "s" : ""} to ${c}`)
                      setSelected(new Set())
                      reload()
                    }}
                  >
                    {c}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <button type="button" onClick={() => setDeleting([...selected])} className="flex h-8 items-center gap-1.5 rounded-full bg-white/10 px-3.5 text-sm font-medium hover:bg-red-500/80 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none">
              <Trash2 className="size-3.5" /> Delete
            </button>
            <button type="button" onClick={() => setSelected(new Set())} className="h-8 rounded-full px-3 text-sm text-white/70 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none">
              Clear
            </button>
          </div>
        </div>
      )}

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading || !data ? (
        <CardGridSkeleton />
      ) : data.length === 0 ? (
        <EmptyState icon={<Utensils className="size-5" />} title="No catalogue items yet" description="Add your first room service item to make it available to guests on WhatsApp." action={<Button onClick={openAdd}><Plus /> Add item</Button>} />
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <div key={item.id} className="group relative">
              <button type="button" onClick={() => (selecting ? toggle(item.id) : openEdit(item))} className="block w-full rounded-2xl text-left outline-none focus-visible:ring-3 focus-visible:ring-zinc-900/30">
                <div className={cn("relative overflow-hidden rounded-2xl border bg-zinc-100", selected.has(item.id) && "ring-2 ring-zinc-900")}>
                  <Thumb url={item.photoUrl} name={item.name} className="aspect-square w-full object-cover" />
                  <div className="absolute bottom-2.5 left-2.5">
                    <StatusBadge status={item.status} />
                  </div>
                </div>
                <p className="mt-2.5 truncate font-semibold">{item.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatPrice(item.priceCents)} · {item.category}
                </p>
              </button>
              {select(item)}
            </div>
          ))}
          <button type="button" onClick={openAdd} className="flex aspect-square flex-col items-center justify-center gap-2 self-start rounded-2xl border-2 border-dashed bg-white text-muted-foreground transition-colors outline-none hover:border-zinc-900 hover:text-zinc-900 focus-visible:border-zinc-900 focus-visible:ring-3 focus-visible:ring-zinc-900/20">
            <Plus className="size-6" />
            <span className="text-sm font-medium">Add item</span>
          </button>
          {items.length === 0 && <p className="col-span-full text-sm text-muted-foreground">No items match these filters.</p>}
        </div>
      ) : (
        <ul className="overflow-hidden rounded-3xl border bg-white">
          {items.map((item) => (
            <li key={item.id} className="group relative flex items-center gap-4 border-b px-4 py-3 last:border-b-0">
              <button type="button" role="checkbox" aria-checked={selected.has(item.id)} aria-label={`Select ${item.name}`} onClick={() => toggle(item.id)} className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border-2 outline-none focus-visible:ring-3 focus-visible:ring-zinc-900/30", selected.has(item.id) ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 text-transparent")}>
                <Check className="size-3.5" />
              </button>
              <button type="button" onClick={() => openEdit(item)} className="flex min-w-0 flex-1 items-center gap-4 text-left outline-none focus-visible:underline">
                <Thumb url={item.photoUrl} name={item.name} className="size-12 shrink-0 rounded-xl object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{item.name}</span>
                  <span className="block text-sm text-muted-foreground">
                    {formatPrice(item.priceCents)} · {item.category}
                  </span>
                </span>
                <StatusBadge status={item.status} />
              </button>
            </li>
          ))}
          <li>
            <button type="button" onClick={openAdd} className="flex w-full items-center justify-center gap-2 border-t border-dashed px-4 py-4 text-sm font-medium text-muted-foreground hover:bg-zinc-50 hover:text-zinc-900 focus-visible:bg-zinc-50 focus-visible:outline-none">
              <Plus className="size-4" /> Add item
            </button>
          </li>
        </ul>
      )}

      <ItemFormDialog open={formOpen} onOpenChange={setFormOpen} item={editing} onSave={save} onDelete={() => { if (editing) { setFormOpen(false); setDeleting([editing.id]) } }} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={deleting && deleting.length > 1 ? `Delete ${deleting.length} items?` : "Delete this item?"}
        description="This removes the item from your catalogue. This can't be undone."
        onConfirm={async () => {
          if (!deleting) return
          await deleteCatalogueItems(deleting)
          toast.success(deleting.length > 1 ? `${deleting.length} items deleted` : "Item deleted")
          setSelected(new Set())
          reload()
        }}
      />
    </>
  )
}

"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Check, LayoutGrid, List, Plus, Trash2, Utensils, Link2, Unplug, ShoppingBag } from "lucide-react"
import { ConfirmDialog } from "@/components/app/confirm-dialog"
import { PageHeader } from "@/components/app/page-header"
import { PillSelect } from "@/components/app/pill-select"
import { StatusPill } from "@/components/app/status-pill"
import { CardGridSkeleton, EmptyState, ErrorState } from "@/components/app/states"
import { TagList } from "@/components/catalogue/tag-list"
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
  getActiveWhatsAppCatalog,
  listAvailableWhatsAppCatalogs,
  createWhatsAppCatalog,
  connectWhatsAppCatalog,
  disconnectWhatsAppCatalog,
  deleteActiveWhatsAppCatalog,
} from "@/lib/api/catalogue"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"

type Sort = "updated" | "name" | "price"

function StatusBadge({ status }: { status: CatalogueItem["status"] }) {
  if (status === "active") return null
  return <StatusPill tone={status === "draft" ? "neutral" : "error"}>{status === "draft" ? "Draft" : "Out of stock"}</StatusPill>
}

export default function CataloguePage() {
  const queryClient = useQueryClient()
  const [setupDialog, setSetupDialog] = useState<"connect" | "create" | null>(null)
  const [catalogName, setCatalogName] = useState("")
  const [selectedCatalogId, setSelectedCatalogId] = useState("")
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [confirmDeleteCatalog, setConfirmDeleteCatalog] = useState(false)

  const catalogQuery = useQuery({
    queryKey: ["whatsapp", "catalog"],
    queryFn: getActiveWhatsAppCatalog,
  })
  const activeCatalog = catalogQuery.data
  const catalogId = activeCatalog?.id

  const availableQuery = useQuery({
    queryKey: ["whatsapp", "catalogs", "available"],
    queryFn: listAvailableWhatsAppCatalogs,
    enabled: setupDialog === "connect",
  })

  const productsQuery = useQuery({
    queryKey: ["whatsapp", "catalog", catalogId, "products"],
    queryFn: listCatalogueItems,
    enabled: !!catalogId,
  })

  const data = catalogId ? productsQuery.data : undefined
  const error = productsQuery.error
  const loading = productsQuery.isPending

  async function refreshCatalog() {
    await queryClient.invalidateQueries({ queryKey: ["whatsapp", "catalog"] })
  }
  async function refreshProducts() {
    await queryClient.invalidateQueries({ queryKey: ["whatsapp", "catalog", catalogId, "products"] })
  }

  const createCatalogMutation = useMutation({
    mutationFn: async (name: string) => {
      const created = await createWhatsAppCatalog(name)
      await connectWhatsAppCatalog(created.id)
      return created
    },
    onSuccess: async () => {
      setSetupDialog(null)
      setCatalogName("")
      await queryClient.invalidateQueries({ queryKey: ["whatsapp"] })
      toast.success("Catalog created and connected")
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't create catalog"),
  })
  const connectMutation = useMutation({
    mutationFn: connectWhatsAppCatalog,
    onSuccess: async () => {
      setSetupDialog(null)
      await queryClient.invalidateQueries({ queryKey: ["whatsapp"] })
      toast.success("Catalog connected")
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't connect catalog"),
  })
  const disconnectMutation = useMutation({
    mutationFn: disconnectWhatsAppCatalog,
    onSuccess: async () => {
      setSelected(new Set())
      await refreshCatalog()
      toast.success("Catalog disconnected — products are kept")
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't disconnect catalog"),
  })
  const deleteCatalogMutation = useMutation({
    mutationFn: deleteActiveWhatsAppCatalog,
    onSuccess: async () => {
      setSelected(new Set())
      await queryClient.invalidateQueries({ queryKey: ["whatsapp"] })
      toast.success("Catalog deleted")
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't delete catalog"),
  })

  const createItemMutation = useMutation({ mutationFn: createCatalogueItem, onSuccess: refreshProducts })
  const updateItemMutation = useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: ItemDraft }) => updateCatalogueItem(id, draft),
    onSuccess: refreshProducts,
  })
  const deleteItemsMutation = useMutation({ mutationFn: deleteCatalogueItems, onSuccess: refreshProducts })
  const changeCategoryMutation = useMutation({
    mutationFn: ({ ids, category }: { ids: string[]; category: string }) => updateCatalogueItemsCategory(ids, category),
    onSuccess: refreshProducts,
  })

  const [category, setCategory] = useState("all")
  const [status, setStatus] = useState("all")
  const [sort, setSort] = useState<Sort>("updated")
  const [view, setView] = useState<"grid" | "list">("grid")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CatalogueItem | null>(null)
  const [deleting, setDeleting] = useState<string[] | null>(null)

  useEffect(() => {
    setSelected(new Set())
    setEditing(null)
    setFormOpen(false)
  }, [catalogId])

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
      if (editing) await updateItemMutation.mutateAsync({ id: editing.id, draft })
      else await createItemMutation.mutateAsync(draft)
      toast.success(editing ? "Item updated" : "Item added")
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
        "absolute top-2.5 right-2.5 flex size-7 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-white shadow transition-opacity outline-none focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-slate-900/40",
        selected.has(item.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100",
      )}
    >
      <Check className="size-4" />
    </button>
  )

  return (
    <>
      <PageHeader title="Catalogue" description="Manage products in your connected WhatsApp catalogue." />

      {catalogQuery.isPending ? (
        <CardGridSkeleton />
      ) : catalogQuery.isError ? (
        <ErrorState
          message={catalogQuery.error instanceof Error ? catalogQuery.error.message : "Couldn't load catalog"}
          onRetry={() => void catalogQuery.refetch()}
        />
      ) : !activeCatalog ? (
        <EmptyState
          icon={<ShoppingBag className="size-5" />}
          title="Connect your WhatsApp catalog"
          description="Choose an existing Meta catalog or create a new one to manage its products."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={() => setSetupDialog("connect")}><Link2 /> Connect existing</Button>
              <Button onClick={() => setSetupDialog("create")}><Plus /> Create catalog</Button>
            </div>
          }
        />
      ) : (
      <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4">
        <div>
          <p className="font-semibold">{activeCatalog.name}</p>
          <p className="text-sm text-muted-foreground">Connected to WhatsApp</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setConfirmDisconnect(true)}><Unplug /> Disconnect</Button>
          <Button variant="destructive" onClick={() => setConfirmDeleteCatalog(true)}><Trash2 /> Delete catalog</Button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <PillSelect label="Filter by category" value={category} onChange={setCategory} options={[{ value: "all", label: "All categories" }, ...CATALOGUE_CATEGORIES.map((c) => ({ value: c, label: c }))]} />
        <PillSelect label="Filter by status" value={status} onChange={setStatus} options={[{ value: "all", label: "All statuses" }, ...STATUS_OPTIONS]} />
        <PillSelect<Sort> label="Sort" prefix="Sort: " value={sort} onChange={setSort} options={[{ value: "updated", label: "Last updated" }, { value: "name", label: "Name" }, { value: "price", label: "Price" }]} />
        <div className="ml-auto flex rounded-full border bg-white p-0.5" role="group" aria-label="View">
          {(["grid", "list"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} aria-label={`${v} view`} onClick={() => setView(v)} className={cn("flex size-8 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30", view === v ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900")}>
              {v === "grid" ? <LayoutGrid className="size-4" /> : <List className="size-4" />}
            </button>
          ))}
        </div>
      </div>

      {selecting && (
        <div role="region" aria-label="Bulk actions" className="sticky top-20 z-30 mb-4 flex flex-wrap items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-white shadow-lg">
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
                      await changeCategoryMutation.mutateAsync({ ids: [...selected], category: c })
                      toast.success(`Moved ${selected.size} item${selected.size > 1 ? "s" : ""} to ${c}`)
                      setSelected(new Set())
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
        <ErrorState message={error instanceof Error ? error.message : "Couldn't load products"} onRetry={() => void productsQuery.refetch()} />
      ) : loading || !data ? (
        <CardGridSkeleton />
      ) : data.length === 0 ? (
        <EmptyState icon={<Utensils className="size-5" />} title="No catalogue items yet" description="Add your first room service item to make it available to guests on WhatsApp." action={<Button onClick={openAdd}><Plus /> Add item</Button>} />
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <div key={item.id} className="group relative">
              <button type="button" onClick={() => (selecting ? toggle(item.id) : openEdit(item))} className="block w-full rounded-2xl text-left outline-none focus-visible:ring-3 focus-visible:ring-slate-900/30">
                <div className={cn("relative overflow-hidden rounded-2xl border bg-slate-100", selected.has(item.id) && "ring-2 ring-slate-900")}>
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
              <div className="mt-2"><TagList tags={item.tags} /></div>
              {select(item)}
            </div>
          ))}
          <button type="button" onClick={openAdd} className="flex aspect-square flex-col items-center justify-center gap-2 self-start rounded-2xl border-2 border-dashed bg-white text-muted-foreground transition-colors outline-none hover:border-slate-900 hover:text-slate-900 focus-visible:border-slate-900 focus-visible:ring-3 focus-visible:ring-slate-900/20">
            <Plus className="size-6" />
            <span className="text-sm font-medium">Add item</span>
          </button>
          {items.length === 0 && <p className="col-span-full text-sm text-muted-foreground">No items match these filters.</p>}
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl border bg-white">
          {items.map((item) => (
            <li key={item.id} className="group relative flex items-center gap-4 border-b px-4 py-3 last:border-b-0">
              <button type="button" role="checkbox" aria-checked={selected.has(item.id)} aria-label={`Select ${item.name}`} onClick={() => toggle(item.id)} className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border-2 outline-none focus-visible:ring-3 focus-visible:ring-slate-900/30", selected.has(item.id) ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-transparent")}>
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
                <span className="hidden sm:block"><TagList tags={item.tags} max={4} /></span>
                <StatusBadge status={item.status} />
              </button>
            </li>
          ))}
          <li>
            <button type="button" onClick={openAdd} className="flex w-full items-center justify-center gap-2 border-t border-dashed px-4 py-4 text-sm font-medium text-muted-foreground hover:bg-slate-50 hover:text-slate-900 focus-visible:bg-slate-50 focus-visible:outline-none">
              <Plus className="size-4" /> Add item
            </button>
          </li>
        </ul>
      )}

      </>
      )}

      <Dialog open={setupDialog === "connect"} onOpenChange={(open) => !open && setSetupDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect existing catalog</DialogTitle>
            <DialogDescription>Select a Meta catalog to connect to this WhatsApp account.</DialogDescription>
          </DialogHeader>
          {availableQuery.isPending ? <p className="text-sm text-muted-foreground">Loading catalogs…</p>
          : availableQuery.isError ? <ErrorState message="Couldn't load catalogs" onRetry={() => void availableQuery.refetch()} />
          : availableQuery.data?.length ? (
            <div className="space-y-2">
              {availableQuery.data.map((catalog) => (
                <label key={catalog.id} className="flex cursor-pointer items-center gap-3 rounded-xl border p-3">
                  <input type="radio" name="catalog" value={catalog.id} checked={selectedCatalogId === catalog.id} onChange={() => setSelectedCatalogId(catalog.id)} />
                  <span>{catalog.name}</span>
                </label>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No existing catalogs found. Create a new catalog instead.</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSetupDialog(null)}>Cancel</Button>
            <Button disabled={!selectedCatalogId || connectMutation.isPending} onClick={() => connectMutation.mutate(selectedCatalogId)}>
              {connectMutation.isPending ? "Connecting…" : "Connect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={setupDialog === "create"} onOpenChange={(open) => !open && setSetupDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create WhatsApp catalog</DialogTitle>
            <DialogDescription>Create a Meta catalog and connect it to WhatsApp.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => { event.preventDefault(); if (catalogName.trim()) createCatalogMutation.mutate(catalogName) }}>
            <label htmlFor="catalog-name" className="mb-2 block text-sm font-medium">Catalog name</label>
            <Input id="catalog-name" value={catalogName} onChange={(event) => setCatalogName(event.target.value)} placeholder="Hotel Services" maxLength={100} required />
            <DialogFooter className="mt-5">
              <Button type="button" variant="outline" onClick={() => setSetupDialog(null)}>Cancel</Button>
              <Button type="submit" disabled={!catalogName.trim() || createCatalogMutation.isPending}>
                {createCatalogMutation.isPending ? "Creating…" : "Create and connect"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDisconnect}
        onOpenChange={setConfirmDisconnect}
        title="Disconnect catalog?"
        description="This removes the WhatsApp association. The catalog and its products will remain available to reconnect later."
        confirmLabel="Disconnect"
        onConfirm={() => disconnectMutation.mutateAsync()}
      />
      <ConfirmDialog
        open={confirmDeleteCatalog}
        onOpenChange={setConfirmDeleteCatalog}
        title="Delete catalog permanently?"
        description="This permanently deletes the connected catalog and all its products. This cannot be undone."
        confirmLabel="Delete catalog"
        onConfirm={() => deleteCatalogMutation.mutateAsync()}
      />

      <ItemFormDialog open={formOpen} onOpenChange={setFormOpen} item={editing} onSave={save} onDelete={() => { if (editing) { setFormOpen(false); setDeleting([editing.id]) } }} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={deleting && deleting.length > 1 ? `Delete ${deleting.length} items?` : "Delete this item?"}
        description="This removes the item from your catalogue. This can't be undone."
        onConfirm={async () => {
          if (!deleting) return
          await deleteItemsMutation.mutateAsync(deleting)
          toast.success(deleting.length > 1 ? `${deleting.length} items deleted` : "Item deleted")
          setSelected(new Set())
        }}
      />
    </>
  )
}

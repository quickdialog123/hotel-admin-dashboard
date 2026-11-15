'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  LayoutGrid,
  List,
  MessageCircle,
  Plus,
  RefreshCw,
  Settings2,
  ShoppingBag,
  Trash2,
  Utensils,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { PageHeader } from '@/components/app/page-header';
import { PillSelect } from '@/components/app/pill-select';
import { StatusPill } from '@/components/app/status-pill';
import {
  CardGridSkeleton,
  EmptyState,
  ErrorState,
} from '@/components/app/states';
import {
  ItemFormDialog,
  STATUS_OPTIONS,
  Thumb,
  type ItemDraft,
} from '@/components/catalogue/item-form-dialog';
import { TagList } from '@/components/catalogue/tag-list';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import {
  CATALOGUE_CATEGORIES,
  connectWhatsAppCatalog,
  createCatalogueItem,
  deleteCatalogueItems,
  getAvailableCatalogs,
  getCatalogConnection,
  listCatalogueItems,
  updateCatalogueItem,
  updateCatalogueItemsCategory,
  updateCatalogSettings,
  type CatalogueItem,
} from '@/lib/api/catalogue';
import { getWabaConnection } from '@/lib/api/waba';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';

type Sort = 'updated' | 'name' | 'price';

const whatsappConnectionKey = ['whatsapp', 'connection'] as const;

const catalogConnectionKey = ['whatsapp', 'catalog', 'connection'] as const;

const availableCatalogsKey = ['whatsapp', 'catalog', 'available'] as const;

function StatusBadge({ status }: { status: CatalogueItem['status'] }) {
  if (status === 'active') {
    return null;
  }

  return (
    <StatusPill tone={status === 'draft' ? 'neutral' : 'error'}>
      {status === 'draft' ? 'Draft' : 'Out of stock'}
    </StatusPill>
  );
}

export default function CataloguePage() {
  const router = useRouter();

  const queryClient = useQueryClient();

  const [settingsOpen, setSettingsOpen] = useState(false);

  const whatsappQuery = useQuery({
    queryKey: whatsappConnectionKey,
    queryFn: getWabaConnection,
  });

  const whatsappConnected = whatsappQuery.data?.status === 'CONNECTED';

  const catalogQuery = useQuery({
    queryKey: catalogConnectionKey,
    queryFn: getCatalogConnection,
    enabled: whatsappConnected,
  });

  const connection = catalogQuery.data;

  const activeCatalog = connection?.catalog;

  const catalogId = activeCatalog?.id;

  const needsCatalog =
    whatsappConnected &&
    !catalogQuery.isPending &&
    !catalogQuery.isError &&
    (!connection || connection.status === 'not_connected' || !activeCatalog);

  const availableCatalogsQuery = useQuery({
    queryKey: availableCatalogsKey,
    queryFn: getAvailableCatalogs,
    enabled: needsCatalog,
  });

  const productsQuery = useQuery({
    queryKey: ['whatsapp', 'catalog', catalogId, 'products'],
    queryFn: listCatalogueItems,
    enabled: Boolean(catalogId),
  });

  const data = catalogId ? productsQuery.data : undefined;

  async function refreshProducts() {
    await queryClient.invalidateQueries({
      queryKey: ['whatsapp', 'catalog', catalogId, 'products'],
    });
  }

  const connectCatalogMutation = useMutation({
    mutationFn: connectWhatsAppCatalog,

    onSuccess: async (nextConnection) => {
      queryClient.setQueryData(catalogConnectionKey, nextConnection);

      await queryClient.invalidateQueries({
        queryKey: availableCatalogsKey,
      });

      toast.success('Catalog connected');
    },

    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Couldn't connect catalog",
      );
    },
  });

  const settingsMutation = useMutation({
    mutationFn: updateCatalogSettings,

    onSuccess: (nextConnection) => {
      queryClient.setQueryData(catalogConnectionKey, nextConnection);
    },

    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Couldn't update catalog settings",
      );
    },
  });

  const createItemMutation = useMutation({
    mutationFn: createCatalogueItem,
    onSuccess: refreshProducts,
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: ItemDraft }) =>
      updateCatalogueItem(id, draft),

    onSuccess: refreshProducts,
  });

  const deleteItemsMutation = useMutation({
    mutationFn: deleteCatalogueItems,
    onSuccess: refreshProducts,
  });

  const changeCategoryMutation = useMutation({
    mutationFn: ({ ids, category }: { ids: string[]; category: string }) =>
      updateCatalogueItemsCategory(ids, category),

    onSuccess: refreshProducts,
  });

  const [category, setCategory] = useState('all');

  const [status, setStatus] = useState('all');

  const [sort, setSort] = useState<Sort>('updated');

  const [view, setView] = useState<'grid' | 'list'>('grid');

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [formOpen, setFormOpen] = useState(false);

  const [editing, setEditing] = useState<CatalogueItem | null>(null);

  const [deleting, setDeleting] = useState<string[] | null>(null);

  useEffect(() => {
    setSelected(new Set());
    setEditing(null);
    setFormOpen(false);
  }, [catalogId]);

  const items = useMemo(() => {
    const rows = (data ?? []).filter(
      (item) =>
        (category === 'all' || item.category === category) &&
        (status === 'all' || item.status === status),
    );

    return rows.sort((a, b) => {
      if (sort === 'name') {
        return a.name.localeCompare(b.name);
      }

      if (sort === 'price') {
        return a.priceCents - b.priceCents;
      }

      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [data, category, status, sort]);

  const selecting = selected.size > 0;

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(item: CatalogueItem) {
    setEditing(item);
    setFormOpen(true);
  }

  async function save(draft: ItemDraft) {
    try {
      if (editing) {
        await updateItemMutation.mutateAsync({
          id: editing.id,
          draft,
        });
      } else {
        await createItemMutation.mutateAsync(draft);
      }

      toast.success(editing ? 'Item updated' : 'Item added');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't save item",
      );

      throw error;
    }
  }

  async function refreshCatalog() {
    await Promise.all([
      catalogQuery.refetch(),
      availableCatalogsQuery.refetch(),
    ]);
  }

  const select = (item: CatalogueItem) => (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected.has(item.id)}
      aria-label={`Select ${item.name}`}
      onClick={(event) => {
        event.stopPropagation();
        toggle(item.id);
      }}
      className={cn(
        'absolute top-2.5 right-2.5 flex size-7 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-white shadow-sm transition-opacity outline-none focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-slate-900/40',
        selected.has(item.id)
          ? 'opacity-100'
          : 'opacity-0 group-hover:opacity-100',
      )}
    >
      <Check className="size-4" />
    </button>
  );

  return (
    <>
      <PageHeader
        title="Catalogue"
        description="Manage products in your connected WhatsApp catalogue."
      />

      {whatsappQuery.isPending ? (
        <CardGridSkeleton />
      ) : whatsappQuery.isError ? (
        <ErrorState
          message={
            whatsappQuery.error instanceof Error
              ? whatsappQuery.error.message
              : "Couldn't load WhatsApp connection"
          }
          onRetry={() => void whatsappQuery.refetch()}
        />
      ) : !whatsappConnected ? (
        <EmptyState
          icon={<MessageCircle className="size-5" />}
          title="Connect WhatsApp first"
          description="Connect and verify your WhatsApp Business Account before setting up a catalog."
          action={
            <Button onClick={() => router.push('/whatsapp')}>
              <MessageCircle />
              Go to WhatsApp
            </Button>
          }
        />
      ) : catalogQuery.isPending ? (
        <CardGridSkeleton />
      ) : catalogQuery.isError ? (
        <ErrorState
          message={
            catalogQuery.error instanceof Error
              ? catalogQuery.error.message
              : "Couldn't load catalog"
          }
          onRetry={() => void catalogQuery.refetch()}
        />
      ) : !connection ||
        connection.status === 'not_connected' ||
        !activeCatalog ? (
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full border bg-muted/30">
              <ShoppingBag className="size-5" />
            </div>

            <h2 className="font-semibold">Connect a catalog</h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Choose one of the catalogs you gave QuickDialog access to during
              WhatsApp setup.
            </p>
          </div>

          {availableCatalogsQuery.isPending ? (
            <CardGridSkeleton />
          ) : availableCatalogsQuery.isError ? (
            <ErrorState
              message={
                availableCatalogsQuery.error instanceof Error
                  ? availableCatalogsQuery.error.message
                  : "Couldn't load catalogs"
              }
              onRetry={() => void availableCatalogsQuery.refetch()}
            />
          ) : availableCatalogsQuery.data.length === 0 ? (
            <EmptyState
              icon={<ShoppingBag className="size-5" />}
              title="No catalogs available"
              description="Reconnect WhatsApp and grant QuickDialog access to at least one Meta catalog."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    variant="outline"
                    disabled={availableCatalogsQuery.isFetching}
                    onClick={() => void availableCatalogsQuery.refetch()}
                  >
                    <RefreshCw
                      className={cn(
                        'size-4',
                        availableCatalogsQuery.isFetching && 'animate-spin',
                      )}
                    />
                    Refresh
                  </Button>

                  <Button onClick={() => router.push('/whatsapp')}>
                    <MessageCircle />
                    Reconnect WhatsApp
                  </Button>
                </div>
              }
            />
          ) : (
            <div className="overflow-hidden rounded-xl border bg-background">
              {availableCatalogsQuery.data.map((catalog) => (
                <div
                  key={catalog.id}
                  className="flex items-center gap-4 border-b p-4 last:border-b-0"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <ShoppingBag className="size-5 text-muted-foreground" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{catalog.name}</p>

                    <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <span>
                        {catalog.productCount}{' '}
                        {catalog.productCount === 1 ? 'product' : 'products'}
                      </span>

                      {catalog.vertical && (
                        <>
                          <span>·</span>

                          <span className="capitalize">{catalog.vertical}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <Button
                    disabled={
                      connectCatalogMutation.isPending || catalog.connected
                    }
                    onClick={() => connectCatalogMutation.mutate(catalog.id)}
                  >
                    {catalog.connected
                      ? 'Connected'
                      : connectCatalogMutation.isPending &&
                          connectCatalogMutation.variables === catalog.id
                        ? 'Connecting...'
                        : 'Connect'}
                  </Button>
                </div>
              ))}

              <div className="flex justify-end border-t bg-muted/20 p-3">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={availableCatalogsQuery.isFetching}
                  onClick={() => void availableCatalogsQuery.refetch()}
                >
                  <RefreshCw
                    className={cn(
                      'size-4',
                      availableCatalogsQuery.isFetching && 'animate-spin',
                    )}
                  />
                  Refresh
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b pb-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate font-semibold">{activeCatalog.name}</h2>

                <StatusPill
                  tone={connection.status === 'connected' ? 'solid' : 'neutral'}
                >
                  {connection.status === 'connected'
                    ? 'Visible on WhatsApp'
                    : 'Hidden from WhatsApp'}
                </StatusPill>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                {activeCatalog.productCount ?? 0}{' '}
                {(activeCatalog.productCount ?? 0) === 1
                  ? 'product'
                  : 'products'}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={catalogQuery.isFetching}
                onClick={() => void refreshCatalog()}
              >
                <RefreshCw
                  className={cn(
                    'size-4',
                    catalogQuery.isFetching && 'animate-spin',
                  )}
                />
                Refresh
              </Button>

              {connection.status === 'hidden' && (
                <Button
                  variant="outline"
                  disabled={settingsMutation.isPending}
                  onClick={() =>
                    settingsMutation.mutate({
                      catalogVisible: true,
                    })
                  }
                >
                  Show on WhatsApp
                </Button>
              )}

              <Button variant="outline" onClick={() => setSettingsOpen(true)}>
                <Settings2 />
                Catalog settings
              </Button>
            </div>
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-2">
            <PillSelect
              label="Filter by category"
              value={category}
              onChange={setCategory}
              options={[
                {
                  value: 'all',
                  label: 'All categories',
                },
                ...CATALOGUE_CATEGORIES.map((category) => ({
                  value: category,
                  label: category,
                })),
              ]}
            />

            <PillSelect
              label="Filter by status"
              value={status}
              onChange={setStatus}
              options={[
                {
                  value: 'all',
                  label: 'All statuses',
                },
                ...STATUS_OPTIONS,
              ]}
            />

            <PillSelect<Sort>
              label="Sort"
              prefix="Sort: "
              value={sort}
              onChange={setSort}
              options={[
                {
                  value: 'updated',
                  label: 'Last updated',
                },
                {
                  value: 'name',
                  label: 'Name',
                },
                {
                  value: 'price',
                  label: 'Price',
                },
              ]}
            />

            <div
              className="ml-auto flex rounded-full border bg-white p-0.5"
              role="group"
              aria-label="View"
            >
              {(['grid', 'list'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={view === mode}
                  aria-label={`${mode} view`}
                  onClick={() => setView(mode)}
                  className={cn(
                    'flex size-8 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30',
                    view === mode
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-500 hover:text-slate-900',
                  )}
                >
                  {mode === 'grid' ? (
                    <LayoutGrid className="size-4" />
                  ) : (
                    <List className="size-4" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {selecting && (
            <div
              role="region"
              aria-label="Bulk actions"
              className="sticky top-20 z-30 mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-white shadow-sm"
            >
              <span className="text-sm font-medium">
                {selected.size} selected
              </span>

              <div className="ml-auto flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger className="h-8 rounded-lg bg-white/10 px-3.5 text-sm font-medium outline-none hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/60">
                    Change category
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end" className="w-44">
                    {CATALOGUE_CATEGORIES.map((nextCategory) => (
                      <DropdownMenuItem
                        key={nextCategory}
                        onClick={async () => {
                          await changeCategoryMutation.mutateAsync({
                            ids: [...selected],
                            category: nextCategory,
                          });

                          toast.success(
                            `Moved ${selected.size} item${
                              selected.size > 1 ? 's' : ''
                            } to ${nextCategory}`,
                          );

                          setSelected(new Set());
                        }}
                      >
                        {nextCategory}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <button
                  type="button"
                  onClick={() => setDeleting([...selected])}
                  className="flex h-8 items-center gap-1.5 rounded-lg bg-white/10 px-3.5 text-sm font-medium hover:bg-red-500/80 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </button>

                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="h-8 rounded-lg px-3 text-sm text-white/70 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {productsQuery.isError ? (
            <ErrorState
              message={
                productsQuery.error instanceof Error
                  ? productsQuery.error.message
                  : "Couldn't load products"
              }
              onRetry={() => void productsQuery.refetch()}
            />
          ) : productsQuery.isPending || !data ? (
            <CardGridSkeleton />
          ) : data.length === 0 ? (
            <EmptyState
              icon={<Utensils className="size-5" />}
              title="No catalogue items yet"
              description="Add your first item to make it available to guests on WhatsApp."
              action={
                <Button onClick={openAdd}>
                  <Plus />
                  Add item
                </Button>
              }
            />
          ) : view === 'grid' ? (
            <div className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
              {items.map((item) => (
                <div key={item.id} className="group relative">
                  <button
                    type="button"
                    onClick={() =>
                      selecting ? toggle(item.id) : openEdit(item)
                    }
                    className="block w-full text-left outline-none focus-visible:ring-3 focus-visible:ring-slate-900/30"
                  >
                    <div
                      className={cn(
                        'relative overflow-hidden rounded-xl border bg-slate-100',
                        selected.has(item.id) && 'ring-2 ring-slate-900',
                      )}
                    >
                      <Thumb
                        url={item.photoUrl}
                        name={item.name}
                        className="aspect-square w-full object-cover"
                      />

                      <div className="absolute bottom-2.5 left-2.5">
                        <StatusBadge status={item.status} />
                      </div>
                    </div>

                    <p className="mt-2.5 truncate font-semibold">{item.name}</p>

                    <p className="text-sm text-muted-foreground">
                      {formatPrice(item.priceCents)} · {item.category}
                    </p>
                  </button>

                  <div className="mt-2">
                    <TagList tags={item.tags} />
                  </div>

                  {select(item)}
                </div>
              ))}

              <button
                type="button"
                onClick={openAdd}
                className="flex aspect-square flex-col items-center justify-center gap-2 self-start rounded-xl border-2 border-dashed bg-white text-muted-foreground transition-colors outline-none hover:border-slate-900 hover:text-slate-900 focus-visible:border-slate-900 focus-visible:ring-3 focus-visible:ring-slate-900/20"
              >
                <Plus className="size-6" />
                <span className="text-sm font-medium">Add item</span>
              </button>

              {items.length === 0 && (
                <p className="col-span-full text-sm text-muted-foreground">
                  No items match these filters.
                </p>
              )}
            </div>
          ) : (
            <ul className="overflow-hidden rounded-xl border bg-white">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="group relative flex items-center gap-4 border-b px-4 py-3 last:border-b-0"
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={selected.has(item.id)}
                    aria-label={`Select ${item.name}`}
                    onClick={() => toggle(item.id)}
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-full border-2 outline-none focus-visible:ring-3 focus-visible:ring-slate-900/30',
                      selected.has(item.id)
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-300 text-transparent',
                    )}
                  >
                    <Check className="size-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className="flex min-w-0 flex-1 items-center gap-4 text-left outline-none focus-visible:underline"
                  >
                    <Thumb
                      url={item.photoUrl}
                      name={item.name}
                      className="size-12 shrink-0 rounded-lg object-cover"
                    />

                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {item.name}
                      </span>

                      <span className="block text-sm text-muted-foreground">
                        {formatPrice(item.priceCents)} · {item.category}
                      </span>
                    </span>

                    <span className="hidden sm:block">
                      <TagList tags={item.tags} max={4} />
                    </span>

                    <StatusBadge status={item.status} />
                  </button>
                </li>
              ))}

              <li>
                <button
                  type="button"
                  onClick={openAdd}
                  className="flex w-full items-center justify-center gap-2 border-t border-dashed px-4 py-4 text-sm font-medium text-muted-foreground hover:bg-slate-50 hover:text-slate-900 focus-visible:bg-slate-50 focus-visible:outline-none"
                >
                  <Plus className="size-4" />
                  Add item
                </button>
              </li>
            </ul>
          )}
        </>
      )}

      {connection && activeCatalog && (
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Catalog settings</DialogTitle>

              <DialogDescription>
                Control how {activeCatalog.name} appears to guests on WhatsApp.
              </DialogDescription>
            </DialogHeader>

            <div className="divide-y">
              <div className="flex items-start justify-between gap-6 py-4">
                <div>
                  <p className="font-medium">Show on WhatsApp</p>

                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Show the catalog storefront and catalog actions to guests.
                  </p>
                </div>

                <Switch
                  checked={connection.catalogVisible}
                  disabled={settingsMutation.isPending}
                  onCheckedChange={(checked) =>
                    settingsMutation.mutate({
                      catalogVisible: checked,
                    })
                  }
                  aria-label="Show catalog on WhatsApp"
                />
              </div>

              <div className="flex items-start justify-between gap-6 py-4">
                <div>
                  <p className="font-medium">Shopping cart</p>

                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Allow guests to add products to their WhatsApp cart.
                  </p>
                </div>

                <Switch
                  checked={connection.cartEnabled}
                  disabled={settingsMutation.isPending}
                  onCheckedChange={(checked) =>
                    settingsMutation.mutate({
                      cartEnabled: checked,
                    })
                  }
                  aria-label="Enable shopping cart"
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <ItemFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        item={editing}
        onSave={save}
        onDelete={() => {
          if (!editing) {
            return;
          }

          setFormOpen(false);
          setDeleting([editing.id]);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
          }
        }}
        title={
          deleting && deleting.length > 1
            ? `Delete ${deleting.length} items?`
            : 'Delete this item?'
        }
        description="This removes the item from your catalogue. This can't be undone."
        onConfirm={async () => {
          if (!deleting) {
            return;
          }

          await deleteItemsMutation.mutateAsync(deleting);

          toast.success(
            deleting.length > 1
              ? `${deleting.length} items deleted`
              : 'Item deleted',
          );

          setDeleting(null);
          setSelected(new Set());
        }}
      />
    </>
  );
}

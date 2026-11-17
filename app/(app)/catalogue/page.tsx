'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LayoutGrid,
  List,
  MessageCircle,
  Plus,
  RefreshCw,
  Settings2,
  ShoppingBag,
  Trash2,
  Unlink,
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
  Thumb,
  type ItemDraft,
} from '@/components/catalogue/item-form-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  catalogueItemInputSchema,
  catalogueItemUpdateSchema,
  connectWhatsAppCatalog,
  createCatalogueItem,
  deleteCatalogueItem,
  disconnectWhatsAppCatalog,
  getCatalogueOperation,
  getAvailableCatalogs,
  getCatalogConnection,
  listCatalogueItems,
  updateCatalogueItem,
  updateCatalogSettings,
  type CatalogueItem,
  type CatalogueItemInput,
  type CatalogueItemUpdate,
  type CatalogueOperation,
} from '@/lib/api/catalogue';
import { getWabaConnection } from '@/lib/api/waba';
import { cn } from '@/lib/utils';

type Sort = 'name' | 'price';
type PendingOperation = { catalogId: string; handle: string };

const whatsappConnectionKey = ['whatsapp', 'connection'] as const;

const catalogConnectionKey = ['whatsapp', 'catalog', 'connection'] as const;

const availableCatalogsKey = ['whatsapp', 'catalog', 'available'] as const;

function AvailabilityBadge({ availability }: { availability?: string | null }) {
  if (!availability) return null;
  const tone = availability === 'in stock'
    ? 'solid'
    : availability === 'out of stock' || availability === 'discontinued'
      ? 'error'
      : 'neutral';
  return <StatusPill tone={tone}>{availability}</StatusPill>;
}

function priceAmount(price?: string | null) {
  const amount = Number.parseFloat(price ?? '');
  return Number.isFinite(amount) ? amount : 0;
}

function operationWarnings(operation: CatalogueOperation) {
  if (operation.warnings.length === 0) return;
  const warning = operation.warnings[0];
  const message = typeof warning === 'string'
    ? warning
    : typeof warning === 'object' && warning !== null && 'message' in warning && typeof warning.message === 'string'
      ? warning.message
      : 'The product operation completed with a Meta warning.';
  toast.warning(message);
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
    queryFn: () => catalogId ? listCatalogueItems(catalogId) : Promise.resolve({ data: [], paging: undefined }),
    enabled: Boolean(catalogId),
  });

  const data = catalogId ? productsQuery.data?.data : undefined;

  const [pendingOperation, setPendingOperation] = useState<PendingOperation | null>(null);
  const [processing, setProcessing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  async function refreshProducts(catalogueId = catalogId) {
    if (!catalogueId) return;
    await queryClient.invalidateQueries({
      queryKey: ['whatsapp', 'catalog', catalogueId, 'products'],
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

  const disconnectCatalogMutation = useMutation({
    mutationFn: disconnectWhatsAppCatalog,

    onSuccess: async (nextConnection) => {
      queryClient.setQueryData(catalogConnectionKey, nextConnection);

      queryClient.removeQueries({
        queryKey: ['whatsapp', 'catalog', catalogId, 'products'],
      });

      await queryClient.invalidateQueries({
        queryKey: availableCatalogsKey,
      });

      setSettingsOpen(false);

      toast.success('Catalog disconnected');
    },

    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Couldn't disconnect catalog",
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
    mutationFn: ({ catalogueId, input }: { catalogueId: string; input: CatalogueItemInput }) =>
      createCatalogueItem(catalogueId, input),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ catalogueId, productId, input }: { catalogueId: string; productId: string; input: CatalogueItemUpdate }) =>
      updateCatalogueItem(catalogueId, productId, input),
  });

  const deleteItemMutation = useMutation({
    mutationFn: ({ catalogueId, productId }: { catalogueId: string; productId: string }) =>
      deleteCatalogueItem(catalogueId, productId),
  });

  const [sort, setSort] = useState<Sort>('name');

  const [view, setView] = useState<'grid' | 'list'>('grid');

  const [formOpen, setFormOpen] = useState(false);

  const [editing, setEditing] = useState<CatalogueItem | null>(null);

  const [deleting, setDeleting] = useState<CatalogueItem | null>(null);

  // Clear any product dialog tied to the previous connected catalog.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setEditing(null);
    setFormOpen(false);
    setDeleting(null);
  }, [catalogId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const items = useMemo(() => {
    const rows = [...(data ?? [])];
    return rows.sort((a, b) => sort === 'name'
      ? a.name.localeCompare(b.name)
      : priceAmount(a.price) - priceAmount(b.price));
  }, [data, sort]);

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(item: CatalogueItem) {
    setEditing(item);
    setFormOpen(true);
  }

  async function finishOperation(catalogueId: string, operation: CatalogueOperation) {
    operationWarnings(operation);
    if (operation.status === 'finished') {
      setPendingOperation(null);
      toast.success('Catalogue product updated');
      await refreshProducts(catalogueId);
      return;
    }

    setPendingOperation({ catalogId: catalogueId, handle: operation.handle });
    toast.info('Meta is still processing this change. Refresh to check its status.');
  }

  async function save(draft: ItemDraft) {
    if (!catalogId) throw new Error('No connected catalog');
    try {
      if (editing) {
        const original = {
          name: editing.name,
          description: editing.description ?? '',
          productUrl: editing.productUrl ?? '',
          imageUrl: editing.imageUrl ?? '',
          price: editing.price?.match(/^(.+?)\s+[A-Z]{3}$/)?.[1] ?? editing.price ?? '',
          currency: editing.currency ?? editing.price?.match(/\s+([A-Z]{3})$/)?.[1] ?? 'USD',
          availability: editing.availability ?? 'in stock',
          brand: editing.brand ?? '',
          condition: editing.condition ?? 'new',
        };
        const changes: Record<string, string> = {};
        for (const key of Object.keys(draft) as Array<keyof ItemDraft>) {
          if (draft[key].trim() !== original[key] && draft[key].trim()) changes[key] = draft[key].trim();
        }
        if (draft.price !== original.price || draft.currency !== original.currency) {
          if (draft.price.trim()) changes.price = draft.price.trim();
          if (draft.currency.trim()) changes.currency = draft.currency.trim();
        }
        const input = catalogueItemUpdateSchema.parse(changes);
        const operation = await updateItemMutation.mutateAsync({
          catalogueId: catalogId,
          productId: editing.productId,
          input,
        });
        setFormOpen(false);
        await finishOperation(catalogId, operation);
      } else {
        const input = catalogueItemInputSchema.parse(draft);
        const operation = await createItemMutation.mutateAsync({ catalogueId: catalogId, input });
        setFormOpen(false);
        await finishOperation(catalogId, operation);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't save product",
      );

      throw error;
    }
  }

  async function remove(item: CatalogueItem) {
    if (!catalogId) return;
    try {
      const operation = await deleteItemMutation.mutateAsync({
        catalogueId: catalogId,
        productId: item.productId,
      });
      setDeleting(null);
      await finishOperation(catalogId, operation);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't delete product");
      throw error;
    }
  }

  async function checkOperation() {
    if (!pendingOperation || processing) return;
    setProcessing(true);
    try {
      const operation = await getCatalogueOperation(pendingOperation.catalogId, pendingOperation.handle);
      operationWarnings(operation);
      if (operation.status === 'finished') {
        setPendingOperation(null);
        toast.success('Catalogue product updated');
        await refreshProducts(pendingOperation.catalogId);
      } else {
        toast.info('Meta is still processing this change.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't check operation status");
    } finally {
      setProcessing(false);
    }
  }

  async function loadNextPage() {
    if (!catalogId || !productsQuery.data?.paging?.cursors?.after || loadingMore) return;
    setLoadingMore(true);
    try {
      const nextPage = await listCatalogueItems(catalogId, productsQuery.data.paging.cursors.after);
      queryClient.setQueryData(['whatsapp', 'catalog', catalogId, 'products'], (current: typeof productsQuery.data) => current ? {
        data: [...current.data, ...nextPage.data],
        paging: nextPage.paging,
      } : nextPage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't load more products");
    } finally {
      setLoadingMore(false);
    }
  }

  async function refreshCatalog() {
    await catalogQuery.refetch();

    if (needsCatalog) {
      await availableCatalogsQuery.refetch();
    }

    if (pendingOperation) {
      await checkOperation();
    }
  }

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
                    disabled={connectCatalogMutation.isPending}
                    onClick={() => connectCatalogMutation.mutate(catalog.id)}
                  >
                    {connectCatalogMutation.isPending &&
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
                disabled={
                  catalogQuery.isFetching || disconnectCatalogMutation.isPending || processing
                }
                onClick={() => void refreshCatalog()}
              >
                <RefreshCw
                  className={cn(
                    'size-4',
                    (catalogQuery.isFetching || processing) && 'animate-spin',
                  )}
                />
                Refresh
              </Button>

              {connection.status === 'hidden' && (
                <Button
                  variant="outline"
                  disabled={
                    settingsMutation.isPending ||
                    disconnectCatalogMutation.isPending
                  }
                  onClick={() =>
                    settingsMutation.mutate({
                      catalogVisible: true,
                    })
                  }
                >
                  Show on WhatsApp
                </Button>
              )}

              <Button
                variant="outline"
                disabled={disconnectCatalogMutation.isPending}
                onClick={() => setSettingsOpen(true)}
              >
                <Settings2 />
                Catalog settings
              </Button>

              <Button
                variant="outline"
                disabled={disconnectCatalogMutation.isPending}
                onClick={() => disconnectCatalogMutation.mutate()}
              >
                <Unlink />

                {disconnectCatalogMutation.isPending
                  ? 'Disconnecting...'
                  : 'Disconnect'}
              </Button>
            </div>
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-2">
            <PillSelect<Sort>
              label="Sort"
              prefix="Sort: "
              value={sort}
              onChange={setSort}
              options={[
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

          {pendingOperation && (
            <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border bg-white px-4 py-3 text-sm">
              <span>A Meta catalog operation is still processing. Use Refresh to check its status.</span>
            </div>
          )}

          {productsQuery.isError ? (
            <ErrorState
              message={productsQuery.error instanceof Error ? productsQuery.error.message : "Couldn't load products"}
              onRetry={() => void productsQuery.refetch()}
            />
          ) : productsQuery.isPending || !data ? (
            <CardGridSkeleton />
          ) : data.length === 0 ? (
            <EmptyState
              icon={<ShoppingBag className="size-5" />}
              title="No products in this catalog yet"
              description="Add your first product to make it available in your WhatsApp catalog."
              action={<Button onClick={openAdd}><Plus /> Add product</Button>}
            />
          ) : view === 'grid' ? (
            <div className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
              {items.map((item) => (
                <div key={item.productId} className="group relative">
                  <button type="button" onClick={() => openEdit(item)} className="block w-full text-left outline-none focus-visible:ring-3 focus-visible:ring-slate-900/30">
                    <div className="relative overflow-hidden rounded-xl border bg-slate-100">
                      <Thumb url={item.imageUrl} name={item.name} className="aspect-square w-full object-cover" />
                      <div className="absolute bottom-2.5 left-2.5"><AvailabilityBadge availability={item.availability} /></div>
                    </div>
                    <p className="mt-2.5 truncate font-semibold">{item.name}</p>
                    <p className="text-sm text-muted-foreground">{item.price ?? 'Price unavailable'}{item.brand ? ` · ${item.brand}` : ''}</p>
                  </button>
                  <button type="button" aria-label={`Delete ${item.name}`} disabled={processing} onClick={() => setDeleting(item)} className="absolute top-2.5 right-2.5 flex size-8 items-center justify-center rounded-full border bg-white/95 text-slate-600 shadow-sm opacity-0 transition-opacity hover:text-red-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40 group-hover:opacity-100 disabled:opacity-50"><Trash2 className="size-4" /></button>
                </div>
              ))}
              <button type="button" onClick={openAdd} className="flex aspect-square flex-col items-center justify-center gap-2 self-start rounded-xl border-2 border-dashed bg-white text-muted-foreground transition-colors outline-none hover:border-slate-900 hover:text-slate-900 focus-visible:border-slate-900 focus-visible:ring-3 focus-visible:ring-slate-900/20">
                <Plus className="size-6" /><span className="text-sm font-medium">Add product</span>
              </button>
            </div>
          ) : (
            <ul className="overflow-hidden rounded-xl border bg-white">
              {items.map((item) => (
                <li key={item.productId} className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0">
                  <button type="button" onClick={() => openEdit(item)} className="flex min-w-0 flex-1 items-center gap-4 text-left outline-none focus-visible:underline">
                    <Thumb url={item.imageUrl} name={item.name} className="size-12 shrink-0 rounded-lg object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{item.name}</span>
                      <span className="block text-sm text-muted-foreground">{item.price ?? 'Price unavailable'}{item.brand ? ` · ${item.brand}` : ''}</span>
                    </span>
                    <AvailabilityBadge availability={item.availability} />
                  </button>
                  <button type="button" aria-label={`Delete ${item.name}`} disabled={processing} onClick={() => setDeleting(item)} className="flex size-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 disabled:opacity-50"><Trash2 className="size-4" /></button>
                </li>
              ))}
            </ul>
          )}

          {productsQuery.data?.paging?.cursors?.after && (
            <div className="mt-5 flex justify-center">
              <Button variant="outline" disabled={loadingMore} onClick={() => void loadNextPage()}>
                {loadingMore ? 'Loading…' : 'Load more products'}
              </Button>
            </div>
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

          setDeleting(editing);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
          }
        }}
        title="Delete this product?"
        description="This submits a deletion to Meta and can’t be undone."
        onConfirm={async () => {
          if (!deleting) {
            return;
          }

          await remove(deleting);
        }}
      />
    </>
  );
}

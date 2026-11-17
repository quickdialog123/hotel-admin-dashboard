import z from "zod"
import { deleteJson, getJson, patchJson, postJson } from "./client"

export const catalogueItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  productUrl: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  availability: z.string().nullable().optional(),
  price: z.string().nullable().optional(),
  currency: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  condition: z.string().nullable().optional(),
});

export type CatalogueItem = z.infer<typeof catalogueItemSchema>;

const pagingSchema = z.object({
  cursors: z.object({
    before: z.string().optional(),
    after: z.string().optional(),
  }).optional(),
  next: z.string().optional(),
}).optional();

export const catalogueItemsPageSchema = z.object({
  data: z.array(catalogueItemSchema),
  paging: pagingSchema,
});

export type CatalogueItemsPage = z.infer<typeof catalogueItemsPageSchema>;

const absoluteHttpUrl = z.string().refine((value) => {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}, "Enter an absolute HTTP or HTTPS URL");

const priceSchema = z.string()
  .regex(/^\d+(\.\d{1,2})?$/, "Enter a price with up to two decimal places")
  .refine((value) => Number(value) > 0, "Price must be greater than zero");

export const catalogueItemInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
  productUrl: absoluteHttpUrl,
  imageUrl: absoluteHttpUrl,
  price: priceSchema,
  currency: z.string().regex(/^[A-Z]{3}$/),
  availability: z.enum(["in stock", "out of stock", "available for order", "discontinued"]),
  brand: z.string().trim().min(1).max(100),
  condition: z.enum(["new", "refurbished", "used"]),
});

export type CatalogueItemInput = z.infer<typeof catalogueItemInputSchema>;

export const catalogueItemUpdateSchema = catalogueItemInputSchema.partial().refine(
  (input) => Object.keys(input).length > 0,
  "At least one product field is required",
);

export type CatalogueItemUpdate = z.infer<typeof catalogueItemUpdateSchema>;

export const catalogueOperationSchema = z.object({
  productId: z.string().optional(),
  handle: z.string(),
  status: z.string(),
  errors: z.array(z.unknown()).optional().default([]),
  warnings: z.array(z.unknown()).optional().default([]),
  products: z.array(catalogueItemSchema).optional(),
  paging: pagingSchema,
});

export type CatalogueOperation = z.infer<typeof catalogueOperationSchema>;

export function listCatalogueItems(catalogId: string, after?: string) {
  return getJson(
    `whatsapp/catalogs/${encodeURIComponent(catalogId)}/products`,
    catalogueItemsPageSchema,
    after ? { after } : undefined,
  );
}

export function createCatalogueItem(catalogId: string, input: CatalogueItemInput) {
  return postJson(
    `whatsapp/catalogs/${encodeURIComponent(catalogId)}/products`,
    input,
    catalogueOperationSchema,
    catalogueItemInputSchema,
  );
}

export function updateCatalogueItem(catalogId: string, productId: string, input: CatalogueItemUpdate) {
  return patchJson(
    `whatsapp/catalogs/${encodeURIComponent(catalogId)}/products/${encodeURIComponent(productId)}`,
    input,
    catalogueOperationSchema,
    catalogueItemUpdateSchema,
  );
}

export function deleteCatalogueItem(catalogId: string, productId: string) {
  return deleteJson(
    `whatsapp/catalogs/${encodeURIComponent(catalogId)}/products/${encodeURIComponent(productId)}`,
    catalogueOperationSchema,
  );
}

export function getCatalogueOperation(catalogId: string, handle: string) {
  return getJson(
    `whatsapp/catalogs/${encodeURIComponent(catalogId)}/operations/${encodeURIComponent(handle)}`,
    catalogueOperationSchema,
  );
}

export const whatsappCatalogSchema = z.object({
  id: z.string(),
  name: z.string(),
  vertical: z.string().nullable(),
  productCount: z.number(),
});

export const catalogConnectionSchema = z.object({
  status: z.enum(['not_connected', 'connected', 'hidden']),
  catalog: whatsappCatalogSchema.nullable(),
  catalogVisible: z.boolean(),
  cartEnabled: z.boolean(),
});

export const availableCatalogSchema = z.object({
  id: z.string(),
  name: z.string(),
  vertical: z.string().nullable(),
  productCount: z.number()
});

export const availableCatalogsSchema = z.array(availableCatalogSchema);

export const connectCatalogInputSchema = z.object({
  catalogId: z.string().min(1),
});

export const catalogSettingsInputSchema = z
  .object({
    catalogVisible: z.boolean().optional(),
    cartEnabled: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.catalogVisible !== undefined || value.cartEnabled !== undefined,
    {
      message: 'At least one setting is required',
    },
  );

export type CatalogConnection = z.infer<typeof catalogConnectionSchema>;

export type AvailableCatalog = z.infer<typeof availableCatalogSchema>;

export type CatalogSettingsInput = z.infer<typeof catalogSettingsInputSchema>;

export function getCatalogConnection() {
  return getJson('whatsapp/catalogs/connection', catalogConnectionSchema);
}

export function getAvailableCatalogs() {
  return getJson('whatsapp/catalogs/available', availableCatalogsSchema);
}

export function connectWhatsAppCatalog(catalogId: string) {
  const input = {
    catalogId,
  };

  return postJson(
    'whatsapp/catalogs/connect',
    input,
    catalogConnectionSchema,
    connectCatalogInputSchema,
  );
}

export function updateCatalogSettings(input: CatalogSettingsInput) {
  return patchJson(
    'whatsapp/catalogs/settings',
    input,
    catalogConnectionSchema,
    catalogSettingsInputSchema,
  );
}

export function disconnectWhatsAppCatalog() {
  return postJson(
    'whatsapp/catalogs/disconnect',
    {},
    catalogConnectionSchema,
  );
}

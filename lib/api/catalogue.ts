import { clone, delay, isoAgo, newId } from "./_mock"

export type CatalogueStatus = "active" | "draft" | "out_of_stock"

/**
 * Modelled on a Meta Commerce Catalog product (`retailer_id`, `name`,
 * `description`, `price`, `image_url`, `availability`).
 */
export type CatalogueItem = {
  id: string
  name: string
  description: string
  priceCents: number
  category: string
  photoUrl: string | null
  /** Free-form metadata labels, e.g. dietary info (Vegetarian, Gluten-free) or merchandising (Chef's pick). */
  tags: string[]
  status: CatalogueStatus
  /** ISO timestamp */
  updatedAt: string
}

/** Suggested tags offered in the item form. Tags are free-form, so any text is allowed. */
export const SUGGESTED_TAGS = ["Vegetarian", "Vegan", "Gluten-free", "Halal", "Contains nuts", "Spicy", "Chef's pick", "Signature", "Served 24/7", "Kids' favourite"] as const

export const CATALOGUE_CATEGORIES = ["Mains", "Drinks", "Desserts", "Snacks", "Breakfast"] as const

let items: CatalogueItem[] = [
  { id: "cat_1", name: "Club Sandwich", description: "Roast chicken, bacon, egg, tomato and lettuce on toasted sourdough, served with fries.", priceCents: 1400, category: "Mains", photoUrl: "/catalogue/club-sandwich.svg", tags: ["Served 24/7", "Kids' favourite"], status: "active", updatedAt: isoAgo(90) },
  { id: "cat_2", name: "Margherita Pizza", description: "San Marzano tomato, buffalo mozzarella, fresh basil.", priceCents: 1600, category: "Mains", photoUrl: "/catalogue/margherita-pizza.svg", tags: ["Vegetarian", "Chef's pick"], status: "active", updatedAt: isoAgo(60 * 5) },
  { id: "cat_3", name: "Grilled Sea Bass", description: "Lemon butter, samphire and new potatoes.", priceCents: 2800, category: "Mains", photoUrl: "/catalogue/sea-bass.svg", tags: ["Gluten-free", "Signature"], status: "out_of_stock", updatedAt: isoAgo(60 * 26) },
  { id: "cat_4", name: "Flat White", description: "Double-shot espresso with steamed milk.", priceCents: 450, category: "Drinks", photoUrl: "/catalogue/flat-white.svg", tags: ["Vegetarian", "Served 24/7"], status: "active", updatedAt: isoAgo(60 * 48) },
  { id: "cat_5", name: "Sparkling Water (750ml)", description: "Chilled, with lemon.", priceCents: 600, category: "Drinks", photoUrl: "/catalogue/sparkling-water.svg", tags: ["Vegan", "Gluten-free"], status: "active", updatedAt: isoAgo(60 * 72) },
  { id: "cat_6", name: "Sticky Toffee Pudding", description: "Warm date sponge, toffee sauce, vanilla ice cream.", priceCents: 950, category: "Desserts", photoUrl: "/catalogue/toffee-pudding.svg", tags: ["Vegetarian", "Contains nuts"], status: "active", updatedAt: isoAgo(60 * 30) },
  { id: "cat_7", name: "Chocolate Fondant", description: "Molten centre, served with raspberry sorbet.", priceCents: 1050, category: "Desserts", photoUrl: null, tags: ["Vegetarian", "Chef's pick"], status: "draft", updatedAt: isoAgo(20) },
  { id: "cat_8", name: "Full English Breakfast", description: "Eggs, bacon, sausage, beans, mushrooms, tomato, toast.", priceCents: 1800, category: "Breakfast", photoUrl: "/catalogue/full-english.svg", tags: ["Halal option"], status: "active", updatedAt: isoAgo(60 * 100) },
  { id: "cat_9", name: "Truffle Fries", description: "Parmesan and truffle oil.", priceCents: 800, category: "Snacks", photoUrl: null, tags: ["Vegan", "Spicy"], status: "draft", updatedAt: isoAgo(60 * 6) },
]

export async function listCatalogueItems(): Promise<CatalogueItem[]> {
  return delay(clone(items))
}

// TODO(backend): photo upload should go to real storage; photoUrl becomes a CDN URL.
export async function createCatalogueItem(input: Omit<CatalogueItem, "id" | "updatedAt">): Promise<CatalogueItem> {
  const item: CatalogueItem = { ...input, id: newId("cat"), updatedAt: new Date().toISOString() }
  items = [item, ...items]
  return delay(clone(item))
}

export async function updateCatalogueItem(id: string, input: Partial<Omit<CatalogueItem, "id">>): Promise<CatalogueItem> {
  items = items.map((i) => (i.id === id ? { ...i, ...input, updatedAt: new Date().toISOString() } : i))
  return delay(clone(items.find((i) => i.id === id)!))
}

export async function deleteCatalogueItem(id: string): Promise<void> {
  items = items.filter((i) => i.id !== id)
  return delay(undefined)
}

export async function deleteCatalogueItems(ids: string[]): Promise<void> {
  items = items.filter((i) => !ids.includes(i.id))
  return delay(undefined)
}

export async function updateCatalogueItemsCategory(ids: string[], category: string): Promise<void> {
  items = items.map((i) => (ids.includes(i.id) ? { ...i, category, updatedAt: new Date().toISOString() } : i))
  return delay(undefined)
}

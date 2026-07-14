import { authedFetch } from "./auth";

// ── Bag types (mirrors server domain.Bag) ─────────────────────────────────

export interface Bag {
  id: string;
  name: string;
  description: string;
  price: number;
  brand: string;
  color: string;
  material: string;
  capacity: string;
  stock: number;
  image?: string;
}

export interface ServerProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  brand: string;
  color: string;
  material: string;
  stock: number;
  category: string;
  status: string;
  image?: string;
  images?: string[];
  createdAt: string;
  /** Sellable variant SKU — what cart/checkout key line items on. */
  sku: string;
}

// ── Bag listing — public ───────────────────────────────────────────────────

export async function fetchBags(filters?: {
  brand?: string;
  color?: string;
  material?: string;
}): Promise<Bag[]> {
  const params = new URLSearchParams();
  if (filters?.brand) params.set("brand", filters.brand);
  if (filters?.color) params.set("color", filters.color);
  if (filters?.material) params.set("material", filters.material);

  const qs = params.size ? `?${params.toString()}` : "";
  const res = await fetch(`/api/products/bags${qs}`);
  if (!res.ok) throw new Error(`Bags fetch failed: ${res.status}`);
  const data = (await res.json()) as { total: number; results: Bag[] | null };
  return data.results ?? [];
}

// ── Single product — proxied to Dupli1 product service ───────────────────

export async function fetchProduct(id: string): Promise<ServerProduct> {
  const res = await fetch(`/api/products/${id}`);
  if (res.status === 404) throw new Error(`Product not found: ${id}`);
  if (!res.ok) throw new Error(`Product fetch failed: ${res.status}`);
  return res.json() as Promise<ServerProduct>;
}

/**
 * Real-time stock for a SKU. Returns `null` when inventory has no record for
 * it yet (untracked, not necessarily zero — stock enforcement on add isn't
 * implemented backend-side; checkout is the real enforcement point).
 */
export async function fetchAvailableStock(sku: string): Promise<number | null> {
  const res = await fetch(`/api/v1/inventory/${encodeURIComponent(sku)}`);
  if (!res.ok) return null;
  const body = (await res.json()) as { quantity: number; reserved: number };
  return Math.max(0, body.quantity - body.reserved);
}

// ── Brand fallback images (server has no image column) ────────────────────

const BRAND_IMAGES: Record<string, string> = {
  Gucci: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&h=720&fit=crop",
  "Louis Vuitton": "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&h=720&fit=crop",
  Chanel: "https://images.unsplash.com/photo-1591561954557-26941169b49e?w=600&h=720&fit=crop",
  Prada: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=600&h=720&fit=crop",
  Coach: "https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=600&h=720&fit=crop",
  "Hermès": "https://images.unsplash.com/photo-1473188588951-666fce8e7c68?w=600&h=720&fit=crop",
  Dior: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&h=720&fit=crop",
  "Bottega Veneta": "https://images.unsplash.com/photo-1591561954557-26941169b49e?w=600&h=720&fit=crop",
  "Miu Miu": "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=600&h=720&fit=crop",
  Balenciaga: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&h=720&fit=crop",
};

export function bagImage(brand: string, image?: string): string {
  if (image) return image;
  return (
    BRAND_IMAGES[brand] ??
    "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&h=720&fit=crop"
  );
}

export function heroBagImage(image?: string, brand?: string): string {
  if (!image) return bagImage(brand ?? "");
  return image.replace(/w_\d+,h_\d+/, "w_1200,h_1400");
}

export function bannerBagImage(image?: string, brand?: string): string {
  if (!image) return bagImage(brand ?? "").replace(/w=\d+,h=\d+/, "w=1600,h=600");
  return image.replace(/w_\d+,h_\d+/, "w_1600,h_600");
}

const PRODUCT_IMAGES: Record<string, string> = {
  bags: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&h=720&fit=crop",
  sneakers: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=720&fit=crop",
  watches: "https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?w=600&h=720&fit=crop",
  outerwear: "https://images.unsplash.com/photo-1548883354-7622d03aca27?w=600&h=720&fit=crop",
};

export function productImage(
  category: string,
  brand: string,
  image?: string
): string {
  if (image) return image;
  if (category.toLowerCase() === "bags") return bagImage(brand);
  return PRODUCT_IMAGES[category.toLowerCase()] ?? bagImage(brand);
}

export interface DisplayProduct {
  id: string;
  name: string;
  price: number;
  description: string;
  category: string;
  stock?: number;
  image?: string;
  details: Record<string, string | number>;
}

export const CATEGORY_IMAGES: Record<string, string> = {
  consultations:
    "https://images.unsplash.com/photo-1552664730-d307ca884978?w=400",
  shoes: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400",
  sneakers: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400",
  outerwear: "https://images.unsplash.com/photo-1539533057592-4516c98775cb?w=400",
  bottoms: "https://images.unsplash.com/photo-1542272604-787c62d465d1?w=400",
  bags: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400",
  clocks: "https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=400",
  watches: "https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?w=400",
};

export function getCategoryImage(category: string): string {
  return (
    CATEGORY_IMAGES[category.toLowerCase()] ??
    "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400"
  );
}

function normalizeProduct(
  raw: Record<string, unknown>,
  category: string
): DisplayProduct {
  if ("Title" in raw) {
    const details: Record<string, string | number> = {};
    if (raw.Status != null) details["Status"] = String(raw.Status);
    if (raw.Duration != null) details["Duration"] = `${raw.Duration} min`;
    return {
      id: String(raw.ID),
      name: String(raw.Title),
      price: Number(raw.Price),
      description: String(raw.Description),
      category: category.toLowerCase(),
      details,
    };
  }
  const details: Record<string, string | number> = {};
  for (const k of [
    "Brand",
    "Color",
    "Material",
    "Size",
    "Gender",
    "Capacity",
    "Type",
    "Style",
  ]) {
    if (raw[k] != null) details[k] = raw[k] as string | number;
  }
  return {
    id: String(raw.ID),
    name: String(raw.Name),
    price: Number(raw.Price),
    description: String(raw.Description),
    category: String(raw.Category ?? category).toLowerCase(),
    stock: raw.Stock != null ? Number(raw.Stock) : undefined,
    image: raw.Image != null ? String(raw.Image) : undefined,
    details,
  };
}

export async function getCategories(): Promise<string[]> {
  const res = await fetch("/api/categories");
  if (!res.ok) throw new Error("Failed to fetch categories");
  const { categories } = (await res.json()) as { categories: string[] };
  return categories;
}

export async function getFilters(category: string): Promise<string[]> {
  const res = await fetch(
    `/api/filters?category=${encodeURIComponent(category)}`
  );
  if (!res.ok) return [];
  const { filters } = (await res.json()) as { filters: string[] };
  return filters;
}

export async function searchProducts(
  category: string,
  params: Record<string, string> = {}
): Promise<{ total: number; results: DisplayProduct[] }> {
  const qs = new URLSearchParams({ category });
  for (const [k, v] of Object.entries(params)) {
    if (v.trim()) qs.set(k, v.trim());
  }
  const res = await fetch(`/api/products/search?${qs}`);
  if (!res.ok) throw new Error("Search failed");
  const { total, results } = (await res.json()) as {
    total: number;
    results: Record<string, unknown>[];
  };
  return {
    total,
    results: results.map((r) => normalizeProduct(r, category)),
  };
}

/** Map products/new form keys (PascalCase) onto the product API JSON fields. */
const CREATE_FIELD_MAP: Record<string, string> = {
  Name: "name",
  Title: "name",
  Brand: "brand",
  Price: "price",
  Stock: "stock",
  Description: "description",
  Color: "color",
  Material: "material",
  Capacity: "capacity",
  Status: "status",
};

export async function createProduct(
  category: string,
  data: Record<string, unknown>
): Promise<{ id: string }> {
  const body: Record<string, unknown> = { category };
  for (const [key, value] of Object.entries(data)) {
    const apiKey = CREATE_FIELD_MAP[key] ?? key;
    // Prefer the first mapped value when Title and Name both exist.
    if (body[apiKey] === undefined) body[apiKey] = value;
  }

  const res = await authedFetch("/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = "Failed to create product";
    try {
      const errBody = (await res.json()) as { error?: string };
      if (errBody.error) msg = errBody.error;
    } catch {}
    throw new Error(msg);
  }
  const created = (await res.json()) as { id?: string };
  if (!created.id) throw new Error("Product created without an id");
  return { id: created.id };
}

/**
 * Upload a product image via the BFF →
 * `POST /api/v1/products/{id}/images` (multipart field `image`).
 * Appends to the product's default variant.
 */
export async function uploadProductImage(
  productId: string,
  file: File
): Promise<void> {
  const form = new FormData();
  form.append("image", file, file.name);

  const res = await authedFetch(
    `/api/products/${encodeURIComponent(productId)}/images`,
    {
      method: "POST",
      body: form,
    }
  );
  if (!res.ok) {
    let msg = "Image upload failed";
    try {
      const errBody = (await res.json()) as { error?: string };
      if (errBody.error) msg = errBody.error;
    } catch {}
    throw new Error(msg);
  }
}

export async function searchAcrossAll(
  query: string
): Promise<DisplayProduct[]> {
  const cats = [
    "consultations",
    "shoes",
    "outerwear",
    "bottoms",
    "bags",
    "clocks",
  ];
  const settled = await Promise.allSettled(
    cats.map((cat) => {
      const p: Record<string, string> = {};
      if (query) {
        p[cat === "consultations" ? "title" : "brand"] = query;
      }
      return searchProducts(cat, p);
    })
  );
  return settled
    .filter(
      (
        r
      ): r is PromiseFulfilledResult<{
        total: number;
        results: DisplayProduct[];
      }> => r.status === "fulfilled"
    )
    .flatMap((r) => r.value.results);
}

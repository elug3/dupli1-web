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

/** Raw parent-style payload from `GET /api/v1/products` (dupli1-product). */
interface UpstreamProduct {
  id: string;
  name: string;
  description: string;
  price?: number;
  priceFrom?: number;
  brand: string;
  color?: string;
  material: string;
  stock?: number;
  category: string;
  status?: string;
  imageUrls?: string[];
  defaultImageUrl?: string;
  tags?: string[];
  createdAt?: string;
  capacity?: string;
  productType?: string;
  style?: string;
  family?: string;
  variants?: Array<{
    sku: string;
    color?: string;
    price: number;
    status: string;
    imageUrls?: string[];
  }>;
}

interface ProductSearchResponse {
  total: number;
  results: UpstreamProduct[] | null;
}

function upstreamPrice(product: UpstreamProduct): number {
  return product.priceFrom ?? product.price ?? 0;
}

function upstreamImage(product: UpstreamProduct): string | undefined {
  if (product.defaultImageUrl?.trim()) return product.defaultImageUrl.trim();
  return product.imageUrls?.find((url) => url.trim().length > 0);
}

function upstreamImages(product: UpstreamProduct): string[] {
  const images = (product.imageUrls ?? []).filter((url) => url.trim().length > 0);
  if (images.length === 0 && product.defaultImageUrl?.trim()) {
    return [product.defaultImageUrl.trim()];
  }
  return images;
}

function upstreamStatus(product: UpstreamProduct): string {
  if (product.tags?.includes("new")) return "new";
  if (product.tags?.includes("hot") || product.tags?.includes("top")) return "featured";
  if (product.status === "active" || !product.status) return "standard";
  return product.status;
}

function upstreamSku(product: UpstreamProduct): string {
  const active =
    product.variants?.find((v) => v.status === "active") ?? product.variants?.[0];
  return active?.sku ?? product.id;
}

function toBag(product: UpstreamProduct): Bag {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: upstreamPrice(product),
    brand: product.brand,
    color: product.color ?? "",
    material: product.material,
    capacity: product.capacity ?? "",
    stock: product.stock ?? 0,
    image: upstreamImage(product),
  };
}

function toServerProduct(product: UpstreamProduct): ServerProduct {
  const images = upstreamImages(product);
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: upstreamPrice(product),
    brand: product.brand,
    color: product.color ?? "",
    material: product.material,
    stock: product.stock ?? 0,
    sku: upstreamSku(product),
    category: product.category || "bags",
    status: upstreamStatus(product),
    image: images[0],
    images: images.length > 0 ? images : undefined,
    createdAt: product.createdAt ?? new Date(0).toISOString(),
  };
}

// ── Bag listing — public gateway path ──────────────────────────────────────
// Production ALB routes `/api/*` to the nginx gateway (not the React BFF), so
// the browser must call the product service paths from elug3/dupli1:
//   GET /api/v1/products?category=bags
//   GET /api/v1/products/{id}

const UPSTREAM_FILTER_KEYS = ["brand", "color", "material", "size", "tags"] as const;

async function searchUpstream(
  filters: Record<string, string> = {}
): Promise<UpstreamProduct[]> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (trimmed.toLowerCase() === "__no_match__") return [];
    params.set(key, trimmed);
  }
  if (!params.has("category")) params.set("category", "bags");

  const res = await fetch(`/api/v1/products?${params}`);
  if (!res.ok) throw new Error(`Product search failed: ${res.status}`);
  const data = (await res.json()) as ProductSearchResponse;
  return data.results ?? [];
}

export async function fetchBags(filters?: {
  brand?: string;
  color?: string;
  material?: string;
}): Promise<Bag[]> {
  const products = await searchUpstream({
    category: "bags",
    ...(filters?.brand ? { brand: filters.brand } : {}),
    ...(filters?.color ? { color: filters.color } : {}),
    ...(filters?.material ? { material: filters.material } : {}),
  });
  return products.map(toBag);
}

export async function fetchProduct(id: string): Promise<ServerProduct> {
  const res = await fetch(`/api/v1/products/${encodeURIComponent(id)}`);
  if (res.status === 404) throw new Error(`Product not found: ${id}`);
  if (!res.ok) throw new Error(`Product fetch failed: ${res.status}`);
  return toServerProduct((await res.json()) as UpstreamProduct);
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
  // Static — matches dupli1-product's bags-only storefront catalog.
  // Avoid `/api/categories`: ALB sends `/api/*` to the gateway, which has no
  // such route (404). Local BFF still serves it for older callers.
  return ["bags"];
}

export async function getFilters(category: string): Promise<string[]> {
  if (category.toLowerCase() !== "bags") return [];
  return ["brand", "color", "material", "productType", "style", "family"];
}

export async function searchProducts(
  category: string,
  params: Record<string, string> = {}
): Promise<{ total: number; results: DisplayProduct[] }> {
  if (category.toLowerCase() !== "bags") {
    return { total: 0, results: [] };
  }

  const upstream: Record<string, string> = { category: "bags" };
  const local: Array<[string, string]> = [];
  const query = params.query?.trim().toLowerCase() ?? "";

  for (const [key, value] of Object.entries(params)) {
    const trimmed = value.trim();
    if (!trimmed || key === "category" || key === "query") continue;
    if (trimmed.toLowerCase() === "__no_match__") {
      return { total: 0, results: [] };
    }
    if ((UPSTREAM_FILTER_KEYS as readonly string[]).includes(key)) {
      upstream[key] = trimmed;
    } else {
      local.push([key, trimmed]);
    }
  }

  const products = await searchUpstream(upstream);
  const filtered = products.filter((product) => {
    for (const [key, wanted] of local) {
      const actual = (() => {
        switch (key.toLowerCase()) {
          case "producttype":
          case "product-type":
          case "type":
            return product.productType ?? "";
          case "style":
            return product.style ?? "";
          case "family":
          case "gender":
            return product.family ?? "";
          default:
            return "";
        }
      })();
      // Facets not populated on the parent yet — don't empty the grid.
      if (!actual) continue;
      if (actual.toLowerCase() !== wanted.toLowerCase()) return false;
    }
    if (!query) return true;
    return [
      product.name,
      product.brand,
      product.description,
      product.color ?? "",
      product.material,
    ].some((value) => value.toLowerCase().includes(query));
  });

  const results = filtered.map((product) =>
    normalizeProduct(
      {
        ID: product.id,
        Name: product.name,
        Description: product.description,
        Price: upstreamPrice(product),
        Brand: product.brand,
        Color: product.color ?? "",
        Material: product.material,
        Capacity: product.capacity ?? "",
        Stock: product.stock ?? 0,
        Category: product.category || "bags",
        Type: product.productType ?? "",
        Style: product.style ?? "",
        Gender: product.family ?? "",
        Status: upstreamStatus(product),
        Image: upstreamImage(product),
      },
      category
    )
  );

  return { total: results.length, results };
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
    if (body[apiKey] === undefined) body[apiKey] = value;
  }

  const res = await authedFetch("/api/v1/products", {
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
 * Upload a product image via
 * `POST /api/v1/products/{id}/images` (multipart field `image`).
 */
export async function uploadProductImage(
  productId: string,
  file: File
): Promise<void> {
  const form = new FormData();
  form.append("image", file, file.name);

  const res = await authedFetch(
    `/api/v1/products/${encodeURIComponent(productId)}/images`,
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
  // Storefront catalog is bags-only against dupli1-product.
  const { results } = await searchProducts("bags", query ? { query } : {});
  return results;
}

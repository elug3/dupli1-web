/**
 * Server-side client for the Dupli1 product service (elug3/dupli1).
 *
 * Public storefront reads:
 *   GET /api/v1/products?category=bags
 *   GET /api/v1/products/{id}
 *
 * Authenticated admin reads/writes are proxied separately via proxyProductApi.
 */

import "./tls-ca.server";

const API_PREFIX = "/api/v1";

export interface UpstreamVariant {
  sku: string;
  /** Canonical ULID from dupli1-product (`json:"skuId"`). */
  skuId?: string;
  color?: string;
  price: number;
  status: string;
}

export interface UpstreamProduct {
  id: string;
  name: string;
  description: string;
  /** Legacy mirror of cheapest active variant; prefer priceFrom. */
  price?: number;
  priceFrom?: number;
  sellingPrice?: number;
  sellingPriceFrom?: number;
  brand: string;
  color?: string;
  material: string;
  stock?: number;
  category: string;
  status?: string;
  imageUrls?: string[];
  defaultImageUrl?: string;
  availableColors?: string[];
  availableSizes?: string[];
  tags?: string[];
  createdAt?: string;
  capacity?: string;
  /** @deprecated Prefer subCategory (dupli1#128). */
  productType?: string;
  subCategory?: string;
  style?: string;
  /** @deprecated Prefer target (dupli1#128). */
  family?: string;
  target?: string;
  variants?: UpstreamVariant[];
}

export interface BagResponse {
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

export interface ProductResponse {
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
  // Sellable variant for cart/checkout — the storefront doesn't yet expose
  // a color/size picker, so it always adds the product's first active variant.
  sku: string;
  /** Canonical variant ULID when the product service returns it. */
  skuId?: string;
}

export interface SearchResult {
  ID: string;
  Name: string;
  Description: string;
  Price: number;
  Brand: string;
  Color: string;
  Material: string;
  Capacity: string;
  Stock: number;
  Category: string;
  Type: string;
  Style: string;
  Gender: string;
  Status: string;
  Image?: string;
}

const BAG_FILTERS = [
  "brand",
  "color",
  "material",
  "subcategory",
  "style",
  "target",
] as const;
/** Query params the product service filters / paginates on (dupli1#128 + rich search). */
const UPSTREAM_BAG_FILTERS = [
  "brand",
  "color",
  "material",
  "size",
  "tags",
  "subcategory",
  "subCategory",
  "style",
  "target",
  "sort",
  "order",
  "limit",
  "offset",
  "q",
  "period",
] as const;
const SUPPORTED_CATEGORIES = ["bags"] as const;

export function productApiBaseUrl(): string {
  return (
    process.env.DUPLI1_PRODUCT_API_BASE_URL ??
    process.env.DUPLI1_API_BASE_URL ??
    "http://localhost:8080"
  );
}

function upstreamUrl(path: string, searchParams?: URLSearchParams): string {
  const url = new URL(path, productApiBaseUrl());
  if (searchParams) url.search = searchParams.toString();
  return url.toString();
}

function firstImage(product: UpstreamProduct): string | undefined {
  if (product.defaultImageUrl?.trim()) return product.defaultImageUrl.trim();
  return product.imageUrls?.find((url) => url.trim().length > 0);
}

function productPrice(product: UpstreamProduct): number {
  return product.priceFrom ?? product.price ?? 0;
}

function mapDisplayStatus(status?: string, tags?: string[]): string {
  if (tags?.includes("new")) return "new";
  if (tags?.includes("hot") || tags?.includes("top")) return "featured";
  if (status === "active" || !status) return "standard";
  return status;
}

export function toBagResponse(product: UpstreamProduct): BagResponse {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: productPrice(product),
    brand: product.brand,
    color: product.color ?? "",
    material: product.material,
    capacity: product.capacity ?? "",
    stock: product.stock ?? 0,
    image: firstImage(product),
  };
}

function defaultVariant(product: UpstreamProduct): UpstreamVariant | undefined {
  return product.variants?.find((v) => v.status === "active") ?? product.variants?.[0];
}

function defaultVariantSku(product: UpstreamProduct): string {
  return defaultVariant(product)?.sku ?? product.id;
}

function defaultVariantSkuId(product: UpstreamProduct): string | undefined {
  return defaultVariant(product)?.skuId || undefined;
}

export function toProductResponse(product: UpstreamProduct): ProductResponse {
  const images = (product.imageUrls ?? []).filter((url) => url.trim().length > 0);
  if (images.length === 0 && product.defaultImageUrl?.trim()) {
    images.push(product.defaultImageUrl.trim());
  }

  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: productPrice(product),
    brand: product.brand,
    color: product.color ?? "",
    material: product.material,
    stock: product.stock ?? 0,
    sku: defaultVariantSku(product),
    skuId: defaultVariantSkuId(product),
    category: product.category || "bags",
    status: mapDisplayStatus(product.status, product.tags),
    image: images[0],
    images: images.length > 0 ? images : undefined,
    createdAt: product.createdAt ?? new Date(0).toISOString(),
  };
}

export function toSearchResult(product: UpstreamProduct): SearchResult {
  return {
    ID: product.id,
    Name: product.name,
    Description: product.description,
    Price: productPrice(product),
    Brand: product.brand,
    Color: product.color ?? "",
    Material: product.material,
    Capacity: product.capacity ?? "",
    Stock: product.stock ?? 0,
    Category: product.category || "bags",
    Type: product.subCategory ?? product.productType ?? "",
    Style: product.style ?? "",
    Gender: product.target ?? product.family ?? "",
    Status: mapDisplayStatus(product.status, product.tags),
    Image: firstImage(product),
  };
}

export function supportedCategories(): string[] {
  return [...SUPPORTED_CATEGORIES];
}

export function supportedFilters(category: string): string[] {
  if (!SUPPORTED_CATEGORIES.includes(category.toLowerCase() as (typeof SUPPORTED_CATEGORIES)[number])) {
    return [];
  }
  return [...BAG_FILTERS];
}

export async function fetchUpstreamBags(
  filters: Record<string, string> = {}
): Promise<UpstreamProduct[]> {
  // Public catalog search: GET /api/v1/products?category=bags
  // (the dedicated /products/bags alias was removed from dupli1-product).
  const params = new URLSearchParams({ category: "bags" });
  for (const key of UPSTREAM_BAG_FILTERS) {
    const value = filters[key]?.trim();
    if (value) params.set(key, value);
  }

  const response = await fetch(
    upstreamUrl(`${API_PREFIX}/products`, params),
    { headers: { Accept: "application/json" } }
  );

  if (!response.ok) {
    throw new Error(`Upstream bag search failed: ${response.status}`);
  }

  const body = (await response.json()) as {
    total?: number;
    results?: UpstreamProduct[] | null;
  };

  return body.results ?? [];
}

export async function fetchUpstreamProductById(
  id: string
): Promise<UpstreamProduct | null> {
  const response = await fetch(
    upstreamUrl(`${API_PREFIX}/products/${encodeURIComponent(id)}`),
    { headers: { Accept: "application/json" } }
  );

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Upstream product fetch failed: ${response.status}`);
  }

  return (await response.json()) as UpstreamProduct;
}

function getSearchableValue(product: UpstreamProduct, key: string): string {
  switch (key.toLowerCase()) {
    case "brand":
      return product.brand;
    case "color":
      return product.color ?? "";
    case "material":
      return product.material;
    case "producttype":
    case "product-type":
    case "type":
    case "subcategory":
      return product.subCategory ?? product.productType ?? "";
    case "style":
      return product.style ?? "";
    case "family":
    case "gender":
    case "target":
      return product.target ?? product.family ?? "";
    default:
      return "";
  }
}

export async function searchUpstreamProducts(
  params: URLSearchParams
): Promise<UpstreamProduct[]> {
  const category = params.get("category")?.toLowerCase();
  if (category && category !== "bags") return [];

  const query =
    params.get("q")?.trim().toLowerCase() ??
    params.get("query")?.trim().toLowerCase();
  const upstreamFilters: Record<string, string> = {};
  const localFilters: Array<[string, string]> = [];

  for (const [key, value] of params.entries()) {
    const normalizedValue = value.trim();
    if (
      !normalizedValue ||
      key === "category" ||
      key === "query" ||
      key === "q"
    ) {
      continue;
    }

    if (normalizedValue.toLowerCase() === "__no_match__") {
      return [];
    }

    if ((UPSTREAM_BAG_FILTERS as readonly string[]).includes(key)) {
      upstreamFilters[key] = normalizedValue;
      continue;
    }

    // Legacy storefront facet aliases — filter locally if still present.
    if ((BAG_FILTERS as readonly string[]).includes(key)) {
      localFilters.push([key, normalizedValue]);
    }
  }

  try {
    const products = await fetchUpstreamBags(upstreamFilters);

    return products.filter((product) => {
      for (const [key, normalizedValue] of localFilters) {
        const productValue = getSearchableValue(product, key);
        // Skip facets the catalog does not populate yet (would otherwise
        // empty every category page).
        if (!productValue) continue;
        if (productValue.toLowerCase() !== normalizedValue.toLowerCase()) {
          return false;
        }
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
  } catch {
    return [];
  }
}

/**
 * Server-side client for the Dupli1 product service (elug3/dupli1).
 *
 * Public storefront reads:
 *   GET /api/v1/products?category=bags
 *   GET /api/v1/products/{id}
 *
 * Authenticated admin reads/writes are proxied separately via proxyProductApi.
 */

const API_PREFIX = "/api/v1";

export interface UpstreamVariant {
  sku: string;
  color?: string;
  price: number;
  status: string;
}

export interface UpstreamProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  brand: string;
  color: string;
  material: string;
  stock: number;
  category: string;
  status?: string;
  imageUrls?: string[];
  tags?: string[];
  createdAt?: string;
  capacity?: string;
  productType?: string;
  style?: string;
  family?: string;
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
  // Sellable variant SKU for cart/checkout — the storefront doesn't yet expose
  // a color/size picker, so it always adds the product's first active variant.
  sku: string;
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
  "productType",
  "style",
  "family",
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

function firstImage(imageUrls?: string[]): string | undefined {
  return imageUrls?.find((url) => url.trim().length > 0);
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
    price: product.price,
    brand: product.brand,
    color: product.color,
    material: product.material,
    capacity: product.capacity ?? "",
    stock: product.stock,
    image: firstImage(product.imageUrls),
  };
}

function defaultVariantSku(product: UpstreamProduct): string {
  const active = product.variants?.find((v) => v.status === "active") ?? product.variants?.[0];
  return active?.sku ?? product.id;
}

export function toProductResponse(product: UpstreamProduct): ProductResponse {
  const images = (product.imageUrls ?? []).filter((url) => url.trim().length > 0);

  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    brand: product.brand,
    color: product.color,
    material: product.material,
    stock: product.stock,
    sku: defaultVariantSku(product),
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
    Price: product.price,
    Brand: product.brand,
    Color: product.color,
    Material: product.material,
    Capacity: product.capacity ?? "",
    Stock: product.stock,
    Category: product.category || "bags",
    Type: product.productType ?? "",
    Style: product.style ?? "",
    Gender: product.family ?? "",
    Status: mapDisplayStatus(product.status, product.tags),
    Image: firstImage(product.imageUrls),
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
  // The product service dropped the dedicated /products/bags list endpoint
  // in favor of a single filterable search: GET /api/v1/products.
  const params = new URLSearchParams({ category: "bags" });
  for (const key of BAG_FILTERS) {
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
      return product.color;
    case "material":
      return product.material;
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
}

export async function searchUpstreamProducts(
  params: URLSearchParams
): Promise<UpstreamProduct[]> {
  const category = params.get("category")?.toLowerCase();
  if (category && category !== "bags") return [];

  const query = params.get("query")?.trim().toLowerCase();
  const upstreamFilters: Record<string, string> = {};
  const localFilters: Array<[string, string]> = [];

  for (const [key, value] of params.entries()) {
    const normalizedValue = value.trim();
    if (!normalizedValue || key === "category" || key === "query") continue;

    if ((BAG_FILTERS as readonly string[]).includes(key)) {
      upstreamFilters[key] = normalizedValue;
      continue;
    }

    localFilters.push([key, normalizedValue]);
  }

  try {
    const products = await fetchUpstreamBags(upstreamFilters);

    return products.filter((product) => {
      for (const [key, normalizedValue] of localFilters) {
        if (normalizedValue.toLowerCase() === "__no_match__") return false;

        const productValue = getSearchableValue(product, key);
        if (productValue.toLowerCase() !== normalizedValue.toLowerCase()) {
          return false;
        }
      }

      if (!query) return true;

      return [
        product.name,
        product.brand,
        product.description,
        product.color,
        product.material,
      ].some((value) => value.toLowerCase().includes(query));
    });
  } catch {
    return [];
  }
}

/**
 * One listing photo per pictured category, filled when the server starts and
 * kept for a day. The menu and the home tiles read it from the root loader,
 * so a category photo is known before the shopper opens the drawer.
 *
 * A confirmed empty category is stored as null and the tile is hidden. A
 * failed lookup is left out, so a catalog blip does not wipe the menu, and
 * the next page retries only the paths that missed.
 */
import { listingProductImage } from "./api";
import {
  type NavImageMap,
  categoryImageQuery,
  picturedNavPaths,
} from "./nav";
import { productApiBaseUrl } from "./product-upstream.server";

/** How long a resolved category photo (or a confirmed empty category) is kept. */
export const NAV_IMAGE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** After a cold miss, don't hold the next document on another full wait. */
const NAV_IMAGE_RETRY_MS = 30_000;

const CATEGORY_IMAGE_TIMEOUT_MS = 2_500;

type Slot = { url: string | null; fetchedAt: number };

export type NavImageLoader = (to: string) => Promise<string | null>;

export function createNavImageCache(deps: {
  paths: () => string[];
  load: NavImageLoader;
  now?: () => number;
  ttlMs?: number;
  retryMs?: number;
}) {
  const now = deps.now ?? Date.now;
  const ttlMs = deps.ttlMs ?? NAV_IMAGE_CACHE_TTL_MS;
  const retryMs = deps.retryMs ?? NAV_IMAGE_RETRY_MS;
  const slots = new Map<string, Slot>();
  let inflight: Promise<NavImageMap> | null = null;
  // No attempt yet. A zero here would look recent next to Date.now() and
  // skip the first wait.
  let lastColdAttemptAt = Number.NEGATIVE_INFINITY;

  function snapshot(): NavImageMap {
    const images: NavImageMap = {};
    for (const [to, slot] of slots) images[to] = slot.url;
    return images;
  }

  function due(at: number): string[] {
    return deps.paths().filter((to) => {
      const slot = slots.get(to);
      return !slot || at - slot.fetchedAt >= ttlMs;
    });
  }

  async function refresh(pending: string[]): Promise<NavImageMap> {
    const at = now();
    await Promise.all(
      pending.map(async (to) => {
        try {
          slots.set(to, { url: await deps.load(to), fetchedAt: at });
        } catch {
          // Keep a previous photo through a blip. A path that has never
          // resolved stays absent so the menu does not treat a failure as
          // an empty category.
        }
      })
    );
    return snapshot();
  }

  function start(pending: string[]): Promise<NavImageMap> {
    if (pending.length === 0) return Promise.resolve(snapshot());
    if (!inflight) {
      inflight = refresh(pending).finally(() => {
        inflight = null;
      });
    }
    return inflight;
  }

  /** Fill anything older than a day. Safe to call at process start. */
  function warm(): Promise<NavImageMap> {
    return start(due(now()));
  }

  /**
   * Photos for the document. Waits on the first fill (and on a startup warm
   * already in flight) so the HTML can omit empty categories. Later reads
   * return what is stored and refresh expired paths in the background.
   */
  function read(): Promise<NavImageMap> {
    const at = now();
    const pending = due(at);
    if (pending.length === 0) return Promise.resolve(snapshot());
    // Serve a photo we already have, or skip the wait when the catalog just
    // failed. Expired paths refresh behind that response.
    if (slots.size > 0 || at - lastColdAttemptAt < retryMs) {
      if (!inflight) void start(pending);
      return Promise.resolve(snapshot());
    }
    if (inflight) return inflight;
    lastColdAttemptAt = at;
    return start(pending);
  }

  return { warm, read };
}

interface ListedProduct {
  category?: string;
  brand?: string;
  defaultListingImageUrl?: string;
  defaultImageUrl?: string;
  imageUrls?: string[];
}

function listingUrl(product: ListedProduct, fallbackCategory: string): string {
  const image =
    product.defaultListingImageUrl?.trim() ||
    product.defaultImageUrl?.trim() ||
    product.imageUrls?.find((url) => url.trim())?.trim();
  return listingProductImage(product.category || fallbackCategory, product.brand ?? "", image);
}

/** Most-viewed product photo for one category path. Null when it has no product. */
export async function fetchMostViewedCategoryImage(to: string): Promise<string | null> {
  const query = categoryImageQuery(to);
  if (!query) return null;
  if (Object.values(query).some((value) => String(value).trim().toLowerCase() === "__no_match__")) {
    return null;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    const trimmed = String(value).trim();
    if (trimmed) params.set(key, trimmed);
  }

  const url = new URL("/api/v1/products", productApiBaseUrl());
  url.search = params.toString();
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(CATEGORY_IMAGE_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`category image lookup failed: ${response.status}`);
  }

  const body = (await response.json()) as { results?: ListedProduct[] | null };
  const product = Array.isArray(body.results) ? body.results[0] : undefined;
  if (!product) return null;
  return listingUrl(product, query.category ?? "bags");
}

type NavImageCache = ReturnType<typeof createNavImageCache>;

declare global {
  var __dupli1NavImageCache: NavImageCache | undefined;
}

function navImageCache(): NavImageCache {
  if (!globalThis.__dupli1NavImageCache) {
    globalThis.__dupli1NavImageCache = createNavImageCache({
      paths: picturedNavPaths,
      load: fetchMostViewedCategoryImage,
    });
  }
  return globalThis.__dupli1NavImageCache;
}

/** Start the day cache. Called from the server entry so it runs at boot. */
export function warmNavImageCache(): Promise<NavImageMap> {
  return navImageCache().warm();
}

/** Category photos for the root loader. Never rejects. */
export function readNavImages(): Promise<NavImageMap> {
  return navImageCache()
    .read()
    .catch(() => ({}));
}

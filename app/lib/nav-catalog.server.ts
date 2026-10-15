/**
 * Menu-category snapshot, warmed when the server process starts.
 *
 * The home tiles and the menu drawer need two things before first paint:
 * which categories actually have products, and the listing photo for each
 * one that does. Both come from the product service. Waiting until a tile
 * mounts meant an empty grey square — either because the category is empty,
 * or because the photo had not been fetched yet.
 *
 * Startup kicks this off (see entry.server). The root loader reuses the
 * same promise, so a request that arrives mid-warm waits briefly instead of
 * starting a second sweep. Product-photo bytes are kept in memory and served
 * from `/media/nav-image`, which is same-origin and cacheable.
 */
import { productApiBaseUrl } from "./product-upstream.server";
import {
  type NavShelf,
  isCatalogProductImage,
  isNavPath,
  navCategoryQuery,
  navPaths,
  shelfFromProduct,
} from "./nav";

/** How long a swept snapshot is reused before the next request refreshes it. */
export const NAV_CATALOG_TTL_MS = 60_000;

/** Cap so a quiet catalog cannot hold up the document. */
const PAGE_WAIT_MS = 2_500;

/** Listing thumbs are small; refuse anything that does not look like one. */
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

interface CatalogHit {
  brand?: string;
  category?: string;
  defaultListingImageUrl?: string;
  defaultImageUrl?: string;
  imageUrls?: string[];
}

interface StoredImage {
  body: Uint8Array;
  contentType: string;
  sourceUrl: string;
}

export interface CachedNavImage {
  body: Uint8Array;
  contentType: string;
}

let generation = 0;
let stored: Record<string, NavShelf> | null = null;
let storedAt = 0;
let current: Promise<Record<string, NavShelf>> | null = null;
const images = new Map<string, StoredImage>();
const inflight = new Map<string, Promise<StoredImage | null>>();

/** Begin the sweep. Safe to call more than once; a fresh snapshot is reused. */
export function startNavCatalog(): void {
  void ensureWarm();
}

/**
 * Categories for the document. A fresh snapshot returns immediately. The
 * first sweep waits up to `waitMs`, then gives the page an empty map so a
 * down catalog cannot stall HTML — the browser fills the gaps itself.
 */
export function loadNavCatalog(waitMs = PAGE_WAIT_MS): Promise<Record<string, NavShelf>> {
  if (stored && Date.now() - storedAt < NAV_CATALOG_TTL_MS) return Promise.resolve(stored);
  if (stored) {
    void ensureWarm();
    return Promise.resolve(stored);
  }
  return withTimeout(ensureWarm(), waitMs, {});
}

/** Bytes for one menu photo, or null when that category has nothing to serve. */
export async function readCachedNavImage(to: string): Promise<CachedNavImage | null> {
  if (!isNavPath(to)) return null;
  const shelves = await loadNavCatalog();
  const image = shelves[to]?.status === "stocked" ? shelves[to].image : null;
  if (!image || !isCatalogProductImage(image)) return null;
  const sourceUrl = absoluteCatalogUrl(image);
  const hit = images.get(to);
  if (hit?.sourceUrl === sourceUrl) return hit;
  return download(to, sourceUrl);
}

/** Test hook: forget the snapshot and any cached bytes. */
export function clearNavCatalogForTests(): void {
  generation += 1;
  current = null;
  stored = null;
  storedAt = 0;
  images.clear();
  inflight.clear();
}

function ensureWarm(): Promise<Record<string, NavShelf>> {
  if (current) return current;
  const gen = generation;
  current = fetchAll()
    .then((shelves) => {
      if (gen !== generation) return stored ?? {};
      stored = shelves;
      storedAt = Date.now();
      cacheImages(shelves, gen);
      return shelves;
    })
    .finally(() => {
      if (gen === generation) current = null;
    });
  return current;
}

async function fetchAll(): Promise<Record<string, NavShelf>> {
  const entries = await Promise.all(
    navPaths().map(async (to) => [to, await fetchShelf(to)] as const)
  );
  return Object.fromEntries(entries);
}

async function fetchShelf(to: string): Promise<NavShelf> {
  const query = navCategoryQuery(to);
  if (!query) return { status: "empty", image: null };

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }

  try {
    const response = await fetch(new URL(`/api/v1/products?${params}`, productApiBaseUrl()), {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return { status: "unknown", image: null };
    const data = (await response.json()) as { results?: CatalogHit[] | null };
    const product = data.results?.[0];
    if (!product) return { status: "empty", image: null };
    return shelfFromProduct({
      category: product.category?.trim() || "bags",
      brand: product.brand?.trim() || "",
      image: listingUrl(product),
    });
  } catch {
    return { status: "unknown", image: null };
  }
}

function listingUrl(product: CatalogHit): string | undefined {
  const listing = product.defaultListingImageUrl?.trim();
  if (listing) return listing;
  const full = product.defaultImageUrl?.trim();
  if (full) return full;
  return product.imageUrls?.find((url) => url.trim().length > 0)?.trim();
}

function cacheImages(shelves: Record<string, NavShelf>, gen: number): void {
  for (const [to, shelf] of Object.entries(shelves)) {
    if (shelf.status !== "stocked" || !shelf.image || !isCatalogProductImage(shelf.image)) {
      if (gen === generation) images.delete(to);
      continue;
    }
    void download(to, absoluteCatalogUrl(shelf.image));
  }
}

function download(to: string, sourceUrl: string): Promise<StoredImage | null> {
  const key = `${to}\0${sourceUrl}`;
  const pending = inflight.get(key);
  if (pending) return pending;

  const gen = generation;
  const task = fetch(sourceUrl, { headers: { Accept: "image/*" } })
    .then(async (response) => {
      if (!response.ok) return null;
      const rawType = response.headers.get("content-type") ?? "";
      if (rawType && !rawType.startsWith("image/")) return null;
      const advertised = Number(response.headers.get("content-length") ?? "0");
      if (Number.isFinite(advertised) && advertised > MAX_IMAGE_BYTES) return null;
      const body = new Uint8Array(await response.arrayBuffer());
      if (body.byteLength === 0 || body.byteLength > MAX_IMAGE_BYTES) return null;
      if (gen !== generation) return null;
      const storedImage: StoredImage = {
        body,
        contentType: rawType.split(";")[0] || "image/jpeg",
        sourceUrl,
      };
      images.set(to, storedImage);
      return storedImage;
    })
    .catch(() => null)
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, task);
  return task;
}

function absoluteCatalogUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return new URL(url, productApiBaseUrl()).toString();
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      }
    );
  });
}

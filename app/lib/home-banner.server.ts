/**
 * Reads the live home banner for the document, cached for a minute like the
 * service's own `Cache-Control`. A slow or failing product service never
 * holds up the page: the home page then shows its built-in video.
 */
import { type HomeBanner, pickHomeBanner } from "./home-banner";
import { productApiBaseUrl } from "./product-upstream.server";

const TTL_MS = 60_000;
const WAIT_MS = 1_500;

let stored: HomeBanner | null = null;
let storedAt = 0;
let current: Promise<HomeBanner | null> | null = null;

async function fetchBanner(): Promise<HomeBanner | null> {
  const url = new URL("/api/v1/products/banners", productApiBaseUrl());
  url.searchParams.set("placement", "home_hero");
  const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  if (!res.ok) throw new Error(`banners: ${res.status}`);
  return pickHomeBanner(await res.json());
}

function refresh(): Promise<HomeBanner | null> {
  if (!current) {
    current = fetchBanner()
      .then((banner) => {
        stored = banner;
        storedAt = Date.now();
        return banner;
      })
      .catch(() => stored)
      .finally(() => {
        current = null;
      });
  }
  return current;
}

export function loadHomeBanner(): Promise<HomeBanner | null> {
  if (storedAt && Date.now() - storedAt < TTL_MS) return Promise.resolve(stored);
  const pending = refresh();
  if (storedAt) return Promise.resolve(stored);
  return Promise.race([
    pending,
    new Promise<HomeBanner | null>((resolve) => setTimeout(() => resolve(null), WAIT_MS)),
  ]);
}

/** Test hook. */
export function resetHomeBannerCache(): void {
  stored = null;
  storedAt = 0;
  current = null;
}

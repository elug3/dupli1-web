import { afterEach, describe, expect, it, vi } from "vitest";
import type { LoaderFunctionArgs } from "react-router";

import {
  NAV_CATALOG_TTL_MS,
  clearNavCatalogForTests,
  loadNavCatalog,
  readCachedNavImage,
} from "./nav-catalog.server";
import { loader as navImageLoader } from "~/routes/media/nav-image";

const JACKETS = "/category/product-type/jackets";
const HANDBAGS = "/category/product-type/handbags";
const IMAGE = "http://localhost:8080/product-images/p.jpg";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function catalogFetch(emptyJackets = true) {
  return vi.fn(async (url: string) => {
    const href = String(url);
    if (href.includes("/product-images/")) {
      return new Response(Uint8Array.from([1, 2, 3, 4]), {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      });
    }
    const empty = emptyJackets && href.includes("subcategory=jackets") && !href.includes("padded");
    return json({
      results: empty
        ? []
        : [
            {
              id: "p",
              name: "Bag",
              description: "",
              brand: "Prada",
              material: "leather",
              category: href.includes("category=clothing") ? "clothing" : "bags",
              defaultListingImageUrl: IMAGE,
            },
          ],
    });
  });
}

afterEach(() => {
  clearNavCatalogForTests();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("startup nav catalog", () => {
  it("warms every menu category and caches product image bytes", async () => {
    const fetchMock = catalogFetch();
    vi.stubGlobal("fetch", fetchMock);

    const shelves = await loadNavCatalog(5_000);

    expect(shelves[JACKETS]).toEqual({ status: "empty", image: null });
    expect(shelves[HANDBAGS]).toMatchObject({ status: "stocked", image: IMAGE });

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes("category=clothing") && url.includes("subcategory=jackets"))).toBe(
      true
    );
    expect(urls.some((url) => url.includes("category=clothing") && url.includes("subcategory=padded"))).toBe(
      true
    );
    expect(urls.some((url) => url.includes("category=bags") && url.includes("subcategory=handbags"))).toBe(
      true
    );

    const cached = await readCachedNavImage(HANDBAGS);
    expect(cached?.contentType).toBe("image/jpeg");
    expect(cached?.body).toEqual(Uint8Array.from([1, 2, 3, 4]));

    const callsAfter = fetchMock.mock.calls.length;
    expect(await readCachedNavImage(HANDBAGS)).toBe(cached);
    expect(fetchMock.mock.calls.length).toBe(callsAfter);
    expect(await readCachedNavImage("/not-a-menu")).toBeNull();
    expect(await readCachedNavImage(JACKETS)).toBeNull();
  });

  it("reuses a fresh snapshot and sweeps again after the ttl", async () => {
    const fetchMock = catalogFetch();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(Date, "now").mockReturnValue(1_000);

    const first = await loadNavCatalog(5_000);
    const searches = () =>
      fetchMock.mock.calls.filter((call) => String(call[0]).includes("/api/v1/products")).length;
    const afterFirst = searches();

    expect(await loadNavCatalog(5_000)).toBe(first);
    expect(searches()).toBe(afterFirst);

    vi.spyOn(Date, "now").mockReturnValue(1_000 + NAV_CATALOG_TTL_MS);
    expect(await loadNavCatalog(5_000)).toBe(first);
    await vi.waitFor(() => expect(searches()).toBeGreaterThan(afterFirst));
  });

  it("keeps every menu when the catalog is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 502 })));

    const shelves = await loadNavCatalog(5_000);

    expect(shelves[HANDBAGS]).toEqual({ status: "unknown", image: null });
    expect(shelves[JACKETS]).toEqual({ status: "unknown", image: null });
    expect(await readCachedNavImage(HANDBAGS)).toBeNull();
  });

  it("does not hold the page for a catalog that never answers", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));

    await expect(loadNavCatalog(30)).resolves.toEqual({});
  });

  it("serves cached bytes from the media route and does not cache a miss", async () => {
    vi.stubGlobal("fetch", catalogFetch());
    await loadNavCatalog(5_000);

    const hit = await navImageLoader({
      request: new Request(`http://localhost/media/nav-image?to=${encodeURIComponent(HANDBAGS)}`),
      params: {},
      context: {},
    } as LoaderFunctionArgs);
    expect(hit.status).toBe(200);
    expect(hit.headers.get("Content-Type")).toBe("image/jpeg");
    expect(hit.headers.get("Cache-Control")).toBe("public, max-age=60");
    expect(new Uint8Array(await hit.arrayBuffer())).toEqual(Uint8Array.from([1, 2, 3, 4]));

    const miss = await navImageLoader({
      request: new Request(`http://localhost/media/nav-image?to=${encodeURIComponent(JACKETS)}`),
      params: {},
      context: {},
    } as LoaderFunctionArgs);
    expect(miss.status).toBe(404);
    expect(miss.headers.get("Cache-Control")).toBe("no-store");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createNavImageCache,
  fetchMostViewedCategoryImage,
} from "./nav-image-cache.server";

const JACKETS = "/category/product-type/jackets";
const PADDED = "/category/product-type/padded-jackets";

describe("nav image cache", () => {
  it("loads one image per category and keeps it for a day", async () => {
    let now = 1_000_000;
    const loads: string[] = [];
    const cache = createNavImageCache({
      paths: () => [JACKETS, PADDED],
      load: async (to) => {
        loads.push(to);
        return to === PADDED ? "https://cdn.example/padded.jpg" : null;
      },
      now: () => now,
      ttlMs: 1_000,
    });

    expect(await cache.warm()).toEqual({
      [JACKETS]: null,
      [PADDED]: "https://cdn.example/padded.jpg",
    });
    expect(await cache.read()).toEqual({
      [JACKETS]: null,
      [PADDED]: "https://cdn.example/padded.jpg",
    });
    expect(loads).toEqual([JACKETS, PADDED]);

    now += 1_000;
    const again = cache.read();
    expect(await again).toEqual({
      [JACKETS]: null,
      [PADDED]: "https://cdn.example/padded.jpg",
    });
    await cache.warm();
    expect(loads).toEqual([JACKETS, PADDED, JACKETS, PADDED]);
  });

  it("retries a failed category without dropping one that succeeded", async () => {
    let now = 5_000;
    let paddedDown = true;
    const loads: string[] = [];
    const cache = createNavImageCache({
      paths: () => [JACKETS, PADDED],
      load: async (to) => {
        loads.push(to);
        if (to === PADDED && paddedDown) throw new Error("catalog down");
        return to === PADDED ? "https://cdn.example/padded.jpg" : null;
      },
      now: () => now,
      ttlMs: 10_000,
      retryMs: 30_000,
    });

    expect(await cache.warm()).toEqual({ [JACKETS]: null });
    paddedDown = false;
    now += 1;
    expect(await cache.warm()).toEqual({
      [JACKETS]: null,
      [PADDED]: "https://cdn.example/padded.jpg",
    });
    expect(loads.filter((to) => to === JACKETS)).toEqual([JACKETS]);
    expect(loads.filter((to) => to === PADDED)).toEqual([PADDED, PADDED]);
  });

  it("does not hold later documents on a catalog that just failed", async () => {
    let calls = 0;
    let release: (value: string | null) => void = () => {};
    const cache = createNavImageCache({
      paths: () => [JACKETS],
      load: () => {
        calls += 1;
        if (calls === 1) return Promise.reject(new Error("down"));
        return new Promise((resolve) => {
          release = resolve;
        });
      },
      now: () => 10_000,
      retryMs: 30_000,
    });

    expect(await cache.read()).toEqual({});
    const second = cache.read();
    const quick = await Promise.race([
      second.then(() => "done"),
      new Promise((resolve) => setTimeout(() => resolve("slow"), 50)),
    ]);
    expect(quick).toBe("done");
    expect(await second).toEqual({});
    release(null);
  });
});

describe("fetchMostViewedCategoryImage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests the most-viewed product and uses its listing image", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(String(url));
        return new Response(
          JSON.stringify({
            results: [
              {
                category: "clothing",
                brand: "Prada",
                defaultImageUrl: "https://cdn.example/full.jpg",
                defaultListingImageUrl: "https://cdn.example/full.w600.jpg",
              },
            ],
          })
        );
      })
    );

    await expect(fetchMostViewedCategoryImage(JACKETS)).resolves.toBe(
      "https://cdn.example/full.w600.jpg"
    );
    const url = new URL(urls[0]);
    expect(url.pathname).toBe("/api/v1/products");
    expect(url.searchParams.get("category")).toBe("clothing");
    expect(url.searchParams.get("subcategory")).toBe("jackets");
    expect(url.searchParams.get("sort")).toBe("views");
    expect(url.searchParams.get("limit")).toBe("1");
  });

  it("returns null when the category has no product", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ results: [] })))
    );
    await expect(fetchMostViewedCategoryImage(JACKETS)).resolves.toBeNull();
  });

  it("throws when the catalog rejects the lookup", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 502 })));
    await expect(fetchMostViewedCategoryImage(JACKETS)).rejects.toThrow(/502/);
  });
});

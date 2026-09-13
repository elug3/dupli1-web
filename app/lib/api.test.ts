import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchBags, fetchRecommendations, searchProducts } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchRecommendations", () => {
  it("maps upstream items to bags and forwards the limit query", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe("/api/v1/products/SEED/recommendations?limit=4");
      return new Response(
        JSON.stringify({
          seedId: "SEED",
          items: [
            {
              id: "p1",
              name: "Prada Galleria",
              description: "Classic leather",
              price: 480000,
              officialPrice: 5350000,
              brand: "Prada",
              material: "Leather",
              category: "bags",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const bags = await fetchRecommendations("SEED", 4);

    expect(bags).toHaveLength(1);
    expect(bags[0]).toMatchObject({
      id: "p1",
      name: "Prada Galleria",
      price: 480000,
      officialPrice: 5350000,
      brand: "Prada",
    });
  });

  it("returns an empty list when the API is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("upstream error", { status: 502 }))
    );

    await expect(fetchRecommendations("MISSING")).resolves.toEqual([]);
  });

  it("returns an empty list when items is null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ seedId: "SEED", items: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    await expect(fetchRecommendations("SEED")).resolves.toEqual([]);
  });
});

describe("listing image mapping", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubProductSearch(products: Record<string, unknown>[]) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        expect(url).toMatch(/^\/api\/v1\/products\?/);
        return new Response(JSON.stringify({ results: products }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      })
    );
  }

  it("fetchBags prefers defaultListingImageUrl over full-size images", async () => {
    stubProductSearch([
      {
        id: "p1",
        name: "Eco Bag",
        description: "Mock",
        price: 100,
        brand: "Dupli1",
        material: "Canvas",
        defaultImageUrl: "http://localhost:8080/product-images/p1/full.jpg",
        defaultListingImageUrl:
          "http://localhost:8080/product-images/p1/full.w600.jpg",
      },
    ]);

    const bags = await fetchBags();
    expect(bags[0]?.image).toBe(
      "http://localhost:8080/product-images/p1/full.w600.jpg"
    );
  });

  it("fetchBags falls back to defaultImageUrl when listing thumb is absent", async () => {
    stubProductSearch([
      {
        id: "p1",
        name: "Legacy Bag",
        description: "No thumb",
        price: 100,
        brand: "Dupli1",
        material: "Canvas",
        defaultImageUrl: "http://localhost:8080/product-images/p1/full.jpg",
      },
    ]);

    const bags = await fetchBags();
    expect(bags[0]?.image).toBe(
      "http://localhost:8080/product-images/p1/full.jpg"
    );
  });

  it("searchProducts maps listing thumbs into DisplayProduct.Image", async () => {
    stubProductSearch([
      {
        id: "p1",
        name: "Grid Bag",
        description: "Category card",
        price: 480000,
        brand: "Prada",
        material: "Leather",
        category: "bags",
        defaultImageUrl: "http://localhost:8080/product-images/p1/full.jpg",
        defaultListingImageUrl:
          "http://localhost:8080/product-images/p1/full.w600.jpg",
      },
    ]);

    const { results } = await searchProducts("bags");
    expect(results[0]?.image).toBe(
      "http://localhost:8080/product-images/p1/full.w600.jpg"
    );
  });
});

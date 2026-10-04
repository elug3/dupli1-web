import { afterEach, describe, expect, it, vi } from "vitest";

import {
  bagImage,
  fetchBags,
  fetchProduct,
  fetchRecommendations,
  productImage,
  searchProducts,
} from "./api";
import { buildCategorySearchParams, categoryForFacet } from "./catalog";

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

describe("category-aware product search", () => {
  function stubSearch() {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(url);
        return new Response(JSON.stringify({ total: 0, results: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      })
    );
    return urls;
  }

  it("keeps the bag listing query exactly as it was", async () => {
    const urls = stubSearch();
    await searchProducts("bags", buildCategorySearchParams("product-type", "totes"));
    await fetchBags();
    await fetchBags({ q: "galleria", limit: 6 });
    expect(urls).toEqual([
      "/api/v1/products?category=bags&subcategory=tote",
      "/api/v1/products?category=bags",
      "/api/v1/products?category=bags&q=galleria&limit=6",
    ]);
  });

  it("lists padded jackets from clothing", async () => {
    const urls = stubSearch();
    await searchProducts(
      categoryForFacet("product-type", "padded-jackets"),
      buildCategorySearchParams("product-type", "padded-jackets")
    );
    await fetchBags({ category: "clothing", subcategory: "padded", sort: "views", limit: 1 });
    expect(urls).toEqual([
      "/api/v1/products?category=clothing&subcategory=padded",
      "/api/v1/products?category=clothing&subcategory=padded&sort=views&limit=1",
    ]);
  });

  it("returns nothing for a category the storefront does not sell", async () => {
    const urls = stubSearch();
    await expect(searchProducts("watches")).resolves.toEqual({ total: 0, results: [] });
    expect(urls).toEqual([]);
  });
});

describe("fetchProduct clothing fields", () => {
  it("maps attributes and a sorted size chart", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            id: "j1",
            name: "Down Jacket",
            description: "",
            price: 390000,
            brand: "Moncler",
            material: "",
            category: "clothing",
            attributes: { fill: "90% duck down", lining: "Nylon" },
            sizeChart: [
              { size: "L", chestCm: 62, lengthCm: 72 },
              { size: "xs", chestCm: 53 },
              { size: "M", chestCm: 59.5, lengthCm: 70 },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    const product = await fetchProduct("j1");
    expect(product.category).toBe("clothing");
    expect(product.attributes).toEqual({ fill: "90% duck down", lining: "Nylon" });
    expect(product.sizeChart?.map((row) => row.size)).toEqual(["XS", "M", "L"]);
  });

  it("leaves sizeChart and attributes off a bag without them", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            id: "b1",
            name: "Galleria",
            description: "",
            price: 480000,
            brand: "Prada",
            material: "Leather",
            category: "bags",
            attributes: {},
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    const product = await fetchProduct("b1");
    expect(product.sizeChart).toBeUndefined();
    expect(product.attributes).toBeUndefined();
  });
});

describe("productImage fallback", () => {
  it("gives clothing the outerwear picture, bags a bag", () => {
    expect(productImage("clothing", "Moncler")).toBe(productImage("outerwear", "Moncler"));
    expect(productImage("clothing", "Moncler")).not.toBe(productImage("bags", "Moncler"));
    expect(productImage("bags", "Prada")).toBe(bagImage("Prada"));
  });
});

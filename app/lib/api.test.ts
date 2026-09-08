import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchRecommendations } from "./api";

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

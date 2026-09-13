import { describe, expect, it } from "vitest";

import { toBagResponse, type UpstreamProduct } from "./product-upstream.server";

function product(partial: Partial<UpstreamProduct>): UpstreamProduct {
  return {
    id: "p1",
    name: "Eco Bag",
    description: "Mock",
    brand: "Dupli1",
    material: "Canvas",
    category: "bags",
    ...partial,
  };
}

describe("toBagResponse listing image", () => {
  it("prefers defaultListingImageUrl for SSR bag cards", () => {
    const bag = toBagResponse(
      product({
        defaultImageUrl: "http://localhost:8080/product-images/p1/full.jpg",
        defaultListingImageUrl:
          "http://localhost:8080/product-images/p1/full.w600.jpg",
      })
    );
    expect(bag.image).toBe(
      "http://localhost:8080/product-images/p1/full.w600.jpg"
    );
  });

  it("falls back to defaultImageUrl when listing thumb is missing", () => {
    const bag = toBagResponse(
      product({
        defaultImageUrl: "http://localhost:8080/product-images/p1/full.jpg",
      })
    );
    expect(bag.image).toBe(
      "http://localhost:8080/product-images/p1/full.jpg"
    );
  });
});

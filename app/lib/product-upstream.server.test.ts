import { describe, expect, it } from "vitest";

import {
  toBagResponse,
  toProductResponse,
  type UpstreamProduct,
} from "./product-upstream.server";

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

describe("toProductResponse dimensions", () => {
  it("carries the default variant's dimensions in millimeters", () => {
    const res = toProductResponse(
      product({
        variants: [
          { sku: "draft", status: "draft", dimensions: { widthMm: 1 } },
          {
            sku: "active",
            status: "active",
            dimensions: { widthMm: 340, heightMm: 220, depthMm: 0 },
          },
        ],
      })
    );
    expect(res.dimensions).toEqual({ widthMm: 340, heightMm: 220 });
  });

  it("omits dimensions the SKU does not have", () => {
    const res = toProductResponse(
      product({ variants: [{ sku: "active", status: "active" }] })
    );
    expect(res.dimensions).toBeUndefined();
  });
});

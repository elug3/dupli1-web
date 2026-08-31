import { describe, expect, it } from "vitest";
import {
  hasSellableVariant,
  inventoryAvailableFromBody,
  isProductInStock,
  resolveEmbeddedStock,
} from "./product-stock";

describe("resolveEmbeddedStock", () => {
  it("prefers numeric availableQty", () => {
    expect(resolveEmbeddedStock({ availableQty: 3, inStock: false })).toBe(3);
  });

  it("maps inStock true to 1 when qty omitted", () => {
    expect(resolveEmbeddedStock({ inStock: true })).toBe(1);
  });

  it("maps inStock false to 0 when qty omitted", () => {
    expect(resolveEmbeddedStock({ inStock: false })).toBe(0);
  });

  it("returns null when stock fields omitted (poll fallback)", () => {
    expect(resolveEmbeddedStock({})).toBeNull();
  });
});

describe("hasSellableVariant", () => {
  it("accepts skuId", () => {
    expect(hasSellableVariant({ skuId: "01ABC", sku: "" })).toBe(true);
  });

  it("accepts non-empty sku", () => {
    expect(hasSellableVariant({ sku: "BOT-001-GRN" })).toBe(true);
  });

  it("rejects parent-only product (no variant ref)", () => {
    expect(hasSellableVariant({ sku: "", skuId: undefined })).toBe(false);
    expect(hasSellableVariant({ sku: "   " })).toBe(false);
  });
});

describe("isProductInStock", () => {
  it("requires sellable variant and positive available", () => {
    expect(
      isProductInStock({ sku: "BOT-001-GRN", skuId: "ID-1" }, 2)
    ).toBe(true);
  });

  it("treats zero available as OOS (always-tracked)", () => {
    expect(
      isProductInStock({ sku: "BOT-001-GRN", skuId: "ID-1" }, 0)
    ).toBe(false);
  });

  it("treats unknown stock (null) as OOS", () => {
    expect(isProductInStock({ sku: "BOT-001-GRN" }, null)).toBe(false);
  });

  it("rejects parent id without variant even when stock positive", () => {
    expect(isProductInStock({ sku: "" }, 5)).toBe(false);
  });
});

describe("inventoryAvailableFromBody", () => {
  it("subtracts reserved and floors at zero", () => {
    expect(inventoryAvailableFromBody({ quantity: 10, reserved: 3 })).toBe(7);
    expect(inventoryAvailableFromBody({ quantity: 2, reserved: 5 })).toBe(0);
  });
});

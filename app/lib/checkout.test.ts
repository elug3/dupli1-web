import { describe, expect, it } from "vitest";
import {
  buildCheckoutSessionItem,
  cartHasUnpurchasableItems,
  getUnpurchasableCartItems,
  isCheckoutLineUnpurchasable,
  isLegacyProductIdSku,
  isUnpurchasableVariantError,
  resolveCheckoutVariantRef,
} from "./checkout";

describe("isUnpurchasableVariantError", () => {
  it("matches order service variant-not-found wording", () => {
    expect(isUnpurchasableVariantError("variant not found")).toBe(true);
    expect(isUnpurchasableVariantError("  Variant Not Found  ")).toBe(true);
  });

  it("rejects unrelated checkout errors", () => {
    expect(isUnpurchasableVariantError("invalid fulfillment")).toBe(false);
    expect(isUnpurchasableVariantError("")).toBe(false);
  });
});

describe("isLegacyProductIdSku", () => {
  it("detects parent product id stored as sku", () => {
    expect(isLegacyProductIdSku("01JABC123", "01jabc123")).toBe(true);
  });

  it("allows real variant skus", () => {
    expect(isLegacyProductIdSku("PRADA_GALLERIA_BLACK_M", "01JABC123")).toBe(false);
  });

  it("returns false when ids are missing", () => {
    expect(isLegacyProductIdSku(undefined, "01JABC123")).toBe(false);
    expect(isLegacyProductIdSku("SKU-1", undefined)).toBe(false);
  });
});

describe("resolveCheckoutVariantRef", () => {
  it("prefers canonical sku_id", () => {
    expect(
      resolveCheckoutVariantRef({
        skuId: "01VARIANT",
        sku: "01PARENT",
        productId: "01PARENT",
      })
    ).toEqual({ sku_id: "01VARIANT" });
  });

  it("includes human sku when not a legacy parent id", () => {
    expect(
      resolveCheckoutVariantRef({
        skuId: "01VARIANT",
        sku: "PRADA_GALLERIA_BLACK_M",
        productId: "01PARENT",
      })
    ).toEqual({ sku_id: "01VARIANT", sku: "PRADA_GALLERIA_BLACK_M" });
  });

  it("falls back to human sku when sku_id is absent", () => {
    expect(resolveCheckoutVariantRef({ sku: "prada_black_m" })).toEqual({
      sku: "PRADA_BLACK_M",
    });
  });

  it("returns empty ref for legacy parent-id sku", () => {
    expect(
      resolveCheckoutVariantRef({ sku: "01PARENT", productId: "01PARENT" })
    ).toEqual({});
  });
});

describe("unpurchasable cart detection", () => {
  const sellable = { skuId: "01VARIANT", sku: "PRADA_GALLERIA_BLACK_M" };
  const legacy = { sku: "01PARENT", productId: "01PARENT" };
  const empty = { sku: "", skuId: "" };

  it("flags legacy and empty lines", () => {
    expect(isCheckoutLineUnpurchasable(sellable)).toBe(false);
    expect(isCheckoutLineUnpurchasable(legacy)).toBe(true);
    expect(isCheckoutLineUnpurchasable(empty)).toBe(true);
  });

  it("collects unpurchasable lines for modal display", () => {
    const items = [sellable, legacy, empty];
    expect(getUnpurchasableCartItems(items)).toEqual([legacy, empty]);
    expect(cartHasUnpurchasableItems(items)).toBe(true);
    expect(cartHasUnpurchasableItems([sellable])).toBe(false);
  });

  it("builds session payload only for sellable refs", () => {
    expect(buildCheckoutSessionItem({ ...sellable, quantity: 2 })).toEqual({
      sku_id: "01VARIANT",
      sku: "PRADA_GALLERIA_BLACK_M",
      quantity: 2,
    });
    expect(buildCheckoutSessionItem({ ...legacy, quantity: 1 })).toEqual({
      quantity: 1,
    });
  });
});

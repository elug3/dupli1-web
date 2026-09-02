import { describe, expect, it } from "vitest";
import {
  buildCheckoutFulfillment,
  buildCheckoutSessionItem,
  cartHasUnpurchasableItems,
  getUnpurchasableCartItems,
  isCheckoutLineUnpurchasable,
  isLegacyProductIdSku,
  isUnpurchasableVariantError,
  isValidPCCC,
  normalizePCCC,
  resolveCheckoutVariantRef,
} from "./checkout";

describe("isUnpurchasableVariantError", () => {
  it("matches variant not found messages", () => {
    expect(isUnpurchasableVariantError("variant not found")).toBe(true);
    expect(isUnpurchasableVariantError("  Variant Not Found  ")).toBe(true);
  });

  it("rejects unrelated errors", () => {
    expect(isUnpurchasableVariantError("insufficient stock")).toBe(false);
  });
});

describe("isLegacyProductIdSku", () => {
  it("detects parent id stored as sku", () => {
    expect(isLegacyProductIdSku("BOT-001", "BOT-001")).toBe(true);
    expect(isLegacyProductIdSku("bot-001", "BOT-001")).toBe(true);
  });

  it("allows real variant skus", () => {
    expect(isLegacyProductIdSku("BOT-001-GRN", "BOT-001")).toBe(false);
  });
});

describe("resolveCheckoutVariantRef", () => {
  it("prefers sku_id", () => {
    expect(
      resolveCheckoutVariantRef({
        skuId: "01HXYZ",
        sku: "BOT-001-GRN",
        productId: "BOT-001",
      })
    ).toEqual({ sku_id: "01HXYZ", sku: "BOT-001-GRN" });
  });

  it("omits legacy parent id sku when sku_id present", () => {
    expect(
      resolveCheckoutVariantRef({
        skuId: "01HXYZ",
        sku: "BOT-001",
        productId: "BOT-001",
      })
    ).toEqual({ sku_id: "01HXYZ" });
  });

  it("uses human sku when no sku_id", () => {
    expect(
      resolveCheckoutVariantRef({ sku: "bot-001-grn", productId: "BOT-001" })
    ).toEqual({ sku: "BOT-001-GRN" });
  });

  it("returns empty ref for legacy parent id sku", () => {
    expect(
      resolveCheckoutVariantRef({ sku: "BOT-001", productId: "BOT-001" })
    ).toEqual({});
  });
});

describe("isCheckoutLineUnpurchasable", () => {
  it("flags lines with no resolvable variant", () => {
    expect(
      isCheckoutLineUnpurchasable({ sku: "BOT-001", productId: "BOT-001" })
    ).toBe(true);
    expect(isCheckoutLineUnpurchasable({ skuId: "01HXYZ" })).toBe(false);
  });
});

describe("cart unpurchasable helpers", () => {
  const items = [
    { sku: "BOT-001-GRN", skuId: "A" },
    { sku: "BOT-001", productId: "BOT-001" },
  ];

  it("cartHasUnpurchasableItems", () => {
    expect(cartHasUnpurchasableItems(items)).toBe(true);
    expect(cartHasUnpurchasableItems([items[0]])).toBe(false);
  });

  it("getUnpurchasableCartItems", () => {
    expect(getUnpurchasableCartItems(items)).toEqual([items[1]]);
  });

  it("buildCheckoutSessionItem", () => {
    expect(
      buildCheckoutSessionItem({ skuId: "A", sku: "BOT-001-GRN", quantity: 2 })
    ).toEqual({ sku_id: "A", sku: "BOT-001-GRN", quantity: 2 });
  });
});

describe("normalizePCCC", () => {
  it("trims and uppercases (matches auth/order normalization)", () => {
    expect(normalizePCCC("  p123456789012  ")).toBe("P123456789012");
  });

  it("passes through already-normalized codes", () => {
    expect(normalizePCCC("P123456789012")).toBe("P123456789012");
  });
});

describe("isValidPCCC", () => {
  it("accepts P + 12 digits after normalization", () => {
    expect(isValidPCCC("p123456789012")).toBe(true);
    expect(isValidPCCC("P123456789012")).toBe(true);
  });

  it("rejects malformed codes", () => {
    expect(isValidPCCC("")).toBe(false);
    expect(isValidPCCC("P12345")).toBe(false);
    expect(isValidPCCC("Q123456789012")).toBe(false);
    expect(isValidPCCC("1234567890123")).toBe(false);
  });
});

describe("buildCheckoutFulfillment", () => {
  it("includes optional pccc on shipping address", () => {
    const fulfillment = buildCheckoutFulfillment({
      name: " Kim ",
      phone: "010-1234-5678",
      address: "123 Main",
      apartment: "",
      city: "강남구",
      zip: "06236",
      province: "서울",
      pccc: "  p123456789012  ",
    });
    expect(fulfillment.recipientName).toBe("Kim");
    expect(fulfillment.recipientPhone).toBe("01012345678");
    expect(fulfillment.shippingAddress.pccc).toBe("p123456789012");
  });

  it("omits blank pccc", () => {
    const fulfillment = buildCheckoutFulfillment({
      name: "Lee",
      phone: "01011112222",
      address: "1",
      apartment: "",
      city: "강남구",
      zip: "06236",
      province: "서울",
      pccc: "   ",
    });
    expect(fulfillment.shippingAddress.pccc).toBeUndefined();
  });
});

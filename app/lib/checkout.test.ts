import { describe, expect, it } from "vitest";
import {
  buildCheckoutFulfillment,
  buildCheckoutSessionItem,
  cartHasUnpurchasableItems,
  getUnpurchasableCartItems,
  isCheckoutLineUnpurchasable,
  isLegacyProductIdSku,
  isUnpurchasableVariantError,
  isValidKRPhone,
  isValidKRPostalCode,
  normalizeKRPhoneDigits,
  normalizePostalCode,
  resolveCheckoutVariantRef,
} from "./checkout";

describe("isUnpurchasableVariantError", () => {
  it("matches variant not found errors from order/checkout APIs", () => {
    expect(isUnpurchasableVariantError("variant not found")).toBe(true);
    expect(isUnpurchasableVariantError("  Variant NOT FOUND  ")).toBe(true);
  });

  it("does not match unrelated checkout failures", () => {
    expect(isUnpurchasableVariantError("payment failed")).toBe(false);
    expect(isUnpurchasableVariantError("invalid coupon")).toBe(false);
  });
});

describe("isLegacyProductIdSku", () => {
  it("detects when human sku equals parent product id", () => {
    expect(isLegacyProductIdSku("01JABC123", "01jabc123")).toBe(true);
  });

  it("returns false when sku differs from product id or inputs are empty", () => {
    expect(isLegacyProductIdSku("BAG-RED-M", "01JABC123")).toBe(false);
    expect(isLegacyProductIdSku("", "01JABC123")).toBe(false);
    expect(isLegacyProductIdSku("01JABC123", undefined)).toBe(false);
  });
});

describe("resolveCheckoutVariantRef", () => {
  it("prefers canonical sku_id and omits legacy product-id sku", () => {
    expect(
      resolveCheckoutVariantRef({
        skuId: "01VARIANT",
        sku: "01PARENT",
        productId: "01PARENT",
      })
    ).toEqual({ sku_id: "01VARIANT" });
  });

  it("includes human sku with sku_id when sku is a real variant code", () => {
    expect(
      resolveCheckoutVariantRef({
        skuId: "01VARIANT",
        sku: "bag-red-m",
        productId: "01PARENT",
      })
    ).toEqual({ sku_id: "01VARIANT", sku: "BAG-RED-M" });
  });

  it("falls back to human sku when sku_id is absent", () => {
    expect(
      resolveCheckoutVariantRef({
        sku: "bag-blue-s",
        productId: "01PARENT",
      })
    ).toEqual({ sku: "BAG-BLUE-S" });
  });

  it("returns empty ref for legacy product-id-only lines", () => {
    expect(
      resolveCheckoutVariantRef({
        sku: "01PARENT",
        productId: "01PARENT",
      })
    ).toEqual({});
  });
});

describe("unpurchasable cart detection", () => {
  const sellable = {
    sku: "BAG-1",
    skuId: "01SELLABLE",
    productId: "01PARENT",
  };
  const legacy = { sku: "01PARENT", productId: "01PARENT" };
  const empty = { sku: "", productId: "01PARENT" };

  it("flags lines with no sellable variant ref", () => {
    expect(isCheckoutLineUnpurchasable(legacy)).toBe(true);
    expect(isCheckoutLineUnpurchasable(empty)).toBe(true);
    expect(isCheckoutLineUnpurchasable(sellable)).toBe(false);
  });

  it("collects unpurchasable lines for the checkout modal", () => {
    const items = [sellable, legacy, empty];
    expect(cartHasUnpurchasableItems(items)).toBe(true);
    expect(getUnpurchasableCartItems(items)).toEqual([legacy, empty]);
  });
});

describe("buildCheckoutSessionItem", () => {
  it("builds session payload with resolved refs and quantity", () => {
    expect(
      buildCheckoutSessionItem({
        sku: "bag-1",
        skuId: "01VARIANT",
        productId: "01PARENT",
        quantity: 2,
      })
    ).toEqual({ sku_id: "01VARIANT", sku: "BAG-1", quantity: 2 });
  });
});

describe("Korean fulfillment validation", () => {
  it("normalizes phone digits and validates mobile format", () => {
    expect(normalizeKRPhoneDigits("010-1234-5678")).toBe("01012345678");
    expect(isValidKRPhone("010-1234-5678")).toBe(true);
    expect(isValidKRPhone("0212345678")).toBe(false);
  });

  it("normalizes and validates 5-digit postal codes", () => {
    expect(normalizePostalCode("062 36")).toBe("06236");
    expect(isValidKRPostalCode("06236")).toBe(true);
    expect(isValidKRPostalCode("0623")).toBe(false);
  });

  it("builds fulfillment snapshot with trimmed fields", () => {
    const fulfillment = buildCheckoutFulfillment({
      name: "  홍길동  ",
      phone: "010-9876-5432",
      address: "  서울시 강남구  ",
      apartment: "  101동  ",
      city: "서울",
      zip: "062 36",
      province: "서울특별시",
      addressId: " addr-1 ",
    });
    expect(fulfillment.recipientName).toBe("홍길동");
    expect(fulfillment.recipientPhone).toBe("01098765432");
    expect(fulfillment.shippingAddress.postalCode).toBe("06236");
    expect(fulfillment.shippingAddress.addressLine2).toBe("101동");
    expect(fulfillment.addressId).toBe("addr-1");
  });
});

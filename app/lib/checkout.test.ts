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

describe("KR phone and postal validation", () => {
  it("strips non-digits from phone input", () => {
    expect(normalizeKRPhoneDigits("010-4112-5167")).toBe("01041125167");
    expect(normalizeKRPhoneDigits("010 4112 5167")).toBe("01041125167");
  });

  it("accepts valid KR mobile numbers", () => {
    expect(isValidKRPhone("010-4112-5167")).toBe(true);
    expect(isValidKRPhone("01012345678")).toBe(true);
  });

  it("rejects invalid KR phone numbers", () => {
    expect(isValidKRPhone("12345")).toBe(false);
    expect(isValidKRPhone("0212345678")).toBe(false);
    expect(isValidKRPhone("0101234567890")).toBe(false);
  });

  it("normalizes and validates 5-digit postal codes", () => {
    expect(normalizePostalCode("061-94")).toBe("06194");
    expect(isValidKRPostalCode("06194")).toBe(true);
    expect(isValidKRPostalCode("0619")).toBe(false);
    expect(isValidKRPostalCode("061945")).toBe(false);
  });
});

describe("buildCheckoutFulfillment", () => {
  it("trims fields and normalizes phone/postal for order service", () => {
    expect(
      buildCheckoutFulfillment({
        name: "  윤라희  ",
        phone: "010-4112-5167",
        address: "테헤란로 78길 14-12",
        apartment: " 9층 ",
        city: "강남구",
        zip: "061-94",
        province: "서울특별시",
        addressId: " addr_000001 ",
      })
    ).toEqual({
      recipientName: "윤라희",
      recipientPhone: "01041125167",
      shippingAddress: {
        postalCode: "06194",
        addressLine1: "테헤란로 78길 14-12",
        addressLine2: "9층",
        city: "강남구",
        province: "서울특별시",
      },
      addressId: "addr_000001",
    });
  });

  it("omits optional apartment and addressId when blank", () => {
    const fulfillment = buildCheckoutFulfillment({
      name: "윤라희",
      phone: "01041125167",
      address: "테헤란로 78길 14-12",
      apartment: "   ",
      city: "강남구",
      zip: "06194",
      province: "서울특별시",
    });
    expect(fulfillment.shippingAddress.addressLine2).toBeUndefined();
    expect(fulfillment.addressId).toBeUndefined();
  });
});

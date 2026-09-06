import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildCheckoutFulfillment,
  buildCheckoutSessionItem,
  cartHasUnpurchasableItems,
  formatKRPhoneInput,
  getUnpurchasableCartItems,
  isCheckoutLineUnpurchasable,
  isLegacyProductIdSku,
  isUnpurchasableVariantError,
  classifyPaymentReturn,
  findResumableOrder,
  isUnconfirmedPayment,
  isResumableOrder,
  isValidKRPhone,
  isValidKRPostalCode,
  isValidPCCC,
  normalizeKRPhoneDigits,
  normalizePCCC,
  normalizePostalCode,
  resolveCheckoutVariantRef,
  resolvePaymentReference,
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

describe("Korean shipping field normalization", () => {
  it("normalizeKRPhoneDigits strips non-digits", () => {
    expect(normalizeKRPhoneDigits("010-4112-5167")).toBe("01041125167");
  });

  it("isValidKRPhone accepts 10- and 11-digit mobile numbers", () => {
    expect(isValidKRPhone("010-4112-5167")).toBe(true);
    expect(isValidKRPhone("01012345678")).toBe(true);
    expect(isValidKRPhone("12345")).toBe(false);
  });

  it("formatKRPhoneInput hyphenates as the user types", () => {
    expect(formatKRPhoneInput("01041125167")).toBe("010-4112-5167");
    expect(formatKRPhoneInput("010411")).toBe("010-411");
  });

  it("normalizePostalCode keeps five digits", () => {
    expect(normalizePostalCode("06194")).toBe("06194");
    expect(normalizePostalCode("06194-000")).toBe("06194");
  });

  it("isValidKRPostalCode requires exactly five digits", () => {
    expect(isValidKRPostalCode("06194")).toBe(true);
    expect(isValidKRPostalCode("0619")).toBe(false);
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

  // Whole-snapshot assertion: the only coverage of addressLine2 trimming.
  it("trims recipient fields and normalizes phone/postal", () => {
    expect(
      buildCheckoutFulfillment({
        name: "  윤라희  ",
        phone: "010-4112-5167",
        address: "테헤란로 78길 14-12",
        apartment: " 9층 ",
        city: "강남구",
        zip: "06194",
        province: "서울특별시",
        pccc: " p123456789012 ",
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
        pccc: "p123456789012",
      },
      addressId: undefined,
    });
  });

  it("omits blank apartment and pccc", () => {
    const fulfillment = buildCheckoutFulfillment({
      name: "Lee",
      phone: "01011112222",
      address: "1",
      apartment: "   ",
      city: "강남구",
      zip: "06236",
      province: "서울",
      pccc: "   ",
    });
    expect(fulfillment.shippingAddress.addressLine2).toBeUndefined();
    expect(fulfillment.shippingAddress.pccc).toBeUndefined();
  });
});


const NOW = 1_700_000_000_000;

function order(overrides: Partial<Parameters<typeof isResumableOrder>[0]> = {}) {
  return {
    id: "ord_1",
    customerId: "cust-1",
    status: "pending",
    totalCents: 70000,
    items: [],
    paymentDueAtMs: NOW + 60_000,
    ...overrides,
  };
}

describe("isResumableOrder", () => {
  it("accepts a pending order inside its unpaid window", () => {
    expect(isResumableOrder(order(), NOW)).toBe(true);
  });

  it("rejects a pending order past its deadline", () => {
    expect(isResumableOrder(order({ paymentDueAtMs: NOW - 1 }), NOW)).toBe(false);
  });

  it("rejects orders that are no longer pending", () => {
    for (const status of ["paid", "canceled", "in_transit", "fulfilled"]) {
      expect(isResumableOrder(order({ status }), NOW)).toBe(false);
    }
  });

  it("trusts pending status when the server sent no deadline", () => {
    expect(isResumableOrder(order({ paymentDueAtMs: undefined }), NOW)).toBe(true);
  });
});

describe("findResumableOrder", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubOrders(orders: unknown[]) {
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      status: 200,
      json: async () => ({ orders }),
    }));
  }

  it("returns null when nothing is payable", async () => {
    stubOrders([
      { id: "a", customer_id: "cust-1", status: "paid", payment_due_at: new Date(NOW + 60_000).toISOString() },
      { id: "b", customer_id: "cust-1", status: "canceled", payment_due_at: new Date(NOW + 60_000).toISOString() },
    ]);
    expect(await findResumableOrder("cust-1", NOW)).toBeNull();
  });

  it("ignores a pending order whose window already closed", async () => {
    stubOrders([
      { id: "stale", customer_id: "cust-1", status: "pending", payment_due_at: new Date(NOW - 1000).toISOString() },
    ]);
    expect(await findResumableOrder("cust-1", NOW)).toBeNull();
  });

  it("picks the order with the latest deadline when several are open", async () => {
    stubOrders([
      { id: "older", customer_id: "cust-1", status: "pending", payment_due_at: new Date(NOW + 30_000).toISOString() },
      { id: "newest", customer_id: "cust-1", status: "pending", payment_due_at: new Date(NOW + 90_000).toISOString() },
    ]);
    const found = await findResumableOrder("cust-1", NOW);
    expect(found?.id).toBe("newest");
  });

  it("maps payment_due_at and payment_id onto the order", async () => {
    stubOrders([
      {
        id: "ord_9",
        customer_id: "cust-1",
        status: "pending",
        total_cents: 70000,
        payment_id: "pay_9",
        payment_due_at: new Date(NOW + 60_000).toISOString(),
      },
    ]);
    const found = await findResumableOrder("cust-1", NOW);
    expect(found?.paymentDueAtMs).toBe(NOW + 60_000);
    expect(found?.paymentId).toBe("pay_9");
  });
});

describe("classifyPaymentReturn", () => {
  it("treats a missing reason as an ordinary decline", () => {
    // A reason dupli1 could not attach must not be read as an approval.
    for (const value of [null, undefined, "", "   "]) {
      expect(classifyPaymentReturn(value)).toBe("declined");
    }
  });

  it("flags reasons that mean the approval could not be verified", () => {
    for (const value of [
      "verify_failed",
      "verification_failed",
      "invalid_payment",
      "amount_mismatch",
      "  VERIFY_FAILED  ",
    ]) {
      expect(classifyPaymentReturn(value)).toBe("unconfirmed");
    }
  });

  it("treats an unrecognised reason as a decline rather than alarming the shopper", () => {
    expect(classifyPaymentReturn("user_cancelled")).toBe("declined");
    expect(classifyPaymentReturn("something_new")).toBe("declined");
  });

  // The values dupli1 actually puts on the wire (payment nanoReturnReason).
  // Pinning them here and in TestNanoReturnUnconfirmedReasonsMatchStorefront on
  // the Go side is what keeps the two repos from drifting apart silently.
  it("classifies every reason dupli1 emits", () => {
    expect(classifyPaymentReturn("verify_failed")).toBe("unconfirmed");
    expect(classifyPaymentReturn("amount_mismatch")).toBe("unconfirmed");
    expect(classifyPaymentReturn("declined")).toBe("declined");
    expect(classifyPaymentReturn("invalid_payload")).toBe("declined");
    // checkout_failed happens before the card window opens — nothing was charged,
    // so the shopper can safely try again (payment nanoReturnCheckoutFailed).
    expect(classifyPaymentReturn("checkout_failed")).toBe("declined");
  });
});

describe("resolvePaymentReference", () => {
  it("prefers the order id the PG return carried", () => {
    expect(
      resolvePaymentReference({
        returnedOrderId: "ord_1",
        resumableOrderId: "ord_2",
        returnedPaymentId: "pay_1",
      })
    ).toEqual({ kind: "order", value: "ord_1" });
  });

  it("falls back to the order we found ourselves when the return omitted one", () => {
    // dupli1 drops order_id whenever it could not tie the callback to a payment
    // row (unknown_payment / shop_mismatch / lookup_failed).
    expect(
      resolvePaymentReference({
        resumableOrderId: "ord_2",
        returnedPaymentId: "pay_1",
      })
    ).toEqual({ kind: "order", value: "ord_2" });
  });

  it("falls back to the payment id when no order is known", () => {
    expect(resolvePaymentReference({ returnedPaymentId: "pay_1" })).toEqual({
      kind: "payment",
      value: "pay_1",
    });
  });

  it("returns null rather than inventing a reference", () => {
    expect(resolvePaymentReference({})).toBeNull();
  });

  it("treats blank and whitespace-only ids as absent", () => {
    expect(
      resolvePaymentReference({
        returnedOrderId: "   ",
        resumableOrderId: "",
        returnedPaymentId: "  pay_1  ",
      })
    ).toEqual({ kind: "payment", value: "pay_1" });
    expect(
      resolvePaymentReference({ returnedOrderId: "", returnedPaymentId: " " })
    ).toBeNull();
  });
});

describe("isUnconfirmedPayment", () => {
  const payment = (status: string) => ({
    id: "pay_1",
    orderId: "ord_1",
    amountCents: 250000,
    status,
    method: "credit_card",
  });

  it("flags a payment the PG returned on but that never settled", () => {
    expect(isUnconfirmedPayment(payment("requires_payment"))).toBe(true);
  });

  it("does not flag a genuine decline or a success", () => {
    for (const status of ["failed", "succeeded", "canceled", "expired"]) {
      expect(isUnconfirmedPayment(payment(status))).toBe(false);
    }
  });
});

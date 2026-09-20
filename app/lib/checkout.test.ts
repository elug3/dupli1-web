import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MAX_DISPUTE_REASON_LENGTH,
  type Order,
  ApiRequestError,
  buildCheckoutFulfillment,
  buildCheckoutSessionItem,
  canCustomerCancelOrder,
  cancelMyOrder,
  canConfirmOrderReceipt,
  canDisputeOrderReceipt,
  cartHasUnpurchasableItems,
  confirmOrderReceipt,
  disputeOrderReceipt,
  formatOrderShippingAddress,
  isOrderUnavailableError,
  orderItemProductPath,
  orderItemTotalWon,
  orderStatusLabelKey,
  orderTimeline,
  formatKRPhoneInput,
  getUnpurchasableCartItems,
  isCheckoutLineUnpurchasable,
  isLegacyProductIdSku,
  isUnpurchasableVariantError,
  classifyPaymentReturn,
  findResumableOrder,
  getOrder,
  isUnconfirmedPayment,
  shouldPromoteReturnToUnconfirmed,
  isResumableOrder,
  listMyOrders,
  orderHasPricingBreakdown,
  resolveResumableOrder,
  isValidKRPhone,
  isValidKRPostalCode,
  isValidPCCC,
  normalizeKRPhoneDigits,
  normalizePCCC,
  normalizePostalCode,
  resolveCheckoutVariantRef,
  resolvePaymentReference,
  shouldOpenNanoCheckout,
  shouldShowCancelRequestedBanner,
  storefrontNanoCheckoutPath,
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
    subtotalWon: 40000,
    discountWon: 0,
    shippingFeeWon: 30000,
    totalWon: 70000,
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
        total_won: 70000,
        payment_id: "pay_9",
        payment_due_at: new Date(NOW + 60_000).toISOString(),
      },
    ]);
    const found = await findResumableOrder("cust-1", NOW);
    expect(found?.paymentDueAtMs).toBe(NOW + 60_000);
    expect(found?.paymentId).toBe("pay_9");
  });
});

describe("order pricing breakdown", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps shipping_fee_won, subtotal, and discount from the order JSON", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        orders: [
          {
            id: "ord_1",
            customer_id: "cust-1",
            status: "paid",
            subtotal_won: 100000,
            discount_won: 10000,
            shipping_fee_won: 30000,
            total_won: 120000,
            coupon_code: "SUMMER30",
          },
        ],
      }),
    }));
    const [mapped] = await listMyOrders("cust-1");
    expect(mapped.subtotalWon).toBe(100000);
    expect(mapped.discountWon).toBe(10000);
    expect(mapped.shippingFeeWon).toBe(30000);
    expect(mapped.totalWon).toBe(120000);
    expect(mapped.couponCode).toBe("SUMMER30");
    expect(orderHasPricingBreakdown(mapped)).toBe(true);
  });

  it("treats a legacy total-only order as having no breakdown", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        orders: [
          {
            id: "ord_legacy",
            customer_id: "cust-1",
            status: "paid",
            total_won: 70000,
          },
        ],
      }),
    }));
    const [mapped] = await listMyOrders("cust-1");
    expect(mapped.subtotalWon).toBe(0);
    expect(mapped.shippingFeeWon).toBe(0);
    expect(mapped.totalWon).toBe(70000);
    expect(orderHasPricingBreakdown(mapped)).toBe(false);
  });

  it("keeps an explicit zero shipping fee as free delivery, not missing", () => {
    expect(
      orderHasPricingBreakdown(
        order({ subtotalWon: 40000, shippingFeeWon: 0, totalWon: 40000 })
      )
    ).toBe(true);
  });
});

describe("resolveResumableOrder", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(handlers: {
    order?: Record<string, unknown> | null;
    orders?: unknown[];
    orderStatus?: number;
  }) {
    vi.stubGlobal("fetch", async (input: RequestInfo) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/api/v1/orders?")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ orders: handlers.orders ?? [] }),
        };
      }
      if (url.includes("/api/v1/orders/")) {
        if (handlers.orderStatus && handlers.orderStatus >= 400) {
          return {
            ok: false,
            status: handlers.orderStatus,
            json: async () => ({ error: "not found" }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => handlers.order ?? {},
        };
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
  }

  it("uses the URL order when it is still payable", async () => {
    stubFetch({
      order: {
        id: "ord_url",
        customer_id: "cust-1",
        status: "pending",
        payment_due_at: new Date(NOW + 60_000).toISOString(),
      },
      orders: [
        {
          id: "ord_list",
          customer_id: "cust-1",
          status: "pending",
          payment_due_at: new Date(NOW + 90_000).toISOString(),
        },
      ],
    });
    const found = await resolveResumableOrder("cust-1", "ord_url", NOW);
    expect(found?.id).toBe("ord_url");
  });

  it("falls back to the order list when the URL order expired", async () => {
    stubFetch({
      order: {
        id: "ord_stale",
        customer_id: "cust-1",
        status: "pending",
        payment_due_at: new Date(NOW - 1000).toISOString(),
      },
      orders: [
        {
          id: "ord_live",
          customer_id: "cust-1",
          status: "pending",
          payment_due_at: new Date(NOW + 60_000).toISOString(),
        },
      ],
    });
    const found = await resolveResumableOrder("cust-1", "ord_stale", NOW);
    expect(found?.id).toBe("ord_live");
  });

  it("falls back when the URL order lookup fails", async () => {
    stubFetch({
      orderStatus: 404,
      orders: [
        {
          id: "ord_live",
          customer_id: "cust-1",
          status: "pending",
          payment_due_at: new Date(NOW + 60_000).toISOString(),
        },
      ],
    });
    const found = await resolveResumableOrder("cust-1", "ord_missing", NOW);
    expect(found?.id).toBe("ord_live");
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

describe("shouldPromoteReturnToUnconfirmed", () => {
  it("does not upgrade checkout_failed — bridge never opened the card window", () => {
    expect(shouldPromoteReturnToUnconfirmed("checkout_failed")).toBe(false);
    expect(shouldPromoteReturnToUnconfirmed("  CHECKOUT_FAILED  ")).toBe(false);
  });

  it("still upgrades other returns when the payment row must be checked", () => {
    for (const value of [
      "declined",
      "invalid_payload",
      "verify_failed",
      "amount_mismatch",
      null,
      undefined,
      "",
    ]) {
      expect(shouldPromoteReturnToUnconfirmed(value)).toBe(true);
    }
  });
});

describe("isUnconfirmedPayment", () => {
  const payment = (status: string) => ({
    id: "pay_1",
    orderId: "ord_1",
    amountWon: 250000,
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

describe("storefrontNanoCheckoutPath", () => {
  it("stays on the storefront, not the gateway /api/v1 path", () => {
    expect(storefrontNanoCheckoutPath("pay_000016")).toBe("/checkout/pay/pay_000016");
    expect(storefrontNanoCheckoutPath("pay_000016")).not.toContain("/api/");
  });
});

describe("refund policy order mapping", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps refund-policy flags from the order JSON", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        id: "ord_1",
        customer_id: "cust-1",
        status: "paid",
        total_won: 70000,
        confirmed_at: "2026-09-11T08:00:00Z",
        cancel_requested_at: "2026-09-11T09:00:00Z",
        cancel_request_reason: "changed mind",
        immediate_cancel_allowed: false,
        cancel_request_allowed: false,
      }),
    }));
    const mapped = await getOrder("ord_1");
    expect(mapped.confirmedAt).toBe("2026-09-11T08:00:00Z");
    expect(mapped.cancelRequestedAt).toBe("2026-09-11T09:00:00Z");
    expect(mapped.cancelRequestReason).toBe("changed mind");
    expect(mapped.immediateCancelAllowed).toBe(false);
    expect(mapped.cancelRequestAllowed).toBe(false);
  });

  it("cancelMyOrder posts to /cancel with optional reason", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.url;
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: "ord_1",
          customer_id: "cust-1",
          status: "canceled",
          total_won: 70000,
        }),
      };
    });
    const updated = await cancelMyOrder("ord_1", "too big");
    expect(updated.status).toBe("canceled");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toContain("/api/v1/orders/ord_1/cancel");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ reason: "too big" });
  });
});

describe("shouldShowCancelRequestedBanner", () => {
  const base = {
    id: "ord_1",
    customerId: "cust-1",
    status: "paid",
    subtotalWon: 40000,
    discountWon: 0,
    shippingFeeWon: 30000,
    totalWon: 70000,
    items: [],
    cancelRequestedAt: "2026-09-11T09:00:00Z",
  };

  it("shows while the order is still awaiting a manager response", () => {
    expect(shouldShowCancelRequestedBanner(base)).toBe(true);
    expect(shouldShowCancelRequestedBanner({ ...base, status: "confirmed" })).toBe(true);
    expect(shouldShowCancelRequestedBanner({ ...base, status: "in_transit" })).toBe(true);
    expect(shouldShowCancelRequestedBanner({ ...base, status: "delivered" })).toBe(true);
  });

  it("hides after cancel completes, once disputed, or before a request exists", () => {
    expect(shouldShowCancelRequestedBanner({ ...base, status: "canceled" })).toBe(false);
    expect(shouldShowCancelRequestedBanner({ ...base, status: "disputed" })).toBe(false);
    expect(shouldShowCancelRequestedBanner({ ...base, status: "fulfilled" })).toBe(false);
    expect(shouldShowCancelRequestedBanner({ ...base, cancelRequestedAt: undefined })).toBe(false);
  });
});

describe("canCustomerCancelOrder", () => {
  const base = {
    id: "ord_1",
    customerId: "cust-1",
    status: "paid",
    subtotalWon: 40000,
    discountWon: 0,
    shippingFeeWon: 30000,
    totalWon: 70000,
    items: [],
  };

  it("offers cancel when immediate refund or request is allowed", () => {
    expect(canCustomerCancelOrder({ ...base, immediateCancelAllowed: true })).toBe(true);
    expect(canCustomerCancelOrder({ ...base, cancelRequestAllowed: true })).toBe(true);
  });

  it("hides the action when neither flag is set", () => {
    expect(
      canCustomerCancelOrder({
        ...base,
        immediateCancelAllowed: false,
        cancelRequestAllowed: false,
      })
    ).toBe(false);
  });
});

describe("shouldOpenNanoCheckout", () => {
  const base = {
    id: "pay_1",
    orderId: "ord_1",
    amountWon: 1000,
    status: "requires_payment",
    method: "credit_card",
    checkoutUrl: "https://dupli1.com/api/v1/payments/pay_1/nano/checkout",
  };

  it("opens NANO for an unpaid card payment even when checkout_url is the gateway", () => {
    expect(shouldOpenNanoCheckout(base)).toBe(true);
  });

  it("does not open NANO after bypass or success", () => {
    expect(shouldOpenNanoCheckout({ ...base, method: "bypass", checkoutUrl: undefined })).toBe(
      false
    );
    expect(shouldOpenNanoCheckout({ ...base, status: "succeeded" })).toBe(false);
  });
});


describe("order detail mapping", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubOrder(raw: Record<string, unknown>) {
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      status: 200,
      json: async () => raw,
    }));
  }

  it("maps the fulfillment snapshot, carrier and lifecycle timestamps", async () => {
    stubOrder({
      id: "ord_1",
      customer_id: "cust-1",
      status: "delivered",
      total_won: 70000,
      items: [
        {
          sku: "PRADA_GALLERIA_BLACK_M",
          sku_id: "01J8SKU1",
          quantity: 1,
          unit_price_won: 70000,
          product_id: "prd-galleria",
          product_name: "Prada Galleria",
        },
      ],
      recipient_name: "김민지",
      recipient_phone: "010-1234-5678",
      shipping_address: {
        postal_code: "06236",
        address_line1: "테헤란로 1",
        address_line2: "5층",
        city: "서울",
        province: "서울특별시",
        pccc: "P123456789012",
      },
      carrier: "CJ대한통운",
      tracking_number: "1234567890",
      created_at: "2026-09-10T01:00:00Z",
      paid_at: "2026-09-10T01:05:00Z",
      confirmed_at: "2026-09-10T02:00:00Z",
      shipped_at: "2026-09-11T02:00:00Z",
      delivered_at: "2026-09-12T02:00:00Z",
      auto_fulfill_due_at: "2026-09-26T02:00:00Z",
    });

    const order = await getOrder("ord_1");
    expect(order.items[0].productId).toBe("prd-galleria");
    expect(order.recipientName).toBe("김민지");
    expect(order.recipientPhone).toBe("010-1234-5678");
    expect(order.shippingAddress).toEqual({
      postalCode: "06236",
      addressLine1: "테헤란로 1",
      addressLine2: "5층",
      city: "서울",
      province: "서울특별시",
      pccc: "P123456789012",
    });
    expect(order.carrier).toBe("CJ대한통운");
    expect(order.trackingNumber).toBe("1234567890");
    expect(order.createdAt).toBe("2026-09-10T01:00:00Z");
    expect(order.paidAt).toBe("2026-09-10T01:05:00Z");
    expect(order.shippedAt).toBe("2026-09-11T02:00:00Z");
    expect(order.deliveredAt).toBe("2026-09-12T02:00:00Z");
    expect(order.autoFulfillDueAt).toBe("2026-09-26T02:00:00Z");
  });

  it("leaves the address undefined when the order carries no snapshot", async () => {
    stubOrder({ id: "ord_1", customer_id: "cust-1", status: "pending", total_won: 1000 });
    const order = await getOrder("ord_1");
    expect(order.shippingAddress).toBeUndefined();
    expect(order.recipientName).toBeUndefined();
  });

  it("prefers promotion_code over the pre-rename coupon_code alias", async () => {
    stubOrder({
      id: "ord_1",
      customer_id: "cust-1",
      status: "paid",
      total_won: 1000,
      promotion_code: "WELCOME50",
      coupon_code: "WELCOME50",
    });
    expect((await getOrder("ord_1")).couponCode).toBe("WELCOME50");
  });

  it("still reads coupon_code from an order that only emits the old name", async () => {
    stubOrder({
      id: "ord_1",
      customer_id: "cust-1",
      status: "paid",
      total_won: 1000,
      coupon_code: "LEGACY10",
    });
    expect((await getOrder("ord_1")).couponCode).toBe("LEGACY10");
  });

  it("surfaces the upstream status on a failed request", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: false,
      status: 404,
      json: async () => ({ error: "not found" }),
    }));
    await expect(getOrder("ord_missing")).rejects.toThrow("not found");
    const error = await getOrder("ord_missing").catch((err: unknown) => err);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(isOrderUnavailableError(error)).toBe(true);
  });

  it("treats a gateway failure as something other than a missing order", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: false,
      status: 502,
      json: async () => ({ error: "upstream_unauthorized" }),
    }));
    const error = await getOrder("ord_1").catch((err: unknown) => err);
    expect(isOrderUnavailableError(error)).toBe(false);
  });
});

describe("orderStatusLabelKey", () => {
  it("maps every status the order service reports", () => {
    expect(orderStatusLabelKey("pending")).toBe("profile.statusPending");
    expect(orderStatusLabelKey("confirmed")).toBe("profile.statusConfirmed");
    expect(orderStatusLabelKey("in_transit")).toBe("profile.statusInTransit");
    expect(orderStatusLabelKey("delivered")).toBe("profile.statusDelivered");
    expect(orderStatusLabelKey("fulfilled")).toBe("profile.statusFulfilled");
    expect(orderStatusLabelKey("disputed")).toBe("profile.statusDisputed");
    expect(orderStatusLabelKey("canceled")).toBe("profile.statusCanceled");
  });

  it("returns null for an unknown status so the caller can show it raw", () => {
    expect(orderStatusLabelKey("teleported")).toBeNull();
  });
});

describe("orderTimeline", () => {
  const base: Order = {
    id: "ord_1",
    customerId: "cust-1",
    status: "pending",
    subtotalWon: 1000,
    discountWon: 0,
    shippingFeeWon: 0,
    totalWon: 1000,
    items: [],
    createdAt: "2026-09-10T01:00:00Z",
  };

  function step(order: Order, key: string) {
    const found = orderTimeline(order).find((entry) => entry.key === key);
    if (!found) throw new Error(`no ${key} step`);
    return found;
  }

  it("marks only placed as reached on a pending order", () => {
    const timeline = orderTimeline(base);
    expect(timeline.map((entry) => entry.key)).toEqual([
      "placed",
      "paid",
      "confirmed",
      "shipped",
      "delivered",
      "fulfilled",
    ]);
    expect(step(base, "placed")).toMatchObject({
      done: true,
      current: true,
      at: "2026-09-10T01:00:00Z",
    });
    expect(step(base, "paid").done).toBe(false);
  });

  it("fills earlier steps from the status even without their timestamps", () => {
    const shipped: Order = { ...base, status: "in_transit" };
    expect(step(shipped, "paid").done).toBe(true);
    expect(step(shipped, "confirmed").done).toBe(true);
    expect(step(shipped, "shipped")).toMatchObject({ done: true, current: true });
    expect(step(shipped, "delivered").done).toBe(false);
  });

  it("counts a fulfilled order complete even when the sweep auto-fulfilled it", () => {
    const auto: Order = { ...base, status: "fulfilled" };
    expect(step(auto, "fulfilled")).toMatchObject({ done: true, current: true, at: undefined });
  });

  it("keeps the progress a canceled order made, and adds the canceled step", () => {
    const canceled: Order = {
      ...base,
      status: "canceled",
      paidAt: "2026-09-10T01:05:00Z",
    };
    expect(step(canceled, "paid").done).toBe(true);
    expect(step(canceled, "confirmed").done).toBe(false);
    expect(step(canceled, "fulfilled").done).toBe(false);
    expect(step(canceled, "canceled")).toMatchObject({ done: true, current: true });
  });

  it("appends the dispute step with its timestamp", () => {
    const disputed: Order = {
      ...base,
      status: "disputed",
      paidAt: "2026-09-10T01:05:00Z",
      deliveredAt: "2026-09-12T02:00:00Z",
      disputedAt: "2026-09-13T02:00:00Z",
    };
    expect(step(disputed, "delivered").done).toBe(true);
    expect(step(disputed, "disputed")).toMatchObject({
      done: true,
      current: true,
      at: "2026-09-13T02:00:00Z",
    });
    expect(step(disputed, "fulfilled").done).toBe(false);
  });
});

describe("receipt actions", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const delivered: Order = {
    id: "ord_1",
    customerId: "cust-1",
    status: "delivered",
    subtotalWon: 1000,
    discountWon: 0,
    shippingFeeWon: 0,
    totalWon: 1000,
    items: [],
  };

  it("offers confirm and dispute only on a delivered order", () => {
    expect(canConfirmOrderReceipt(delivered)).toBe(true);
    expect(canDisputeOrderReceipt(delivered)).toBe(true);
    for (const status of ["pending", "paid", "confirmed", "in_transit", "fulfilled", "disputed"]) {
      expect(canConfirmOrderReceipt({ ...delivered, status })).toBe(false);
      expect(canDisputeOrderReceipt({ ...delivered, status })).toBe(false);
    }
  });

  it("posts the receipt confirmation and maps the returned order", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${typeof input === "string" ? input : input.url}`);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: "ord_1",
          customer_id: "cust-1",
          status: "fulfilled",
          total_won: 1000,
          receipt_confirmed_at: "2026-09-13T02:00:00Z",
        }),
      };
    });

    const updated = await confirmOrderReceipt("ord_1");
    expect(calls).toEqual([
      "POST /auth/session/gateway/api/v1/orders/ord_1/receipt/confirm",
    ]);
    expect(updated.status).toBe("fulfilled");
    expect(updated.receiptConfirmedAt).toBe("2026-09-13T02:00:00Z");
  });

  it("posts the dispute with its reason, capped at the backend limit", async () => {
    const bodies: string[] = [];
    vi.stubGlobal("fetch", async (_input: RequestInfo, init?: RequestInit) => {
      bodies.push(String(init?.body));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: "ord_1",
          customer_id: "cust-1",
          status: "disputed",
          total_won: 1000,
          dispute_reason: "never arrived",
        }),
      };
    });

    const updated = await disputeOrderReceipt("ord_1", "never arrived");
    expect(JSON.parse(bodies[0])).toEqual({ reason: "never arrived" });
    expect(updated.status).toBe("disputed");
    expect(updated.disputeReason).toBe("never arrived");

    await disputeOrderReceipt("ord_1", "x".repeat(MAX_DISPUTE_REASON_LENGTH + 50));
    expect(JSON.parse(bodies[1]).reason).toHaveLength(MAX_DISPUTE_REASON_LENGTH);
  });

  it("sends an empty reason rather than undefined when none was given", async () => {
    const bodies: string[] = [];
    vi.stubGlobal("fetch", async (_input: RequestInfo, init?: RequestInit) => {
      bodies.push(String(init?.body));
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: "ord_1", customer_id: "cust-1", status: "disputed" }),
      };
    });
    await disputeOrderReceipt("ord_1");
    expect(JSON.parse(bodies[0])).toEqual({ reason: "" });
  });
});

describe("orderItemProductPath", () => {
  const base = { sku: "BAG-001", quantity: 1, unitPriceWon: 1000 };

  it("points at the parent product page", () => {
    expect(orderItemProductPath({ ...base, productId: "prd-1" })).toBe(
      "/product/prd-1"
    );
  });

  it("returns null for an order placed before product_id was captured", () => {
    expect(orderItemProductPath(base)).toBeNull();
    expect(orderItemProductPath({ ...base, productId: "   " })).toBeNull();
  });

  it("escapes an id that would otherwise break out of the route", () => {
    expect(orderItemProductPath({ ...base, productId: "a/b?c" })).toBe(
      "/product/a%2Fb%3Fc"
    );
  });
});

describe("order line formatting", () => {
  it("multiplies the unit price by quantity, in whole won", () => {
    expect(
      orderItemTotalWon({ sku: "A", quantity: 3, unitPriceWon: 12000 })
    ).toBe(36000);
  });

  it("joins only the address parts the snapshot filled in", () => {
    expect(
      formatOrderShippingAddress({
        postalCode: "06236",
        addressLine1: "테헤란로 1",
        city: "서울",
        province: "",
      })
    ).toBe("테헤란로 1, 서울, 06236");
  });
});

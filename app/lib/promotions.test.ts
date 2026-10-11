import { afterEach, describe, expect, it, vi } from "vitest";
import type { CartItem } from "./cart";
import {
  describeConditions,
  describeOffer,
  evaluatePromotion,
  fetchMyTier,
  fetchWallet,
  promotionLines,
  promotionMessageKey,
  rejectionFromBody,
  splitDiscount,
  toConditions,
  toOffer,
} from "./promotions";

const ITEM: CartItem = {
  sku: "PRADA_GALLERIA_BLACK_M",
  skuId: "01J8SKU",
  productId: "01J8PARENT",
  quantity: 2,
  unitPriceWon: 1200000,
  name: "Galleria",
  brand: "Prada",
  price: 1200000,
  image: "",
};

function stubFetch(body: unknown, ok = true, status = 200) {
  const fetchStub = vi.fn(
    async () =>
      ({ ok, status, json: async () => body }) as unknown as Response
  );
  vi.stubGlobal("fetch", fetchStub);
  return fetchStub;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("promotionLines", () => {
  // Order fills only these four fields from a priced session; sending a
  // category or brand the browser knows would preview a rule checkout cannot
  // evaluate, so an eligible-looking code would be refused at the last step.
  it("sends exactly the fields checkout sends", () => {
    expect(promotionLines([ITEM])).toEqual([
      {
        sku_id: "01J8SKU",
        sku: "PRADA_GALLERIA_BLACK_M",
        quantity: 2,
        unit_price_won: 1200000,
      },
    ]);
  });
});

describe("evaluatePromotion", () => {
  it("returns the discount the service priced, not a local calculation", async () => {
    stubFetch({ ok: true, discount_won: 50000 });
    const result = await evaluatePromotion("welcome50", {
      items: [ITEM],
      shippingFeeWon: 30000,
    });
    expect(result).toEqual({
      ok: true,
      promotion: { code: "WELCOME50", discountWon: 50000 },
    });
  });

  it("posts the bag, the fee and the customer it was given", async () => {
    const fetchStub = stubFetch({ ok: true, discount_won: 1000 });
    await evaluatePromotion("X", {
      items: [ITEM],
      shippingFeeWon: 30000,
      customerId: "cust-1",
    });
    const [, init] = fetchStub.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      code: "X",
      customer_id: "cust-1",
      shipping_fee_won: 30000,
      lines: promotionLines([ITEM]),
    });
  });

  it("carries the reason and sub-reason of a refusal", async () => {
    // A refusal is a 200 with ok:false — the request itself succeeded.
    stubFetch({ ok: false, reason: "not_eligible", sub_reason: "min_spend" });
    const result = await evaluatePromotion("WELCOME50", {
      items: [ITEM],
      shippingFeeWon: 30000,
    });
    expect(result).toEqual({
      ok: false,
      rejection: { reason: "not_eligible", subReason: "min_spend" },
    });
  });

  it("says nothing about the code when the check itself fails", async () => {
    // 429 from the rate limiter, say: the code may be perfectly good.
    stubFetch(null, false, 429);
    const result = await evaluatePromotion("X", {
      items: [ITEM],
      shippingFeeWon: 30000,
    });
    expect(result).toEqual({ ok: false, rejection: { reason: "unavailable" } });
  });

  it("treats a network failure the same way", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      })
    );
    const result = await evaluatePromotion("X", {
      items: [ITEM],
      shippingFeeWon: 30000,
    });
    expect(result).toEqual({ ok: false, rejection: { reason: "unavailable" } });
  });

  it("refuses an empty code without calling the service", async () => {
    const fetchStub = stubFetch({ ok: true });
    const result = await evaluatePromotion("   ", {
      items: [],
      shippingFeeWon: 0,
    });
    expect(result).toEqual({
      ok: false,
      rejection: { reason: "invalid_code" },
    });
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it("falls back to invalid_code for a reason it does not know", async () => {
    stubFetch({ ok: false, reason: "something_new" });
    const result = await evaluatePromotion("X", {
      items: [ITEM],
      shippingFeeWon: 0,
    });
    expect(result).toEqual({
      ok: false,
      rejection: { reason: "invalid_code", subReason: undefined },
    });
  });
});

describe("promotionMessageKey", () => {
  it("names the rule that bit rather than a generic failure", () => {
    expect(
      promotionMessageKey({ reason: "not_eligible", subReason: "min_spend" })
    ).toBe("promo.minSpend");
    expect(
      promotionMessageKey({ reason: "not_eligible", subReason: "on_sale_excluded" })
    ).toBe("promo.onSale");
    expect(promotionMessageKey({ reason: "expired" })).toBe("promo.expired");
    expect(promotionMessageKey({ reason: "already_used" })).toBe(
      "promo.alreadyUsed"
    );
    expect(promotionMessageKey({ reason: "campaign_exhausted" })).toBe(
      "promo.exhausted"
    );
    expect(promotionMessageKey({ reason: "login_required" })).toBe(
      "promo.loginRequired"
    );
  });

  it("falls back to a general message for an unrecognised sub-reason", () => {
    expect(
      promotionMessageKey({ reason: "not_eligible", subReason: "weather" })
    ).toBe("promo.notEligible");
  });
});

describe("rejectionFromBody", () => {
  it("reads order's 422 body", () => {
    expect(
      rejectionFromBody({
        error: "promotion not eligible: not_eligible:min_spend",
        code: 422,
        reason: "not_eligible",
        sub_reason: "min_spend",
      })
    ).toEqual({ reason: "not_eligible", subReason: "min_spend" });
  });

  it("is null for a body that carries no reason", () => {
    expect(rejectionFromBody({ error: "boom" })).toBeNull();
    expect(rejectionFromBody(null)).toBeNull();
  });
});

describe("fetchWallet", () => {
  it("maps entitlements with the verdict the service reached", async () => {
    stubFetch({
      total: 2,
      results: [
        {
          entitlement: {
            id: "ent-1",
            code: "WELCOME50",
            expires_at: "2026-10-31T14:59:59Z",
          },
          promotion: { description: "First-purchase discount", terms: "100,000원 이상" },
          eligible: true,
          discount_won: 50000,
        },
        {
          entitlement: { id: "ent-2", code: "VIP10" },
          promotion: { description: "VIP", terms: "" },
          eligible: false,
          discount_won: 0,
          reason: "not_eligible",
          sub_reason: "min_spend",
        },
      ],
    });

    const wallet = await fetchWallet({ items: [ITEM], shippingFeeWon: 30000 });
    expect(wallet).toEqual([
      {
        entitlementId: "ent-1",
        code: "WELCOME50",
        description: "First-purchase discount",
        terms: "100,000원 이상",
        expiresAt: "2026-10-31T14:59:59Z",
        eligible: true,
        discountWon: 50000,
        rejection: undefined,
      },
      {
        entitlementId: "ent-2",
        code: "VIP10",
        description: "VIP",
        terms: "",
        expiresAt: undefined,
        eligible: false,
        discountWon: 0,
        rejection: { reason: "not_eligible", subReason: "min_spend" },
      },
    ]);
  });

  it("sends the bag so each code is judged against it", async () => {
    const fetchStub = stubFetch({ results: [] });
    await fetchWallet({ items: [ITEM], shippingFeeWon: 30000 });
    const [url, init] = fetchStub.mock.calls[0] as unknown as [string, RequestInit];
    // The customer comes from the session token, so this goes through the
    // session gateway and the body carries no customer id.
    expect(url).toBe("/auth/session/gateway/api/v1/products/promotions/me");
    expect(JSON.parse(String(init.body))).toEqual({
      shipping_fee_won: 30000,
      lines: promotionLines([ITEM]),
    });
  });

  // A withdrawn entitlement has no business on a customer's shelf.
  it("drops revoked entitlements", async () => {
    stubFetch({
      results: [
        {
          entitlement: { id: "ent-1", code: "OOPS", revoked_at: "2026-09-20T00:00:00Z" },
          eligible: false,
        },
      ],
    });
    expect(await fetchWallet({ items: [], shippingFeeWon: 0 })).toEqual([]);
  });

  it("is empty rather than throwing when the wallet cannot be read", async () => {
    stubFetch(null, false, 401);
    expect(await fetchWallet({ items: [ITEM], shippingFeeWon: 0 })).toEqual([]);
  });
});

describe("fetchMyTier", () => {
  it("returns the member's tier through the session gateway", async () => {
    const fetchStub = stubFetch({ ok: true, code: "VIP", discount_won: 240000 });
    const tier = await fetchMyTier({ items: [ITEM], shippingFeeWon: 30000 });
    expect(tier).toEqual({ code: "VIP", discountWon: 240000 });
    const [url, init] = fetchStub.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/auth/session/gateway/api/v1/products/promotions/me/tier");
    // The customer comes from the token, never the body.
    expect(JSON.parse(String(init.body))).not.toHaveProperty("customer_id");
  });

  it("is null for a non-member or a failed call", async () => {
    stubFetch({ ok: false });
    expect(await fetchMyTier({ items: [ITEM], shippingFeeWon: 30000 })).toBeNull();
    stubFetch({}, false, 401);
    expect(await fetchMyTier({ items: [ITEM], shippingFeeWon: 30000 })).toBeNull();
  });
});

describe("splitDiscount", () => {
  it("takes the code first and gives the tier what is left", () => {
    expect(splitDiscount(40000, 30000)).toEqual({ codeWon: 30000, tierWon: 10000 });
    // Clamped total smaller than the code alone: no tier left.
    expect(splitDiscount(10000, 30000)).toEqual({ codeWon: 10000, tierWon: 0 });
    expect(splitDiscount(5000, 0)).toEqual({ codeWon: 0, tierWon: 5000 });
  });
});

describe("toOffer", () => {
  it("reads a percentage, keeping its cap", () => {
    expect(
      toOffer({ benefit: { discount_type: "percent", discount_fraction: 0.1, max_discount_won: 30000 } })
    ).toEqual({ kind: "percent", percent: 10, maxDiscountWon: 30000 });
  });

  it("reads a fixed amount", () => {
    expect(toOffer({ benefit: { discount_type: "fixed", discount_fixed_won: 50000 } })).toEqual({
      kind: "fixed",
      amountWon: 50000,
    });
  });

  it("falls back to the legacy percentage only when no benefit is set", () => {
    expect(toOffer({ discount: 0.15 })).toEqual({ kind: "percent", percent: 15 });
    expect(toOffer({ discount: 0.15, benefit: { discount_type: "none" } })).toBeUndefined();
    expect(toOffer(null)).toBeUndefined();
  });
});

describe("toConditions", () => {
  it("collects the rules a shopper can read", () => {
    expect(
      toConditions({
        max_per_customer: 1,
        conditions: {
          all: [
            { attr: "subtotal_won", op: "gte", value: 100000 },
            { attr: "line.category", op: "in", value: ["bags"] },
            { attr: "line.brandCode", op: "eq", value: "PRA" },
            { attr: "line.skuId", op: "eq", value: "01J8SKU" },
          ],
          exclude: [{ attr: "line.on_sale", op: "eq", value: true }],
        },
      })
    ).toEqual({
      minSubtotalWon: 100000,
      categories: ["bags"],
      brandCodes: ["PRA"],
      excludesSaleItems: true,
      maxPerCustomer: 1,
    });
  });

  it("is undefined for a code with no rules", () => {
    expect(toConditions({ conditions: { all: [] }, max_per_customer: 0 })).toBeUndefined();
  });
});

describe("describeOffer / describeConditions", () => {
  const t = (key: string, v?: Record<string, string | number>) =>
    key === "category.bags" ? "Bags" : `${key}${v ? JSON.stringify(v) : ""}`;
  const won = (n: number) => `₩${n}`;

  it("words each offer", () => {
    expect(describeOffer({ kind: "fixed", amountWon: 50000 }, t, won)).toBe(
      'promo.offerFixed{"amount":"₩50000"}'
    );
    expect(describeOffer({ kind: "percent", percent: 10, maxDiscountWon: 30000 }, t, won)).toBe(
      'promo.offerPercent{"percent":10}, promo.offerCap{"amount":"₩30000"}'
    );
    expect(describeOffer(undefined, t, won)).toBe("");
  });

  it("lists conditions in display order", () => {
    expect(
      describeConditions(
        {
          conditions: { minSubtotalWon: 100000, categories: ["bags"], maxPerCustomer: 1 },
          expiresAt: "2026-10-31T14:59:59Z",
        },
        t,
        won,
        () => "2026. 10. 31."
      )
    ).toEqual([
      'promo.condMinSpend{"amount":"₩100000"}',
      'promo.condCategory{"categories":"Bags"}',
      "promo.condOnce",
      'promo.condExpires{"date":"2026. 10. 31."}',
    ]);
  });
});

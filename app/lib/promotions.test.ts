import { afterEach, describe, expect, it, vi } from "vitest";
import type { CartItem } from "./cart";
import {
  evaluatePromotion,
  fetchWallet,
  promotionLines,
  promotionMessageKey,
  rejectionFromBody,
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

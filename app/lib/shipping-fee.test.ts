import { afterEach, describe, expect, it, vi } from "vitest";

import { SHIPPING_FEE, computeTotals, type CartLine } from "./cart";
import { getShippingFeeCents } from "./checkout";

const LINE: CartLine = {
  sku: "SKU-1",
  product_id: "p1",
  quantity: 1,
  unit_price_cents: 1004,
} as unknown as CartLine;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("computeTotals shipping fee", () => {
  // The order service owns the charge. A hardcoded copy here is what let the
  // storefront quote a total the backend never collected.
  it("uses the fee it is given rather than the display constant", () => {
    const totals = computeTotals([LINE], 1004, 0, 4500);
    expect(totals.shipping).toBe(4500);
    expect(totals.total).toBe(1004 + 4500);
  });

  it("falls back to SHIPPING_FEE when no fee is supplied", () => {
    const totals = computeTotals([LINE], 1004, 0);
    expect(totals.shipping).toBe(SHIPPING_FEE);
    expect(totals.total).toBe(1004 + SHIPPING_FEE);
  });

  // Free delivery must survive as an explicit 0 and not be mistaken for
  // "unset", which would silently reinstate the constant.
  it("honours an explicit zero fee", () => {
    const totals = computeTotals([LINE], 1004, 0, 0);
    expect(totals.shipping).toBe(0);
    expect(totals.total).toBe(1004);
  });

  it("charges nothing to ship an empty bag", () => {
    const totals = computeTotals([], 0, 0, 30000);
    expect(totals.shipping).toBe(0);
    expect(totals.total).toBe(0);
  });

  // total = subtotal - discount + shipping, matching the order service.
  it("applies the discount to goods only, never to delivery", () => {
    const totals = computeTotals([LINE], 10000, 0.3, 30000);
    expect(totals.discount).toBe(3000);
    expect(totals.total).toBe(10000 - 3000 + 30000);
  });
});

describe("getShippingFeeCents", () => {
  function stubSettings(body: unknown, ok = true) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => body }) as unknown as Response)
    );
  }

  it("reads the fee the order service publishes", async () => {
    stubSettings({ limits: { currency: "krw", shipping_fee_cents: 30000 } });
    await expect(getShippingFeeCents()).resolves.toBe(30000);
  });

  it("reads an explicit zero as free delivery, not as missing", async () => {
    stubSettings({ limits: { shipping_fee_cents: 0 } });
    await expect(getShippingFeeCents()).resolves.toBe(0);
  });

  // null means "no answer", so callers keep the display constant instead of
  // quoting 0 and under-charging on screen.
  it("returns null when the service omits the field", async () => {
    stubSettings({ limits: { currency: "krw" } });
    await expect(getShippingFeeCents()).resolves.toBeNull();
  });

  it("returns null on a failed response", async () => {
    stubSettings({}, false);
    await expect(getShippingFeeCents()).resolves.toBeNull();
  });

  it("returns null when the request throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );
    await expect(getShippingFeeCents()).resolves.toBeNull();
  });
});

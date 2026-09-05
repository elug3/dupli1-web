import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCartSnapshot, refreshCart, resetCart } from "./cart";
import { login, logout, register } from "./auth";

const CART_LINE = {
  sku: "SKU-1",
  product_id: "p1",
  quantity: 2,
  unit_price_cents: 1000,
};

/** Scripted fetch: session endpoints always succeed, cart depends on `signedIn`.
 *  Cart calls go to `/auth/session/gateway/...`, so match that before the
 *  login/register/logout endpoints that share the `/auth/session/` prefix. */
function stubFetch(signedIn: boolean) {
  const fetchStub = vi.fn(async (url: unknown) => {
    const path = String(url);
    if (path.startsWith("/auth/session/") && !path.startsWith("/auth/session/gateway")) {
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as unknown as Response;
    }
    if (!signedIn) {
      return { ok: false, status: 401, json: async () => ({ error: "unauthorized" }) } as unknown as Response;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ items: [CART_LINE], subtotal_cents: 2000 }),
    } as unknown as Response;
  });
  vi.stubGlobal("fetch", fetchStub);
  return fetchStub;
}

beforeEach(() => {
  resetCart();
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetCart();
});

describe("resetCart", () => {
  it("returns a guest store to idle so useCart refetches", async () => {
    stubFetch(false);
    await refreshCart();
    expect(getCartSnapshot().status).toBe("guest");

    resetCart();
    expect(getCartSnapshot().status).toBe("idle");
  });

  it("clears lines from the previous session", async () => {
    stubFetch(true);
    await refreshCart();
    expect(getCartSnapshot().items).toHaveLength(1);

    resetCart();
    expect(getCartSnapshot().items).toEqual([]);
    expect(getCartSnapshot().subtotalCents).toBe(0);
  });
});

describe("session changes reset the cart store", () => {
  // The store is a module singleton that outlives client-side navigation. A
  // `guest` status cached while signed out used to survive login, so /checkout
  // read it, redirected to /login, and the two bounced forever.
  it("login clears the guest status cached while signed out", async () => {
    stubFetch(false);
    await refreshCart();
    expect(getCartSnapshot().status).toBe("guest");

    stubFetch(true);
    await login("shopper@example.com", "pw");
    expect(getCartSnapshot().status).toBe("idle");

    await refreshCart();
    expect(getCartSnapshot().status).toBe("ready");
  });

  it("register clears it too, since it also sets the session cookie", async () => {
    stubFetch(false);
    await refreshCart();
    expect(getCartSnapshot().status).toBe("guest");

    stubFetch(true);
    await register("new@example.com", "pw");
    expect(getCartSnapshot().status).toBe("idle");
  });

  it("logout drops the previous customer's lines", async () => {
    stubFetch(true);
    await refreshCart();
    expect(getCartSnapshot().items).toHaveLength(1);

    await logout();
    expect(getCartSnapshot().status).toBe("idle");
    expect(getCartSnapshot().items).toEqual([]);
  });
});

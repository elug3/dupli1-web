import { afterEach, describe, expect, it, vi } from "vitest";
import {
  handleLogin,
  handleRefresh,
  handleSessionGatewayProxy,
  proxyNanoCheckout,
  proxyVisitBeacon,
} from "./bff-session.server";
import { memorySessionStore, redisSessionStore } from "./session-store.server";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function upstreamResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete globalThis.__dupli1SessionStore;
});

describe("handleSessionGatewayProxy profile routing", () => {
  it("forwards /api/v1/profile/me/* to the profile upstream", async () => {
    const fetchCalls: string[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown, init?: RequestInit) => {
        const target = String(url);
        fetchCalls.push(target);

        if (target.endsWith("/api/v1/auth/login")) {
          return jsonResponse({ refresh_token: "rt-1" });
        }
        if (target.endsWith("/api/v1/auth/refresh")) {
          return jsonResponse({ token: "access-1", refresh_token: "rt-2" });
        }
        if (target.endsWith("/api/v1/profile/me/profile")) {
          expect(init?.headers).toBeInstanceOf(Headers);
          const headers = init?.headers as Headers;
          expect(headers.get("Authorization")).toBe("Bearer access-1");
          return upstreamResponse({ display_name: "Test User", phone: "" });
        }

        throw new Error(`unexpected fetch: ${target}`);
      })
    );

    const loginResponse = await handleLogin(
      new Request("http://localhost/auth/session/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "user@example.com", password: "secret" }),
      })
    );
    expect(loginResponse.status).toBe(200);

    const setCookie = loginResponse.headers.get("Set-Cookie");
    expect(setCookie).toBeTruthy();

    const profileResponse = await handleSessionGatewayProxy(
      new Request("http://localhost/auth/session/gateway/api/v1/profile/me/profile", {
        headers: { Cookie: setCookie! },
      })
    );

    expect(profileResponse.status).toBe(200);
    expect(await profileResponse.json()).toEqual({
      display_name: "Test User",
      phone: "",
    });
    expect(
      fetchCalls.some((url) => url.endsWith("/api/v1/profile/me/profile"))
    ).toBe(true);
  });

  it("returns 404 for unknown gateway API prefixes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        const target = String(url);
        if (target.endsWith("/api/v1/auth/login")) {
          return jsonResponse({ refresh_token: "rt-1" });
        }
        if (target.endsWith("/api/v1/auth/refresh")) {
          return jsonResponse({ token: "access-1", refresh_token: "rt-2" });
        }
        throw new Error(`unexpected fetch: ${target}`);
      })
    );

    const loginResponse = await handleLogin(
      new Request("http://localhost/auth/session/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "user@example.com", password: "secret" }),
      })
    );
    const setCookie = loginResponse.headers.get("Set-Cookie");

    const response = await handleSessionGatewayProxy(
      new Request("http://localhost/auth/session/gateway/api/v1/unknown/resource", {
        headers: { Cookie: setCookie! },
      })
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
  });
});

describe("proxyNanoCheckout", () => {
  async function signIn(): Promise<string> {
    const loginResponse = await handleLogin(
      new Request("http://localhost/auth/session/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "user@example.com", password: "secret" }),
      })
    );
    const setCookie = loginResponse.headers.get("Set-Cookie");
    expect(setCookie).toBeTruthy();
    return setCookie!;
  }

  it("sends unauthenticated shoppers to login, not the gateway API", async () => {
    const response = await proxyNanoCheckout(
      new Request("http://localhost/checkout/pay/pay_000016"),
      "pay_000016"
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "/login?next=%2Fcheckout%2Fpay%2Fpay_000016"
    );
  });

  it("rejects an unsafe payment id", async () => {
    const response = await proxyNanoCheckout(
      new Request("http://localhost/checkout/pay/x"),
      "../nano/return"
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/checkout?error=checkout_failed");
  });

  it("proxies the payment-service HTML bridge on the storefront path", async () => {
    const fetchCalls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown, init?: RequestInit) => {
        const target = String(url);
        fetchCalls.push({ url: target, init });
        if (target.endsWith("/api/v1/auth/login")) {
          return jsonResponse({ refresh_token: "rt-1" });
        }
        if (target.endsWith("/api/v1/auth/refresh")) {
          return jsonResponse({ token: "access-1", refresh_token: "rt-2" });
        }
        if (target.includes("/api/v1/payments/pay_000016/nano/checkout")) {
          expect(init?.redirect).toBe("manual");
          const headers = init?.headers as Headers;
          expect(headers.get("Authorization")).toBe("Bearer access-1");
          expect(headers.get("User-Agent")).toContain("Chrome");
          return new Response("<!DOCTYPE html><title>나노페이</title>", {
            status: 200,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }
        throw new Error(`unexpected fetch: ${target}`);
      })
    );

    const cookie = await signIn();
    const response = await proxyNanoCheckout(
      new Request("http://localhost/checkout/pay/pay_000016", {
        headers: {
          Cookie: cookie,
          "User-Agent": "Mozilla/5.0 Chrome/128.0.0.0",
        },
      }),
      "pay_000016"
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    expect(await response.text()).toContain("나노페이");
    expect(
      fetchCalls.some((c) => c.url.includes("/api/v1/payments/pay_000016/nano/checkout"))
    ).toBe(true);
  });

  it("forwards a NANO 302 to the browser instead of following it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown, init?: RequestInit) => {
        const target = String(url);
        if (target.endsWith("/api/v1/auth/login")) {
          return jsonResponse({ refresh_token: "rt-1" });
        }
        if (target.endsWith("/api/v1/auth/refresh")) {
          return jsonResponse({ token: "access-1", refresh_token: "rt-2" });
        }
        if (target.includes("/nano/checkout")) {
          expect(init?.redirect).toBe("manual");
          return new Response(null, {
            status: 302,
            headers: { Location: "https://pay.nanopay.co.kr/pay/abc" },
          });
        }
        throw new Error(`unexpected fetch: ${target}`);
      })
    );

    const cookie = await signIn();
    const response = await proxyNanoCheckout(
      new Request("http://localhost/checkout/pay/pay_1", {
        headers: { Cookie: cookie },
      }),
      "pay_1"
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("https://pay.nanopay.co.kr/pay/abc");
  });
});

/**
 * Auth answers 503 when it cannot reach its own refresh-token ledger, which
 * lives in Redis and goes away briefly on every deploy (the task is replaced
 * stop-before-start to keep one writer on its append-only file). Before this,
 * any non-ok refresh dropped the session record and cleared the cookie, so
 * those seconds signed out every shopper who happened to be mid-visit.
 */
describe("auth unavailable is not an expired session", () => {
  async function signIn(afterLogin: () => Response | never): Promise<string> {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        const target = String(url);
        if (target.endsWith("/api/v1/auth/login")) {
          return jsonResponse({ refresh_token: "rt-1" });
        }
        if (target.endsWith("/api/v1/auth/refresh")) {
          return jsonResponse({ token: "access-1", refresh_token: "rt-2" });
        }
        throw new Error(`unexpected fetch: ${target}`);
      })
    );

    const loginResponse = await handleLogin(
      new Request("http://localhost/auth/session/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "user@example.com", password: "secret" }),
      })
    );
    expect(loginResponse.status).toBe(200);
    const setCookie = loginResponse.headers.get("Set-Cookie");
    expect(setCookie).toBeTruthy();

    vi.stubGlobal("fetch", vi.fn(async () => afterLogin()));
    return setCookie!.split(";")[0];
  }

  function refresh(cookie: string): Promise<Response> {
    return handleRefresh(
      new Request("http://localhost/auth/session/refresh", {
        method: "POST",
        headers: { Cookie: cookie },
      })
    );
  }

  it("keeps the session and the cookie when auth returns 503", async () => {
    const cookie = await signIn(() =>
      jsonResponse({ error: "refresh unavailable" }, 503)
    );

    const response = await refresh(cookie);

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "auth_unavailable" });
    // Clearing the cookie is the sign-out this exists to prevent.
    expect(response.headers.get("Set-Cookie") ?? "").not.toContain("Max-Age=0");
  });

  it("signs the shopper back in as soon as auth answers", async () => {
    const cookie = await signIn(() =>
      jsonResponse({ error: "refresh unavailable" }, 503)
    );
    expect((await refresh(cookie)).status).toBe(503);

    // The record still holds rt-2 from login; had the 503 been read as a
    // rejection, the session would already be gone.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ token: "access-2", refresh_token: "rt-3" }))
    );

    expect((await refresh(cookie)).status).toBe(200);
  });

  it("does not sign out when auth cannot be dialled at all", async () => {
    const cookie = await signIn(() => {
      throw new Error("ECONNREFUSED");
    });

    const response = await refresh(cookie);

    expect(response.status).toBe(503);
    expect(response.headers.get("Set-Cookie") ?? "").not.toContain("Max-Age=0");
  });

  it("does not sign out on a 200 that carries no token", async () => {
    const cookie = await signIn(() => jsonResponse({ ok: true }));

    const response = await refresh(cookie);

    expect(response.status).toBe(503);
    expect(response.headers.get("Set-Cookie") ?? "").not.toContain("Max-Age=0");
  });

  it("still ends the session on a 401, which is auth's own verdict", async () => {
    const cookie = await signIn(() =>
      jsonResponse({ error: "invalid refresh token" }, 401)
    );

    const response = await refresh(cookie);

    expect(response.status).toBe(401);
    expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });
});

describe("login client", () => {
  it("asks auth for the storefront client whatever the browser sends", async () => {
    let sentClient: unknown;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown, init?: RequestInit) => {
        if (String(url).endsWith("/api/v1/auth/login")) {
          sentClient = JSON.parse(String(init?.body)).client;
          return jsonResponse({ refresh_token: "rt-1" });
        }
        if (String(url).endsWith("/api/v1/auth/refresh")) {
          return jsonResponse({ token: "access-1", refresh_token: "rt-2" });
        }
        throw new Error(`unexpected fetch: ${String(url)}`);
      })
    );

    await handleLogin(
      new Request("http://localhost/auth/session/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "a@example.com", password: "secret", client: "service" }),
      })
    );
    expect(sentClient).toBe("storefront");
  });

  it("passes auth's refusal message through without a session", async () => {
    const message = "Service accounts cannot sign in to the storefront.";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ error: message, code: "account_type_not_allowed" }, 403)
      )
    );

    const res = await handleLogin(
      new Request("http://localhost/auth/session/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "robot@example.com", password: "secret" }),
      })
    );
    expect(res.status).toBe(403);
    expect(res.headers.get("Set-Cookie")).toBeNull();
    expect(await res.json()).toMatchObject({ error: message, code: "account_type_not_allowed" });
  });
});

describe("a deploy does not end sessions", () => {
  async function loginCookie(mod: typeof import("./bff-session.server")) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ access_token: "a-1", refresh_token: "rt-1" }))
    );
    const login = await mod.handleLogin(
      new Request("http://localhost/auth/session/login", {
        method: "POST",
        body: JSON.stringify({ email: "u@example.com", password: "x" }),
      })
    );
    return login.headers.get("Set-Cookie")!.split(";")[0];
  }

  it("honours a cookie issued by a previous process sharing the store", async () => {
    const shared = memorySessionStore();
    globalThis.__dupli1SessionStore = shared;
    vi.resetModules();
    const cookie = await loginCookie(await import("./bff-session.server"));

    // A fresh module instance stands in for the replacement task.
    vi.resetModules();
    const after = await import("./bff-session.server");
    const seen: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: unknown, init?: RequestInit) => {
        seen.push(String((init?.headers as Record<string, string>).Authorization));
        return jsonResponse({ id: "u1" });
      })
    );
    const me = await after.handleMe(
      new Request("http://localhost/auth/session/me", { headers: { Cookie: cookie } })
    );

    expect(me.status).toBe(200);
    expect(seen).toEqual(["Bearer a-1"]);
  });

  it("keeps the cookie when the session store is down", async () => {
    const mod = await import("./bff-session.server");
    const cookie = await loginCookie(mod);
    globalThis.__dupli1SessionStore = {
      get: async () => {
        throw new Error("redis down");
      },
      set: async () => {},
      delete: async () => {},
    };

    const response = await mod.handleMe(
      new Request("http://localhost/auth/session/me", { headers: { Cookie: cookie } })
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("Set-Cookie") ?? "").not.toContain("Max-Age=0");
  });

  it("coalesces parallel refreshes onto one auth exchange", async () => {
    globalThis.__dupli1SessionStore = memorySessionStore();
    let refreshCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        const target = String(url);
        if (target.endsWith("/api/v1/auth/login")) {
          return jsonResponse({ refresh_token: "rt-1" });
        }
        if (target.endsWith("/api/v1/auth/refresh")) {
          refreshCalls++;
          return jsonResponse({ token: "a-2", refresh_token: "rt-2" });
        }
        throw new Error(`unexpected fetch: ${target}`);
      })
    );
    vi.resetModules();
    const mod = await import("./bff-session.server");
    const login = await mod.handleLogin(
      new Request("http://localhost/auth/session/login", {
        method: "POST",
        body: JSON.stringify({ email: "u@example.com", password: "x" }),
      })
    );
    expect(login.status).toBe(200);
    const cookie = login.headers.get("Set-Cookie")!.split(";")[0];
    const id = decodeURIComponent(cookie.split("=")[1]);
    const store = globalThis.__dupli1SessionStore!;
    const record = (await store.get(id))!;
    await store.set(
      id,
      { ...record, accessTokenExpiresAt: 0, accessToken: "stale" },
      3600
    );
    const before = refreshCalls;

    const refresh = () =>
      mod.handleRefresh(
        new Request("http://localhost/auth/session/refresh", {
          method: "POST",
          headers: { Cookie: cookie },
        })
      );

    const responses = await Promise.all([refresh(), refresh(), refresh(), refresh()]);
    for (const response of responses) {
      expect(response.status).toBe(200);
    }
    expect(refreshCalls - before).toBe(1);
  });

  it("uses the successor token when a parallel request already rotated it", async () => {
    const mod = await import("./bff-session.server");
    const cookie = await loginCookie(mod);
    const id = decodeURIComponent(cookie.split("=")[1]);
    const store = globalThis.__dupli1SessionStore!;
    const stale = (await store.get(id))!;

    // Auth refuses rt-1 because the other request spent it and stored rt-2.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        await store.set(id, { ...stale, refreshToken: "rt-2", accessToken: "a-2" }, 60);
        return jsonResponse({ error: "reused" }, 401);
      })
    );
    const response = await mod.handleRefresh(
      new Request("http://localhost/auth/session/refresh", {
        method: "POST",
        headers: { Cookie: cookie },
      })
    );

    expect(response.status).toBe(200);
    expect((await store.get(id))?.refreshToken).toBe("rt-2");
  });
});

const REDIS_URL = process.env.DUPLI1_TEST_REDIS_URL;

describe.skipIf(!REDIS_URL)("redis session store", () => {
  it("round-trips a record and expires it", async () => {
    const store = redisSessionStore(REDIS_URL!);
    const record = {
      refreshToken: "r",
      accessToken: "a",
      accessTokenExpiresAt: 1,
      expiresAt: Date.now() + 1000,
    };
    await store.set("t-1", record, 1);
    expect(await store.get("t-1")).toEqual(record);
    await new Promise((r) => setTimeout(r, 1200));
    expect(await store.get("t-1")).toBeNull();
    await store.set("t-2", record, 60);
    await store.delete("t-2");
    expect(await store.get("t-2")).toBeNull();
  });
});

describe("proxyVisitBeacon", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("carries only the guest cookie both ways and answers 204", async () => {
    const upstream = new Response(null, {
      status: 204,
      headers: [
        ["Set-Cookie", "dupli1_guest=01J9ZZZZZZZZZZZZZZZZZZZZZZ; Path=/; HttpOnly; SameSite=Lax"],
        ["Set-Cookie", "other=1; Path=/"],
      ],
    });
    const fetchMock = vi.fn().mockResolvedValue(upstream);
    vi.stubGlobal("fetch", fetchMock);

    const response = await proxyVisitBeacon(
      new Request("http://localhost/api/v1/products/visits", {
        method: "POST",
        headers: {
          Cookie: "dupli1_session=secret; dupli1_guest=01J9AAAAAAAAAAAAAAAAAAAAAA",
          "User-Agent": "Mozilla/5.0",
        },
      })
    );

    expect(response.status).toBe(204);
    expect(response.headers.getSetCookie()).toEqual([
      "dupli1_guest=01J9ZZZZZZZZZZZZZZZZZZZZZZ; Path=/; HttpOnly; SameSite=Lax",
    ]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/v1\/products\/visits$/);
    const sent = new Headers(init.headers);
    expect(sent.get("Cookie")).toBe("dupli1_guest=01J9AAAAAAAAAAAAAAAAAAAAAA");
    expect(sent.get("User-Agent")).toBe("Mozilla/5.0");
  });

  it("answers 204 when product is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const response = await proxyVisitBeacon(
      new Request("http://localhost/api/v1/products/visits", { method: "POST" })
    );
    expect(response.status).toBe(204);
  });
});

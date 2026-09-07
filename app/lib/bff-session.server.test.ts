import { afterEach, describe, expect, it, vi } from "vitest";
import {
  handleLogin,
  handleSessionGatewayProxy,
  proxyNanoCheckout,
} from "./bff-session.server";

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
  delete globalThis.__dupli1BffSessions;
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

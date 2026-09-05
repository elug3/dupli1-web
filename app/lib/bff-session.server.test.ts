import { afterEach, describe, expect, it, vi } from "vitest";
import {
  handleLogin,
  handleSessionGatewayProxy,
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

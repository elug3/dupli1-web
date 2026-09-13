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

describe("refresh failures", () => {
  /**
   * Signs in with an already-stale access token, so the very next gateway call
   * has to run a refresh handshake — that is the path under test.
   */
  async function signIn(): Promise<string> {
    const response = await handleLogin(
      new Request("http://localhost/auth/session/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "user@example.com", password: "secret" }),
      })
    );
    expect(response.status).toBe(200);
    return response.headers.get("Set-Cookie")!;
  }

  /** Auth's answer to `POST /api/v1/auth/refresh`, swapped per test. */
  type RefreshBehaviour = () => Promise<Response>;

  const healthy: RefreshBehaviour = async () =>
    jsonResponse({ token: "access-2", refresh_token: "rt-2" });

  function stub(refresh: { current: RefreshBehaviour }) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        const target = String(url);
        if (target.endsWith("/api/v1/auth/login")) {
          // expires_in: 0 → the access token is stale before it is stored.
          return jsonResponse({
            access_token: "access-1",
            refresh_token: "rt-1",
            expires_in: 0,
          });
        }
        if (target.endsWith("/api/v1/auth/refresh")) return refresh.current();
        if (target.includes("/api/v1/cart")) return upstreamResponse({ items: [] });
        throw new Error(`unexpected fetch: ${target}`);
      })
    );
  }

  function getCart(cookie: string): Promise<Response> {
    return handleSessionGatewayProxy(
      new Request("http://localhost/auth/session/gateway/api/v1/cart", {
        headers: { Cookie: cookie },
      })
    );
  }

  it("keeps the session alive when auth is down, and recovers with it", async () => {
    const refresh = { current: healthy };
    stub(refresh);
    const cookie = await signIn();

    refresh.current = async () => jsonResponse({ error: "bad gateway" }, 502);
    const during = await getCart(cookie);

    expect(during.status).toBe(503);
    expect(await during.json()).toMatchObject({ error_code: "auth_unavailable" });
    // The cookie must survive: clearing it is what turns a blip into a logout.
    expect(during.headers.get("Set-Cookie")).toBeNull();

    refresh.current = healthy;
    const after = await getCart(cookie);
    expect(after.status).toBe(200);
    expect(await after.json()).toEqual({ items: [] });
  });

  it("treats every auth failure status as temporary except its verdicts", async () => {
    for (const status of [500, 502, 503, 504, 429, 404, 408]) {
      const refresh = { current: healthy };
      stub(refresh);
      const cookie = await signIn();

      refresh.current = async () => jsonResponse({ error: "nope" }, status);
      const response = await getCart(cookie);
      expect(response.status, `auth ${status}`).toBe(503);

      refresh.current = healthy;
      expect((await getCart(cookie)).status, `auth ${status}`).toBe(200);
      vi.unstubAllGlobals();
      delete globalThis.__dupli1BffSessions;
    }
  });

  it("ends the session when auth rejects the refresh token", async () => {
    // 401 is auth's verdict: invalid, expired, rotated, revoked, or locked.
    for (const status of [401, 400]) {
      const refresh = { current: healthy };
      stub(refresh);
      const cookie = await signIn();

      refresh.current = async () => jsonResponse({ error: "invalid token" }, status);
      const response = await getCart(cookie);

      expect(response.status, `auth ${status}`).toBe(401);
      expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");

      // The record is gone, so a healthy auth cannot revive it either.
      refresh.current = healthy;
      expect((await getCart(cookie)).status).toBe(401);
      vi.unstubAllGlobals();
      delete globalThis.__dupli1BffSessions;
    }
  });

  it("survives auth being unreachable rather than throwing", async () => {
    const refresh = { current: healthy };
    stub(refresh);
    const cookie = await signIn();

    refresh.current = async () => {
      throw new TypeError("fetch failed");
    };
    const response = await getCart(cookie);
    expect(response.status).toBe(503);

    refresh.current = healthy;
    expect((await getCart(cookie)).status).toBe(200);
  });

  it("does not sign anyone out over an unreadable or empty token response", async () => {
    const refresh = { current: healthy };
    stub(refresh);
    const cookie = await signIn();

    // 200 with no token at all — a contract problem, not an expired session.
    refresh.current = async () => jsonResponse({ refresh_token: "rt-2" });
    expect((await getCart(cookie)).status).toBe(503);

    // 200 whose body is not JSON.
    refresh.current = async () =>
      new Response("<html>proxy error</html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    expect((await getCart(cookie)).status).toBe(503);

    refresh.current = healthy;
    expect((await getCart(cookie)).status).toBe(200);
  });
});

/**
 * With a shared session store, two SSR tasks serve the same session. Refresh
 * rotates on use, so a second exchange of the same token is rejected — and
 * treating that rejection as "session over" would sign the customer out over a
 * race that harmed nothing. These cases stand in for the other task by editing
 * the store directly, which is exactly what it would see through Redis.
 */
describe("shared store: concurrent refresh", () => {
  function storedSession(cookie: string) {
    const id = decodeURIComponent(cookie.split(";")[0].split("=")[1]);
    const record = globalThis.__dupli1BffSessions!.get(id);
    if (!record) throw new Error("session not found in store");
    return { id, record };
  }

  async function signInWithStaleToken(): Promise<string> {
    const response = await handleLogin(
      new Request("http://localhost/auth/session/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "user@example.com", password: "secret" }),
      })
    );
    expect(response.status).toBe(200);
    return response.headers.get("Set-Cookie")!;
  }

  function getCart(cookie: string): Promise<Response> {
    return handleSessionGatewayProxy(
      new Request("http://localhost/auth/session/gateway/api/v1/cart", {
        headers: { Cookie: cookie },
      })
    );
  }

  it("uses the other task's token instead of signing out on a lost race", async () => {
    let refreshCalls = 0;
    let cookie = "";

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown, init?: RequestInit) => {
        const target = String(url);
        if (target.endsWith("/api/v1/auth/login")) {
          // expires_in: 0 → stale immediately, so the next call must refresh.
          return jsonResponse({
            access_token: "access-1",
            refresh_token: "rt-1",
            expires_in: 0,
          });
        }
        if (target.endsWith("/api/v1/auth/refresh")) {
          refreshCalls += 1;
          // Stand in for the other task: it already rotated rt-1 -> rt-2 and
          // cached a live access token, so auth rejects our spent rt-1.
          const { id, record } = storedSession(cookie);
          globalThis.__dupli1BffSessions!.set(id, {
            ...record,
            refreshToken: "rt-2",
            accessToken: "access-from-other-task",
            accessTokenExpiresAt: Date.now() + 60_000,
          });
          return jsonResponse({ error: "invalid refresh token" }, 401);
        }
        if (target.includes("/api/v1/cart")) {
          const headers = init?.headers as Headers;
          expect(headers.get("Authorization")).toBe(
            "Bearer access-from-other-task"
          );
          return upstreamResponse({ items: [] });
        }
        throw new Error(`unexpected fetch: ${target}`);
      })
    );

    cookie = await signInWithStaleToken();
    const response = await getCart(cookie);

    expect(refreshCalls).toBe(1);
    expect(response.status).toBe(200);
    // The session must still be there: nothing about this race ended it.
    expect(globalThis.__dupli1BffSessions!.size).toBe(1);
  });

  it("still ends the session when the stored token is the one auth rejected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        const target = String(url);
        if (target.endsWith("/api/v1/auth/login")) {
          return jsonResponse({
            access_token: "access-1",
            refresh_token: "rt-1",
            expires_in: 0,
          });
        }
        if (target.endsWith("/api/v1/auth/refresh")) {
          // Nobody rotated anything; the token really is dead.
          return jsonResponse({ error: "invalid refresh token" }, 401);
        }
        if (target.includes("/api/v1/cart")) {
          throw new Error("should not reach the upstream");
        }
        throw new Error(`unexpected fetch: ${target}`);
      })
    );

    const cookie = await signInWithStaleToken();
    const response = await getCart(cookie);

    expect(response.status).toBe(401);
    expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(globalThis.__dupli1BffSessions!.size).toBe(0);
  });

  it("coalesces parallel refreshes onto one exchange", async () => {
    let refreshCalls = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        const target = String(url);
        if (target.endsWith("/api/v1/auth/login")) {
          return jsonResponse({
            access_token: "access-1",
            refresh_token: "rt-1",
            expires_in: 0,
          });
        }
        if (target.endsWith("/api/v1/auth/refresh")) {
          refreshCalls += 1;
          await new Promise((resolve) => setTimeout(resolve, 10));
          return jsonResponse({ token: "access-2", refresh_token: "rt-2" });
        }
        if (target.includes("/api/v1/cart")) return upstreamResponse({ items: [] });
        throw new Error(`unexpected fetch: ${target}`);
      })
    );

    const cookie = await signInWithStaleToken();
    const responses = await Promise.all([
      getCart(cookie),
      getCart(cookie),
      getCart(cookie),
      getCart(cookie),
    ]);

    for (const response of responses) expect(response.status).toBe(200);
    // Without coalescing each caller spends rt-1 and three of four are rejected.
    expect(refreshCalls).toBe(1);
  });
});

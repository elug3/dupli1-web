import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getServiceAccountAccessToken, serviceAccountConfigured } from "./service-account.server";

const KEY = "dk_test_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("service account API key", () => {
  beforeEach(() => {
    delete globalThis.__dupli1WebServiceAccount;
    vi.stubEnv("DUPLI1_WEB_SERVICE_TOKEN", "");
    vi.stubEnv("DUPLI1_WEB_SERVICE_API_KEY", KEY);
    vi.stubEnv("DUPLI1_WEB_SERVICE_AUTH_URL", "http://proxy.internal:8081");
    vi.stubEnv("DUPLI1_WEB_SERVICE_EMAIL", "web@example.com");
    vi.stubEnv("DUPLI1_WEB_SERVICE_PASSWORD", "legacy-password");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    delete globalThis.__dupli1WebServiceAccount;
  });

  it("exchanges the key at the internal URL, not the password login, and caches the token", async () => {
    const calls: { url: string; auth: string | null }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown, init?: RequestInit) => {
        calls.push({ url: String(url), auth: new Headers(init?.headers).get("Authorization") });
        return json({ token: "access-1", token_type: "Bearer", expires_in: 900 });
      })
    );

    expect(serviceAccountConfigured()).toBe(true);
    expect(await getServiceAccountAccessToken()).toBe("access-1");
    expect(await getServiceAccountAccessToken()).toBe("access-1");

    expect(calls).toEqual([{ url: "http://proxy.internal:8081/api/v1/auth/token", auth: `ApiKey ${KEY}` }]);
  });

  it("is configured by the key alone, with no password", async () => {
    vi.stubEnv("DUPLI1_WEB_SERVICE_EMAIL", "");
    vi.stubEnv("DUPLI1_WEB_SERVICE_PASSWORD", "");
    vi.stubGlobal("fetch", vi.fn(async () => json({ token: "access-2", expires_in: 900 })));
    expect(serviceAccountConfigured()).toBe(true);
    expect(await getServiceAccountAccessToken()).toBe("access-2");
  });

  it("explains an internal-only 404 and never echoes the key", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "not found" }, 404)));
    const err = await getServiceAccountAccessToken().catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain("DUPLI1_WEB_SERVICE_AUTH_URL");
    expect((err as Error).message).not.toContain(KEY);
  });
});

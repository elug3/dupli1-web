import { describe, expect, it, vi } from "vitest";

import { kstDay, recordVisit, VISIT_BEACON_PATH, VISIT_STORAGE_KEY } from "./visit-beacon";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

describe("kstDay", () => {
  it("rolls over at midnight KST, not UTC", () => {
    expect(kstDay(new Date("2026-10-01T14:59:00Z"))).toBe("2026-10-01");
    expect(kstDay(new Date("2026-10-01T15:00:00Z"))).toBe("2026-10-02");
  });
});

describe("recordVisit", () => {
  const now = new Date("2026-10-02T03:00:00Z");

  it("posts once and remembers the KST day", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const storage = memoryStorage();

    await recordVisit({ fetch, storage, userAgent: BROWSER_UA, now });
    await recordVisit({ fetch, storage, userAgent: BROWSER_UA, now });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      VISIT_BEACON_PATH,
      expect.objectContaining({ method: "POST", credentials: "same-origin" })
    );
    expect(storage.data.get(VISIT_STORAGE_KEY)).toBe("2026-10-02");
  });

  it("sends again on a new KST day", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const storage = memoryStorage({ [VISIT_STORAGE_KEY]: "2026-10-01" });

    await recordVisit({ fetch, storage, userAgent: BROWSER_UA, now });

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not remember a failed send, so the next load retries", async () => {
    const storage = memoryStorage();
    await recordVisit({
      fetch: vi.fn().mockRejectedValue(new TypeError("offline")),
      storage,
      userAgent: BROWSER_UA,
      now,
    });
    await recordVisit({
      fetch: vi.fn().mockResolvedValue(new Response(null, { status: 502 })),
      storage,
      userAgent: BROWSER_UA,
      now,
    });
    expect(storage.data.has(VISIT_STORAGE_KEY)).toBe(false);
  });

  it("skips crawlers", async () => {
    const fetch = vi.fn();
    await recordVisit({
      fetch,
      storage: memoryStorage(),
      userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      now,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not remember the day when the server rate-limits, so the next load retries", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 429 }));
    const storage = memoryStorage();

    await recordVisit({ fetch, storage, userAgent: BROWSER_UA, now });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(storage.data.has(VISIT_STORAGE_KEY)).toBe(false);
  });

  it("still sends when storage throws", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const storage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    await expect(recordVisit({ fetch, storage, userAgent: BROWSER_UA, now })).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

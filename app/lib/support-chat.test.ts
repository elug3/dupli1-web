import { afterEach, describe, expect, it, vi } from "vitest";
import {
  errorKeyFor,
  getSupportChatSnapshot,
  openSupportChat,
  resetSupportChat,
  sendSupportMessage,
  startSupportChat,
} from "./support-chat";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const EMPTY = {
  conversation: { inquiry: null, messages: [], unread: 0, service_open: true, service_window: "평일 10:00–22:00" },
};

afterEach(() => {
  resetSupportChat();
  vi.unstubAllGlobals();
});

describe("errorKeyFor", () => {
  it("maps support's codes to copy", () => {
    expect(errorKeyFor("rate_limited", 429)).toBe("chat.error.rateLimited");
    expect(errorKeyFor("invalid_reference", 422)).toBe("chat.error.invalidReference");
    expect(errorKeyFor(undefined, 0)).toBe("chat.error.offline");
    expect(errorKeyFor("internal", 500)).toBe("chat.error.generic");
  });
});

describe("support chat store", () => {
  it("leaves a signed-out shopper as a guest without touching support", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    await startSupportChat();
    expect(getSupportChatSnapshot().status).toBe("guest");
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual(["/auth/session/me"]);
  });

  it("treats a service account as unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ user_id: "svc", account_type: "service" })));
    await startSupportChat();
    expect(getSupportChatSnapshot().status).toBe("unavailable");
  });

  it("sends the attached product as its SKU and clears it", async () => {
    const sent: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown, init?: RequestInit) => {
        const target = String(url);
        if (target === "/auth/session/me") return json({ user_id: "u1", account_type: "customer" });
        if (target.endsWith("/support/web/messages")) {
          sent.push(JSON.parse(String(init?.body)));
          return json(EMPTY);
        }
        return json(EMPTY);
      })
    );
    await startSupportChat();
    expect(getSupportChatSnapshot().status).toBe("ready");

    openSupportChat({ kind: "product", productId: "P01", skuId: "SKU01", name: "Galleria" });
    expect(await sendSupportMessage("재입고 되나요?")).toBe(true);
    expect(sent).toEqual([{ body: "재입고 되나요?", product_id: "P01", sku_id: "SKU01" }]);
    expect(getSupportChatSnapshot().pending).toBeNull();
  });

  it("keeps the draft's attachment and shows the reason when support refuses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        const target = String(url);
        if (target === "/auth/session/me") return json({ user_id: "u1", account_type: "customer" });
        if (target.endsWith("/support/web/messages")) {
          return json({ error: "nope", code: "invalid_reference" }, 422);
        }
        return json(EMPTY);
      })
    );
    await startSupportChat();
    openSupportChat({ kind: "order", orderId: "ORD9", label: "Mini" });
    expect(await sendSupportMessage("")).toBe(false);
    const state = getSupportChatSnapshot();
    expect(state.error).toBe("chat.error.invalidReference");
    expect(state.pending).toMatchObject({ orderId: "ORD9" });
  });
});

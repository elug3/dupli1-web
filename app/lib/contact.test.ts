import { describe, expect, it } from "vitest";

import {
  TELEGRAM_CONTACT_HANDLE,
  telegramContactUrl,
  telegramStartPayload,
} from "./contact";

describe("telegramContactUrl", () => {
  it("links the consultation bot by default", () => {
    expect(telegramContactUrl()).toBe(`https://t.me/${TELEGRAM_CONTACT_HANDLE}`);
  });

  it("points at a bot handle, which Telegram requires to end in bot", () => {
    expect(TELEGRAM_CONTACT_HANDLE.toLowerCase().endsWith("bot")).toBe(true);
  });

  it("strips a leading @ so the link stays valid", () => {
    expect(telegramContactUrl({ handle: "@dupli1_support_bot" })).toBe(
      "https://t.me/dupli1_support_bot"
    );
  });

  it("accepts a pasted t.me link in any shape", () => {
    expect(telegramContactUrl({ handle: "https://t.me/dupli1_support_bot" })).toBe(
      "https://t.me/dupli1_support_bot"
    );
    expect(telegramContactUrl({ handle: "t.me/dupli1_support_bot/" })).toBe(
      "https://t.me/dupli1_support_bot"
    );
    expect(
      telegramContactUrl({ handle: "  https://www.telegram.me/dupli1_support_bot  " })
    ).toBe("https://t.me/dupli1_support_bot");
  });

  it("carries the shopper's context as a start payload", () => {
    expect(
      telegramContactUrl({
        context: { surface: "category", ref: "b-louis-vuitton", language: "ko" },
      })
    ).toBe(`https://t.me/${TELEGRAM_CONTACT_HANDLE}?start=c_b-louis-vuitton_ko`);
  });

  it("omits ?start= entirely when there is no context", () => {
    // An empty start payload is not the same as none: Telegram would deliver
    // "/start" with a blank argument, which reads as noise.
    expect(telegramContactUrl({ context: undefined })).not.toContain("?start=");
  });
});

describe("telegramStartPayload", () => {
  it("encodes each surface", () => {
    expect(telegramStartPayload({ surface: "home", language: "ko" })).toBe("h_ko");
    expect(
      telegramStartPayload({ surface: "category", ref: "t-handbags", language: "ko" })
    ).toBe("c_t-handbags_ko");
    expect(
      telegramStartPayload({ surface: "product", ref: "bag-lv-capucines-bb", language: "en" })
    ).toBe("p_bag-lv-capucines-bb_en");
  });

  it("stays inside Telegram's 64-character limit", () => {
    const payload = telegramStartPayload({
      surface: "product",
      ref: "a".repeat(200),
      language: "ko",
    });
    expect(payload.length).toBeLessThanOrEqual(64);
  });

  it("drops an over-long reference rather than truncating it", () => {
    // A cut-off reference points at the wrong product, which is worse than
    // none: staff would open a consultation about something else entirely.
    expect(
      telegramStartPayload({ surface: "product", ref: "a".repeat(200), language: "ko" })
    ).toBe("p_ko");
  });

  it("uses only characters Telegram accepts", () => {
    const payload = telegramStartPayload({
      surface: "category",
      ref: "b-루이비통 & co/x",
      language: "ko",
    });
    expect(payload).toMatch(/^[A-Za-z0-9_-]*$/);
  });

  it("omits a reference that sanitizes away to nothing", () => {
    expect(
      telegramStartPayload({ surface: "category", ref: "루이비통", language: "ko" })
    ).toBe("c_ko");
  });

  it("returns empty for no context at all", () => {
    expect(telegramStartPayload(undefined)).toBe("");
  });
});

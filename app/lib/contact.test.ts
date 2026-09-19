import { describe, expect, it } from "vitest";

import { TELEGRAM_CONTACT_HANDLE, telegramContactUrl } from "./contact";

describe("telegramContactUrl", () => {
  it("links the configured storefront handle by default", () => {
    expect(telegramContactUrl()).toBe(`https://t.me/${TELEGRAM_CONTACT_HANDLE}`);
  });

  it("strips a leading @ so the link stays valid", () => {
    expect(telegramContactUrl("@dupli1_support")).toBe(
      "https://t.me/dupli1_support"
    );
  });

  it("accepts a pasted t.me link in any shape", () => {
    expect(telegramContactUrl("https://t.me/dupli1_support")).toBe(
      "https://t.me/dupli1_support"
    );
    expect(telegramContactUrl("t.me/dupli1_support/")).toBe(
      "https://t.me/dupli1_support"
    );
    expect(telegramContactUrl("  https://www.telegram.me/dupli1_support  ")).toBe(
      "https://t.me/dupli1_support"
    );
  });
});

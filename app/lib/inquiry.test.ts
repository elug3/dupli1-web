import { describe, expect, it } from "vitest";
import { CONCIERGE_EMAIL, conciergeMailto } from "./inquiry";

describe("conciergeMailto", () => {
  it("encodes subject and body without '+' for spaces", () => {
    const href = conciergeMailto("Price inquiry: Prada Galleria", "Hello\nthere");
    expect(href).toBe(
      `mailto:${CONCIERGE_EMAIL}` +
        "?subject=Price%20inquiry%3A%20Prada%20Galleria" +
        "&body=Hello%0Athere"
    );
    expect(href).not.toContain("+");
  });

  it("encodes non-latin copy", () => {
    const href = conciergeMailto("가격 문의", "문의");
    expect(href).toContain("subject=%EA%B0%80%EA%B2%A9%20%EB%AC%B8%EC%9D%98");
  });
});

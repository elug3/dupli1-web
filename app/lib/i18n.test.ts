import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LANGUAGES, LanguageProvider, formatKrw, useLanguage } from "./i18n";

const amounts = [0, 1, 999, 1000, 50000, 1234000, 12345678, -5000, 1234.5];
// Captured from the pre-refactor Intl.NumberFormat(locale, KRW, 0) output.
const expected = [
  "₩0",
  "₩1",
  "₩999",
  "₩1,000",
  "₩50,000",
  "₩1,234,000",
  "₩12,345,678",
  "-₩5,000",
  "₩1,235",
];

describe("formatKrw", () => {
  for (const locale of ["en-US", "ko-KR", "zh-CN"]) {
    it(`formats whole won for ${locale}`, () => {
      expect(amounts.map((n) => formatKrw(locale, n))).toEqual(expected);
    });
  }

  it("matches the fallback context (ko-KR) outside the provider", () => {
    let out: string[] = [];
    function Probe() {
      const { formatCurrency } = useLanguage();
      out = amounts.map((n) => formatCurrency(n));
      return null;
    }
    renderToString(createElement(Probe));
    expect(out).toEqual(expected);
    expect(out).toEqual(amounts.map((n) => formatKrw("ko-KR", n)));
  });

  it("matches the provider's formatCurrency", () => {
    let out: string[] = [];
    function Probe() {
      const { formatCurrency } = useLanguage();
      out = amounts.map((n) => formatCurrency(n));
      return null;
    }
    renderToString(createElement(LanguageProvider, null, createElement(Probe)));
    expect(out).toEqual(expected);
    for (const option of LANGUAGES) {
      expect(amounts.map((n) => formatKrw(option.locale, n))).toEqual(expected);
    }
  });
});

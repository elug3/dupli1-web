import { describe, expect, it } from "vitest";

import { isTelegramFloatRoute } from "./telegram-float";

describe("isTelegramFloatRoute", () => {
  it("shows the chat button on home and category pages", () => {
    expect(isTelegramFloatRoute("/")).toBe(true);
    expect(isTelegramFloatRoute("/category/product-type/handbags")).toBe(true);
    expect(isTelegramFloatRoute("/category/brand/louis-vuitton")).toBe(true);
    expect(isTelegramFloatRoute("/category/style/evening")).toBe(true);
  });

  it("keeps it off pages with their own bottom chrome or checkout flow", () => {
    expect(isTelegramFloatRoute("/product/bag-lv-capucines-bb")).toBe(false);
    expect(isTelegramFloatRoute("/cart")).toBe(false);
    expect(isTelegramFloatRoute("/checkout")).toBe(false);
    expect(isTelegramFloatRoute("/checkout/confirmation")).toBe(false);
    expect(isTelegramFloatRoute("/profile")).toBe(false);
    expect(isTelegramFloatRoute("/login")).toBe(false);
  });

  it("does not match a path that merely starts with the word category", () => {
    expect(isTelegramFloatRoute("/categories")).toBe(false);
  });
});

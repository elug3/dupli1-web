import { describe, expect, it } from "vitest";

import { isChatFloatRoute } from "./support-chat";

describe("isChatFloatRoute", () => {
  it("shows the chat button on home and category pages", () => {
    expect(isChatFloatRoute("/")).toBe(true);
    expect(isChatFloatRoute("/category/product-type/handbags")).toBe(true);
    expect(isChatFloatRoute("/category/brand/louis-vuitton")).toBe(true);
  });

  it("keeps it off pages with their own bottom chrome or checkout flow", () => {
    expect(isChatFloatRoute("/product/bag-lv-capucines-bb")).toBe(false);
    expect(isChatFloatRoute("/cart")).toBe(false);
    expect(isChatFloatRoute("/checkout")).toBe(false);
    expect(isChatFloatRoute("/profile")).toBe(false);
  });

  it("does not match a path that merely starts with the word category", () => {
    expect(isChatFloatRoute("/categories")).toBe(false);
  });
});

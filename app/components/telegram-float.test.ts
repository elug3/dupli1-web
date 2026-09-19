import { describe, expect, it } from "vitest";

import { isTelegramFloatRoute, storefrontContext } from "./telegram-float";
import { telegramStartPayload } from "../lib/contact";

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

describe("storefrontContext", () => {
  it("reads the home page", () => {
    expect(storefrontContext("/", "ko")).toEqual({ surface: "home", language: "ko" });
  });

  it("reads a category page, compressing the facet to one letter", () => {
    expect(storefrontContext("/category/brand/louis-vuitton", "ko")).toEqual({
      surface: "category",
      ref: "b-louis-vuitton",
      language: "ko",
    });
    expect(storefrontContext("/category/product-type/handbags", "en")).toEqual({
      surface: "category",
      ref: "t-handbags",
      language: "en",
    });
  });

  it("keeps the facet letter readable after the first hyphen", () => {
    // Values carry hyphens of their own, so the split has to be on the first
    // one or `t-shoulder-bags` would parse as facet "t-shoulder".
    const context = storefrontContext("/category/product-type/shoulder-bags", "ko");
    expect(context?.ref).toBe("t-shoulder-bags");
    expect(context?.ref?.split("-")[0]).toBe("t");
  });

  it("reads a product page, for when the button is enabled there", () => {
    expect(storefrontContext("/product/bag-lv-capucines-bb", "ko")).toEqual({
      surface: "product",
      ref: "bag-lv-capucines-bb",
      language: "ko",
    });
  });

  it("carries no reference for an unknown facet rather than guessing", () => {
    expect(storefrontContext("/category/nonsense/whatever", "ko")).toEqual({
      surface: "category",
      ref: undefined,
      language: "ko",
    });
  });

  it("returns nothing for a page it does not recognise", () => {
    expect(storefrontContext("/cart", "ko")).toBeUndefined();
    expect(storefrontContext("/category/brand", "ko")).toBeUndefined();
  });

  it("produces payloads Telegram accepts for every route it serves", () => {
    const paths = [
      "/",
      "/category/brand/louis-vuitton",
      "/category/product-type/shoulder-bags",
      "/category/style/evening",
      "/category/family/women",
    ];
    for (const path of paths) {
      const payload = telegramStartPayload(storefrontContext(path, "ko"));
      expect(payload).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(payload.length).toBeLessThanOrEqual(64);
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  MY_ACCOUNT_ORDERS_PATH,
  MY_ACCOUNT_PATH,
  myAccountOrderPath,
  myAccountPath,
  parseAccountSection,
} from "./account";

describe("myAccountPath", () => {
  it("keeps wishlist at the account root", () => {
    expect(myAccountPath()).toBe(MY_ACCOUNT_PATH);
    expect(myAccountPath("wishlist")).toBe("/profile");
  });

  it("nests other sections under the account root", () => {
    expect(myAccountPath("orders")).toBe(MY_ACCOUNT_ORDERS_PATH);
    expect(myAccountPath("orders")).toBe("/profile/orders");
    expect(myAccountPath("promotions")).toBe("/profile/promotions");
  });
});

describe("myAccountOrderPath", () => {
  it("nests one order under the orders section", () => {
    expect(myAccountOrderPath("01J8ABCD")).toBe("/profile/orders/01J8ABCD");
  });

  it("escapes an id that would otherwise break out of the route", () => {
    expect(myAccountOrderPath("a/b?c")).toBe("/profile/orders/a%2Fb%3Fc");
  });
});

describe("parseAccountSection", () => {
  it("accepts known account sections", () => {
    expect(parseAccountSection("orders")).toBe("orders");
    expect(parseAccountSection("settings")).toBe("settings");
  });

  it("keeps a bookmarked pre-rename slug on its section", () => {
    expect(parseAccountSection("coupons")).toBe("promotions");
  });

  it("defaults unknown or missing values to wishlist", () => {
    expect(parseAccountSection(undefined)).toBe("wishlist");
    expect(parseAccountSection("history")).toBe("wishlist");
    expect(parseAccountSection("")).toBe("wishlist");
  });
});

import { describe, expect, it } from "vitest";
import {
  MY_ACCOUNT_ORDERS_PATH,
  MY_ACCOUNT_PATH,
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
    expect(myAccountPath("coupons")).toBe("/profile/coupons");
  });
});

describe("parseAccountSection", () => {
  it("accepts known account sections", () => {
    expect(parseAccountSection("orders")).toBe("orders");
    expect(parseAccountSection("settings")).toBe("settings");
  });

  it("defaults unknown or missing values to wishlist", () => {
    expect(parseAccountSection(undefined)).toBe("wishlist");
    expect(parseAccountSection("history")).toBe("wishlist");
    expect(parseAccountSection("")).toBe("wishlist");
  });
});

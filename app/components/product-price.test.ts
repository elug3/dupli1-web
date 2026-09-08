import { describe, expect, it } from "vitest";
import { saleDiscountPercent } from "./product-price";

describe("saleDiscountPercent", () => {
  it("returns rounded percent when official price is higher", () => {
    expect(saleDiscountPercent(480_000, 5_350_000)).toBe(91);
    expect(saleDiscountPercent(900, 1000)).toBe(10);
  });

  it("returns null when there is no discount", () => {
    expect(saleDiscountPercent(1000, 1000)).toBeNull();
    expect(saleDiscountPercent(1200, 1000)).toBeNull();
    expect(saleDiscountPercent(1000, 0)).toBeNull();
    expect(saleDiscountPercent(Number.NaN, 1000)).toBeNull();
  });
});

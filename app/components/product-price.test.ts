import { describe, expect, it } from "vitest";
import { isPriceOnRequest, saleDiscountPercent } from "./product-price";

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

describe("isPriceOnRequest", () => {
  it("treats an unpriced style as inquiry-only", () => {
    // product stores price NOT NULL DEFAULT 0 and both web mappers coalesce a
    // missing value to 0, so these are the same case on the wire.
    expect(isPriceOnRequest(0)).toBe(true);
    expect(isPriceOnRequest(undefined)).toBe(true);
    expect(isPriceOnRequest(null)).toBe(true);
    expect(isPriceOnRequest(Number.NaN)).toBe(true);
    expect(isPriceOnRequest(-1)).toBe(true);
  });

  it("leaves a real price alone", () => {
    expect(isPriceOnRequest(1)).toBe(false);
    expect(isPriceOnRequest(2_890_000)).toBe(false);
  });
});

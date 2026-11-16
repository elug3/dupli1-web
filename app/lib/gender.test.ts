import { describe, expect, it } from "vitest";
import { genderHomePath, matchesGender, normalizeGenderMode, withGender } from "./gender";

describe("gender mode", () => {
  it("accepts only the three modes", () => {
    expect(normalizeGenderMode("Women")).toBe("women");
    expect(normalizeGenderMode(" men ")).toBe("men");
    expect(normalizeGenderMode("all")).toBe("all");
    expect(normalizeGenderMode("kids")).toBeNull();
    expect(normalizeGenderMode(null)).toBeNull();
  });

  it("shows everything in the neutral mode", () => {
    expect(matchesGender("men", "all")).toBe(true);
    expect(matchesGender("kids", "all")).toBe(true);
  });

  it("keeps the other gender out, and unisex or untagged products in", () => {
    expect(matchesGender("women", "women")).toBe(true);
    expect(matchesGender("men", "women")).toBe(false);
    expect(matchesGender("all", "women")).toBe(true);
    expect(matchesGender("", "men")).toBe(true);
    expect(matchesGender(undefined, "men")).toBe(true);
    expect(matchesGender("kids", "men")).toBe(false);
  });

  it("gives each mode its home", () => {
    expect(genderHomePath("all")).toBe("/");
    expect(genderHomePath("women")).toBe("/women");
    expect(genderHomePath("men")).toBe("/men");
  });

  it("narrows category links to the mode", () => {
    expect(withGender("/category/product-type/padded-jackets", "women")).toBe(
      "/category/product-type/padded-jackets?gender=women"
    );
    expect(withGender("/category/product-type/handbags?sort=popular", "men")).toBe(
      "/category/product-type/handbags?sort=popular&gender=men"
    );
  });

  it("leaves neutral, already-gendered and non-category links alone", () => {
    expect(withGender("/category/brand/prada", "all")).toBe("/category/brand/prada");
    expect(withGender("/category/brand/prada?gender=men", "women")).toBe(
      "/category/brand/prada?gender=men"
    );
    expect(withGender("/new", "women")).toBe("/new");
  });
});

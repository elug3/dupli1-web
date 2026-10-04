import { describe, expect, it } from "vitest";

import {
  brandApiName,
  brandToSlug,
  buildCategorySearchParams,
  categoryForFacet,
  categoryListing,
  categoryTitleKey,
  isFeaturedBrandSlug,
} from "./catalog";

describe("Bottega Veneta catalog wiring", () => {
  it("maps display and API names to the brand slug", () => {
    expect(brandToSlug("Bottega Veneta")).toBe("bottega-veneta");
    expect(brandApiName("bottega-veneta")).toBe("Bottega Veneta");
  });

  it("filters search by the upstream brand name", () => {
    expect(buildCategorySearchParams("brand", "bottega-veneta")).toEqual({
      brand: "Bottega Veneta",
    });
  });

  it("uses the featured brand page", () => {
    expect(isFeaturedBrandSlug("bottega-veneta")).toBe(true);
  });
});

describe("padded jackets catalog wiring", () => {
  it("searches clothing's padded subcategory", () => {
    expect(categoryForFacet("product-type", "padded-jackets")).toBe("clothing");
    expect(buildCategorySearchParams("product-type", "padded-jackets")).toEqual({
      subcategory: "padded",
    });
    expect(categoryTitleKey("product-type", "padded-jackets")).toBe("category.paddedJackets");
  });

  it("keeps every other page on bags", () => {
    expect(categoryForFacet("product-type", "totes")).toBe("bags");
    expect(categoryForFacet("brand", "prada")).toBe("bags");
    expect(categoryForFacet("style", "casual")).toBe("bags");
    expect(buildCategorySearchParams("product-type", "totes")).toEqual({ subcategory: "tote" });
  });

  it("points a product's breadcrumb at its category listing", () => {
    expect(categoryListing("clothing").to).toBe("/category/product-type/padded-jackets");
    expect(categoryListing("bags").to).toBe("/category/product-type/handbags");
    expect(categoryListing("").to).toBe("/category/product-type/handbags");
  });
});

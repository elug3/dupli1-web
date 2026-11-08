import { describe, expect, it } from "vitest";

import type { DisplayProduct } from "./api";
import {
  applyListingFilters,
  compareSizes,
  filterOptions,
  listingSortParams,
  parseListingFilters,
  withListingFilter,
  withoutListingFilters,
} from "./listing-filters";

function jacket(id: string, brand: string, gender: string, sizes: string[]): DisplayProduct {
  return {
    id,
    name: id,
    price: 1,
    description: "",
    category: "clothing",
    details: { Brand: brand, Gender: gender },
    sizes,
  };
}

const LISTING = [
  jacket("a", "Moncler", "men", ["M", "L"]),
  jacket("b", "Moncler", "women", ["S", "M"]),
  jacket("c", "Saint Laurent", "all", ["48R", "50"]),
  jacket("d", "Hermes", "kids", ["XS"]),
];

const ids = (products: DisplayProduct[]) => products.map((p) => p.id);

describe("listing filters", () => {
  it("reads the URL and falls back to newest", () => {
    expect(parseListingFilters(new URLSearchParams("size=M&sort=price-asc"))).toEqual({
      size: "M",
      gender: null,
      brand: null,
      sort: "price-asc",
    });
    expect(parseListingFilters(new URLSearchParams("sort=bogus")).sort).toBe("newest");
  });

  it("keeps defaults out of the URL", () => {
    const params = new URLSearchParams("size=M&sort=popular");
    expect(withListingFilter(params, "sort", "newest").toString()).toBe("size=M");
    expect(withListingFilter(params, "size", null).toString()).toBe("sort=popular");
    expect(withoutListingFilters(new URLSearchParams("size=M&brand=x&sort=popular")).toString()).toBe(
      "sort=popular"
    );
  });

  it("maps sorts onto product search", () => {
    expect(listingSortParams("newest")).toEqual({});
    expect(listingSortParams("popular")).toEqual({ sort: "views" });
    expect(listingSortParams("price-desc")).toEqual({ sort: "price", order: "desc" });
  });

  it("filters by size, brand and gender, unisex counting for men and women", () => {
    const filters = parseListingFilters(new URLSearchParams("gender=men"));
    expect(ids(applyListingFilters(LISTING, filters))).toEqual(["a", "c"]);
    expect(
      ids(applyListingFilters(LISTING, parseListingFilters(new URLSearchParams("brand=saint-laurent"))))
    ).toEqual(["c"]);
    expect(
      ids(applyListingFilters(LISTING, parseListingFilters(new URLSearchParams("size=M&gender=women"))))
    ).toEqual(["b"]);
  });

  it("counts options against the other filters, sizes in apparel order", () => {
    const filters = parseListingFilters(new URLSearchParams("brand=moncler"));
    expect(filterOptions(LISTING, filters, "size")).toEqual([
      { value: "S", label: "S", count: 1 },
      { value: "M", label: "M", count: 2 },
      { value: "L", label: "L", count: 1 },
    ]);
    // The brand filter ignores itself, so other brands stay pickable.
    expect(filterOptions(LISTING, filters, "brand").map((o) => o.label)).toEqual([
      "Hermès",
      "Moncler",
      "Saint Laurent",
    ]);
  });

  it("drops a filter that cannot narrow, unless it is set", () => {
    const unisex = [jacket("x", "Moncler", "all", ["M"]), jacket("y", "Moncler", "all", ["M"])];
    const none = parseListingFilters(new URLSearchParams());
    expect(filterOptions(unisex, none, "gender")).toEqual([]);
    expect(filterOptions(unisex, none, "size")).toEqual([]);
    const set = parseListingFilters(new URLSearchParams("size=XL"));
    expect(filterOptions(unisex, set, "size")).toEqual([
      { value: "XL", label: "XL", count: 0 },
      { value: "M", label: "M", count: 2 },
    ]);
  });

  it("orders letter sizes, then Italian sizes by number and fit", () => {
    expect(["50", "48L", "XL", "48", "S", "48S", "48R", "ONE"].sort(compareSizes)).toEqual([
      "S",
      "XL",
      "48S",
      "48",
      "48R",
      "48L",
      "50",
      "ONE",
    ]);
  });
});

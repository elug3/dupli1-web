import { describe, expect, it } from "vitest";

import { facetOptions, isCategoryFacet } from "./catalog";
import {
  NAV_GROUPS,
  VISIBLE_NAV_GROUPS,
  categoryImageQuery,
  picturedNavPaths,
  subjectRowImageTo,
  visiblePicturedItems,
} from "./nav";

function categoryExists(to: string): boolean {
  const [, root, facet, value] = to.split("/");
  return root === "category" && isCategoryFacet(facet) && facetOptions(facet).includes(value);
}

describe("nav tree", () => {
  it("keeps planned subjects out of the menu until they launch", () => {
    const planned = NAV_GROUPS.filter((g) => !g.launched).map((g) => g.id);
    expect(planned).toEqual(expect.arrayContaining(["wallets"]));
    for (const id of planned) {
      expect(VISIBLE_NAV_GROUPS.some((g) => g.id === id)).toBe(false);
    }
  });

  it("lists subjects before facets", () => {
    const kinds = VISIBLE_NAV_GROUPS.map((g) => g.kind);
    expect(kinds.indexOf("facet")).toBeGreaterThan(kinds.lastIndexOf("subject"));
  });

  it("links every visible group and item to a category the catalog knows", () => {
    for (const group of VISIBLE_NAV_GROUPS) {
      expect(categoryExists(group.to), group.to).toBe(true);
      expect(group.items.length).toBeGreaterThan(0);
      for (const item of group.items) expect(categoryExists(item.to), item.to).toBe(true);
    }
  });
});

describe("category image queries", () => {
  it("asks for one most-viewed product in that category", () => {
    expect(categoryImageQuery("/category/product-type/jackets")).toEqual({
      subcategory: "jackets",
      category: "clothing",
      sort: "views",
      limit: 1,
    });
    expect(categoryImageQuery("/category/product-type/handbags")).toMatchObject({
      subcategory: "handbags",
      category: "bags",
      sort: "views",
      limit: 1,
    });
  });

  it("pictures launched subjects only", () => {
    const paths = picturedNavPaths();
    expect(paths).toContain("/category/product-type/jackets");
    expect(paths).toContain("/category/product-type/padded-jackets");
    expect(paths).toContain("/category/product-type/handbags");
    expect(paths.some((path) => path.includes("/brand/"))).toBe(false);
    expect(paths.some((path) => path.includes("wallets"))).toBe(false);
  });
});

describe("empty category tiles", () => {
  const jackets = NAV_GROUPS.find((group) => group.id === "jackets");
  if (!jackets) throw new Error("jackets group missing");

  it("drops a tile the catalog confirmed empty and keeps the rest", () => {
    const visible = visiblePicturedItems(jackets.items, {
      "/category/product-type/jackets": null,
      "/category/product-type/padded-jackets": "https://cdn.example/padded.jpg",
    });
    expect(visible.map((item) => item.to)).toEqual(["/category/product-type/padded-jackets"]);
  });

  it("keeps a tile while its lookup is still unknown", () => {
    const visible = visiblePicturedItems(jackets.items, {});
    expect(visible).toHaveLength(jackets.items.length);
  });

  it("uses a sibling photo when the subject category itself is empty", () => {
    expect(
      subjectRowImageTo(jackets, {
        "/category/product-type/jackets": null,
        "/category/product-type/padded-jackets": "https://cdn.example/padded.jpg",
      })
    ).toBe("/category/product-type/padded-jackets");
  });

  it("hides the subject row when every category in it is empty", () => {
    expect(
      subjectRowImageTo(jackets, {
        "/category/product-type/jackets": null,
        "/category/product-type/padded-jackets": null,
      })
    ).toBeNull();
  });

  it("keeps the group's own category until that lookup is known", () => {
    expect(subjectRowImageTo(jackets, undefined)).toBe(jackets.to);
  });
});

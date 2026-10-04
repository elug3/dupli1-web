import { describe, expect, it } from "vitest";

import { facetOptions, isCategoryFacet } from "./catalog";
import { NAV_GROUPS, VISIBLE_NAV_GROUPS, searchCategories } from "./nav";

function categoryExists(to: string): boolean {
  const [, root, facet, value] = to.split("/");
  return root === "category" && isCategoryFacet(facet) && facetOptions(facet).includes(value);
}

describe("nav tree", () => {
  it("keeps planned subjects out of the menu until they launch", () => {
    const planned = NAV_GROUPS.filter((g) => !g.launched).map((g) => g.id);
    expect(planned).toEqual(expect.arrayContaining(["wallets", "paddedJackets"]));
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

  it("searches only the categories of launched subjects", () => {
    expect(searchCategories()).toEqual(["bags"]);
    const launched = NAV_GROUPS.map((g) => (g.id === "paddedJackets" ? { ...g, launched: true } : g));
    expect(searchCategories(launched)).toEqual(["bags", "clothing"]);
  });
});

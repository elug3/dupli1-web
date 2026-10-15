import { afterEach, describe, expect, it, vi } from "vitest";

import { facetOptions, isCategoryFacet } from "./catalog";
import {
  NAV_GROUPS,
  VISIBLE_NAV_GROUPS,
  clearNavShelfCache,
  navCoverPath,
  navDisplaySrc,
  navGroupDestination,
  navGroupVisible,
  navItemImage,
  navItemVisible,
  navPreloadHrefs,
  resolveNavShelf,
  seedNavShelves,
  visibleNavItems,
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

const JACKETS = "/category/product-type/jackets";
const PADDED = "/category/product-type/padded-jackets";

describe("empty category menus", () => {
  const jackets = VISIBLE_NAV_GROUPS.find((group) => group.id === "jackets");
  if (!jackets) throw new Error("jackets nav group missing");

  it("hides a category that has no products and keeps its stocked siblings", () => {
    const shelves = {
      [JACKETS]: { status: "empty" as const, image: null },
      [PADDED]: { status: "stocked" as const, image: "https://dupli1.com/product-images/pad.jpg" },
    };

    expect(navItemVisible(JACKETS, shelves)).toBe(false);
    expect(visibleNavItems(jackets.items, shelves).map((item) => item.to)).toEqual([PADDED]);
    expect(navGroupVisible(jackets, shelves)).toBe(true);
    expect(navCoverPath(jackets, shelves)).toBe(PADDED);
    expect(navGroupDestination(jackets, shelves)).toBe(PADDED);
  });

  it("hides the whole group when every category in it is empty", () => {
    const shelves = {
      [JACKETS]: { status: "empty" as const, image: null },
      [PADDED]: { status: "empty" as const, image: null },
    };

    expect(navGroupVisible(jackets, shelves)).toBe(false);
    expect(navCoverPath(jackets, shelves)).toBeNull();
  });

  it("keeps the menu when the catalog has not answered or the request failed", () => {
    expect(navGroupVisible(jackets, {})).toBe(true);
    expect(visibleNavItems(jackets.items, {})).toHaveLength(jackets.items.length);
    expect(navCoverPath(jackets, {})).toBe(JACKETS);
    expect(navGroupDestination(jackets, {})).toBe(JACKETS);
    expect(navItemVisible(JACKETS, { [JACKETS]: { status: "unknown", image: null } })).toBe(true);
  });

  it("points a product photo at the startup cache and leaves fallbacks alone", () => {
    expect(navDisplaySrc(PADDED, "https://dupli1.com/product-images/pad.jpg")).toBe(
      `/media/nav-image?to=${encodeURIComponent(PADDED)}`
    );
    expect(navDisplaySrc(PADDED, "/product-images/pad.jpg")).toBe(
      `/media/nav-image?to=${encodeURIComponent(PADDED)}`
    );
    expect(navDisplaySrc(JACKETS, "https://images.unsplash.com/photo-1")).toBe(
      "https://images.unsplash.com/photo-1"
    );
    expect(navDisplaySrc(JACKETS, null)).toBeNull();
  });

  it("preloads only pictured categories that are stocked", () => {
    const hrefs = navPreloadHrefs({
      [JACKETS]: { status: "empty", image: null },
      [PADDED]: { status: "stocked", image: "https://dupli1.com/product-images/pad.jpg" },
      "/category/product-type/handbags": {
        status: "stocked",
        image: "https://images.unsplash.com/photo-bag",
      },
      "/category/brand/prada": {
        status: "stocked",
        image: "https://dupli1.com/product-images/prada.jpg",
      },
    });

    expect(hrefs).toContain(`/media/nav-image?to=${encodeURIComponent(PADDED)}`);
    expect(hrefs).toContain("https://images.unsplash.com/photo-bag");
    expect(hrefs.some((href) => href.includes("prada"))).toBe(false);
    expect(hrefs.some((href) => href.includes(encodeURIComponent(JACKETS)))).toBe(false);
  });
});

describe("nav shelf lookup", () => {
  afterEach(() => {
    clearNavShelfCache();
    vi.unstubAllGlobals();
  });

  it("caches the top product image and reports an empty category", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const empty = String(url).includes("subcategory=jackets");
      return new Response(
        JSON.stringify({
          total: empty ? 0 : 1,
          results: empty
            ? []
            : [
                {
                  id: "p1",
                  name: "Pad",
                  description: "",
                  brand: "Prada",
                  material: "nylon",
                  category: "clothing",
                  defaultListingImageUrl: "http://localhost:8080/product-images/pad.jpg",
                },
              ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const stocked = await resolveNavShelf(PADDED);
    const empty = await resolveNavShelf(JACKETS);

    expect(stocked).toMatchObject({
      status: "stocked",
      image: "http://localhost:8080/product-images/pad.jpg",
    });
    expect(empty).toEqual({ status: "empty", image: null });
    expect(await navItemImage(JACKETS)).toBeNull();

    const calls = fetchMock.mock.calls.length;
    await resolveNavShelf(PADDED);
    expect(fetchMock.mock.calls.length).toBe(calls);
    expect(String(fetchMock.mock.calls[0][0])).toContain("category=clothing");
    expect(String(fetchMock.mock.calls[0][0])).toContain("subcategory=padded");
  });

  it("stays unknown when the catalog is unreachable, and reuses a seeded snapshot", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("offline");
      })
    );

    expect(await resolveNavShelf("/category/product-type/totes")).toEqual({
      status: "unknown",
      image: null,
    });

    clearNavShelfCache();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    seedNavShelves({
      "/category/product-type/totes": { status: "empty", image: null },
    });
    expect(await resolveNavShelf("/category/product-type/totes")).toEqual({
      status: "empty",
      image: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from "vitest";
import type { Bag } from "./api";
import {
  SHELF_FETCH_LIMIT,
  homeCategoryBoxes,
  isOuterwearSeason,
  mergeNewest,
  pickShelf,
} from "./home-shelves";
import { NAV_GROUPS, type NavShelfMap } from "./nav";

function bag(id: string, over: Partial<Bag> = {}): Bag {
  return {
    id,
    name: id,
    description: "",
    price: 1000,
    brand: "Moncler",
    color: "",
    material: "",
    capacity: "",
    stock: 1,
    category: "clothing",
    ...over,
  };
}

const stocked = { status: "stocked", image: null } as const;
const empty = { status: "empty", image: null } as const;

describe("pickShelf", () => {
  const popular = [
    bag("m1", { target: "men" }),
    bag("w1", { target: "women" }),
    bag("w2", { target: "women", brand: "Prada" }),
    bag("u1", { target: "all", brand: "Canada Goose" }),
    bag("w3", { target: "women" }),
    bag("w4", { target: "women", brand: "Loewe" }),
  ];

  it("keeps the other gender out and unisex in", () => {
    const ids = pickShelf(popular, "women").map((b) => b.id);
    expect(ids).toHaveLength(4);
    expect(ids).not.toContain("m1");
    expect(ids).toContain("u1");
  });

  it("spreads the four across brands before repeating one", () => {
    expect(pickShelf(popular, "women").map((b) => b.id)).toEqual(["w1", "w2", "u1", "w4"]);
  });

  it("shows fewer when the mode has fewer", () => {
    expect(pickShelf(popular, "men").map((b) => b.id)).toEqual(["m1", "u1"]);
  });
});

describe("mergeNewest", () => {
  it("orders every category together by listing date", () => {
    const bags = [bag("b-old", { createdAt: "2026-10-01T00:00:00Z" }), bag("b-new", { createdAt: "2026-11-10T00:00:00Z" })];
    const jackets = [bag("j-mid", { createdAt: "2026-11-01T00:00:00Z" }), bag("j-undated")];
    expect(mergeNewest([bags, jackets], "all", 3).map((b) => b.id)).toEqual(["b-new", "j-mid", "b-old"]);
  });

  it("applies the mode and drops repeats", () => {
    const list = [
      bag("w", { target: "women", createdAt: "2026-11-02T00:00:00Z" }),
      bag("m", { target: "men", createdAt: "2026-11-03T00:00:00Z" }),
    ];
    expect(mergeNewest([list, list], "women", 10).map((b) => b.id)).toEqual(["w"]);
  });
});

describe("homeCategoryBoxes", () => {
  const shelves: NavShelfMap = {
    "/category/product-type/handbags": stocked,
    "/category/product-type/totes": stocked,
    "/category/product-type/clothing": stocked,
    "/category/product-type/padded-jackets": stocked,
    "/category/product-type/jackets": empty,
  };

  it("makes one box per launched subject with something to sell", () => {
    const boxes = homeCategoryBoxes(NAV_GROUPS.filter((g) => g.launched), shelves, 5);
    expect(boxes.map((b) => b.id)).toEqual(["bags", "clothing"]);
    expect(boxes[0].query).toMatchObject({ category: "bags", sort: "views", limit: SHELF_FETCH_LIMIT });
  });

  it("names a group after its only stocked shelf", () => {
    const clothing = homeCategoryBoxes(NAV_GROUPS.filter((g) => g.launched), shelves, 5)[1];
    expect(clothing.label).toMatchObject({ labelKey: "category.paddedJackets" });
    expect(clothing.to).toBe("/category/product-type/padded-jackets");
    expect(clothing.query).toMatchObject({ category: "clothing", subcategory: "padded" });
  });

  it("leads with clothing from November to February", () => {
    const launched = NAV_GROUPS.filter((g) => g.launched);
    expect(homeCategoryBoxes(launched, shelves, 10).map((b) => b.id)).toEqual(["clothing", "bags"]);
    expect(homeCategoryBoxes(launched, shelves, 2).map((b) => b.id)).toEqual(["bags", "clothing"]);
    expect([10, 11, 0, 1].every(isOuterwearSeason)).toBe(true);
    expect([2, 6, 9].some(isOuterwearSeason)).toBe(false);
  });

  it("skips a subject whose shelves are all empty", () => {
    const none: NavShelfMap = { ...shelves, "/category/product-type/padded-jackets": empty };
    expect(homeCategoryBoxes(NAV_GROUPS.filter((g) => g.launched), none, 5).map((b) => b.id)).toEqual(["bags"]);
  });
});

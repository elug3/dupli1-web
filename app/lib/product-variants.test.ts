import { describe, expect, it } from "vitest";
import type { ProductVariant, ServerProduct } from "./api";
import {
  defaultVariant,
  isCombinationAvailable,
  isVariantAvailable,
  pickVariant,
  swatchColor,
  variantColors,
  variantSizes,
  withVariant,
} from "./product-variants";

const v = (color: string, size: string, availableQty = 1, images: string[] = []): ProductVariant => ({
  sku: `BAG_${color}_${size}`,
  skuId: `id-${color}-${size}`,
  color,
  size,
  availableQty,
  inStock: availableQty > 0,
  images,
});

// Black comes in S/M/L, Cognac only in M (sold out) and L.
const grid = [v("Black", "M"), v("Black", "S"), v("Black", "L"), v("Cognac", "M", 0), v("Cognac", "L")];

const product: ServerProduct = {
  id: "p1",
  name: "Bag",
  description: "",
  price: 1000,
  brand: "Prada",
  color: "Black",
  material: "Leather",
  stock: 0,
  category: "bags",
  status: "standard",
  createdAt: "",
  sku: "BAG_Black_M",
  skuId: "id-Black-M",
  images: ["/parent.jpg"],
  image: "/parent.jpg",
  variants: grid,
};

describe("variantColors / variantSizes", () => {
  it("lists distinct colors in catalogue order", () => {
    expect(variantColors(grid)).toEqual(["Black", "Cognac"]);
  });

  it("orders sizes S→L", () => {
    expect(variantSizes(grid)).toEqual(["S", "M", "L"]);
  });

  it("hides the size picker for one-size styles", () => {
    expect(variantSizes([v("Black", "OS"), v("Cognac", "OS")])).toEqual([]);
    expect(variantSizes([v("Black", ""), v("Cognac", "")])).toEqual([]);
  });

  it("sorts unknown size labels after known ones", () => {
    expect(variantSizes([v("Black", "25"), v("Black", "M"), v("Black", "20")])).toEqual(["M", "20", "25"]);
  });

  it("orders Italian sizes by number, short to long fit, after letter sizes", () => {
    const sizes = ["48", "100", "36S", "4XL", "48L", "36", "XXXL", "48S", "48R", "XL"];
    expect(variantSizes(sizes.map((s) => v("Black", s)))).toEqual([
      "XL", "XXXL", "4XL", "36S", "36", "48S", "48", "48R", "48L", "100",
    ]);
  });
});

describe("pickVariant", () => {
  const blackM = grid[0];

  it("keeps the size when the new color has it", () => {
    expect(pickVariant(grid, blackM, { color: "Cognac" })?.sku).toBe("BAG_Cognac_M");
  });

  it("falls back to an in-stock variant of the picked color", () => {
    const blackS = grid[1];
    expect(pickVariant(grid, blackS, { color: "Cognac" })?.sku).toBe("BAG_Cognac_L");
  });

  it("keeps the color when the new size has it", () => {
    expect(pickVariant(grid, blackM, { size: "L" })?.sku).toBe("BAG_Black_L");
  });

  it("switches color when the picked size only exists in another", () => {
    const only = [v("Black", "M"), v("Cognac", "L")];
    expect(pickVariant(only, only[0], { size: "L" })?.sku).toBe("BAG_Cognac_L");
  });
});

describe("availability", () => {
  it("reads embedded stock", () => {
    expect(isVariantAvailable(v("Black", "M", 0))).toBe(false);
    expect(isVariantAvailable({ ...v("Black", "M"), availableQty: undefined, inStock: undefined })).toBe(true);
  });

  it("checks a color × size combination", () => {
    expect(isCombinationAvailable(grid, "Cognac", "M")).toBe(false);
    expect(isCombinationAvailable(grid, "Cognac", undefined)).toBe(true);
    expect(isCombinationAvailable(grid, "Cognac", "S")).toBe(false);
  });
});

describe("defaultVariant / withVariant", () => {
  it("opens on the product's default SKU", () => {
    expect(defaultVariant(product)?.sku).toBe("BAG_Black_M");
    expect(defaultVariant({ ...product, skuId: undefined, sku: "BAG_Black_L" })?.sku).toBe("BAG_Black_L");
  });

  it("applies the variant's SKU, stock and color", () => {
    const next = withVariant(product, grid[3]);
    expect(next).toMatchObject({ sku: "BAG_Cognac_M", skuId: "id-Cognac-M", availableQty: 0, inStock: false, color: "Cognac" });
    expect(next.images).toEqual(["/parent.jpg"]);
  });

  it("uses the variant's own images when it has them", () => {
    const next = withVariant(product, v("Cognac", "L", 1, ["/cognac-1.jpg", "/cognac-2.jpg"]));
    expect(next.images).toEqual(["/cognac-1.jpg", "/cognac-2.jpg"]);
    expect(next.image).toBe("/cognac-1.jpg");
  });
});

describe("swatchColor", () => {
  it("maps known names case-insensitively", () => {
    expect(swatchColor("Cognac")).toBe("#a86738");
    expect(swatchColor(" BLACK ")).toBe("#0a0a0a");
  });

  it("returns undefined for unknown names", () => {
    expect(swatchColor("Tangerine Dream")).toBeUndefined();
  });
});

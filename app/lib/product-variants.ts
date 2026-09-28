import type { ProductVariant, ServerProduct } from "./api";

/**
 * Color and size selection for the PDP.
 *
 * A parent product's sellable variants form a color × size grid. The page
 * shows every distinct color as a swatch and every distinct size as a pill;
 * picking one keeps the other when that combination exists, otherwise it
 * falls back to the closest variant in the picked value.
 */

/** Sizes in the order a shopper reads them; unknown labels sort after, A→Z. */
const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "MINI", "SMALL", "MEDIUM", "LARGE"];
/** Labels meaning "the style comes in one size" — no size picker for those. */
const ONE_SIZE = new Set(["", "OS", "ONE SIZE", "ONESIZE", "FREE", "F", "U", "TU"]);

/** Swatch fill for a color name; `undefined` → draw a neutral, labelled swatch. */
const SWATCHES: Record<string, string> = {
  black: "#0a0a0a",
  white: "#ffffff",
  ivory: "#f4efe3",
  cream: "#efe6d2",
  beige: "#d8c3a5",
  sand: "#d6c09c",
  camel: "#b98a56",
  cognac: "#a86738",
  caramel: "#b0703a",
  tan: "#c19a6b",
  brown: "#6b4226",
  chocolate: "#4a2c21",
  "dark brown": "#3b2620",
  burgundy: "#6d1f2c",
  red: "#b3261e",
  pink: "#e8b4bc",
  orange: "#d9772b",
  yellow: "#e6c34a",
  gold: "#c8a96e",
  silver: "#c0c3c7",
  grey: "#8e8e8e",
  gray: "#8e8e8e",
  slate: "#5b6470",
  navy: "#1f2a44",
  blue: "#2f5d9a",
  green: "#3f6b4a",
  khaki: "#8a8458",
  purple: "#5e3d7a",
};

export function swatchColor(color: string): string | undefined {
  return SWATCHES[color.trim().toLowerCase()];
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((v) => v.length > 0))];
}

/** Distinct colors, in catalogue order. */
export function variantColors(variants: ProductVariant[]): string[] {
  return unique(variants.map((v) => v.color));
}

/** Distinct sizes, S→L order; empty when the style is one-size. */
export function variantSizes(variants: ProductVariant[]): string[] {
  const sizes = unique(variants.map((v) => v.size));
  if (sizes.every((size) => ONE_SIZE.has(size.toUpperCase()))) return [];
  const rank = (size: string) => {
    const i = SIZE_ORDER.indexOf(size.toUpperCase());
    return i === -1 ? SIZE_ORDER.length : i;
  };
  return sizes.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

export function isVariantAvailable(variant: ProductVariant): boolean {
  if (typeof variant.availableQty === "number") return variant.availableQty > 0;
  if (typeof variant.inStock === "boolean") return variant.inStock;
  // Stock not embedded: the page polls it once selected; do not grey it out.
  return true;
}

/** The variant a page opens on: the product's default SKU, else the first. */
export function defaultVariant(product: ServerProduct): ProductVariant | undefined {
  const variants = product.variants ?? [];
  return (
    variants.find((v) => (product.skuId ? v.skuId === product.skuId : v.sku === product.sku)) ??
    variants[0]
  );
}

/**
 * The variant to switch to when the shopper picks `color` and/or `size`,
 * keeping the current value of the axis they did not touch when that
 * combination exists; otherwise the first in-stock variant with the picked
 * value, then any variant with it.
 */
export function pickVariant(
  variants: ProductVariant[],
  current: ProductVariant | undefined,
  pick: { color?: string; size?: string }
): ProductVariant | undefined {
  const color = pick.color ?? current?.color;
  const size = pick.size ?? current?.size;
  const exact = variants.find((v) => v.color === color && v.size === size);
  if (exact) return exact;
  const matches = variants.filter((v) =>
    pick.color !== undefined ? v.color === pick.color : v.size === pick.size
  );
  return matches.find(isVariantAvailable) ?? matches[0] ?? current;
}

/** Whether some variant with this color/size combination exists and has stock. */
export function isCombinationAvailable(
  variants: ProductVariant[],
  color: string | undefined,
  size: string | undefined
): boolean {
  return variants.some(
    (v) =>
      (color === undefined || v.color === color) &&
      (size === undefined || v.size === size) &&
      isVariantAvailable(v)
  );
}

/**
 * The product as the rest of the page sees it with `variant` selected: its
 * SKU goes to the cart, its stock to the buy buttons, its size and images to
 * the details and the gallery.
 */
export function withVariant(product: ServerProduct, variant: ProductVariant | undefined): ServerProduct {
  if (!variant) return product;
  return {
    ...product,
    sku: variant.sku,
    skuId: variant.skuId,
    availableQty: variant.availableQty,
    inStock: variant.inStock,
    dimensions: variant.dimensions ?? product.dimensions,
    color: variant.color || product.color,
    images: variant.images.length > 0 ? variant.images : product.images,
    image: variant.images[0] ?? product.image,
  };
}

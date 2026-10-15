import { type BagSearchFilters, fetchBags, listingProductImage } from "./api";
import { buildCategorySearchParams, categoryForFacet, isCategoryFacet } from "./catalog";

export type NavItem = { to: string } & ({ labelKey: string } | { label: string });

export interface NavGroup {
  id: string;
  labelKey: string;
  /** Where "View all" goes, and whose top product is a subject's image. */
  to: string;
  /**
   * A subject is a kind of thing we sell (bags, wallets, padded jackets) and
   * gets a picture in the menu; a facet (brand, style) cuts across subjects
   * and stays a text row.
   */
  kind: "subject" | "facet";
  /** False while a subject is planned but not on sale: nothing renders it. */
  launched: boolean;
  items: NavItem[];
}

/**
 * The storefront's category tree: the menu drawer and the footer read it.
 * Subjects come first, in the order they appear in the menu.
 *
 * Launching a planned subject: add its slugs to PRODUCT_TYPE_SLUGS and
 * PRODUCT_TYPE_TO_SUBCATEGORY (catalog.ts) with the subcategory codes product
 * uses, PRODUCT_TYPE_TO_CATEGORY when it is not a bag, a title in
 * categoryTitleKey, fill in `items`, then set `launched`.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "bags",
    labelKey: "nav.bags",
    to: "/category/product-type/handbags",
    kind: "subject",
    launched: true,
    items: [
      { labelKey: "home.categoryBags", to: "/category/product-type/handbags" },
      { labelKey: "category.totes", to: "/category/product-type/totes" },
      { labelKey: "category.shoulderBags", to: "/category/product-type/shoulder-bags" },
      { labelKey: "category.crossbody", to: "/category/product-type/crossbody" },
      { labelKey: "category.miniBags", to: "/category/product-type/mini-bags" },
    ],
  },
  {
    id: "wallets",
    labelKey: "nav.wallets",
    to: "/category/product-type/wallets",
    kind: "subject",
    launched: false,
    items: [],
  },
  {
    id: "jackets",
    labelKey: "nav.jackets",
    to: "/category/product-type/jackets",
    kind: "subject",
    launched: true,
    items: [
      { labelKey: "category.jackets", to: "/category/product-type/jackets" },
      { labelKey: "category.paddedJackets", to: "/category/product-type/padded-jackets" },
    ],
  },
  {
    id: "brand",
    labelKey: "nav.brand",
    to: "/category/brand/louis-vuitton",
    kind: "facet",
    launched: true,
    items: [
      { label: "Louis Vuitton", to: "/category/brand/louis-vuitton" },
      { label: "Miu Miu", to: "/category/brand/miu-miu" },
      { label: "Balenciaga", to: "/category/brand/balenciaga" },
      { label: "Bottega Veneta", to: "/category/brand/bottega-veneta" },
      { label: "Chanel", to: "/category/brand/chanel" },
      { label: "Hermès", to: "/category/brand/hermes" },
      { label: "Loewe", to: "/category/brand/loewe" },
      { label: "Prada", to: "/category/brand/prada" },
      { label: "Saint Laurent", to: "/category/brand/ysl" },
    ],
  },
  {
    id: "style",
    labelKey: "nav.style",
    to: "/category/style/casual",
    kind: "facet",
    launched: true,
    items: [
      { labelKey: "category.casual", to: "/category/style/casual" },
      { labelKey: "category.evening", to: "/category/style/evening" },
      { labelKey: "category.business", to: "/category/style/business" },
      { labelKey: "category.weekend", to: "/category/style/weekend" },
      { labelKey: "category.statement", to: "/category/style/statement" },
    ],
  },
];

/** The groups a shopper sees: planned subjects stay out until they launch. */
export const VISIBLE_NAV_GROUPS: NavGroup[] = NAV_GROUPS.filter((g) => g.launched);

export function navItemLabel(item: NavItem, t: (key: string) => string): string {
  return "labelKey" in item ? t(item.labelKey) : item.label;
}

/**
 * Category paths that render a product photo: launched subject rows and
 * their tiles. Brand and style stay text, so they are not pictured.
 */
export function picturedNavPaths(): string[] {
  const paths = new Set<string>();
  for (const group of VISIBLE_NAV_GROUPS) {
    if (group.kind !== "subject") continue;
    paths.add(group.to);
    for (const item of group.items) paths.add(item.to);
  }
  return [...paths];
}

/** Search for the single most-viewed product that represents `to`. */
export function categoryImageQuery(to: string): BagSearchFilters | null {
  const [, , facet, value] = to.split("/");
  if (!facet || !isCategoryFacet(facet)) return null;
  return {
    ...(buildCategorySearchParams(facet, value) as BagSearchFilters),
    category: categoryForFacet(facet, value),
    sort: "views",
    limit: 1,
  };
}

/**
 * Startup cache of category photos. `null` means the category was looked up
 * and has no product; a missing key means we do not know yet.
 */
export type NavImageMap = Record<string, string | null>;

export function navImageFromMap(
  images: NavImageMap | undefined,
  to: string
): string | null | undefined {
  if (!images || !Object.prototype.hasOwnProperty.call(images, to)) return undefined;
  return images[to];
}

/** True only when the catalog confirmed this category has no product. */
export function navTargetEmpty(images: NavImageMap | undefined, to: string): boolean {
  return navImageFromMap(images, to) === null;
}

/** Drop tiles whose category has no product. Unknown lookups stay visible. */
export function visiblePicturedItems<T extends { to: string }>(
  items: T[],
  images: NavImageMap | undefined
): T[] {
  return items.filter((item) => !navTargetEmpty(images, item.to));
}

/**
 * Thumbnail path for a side-nav subject row.
 * Prefers the group's own category, then the first child that has a product,
 * so an empty subcategory does not leave a blank row while a sibling is on
 * sale. Returns null when every pictured category in the group is empty —
 * that row is the menu for a category with nothing to sell.
 */
export function subjectRowImageTo(
  group: NavGroup,
  images: NavImageMap | undefined
): string | null {
  const targets = [...new Set([group.to, ...group.items.map((item) => item.to)])];
  if (targets.length > 0 && targets.every((to) => navTargetEmpty(images, to))) return null;
  // Unknown still uses the group's own category; only a confirmed empty one
  // falls through to a sibling that has (or might have) a product.
  if (!navTargetEmpty(images, group.to)) return group.to;
  const pictured = group.items.find((item) => images?.[item.to]);
  if (pictured) return pictured.to;
  const pending = group.items.find((item) => !navTargetEmpty(images, item.to));
  return pending?.to ?? null;
}

// Same-page fallback when the startup cache has no entry for a path. The
// day-long cache lives on the server and arrives with the root loader.
const imageCache = new Map<string, Promise<string | null>>();

/**
 * The most viewed product in a category, as the image for its menu tile.
 * Resolves to null when the category is empty or the catalog is unreachable.
 */
export function navItemImage(to: string): Promise<string | null> {
  const cached = imageCache.get(to);
  if (cached) return cached;

  const query = categoryImageQuery(to);
  const request = query
    ? fetchBags(query)
        .then((bags) =>
          bags[0] ? listingProductImage(bags[0].category, bags[0].brand, bags[0].image) : null
        )
        .catch(() => null)
    : Promise.resolve(null);

  imageCache.set(to, request);
  return request;
}

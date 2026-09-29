import { type BagSearchFilters, fetchBags, listingBagImage } from "./api";
import { buildCategorySearchParams, isCategoryFacet } from "./catalog";

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
 * uses, a title in categoryTitleKey, fill in `items`, then set `launched`.
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
    id: "paddedJackets",
    labelKey: "nav.paddedJackets",
    to: "/category/product-type/padded-jackets",
    kind: "subject",
    launched: false,
    items: [],
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

// One request per item, once per page load: the drawer asks again only for
// items it has not seen.
const imageCache = new Map<string, Promise<string | null>>();

/**
 * The most viewed product in a category, as the image for its menu tile.
 * Resolves to null when the category is empty or the catalog is unreachable.
 */
export function navItemImage(to: string): Promise<string | null> {
  const cached = imageCache.get(to);
  if (cached) return cached;

  const [, , facet, value] = to.split("/");
  const request =
    facet && isCategoryFacet(facet)
      ? fetchBags({
          ...(buildCategorySearchParams(facet, value) as BagSearchFilters),
          sort: "views",
          limit: 1,
        })
          .then((bags) => (bags[0] ? listingBagImage(bags[0].brand, bags[0].image) : null))
          .catch(() => null)
      : Promise.resolve(null);

  imageCache.set(to, request);
  return request;
}

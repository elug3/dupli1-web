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
 * Whether a menu category has anything to sell.
 * `unknown` means the catalog did not answer — the menu stays up.
 * `empty` is a real zero and is the only status that hides a menu.
 */
export type NavShelfStatus = "stocked" | "empty" | "unknown";

export interface NavShelf {
  status: NavShelfStatus;
  /** Listing image of the most viewed product, when status is `stocked`. */
  image: string | null;
}

export type NavShelfMap = Readonly<Record<string, NavShelf | undefined>>;

/** One search for a menu path: most viewed product in that category. */
export function navCategoryQuery(to: string): BagSearchFilters | null {
  const [, , facet, value] = to.split("/");
  if (!facet || !value || !isCategoryFacet(facet)) return null;
  const filters = buildCategorySearchParams(facet, value);
  if (Object.values(filters).some((filter) => filter.toLowerCase() === "__no_match__")) {
    return null;
  }
  return {
    ...(filters as BagSearchFilters),
    category: categoryForFacet(facet, value),
    sort: "views",
    limit: 1,
  };
}

export function shelfFromProduct(
  product: { category: string; brand: string; image?: string } | null
): NavShelf {
  if (!product) return { status: "empty", image: null };
  return {
    status: "stocked",
    image: listingProductImage(product.category, product.brand, product.image),
  };
}

/** Every category the menu, home tiles, and footer can point at. */
export function navPaths(groups: readonly NavGroup[] = VISIBLE_NAV_GROUPS): string[] {
  const paths = new Set<string>();
  for (const group of groups) {
    paths.add(group.to);
    for (const item of group.items) paths.add(item.to);
  }
  return [...paths];
}

export function isNavPath(to: string): boolean {
  return navPaths().includes(to);
}

/**
 * Subject rows and their tiles are the pictures on the home page and in the
 * closed menu, so those are the images worth downloading before first paint.
 */
export function navPicturedPaths(groups: readonly NavGroup[] = VISIBLE_NAV_GROUPS): string[] {
  const paths: string[] = [];
  for (const group of groups) {
    if (group.kind !== "subject") continue;
    paths.push(group.to);
    for (const item of group.items) paths.push(item.to);
  }
  return paths;
}

/** Product photos live on the catalog CDN. Everything else is a fallback. */
export function isCatalogProductImage(url: string): boolean {
  const path = url.startsWith("/") ? url : imagePathname(url);
  return path.includes("/product-images/");
}

function imagePathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
}

/**
 * Same-origin URL for a cached product photo. Fallbacks (no catalog file)
 * stay on their own host.
 */
export function navDisplaySrc(to: string, image: string | null): string | null {
  if (!image) return null;
  if (!isCatalogProductImage(image)) return image;
  return `/media/nav-image?to=${encodeURIComponent(to)}`;
}

/** Preload hrefs for pictured categories the catalog has already stocked. */
export function navPreloadHrefs(shelves: NavShelfMap): string[] {
  const hrefs: string[] = [];
  const seen = new Set<string>();
  for (const to of navPicturedPaths()) {
    const shelf = shelves[to];
    if (shelf?.status !== "stocked") continue;
    const href = navDisplaySrc(to, shelf.image);
    if (!href || seen.has(href)) continue;
    seen.add(href);
    hrefs.push(href);
  }
  return hrefs;
}

/** Known-empty categories drop out. A missing or failed lookup stays visible. */
export function navItemVisible(to: string, shelves: NavShelfMap): boolean {
  return shelves[to]?.status !== "empty";
}

export function visibleNavItems<T extends { to: string }>(
  items: readonly T[],
  shelves: NavShelfMap
): T[] {
  return items.filter((item) => navItemVisible(item.to, shelves));
}

/** A group stays while any of its categories might still have products. */
export function navGroupVisible(group: NavGroup, shelves: NavShelfMap): boolean {
  const items = group.items.length > 0 ? group.items : [{ to: group.to }];
  return items.some((item) => navItemVisible(item.to, shelves));
}

export function visibleNavGroups(groups: readonly NavGroup[], shelves: NavShelfMap): NavGroup[] {
  return groups.filter((group) => navGroupVisible(group, shelves));
}

/**
 * Picture for a subject row. Prefer that row's own category; when it is
 * empty, the first category under it that still has a product (padded
 * jackets covering an empty jackets row).
 */
export function navCoverPath(group: NavGroup, shelves: NavShelfMap): string | null {
  if (shelves[group.to]?.status === "stocked") return group.to;
  const stocked = group.items.find((item) => shelves[item.to]?.status === "stocked");
  if (stocked) return stocked.to;
  if (shelves[group.to]?.status === "empty") {
    const other = group.items.find(
      (item) => item.to !== group.to && shelves[item.to]?.status !== "empty"
    );
    return other?.to ?? null;
  }
  return group.to;
}

/** Where the group's "view all" goes once empty categories are set aside. */
export function navGroupDestination(group: NavGroup, shelves: NavShelfMap): string {
  if (shelves[group.to]?.status !== "empty") return group.to;
  const stocked = group.items.find((item) => shelves[item.to]?.status === "stocked");
  if (stocked) return stocked.to;
  const other = group.items.find((item) => shelves[item.to]?.status !== "empty");
  return other?.to ?? group.to;
}

// One request per category, for the life of the page. The server warms the
// same answers at startup and ships them in the root loader; this map covers
// whatever that snapshot did not include.
const shelfCache = new Map<string, Promise<NavShelf>>();

/** Test hook: drop cached category lookups so the next resolve hits fetch. */
export function clearNavShelfCache(): void {
  shelfCache.clear();
}

export function seedNavShelves(shelves: NavShelfMap): void {
  for (const [to, shelf] of Object.entries(shelves)) {
    if (shelf && !shelfCache.has(to)) shelfCache.set(to, Promise.resolve(shelf));
  }
}

export function resolveNavShelf(to: string): Promise<NavShelf> {
  const cached = shelfCache.get(to);
  if (cached) return cached;

  const query = navCategoryQuery(to);
  const request = query
    ? fetchBags(query)
        .then((bags) => shelfFromProduct(bags[0] ?? null))
        .catch(() => ({ status: "unknown" as const, image: null }))
    : Promise.resolve<NavShelf>({ status: "empty", image: null });

  shelfCache.set(to, request);
  return request;
}

/**
 * The most viewed product in a category, as the image for its menu tile.
 * Resolves to null when the category is empty or the catalog is unreachable.
 */
export function navItemImage(to: string): Promise<string | null> {
  return resolveNavShelf(to).then((shelf) => (shelf.status === "stocked" ? shelf.image : null));
}

/** Fill any category the root snapshot did not already answer. */
export function warmNavShelves(paths: readonly string[] = navPaths()): Promise<Record<string, NavShelf>> {
  return Promise.all(
    paths.map(async (to) => [to, await resolveNavShelf(to)] as const)
  ).then((entries) => Object.fromEntries(entries));
}

/** Ask the browser to fetch pictured category images into its HTTP cache. */
export function preloadNavImages(shelves: NavShelfMap): void {
  if (typeof window === "undefined") return;
  for (const href of navPreloadHrefs(shelves)) {
    const img = new Image();
    img.decoding = "async";
    img.src = href;
  }
}

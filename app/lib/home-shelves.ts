import { type Bag, type BagSearchFilters, diversifyBagsByBrand } from "./api";
import { STOREFRONT_CATEGORIES } from "./catalog";
import { type GenderMode, matchesGender } from "./gender";
import {
  type NavGroup,
  type NavShelfMap,
  navCategoryQuery,
  navGroupDestination,
  visibleNavItems,
} from "./nav";

/** Products a home shelf shows: one grid row on desktop, two on phones. */
export const SHELF_SIZE = 4;

/**
 * How many products a shelf asks for. Gender is applied here, over the
 * answer (product search matches `target` exactly and would drop unisex), so
 * the request is wide enough to leave four after the other gender is set aside.
 */
export const SHELF_FETCH_LIMIT = 48;

/** New arrivals page length. */
export const NEW_ARRIVALS_SIZE = 48;

/** The products of a mode, in the order the catalog returned them. */
export function forGender(bags: readonly Bag[], mode: GenderMode): Bag[] {
  return bags.filter((bag) => matchesGender(bag.target, mode));
}

/** Four for a category box: the mode's most popular, spread across brands. */
export function pickShelf(bags: readonly Bag[], mode: GenderMode, size = SHELF_SIZE): Bag[] {
  return diversifyBagsByBrand(forGender(bags, mode), size);
}

function listedAt(bag: Bag): number {
  const time = bag.createdAt ? Date.parse(bag.createdAt) : NaN;
  return Number.isNaN(time) ? 0 : time;
}

/**
 * Newest first across every category we sell: each category is searched on
 * its own, so the lists are merged here by listing date.
 */
export function mergeNewest(
  lists: readonly (readonly Bag[])[],
  mode: GenderMode,
  size: number
): Bag[] {
  const seen = new Set<string>();
  const merged: Bag[] = [];
  for (const list of lists) {
    for (const bag of forGender(list, mode)) {
      if (seen.has(bag.id)) continue;
      seen.add(bag.id);
      merged.push(bag);
    }
  }
  return merged.sort((a, b) => listedAt(b) - listedAt(a)).slice(0, size);
}

/** One search per category for the newest products. */
export function newestQueries(limit: number): BagSearchFilters[] {
  return STOREFRONT_CATEGORIES.map((category) => ({ category, sort: "newest", limit }));
}

export interface CategoryBox {
  id: string;
  /** The box's heading: a group, or its one shelf when it has only one. */
  label: { labelKey: string } | { label: string };
  /** Where "view all" goes (before the mode is applied). */
  to: string;
  query: BagSearchFilters;
}

/** November to February: the months outerwear leads the home page. */
export function isOuterwearSeason(month: number): boolean {
  return month === 10 || month === 11 || month === 0 || month === 1;
}

/**
 * The home page's category boxes, read from the menu's tree so a subject that
 * launches (wallets) gets its box that day. A group with a single stocked
 * shelf is named after that shelf (의류 holding only 패딩 reads "패딩").
 * Clothing comes first in the cold months, bags first otherwise.
 */
export function homeCategoryBoxes(
  groups: readonly NavGroup[],
  shelves: NavShelfMap,
  month: number
): CategoryBox[] {
  const boxes: CategoryBox[] = [];
  for (const group of groups) {
    if (group.kind !== "subject") continue;
    const items = visibleNavItems(group.items, shelves);
    if (items.length === 0) continue;
    const single = items.length === 1 ? items[0] : null;
    const to = single ? single.to : navGroupDestination(group, shelves);
    const query = navCategoryQuery(to);
    if (!query) continue;
    boxes.push({
      id: group.id,
      label: single ?? { labelKey: group.labelKey },
      to,
      query: { ...query, sort: "views", limit: SHELF_FETCH_LIMIT },
    });
  }
  if (isOuterwearSeason(month)) {
    boxes.sort((a, b) => Number(b.id === "clothing") - Number(a.id === "clothing"));
  }
  return boxes;
}

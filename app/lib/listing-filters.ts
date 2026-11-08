import type { DisplayProduct } from "./api";
import { brandDisplayName, normalizeBrandKey } from "./catalog";

/**
 * The filters and sort on a category listing, kept in the URL query so a
 * filtered page can be shared: `?size=M&gender=men&brand=moncler&sort=price-asc`.
 *
 * Sort goes to product search (`sort`/`order`). Filters run here over the
 * listing already loaded, so every option shown has products behind it.
 */
export interface ListingFilters {
  size: string | null;
  gender: string | null;
  brand: string | null;
  sort: ListingSort;
}

export const LISTING_SORTS = ["newest", "popular", "price-asc", "price-desc"] as const;

export type ListingSort = (typeof LISTING_SORTS)[number];

export const SORT_LABEL_KEYS: Record<ListingSort, string> = {
  newest: "sort.newest",
  popular: "sort.popular",
  "price-asc": "sort.priceAsc",
  "price-desc": "sort.priceDesc",
};

export const FILTER_KEYS = ["size", "gender", "brand"] as const;

export type FilterKey = (typeof FILTER_KEYS)[number];

/** Upstream `target` codes a shopper can pick; `all` (unisex) matches men and women. */
const GENDERS = ["women", "men", "kids"] as const;

export const GENDER_LABEL_KEYS: Record<string, string> = {
  women: "category.women",
  men: "category.men",
  kids: "category.kids",
};

export function parseListingFilters(params: URLSearchParams): ListingFilters {
  const sort = params.get("sort");
  return {
    size: params.get("size") || null,
    gender: params.get("gender") || null,
    brand: params.get("brand") || null,
    sort: (LISTING_SORTS as readonly string[]).includes(sort ?? "")
      ? (sort as ListingSort)
      : "newest",
  };
}

/** The query for a changed filter; the default sort and "all" leave the URL. */
export function withListingFilter(
  params: URLSearchParams,
  key: FilterKey | "sort",
  value: string | null
): URLSearchParams {
  const next = new URLSearchParams(params);
  if (!value || (key === "sort" && value === "newest")) next.delete(key);
  else next.set(key, value);
  return next;
}

export function withoutListingFilters(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of FILTER_KEYS) next.delete(key);
  return next;
}

export function hasActiveFilters(filters: ListingFilters): boolean {
  return FILTER_KEYS.some((key) => filters[key] !== null);
}

/** Product search params for a sort. */
export function listingSortParams(sort: ListingSort): Record<string, string> {
  switch (sort) {
    case "newest":
      return {};
    case "popular":
      return { sort: "views" };
    case "price-asc":
      return { sort: "price", order: "asc" };
    case "price-desc":
      return { sort: "price", order: "desc" };
  }
}

/** URL value for a brand: `Saint Laurent` → `saint-laurent`, accents dropped. */
export function brandFilterValue(brand: string): string {
  return normalizeBrandKey(brand).replace(/\s+/g, "-");
}

function productBrand(product: DisplayProduct): string {
  return String(product.details.Brand ?? "").trim();
}

function productGender(product: DisplayProduct): string {
  return String(product.details.Gender ?? "").trim().toLowerCase();
}

function matches(product: DisplayProduct, key: FilterKey, value: string): boolean {
  switch (key) {
    case "size":
      return (product.sizes ?? []).includes(value);
    case "gender": {
      const gender = productGender(product);
      return gender === value || (gender === "all" && value !== "kids");
    }
    case "brand":
      return brandFilterValue(productBrand(product)) === value;
  }
}

function applyExcept(
  products: readonly DisplayProduct[],
  filters: ListingFilters,
  skip: FilterKey | null
): DisplayProduct[] {
  return products.filter((product) =>
    FILTER_KEYS.every((key) => {
      const value = filters[key];
      return key === skip || value === null || matches(product, key, value);
    })
  );
}

export function applyListingFilters(
  products: readonly DisplayProduct[],
  filters: ListingFilters
): DisplayProduct[] {
  return applyExcept(products, filters, null);
}

export interface FilterOption {
  value: string;
  /** Shown as is (sizes, brands) or a translation key (genders). */
  label: string;
  count: number;
}

const LETTER_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "4XL"];
const FITS = ["S", "", "R", "L"];

/**
 * Clothing size order (dupli1 `domain.ApparelSizes`): letter sizes, then
 * Italian 34–60 by number and fit (48S, 48, 48R, 48L). Unknown codes last.
 */
export function compareSizes(a: string, b: string): number {
  return sizeRank(a) - sizeRank(b) || a.localeCompare(b);
}

function sizeRank(size: string): number {
  const letter = LETTER_SIZES.indexOf(size.toUpperCase());
  if (letter >= 0) return letter;
  const italian = /^(\d+)([SRL]?)$/i.exec(size);
  if (italian) {
    return 100 + Number(italian[1]) * FITS.length + FITS.indexOf(italian[2].toUpperCase());
  }
  return 10_000;
}

/**
 * The options for one filter, counted against the listing with every other
 * filter applied. A filter that cannot narrow the listing is left out, unless
 * the shopper has it set and needs it to clear.
 */
export function filterOptions(
  products: readonly DisplayProduct[],
  filters: ListingFilters,
  key: FilterKey
): FilterOption[] {
  const pool = applyExcept(products, filters, key);
  const counts = new Map<string, FilterOption>();
  const add = (value: string, label: string) => {
    const option = counts.get(value);
    if (option) option.count += 1;
    else counts.set(value, { value, label, count: 1 });
  };

  for (const product of pool) {
    switch (key) {
      case "size":
        for (const size of new Set(product.sizes ?? [])) add(size, size);
        break;
      case "gender":
        for (const gender of GENDERS) {
          if (matches(product, "gender", gender)) add(gender, GENDER_LABEL_KEYS[gender]);
        }
        break;
      case "brand": {
        const brand = productBrand(product);
        if (brand) add(brandFilterValue(brand), brandDisplayName(brand));
        break;
      }
    }
  }

  let options = [...counts.values()];
  switch (key) {
    case "size":
      options.sort((a, b) => compareSizes(a.value, b.value));
      break;
    case "gender":
      options.sort(
        (a, b) =>
          GENDERS.indexOf(a.value as (typeof GENDERS)[number]) -
          GENDERS.indexOf(b.value as (typeof GENDERS)[number])
      );
      break;
    case "brand":
      options.sort((a, b) => a.label.localeCompare(b.label));
      break;
  }

  // A value from a shared link that nothing has any more stays, to clear.
  const selected = filters[key];
  if (selected !== null && !counts.has(selected)) {
    options.unshift({
      value: selected,
      label: key === "gender" ? (GENDER_LABEL_KEYS[selected] ?? selected) : selected,
      count: 0,
    });
  }

  // A men-only option over a listing that is all unisex picks everything.
  const narrows = options.some((option) => option.count < pool.length);
  if (!narrows && filters[key] === null) options = [];
  return options;
}

export const BRAND_SLUGS: Record<string, string> = {
  "louis-vuitton": "Louis Vuitton",
  "miu-miu": "Miu Miu",
  balenciaga: "Balenciaga",
  chanel: "Chanel",
  hermes: "Hermès",
  loewe: "Loewe",
  prada: "Prada",
  ysl: "Saint Laurent",
};

/**
 * Upstream catalog brand filter values. Display names in BRAND_SLUGS may use
 * typographic accents (Hermès) while the product service seeds ASCII names
 * (Hermes) — filters must match the seeded name for ILIKE/contains search.
 */
export const BRAND_API_NAMES: Record<string, string> = {
  "louis-vuitton": "Louis Vuitton",
  "miu-miu": "Miu Miu",
  balenciaga: "Balenciaga",
  chanel: "Chanel",
  hermes: "Hermes",
  loewe: "Loewe",
  prada: "Prada",
  ysl: "Saint Laurent",
};

/** Brand pages that render a dedicated full-bleed brand hero. */
export const FEATURED_BRAND_SLUGS = [
  "louis-vuitton",
  "hermes",
  "prada",
] as const;

export type FeaturedBrandSlug = (typeof FEATURED_BRAND_SLUGS)[number];

export const BRAND_LOGOS: Record<string, string> = {
  "louis-vuitton": "/brands/louis-vuitton.svg",
  "miu-miu": "/brands/miu-miu.svg",
  balenciaga: "/brands/balenciaga.svg",
  chanel: "/brands/chanel.svg",
  hermes: "/brands/hermes.svg",
  loewe: "/brands/loewe.svg",
  prada: "/brands/prada.svg",
  ysl: "/brands/saint-laurent.svg",
};

export const PRODUCT_TYPE_SLUGS: Record<string, string> = {
  handbags: "",
  totes: "Totes",
  "shoulder-bags": "Shoulder Bags",
  crossbody: "Crossbody",
  "mini-bags": "Mini Bags",
};

/**
 * URL slug → upstream `subcategory` code (elug3/dupli1#128).
 * Distinct from legacy display labels in PRODUCT_TYPE_SLUGS.
 */
export const PRODUCT_TYPE_TO_SUBCATEGORY: Record<string, string> = {
  handbags: "handbags",
  totes: "tote",
  "shoulder-bags": "shoulder",
  crossbody: "cross",
  "mini-bags": "mini",
};

export const STYLE_SLUGS: Record<string, string> = {
  casual: "Casual",
  evening: "Evening",
  business: "Business",
  weekend: "Weekend",
  statement: "Statement",
};

export const FAMILY_SLUGS: Record<string, string> = {
  women: "Women",
  men: "Men",
  kids: "Kids",
  unisex: "Unisex",
  all: "All",
};

/** URL slug → upstream `target` code (elug3/dupli1#128 + #130 `all`). */
export const FAMILY_TO_TARGET: Record<string, string | null> = {
  women: "women",
  men: "men",
  kids: "kids",
  /** Storefront “Unisex” maps to merchandising target `all`. */
  unisex: "all",
  all: "all",
};

export type CategoryFacet = "product-type" | "brand" | "style" | "family";

export function isCategoryFacet(facet: string): facet is CategoryFacet {
  return (
    facet === "product-type" ||
    facet === "brand" ||
    facet === "style" ||
    facet === "family"
  );
}

/** Accent-insensitive brand key for matching Hermes / Hermès. */
export function normalizeBrandKey(brand: string): string {
  return brand
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

export function brandsMatch(a: string, b: string): boolean {
  return normalizeBrandKey(a) === normalizeBrandKey(b);
}

export function brandApiName(slug: string): string | undefined {
  return BRAND_API_NAMES[slug] ?? BRAND_SLUGS[slug];
}

export function isFeaturedBrandSlug(slug: string): slug is FeaturedBrandSlug {
  return (FEATURED_BRAND_SLUGS as readonly string[]).includes(slug);
}

export function brandBlurbKey(slug: string): string | null {
  if (!isFeaturedBrandSlug(slug)) return null;
  return `brand.${slug}.blurb`;
}

export function buildCategorySearchParams(
  facet: CategoryFacet,
  value?: string
): Record<string, string> {
  if (!value) return {};

  switch (facet) {
    case "brand": {
      const brand = brandApiName(value);
      return brand ? { brand } : { brand: "__no_match__" };
    }
    case "product-type": {
      if (!(value in PRODUCT_TYPE_TO_SUBCATEGORY)) {
        return { subcategory: "__no_match__" };
      }
      return { subcategory: PRODUCT_TYPE_TO_SUBCATEGORY[value] };
    }
    case "style": {
      if (!(value in STYLE_SLUGS)) return { style: "__no_match__" };
      // Upstream expects taxonomy codes (casual), not display names (Casual).
      return { style: value };
    }
    case "family": {
      if (!(value in FAMILY_TO_TARGET)) return { target: "__no_match__" };
      const target = FAMILY_TO_TARGET[value];
      return target ? { target } : { target: "__no_match__" };
    }
  }
}

export function categoryTitleKey(
  facet: CategoryFacet,
  value?: string
): string | null {
  if (!value) {
    switch (facet) {
      case "product-type":
        return "home.categoryBags";
      case "brand":
        return "nav.brand";
      case "style":
        return "nav.style";
      case "family":
        return "nav.family";
    }
  }

  switch (facet) {
    case "brand":
      return null;
    case "product-type":
      if (value === "handbags") return "home.categoryBags";
      if (value === "totes") return "category.totes";
      if (value === "shoulder-bags") return "category.shoulderBags";
      if (value === "crossbody") return "category.crossbody";
      if (value === "mini-bags") return "category.miniBags";
      return "home.categoryBags";
    case "style":
      return value && value in STYLE_SLUGS ? `category.${value}` : "nav.style";
    case "family":
      return value && value in FAMILY_SLUGS ? `category.${value}` : "nav.family";
  }
}

export function facetOptions(facet: CategoryFacet): string[] {
  switch (facet) {
    case "product-type":
      return Object.keys(PRODUCT_TYPE_SLUGS);
    case "brand":
      return Object.keys(BRAND_SLUGS);
    case "style":
      return Object.keys(STYLE_SLUGS);
    case "family":
      return Object.keys(FAMILY_SLUGS);
  }
}

export function productMatchesFacetValue(
  details: Record<string, string | number>,
  facet: CategoryFacet,
  value: string
): boolean {
  const get = (key: string) => String(details[key] ?? "");

  switch (facet) {
    case "brand": {
      const expected = brandApiName(value) ?? BRAND_SLUGS[value] ?? value;
      return brandsMatch(get("Brand"), expected);
    }
    case "product-type": {
      const code = PRODUCT_TYPE_TO_SUBCATEGORY[value];
      if (!code) return false;
      const actual = get("Type") || get("SubCategory");
      return actual.toLowerCase() === code.toLowerCase();
    }
    case "style": {
      if (!(value in STYLE_SLUGS)) return false;
      const actual = get("Style");
      return actual.toLowerCase() === value.toLowerCase();
    }
    case "family": {
      const target = FAMILY_TO_TARGET[value];
      if (!target) return false;
      const actual = get("Gender") || get("Target");
      return actual.toLowerCase() === target.toLowerCase();
    }
  }
}

export function brandToSlug(brand: string): string | null {
  const key = normalizeBrandKey(brand);
  const fromApi = Object.entries(BRAND_API_NAMES).find(
    ([, name]) => normalizeBrandKey(name) === key
  );
  if (fromApi) return fromApi[0];

  const fromDisplay = Object.entries(BRAND_SLUGS).find(
    ([, name]) => normalizeBrandKey(name) === key
  );
  return fromDisplay?.[0] ?? null;
}

/** Prefer typographic display names (Hermès) over upstream ASCII (Hermes). */
export function brandDisplayName(brandOrSlug: string): string {
  if (BRAND_SLUGS[brandOrSlug]) return BRAND_SLUGS[brandOrSlug];
  const slug = brandToSlug(brandOrSlug);
  if (slug) return BRAND_SLUGS[slug];
  return brandOrSlug;
}

export function categoryDisplayLabel(
  facet: CategoryFacet,
  value: string | undefined,
  t: (key: string) => string
): string {
  if (facet === "brand" && value) {
    return brandDisplayName(value);
  }

  const key = categoryTitleKey(facet, value);
  if (key) return t(key);

  if (!value) return t("home.categoryBags");
  return value.replace(/-/g, " ");
}

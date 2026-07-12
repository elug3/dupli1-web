export const BRAND_SLUGS: Record<string, string> = {
  "louis-vuitton": "Louis Vuitton",
  "miu-miu": "Miu Miu",
  balenciaga: "Balenciaga",
  hermes: "Hermès",
  loewe: "Loewe",
  prada: "Prada",
  ysl: "Saint Laurent",
};

export const PRODUCT_TYPE_SLUGS: Record<string, string> = {
  handbags: "",
  totes: "Totes",
  "shoulder-bags": "Shoulder Bags",
  crossbody: "Crossbody",
  "mini-bags": "Mini Bags",
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

export function buildCategorySearchParams(
  facet: CategoryFacet,
  value?: string
): Record<string, string> {
  if (!value) return {};

  switch (facet) {
    case "brand": {
      const brand = BRAND_SLUGS[value];
      return brand ? { brand } : { brand: "__no_match__" };
    }
    case "product-type": {
      if (!(value in PRODUCT_TYPE_SLUGS)) return { productType: "__no_match__" };
      const type = PRODUCT_TYPE_SLUGS[value];
      return type ? { productType: type } : {};
    }
    case "style": {
      const style = STYLE_SLUGS[value];
      return style ? { style } : { style: "__no_match__" };
    }
    case "family": {
      const family = FAMILY_SLUGS[value];
      return family ? { family } : { family: "__no_match__" };
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
    case "brand":
      return get("Brand") === (BRAND_SLUGS[value] ?? value);
    case "product-type": {
      if (value === "handbags") return true;
      const type = PRODUCT_TYPE_SLUGS[value];
      return type ? get("Type") === type : false;
    }
    case "style": {
      const style = STYLE_SLUGS[value];
      return style ? get("Style") === style : false;
    }
    case "family": {
      const family = FAMILY_SLUGS[value];
      return family ? get("Gender") === family : false;
    }
  }
}

export function brandToSlug(brand: string): string | null {
  const entry = Object.entries(BRAND_SLUGS).find(([, name]) => name === brand);
  return entry?.[0] ?? null;
}

export function categoryDisplayLabel(
  facet: CategoryFacet,
  value: string | undefined,
  t: (key: string) => string
): string {
  if (facet === "brand" && value) {
    return BRAND_SLUGS[value] ?? value.replace(/-/g, " ");
  }

  const key = categoryTitleKey(facet, value);
  if (key) return t(key);

  if (!value) return t("home.categoryBags");
  return value.replace(/-/g, " ");
}

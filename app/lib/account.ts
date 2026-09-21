export const ACCOUNT_SECTIONS = [
  "wishlist",
  "promotions",
  "orders",
  "settings",
  "support",
] as const;

export type AccountSection = (typeof ACCOUNT_SECTIONS)[number];

/** My Account lives at `/profile`; orders are the `/profile/orders` section. */
export const MY_ACCOUNT_PATH = "/profile";
export const MY_ACCOUNT_ORDERS_PATH = `${MY_ACCOUNT_PATH}/orders`;

/** One order's detail page, nested under the orders section. */
export function myAccountOrderPath(orderId: string): string {
  return `${MY_ACCOUNT_ORDERS_PATH}/${encodeURIComponent(orderId)}`;
}

export function myAccountPath(section: AccountSection = "wishlist"): string {
  if (section === "wishlist") return MY_ACCOUNT_PATH;
  return `${MY_ACCOUNT_PATH}/${section}`;
}

/**
 * Pre-rename section slugs, kept so a bookmarked URL still lands on the right
 * section for one release (dupli1 docs/product-promotion-rename.md). Drop with
 * the other compatibility aliases.
 */
const PRE_RENAME_SECTIONS: Record<string, AccountSection> = {
  coupons: "promotions",
};

export function parseAccountSection(value: string | undefined): AccountSection {
  if (value && (ACCOUNT_SECTIONS as readonly string[]).includes(value)) {
    return value as AccountSection;
  }
  if (value && PRE_RENAME_SECTIONS[value]) {
    return PRE_RENAME_SECTIONS[value];
  }
  return "wishlist";
}

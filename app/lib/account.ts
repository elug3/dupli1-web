export const ACCOUNT_SECTIONS = [
  "wishlist",
  "coupons",
  "orders",
  "settings",
  "support",
] as const;

export type AccountSection = (typeof ACCOUNT_SECTIONS)[number];

/** My Account lives at `/profile`; orders are the `/profile/orders` section. */
export const MY_ACCOUNT_PATH = "/profile";
export const MY_ACCOUNT_ORDERS_PATH = `${MY_ACCOUNT_PATH}/orders`;

export function myAccountPath(section: AccountSection = "wishlist"): string {
  if (section === "wishlist") return MY_ACCOUNT_PATH;
  return `${MY_ACCOUNT_PATH}/${section}`;
}

export function parseAccountSection(value: string | undefined): AccountSection {
  if (value && (ACCOUNT_SECTIONS as readonly string[]).includes(value)) {
    return value as AccountSection;
  }
  return "wishlist";
}

// The signed-in customer's promotional codes.
//
// The wallet replaces a stub that held an empty array and lost anything it
// "redeemed" on reload. Entitlements are real rows owned by the product
// service; this only reads them.

import { formatPrice } from "./cart";

/** One entitlement, judged against the cart the customer is looking at. */
export interface WalletEntry {
  id: string;
  code: string;
  /** Customer-facing conditions copy from the definition. */
  terms: string;
  description: string;
  /** When this customer's entitlement lapses. Null means it does not. */
  expiresAt: string | null;
  revoked: boolean;
  /** Whether it applies to the current cart. */
  eligible: boolean;
  /** Discount in whole KRW won if applied now. */
  discountWon: number;
  /** Why it does not apply, when it does not. */
  reason?: string;
  subReason?: string;
}

interface RawWalletEntry {
  entitlement?: {
    id?: string;
    code?: string;
    expires_at?: string | null;
    revoked_at?: string | null;
  };
  promotion?: { description?: string; terms?: string } | null;
  eligible?: boolean;
  discount_won?: number;
  reason?: string;
  sub_reason?: string;
}

/**
 * Loads the wallet, judged against the cart passed in.
 *
 * Ineligible codes come back too, with a reason — a customer who knows they
 * have a code is owed an explanation rather than an empty list.
 */
export async function loadWallet(
  lines: { skuId?: string; sku: string; productId: string; quantity: number; unitPriceWon: number }[],
  shippingFeeWon: number
): Promise<WalletEntry[]> {
  const res = await fetch("/auth/session/gateway/api/v1/products/promotions/me", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      shipping_fee_won: shippingFeeWon,
      lines: lines.map((line) => ({
        sku_id: line.skuId ?? "",
        sku: line.sku,
        product_id: line.productId,
        quantity: line.quantity,
        unit_price_won: line.unitPriceWon,
      })),
    }),
  });
  if (!res.ok) return [];

  const body = (await res.json()) as { results?: RawWalletEntry[] };
  return (body.results ?? []).map((raw) => ({
    id: raw.entitlement?.id ?? "",
    code: raw.entitlement?.code ?? "",
    terms: raw.promotion?.terms ?? "",
    description: raw.promotion?.description ?? "",
    expiresAt: raw.entitlement?.expires_at ?? null,
    revoked: Boolean(raw.entitlement?.revoked_at),
    eligible: Boolean(raw.eligible),
    discountWon: raw.discount_won ?? 0,
    reason: raw.reason,
    subReason: raw.sub_reason,
  }));
}

/** True once the entitlement's own window has closed. */
export function isLapsed(entry: WalletEntry, now = new Date()): boolean {
  if (entry.revoked) return true;
  if (!entry.expiresAt) return false;
  return new Date(entry.expiresAt) < now;
}

/** What the code is worth, for the card. */
export function describeWalletValue(entry: WalletEntry): string {
  return entry.discountWon > 0 ? formatPrice(entry.discountWon) : "";
}

/** i18n key for why a wallet code does not apply right now. */
export function walletReasonKey(entry: WalletEntry): string | null {
  if (entry.eligible) return null;
  switch (entry.reason) {
    case "expired":
      return "cart.promoExpired";
    case "already_used":
      return "cart.promoAlreadyUsed";
    case "campaign_exhausted":
      return "cart.promoExhausted";
    case "not_eligible":
      return entry.subReason === "min_spend" ? "cart.promoMinSpend" : "cart.promoNotEligible";
    // invalid_code here means the campaign is switched off, which reads to the
    // customer as "not available right now" rather than "your code is wrong".
    case "invalid_code":
      return "profile.promotionNotAvailable";
    default:
      return "cart.promoNotEligible";
  }
}

/**
 * Promotional code preview for the bag and checkout.
 *
 * The storefront cannot price a code itself. A fixed-₩ benefit, a cap, a
 * minimum spend or a line rule all live in the definition, so the only honest
 * preview is the one the service computes — `POST /promotions/evaluate`, the
 * same call order makes when the code is applied and again at checkout
 * complete. It is advisory: the service re-evaluates authoritatively on both
 * of those, and the order's discount is whatever it says then.
 *
 * See dupli1 docs/product-promo-referral-code-plan.md.
 */
import type { CartItem } from "./cart";

/** Machine-readable rejections, mirroring dupli1 `domain.Reason`. */
export type PromotionReason =
  | "invalid_code"
  | "expired"
  | "already_used"
  | "not_eligible"
  | "campaign_exhausted"
  | "login_required"
  /** Local: the evaluate call itself failed, so we know nothing about the code. */
  | "unavailable";

export interface PromotionRejection {
  reason: PromotionReason;
  subReason?: string;
}

/** A code the service priced against the current bag. */
export interface AppliedPromotion {
  code: string;
  /** Whole KRW the service says this bag earns. Never computed here. */
  discountWon: number;
}

export type PromotionResult =
  | { ok: true; promotion: AppliedPromotion }
  | { ok: false; rejection: PromotionRejection };

/** Thrown when applying a code to a checkout session is refused. */
export class PromotionRejectedError extends Error {
  readonly rejection: PromotionRejection;

  constructor(rejection: PromotionRejection, message: string) {
    super(message);
    this.name = "PromotionRejectedError";
    this.rejection = rejection;
  }
}

/**
 * One bag line as the evaluator reads it.
 *
 * Deliberately the same four fields order sends from a priced checkout session
 * (dupli1 `order/pkg/service/checkout.go` promotionContextFor). Sending more —
 * a category or brand the browser happens to know — would preview a rule that
 * checkout cannot evaluate, so an eligible-looking code would be refused at
 * the last step.
 */
export interface PromotionLine {
  sku_id?: string;
  sku: string;
  quantity: number;
  unit_price_won: number;
}

export function promotionLines(items: CartItem[]): PromotionLine[] {
  return items.map((item) => ({
    sku_id: item.skuId,
    sku: item.sku,
    quantity: item.quantity,
    unit_price_won: item.unitPriceWon,
  }));
}

interface EvaluateResponse {
  ok?: boolean;
  discount_won?: number;
  reason?: string;
  sub_reason?: string;
}

const KNOWN_REASONS: PromotionReason[] = [
  "invalid_code",
  "expired",
  "already_used",
  "not_eligible",
  "campaign_exhausted",
  "login_required",
];

function toReason(value: string | undefined): PromotionReason {
  return KNOWN_REASONS.includes(value as PromotionReason)
    ? (value as PromotionReason)
    : "invalid_code";
}

/**
 * Prices a code against the current bag.
 *
 * `customerId` is what makes an account-scoped code and a once-per-customer
 * cap preview truthfully; it is only ever a preview, since apply and complete
 * re-evaluate server-side against the session's own customer.
 */
export async function evaluatePromotion(
  code: string,
  options: {
    items: CartItem[];
    shippingFeeWon: number;
    customerId?: string;
  }
): Promise<PromotionResult> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) {
    return { ok: false, rejection: { reason: "invalid_code" } };
  }

  let body: EvaluateResponse;
  try {
    const res = await fetch("/api/promotions/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        code: trimmed,
        customer_id: options.customerId ?? "",
        shipping_fee_won: options.shippingFeeWon,
        lines: promotionLines(options.items),
      }),
    });
    // A refusal is a 200 with ok:false — the request itself succeeded. Any
    // other status (429, 502) means we could not judge the code at all.
    if (!res.ok) return { ok: false, rejection: { reason: "unavailable" } };
    body = (await res.json()) as EvaluateResponse;
  } catch {
    return { ok: false, rejection: { reason: "unavailable" } };
  }

  if (!body.ok) {
    return {
      ok: false,
      rejection: { reason: toReason(body.reason), subReason: body.sub_reason },
    };
  }
  return {
    ok: true,
    promotion: { code: trimmed, discountWon: body.discount_won ?? 0 },
  };
}

/** i18n key for a rejection, so the copy stays in the message catalogue. */
export function promotionMessageKey(rejection: PromotionRejection): string {
  switch (rejection.reason) {
    case "expired":
      return "promo.expired";
    case "already_used":
      return "promo.alreadyUsed";
    case "campaign_exhausted":
      return "promo.exhausted";
    case "login_required":
      return "promo.loginRequired";
    case "unavailable":
      return "promo.unavailable";
    case "not_eligible":
      switch (rejection.subReason) {
        case "min_spend":
          return "promo.minSpend";
        case "category":
          return "promo.category";
        case "brand":
          return "promo.brand";
        case "on_sale_excluded":
          return "promo.onSale";
        case "no_line_match":
          return "promo.noLineMatch";
        default:
          return "promo.notEligible";
      }
    default:
      return "promo.invalidCode";
  }
}

/** Reads the reason out of order's `422` body when applying to a session. */
export function rejectionFromBody(body: unknown): PromotionRejection | null {
  if (!body || typeof body !== "object") return null;
  const record = body as { reason?: unknown; sub_reason?: unknown };
  if (typeof record.reason !== "string") return null;
  return {
    reason: toReason(record.reason),
    subReason:
      typeof record.sub_reason === "string" ? record.sub_reason : undefined,
  };
}

// ── Wallet ──────────────────────────────────────────────────────────────────

/**
 * One promotional code this customer holds, judged against the bag they are
 * looking at.
 *
 * Account-scoped codes are issued, not typed: the sign-up campaign mints an
 * entitlement on registration, and a manager can grant one as goodwill. The
 * wallet is the only place a customer can discover one, so an ineligible entry
 * comes back with its reason rather than being hidden — somebody who knows
 * they have a code is owed an explanation, not silence.
 */
export interface WalletEntry {
  entitlementId: string;
  code: string;
  description: string;
  terms: string;
  /** Per entitlement, not per campaign: everyone gets the same window. */
  expiresAt?: string;
  eligible: boolean;
  /** Whole KRW this bag earns with the code, as the service priced it. */
  discountWon: number;
  rejection?: PromotionRejection;
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
 * Lists the signed-in customer's codes.
 *
 * The bag travels with the request so each entry is judged against it — the
 * service takes the customer from the session token, never from the body, so
 * one account cannot read another's wallet. An empty bag is fine: the entries
 * come back, with nothing to judge them against.
 */
export async function fetchWallet(options: {
  items: CartItem[];
  shippingFeeWon: number;
}): Promise<WalletEntry[]> {
  let body: { results?: RawWalletEntry[] };
  try {
    // Needs the session's bearer token, so it goes through the session
    // gateway rather than a public BFF route.
    const res = await fetch(
      "/auth/session/gateway/api/v1/products/promotions/me",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          shipping_fee_won: options.shippingFeeWon,
          lines: promotionLines(options.items),
        }),
      }
    );
    if (!res.ok) return [];
    body = (await res.json()) as { results?: RawWalletEntry[] };
  } catch {
    return [];
  }

  return (body.results ?? [])
    // A revoked entitlement is withdrawn, not merely unusable; it has no
    // business on a customer's shelf.
    .filter((raw) => raw.entitlement?.id && !raw.entitlement.revoked_at)
    .map((raw) => ({
      entitlementId: raw.entitlement?.id ?? "",
      code: raw.entitlement?.code ?? "",
      description: raw.promotion?.description ?? "",
      terms: raw.promotion?.terms ?? "",
      expiresAt: raw.entitlement?.expires_at ?? undefined,
      eligible: Boolean(raw.eligible),
      discountWon: raw.discount_won ?? 0,
      rejection: raw.eligible
        ? undefined
        : { reason: toReason(raw.reason), subReason: raw.sub_reason },
    }));
}

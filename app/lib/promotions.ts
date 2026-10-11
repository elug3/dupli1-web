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
    const res = await fetch("/api/v1/products/promotions/evaluate", {
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
  /** What the code gives as its definition states it, whatever the bag. */
  offer?: PromotionOffer;
  /** The rules a shopper can read before picking the code; absent when none. */
  conditions?: PromotionConditions;
}

/** A code's benefit, e.g. 10% off up to ₩30,000, or ₩50,000 off. */
export type PromotionOffer =
  | { kind: "percent"; percent: number; maxDiscountWon?: number }
  | { kind: "fixed"; amountWon: number };

/**
 * The parts of a code's eligibility a shopper can act on. Line rules naming a
 * SKU or product are left out: there is nothing readable to say about them,
 * and the service still judges them.
 */
export interface PromotionConditions {
  minSubtotalWon?: number;
  categories?: string[];
  /** Brand codes (`PRA`), internal; shown only as "selected brands". */
  brandCodes?: string[];
  excludesSaleItems?: boolean;
  maxPerCustomer?: number;
}

interface RawPredicate {
  attr?: string;
  op?: string;
  value?: unknown;
}

interface RawPromotion {
  description?: string;
  terms?: string;
  expires_at?: string | null;
  max_per_customer?: number;
  /** Legacy percentage (0.1 = 10%) on definitions written before `benefit`. */
  discount?: number;
  benefit?: {
    discount_type?: string;
    discount_fraction?: number;
    discount_fixed_won?: number;
    max_discount_won?: number | null;
  } | null;
  conditions?: { all?: RawPredicate[]; exclude?: RawPredicate[] } | null;
}

/** Reads the benefit document; undefined when it names no discount. */
export function toOffer(promotion: RawPromotion | null | undefined): PromotionOffer | undefined {
  const benefit = promotion?.benefit;
  if (benefit?.discount_type === "fixed" && (benefit.discount_fixed_won ?? 0) > 0) {
    return { kind: "fixed", amountWon: benefit.discount_fixed_won as number };
  }
  const fraction =
    benefit?.discount_type === "percent"
      ? benefit.discount_fraction
      : benefit?.discount_type
        ? undefined
        : promotion?.discount;
  if (!fraction || fraction <= 0 || fraction >= 1) return undefined;
  const cap = benefit?.max_discount_won ?? undefined;
  return {
    kind: "percent",
    // 0.1 → 10, without 10.000000000000002.
    percent: Math.round(fraction * 1000) / 10,
    ...(cap && cap > 0 ? { maxDiscountWon: cap } : {}),
  };
}

function stringValues(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [value];
  return list.filter((v): v is string => typeof v === "string" && v !== "");
}

/** Reads the conditions document; undefined when nothing is worth showing. */
export function toConditions(
  promotion: RawPromotion | null | undefined
): PromotionConditions | undefined {
  const out: PromotionConditions = {};
  for (const p of promotion?.conditions?.all ?? []) {
    const num = typeof p.value === "number" ? p.value : Number.NaN;
    if (p.attr === "subtotal_won" && (p.op === "gte" || p.op === "gt") && num > 0) {
      out.minSubtotalWon = p.op === "gt" ? num + 1 : num;
    } else if (p.attr === "line.category" && (p.op === "eq" || p.op === "in")) {
      out.categories = stringValues(p.value);
    } else if (p.attr === "line.brandCode" && (p.op === "eq" || p.op === "in")) {
      out.brandCodes = stringValues(p.value);
    } else if (p.attr === "line.on_sale" && p.op === "eq" && p.value === false) {
      out.excludesSaleItems = true;
    }
  }
  for (const p of promotion?.conditions?.exclude ?? []) {
    if (p.attr === "line.on_sale" && p.op === "eq" && p.value === true) {
      out.excludesSaleItems = true;
    }
  }
  if ((promotion?.max_per_customer ?? 0) > 0) {
    out.maxPerCustomer = promotion?.max_per_customer;
  }
  if (!out.categories?.length) delete out.categories;
  if (!out.brandCodes?.length) delete out.brandCodes;
  return Object.keys(out).length > 0 ? out : undefined;
}

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** "10% off, up to ₩30,000" / "₩50,000 off"; "" when the offer is unknown. */
export function describeOffer(
  offer: PromotionOffer | undefined,
  t: Translate,
  formatCurrency: (amount: number) => string
): string {
  if (!offer) return "";
  if (offer.kind === "fixed") {
    return t("promo.offerFixed", { amount: formatCurrency(offer.amountWon) });
  }
  const base = t("promo.offerPercent", { percent: offer.percent });
  return offer.maxDiscountWon
    ? `${base}, ${t("promo.offerCap", { amount: formatCurrency(offer.maxDiscountWon) })}`
    : base;
}

/** The readable conditions in display order: spend, scope, uses, expiry. */
export function describeConditions(
  entry: Pick<WalletEntry, "conditions" | "expiresAt">,
  t: Translate,
  formatCurrency: (amount: number) => string,
  formatDateTime: (iso: string) => string
): string[] {
  const c = entry.conditions ?? {};
  const parts: string[] = [];
  if (c.minSubtotalWon) {
    parts.push(t("promo.condMinSpend", { amount: formatCurrency(c.minSubtotalWon) }));
  }
  if (c.categories?.length) {
    const names = c.categories.map((code) => {
      const key = `category.${code}`;
      const name = t(key);
      return name === key ? code : name;
    });
    parts.push(t("promo.condCategory", { categories: names.join(", ") }));
  }
  if (c.brandCodes?.length) parts.push(t("promo.condBrand"));
  if (c.excludesSaleItems) parts.push(t("promo.condNoSale"));
  if (c.maxPerCustomer === 1) parts.push(t("promo.condOnce"));
  else if (c.maxPerCustomer) parts.push(t("promo.condUses", { count: c.maxPerCustomer }));
  const expires = entry.expiresAt ? formatDateTime(entry.expiresAt) : "";
  if (expires) parts.push(t("promo.condExpires", { date: expires }));
  return parts;
}

interface RawWalletEntry {
  entitlement?: {
    id?: string;
    code?: string;
    expires_at?: string | null;
    revoked_at?: string | null;
  };
  promotion?: RawPromotion | null;
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
      // The entitlement's own window wins; otherwise the campaign's.
      expiresAt: raw.entitlement?.expires_at ?? raw.promotion?.expires_at ?? undefined,
      eligible: Boolean(raw.eligible),
      discountWon: raw.discount_won ?? 0,
      rejection: raw.eligible
        ? undefined
        : { reason: toReason(raw.reason), subReason: raw.sub_reason },
      offer: toOffer(raw.promotion),
      conditions: toConditions(raw.promotion),
    }));
}

/** The automatic customer tier (VIP, a private tier) a member earns on a bag. */
export interface MemberTier {
  code: string;
  /** Whole KRW, as the service priced it for this bag. */
  discountWon: number;
}

/**
 * The signed-in customer's tier discount on this bag, or null when they hold
 * none (or are signed out).
 *
 * A tier is not a code: a manager makes an account a member, and the order
 * service applies the tier to every order on top of one code. This is only the
 * preview; checkout complete asks again and is what is charged.
 */
export async function fetchMyTier(options: {
  items: CartItem[];
  shippingFeeWon: number;
}): Promise<MemberTier | null> {
  if (options.items.length === 0) return null;
  try {
    const res = await fetch(
      "/auth/session/gateway/api/v1/products/promotions/me/tier",
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
    if (!res.ok) return null;
    const body = (await res.json()) as {
      ok?: boolean;
      code?: string;
      discount_won?: number;
    };
    if (!body.ok || !body.code || !body.discount_won) return null;
    return { code: body.code, discountWon: body.discount_won };
  } catch {
    return null;
  }
}

/**
 * Splits a clamped total discount back into the code's and the tier's share.
 * The order service caps the two together at the goods subtotal and takes the
 * code first, so the tier is what the code leaves.
 */
export function splitDiscount(
  totalWon: number,
  codeWon: number
): { codeWon: number; tierWon: number } {
  const code = Math.max(0, Math.min(codeWon, totalWon));
  return { codeWon: code, tierWon: Math.max(0, totalWon - code) };
}

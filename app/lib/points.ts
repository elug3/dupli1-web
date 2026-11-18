/**
 * Points (적립금) — the shopper's store credit, owned by dupli1-payment
 * (elug3/dupli1 docs/payment-points.md). 1 P = ₩1. Reads go through the
 * cookie session gateway, which attaches the shopper's token.
 */

export type PointsTierCode = "member" | "silver" | "gold" | "diamond";

export interface PointsTier {
  code: PointsTierCode | string;
  /** Earn multiplier in tenths: 15 = 1.5×. */
  multiplier: number;
  minSpendWon: number;
}

export interface PointsTierStatus extends PointsTier {
  /** Goods paid on fulfilled orders in the window that decides the tier. */
  spendWon: number;
  next?: PointsTier;
}

export type PointEntryKind =
  | "earn"
  | "review"
  | "grant"
  | "spend"
  | "return"
  | "clawback"
  | "adjust"
  | "expire";

export interface PointEntry {
  id: string;
  kind: PointEntryKind | string;
  /** Signed: + arrives, − leaves. */
  points: number;
  orderId?: string;
  note?: string;
  createdAt: string;
}

export interface PointsSummary {
  balance: number;
  pending: number;
  expiring: number;
  expiringBy: string;
  tier: PointsTierStatus;
  entries: PointEntry[];
  nextCursor?: string;
}

interface RawTier {
  code: string;
  multiplier: number;
  min_spend_won: number;
}

interface RawEntry {
  id: string;
  kind: string;
  points: number;
  order_id?: string;
  note?: string;
  created_at: string;
}

interface RawSummary {
  balance?: number;
  pending?: number;
  expiring?: number;
  expiring_by?: string;
  tier?: RawTier & { spend_won?: number; next?: RawTier };
  entries?: RawEntry[];
  next_cursor?: string;
}

function mapTier(raw: RawTier): PointsTier {
  return { code: raw.code, multiplier: raw.multiplier, minSpendWon: raw.min_spend_won };
}

function mapEntry(raw: RawEntry): PointEntry {
  return {
    id: raw.id,
    kind: raw.kind,
    points: raw.points,
    orderId: raw.order_id || undefined,
    note: raw.note || undefined,
    createdAt: raw.created_at,
  };
}

export function mapPointsSummary(raw: RawSummary): PointsSummary {
  const tier = raw.tier ?? { code: "member", multiplier: 10, min_spend_won: 0 };
  return {
    balance: raw.balance ?? 0,
    pending: raw.pending ?? 0,
    expiring: raw.expiring ?? 0,
    expiringBy: raw.expiring_by ?? "",
    tier: {
      ...mapTier(tier),
      spendWon: tier.spend_won ?? 0,
      next: tier.next ? mapTier(tier.next) : undefined,
    },
    entries: (raw.entries ?? []).map(mapEntry),
    nextCursor: raw.next_cursor || undefined,
  };
}

const GATEWAY = "/auth/session/gateway/api/v1/payments/points";

/** The signed-in shopper's points, or null when they cannot be read (signed out, service down). */
export async function fetchMyPoints(
  limit = 20,
  init: RequestInit = {}
): Promise<PointsSummary | null> {
  try {
    const res = await fetch(`${GATEWAY}/me?limit=${limit}`, {
      ...init,
      credentials: "same-origin",
    });
    if (!res.ok) return null;
    return mapPointsSummary((await res.json()) as RawSummary);
  } catch {
    return null;
  }
}

export async function fetchMyPointEntries(
  cursor: string,
  limit = 20
): Promise<{ entries: PointEntry[]; nextCursor?: string }> {
  const params = new URLSearchParams({ cursor, limit: String(limit) });
  const res = await fetch(`${GATEWAY}/me/entries?${params}`, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const body = (await res.json()) as { entries?: RawEntry[]; next_cursor?: string };
  return {
    entries: (body.entries ?? []).map(mapEntry),
    nextCursor: body.next_cursor || undefined,
  };
}

/**
 * The points an order can actually use: whole, not negative, no more than the
 * balance, and no more than the goods after discounts (points never pay for
 * delivery). Order trims the same way; this keeps the quote honest.
 */
export function usablePoints(wanted: number, balance: number, goodsAfterDiscountWon: number): number {
  if (!Number.isFinite(wanted) || wanted <= 0) return 0;
  return Math.max(0, Math.min(Math.floor(wanted), balance, goodsAfterDiscountWon));
}

/** Parses a points field: digits only (commas allowed), anything else is 0. */
export function parsePointsInput(value: string): number {
  const digits = value.replace(/[,\s]/g, "");
  if (!/^\d+$/.test(digits)) return 0;
  return Number(digits);
}

/** "12,500" — points are counted, not priced, so no ₩. */
export function formatPoints(points: number): string {
  return Math.abs(points).toLocaleString("en-US");
}

/** The earning rate a tier gives, as a percent: multiplier 15 → "1.5". */
export function tierRatePercent(multiplier: number): string {
  return String(multiplier / 10);
}

// Review rewards (docs/payment-points.md → Review rewards).
export const REVIEW_REWARD_MIN_CHARS = 20;
export const REVIEW_TEXT_POINTS = 2_000;
export const REVIEW_PHOTO_POINTS = 5_000;

/** What a review would earn as written, before payment confirms it. */
export function reviewRewardPoints(bodyChars: number, photoCount: number): number {
  if (bodyChars < REVIEW_REWARD_MIN_CHARS) return 0;
  return photoCount > 0 ? REVIEW_PHOTO_POINTS : REVIEW_TEXT_POINTS;
}

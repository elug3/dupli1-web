/**
 * Product reviews (리뷰) on the PDP — public reads from dupli1-product
 * (elug3/dupli1 docs/product-reviews-plan.md). The browser calls
 * `/api/v1/products/{id}/reviews` directly: production forwards it to the
 * gateway, and local dev has a BFF mirror.
 */

export type ReviewSort = "latest" | "rating_desc" | "rating_asc";

export type FitResult = "small" | "true_to_size" | "large";

export interface ReviewFit {
  result: FitResult;
  heightCm?: number;
  usualSize?: string;
}

export interface ReviewPhoto {
  id: string;
  url: string;
  thumbUrl: string;
}

export interface Review {
  id: string;
  productId: string;
  skuId: string;
  variantLabel?: string;
  rating: number;
  body: string;
  fit?: ReviewFit;
  photos: ReviewPhoto[];
  /** Masked by the backend (김**), or 구매자 with no display name. */
  author: string;
  verifiedPurchase: boolean;
  createdAt: string;
  editedAt?: string;
}

export interface ReviewSummary {
  count: number;
  /** One decimal; null with no reviews. */
  average: number | null;
  /** "1" … "5" → count. */
  byRating: Record<string, number>;
  photoCount: number;
  /** Clothing only. */
  fit?: { small: number; trueToSize: number; large: number };
}

export interface ReviewPage {
  summary: ReviewSummary;
  reviews: Review[];
  nextCursor?: string;
}

export interface ReviewStripPhoto extends ReviewPhoto {
  reviewId: string;
}

export interface ReviewQuery {
  sort?: ReviewSort;
  photoOnly?: boolean;
  limit?: number;
  cursor?: string;
}

/** The anonymous author the backend sends for a buyer with no display name. */
export const ANONYMOUS_AUTHOR = "구매자";

export const EMPTY_SUMMARY: ReviewSummary = {
  count: 0,
  average: null,
  byRating: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
  photoCount: 0,
};

function reviewsPath(productId: string, suffix = ""): string {
  return `/api/v1/products/${encodeURIComponent(productId)}/reviews${suffix}`;
}

export function reviewQueryString(q: ReviewQuery): string {
  const params = new URLSearchParams();
  if (q.sort && q.sort !== "latest") params.set("sort", q.sort);
  if (q.photoOnly) params.set("photo", "true");
  if (q.limit) params.set("limit", String(q.limit));
  if (q.cursor) params.set("cursor", q.cursor);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** One page of a product's visible reviews and its summary. */
export async function fetchProductReviews(
  productId: string,
  q: ReviewQuery = {},
  init?: RequestInit
): Promise<ReviewPage> {
  const res = await fetch(reviewsPath(productId, reviewQueryString(q)), init);
  if (!res.ok) throw new Error(`reviews: ${res.status}`);
  const body = (await res.json()) as Partial<ReviewPage>;
  return {
    summary: { ...EMPTY_SUMMARY, ...body.summary },
    reviews: (body.reviews ?? []).map(normalizeReview),
    nextCursor: body.nextCursor || undefined,
  };
}

/** Photos of a product's visible reviews, newest first. */
export async function fetchReviewPhotos(
  productId: string,
  limit = 20,
  init?: RequestInit
): Promise<ReviewStripPhoto[]> {
  const res = await fetch(reviewsPath(productId, `/photos?limit=${limit}`), init);
  if (!res.ok) throw new Error(`review photos: ${res.status}`);
  const body = (await res.json()) as { photos?: ReviewStripPhoto[] };
  return (body.photos ?? []).filter((p) => p.url);
}

function normalizeReview(r: Review): Review {
  return { ...r, photos: (r.photos ?? []).filter((p) => p.url) };
}

/** 2026-10-28T… → 2026.10.28, in Korea's calendar day. */
export function formatReviewDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}.${get("month")}.${get("day")}`;
}

/** Share of each star rating, 0–100, for the summary bars. */
export function ratingShares(summary: ReviewSummary): { stars: number; count: number; percent: number }[] {
  return [5, 4, 3, 2, 1].map((stars) => {
    const count = summary.byRating[String(stars)] ?? 0;
    return { stars, count, percent: summary.count > 0 ? Math.round((count / summary.count) * 100) : 0 };
  });
}

/** The fit answer most buyers gave, with its share; null without answers. */
export function dominantFit(
  fit: ReviewSummary["fit"]
): { result: FitResult; percent: number; shares: Record<FitResult, number> } | null {
  if (!fit) return null;
  const total = fit.small + fit.trueToSize + fit.large;
  if (total === 0) return null;
  const shares: Record<FitResult, number> = {
    small: Math.round((fit.small / total) * 100),
    true_to_size: Math.round((fit.trueToSize / total) * 100),
    large: Math.round((fit.large / total) * 100),
  };
  const counts: [FitResult, number][] = [
    ["true_to_size", fit.trueToSize],
    ["small", fit.small],
    ["large", fit.large],
  ];
  // Ties go to true_to_size: listed first, and sort is stable.
  counts.sort((a, b) => b[1] - a[1]);
  const result = counts[0][0];
  return { result, percent: shares[result], shares };
}

/** Number of stars to fill for an average: rounded to the nearest whole. */
export function filledStars(average: number | null | undefined): number {
  if (average == null || Number.isNaN(average)) return 0;
  return Math.max(0, Math.min(5, Math.round(average)));
}

export const FIT_LABEL_KEYS: Record<FitResult, string> = {
  small: "reviews.fitSmall",
  true_to_size: "reviews.fitTrue",
  large: "reviews.fitLarge",
};

// ── The shopper's own reviews ──────────────────────────────────────────────
//
// Writes go through the session gateway, which attaches the Bearer token:
// product forwards that token to order to check the line was bought and the
// order is 구매확정 (fulfilled), so the browser never vouches for itself.

const GATEWAY = "/auth/session/gateway/api/v1/products";

export const REVIEW_LIMITS = {
  bodyMin: 10,
  bodyMax: 1000,
  photos: 10,
  photoBytes: 10 * 1024 * 1024,
  heightMin: 100,
  heightMax: 230,
  usualSizeMax: 10,
} as const;

export const REVIEW_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** A review as its author sees it: also the order and the hidden state. */
export interface MyReview extends Review {
  orderId: string;
  hidden?: boolean;
  hiddenReason?: string;
}

export interface UploadedPhoto {
  photoId: string;
  url: string;
  thumbUrl: string;
}

export interface ReviewDraft {
  rating: number;
  body: string;
  /** Clothing only; result unset means no fit answer. */
  fit?: { result?: FitResult; heightCm?: number | ""; usualSize?: string };
  photoIds: string[];
}

export class ReviewRequestError extends Error {
  constructor(
    readonly status: number,
    readonly reason?: string,
    readonly reviewId?: string
  ) {
    super(reason ?? `HTTP ${status}`);
  }
}

async function callGateway(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (typeof init.body === "string") headers.set("Content-Type", "application/json");
  let res: Response;
  try {
    res = await fetch(`${GATEWAY}${path}`, { ...init, credentials: "same-origin", headers });
  } catch {
    throw new ReviewRequestError(0);
  }
  if (!res.ok) {
    let reason: string | undefined;
    let reviewId: string | undefined;
    try {
      const body = (await res.json()) as { reason?: string; reviewId?: string };
      reason = body.reason;
      reviewId = body.reviewId;
    } catch {
      // Not JSON: the status is all there is.
    }
    throw new ReviewRequestError(res.status, reason, reviewId);
  }
  return res;
}

/** The caller's reviews, newest first; orderId narrows to one order. */
export async function listMyReviews(orderId?: string): Promise<MyReview[]> {
  const qs = orderId ? `?orderId=${encodeURIComponent(orderId)}` : "";
  const res = await callGateway(`/reviews/me${qs}`);
  const body = (await res.json()) as { reviews?: MyReview[] };
  return (body.reviews ?? []).map((r) => ({ ...r, photos: (r.photos ?? []).filter((p) => p.url) }));
}

/** Upload one photo; it waits, unattached, until a review lists its id. */
export async function uploadReviewPhoto(file: File): Promise<UploadedPhoto> {
  const form = new FormData();
  form.append("photo", file, file.name);
  const res = await callGateway("/reviews/photos", { method: "POST", body: form });
  return (await res.json()) as UploadedPhoto;
}

export async function createReview(
  productId: string,
  line: { orderId: string; skuId: string },
  draft: ReviewDraft
): Promise<MyReview> {
  const res = await callGateway(`/${encodeURIComponent(productId)}/reviews`, {
    method: "POST",
    body: JSON.stringify({ orderId: line.orderId, skuId: line.skuId, ...reviewRequestBody(draft) }),
  });
  return (await res.json()) as MyReview;
}

export async function updateReview(reviewId: string, draft: ReviewDraft): Promise<MyReview> {
  const res = await callGateway(`/reviews/by-id/${encodeURIComponent(reviewId)}`, {
    method: "PATCH",
    body: JSON.stringify(reviewRequestBody(draft)),
  });
  return (await res.json()) as MyReview;
}

export async function deleteReview(reviewId: string): Promise<void> {
  await callGateway(`/reviews/by-id/${encodeURIComponent(reviewId)}`, { method: "DELETE" });
}

/** The wire body for create and edit. An empty fit is sent as {} to clear it. */
export function reviewRequestBody(draft: ReviewDraft): {
  rating: number;
  body: string;
  fit?: ReviewFit | Record<string, never>;
  photoIds: string[];
} {
  const out: ReturnType<typeof reviewRequestBody> = {
    rating: draft.rating,
    body: draft.body.trim(),
    photoIds: draft.photoIds,
  };
  if (draft.fit) {
    const f = draft.fit;
    if (f.result) {
      const fit: ReviewFit = { result: f.result };
      if (typeof f.heightCm === "number" && f.heightCm > 0) fit.heightCm = f.heightCm;
      const usual = f.usualSize?.trim();
      if (usual) fit.usualSize = usual;
      out.fit = fit;
    } else {
      out.fit = {};
    }
  }
  return out;
}

export type DraftError = "rating" | "bodyShort" | "bodyLong" | "photos" | "height" | "usualSize";

/** What the form must fix before it may submit; empty when it may. */
export function reviewDraftErrors(draft: ReviewDraft): DraftError[] {
  const errors: DraftError[] = [];
  if (!Number.isInteger(draft.rating) || draft.rating < 1 || draft.rating > 5) errors.push("rating");
  const len = [...draft.body.trim()].length;
  if (len < REVIEW_LIMITS.bodyMin) errors.push("bodyShort");
  if (len > REVIEW_LIMITS.bodyMax) errors.push("bodyLong");
  if (draft.photoIds.length > REVIEW_LIMITS.photos) errors.push("photos");
  const h = draft.fit?.heightCm;
  if (typeof h === "number" && (h < REVIEW_LIMITS.heightMin || h > REVIEW_LIMITS.heightMax)) errors.push("height");
  if ((draft.fit?.usualSize?.trim().length ?? 0) > REVIEW_LIMITS.usualSizeMax) errors.push("usualSize");
  return errors;
}

/** Client-side check before uploading, so a wrong file fails at once. */
export function reviewPhotoProblem(file: { type: string; size: number }): "type" | "size" | null {
  if (!(REVIEW_PHOTO_TYPES as readonly string[]).includes(file.type)) return "type";
  if (file.size > REVIEW_LIMITS.photoBytes) return "size";
  return null;
}

/** i18n key for a failed review request. */
export function reviewErrorKey(err: unknown): string {
  if (!(err instanceof ReviewRequestError)) return "reviews.write.failed";
  if (err.status === 401) return "reviews.write.signIn";
  switch (err.reason) {
    case "not_reviewable":
      return "reviews.write.notReviewable";
    case "review_exists":
      return "reviews.write.exists";
    case "review_hidden":
      return "reviews.write.hiddenLocked";
    case "invalid_photo":
      return "reviews.write.photoInvalid";
    case "invalid_review":
      return "reviews.write.invalid";
    case "rate_limited":
      return "reviews.write.rateLimited";
    case "reference_unavailable":
    case "reviews_unavailable":
      return "reviews.write.unavailable";
  }
  if (err.status === 429) return "reviews.write.rateLimited";
  if (err.status === 0 || err.status >= 500) return "reviews.write.unavailable";
  return "reviews.write.failed";
}

/** The product and variant an order line is about, for the review call. */
export interface ReviewLine {
  orderId: string;
  productId: string;
  skuId: string;
}

/**
 * Fills in what an older order line lacks: orders placed before order
 * snapshotted product_id, or before sku_id, only carry the SKU string. The
 * catalog's public variant lookup has both.
 */
export async function resolveReviewLine(
  orderId: string,
  item: { productId?: string; skuId?: string; sku: string }
): Promise<ReviewLine | null> {
  const productId = item.productId?.trim();
  const skuId = item.skuId?.trim();
  if (productId && skuId) return { orderId, productId, skuId };
  const path = skuId
    ? `/variants/by-sku-id/${encodeURIComponent(skuId)}`
    : `/variants/by-sku/${encodeURIComponent(item.sku)}`;
  try {
    const res = await callGateway(path);
    const v = (await res.json()) as { skuId?: string; productId?: string };
    if (!v.skuId || !v.productId) return null;
    return { orderId, productId: v.productId, skuId: v.skuId };
  } catch {
    return null;
  }
}

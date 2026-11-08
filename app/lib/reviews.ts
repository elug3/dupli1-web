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

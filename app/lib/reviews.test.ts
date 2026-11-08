import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EMPTY_SUMMARY,
  ReviewRequestError,
  createReview,
  deleteReview,
  dominantFit,
  fetchProductReviews,
  fetchReviewPhotos,
  filledStars,
  formatReviewDate,
  listMyReviews,
  ratingShares,
  resolveReviewLine,
  reviewDraftErrors,
  reviewErrorKey,
  reviewPhotoProblem,
  reviewQueryString,
  reviewRequestBody,
  updateReview,
  uploadReviewPhoto,
} from "./reviews";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("reviewQueryString", () => {
  it("leaves the defaults out", () => {
    expect(reviewQueryString({})).toBe("");
    expect(reviewQueryString({ sort: "latest" })).toBe("");
  });
  it("sends sort, photo filter, limit and cursor", () => {
    expect(reviewQueryString({ sort: "rating_desc", photoOnly: true, limit: 5, cursor: "abc" })).toBe(
      "?sort=rating_desc&photo=true&limit=5&cursor=abc"
    );
  });
});

describe("fetchProductReviews", () => {
  it("reads the public endpoint and fills a missing summary", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json({
        reviews: [
          { id: "r1", rating: 5, body: "좋아요 정말 좋아요", author: "김**", photos: [{ id: "p", url: "", thumbUrl: "" }] },
        ],
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const page = await fetchProductReviews("BAG 1", { sort: "rating_asc" });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/products/BAG%201/reviews?sort=rating_asc");
    expect(page.summary).toEqual(EMPTY_SUMMARY);
    // A photo without a URL (no object storage) is dropped, not shown broken.
    expect(page.reviews[0].photos).toEqual([]);
    expect(page.nextCursor).toBeUndefined();
  });
  it("throws on an error status so the section can offer a retry", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ reason: "product_not_found" }, 404)));
    await expect(fetchProductReviews("x")).rejects.toThrow("404");
  });
  it("reads the photo strip", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json({ photos: [{ reviewId: "r", id: "p", url: "/product-images/reviews/p.jpg", thumbUrl: "t" }] })
    );
    vi.stubGlobal("fetch", fetchMock);
    const photos = await fetchReviewPhotos("BAG-1", 12);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/products/BAG-1/reviews/photos?limit=12");
    expect(photos).toHaveLength(1);
  });
});

describe("summary helpers", () => {
  it("formats the review date in Korea's calendar day", () => {
    expect(formatReviewDate("2026-10-27T16:30:00Z")).toBe("2026.10.28");
    expect(formatReviewDate("nope")).toBe("");
  });
  it("shares each rating, five stars first", () => {
    const shares = ratingShares({ ...EMPTY_SUMMARY, count: 4, byRating: { "5": 3, "4": 1 } });
    expect(shares.map((s) => [s.stars, s.percent])).toEqual([
      [5, 75],
      [4, 25],
      [3, 0],
      [2, 0],
      [1, 0],
    ]);
    expect(ratingShares(EMPTY_SUMMARY).every((s) => s.percent === 0)).toBe(true);
  });
  it("names the fit most buyers chose, true to size on a tie", () => {
    expect(dominantFit(undefined)).toBeNull();
    expect(dominantFit({ small: 0, trueToSize: 0, large: 0 })).toBeNull();
    expect(dominantFit({ small: 1, trueToSize: 8, large: 1 })).toMatchObject({ result: "true_to_size", percent: 80 });
    expect(dominantFit({ small: 2, trueToSize: 2, large: 0 })?.result).toBe("true_to_size");
    expect(dominantFit({ small: 3, trueToSize: 1, large: 0 })?.result).toBe("small");
  });
  it("rounds the average to whole stars", () => {
    expect(filledStars(null)).toBe(0);
    expect(filledStars(4.4)).toBe(4);
    expect(filledStars(4.5)).toBe(5);
    expect(filledStars(9)).toBe(5);
  });
});

const body10 = "가죽 결이 곱고 좋아요.";

describe("writing a review", () => {
  it("posts the line and the draft through the session gateway", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ id: "r1", orderId: "O1" }, 201));
    vi.stubGlobal("fetch", fetchMock);
    await createReview("BAG-1", { orderId: "O1", skuId: "S1" }, { rating: 5, body: `  ${body10} `, photoIds: ["p1"] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/auth/session/gateway/api/v1/products/BAG-1/reviews");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ orderId: "O1", skuId: "S1", rating: 5, body: body10, photoIds: ["p1"] });
  });
  it("edits and deletes by review id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ id: "r1" }));
    vi.stubGlobal("fetch", fetchMock);
    await updateReview("r 1", { rating: 4, body: body10, photoIds: [] });
    expect(fetchMock.mock.calls[0][0]).toBe("/auth/session/gateway/api/v1/products/reviews/by-id/r%201");
    expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await deleteReview("r1");
    expect(fetchMock.mock.calls[1][1].method).toBe("DELETE");
  });
  it("uploads a photo as multipart without forcing a JSON content type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ photoId: "p1", url: "u", thumbUrl: "t" }, 201));
    vi.stubGlobal("fetch", fetchMock);
    const up = await uploadReviewPhoto(new File([new Uint8Array([1])], "a.jpg", { type: "image/jpeg" }));
    const init = fetchMock.mock.calls[0][1];
    expect(init.body).toBeInstanceOf(FormData);
    expect(new Headers(init.headers).get("Content-Type")).toBeNull();
    expect(up.photoId).toBe("p1");
  });
  it("lists the caller's reviews for one order", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ reviews: [{ id: "r1", photos: null }] }));
    vi.stubGlobal("fetch", fetchMock);
    const reviews = await listMyReviews("O 1");
    expect(fetchMock.mock.calls[0][0]).toBe("/auth/session/gateway/api/v1/products/reviews/me?orderId=O%201");
    expect(reviews[0].photos).toEqual([]);
  });
  it("carries the backend reason and the existing review id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json({ error: "x", code: 409, reason: "review_exists", reviewId: "r9" }, 409))
    );
    const err = await createReview("B", { orderId: "O", skuId: "S" }, { rating: 5, body: body10, photoIds: [] }).catch((e) => e);
    expect(err).toBeInstanceOf(ReviewRequestError);
    expect(err.reason).toBe("review_exists");
    expect(err.reviewId).toBe("r9");
    expect(reviewErrorKey(err)).toBe("reviews.write.exists");
  });
});

describe("review draft", () => {
  it("sends fit only with an answer, and {} to clear one", () => {
    expect(reviewRequestBody({ rating: 4, body: body10, photoIds: [] }).fit).toBeUndefined();
    expect(reviewRequestBody({ rating: 4, body: body10, photoIds: [], fit: { heightCm: 170 } }).fit).toEqual({});
    expect(
      reviewRequestBody({ rating: 4, body: body10, photoIds: [], fit: { result: "small", heightCm: 170, usualSize: " M " } }).fit
    ).toEqual({ result: "small", heightCm: 170, usualSize: "M" });
    expect(reviewRequestBody({ rating: 4, body: body10, photoIds: [], fit: { result: "large", heightCm: "" } }).fit).toEqual({
      result: "large",
    });
  });
  it("checks rating, length, photos and fit before submitting", () => {
    expect(reviewDraftErrors({ rating: 5, body: body10, photoIds: [] })).toEqual([]);
    expect(reviewDraftErrors({ rating: 0, body: "짧아요", photoIds: Array(11).fill("p") })).toEqual([
      "rating",
      "bodyShort",
      "photos",
    ]);
    expect(reviewDraftErrors({ rating: 3, body: "가".repeat(1001), photoIds: [] })).toEqual(["bodyLong"]);
    expect(reviewDraftErrors({ rating: 3, body: body10, photoIds: [], fit: { heightCm: 90, usualSize: "x".repeat(11) } })).toEqual([
      "height",
      "usualSize",
    ]);
  });
  it("refuses a wrong photo before uploading it", () => {
    expect(reviewPhotoProblem({ type: "image/jpeg", size: 1000 })).toBeNull();
    expect(reviewPhotoProblem({ type: "image/heic", size: 1000 })).toBe("type");
    expect(reviewPhotoProblem({ type: "image/png", size: 11 * 1024 * 1024 })).toBe("size");
  });
  it("maps failures to messages", () => {
    expect(reviewErrorKey(new ReviewRequestError(403, "not_reviewable"))).toBe("reviews.write.notReviewable");
    expect(reviewErrorKey(new ReviewRequestError(401))).toBe("reviews.write.signIn");
    expect(reviewErrorKey(new ReviewRequestError(429))).toBe("reviews.write.rateLimited");
    expect(reviewErrorKey(new ReviewRequestError(0))).toBe("reviews.write.unavailable");
    expect(reviewErrorKey(new Error("x"))).toBe("reviews.write.failed");
  });
});

describe("resolveReviewLine", () => {
  it("uses the order line when it has both ids", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await resolveReviewLine("O1", { productId: "P", skuId: "S", sku: "X" })).toEqual({
      orderId: "O1",
      productId: "P",
      skuId: "S",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("looks an older line up by its SKU", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ skuId: "S2", productId: "P2" }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await resolveReviewLine("O1", { sku: "DUP_A" })).toEqual({ orderId: "O1", productId: "P2", skuId: "S2" });
    expect(fetchMock.mock.calls[0][0]).toBe("/auth/session/gateway/api/v1/products/variants/by-sku/DUP_A");
  });
  it("gives up when the catalog no longer has the variant", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ error: "not found" }, 404)));
    expect(await resolveReviewLine("O1", { skuId: "gone", sku: "X" })).toBeNull();
  });
});

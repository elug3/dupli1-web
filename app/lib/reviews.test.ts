import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EMPTY_SUMMARY,
  dominantFit,
  fetchProductReviews,
  fetchReviewPhotos,
  filledStars,
  formatReviewDate,
  ratingShares,
  reviewQueryString,
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

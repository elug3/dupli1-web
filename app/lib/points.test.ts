import { describe, expect, it } from "vitest";
import {
  formatPoints,
  mapPointsSummary,
  parsePointsInput,
  reviewRewardPoints,
  tierRatePercent,
  usablePoints,
} from "./points";

describe("usablePoints", () => {
  it("is limited by the balance and by the goods, never delivery", () => {
    expect(usablePoints(5_000, 12_000, 100_000)).toBe(5_000);
    expect(usablePoints(50_000, 12_000, 100_000)).toBe(12_000);
    expect(usablePoints(50_000, 80_000, 30_000)).toBe(30_000);
  });
  it("drops fractions and refuses negatives", () => {
    expect(usablePoints(1_500.9, 10_000, 10_000)).toBe(1_500);
    expect(usablePoints(-5, 10_000, 10_000)).toBe(0);
    expect(usablePoints(Number.NaN, 10_000, 10_000)).toBe(0);
  });
});

describe("parsePointsInput", () => {
  it("reads digits with commas", () => {
    expect(parsePointsInput("12,500")).toBe(12_500);
    expect(parsePointsInput("")).toBe(0);
    expect(parsePointsInput("12a")).toBe(0);
  });
});

describe("reviewRewardPoints", () => {
  it("needs 20 characters, and a photo makes it 5,000", () => {
    expect(reviewRewardPoints(19, 3)).toBe(0);
    expect(reviewRewardPoints(20, 0)).toBe(2_000);
    expect(reviewRewardPoints(20, 1)).toBe(5_000);
  });
});

describe("mapPointsSummary", () => {
  it("maps the payment wire shape", () => {
    const s = mapPointsSummary({
      balance: 7_500,
      pending: 3_750,
      expiring: 4_500,
      expiring_by: "2026-12-18T00:00:00Z",
      tier: { code: "silver", multiplier: 15, min_spend_won: 1_000_000, spend_won: 1_840_000, next: { code: "gold", multiplier: 20, min_spend_won: 3_000_000 } },
      entries: [{ id: "e1", kind: "review", points: 5_000, order_id: "o1", note: "photo", created_at: "2026-11-18T00:00:00Z" }],
      next_cursor: "c1",
    });
    expect(s.tier.next?.minSpendWon).toBe(3_000_000);
    expect(s.entries[0].orderId).toBe("o1");
    expect(tierRatePercent(s.tier.multiplier)).toBe("1.5");
    expect(formatPoints(-12_500)).toBe("12,500");
  });
});

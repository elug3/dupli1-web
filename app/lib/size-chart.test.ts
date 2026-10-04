import { describe, expect, it } from "vitest";

import { formatCm, normalizeSizeChart, sizeChartColumns } from "./size-chart";

describe("size chart", () => {
  it("orders rows XXS→XXL whatever order they arrive in", () => {
    const rows = normalizeSizeChart([
      { size: "XXL", chestCm: 68 },
      { size: "s", chestCm: 56 },
      { size: "XXS", chestCm: 50 },
      { size: "XL", chestCm: 65 },
      { size: "M", chestCm: 59 },
      { size: "XS", chestCm: 53 },
      { size: "L", chestCm: 62 },
    ]);
    expect(rows.map((row) => row.size)).toEqual(["XXS", "XS", "S", "M", "L", "XL", "XXL"]);
  });

  it("drops rows without a size or any measurement, and zero measurements", () => {
    const rows = normalizeSizeChart([
      { size: "", chestCm: 50 },
      { size: "M" },
      { size: "L", chestCm: 0, lengthCm: 70 },
      null,
    ]);
    expect(rows).toEqual([{ size: "L", lengthCm: 70 }]);
  });

  it("is empty for a missing chart", () => {
    expect(normalizeSizeChart(undefined)).toEqual([]);
    expect(normalizeSizeChart({})).toEqual([]);
  });

  it("shows only measurements some row gives, in a fixed order", () => {
    const rows = normalizeSizeChart([
      { size: "M", sleeveCm: 63, chestCm: 59 },
      { size: "L", chestCm: 62 },
    ]);
    expect(sizeChartColumns(rows)).toEqual(["chestCm", "sleeveCm"]);
  });

  it("formats centimetres, with a dash for a gap", () => {
    expect(formatCm(59.5)).toBe("59.5");
    expect(formatCm(62)).toBe("62");
    expect(formatCm(undefined)).toBe("—");
  });
});

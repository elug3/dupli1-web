import { describe, expect, it } from "vitest";
import {
  formatDimensionsCm,
  normalizeDimensions,
} from "./product-dimensions";

const label = (axis: "width" | "height" | "depth") =>
  ({ width: "W", height: "H", depth: "D" })[axis];

describe("normalizeDimensions", () => {
  it("drops missing, zero and non-finite axes", () => {
    expect(
      normalizeDimensions({ widthMm: 340, heightMm: 0, depthMm: Number.NaN })
    ).toEqual({ widthMm: 340 });
  });

  it("returns null when nothing is known", () => {
    expect(normalizeDimensions(undefined)).toBeNull();
    expect(normalizeDimensions({})).toBeNull();
    expect(normalizeDimensions({ widthMm: 0 })).toBeNull();
  });
});

describe("formatDimensionsCm", () => {
  it("formats every axis in centimeters", () => {
    expect(
      formatDimensionsCm({ widthMm: 340, heightMm: 220, depthMm: 80 }, label)
    ).toBe("W 34 × H 22 × D 8 cm");
  });

  it("keeps half centimeters", () => {
    expect(formatDimensionsCm({ widthMm: 225, heightMm: 105 }, label)).toBe(
      "W 22.5 × H 10.5 cm"
    );
  });

  it("omits an axis that does not apply", () => {
    expect(formatDimensionsCm({ widthMm: 190, heightMm: 100 }, label)).toBe(
      "W 19 × H 10 cm"
    );
  });

  it("returns empty string without dimensions", () => {
    expect(formatDimensionsCm(undefined, label)).toBe("");
  });
});

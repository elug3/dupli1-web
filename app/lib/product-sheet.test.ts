import { describe, expect, it } from "vitest";
import { hasReachedScrollEnd, resolveSheetDrag } from "./product-sheet";

// A 412×839 phone with a 180px sheet head and a tall sheet.
const base = { startY: 700, viewportHeight: 839, peekHeight: 180, sheetHeight: 1400 };

describe("resolveSheetDrag", () => {
  it("ignores movement inside the dead zone", () => {
    expect(resolveSheetDrag({ ...base, y: 700 - 19 })).toEqual({
      active: false,
      offset: 0,
      commit: false,
    });
  });

  it("follows the finger 1:1 once past the dead zone", () => {
    expect(resolveSheetDrag({ ...base, y: 640 })).toEqual({
      active: true,
      offset: -60,
      commit: false,
    });
  });

  it("commits at a tenth of the viewport height", () => {
    expect(resolveSheetDrag({ ...base, y: 700 - 83 }).commit).toBe(false);
    expect(resolveSheetDrag({ ...base, y: 700 - 84 }).commit).toBe(true);
  });

  it("clamps the lift so the sheet covers at most 70% of the viewport", () => {
    // 0.7 × 839 − 180 = 407.3
    expect(resolveSheetDrag({ ...base, y: 0 }).offset).toBeCloseTo(-407.3);
  });

  it("never lifts past the sheet's own height", () => {
    expect(resolveSheetDrag({ ...base, sheetHeight: 150, y: 0 }).offset).toBe(-150);
  });

  it("never moves the sheet down", () => {
    const drag = resolveSheetDrag({ ...base, y: 800 });
    expect(drag).toEqual({ active: true, offset: 0, commit: false });
    expect(Object.is(drag.offset, -0)).toBe(false);
  });
});

describe("hasReachedScrollEnd", () => {
  it("is true at the end, allowing a pixel of rounding", () => {
    expect(hasReachedScrollEnd({ scrollTop: 3501, clientHeight: 687, scrollHeight: 4188 })).toBe(true);
    expect(hasReachedScrollEnd({ scrollTop: 3500.4, clientHeight: 687, scrollHeight: 4188 })).toBe(true);
  });

  it("is false before the end", () => {
    expect(hasReachedScrollEnd({ scrollTop: 900, clientHeight: 687, scrollHeight: 4188 })).toBe(false);
  });

  it("is false for a gallery that cannot scroll (a single image)", () => {
    expect(hasReachedScrollEnd({ scrollTop: 0, clientHeight: 687, scrollHeight: 687 })).toBe(false);
  });
});

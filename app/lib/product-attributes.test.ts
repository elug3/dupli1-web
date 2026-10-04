import { describe, expect, it } from "vitest";

import { attributeKey, attributeLabel, attributeRows } from "./product-attributes";

describe("product attributes", () => {
  it("reads keys however they are spelled", () => {
    for (const raw of ["fillWeight", "fill_weight", "Fill Weight", "fill-weight"]) {
      expect(attributeKey(raw)).toBe("fill-weight");
      expect(attributeLabel(raw)).toBe("Fill weight");
    }
  });

  it("keeps acronyms and Korean keys as written", () => {
    expect(attributeLabel("RDS certified")).toBe("RDS certified");
    expect(attributeLabel("충전재")).toBe("충전재");
  });

  it("lists every non-empty pair in order", () => {
    expect(
      attributeRows({ fill: "90% duck down", lining: " ", care: "Dry clean only" })
    ).toEqual([
      { key: "fill", label: "Fill", value: "90% duck down" },
      { key: "care", label: "Care", value: "Dry clean only" },
    ]);
    expect(attributeRows(undefined)).toEqual([]);
  });
});

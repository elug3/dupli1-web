import { describe, expect, it } from "vitest";

import {
  carrierDisplayName,
  carrierTrackingUrl,
  normalizeCarrierCode,
  waybillDigits,
} from "./shipment-tracking";

const t = (key: string) => `<${key}>`;

describe("normalizeCarrierCode", () => {
  it("accepts every code order allows at ship time", () => {
    for (const code of ["cj", "hanjin", "lotte", "logen", "epost", "other"]) {
      expect(normalizeCarrierCode(code)).toBe(code);
    }
  });

  it("tolerates case and whitespace", () => {
    expect(normalizeCarrierCode(" CJ ")).toBe("cj");
  });

  it("returns null for free text and missing values", () => {
    expect(normalizeCarrierCode("CJ대한통운")).toBeNull();
    expect(normalizeCarrierCode(undefined)).toBeNull();
    expect(normalizeCarrierCode("")).toBeNull();
  });
});

describe("carrierDisplayName", () => {
  it("translates a known carrier code", () => {
    expect(carrierDisplayName("hanjin", undefined, t)).toBe("<tracking.carrier.hanjin>");
  });

  it("shows the manager's carrier name for other", () => {
    expect(carrierDisplayName("other", " 경동택배 ", t)).toBe("경동택배");
  });

  it("falls back to a generic label when other has no name", () => {
    expect(carrierDisplayName("other", undefined, t)).toBe("<tracking.carrier.other>");
  });

  it("keeps a pre-code free-text carrier as it was stored", () => {
    expect(carrierDisplayName("CJ대한통운", undefined, t)).toBe("CJ대한통운");
  });

  it("is empty with no carrier", () => {
    expect(carrierDisplayName(undefined, undefined, t)).toBeUndefined();
  });
});

describe("waybillDigits", () => {
  it("strips the hyphens and spaces carriers print", () => {
    expect(waybillDigits("1234-5678 9012")).toBe("123456789012");
  });

  it("refuses anything that is not a waybill number", () => {
    expect(waybillDigits("abc123456")).toBeNull();
    expect(waybillDigits("123")).toBeNull();
    expect(waybillDigits("1".repeat(21))).toBeNull();
    expect(waybillDigits(undefined)).toBeNull();
  });
});

describe("carrierTrackingUrl", () => {
  it("links each domestic carrier's tracking page with the bare digits", () => {
    expect(carrierTrackingUrl("cj", "1234-5678-9012")).toBe(
      "https://trace.cjlogistics.com/next/tracking.html?wblNo=123456789012"
    );
    expect(carrierTrackingUrl("lotte", "123456789012")).toContain("InvNo=123456789012");
    expect(carrierTrackingUrl("hanjin", "123456789012")).toContain(
      "wblnumText2=123456789012"
    );
    expect(carrierTrackingUrl("logen", "12345678901")).toBe(
      "https://www.ilogen.com/web/personal/trace/12345678901"
    );
    expect(carrierTrackingUrl("epost", "6012345678901")).toContain(
      "sid1=6012345678901"
    );
  });

  it("only ever links to https carrier pages", () => {
    for (const code of ["cj", "hanjin", "lotte", "logen", "epost"]) {
      expect(carrierTrackingUrl(code, "123456789012")).toMatch(/^https:\/\//);
    }
  });

  it("has no link for other or unknown carriers", () => {
    expect(carrierTrackingUrl("other", "123456789012")).toBeNull();
    expect(carrierTrackingUrl("CJ대한통운", "123456789012")).toBeNull();
  });

  it("has no link for a tracking number that is not a waybill", () => {
    expect(carrierTrackingUrl("cj", "javascript:alert(1)")).toBeNull();
    expect(carrierTrackingUrl("cj", undefined)).toBeNull();
  });
});

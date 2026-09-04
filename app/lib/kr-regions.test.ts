import { describe, expect, it } from "vitest";
import {
  KR_PROVINCES,
  KR_REGIONS,
  districtsForProvince,
  isValidDistrict,
} from "./kr-regions";

describe("KR region map", () => {
  it("lists 17 provinces including recent renames", () => {
    expect(KR_PROVINCES).toHaveLength(17);
    expect(KR_PROVINCES).toContain("강원특별자치도");
    expect(KR_PROVINCES).toContain("전북특별자치도");
  });

  it("districtsForProvince returns districts for a known province", () => {
    const districts = districtsForProvince("서울특별시");
    expect(districts.length).toBeGreaterThan(20);
    expect(districts).toContain("강남구");
  });

  it("districtsForProvince returns empty for unknown province", () => {
    expect(districtsForProvince("없는도")).toEqual([]);
  });

  it("isValidDistrict validates province/city pairs", () => {
    expect(isValidDistrict("서울특별시", "강남구")).toBe(true);
    expect(isValidDistrict("서울특별시", "없는구")).toBe(false);
  });

  it("includes 군위군 under 대구광역시 after 2023 transfer", () => {
    expect(districtsForProvince("대구광역시")).toContain("군위군");
    expect(
      KR_REGIONS.find((r) => r.province === "경상북도")?.districts
    ).not.toContain("군위군");
  });
});

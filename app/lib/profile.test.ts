import { describe, expect, it } from "vitest";
import { validateAddressInput } from "./profile";

const validAddress = {
  recipientName: "윤라희",
  recipientPhone: "010-4112-5167",
  postalCode: "06194",
  addressLine1: "테헤란로 78길 14-12",
  addressLine2: "9층",
  city: "강남구",
  province: "서울특별시",
  pccc: "p123456789012",
};

describe("validateAddressInput", () => {
  it("returns null for a complete valid address", () => {
    expect(validateAddressInput(validAddress)).toBeNull();
  });

  it("requires pccc (Korean customs clearance)", () => {
    expect(validateAddressInput({ ...validAddress, pccc: "" })).toBe("pccc");
    expect(validateAddressInput({ ...validAddress, pccc: "   " })).toBe("pccc");
    expect(validateAddressInput({ ...validAddress, pccc: "invalid" })).toBe(
      "pccc"
    );
  });

  it("flags missing required fields before pccc", () => {
    expect(
      validateAddressInput({ ...validAddress, recipientName: "  " })
    ).toBe("recipientName");
    expect(
      validateAddressInput({ ...validAddress, recipientPhone: "123" })
    ).toBe("recipientPhone");
    expect(
      validateAddressInput({ ...validAddress, postalCode: "0619" })
    ).toBe("postalCode");
    expect(validateAddressInput({ ...validAddress, city: "" })).toBe("city");
    expect(validateAddressInput({ ...validAddress, province: "" })).toBe(
      "province"
    );
  });
});

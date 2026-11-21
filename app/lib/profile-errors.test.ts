import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createAddress,
  deleteAddress,
  getCustomerProfile,
  setDefaultAddress,
  updateAddress,
  updateCustomerProfile,
} from "./profile";

afterEach(() => {
  vi.unstubAllGlobals();
});

const address = {
  recipientName: "윤라희",
  recipientPhone: "010-4112-5167",
  postalCode: "06194",
  addressLine1: "테헤란로 78길 14-12",
  city: "강남구",
  province: "서울특별시",
  pccc: "p123456789012",
};

const cases: [string, () => Promise<unknown>, string][] = [
  ["getCustomerProfile", () => getCustomerProfile(), "Failed to load profile"],
  [
    "updateCustomerProfile",
    () => updateCustomerProfile({ displayName: "x" }),
    "Failed to update profile",
  ],
  ["createAddress", () => createAddress(address), "Failed to save address"],
  ["updateAddress", () => updateAddress("a1", address), "Failed to update address"],
  ["deleteAddress", () => deleteAddress("a1"), "Failed to delete address"],
  [
    "setDefaultAddress",
    () => setDefaultAddress("a1"),
    "Failed to set default address",
  ],
];

describe("profile.ts error messages", () => {
  for (const [name, call, fallback] of cases) {
    it(`${name} falls back to "${fallback}" on a non-JSON failure`, async () => {
      vi.stubGlobal("fetch", vi.fn(async () => new Response("<html/>", { status: 500 })));
      await expect(call()).rejects.toThrow(new Error(fallback));
    });

    it(`${name} surfaces the body error`, async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(JSON.stringify({ error: "server said no" }), { status: 400 }))
      );
      await expect(call()).rejects.toThrow(new Error("server said no"));
    });
  }
});

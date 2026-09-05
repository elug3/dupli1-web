import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearCheckoutDraft,
  loadCheckoutDraft,
  saveCheckoutDraft,
} from "./checkout-draft";

const USER = "user-1";
const FORM = { name: "윤라희", pccc: "P123456789012" };

/** Minimal in-memory localStorage; the node test env has none. */
function stubStorage() {
  const map = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  });
  return map;
}

let store: Map<string, string>;

beforeEach(() => {
  store = stubStorage();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function save(userId = USER) {
  saveCheckoutDraft({
    userId,
    activeStep: "payment",
    form: FORM,
    selectedAddressId: null,
    saveAddress: true,
    promoInput: "WELCOME",
  });
}

describe("checkout draft round-trip", () => {
  it("restores the form, step, and flags", () => {
    save();
    const draft = loadCheckoutDraft<typeof FORM>(USER);
    expect(draft?.form).toEqual(FORM);
    expect(draft?.activeStep).toBe("payment");
    expect(draft?.saveAddress).toBe(true);
    expect(draft?.promoInput).toBe("WELCOME");
  });

  it("ignores a draft belonging to another account and deletes it", () => {
    save("someone-else");
    expect(loadCheckoutDraft(USER)).toBeNull();
    // Dropped on read so another shopper's address does not linger on disk.
    expect(store.size).toBe(0);
  });

  it("returns null when nothing is stored", () => {
    expect(loadCheckoutDraft(USER)).toBeNull();
  });

  it("refuses to save or load without a user id", () => {
    saveCheckoutDraft({
      userId: "",
      activeStep: "shipping",
      form: FORM,
      selectedAddressId: null,
      saveAddress: false,
      promoInput: "",
    });
    expect(store.size).toBe(0);
    expect(loadCheckoutDraft("")).toBeNull();
  });
});

describe("checkout draft expiry", () => {
  it("keeps a draft inside the 30-minute window", () => {
    vi.useFakeTimers();
    save();
    vi.advanceTimersByTime(29 * 60 * 1000);
    expect(loadCheckoutDraft(USER)).not.toBeNull();
  });

  it("drops PII once the window passes", () => {
    vi.useFakeTimers();
    save();
    vi.advanceTimersByTime(31 * 60 * 1000);
    expect(loadCheckoutDraft(USER)).toBeNull();
    expect(store.size).toBe(0);
  });
});

describe("checkout draft resilience", () => {
  it("discards malformed JSON instead of throwing", () => {
    store.set("dupli1_checkout_draft", "{not json");
    expect(loadCheckoutDraft(USER)).toBeNull();
  });

  it("discards a draft written by an older version", () => {
    store.set(
      "dupli1_checkout_draft",
      JSON.stringify({ version: 0, userId: USER, expiresAt: Date.now() + 1000, form: FORM })
    );
    expect(loadCheckoutDraft(USER)).toBeNull();
  });

  it("clearCheckoutDraft removes the entry", () => {
    save();
    clearCheckoutDraft();
    expect(loadCheckoutDraft(USER)).toBeNull();
  });
});

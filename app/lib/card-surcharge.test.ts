import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cardSurchargeWon,
  completeCheckoutSession,
  formatSurchargeRate,
  getCardSurchargeBps,
} from "./checkout";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("card surcharge", () => {
  it("rounds down to the won like order does", () => {
    expect(cardSurchargeWon(100000, 1000)).toBe(10000);
    expect(cardSurchargeWon(12345, 1000)).toBe(1234);
    expect(cardSurchargeWon(12345, 250)).toBe(308);
    expect(cardSurchargeWon(0, 1000)).toBe(0);
    expect(cardSurchargeWon(100000, 0)).toBe(0);
  });

  it("formats the rate", () => {
    expect(formatSurchargeRate(1000)).toBe("10%");
    expect(formatSurchargeRate(250)).toBe("2.5%");
  });

  it("reads the rate from order settings, null when unpublished", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      json: async () => ({ limits: { card_surcharge_bps: 1000 } }),
    }));
    expect(await getCardSurchargeBps()).toBe(1000);

    vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => ({ limits: {} }) }));
    expect(await getCardSurchargeBps()).toBeNull();
  });

  it("complete sends the payment method and maps the surcharge back", async () => {
    const bodies: unknown[] = [];
    vi.stubGlobal("fetch", async (_input: RequestInfo, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          session: { id: "cs_1", status: "completed" },
          order: {
            id: "ord_1",
            customer_id: "cust-1",
            status: "pending",
            subtotal_won: 100000,
            payment_method: "credit_card",
            card_surcharge_won: 10000,
            total_won: 110000,
          },
        }),
      };
    });
    const { order } = await completeCheckoutSession(
      "cs_1",
      {
        recipientName: "Kim",
        recipientPhone: "01012345678",
        shippingAddress: { postalCode: "06236", addressLine1: "1 Test", city: "Seoul", province: "Seoul" },
      } as Parameters<typeof completeCheckoutSession>[1],
      "bypass"
    );
    expect(bodies[0]).toMatchObject({ payment_method: "bypass" });
    expect(order.cardSurchargeWon).toBe(10000);
    expect(order.paymentMethod).toBe("credit_card");
  });
});

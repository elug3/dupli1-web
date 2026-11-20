import { afterEach, describe, expect, it, vi } from "vitest";
import { completeCheckoutSession } from "./checkout";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("payment method", () => {
  it("complete sends the payment method and maps an old order's surcharge back", async () => {
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

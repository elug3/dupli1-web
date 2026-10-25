import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiRequestError,
  PaymentMethodDisabledError,
  createPayment,
  getPaymentSettings,
  paymentSettingsFromMethods,
} from "./checkout";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("paymentSettingsFromMethods", () => {
  it("drops a switched-off card and keeps the operator's message", () => {
    expect(
      paymentSettingsFromMethods([
        { method: "credit_card", available: false, disabled: true, message: " 점검 중 " },
        { method: "bypass", available: true },
      ])
    ).toEqual({
      methodCreditCard: false,
      methodBypass: true,
      creditCardDisabled: true,
      creditCardDisabledMessage: "점검 중",
    });
  });

  it("does not call an unconfigured card switched off", () => {
    const settings = paymentSettingsFromMethods([
      { method: "credit_card", available: false, disabled: false },
    ]);
    expect(settings.methodCreditCard).toBe(false);
    expect(settings.creditCardDisabled).toBe(false);
    expect(settings.methodBypass).toBe(false);
  });
});

describe("getPaymentSettings", () => {
  it("reads the live methods endpoint", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo) => {
      calls.push(String(input));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          methods: [{ method: "credit_card", available: false, disabled: true }],
        }),
      };
    });
    const settings = await getPaymentSettings();
    expect(calls).toEqual(["/api/v1/payments/methods"]);
    expect(settings.creditCardDisabled).toBe(true);
    expect(settings.creditCardDisabledMessage).toBeNull();
  });

  it("falls back to /settings where payment has no methods endpoint yet", async () => {
    vi.stubGlobal("fetch", async (input: RequestInfo) =>
      String(input) === "/api/v1/payments/methods"
        ? { ok: false, status: 404, json: async () => ({}) }
        : {
            ok: true,
            status: 200,
            json: async () => ({ features: { method_credit_card: true, method_bypass: true } }),
          }
    );
    expect(await getPaymentSettings()).toEqual({ methodCreditCard: true, methodBypass: true });
  });
});

describe("a refused payment method", () => {
  it("surfaces as PaymentMethodDisabledError with the shopper message", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: false,
      status: 409,
      json: async () => ({
        error: "payment method is temporarily disabled: credit_card",
        code: 409,
        reason: "payment_method_disabled",
        method: "credit_card",
        message: "카드 결제 점검 중입니다",
      }),
    }));
    const err = await createPayment("ord-1").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PaymentMethodDisabledError);
    expect(err).toBeInstanceOf(ApiRequestError);
    expect((err as PaymentMethodDisabledError).method).toBe("credit_card");
    expect((err as PaymentMethodDisabledError).shopperMessage).toBe("카드 결제 점검 중입니다");
  });

  it("leaves any other 409 a plain ApiRequestError", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: false,
      status: 409,
      json: async () => ({ error: "order was priced for a different payment method", code: 409 }),
    }));
    const err = await createPayment("ord-1").catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(PaymentMethodDisabledError);
    expect((err as ApiRequestError).message).toBe("order was priced for a different payment method");
  });
});

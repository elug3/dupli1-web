import { describe, expect, it } from "vitest";

import {
  confirmationPath,
  formatCardNumberInput,
  installmentOptions,
  interpretCardResponse,
  parsePaymentRecord,
  payPageState,
  readCardForm,
} from "./card-payment";

const keyInPayment = {
  id: "pay_000031",
  order_id: "ord_000031",
  amount_won: 77000,
  status: "requires_payment",
  method: "credit_card",
  provider: "nano",
};

describe("payPageState", () => {
  it("shows the form for a key-in payment (no checkout_url)", () => {
    expect(payPageState(parsePaymentRecord(keyInPayment)!)).toEqual({
      kind: "form",
    });
  });

  it("sends a 인증결제 payment on to the NANO window", () => {
    const record = parsePaymentRecord({
      ...keyInPayment,
      checkout_url:
        "https://dupli1.com/api/v1/payments/pay_000031/nano/checkout",
    })!;
    expect(payPageState(record)).toEqual({ kind: "redirectWindow" });
  });

  it("never offers the form again once an approval went unanswered", () => {
    const record = parsePaymentRecord({
      ...keyInPayment,
      card_approval_unconfirmed: true,
    })!;
    expect(payPageState(record)).toEqual({ kind: "unconfirmed" });
  });

  it("goes to confirmation once paid, and closes a failed payment", () => {
    expect(
      payPageState(
        parsePaymentRecord({ ...keyInPayment, status: "succeeded" })!,
      ).kind,
    ).toBe("paid");
    expect(
      payPageState(parsePaymentRecord({ ...keyInPayment, status: "failed" })!)
        .kind,
    ).toBe("closed");
  });

  it("refuses something that is not a payment", () => {
    expect(parsePaymentRecord({ error: "not found" })).toBeNull();
    expect(parsePaymentRecord(null)).toBeNull();
  });
});

describe("interpretCardResponse", () => {
  it("is paid only for a succeeded payment", () => {
    expect(
      interpretCardResponse(200, { ...keyInPayment, status: "succeeded" }).kind,
    ).toBe("paid");
    expect(interpretCardResponse(200, keyInPayment)).toEqual({
      kind: "error",
      error: { code: "failed" },
    });
  });

  it("maps payment's reasons", () => {
    expect(
      interpretCardResponse(422, {
        reason: "invalid_card",
        field: "holder_id",
      }),
    ).toEqual({
      kind: "error",
      error: { code: "invalid_card", field: "holder_id" },
    });
    expect(
      interpretCardResponse(402, {
        reason: "card_declined",
        message: "비밀번호 오류",
        attempts_remaining: 3,
      }),
    ).toEqual({
      kind: "error",
      error: {
        code: "declined",
        message: "비밀번호 오류",
        attemptsRemaining: 3,
      },
    });
    expect(
      interpretCardResponse(409, { reason: "card_approval_unconfirmed" }).kind,
    ).toBe("error");
    expect(
      interpretCardResponse(409, { reason: "card_approval_unconfirmed" }),
    ).toMatchObject({
      error: { code: "unconfirmed" },
    });
    expect(
      interpretCardResponse(409, { reason: "card_attempts_exhausted" }),
    ).toMatchObject({
      error: { code: "attempts_exhausted" },
    });
    expect(
      interpretCardResponse(409, {
        reason: "payment_method_disabled",
        message: "점검 중",
      }),
    ).toMatchObject({ error: { code: "method_disabled", message: "점검 중" } });
    expect(
      interpretCardResponse(400, { error: "order is not pending" }),
    ).toMatchObject({
      error: { code: "order_closed" },
    });
    expect(interpretCardResponse(500, null)).toMatchObject({
      error: { code: "failed" },
    });
  });

  it("does not trust an unknown field name", () => {
    expect(
      interpretCardResponse(422, { reason: "invalid_card", field: "<script>" }),
    ).toMatchObject({
      error: { code: "invalid_card", field: "card_number" },
    });
  });
});

describe("readCardForm", () => {
  it("reads only the card fields, without separators", () => {
    const form = new FormData();
    form.set("card_number", " 4111 1111-1111 1111 ");
    form.set("exp_month", "07");
    form.set("exp_year", "30");
    form.set("card_password", "12");
    form.set("holder_id", "900101");
    form.set("holder_kind", "personal");
    form.set("cvc", "123");
    expect(readCardForm(form)).toEqual({
      card_number: "4111111111111111",
      exp_month: "07",
      exp_year: "30",
      card_password: "12",
      holder_id: "900101",
      installment: "00",
    });
  });
});

describe("helpers", () => {
  it("offers installments from ₩50,000", () => {
    expect(installmentOptions(49_999)).toEqual(["00"]);
    const options = installmentOptions(50_000);
    expect(options[0]).toBe("00");
    expect(options[1]).toBe("02");
    expect(options.at(-1)).toBe("12");
  });

  it("groups the card number in fours", () => {
    expect(formatCardNumberInput("4111111111111111")).toBe(
      "4111 1111 1111 1111",
    );
    expect(formatCardNumberInput("4111-11ab")).toBe("4111 11");
  });

  it("builds the confirmation path the page reads", () => {
    expect(confirmationPath("ord_1", "pay_1")).toBe(
      "/checkout/confirmation?order_id=ord_1&payment_id=pay_1",
    );
  });
});

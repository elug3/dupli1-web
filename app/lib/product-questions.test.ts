import { afterEach, describe, expect, it, vi } from "vitest";
import {
  QuestionRequestError,
  askProductQuestion,
  draftErrors,
  fitSummary,
  listMyProductQuestions,
  questionErrorKey,
  requestBody,
  withdrawProductQuestion,
} from "./product-questions";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestBody", () => {
  it("trims the question and keeps only the fit that was given", () => {
    expect(
      requestBody({ type: "size", body: "  M?  ", fit: { height_cm: 178, weight_kg: undefined, usual_size: " L " } })
    ).toEqual({ type: "size", body: "M?", fit: { height_cm: 178, usual_size: "L" } });
  });

  it("drops fit off a question that is not about size", () => {
    expect(requestBody({ type: "stock", body: "언제 입고돼요?", fit: { height_cm: 178 } })).toEqual({
      type: "stock",
      body: "언제 입고돼요?",
    });
  });

  it("drops an empty fit", () => {
    expect(requestBody({ type: "size", body: "M?", fit: { usual_size: "  " } })).toEqual({
      type: "size",
      body: "M?",
    });
  });
});

describe("draftErrors", () => {
  it("needs a question within the limit", () => {
    expect(draftErrors({ type: "other", body: "   " })).toEqual(["qna.error.bodyRequired"]);
    expect(draftErrors({ type: "other", body: "가".repeat(1001) })).toEqual(["qna.error.bodyTooLong"]);
    // Counted in characters, as support counts runes.
    expect(draftErrors({ type: "other", body: "가".repeat(1000) })).toEqual([]);
  });

  it("checks fit ranges on a size question", () => {
    expect(
      draftErrors({ type: "size", body: "M?", fit: { height_cm: 90, weight_kg: 250, usual_size: "XXXXXXXXXXL" } })
    ).toEqual(["qna.error.height", "qna.error.weight", "qna.error.usualSize"]);
    expect(draftErrors({ type: "size", body: "M?", fit: { height_cm: 178, weight_kg: 70 } })).toEqual([]);
  });
});

describe("fitSummary", () => {
  it("joins what was given", () => {
    expect(fitSummary({ height_cm: 178, weight_kg: 70, usual_size: "L" }, "평소")).toBe("178cm · 70kg · 평소 L");
    expect(fitSummary({ usual_size: "M" }, "usually")).toBe("usually M");
    expect(fitSummary(undefined, "평소")).toBe("");
  });
});

describe("questionErrorKey", () => {
  it("maps support's codes to copy", () => {
    expect(questionErrorKey(new QuestionRequestError(429, "rate_limited"))).toBe("qna.error.rateLimited");
    expect(questionErrorKey(new QuestionRequestError(409, "question_answered"))).toBe("qna.error.answered");
    expect(questionErrorKey(new QuestionRequestError(422, "invalid_reference"))).toBe("qna.error.variant");
    expect(questionErrorKey(new QuestionRequestError(0))).toBe("qna.error.offline");
    expect(questionErrorKey(new QuestionRequestError(401))).toBe("qna.error.signedOut");
    expect(questionErrorKey(new Error("boom"))).toBe("qna.error.generic");
  });
});

describe("requests", () => {
  it("goes through the session gateway", async () => {
    const calls: Array<{ url: string; method: string; body?: unknown }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown, init?: RequestInit) => {
        calls.push({
          url: String(url),
          method: init?.method ?? "GET",
          body: init?.body ? JSON.parse(String(init.body)) : undefined,
        });
        if (init?.method === "DELETE") return new Response(null, { status: 204 });
        if (init?.method === "POST") return json({ id: "Q1" }, 201);
        return json({ questions: [{ id: "Q1" }] });
      })
    );

    expect(await listMyProductQuestions("P 01")).toEqual([{ id: "Q1" }]);
    await askProductQuestion("P01", "SKU01", { type: "product", body: "소재가 뭐예요?" });
    await withdrawProductQuestion("Q1");

    expect(calls).toEqual([
      { url: "/auth/session/gateway/api/v1/support/products/P%2001/questions", method: "GET", body: undefined },
      {
        url: "/auth/session/gateway/api/v1/support/products/P01/questions",
        method: "POST",
        body: { sku_id: "SKU01", type: "product", body: "소재가 뭐예요?" },
      },
      { url: "/auth/session/gateway/api/v1/support/me/product-questions/Q1", method: "DELETE", body: undefined },
    ]);
  });

  it("surfaces support's error code", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "slow down", code: "rate_limited" }, 429)));
    await expect(askProductQuestion("P01", "SKU01", { type: "other", body: "?" })).rejects.toMatchObject({
      status: 429,
      code: "rate_limited",
    });
  });
});

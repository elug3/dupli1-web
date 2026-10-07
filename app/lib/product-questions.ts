/**
 * Product questions — 상품 문의 (dupli1 docs/support-product-questions.md).
 *
 * Private: a shopper asks about the variant they have selected, and only they
 * and staff ever see the question and its answer. The product page lists the
 * shopper's own questions about that product; 마이페이지 lists all of them.
 * Calls go through the session gateway, which attaches the shopper's token.
 */

const BASE = "/auth/session/gateway/api/v1/support";

export const QUESTION_TYPES = ["size", "stock", "product", "other"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** Mirrors support's `MaxQuestionRunes`. */
export const MAX_QUESTION_CHARS = 1000;

export type Fit = {
  height_cm?: number;
  weight_kg?: number;
  usual_size?: string;
};

export type ProductQuestion = {
  id: string;
  product_id: string;
  sku_id?: string;
  /** How the variant read when asked: "Black / M". */
  variant_label?: string;
  product_name?: string;
  type: QuestionType;
  body: string;
  fit?: Fit;
  status: "waiting" | "answered";
  answer?: string;
  answered_at?: string;
  created_at: string;
  updated_at: string;
  /** Still unanswered, so the shopper may edit or withdraw it. */
  editable: boolean;
};

export type QuestionDraft = {
  type: QuestionType;
  body: string;
  fit?: Fit;
};

export class QuestionRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string
  ) {
    super(code ?? `HTTP ${status}`);
  }
}

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, credentials: "same-origin", headers });
  } catch {
    throw new QuestionRequestError(0);
  }
  if (!res.ok) {
    let code: string | undefined;
    try {
      code = ((await res.json()) as { code?: string }).code;
    } catch {
      // Not JSON: the status is all there is.
    }
    throw new QuestionRequestError(res.status, code);
  }
  return res;
}

async function readList(res: Response): Promise<ProductQuestion[]> {
  const body = (await res.json()) as { questions?: ProductQuestion[] };
  return body.questions ?? [];
}

/** The signed-in shopper's questions about one product, newest first. */
export async function listMyProductQuestions(productId: string): Promise<ProductQuestion[]> {
  return readList(await call(`/products/${encodeURIComponent(productId)}/questions`));
}

/** Everything the signed-in shopper has asked, newest first. */
export async function listAllMyQuestions(): Promise<ProductQuestion[]> {
  return readList(await call("/me/product-questions"));
}

export async function askProductQuestion(
  productId: string,
  skuId: string,
  draft: QuestionDraft
): Promise<ProductQuestion> {
  const res = await call(`/products/${encodeURIComponent(productId)}/questions`, {
    method: "POST",
    body: JSON.stringify({ sku_id: skuId, ...requestBody(draft) }),
  });
  return (await res.json()) as ProductQuestion;
}

export async function editProductQuestion(id: string, draft: QuestionDraft): Promise<ProductQuestion> {
  const res = await call(`/me/product-questions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(requestBody(draft)),
  });
  return (await res.json()) as ProductQuestion;
}

export async function withdrawProductQuestion(id: string): Promise<void> {
  await call(`/me/product-questions/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** The wire body: trimmed text, and fit only on a size question that has any. */
export function requestBody(draft: QuestionDraft): { type: QuestionType; body: string; fit?: Fit } {
  const fit = draft.type === "size" ? cleanFit(draft.fit) : undefined;
  return { type: draft.type, body: draft.body.trim(), ...(fit ? { fit } : {}) };
}

function cleanFit(fit: Fit | undefined): Fit | undefined {
  if (!fit) return undefined;
  const out: Fit = {};
  if (fit.height_cm) out.height_cm = fit.height_cm;
  if (fit.weight_kg) out.weight_kg = fit.weight_kg;
  const usual = fit.usual_size?.trim();
  if (usual) out.usual_size = usual;
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Field-level problems the form shows before sending, as i18n keys. */
export function draftErrors(draft: QuestionDraft): string[] {
  const errors: string[] = [];
  const body = draft.body.trim();
  if (!body) errors.push("qna.error.bodyRequired");
  else if ([...body].length > MAX_QUESTION_CHARS) errors.push("qna.error.bodyTooLong");
  if (draft.type === "size" && draft.fit) {
    const { height_cm: h, weight_kg: w, usual_size: u } = draft.fit;
    if (h !== undefined && h !== 0 && (h < 100 || h > 230)) errors.push("qna.error.height");
    if (w !== undefined && w !== 0 && (w < 30 || w > 200)) errors.push("qna.error.weight");
    if (u && [...u.trim()].length > 10) errors.push("qna.error.usualSize");
  }
  return errors;
}

/** "178cm · 70kg · 평소 L" — the fit line under a size question. */
export function fitSummary(fit: Fit | undefined, usualLabel: string): string {
  if (!fit) return "";
  const parts: string[] = [];
  if (fit.height_cm) parts.push(`${fit.height_cm}cm`);
  if (fit.weight_kg) parts.push(`${fit.weight_kg}kg`);
  if (fit.usual_size) parts.push(`${usualLabel} ${fit.usual_size}`);
  return parts.join(" · ");
}

/** Maps support's error `code` to copy; unknown codes read as a plain failure. */
export function questionErrorKey(err: unknown): string {
  if (!(err instanceof QuestionRequestError)) return "qna.error.generic";
  switch (err.code) {
    case "invalid_question":
      return "qna.error.invalid";
    case "invalid_reference":
      return "qna.error.variant";
    case "rate_limited":
      return "qna.error.rateLimited";
    case "question_answered":
      return "qna.error.answered";
    case "reference_unavailable":
    case "questions_unavailable":
      return "qna.error.unavailable";
    default:
      if (err.status === 0) return "qna.error.offline";
      if (err.status === 401) return "qna.error.signedOut";
      if (err.status === 503) return "qna.error.unavailable";
      return "qna.error.generic";
  }
}

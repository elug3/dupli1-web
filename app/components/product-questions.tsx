import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router";

import { ConsultButton } from "~/components/support-chat";
import type { ContactContext } from "~/lib/contact";
import { useLanguage } from "~/lib/i18n";
import {
  type Fit,
  type ProductQuestion,
  type QuestionDraft,
  type QuestionType,
  MAX_QUESTION_CHARS,
  QUESTION_TYPES,
  QuestionRequestError,
  askProductQuestion,
  draftErrors,
  editProductQuestion,
  fitSummary,
  listMyProductQuestions,
  questionErrorKey,
  withdrawProductQuestion,
} from "~/lib/product-questions";
import type { PendingRef } from "~/lib/support-chat";

/** `?qna=ask` opens the form (the sign-in round trip); `?qna=<id>` one question (the reply email). */
const ASK_PARAM = "ask";

type Load = "loading" | "guest" | "unavailable" | "error" | "ready";

/**
 * 상품 문의 on the PDP: a row among the detail links that opens the shopper's
 * own questions about this product, and the form to ask one. Private — no
 * other shopper's question is ever listed (dupli1 docs/support-product-questions.md).
 */
export function ProductQuestionsRow({
  productId,
  skuId,
  variantLabel,
  isClothing,
  chatPending,
  telegramContext,
}: {
  productId: string;
  /** The selected variant; the question is about it. */
  skuId: string;
  variantLabel: string;
  isClothing: boolean;
  chatPending?: PendingRef;
  telegramContext?: ContactContext;
}) {
  const { t } = useLanguage();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [initial, setInitial] = useState<{ compose: boolean; focusId: string | null }>({
    compose: false,
    focusId: null,
  });

  // The reply email and the sign-in round trip both land with ?qna=.
  useEffect(() => {
    const qna = new URLSearchParams(location.search).get("qna");
    if (!qna) return;
    setInitial({ compose: qna === ASK_PARAM, focusId: qna === ASK_PARAM ? null : qna });
    setOpen(true);
  }, [location.search]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setInitial({ compose: false, focusId: null });
          setOpen(true);
        }}
        aria-haspopup="dialog"
        className="flex w-full items-center justify-between border-b border-zinc-100 py-4 text-left"
      >
        <span className="text-sm font-medium text-zinc-950">{t("qna.title")}</span>
        <span className="text-zinc-400">
          <ChevronRightIcon />
        </span>
      </button>
      <ProductQuestionsDialog
        open={open}
        onClose={() => setOpen(false)}
        productId={productId}
        skuId={skuId}
        variantLabel={variantLabel}
        isClothing={isClothing}
        initialCompose={initial.compose}
        focusId={initial.focusId}
        chatPending={chatPending}
        telegramContext={telegramContext}
      />
    </>
  );
}

function ProductQuestionsDialog({
  open,
  onClose,
  productId,
  skuId,
  variantLabel,
  isClothing,
  initialCompose,
  focusId,
  chatPending,
  telegramContext,
}: {
  open: boolean;
  onClose: () => void;
  productId: string;
  skuId: string;
  variantLabel: string;
  isClothing: boolean;
  initialCompose: boolean;
  focusId: string | null;
  chatPending?: PendingRef;
  telegramContext?: ContactContext;
}) {
  const { t } = useLanguage();
  const location = useLocation();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [load, setLoad] = useState<Load>("loading");
  const [questions, setQuestions] = useState<ProductQuestion[]>([]);
  // null: the list; "new": the ask form; a question: editing it.
  const [form, setForm] = useState<null | "new" | ProductQuestion>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoad((current) => (current === "ready" ? current : "loading"));
    try {
      setQuestions(await listMyProductQuestions(productId));
      setLoad("ready");
    } catch (err) {
      const status = err instanceof QuestionRequestError ? err.status : 0;
      setLoad(status === 401 ? "guest" : status === 404 || status === 503 ? "unavailable" : "error");
    }
  }, [productId]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (!open) return;
    setNotice(null);
    setForm(initialCompose ? "new" : null);
    void refresh();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, initialCompose, refresh]);

  const signInHref = `/login?next=${encodeURIComponent(`${location.pathname}?qna=${ASK_PARAM}`)}`;

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={[
        // A drawer from the right on desktop, a bottom sheet on phones.
        "bg-white p-0 text-ink backdrop:bg-black/50",
        "sm:my-0 sm:ml-auto sm:mr-0 sm:h-svh sm:max-h-none sm:w-[440px] sm:max-w-full",
        "max-sm:mb-0 max-sm:mt-auto max-sm:w-full max-sm:max-w-none max-sm:rounded-t-xl",
      ].join(" ")}
    >
      <div className="flex max-h-[90svh] flex-col sm:h-full sm:max-h-none">
        <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-5 sm:px-8 sm:pt-7">
          <h2
            id={titleId}
            className="text-xl font-light tracking-tight text-zinc-950 sm:text-2xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {form === null ? t("qna.title") : form === "new" ? t("qna.ask") : t("qna.edit")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("qna.close")}
            className="-mr-2 -mt-1 flex size-10 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-6 sm:px-8 sm:pb-8">
          <PrivacyNote />

          {load === "loading" && <p className="py-10 text-center text-sm text-zinc-400">{t("qna.loading")}</p>}

          {load === "guest" && (
            <div className="py-8 text-center">
              <p className="text-sm font-medium text-zinc-950">{t("qna.signIn.title")}</p>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">{t("qna.signIn.body")}</p>
              <Link
                to={signInHref}
                className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-zinc-950 px-8 text-sm font-medium text-white transition hover:bg-zinc-800"
              >
                {t("qna.signIn.cta")}
              </Link>
            </div>
          )}

          {(load === "unavailable" || load === "error") && (
            <div className="py-8 text-center">
              <p className="text-sm text-zinc-500">
                {t(load === "unavailable" ? "qna.unavailable" : "qna.error.generic")}
              </p>
              <button
                type="button"
                onClick={() => void refresh()}
                className="mt-4 inline-flex h-10 items-center rounded-full border border-zinc-300 px-6 text-sm text-zinc-950 transition hover:border-zinc-950"
              >
                {t("qna.retry")}
              </button>
            </div>
          )}

          {load === "ready" && form !== null && (
            <QuestionForm
              key={form === "new" ? "new" : form.id}
              editing={form === "new" ? null : form}
              variantLabel={form === "new" ? variantLabel : form.variant_label ?? ""}
              isClothing={isClothing}
              onCancel={() => setForm(null)}
              onSubmit={async (draft) => {
                if (form === "new") {
                  const asked = await askProductQuestion(productId, skuId, draft);
                  setQuestions((current) => [asked, ...current]);
                  setNotice(t("qna.sent"));
                } else {
                  const saved = await editProductQuestion(form.id, draft);
                  setQuestions((current) => current.map((q) => (q.id === saved.id ? saved : q)));
                }
                setForm(null);
              }}
              orderHint={
                <span onClickCapture={onClose}>
                  <ConsultButton
                    pending={chatPending}
                    telegramContext={telegramContext}
                    className="underline underline-offset-4 transition hover:text-zinc-950"
                  >
                    {t("qna.orderHintCta")}
                  </ConsultButton>
                </span>
              }
            />
          )}

          {load === "ready" && form === null && (
            <>
              <button
                type="button"
                onClick={() => {
                  setNotice(null);
                  setForm("new");
                }}
                className="mt-4 flex h-12 w-full items-center justify-center rounded-full bg-zinc-950 text-sm font-medium text-white transition hover:bg-zinc-800"
              >
                {t("qna.ask")}
              </button>
              {notice && (
                <p role="status" className="mt-3 text-center text-xs text-zinc-500">
                  {notice}
                </p>
              )}
              <div className="mt-8 flex items-baseline gap-2">
                <h3 className="text-xs font-medium text-zinc-950">{t("qna.mine")}</h3>
                <span className="text-xs tabular-nums text-zinc-400">{questions.length}</span>
              </div>
              {questions.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-400">{t("qna.empty")}</p>
              ) : (
                <ul className="mt-2 divide-y divide-zinc-100 border-t border-zinc-100">
                  {questions.map((question) => (
                    <li key={question.id}>
                      <QuestionCard
                        question={question}
                        focused={question.id === focusId}
                        onEdit={() => {
                          setNotice(null);
                          setForm(question);
                        }}
                        onWithdrawn={() =>
                          setQuestions((current) => current.filter((q) => q.id !== question.id))
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}

function PrivacyNote() {
  const { t } = useLanguage();
  return (
    <p className="flex items-center gap-1.5 text-xs text-zinc-500">
      <LockIcon />
      {t("qna.privacy")}
    </p>
  );
}

/** Ask or edit. Fit fields show for a size question about clothing only. */
function QuestionForm({
  editing,
  variantLabel,
  isClothing,
  onCancel,
  onSubmit,
  orderHint,
}: {
  editing: ProductQuestion | null;
  variantLabel: string;
  isClothing: boolean;
  onCancel: () => void;
  onSubmit: (draft: QuestionDraft) => Promise<void>;
  orderHint: React.ReactNode;
}) {
  const { t } = useLanguage();
  const bodyId = useId();
  const [type, setType] = useState<QuestionType>(editing?.type ?? "size");
  const [body, setBody] = useState(editing?.body ?? "");
  const [height, setHeight] = useState(numberField(editing?.fit?.height_cm));
  const [weight, setWeight] = useState(numberField(editing?.fit?.weight_kg));
  const [usual, setUsual] = useState(editing?.fit?.usual_size ?? "");
  const [errors, setErrors] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const showFit = type === "size" && isClothing;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sending) return;
    const fit: Fit | undefined = showFit
      ? { height_cm: toNumber(height), weight_kg: toNumber(weight), usual_size: usual }
      : undefined;
    const draft: QuestionDraft = { type, body, fit };
    const problems = draftErrors(draft);
    setErrors(problems);
    if (problems.length > 0) return;
    setSending(true);
    try {
      await onSubmit(draft);
    } catch (err) {
      setErrors([questionErrorKey(err)]);
    } finally {
      setSending(false);
    }
  }

  const length = [...body].length;

  return (
    <form onSubmit={(event) => void submit(event)} className="mt-5 flex flex-col gap-6" noValidate>
      {variantLabel && (
        <p className="text-xs text-zinc-500">{t("qna.option", { label: variantLabel })}</p>
      )}

      <fieldset>
        <legend className="text-xs font-medium text-zinc-950">{t("qna.type.label")}</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {QUESTION_TYPES.map((value) => (
            <label key={value} className="cursor-pointer">
              <input
                type="radio"
                name="qna-type"
                value={value}
                checked={type === value}
                onChange={() => setType(value)}
                className="peer sr-only"
              />
              <span className="inline-flex h-9 items-center rounded-full border border-zinc-300 px-4 text-xs text-zinc-700 transition peer-checked:border-zinc-950 peer-checked:bg-zinc-950 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-zinc-400">
                {t(`qna.type.${value}`)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {showFit && (
        <fieldset>
          <legend className="text-xs font-medium text-zinc-950">{t("qna.fit.title")}</legend>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <FitInput label={t("qna.fit.height")} value={height} onChange={setHeight} inputMode="numeric" />
            <FitInput label={t("qna.fit.weight")} value={weight} onChange={setWeight} inputMode="numeric" />
            <FitInput label={t("qna.fit.usual")} value={usual} onChange={setUsual} maxLength={10} />
          </div>
        </fieldset>
      )}

      <div>
        <label htmlFor={bodyId} className="text-xs font-medium text-zinc-950">
          {t("qna.body.label")}
        </label>
        <textarea
          id={bodyId}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={6}
          placeholder={t("qna.body.placeholder")}
          className="mt-3 block w-full resize-none rounded-md border border-zinc-300 p-3 text-sm text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-none"
        />
        <p className={`mt-1.5 text-right text-[11px] tabular-nums ${length > MAX_QUESTION_CHARS ? "text-red-600" : "text-zinc-400"}`}>
          {length.toLocaleString()} / {MAX_QUESTION_CHARS.toLocaleString()}
        </p>
      </div>

      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 text-xs text-red-600">
          {errors.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
      )}

      <p className="text-xs text-zinc-500">
        {t("qna.orderHint")} {orderHint}
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-12 flex-1 rounded-full border border-zinc-300 text-sm text-zinc-950 transition hover:border-zinc-950"
        >
          {t("qna.cancel")}
        </button>
        <button
          type="submit"
          disabled={sending}
          aria-busy={sending}
          className="h-12 flex-[2] rounded-full bg-zinc-950 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:bg-zinc-300"
        >
          {sending ? t("qna.sending") : editing ? t("qna.save") : t("qna.submit")}
        </button>
      </div>
    </form>
  );
}

function FitInput({
  label,
  value,
  onChange,
  inputMode,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: "numeric";
  maxLength?: number;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-[11px] text-zinc-500">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) =>
          onChange(inputMode === "numeric" ? event.target.value.replace(/\D/g, "").slice(0, 3) : event.target.value)
        }
        inputMode={inputMode}
        maxLength={maxLength}
        className="mt-1 h-10 w-full rounded-md border border-zinc-300 px-3 text-sm text-zinc-950 focus:border-zinc-950 focus:outline-none"
      />
    </div>
  );
}

/**
 * One question with its answer. Editable while unanswered: edit opens the
 * form, delete asks once inline. `productLink` adds the product's name, for
 * 마이페이지 where questions about every product are listed together.
 */
export function QuestionCard({
  question,
  focused = false,
  productLink,
  onEdit,
  onWithdrawn,
}: {
  question: ProductQuestion;
  focused?: boolean;
  productLink?: string;
  onEdit?: () => void;
  onWithdrawn: () => void;
}) {
  const { t, formatDateTime } = useLanguage();
  const ref = useRef<HTMLElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const answered = question.status === "answered";
  const fit = fitSummary(question.fit, t("qna.fit.usualShort"));

  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: "nearest" });
  }, [focused]);

  async function withdraw() {
    setBusy(true);
    setError(null);
    try {
      await withdrawProductQuestion(question.id);
      onWithdrawn();
    } catch (err) {
      setError(questionErrorKey(err));
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article ref={ref} className={`py-5 ${focused ? "bg-zinc-50 px-3 -mx-3" : ""}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
        <span
          className={[
            "rounded-full px-2 py-0.5",
            answered ? "bg-zinc-950 text-white" : "border border-zinc-300 text-zinc-600",
          ].join(" ")}
        >
          {t(answered ? "qna.status.answered" : "qna.status.waiting")}
        </span>
        <span className="text-zinc-500">{t(`qna.type.${question.type}`)}</span>
        <span className="text-zinc-300">·</span>
        <span className="text-zinc-400">{formatDateTime(question.created_at)}</span>
      </div>

      {productLink && question.product_name && (
        <Link to={productLink} className="mt-2 block text-sm font-medium text-zinc-950 underline-offset-4 hover:underline">
          {question.product_name}
        </Link>
      )}
      {question.variant_label && <p className="mt-1 text-xs text-zinc-400">{question.variant_label}</p>}

      <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-zinc-950">{question.body}</p>
      {fit && <p className="mt-1 text-xs text-zinc-500">{fit}</p>}

      {answered && question.answer && (
        <div className="mt-4 rounded-md bg-zinc-50 p-4">
          <p className="text-[11px] font-medium text-zinc-950">
            {t("qna.answer")}
            {question.answered_at && (
              <span className="ml-2 font-normal text-zinc-400">{formatDateTime(question.answered_at)}</span>
            )}
          </p>
          <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-zinc-700">{question.answer}</p>
        </div>
      )}

      {question.editable && (
        <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
          {confirming ? (
            <>
              <span className="text-zinc-950">{t("qna.deleteConfirm")}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void withdraw()}
                className="font-medium text-zinc-950 underline underline-offset-4"
              >
                {t("qna.delete")}
              </button>
              <button type="button" onClick={() => setConfirming(false)} className="hover:text-zinc-950">
                {t("qna.cancel")}
              </button>
            </>
          ) : (
            <>
              {onEdit && (
                <button type="button" onClick={onEdit} className="hover:text-zinc-950">
                  {t("qna.edit")}
                </button>
              )}
              <button type="button" onClick={() => setConfirming(true)} className="hover:text-zinc-950">
                {t("qna.delete")}
              </button>
            </>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {t(error)}
        </p>
      )}
    </article>
  );
}

function numberField(value: number | undefined): string {
  return value ? String(value) : "";
}

function toNumber(value: string): number | undefined {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function LockIcon() {
  return (
    <svg aria-hidden="true" className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="11" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none">
      <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

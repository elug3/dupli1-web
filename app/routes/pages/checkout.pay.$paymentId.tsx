import { useState } from "react";
import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";

import { MY_ACCOUNT_ORDERS_PATH } from "~/lib/account";
import { callPaymentsAsShopper } from "~/lib/bff-session.server";
import {
  cardFieldMessageKey,
  confirmationPath,
  formatCardNumberInput,
  installmentOptions,
  interpretCardResponse,
  parsePaymentRecord,
  payPageState,
  readCardForm,
  type CardField,
  type CardPayError,
} from "~/lib/card-payment";
import { useLanguage } from "~/lib/i18n";

/**
 * Key-in card payment (NANO 수기결제, Linear SER-106).
 *
 * The card is posted to this route's own action (SSR) and forwarded to
 * payment with the shopper's token: it never goes from browser JavaScript to
 * a gateway route, is never stored here, and is never sent back in a
 * response. A payment from before key-in still has a NANO window, and is sent
 * on to `/checkout/pay/:id/window`.
 */

const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

function withCookie(response: Response, setCookie?: string): Response {
  if (setCookie) response.headers.append("Set-Cookie", setCookie);
  return response;
}

function loginRedirect(paymentId: string, setCookie?: string): Response {
  const next = `/checkout/pay/${encodeURIComponent(paymentId)}`;
  return withCookie(
    redirect(`/login?next=${encodeURIComponent(next)}`),
    setCookie,
  );
}

export function meta() {
  return [
    { title: "Card payment — Dupli1" },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const id = (params.paymentId ?? "").trim();
  if (!ID_PATTERN.test(id)) throw redirect("/checkout?error=checkout_failed");

  const call = await callPaymentsAsShopper(
    request,
    "GET",
    `/api/v1/payments/${encodeURIComponent(id)}`,
  );
  if (call.kind === "signedOut") throw loginRedirect(id, call.setCookie);
  if (call.kind === "unavailable")
    throw redirect("/checkout?error=checkout_failed");
  const payment = call.status === 200 ? parsePaymentRecord(call.body) : null;
  if (!payment)
    throw withCookie(
      redirect("/checkout?error=checkout_failed"),
      call.setCookie,
    );

  const state = payPageState(payment);
  switch (state.kind) {
    case "paid":
      throw withCookie(
        redirect(confirmationPath(payment.orderId, payment.id)),
        call.setCookie,
      );
    case "redirectWindow":
      throw withCookie(
        redirect(`/checkout/pay/${encodeURIComponent(payment.id)}/window`),
        call.setCookie,
      );
  }
  return {
    paymentId: payment.id,
    orderId: payment.orderId,
    amountWon: payment.amountWon,
    view: state.kind as "form" | "unconfirmed" | "closed",
  };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const id = (params.paymentId ?? "").trim();
  if (!ID_PATTERN.test(id)) throw redirect("/checkout?error=checkout_failed");

  const card = readCardForm(await request.formData());
  const call = await callPaymentsAsShopper(
    request,
    "POST",
    `/api/v1/payments/${encodeURIComponent(id)}/card`,
    card,
  );
  if (call.kind === "signedOut") throw loginRedirect(id, call.setCookie);
  if (call.kind === "unavailable") {
    // Auth did not answer, so payment was never called: nothing charged.
    return { error: { code: "failed" } as CardPayError };
  }
  const outcome = interpretCardResponse(call.status, call.body);
  if (outcome.kind === "paid") {
    throw withCookie(
      redirect(confirmationPath(outcome.payment.orderId, outcome.payment.id)),
      call.setCookie,
    );
  }
  // Only the reason goes back to the page; never the card.
  return { error: outcome.error };
}

export default function CardPaymentPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const { t, formatCurrency } = useLanguage();
  const submitting = navigation.state !== "idle";
  const error = actionData?.error;

  const view =
    error?.code === "unconfirmed"
      ? "unconfirmed"
      : error?.code === "attempts_exhausted" || error?.code === "order_closed"
        ? "closed"
        : data.view;

  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-24 pt-10 md:pt-16">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
        {t("cardPay.eyebrow")}
      </p>
      <h1 className="mt-2 text-2xl font-light tracking-tight text-zinc-950">
        {t("cardPay.title")}
      </h1>
      <dl className="mt-6 flex items-baseline justify-between border-y border-zinc-100 py-4 text-sm">
        <dt className="text-zinc-500">{t("cardPay.amount")}</dt>
        <dd className="text-lg font-medium text-zinc-950">
          {formatCurrency(data.amountWon)}
        </dd>
      </dl>
      <p className="mt-2 text-[11px] text-zinc-400">
        {t("cardPay.orderRef", { order: data.orderId })}
      </p>

      {view === "unconfirmed" && <UnconfirmedNotice orderId={data.orderId} />}
      {view === "closed" && <ClosedNotice error={error} />}
      {view === "form" && (
        <CardForm
          amountWon={data.amountWon}
          error={error}
          submitting={submitting}
        />
      )}
    </main>
  );
}

function CardForm({
  amountWon,
  error,
  submitting,
}: {
  amountWon: number;
  error?: CardPayError;
  submitting: boolean;
}) {
  const { t, formatCurrency } = useLanguage();
  const [number, setNumber] = useState("");
  const [holderKind, setHolderKind] = useState<"personal" | "corporate">(
    "personal",
  );
  const installments = installmentOptions(amountWon);
  const fieldError = (field: CardField) =>
    error?.code === "invalid_card" && error.field === field
      ? t(cardFieldMessageKey(field))
      : undefined;

  return (
    <Form
      method="post"
      className="mt-8 space-y-5"
      autoComplete="on"
      noValidate={false}
    >
      {error && error.code !== "invalid_card" && <FormError error={error} />}

      <div>
        <Label htmlFor="card_number">{t("cardPay.cardNumber")}</Label>
        <input
          id="card_number"
          name="card_number"
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="0000 0000 0000 0000"
          required
          value={number}
          onChange={(e) => setNumber(formatCardNumberInput(e.target.value))}
          aria-invalid={Boolean(fieldError("card_number"))}
          className={inputClass(Boolean(fieldError("card_number")))}
        />
        <FieldError message={fieldError("card_number")} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="exp_month">{t("cardPay.expMonth")}</Label>
          <input
            id="exp_month"
            name="exp_month"
            inputMode="numeric"
            autoComplete="cc-exp-month"
            placeholder="MM"
            maxLength={2}
            pattern="[0-9]{1,2}"
            required
            aria-invalid={Boolean(fieldError("exp_month"))}
            className={inputClass(Boolean(fieldError("exp_month")))}
          />
          <FieldError message={fieldError("exp_month")} />
        </div>
        <div>
          <Label htmlFor="exp_year">{t("cardPay.expYear")}</Label>
          <input
            id="exp_year"
            name="exp_year"
            inputMode="numeric"
            autoComplete="cc-exp-year"
            placeholder="YY"
            maxLength={2}
            pattern="[0-9]{2}"
            required
            aria-invalid={Boolean(fieldError("exp_year"))}
            className={inputClass(Boolean(fieldError("exp_year")))}
          />
          <FieldError message={fieldError("exp_year")} />
        </div>
      </div>

      <div>
        <Label htmlFor="card_password">{t("cardPay.password")}</Label>
        <input
          id="card_password"
          name="card_password"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={2}
          pattern="[0-9]{2}"
          required
          aria-describedby="card_password_hint"
          aria-invalid={Boolean(fieldError("card_password"))}
          className={`${inputClass(Boolean(fieldError("card_password")))} max-w-28 tracking-[0.4em]`}
        />
        <p id="card_password_hint" className="mt-1.5 text-[11px] text-zinc-400">
          {t("cardPay.passwordHint")}
        </p>
        <FieldError message={fieldError("card_password")} />
      </div>

      <fieldset>
        <legend className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
          {t("cardPay.holderKind")}
        </legend>
        <div className="flex gap-2">
          {(["personal", "corporate"] as const).map((kind) => (
            <label
              key={kind}
              className={[
                "flex h-10 flex-1 cursor-pointer items-center justify-center border text-xs transition",
                holderKind === kind
                  ? "border-zinc-950 text-zinc-950"
                  : "border-zinc-200 text-zinc-500 hover:border-zinc-400",
              ].join(" ")}
            >
              <input
                type="radio"
                name="holder_kind"
                value={kind}
                checked={holderKind === kind}
                onChange={() => setHolderKind(kind)}
                className="sr-only"
              />
              {t(
                kind === "personal"
                  ? "cardPay.holderPersonal"
                  : "cardPay.holderCorporate",
              )}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <Label htmlFor="holder_id">
          {t(
            holderKind === "personal"
              ? "cardPay.birthDate"
              : "cardPay.businessNumber",
          )}
        </Label>
        <input
          id="holder_id"
          name="holder_id"
          inputMode="numeric"
          autoComplete="off"
          placeholder={holderKind === "personal" ? "YYMMDD" : "0000000000"}
          maxLength={holderKind === "personal" ? 6 : 12}
          required
          aria-invalid={Boolean(fieldError("holder_id"))}
          className={inputClass(Boolean(fieldError("holder_id")))}
        />
        <FieldError message={fieldError("holder_id")} />
      </div>

      <div>
        <Label htmlFor="installment">{t("cardPay.installment")}</Label>
        <select
          id="installment"
          name="installment"
          defaultValue="00"
          disabled={installments.length === 1}
          className={inputClass(Boolean(fieldError("installment")))}
        >
          {installments.map((value) => (
            <option key={value} value={value}>
              {value === "00"
                ? t("cardPay.lumpSum")
                : t("cardPay.months", { months: String(Number(value)) })}
            </option>
          ))}
        </select>
        {installments.length === 1 && (
          <p className="mt-1.5 text-[11px] text-zinc-400">
            {t("cardPay.installmentMinimum", {
              amount: formatCurrency(50_000),
            })}
          </p>
        )}
        <FieldError message={fieldError("installment")} />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="flex h-14 w-full items-center justify-center rounded-full bg-ink text-[11px] font-medium uppercase tracking-widest text-white transition-colors duration-300 ease-lux hover:bg-black disabled:cursor-wait disabled:opacity-70"
      >
        {submitting
          ? t("cardPay.paying")
          : t("cardPay.pay", { amount: formatCurrency(amountWon) })}
      </button>
      <p className="text-center text-[11px] leading-relaxed text-zinc-400">
        {t("cardPay.privacy")}
      </p>
    </Form>
  );
}

function FormError({ error }: { error: CardPayError }) {
  const { t } = useLanguage();
  let message: string;
  let detail: string | undefined;
  switch (error.code) {
    case "declined":
      // The card company's own reason (비밀번호 오류, 한도 초과, …), then ours.
      message = error.message || t("cardPay.declinedFallback");
      if (error.attemptsRemaining > 0) {
        detail = t("cardPay.attemptsRemaining", {
          count: String(error.attemptsRemaining),
        });
      }
      break;
    case "in_progress":
      message = t("cardPay.inProgress");
      break;
    case "method_disabled":
      message = error.message || t("checkout.methodCreditCardDisabled");
      break;
    default:
      message = t("cardPay.failed");
  }
  return (
    <p
      role="alert"
      className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      {message}
      {detail && (
        <span className="mt-1 block text-xs text-red-600">{detail}</span>
      )}
    </p>
  );
}

function UnconfirmedNotice({ orderId }: { orderId: string }) {
  const { t } = useLanguage();
  return (
    <div
      role="alert"
      className="mt-8 border border-amber-300 bg-amber-50 px-4 py-4 md:px-6"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-800">
        {t("checkout.unconfirmedTitle")}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-amber-900">
        {t("checkout.unconfirmedBody", { order: orderId })}
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-amber-700">
        {t("checkout.unconfirmedContact", { order: orderId })}
      </p>
      <Link
        to={MY_ACCOUNT_ORDERS_PATH}
        className="mt-4 inline-flex h-11 items-center justify-center border border-amber-400 px-5 text-[10px] font-semibold uppercase tracking-widest text-amber-900 transition hover:bg-amber-100"
      >
        {t("checkout.unconfirmedViewOrders")}
      </Link>
    </div>
  );
}

function ClosedNotice({ error }: { error?: CardPayError }) {
  const { t } = useLanguage();
  const key =
    error?.code === "attempts_exhausted"
      ? "cardPay.attemptsExhausted"
      : error?.code === "order_closed"
        ? "cardPay.orderClosed"
        : "cardPay.closed";
  return (
    <div role="alert" className="mt-8 border border-zinc-200 px-4 py-4 md:px-6">
      <p className="text-sm leading-relaxed text-zinc-700">{t(key)}</p>
      <Link
        to="/checkout"
        className="mt-4 inline-flex h-11 items-center justify-center border border-zinc-300 px-5 text-[10px] font-semibold uppercase tracking-widest text-zinc-900 transition hover:bg-zinc-50"
      >
        {t("cardPay.backToCheckout")}
      </Link>
    </div>
  );
}

function Label({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-zinc-600"
    >
      {children}
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-[11px] text-red-600">{message}</p>;
}

function inputClass(invalid: boolean): string {
  return [
    "h-12 w-full border bg-white px-4 text-sm text-zinc-950 outline-none transition disabled:bg-zinc-50 disabled:text-zinc-500",
    invalid
      ? "border-red-400 focus:border-red-500"
      : "border-zinc-200 focus:border-zinc-950",
  ].join(" ");
}

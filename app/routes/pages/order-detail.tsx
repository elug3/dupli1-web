import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router";

import { MY_ACCOUNT_ORDERS_PATH } from "~/lib/account";
import { type User, getMe } from "~/lib/auth";
import {
  MAX_DISPUTE_REASON_LENGTH,
  type Order,
  type OrderItem,
  type OrderTimelineStep,
  canConfirmOrderReceipt,
  canCustomerCancelOrder,
  canDisputeOrderReceipt,
  cancelMyOrder,
  confirmOrderReceipt,
  disputeOrderReceipt,
  formatOrderShippingAddress,
  getOrder,
  isOrderUnavailableError,
  isResumableOrder,
  orderItemTotalWon,
  orderStatusLabelKey,
  orderTimeline,
  shouldShowCancelRequestedBanner,
} from "~/lib/checkout";
import { useLanguage } from "~/lib/i18n";

/** Same palette as the orders list, extended to the statuses only detail shows. */
const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  paid: "bg-blue-50 text-blue-700",
  confirmed: "bg-blue-50 text-blue-700",
  in_transit: "bg-indigo-50 text-indigo-700",
  delivered: "bg-emerald-50 text-emerald-700",
  fulfilled: "bg-emerald-50 text-emerald-700",
  disputed: "bg-red-50 text-red-700",
  canceled: "bg-zinc-100 text-zinc-500",
};

const TIMELINE_LABEL_KEYS: Record<OrderTimelineStep["key"], string> = {
  placed: "orderDetail.stepPlaced",
  paid: "orderDetail.stepPaid",
  confirmed: "orderDetail.stepConfirmed",
  shipped: "orderDetail.stepShipped",
  delivered: "orderDetail.stepDelivered",
  fulfilled: "orderDetail.stepFulfilled",
  disputed: "orderDetail.stepDisputed",
  canceled: "orderDetail.stepCanceled",
};

type LoadState = "loading" | "ready" | "unavailable" | "failed";

export function meta() {
  return [
    { title: "Order Details | Dupli1" },
    {
      name: "description",
      content: "Track and manage one of your Dupli1 orders.",
    },
  ];
}

export default function OrderDetailPage() {
  const { t } = useLanguage();
  const location = useLocation();
  const { orderId: orderIdParam } = useParams();
  const orderId = orderIdParam ?? "";
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [order, setOrder] = useState<Order | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    getMe().then(setUser);
  }, []);

  useEffect(() => {
    if (!user || !orderId) return;
    let cancelled = false;
    setState("loading");

    getOrder(orderId)
      .then((fetched) => {
        if (cancelled) return;
        // The order service already enforces ownership; this only keeps a
        // manager's own token from rendering somebody else's order here.
        if (fetched.customerId !== user.user_id) {
          setState("unavailable");
          return;
        }
        setOrder(fetched);
        setState("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState(isOrderUnavailableError(error) ? "unavailable" : "failed");
      });

    return () => {
      cancelled = true;
    };
  }, [user, orderId]);

  if (user === undefined || (user && state === "loading")) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-12 md:px-10">
        <div className="space-y-4">
          <div className="h-4 w-24 animate-pulse bg-zinc-100" />
          <div className="h-8 w-64 animate-pulse bg-zinc-100" />
          <div className="h-64 animate-pulse bg-zinc-100" />
        </div>
      </main>
    );
  }

  if (!user) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return (
      <main className="mx-auto max-w-md px-5 py-20 text-center">
        <h1 className="text-xl font-semibold text-zinc-950">
          {t("profile.signInToDupli1")}
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          {t("profile.signInDescription")}
        </p>
        <Link
          to={`/login?next=${next}`}
          className="mt-6 inline-flex h-12 items-center bg-zinc-950 px-8 text-sm font-semibold text-white transition hover:bg-zinc-800"
        >
          {t("profile.signIn")}
        </Link>
      </main>
    );
  }

  if (state !== "ready" || !order) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-12 md:px-10">
        <BackToOrders label={t("orderDetail.backToOrders")} />
        <p className="mt-8 border border-zinc-100 px-5 py-8 text-center text-sm text-zinc-500">
          {state === "unavailable"
            ? t("orderDetail.notFound")
            : t("orderDetail.loadFailed")}
        </p>
      </main>
    );
  }

  return <OrderDetail order={order} onOrderChange={setOrder} />;
}

function OrderDetail({
  order,
  onOrderChange,
}: {
  order: Order;
  onOrderChange: (order: Order) => void;
}) {
  const { t, formatCurrency, formatDateTime } = useLanguage();
  const [pending, setPending] = useState<"cancel" | "receipt" | "dispute" | null>(
    null
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const statusKey = orderStatusLabelKey(order.status);
  const timeline = orderTimeline(order);

  // Reset any open form when the order moves on, so a stale dispute draft does
  // not sit under an order that is already disputed.
  const applyUpdate = useCallback(
    (updated: Order) => {
      onOrderChange(updated);
      setDisputeOpen(false);
      setDisputeReason("");
    },
    [onOrderChange]
  );

  async function handleCancel() {
    const immediate = Boolean(order.immediateCancelAllowed);
    const ok = window.confirm(
      immediate
        ? t("profile.confirmCancelImmediate")
        : t("profile.confirmCancelRequest")
    );
    if (!ok) return;
    setPending("cancel");
    setActionError(null);
    try {
      applyUpdate(await cancelMyOrder(order.id));
    } catch {
      setActionError(t("profile.cancelFailed"));
    } finally {
      setPending(null);
    }
  }

  async function handleConfirmReceipt() {
    if (!window.confirm(t("orderDetail.confirmReceiptPrompt"))) return;
    setPending("receipt");
    setActionError(null);
    try {
      applyUpdate(await confirmOrderReceipt(order.id));
    } catch {
      setActionError(t("orderDetail.confirmReceiptFailed"));
    } finally {
      setPending(null);
    }
  }

  async function handleDispute() {
    setPending("dispute");
    setActionError(null);
    try {
      applyUpdate(await disputeOrderReceipt(order.id, disputeReason));
    } catch {
      setActionError(t("orderDetail.disputeFailed"));
    } finally {
      setPending(null);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-10 md:px-10">
      <BackToOrders label={t("orderDetail.backToOrders")} />

      <header className="mt-6 flex flex-wrap items-start justify-between gap-4 border-b border-zinc-100 pb-6">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">
            {t("orderDetail.heading")}
          </p>
          <h1 className="mt-1 break-all font-mono text-lg font-medium tracking-wide text-zinc-950">
            {order.id}
          </h1>
          {order.createdAt && (
            <p className="mt-1 text-[11px] text-zinc-400">
              {t("orderDetail.placedOn", { date: formatDateTime(order.createdAt) })}
            </p>
          )}
        </div>
        <span
          className={[
            "shrink-0 px-2.5 py-1 text-[10px] uppercase tracking-[0.1em]",
            STATUS_STYLES[order.status] ?? "bg-zinc-100 text-zinc-500",
          ].join(" ")}
        >
          {statusKey ? t(statusKey) : order.status}
        </span>
      </header>

      {isResumableOrder(order) && (
        <div
          role="status"
          className="mt-6 flex flex-wrap items-center justify-between gap-3 border border-[#c8a96e] bg-[#fdfaf4] px-4 py-4"
        >
          <p className="text-sm text-zinc-700">{t("checkout.resumeTitle")}</p>
          <Link
            to="/checkout"
            className="inline-flex h-10 items-center bg-zinc-950 px-5 text-[10px] font-semibold uppercase tracking-widest text-white transition hover:bg-zinc-800"
          >
            {t("checkout.resumeAction")}
          </Link>
        </div>
      )}

      {shouldShowCancelRequestedBanner(order) && (
        <p className="mt-6 border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-800">
          {t("profile.cancelRequested")}
          {order.cancelRequestReason && (
            <span className="mt-1 block text-amber-700">
              {t("orderDetail.cancelReason", { reason: order.cancelRequestReason })}
            </span>
          )}
        </p>
      )}

      {order.status === "disputed" && (
        <p className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-800">
          {t("orderDetail.disputeOpen")}
          {order.disputeReason && (
            <span className="mt-1 block text-red-700">
              {t("orderDetail.disputeYourNote", { reason: order.disputeReason })}
            </span>
          )}
        </p>
      )}

      <Section title={t("orderDetail.progress")}>
        <ol className="space-y-0">
          {timeline.map((step) => (
            <li
              key={step.key}
              className="flex items-baseline gap-3 border-b border-zinc-50 py-3 last:border-b-0"
            >
              <span
                aria-hidden="true"
                className={[
                  "mt-1 size-1.5 shrink-0 rounded-full",
                  step.done ? "bg-zinc-950" : "bg-zinc-200",
                ].join(" ")}
              />
              <span
                className={[
                  "flex-1 text-sm",
                  step.current
                    ? "font-medium text-zinc-950"
                    : step.done
                      ? "text-zinc-700"
                      : "text-zinc-300",
                ].join(" ")}
              >
                {t(TIMELINE_LABEL_KEYS[step.key])}
              </span>
              {step.at && (
                <span className="shrink-0 text-[11px] tabular-nums text-zinc-400">
                  {formatDateTime(step.at)}
                </span>
              )}
            </li>
          ))}
        </ol>
      </Section>

      <Section title={t("orderDetail.items")}>
        <ul className="space-y-0">
          {order.items.map((item, index) => (
            <OrderItemRow key={item.skuId ?? `${item.sku}-${index}`} item={item} />
          ))}
        </ul>
      </Section>

      <Section title={t("orderDetail.summary")}>
        <dl className="space-y-3 text-sm">
          <SummaryRow
            label={t("cart.subtotal")}
            value={formatCurrency(order.subtotalWon)}
          />
          {order.discountWon > 0 && (
            <SummaryRow
              label={
                order.couponCode
                  ? t("cart.promo", { code: order.couponCode })
                  : t("confirmation.discount")
              }
              value={`−${formatCurrency(order.discountWon)}`}
              tone="discount"
            />
          )}
          <SummaryRow
            label={t("cart.shipping")}
            value={
              order.shippingFeeWon === 0
                ? t("cart.complimentary")
                : formatCurrency(order.shippingFeeWon)
            }
          />
          <SummaryRow
            label={t("confirmation.total")}
            value={formatCurrency(order.totalWon)}
            tone="total"
          />
          {order.paymentId && (
            <SummaryRow
              label={t("orderDetail.paymentReference")}
              value={order.paymentId}
              mono
            />
          )}
        </dl>
      </Section>

      <Section title={t("orderDetail.delivery")}>
        {order.recipientName || order.shippingAddress ? (
          <dl className="space-y-3 text-sm">
            {order.recipientName && (
              <SummaryRow
                label={t("orderDetail.recipient")}
                value={order.recipientName}
              />
            )}
            {order.recipientPhone && (
              <SummaryRow
                label={t("orderDetail.recipientPhone")}
                value={order.recipientPhone}
              />
            )}
            {order.shippingAddress && (
              <SummaryRow
                label={t("orderDetail.address")}
                value={formatOrderShippingAddress(order.shippingAddress)}
              />
            )}
            {order.shippingAddress?.pccc && (
              <SummaryRow
                label={t("orderDetail.pccc")}
                value={order.shippingAddress.pccc}
                mono
              />
            )}
          </dl>
        ) : (
          <p className="text-sm text-zinc-400">{t("orderDetail.noDelivery")}</p>
        )}
      </Section>

      {(order.carrier || order.trackingNumber) && (
        <Section title={t("orderDetail.tracking")}>
          <dl className="space-y-3 text-sm">
            {order.carrier && (
              <SummaryRow label={t("orderDetail.carrier")} value={order.carrier} />
            )}
            {order.trackingNumber && (
              <SummaryRow
                label={t("orderDetail.trackingNumber")}
                value={order.trackingNumber}
                mono
              />
            )}
          </dl>
        </Section>
      )}

      {canConfirmOrderReceipt(order) && order.autoFulfillDueAt && (
        <p className="mt-8 text-[11px] text-zinc-400">
          {t("orderDetail.autoCompleteOn", {
            date: formatDateTime(order.autoFulfillDueAt),
          })}
        </p>
      )}

      {actionError && (
        <p role="alert" className="mt-4 text-[12px] text-red-600">
          {actionError}
        </p>
      )}

      {(canConfirmOrderReceipt(order) ||
        canDisputeOrderReceipt(order) ||
        canCustomerCancelOrder(order)) && (
        <div className="mt-4 flex flex-wrap gap-3 border-t border-zinc-100 pt-6">
          {canConfirmOrderReceipt(order) && (
            <button
              type="button"
              disabled={pending !== null}
              onClick={handleConfirmReceipt}
              className="inline-flex h-11 items-center bg-zinc-950 px-6 text-[10px] font-semibold uppercase tracking-widest text-white transition hover:bg-zinc-800 disabled:opacity-50"
            >
              {pending === "receipt"
                ? t("orderDetail.confirmingReceipt")
                : t("orderDetail.confirmReceipt")}
            </button>
          )}
          {canDisputeOrderReceipt(order) && !disputeOpen && (
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => setDisputeOpen(true)}
              className="inline-flex h-11 items-center border border-zinc-200 px-6 text-[10px] font-semibold uppercase tracking-widest text-zinc-600 transition hover:border-zinc-950 hover:text-zinc-950 disabled:opacity-50"
            >
              {t("orderDetail.reportNotReceived")}
            </button>
          )}
          {canCustomerCancelOrder(order) && (
            <button
              type="button"
              disabled={pending !== null}
              onClick={handleCancel}
              className="inline-flex h-11 items-center text-[10px] font-semibold uppercase tracking-widest text-zinc-500 underline-offset-4 transition hover:text-zinc-950 hover:underline disabled:opacity-50"
            >
              {pending === "cancel"
                ? t("profile.canceling")
                : order.immediateCancelAllowed
                  ? t("profile.cancelOrder")
                  : t("profile.requestCancel")}
            </button>
          )}
        </div>
      )}

      {disputeOpen && (
        <form
          className="mt-6 border border-zinc-200 p-5"
          onSubmit={(event) => {
            event.preventDefault();
            handleDispute();
          }}
        >
          <p className="text-sm font-medium text-zinc-950">
            {t("orderDetail.disputeTitle")}
          </p>
          <p className="mt-1 text-[12px] text-zinc-500">
            {t("orderDetail.disputeBody")}
          </p>
          <textarea
            value={disputeReason}
            onChange={(event) => setDisputeReason(event.target.value)}
            maxLength={MAX_DISPUTE_REASON_LENGTH}
            rows={3}
            placeholder={t("orderDetail.disputeReasonPlaceholder")}
            className="mt-3 w-full border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-950 outline-none transition focus:border-zinc-400 placeholder:text-zinc-300"
          />
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={pending !== null}
              className="inline-flex h-11 items-center bg-zinc-950 px-6 text-[10px] font-semibold uppercase tracking-widest text-white transition hover:bg-zinc-800 disabled:opacity-50"
            >
              {pending === "dispute"
                ? t("orderDetail.disputeSubmitting")
                : t("orderDetail.disputeSubmit")}
            </button>
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => setDisputeOpen(false)}
              className="inline-flex h-11 items-center px-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 transition hover:text-zinc-950 disabled:opacity-50"
            >
              {t("orderDetail.disputeDismiss")}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}

function OrderItemRow({ item }: { item: OrderItem }) {
  const { t, formatCurrency } = useLanguage();
  const name = item.productName ?? item.sku;

  return (
    <li className="flex gap-4 border-b border-zinc-50 py-4 last:border-b-0">
      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt={name}
          className="size-20 shrink-0 bg-zinc-50 object-cover"
        />
      ) : (
        <div aria-hidden="true" className="size-20 shrink-0 bg-zinc-50" />
      )}
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-zinc-950">{name}</p>
          <p className="mt-0.5 truncate font-mono text-[11px] tracking-wide text-zinc-400">
            {item.sku}
          </p>
        </div>
        <p className="mt-2 text-[11px] text-zinc-500">
          {t("orderDetail.quantity", { count: String(item.quantity) })}
          {" · "}
          {t("orderDetail.unitPrice", {
            price: formatCurrency(item.unitPriceWon),
          })}
        </p>
      </div>
      <p className="shrink-0 text-sm font-medium text-zinc-950">
        {formatCurrency(orderItemTotalWon(item))}
      </p>
    </li>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-[10px] uppercase tracking-[0.2em] text-zinc-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

function SummaryRow({
  label,
  value,
  tone,
  mono = false,
}: {
  label: string;
  value: string;
  tone?: "discount" | "total";
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-6">
      <dt
        className={[
          // Keeps a long value (an address) from squeezing the label onto two
          // lines at phone width.
          "shrink-0",
          tone === "discount" ? "text-emerald-700" : "text-zinc-400",
        ].join(" ")}
      >
        {label}
      </dt>
      <dd
        className={[
          "min-w-0 text-right",
          mono ? "break-all font-mono text-[12px]" : "",
          tone === "discount"
            ? "text-emerald-700"
            : tone === "total"
              ? "font-semibold text-zinc-950"
              : "font-medium text-zinc-950",
        ].join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}

function BackToOrders({ label }: { label: string }) {
  return (
    <Link
      to={MY_ACCOUNT_ORDERS_PATH}
      className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.15em] text-zinc-400 transition hover:text-zinc-950"
    >
      <svg aria-hidden="true" className="size-3" viewBox="0 0 24 24" fill="none">
        <path
          d="M15 18l-6-6 6-6"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
      {label}
    </Link>
  );
}

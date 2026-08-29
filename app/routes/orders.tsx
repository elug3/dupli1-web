import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { getMe } from "~/lib/auth";
import {
  type Order,
  type OrderStatus,
  carrierTrackingUrl,
  listOrders,
} from "~/lib/checkout";
import { useLanguage } from "~/lib/i18n";

export function meta() {
  return [
    { title: "Orders | Dupli1" },
    { name: "description", content: "Track your Dupli1 orders and shipping status." },
  ];
}

const STATUS_FLOW: OrderStatus[] = [
  "pending",
  "paid",
  "in_transit",
  "fulfilled",
];

function statusLabelKey(status: string): string {
  switch (status) {
    case "pending":
      return "orders.statusPending";
    case "paid":
      return "orders.statusPaid";
    case "in_transit":
      return "orders.statusInTransit";
    case "fulfilled":
      return "orders.statusFulfilled";
    case "canceled":
      return "orders.statusCanceled";
    default:
      return "orders.statusPending";
  }
}

function carrierLabelKey(carrier: string): string {
  switch (carrier) {
    case "cj":
      return "orders.carrierCj";
    case "hanjin":
      return "orders.carrierHanjin";
    case "lotte":
      return "orders.carrierLotte";
    case "logen":
      return "orders.carrierLogen";
    case "epost":
      return "orders.carrierEpost";
    case "other":
      return "orders.carrierOther";
    default:
      return "orders.carrier";
  }
}

function formatOrderDate(iso: string | undefined, locale: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function OrdersPage() {
  const { t, formatCurrency, language } = useLanguage();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const locale =
    language === "ko" ? "ko-KR" : language === "zh" ? "zh-CN" : "en-US";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const user = await getMe();
      if (cancelled) return;
      if (!user) {
        navigate("/login", { replace: true, state: { from: "/orders" } });
        return;
      }
      try {
        const list = await listOrders(user.user_id);
        if (!cancelled) setOrders(list);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : t("orders.loadFailed")
          );
          setOrders([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, t]);

  return (
    <main className="bg-white">
      <div className="mx-auto max-w-3xl px-4 py-12 md:px-8 md:py-16">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#c8a96e]">
          {t("orders.eyebrow")}
        </p>
        <h1
          className="mt-3 text-4xl font-light text-zinc-950 md:text-5xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("orders.title")}
        </h1>
        <p className="mt-3 max-w-lg text-sm text-zinc-400">
          {t("orders.subtitle")}
        </p>

        {orders === null && !error && (
          <p className="mt-12 text-sm text-zinc-400">{t("orders.loading")}</p>
        )}

        {error && (
          <p className="mt-12 border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {orders && orders.length === 0 && !error && (
          <div className="mt-12 border border-zinc-100 px-8 py-16 text-center">
            <p className="text-sm text-zinc-400">{t("profile.noOrders")}</p>
            <Link
              to="/"
              className="mt-6 inline-flex h-11 items-center border border-zinc-950 px-6 text-[10px] font-semibold uppercase tracking-widest text-zinc-950 transition hover:bg-zinc-950 hover:text-white"
            >
              {t("cart.continueShopping")}
            </Link>
          </div>
        )}

        {orders && orders.length > 0 && (
          <ul className="mt-10 divide-y divide-zinc-100 border-y border-zinc-100">
            {orders.map((order) => {
              const open = expandedId === order.id;
              const trackUrl = carrierTrackingUrl(
                order.carrier,
                order.trackingNumber
              );
              return (
                <li key={order.id} className="py-6">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId(open ? null : order.id)
                    }
                    className="flex w-full items-start justify-between gap-4 text-left"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-zinc-500">
                        {order.id}
                      </p>
                      <p className="mt-1 text-sm text-zinc-950">
                        {formatOrderDate(order.createdAt, locale)}
                        <span className="mx-2 text-zinc-300">·</span>
                        {t(statusLabelKey(order.status))}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-zinc-950">
                      {formatCurrency(order.totalCents)}
                    </p>
                  </button>

                  {open && (
                    <div className="mt-5 space-y-6 border-t border-zinc-50 pt-5">
                      <StatusTimeline status={order.status} />

                      {(order.trackingNumber || order.carrier) && (
                        <div className="border border-zinc-100 bg-zinc-50/50 px-4 py-3 text-sm">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400">
                            {t("orders.tracking")}
                          </p>
                          <p className="mt-2 text-zinc-950">
                            {order.carrier === "other" && order.carrierNote
                              ? order.carrierNote
                              : order.carrier
                                ? t(carrierLabelKey(order.carrier))
                                : null}
                            {order.trackingNumber && (
                              <>
                                {(order.carrier || order.carrierNote) && (
                                  <span className="mx-1.5 text-zinc-300">·</span>
                                )}
                                <span className="font-mono">
                                  {order.trackingNumber}
                                </span>
                              </>
                            )}
                          </p>
                          {trackUrl && (
                            <a
                              href={trackUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-block text-xs font-medium text-zinc-950 underline underline-offset-2"
                            >
                              {t("orders.trackShipment")}
                            </a>
                          )}
                        </div>
                      )}

                      <ul className="space-y-3">
                        {order.items.map((item, i) => (
                          <li
                            key={`${item.skuId ?? item.sku}-${i}`}
                            className="flex justify-between gap-4 text-sm"
                          >
                            <span className="min-w-0 text-zinc-700">
                              <span className="block truncate font-medium text-zinc-950">
                                {item.productName ?? item.sku}
                              </span>
                              <span className="font-mono text-[11px] text-zinc-400">
                                {item.sku} × {item.quantity}
                              </span>
                            </span>
                            <span className="shrink-0 text-zinc-950">
                              {formatCurrency(
                                item.unitPriceCents * item.quantity
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-10 text-center text-xs text-zinc-400">
          <Link to="/profile" className="underline underline-offset-2">
            {t("footer.myAccount")}
          </Link>
        </p>
      </div>
    </main>
  );
}

function StatusTimeline({ status }: { status: OrderStatus }) {
  const { t } = useLanguage();
  if (status === "canceled") {
    return (
      <p className="text-sm font-medium text-red-700">
        {t("orders.statusCanceled")}
      </p>
    );
  }
  const currentIdx = STATUS_FLOW.indexOf(status as (typeof STATUS_FLOW)[number]);
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {STATUS_FLOW.map((step, idx) => {
        const done = currentIdx >= idx;
        const current = currentIdx === idx;
        return (
          <li
            key={step}
            className={[
              "border px-3 py-2 text-center text-[10px] uppercase tracking-[0.12em]",
              current
                ? "border-zinc-950 bg-zinc-950 text-white"
                : done
                  ? "border-zinc-200 bg-zinc-50 text-zinc-700"
                  : "border-zinc-100 text-zinc-300",
            ].join(" ")}
          >
            {t(statusLabelKey(step))}
          </li>
        );
      })}
    </ol>
  );
}

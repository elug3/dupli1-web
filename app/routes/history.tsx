import { useEffect, useState } from "react";
import { Link } from "react-router";
import { bagImage } from "../lib/api";
import {
  clearHistory,
  clearRecentViews,
  getHistory,
  getRecentViews,
  type HistoryEntry,
  type ViewedProduct,
} from "../lib/history";
import { useLanguage } from "../lib/i18n";

export function meta() {
  return [
    { title: "History | Dupli1" },
    { name: "description", content: "View recent browsing history." },
  ];
}

export default function History() {
  const { t, translateProductName } = useLanguage();
  const [searches, setSearches] = useState<HistoryEntry[]>([]);
  const [views, setViews] = useState<ViewedProduct[]>([]);

  useEffect(() => {
    setSearches(getHistory());
    setViews(getRecentViews());
  }, []);

  function handleClearSearches() {
    clearHistory();
    setSearches([]);
  }

  function handleClearViews() {
    clearRecentViews();
    setViews([]);
  }

  return (
    <main className="bg-white">
      <div className="mx-auto max-w-3xl px-4 py-10 md:px-8 md:py-14">
        <div className="mb-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#c8a96e]">
            {t("history.eyebrow")}
          </p>
          <h1
            className="mt-2 text-4xl font-light tracking-tight text-zinc-950 md:text-5xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("history.title")}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-zinc-500">
            {t("history.description")}
          </p>
        </div>

        <section className="mb-12">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-950">
              {t("history.recentlyViewed")}
            </h2>
            {views.length > 0 && (
              <button
                type="button"
                onClick={handleClearViews}
                className="text-[10px] uppercase tracking-[0.15em] text-zinc-400 transition hover:text-zinc-950"
              >
                {t("history.clear")}
              </button>
            )}
          </div>

          {views.length === 0 ? (
            <EmptyBlock message={t("history.emptyViews")} />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {views.map((product) => (
                <Link key={product.id} to={`/product/${product.id}`} className="group">
                  <div className="overflow-hidden bg-zinc-50">
                    <img
                      src={bagImage(product.brand, product.image)}
                      alt={translateProductName(product.id, product.name)}
                      className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  </div>
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                    {product.brand}
                  </p>
                  <p className="mt-0.5 text-sm font-medium leading-snug text-zinc-950">
                    {translateProductName(product.id, product.name)}
                  </p>
                  <p className="mt-1 text-[10px] text-zinc-400">
                    {formatRelativeTime(product.timestamp, t)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-950">
              {t("history.recentSearches")}
            </h2>
            {searches.length > 0 && (
              <button
                type="button"
                onClick={handleClearSearches}
                className="text-[10px] uppercase tracking-[0.15em] text-zinc-400 transition hover:text-zinc-950"
              >
                {t("history.clear")}
              </button>
            )}
          </div>

          {searches.length === 0 ? (
            <EmptyBlock message={t("history.emptySearches")} />
          ) : (
            <ul className="divide-y divide-zinc-100 border border-zinc-100">
              {searches.map((entry) => (
                <li key={entry.id}>
                  <Link
                    to={`/category/product-type/handbags?q=${encodeURIComponent(entry.query)}`}
                    className="flex items-center justify-between gap-4 px-4 py-4 transition hover:bg-zinc-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-950">
                        {entry.query}
                      </p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-zinc-400">
                        {t("history.bags")}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] text-zinc-400">
                      {formatRelativeTime(entry.timestamp, t)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function EmptyBlock({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-6 py-10 text-center">
      <p className="text-sm text-zinc-500">{message}</p>
    </div>
  );
}

function formatRelativeTime(
  timestamp: number,
  t: (key: string, values?: Record<string, string | number>) => string
): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return t("history.justNow");
  if (minutes < 60) return t("history.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("history.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  return t("history.daysAgo", { count: days });
}

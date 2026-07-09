import { useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { type DisplayProduct, productImage, searchProducts } from "../lib/api";
import { pushHistory } from "../lib/history";
import { useLanguage } from "../lib/i18n";
import { ProductPrice } from "./product-price";

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const { t, translateProductName } = useLanguage();
  const navigate = useNavigate();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DisplayProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSearched(false);
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = window.setTimeout(() => {
      searchProducts("bags", { query: trimmed })
        .then((data) => {
          setResults(data.results.slice(0, 8));
          setSearched(true);
        })
        .catch(() => {
          setResults([]);
          setSearched(true);
        })
        .finally(() => setLoading(false));
    }, 250);

    return () => window.clearTimeout(timer);
  }, [open, query]);

  function goToProduct(id: string) {
    onClose();
    navigate(`/product/${id}`);
  }

  function goToAllResults() {
    const trimmed = query.trim();
    if (!trimmed) return;
    pushHistory(trimmed, "bags");
    onClose();
    navigate(`/category/product-type/handbags?q=${encodeURIComponent(trimmed)}`);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 px-4 pt-[5.5rem] backdrop-blur-[2px] md:pt-[7.75rem]">
      <button
        type="button"
        aria-label={t("search.close")}
        className="absolute inset-0"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={inputId}
        className="relative z-10 w-full max-w-2xl overflow-hidden border border-zinc-100 bg-white shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3">
          <SearchIcon />
          <input
            ref={inputRef}
            id={inputId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("search.placeholder")}
            className="h-11 flex-1 bg-transparent text-sm text-zinc-950 outline-none placeholder:text-zinc-400"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded p-2 text-zinc-400 transition hover:text-zinc-950"
            aria-label={t("search.close")}
          >
            <CloseIcon />
          </button>
        </div>

        <div className="max-h-[min(60vh,28rem)] overflow-y-auto">
          {loading && (
            <p className="px-4 py-8 text-center text-sm text-zinc-400">
              {t("search.searching")}
            </p>
          )}

          {!loading && !query.trim() && (
            <p className="px-4 py-8 text-center text-sm text-zinc-400">
              {t("search.hint")}
            </p>
          )}

          {!loading && searched && results.length === 0 && query.trim() && (
            <p className="px-4 py-8 text-center text-sm text-zinc-400">
              {t("search.noResults")}
            </p>
          )}

          {!loading && results.length > 0 && (
            <ul className="divide-y divide-zinc-100">
              {results.map((product) => (
                <li key={product.id}>
                  <button
                    type="button"
                    onClick={() => goToProduct(product.id)}
                    className="flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-zinc-50"
                  >
                    <img
                      src={productImage(
                        product.category,
                        String(product.details.Brand ?? ""),
                        product.image
                      )}
                      alt=""
                      className="size-14 shrink-0 bg-zinc-50 object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                        {product.details.Brand}
                      </p>
                      <p className="truncate text-sm font-medium text-zinc-950">
                        {translateProductName(product.id, product.name)}
                      </p>
                      <ProductPrice price={product.price} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!loading && results.length > 0 && query.trim() && (
          <div className="border-t border-zinc-100 px-4 py-3">
            <button
              type="button"
              onClick={goToAllResults}
              className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 transition hover:text-zinc-950"
            >
              {t("search.viewAll")} →
            </button>
          </div>
        )}

        <div className="border-t border-zinc-100 px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-zinc-400">
          <Link to="/history" onClick={onClose} className="transition hover:text-zinc-950">
            {t("search.recentHistory")} →
          </Link>
        </div>
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" className="size-5 shrink-0 text-zinc-400" viewBox="0 0 24 24" fill="none">
      <path d="m20 20-4.35-4.35M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none">
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

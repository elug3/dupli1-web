import { useEffect, useRef, useState } from "react";

import { type Bag, fetchBags, listingProductImage } from "~/lib/api";
import { STOREFRONT_CATEGORIES, brandDisplayName } from "~/lib/catalog";
import { useLanguage } from "~/lib/i18n";
import { NAV_GROUPS, navItemLabel } from "~/lib/nav";
import { useWishlist } from "~/lib/useWishlist";
import { PRODUCT_GRID_CLASS, ProductCard, ProductCardSkeleton } from "./product-card";

const SEARCH_DEBOUNCE_MS = 250;
const SEARCH_LIMIT = 24;

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; results: Bag[] }
  | { status: "failed" };

/**
 * Full-screen product search. The header mounts it only while open, so a
 * closed search costs no wishlist or catalog requests.
 */
export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const { t, translateProductName } = useLanguage();
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const wishlist = useWishlist();
  const brands = NAV_GROUPS.find((g) => g.id === "brand")?.items ?? [];

  useEffect(() => {
    inputRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setState({ status: "idle" });
      return;
    }
    setState({ status: "loading" });
    let cancelled = false;
    const timer = window.setTimeout(() => {
      // One query per category we sell, bags first.
      Promise.all(STOREFRONT_CATEGORIES.map((category) => fetchBags({ category, q, limit: SEARCH_LIMIT })))
        .then((lists) => lists.flat().slice(0, SEARCH_LIMIT))
        .then((results) => {
          if (!cancelled) setState({ status: "done", results });
        })
        .catch(() => {
          if (!cancelled) setState({ status: "failed" });
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  return (
    <div role="dialog" aria-modal="true" aria-label={t("nav.search")} className="fixed inset-0 z-50 overflow-y-auto bg-white text-ink">
      <div className="sticky top-0 z-10 border-b border-rule bg-white">
        <form
          role="search"
          onSubmit={(event) => event.preventDefault()}
          className="mx-auto flex h-(--header-h) max-w-7xl items-center gap-3 px-4 md:px-8"
        >
          <SearchIcon />
          <label htmlFor="site-search" className="sr-only">
            {t("nav.search")}
          </label>
          <input
            ref={inputRef}
            id="site-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("search.placeholder")}
            autoComplete="off"
            enterKeyHint="search"
            className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-mute [&::-webkit-search-cancel-button]:appearance-none"
          />
          <button type="button" onClick={onClose} className="-mr-2 p-2" aria-label={t("search.close")}>
            <CloseIcon />
          </button>
        </form>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
        {state.status === "idle" && (
          <section>
            <h2 className="mb-4 text-caption text-mute">{t("search.suggested")}</h2>
            <ul className="flex flex-wrap gap-2">
              {brands.map((item) => {
                const label = navItemLabel(item, t);
                return (
                  <li key={item.to}>
                    <button
                      type="button"
                      onClick={() => setQuery(label)}
                      className="border border-rule px-4 py-2 text-small transition-colors duration-300 hover:border-ink"
                    >
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {state.status === "loading" && (
          <div className={PRODUCT_GRID_CLASS}>
            {Array.from({ length: 4 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        )}

        {state.status === "failed" && <p className="text-small text-alert">{t("search.failed")}</p>}

        {state.status === "done" &&
          (state.results.length === 0 ? (
            <p className="text-small text-mute">{t("search.noResults", { query: query.trim() })}</p>
          ) : (
            <>
              <p className="mb-6 text-caption text-mute">{t("search.results", { count: state.results.length })}</p>
              <div className={PRODUCT_GRID_CLASS}>
                {state.results.map((bag, index) => (
                  <ProductCard
                    key={bag.id}
                    id={bag.id}
                    name={translateProductName(bag.id, bag.name)}
                    brand={brandDisplayName(bag.brand)}
                    image={listingProductImage(bag.category, bag.brand, bag.image)}
                    price={bag.price}
                    officialPrice={bag.officialPrice}
                    stock={bag.stock}
                    index={index}
                    wishlisted={wishlist.has(bag.id)}
                    wishlistBusy={wishlist.isBusy(bag.id)}
                    onToggleWishlist={() => void wishlist.toggle(bag.id)}
                  />
                ))}
              </div>
            </>
          ))}
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" className="size-5 shrink-0" viewBox="0 0 24 24" fill="none">
      <path d="m20 20-4.2-4.2M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
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

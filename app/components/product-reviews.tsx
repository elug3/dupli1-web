import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { ImageZoomModal } from "~/components/product-image-gallery";
import { useLanguage } from "~/lib/i18n";
import {
  ANONYMOUS_AUTHOR,
  EMPTY_SUMMARY,
  FIT_LABEL_KEYS,
  type Review,
  type ReviewPhoto,
  type ReviewSort,
  type ReviewSummary,
  dominantFit,
  fetchProductReviews,
  fetchReviewPhotos,
  filledStars,
  formatReviewDate,
  ratingShares,
} from "~/lib/reviews";

/** Anchor the 리뷰 row in the detail links scrolls to. */
export const REVIEWS_ANCHOR = "reviews";

const PAGE_SIZE = 5;
/** Photo tiles in the strip; the last one says how many more there are. */
const STRIP_TILES = 7;

const SORTS: { value: ReviewSort; key: string }[] = [
  { value: "latest", key: "reviews.sortLatest" },
  { value: "rating_desc", key: "reviews.sortRatingDesc" },
  { value: "rating_asc", key: "reviews.sortRatingAsc" },
];

type Load = "loading" | "error" | "ready";

/**
 * 구매 고객 리뷰: the full-width section between the product layout and
 * 함께 보면 좋은 상품. Summary on the left (sticky from lg), photo reviews first
 * on the right, then sort and filter, then the list. Design: Figma
 * "Reviews (PDP)" in the PDP design file.
 */
export function ProductReviews({ productId }: { productId: string }) {
  const { t } = useLanguage();
  const [summary, setSummary] = useState<ReviewSummary>(EMPTY_SUMMARY);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [sort, setSort] = useState<ReviewSort>("latest");
  const [photoOnly, setPhotoOnly] = useState(false);
  const [load, setLoad] = useState<Load>("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [strip, setStrip] = useState<ReviewPhoto[]>([]);
  const [viewer, setViewer] = useState<{ photos: ReviewPhoto[]; index: number } | null>(null);
  const [attempt, setAttempt] = useState(0);

  // First page, again whenever the sort or filter changes.
  useEffect(() => {
    const ctrl = new AbortController();
    setLoad("loading");
    fetchProductReviews(productId, { sort, photoOnly, limit: PAGE_SIZE }, { signal: ctrl.signal })
      .then((page) => {
        setSummary(page.summary);
        setReviews(page.reviews);
        setCursor(page.nextCursor);
        setLoad("ready");
      })
      .catch((err: unknown) => {
        if (!ctrl.signal.aborted) {
          console.warn("reviews: load failed", err);
          setLoad("error");
        }
      });
    return () => ctrl.abort();
  }, [productId, sort, photoOnly, attempt]);

  // The strip only needs reloading per product.
  useEffect(() => {
    const ctrl = new AbortController();
    setStrip([]);
    fetchReviewPhotos(productId, 60, { signal: ctrl.signal })
      .then(setStrip)
      .catch(() => {
        // The strip is extra; the list still shows each review's photos.
      });
    return () => ctrl.abort();
  }, [productId]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchProductReviews(productId, { sort, photoOnly, limit: PAGE_SIZE, cursor });
      setReviews((prev) => [...prev, ...page.reviews.filter((r) => !prev.some((p) => p.id === r.id))]);
      setCursor(page.nextCursor);
    } catch (err) {
      console.warn("reviews: load more failed", err);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, productId, sort, photoOnly]);

  const empty = load === "ready" && summary.count === 0;
  const filtered = sort !== "latest" || photoOnly;
  const remaining = filtered ? 0 : Math.max(0, summary.count - reviews.length);

  return (
    <section
      id={REVIEWS_ANCHOR}
      aria-labelledby="reviews-heading"
      // Above the gallery's pinned wishlist button, which would otherwise
      // hang over the top of the section as the last image scrolls away.
      className="relative z-10 scroll-mt-[calc(var(--header-h)+1rem)] border-t border-zinc-100 bg-white px-4 py-12 md:px-8 md:py-16"
    >
      <div className="mx-auto max-w-7xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-400">
          {t("reviews.eyebrow")}
        </p>
        <h2
          id="reviews-heading"
          className="mt-2 text-2xl font-light text-zinc-950 md:text-3xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("reviews.title")}
        </h2>

        {load === "loading" && reviews.length === 0 ? (
          <ReviewsSkeleton />
        ) : load === "error" ? (
          <div className="mt-8 flex flex-col items-start gap-3 text-sm text-zinc-500">
            <p>{t("reviews.error")}</p>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="text-sm font-medium text-zinc-950 underline underline-offset-4"
            >
              {t("reviews.retry")}
            </button>
          </div>
        ) : empty ? (
          <EmptyReviews />
        ) : (
          <div className="mt-8 flex flex-col gap-10 lg:mt-10 lg:flex-row lg:items-start lg:gap-16">
            <SummaryColumn summary={summary} />

            <div className="min-w-0 flex-1">
              {strip.length > 0 && (
                <PhotoStrip
                  photos={strip}
                  total={summary.photoCount}
                  onOpen={(index) => setViewer({ photos: strip, index })}
                />
              )}

              <Toolbar
                sort={sort}
                onSort={setSort}
                photoOnly={photoOnly}
                onPhotoOnly={setPhotoOnly}
              />

              {reviews.length === 0 ? (
                <p className="py-10 text-sm text-zinc-500">{t("reviews.noMatch")}</p>
              ) : (
                <ul className={load === "loading" ? "opacity-50 transition-opacity" : undefined}>
                  {reviews.map((review) => (
                    <ReviewItem
                      key={review.id}
                      review={review}
                      onOpenPhoto={(index) => setViewer({ photos: review.photos, index })}
                    />
                  ))}
                </ul>
              )}

              {cursor && (
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  className="mt-8 flex h-12 w-full items-center justify-center rounded-md border border-zinc-200 text-sm font-medium text-zinc-950 transition hover:border-zinc-950 disabled:opacity-60"
                >
                  {remaining > 0
                    ? t("reviews.loadMore", { count: remaining })
                    : t("reviews.loadMorePlain")}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {viewer && (
        <ImageZoomModal
          images={viewer.photos.map((p) => ({ src: p.url, position: "object-center" }))}
          activeIndex={viewer.index}
          onActiveIndexChange={(index) => setViewer((v) => (v ? { ...v, index } : v))}
          alt={t("reviews.photoAlt", { n: viewer.index + 1 })}
          onClose={() => setViewer(null)}
        />
      )}
    </section>
  );
}

// ── Summary row in the detail links ────────────────────────────────────────

/**
 * 리뷰 among the PDP detail links, beside 상품 문의. Reads the counters the
 * product payload already carries, so it costs no request; tapping it scrolls
 * to the section. With no reviews it shows a quiet prompt, never a zero.
 */
export function ReviewSummaryRow({
  reviewCount,
  ratingAverage,
}: {
  reviewCount?: number;
  ratingAverage?: number | null;
}) {
  const { t } = useLanguage();
  const has = (reviewCount ?? 0) > 0 && ratingAverage != null;
  return (
    <a
      href={`#${REVIEWS_ANCHOR}`}
      onClick={(e) => {
        const target = document.getElementById(REVIEWS_ANCHOR);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
      className="flex w-full items-center gap-2 border-b border-zinc-100 py-4 text-left"
    >
      <span className="flex-1 text-sm font-medium text-zinc-950">{t("reviews.row")}</span>
      {has ? (
        <span className="flex items-center gap-1.5 text-[13px]">
          <Stars filled={filledStars(ratingAverage)} label={t("reviews.ratingLabel", { rating: ratingAverage!.toFixed(1) })} />
          <span className="font-medium text-zinc-950">{ratingAverage!.toFixed(1)}</span>
          <span className="text-zinc-400">({reviewCount})</span>
        </span>
      ) : (
        <span className="text-[13px] text-zinc-400">{t("reviews.rowEmpty")}</span>
      )}
      <span className="text-zinc-400">
        <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none">
          <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </a>
  );
}

// ── Summary ────────────────────────────────────────────────────────────────

function SummaryColumn({ summary }: { summary: ReviewSummary }) {
  const { t } = useLanguage();
  const fit = dominantFit(summary.fit);
  return (
    <aside className="w-full shrink-0 lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:w-[300px]">
      <div className="flex items-center gap-3 lg:flex-col lg:items-start lg:gap-2">
        <p className="flex items-baseline gap-1.5">
          <span className="text-4xl font-light leading-none text-zinc-950 lg:text-[56px]">
            {summary.average?.toFixed(1) ?? "–"}
          </span>
          <span className="hidden text-base text-zinc-400 lg:inline">/ 5</span>
        </p>
        <Stars filled={filledStars(summary.average)} size="lg" label={t("reviews.ratingLabel", { rating: summary.average?.toFixed(1) ?? "0" })} />
        <p className="text-xs text-zinc-500">
          {t("reviews.count", { count: summary.count })}
          <span className="hidden lg:inline"> · {t("reviews.allVerified")}</span>
        </p>
      </div>

      {fit ? (
        <div className="mt-6">
          <p className="flex gap-1.5 text-xs">
            <span className="font-medium text-zinc-950">{t("reviews.fit")}</span>
            <span className="text-zinc-600">
              {t("reviews.fitSummary", { label: t(FIT_LABEL_KEYS[fit.result]), percent: fit.percent })}
            </span>
          </p>
          <div className="mt-2 flex h-1 gap-0.5" aria-hidden="true">
            {(["small", "true_to_size", "large"] as const).map((r) => (
              <span
                key={r}
                className={`rounded-full ${r === fit.result ? "bg-zinc-950" : "bg-zinc-200"}`}
                style={{ flexGrow: Math.max(fit.shares[r], 4) }}
              />
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-zinc-400">
            <span>{t("reviews.fitSmall")}</span>
            <span>{t("reviews.fitTrue")}</span>
            <span>{t("reviews.fitLarge")}</span>
          </div>
        </div>
      ) : (
        <ul className="mt-6 space-y-2" aria-label={t("reviews.distribution")}>
          {ratingShares(summary).map(({ stars, count, percent }) => (
            <li key={stars} className="flex items-center gap-3 text-xs">
              <span className="w-7 shrink-0 text-zinc-500">{t("reviews.stars", { n: stars })}</span>
              <span className="relative h-1 flex-1 overflow-hidden rounded-full bg-zinc-100">
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-zinc-950"
                  style={{ width: `${percent}%` }}
                />
              </span>
              <span className={`w-6 shrink-0 text-right ${count ? "text-zinc-950" : "text-zinc-300"}`}>
                {count}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 hidden text-xs leading-relaxed text-zinc-400 lg:block">
        {t("reviews.writeNote")}
      </p>
    </aside>
  );
}

// ── Photo strip ────────────────────────────────────────────────────────────

function PhotoStrip({
  photos,
  total,
  onOpen,
}: {
  photos: ReviewPhoto[];
  total: number;
  onOpen: (index: number) => void;
}) {
  const { t } = useLanguage();
  const count = Math.max(total, photos.length);
  const overflow = photos.length > STRIP_TILES;
  const tiles = overflow ? photos.slice(0, STRIP_TILES - 1) : photos.slice(0, STRIP_TILES);
  return (
    <div className="mb-8">
      <p className="flex gap-1.5 text-sm">
        <span className="font-medium text-zinc-950">{t("reviews.photos")}</span>
        <span className="text-zinc-400">{count}</span>
      </p>
      <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
        {tiles.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => onOpen(i)}
            className="relative size-24 shrink-0 overflow-hidden bg-zinc-100 md:size-28"
            aria-label={t("reviews.photoAlt", { n: i + 1 })}
          >
            <img src={photo.thumbUrl || photo.url} alt="" loading="lazy" className="h-full w-full object-cover" />
          </button>
        ))}
        {overflow && (
          <button
            type="button"
            onClick={() => onOpen(STRIP_TILES - 1)}
            className="flex size-24 shrink-0 items-center justify-center bg-zinc-950 text-base font-medium text-white md:size-28"
            aria-label={t("reviews.photoAlt", { n: STRIP_TILES })}
          >
            +{count - (STRIP_TILES - 1)}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Toolbar ────────────────────────────────────────────────────────────────

function Toolbar({
  sort,
  onSort,
  photoOnly,
  onPhotoOnly,
}: {
  sort: ReviewSort;
  onSort: (sort: ReviewSort) => void;
  photoOnly: boolean;
  onPhotoOnly: (on: boolean) => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center gap-4 border-b border-zinc-950 pb-3">
      <div className="flex min-w-0 gap-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label={t("reviews.sortLabel")}>
        {SORTS.map((s) => (
          <button
            key={s.value}
            type="button"
            aria-pressed={sort === s.value}
            onClick={() => onSort(s.value)}
            className={`shrink-0 whitespace-nowrap text-[13px] transition ${
              sort === s.value ? "font-medium text-zinc-950" : "text-zinc-400 hover:text-zinc-700"
            }`}
          >
            {t(s.key)}
          </button>
        ))}
      </div>
      <label className="ml-auto flex shrink-0 cursor-pointer items-center gap-1.5 text-[13px] text-zinc-600">
        <input
          type="checkbox"
          checked={photoOnly}
          onChange={(e) => onPhotoOnly(e.target.checked)}
          className="size-3.5 accent-zinc-950"
        />
        {t("reviews.photoOnly")}
      </label>
    </div>
  );
}

// ── One review ─────────────────────────────────────────────────────────────

function ReviewItem({ review, onOpenPhoto }: { review: Review; onOpenPhoto: (index: number) => void }) {
  const { t, translateValue } = useLanguage();
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);

  // 더보기 only when the four-line clamp actually cut something.
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el || expanded) return;
    const measure = () => setClamped(el.scrollHeight > el.clientHeight + 1);
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(el);
    return () => observer?.disconnect();
  }, [review.body, expanded]);

  const author = review.author === ANONYMOUS_AUTHOR ? t("reviews.anonymous") : review.author;
  const variant = translateVariantLabel(review.variantLabel, (c) => translateValue("color", c));

  return (
    <li className="border-b border-zinc-100 py-6">
      <div className="flex items-center gap-2">
        <Stars filled={review.rating} label={t("reviews.ratingLabel", { rating: review.rating })} />
        {review.verifiedPurchase && (
          <span className="rounded-sm bg-zinc-100 px-1.5 py-px text-[10px] font-medium text-zinc-600">
            {t("reviews.verified")}
          </span>
        )}
        <time dateTime={review.createdAt} className="ml-auto text-[11px] text-zinc-400">
          {formatReviewDate(review.createdAt)}
        </time>
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        {author}
        {variant && <> · {variant}</>}
      </p>
      {review.fit && (
        <p className="mt-2 flex gap-1.5 text-xs">
          <span className="font-medium text-zinc-950">{t("reviews.fit")}</span>
          <span className="text-zinc-600">{fitLine(review, t)}</span>
        </p>
      )}
      <p
        ref={bodyRef}
        className={`mt-3 whitespace-pre-line break-keep text-sm leading-[1.7] text-zinc-950 ${expanded ? "" : "line-clamp-4"}`}
      >
        {review.body}
      </p>
      {(clamped || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-2 text-xs font-medium text-zinc-500 underline underline-offset-4 hover:text-zinc-950"
        >
          {expanded ? t("reviews.less") : t("reviews.more")}
        </button>
      )}
      {review.photos.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {review.photos.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => onOpenPhoto(i)}
              className="size-[72px] overflow-hidden bg-zinc-100 md:size-20"
              aria-label={t("reviews.photoAlt", { n: i + 1 })}
            >
              <img src={photo.thumbUrl || photo.url} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </li>
  );
}

function fitLine(review: Review, t: (key: string, values?: Record<string, string | number>) => string): string {
  const fit = review.fit;
  if (!fit) return "";
  const parts = [t(FIT_LABEL_KEYS[fit.result])];
  const extra = [
    fit.heightCm ? t("reviews.fitHeight", { height: fit.heightCm }) : "",
    fit.usualSize ? t("reviews.fitUsual", { size: fit.usualSize }) : "",
  ].filter(Boolean);
  if (extra.length) parts.push(extra.join(", "));
  return parts.join(" · ");
}

/** "Black / M" → "블랙 / M": the color half goes through the color dictionary. */
export function translateVariantLabel(label: string | undefined, translateColor: (c: string) => string): string {
  if (!label) return "";
  const [color, ...rest] = label.split(" / ");
  return [translateColor(color), ...rest].filter(Boolean).join(" / ");
}

// ── Pieces ─────────────────────────────────────────────────────────────────

export function Stars({
  filled,
  size = "sm",
  label,
}: {
  filled: number;
  size?: "sm" | "lg";
  label?: string;
}) {
  const cls = size === "lg" ? "size-[18px]" : "size-3";
  return (
    <span className="flex shrink-0 gap-px" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} aria-hidden="true" viewBox="0 0 24 24" className={`${cls} ${i < filled ? "text-zinc-950" : "text-zinc-200"}`}>
          <path
            fill="currentColor"
            d="M12 2.5l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.52l-5.88 3.09 1.12-6.55L2.48 9.42l6.58-.96z"
          />
        </svg>
      ))}
    </span>
  );
}

function EmptyReviews() {
  const { t } = useLanguage();
  return (
    <div className="mt-8 flex flex-col items-center gap-2 rounded bg-ground px-6 py-12 text-center">
      <Stars filled={0} size="lg" />
      <p className="mt-2 text-[15px] font-medium text-zinc-950">{t("reviews.emptyTitle")}</p>
      <p className="max-w-xs break-keep text-[13px] leading-relaxed text-zinc-500">{t("reviews.emptyBody")}</p>
    </div>
  );
}

function ReviewsSkeleton() {
  return (
    <div className="mt-8 flex animate-pulse flex-col gap-10 lg:flex-row lg:gap-16" aria-hidden="true">
      <div className="space-y-3 lg:w-[300px]">
        <div className="h-12 w-24 rounded bg-zinc-100" />
        <div className="h-4 w-32 rounded bg-zinc-100" />
      </div>
      <div className="flex-1 space-y-6">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-2 border-b border-zinc-100 pb-6">
            <div className="h-3 w-24 rounded bg-zinc-100" />
            <div className="h-3 w-40 rounded bg-zinc-100" />
            <div className="h-4 w-full rounded bg-zinc-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

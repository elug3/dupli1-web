import { useCallback, useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";

/** Set once the shopper has seen (or skipped) the first-visit scroll hint. */
const SCROLL_HINT_KEY = "dupli1.pdpScrollHintShown";
/** Share of a slide that must be in view for its dot to light up. */
const ACTIVE_SLIDE_RATIO = 0.25;

type GalleryImage = {
  src: string;
  position: string;
};

type ProductImageGalleryProps = {
  images: GalleryImage[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  alt: string;
  badge?: ReactNode;
  actions?: ReactNode;
  /** The mobile vertical scroller, for a parent that coordinates with it. */
  scrollerRef?: Ref<HTMLDivElement | null>;
  /** Called on every scroll of the mobile scroller. */
  onScrollerScroll?: () => void;
  /** Freeze the mobile scroller (e.g. while a sheet covers it). */
  scrollLocked?: boolean;
};

export function ProductImageGallery({
  images,
  activeIndex,
  onActiveIndexChange,
  alt,
  badge,
  actions,
  scrollerRef,
  onScrollerScroll,
  scrollLocked = false,
}: ProductImageGalleryProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(false);
  // The index the scroller itself last reported, so an index change that came
  // from scrolling does not scroll again (only dots and the zoom modal do).
  const observedIndex = useRef(activeIndex);
  const onActiveIndexChangeRef = useRef(onActiveIndexChange);
  onActiveIndexChangeRef.current = onActiveIndexChange;

  const setScrollRef = useCallback(
    (el: HTMLDivElement | null) => {
      scrollRef.current = el;
      if (typeof scrollerRef === "function") scrollerRef(el);
      else if (scrollerRef) scrollerRef.current = el;
    },
    [scrollerRef]
  );

  // Mobile: a slide counts as current once a quarter of it is in view.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.intersectionRatio < ACTIVE_SLIDE_RATIO) continue;
          const index = Number((entry.target as HTMLElement).dataset.slideIndex);
          observedIndex.current = index;
          onActiveIndexChangeRef.current(index);
        }
      },
      { root, threshold: ACTIVE_SLIDE_RATIO }
    );
    root.querySelectorAll("[data-slide-index]").forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
  }, [images.length]);

  useEffect(() => {
    if (activeIndex === observedIndex.current) return;
    observedIndex.current = activeIndex;
    const slide = scrollRef.current?.querySelector<HTMLElement>(
      `[data-slide-index="${activeIndex}"]`
    );
    if (slide) scrollRef.current?.scrollTo({ top: slide.offsetTop, behavior: "smooth" });
  }, [activeIndex]);

  // First visit: nudge the images up and back once so it is obvious the
  // gallery scrolls vertically.
  useEffect(() => {
    if (images.length < 2) return;
    try {
      if (!window.localStorage.getItem(SCROLL_HINT_KEY)) setShowScrollHint(true);
    } catch {
      // Storage blocked — skip the hint.
    }
  }, [images.length]);

  function dismissScrollHint() {
    if (!showScrollHint) return;
    setShowScrollHint(false);
    try {
      window.localStorage.setItem(SCROLL_HINT_KEY, "1");
    } catch {
      // Storage blocked — the hint simply shows again next time.
    }
  }

  return (
    <div className="relative flex-1 bg-zinc-50">
      {/* Mobile: full-bleed vertical scroller, each image the height of the
          space the bottom sheet leaves (--pdp-gallery-h, set by the page) */}
      <div
        ref={setScrollRef}
        onScroll={() => {
          dismissScrollHint();
          onScrollerScroll?.();
        }}
        className={[
          "relative h-[var(--pdp-gallery-h,120vw)] overscroll-none bg-white [-ms-overflow-style:none] [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden",
          scrollLocked ? "overflow-y-hidden" : "overflow-y-auto",
        ].join(" ")}
      >
        {images.map((img, i) => (
          <div
            key={i}
            data-slide-index={i}
            onAnimationEnd={dismissScrollHint}
            className={[
              "relative box-content h-[var(--pdp-gallery-h,120vw)] w-full bg-zinc-50",
              i < images.length - 1 ? "border-b-2 border-white" : "",
              showScrollHint ? "animate-pdp-scroll-hint" : "",
            ].join(" ")}
          >
            <img
              src={img.src}
              alt={i === 0 ? alt : ""}
              draggable={false}
              loading={i === 0 ? undefined : "lazy"}
              onClick={() => {
                onActiveIndexChange(i);
                setIsZoomOpen(true);
              }}
              className={`absolute inset-0 h-full w-full object-cover ${img.position}`}
            />
          </div>
        ))}

        {/* Dot rail: zero-height and sticky to the scroller's bottom edge, so
            it stays put bottom-left while the images scroll past */}
        {images.length > 1 && (
          <div className="pointer-events-none sticky bottom-0 z-10 h-0 w-min">
            <div className="pointer-events-auto absolute bottom-0 left-0 flex flex-col pb-3 pl-3">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Image ${i + 1} of ${images.length}`}
                  aria-current={activeIndex === i}
                  onClick={() => onActiveIndexChange(i)}
                  className="flex size-5 items-center justify-center"
                >
                  <span
                    className={[
                      "size-1.5 rounded-full border border-zinc-950 transition-colors",
                      activeIndex === i ? "bg-zinc-950" : "bg-transparent",
                    ].join(" ")}
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Desktop: full-bleed vertical stack — every image at full column
          width, one below the other, hairline-separated. The column scrolls
          against the pinned product info beside it. */}
      <div className="hidden flex-col gap-0.5 bg-white lg:flex">
        {actions && (
          <div className="pointer-events-none sticky top-[8.25rem] z-10 h-0">
            <div className="pointer-events-auto absolute right-4 top-4">
              {actions}
            </div>
          </div>
        )}
        {images.map((img, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Open image ${i + 1} of ${images.length}`}
            onClick={() => {
              onActiveIndexChange(i);
              setIsZoomOpen(true);
            }}
            className="relative block w-full cursor-zoom-in overflow-hidden bg-zinc-50"
            style={{ paddingBottom: "120%" }}
          >
            <img
              src={img.src}
              alt={i === 0 ? alt : ""}
              draggable={false}
              loading={i === 0 ? undefined : "lazy"}
              className={`absolute inset-0 h-full w-full object-cover ${img.position}`}
            />
          </button>
        ))}
      </div>

      {badge && (
        <div className="pointer-events-none absolute left-4 top-4 z-10">{badge}</div>
      )}

      {actions && (
        <div className="absolute right-4 top-4 z-10 lg:hidden">{actions}</div>
      )}

      {isZoomOpen && (
        <ImageZoomModal
          images={images}
          activeIndex={activeIndex}
          onActiveIndexChange={onActiveIndexChange}
          alt={alt}
          onClose={() => setIsZoomOpen(false)}
        />
      )}
    </div>
  );
}

// ── Full-body zoom modal ────────────────────────────────────────────────────

function ImageZoomModal({
  images,
  activeIndex,
  onActiveIndexChange,
  alt,
  onClose,
}: {
  images: GalleryImage[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  alt: string;
  onClose: () => void;
}) {
  const hasMultiple = images.length > 1;

  const goPrev = useCallback(() => {
    onActiveIndexChange((activeIndex - 1 + images.length) % images.length);
  }, [activeIndex, images.length, onActiveIndexChange]);

  const goNext = useCallback(() => {
    onActiveIndexChange((activeIndex + 1) % images.length);
  }, [activeIndex, images.length, onActiveIndexChange]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && hasMultiple) goPrev();
      else if (e.key === "ArrowRight" && hasMultiple) goNext();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, goPrev, goNext, hasMultiple]);

  const activeImage = images[activeIndex];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.95)" }}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-3 top-3 z-10 flex size-10 items-center justify-center rounded-full text-white transition hover:bg-white/10 md:right-5 md:top-5"
      >
        <CloseIcon />
      </button>

      {hasMultiple && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          aria-label="Previous image"
          className="absolute left-2 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-white transition hover:bg-white/10 md:left-4"
        >
          <ArrowIcon direction="left" />
        </button>
      )}

      <div
        className="h-[85vh] w-[92vw] md:w-[85vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={activeImage.src}
          alt={alt}
          draggable={false}
          className="h-full w-full select-none object-contain"
        />
      </div>

      {hasMultiple && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          aria-label="Next image"
          className="absolute right-2 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-white transition hover:bg-white/10 md:right-4"
        >
          <ArrowIcon direction="right" />
        </button>
      )}

      {hasMultiple && (
        <div className="absolute bottom-5 left-0 right-0 z-10 flex justify-center gap-2">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onActiveIndexChange(i);
              }}
              aria-label={`Image ${i + 1} of ${images.length}`}
              className={[
                "h-1.5 rounded-full bg-white transition-all",
                activeIndex === i ? "w-5" : "w-1.5",
              ].join(" ")}
              style={activeIndex === i ? undefined : { opacity: 0.4 }}
            />
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg aria-hidden="true" className="size-6" viewBox="0 0 24 24" fill="none">
      <path
        d={direction === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

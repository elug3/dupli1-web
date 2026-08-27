import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

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
};

export function ProductImageGallery({
  images,
  activeIndex,
  onActiveIndexChange,
  alt,
  badge,
  actions,
}: ProductImageGalleryProps) {
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const desktopItemRefs = useRef<(HTMLElement | null)[]>([]);
  const scrollingToIndex = useRef<number | null>(null);
  const activeIndexRef = useRef(activeIndex);
  const [isZoomOpen, setIsZoomOpen] = useState(false);

  activeIndexRef.current = activeIndex;

  // Keep the mobile horizontal carousel in sync with activeIndex.
  useEffect(() => {
    const container = mobileScrollRef.current;
    if (!container) return;

    const targetLeft = container.offsetWidth * activeIndex;
    if (Math.abs(container.scrollLeft - targetLeft) > 2) {
      container.scrollTo({ left: targetLeft, behavior: "smooth" });
    }
  }, [activeIndex]);

  // Desktop: track which full-bleed frame is in view while the page scrolls.
  useEffect(() => {
    const elements = desktopItemRefs.current.filter(Boolean) as HTMLElement[];
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (scrollingToIndex.current !== null) return;

        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        const top = visible[0]?.target;
        if (!(top instanceof HTMLElement)) return;

        const index = Number(top.dataset.index);
        if (
          Number.isInteger(index) &&
          index >= 0 &&
          index < images.length &&
          index !== activeIndexRef.current
        ) {
          onActiveIndexChange(index);
        }
      },
      {
        threshold: [0.25, 0.45, 0.65],
        rootMargin: "-12% 0px -28% 0px",
      }
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [images.length, onActiveIndexChange]);

  function handleMobileScroll() {
    const container = mobileScrollRef.current;
    if (!container) return;

    const slideWidth = container.offsetWidth;
    if (slideWidth === 0) return;

    const index = Math.round(container.scrollLeft / slideWidth);
    if (index !== activeIndex && index >= 0 && index < images.length) {
      onActiveIndexChange(index);
    }
  }

  function openZoomAt(index: number) {
    onActiveIndexChange(index);
    setIsZoomOpen(true);
  }

  function scrollDesktopTo(index: number) {
    const el = desktopItemRefs.current[index];
    if (!el) return;

    scrollingToIndex.current = index;
    onActiveIndexChange(index);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      if (scrollingToIndex.current === index) {
        scrollingToIndex.current = null;
      }
    }, 700);
  }

  return (
    <div className="relative flex-1">
      {/* Mobile: swipeable carousel (first viewport stays compact) */}
      <div className="relative overflow-hidden bg-zinc-50 md:hidden">
        <div
          ref={mobileScrollRef}
          onScroll={handleMobileScroll}
          className="flex snap-x snap-mandatory overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {images.map((img, i) => (
            <div
              key={i}
              className="relative w-full shrink-0 snap-center snap-always"
              style={{ paddingBottom: "120%" }}
            >
              <img
                src={img.src}
                alt={i === activeIndex ? alt : ""}
                draggable={false}
                onClick={() => openZoomAt(i)}
                className={`absolute inset-0 h-full w-full object-cover ${img.position}`}
              />
            </div>
          ))}
        </div>

        {badge && (
          <div className="pointer-events-none absolute left-4 top-4 z-10">{badge}</div>
        )}

        {actions && (
          <div className="absolute right-4 top-4 z-10">{actions}</div>
        )}

        {images.length > 1 && (
          <div className="absolute bottom-4 left-0 right-0 z-10 flex justify-center gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Image ${i + 1} of ${images.length}`}
                onClick={() => onActiveIndexChange(i)}
                className={[
                  "h-1.5 rounded-full transition-all",
                  activeIndex === i ? "w-5 bg-zinc-950" : "w-1.5 bg-zinc-400",
                ].join(" ")}
              />
            ))}
          </div>
        )}
      </div>

      {/* Desktop: full-bleed vertical stack — page scroll drives the gallery */}
      <div className="relative hidden md:block">
        {(badge || actions) && (
          <div className="pointer-events-none sticky top-28 z-10 -mb-14 flex items-start justify-between px-4 pt-4">
            <div>{badge}</div>
            <div className="pointer-events-auto">{actions}</div>
          </div>
        )}

        <div className="flex flex-col">
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              data-index={i}
              ref={(el) => {
                desktopItemRefs.current[i] = el;
              }}
              onClick={() => openZoomAt(i)}
              aria-label={`${alt} — image ${i + 1} of ${images.length}`}
              className="relative block w-full cursor-zoom-in bg-zinc-50"
              style={{ paddingBottom: "120%" }}
            >
              <img
                src={img.src}
                alt={i === activeIndex ? alt : ""}
                draggable={false}
                className={`absolute inset-0 h-full w-full object-cover ${img.position}`}
              />
            </button>
          ))}
        </div>

        {images.length > 1 && (
          <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-10">
            <div className="sticky top-1/2 flex -translate-y-1/2 flex-col items-center gap-1">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Go to image ${i + 1}`}
                  aria-current={activeIndex === i ? "true" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    scrollDesktopTo(i);
                  }}
                  className="pointer-events-auto flex size-8 items-center justify-center"
                >
                  <span
                    className={[
                      "block size-2 rounded-full transition",
                      activeIndex === i
                        ? "bg-zinc-950"
                        : "bg-zinc-400/80 hover:bg-zinc-700",
                    ].join(" ")}
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

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

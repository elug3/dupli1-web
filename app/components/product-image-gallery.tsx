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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isZoomOpen, setIsZoomOpen] = useState(false);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const targetLeft = container.offsetWidth * activeIndex;
    if (Math.abs(container.scrollLeft - targetLeft) > 2) {
      container.scrollTo({ left: targetLeft, behavior: "smooth" });
    }
  }, [activeIndex]);

  function handleScroll() {
    const container = scrollRef.current;
    if (!container) return;

    const slideWidth = container.offsetWidth;
    if (slideWidth === 0) return;

    const index = Math.round(container.scrollLeft / slideWidth);
    if (index !== activeIndex && index >= 0 && index < images.length) {
      onActiveIndexChange(index);
    }
  }

  const activeImage = images[activeIndex];

  return (
    <div className="relative flex-1 overflow-hidden bg-zinc-50">
      {/* Mobile: swipeable carousel */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden"
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
              onClick={() => setIsZoomOpen(true)}
              className={`absolute inset-0 h-full w-full object-cover ${img.position}`}
            />
          </div>
        ))}
      </div>

      {/* Desktop: single image */}
      <div className="relative hidden md:block" style={{ paddingBottom: "120%" }}>
        <img
          src={activeImage.src}
          alt={alt}
          onClick={() => setIsZoomOpen(true)}
          className={`absolute inset-0 h-full w-full cursor-zoom-in object-cover transition duration-500 ${activeImage.position}`}
        />
      </div>

      {badge && (
        <div className="pointer-events-none absolute left-4 top-4 z-10">{badge}</div>
      )}

      {actions && (
        <div className="absolute right-4 top-4 z-10">{actions}</div>
      )}

      {images.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 z-10 flex justify-center gap-1.5 md:hidden">
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

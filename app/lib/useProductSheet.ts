import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { hasReachedScrollEnd, resolveSheetDrag } from "~/lib/product-sheet";

/** Tailwind `max-lg`: below 64rem the PDP is a gallery with a bottom sheet. */
const MOBILE_QUERY = "(width < 64rem)";
/** Breathing room kept under the bag button in the collapsed sheet. */
const PEEK_BOTTOM_GAP_PX = 16;

function isMobileViewport() {
  return typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches;
}

function headerBottom() {
  return document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
}

function scrollWindowTo(top: number) {
  window.scrollTo({ top, behavior: "instant" });
}

/**
 * Mobile PDP: a full-bleed vertical gallery with the product info as a bottom
 * sheet over it.
 *
 * Collapsed, the document does not scroll — only the gallery does, and the
 * sheet shows its head (handle, name, price, bag button). The sheet opens when
 * dragged up far enough, when its handle is tapped, or when the gallery is
 * scrolled to its last image. Open, it sits right under the site header and
 * the document scrolls it (and the related products after it); scrolling back
 * to the very top closes it again.
 *
 * Open moves the sheet in layout (a negative bottom margin on the gallery) and
 * animates the jump with a FLIP, so the page's scroll height is exactly the
 * content's. From `lg` up none of this applies and the page is the normal
 * two-column layout.
 */
export function useProductSheet() {
  const rootRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const headEndRef = useRef<HTMLDivElement>(null);

  const [isMobile, setIsMobile] = useState(isMobileViewport);
  const [open, setOpenState] = useState(false);
  const [pinnedTop, setPinnedTop] = useState<number | null>(null);

  const openRef = useRef(false);
  const peekRef = useRef(0);
  // Sheet top (viewport px) right before an open/close, for the FLIP.
  const flipFrom = useRef<number | null>(null);
  const drag = useRef<{ startY: number; active: boolean; commit: boolean } | null>(null);
  const suppressClick = useRef(false);

  const setOpen = useCallback((next: boolean) => {
    const sheet = sheetRef.current;
    if (!sheet || openRef.current === next || !isMobileViewport()) return;
    flipFrom.current = sheet.getBoundingClientRect().top;
    openRef.current = next;
    setOpenState(next);
  }, []);

  // Viewport size → mobile or desktop layout.
  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY);
    const onChange = () => {
      setIsMobile(query.matches);
      if (!query.matches && openRef.current) {
        openRef.current = false;
        setOpenState(false);
      }
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // CSS variables the layout sizes itself from: viewport height, header
  // bottom, and the collapsed sheet's visible height (its head).
  useEffect(() => {
    const root = rootRef.current;
    const sheet = sheetRef.current;
    if (!root || !sheet || !isMobile) return;
    const measure = () => {
      root.style.setProperty("--pdp-vh", `${window.innerHeight}px`);
      root.style.setProperty("--pdp-header", `${headerBottom()}px`);
      const headEnd = headEndRef.current;
      // Re-measured only at rest: the head's offset inside the sheet is
      // unaffected by the sheet's own transform, but an open sheet's head is
      // not what the collapsed state shows.
      if (!headEnd || openRef.current || drag.current?.active) return;
      const peek = Math.ceil(
        headEnd.getBoundingClientRect().bottom -
          sheet.getBoundingClientRect().top +
          PEEK_BOTTOM_GAP_PX
      );
      peekRef.current = peek;
      root.style.setProperty("--pdp-peek", `${peek}px`);
    };
    measure();
    // The head grows once the price stops loading, and with long names.
    const observer = new ResizeObserver(measure);
    observer.observe(sheet);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [isMobile]);

  // Document lock while collapsed, plus the FLIP for open/close.
  useLayoutEffect(() => {
    const html = document.documentElement;
    const sheet = sheetRef.current;
    const gallery = galleryRef.current;
    if (!isMobile || !sheet) {
      flipFrom.current = null;
      return;
    }

    const before = flipFrom.current;
    flipFrom.current = null;
    if (before !== null) {
      sheet.style.transition = "none";
      sheet.style.transform = "";
    }

    if (open) {
      html.style.overflow = "";
      // 1px down: arriving back at 0 is what "pulled past the top" means.
      scrollWindowTo(1);
    } else {
      scrollWindowTo(0);
      html.style.overflow = "hidden";
      // Step back off the gallery's end so reaching it can open again.
      if (before !== null && gallery) gallery.scrollTop = Math.max(0, gallery.scrollTop - 2);
    }

    if (before !== null) {
      const delta = before - sheet.getBoundingClientRect().top;
      sheet.style.transform = `translateY(${delta}px)`;
      sheet.getBoundingClientRect(); // commit the inverted position
      sheet.style.transition = "";
      sheet.style.transform = "";
    }

    return () => {
      html.style.overflow = "";
    };
  }, [isMobile, open]);

  // Open: close on reaching the top again; pin a handle under the header once
  // the sheet's own handle has scrolled away.
  useEffect(() => {
    if (!isMobile || !open) {
      setPinnedTop(null);
      return;
    }
    const onScroll = () => {
      if (window.scrollY <= 0) {
        setOpen(false);
        return;
      }
      const top = headerBottom();
      const sheetTop = sheetRef.current?.getBoundingClientRect().top ?? top;
      setPinnedTop(sheetTop < top - 24 ? top : null);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isMobile, open, setOpen]);

  // Dragging the collapsed sheet up.
  useEffect(() => {
    if (!isMobile) return;
    const onMove = (event: PointerEvent) => {
      const state = drag.current;
      const sheet = sheetRef.current;
      if (!state || !sheet) return;
      const next = resolveSheetDrag({
        startY: state.startY,
        y: event.clientY,
        viewportHeight: window.innerHeight,
        peekHeight: peekRef.current,
        sheetHeight: sheet.offsetHeight,
      });
      if (!state.active && !next.active) return;
      state.active = true;
      state.commit = next.commit;
      sheet.style.transition = "none";
      sheet.style.transform = `translateY(${next.offset}px)`;
    };
    const onEnd = () => {
      const state = drag.current;
      const sheet = sheetRef.current;
      drag.current = null;
      if (!state?.active || !sheet) return;
      // The pointer lifted over whatever it started on; that is not a click.
      suppressClick.current = true;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
      if (state.commit) {
        setOpen(true);
      } else {
        sheet.style.transition = "";
        sheet.style.transform = "";
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };
  }, [isMobile, setOpen]);

  const onSheetPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      if (!isMobile || openRef.current || event.button !== 0) return;
      drag.current = { startY: event.clientY, active: false, commit: false };
    },
    [isMobile]
  );

  const onSheetClickCapture = useCallback((event: ReactMouseEvent) => {
    if (!suppressClick.current) return;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const onGalleryScroll = useCallback(() => {
    const gallery = galleryRef.current;
    if (gallery && !openRef.current && hasReachedScrollEnd(gallery)) setOpen(true);
  }, [setOpen]);

  const toggle = useCallback(() => setOpen(!openRef.current), [setOpen]);

  const mobileOpen = isMobile && open;
  const galleryStyle: CSSProperties | undefined = mobileOpen
    ? { marginBottom: "calc(-1 * var(--pdp-gallery-h))" }
    : undefined;
  // Tall enough that the 1px "not at the top" offset always exists.
  const sheetStyle: CSSProperties | undefined = mobileOpen
    ? { minHeight: "calc(var(--pdp-vh) - var(--pdp-header) + 1px)" }
    : undefined;

  return {
    isMobile,
    open: mobileOpen,
    pinnedTop,
    toggle,
    show: useCallback(() => setOpen(true), [setOpen]),
    close: useCallback(() => setOpen(false), [setOpen]),
    rootRef,
    galleryRef,
    sheetRef,
    headEndRef,
    galleryStyle,
    sheetStyle,
    onGalleryScroll,
    sheetHandlers: {
      onPointerDown: onSheetPointerDown,
      onClickCapture: onSheetClickCapture,
    },
  };
}

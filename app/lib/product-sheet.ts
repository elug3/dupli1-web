/**
 * Drag maths for the mobile PDP bottom sheet (`app/routes/pages/product.tsx`).
 *
 * Collapsed, the sheet shows only its head (handle, name, price, bag button)
 * under a full-bleed vertical gallery. Dragging it up follows the finger once
 * past a small dead zone, is clamped so it never overshoots most of the
 * screen, and opens on release once it has travelled a tenth of the viewport;
 * anything shorter springs back.
 */

/** Movement below this is a tap, not a drag, so the bag button still clicks. */
export const SHEET_DRAG_DEAD_ZONE_PX = 20;
/** Share of the viewport height a drag must travel to open the sheet. */
export const SHEET_OPEN_THRESHOLD = 0.1;
/** Share of the viewport the dragged sheet may cover at most. */
export const SHEET_MAX_COVER = 0.7;

export type SheetDragInput = {
  /** Pointer Y when the drag started. */
  startY: number;
  /** Current pointer Y. */
  y: number;
  /** `window.innerHeight`. */
  viewportHeight: number;
  /** Visible height of the collapsed sheet (its head). */
  peekHeight: number;
  /** Full height of the sheet element. */
  sheetHeight: number;
};

export type SheetDrag = {
  /** False while still inside the dead zone. */
  active: boolean;
  /** `translateY` for the sheet, in px (0 or negative: the sheet only rises). */
  offset: number;
  /** Releasing now opens the sheet. */
  commit: boolean;
};

export function resolveSheetDrag({
  startY,
  y,
  viewportHeight,
  peekHeight,
  sheetHeight,
}: SheetDragInput): SheetDrag {
  const lift = startY - y; // positive = upward
  if (Math.abs(lift) < SHEET_DRAG_DEAD_ZONE_PX) {
    return { active: false, offset: 0, commit: false };
  }
  const maxLift = Math.max(
    0,
    Math.min(sheetHeight, SHEET_MAX_COVER * viewportHeight - peekHeight)
  );
  const offset = -Math.min(Math.max(lift, 0), maxLift);
  return {
    active: true,
    // `-0` would render as `translateY(-0px)`; keep it a plain zero.
    offset: offset === 0 ? 0 : offset,
    commit: lift >= SHEET_OPEN_THRESHOLD * viewportHeight,
  };
}

/** True once a scroller has been scrolled to (within a pixel of) its end. */
export function hasReachedScrollEnd(el: {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
}): boolean {
  return el.scrollHeight > el.clientHeight && el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
}

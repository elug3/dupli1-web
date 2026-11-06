import { useEffect, useSyncExternalStore } from "react";

/**
 * Lets a page put the fixed site header over its own full-bleed image, the
 * way the home hero does. The tone says what the header text should be drawn
 * in: `light` (white, over a dark image) or `dark` (ink, over a light one).
 */
export type HeaderOverlayTone = "light" | "dark";

let current: HeaderOverlayTone | null = null;
const listeners = new Set<() => void>();

function set(tone: HeaderOverlayTone | null) {
  if (current === tone) return;
  current = tone;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The overlay a mounted page asked for, or null. */
export function useHeaderOverlay(): HeaderOverlayTone | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}

/** Call from a page whose first element is a full-bleed image. */
export function useRequestHeaderOverlay(tone: HeaderOverlayTone | null) {
  useEffect(() => {
    if (!tone) return;
    set(tone);
    return () => set(null);
  }, [tone]);
}

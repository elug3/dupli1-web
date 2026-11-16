import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

/**
 * Who the shopper is shopping for. It is the storefront's first cut: a shopper
 * picks once and the home page, the menu and listing links follow. `all` is
 * the neutral state of a visitor who has not chosen.
 */
export type GenderMode = "all" | "women" | "men";

export const GENDER_MODES: readonly GenderMode[] = ["women", "men", "all"];

/** Translation key for each mode's label. */
export const GENDER_MODE_LABEL_KEYS: Record<GenderMode, string> = {
  women: "category.women",
  men: "category.men",
  all: "filter.all",
};

const STORAGE_KEY = "dupli1_gender";

export function normalizeGenderMode(value: string | null | undefined): GenderMode | null {
  const mode = (value ?? "").trim().toLowerCase();
  return mode === "women" || mode === "men" || mode === "all" ? mode : null;
}

/**
 * Whether a product's audience (`target`: women | men | kids | all) belongs in
 * a mode. Unisex (`all`) and products with no audience recorded show for both,
 * so nothing disappears just because it was never tagged.
 */
export function matchesGender(target: string | undefined, mode: GenderMode): boolean {
  if (mode === "all") return true;
  const code = (target ?? "").trim().toLowerCase();
  return code === mode || code === "all" || code === "";
}

/** The home page of a mode. */
export function genderHomePath(mode: GenderMode): string {
  return mode === "all" ? "/" : `/${mode}`;
}

/** `/`, `/women` and `/men` are all the home page (hero under the header). */
export function isHomePath(pathname: string): boolean {
  return pathname === "/" || pathname === "/women" || pathname === "/men";
}

/**
 * A category listing link narrowed to the mode, through the listing's own
 * `gender` filter. A link that already names a gender is left alone.
 */
export function withGender(to: string, mode: GenderMode): string {
  if (mode === "all" || !to.startsWith("/category/")) return to;
  const [path, query = ""] = to.split("?");
  const params = new URLSearchParams(query);
  if (params.has("gender")) return to;
  params.set("gender", mode);
  return `${path}?${params.toString()}`;
}

interface GenderContextValue {
  mode: GenderMode;
  /** False until the remembered choice has been read (first client render). */
  ready: boolean;
  setMode: (mode: GenderMode) => void;
}

const GenderContext = createContext<GenderContextValue>({
  mode: "all",
  ready: false,
  setMode: () => {},
});

/** Remembers the choice in this browser, the way the language is remembered. */
export function GenderProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<GenderMode>("all");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = normalizeGenderMode(localStorage.getItem(STORAGE_KEY));
      if (stored) setModeState(stored);
    } catch {
      // Storage blocked: the visitor simply stays in `all`.
    }
    setReady(true);
  }, []);

  const setMode = useCallback((next: GenderMode) => {
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not remembered across visits, still applied for this one.
    }
  }, []);

  const value = useMemo(() => ({ mode, ready, setMode }), [mode, ready, setMode]);
  return <GenderContext.Provider value={value}>{children}</GenderContext.Provider>;
}

export function useGender(): GenderContextValue {
  return useContext(GenderContext);
}

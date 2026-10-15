import { useEffect, useMemo, useState } from "react";
import { useRouteLoaderData } from "react-router";

import {
  type NavShelf,
  navPaths,
  preloadNavImages,
  seedNavShelves,
  warmNavShelves,
} from "./nav";

const EMPTY: Record<string, NavShelf> = {};

/**
 * Category snapshot from the root loader (filled at server startup), with a
 * browser fetch only for paths the server did not answer in time.
 */
export function useNavShelves(): Record<string, NavShelf> {
  const loaded =
    useRouteLoaderData<{ navShelves?: Record<string, NavShelf> }>("root")?.navShelves ?? EMPTY;
  const [filled, setFilled] = useState<Record<string, NavShelf> | null>(null);

  useEffect(() => {
    seedNavShelves(loaded);
    const missing = navPaths().filter((to) => !loaded[to]);
    if (missing.length === 0) {
      preloadNavImages(loaded);
      return;
    }
    let cancelled = false;
    void warmNavShelves(missing).then((shelves) => {
      if (cancelled) return;
      setFilled(shelves);
      preloadNavImages({ ...loaded, ...shelves });
    });
    return () => {
      cancelled = true;
    };
  }, [loaded]);

  return useMemo(() => ({ ...loaded, ...(filled ?? {}) }), [loaded, filled]);
}

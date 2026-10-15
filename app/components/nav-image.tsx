import { useEffect, useState } from "react";

import { navImageFromMap, navItemImage } from "~/lib/nav";
import { useNavImages } from "~/lib/useNavImages";

/**
 * A category's most viewed product on the ground colour. The URL comes from
 * the day cache started with the server, so the photo is in the first HTML.
 * A category the catalog confirmed empty renders nothing — the menu and the
 * home feed omit that tile. A lookup that has not resolved yet stays a blank
 * ground until the fallback request returns.
 */
export function NavImage({ to, className }: { to: string; className: string }) {
  const fromCache = navImageFromMap(useNavImages(), to);
  const [fetched, setFetched] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (fromCache !== undefined) return;
    let cancelled = false;
    void navItemImage(to).then((next) => {
      if (!cancelled) setFetched(next);
    });
    return () => {
      cancelled = true;
    };
  }, [to, fromCache]);

  if (fromCache === null) return null;

  const src = fromCache ?? fetched;
  return (
    <div className={`overflow-hidden bg-ground ${className}`}>
      {src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover mix-blend-multiply"
        />
      )}
    </div>
  );
}

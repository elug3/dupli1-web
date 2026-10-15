import { useEffect, useState } from "react";

import { navDisplaySrc, navItemImage } from "~/lib/nav";
import { useNavShelves } from "~/lib/useNavShelves";

/**
 * A category's most viewed product on the ground colour. The startup
 * snapshot paints it on the first response; a catalog photo is served from
 * the in-memory cache, and a failed cache read falls back to the CDN URL.
 */
export function NavImage({ to, className }: { to: string; className: string }) {
  const shelf = useNavShelves()[to];
  const stocked = shelf?.status === "stocked";
  const stockedSrc = stocked ? navDisplaySrc(to, shelf.image) : null;
  const direct = stocked ? shelf.image : null;
  const [fetched, setFetched] = useState<{ to: string; src: string | null } | null>(null);
  const [fallback, setFallback] = useState<{ to: string; src: string } | null>(null);

  useEffect(() => {
    if (stocked || shelf?.status === "empty") return;
    let cancelled = false;
    void navItemImage(to).then((image) => {
      if (!cancelled) setFetched({ to, src: navDisplaySrc(to, image) });
    });
    return () => {
      cancelled = true;
    };
  }, [to, shelf?.status, stocked]);

  const src =
    fallback?.to === to
      ? fallback.src
      : shelf?.status === "empty"
        ? null
        : stockedSrc ?? (fetched?.to === to ? fetched.src : null);

  return (
    <div className={`overflow-hidden bg-ground ${className}`}>
      {src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover mix-blend-multiply"
          onError={() => {
            if (!direct || src === direct) return;
            setFallback({ to, src: direct });
          }}
        />
      )}
    </div>
  );
}

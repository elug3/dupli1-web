import { useEffect, useState } from "react";

import { navItemImage } from "~/lib/nav";

/**
 * A category's most viewed product on the ground colour, blank until it
 * loads. The menu drawer and the home category tiles share it, and the
 * request behind it, so a tile seen in one is instant in the other.
 */
export function NavImage({ to, className }: { to: string; className: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void navItemImage(to).then((next) => {
      if (!cancelled) setSrc(next);
    });
    return () => {
      cancelled = true;
    };
  }, [to]);

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

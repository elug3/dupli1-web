import { useEffect, useState } from "react";

/**
 * Thumbnail for one order line, shared by the orders list and order detail.
 *
 * Order items carry the image the catalog held when the order was placed, so
 * the URL can outlive the file it points at. A dead URL falls back to the same
 * neutral tile as a line that never had an image, rather than a broken icon.
 */
export function OrderItemThumb({
  src,
  alt,
  className,
}: {
  src?: string;
  alt: string;
  /** Sizing utilities, e.g. `size-20`. */
  className: string;
}) {
  const [failed, setFailed] = useState(false);

  // A re-render with a different image must get its own chance to load.
  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        aria-hidden="true"
        className={`${className} shrink-0 bg-zinc-50`}
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${className} shrink-0 bg-zinc-50 object-cover`}
    />
  );
}

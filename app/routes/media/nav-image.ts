import type { LoaderFunctionArgs } from "react-router";

import { readCachedNavImage } from "~/lib/nav-catalog.server";

/**
 * Listing photo for one menu category, from the startup cache.
 * `to` is a nav path, never an image URL, so this cannot proxy arbitrary hosts.
 * A miss is not cached: the category may gain a product on the next sweep.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const to = new URL(request.url).searchParams.get("to")?.trim() ?? "";
  const image = await readCachedNavImage(to);
  if (!image) {
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return new Response(image.body.slice(), {
    status: 200,
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=60",
    },
  });
}

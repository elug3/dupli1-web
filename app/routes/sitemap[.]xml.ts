import type { LoaderFunctionArgs } from "react-router";

import { buildSitemapEntries, renderSitemapXml } from "~/lib/sitemap.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const entries = await buildSitemapEntries();
  const xml = renderSitemapXml(entries);

  const ifNoneMatch = request.headers.get("If-None-Match");
  const etag = `"dupli1-sitemap-${entries.length}"`;

  if (ifNoneMatch === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      ETag: etag,
    },
  });
}

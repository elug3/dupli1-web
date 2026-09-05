import type { LoaderFunctionArgs } from "react-router";

import {
  fetchUpstreamBags,
  toBagResponse,
} from "~/lib/product-upstream.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const params = new URL(request.url).searchParams;
  const filters: Record<string, string> = {};

  for (const key of ["brand", "color", "material"]) {
    const value = params.get(key);
    if (value?.trim()) filters[key] = value.trim();
  }

  try {
    const products = await fetchUpstreamBags(filters);
    const results = products.map(toBagResponse);

    return Response.json({ total: results.length, results });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch bags";
    return Response.json({ error: message }, { status: 502 });
  }
}

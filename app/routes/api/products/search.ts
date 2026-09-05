import type { LoaderFunctionArgs } from "react-router";

import {
  searchUpstreamProducts,
  toSearchResult,
} from "~/lib/product-upstream.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const products = (await searchUpstreamProducts(
    new URL(request.url).searchParams
  )).map(toSearchResult);

  return Response.json({ total: products.length, results: products });
}

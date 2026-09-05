import type { LoaderFunctionArgs } from "react-router";

import {
  fetchUpstreamProductById,
  toProductResponse,
} from "~/lib/product-upstream.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const id = params.id ?? "";
  if (!id) {
    return Response.json({ error: "Product not found" }, { status: 404 });
  }

  try {
    const product = await fetchUpstreamProductById(id);

    if (!product) {
      return Response.json({ error: "Product not found" }, { status: 404 });
    }

    return Response.json(toProductResponse(product));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch product";
    return Response.json({ error: message }, { status: 502 });
  }
}

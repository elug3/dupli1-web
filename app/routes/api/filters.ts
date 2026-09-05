import type { LoaderFunctionArgs } from "react-router";

import { supportedFilters } from "~/lib/product-upstream.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const category = new URL(request.url).searchParams.get("category") ?? "";

  return Response.json({ filters: supportedFilters(category) });
}

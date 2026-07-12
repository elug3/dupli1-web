import type { LoaderFunctionArgs } from "react-router";

import { proxyBackendApi } from "../lib/bff-session.server";

// Stock reads are public on the inventory service — no session required.
export async function loader({ request, params }: LoaderFunctionArgs) {
  const sku = encodeURIComponent(params.sku ?? "");
  return proxyBackendApi("inventory", request, `/api/v1/inventory/${sku}`, {
    noStore: true,
  });
}

import type { LoaderFunctionArgs } from "react-router";

import { proxyBackendApi } from "../lib/bff-session.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const id = encodeURIComponent(params.id ?? "");
  return proxyBackendApi("payments", request, `/api/v1/payments/${id}`, {
    requireAuth: true,
    noStore: true,
  });
}

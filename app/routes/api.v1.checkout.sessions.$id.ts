import type { LoaderFunctionArgs } from "react-router";

import { proxyBackendApi } from "../lib/bff-session.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const id = encodeURIComponent(params.id ?? "");
  return proxyBackendApi("checkout", request, `/api/v1/checkout/sessions/${id}`, {
    requireAuth: true,
  });
}

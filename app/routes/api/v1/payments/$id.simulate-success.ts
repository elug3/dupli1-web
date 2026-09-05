import type { LoaderFunctionArgs } from "react-router";

import { proxyBackendApi } from "~/lib/bff-session.server";

// Dev-only endpoint (PAYMENT_ALLOW_DEV_SIMULATE on the payment service); not
// Bearer-gated upstream, so this proxy doesn't require a session either.
export async function loader({ request, params }: LoaderFunctionArgs) {
  const id = encodeURIComponent(params.id ?? "");
  return proxyBackendApi(
    "payments",
    request,
    `/api/v1/payments/${id}/simulate-success`,
    { noStore: true }
  );
}

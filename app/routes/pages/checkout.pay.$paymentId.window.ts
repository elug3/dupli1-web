import type { LoaderFunctionArgs } from "react-router";

import { proxyNanoCheckout } from "~/lib/bff-session.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  return proxyNanoCheckout(request, params.paymentId ?? "");
}

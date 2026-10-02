import type { ActionFunctionArgs } from "react-router";

import { proxyVisitBeacon } from "~/lib/bff-session.server";

/**
 * Local-dev BFF passthrough for the unique-visitor beacon.
 * Production ALB forwards `/api/v1/products/visits` to the gateway.
 */
export async function action({ request }: ActionFunctionArgs) {
  return proxyVisitBeacon(request);
}

import type { ActionFunctionArgs } from "react-router";

import { proxyProductApi } from "~/lib/bff-session.server";

// Cart-aware preview of a promotional code. Public, like redeem: the customer
// is shown what a code would give before committing. The preview is advisory —
// checkout complete re-evaluates against server-resolved prices and is the
// authority on what is actually charged.
export async function action({ request }: ActionFunctionArgs) {
  return proxyProductApi(request, "/api/v1/products/promotions/evaluate");
}

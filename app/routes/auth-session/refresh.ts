import type { ActionFunctionArgs } from "react-router";

import { handleRefresh } from "~/lib/bff-session.server";

export async function action({ request }: ActionFunctionArgs) {
  return handleRefresh(request);
}

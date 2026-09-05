import type { ActionFunctionArgs } from "react-router";

import { handleLogout } from "~/lib/bff-session.server";

export async function action({ request }: ActionFunctionArgs) {
  return handleLogout(request);
}

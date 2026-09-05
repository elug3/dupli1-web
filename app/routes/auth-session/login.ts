import type { ActionFunctionArgs } from "react-router";

import { handleLogin } from "~/lib/bff-session.server";

export async function action({ request }: ActionFunctionArgs) {
  return handleLogin(request);
}

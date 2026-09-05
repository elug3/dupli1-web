import type { ActionFunctionArgs } from "react-router";

import { handleRegister } from "~/lib/bff-session.server";

export async function action({ request }: ActionFunctionArgs) {
  return handleRegister(request);
}

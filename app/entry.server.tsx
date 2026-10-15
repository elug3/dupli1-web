import { createReadableStreamFromReadable } from "@react-router/node";
import * as Sentry from "@sentry/react-router";
import { renderToPipeableStream } from "react-dom/server";
import { ServerRouter } from "react-router";

import { startNavCatalog } from "./lib/nav-catalog.server";

// Category menus need their photos before the first shopper opens one.
startNavCatalog();

// React Router's default server entry, wrapped so server render, loader and
// action errors reach Sentry (a no-op until instrument.server.mjs inits it).
export default Sentry.createSentryHandleRequest({
  ServerRouter,
  renderToPipeableStream,
  createReadableStreamFromReadable,
});

export const handleError = Sentry.createSentryHandleError({ logErrors: true });

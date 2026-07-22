# AGENTS.md

Guidance for AI agents working in `dupli1-web`.

`dupli1-web` is the **customer-facing storefront** for the Dupli1 fashion-bag marketplace: a React Router 7 (React 19 + Vite + Tailwind v4) SSR app. The browser talks only to same-origin routes; the React Router server acts as a BFF and forwards `/api/v1/*` calls to the backend nginx gateway. Standard commands (`npm run dev`, `npm run build`, `npm run start`, `npm run typecheck`) and env vars are documented in [README.md](README.md).

## Language & audience

English is supported (along with Korean and Chinese in `app/lib/i18n.tsx`), but **primary users are Korean**. Prefer Korean-first product naming and copy; keep English strings correct for the language switcher, and follow the Korean product-name rules in [README.md](README.md#content-guidelines).

**Currency is KRW only.** Display and enter all product prices in Korean Won — do not convert to USD or other currencies by language. Cart/order/payment JSON fields named `*_cents` are **whole KRW won** (zero-decimal Stripe minor units) — never divide by 100 for display.

Authenticated cart/checkout/orders/payments go through `/auth/session/gateway` (BFF attaches Bearer). Contract: [elug3/dupli1 docs/cart-service.md](https://github.com/elug3/dupli1/blob/master/docs/cart-service.md).

Stock/reservations use product-owned `/api/v1/inventory/*` (standalone `dupli1-inventory` removed). BFF maps those paths to the product upstream — do not add `DUPLI1_INVENTORY_*` env vars.

Non-auth upstream `401` → BFF force-refreshes with auth and retries once; do not treat that as logout unless auth refresh/`/me` fails (then `401`). Persistent upstream rejection after refresh → `502` `upstream_unauthorized`.

## Cursor Cloud specific instructions

- Dependencies (`npm install`) are refreshed automatically by the cloud update script; no manual install needed on a fresh VM.
- Dev server: `npm run dev` (defaults to `http://localhost:5173`). The sibling admin app (`dupli1-manage-web`) also defaults to 5173, so if you run both at once, start one on another port, e.g. `npm run dev -- --port 5174`.
- This app needs the **`dupli1` backend running** (nginx gateway at `http://localhost:8080`). See `../dupli1/AGENTS.md` for starting Docker + `docker compose up`. Without it, pages that hit the API return errors.
- Env vars the SSR/BFF reads (set before `npm run dev`):
  - `DUPLI1_API_BASE_URL=http://localhost:8080` — the gateway (use `https://localhost:443` after local TLS is wired).
  - `DUPLI1_API_CA_FILE=../dupli1/certs/server.crt` — optional; trust the Compose self-signed gateway cert when using HTTPS.
  - `DUPLI1_WEB_SERVICE_EMAIL` / `DUPLI1_WEB_SERVICE_PASSWORD` — preferred for **customer registration**. The BFF logs in as the `dupli1-web` service account (`user.create`) and refreshes short-lived access tokens. Local Compose defaults: email `dupli1-web@web.dupli1.com`, password `dupli1-web-dev-secret`.
  - `DUPLI1_WEB_SERVICE_TOKEN=<access_token>` — optional short-lived (~15 min) access-token override (skips login/refresh). Mint with: `POST /api/v1/auth/login` → take `refresh_token` → `POST /api/v1/auth/refresh` → use returned `token`. Browsing/catalog does not need either.
- Local TLS for the sibling gateway: `./scripts/dupli1-local-tls/apply.sh` (see that folder’s README; implements [elug3/dupli1#48](https://github.com/elug3/dupli1/issues/48)).

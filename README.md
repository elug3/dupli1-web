# Dupli1 Web

Dupli1 Web is a React Router application for a specialty fashion and accessories marketplace. The project is structured as a server-rendered React app with Tailwind CSS, Docker support, and production build scripts.

## Compliance Notice

This project must only be used for lawful commerce. Product listings, images, descriptions, metadata, and marketing copy must not advertise, sell, or imply the sale of counterfeit goods, unauthorized replicas, or products that infringe third-party trademarks, copyrights, trade dress, or other intellectual property rights.

Use brand names, logos, protected designs, and luxury-house references only when the business has clear authorization or when the use is legally reviewed and permitted. Marketplace content should describe authentic, licensed, original, or legally sourced products.

## Product Scope

The marketplace can support:

- Apparel categories such as tops, outerwear, pants, dresses, and seasonal collections.
- Accessory categories such as bags, wallets, jewelry, eyewear, belts, scarves, and footwear.
- Curated collections, editorial merchandising, promotions, and product-detail pages.
- Customer-facing shopping flows such as browsing, filtering, cart, checkout, account, and order-history experiences.

The marketplace should not support:

- Counterfeit, imitation, or unauthorized replica products.
- Listings that copy protected luxury-brand names, marks, logos, patterns, silhouettes, or trade dress without authorization.
- Claims that products are equivalent to, inspired by, copied from, or substitutes for protected luxury-brand designs where that claim creates infringement or consumer confusion.

## Tech Stack

- React 19
- React Router 7
- TypeScript
- Vite
- Tailwind CSS
- Docker

## Project Structure

```text
app/
  root.tsx              Root document layout and error boundary
  routes.ts            Route registration
  routes/home.tsx      Home route
  app.css              Global styles and Tailwind import
public/
  favicon.ico          Public browser icon
Dockerfile             Multi-stage production Docker build
package.json           Scripts and dependencies
react-router.config.ts React Router configuration
vite.config.ts         Vite configuration
```

## Development

Install dependencies:

```bash
npm install
```

Start the local development server:

```bash
npm run dev
```

The app runs at:

```text
http://localhost:5173
```

The browser talks only to same-origin `/api/*` routes. React Router server
routes act as a BFF and forward requests to the internal API gateway configured
with:

```bash
DUPLI1_API_BASE_URL=http://localhost:8080
```

If auth and product services are deployed at separate origins, override the
shared gateway with `DUPLI1_AUTH_API_BASE_URL` and
`DUPLI1_PRODUCT_API_BASE_URL`.

### Local HTTPS gateway (optional)

The Dupli1 Compose gateway mounts self-signed certs but historically served HTTP
only ([elug3/dupli1#48](https://github.com/elug3/dupli1/issues/48)). Wire dual-mode
HTTP+HTTPS into a sibling `../dupli1` checkout:

```bash
./scripts/dupli1-local-tls/apply.sh
cd ../dupli1 && sudo docker compose up -d --build dupli1-proxy
```

Then point this app at HTTPS and trust the local cert:

```bash
DUPLI1_API_BASE_URL=https://localhost:443
DUPLI1_API_CA_FILE=../dupli1/certs/server.crt
```

Plain `http://localhost:8080` remains the default and needs no CA file. See
[scripts/dupli1-local-tls/README.md](scripts/dupli1-local-tls/README.md).

Customer registration requires the dupli1-web service account's API key
(elug3/dupli1 `docs/auth-service-api-keys.md`) — the same value auth seeds from
`DUPLI1_WEB_SERVICE_API_KEY`. Service accounts have no password and cannot sign
in to either web app. The BFF exchanges the key for access tokens at auth's
`/api/v1/auth/token`, which the gateway serves only on its internal listener, so
point `DUPLI1_WEB_SERVICE_AUTH_URL` there (or at auth directly):

```bash
DUPLI1_WEB_SERVICE_API_KEY=dk_live_<43 chars>
DUPLI1_WEB_SERVICE_AUTH_URL=http://proxy.dupli1.local:8081   # defaults to DUPLI1_AUTH_API_BASE_URL / DUPLI1_API_BASE_URL
```

For local/dev you can set a short-lived access token instead (skips the exchange):

```bash
DUPLI1_WEB_SERVICE_TOKEN=<access_token>
```

The BFF sends the access token as `Authorization: Bearer <token>` when calling
`POST /api/v1/auth/register`. Never expose these credentials to browsers.

Product catalog reads call the Dupli1 product service
([elug3/dupli1](https://github.com/elug3/dupli1)) on the gateway paths the ALB
already routes (`/api/*` → nginx proxy). The browser uses:

- Public search: `GET /api/v1/products?category=bags` — the category comes from the page (`categoryForFacet` in `app/lib/catalog.ts`): `/category/product-type/padded-jackets` sends `category=clothing&subcategory=padded`, every other page `category=bags`
- Public product detail: `GET /api/v1/products/{id}` (active products only). Clothing parents may carry `sizeChart` (cm per size → the PDP "Size guide") and free-form `attributes` (fill, lining, care…), shown on the PDP in place of bag dimensions
- Admin product create: `POST /api/v1/products` (requires `product.create`; body needs existing catalog `brandCode` + `styleCode`)
- Admin image upload: `POST /api/v1/products/{id}/images` (multipart field `image`)

Product `imageUrls` are absolute CDN/gateway URLs from the product service
(CloudFront / `images.dupli1.com` in AWS; local Compose uses
`/product-images/...`). The storefront does not rewrite or proxy them.

Local `npm run dev` registers matching React Router BFF proxies at the same
`/api/v1/products*` paths so the client code works without an ALB.

Authenticated cart, checkout, orders, and payments call
`/auth/session/gateway/api/v1/...`. The BFF attaches the session Bearer token
and forwards to the gateway (`DUPLI1_API_BASE_URL`, or per-service overrides
such as `DUPLI1_CART_API_BASE_URL`). Cart owns persistent bag lines
([elug3/dupli1 cart-service](https://github.com/elug3/dupli1/blob/master/docs/cart-service.md)):

- `GET|DELETE /api/v1/cart`
- `POST|PUT /api/v1/cart/items` (body: `{ sku` or `sku_id`, `quantity }`)
- `DELETE /api/v1/cart/items/{sku}` or `.../items/by-sku-id/{skuId}`

Cart `unit_price_won` / `subtotal_won` are **whole KRW won** (KRW is a
zero-decimal currency — do not divide by 100). There is no guest cart yet;
unsigned callers get 401 and the UI treats the bag as empty until login.

Checkout creates a payment with an explicit `method` ([elug3/dupli1#108](https://github.com/elug3/dupli1/pull/108)).
The storefront payment step offers **credit card** (`method: "credit_card"`) via
NANO certified checkout when configured. Dupli1 never collects card PAN/CVC —
the browser stays on dupli1-web at `/checkout/pay/:paymentId`. That resource
route's BFF calls the payment-service bridge (`GET /api/v1/payments/{id}/nano/checkout`)
over the internal gateway. Do not send the shopper to that `/api/v1/...` URL:
production ALB forwards `/api/*` to `dupli1-proxy`, so it is a gateway endpoint,
not a storefront page. Staff sessions with
`payment.bypass` / `admin.*` / `*` also see **Mark as paid (bypass)**.
Use `detectUserKind()` / `canBypassPayment()` in `app/lib/auth.ts`
(`customer` | `manager` | `service` — backend `account_type` uses the same
values; `admin` is a permission tier such as `admin.*`, not an account type).

**Stock path (no standalone inventory service):** PDP stock hints and cart
`available_qty` come from product-owned `GET /api/v1/inventory/{sku}` (or
`…/by-sku-id/{skuId}`). Checkout `complete` reserves stock there; payment
only collects money; order ship commits the reservation.

Authenticated browser sessions use an opaque `HttpOnly` session cookie. Access
and refresh tokens are stored server-side by the BFF in Redis
(`DUPLI1_WEB_REDIS_URL`, key `dupli1:web:session:<id>`, 7-day TTL), so a deploy
or a second replica keeps every session. Unset, they live in process memory and
end on restart (local development only). If Redis is unreachable the BFF answers
`503` `auth_unavailable` and keeps the cookie. Rotated refresh tokens are saved
before use; access tokens are reused
for at most five minutes and refreshed with the cached refresh token pair. The
BFF includes `audience: "web"` in token requests for the backend contract, but
the current Go auth service must also support/enforce that claim and configure
its JWT expiry if the token `exp` itself must be exactly five minutes.

**Auth is the source of truth for login state.** When cart/order/payment (or
another non-auth upstream) returns `401`, the BFF force-refreshes via
`POST /api/v1/auth/refresh` and retries once. Only a failed auth refresh (or
`/auth/session/me`) clears the session and surfaces `401` to the browser —
upstream rejection after a successful refresh is returned as `502`
(`code: upstream_unauthorized`) so the UI can show an error without bouncing
to `/login`.

## Quality Checks

Run TypeScript and React Router type generation:

```bash
npm run typecheck
```

Create a production build:

```bash
npm run build
```

Start the production server after building:

```bash
npm run start
```

## Docker

Build the image:

```bash
docker build -t dupli1-web .
```

Run the container:

```bash
docker run -p 3000:3000 dupli1-web
```

The production server is then available at:

```text
http://localhost:3000
```

## Language & Audience

The storefront supports **English**, Korean, and Chinese via the in-app language switcher (`app/lib/i18n.tsx`). **Primary users are Korean.** Write and review UX copy, marketing, and product content with a Korean audience first; keep English (and Chinese) translations accurate and complete, but do not treat English as the default customer voice.

**All prices use KRW (Korean Won) only.** The UI formats every amount as KRW regardless of the selected language — there is no USD conversion.

## Customer Contact

The home and category pages carry a floating **Telegram** chat button
(`app/components/telegram-float.tsx`) that opens the consultation bot,
`@dupli1_support_bot`. The handle lives in `TELEGRAM_CONTACT_HANDLE`
(`app/lib/contact.ts`) — change it there; it is a constant, not an env var,
because the client bundle is baked at image build time. It is a *bot* handle
rather than the human `@Dupli1212` account because Telegram requires every bot
username to end in `bot`.

Which routes show the button is decided by `isTelegramFloatRoute`, and the
button is mounted from `root.tsx` so it anchors to the viewport rather than to
the transformed page-transition wrapper.

The link carries where the shopper came from as a Telegram start payload —
`?start=c_b-louis-vuitton_ko` — built by `storefrontContext` (route → context)
and `telegramStartPayload` (context → payload). Telegram caps that payload at
64 characters and accepts only `A-Za-z0-9_-`, so an over-long reference is
dropped rather than truncated: a cut-off reference points at the wrong product.
The bot stores it and shows it to staff; it is a hint, never an identity and
never a permission. Backend contract: [elug3/dupli1 docs/support-telegram-bot.md](../dupli1/docs/support-telegram-bot.md).

## Content Guidelines

**MUST USE Korean product names.** Product titles shown in the catalog, search results, cart, and checkout must use the Korean product name (for example, `루이비통 익스프레스 MM`), not English-only alternatives.

Before adding marketplace content, verify that each product has:

- Lawful sourcing and sale authorization.
- Original or licensed imagery.
- Accurate product names and descriptions in Korean.
- No misleading affiliation with third-party luxury brands.
- No unauthorized logos, monograms, protected patterns, or brand identifiers.
- Clear pricing, shipping, returns, and customer-service information.

## CI/CD

GitHub Actions runs two workflows on every change to `master`:

| Workflow | Trigger | Purpose |
| --- | --- | --- |
| [CI](.github/workflows/ci.yml) | Push and pull requests to `master` | Install dependencies, run `npm run typecheck`, run `npm run build`, and verify the Docker image builds |
| [Image](.github/workflows/images.yml) | Push to `master` | Publish the image to GHCR, then deploy it to VENUS |

### CI checks

Pull requests and pushes to `master` must pass:

```bash
npm ci
npm run typecheck
npm run build
docker build -t dupli1-web .
```

### Production deployment

Production runs on VENUS, a self-hosted machine behind a Cloudflare Tunnel
(moved off AWS ECS on 2026-09-27). Merging to `master`:

1. builds `ghcr.io/elug3/dupli1-web:sha-<short>` (also tagged `master`);
2. runs `deploy.sh web sha-<short>` from the backend repo's deploy checkout on
   the VENUS self-hosted runner. It restarts only the `web` container, checks
   `/` and `/login`, and rolls back to the previous image if they fail.

The runbook, including manual deploys and rollback, is
[elug3/dupli1 docs/deployment-venus.md](https://github.com/elug3/dupli1/blob/main/docs/deployment-venus.md)
→ "Deploying new code". The container's environment (port `3000`,
`DUPLI1_API_BASE_URL=http://proxy.dupli1.local`) lives in the backend repo's
`deploy/venus/docker-compose.yml`.

Customer registration credentials are **not** GitHub Actions secrets.
`DUPLI1_WEB_SERVICE_API_KEY` comes from `/opt/dupli1/.env` on VENUS, the same
value `dupli1-auth` seeds the machine user's key from. A different key here
would drift from auth and break signup (`invalid_api_key`).

## Deployment Notes

The application builds into:

```text
build/
  client/    Static assets
  server/    Server-rendered React Router app
```

Deploy the built output with the production dependencies from `package.json`, or use the included Dockerfile on platforms that support Node containers.

### Error and log monitoring (Sentry)

Off unless `SENTRY_DSN` is set at runtime; works with sentry.io or a self-hosted Sentry.

| Variable | Default | Meaning |
|---|---|---|
| `SENTRY_DSN` | unset (off) | The Sentry project's DSN |
| `SENTRY_ENVIRONMENT` | `development` | e.g. `production` |
| `SENTRY_RELEASE` | unset | e.g. the image tag |
| `SENTRY_TRACES_SAMPLE_RATE` | `0` | Share of requests/page loads traced, `0`–`1` |
| `SENTRY_LOGS` | on | `false` stops sending server `console.warn`/`console.error` as Sentry Logs |

The server initialises in `instrument.server.mjs` (loaded with `node --import` by `npm run start`); loader, action and render errors are reported from `app/entry.server.tsx`. The browser SDK reads the same DSN through the root loader, so one image works for any Sentry project. Request bodies, cookies and stack-frame locals are never sent (`SENTRY_DATA_COLLECTION` in `app/lib/sentry.ts`). `npm run dev` does not load the server SDK.

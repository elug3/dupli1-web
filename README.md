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

Customer registration requires a dupli1-web service account. Prefer email + password
so the BFF can mint and refresh access tokens:

```bash
DUPLI1_WEB_SERVICE_EMAIL=dupli1-web@web.dupli1.com
DUPLI1_WEB_SERVICE_PASSWORD=<service-account-password>
```

Optionally set a short-lived access token instead (skips login/refresh):

```bash
DUPLI1_WEB_SERVICE_TOKEN=<access_token>
```

The BFF sends the access token as `Authorization: Bearer <token>` when calling
`POST /api/v1/auth/register`. Never expose these credentials to browsers.

Product catalog reads call the Dupli1 product service
([elug3/dupli1](https://github.com/elug3/dupli1)) on the gateway paths the ALB
already routes (`/api/*` → nginx proxy). The browser uses:

- Public bag search: `GET /api/v1/products?category=bags`
- Public product detail: `GET /api/v1/products/{id}` (active products only)
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

Cart `unit_price_cents` / `subtotal_cents` are **whole KRW won** (KRW is a
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
and refresh tokens are cached server-side by the BFF; access tokens are reused
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
| [Deploy](.github/workflows/deploy.yml) | Push to `master` | Build and push the Docker image to Amazon ECR, then roll out a new Amazon ECS task definition |

### CI checks

Pull requests and pushes to `master` must pass:

```bash
npm ci
npm run typecheck
npm run build
docker build -t dupli1-web .
```

### Production deployment

Merging to `master` deploys to Amazon ECS in `us-east-1`:

- **ECR repository:** `web`
- **ECS cluster:** `production`
- **ECS service:** `dupli1-web`
- **Task definition:** [.aws/task-definition.json](.aws/task-definition.json)

Deployment uses GitHub OIDC to assume `arn:aws:iam::845061289093:role/github-actions-deploy-role`. That role has ECR push and ECS deploy permissions. Ensure the role's OIDC trust policy includes this repository.

The container listens on port `3000` behind the `dupli1-web-3000-tg` load balancer target group. Backend API calls are routed through `DUPLI1_API_BASE_URL=http://proxy.dupli1.local`.

Customer registration credentials are **not** GitHub Actions secrets. Production
injects `DUPLI1_WEB_SERVICE_EMAIL` / `DUPLI1_WEB_SERVICE_PASSWORD` from AWS
Secrets Manager `dupli1/production/web-service-account` (same secret
`dupli1-auth` uses to seed the machine user). The deploy workflow attaches that
secret on every release. Do not put a different password in GitHub secrets —
it will drift from auth and break signup (`login: invalid credentials`).

To re-attach Secrets Manager after a bad task revision (without rebuilding):

```bash
bash scripts/configure-web-service-ecs.sh
```

or run the **Attach web service Secrets Manager credentials** workflow. After
rotating the secret password, also force-redeploy `dupli1-auth` so it re-seeds
the DB hash (see [elug3/dupli1 infra/terraform/README.md](https://github.com/elug3/dupli1/blob/main/infra/terraform/README.md)).

## Deployment Notes

The application builds into:

```text
build/
  client/    Static assets
  server/    Server-rendered React Router app
```

Deploy the built output with the production dependencies from `package.json`, or use the included Dockerfile on platforms that support Node containers.

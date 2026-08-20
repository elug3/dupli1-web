# AI instruction: expose unavailable variant `sku_id`s in cart & checkout APIs

**Audience:** AI agent or engineer working in [`elug3/dupli1`](https://github.com/elug3/dupli1) (backend monorepo).

**Consumer:** [`elug3/dupli1-web`](https://github.com/elug3/dupli1-web) storefront checkout — PR context: unavailable-product modal on checkout ([dupli1-web#80](https://github.com/elug3/dupli1-web/pull/80)).

**Goal:** Let the storefront show customers **which bag lines cannot be purchased** (hidden, inactive, or removed variants) using **server-authoritative `sku_id` data**, instead of guessing from plain-text `"variant not found"` errors or client heuristics.

---

## Problem statement

Today, when a cart or checkout line references a variant that is no longer sellable:

1. **Cart mutations** (`POST`/`PUT /api/v1/cart/items`) return `404` with a generic body:
   ```json
   { "error": "variant not found", "code": 404 }
   ```
   No `sku_id` (or `sku`) is included.

2. **Cart read** (`GET /api/v1/cart`) keeps stale lines but **silently drops enrichment** when `resolveVariant` fails (`cart/pkg/service/service.go` → `enrichCart`). The client sees `sku` / `sku_id` + `quantity` but empty `product_id`, `unit_price_cents`, etc. There is no explicit `unavailable` flag or `missing` list.

3. **Checkout session** (`PUT /api/v1/checkout/sessions/{id}/items`, `POST .../complete`) fails with the same plain `"variant not found"` string from order pricing (`order/pkg/ports/product.go` → `ErrVariantNotFound`). No per-line breakdown.

4. The **product service already knows** which `sku_id`s are missing via batch lookup:
   ```
   GET /api/v1/products/variants?sku_ids=id1,id2,...
   → { "items": [...], "missing": ["id2"] }
   ```
   (documented in `docs/endpoints.md`, `docs/api.md`). Cart/order use this internally for enrichment but **do not expose** `missing` to storefront clients.

The storefront currently works around this by:
- Client-side checks (missing `sku`/`sku_id`, legacy `sku === product_id`)
- Falling back to listing **all** bag items when checkout returns `"variant not found"`

This is fragile and poor UX for multi-item carts.

---

## Required outcome

Add **structured, machine-readable unavailable variant identifiers** to cart and checkout responses/errors so `dupli1-web` can render a localized modal naming the exact products without extra round trips or heuristics.

Prefer **`sku_id`** (canonical ULID) as the primary key. Include human **`sku`** when known (for logging, admin, and legacy lines).

---

## Proposed API changes

Implement **Option A** (preferred). Option B is acceptable as a smaller first step.

### Option A (preferred): enrich cart + checkout session reads

#### 1. `GET /api/v1/cart` — add top-level unavailable metadata

**Response `200`** (additive; backward compatible):

```json
{
  "customer_id": "03f95d58-4840-46d4-9c92-fe48364d2e75",
  "items": [ /* unchanged enriched lines */ ],
  "unavailable_items": [
    {
      "sku_id": "01JAY6Z9K3F8QW1G7H2T5X0ABC",
      "sku": "BOT-001-BLK",
      "reason": "variant_not_found"
    }
  ],
  "subtotal_cents": 125000,
  "updated_at": "2026-07-05T12:00:00Z"
}
```

| Field | Type | Notes |
|-------|------|-------|
| `unavailable_items` | array | Omitted or `[]` when all lines are sellable |
| `unavailable_items[].sku_id` | string | Canonical ULID when stored or resolved |
| `unavailable_items[].sku` | string | Human SKU when known; may be empty |
| `unavailable_items[].reason` | string | Stable machine code — see **Reason codes** below |

**Line-level flag (optional but helpful):** add `"available": false` on entries in `items[]` that failed enrichment, so clients can join without a second array. If both exist, `unavailable_items` is authoritative.

**Pricing rule:** `subtotal_cents` must **exclude** unavailable lines (today enrichment failure already yields `unit_price_cents: 0`; make that explicit and documented).

#### 2. Checkout session `GET` + successful item mutations — same shape

Apply the same `unavailable_items` (and optional per-line `available`) to:

- `GET /api/v1/checkout/sessions/{id}`
- `PUT /api/v1/checkout/sessions/{id}/items`
- `POST /api/v1/checkout/sessions/{id}/items`

Checkout sessions are short-lived but should mirror cart semantics so the storefront can validate **before** `complete`.

#### 3. Mutation errors — structured error body

When `POST`/`PUT` cart items or checkout items fail because one or more variants are not sellable, return **`422 Unprocessable Entity`** (or keep `404` for single-item not-found if you must stay compatible) with:

```json
{
  "error": "variant not found",
  "code": 422,
  "unavailable_items": [
    { "sku_id": "01JAY6Z9K3F8QW1G7H2T5X0ABC", "sku": "BOT-001-BLK", "reason": "variant_not_found" }
  ]
}
```

- Preserve existing `error` string `"variant not found"` for backward compatibility.
- `unavailable_items` must list **every** failed line on batch `PUT` (replace all items), not only the first failure.

`POST .../complete` should return the same structured body when pricing/reservation fails due to invalid variants (distinct from empty cart, expired session, or stock exhaustion).

### Option B (minimal): document + proxy batch lookup only

If cart/checkout changes are deferred, at minimum:

1. Document that storefronts should call `GET /api/v1/products/variants?sku_ids=...` with cart `sku_id`s and treat `missing` as unavailable.
2. Ensure that route is **public** (no auth) and gateway-stable under `/api/v1/products/variants?sku_ids=`.

Option B is weaker (extra round trip, no cart/checkout context) — prefer Option A.

---

## Reason codes

Use stable snake_case strings:

| `reason` | When |
|----------|------|
| `variant_not_found` | Unknown `sku_id` / `sku`, or variant inactive/archived |
| `parent_not_active` | Variant exists but parent product is draft/archived/hidden |
| `legacy_product_id_sku` | (optional) Stored human `sku` equals parent `product_id` — not a variant row |

Start with `variant_not_found`; split later if product client already distinguishes cases.

---

## Implementation guidance (dupli1 repo)

### Cart (`cart/`)

- **Enrichment:** `cart/pkg/service/service.go` → `enrichCart` already calls `resolveVariant` per line. Collect failures into `unavailable_items` instead of silently returning empty enrichment.
- **Mutations:** `ReplaceItems` / `UpsertItem` currently abort on first `resolveVariant` error. For `PUT` replace, consider validating all lines and returning **all** failures in one response.
- **Handler:** `cart/pkg/handler/http.go` → extend `respondServiceError` / JSON cart model in `cart/pkg/domain/cart.go`.
- **Ports:** Reuse `ports.ErrVariantNotFound`; map product batch `missing` if you switch to batch lookup in enrichment.

### Order / checkout (`order/`)

- **Pricing:** find `priceItems` (checkout service) — same pattern: collect per-line variant resolution failures.
- **Handler:** `order/pkg/handler/checkout.go` — structured error JSON on item mutations and `complete`.
- **Session model:** `order/pkg/domain/checkout_session.go` — optional `UnavailableItems []UnavailableItem` on session JSON.

### Product (`product/`)

- Batch endpoint already returns `missing`. Ensure cart/order enrichment uses it consistently and propagates IDs outward (Option A).

### Gateway / docs

- Update `docs/cart-service.md`, `docs/checkout-session.md`, `docs/api.md`, `docs/endpoints.md`.
- Regenerate OpenAPI if the repo publishes it.
- No new env vars expected.

### Tests

Add table-driven tests for:

1. `GET /api/v1/cart` with one valid + one hidden variant → `unavailable_items` length 1, correct `sku_id`.
2. `PUT /api/v1/cart/items` batch with two bad lines → single `422`/`404` with **two** entries in `unavailable_items`.
3. Checkout `PUT .../items` and `complete` with stale `sku_id` → structured error.
4. Backward compatibility: clients ignoring new fields still work; `error` string unchanged.

---

## Storefront integration (dupli1-web — after backend ships)

Once released, `dupli1-web` will:

1. Read `unavailable_items` from `GET /api/v1/cart` on checkout load.
2. On checkout submit errors, parse `unavailable_items` from the JSON error body.
3. Map `sku_id` → cart line display (name, image, brand) and show the existing `ProductUnavailableDialog`.
4. Remove client-side fallback that lists **all** bag items when the API error is ambiguous.

**Contract the web client will parse:**

```ts
interface UnavailableVariant {
  sku_id?: string;
  sku?: string;
  reason: string;
}

interface CartResponse {
  items: CartLine[];
  unavailable_items?: UnavailableVariant[];
}

interface ApiErrorBody {
  error: string;
  code?: number;
  unavailable_items?: UnavailableVariant[];
}
```

---

## Acceptance criteria

- [ ] `GET /api/v1/cart` returns `unavailable_items` with `sku_id` for each line that cannot be enriched/sold.
- [ ] Cart `PUT`/`POST` item mutations return `unavailable_items` in the error JSON when any line fails variant resolution.
- [ ] Checkout session read/update returns the same metadata.
- [ ] `POST .../complete` returns `unavailable_items` when completion fails due to invalid variants.
- [ ] Batch failures return **all** bad lines, not fail-fast on the first.
- [ ] Existing `error: "variant not found"` string preserved for backward compatibility.
- [ ] Docs updated in `docs/cart-service.md` and `docs/checkout-session.md`.
- [ ] Unit/integration tests cover multi-line failure cases.

---

## Out of scope

- Guest cart / merge-on-login
- Auto-removing stale lines from the cart (storefront may prompt user to remove in bag)
- Stock exhaustion (`available_qty === 0`) — separate from variant visibility; may be a future `reason: insufficient_stock`
- Changing payment or inventory APIs

---

## References

| Resource | Location |
|----------|----------|
| Cart enrichment (silent failure today) | `cart/pkg/service/service.go` — `enrichCart`, `resolveVariant` |
| Cart error handler | `cart/pkg/handler/http.go` — `respondServiceError` |
| Order variant port | `order/pkg/ports/product.go` — `ErrVariantNotFound` |
| Batch variant lookup | `GET /api/v1/products/variants?sku_ids=` — `{ items, missing }` |
| Cart service doc | `docs/cart-service.md` |
| Checkout session doc | `docs/checkout-session.md` |
| Storefront checkout modal | `dupli1-web` `app/routes/checkout.tsx`, `app/lib/checkout.ts` |

---

## Suggested GitHub issue title

**feat(cart,order): return unavailable variant sku_ids in cart/checkout responses and errors**

Suggested labels: `enhancement`, `cart`, `order`, `api`, `storefront`

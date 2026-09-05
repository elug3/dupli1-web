import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  // Auth session BFF must live outside /api/* — production ALB forwards
  // `/api/*` and `/gateway/*` to dupli1-proxy (elug3/dupli1 ecs_frontends.tf),
  // so browser login/me under `/api/v1/auth/*` never reaches this app and never
  // sets the HttpOnly session cookie. Same pattern as dupli1-manage-web.
  route("auth/session/login", "routes/auth-session/login.ts"),
  route("auth/session/register", "routes/auth-session/register.ts"),
  route("auth/session/refresh", "routes/auth-session/refresh.ts"),
  route("auth/session/me", "routes/auth-session/me.ts"),
  route("auth/session/logout", "routes/auth-session/logout.ts"),
  route("auth/session/gateway/*", "routes/auth-session/gateway.ts"),
  route("api/products/bags", "routes/api/products/bags.ts"),
  route("api/products/search", "routes/api/products/search.ts"),
  route("api/products/upload-url", "routes/api/products/upload-url.ts"),
  route("api/products", "routes/api/products/index.ts"),
  route("api/products/:id", "routes/api/products/$id.ts"),
  route("api/categories", "routes/api/categories.ts"),
  route("api/filters", "routes/api/filters.ts"),
  route("api/coupons/redeem", "routes/api/coupons.redeem.ts"),
  // Public catalog: browser hits `/api/v1/products*` so production ALB can
  // forward to the gateway. These BFF handlers cover local `npm run dev` only.
  // Authenticated cart/checkout/orders/payments go through `/auth/session/gateway`.
  route("api/v1/products", "routes/api/v1/products/index.ts"),
  route("api/v1/products/:id/images", "routes/api/v1/products/$id.images.ts"),
  route("api/v1/products/:id", "routes/api/v1/products/$id.ts"),
  // Local-dev BFF mirrors for cart/checkout (unused in production ALB path).
  // Browser cart/checkout calls go through `/auth/session/gateway` so the BFF
  // attaches the session Bearer token (see elug3/dupli1 docs/cart-service.md).
  route("api/v1/cart", "routes/api/v1/cart/index.ts"),
  route("api/v1/cart/items", "routes/api/v1/cart/items.ts"),
  route(
    "api/v1/cart/items/by-sku-id/:skuId",
    "routes/api/v1/cart/items.by-sku-id.$skuId.ts"
  ),
  route("api/v1/cart/items/:sku", "routes/api/v1/cart/items.$sku.ts"),
  route("api/v1/checkout/sessions", "routes/api/v1/checkout/sessions.ts"),
  route("api/v1/checkout/sessions/:id", "routes/api/v1/checkout/sessions.$id.ts"),
  route(
    "api/v1/checkout/sessions/:id/items",
    "routes/api/v1/checkout/sessions.$id.items.ts"
  ),
  route(
    "api/v1/checkout/sessions/:id/items/:sku",
    "routes/api/v1/checkout/sessions.$id.items.$sku.ts"
  ),
  route(
    "api/v1/checkout/sessions/:id/coupon",
    "routes/api/v1/checkout/sessions.$id.coupon.ts"
  ),
  route(
    "api/v1/checkout/sessions/:id/complete",
    "routes/api/v1/checkout/sessions.$id.complete.ts"
  ),
  route("api/v1/payments", "routes/api/v1/payments/index.ts"),
  route("api/v1/payments/:id", "routes/api/v1/payments/$id.ts"),
  route("api/v1/orders", "routes/api/v1/orders.ts"),
  route("api/v1/orders/:id", "routes/api/v1/orders.$id.ts"),
  // Stock is owned by dupli1-product (standalone inventory service removed).
  route(
    "api/v1/inventory/by-sku-id/:skuId",
    "routes/api/v1/inventory.by-sku-id.$skuId.ts"
  ),
  route("api/v1/inventory/:sku", "routes/api/v1/inventory.$sku.ts"),
  index("routes/pages/home.tsx"),
  route("product/:id", "routes/pages/product.tsx"),
  route("cart", "routes/pages/cart.tsx"),
  route("checkout", "routes/pages/checkout.tsx"),
  route("checkout/confirmation", "routes/pages/checkout.confirmation.tsx"),
  route("history", "routes/pages/history.tsx"),
  route("profile", "routes/pages/profile.tsx"),
  route("login", "routes/pages/login.tsx"),
  route("products/new", "routes/pages/product-new.tsx"),
  route("category/:facet/:value", "routes/pages/category.tsx"),
  route("*", "routes/pages/not-found.tsx"),
] satisfies RouteConfig;

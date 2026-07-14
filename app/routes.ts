import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  route("api/v1/auth/login", "routes/api.v1.auth.login.ts"),
  route("api/v1/auth/register", "routes/api.v1.auth.register.ts"),
  route("api/v1/auth/refresh", "routes/api.v1.auth.refresh.ts"),
  route("api/v1/auth/me", "routes/api.v1.auth.me.ts"),
  route("api/v1/auth/logout", "routes/api.v1.auth.logout.ts"),
  route("api/products/bags", "routes/api.products.bags.ts"),
  route("api/products/search", "routes/api.products.search.ts"),
  route("api/products", "routes/api.products.ts"),
  route("api/products/:id/images", "routes/api.products.$id.images.ts"),
  route("api/products/:id", "routes/api.products.id.ts"),
  route("api/categories", "routes/api.categories.ts"),
  route("api/filters", "routes/api.filters.ts"),
  route("api/coupons/redeem", "routes/api.coupons.redeem.ts"),
  route("api/v1/cart", "routes/api.v1.cart.ts"),
  route("api/v1/cart/items", "routes/api.v1.cart.items.ts"),
  route("api/v1/cart/items/:sku", "routes/api.v1.cart.items.$sku.ts"),
  route("api/v1/checkout/sessions", "routes/api.v1.checkout.sessions.ts"),
  route("api/v1/checkout/sessions/:id", "routes/api.v1.checkout.sessions.$id.ts"),
  route(
    "api/v1/checkout/sessions/:id/items",
    "routes/api.v1.checkout.sessions.$id.items.ts"
  ),
  route(
    "api/v1/checkout/sessions/:id/items/:sku",
    "routes/api.v1.checkout.sessions.$id.items.$sku.ts"
  ),
  route(
    "api/v1/checkout/sessions/:id/coupon",
    "routes/api.v1.checkout.sessions.$id.coupon.ts"
  ),
  route(
    "api/v1/checkout/sessions/:id/complete",
    "routes/api.v1.checkout.sessions.$id.complete.ts"
  ),
  route("api/v1/payments", "routes/api.v1.payments.ts"),
  route("api/v1/payments/:id", "routes/api.v1.payments.$id.ts"),
  route(
    "api/v1/payments/:id/simulate-success",
    "routes/api.v1.payments.$id.simulate-success.ts"
  ),
  route("api/v1/orders", "routes/api.v1.orders.ts"),
  route("api/v1/orders/:id", "routes/api.v1.orders.$id.ts"),
  route("api/v1/inventory/:sku", "routes/api.v1.inventory.$sku.ts"),
  index("routes/home.tsx"),
  route("product/:id", "routes/product.tsx"),
  route("cart", "routes/cart.tsx"),
  route("checkout", "routes/checkout.tsx"),
  route("checkout/confirmation", "routes/checkout.confirmation.tsx"),
  route("history", "routes/history.tsx"),
  route("profile", "routes/profile.tsx"),
  route("login", "routes/login.tsx"),
  route("products/new", "routes/product-new.tsx"),
  route("category/:facet/:value?", "routes/category.tsx"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;

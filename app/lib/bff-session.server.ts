import { randomUUID } from "node:crypto";

import type { User } from "./auth";
import { getServiceAccountAccessToken, serviceAccountConfigured } from "./service-account.server";
import {
  type StoredSession,
  deleteSessionRecord,
  readSessionRecord,
  writeSessionRecord,
} from "./session-store.server";
import "./tls-ca.server";

const SESSION_COOKIE_NAME = "dupli1_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const ACCESS_TOKEN_TTL_SECONDS = 60 * 5;
const ACCESS_TOKEN_REFRESH_SKEW_MS = 15_000;
const TOKEN_AUDIENCE = "web";

type ApiService =
  | "auth"
  | "products"
  | "cart"
  | "checkout"
  | "orders"
  | "payments"
  | "profile";

interface TokenResponse {
  access_token?: unknown;
  refresh_token?: unknown;
  token?: unknown;
  expires_in?: unknown;
  user?: unknown;
  [key: string]: unknown;
}

interface AccessTokenResult {
  token: string;
  setCookie?: string;
}

function now(): number {
  return Date.now();
}

function sharedApiBaseUrl(): string | undefined {
  return process.env.DUPLI1_API_BASE_URL;
}

function authApiBaseUrl(): string {
  return (
    process.env.DUPLI1_AUTH_API_BASE_URL ??
    sharedApiBaseUrl() ??
    "http://localhost:8080"
  );
}

function productApiBaseUrl(): string {
  return (
    process.env.DUPLI1_PRODUCT_API_BASE_URL ??
    sharedApiBaseUrl() ??
    "http://localhost:8081"
  );
}

function cartApiBaseUrl(): string {
  return (
    process.env.DUPLI1_CART_API_BASE_URL ??
    sharedApiBaseUrl() ??
    "http://localhost:8080"
  );
}

// Checkout sessions and orders both live on dupli1-order.
function ordersApiBaseUrl(): string {
  return (
    process.env.DUPLI1_ORDER_API_BASE_URL ??
    sharedApiBaseUrl() ??
    "http://localhost:8080"
  );
}

function paymentsApiBaseUrl(): string {
  return (
    process.env.DUPLI1_PAYMENT_API_BASE_URL ??
    sharedApiBaseUrl() ??
    "http://localhost:8080"
  );
}

function profileApiBaseUrl(): string {
  return (
    process.env.DUPLI1_PROFILE_API_BASE_URL ??
    sharedApiBaseUrl() ??
    "http://localhost:8080"
  );
}

function apiBaseUrl(service: ApiService): string {
  switch (service) {
    case "auth":
      return authApiBaseUrl();
    case "products":
      return productApiBaseUrl();
    case "cart":
      return cartApiBaseUrl();
    case "checkout":
    case "orders":
      return ordersApiBaseUrl();
    case "payments":
      return paymentsApiBaseUrl();
    case "profile":
      return profileApiBaseUrl();
  }
}

function upstreamUrl(service: ApiService, path: string, requestUrl?: string): string {
  const target = new URL(path, apiBaseUrl(service));
  if (requestUrl) {
    target.search = new URL(requestUrl).search;
  }
  return target.toString();
}

function parseCookies(header: string | null): Map<string, string> {
  const cookies = new Map<string, string>();
  if (!header) return cookies;

  for (const part of header.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName || rawValue.length === 0) continue;
    cookies.set(rawName, decodeURIComponent(rawValue.join("=")));
  }

  return cookies;
}

function sessionCookie(sessionId: string, maxAge = SESSION_TTL_SECONDS): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];

  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function clearSessionCookie(): string {
  return sessionCookie("", 0);
}

function sessionIdFromRequest(request: Request): string | null {
  return parseCookies(request.headers.get("Cookie")).get(SESSION_COOKIE_NAME) ?? null;
}

async function readSession(
  request: Request
): Promise<{ id: string; record: StoredSession } | null> {
  const sessionId = sessionIdFromRequest(request);
  if (!sessionId) return null;

  const record = await readSessionRecord(sessionId);
  if (!record) return null;

  return { id: sessionId, record };
}

/**
 * Why a refresh handshake produced no tokens.
 *
 * `rejected` is auth's verdict on the token itself — invalid, expired, already
 * rotated, or the account is locked. The session really is over.
 *
 * `unavailable` means we never got a verdict: auth was unreachable, timed out,
 * or answered with its own failure. The refresh token is still presumed good,
 * and it is the only thing standing between the customer and a re-login, so it
 * must survive someone else's outage.
 */
type RefreshFailure = "rejected" | "unavailable";

type RefreshResult =
  | {
      ok: true;
      accessToken: string;
      refreshToken: string;
      expiresIn?: number;
    }
  | { ok: false; failure: RefreshFailure };

/**
 * Statuses that are auth's verdict on the refresh token (docs/api.md
 * `POST /api/v1/auth/refresh`): `400` malformed body, `401` invalid, expired,
 * rotated, revoked, or a deactivated/locked account.
 *
 * Every other status — including a `404` from a misrouted gateway and any
 * `5xx` — is deliberately *not* a rejection. Guessing wrong in that direction
 * signs out every customer at once, and the default has to fail safe.
 */
const REFRESH_REJECTED_STATUSES = new Set([400, 401]);

async function exchangeRefreshToken(
  refreshToken: string
): Promise<RefreshResult> {
  let upstream: Response;
  try {
    upstream = await requestTokens("/api/v1/auth/refresh", {
      refresh_token: refreshToken,
    });
  } catch {
    // Connection refused, DNS, TLS, timeout — auth never saw the request.
    return { ok: false, failure: "unavailable" };
  }

  if (!upstream.ok) {
    return {
      ok: false,
      failure: REFRESH_REJECTED_STATUSES.has(upstream.status)
        ? "rejected"
        : "unavailable",
    };
  }

  let body: TokenResponse;
  try {
    body = (await upstream.json()) as TokenResponse;
  } catch {
    // 200 with a body we cannot read (proxy error page) is not a verdict.
    return { ok: false, failure: "unavailable" };
  }

  const accessToken =
    typeof body.token === "string"
      ? body.token
      : typeof body.access_token === "string"
        ? body.access_token
        : null;

  // Auth accepted the token but sent nothing usable: a contract problem on
  // their side, not grounds for ending the customer's session.
  if (!accessToken) return { ok: false, failure: "unavailable" };

  return {
    ok: true,
    accessToken,
    refreshToken:
      typeof body.refresh_token === "string" && body.refresh_token
        ? body.refresh_token
        : refreshToken,
    expiresIn:
      typeof body.expires_in === "number" && Number.isFinite(body.expires_in)
        ? body.expires_in
        : undefined,
  };
}

/** Auth could not be consulted. Distinct from 401 so the browser keeps its
 * cookie and can retry, rather than being sent to the login form. */
function authUnavailableResponse(): Response {
  return json(
    {
      error: "Sign-in service is temporarily unavailable. Please try again.",
      error_code: "auth_unavailable",
    },
    { status: 503 }
  );
}

async function createSessionFromRefreshToken(
  refreshToken: string,
  user?: User
): Promise<{ setCookie: string } | Response> {
  const exchanged = await exchangeRefreshToken(refreshToken);
  if (!exchanged.ok) {
    return exchanged.failure === "unavailable"
      ? authUnavailableResponse()
      : json({ error: "Auth server did not issue an access token" }, { status: 502 });
  }

  return createSession({
    access_token: exchanged.accessToken,
    refresh_token: exchanged.refreshToken,
    expires_in: exchanged.expiresIn,
    user,
  });
}

function isTokenResponse(value: TokenResponse): value is {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  user?: User;
} {
  return (
    typeof value.access_token === "string" &&
    typeof value.refresh_token === "string"
  );
}

function accessTokenExpiresAt(expiresIn?: number): number {
  const seconds =
    typeof expiresIn === "number" && Number.isFinite(expiresIn)
      ? Math.min(expiresIn, ACCESS_TOKEN_TTL_SECONDS)
      : ACCESS_TOKEN_TTL_SECONDS;
  return now() + seconds * 1000;
}

async function createSession(tokens: {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  user?: User;
}): Promise<{ setCookie: string }> {
  const sessionId = randomUUID();
  await writeSessionRecord(sessionId, {
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token,
    accessTokenExpiresAt: accessTokenExpiresAt(tokens.expires_in),
    expiresAt: now() + SESSION_TTL_SECONDS * 1000,
    user: tokens.user,
  });

  return { setCookie: sessionCookie(sessionId) };
}

/**
 * Persist a record and extend its deadline.
 *
 * Records now come back from the store as copies, so callers must hand the
 * updated record here — mutating what `readSession` returned no longer reaches
 * storage.
 */
async function touchSession(
  sessionId: string,
  record: StoredSession
): Promise<string> {
  await writeSessionRecord(sessionId, {
    ...record,
    expiresAt: now() + SESSION_TTL_SECONDS * 1000,
  });
  return sessionCookie(sessionId);
}

async function forgetSession(request: Request): Promise<void> {
  const sessionId = sessionIdFromRequest(request);
  if (sessionId) await deleteSessionRecord(sessionId);
}

async function parseJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function tokenRequestBody(body: Record<string, unknown>): string {
  // The current Go backend ignores these extra fields, but keeping them in the
  // BFF request preserves the intended contract when audience/TTL support lands.
  return JSON.stringify({
    ...body,
    audience: TOKEN_AUDIENCE,
    access_token_ttl_seconds: ACCESS_TOKEN_TTL_SECONDS,
  });
}

async function requestTokens(
  path: string,
  body: Record<string, unknown>
): Promise<Response> {
  return fetch(upstreamUrl("auth", path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: tokenRequestBody(body),
  });
}

function json(
  data: unknown,
  init: ResponseInit = {},
  setCookie?: string
): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Cache-Control", "no-store");
  if (setCookie) headers.append("Set-Cookie", setCookie);
  return new Response(JSON.stringify(data), { ...init, headers });
}

async function sanitizedAuthResponse(
  upstream: Response,
  setCookie?: string
): Promise<Response> {
  const contentType = upstream.headers.get("Content-Type") ?? "";
  let payload: unknown = { ok: upstream.ok };

  if (contentType.includes("application/json")) {
    try {
      const body = (await upstream.json()) as TokenResponse;
      const { access_token, refresh_token, ...safeBody } = body;
      void access_token;
      void refresh_token;
      payload = Object.keys(safeBody).length ? safeBody : { ok: upstream.ok };
    } catch {
      payload = { ok: upstream.ok };
    }
  } else if (!upstream.ok) {
    // A non-JSON error body is an infrastructure page, not a message: the ALB
    // serves HTML for 502/503/504 when nginx is unreachable, and passing that
    // through put a whole HTML document in the browser's error box. Nothing in
    // it is worth showing, so only the status survives.
    payload = {
      error: `Upstream request failed: ${upstream.status}`,
      error_code: "upstream_unavailable",
    };
  }

  return json(payload, { status: upstream.status }, setCookie);
}

// Per WHATWG Fetch spec, these statuses must have a null body.
// Node.js (undici) throws if you pass any body — even an empty ArrayBuffer.
const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

async function proxyResponse(
  upstream: Response,
  options: { noStore?: boolean; setCookie?: string } = {}
): Promise<Response> {
  const headers = new Headers();
  const contentType = upstream.headers.get("Content-Type");
  if (contentType) headers.set("Content-Type", contentType);
  if (options.noStore) headers.set("Cache-Control", "no-store");
  if (options.setCookie) headers.append("Set-Cookie", options.setCookie);

  const body = NULL_BODY_STATUSES.has(upstream.status)
    ? null
    : await upstream.arrayBuffer();

  return new Response(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

export async function handleLogin(request: Request): Promise<Response> {
  const body = await parseJsonBody(request);
  const upstream = await requestTokens("/api/v1/auth/login", body);

  if (!upstream.ok) {
    return sanitizedAuthResponse(upstream);
  }

  const tokens = (await upstream.json()) as TokenResponse;
  if (isTokenResponse(tokens)) {
    const { setCookie } = await createSession(tokens);
    return json({ ok: true, user: tokens.user ?? null }, { status: 200 }, setCookie);
  }

  if (typeof tokens.refresh_token !== "string" || !tokens.refresh_token) {
    return json({ error: "Auth server did not return a refresh token" }, { status: 502 });
  }

  const sessionResult = await createSessionFromRefreshToken(
    tokens.refresh_token,
    (tokens.user as User | undefined) ?? undefined
  );
  if (sessionResult instanceof Response) return sessionResult;

  return json({ ok: true, user: tokens.user ?? null }, { status: 200 }, sessionResult.setCookie);
}

export async function handleRegister(request: Request): Promise<Response> {
  if (!serviceAccountConfigured()) {
    return json(
      {
        error:
          "Registration is unavailable: configure DUPLI1_WEB_SERVICE_TOKEN or DUPLI1_WEB_SERVICE_EMAIL + DUPLI1_WEB_SERVICE_PASSWORD",
      },
      { status: 503 }
    );
  }

  const body = await parseJsonBody(request);
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return json({ error: "email and password are required" }, { status: 400 });
  }

  let serviceToken: string;
  try {
    serviceToken = await getServiceAccountAccessToken();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Service account authentication failed";
    return json({ error: message }, { status: 503 });
  }

  const registerResponse = await fetch(upstreamUrl("auth", "/api/v1/auth/register"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceToken}`,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!registerResponse.ok) {
    return sanitizedAuthResponse(registerResponse);
  }

  const loginResponse = await requestTokens("/api/v1/auth/login", { email, password });
  if (!loginResponse.ok) {
    return sanitizedAuthResponse(loginResponse);
  }

  const loginBody = (await loginResponse.json()) as TokenResponse;
  if (isTokenResponse(loginBody)) {
    const { setCookie } = await createSession(loginBody);
    return json({ ok: true, user: loginBody.user ?? null }, { status: 200 }, setCookie);
  }

  if (typeof loginBody.refresh_token !== "string" || !loginBody.refresh_token) {
    return json({ error: "Auth server did not return a refresh token" }, { status: 502 });
  }

  const sessionResult = await createSessionFromRefreshToken(loginBody.refresh_token);
  if (sessionResult instanceof Response) return sessionResult;

  return json({ ok: true }, { status: 200 }, sessionResult.setCookie);
}

/** Apply a successful exchange to a record and persist it. */
async function storeExchange(
  sessionId: string,
  record: StoredSession,
  exchanged: { accessToken: string; refreshToken: string; expiresIn?: number }
): Promise<AccessTokenResult> {
  const updated: StoredSession = {
    ...record,
    accessToken: exchanged.accessToken,
    refreshToken: exchanged.refreshToken,
    accessTokenExpiresAt: accessTokenExpiresAt(exchanged.expiresIn),
  };
  return {
    token: updated.accessToken,
    setCookie: await touchSession(sessionId, updated),
  };
}

/**
 * One in-flight refresh per session.
 *
 * Refresh rotates on use, so two concurrent exchanges spend the same token and
 * auth rejects the loser. Joiners share the winner's result instead of racing.
 */
const refreshesInFlight = new Map<
  string,
  Promise<AccessTokenResult | Response>
>();

async function refreshSessionTokens(
  sessionId: string,
  record: StoredSession
): Promise<AccessTokenResult | Response> {
  const joined = refreshesInFlight.get(sessionId);
  if (joined) return joined;

  const attempt = (async (): Promise<AccessTokenResult | Response> => {
    const exchanged = await exchangeRefreshToken(record.refreshToken);
    if (exchanged.ok) {
      return storeExchange(sessionId, record, exchanged);
    }

    if (exchanged.failure === "unavailable") {
      // Keep the record and the cookie. Auth never ruled on this token, so
      // dropping it would turn a blip on their side into a real sign-out —
      // the refresh token is unrecoverable once we forget it.
      //
      // Refresh rotates on use, so a request auth processed but never
      // delivered leaves us holding a spent token. The next attempt then gets
      // a real 401 and ends the session below, which is the correct outcome
      // reached one retry later instead of guessed at now.
      return authUnavailableResponse();
    }

    // Auth's verdict is "rejected" — but with a shared store that is not proof
    // the session is over. Another task may have rotated the token between our
    // read and our call, which invalidates ours while the session stays
    // healthy. In-process coalescing cannot see that, so consult the store
    // before signing anybody out.
    const current = await readSessionRecord(sessionId);
    if (current && current.refreshToken !== record.refreshToken) {
      if (current.accessTokenExpiresAt - ACCESS_TOKEN_REFRESH_SKEW_MS > now()) {
        return { token: current.accessToken };
      }
      const retried = await exchangeRefreshToken(current.refreshToken);
      if (retried.ok) {
        return storeExchange(sessionId, current, retried);
      }
      if (retried.failure === "unavailable") {
        return authUnavailableResponse();
      }
    }

    await deleteSessionRecord(sessionId);
    return json(
      { error: "Session expired. Please sign in again." },
      { status: 401 },
      clearSessionCookie()
    );
  })();

  refreshesInFlight.set(sessionId, attempt);
  try {
    return await attempt;
  } finally {
    refreshesInFlight.delete(sessionId);
  }
}

export async function getAccessToken(
  request: Request,
  options: { forceRefresh?: boolean } = {}
): Promise<AccessTokenResult | Response> {
  const session = await readSession(request);
  if (!session) {
    return json(
      { error: "Not authenticated" },
      { status: 401 },
      clearSessionCookie()
    );
  }

  const shouldRefresh =
    options.forceRefresh ||
    session.record.accessTokenExpiresAt - ACCESS_TOKEN_REFRESH_SKEW_MS <= now();

  if (!shouldRefresh) {
    return { token: session.record.accessToken };
  }

  return refreshSessionTokens(session.id, session.record);
}

export async function handleRefresh(request: Request): Promise<Response> {
  const result = await getAccessToken(request, { forceRefresh: true });
  if (result instanceof Response) return result;
  return json({ ok: true }, { status: 200 }, result.setCookie);
}

async function fetchAuthMe(
  token: string,
  setCookie?: string
): Promise<Response> {
  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl("auth", "/api/v1/auth/me"), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    // Unreachable auth must not throw out of the route: a 500 with an HTML
    // body tells the browser nothing, and the session is still intact.
    return authUnavailableResponse();
  }
  return proxyResponse(upstream, { noStore: true, setCookie });
}

export async function handleMe(request: Request): Promise<Response> {
  const result = await getAccessToken(request);
  if (result instanceof Response) return result;

  let me = await fetchAuthMe(result.token, result.setCookie);

  // Auth is source of truth: if /me rejects a cached access token, force a
  // refresh handshake once before treating the browser session as dead.
  if (me.status === 401) {
    const refreshed = await getAccessToken(request, { forceRefresh: true });
    if (refreshed instanceof Response) return refreshed;

    me = await fetchAuthMe(refreshed.token, refreshed.setCookie);
    if (me.status === 401) {
      await forgetSession(request);
      return json(
        { error: "Not authenticated" },
        { status: 401 },
        clearSessionCookie()
      );
    }
  }

  return me;
}

export async function handleLogout(request: Request): Promise<Response> {
  const session = await readSession(request);

  if (session) {
    await fetch(upstreamUrl("auth", "/api/v1/auth/logout"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refresh_token: session.record.refreshToken,
        audience: TOKEN_AUDIENCE,
      }),
    }).catch(() => {});
    await deleteSessionRecord(session.id);
  }

  return json({ ok: true }, { status: 200 }, clearSessionCookie());
}

export async function proxyBackendApi(
  service: ApiService,
  request: Request,
  path: string,
  options: { requireAuth?: boolean; noStore?: boolean } = {}
): Promise<Response> {
  const headers = new Headers();
  headers.set("Accept", request.headers.get("Accept") ?? "application/json");

  const contentType = request.headers.get("Content-Type");
  if (contentType) headers.set("Content-Type", contentType);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  // Buffer once so a post-refresh retry can resend the same payload.
  const body = hasBody ? await request.arrayBuffer() : undefined;
  const target = upstreamUrl(service, path, request.url);
  const noStore = options.noStore ?? options.requireAuth;

  let setCookie: string | undefined;
  if (options.requireAuth) {
    const result = await getAccessToken(request);
    if (result instanceof Response) return result;
    headers.set("Authorization", `Bearer ${result.token}`);
    setCookie = result.setCookie;
  }

  let upstream = await fetch(target, {
    method: request.method,
    headers,
    body,
  });

  // Non-auth services are not the source of truth for login state. If one
  // returns 401, force a refresh_token handshake with auth and retry once.
  // Only auth refresh failure clears the session / surfaces 401 to the browser.
  if (options.requireAuth && upstream.status === 401 && service !== "auth") {
    const refreshed = await getAccessToken(request, { forceRefresh: true });
    if (refreshed instanceof Response) return refreshed;

    headers.set("Authorization", `Bearer ${refreshed.token}`);
    setCookie = refreshed.setCookie ?? setCookie;

    upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
    });

    if (upstream.status === 401) {
      // Session is still valid per auth; the upstream rejected the token
      // (misconfig, outage, etc.). Do not log the user out.
      return json(
        {
          error: `${service} rejected a valid session token`,
          error_code: "upstream_unauthorized",
          service,
        },
        { status: 502 },
        setCookie
      );
    }
  }

  return proxyResponse(upstream, { noStore, setCookie });
}

/**
 * Map a gateway-relative API path to the upstream service.
 * Used by `/auth/session/gateway/*` so authenticated browser calls stay outside
 * the ALB `/api/*` rule that forwards to dupli1-proxy (see elug3/dupli1).
 */
function serviceForApiPath(path: string): ApiService | null {
  if (
    path.startsWith("/api/v1/profile") ||
    path.startsWith("/api/v1/auth/me/profile") ||
    path.startsWith("/api/v1/auth/me/addresses")
  ) {
    return "profile";
  }
  if (path.startsWith("/api/v1/auth")) return "auth";
  if (
    path.startsWith("/api/v1/products") ||
    path.startsWith("/api/v1/coupons") ||
    path.startsWith("/api/v1/catalog") ||
    path.startsWith("/api/v1/variants") ||
    // Stock/reservations live on dupli1-product (standalone inventory service removed).
    path.startsWith("/api/v1/inventory")
  ) {
    return "products";
  }
  if (path.startsWith("/api/v1/cart")) return "cart";
  if (path.startsWith("/api/v1/checkout") || path.startsWith("/api/v1/orders")) {
    return "orders";
  }
  if (path.startsWith("/api/v1/payments")) return "payments";
  return null;
}

/**
 * Cookie-authenticated proxy for browser calls that must attach a Bearer token.
 * Path shape: `/auth/session/gateway/api/v1/...` → upstream `/api/v1/...`.
 */
export async function handleSessionGatewayProxy(
  request: Request
): Promise<Response> {
  const url = new URL(request.url);
  const gatewayPath = url.pathname.replace(/^\/auth\/session\/gateway/, "");
  if (!gatewayPath.startsWith("/api/")) {
    return json({ error: "Not found" }, { status: 404 });
  }

  const service = serviceForApiPath(gatewayPath);
  if (!service) {
    return json({ error: "Not found" }, { status: 404 });
  }

  return proxyBackendApi(service, request, gatewayPath, {
    requireAuth: true,
    noStore: true,
  });
}

export async function proxyProductApi(
  request: Request,
  path: string,
  options: { requireAuth?: boolean; noStore?: boolean } = {}
): Promise<Response> {
  return proxyBackendApi("products", request, path, options);
}

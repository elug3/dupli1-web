import { randomUUID } from "node:crypto";

import type { User } from "./auth";
import { getServiceAccountAccessToken, serviceAccountConfigured } from "./service-account.server";
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
  | "orders"
  | "payments";

interface TokenResponse {
  access_token?: unknown;
  refresh_token?: unknown;
  token?: unknown;
  expires_in?: unknown;
  user?: unknown;
  [key: string]: unknown;
}

interface SessionRecord {
  refreshToken: string;
  accessToken: string;
  accessTokenExpiresAt: number;
  expiresAt: number;
  user?: User;
}

interface AccessTokenResult {
  token: string;
  setCookie?: string;
}

declare global {
  // Keep the cache stable across Vite server reloads during local development.
  // Production deployments should replace this with shared server-side storage.
  var __dupli1BffSessions: Map<string, SessionRecord> | undefined;
}

const sessions = (globalThis.__dupli1BffSessions ??= new Map());

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

function apiBaseUrl(service: ApiService): string {
  switch (service) {
    case "auth":
      return authApiBaseUrl();
    case "products":
      return productApiBaseUrl();
    case "cart":
      return cartApiBaseUrl();
    case "orders":
      return ordersApiBaseUrl();
    case "payments":
      return paymentsApiBaseUrl();
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

function readSession(request: Request): { id: string; record: SessionRecord } | null {
  const sessionId = sessionIdFromRequest(request);
  if (!sessionId) return null;

  const record = sessions.get(sessionId);
  if (!record) return null;

  if (record.expiresAt <= now()) {
    sessions.delete(sessionId);
    return null;
  }

  return { id: sessionId, record };
}

async function exchangeRefreshToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
} | null> {
  const upstream = await requestTokens("/api/v1/auth/refresh", {
    refresh_token: refreshToken,
  });

  if (!upstream.ok) return null;

  const body = (await upstream.json()) as TokenResponse;
  const accessToken =
    typeof body.token === "string"
      ? body.token
      : typeof body.access_token === "string"
        ? body.access_token
        : null;

  if (!accessToken) return null;

  return {
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

async function createSessionFromRefreshToken(
  refreshToken: string,
  user?: User
): Promise<{ setCookie: string } | Response> {
  const exchanged = await exchangeRefreshToken(refreshToken);
  if (!exchanged) {
    return json({ error: "Auth server did not issue an access token" }, { status: 502 });
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

function createSession(tokens: {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  user?: User;
}): { setCookie: string } {
  const sessionId = randomUUID();
  sessions.set(sessionId, {
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token,
    accessTokenExpiresAt: accessTokenExpiresAt(tokens.expires_in),
    expiresAt: now() + SESSION_TTL_SECONDS * 1000,
    user: tokens.user,
  });

  return { setCookie: sessionCookie(sessionId) };
}

function touchSession(sessionId: string, record: SessionRecord): string {
  record.expiresAt = now() + SESSION_TTL_SECONDS * 1000;
  sessions.set(sessionId, record);
  return sessionCookie(sessionId);
}

function forgetSession(request: Request): void {
  const sessionId = sessionIdFromRequest(request);
  if (sessionId) sessions.delete(sessionId);
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
    payload = { error: await upstream.text() };
  }

  return json(payload, { status: upstream.status }, setCookie);
}

async function proxyResponse(
  upstream: Response,
  options: { noStore?: boolean; setCookie?: string } = {}
): Promise<Response> {
  const headers = new Headers();
  const contentType = upstream.headers.get("Content-Type");
  if (contentType) headers.set("Content-Type", contentType);
  if (options.noStore) headers.set("Cache-Control", "no-store");
  if (options.setCookie) headers.append("Set-Cookie", options.setCookie);

  return new Response(await upstream.arrayBuffer(), {
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
    const { setCookie } = createSession(tokens);
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
    const { setCookie } = createSession(loginBody);
    return json({ ok: true, user: loginBody.user ?? null }, { status: 200 }, setCookie);
  }

  if (typeof loginBody.refresh_token !== "string" || !loginBody.refresh_token) {
    return json({ error: "Auth server did not return a refresh token" }, { status: 502 });
  }

  const sessionResult = await createSessionFromRefreshToken(loginBody.refresh_token);
  if (sessionResult instanceof Response) return sessionResult;

  return json({ ok: true }, { status: 200 }, sessionResult.setCookie);
}

export async function getAccessToken(
  request: Request,
  options: { forceRefresh?: boolean } = {}
): Promise<AccessTokenResult | Response> {
  const session = readSession(request);
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

  const exchanged = await exchangeRefreshToken(session.record.refreshToken);

  if (!exchanged) {
    sessions.delete(session.id);
    return json(
      { error: "Session expired. Please sign in again." },
      { status: 401 },
      clearSessionCookie()
    );
  }

  session.record.accessToken = exchanged.accessToken;
  session.record.refreshToken = exchanged.refreshToken;
  session.record.accessTokenExpiresAt = accessTokenExpiresAt(exchanged.expiresIn);

  return {
    token: session.record.accessToken,
    setCookie: touchSession(session.id, session.record),
  };
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
  const upstream = await fetch(upstreamUrl("auth", "/api/v1/auth/me"), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
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
      forgetSession(request);
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
  const session = readSession(request);

  if (session) {
    await fetch(upstreamUrl("auth", "/api/v1/auth/logout"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refresh_token: session.record.refreshToken,
        audience: TOKEN_AUDIENCE,
      }),
    }).catch(() => {});
    sessions.delete(session.id);
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
          code: "upstream_unauthorized",
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
  if (path.startsWith("/api/v1/auth")) return "auth";
  if (path.startsWith("/api/v1/products")) return "products";
  if (path.startsWith("/api/v1/cart")) return "cart";
  if (path.startsWith("/api/v1/orders")) return "orders";
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

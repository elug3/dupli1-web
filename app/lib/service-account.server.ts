const ACCESS_TOKEN_TTL_SECONDS = 60 * 5;
const ACCESS_TOKEN_REFRESH_SKEW_MS = 15_000;

interface ServiceAccountState {
  accessToken: string;
  accessTokenExpiresAt: number;
}

interface AuthTokenResponse {
  token?: string;
  expires_in?: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __dupli1WebServiceAccount: ServiceAccountState | undefined;
}

function getState(): ServiceAccountState | undefined {
  return globalThis.__dupli1WebServiceAccount;
}

function setState(next: ServiceAccountState | undefined): void {
  globalThis.__dupli1WebServiceAccount = next;
}

function now(): number {
  return Date.now();
}

function authApiBaseUrl(): string {
  return (
    process.env.DUPLI1_AUTH_API_BASE_URL ??
    process.env.DUPLI1_API_BASE_URL ??
    "http://localhost:8080"
  );
}

/**
 * Where the API key exchange goes. auth's `/api/v1/auth/token` is served only
 * on the gateway's internal listener (elug3/dupli1 api/gateway/routes.conf),
 * so in production this must point there — e.g. `http://proxy.dupli1.local:8081`
 * — or at auth directly, not at the public gateway `DUPLI1_API_BASE_URL`
 * names. Separate from `DUPLI1_AUTH_API_BASE_URL` so shopper logins keep
 * their route.
 */
function tokenExchangeUrl(): string {
  const base = process.env.DUPLI1_WEB_SERVICE_AUTH_URL?.trim() || authApiBaseUrl();
  return new URL("/api/v1/auth/token", base).toString();
}

function accessTokenExpiresAt(expiresIn?: number): number {
  const seconds =
    typeof expiresIn === "number" && Number.isFinite(expiresIn)
      ? Math.min(expiresIn, ACCESS_TOKEN_TTL_SECONDS)
      : ACCESS_TOKEN_TTL_SECONDS;
  return now() + seconds * 1000;
}

function staticServiceToken(): string | undefined {
  const token = process.env.DUPLI1_WEB_SERVICE_TOKEN?.trim();
  return token || undefined;
}

/**
 * The dupli1-web service account's API key (elug3/dupli1
 * docs/auth-service-api-keys.md). Service accounts have no password, so this
 * is its only credential.
 */
function serviceAPIKey(): string | undefined {
  const key = process.env.DUPLI1_WEB_SERVICE_API_KEY?.trim();
  return key || undefined;
}

export function serviceAccountConfigured(): boolean {
  return Boolean(staticServiceToken() || serviceAPIKey());
}

/**
 * Trades the API key for an access token. No refresh token comes back: the
 * key is the long-lived credential, so when the token nears expiry we simply
 * exchange again. Errors never include the key.
 */
async function exchangeAPIKey(apiKey: string): Promise<ServiceAccountState> {
  const response = await fetch(tokenExchangeUrl(), {
    method: "POST",
    headers: { Authorization: `ApiKey ${apiKey}` },
  });
  if (!response.ok) {
    const hint =
      response.status === 404
        ? " — the exchange is internal-only; point DUPLI1_WEB_SERVICE_AUTH_URL at the gateway's internal listener or at auth"
        : "";
    throw new Error(
      `Service account API key exchange failed (${response.status}): ${await response.text()}${hint}`
    );
  }
  const body = (await response.json()) as AuthTokenResponse;
  const accessToken = typeof body.token === "string" ? body.token : "";
  if (!accessToken) {
    throw new Error("Service account API key exchange did not return a token");
  }
  return { accessToken, accessTokenExpiresAt: accessTokenExpiresAt(body.expires_in) };
}

/**
 * Returns a bearer access token for server-side customer registration.
 *
 * Preference order:
 * 1. Static `DUPLI1_WEB_SERVICE_TOKEN` (short-lived; fine for local/dev)
 * 2. `DUPLI1_WEB_SERVICE_API_KEY`, exchanged at auth and cached until near expiry
 */
export async function getServiceAccountAccessToken(): Promise<string> {
  const staticToken = staticServiceToken();
  if (staticToken) {
    return staticToken;
  }

  const cached = getState();
  if (cached && cached.accessTokenExpiresAt - ACCESS_TOKEN_REFRESH_SKEW_MS > now()) {
    return cached.accessToken;
  }

  const apiKey = serviceAPIKey();
  if (!apiKey) {
    throw new Error(
      "DUPLI1_WEB_SERVICE_API_KEY is required (or DUPLI1_WEB_SERVICE_TOKEN for local/dev)"
    );
  }
  const exchanged = await exchangeAPIKey(apiKey);
  setState(exchanged);
  return exchanged.accessToken;
}

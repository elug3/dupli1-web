const ACCESS_TOKEN_TTL_SECONDS = 60 * 5;
const ACCESS_TOKEN_REFRESH_SKEW_MS = 15_000;

interface ServiceAccountState {
  /** Empty when the token came from an API key: there is nothing to refresh. */
  refreshToken: string;
  accessToken: string;
  accessTokenExpiresAt: number;
}

interface AuthLoginResponse {
  refresh_token?: string;
}

interface AuthRefreshResponse {
  token?: string;
  access_token?: string;
  refresh_token?: string;
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

function authUrl(path: string): string {
  return new URL(path, authApiBaseUrl()).toString();
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

/** Service-account API key (elug3/dupli1 docs/auth-service-api-keys.md). */
function serviceAPIKey(): string | undefined {
  const key = process.env.DUPLI1_WEB_SERVICE_API_KEY?.trim();
  return key || undefined;
}

function serviceAccountCredentials(): { email: string; password: string } | undefined {
  const email = process.env.DUPLI1_WEB_SERVICE_EMAIL?.trim();
  const password = process.env.DUPLI1_WEB_SERVICE_PASSWORD;
  if (!email || !password) return undefined;
  return { email, password };
}

export function serviceAccountConfigured(): boolean {
  return Boolean(staticServiceToken() || serviceAPIKey() || serviceAccountCredentials());
}

export function requireServiceAccountConfig(): {
  email: string;
  password: string;
} {
  const credentials = serviceAccountCredentials();
  if (!credentials) {
    throw new Error(
      "DUPLI1_WEB_SERVICE_API_KEY (or DUPLI1_WEB_SERVICE_EMAIL and DUPLI1_WEB_SERVICE_PASSWORD, or DUPLI1_WEB_SERVICE_TOKEN) is required"
    );
  }
  return credentials;
}

/**
 * Trades the API key for an access token. No refresh token comes back: the
 * key is the long-lived credential, so when the token nears expiry we simply
 * exchange again. Errors never include the key.
 */
async function exchangeAPIKey(apiKey: string): Promise<{ accessToken: string; expiresAt: number }> {
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
  const body = (await response.json()) as AuthRefreshResponse;
  const accessToken = typeof body.token === "string" ? body.token : "";
  if (!accessToken) {
    throw new Error("Service account API key exchange did not return a token");
  }
  return { accessToken, expiresAt: accessTokenExpiresAt(body.expires_in) };
}

async function loginForRefreshToken(
  email: string,
  password: string
): Promise<string> {
  const response = await fetch(authUrl("/api/v1/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // A machine login, not a web session: auth allows it for service accounts only.
    body: JSON.stringify({ email, password, client: "service" }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `Service account login failed (${response.status}): ${message}`
    );
  }

  const body = (await response.json()) as AuthLoginResponse;
  if (typeof body.refresh_token !== "string" || !body.refresh_token) {
    throw new Error("Service account login did not return a refresh token");
  }

  return body.refresh_token;
}

async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}> {
  const response = await fetch(authUrl("/api/v1/auth/refresh"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `Service account refresh failed (${response.status}): ${message}`
    );
  }

  const body = (await response.json()) as AuthRefreshResponse;
  const accessToken =
    typeof body.token === "string"
      ? body.token
      : typeof body.access_token === "string"
        ? body.access_token
        : "";

  if (!accessToken) {
    throw new Error("Service account refresh did not return an access token");
  }

  const nextRefreshToken =
    typeof body.refresh_token === "string" && body.refresh_token
      ? body.refresh_token
      : refreshToken;

  return {
    accessToken,
    refreshToken: nextRefreshToken,
    expiresAt: accessTokenExpiresAt(body.expires_in),
  };
}

/**
 * Returns a bearer access token for server-side customer registration.
 *
 * Preference order:
 * 1. Static `DUPLI1_WEB_SERVICE_TOKEN` (short-lived; fine for local/dev)
 * 2. API key exchange via `DUPLI1_WEB_SERVICE_API_KEY`
 * 3. Login + refresh via `DUPLI1_WEB_SERVICE_EMAIL` / `DUPLI1_WEB_SERVICE_PASSWORD`
 *    (being retired in favour of the API key)
 */
export async function getServiceAccountAccessToken(): Promise<string> {
  const staticToken = staticServiceToken();
  if (staticToken) {
    return staticToken;
  }

  const cached = getState();
  if (
    cached &&
    cached.accessTokenExpiresAt - ACCESS_TOKEN_REFRESH_SKEW_MS > now()
  ) {
    return cached.accessToken;
  }

  const apiKey = serviceAPIKey();
  if (apiKey) {
    const exchanged = await exchangeAPIKey(apiKey);
    setState({
      refreshToken: "",
      accessToken: exchanged.accessToken,
      accessTokenExpiresAt: exchanged.expiresAt,
    });
    return exchanged.accessToken;
  }

  const { email, password } = requireServiceAccountConfig();

  if (cached?.refreshToken) {
    try {
      const refreshed = await refreshAccessToken(cached.refreshToken);
      setState({
        refreshToken: refreshed.refreshToken,
        accessToken: refreshed.accessToken,
        accessTokenExpiresAt: refreshed.expiresAt,
      });
      return refreshed.accessToken;
    } catch {
      setState(undefined);
    }
  }

  const refreshToken = await loginForRefreshToken(email, password);
  const refreshed = await refreshAccessToken(refreshToken);
  setState({
    refreshToken: refreshed.refreshToken,
    accessToken: refreshed.accessToken,
    accessTokenExpiresAt: refreshed.expiresAt,
  });

  return refreshed.accessToken;
}

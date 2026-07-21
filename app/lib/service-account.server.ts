const ACCESS_TOKEN_TTL_SECONDS = 60 * 5;
const ACCESS_TOKEN_REFRESH_SKEW_MS = 15_000;

interface ServiceAccountState {
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

function serviceAccountCredentials(): { email: string; password: string } | undefined {
  const email = process.env.DUPLI1_WEB_SERVICE_EMAIL?.trim();
  const password = process.env.DUPLI1_WEB_SERVICE_PASSWORD;
  if (!email || !password) return undefined;
  return { email, password };
}

export function serviceAccountConfigured(): boolean {
  return Boolean(staticServiceToken() || serviceAccountCredentials());
}

export function requireServiceAccountConfig(): {
  email: string;
  password: string;
} {
  const credentials = serviceAccountCredentials();
  if (!credentials) {
    throw new Error(
      "DUPLI1_WEB_SERVICE_EMAIL and DUPLI1_WEB_SERVICE_PASSWORD are required (or set DUPLI1_WEB_SERVICE_TOKEN)"
    );
  }
  return credentials;
}

async function loginForRefreshToken(
  email: string,
  password: string
): Promise<string> {
  const response = await fetch(authUrl("/api/v1/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
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
 * 2. Login + refresh via `DUPLI1_WEB_SERVICE_EMAIL` / `DUPLI1_WEB_SERVICE_PASSWORD`
 */
export async function getServiceAccountAccessToken(): Promise<string> {
  const staticToken = staticServiceToken();
  if (staticToken) {
    return staticToken;
  }

  const { email, password } = requireServiceAccountConfig();

  const cached = getState();
  if (
    cached &&
    cached.accessTokenExpiresAt - ACCESS_TOKEN_REFRESH_SKEW_MS > now()
  ) {
    return cached.accessToken;
  }

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

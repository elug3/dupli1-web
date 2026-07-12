export type AccountType = "customer" | "admin" | "service";

export interface User {
  user_id: string;
  email: string;
  account_type: AccountType;
  permissions: string[];
  is_active: boolean;
  locked_at: string | null;
  failed_login_attempts: number;
}

/** Mirrors shared/pkg/permissions eval.go: exact match, resource wildcard
 * (e.g. "product.*"), "admin.*" (user.* domain only), then "*". */
export function hasPermission(
  user: User | null | undefined,
  required: string
): boolean {
  const held = user?.permissions ?? [];
  if (held.includes(required)) return true;
  if (
    held.some((h) => {
      if (!h.endsWith(".*")) return false;
      const prefix = h.slice(0, -2);
      return prefix !== "" && (required === prefix || required.startsWith(`${prefix}.`));
    })
  ) {
    return true;
  }
  if (held.includes("admin.*") && required.startsWith("user.")) return true;
  return held.includes("*");
}

function post(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
}

export async function getMe(): Promise<User | null> {
  const res = await fetch("/api/v1/auth/me", {
    credentials: "same-origin",
  });

  if (res.status === 401) return null;
  if (!res.ok) return null;
  return res.json() as Promise<User>;
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    return (body as { error?: string }).error ?? fallback;
  } catch {
    return fallback;
  }
}

export async function login(email: string, password: string): Promise<void> {
  const res = await post("/api/v1/auth/login", { email, password });
  if (!res.ok) throw new Error(await errorMessage(res, "Login failed"));
}

export async function register(
  email: string,
  password: string
): Promise<void> {
  const res = await post("/api/v1/auth/register", { email, password });
  if (!res.ok) throw new Error(await errorMessage(res, "Registration failed"));
}

export async function authedFetch(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers as HeadersInit);

  const res = await fetch(url, {
    ...init,
    credentials: "same-origin",
    headers,
  });

  if (res.status === 401) {
    throw new Error("Session expired. Please sign in again.");
  }

  return res;
}

export async function logout(): Promise<void> {
  await post("/api/v1/auth/logout", {}).catch(() => {});
}

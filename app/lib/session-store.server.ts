/**
 * Storefront session storage.
 *
 * The BFF keeps the customer's refresh token and a short-lived access token
 * server side; the `dupli1_session` cookie carries only an id.
 *
 * Backed by Redis when `REDIS_URL` is set, so every SSR task resolves the same
 * session; otherwise a per-process `Map`, which keeps `npm run dev` and the
 * tests working with no infrastructure. **The Map is only correct for a single
 * task**: the ALB target group has no session affinity, so a request landing on
 * another task finds no session, clears the cookie, and signs the customer out
 * everywhere — including for the ~300s of a rolling deploy, when two tasks
 * serve at once.
 */
import type { User } from "./auth";

export interface StoredSession {
  refreshToken: string;
  accessToken: string;
  accessTokenExpiresAt: number;
  expiresAt: number;
  user?: User;
}

/** Namespaced so admin and storefront sessions can share one Redis. */
const KEY_PREFIX = "web:session:";

declare global {
  // Keeps sessions stable across Vite server reloads during development, and
  // lets tests reset the store with `delete globalThis.__dupli1BffSessions`.
  var __dupli1BffSessions: Map<string, StoredSession> | undefined;
}

interface Backend {
  readonly kind: "memory" | "redis";
  read(sessionId: string): Promise<StoredSession | null>;
  write(sessionId: string, record: StoredSession): Promise<void>;
  remove(sessionId: string): Promise<void>;
}

// ── In-memory backend ────────────────────────────────────────────────────────

function memoryBackend(): Backend {
  // Resolved on every call rather than captured once: tests clear the global
  // between cases, and capturing would leave this holding the stale Map.
  const map = (): Map<string, StoredSession> =>
    (globalThis.__dupli1BffSessions ??= new Map());

  return {
    kind: "memory",
    async read(sessionId) {
      return map().get(sessionId) ?? null;
    },
    async write(sessionId, record) {
      map().set(sessionId, record);
    },
    async remove(sessionId) {
      map().delete(sessionId);
    },
  };
}

// ── Redis backend ────────────────────────────────────────────────────────────

/**
 * Imported dynamically so a Node-only package never reaches the client bundle,
 * and so a dev server without `REDIS_URL` does not load it at all.
 */
async function redisBackend(url: string): Promise<Backend> {
  const { createClient } = await import("redis");
  const client = createClient({ url });

  // node-redis queues commands and reconnects by itself; log so a sustained
  // outage is visible rather than surfacing only as mystery sign-outs.
  client.on("error", (error: unknown) => {
    console.error("session store: redis error", error);
  });

  await client.connect();

  return {
    kind: "redis",
    async read(sessionId) {
      const raw = await client.get(`${KEY_PREFIX}${sessionId}`);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as StoredSession;
      } catch {
        // An unreadable record is the same as no session; drop it.
        await client.del(`${KEY_PREFIX}${sessionId}`);
        return null;
      }
    },
    async write(sessionId, record) {
      // Redis expires the key alongside the record's own deadline, so an
      // abandoned session is collected instead of lingering for the 7-day TTL.
      const ttlMs = Math.max(1, record.expiresAt - Date.now());
      await client.set(`${KEY_PREFIX}${sessionId}`, JSON.stringify(record), {
        PX: ttlMs,
      });
    },
    async remove(sessionId) {
      await client.del(`${KEY_PREFIX}${sessionId}`);
    },
  };
}

// ── Backend selection ────────────────────────────────────────────────────────

let backendPromise: Promise<Backend> | null = null;

function backend(): Promise<Backend> {
  if (!backendPromise) {
    const url = process.env.REDIS_URL?.trim();
    if (!url) {
      backendPromise = Promise.resolve(memoryBackend());
    } else {
      backendPromise = redisBackend(url).catch((error) => {
        // Never silently fall back to memory: that splits sessions across tasks
        // and hides the outage behind intermittent sign-outs.
        backendPromise = null;
        throw error;
      });
    }
  }
  return backendPromise;
}

/** Which backend is in use. Exposed for diagnostics and tests. */
export async function sessionStoreKind(): Promise<"memory" | "redis"> {
  return (await backend()).kind;
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Read a session, treating an expired one as absent and dropping it. */
export async function readSessionRecord(
  sessionId: string
): Promise<StoredSession | null> {
  const store = await backend();
  const record = await store.read(sessionId);
  if (!record) return null;
  if (record.expiresAt <= Date.now()) {
    await store.remove(sessionId);
    return null;
  }
  return record;
}

export async function writeSessionRecord(
  sessionId: string,
  record: StoredSession
): Promise<void> {
  await (await backend()).write(sessionId, record);
}

export async function deleteSessionRecord(sessionId: string): Promise<void> {
  await (await backend()).remove(sessionId);
}

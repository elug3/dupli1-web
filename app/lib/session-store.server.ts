import { createClient } from "redis";

export interface SessionRecord {
  refreshToken: string;
  accessToken: string;
  accessTokenExpiresAt: number;
  expiresAt: number;
}

/**
 * Where BFF sessions live. Methods reject when the backing store cannot be
 * reached; callers treat that as "unknown", never as "no such session".
 */
export interface SessionStore {
  get(id: string): Promise<SessionRecord | null>;
  set(id: string, record: SessionRecord, ttlSeconds: number): Promise<void>;
  delete(id: string): Promise<void>;
}

const KEY_PREFIX = "dupli1:web:session:";

export function memorySessionStore(): SessionStore {
  const map = new Map<string, SessionRecord>();
  return {
    async get(id) {
      const record = map.get(id);
      if (record && record.expiresAt <= Date.now()) {
        map.delete(id);
        return null;
      }
      return record ?? null;
    },
    async set(id, record) {
      map.set(id, record);
    },
    async delete(id) {
      map.delete(id);
    },
  };
}

export function redisSessionStore(url: string): SessionStore {
  const client = createClient({
    url,
    socket: { reconnectStrategy: (retries) => Math.min(retries * 100, 2000) },
  });
  // Without a listener node-redis rethrows connection errors and kills the
  // process; a Redis blip should surface as failed commands instead.
  client.on("error", (error) => console.error("session store:", error.message));
  const ready = client.connect().catch((error) => {
    console.error("session store: initial connect failed:", error.message);
  });

  async function connected() {
    await ready;
    return client;
  }

  return {
    async get(id) {
      const raw = await (await connected()).get(KEY_PREFIX + id);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as SessionRecord;
      } catch {
        return null;
      }
    },
    async set(id, record, ttlSeconds) {
      await (await connected()).set(KEY_PREFIX + id, JSON.stringify(record), {
        EX: ttlSeconds,
      });
    },
    async delete(id) {
      await (await connected()).del(KEY_PREFIX + id);
    },
  };
}

declare global {
  // Keep one store across Vite server reloads during local development.
  var __dupli1SessionStore: SessionStore | undefined;
}

/**
 * DUPLI1_WEB_REDIS_URL selects Redis, shared by every task so a deploy or a
 * second replica keeps sessions. Unset, sessions live in process memory, which
 * is fine for local development and tests but ends them on restart.
 */
export function sessionStore(): SessionStore {
  if (!globalThis.__dupli1SessionStore) {
    const url = process.env.DUPLI1_WEB_REDIS_URL;
    if (!url && process.env.NODE_ENV === "production") {
      console.warn(
        "DUPLI1_WEB_REDIS_URL is not set: sessions are in memory and end on every restart"
      );
    }
    globalThis.__dupli1SessionStore = url
      ? redisSessionStore(url)
      : memorySessionStore();
  }
  return globalThis.__dupli1SessionStore;
}

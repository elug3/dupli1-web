/**
 * Web consultation chat (dupli1 docs/support-web-chat.md).
 *
 * One store per tab, like the cart: the floating button, the header badge,
 * the chat panel and the "문의하기" buttons on product and order pages all read
 * it. It holds the shopper's one conversation and keeps it current over a
 * Server-Sent Events stream through the session gateway. Every frame only says
 * that something changed (ids, never words), so the store simply reloads the
 * conversation over REST — which also makes a reconnect lossless.
 *
 * Signed-out shoppers never get here: their buttons stay Telegram links.
 */
import { getMe, isServiceAccount } from "./auth";

const BASE = "/auth/session/gateway/api/v1/support/web";
/** Mirrors support's `MaxWebMessageRunes`. */
export const MAX_MESSAGE_CHARS = 2000;

export type ProductRef = {
  product_id: string;
  sku_id: string;
  sku?: string;
  name: string;
  color?: string;
  price_won: number;
  image_url?: string;
};

export type OrderRef = {
  order_id: string;
  status: string;
  total_won: number;
  first_item_name?: string;
  item_count: number;
  created_at?: string;
};

export type ChatMessage = {
  id: string;
  /** inbound = the shopper; outbound = Dupli1 (staff or a system note). */
  direction: "inbound" | "outbound";
  kind: "text" | "product_ref" | "order_ref" | "system";
  body: string;
  ref?: ProductRef | OrderRef;
  created_at: string;
};

export type ChatInquiry = {
  id: string;
  status: "open" | "assigned" | "answered" | "closed";
  product_id?: string;
  sku_id?: string;
  order_id?: string;
  opened_at: string;
};

export type ChatConversation = {
  inquiry: ChatInquiry | null;
  messages: ChatMessage[];
  unread: number;
  service_open: boolean;
  service_window: string;
};

/** Something the shopper is about to ask about, sent with their next message. */
export type PendingRef =
  | {
      kind: "product";
      productId: string;
      skuId: string;
      name: string;
      color?: string;
      imageUrl?: string;
      priceWon?: number;
    }
  | { kind: "order"; orderId: string; label: string };

/**
 * idle: not checked yet · guest: signed out · unavailable: a service account,
 * or support has no web chat · ready: a signed-in shopper's conversation.
 */
export type ChatStatus = "idle" | "loading" | "guest" | "unavailable" | "ready" | "error";

export type ChatState = {
  status: ChatStatus;
  userId: string | null;
  conversation: ChatConversation | null;
  open: boolean;
  pending: PendingRef | null;
  live: boolean;
  sending: boolean;
  /** An i18n key under `chat.error.*`. */
  error: string | null;
};

const INITIAL: ChatState = {
  status: "idle",
  userId: null,
  conversation: null,
  open: false,
  pending: null,
  live: false,
  sending: false,
  error: null,
};

let state: ChatState = INITIAL;
const listeners = new Set<() => void>();

function setState(patch: Partial<ChatState>): void {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

export function subscribeSupportChat(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSupportChatSnapshot(): ChatState {
  return state;
}

export function getSupportChatServerSnapshot(): ChatState {
  return INITIAL;
}

/** Maps support's error `code` to copy; unknown codes read as a plain failure. */
export function errorKeyFor(code: string | undefined, status: number): string {
  switch (code) {
    case "invalid_message":
      return "chat.error.invalidMessage";
    case "invalid_reference":
      return "chat.error.invalidReference";
    case "reference_unavailable":
      return "chat.error.referenceUnavailable";
    case "rate_limited":
      return "chat.error.rateLimited";
    default:
      return status === 0 ? "chat.error.offline" : "chat.error.generic";
  }
}

class ChatRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string
  ) {
    super(code ?? `HTTP ${status}`);
  }
}

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, credentials: "same-origin", headers });
  } catch {
    throw new ChatRequestError(0);
  }
  if (!res.ok) {
    let code: string | undefined;
    try {
      code = ((await res.json()) as { code?: string }).code;
    } catch {
      // Not JSON: the status is all there is.
    }
    throw new ChatRequestError(res.status, code);
  }
  return res;
}

async function readConversation(res: Response): Promise<ChatConversation> {
  const body = (await res.json()) as { conversation: ChatConversation };
  return { ...body.conversation, messages: body.conversation.messages ?? [] };
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

let starting: Promise<void> | null = null;

/** Called from the root layout on navigation; does nothing once settled. */
export function startSupportChat(): Promise<void> {
  if (state.status !== "idle") return starting ?? Promise.resolve();
  starting = (async () => {
    setState({ status: "loading" });
    const user = await getMe().catch(() => null);
    if (!user) {
      setState({ status: "guest" });
      return;
    }
    if (isServiceAccount(user)) {
      setState({ status: "unavailable" });
      return;
    }
    setState({ userId: user.user_id });
    try {
      const conversation = await readConversation(await call("/conversation"));
      setState({ status: "ready", conversation, error: null });
      connectStream();
    } catch (err) {
      const status = err instanceof ChatRequestError ? err.status : 0;
      // 401: signed out after all. 403/503: no web chat for this account or
      // this deployment — the Telegram button takes over.
      setState({
        status: status === 401 ? "guest" : status === 403 || status === 503 ? "unavailable" : "error",
      });
    }
  })().finally(() => {
    starting = null;
  });
  return starting;
}

/** Forget everything — on sign in, sign out and registration. */
export function resetSupportChat(): void {
  disconnectStream();
  state = INITIAL;
  listeners.forEach((listener) => listener());
}

let reloading: Promise<void> | null = null;
let reloadAgain = false;

/** Reloads the conversation; overlapping calls collapse into one follow-up. */
export function refreshSupportChat(): Promise<void> {
  if (state.status !== "ready") return Promise.resolve();
  if (reloading) {
    reloadAgain = true;
    return reloading;
  }
  reloading = (async () => {
    do {
      reloadAgain = false;
      try {
        const conversation = await readConversation(await call("/conversation"));
        setState({ conversation });
        if (state.open && conversation.unread > 0) void markRead();
      } catch (err) {
        if (err instanceof ChatRequestError && err.status === 401) {
          resetSupportChat();
          setState({ status: "guest" });
          return;
        }
      }
    } while (reloadAgain);
  })().finally(() => {
    reloading = null;
  });
  return reloading;
}

// ── Stream ───────────────────────────────────────────────────────────────────

let source: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let backoffMs = 3000;

function connectStream(): void {
  if (typeof EventSource === "undefined" || source) return;
  const es = new EventSource(`${BASE}/events`);
  source = es;
  const onFrame = () => void refreshSupportChat();
  es.addEventListener("ready", () => {
    backoffMs = 3000;
    setState({ live: true });
    // Whatever changed while the stream was down.
    onFrame();
  });
  es.addEventListener("message", onFrame);
  es.addEventListener("inquiry", onFrame);
  es.onerror = () => {
    setState({ live: false });
    // A stream that ended normally (its token expired) is retried by the
    // browser. One refused outright (the BFF answered an error) is closed for
    // good, so reconnect ourselves, backing off.
    if (es.readyState === EventSource.CLOSED) {
      source = null;
      scheduleReconnect();
    }
  };
}

function scheduleReconnect(): void {
  if (reconnectTimer || state.status !== "ready") return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = undefined;
    if (state.status === "ready") connectStream();
  }, backoffMs);
  backoffMs = Math.min(backoffMs * 2, 60_000);
}

function disconnectStream(): void {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = undefined;
  source?.close();
  source = null;
}

// ── Actions ──────────────────────────────────────────────────────────────────

/** Opens the panel, optionally with something to ask about. */
export function openSupportChat(pending?: PendingRef): void {
  setState({ open: true, pending: pending ?? state.pending, error: null });
  if (state.conversation && state.conversation.unread > 0) void markRead();
}

export function closeSupportChat(): void {
  setState({ open: false });
}

export function clearPendingRef(): void {
  setState({ pending: null });
}

export function setPendingRef(pending: PendingRef): void {
  setState({ pending, error: null });
}

export async function sendSupportMessage(body: string): Promise<boolean> {
  const text = body.trim();
  const pending = state.pending;
  if (!text && !pending) return false;
  if (text.length > MAX_MESSAGE_CHARS) {
    setState({ error: "chat.error.invalidMessage" });
    return false;
  }
  setState({ sending: true, error: null });
  try {
    const payload: Record<string, string> = {};
    if (text) payload.body = text;
    if (pending?.kind === "product") {
      payload.product_id = pending.productId;
      payload.sku_id = pending.skuId;
    }
    if (pending?.kind === "order") payload.order_id = pending.orderId;
    const conversation = await readConversation(
      await call("/messages", { method: "POST", body: JSON.stringify(payload) })
    );
    setState({ conversation, pending: null, sending: false });
    return true;
  } catch (err) {
    const e = err instanceof ChatRequestError ? err : new ChatRequestError(0);
    if (e.status === 401) {
      resetSupportChat();
      setState({ status: "guest" });
      return false;
    }
    setState({ sending: false, error: errorKeyFor(e.code, e.status) });
    return false;
  }
}

export async function markRead(): Promise<void> {
  if (state.status !== "ready" || !state.conversation?.unread) return;
  // Optimistic: the badge clears the moment the panel shows the replies.
  setState({ conversation: { ...state.conversation, unread: 0 } });
  try {
    await call("/read", { method: "POST" });
  } catch {
    // The next reload restores the true count.
  }
}

export async function endConsultation(): Promise<void> {
  try {
    const conversation = await readConversation(
      await call("/inquiries/current/close", { method: "POST" })
    );
    setState({ conversation });
  } catch (err) {
    const e = err instanceof ChatRequestError ? err : new ChatRequestError(0);
    setState({ error: errorKeyFor(e.code, e.status) });
  }
}

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Link } from "react-router";

import { myAccountOrderPath } from "~/lib/account";
import { listMyOrders, orderStatusLabelKey, type Order } from "~/lib/checkout";
import { telegramContactUrl, type ContactContext } from "~/lib/contact";
import { useLanguage } from "~/lib/i18n";
import {
  MAX_MESSAGE_CHARS,
  clearPendingRef,
  closeSupportChat,
  endConsultation,
  getSupportChatServerSnapshot,
  getSupportChatSnapshot,
  openSupportChat,
  sendSupportMessage,
  setPendingRef,
  subscribeSupportChat,
  type ChatMessage,
  type OrderRef,
  type PendingRef,
  type ProductRef,
} from "~/lib/support-chat";

export function useSupportChat() {
  return useSyncExternalStore(
    subscribeSupportChat,
    getSupportChatSnapshot,
    getSupportChatServerSnapshot
  );
}

/**
 * "Ask about this" — opens the chat with the product or order attached for a
 * signed-in shopper; a signed-out one (or a deployment without web chat)
 * gets the Telegram bot instead, with the page as its context.
 */
export function ConsultButton({
  pending,
  telegramContext,
  className,
  children,
}: {
  pending?: PendingRef;
  telegramContext?: ContactContext;
  className?: string;
  children: ReactNode;
}) {
  const chat = useSupportChat();
  if (chat.status === "ready") {
    return (
      <button type="button" onClick={() => openSupportChat(pending)} className={className}>
        {children}
      </button>
    );
  }
  if (chat.status === "idle" || chat.status === "loading" || !telegramContext) return null;
  return (
    <a
      href={telegramContactUrl({ context: telegramContext })}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}

/** Floating chat button for signed-in shoppers, where the Telegram one sits. */
export function SupportChatLauncher() {
  const { t } = useLanguage();
  const chat = useSupportChat();
  const unread = chat.conversation?.unread ?? 0;
  if (chat.open) return null;
  const label = t("chat.open");
  return (
    <button
      type="button"
      onClick={() => openSupportChat()}
      aria-label={unread > 0 ? `${label} (${t("chat.unread", { count: unread })})` : label}
      title={label}
      className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex size-14 items-center justify-center rounded-full bg-zinc-950 text-white shadow-[0_6px_20px_rgba(0,0,0,0.25)] transition hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 md:right-8 md:size-16"
    >
      <ChatIcon className="size-7 md:size-8" />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}

/** The chat itself: a right-hand sheet on desktop, full screen on a phone. */
export function SupportChatPanel() {
  const { t, formatDateTime } = useLanguage();
  const chat = useSupportChat();
  const [draft, setDraft] = useState("");
  const [pickingOrder, setPickingOrder] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const messages = chat.conversation?.messages ?? [];
  const inquiry = chat.conversation?.inquiry ?? null;

  useEffect(() => {
    if (!chat.open) return;
    endRef.current?.scrollIntoView({ block: "end" });
  }, [chat.open, messages.length]);

  useEffect(() => {
    if (!chat.open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSupportChat();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chat.open]);

  if (!chat.open || chat.status !== "ready" || !chat.conversation) return null;
  const conversation = chat.conversation;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (await sendSupportMessage(draft)) setDraft("");
  }

  const tooLong = draft.trim().length > MAX_MESSAGE_CHARS;
  const canSend = !chat.sending && !tooLong && (draft.trim() !== "" || chat.pending !== null);

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={t("chat.title")}
      // Above the cookie banner (z-60): the shopper opened this on purpose,
      // and the banner would otherwise cover the composer until they choose.
      className="fixed inset-0 z-[70] flex flex-col bg-white md:inset-y-0 md:right-0 md:left-auto md:w-[26rem] md:border-l md:border-zinc-200 md:shadow-[-12px_0_40px_rgba(0,0,0,0.08)]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-zinc-950">{t("chat.title")}</h2>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            {conversation.service_open
              ? t("chat.hours", { window: conversation.service_window })
              : t("chat.afterHours", { window: conversation.service_window })}
          </p>
          {inquiry && (
            <p className="mt-1 text-[11px] text-zinc-400">
              {t(`chat.status.${inquiry.status}`)}
              {!chat.live && ` · ${t("chat.reconnecting")}`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {inquiry && (
            <button
              type="button"
              onClick={() => void endConsultation()}
              className="px-2 py-1 text-[11px] text-zinc-500 underline-offset-4 hover:text-zinc-950 hover:underline"
            >
              {t("chat.end")}
            </button>
          )}
          <button
            type="button"
            onClick={closeSupportChat}
            aria-label={t("chat.close")}
            className="p-2 text-zinc-500 transition hover:text-zinc-950"
          >
            <CloseIcon />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4" aria-live="polite">
        {messages.length === 0 ? (
          <p className="mt-8 text-center text-sm leading-relaxed text-zinc-500">
            {t("chat.empty")}
          </p>
        ) : (
          <ol className="space-y-3">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                time={formatDateTime(message.created_at)}
              />
            ))}
          </ol>
        )}
        {!inquiry && messages.length > 0 && (
          <p className="mt-4 text-center text-[11px] text-zinc-400">{t("chat.closedNote")}</p>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(event) => void submit(event)}
        className="border-t border-zinc-100 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        {chat.pending && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
            <span className="truncate">
              {t("chat.attaching", {
                label: chat.pending.kind === "product" ? chat.pending.name : chat.pending.label,
              })}
            </span>
            <button
              type="button"
              onClick={clearPendingRef}
              aria-label={t("chat.removeAttachment")}
              className="shrink-0 text-zinc-400 hover:text-zinc-950"
            >
              <CloseIcon small />
            </button>
          </div>
        )}
        {pickingOrder && chat.userId && (
          <OrderPicker
            customerId={chat.userId}
            onPick={(order) => {
              setPendingRef(order);
              setPickingOrder(false);
            }}
            onCancel={() => setPickingOrder(false)}
          />
        )}
        {chat.error && (
          <p role="alert" className="mb-2 text-[11px] text-red-600">
            {t(chat.error)}
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends; Shift+Enter (and an IME still composing Hangul) does not.
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                if (canSend) void submit(event);
              }
            }}
            rows={2}
            maxLength={MAX_MESSAGE_CHARS + 200}
            placeholder={t("chat.placeholder")}
            aria-label={t("chat.placeholder")}
            className="min-h-11 flex-1 resize-none rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-300 focus:border-zinc-400"
          />
          <button
            type="submit"
            disabled={!canSend}
            className="h-11 shrink-0 rounded-md bg-zinc-950 px-4 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
          >
            {chat.sending ? t("chat.sending") : t("chat.send")}
          </button>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-400">
          <button
            type="button"
            onClick={() => setPickingOrder((v) => !v)}
            className="underline-offset-4 hover:text-zinc-950 hover:underline"
          >
            {t("chat.attachOrder")}
          </button>
          <span className={tooLong ? "text-red-600" : undefined}>
            {draft.trim().length}/{MAX_MESSAGE_CHARS}
          </span>
        </div>
      </form>
    </div>
  );
}

function MessageBubble({ message, time }: { message: ChatMessage; time: string }) {
  const { t } = useLanguage();
  if (message.kind === "system") {
    return (
      <li className="px-6 text-center text-[11px] leading-relaxed text-zinc-400">
        {message.body}
      </li>
    );
  }
  const mine = message.direction === "inbound";
  return (
    <li className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      {!mine && <span className="mb-0.5 text-[10px] text-zinc-400">{t("chat.staff")}</span>}
      <div
        className={[
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          mine ? "bg-zinc-950 text-white" : "bg-zinc-100 text-zinc-950",
        ].join(" ")}
      >
        <MessageContent message={message} mine={mine} />
      </div>
      <span className="mt-0.5 text-[10px] text-zinc-400">{time}</span>
    </li>
  );
}

function MessageContent({ message, mine }: { message: ChatMessage; mine: boolean }) {
  const { t, formatCurrency } = useLanguage();
  const sub = mine ? "text-zinc-300" : "text-zinc-500";
  if (message.kind === "product_ref" && message.ref) {
    const ref = message.ref as ProductRef;
    return (
      <Link to={`/product/${encodeURIComponent(ref.product_id)}`} className="flex items-center gap-3">
        {ref.image_url && (
          <img src={ref.image_url} alt="" className="size-12 shrink-0 rounded-md object-cover" />
        )}
        <span className="min-w-0">
          <span className="block truncate font-medium">{ref.name}</span>
          <span className={`block text-xs ${sub}`}>
            {[ref.color, ref.price_won ? formatCurrency(ref.price_won) : ""]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
      </Link>
    );
  }
  if (message.kind === "order_ref" && message.ref) {
    const ref = message.ref as OrderRef;
    const statusKey = orderStatusLabelKey(ref.status);
    return (
      <Link to={myAccountOrderPath(ref.order_id)} className="block">
        <span className="block font-medium">{t("chat.order", { id: ref.order_id })}</span>
        <span className={`block text-xs ${sub}`}>
          {[
            statusKey ? t(statusKey) : ref.status,
            formatCurrency(ref.total_won),
            ref.first_item_name,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </Link>
    );
  }
  return <p className="whitespace-pre-wrap break-words">{message.body}</p>;
}

function OrderPicker({
  customerId,
  onPick,
  onCancel,
}: {
  customerId: string;
  onPick: (pending: PendingRef) => void;
  onCancel: () => void;
}) {
  const { t, formatCurrency, formatDateTime } = useLanguage();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listMyOrders(customerId)
      .then((list) => {
        if (cancelled) return;
        setOrders(
          [...list].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")).slice(0, 10)
        );
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  return (
    <div className="mb-2 max-h-56 overflow-y-auto rounded-md border border-zinc-200">
      <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2 text-[11px] text-zinc-500">
        {t("chat.pickOrder")}
        <button type="button" onClick={onCancel} aria-label={t("chat.close")}>
          <CloseIcon small />
        </button>
      </div>
      {failed ? (
        <p className="px-3 py-3 text-xs text-red-600">{t("chat.error.generic")}</p>
      ) : orders === null ? (
        <p className="px-3 py-3 text-xs text-zinc-400">…</p>
      ) : orders.length === 0 ? (
        <p className="px-3 py-3 text-xs text-zinc-400">{t("chat.noOrders")}</p>
      ) : (
        <ul>
          {orders.map((order) => {
            const label = orderLabel(order, t);
            const statusKey = orderStatusLabelKey(order.status);
            return (
              <li key={order.id}>
                <button
                  type="button"
                  onClick={() => onPick({ kind: "order", orderId: order.id, label })}
                  className="w-full px-3 py-2 text-left text-xs hover:bg-zinc-50"
                >
                  <span className="block truncate text-zinc-950">{label}</span>
                  <span className="block text-[11px] text-zinc-400">
                    {[
                      statusKey ? t(statusKey) : order.status,
                      formatCurrency(order.totalWon),
                      formatDateTime(order.createdAt),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** "Prada Galleria 외 1" — the order as a shopper recognises it. */
export function orderLabel(
  order: Pick<Order, "id" | "items">,
  t: (key: string, values?: Record<string, string | number>) => string
): string {
  const first = order.items[0];
  const name = first?.productName || first?.sku || order.id;
  return order.items.length > 1
    ? t("chat.andMore", { name, count: order.items.length - 1 })
    : name;
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path
        strokeLinejoin="round"
        d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.4c-.33.27-.8.03-.8-.39V16h0A2.5 2.5 0 0 1 4 13.5v-8Z"
      />
      <path strokeLinecap="round" d="M8 8.5h8M8 11.5h5" />
    </svg>
  );
}

function CloseIcon({ small = false }: { small?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={small ? "size-3.5" : "size-5"} fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

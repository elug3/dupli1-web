import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { type User, getMe, logout } from "~/lib/auth";
import { type Bag, fetchBags, bagImage } from "~/lib/api";
import { ProductPrice } from "~/components/product-price";
import { useLanguage } from "~/lib/i18n";

type Section = "wishlist" | "coupons" | "orders" | "settings" | "support";

type CouponStatus = "active" | "expired" | "used";

interface Coupon {
  code: string;
  discount: string;
  description: string;
  expires: string;
  status: CouponStatus;
}

const COUPONS: Coupon[] = [];

const FAQ_ITEMS = [
  {
    qKey: "profile.faqTrackOrder",
    aKey: "profile.faqTrackOrderAnswer",
  },
  {
    qKey: "profile.faqReturnPolicy",
    aKey: "profile.faqReturnPolicyAnswer",
  },
  {
    qKey: "profile.faqAuthenticated",
    aKey: "profile.faqAuthenticatedAnswer",
  },
  {
    qKey: "profile.faqApplyCoupon",
    aKey: "profile.faqApplyCouponAnswer",
  },
  {
    qKey: "profile.faqCancelOrder",
    aKey: "profile.faqCancelOrderAnswer",
  },
];

const NAV_ITEMS: { id: Section; labelKey: string; icon: React.FC }[] = [
  { id: "wishlist", labelKey: "profile.wishlist", icon: HeartIcon },
  { id: "coupons", labelKey: "profile.coupons", icon: TagIcon },
  { id: "orders", labelKey: "profile.orders", icon: BoxIcon },
  { id: "settings", labelKey: "profile.accountSettings", icon: SettingsIcon },
  { id: "support", labelKey: "profile.support", icon: SupportIcon },
];

export function meta() {
  return [
    { title: "Account | Dupli1" },
    { name: "description", content: "Manage your Dupli1 account." },
  ];
}

export default function Profile() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [section, setSection] = useState<Section>("wishlist");

  useEffect(() => {
    getMe().then(setUser);
  }, []);

  async function handleLogout() {
    await logout();
    setUser(null);
    navigate("/");
  }

  if (user === undefined) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-12">
        <div className="space-y-4">
          <div className="h-6 w-32 animate-pulse rounded bg-zinc-100" />
          <div className="h-48 animate-pulse rounded-xl bg-zinc-100" />
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-md px-5 py-20 text-center">
        <div className="mb-6 flex justify-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-zinc-100">
            <ProfileIcon className="size-8 text-zinc-400" />
          </span>
        </div>
        <h1 className="text-xl font-semibold text-zinc-950">{t("profile.signInToDupli1")}</h1>
        <p className="mt-2 text-sm text-zinc-500">
          {t("profile.signInDescription")}
        </p>
        <Link
          to="/login"
          className="mt-6 inline-flex h-12 items-center bg-zinc-950 px-8 text-sm font-semibold text-white transition hover:bg-zinc-800"
        >
          {t("profile.signIn")}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 md:px-10">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">{t("profile.account")}</p>
          <h1 className="mt-0.5 text-2xl font-light tracking-wide text-zinc-950">
            {user.email}
          </h1>
        </div>
        <button
          onClick={handleLogout}
          className="text-[11px] uppercase tracking-[0.15em] text-zinc-400 transition hover:text-zinc-950"
        >
          {t("profile.signOut")}
        </button>
      </div>

      <div className="flex flex-col gap-8 md:flex-row">
        {/* Sidebar — desktop */}
        <aside className="hidden w-52 shrink-0 md:block">
          <nav className="space-y-0.5">
            {NAV_ITEMS.map(({ id, labelKey, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSection(id)}
                className={[
                  "flex w-full items-center gap-3 px-3 py-2.5 text-left text-[11px] uppercase tracking-[0.12em] transition",
                  section === id
                    ? "bg-zinc-950 text-white"
                    : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-950",
                ].join(" ")}
              >
                <Icon />
                {t(labelKey)}
              </button>
            ))}
          </nav>
          <div className="mt-6 border-t border-zinc-100 pt-6">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-[11px] uppercase tracking-[0.12em] text-zinc-400 transition hover:text-zinc-950"
            >
              <SignOutIcon />
              {t("profile.signOut")}
            </button>
          </div>
        </aside>

        {/* Mobile tab bar */}
        <div className="flex gap-1 overflow-x-auto pb-1 md:hidden">
          {NAV_ITEMS.map(({ id, labelKey }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={[
                "shrink-0 px-4 py-2 text-[10px] uppercase tracking-[0.12em] transition",
                section === id
                  ? "bg-zinc-950 text-white"
                  : "border border-zinc-200 text-zinc-500",
              ].join(" ")}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {section === "wishlist" && <WishlistSection />}
          {section === "coupons" && <CouponsSection />}
          {section === "orders" && <OrdersSection />}
          {section === "settings" && <SettingsSection user={user} />}
          {section === "support" && <SupportSection />}
        </div>
      </div>
    </main>
  );
}

// ── Wishlist ───────────────────────────────────────────────────────────────

function WishlistSection() {
  const { t, translateProductName } = useLanguage();
  const [items, setItems] = useState<Bag[]>([]);

  function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <section>
      <SectionHeader title={t("profile.wishlist")} count={items.length} />
      {items.length === 0 ? (
        <EmptyState message={t("profile.emptyWishlist")} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <div key={item.id} className="group relative">
              <Link to={`/product/${item.id}`}>
                <div className="overflow-hidden bg-zinc-50">
                  <img
                    src={bagImage(item.brand, item.image)}
                    alt={translateProductName(item.id, item.name)}
                    className="aspect-square w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="mt-2 space-y-0.5">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-400">
                    {item.brand}
                  </p>
                  <p className="text-xs font-medium text-zinc-950 leading-snug">
                    {translateProductName(item.id, item.name)}
                  </p>
                  <ProductPrice price={item.price} />
                </div>
              </Link>
              <button
                onClick={() => remove(item.id)}
                aria-label={t("profile.removeWishlist")}
                className="absolute right-2 top-2 flex size-7 items-center justify-center bg-white/80 text-zinc-400 opacity-0 transition hover:text-red-500 group-hover:opacity-100"
              >
                <HeartFilledIcon />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Coupons ────────────────────────────────────────────────────────────────

function CouponsSection() {
  const { t } = useLanguage();
  const [coupons, setCoupons] = useState<Coupon[]>(COUPONS);
  const [copied, setCopied] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [redeemStatus, setRedeemStatus] = useState<"idle" | "success" | "already" | "invalid">("idle");

  function copy(code: string) {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    const code = input.trim().toUpperCase();
    if (!code) return;

    if (coupons.some((c) => c.code === code)) {
      setRedeemStatus("already");
      setTimeout(() => setRedeemStatus("idle"), 3000);
      return;
    }

    try {
      const res = await fetch("/api/coupons/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ code }),
      });

      if (res.status === 404) {
        setRedeemStatus("invalid");
      } else if (!res.ok) {
        setRedeemStatus("invalid");
      } else {
        const data = (await res.json()) as {
          code: string;
          discount: number;
          description: string;
          expires: string;
        };
        setCoupons((prev) => [
          {
            code: data.code,
            discount: `${Math.round(data.discount * 100)}% off`,
            description: data.description,
            expires: data.expires,
            status: "active",
          },
          ...prev,
        ]);
        setInput("");
        setRedeemStatus("success");
      }
    } catch {
      setRedeemStatus("invalid");
    }

    setTimeout(() => setRedeemStatus("idle"), 3000);
  }

  const active = coupons.filter((c) => c.status === "active");
  const inactive = coupons.filter((c) => c.status !== "active");

  return (
    <section>
      <SectionHeader title={t("profile.coupons")} count={t("profile.active", { count: active.length })} />

      {/* Redeem form */}
      <div className="mb-8 border border-zinc-100 p-5">
        <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-zinc-400">
          {t("profile.redeemCode")}
        </p>
        <form onSubmit={redeem} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => { setInput(e.target.value); setRedeemStatus("idle"); }}
            placeholder="e.g. SUMMER30"
            className="flex-1 border border-zinc-200 bg-white px-4 py-2.5 font-mono text-sm uppercase tracking-wider text-zinc-950 outline-none transition focus:border-zinc-400 placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-zinc-300"
          />
          <button
            type="submit"
            className="bg-zinc-950 px-5 py-2.5 text-[11px] uppercase tracking-[0.15em] text-white transition hover:bg-zinc-800"
          >
            {t("profile.redeem")}
          </button>
        </form>
        {redeemStatus === "success" && (
          <p className="mt-2 text-[11px] text-emerald-600">{t("profile.couponAdded")}</p>
        )}
        {redeemStatus === "already" && (
          <p className="mt-2 text-[11px] text-zinc-500">{t("profile.couponAlready")}</p>
        )}
        {redeemStatus === "invalid" && (
          <p className="mt-2 text-[11px] text-red-500">{t("profile.invalidCoupon")}</p>
        )}
      </div>

      {/* Active coupons */}
      {active.length === 0 ? (
        <EmptyState message={t("profile.noActiveCoupons")} />
      ) : (
        <div className="space-y-3">
          {active.map((c) => (
            <CouponCard key={c.code} coupon={c} copied={copied === c.code} onCopy={() => copy(c.code)} />
          ))}
        </div>
      )}

      {/* Used / expired */}
      {inactive.length > 0 && (
        <>
          <p className="mt-8 mb-3 text-[10px] uppercase tracking-[0.2em] text-zinc-300">{t("profile.usedExpired")}</p>
          <div className="space-y-3 opacity-50">
            {inactive.map((c) => (
              <CouponCard key={c.code} coupon={c} copied={false} onCopy={() => {}} disabled />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function CouponCard({
  coupon,
  copied,
  onCopy,
  disabled,
}: {
  coupon: Coupon;
  copied: boolean;
  onCopy: () => void;
  disabled?: boolean;
}) {
  const { t } = useLanguage();

  return (
    <div className="flex items-center justify-between border border-zinc-100 px-5 py-4">
      <div className="flex items-center gap-4">
        <div className="min-w-[5rem]">
          <p className="font-mono text-sm font-semibold tracking-wider text-zinc-950">
            {coupon.code}
          </p>
          <p className="text-[10px] uppercase tracking-[0.1em] text-[#c8a96e]">
            {coupon.discount}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-600">{coupon.description}</p>
          <p className="mt-0.5 text-[10px] text-zinc-400">
            {coupon.status === "expired" ? t("profile.expired") : coupon.status === "used" ? t("profile.used") : t("profile.expires")}{" "}
            {coupon.expires}
          </p>
        </div>
      </div>
      {!disabled && (
        <button
          onClick={onCopy}
          className="ml-4 shrink-0 text-[10px] uppercase tracking-[0.12em] text-zinc-400 transition hover:text-zinc-950"
        >
          {copied ? t("profile.copied") : t("profile.copy")}
        </button>
      )}
    </div>
  );
}

// ── Orders ─────────────────────────────────────────────────────────────────

function OrdersSection() {
  const { t } = useLanguage();

  return (
    <section>
      <SectionHeader title={t("profile.orders")} count={0} />
      <EmptyState message={t("profile.noOrders")} />
    </section>
  );
}

// ── Account Settings ───────────────────────────────────────────────────────

function SettingsSection({ user }: { user: User }) {
  const { t } = useLanguage();
  const [saved, setSaved] = useState(false);
  const [notifications, setNotifications] = useState({
    orders: true,
    promotions: true,
    wishlist: false,
    newArrivals: false,
  });

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <section className="space-y-10">
      <SectionHeader title={t("profile.accountSettings")} />

      {/* Profile info */}
      <div>
        <p className="mb-4 text-[10px] uppercase tracking-[0.2em] text-zinc-400">
          {t("profile.profile")}
        </p>
        <form onSubmit={handleSave} className="space-y-3">
          <Field label={t("profile.name")} defaultValue="" placeholder="—" />
          <Field label={t("profile.email")} defaultValue={user.email} type="email" />
          <Field label={t("profile.phone")} defaultValue="" placeholder="+1 (000) 000-0000" type="tel" />
          <div className="pt-1">
            <button
              type="submit"
              className="bg-zinc-950 px-6 py-2.5 text-[11px] uppercase tracking-[0.15em] text-white transition hover:bg-zinc-800"
            >
              {saved ? t("profile.saved") : t("profile.saveChanges")}
            </button>
          </div>
        </form>
      </div>

      {/* Change password */}
      <div>
        <p className="mb-4 text-[10px] uppercase tracking-[0.2em] text-zinc-400">
          {t("profile.password")}
        </p>
        <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
          <Field label={t("profile.currentPassword")} type="password" placeholder="••••••••" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("profile.newPassword")} type="password" placeholder="••••••••" />
            <Field label={t("profile.confirmPassword")} type="password" placeholder="••••••••" />
          </div>
          <div className="pt-1">
            <button
              type="submit"
              className="border border-zinc-200 px-6 py-2.5 text-[11px] uppercase tracking-[0.15em] text-zinc-700 transition hover:bg-zinc-50"
            >
              {t("profile.updatePassword")}
            </button>
          </div>
        </form>
      </div>

      {/* Notifications */}
      <div>
        <p className="mb-4 text-[10px] uppercase tracking-[0.2em] text-zinc-400">
          {t("profile.emailNotifications")}
        </p>
        <div className="space-y-3">
          {(
            [
              { key: "orders", label: t("profile.orderUpdates") },
              { key: "promotions", label: t("profile.promotions") },
              { key: "wishlist", label: t("profile.wishlistDrops") },
              { key: "newArrivals", label: t("profile.newArrivals") },
            ] as { key: keyof typeof notifications; label: string }[]
          ).map(({ key, label }) => (
            <label key={key} className="flex items-center justify-between border border-zinc-100 px-4 py-3">
              <span className="text-xs text-zinc-700">{label}</span>
              <Toggle
                enabled={notifications[key]}
                onChange={(v) => setNotifications((p) => ({ ...p, [key]: v }))}
              />
            </label>
          ))}
        </div>
      </div>

      {/* Danger zone */}
      <div className="border-t border-zinc-100 pt-8">
        <p className="mb-4 text-[10px] uppercase tracking-[0.2em] text-zinc-400">{t("profile.dangerZone")}</p>
        <button className="text-[11px] uppercase tracking-[0.12em] text-red-500 transition hover:text-red-700">
          {t("profile.deleteAccount")}
        </button>
      </div>
    </section>
  );
}

function Field({
  label,
  defaultValue,
  placeholder,
  type = "text",
}: {
  label: string;
  defaultValue?: string;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-[0.15em] text-zinc-400">
        {label}
      </label>
      <input
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-950 outline-none transition focus:border-zinc-400 placeholder:text-zinc-300"
      />
    </div>
  );
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={[
        "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors",
        enabled ? "bg-zinc-950" : "bg-zinc-200",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform",
          enabled ? "translate-x-4" : "translate-x-0.5",
        ].join(" ")}
      />
    </button>
  );
}

// ── Support ────────────────────────────────────────────────────────────────

function SupportSection() {
  const { t } = useLanguage();
  const [open, setOpen] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  }

  return (
    <section className="space-y-10">
      <SectionHeader title={t("profile.support")} />

      {/* FAQ */}
      <div>
        <p className="mb-4 text-[10px] uppercase tracking-[0.2em] text-zinc-400">
          {t("profile.faq")}
        </p>
        <div className="divide-y divide-zinc-100 border-t border-zinc-100">
          {FAQ_ITEMS.map((item, i) => (
            <div key={i}>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between py-4 text-left"
              >
                <span className="text-sm text-zinc-950">{t(item.qKey)}</span>
                <ChevronIcon
                  className={[
                    "ml-4 size-4 shrink-0 text-zinc-400 transition-transform",
                    open === i ? "rotate-180" : "",
                  ].join(" ")}
                />
              </button>
              {open === i && (
                <p className="pb-4 text-sm leading-relaxed text-zinc-500">{t(item.aKey)}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Contact form */}
      <div>
        <p className="mb-4 text-[10px] uppercase tracking-[0.2em] text-zinc-400">
          {t("profile.contactUs")}
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("profile.subject")} placeholder="e.g. Return request" />
            <Field label={t("profile.orderId")} placeholder="SCK-2026-XXXX" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-[0.15em] text-zinc-400">
              {t("profile.message")}
            </label>
            <textarea
              rows={5}
              placeholder={t("profile.messagePlaceholder")}
              className="w-full border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-950 outline-none transition focus:border-zinc-400 placeholder:text-zinc-300 resize-none"
            />
          </div>
          <div className="pt-1">
            <button
              type="submit"
              className="bg-zinc-950 px-6 py-2.5 text-[11px] uppercase tracking-[0.15em] text-white transition hover:bg-zinc-800"
            >
              {submitted ? t("profile.messageSent") : t("profile.sendMessage")}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

// ── Shared ─────────────────────────────────────────────────────────────────

function SectionHeader({ title, count }: { title: string; count?: string | number }) {
  return (
    <div className="mb-6 flex items-baseline gap-3">
      <h2 className="text-lg font-light tracking-wide text-zinc-950">{title}</h2>
      {count !== undefined && (
        <span className="text-[10px] uppercase tracking-[0.15em] text-zinc-400">{count}</span>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="border border-zinc-100 px-8 py-16 text-center">
      <p className="text-sm text-zinc-400">{message}</p>
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────

function ProfileIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none">
      <path d="M12 21C12 21 3 14.5 3 8.5a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-9 12.5-9 12.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function HeartFilledIcon() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21C12 21 3 14.5 3 8.5a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-9 12.5-9 12.5Z" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none">
      <path d="M12.5 3H7a2 2 0 0 0-2 2v5.5l9.5 9.5a2 2 0 0 0 2.83 0l4.17-4.17a2 2 0 0 0 0-2.83L12.5 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="9" cy="9" r="1" fill="currentColor" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none">
      <path d="M21 8V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8m18 0H3m18 0-3-5H6L3 8m9 4v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none">
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function SupportIcon() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none">
      <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.97-4.03 9-9 9a9.09 9.09 0 0 1-4.02-.94L3 21l1.94-4.98A8.96 8.96 0 0 1 3 12c0-4.97 4.03-9 9-9s9 4.03 9 9Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none">
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

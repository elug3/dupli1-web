import { useCallback, useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router";

import { useLanguage, type LanguageCode } from "~/lib/i18n";
import { useCart } from "~/lib/useCart";
import { useShippingFeeWon } from "~/lib/useShippingFee";
import { MenuDrawer } from "./menu-drawer";
import { SearchOverlay } from "./search-overlay";

/** Scroll distance after which the home header turns solid white. */
const SOLID_AFTER_PX = 120;

/**
 * One header bar, `--header-h` tall: menu and search on the left, the
 * wordmark in the centre, account and bag on the right. Over the home hero it
 * is transparent until the page scrolls.
 */
export function SiteHeader() {
  const { t } = useLanguage();
  const { count } = useCart();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const overHero = pathname === "/";

  useEffect(() => {
    if (!overHero) return;
    const onScroll = () => setScrolled(window.scrollY > SOLID_AFTER_PX);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [overHero]);

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const transparent = overHero && !scrolled && !menuOpen;

  return (
    <>
      <header
        className={[
          "fixed inset-x-0 top-0 z-40 transition-colors duration-300 ease-lux",
          transparent
            ? "bg-gradient-to-b from-black/30 to-transparent text-white"
            : "border-b border-rule bg-white text-ink",
        ].join(" ")}
      >
        <div className="grid h-(--header-h) grid-cols-[1fr_auto_1fr] items-center px-2 md:px-8">
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-expanded={menuOpen}
              aria-controls="menu-drawer"
              className="flex items-center gap-2 p-2 text-small"
            >
              <MenuIcon />
              <span className="hidden md:inline">{t("nav.menu")}</span>
            </button>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 p-2 text-small md:ml-2"
            >
              <SearchIcon />
              <span className="sr-only md:not-sr-only">{t("nav.search")}</span>
            </button>
          </div>

          <NavLink
            to="/"
            data-brand-logo
            className="justify-self-center text-sm font-semibold uppercase tracking-[0.4em]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Dupli1
          </NavLink>

          <div className="flex items-center justify-end">
            <LanguageSelector className="mr-2 hidden sm:flex" />
            <NavLink to="/profile" aria-label={t("nav.profile")} className="p-2">
              <ProfileIcon />
            </NavLink>
            <NavLink to="/cart" aria-label={t("nav.shoppingBag")} className="relative p-2">
              <BagIcon />
              {count > 0 && (
                <span className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center bg-ink text-[9px] font-semibold text-white">
                  {count > 9 ? "9+" : count}
                </span>
              )}
            </NavLink>
          </div>
        </div>
      </header>

      <MenuDrawer
        open={menuOpen}
        onClose={closeMenu}
        footer={
          <>
            <LanguageSelector className="flex sm:hidden" />
            <ShippingNote />
          </>
        }
      />
      {searchOpen && <SearchOverlay onClose={closeSearch} />}
    </>
  );
}

/** "Shipping ₩30,000 on all orders", now in the drawer and footer instead of a bar. */
export function ShippingNote({ className = "text-caption text-mute" }: { className?: string }) {
  const { t, formatCurrency } = useLanguage();
  const shippingFeeWon = useShippingFeeWon();
  return (
    <p className={className}>
      {shippingFeeWon === 0
        ? t("announcement.shippingFree")
        : t("announcement.shipping", { amount: formatCurrency(shippingFeeWon) })}
    </p>
  );
}

function LanguageSelector({ className = "" }: { className?: string }) {
  const { language, languages, setLanguage, t } = useLanguage();

  return (
    <label className={`items-center gap-1 p-1 text-caption ${className}`}>
      <span className="sr-only">{t("language.label")}</span>
      <GlobeIcon />
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value as LanguageCode)}
        aria-label={t("language.label")}
        className="cursor-pointer bg-transparent outline-none [&>option]:text-ink"
      >
        {languages.map((option) => (
          <option key={option.code} value={option.code}>
            {option.nativeLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function ProfileIcon() {
  return (
    <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none">
      <path d="M6 8h12l-1 13H7L6 8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none">
      <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M3.6 9h16.8M3.6 15h16.8M12 3c2.25 2.45 3.35 5.45 3.35 9S14.25 18.55 12 21c-2.25-2.45-3.35-5.45-3.35-9S9.75 5.45 12 3Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none">
      <path d="m20 20-4.2-4.2M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

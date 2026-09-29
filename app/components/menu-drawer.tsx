import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { useLanguage } from "~/lib/i18n";
import { VISIBLE_NAV_GROUPS, type NavGroup, navItemImage, navItemLabel } from "~/lib/nav";

/**
 * The one menu for every width: a drawer from the left, full screen on
 * phones and 440px from md. Level one lists what we sell as pictured rows
 * (bags now; wallets and padded jackets once they launch), then brand and
 * style as text. Choosing one replaces it with that group's items as image
 * tiles. Menu → group → item is three taps at most, and "View all" makes the
 * group itself two.
 */
export function MenuDrawer({
  open,
  onClose,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  /** Extra lines under level one (language, shipping). */
  footer?: React.ReactNode;
}) {
  const { t } = useLanguage();
  const [groupId, setGroupId] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const group = VISIBLE_NAV_GROUPS.find((g) => g.id === groupId) ?? null;
  const subjects = VISIBLE_NAV_GROUPS.filter((g) => g.kind === "subject");
  const facets = VISIBLE_NAV_GROUPS.filter((g) => g.kind === "facet");

  useEffect(() => {
    if (!open) {
      setGroupId(null);
      return;
    }
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return (
    <div inert={!open} className={open ? "" : "pointer-events-none"}>
      <button
        type="button"
        tabIndex={-1}
        aria-label={t("nav.closeMenu")}
        onClick={onClose}
        className={[
          "fixed inset-0 z-50 bg-black/60 transition-opacity duration-300 ease-lux motion-reduce:transition-none",
          open ? "opacity-100" : "opacity-0",
        ].join(" ")}
      />
      <nav
        id="menu-drawer"
        aria-label={t("nav.main")}
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-full flex-col bg-white text-ink transition-transform duration-500 ease-lux motion-reduce:transition-none md:w-[440px]",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="flex h-(--header-h) shrink-0 items-center gap-4 px-4 md:px-8">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="-ml-2 flex items-center gap-2 p-2 text-small"
          >
            <CloseIcon />
            <span>{t("nav.closeMenu")}</span>
          </button>
          {group && (
            <button
              type="button"
              onClick={() => setGroupId(null)}
              className="ml-auto flex items-center gap-1 p-2 text-small text-mute hover:text-ink"
            >
              <ChevronIcon className="rotate-180" />
              <span>{t("nav.back")}</span>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-10 md:px-8">
          {group ? (
            <GroupTiles group={group} onNavigate={onClose} />
          ) : (
            <>
              <ul className="mt-6 grid gap-3">
                {subjects.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => setGroupId(g.id)}
                      className="flex w-full items-center gap-4 text-left"
                    >
                      <NavImage to={g.to} className="size-20 shrink-0" />
                      <span className="flex-1 text-xl">{t(g.labelKey)}</span>
                      <ChevronIcon />
                    </button>
                  </li>
                ))}
              </ul>
              <ul className="mt-6 grid gap-1 border-t border-rule pt-4">
                {facets.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => setGroupId(g.id)}
                      className="flex w-full items-center justify-between py-3 text-left text-xl"
                    >
                      <span>{t(g.labelKey)}</span>
                      <ChevronIcon />
                    </button>
                  </li>
                ))}
              </ul>
              {footer && <div className="mt-10 grid gap-3 border-t border-rule pt-6">{footer}</div>}
            </>
          )}
        </div>
      </nav>
    </div>
  );
}

function GroupTiles({ group, onNavigate }: { group: NavGroup; onNavigate: () => void }) {
  const { t } = useLanguage();

  return (
    <div className="mt-6">
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h2 className="text-xl">{t(group.labelKey)}</h2>
        <Link to={group.to} onClick={onNavigate} className="text-small text-mute underline underline-offset-4 hover:text-ink">
          {t("nav.viewAll")}
        </Link>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-5">
        {group.items.map((item) => (
          <li key={item.to}>
            <Link to={item.to} onClick={onNavigate} className="block">
              <NavImage to={item.to} className="aspect-square" />
              <p className="mt-2 text-small">{navItemLabel(item, t)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A category's most viewed product on the ground colour; blank until it loads. */
function NavImage({ to, className }: { to: string; className: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void navItemImage(to).then((next) => {
      if (!cancelled) setSrc(next);
    });
    return () => {
      cancelled = true;
    };
  }, [to]);

  return (
    <div className={`overflow-hidden bg-ground ${className}`}>
      {src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover mix-blend-multiply"
        />
      )}
    </div>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none">
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

function ChevronIcon({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={`size-4 ${className}`} viewBox="0 0 24 24" fill="none">
      <path d="m9 6 6 6-6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

import { type ReactNode, useEffect, useId, useRef, useState } from "react";

export interface ListboxOption {
  value: string;
  /** What the open list shows for this option. */
  content: ReactNode;
  /** Listed (with its reason in `content`) but cannot be picked. */
  disabled?: boolean;
  /** Draws a rule above the option, e.g. before "Enter a new address". */
  separated?: boolean;
}

/**
 * Checkout's one dropdown: a button showing the current choice over a list
 * of options, each free to span several lines (who, where, a badge, a
 * reason) where a native <select> allows one line of plain text.
 *
 * Keyboard: Enter / Space / ↓ opens, ↑ ↓ Home End move, Enter picks, Esc
 * closes (focus returns to the button), Tab closes and moves on.
 */
export function ListboxSelect({
  id,
  label,
  value,
  options,
  selectedContent,
  note,
  error,
  onChange,
}: {
  /** Put on the button, so validation can scroll to and focus it. */
  id?: string;
  label: string;
  value: string | null;
  options: ListboxOption[];
  /** What the closed button shows. */
  selectedContent: ReactNode;
  /** A line at the top of the open list (an empty address book, say). */
  note?: ReactNode;
  error?: string;
  onChange: (value: string) => void;
}) {
  const autoId = useId();
  const baseId = id ?? autoId;
  const buttonId = id ?? `${autoId}-button`;
  const labelId = `${baseId}-label`;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  function choose(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    setOpen(false);
    buttonRef.current?.focus();
    onChange(option.value);
  }

  function openList() {
    const index = options.findIndex((o) => o.value === value);
    setActive(index >= 0 ? index : 0);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document
      .getElementById(`${baseId}-opt-${active}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active, baseId]);

  function onButtonKey(e: React.KeyboardEvent) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      openList();
    }
  }

  function onListKey(e: React.KeyboardEvent) {
    const last = options.length - 1;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => Math.min(i + 1, last));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(last);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        choose(active);
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <p
        id={labelId}
        className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-mute"
      >
        {label}
      </p>
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${labelId} ${buttonId}`}
        aria-invalid={error ? true : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onButtonKey}
        className={[
          "flex min-h-12 w-full scroll-mt-32 items-center justify-between gap-3 border bg-white px-4 py-3 text-left outline-none transition-colors duration-300 ease-lux",
          open
            ? "border-ink"
            : error
              ? "border-alert"
              : "border-rule hover:border-mute focus-visible:border-ink",
        ].join(" ")}
      >
        {selectedContent}
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={[
            "size-4 shrink-0 text-mute transition-transform duration-300 ease-lux",
            open ? "rotate-180" : "",
          ].join(" ")}
        >
          <path
            d="M5 7.5l5 5 5-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {error && <p className="mt-1.5 text-caption text-alert">{error}</p>}

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={labelId}
          aria-activedescendant={`${baseId}-opt-${active}`}
          onKeyDown={onListKey}
          className="absolute inset-x-0 top-full z-30 -mt-px max-h-96 overflow-y-auto border border-ink bg-white outline-none"
        >
          {note && (
            <li
              role="presentation"
              className="px-4 pb-1 pt-3 text-caption text-mute"
            >
              {note}
            </li>
          )}
          {options.map((option, index) => {
            const isSelected = value === option.value;
            return (
              <li
                key={option.value}
                id={`${baseId}-opt-${index}`}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled || undefined}
                onMouseEnter={() => setActive(index)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(index)}
                className={[
                  "flex items-start gap-3 px-4 py-3 transition-colors duration-300 ease-lux",
                  option.disabled ? "cursor-not-allowed" : "cursor-pointer",
                  index > 0 || note || option.separated
                    ? "border-t border-rule"
                    : "",
                  index === active && !option.disabled ? "bg-ground" : "",
                ].join(" ")}
              >
                <span
                  aria-hidden="true"
                  className={[
                    "mt-1 size-3.5 shrink-0 text-ink",
                    isSelected ? "" : "invisible",
                  ].join(" ")}
                >
                  <svg viewBox="0 0 16 16">
                    <path
                      d="M3 8.5l3 3 7-7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span
                  className={["min-w-0 flex-1", option.disabled ? "opacity-50" : ""].join(" ")}
                >
                  {option.content}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Title over a quieter second line: the shape most options take. */
export function OptionLines({
  title,
  detail,
  badge,
}: {
  title: ReactNode;
  detail?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <span className="block min-w-0">
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-ink">{title}</span>
        {badge && (
          <span className="rounded-full border border-ink px-2 py-px text-[10px] font-medium uppercase tracking-wider text-ink">
            {badge}
          </span>
        )}
      </span>
      {detail && (
        <span className="mt-0.5 block text-caption text-mute">{detail}</span>
      )}
    </span>
  );
}

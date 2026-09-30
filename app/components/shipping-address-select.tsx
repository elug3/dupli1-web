import { useEffect, useId, useRef, useState } from "react";
import { formatKRPhoneInput } from "~/lib/checkout";
import { useLanguage } from "~/lib/i18n";
import { type CustomerAddress, formatAddressSummary } from "~/lib/profile";

/** The dropdown's value: a saved address id, or a new address typed in. */
export type AddressChoice = string | "new";

const NEW = "new";

function addressTitle(address: CustomerAddress): string {
  return address.label?.trim() || address.recipientName;
}

/**
 * "Select shipping address" dropdown for checkout: the shopper's saved
 * addresses (default first), then "Enter a new address". Shown to every
 * signed-in shopper, so an empty book still offers the one choice and says
 * why there is nothing else.
 *
 * `editedFrom` is the saved address the form was filled from before the
 * shopper changed a field: the choice is then "new", but the button keeps
 * naming where it came from instead of reading as a blank new address.
 *
 * A listbox rather than a native <select> so each option can show who, where
 * and the default badge on two lines. Keyboard: Enter / Space / ↓ opens,
 * ↑ ↓ Home End move, Enter picks, Esc closes (focus returns to the button).
 */
export function ShippingAddressSelect({
  addresses,
  value,
  editedFrom = null,
  onSelectAddress,
  onSelectNew,
}: {
  addresses: CustomerAddress[];
  value: AddressChoice | null;
  editedFrom?: CustomerAddress | null;
  onSelectAddress: (address: CustomerAddress) => void;
  onSelectNew: () => void;
}) {
  const { t } = useLanguage();
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  // Default address first, then the book's own order.
  const sorted = [...addresses].sort(
    (a, b) => Number(b.isDefault) - Number(a.isDefault)
  );
  const choices: AddressChoice[] = [...sorted.map((a) => a.id), NEW];
  const selected = sorted.find((a) => a.id === value) ?? null;

  function choose(choice: AddressChoice) {
    setOpen(false);
    buttonRef.current?.focus();
    if (choice === NEW) {
      onSelectNew();
      return;
    }
    const address = sorted.find((a) => a.id === choice);
    if (address) onSelectAddress(address);
  }

  function openList() {
    const index = choices.indexOf(value ?? NEW);
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
      .getElementById(`${id}-opt-${active}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active, id]);

  function onButtonKey(e: React.KeyboardEvent) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      openList();
    }
  }

  function onListKey(e: React.KeyboardEvent) {
    const last = choices.length - 1;
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
        choose(choices[active]);
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

  const labelId = `${id}-label`;

  return (
    <div ref={rootRef} className="relative">
      <p
        id={labelId}
        className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-mute"
      >
        {t("checkout.selectShippingAddress")}
      </p>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${labelId} ${id}-button`}
        id={`${id}-button`}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onButtonKey}
        className={[
          "flex min-h-12 w-full items-center justify-between gap-3 border bg-white px-4 py-3 text-left outline-none transition-colors duration-300 ease-lux",
          open
            ? "border-ink"
            : "border-rule hover:border-mute focus-visible:border-ink",
        ].join(" ")}
      >
        {selected ? (
          <AddressLines address={selected} showPccc />
        ) : value === NEW && editedFrom ? (
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-ink">
              {addressTitle(editedFrom)}
            </span>
            <span className="mt-0.5 block text-caption text-mute">
              {t("checkout.addressEdited")}
            </span>
          </span>
        ) : (
          <span className="text-sm text-ink">
            {value === NEW
              ? t("checkout.useNewAddress")
              : t("checkout.selectShippingAddressPlaceholder")}
          </span>
        )}
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

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={labelId}
          aria-activedescendant={`${id}-opt-${active}`}
          onKeyDown={onListKey}
          className="absolute inset-x-0 top-full z-30 -mt-px max-h-80 overflow-y-auto border border-ink bg-white outline-none"
        >
          {sorted.length === 0 && (
            <li
              role="presentation"
              className="px-4 pb-1 pt-3 text-caption text-mute"
            >
              {t("checkout.noSavedAddresses")}
            </li>
          )}
          {choices.map((choice, index) => {
            const address = sorted.find((a) => a.id === choice);
            const isSelected = value === choice;
            return (
              <li
                key={choice}
                id={`${id}-opt-${index}`}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActive(index)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(choice)}
                className={[
                  "flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors duration-300 ease-lux",
                  index > 0 || sorted.length === 0 ? "border-t border-rule" : "",
                  index === active ? "bg-ground" : "",
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
                {address ? (
                  <AddressLines address={address} showPccc />
                ) : (
                  <span className="text-sm font-medium text-ink">
                    + {t("checkout.useNewAddress")}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function AddressLines({
  address,
  showPccc = false,
}: {
  address: CustomerAddress;
  showPccc?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <span className="min-w-0">
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-ink">
          {addressTitle(address)}
        </span>
        {address.isDefault && (
          <span className="rounded-full border border-ink px-2 py-px text-[10px] font-medium uppercase tracking-wider text-ink">
            {t("profile.defaultAddress")}
          </span>
        )}
      </span>
      <span className="mt-0.5 block text-caption text-mute">
        {address.recipientName} · {formatKRPhoneInput(address.recipientPhone)}
      </span>
      <span className="mt-0.5 block truncate text-caption text-mute">
        ({address.postalCode}) {formatAddressSummary(address)}
      </span>
      {showPccc && !address.pccc && (
        <span className="mt-0.5 block text-caption text-alert">
          {t("checkout.savedAddressMissingPccc")}
        </span>
      )}
    </span>
  );
}

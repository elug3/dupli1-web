import { ListboxSelect } from "~/components/listbox-select";
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
 * "Shipping address" dropdown for checkout: the shopper's saved addresses
 * (default first), then "Enter a new address". Shown to every signed-in
 * shopper, so an empty book still offers the one choice and says why there
 * is nothing else.
 *
 * `editedFrom` is the saved address the form was filled from before the
 * shopper changed a field: the choice is then "new", but the button keeps
 * naming where it came from instead of reading as a blank new address.
 */
export function ShippingAddressSelect({
  addresses,
  value,
  editedFrom = null,
  error,
  onSelectAddress,
  onSelectNew,
}: {
  addresses: CustomerAddress[];
  value: AddressChoice | null;
  editedFrom?: CustomerAddress | null;
  error?: string;
  onSelectAddress: (address: CustomerAddress) => void;
  onSelectNew: () => void;
}) {
  const { t } = useLanguage();

  // Default address first, then the book's own order.
  const sorted = [...addresses].sort(
    (a, b) => Number(b.isDefault) - Number(a.isDefault)
  );
  const selected = sorted.find((a) => a.id === value) ?? null;

  const options = [
    ...sorted.map((address) => ({
      value: address.id,
      content: <AddressLines address={address} showPccc />,
    })),
    {
      value: NEW,
      content: (
        <span className="text-sm font-medium text-ink">
          + {t("checkout.useNewAddress")}
        </span>
      ),
    },
  ];

  return (
    <ListboxSelect
      label={t("checkout.stepShipping")}
      value={value}
      options={options}
      error={error}
      note={sorted.length === 0 ? t("checkout.noSavedAddresses") : undefined}
      onChange={(choice) => {
        if (choice === NEW) {
          onSelectNew();
          return;
        }
        const address = sorted.find((a) => a.id === choice);
        if (address) onSelectAddress(address);
      }}
      selectedContent={
        selected ? (
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
        )
      }
    />
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
    <span className="block min-w-0">
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

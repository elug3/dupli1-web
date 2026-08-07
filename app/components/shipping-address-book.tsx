import { useState } from "react";
import {
  type AddressInput,
  type CustomerAddress,
  MAX_ADDRESSES_PER_USER,
  createAddress,
  deleteAddress,
  formatAddressSummary,
  setDefaultAddress,
  updateAddress,
  validateAddressInput,
} from "~/lib/profile";
import { useLanguage } from "~/lib/i18n";

const emptyForm: AddressInput = {
  label: "",
  recipientName: "",
  recipientPhone: "",
  postalCode: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  province: "",
  isDefault: false,
};

function addressToForm(address: CustomerAddress): AddressInput {
  return {
    label: address.label ?? "",
    recipientName: address.recipientName,
    recipientPhone: address.recipientPhone,
    postalCode: address.postalCode,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2 ?? "",
    city: address.city,
    province: address.province,
    isDefault: address.isDefault,
  };
}

export function ShippingAddressBook({
  addresses,
  onChange,
}: {
  addresses: CustomerAddress[];
  onChange: (addresses: CustomerAddress[]) => void;
}) {
  const { t } = useLanguage();
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<AddressInput>(emptyForm);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const atLimit = addresses.length >= MAX_ADDRESSES_PER_USER;

  function openCreate() {
    setEditingId("new");
    setForm({ ...emptyForm, isDefault: addresses.length === 0 });
    setFieldError(null);
    setError(null);
  }

  function openEdit(address: CustomerAddress) {
    setEditingId(address.id);
    setForm(addressToForm(address));
    setFieldError(null);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setFieldError(null);
    setError(null);
  }

  function update<K extends keyof AddressInput>(key: K, value: AddressInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const invalid = validateAddressInput(form);
    if (invalid) {
      setFieldError(invalid);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (editingId === "new") {
        const created = await createAddress(form);
        onChange(
          [...addresses.map((a) => (created.isDefault ? { ...a, isDefault: false } : a)), created]
        );
      } else if (editingId) {
        const updated = await updateAddress(editingId, form);
        onChange(
          addresses.map((a) => {
            if (a.id === updated.id) return updated;
            return updated.isDefault ? { ...a, isDefault: false } : a;
          })
        );
      }
      cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("profile.addressSaveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm(t("profile.addressDeleteConfirm"))) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAddress(id);
      onChange(addresses.filter((a) => a.id !== id));
      if (editingId === id) cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("profile.addressDeleteFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleSetDefault(id: string) {
    setBusy(true);
    setError(null);
    try {
      const updated = await setDefaultAddress(id);
      onChange(
        addresses.map((a) => ({
          ...a,
          isDefault: a.id === updated.id,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("profile.addressDefaultFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">
            {t("profile.shippingAddresses")}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {t("profile.shippingAddressesHint", {
              max: String(MAX_ADDRESSES_PER_USER),
            })}
          </p>
        </div>
        {!editingId && (
          <button
            type="button"
            onClick={openCreate}
            disabled={atLimit || busy}
            className="shrink-0 border border-zinc-200 px-4 py-2 text-[10px] uppercase tracking-[0.15em] text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("profile.addAddress")}
          </button>
        )}
      </div>

      {error && (
        <p className="mb-3 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}

      {atLimit && !editingId && (
        <p className="mb-3 text-xs text-zinc-500">{t("profile.addressLimitReached")}</p>
      )}

      {addresses.length === 0 && !editingId && (
        <p className="border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-400">
          {t("profile.noAddresses")}
        </p>
      )}

      <div className="space-y-3">
        {addresses.map((address) => (
          <div
            key={address.id}
            className="border border-zinc-100 px-4 py-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-zinc-950">
                    {address.label?.trim() || address.recipientName}
                  </p>
                  {address.isDefault && (
                    <span className="bg-zinc-950 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
                      {t("profile.defaultAddress")}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {address.recipientName} · {address.recipientPhone}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                  ({address.postalCode}) {formatAddressSummary(address)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!address.isDefault && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleSetDefault(address.id)}
                    className="text-[10px] uppercase tracking-[0.12em] text-zinc-500 transition hover:text-zinc-950 disabled:opacity-40"
                  >
                    {t("profile.setDefault")}
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => openEdit(address)}
                  className="text-[10px] uppercase tracking-[0.12em] text-zinc-500 transition hover:text-zinc-950 disabled:opacity-40"
                >
                  {t("profile.editAddress")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleDelete(address.id)}
                  className="text-[10px] uppercase tracking-[0.12em] text-red-500 transition hover:text-red-700 disabled:opacity-40"
                >
                  {t("profile.deleteAddress")}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editingId && (
        <form
          onSubmit={handleSave}
          className="mt-4 space-y-3 border border-zinc-200 bg-zinc-50/60 px-4 py-5"
        >
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">
            {editingId === "new" ? t("profile.addAddress") : t("profile.editAddress")}
          </p>
          <AddressFormFields
            form={form}
            fieldError={fieldError}
            onChange={update}
          />
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="submit"
              disabled={busy}
              className="bg-zinc-950 px-6 py-2.5 text-[11px] uppercase tracking-[0.15em] text-white transition hover:bg-zinc-800 disabled:opacity-50"
            >
              {busy ? t("profile.saving") : t("profile.saveAddress")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={cancelEdit}
              className="border border-zinc-200 px-6 py-2.5 text-[11px] uppercase tracking-[0.15em] text-zinc-700 transition hover:bg-white disabled:opacity-50"
            >
              {t("profile.cancel")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function AddressFormFields({
  form,
  fieldError,
  onChange,
  idPrefix = "addr",
}: {
  form: AddressInput;
  fieldError: string | null;
  onChange: <K extends keyof AddressInput>(key: K, value: AddressInput[K]) => void;
  idPrefix?: string;
}) {
  const { t } = useLanguage();

  function err(key: string) {
    return fieldError === key ? t("checkout.required") : undefined;
  }

  function phoneErr() {
    if (fieldError !== "recipientPhone") return undefined;
    return form.recipientPhone.trim()
      ? t("checkout.validPhone")
      : t("checkout.required");
  }

  function zipErr() {
    if (fieldError !== "postalCode") return undefined;
    return form.postalCode.trim()
      ? t("checkout.validZip")
      : t("checkout.required");
  }

  return (
    <div className="space-y-3">
      <LabeledInput
        id={`${idPrefix}-label`}
        label={t("profile.addressLabel")}
        value={form.label ?? ""}
        onChange={(v) => onChange("label", v)}
        placeholder={t("profile.addressLabelPlaceholder")}
      />
      <LabeledInput
        id={`${idPrefix}-name`}
        label={t("checkout.name")}
        value={form.recipientName}
        onChange={(v) => onChange("recipientName", v)}
        error={err("recipientName")}
        autoComplete="name"
        required
      />
      <LabeledInput
        id={`${idPrefix}-phone`}
        label={t("checkout.phone")}
        value={form.recipientPhone}
        onChange={(v) => onChange("recipientPhone", v)}
        error={phoneErr()}
        autoComplete="tel"
        placeholder="01012345678"
        required
      />
      <LabeledInput
        id={`${idPrefix}-zip`}
        label={t("checkout.zip")}
        value={form.postalCode}
        onChange={(v) => onChange("postalCode", v)}
        error={zipErr()}
        autoComplete="postal-code"
        placeholder="06194"
        required
      />
      <LabeledInput
        id={`${idPrefix}-province`}
        label={t("checkout.province")}
        value={form.province}
        onChange={(v) => onChange("province", v)}
        error={err("province")}
        autoComplete="address-level1"
        placeholder={t("checkout.provincePlaceholder")}
        required
      />
      <LabeledInput
        id={`${idPrefix}-city`}
        label={t("checkout.city")}
        value={form.city}
        onChange={(v) => onChange("city", v)}
        error={err("city")}
        autoComplete="address-level2"
        placeholder={t("checkout.cityPlaceholder")}
        required
      />
      <LabeledInput
        id={`${idPrefix}-line1`}
        label={t("checkout.address")}
        value={form.addressLine1}
        onChange={(v) => onChange("addressLine1", v)}
        error={err("addressLine1")}
        autoComplete="street-address"
        required
      />
      <LabeledInput
        id={`${idPrefix}-line2`}
        label={t("checkout.apartment")}
        value={form.addressLine2 ?? ""}
        onChange={(v) => onChange("addressLine2", v)}
        autoComplete="address-line2"
      />
      <label className="flex items-center gap-2 pt-1 text-xs text-zinc-700">
        <input
          type="checkbox"
          checked={Boolean(form.isDefault)}
          onChange={(e) => onChange("isDefault", e.target.checked)}
          className="size-3.5 accent-zinc-950"
        />
        {t("profile.setAsDefault")}
      </label>
    </div>
  );
}

function LabeledInput({
  id,
  label,
  value,
  onChange,
  error,
  placeholder,
  autoComplete,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-[10px] uppercase tracking-[0.15em] text-zinc-400"
      >
        {label}
        {required ? " *" : ""}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={[
          "w-full border bg-white px-3 py-2.5 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-300",
          error ? "border-red-400" : "border-zinc-200 focus:border-zinc-400",
        ].join(" ")}
      />
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}

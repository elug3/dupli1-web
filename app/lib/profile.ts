import { authedFetch } from "~/lib/auth";
import {
  isValidKRPhone,
  isValidKRPostalCode,
  isValidPCCC,
  normalizeKRPhoneDigits,
  normalizePCCC,
  normalizePostalCode,
} from "~/lib/checkout";

/** Max addresses enforced by auth (`domain.MaxAddressesPerUser`). */
export const MAX_ADDRESSES_PER_USER = 10;

export interface CustomerAddress {
  id: string;
  label?: string;
  recipientName: string;
  recipientPhone: string;
  postalCode: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  province: string;
  /**
   * Korea Personal Customs Clearance Code ("P" + 12 digits). Required by
   * `validateAddressInput`; kept optional in this wire type since older
   * saved addresses may predate the requirement.
   */
  pccc?: string;
  isDefault: boolean;
}

export interface CustomerProfile {
  userId: string;
  displayName: string;
  phone: string;
  defaultAddressId?: string;
  addresses: CustomerAddress[];
}

export interface AddressInput {
  label?: string;
  recipientName: string;
  recipientPhone: string;
  postalCode: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  province: string;
  pccc?: string;
  isDefault?: boolean;
}

interface RawAddress {
  id: string;
  label?: string;
  recipient_name: string;
  recipient_phone: string;
  postal_code: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  province: string;
  pccc?: string;
  is_default: boolean;
}

interface RawProfileView {
  user_id: string;
  display_name?: string;
  phone?: string;
  default_address_id?: string;
  addresses?: RawAddress[] | null;
}

function mapAddress(raw: RawAddress): CustomerAddress {
  return {
    id: raw.id,
    label: raw.label || undefined,
    recipientName: raw.recipient_name,
    recipientPhone: raw.recipient_phone,
    postalCode: raw.postal_code,
    addressLine1: raw.address_line1,
    addressLine2: raw.address_line2 || undefined,
    city: raw.city,
    province: raw.province,
    pccc: raw.pccc || undefined,
    isDefault: Boolean(raw.is_default),
  };
}

function mapProfile(raw: RawProfileView): CustomerProfile {
  return {
    userId: raw.user_id,
    displayName: raw.display_name ?? "",
    phone: raw.phone ?? "",
    defaultAddressId: raw.default_address_id || undefined,
    addresses: (raw.addresses ?? []).map(mapAddress),
  };
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

function toWireAddress(input: AddressInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    recipient_name: input.recipientName.trim(),
    recipient_phone: normalizeKRPhoneDigits(input.recipientPhone),
    postal_code: normalizePostalCode(input.postalCode),
    address_line1: input.addressLine1.trim(),
    city: input.city.trim(),
    province: input.province.trim(),
  };
  const label = input.label?.trim();
  if (label) body.label = label;
  const line2 = input.addressLine2?.trim();
  if (line2) body.address_line2 = line2;
  const pccc = input.pccc?.trim();
  if (pccc) body.pccc = normalizePCCC(pccc);
  if (typeof input.isDefault === "boolean") body.is_default = input.isDefault;
  return body;
}

export function validateAddressInput(input: AddressInput): string | null {
  if (!input.recipientName.trim()) return "recipientName";
  if (!input.recipientPhone.trim() || !isValidKRPhone(input.recipientPhone)) {
    return "recipientPhone";
  }
  if (!input.postalCode.trim() || !isValidKRPostalCode(input.postalCode)) {
    return "postalCode";
  }
  if (!input.addressLine1.trim()) return "addressLine1";
  if (!input.city.trim()) return "city";
  if (!input.province.trim()) return "province";
  if (!input.pccc?.trim() || !isValidPCCC(input.pccc)) return "pccc";
  return null;
}

export function formatAddressSummary(address: CustomerAddress): string {
  const detail = [address.addressLine1, address.addressLine2]
    .filter(Boolean)
    .join(" ");
  return `${address.province} ${address.city} ${detail}`.replace(/\s+/g, " ").trim();
}

export async function getCustomerProfile(): Promise<CustomerProfile> {
  const res = await authedFetch("/api/v1/auth/me/profile");
  if (!res.ok) {
    throw new Error(await readError(res, "Failed to load profile"));
  }
  return mapProfile((await res.json()) as RawProfileView);
}

export async function updateCustomerProfile(patch: {
  displayName?: string;
  phone?: string;
}): Promise<CustomerProfile> {
  const body: Record<string, string> = {};
  if (patch.displayName !== undefined) {
    body.display_name = patch.displayName.trim();
  }
  if (patch.phone !== undefined) {
    body.phone = normalizeKRPhoneDigits(patch.phone);
  }
  const res = await authedFetch("/api/v1/auth/me/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readError(res, "Failed to update profile"));
  }
  return mapProfile((await res.json()) as RawProfileView);
}

export async function listAddresses(): Promise<CustomerAddress[]> {
  const res = await authedFetch("/api/v1/auth/me/addresses");
  if (!res.ok) {
    throw new Error(await readError(res, "Failed to load addresses"));
  }
  const body = (await res.json()) as { addresses?: RawAddress[] | null };
  return (body.addresses ?? []).map(mapAddress);
}

export async function createAddress(
  input: AddressInput
): Promise<CustomerAddress> {
  const res = await authedFetch("/api/v1/auth/me/addresses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toWireAddress(input)),
  });
  if (!res.ok) {
    throw new Error(await readError(res, "Failed to save address"));
  }
  return mapAddress((await res.json()) as RawAddress);
}

export async function updateAddress(
  id: string,
  input: AddressInput
): Promise<CustomerAddress> {
  const res = await authedFetch(
    `/api/v1/auth/me/addresses/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toWireAddress(input)),
    }
  );
  if (!res.ok) {
    throw new Error(await readError(res, "Failed to update address"));
  }
  return mapAddress((await res.json()) as RawAddress);
}

export async function deleteAddress(id: string): Promise<void> {
  const res = await authedFetch(
    `/api/v1/auth/me/addresses/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
  if (!res.ok && res.status !== 204) {
    throw new Error(await readError(res, "Failed to delete address"));
  }
}

export async function setDefaultAddress(id: string): Promise<CustomerAddress> {
  const res = await authedFetch(
    `/api/v1/auth/me/addresses/${encodeURIComponent(id)}/default`,
    { method: "POST" }
  );
  if (!res.ok) {
    throw new Error(await readError(res, "Failed to set default address"));
  }
  return mapAddress((await res.json()) as RawAddress);
}

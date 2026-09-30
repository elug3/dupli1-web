import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { CartLineControls } from "~/components/cart-line-controls";
import { LoadingBadge } from "~/components/loading-badge";
import { canBypassPayment, getMe, type User } from "~/lib/auth";
import { clearCart } from "~/lib/cart";
import {
  type AppliedPromotion,
  evaluatePromotion,
  promotionMessageKey,
  PromotionRejectedError,
  splitDiscount,
} from "~/lib/promotions";
import { useMemberTier, usePromotionWallet } from "~/components/promotion-wallet";
import {
  applySessionPromotion,
  buildCheckoutFulfillment,
  buildCheckoutSessionItem,
  cartHasUnpurchasableItems,
  completeCheckoutSession,
  createCheckoutSession,
  createPayment,
  storefrontNanoCheckoutPath,
  shouldOpenNanoCheckout,
  classifyPaymentReturn,
  resolveResumableOrder,
  getPayment,
  getPaymentSettings,
  getUnpurchasableCartItems,
  formatKRPhoneInput,
  isUnpurchasableVariantError,
  isValidKRPhone,
  isValidKRPostalCode,
  isValidPCCC,
  normalizePCCC,
  normalizePostalCode,
  isUnconfirmedPayment,
  shouldPromoteReturnToUnconfirmed,
  replaceSessionItems,
  resolvePaymentReference,
  type Order,
  type PaymentMethod,
  type PaymentReference,
  type PaymentSettings,
} from "~/lib/checkout";
import {
  clearCheckoutDraft,
  loadCheckoutDraft,
  saveCheckoutDraft,
} from "~/lib/checkout-draft";
import {
  type CustomerAddress,
  type CustomerProfile,
  createAddress,
  getCustomerProfile,
  MAX_ADDRESSES_PER_USER,
} from "~/lib/profile";
import { ListboxSelect, OptionLines } from "~/components/listbox-select";
import { ShippingAddressSelect } from "~/components/shipping-address-select";
import { MY_ACCOUNT_ORDERS_PATH } from "~/lib/account";
import { useLanguage } from "~/lib/i18n";
import { KR_PROVINCES, districtsForProvince } from "~/lib/kr-regions";
import { useCart } from "~/lib/useCart";
import type { CartItem } from "~/lib/cart";
import { useCartMutation } from "~/lib/useCartMutation";
import { OrderSummary } from "./cart";

export function meta() {
  return [
    { title: "Checkout — Dupli1" },
    {
      name: "description",
      content: "Complete your Dupli1 order with secure checkout.",
    },
  ];
}

interface FormState {
  email: string;
  name: string;
  address: string;
  apartment: string;
  city: string;
  province: string;
  zip: string;
  country: string;
  phone: string;
  /** Korea Personal Customs Clearance Code; required by checkout to clear shipments through customs. */
  pccc: string;
  /** credit_card for everyone; bypass only when canBypassPayment (elug3/dupli1#108). */
  paymentMethod: PaymentMethod;
  bypassNote: string;
}

const initialForm: FormState = {
  email: "",
  name: "",
  address: "",
  apartment: "",
  city: "",
  province: "",
  zip: "",
  country: "",
  phone: "",
  pccc: "",
  paymentMethod: "credit_card",
  bypassNote: "",
};

/** Every field the one-page form checks before placing the order. */
const checkoutFields: (keyof FormState)[] = [
  "name",
  "phone",
  "address",
  "city",
  "province",
  "zip",
  "pccc",
  "paymentMethod",
];

/** Promotional code dropdown values that are not a code from the wallet. */
const PROMO_NONE = "none";
const PROMO_ENTER = "enter";

const addressFields: (keyof FormState)[] = [
  "name",
  "phone",
  "address",
  "apartment",
  "city",
  "province",
  "zip",
  "pccc",
];

function applyAddressToForm(
  prev: FormState,
  address: CustomerAddress
): FormState {
  return {
    ...prev,
    name: address.recipientName,
    phone: formatKRPhoneInput(address.recipientPhone),
    address: address.addressLine1,
    apartment: address.addressLine2 ?? "",
    city: address.city,
    province: address.province,
    zip: address.postalCode,
    pccc: address.pccc ?? "",
  };
}

export default function CheckoutPage() {
  const { t, formatCurrency, translateProductName } = useLanguage();
  const lockedCountry = t("checkout.countryValue");
  const navigate = useNavigate();
  const { items, status, totals } = useCart();
  const mutation = useCartMutation();
  const [form, setForm] = useState<FormState>(initialForm);
  const [promotion, setPromotion] = useState<AppliedPromotion | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [promoError, setPromoError] = useState("");
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>(
    {}
  );
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [productUnavailableOpen, setProductUnavailableOpen] = useState(false);
  const [unavailableProducts, setUnavailableProducts] = useState<CartItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [promoMode, setPromoMode] = useState<typeof PROMO_NONE | typeof PROMO_ENTER>(
    PROMO_NONE
  );
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(
    null
  );
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | "new" | null>(
    null
  );
  const [saveAddress, setSaveAddress] = useState(false);
  // The saved address the form was filled from before the shopper edited it.
  const [editedAddressId, setEditedAddressId] = useState<string | null>(null);
  const [resumeOrder, setResumeOrder] = useState<Order | null>(null);
  const [resumeDismissed, setResumeDismissed] = useState(false);
  const [resumeNotice, setResumeNotice] = useState<string | null>(null);
  const [resuming, setResuming] = useState(false);
  // NANO returns land back here through dupli1's payment handler
  // (appendNanoReturnQuery), which carries ?order_id=&payment_id=&error= and
  // omits any of the three it could not fill rather than sending it blank.
  const [searchParams] = useSearchParams();
  const returnedOrderId = searchParams.get("order_id") ?? undefined;
  const returnedPaymentId = searchParams.get("payment_id") ?? undefined;
  const cameBackFromFailedPayment = Boolean(returnedOrderId);
  // An approval the backend could not verify must never invite a retry: the
  // card may already be charged (elug3/dupli1#232).
  const [paymentUnconfirmed, setPaymentUnconfirmed] = useState(
    () => classifyPaymentReturn(searchParams.get("error")) === "unconfirmed"
  );
  const [draftRestored, setDraftRestored] = useState(false);
  // A ref, not state: the profile fetch resolves inside a closure and must see
  // the current value without re-running its effect.
  const draftAppliedRef = useRef(false);

  const allowBypass = canBypassPayment(sessionUser);
  // Settings still loading (null) keeps card visible so the step never renders empty.
  const paymentMethodOptions: PaymentMethod[] = [];
  if (!paymentSettings || paymentSettings.methodCreditCard) {
    paymentMethodOptions.push("credit_card");
  }
  if (allowBypass && paymentSettings?.methodBypass) {
    paymentMethodOptions.push("bypass");
  }

  useEffect(() => {
    setMounted(true);
    getPaymentSettings().then(setPaymentSettings);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getMe()
      .then((user) => {
        if (cancelled) return;
        setSessionUser(user);
        if (!user) return;
        // The account's email, never typed: only the confirmation page reads it.
        setForm((prev) => ({ ...prev, email: user.email }));
        getCustomerProfile()
          .then((loaded) => {
            if (cancelled) return;
            setProfile(loaded);
            const defaultAddr =
              loaded.addresses.find((a) => a.id === loaded.defaultAddressId) ??
              loaded.addresses.find((a) => a.isDefault) ??
              loaded.addresses[0];
            setForm((prev) => {
              let next = { ...prev };
              if (!prev.name && loaded.displayName) {
                next.name = loaded.displayName;
              }
              if (!prev.phone && loaded.phone) {
                next.phone = formatKRPhoneInput(loaded.phone);
              }
              if (defaultAddr && !prev.address) {
                next = applyAddressToForm(next, defaultAddr);
              }
              return next;
            });
            if (draftAppliedRef.current) return;
            if (defaultAddr) {
              setSelectedAddressId(defaultAddr.id);
            } else {
              // First order: keep the address for next time unless the
              // shopper unticks it — an empty book meant retyping every order.
              setSelectedAddressId("new");
              setSaveAddress(true);
            }
          })
          .catch(() => {
            if (!cancelled) {
              setProfile(null);
              if (!draftAppliedRef.current) setSelectedAddressId("new");
            }
          });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Snap off a method the backend (or this user's permissions) does not offer.
  useEffect(() => {
    if (!paymentSettings) return;
    if (paymentMethodOptions.includes(form.paymentMethod)) return;
    const fallback = paymentMethodOptions[0] ?? "credit_card";
    setForm((prev) => ({
      ...prev,
      paymentMethod: fallback,
      bypassNote: fallback === "bypass" ? prev.bypassNote : "",
    }));
  }, [paymentSettings, allowBypass, form.paymentMethod]);

  // Look for an order the shopper can still pay. The ?order_id= from a failed
  // NANO return is only a fast path; the order list is the durable source and
  // is what makes this survive a closed tab or cleared storage.
  useEffect(() => {
    const userId = sessionUser?.user_id;
    if (!mounted || !userId) return;
    let cancelled = false;

    async function lookup(customerId: string) {
      try {
        const found = await resolveResumableOrder(customerId, returnedOrderId);
        if (cancelled || !found) return;
        setResumeOrder(found);
      } catch {
        // A failed lookup must never block checkout; the banner just stays off.
      }
    }

    lookup(userId);
    return () => {
      cancelled = true;
    };
  }, [mounted, sessionUser, returnedOrderId]);

  useEffect(() => {
    if (!mounted || !returnedPaymentId || paymentUnconfirmed) return;
    // checkout_failed leaves the payment at requires_payment — the bridge never
    // opened the card window, so that is safe to retry, not a stranded charge.
    if (!shouldPromoteReturnToUnconfirmed(searchParams.get("error"))) return;
    let cancelled = false;
    getPayment(returnedPaymentId)
      .then((payment) => {
        if (cancelled) return;
        if (isUnconfirmedPayment(payment)) setPaymentUnconfirmed(true);
      })
      .catch(() => {
        // Unreadable payment: fall back to the ordinary decline wording.
      });
    return () => {
      cancelled = true;
    };
  }, [mounted, returnedPaymentId, paymentUnconfirmed, searchParams]);

  // Restore the saved form once, after the session is known so the draft can
  // be matched to its owner. Runs before any auto-fill from the profile wins.
  useEffect(() => {
    const userId = sessionUser?.user_id;
    if (!mounted || !userId || draftRestored) return;
    setDraftRestored(true);
    const draft = loadCheckoutDraft<FormState>(userId);
    if (!draft) return;
    draftAppliedRef.current = true;
    setForm(draft.form);
    setSelectedAddressId(draft.selectedAddressId);
    setSaveAddress(draft.saveAddress);
    setPromoInput(draft.promoInput);
    if (draft.promoInput) setPromoMode(PROMO_ENTER);
  }, [mounted, sessionUser, draftRestored]);

  // Persist after the restore has run, so an empty initial form never clobbers
  // a stored draft on the first render.
  useEffect(() => {
    const userId = sessionUser?.user_id;
    if (!mounted || !userId || !draftRestored || submitting) return;
    const timer = setTimeout(() => {
      saveCheckoutDraft<FormState>({
        userId,
        // One page now; the draft format still carries a step.
        activeStep: "shipping",
        form,
        selectedAddressId,
        saveAddress,
        promoInput,
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [
    mounted,
    sessionUser,
    draftRestored,
    submitting,
    form,
    selectedAddressId,
    saveAddress,
    promoInput,
  ]);

  useEffect(() => {
    setForm((prev) => ({ ...prev, country: lockedCountry }));
  }, [lockedCountry]);

  useEffect(() => {
    if (mounted && status === "guest") {
      navigate(`/login?next=${encodeURIComponent("/checkout")}`);
    }
  }, [mounted, status, navigate]);

  useEffect(() => {
    if (!mounted || status !== "ready" || items.length === 0) return;
    const unpurchasable = getUnpurchasableCartItems(items);
    if (unpurchasable.length > 0) {
      openProductUnavailable(unpurchasable);
    }
  }, [mounted, status, items]);

  function openProductUnavailable(
    lines: CartItem[],
    options: { fallbackToAll?: boolean } = {}
  ) {
    const source =
      lines.length > 0 ? lines : options.fallbackToAll ? items : [];
    setUnavailableProducts(source);
    setProductUnavailableOpen(source.length > 0);
  }

  function dismissProductUnavailable() {
    navigate("/cart");
  }

  // A member's tier stacks under the code. Priced against the same delivery
  // quote the summary shows; complete re-asks and is what is charged.
  const tier = useMemberTier(items, totals().shipping);
  const summary = totals((promotion?.discountWon ?? 0) + (tier?.discountWon ?? 0));
  const discountSplit = splitDiscount(summary.discount, promotion?.discountWon ?? 0);
  const checkoutTotal = summary.total;
  const cartBusy = mutation.pendingKey !== null;
  const savedAddresses = profile?.addresses ?? [];
  // Only a signed-in shopper with a loaded, not-full address book can save.
  const canSaveAddress =
    profile !== null && savedAddresses.length < MAX_ADDRESSES_PER_USER;

  // A saved address is shown by the dropdown alone; its fields open only for
  // a new address, or when one of them fails validation.
  const selectedSaved =
    selectedAddressId && selectedAddressId !== "new"
      ? (savedAddresses.find((a) => a.id === selectedAddressId) ?? null)
      : null;
  const hiddenFieldError = addressFields.some(
    (field) => field !== "pccc" && errors[field]
  );
  const showAddressForm = !selectedSaved || hiddenFieldError;
  // Older saved addresses may lack the customs code: ask for that alone.
  const showPcccAlone =
    !showAddressForm && (!selectedSaved?.pccc || Boolean(errors.pccc));
  const paymentMethodLabels: Record<PaymentMethod, string> = {
    credit_card: t("checkout.methodCreditCard"),
    bypass: t("checkout.methodBypass"),
  };
  const placeOrderLabel = t("checkout.placeOrderWithTotal", {
    total: formatCurrency(checkoutTotal),
  });

  // Same wallet the bag shows, so a code the shopper did not apply earlier is
  // still in front of them at the last step.
  const wallet = usePromotionWallet(items, summary.shipping);
  const eligibleCodes = wallet.entries.filter((e) => e.eligible).length;

  async function applyPromo(fromWallet?: string) {
    const code = (fromWallet ?? promoInput).trim();
    if (!code) return;
    setApplyingPromo(true);
    setPromoError("");
    const result = await evaluatePromotion(code, {
      items,
      shippingFeeWon: summary.shipping,
      customerId: sessionUser?.user_id,
    });
    setApplyingPromo(false);
    if (result.ok) {
      setPromotion(result.promotion);
    } else {
      setPromotion(null);
      setPromoError(t(promotionMessageKey(result.rejection)));
    }
  }

  function removePromo() {
    setPromotion(null);
    setPromoError("");
    setPromoInput("");
  }

  function selectPromo(choice: string) {
    if (choice === PROMO_NONE) {
      removePromo();
      setPromoMode(PROMO_NONE);
      return;
    }
    if (choice === PROMO_ENTER) {
      setPromotion(null);
      setPromoError("");
      setPromoMode(PROMO_ENTER);
      requestAnimationFrame(() => document.getElementById("promo-code")?.focus());
      return;
    }
    setPromoMode(PROMO_NONE);
    setPromoInput("");
    void applyPromo(choice);
  }

  // The bag is editable on this page too, so an applied code is re-priced
  // whenever it changes rather than left showing a number the service would
  // no longer agree to.
  useEffect(() => {
    if (!promotion) return;
    let cancelled = false;
    evaluatePromotion(promotion.code, {
      items,
      shippingFeeWon: summary.shipping,
      customerId: sessionUser?.user_id,
    })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setPromotion(result.promotion);
          return;
        }
        // A check we could not make says nothing about the code, so keep the
        // one the shopper applied; checkout re-evaluates authoritatively.
        if (result.rejection.reason === "unavailable") return;
        setPromotion(null);
        setPromoError(t(promotionMessageKey(result.rejection)));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Keyed on the priced bag, not the promotion, so re-pricing cannot loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary.subtotal, summary.itemCount, summary.shipping, sessionUser?.user_id]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    if (
      selectedAddressId &&
      selectedAddressId !== "new" &&
      addressFields.includes(key) &&
      // The customs code alone is asked for on a saved address that lacks
      // it; filling it in is not editing the address.
      !(key === "pccc" && !showAddressForm)
    ) {
      setEditedAddressId(selectedAddressId);
      setSelectedAddressId("new");
      setSaveAddress(false);
    }
  }

  function updateProvince(value: string) {
    updateField("province", value);
    updateField("city", "");
  }

  function selectSavedAddress(address: CustomerAddress) {
    setEditedAddressId(null);
    setSelectedAddressId(address.id);
    setSaveAddress(false);
    setForm((prev) => applyAddressToForm(prev, address));
    setErrors((prev) => ({
      ...prev,
      ...Object.fromEntries(addressFields.map((field) => [field, undefined])),
    }));
  }

  function selectNewAddress() {
    // Leaving a saved (or edited) address empties the location fields, so
    // "Enter a new address" does not show the last address as if it were
    // new. Recipient, phone and PCCC stay: they usually belong to the
    // shopper, not the place.
    if ((selectedAddressId && selectedAddressId !== "new") || editedAddressId) {
      setForm((prev) => ({
        ...prev,
        address: "",
        apartment: "",
        city: "",
        province: "",
        zip: "",
      }));
    }
    setEditedAddressId(null);
    setSelectedAddressId("new");
    // A new address is saved by default (opt-out); editing a pre-filled saved
    // one also becomes "new" but stays unticked (see updateField), so small
    // corrections do not pile up near-duplicates in the book.
    setSaveAddress(canSaveAddress);
  }

  async function handleResumePayment() {
    if (!resumeOrder) return;
    setResuming(true);
    setResumeNotice(null);
    try {
      // Always credit_card: bypass settles instantly, so a bypass order is
      // never left pending long enough to resume. The payment service reuses
      // the order's open payment, so this returns the same NANO session when
      // one is live and mints a fresh one after a failure — never a double
      // charge (verified: two calls both return the same payment id).
      const payment = await createPayment(resumeOrder.id, "credit_card");
      if (shouldOpenNanoCheckout(payment)) {
        // Stay on dupli1-web; the BFF calls the payment-service bridge.
        window.location.assign(storefrontNanoCheckoutPath(payment.id));
        return;
      }
      // Already settled while we were away.
      navigate("/checkout/confirmation", {
        state: { orderId: resumeOrder.id, email: form.email },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      // loadPendingOrder rejects a non-pending order; the window has closed.
      setResumeNotice(
        /not pending|not found/i.test(message)
          ? t("checkout.resumeExpired")
          : t("checkout.resumeLookupFailed")
      );
      setResumeOrder(null);
      setResuming(false);
    }
  }

  function handleResumeExpired() {
    setResumeOrder(null);
    setResumeNotice(t("checkout.resumeExpired"));
  }

  function validateFields(fields: (keyof FormState)[]): keyof FormState | null {
    const next: Partial<Record<keyof FormState, string>> = {};
    let firstInvalidField: keyof FormState | null = null;

    for (const field of fields) {
      if (!form[field].trim()) {
        next[field] = t("checkout.required");
        firstInvalidField ??= field;
      }
    }

    if (fields.includes("phone") && form.phone.trim() && !isValidKRPhone(form.phone)) {
      next.phone = t("checkout.validPhone");
      firstInvalidField ??= "phone";
    }

    if (fields.includes("zip") && form.zip.trim() && !isValidKRPostalCode(form.zip)) {
      next.zip = t("checkout.validZip");
      firstInvalidField ??= "zip";
    }

    if (fields.includes("pccc") && form.pccc.trim() && !isValidPCCC(form.pccc)) {
      next.pccc = t("checkout.validPccc");
      firstInvalidField ??= "pccc";
    }

    if (
      fields.includes("paymentMethod") &&
      !paymentMethodOptions.includes(form.paymentMethod)
    ) {
      next.paymentMethod = t("checkout.paymentUnavailable");
      firstInvalidField ??= "paymentMethod";
    }

    setErrors((prev) => ({
      ...prev,
      ...Object.fromEntries(fields.map((field) => [field, undefined])),
      ...next,
    }));
    return firstInvalidField;
  }


  function scrollToField(field: keyof FormState) {
    requestAnimationFrame(() => {
      const element = document.getElementById(field);
      if (!element) return;
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.focus({ preventScroll: true });
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setCheckoutError(null);
    try {
      const firstInvalidField = validateFields(checkoutFields);
      if (firstInvalidField) {
        scrollToField(firstInvalidField);
        setSubmitting(false);
        return;
      }

      const user = await getMe();
      if (!user) {
        navigate(`/login?next=${encodeURIComponent("/checkout")}`);
        return;
      }

      let addressId =
        selectedAddressId && selectedAddressId !== "new"
          ? selectedAddressId
          : undefined;

      if (saveAddress && canSaveAddress && selectedAddressId === "new") {
        try {
          const created = await createAddress({
            recipientName: form.name,
            recipientPhone: form.phone,
            postalCode: form.zip,
            addressLine1: form.address,
            addressLine2: form.apartment,
            city: form.city,
            province: form.province,
            pccc: form.pccc,
            isDefault: savedAddresses.length === 0,
          });
          addressId = created.id;
          setProfile((prev) =>
            prev
              ? {
                  ...prev,
                  addresses: [...prev.addresses, created],
                  defaultAddressId: created.isDefault
                    ? created.id
                    : prev.defaultAddressId,
                }
              : prev
          );
        } catch {
          // Order can still complete without persisting the address book entry.
        }
      }

      const session = await createCheckoutSession(user.user_id);
      // Prefer canonical sku_id; never send parent product.id as the human sku.
      const sessionItems = items.map((item) =>
        buildCheckoutSessionItem({
          sku: item.sku,
          skuId: item.skuId,
          productId: item.productId,
          quantity: item.quantity,
        })
      );
      if (cartHasUnpurchasableItems(items)) {
        openProductUnavailable(getUnpurchasableCartItems(items));
        setSubmitting(false);
        return;
      }
      await replaceSessionItems(session.id, sessionItems);
      if (promotion) {
        // Authoritative: the service re-prices the code against the session's
        // own lines, so a preview that has since gone stale is refused here
        // rather than carried into the order.
        await applySessionPromotion(session.id, promotion.code);
      }
      // Complete → pending order + stock reserved on dupli1-product inventory.
      // Payment then marks paid (card redirect / bypass); ship commits stock.
      const { order } = await completeCheckoutSession(
        session.id,
        buildCheckoutFulfillment({
          name: form.name,
          phone: form.phone,
          address: form.address,
          apartment: form.apartment,
          city: form.city,
          zip: form.zip,
          province: form.province,
          pccc: form.pccc,
          addressId,
        })
      );
      const payment = await createPayment(order.id, form.paymentMethod, {
        note: form.bypassNote,
      });

      // The order now owns the form contents; a stale draft would only
      // re-populate a checkout the shopper already finished.
      clearCheckoutDraft();

      if (!shouldOpenNanoCheckout(payment)) {
        // Money already taken (bypass), so the bag has served its purpose.
        await clearCart();
        navigate("/checkout/confirmation", {
          state: { orderId: order.id, email: form.email },
        });
      } else {
        // NANO: stay on dupli1-web (`/checkout/pay/:id`). The BFF opens the
        // payment-service bridge; do not send the shopper to `/api/v1/...`.
        // Keep the bag until payment is confirmed — abandoning here must not
        // strand the shopper with an empty bag and an order that expires in
        // 5 minutes. Confirmation clears it once paid.
        window.location.assign(storefrontNanoCheckoutPath(payment.id));
      }
    } catch (err) {
      if (err instanceof PromotionRejectedError) {
        // The code went stale between the preview and here — say which rule
        // refused it, next to the field, and let the shopper try again.
        setPromotion(null);
        setPromoError(t(promotionMessageKey(err.rejection)));
        setSubmitting(false);
        return;
      }
      const message =
        err instanceof Error ? err.message : t("login.somethingWentWrong");
      if (isUnpurchasableVariantError(message)) {
        const unpurchasable = getUnpurchasableCartItems(items);
        openProductUnavailable(unpurchasable, { fallbackToAll: true });
      } else {
        setCheckoutError(message);
      }
      setSubmitting(false);
    }
  }

  if (!mounted || status === "idle" || status === "loading" || status === "guest") {
    return (
      <main className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 md:px-10">
          <div className="h-8 w-48 animate-pulse bg-zinc-100" />
        </div>
      </main>
    );
  }

  // Warn on every unconfirmed return, with whatever reference we can muster.
  // Gating this on ?order_id= hid the warning in exactly the cases dupli1 could
  // not tie the callback to an order — where a stranded charge is most likely.
  const unconfirmedNotice = paymentUnconfirmed ? (
    <UnconfirmedPaymentNotice
      reference={resolvePaymentReference({
        returnedOrderId,
        resumableOrderId: resumeOrder?.id,
        returnedPaymentId,
      })}
    />
  ) : null;

  const resumeBanner =
    resumeOrder && !resumeDismissed && !paymentUnconfirmed ? (
      <ResumePaymentBanner
        order={resumeOrder}
        failed={cameBackFromFailedPayment}
        resuming={resuming}
        onResume={handleResumePayment}
        onDismiss={() => setResumeDismissed(true)}
        onExpired={handleResumeExpired}
      />
    ) : null;

  const resumeNoticeBanner = resumeNotice ? (
    <p className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {resumeNotice}
    </p>
  ) : null;

  if (items.length === 0) {
    return (
      <main className="bg-white">
        <div className="mx-auto max-w-3xl space-y-4 px-4 pt-8 md:px-10">
          {unconfirmedNotice}
          {resumeBanner}
          {resumeNoticeBanner}
        </div>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4">
          <p
            className="text-3xl font-light text-zinc-950"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("checkout.nothingToCheckout")}
          </p>
          <p className="text-sm text-zinc-400">
            {t("checkout.emptyBag")}
          </p>
          <Link
            to="/"
            className="mt-2 inline-flex h-12 items-center bg-zinc-950 px-8 text-[10px] font-semibold uppercase tracking-widest text-white transition hover:bg-zinc-800"
          >
            {t("cart.continueShopping")}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-white">
      <ProductUnavailableDialog
        open={productUnavailableOpen}
        items={unavailableProducts}
        onConfirm={dismissProductUnavailable}
      />
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-10 md:py-14">
        <Link
          to="/cart"
          className="mb-8 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400 transition hover:text-zinc-950"
        >
          <BackIcon />
          {t("checkout.backToBag")}
        </Link>

        <div className="mb-10 md:mb-14">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-400">
            {t("checkout.secureCheckout")}
          </p>
          <h1
            className="mt-2 text-4xl font-light tracking-tight text-zinc-950 md:text-5xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("checkout.completeOrder")}
          </h1>
        </div>

        {(unconfirmedNotice || resumeBanner || resumeNoticeBanner) && (
          <div className="mb-8 space-y-4">
            {unconfirmedNotice}
            {resumeBanner}
            {resumeNoticeBanner}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          // Our own messages (required, phone, PCCC), not the browser's.
          noValidate
          className="grid gap-12 lg:grid-cols-[1fr_380px] lg:gap-16"
        >
          <div className="space-y-8">
            <FieldGroup>
              {profile !== null && (
                <ShippingAddressSelect
                  addresses={savedAddresses}
                  value={selectedAddressId}
                  editedFrom={
                    savedAddresses.find((a) => a.id === editedAddressId) ??
                    null
                  }
                  onSelectAddress={selectSavedAddress}
                  onSelectNew={selectNewAddress}
                />
              )}
              {showAddressForm && (
                <>
                  <Field
                    label={t("checkout.name")}
                    id="name"
                    value={form.name}
                    error={errors.name}
                    onChange={(v) => updateField("name", v)}
                    autoComplete="name"
                    required
                  />
                  <Field
                    label={t("checkout.phone")}
                    id="phone"
                    type="tel"
                    value={form.phone}
                    error={errors.phone}
                    onChange={(v) => updateField("phone", formatKRPhoneInput(v))}
                    autoComplete="tel"
                    inputMode="numeric"
                    maxLength={13}
                    placeholder="010-1234-5678"
                    required
                  />
                  <Field
                    label={t("checkout.address")}
                    id="address"
                    value={form.address}
                    error={errors.address}
                    onChange={(v) => updateField("address", v)}
                    autoComplete="street-address"
                    required
                  />
                  <Field
                    label={t("checkout.apartment")}
                    id="apartment"
                    value={form.apartment}
                    onChange={(v) => updateField("apartment", v)}
                    autoComplete="address-line2"
                  />
                  <div className="grid gap-4 md:grid-cols-2">
                    <SelectField
                      label={t("checkout.province")}
                      id="province"
                      value={form.province}
                      error={errors.province}
                      onChange={updateProvince}
                      options={KR_PROVINCES}
                      placeholder={t("checkout.selectProvince")}
                      required
                    />
                    <SelectField
                      label={t("checkout.city")}
                      id="city"
                      value={form.city}
                      error={errors.city}
                      onChange={(v) => updateField("city", v)}
                      options={districtsForProvince(form.province)}
                      placeholder={
                        form.province
                          ? t("checkout.selectDistrict")
                          : t("checkout.selectProvinceFirst")
                      }
                      disabled={!form.province}
                      required
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field
                      label={t("checkout.zip")}
                      id="zip"
                      value={form.zip}
                      error={errors.zip}
                      onChange={(v) => updateField("zip", normalizePostalCode(v))}
                      autoComplete="postal-code"
                      inputMode="numeric"
                      maxLength={5}
                      required
                    />
                    <Field
                      label={t("checkout.country")}
                      id="country"
                      value={form.country}
                      onChange={() => {}}
                      autoComplete="country-name"
                      readOnly
                    />
                  </div>
                </>
              )}
              {(showAddressForm || showPcccAlone) && (
                <div>
                  <Field
                    label={t("checkout.pccc")}
                    id="pccc"
                    value={form.pccc}
                    error={errors.pccc}
                    onChange={(v) => updateField("pccc", normalizePCCC(v))}
                    placeholder={t("checkout.pcccPlaceholder")}
                    maxLength={13}
                    required
                  />
                  <p className="mt-1.5 text-[11px] text-zinc-400">
                    {t("checkout.pcccHint")}
                  </p>
                </div>
              )}
              {showAddressForm && selectedAddressId === "new" && canSaveAddress && (
                <label className="flex items-center gap-2 text-xs text-zinc-700">
                  <input
                    type="checkbox"
                    checked={saveAddress}
                    onChange={(e) => setSaveAddress(e.target.checked)}
                    className="size-3.5 accent-zinc-950"
                  />
                  {t("checkout.saveAddressToAccount")}
                </label>
              )}
            </FieldGroup>

            <FieldGroup>
              {paymentMethodOptions.length > 0 ? (
                <ListboxSelect
                  id="paymentMethod"
                  label={t("checkout.paymentMethod")}
                  value={form.paymentMethod}
                  error={errors.paymentMethod}
                  onChange={(v) => updateField("paymentMethod", v as PaymentMethod)}
                  options={paymentMethodOptions.map((method) => ({
                    value: method,
                    content: (
                      <OptionLines
                        title={paymentMethodLabels[method]}
                        detail={
                          method === "bypass"
                            ? t("checkout.methodBypassHint")
                            : t("checkout.methodCreditCardHint")
                        }
                      />
                    ),
                  }))}
                  selectedContent={
                    <OptionLines
                      title={paymentMethodLabels[form.paymentMethod]}
                      detail={
                        form.paymentMethod === "bypass"
                          ? t("checkout.methodBypassBadge")
                          : t("checkout.methodSecureRedirect")
                      }
                    />
                  }
                />
              ) : (
                <p
                  id="paymentMethod"
                  tabIndex={-1}
                  className="border border-rule px-4 py-4 text-sm text-mute outline-none"
                >
                  {t("checkout.paymentUnavailable")}
                </p>
              )}
              {form.paymentMethod === "bypass" && (
                <Field
                  label={t("checkout.bypassNote")}
                  id="bypassNote"
                  value={form.bypassNote}
                  onChange={(v) => updateField("bypassNote", v)}
                  placeholder={t("checkout.bypassNotePlaceholder")}
                  maxLength={200}
                />
              )}
            </FieldGroup>

            <FieldGroup>
              <ListboxSelect
                label={t("cart.promoCode")}
                value={
                  promotion && wallet.entries.some((e) => e.code === promotion.code)
                    ? promotion.code
                    : promotion
                      ? PROMO_ENTER
                      : promoMode
                }
                onChange={selectPromo}
                options={[
                  {
                    value: PROMO_NONE,
                    content: <OptionLines title={t("checkout.promoNone")} />,
                  },
                  ...wallet.entries.map((entry) => ({
                    value: entry.code,
                    disabled: !entry.eligible,
                    content: (
                      <OptionLines
                        title={entry.code}
                        detail={
                          entry.eligible
                            ? t("promo.walletSaves", {
                                amount: formatCurrency(entry.discountWon),
                              })
                            : entry.rejection
                              ? t(promotionMessageKey(entry.rejection))
                              : entry.description
                        }
                      />
                    ),
                  })),
                  {
                    value: PROMO_ENTER,
                    separated: true,
                    content: (
                      <span className="text-sm font-medium text-ink">
                        + {t("checkout.promoEnter")}
                      </span>
                    ),
                  },
                ]}
                selectedContent={
                  promotion ? (
                    <OptionLines
                      title={promotion.code}
                      detail={t("cart.discountApplied", {
                        amount: formatCurrency(discountSplit.codeWon),
                      })}
                    />
                  ) : promoMode === PROMO_ENTER ? (
                    <OptionLines title={t("checkout.promoEnter")} />
                  ) : (
                    <OptionLines
                      title={t("checkout.promoNone")}
                      detail={
                        eligibleCodes > 0
                          ? t("checkout.promoAvailable", { count: eligibleCodes })
                          : undefined
                      }
                    />
                  )
                }
              />
              {promoMode === PROMO_ENTER && !promotion && (
                <div className="flex gap-2">
                  <input
                    id="promo-code"
                    type="text"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void applyPromo();
                      }
                    }}
                    placeholder={t("cart.promoCode")}
                    disabled={applyingPromo}
                    className="h-12 flex-1 border border-rule bg-white px-4 text-sm text-ink outline-none transition-colors duration-300 ease-lux focus:border-ink"
                  />
                  <button
                    type="button"
                    onClick={() => void applyPromo()}
                    disabled={applyingPromo}
                    className="h-12 rounded-full border border-ink px-6 text-[10px] font-semibold uppercase tracking-widest text-ink transition-colors duration-300 ease-lux hover:bg-ink hover:text-white disabled:cursor-wait disabled:opacity-60"
                  >
                    {t("cart.apply")}
                  </button>
                </div>
              )}
              {promoError && (
                <p className="text-caption text-alert">{promoError}</p>
              )}
            </FieldGroup>

            {checkoutError && (
              <p className="rounded bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                {checkoutError}
              </p>
            )}

            <div className="space-y-6 lg:hidden">
              <MiniBag
                items={items}
                shipping={summary.shipping}
                total={checkoutTotal}
                mutation={mutation}
              />
              <PlaceOrderButton
                label={submitting ? t("checkout.processing") : placeOrderLabel}
                disabled={submitting || cartBusy}
              />
            </div>
          </div>

          <aside className="hidden lg:block lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:self-start">
            <div className="mb-6 space-y-6 border-b border-zinc-100 pb-6">
              {items.map((item) => (
                <div key={item.skuId ?? item.sku}>
                  <div className="flex gap-4">
                    <div className="relative h-20 w-16 shrink-0 overflow-hidden bg-zinc-50">
                      <img
                        src={item.image}
                        alt={translateProductName(item.productId, item.name)}
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center bg-zinc-950 text-[10px] text-white">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-widest text-zinc-400">
                        {item.brand}
                      </p>
                      <p className="truncate text-sm text-zinc-950">
                        {translateProductName(item.productId, item.name)}
                      </p>
                    </div>
                  </div>
                  <CartLineControls
                    sku={item.sku}
                    skuId={item.skuId}
                    quantity={item.quantity}
                    price={item.price}
                    mutation={mutation}
                  />
                </div>
              ))}
            </div>

            <OrderSummary
              summary={summary}
              promotion={promotion}
              tier={tier}
              promoInput={promoInput}
              promoError={promoError}
              applyingPromo={applyingPromo}
              onPromoInputChange={setPromoInput}
              onApplyPromo={(code) => applyPromo(code)}
              onRemovePromo={removePromo}
              walletEntries={wallet.entries}
              showPromo={false}
            />

            <div className="mt-4">
              <PlaceOrderButton
                label={submitting ? t("checkout.processing") : placeOrderLabel}
                disabled={submitting || cartBusy}
              />
            </div>
          </aside>
        </form>
      </div>
    </main>
  );
}

/**
 * Shown when the PG approved a payment that dupli1 could not verify, so the
 * card may already be charged while the order is still unpaid. Deliberately
 * offers no way to pay again — see elug3/dupli1#232.
 */
function UnconfirmedPaymentNotice({
  reference,
}: {
  reference: PaymentReference;
}) {
  const { t } = useLanguage();

  // Support needs something to search on, so quote whichever id survived the
  // return. With none, the warning still stands — it just cannot name the order.
  const [bodyKey, contactKey, values] =
    reference === null
      ? [
          "checkout.unconfirmedBodyNoRef",
          "checkout.unconfirmedContactNoRef",
          undefined,
        ]
      : reference.kind === "order"
        ? [
            "checkout.unconfirmedBody",
            "checkout.unconfirmedContact",
            { order: reference.value },
          ]
        : [
            "checkout.unconfirmedBodyPayment",
            "checkout.unconfirmedContactPayment",
            { ref: reference.value },
          ];

  return (
    <div
      role="alert"
      className="border border-amber-300 bg-amber-50 px-4 py-4 md:px-6"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-800">
        {t("checkout.unconfirmedTitle")}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-amber-900">
        {t(bodyKey, values)}
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-amber-700">
        {t(contactKey, values)}
      </p>
      <Link
        to={MY_ACCOUNT_ORDERS_PATH}
        className="mt-4 inline-flex h-11 items-center justify-center border border-amber-400 px-5 text-[10px] font-semibold uppercase tracking-widest text-amber-900 transition hover:bg-amber-100"
      >
        {t("checkout.unconfirmedViewOrders")}
      </Link>
    </div>
  );
}

/**
 * Offers a second run at an order that is `pending` and still inside its
 * 5-minute unpaid window. Counts down to that deadline and retires itself when
 * it passes, since the order is canceled and its stock released server-side.
 */
function ResumePaymentBanner({
  order,
  failed,
  resuming,
  onResume,
  onDismiss,
  onExpired,
}: {
  order: Order;
  failed: boolean;
  resuming: boolean;
  onResume: () => void;
  onDismiss: () => void;
  onExpired: () => void;
}) {
  const { t, formatCurrency } = useLanguage();
  const dueAt = order.paymentDueAtMs;
  const [remainingMs, setRemainingMs] = useState(() =>
    dueAt === undefined ? null : dueAt - Date.now()
  );

  useEffect(() => {
    if (dueAt === undefined) return;
    // Recompute from the deadline rather than decrementing, so a backgrounded
    // tab (throttled timers) does not drift.
    function tick() {
      const left = dueAt! - Date.now();
      setRemainingMs(left);
      if (left <= 0) onExpired();
    }
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [dueAt, onExpired]);

  if (remainingMs !== null && remainingMs <= 0) return null;

  return (
    <div
      role="status"
      className="border border-ink bg-ground px-4 py-4 md:px-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8a6d33]">
            {t("checkout.resumeTitle")}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-700">
            {t(failed ? "checkout.resumeFailedBody" : "checkout.resumeBody", {
              order: order.id,
              total: formatCurrency(order.totalWon),
            })}
          </p>
          {remainingMs !== null && (
            <p className="mt-1 text-[11px] font-medium tabular-nums text-[#8a6d33]">
              {t("checkout.resumeExpiresIn", { time: formatCountdown(remainingMs) })}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onResume}
            disabled={resuming}
            className="flex h-11 items-center justify-center bg-zinc-950 px-6 text-[10px] font-semibold uppercase tracking-widest text-white transition hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-70"
          >
            {resuming ? t("checkout.resumeResuming") : t("checkout.resumeAction")}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            disabled={resuming}
            className="flex h-11 items-center justify-center px-4 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 transition hover:text-zinc-950 disabled:opacity-50"
          >
            {t("checkout.resumeDismiss")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** mm:ss, floored at zero. */
function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function ProductUnavailableDialog({
  open,
  items,
  onConfirm,
}: {
  open: boolean;
  items: CartItem[];
  onConfirm: () => void;
}) {
  const { t, translateProductName } = useLanguage();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onConfirm();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onConfirm]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-unavailable-title"
      aria-describedby="product-unavailable-description"
    >
      <div className="w-full max-w-lg border border-zinc-200 bg-white p-8 shadow-xl">
        <h2
          id="product-unavailable-title"
          className="text-2xl font-light text-zinc-950"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("checkout.productUnavailableTitle")}
        </h2>
        <p
          id="product-unavailable-description"
          className="mt-4 text-sm leading-relaxed text-zinc-500"
        >
          {t("checkout.productUnavailableMessage")}
        </p>
        {items.length > 0 && (
          <ul className="mt-6 max-h-60 space-y-3 overflow-y-auto" aria-label={t("checkout.productUnavailableList")}>
            {items.map((item) => (
              <li
                key={item.skuId ?? item.sku}
                className="flex gap-3 border border-zinc-100 bg-zinc-50/50 p-3"
              >
                <div className="h-16 w-12 shrink-0 overflow-hidden bg-zinc-50">
                  <img
                    src={item.image}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-widest text-zinc-400">
                    {item.brand}
                  </p>
                  <p className="truncate text-sm font-medium text-zinc-950">
                    {translateProductName(item.productId, item.name)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-400">
                    {t("checkout.productUnavailableQuantity", {
                      count: item.quantity,
                    })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={onConfirm}
          className="mt-8 flex h-12 w-full items-center justify-center bg-zinc-950 text-[10px] font-semibold uppercase tracking-widest text-white transition hover:bg-zinc-800"
        >
          {t("checkout.productUnavailableAction")}
        </button>
      </div>
    </div>
  );
}

/** Sub-group inside a step, e.g. Contact vs Shipping within step 01. */
function FieldGroup({
  title,
  children,
  divided = false,
}: {
  /** Omitted when the section heading already names the group. */
  title?: string;
  children: React.ReactNode;
  divided?: boolean;
}) {
  return (
    <div className={divided ? "space-y-4 border-t border-zinc-100 pt-8" : "space-y-4"}>
      {title && (
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

function Field({
  label,
  id,
  value,
  error,
  onChange,
  type = "text",
  autoComplete,
  placeholder,
  inputMode,
  maxLength,
  onKeyDown,
  required = false,
  readOnly = false,
}: {
  label: string;
  id: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  required?: boolean;
  readOnly?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-zinc-600"
      >
        {label}
        {required && (
          <span className="ml-0.5 text-red-500" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        required={required}
        readOnly={readOnly}
        aria-required={required}
        aria-readonly={readOnly}
        onKeyDown={onKeyDown}
        onChange={(e) => onChange(e.target.value)}
        className={[
          "h-12 w-full scroll-mt-32 border bg-white px-4 text-sm text-zinc-950 outline-none transition",
          readOnly
            ? "cursor-default border-zinc-100 bg-zinc-50 text-zinc-500"
            : error
              ? "border-red-400 focus:border-red-500"
              : "border-zinc-200 focus:border-zinc-950",
        ].join(" ")}
      />
      {error && <p className="mt-1.5 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}

function SelectField({
  label,
  id,
  value,
  error,
  onChange,
  options,
  placeholder,
  required = false,
  disabled = false,
}: {
  label: string;
  id: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-zinc-600"
      >
        {label}
        {required && (
          <span className="ml-0.5 text-red-500" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <select
        id={id}
        value={value}
        required={required}
        disabled={disabled}
        aria-required={required}
        onChange={(e) => onChange(e.target.value)}
        className={[
          "h-12 w-full scroll-mt-32 border bg-white px-4 text-sm text-zinc-950 outline-none transition",
          disabled
            ? "cursor-not-allowed border-zinc-100 bg-zinc-50 text-zinc-400"
            : error
              ? "border-red-400 focus:border-red-500"
              : "border-zinc-200 focus:border-zinc-950",
        ].join(" ")}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {error && <p className="mt-1.5 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}

function PlaceOrderButton({
  label,
  disabled,
}: {
  label: string;
  disabled: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="flex h-14 w-full items-center justify-center rounded-full bg-ink text-[11px] font-medium uppercase tracking-widest text-white transition-colors duration-300 ease-lux hover:bg-black disabled:cursor-wait disabled:opacity-70"
    >
      {label}
    </button>
  );
}

function MiniBag({
  items,
  shipping,
  total,
  mutation,
}: {
  items: ReturnType<typeof useCart>["items"];
  shipping: number;
  total: number;
  mutation: ReturnType<typeof useCartMutation>;
}) {
  const { t, formatCurrency, translateProductName } = useLanguage();

  return (
    <div className="border border-zinc-100 bg-zinc-50/50 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-950">
        {t("checkout.yourBag", { count: items.length })}
      </p>
      <ul className="mt-3 space-y-4">
        {items.map((item) => {
          const pending = mutation.isPending(item.sku, item.skuId);
          const action = mutation.getAction(item.sku, item.skuId);

          return (
            <li
              key={item.skuId ?? item.sku}
              className="border-b border-zinc-100 pb-4 last:border-0 last:pb-0"
            >
              <div className="flex justify-between gap-3 text-sm">
                <span className="truncate text-zinc-600">
                  {translateProductName(item.productId, item.name)}
                </span>
                <span className="shrink-0 font-medium text-zinc-950">
                  {formatCurrency(item.price * item.quantity)}
                </span>
              </div>
              {pending && action === "remove" ? (
                <div className="mt-2">
                  <LoadingBadge label={t("cart.removing")} />
                </div>
              ) : (
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="relative">
                    {pending &&
                      (action === "increase" || action === "decrease") && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-50/90">
                          <LoadingBadge label={t("cart.updating")} />
                        </div>
                      )}
                    <MiniQuantityControl
                      quantity={item.quantity}
                      disabled={pending}
                      onDecrease={() =>
                        mutation.decreaseQuantity(item.sku, item.quantity, item.skuId)
                      }
                      onIncrease={() =>
                        mutation.increaseQuantity(item.sku, item.quantity, item.skuId)
                      }
                    />
                  </div>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => mutation.removeItem(item.sku, item.skuId)}
                    className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 transition hover:text-zinc-950 disabled:cursor-wait disabled:opacity-50"
                  >
                    {t("cart.remove")}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <dl className="mt-4 space-y-2 border-t border-zinc-200 pt-4 text-sm">
        <div className="flex justify-between text-zinc-600">
          <dt>{t("cart.shipping")}</dt>
          <dd className="font-medium text-zinc-950">
            {shipping === 0 ? t("cart.complimentary") : formatCurrency(shipping)}
          </dd>
        </div>
        <div className="flex justify-between font-semibold text-zinc-950">
          <dt>{t("cart.total")}</dt>
          <dd>{formatCurrency(total)}</dd>
        </div>
      </dl>
    </div>
  );
}

function MiniQuantityControl({
  quantity,
  onDecrease,
  onIncrease,
  disabled = false,
}: {
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
  disabled?: boolean;
}) {
  const { t } = useLanguage();

  return (
    <div className="inline-flex items-center border border-zinc-200 bg-white">
      <button
        type="button"
        onClick={onDecrease}
        disabled={disabled}
        aria-label={t("cart.decreaseQuantity")}
        className="flex h-8 w-8 items-center justify-center text-zinc-500 transition hover:text-zinc-950 disabled:cursor-wait disabled:opacity-50"
      >
        <span aria-hidden="true">−</span>
      </button>
      <span className="flex h-8 w-8 items-center justify-center text-xs font-medium text-zinc-950">
        {quantity}
      </span>
      <button
        type="button"
        onClick={onIncrease}
        disabled={disabled}
        aria-label={t("cart.increaseQuantity")}
        className="flex h-8 w-8 items-center justify-center text-zinc-500 transition hover:text-zinc-950 disabled:cursor-wait disabled:opacity-50"
      >
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}

function BackIcon() {
  return (
    <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none">
      <path d="m15 18-6-6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

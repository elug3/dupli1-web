import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { CartLineControls } from "~/components/cart-line-controls";
import { LoadingBadge } from "~/components/loading-badge";
import { canBypassPayment, getMe, type User } from "~/lib/auth";
import { clearCart, redeemCoupon, type RedeemedCoupon } from "~/lib/cart";
import {
  applySessionCoupon,
  blocksNewCheckoutOrder,
  buildCheckoutFulfillment,
  buildCheckoutSessionItem,
  cartHasUnpurchasableItems,
  completeCheckoutSession,
  createCheckoutSession,
  createPayment,
  classifyPaymentReturn,
  findResumableOrder,
  getOrder,
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
  isResumableOrder,
  isUnconfirmedPayment,
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
  formatAddressSummary,
  getCustomerProfile,
} from "~/lib/profile";
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

const checkoutSteps = ["shipping", "payment", "review"] as const;
type CheckoutStep = (typeof checkoutSteps)[number];

/** Fields each step owns; the review step re-validates the two before it. */
const stepFields: Record<CheckoutStep, (keyof FormState)[]> = {
  shipping: [
    "email",
    "phone",
    "name",
    "address",
    "city",
    "province",
    "zip",
    "pccc",
  ],
  payment: ["paymentMethod"],
  review: [],
};

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
  const [coupon, setCoupon] = useState<RedeemedCoupon | null>(null);
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
  const [activeStep, setActiveStep] = useState<CheckoutStep>("shipping");
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(
    null
  );
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | "new" | null>(
    null
  );
  const [saveAddress, setSaveAddress] = useState(false);
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
        setForm((prev) =>
          prev.email ? prev : { ...prev, email: user.email }
        );
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
                next.phone = loaded.phone;
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
              setSelectedAddressId("new");
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
        const found = returnedOrderId
          ? await getOrder(returnedOrderId)
          : await findResumableOrder(customerId);
        if (cancelled || !found) return;
        // A returned order belonging to someone else, or already paid, is not
        // ours to offer — fall through to showing nothing.
        if (found.customerId !== customerId || !isResumableOrder(found)) return;
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
  }, [mounted, returnedPaymentId, paymentUnconfirmed]);

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
    setActiveStep(draft.activeStep as CheckoutStep);
    setSelectedAddressId(draft.selectedAddressId);
    setSaveAddress(draft.saveAddress);
    setPromoInput(draft.promoInput);
  }, [mounted, sessionUser, draftRestored]);

  // Persist after the restore has run, so an empty initial form never clobbers
  // a stored draft on the first render.
  useEffect(() => {
    const userId = sessionUser?.user_id;
    if (!mounted || !userId || !draftRestored || submitting) return;
    const timer = setTimeout(() => {
      saveCheckoutDraft<FormState>({
        userId,
        activeStep,
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
    activeStep,
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

  const summary = totals(coupon?.discount ?? 0);
  const checkoutTotal = summary.total;
  const cartBusy = mutation.pendingKey !== null;
  const savedAddresses = profile?.addresses ?? [];

  const activeStepIndex = checkoutSteps.indexOf(activeStep);
  const nextStep = checkoutSteps[activeStepIndex + 1];
  const previousStep = checkoutSteps[activeStepIndex - 1];
  const isReviewStep = activeStep === "review";
  const stepLabels: Record<CheckoutStep, string> = {
    shipping: t("checkout.stepShipping"),
    payment: t("checkout.stepPayment"),
    review: t("checkout.stepReview"),
  };
  const paymentMethodLabels: Record<PaymentMethod, string> = {
    credit_card: t("checkout.methodCreditCard"),
    bypass: t("checkout.methodBypass"),
  };
  const primaryActionLabel =
    activeStep === "shipping"
      ? t("checkout.continueToPayment")
      : activeStep === "payment"
        ? t("checkout.continueToReview")
        : t("checkout.placeOrderWithTotal", {
            total: formatCurrency(checkoutTotal),
          });

  async function applyPromo() {
    const code = promoInput.trim();
    if (!code) return;
    setApplyingPromo(true);
    setPromoError("");
    const redeemed = await redeemCoupon(code);
    setApplyingPromo(false);
    if (redeemed) {
      setCoupon(redeemed);
    } else {
      setCoupon(null);
      setPromoError(t("checkout.invalidPromo"));
    }
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    if (
      selectedAddressId &&
      selectedAddressId !== "new" &&
      addressFields.includes(key)
    ) {
      setSelectedAddressId("new");
      setSaveAddress(false);
    }
  }

  function updateProvince(value: string) {
    updateField("province", value);
    updateField("city", "");
  }

  function selectSavedAddress(address: CustomerAddress) {
    setSelectedAddressId(address.id);
    setSaveAddress(false);
    setForm((prev) => applyAddressToForm(prev, address));
    setErrors((prev) => ({
      ...prev,
      ...Object.fromEntries(addressFields.map((field) => [field, undefined])),
    }));
  }

  function selectNewAddress() {
    setSelectedAddressId("new");
    setSaveAddress(false);
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
      if (payment.checkoutUrl && payment.status !== "succeeded") {
        window.location.assign(payment.checkoutUrl);
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

    if (fields.includes("email") && form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      next.email = t("checkout.validEmail");
      firstInvalidField ??= "email";
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

  function validateStep(step: CheckoutStep): keyof FormState | null {
    return validateFields(stepFields[step]);
  }

  function scrollToField(field: keyof FormState) {
    requestAnimationFrame(() => {
      const element = document.getElementById(field);
      if (!element) return;
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.focus({ preventScroll: true });
    });
  }

  function goToStep(step: CheckoutStep) {
    setCheckoutError(null);
    setActiveStep(step);
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function handleNextStep() {
    if (!nextStep) return;
    const firstInvalidField = validateStep(activeStep);
    if (firstInvalidField) {
      scrollToField(firstInvalidField);
      return;
    }
    goToStep(nextStep);
  }

  function handlePreviousStep() {
    if (previousStep) goToStep(previousStep);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isReviewStep) {
      handleNextStep();
      return;
    }

    setSubmitting(true);
    setCheckoutError(null);
    try {
      if (blocksNewCheckoutOrder({ paymentUnconfirmed, resumeOrder })) {
        setCheckoutError(
          paymentUnconfirmed
            ? t("checkout.unconfirmedTitle")
            : t("checkout.resumeTitle")
        );
        setSubmitting(false);
        return;
      }

      // Review shows a read-only copy of both earlier steps; re-check them so a
      // method that disappeared (or a cleared field) cannot reach the gateway.
      for (const step of ["shipping", "payment"] as const) {
        const firstInvalidField = validateStep(step);
        if (firstInvalidField) {
          // Not goToStep: that scrolls to top, which would fight scrollToField.
          setActiveStep(step);
          scrollToField(firstInvalidField);
          setSubmitting(false);
          return;
        }
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

      if (saveAddress && selectedAddressId === "new") {
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
      if (coupon) {
        await applySessionCoupon(session.id, coupon.code);
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

      if (!payment.checkoutUrl || payment.status === "succeeded") {
        // Money already taken (bypass), so the bag has served its purpose.
        await clearCart();
        navigate("/checkout/confirmation", {
          state: { orderId: order.id, email: form.email },
        });
      } else {
        // NANO: leave Dupli1 for the hosted certified checkout window.
        // Deliberately keep the bag until payment is confirmed — abandoning
        // here must not strand the shopper with an empty bag and an order
        // that expires in 5 minutes. Confirmation clears it once paid.
        window.location.assign(payment.checkoutUrl);
      }
    } catch (err) {
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

        <CheckoutStepper
          activeStep={activeStep}
          labels={stepLabels}
          steps={checkoutSteps}
          onSelect={goToStep}
        />

        <form
          onSubmit={handleSubmit}
          className="grid gap-12 lg:grid-cols-[1fr_380px] lg:gap-16"
        >
          <div className="space-y-8">
            {activeStep === "shipping" && (
              <CheckoutSection step="01" title={t("checkout.stepShipping")}>
                <FieldGroup title={t("checkout.contact")}>
                  <Field
                    label={t("checkout.email")}
                    id="email"
                    type="email"
                    value={form.email}
                    error={errors.email}
                    onChange={(v) => updateField("email", v)}
                    autoComplete="email"
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
                </FieldGroup>

                <FieldGroup title={t("checkout.shipping")} divided>
                  {savedAddresses.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                        {t("checkout.savedAddresses")}
                      </p>
                      <div className="space-y-2" role="radiogroup" aria-label={t("checkout.savedAddresses")}>
                        {savedAddresses.map((address) => {
                          const selected = selectedAddressId === address.id;
                          return (
                            <label
                              key={address.id}
                              className={[
                                "flex cursor-pointer gap-3 border px-4 py-3 transition",
                                selected
                                  ? "border-zinc-950 bg-zinc-50"
                                  : "border-zinc-200 hover:border-zinc-400",
                              ].join(" ")}
                            >
                              <input
                                type="radio"
                                name="savedAddress"
                                className="mt-1 accent-zinc-950"
                                checked={selected}
                                onChange={() => selectSavedAddress(address)}
                              />
                              <span className="min-w-0">
                                <span className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-medium text-zinc-950">
                                    {address.label?.trim() || address.recipientName}
                                  </span>
                                  {address.isDefault && (
                                    <span className="bg-zinc-950 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
                                      {t("profile.defaultAddress")}
                                    </span>
                                  )}
                                </span>
                                <span className="mt-0.5 block text-xs text-zinc-500">
                                  {address.recipientName} · {address.recipientPhone}
                                </span>
                                <span className="mt-0.5 block text-xs text-zinc-600">
                                  ({address.postalCode}) {formatAddressSummary(address)}
                                </span>
                                {address.pccc && (
                                  <span className="mt-0.5 block text-[11px] text-zinc-400">
                                    {t("checkout.pccc")}: {address.pccc}
                                  </span>
                                )}
                              </span>
                            </label>
                          );
                        })}
                        <label
                          className={[
                            "flex cursor-pointer gap-3 border px-4 py-3 transition",
                            selectedAddressId === "new"
                              ? "border-zinc-950 bg-zinc-50"
                              : "border-zinc-200 hover:border-zinc-400",
                          ].join(" ")}
                        >
                          <input
                            type="radio"
                            name="savedAddress"
                            className="mt-1 accent-zinc-950"
                            checked={selectedAddressId === "new"}
                            onChange={selectNewAddress}
                          />
                          <span className="text-sm text-zinc-950">
                            {t("checkout.useNewAddress")}
                          </span>
                        </label>
                      </div>
                    </div>
                  )}
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
                  {selectedAddressId === "new" && (
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
                  <p className="text-[11px] text-zinc-400">
                    <Link
                      to="/profile"
                      className="underline underline-offset-2 transition hover:text-zinc-700"
                    >
                      {t("checkout.manageAddresses")}
                    </Link>
                  </p>
                </FieldGroup>
              </CheckoutSection>
            )}

            {activeStep === "payment" && (
              <CheckoutSection step="02" title={t("checkout.stepPayment")}>
                <div
                  id="paymentMethod"
                  tabIndex={-1}
                  className="space-y-3 scroll-mt-32 outline-none"
                  role="radiogroup"
                  aria-label={t("checkout.paymentMethod")}
                >
                  {paymentMethodOptions.includes("credit_card") && (
                    <PaymentMethodOption
                      name="paymentMethod"
                      value="credit_card"
                      checked={form.paymentMethod === "credit_card"}
                      title={t("checkout.methodCreditCard")}
                      subtitle={t("checkout.methodCreditCardHint")}
                      badge={t("checkout.methodSecureRedirect")}
                      onChange={() => updateField("paymentMethod", "credit_card")}
                    />
                  )}
                  {paymentMethodOptions.includes("bypass") && (
                    <PaymentMethodOption
                      name="paymentMethod"
                      value="bypass"
                      checked={form.paymentMethod === "bypass"}
                      title={t("checkout.methodBypass")}
                      subtitle={t("checkout.methodBypassHint")}
                      badge={t("checkout.methodBypassBadge")}
                      onChange={() => updateField("paymentMethod", "bypass")}
                    />
                  )}
                  {paymentMethodOptions.length === 0 && (
                    <p className="border border-zinc-200 bg-zinc-50/50 px-4 py-4 text-sm text-zinc-500">
                      {t("checkout.paymentUnavailable")}
                    </p>
                  )}
                </div>
                {errors.paymentMethod && (
                  <p className="text-[11px] text-red-600">{errors.paymentMethod}</p>
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
                <p className="text-sm leading-relaxed text-zinc-500">
                  {form.paymentMethod === "bypass"
                    ? t("checkout.bypassNoteHelp")
                    : t("checkout.paymentNote")}
                </p>
              </CheckoutSection>
            )}

            {activeStep === "review" && (
              <CheckoutSection step="03" title={t("checkout.stepReview")}>
                <p className="text-sm leading-relaxed text-zinc-500">
                  {t("checkout.reviewNote")}
                </p>

                <ReviewBlock
                  title={t("checkout.contact")}
                  onEdit={() => goToStep("shipping")}
                >
                  <p>{form.email}</p>
                  <p>{form.phone}</p>
                </ReviewBlock>

                <ReviewBlock
                  title={t("checkout.stepShipping")}
                  onEdit={() => goToStep("shipping")}
                >
                  <p className="font-medium text-zinc-950">{form.name}</p>
                  <p>
                    ({form.zip}) {form.province} {form.city} {form.address}
                    {form.apartment ? ` ${form.apartment}` : ""}
                  </p>
                  <p>{form.country}</p>
                  <p className="text-zinc-400">
                    {t("checkout.pccc")}: {form.pccc}
                  </p>
                </ReviewBlock>

                <ReviewBlock
                  title={t("checkout.paymentMethod")}
                  onEdit={() => goToStep("payment")}
                >
                  <p className="font-medium text-zinc-950">
                    {paymentMethodLabels[form.paymentMethod]}
                  </p>
                  {form.paymentMethod === "bypass" && form.bypassNote.trim() && (
                    <p className="text-zinc-400">{form.bypassNote}</p>
                  )}
                </ReviewBlock>

                <ReviewBlock
                  title={t("checkout.reviewItems", { count: items.length })}
                  onEdit={() => navigate("/cart")}
                >
                  <ul className="space-y-3">
                    {items.map((item) => (
                      <li
                        key={item.skuId ?? item.sku}
                        className="flex items-center gap-3"
                      >
                        <div className="h-14 w-11 shrink-0 overflow-hidden bg-zinc-50">
                          <img
                            src={item.image}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-zinc-950">
                            {translateProductName(item.productId, item.name)}
                          </p>
                          <p className="text-[11px] text-zinc-400">
                            {t("checkout.reviewQuantity", { count: item.quantity })}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-medium text-zinc-950">
                          {formatCurrency(item.price * item.quantity)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <dl className="mt-4 space-y-2 border-t border-zinc-200 pt-4">
                    <div className="flex justify-between">
                      <dt>{t("cart.subtotal")}</dt>
                      <dd className="text-zinc-950">
                        {formatCurrency(summary.subtotal)}
                      </dd>
                    </div>
                    {summary.promoApplied && coupon && (
                      <div className="flex justify-between text-emerald-700">
                        <dt>{t("cart.promo", { code: coupon.code })}</dt>
                        <dd>−{formatCurrency(summary.discount)}</dd>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <dt>{t("cart.shipping")}</dt>
                      <dd className="text-zinc-950">
                        {summary.shipping === 0
                          ? t("cart.complimentary")
                          : formatCurrency(summary.shipping)}
                      </dd>
                    </div>
                    <div className="flex justify-between border-t border-zinc-200 pt-2 text-base">
                      <dt className="font-semibold uppercase tracking-widest text-zinc-950">
                        {t("cart.total")}
                      </dt>
                      <dd className="text-lg font-semibold text-zinc-950">
                        {formatCurrency(checkoutTotal)}
                      </dd>
                    </div>
                  </dl>
                </ReviewBlock>
              </CheckoutSection>
            )}

            {checkoutError && (
              <p className="rounded bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                {checkoutError}
              </p>
            )}

            <div className="lg:hidden">
              <MiniBag items={items} total={checkoutTotal} mutation={mutation} />
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-zinc-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
              {previousStep ? (
                <button
                  type="button"
                  onClick={handlePreviousStep}
                  className="flex h-12 items-center justify-center border border-zinc-200 px-6 text-[10px] font-semibold uppercase tracking-widest text-zinc-600 transition hover:border-zinc-950 hover:text-zinc-950"
                >
                  {t("checkout.previousStep")}
                </button>
              ) : (
                <span />
              )}
              {isReviewStep ? (
                <button
                  type="submit"
                  disabled={submitting || cartBusy}
                  className="flex h-14 items-center justify-center bg-zinc-950 px-8 text-[10px] font-semibold uppercase tracking-widest text-white transition hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-70 sm:min-w-64"
                >
                  {submitting ? t("checkout.processing") : primaryActionLabel}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={cartBusy}
                  className="flex h-14 items-center justify-center bg-zinc-950 px-8 text-[10px] font-semibold uppercase tracking-widest text-white transition hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-70 sm:min-w-64"
                >
                  {primaryActionLabel}
                </button>
              )}
            </div>
          </div>

          <aside className="hidden lg:block lg:sticky lg:top-28 lg:self-start">
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
              coupon={coupon}
              promoInput={promoInput}
              promoError={promoError}
              applyingPromo={applyingPromo}
              onPromoInputChange={setPromoInput}
              onApplyPromo={applyPromo}
              checkoutHref="#"
              checkoutLabel={
                submitting ? t("checkout.processing") : primaryActionLabel
              }
              disabled
            />

            <div className="mt-4 space-y-3">
              {isReviewStep ? (
                <button
                  type="submit"
                  disabled={submitting || cartBusy}
                  className="flex h-14 w-full items-center justify-center bg-zinc-950 text-[10px] font-semibold uppercase tracking-widest text-white transition hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-70"
                >
                  {submitting ? t("checkout.processing") : t("checkout.placeOrder")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={cartBusy}
                  className="flex h-14 w-full items-center justify-center bg-zinc-950 text-[10px] font-semibold uppercase tracking-widest text-white transition hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-70"
                >
                  {primaryActionLabel}
                </button>
              )}
              {previousStep && (
                <button
                  type="button"
                  onClick={handlePreviousStep}
                  className="flex h-12 w-full items-center justify-center border border-zinc-200 text-[10px] font-semibold uppercase tracking-widest text-zinc-600 transition hover:border-zinc-950 hover:text-zinc-950"
                >
                  {t("checkout.previousStep")}
                </button>
              )}
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
        to="/history"
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
      className="border border-[#c8a96e] bg-[#fdfaf4] px-4 py-4 md:px-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8a6d33]">
            {t("checkout.resumeTitle")}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-700">
            {t(failed ? "checkout.resumeFailedBody" : "checkout.resumeBody", {
              order: order.id,
              total: formatCurrency(order.totalCents),
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

function CheckoutStepper({
  activeStep,
  labels,
  steps,
  onSelect,
}: {
  activeStep: CheckoutStep;
  labels: Record<CheckoutStep, string>;
  steps: readonly CheckoutStep[];
  onSelect: (step: CheckoutStep) => void;
}) {
  const { t } = useLanguage();
  const activeIndex = steps.indexOf(activeStep);

  return (
    <ol className="mb-10 grid gap-3 border-y border-zinc-100 py-4 md:mb-12 md:grid-cols-3">
      {steps.map((step, index) => {
        const isActive = step === activeStep;
        // Only completed steps are clickable; moving forward has to validate.
        const isComplete = index < activeIndex;

        return (
          <li key={step}>
            <button
              type="button"
              onClick={() => onSelect(step)}
              disabled={!isComplete}
              aria-current={isActive ? "step" : undefined}
              className="flex w-full items-center gap-3 text-left enabled:cursor-pointer disabled:cursor-default"
            >
              <span
                className={[
                  "flex size-8 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                  isActive
                    ? "border-zinc-950 bg-zinc-950 text-white"
                    : isComplete
                      ? "border-[#c8a96e] bg-[#c8a96e] text-white"
                      : "border-zinc-200 text-zinc-300",
                ].join(" ")}
              >
                {isComplete ? <CheckIcon /> : String(index + 1).padStart(2, "0")}
              </span>
              <span>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
                  {t("checkout.stepCount", {
                    current: index + 1,
                    total: steps.length,
                  })}
                </span>
                <span
                  className={[
                    "block text-sm font-medium",
                    isActive
                      ? "text-zinc-950"
                      : isComplete
                        ? "text-zinc-500 hover:text-zinc-950"
                        : "text-zinc-400",
                  ].join(" ")}
                >
                  {labels[step]}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function CheckoutSection({
  step,
  title,
  children,
}: {
  step: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-zinc-100 pt-10 first:border-t-0 first:pt-0">
      <div className="mb-6 flex items-baseline gap-4">
        <span className="text-[10px] font-semibold tracking-[0.2em] text-[#c8a96e]">
          {step}
        </span>
        <h2
          className="text-2xl font-light text-zinc-950"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {title}
        </h2>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/** Sub-group inside a step, e.g. Contact vs Shipping within step 01. */
function FieldGroup({
  title,
  children,
  divided = false,
}: {
  title: string;
  children: React.ReactNode;
  divided?: boolean;
}) {
  return (
    <div className={divided ? "space-y-4 border-t border-zinc-100 pt-8" : "space-y-4"}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
        {title}
      </p>
      {children}
    </div>
  );
}

function ReviewBlock({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  const { t } = useLanguage();

  return (
    <div className="border border-zinc-100 bg-zinc-50/50 p-4 md:p-6">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-950">
          {title}
        </h3>
        <button
          type="button"
          onClick={onEdit}
          aria-label={t("checkout.editSection", { section: title })}
          className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 underline underline-offset-2 transition hover:text-zinc-950"
        >
          {t("checkout.edit")}
        </button>
      </div>
      <div className="space-y-1 text-sm text-zinc-600">{children}</div>
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

function PaymentMethodOption({
  name,
  value,
  checked,
  title,
  subtitle,
  badge,
  onChange,
  disabled = false,
}: {
  name: string;
  value: string;
  checked: boolean;
  title: string;
  subtitle: string;
  badge: string;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={[
        "flex items-center justify-between gap-4 border px-4 py-4 transition",
        disabled
          ? "cursor-not-allowed border-zinc-100 bg-zinc-50/50 opacity-60"
          : checked
            ? "cursor-pointer border-zinc-950 bg-zinc-50"
            : "cursor-pointer border-zinc-200 hover:border-zinc-400",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <input
          type="radio"
          name={name}
          value={value}
          checked={checked}
          disabled={disabled}
          onChange={onChange}
          className="size-4 accent-zinc-950 disabled:cursor-not-allowed"
        />
        <div>
          <p className="text-sm font-medium text-zinc-950">{title}</p>
          <p className="text-[11px] text-zinc-400">{subtitle}</p>
        </div>
      </div>
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        {badge}
      </span>
    </label>
  );
}

function MiniBag({
  items,
  total,
  mutation,
}: {
  items: ReturnType<typeof useCart>["items"];
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
      <div className="mt-4 flex justify-between border-t border-zinc-200 pt-4 text-sm font-semibold text-zinc-950">
        <span>{t("cart.total")}</span>
        <span>{formatCurrency(total)}</span>
      </div>
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

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none">
      <path d="M20 7 10 17l-5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

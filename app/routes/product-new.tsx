import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { getMe, hasPermission, type User } from "~/lib/auth";
import { createProduct, getCategories, uploadProductImage } from "~/lib/api";
import { useLanguage } from "~/lib/i18n";

export function meta() {
  return [
    { title: "New Product | Dupli1" },
    { name: "description", content: "Add a new product to the catalogue." },
  ];
}

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "textarea" | "select";
  options?: string[];
  required?: boolean;
  placeholder?: string;
}

const SHARED_FIELDS: FieldDef[] = [
  { key: "Name", label: "Name", type: "text", required: true, placeholder: "Product name" },
  { key: "Brand", label: "Brand", type: "text", required: true, placeholder: "Brand name" },
  // Phase C (dupli1-product): create requires existing catalog masters.
  { key: "BrandCode", label: "Brand code", type: "text", required: true, placeholder: "e.g. GUC" },
  { key: "StyleCode", label: "Style code", type: "text", required: true, placeholder: "e.g. TOTE01" },
  { key: "Price", label: "Selling price (₩)", type: "number", required: true, placeholder: "0" },
  { key: "Stock", label: "Stock", type: "number", placeholder: "0" },
  { key: "Description", label: "Description", type: "textarea", placeholder: "Product description…" },
  { key: "Color", label: "Color", type: "text", placeholder: "e.g. Black" },
  { key: "Material", label: "Material", type: "text", placeholder: "e.g. Leather" },
];

const CATEGORY_FIELDS: Record<string, FieldDef[]> = {
  consultations: [
    { key: "Title", label: "Title", type: "text", required: true, placeholder: "Consultation name" },
    { key: "Price", label: "Selling price (₩)", type: "number", required: true, placeholder: "0" },
    { key: "Description", label: "Description", type: "textarea", placeholder: "Describe the consultation…" },
    { key: "Status", label: "Status", type: "select", options: ["available", "unavailable"] },
    { key: "Duration", label: "Duration (min)", type: "number", placeholder: "60" },
  ],
  shoes: [
    ...SHARED_FIELDS,
    { key: "Size", label: "Size", type: "text", placeholder: "e.g. 42" },
    { key: "Gender", label: "Gender", type: "select", options: ["Male", "Female", "Unisex"] },
  ],
  outerwear: [
    ...SHARED_FIELDS,
    { key: "Size", label: "Size", type: "text", placeholder: "e.g. M" },
    { key: "Gender", label: "Gender", type: "select", options: ["Male", "Female", "Unisex"] },
  ],
  bottoms: [
    ...SHARED_FIELDS,
    { key: "Size", label: "Size", type: "text", placeholder: "e.g. 32" },
    { key: "Gender", label: "Gender", type: "select", options: ["Male", "Female", "Unisex"] },
  ],
  bags: [
    ...SHARED_FIELDS,
    { key: "Capacity", label: "Capacity", type: "text", placeholder: "e.g. 20L" },
    {
      key: "ProductType",
      label: "Product Type",
      type: "select",
      options: ["Totes", "Shoulder Bags", "Crossbody", "Mini Bags"],
    },
    {
      key: "Style",
      label: "Style",
      type: "select",
      options: ["Casual", "Evening", "Business", "Weekend", "Statement"],
    },
    {
      key: "Family",
      label: "Family",
      type: "select",
      options: ["Women", "Men", "Kids", "Unisex"],
    },
  ],
  clocks: [
    ...SHARED_FIELDS,
    { key: "Type", label: "Type", type: "select", options: ["Analog", "Digital", "Smart"] },
    { key: "Gender", label: "Gender", type: "select", options: ["Male", "Female", "Unisex"] },
  ],
};

const DISPLAY_NAMES: Record<string, string> = {
  consultations: "Consultations",
  shoes: "Shoes",
  outerwear: "Outerwear",
  bottoms: "Bottoms",
  bags: "Bags",
  clocks: "Watches",
};

const FIELD_LABEL_KEYS: Record<string, string> = {
  Name: "field.name",
  Brand: "product.brand",
  BrandCode: "field.brandCode",
  StyleCode: "field.styleCode",
  Price: "field.price",
  Stock: "field.stock",
  Description: "field.description",
  Color: "field.color",
  Material: "field.material",
  Title: "field.title",
  Status: "field.status",
  Duration: "field.duration",
  Size: "field.size",
  Gender: "field.gender",
  Capacity: "field.capacity",
  Type: "field.type",
  ProductType: "field.productType",
  Style: "field.style",
  Family: "field.family",
};

const FIELD_PLACEHOLDER_KEYS: Record<string, string> = {
  "Product name": "field.productName",
  "Brand name": "field.brandName",
  "Product description…": "field.productDescription",
  "Consultation name": "field.consultationName",
  "Describe the consultation…": "field.consultationDescription",
};

function canManageProducts(user: User): boolean {
  return hasPermission(user, "product.create");
}

export default function ProductNew() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [categories, setCategories] = useState<string[]>(Object.keys(CATEGORY_FIELDS));
  const [category, setCategory] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    getMe().then((u) => {
      setUser(u);
      if (!u) navigate("/login", { replace: true });
    });
    getCategories().then(setCategories).catch(() => {});
  }, []);

  // loading / redirect-in-progress
  if (user === undefined || user === null) {
    return (
      <main className="mx-auto max-w-md px-5 py-8">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-zinc-200" />
      </main>
    );
  }

  if (!canManageProducts(user)) {
    return (
      <main className="mx-auto max-w-md px-5 py-14 text-center">
        <div className="mb-6 flex justify-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-red-50">
            <LockIcon className="size-8 text-red-400" />
          </span>
        </div>
        <h1 className="text-xl font-semibold text-zinc-950">{t("admin.accessDenied")}</h1>
        <p className="mt-2 text-sm text-zinc-500">
          {t("admin.accessDeniedDescription")}
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex h-12 items-center rounded-xl bg-zinc-950 px-8 text-sm font-semibold text-white transition hover:bg-zinc-800"
        >
          {t("admin.goHome")}
        </Link>
      </main>
    );
  }

  if (success) {
    return (
      <main className="mx-auto max-w-md px-5 py-14 text-center">
        <div className="mb-6 flex justify-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-green-50">
            <CheckIcon className="size-8 text-green-500" />
          </span>
        </div>
        <h1 className="text-xl font-semibold text-zinc-950">{t("admin.productAdded")}</h1>
        <p className="mt-2 text-sm text-zinc-500">
          {t("admin.productAddedDescription")}
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              setSuccess(false);
              setValues({});
              setError(null);
            }}
            className="inline-flex h-12 items-center justify-center rounded-xl bg-zinc-950 px-8 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            {t("admin.addAnother")}
          </button>
          <Link
            to="/"
            className="inline-flex h-12 items-center justify-center rounded-xl border border-zinc-200 bg-white px-8 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
          >
            {t("admin.viewProducts")}
          </Link>
        </div>
      </main>
    );
  }

  const fields = CATEGORY_FIELDS[category] ?? [];

  function handleImageChange(file: File | null) {
    setImageFile(file);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data: Record<string, unknown> = {};
      for (const field of fields) {
        const val = values[field.key] ?? "";
        if (field.type === "number") {
          if (val !== "") data[field.key] = Number(val);
        } else if (val) {
          data[field.key] = val;
        }
      }

      let createdId: string | undefined;
      // Create first so multipart image upload can target /products/{id}/images.
      // Color/price seed a default variant that the image attaches to.
      const created = await createProduct(category, data);
      createdId = created.id;

      if (imageFile && createdId) {
        setUploadingImage(true);
        await uploadProductImage(createdId, imageFile);
        setUploadingImage(false);
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.somethingWentWrong"));
      setUploadingImage(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-5 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-950">{t("admin.newProduct")}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t("admin.newProductDescription")}</p>
      </div>

      {/* Category selector */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-950">{t("admin.category")}</h2>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setCategory(cat);
                setValues({});
                setError(null);
              }}
              className={[
                "h-10 shrink-0 rounded-lg border px-4 text-sm font-semibold transition",
                category === cat
                  ? "border-zinc-950 bg-zinc-950 text-white"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400",
              ].join(" ")}
            >
              {t(`admin.category.${cat}`) === `admin.category.${cat}` ? DISPLAY_NAMES[cat] ?? cat : t(`admin.category.${cat}`)}
            </button>
          ))}
        </div>
      </section>

      {/* Form */}
      {category ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map((field) => (
            <FieldInput
              key={field.key}
              field={field}
              value={values[field.key] ?? ""}
              onChange={(val) => setValues((v) => ({ ...v, [field.key]: val }))}
            />
          ))}

          <ImagePicker
            preview={imagePreview}
            onChange={handleImageChange}
          />

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="h-12 w-full rounded-xl bg-zinc-950 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
          >
            {submitting ? (uploadingImage ? t("admin.uploadingImage") : t("admin.saving")) : t("admin.saveProduct")}
          </button>
        </form>
      ) : (
        <p className="py-8 text-center text-sm text-zinc-500">
          {t("admin.selectCategory")}
        </p>
      )}
    </main>
  );
}

interface FieldInputProps {
  field: FieldDef;
  value: string;
  onChange: (val: string) => void;
}

function FieldInput({ field, value, onChange }: FieldInputProps) {
  const { t, translateValue } = useLanguage();
  const base =
    "w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium outline-none ring-zinc-950 transition focus:border-zinc-400 focus:ring-2";
  const label = FIELD_LABEL_KEYS[field.key]
    ? t(FIELD_LABEL_KEYS[field.key])
    : field.label;
  const placeholder =
    field.placeholder && FIELD_PLACEHOLDER_KEYS[field.placeholder]
      ? t(FIELD_PLACEHOLDER_KEYS[field.placeholder])
      : field.placeholder;

  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-zinc-600">
        {label}
        {field.required && <span className="ml-0.5 text-red-500">*</span>}
      </span>

      {field.type === "textarea" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          placeholder={placeholder}
          rows={3}
          className={`${base} py-3`}
        />
      ) : field.type === "select" ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          className={`${base} h-11`}
        >
          <option value="">{t("admin.select")}</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>
              {translateValue("value", opt)}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={field.type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          placeholder={placeholder}
          min={field.type === "number" ? 0 : undefined}
          step={field.key === "Price" ? "0.01" : undefined}
          className={`${base} h-11`}
        />
      )}
    </label>
  );
}

interface ImagePickerProps {
  preview: string | null;
  onChange: (file: File | null) => void;
}

function ImagePicker({ preview, onChange }: ImagePickerProps) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    onChange(file);
  }

  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-zinc-600">{t("admin.productImage")}</span>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFile(e.dataTransfer.files[0]);
        }}
        className="relative flex min-h-36 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-zinc-300 bg-zinc-50 transition hover:border-zinc-400 hover:bg-zinc-100"
      >
        {preview ? (
          <>
            <img src={preview} alt={t("admin.preview")} className="h-36 w-full object-cover" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
              className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-zinc-950/60 text-white transition hover:bg-zinc-950"
            >
              <svg viewBox="0 0 24 24" className="size-3.5" fill="none">
                <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 px-4 py-6 text-center">
            <svg viewBox="0 0 24 24" className="size-8 text-zinc-400" fill="none">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-xs font-medium text-zinc-500">
              {t("admin.imageHint")}
            </p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
    </label>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M6 10V7a6 6 0 0 1 12 0v3M4 10h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1Zm8 5v2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M20 7 10 17l-5-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

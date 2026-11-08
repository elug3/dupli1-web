import { useEffect, useId, useRef, useState } from "react";

import { fetchProduct } from "~/lib/api";
import { useLanguage } from "~/lib/i18n";
import {
  type DraftError,
  type FitResult,
  type MyReview,
  type ReviewDraft,
  type ReviewLine,
  FIT_LABEL_KEYS,
  REVIEW_LIMITS,
  REVIEW_PHOTO_TYPES,
  createReview,
  deleteReview,
  reviewDraftErrors,
  reviewErrorKey,
  reviewPhotoProblem,
  updateReview,
  uploadReviewPhoto,
} from "~/lib/reviews";

type PhotoSlot = {
  key: string;
  status: "uploading" | "done" | "error";
  preview: string;
  photoId?: string;
  /** Object URL to revoke when the slot goes. */
  objectUrl?: string;
};

const DRAFT_ERROR_KEYS: Record<DraftError, string> = {
  rating: "reviews.write.errRating",
  bodyShort: "reviews.write.errBodyShort",
  bodyLong: "reviews.write.errBodyLong",
  photos: "reviews.write.photoMax",
  height: "reviews.write.errHeight",
  usualSize: "reviews.write.errUsualSize",
};

const FIT_RESULTS: FitResult[] = ["small", "true_to_size", "large"];

let slotSeq = 0;

/**
 * 리뷰 쓰기 / 리뷰 수정 for one order line: a drawer from the right on desktop,
 * a bottom sheet on phones, like 상품 문의. Photos upload one by one as they
 * are picked, so a slow phone connection retries a photo, not the review.
 */
export function ReviewComposer({
  open,
  onClose,
  line,
  productName,
  imageUrl,
  existing,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  line: ReviewLine;
  productName: string;
  imageUrl?: string;
  existing?: MyReview;
  onSaved: (review: MyReview, created: boolean) => void;
  onDeleted: (reviewId: string) => void;
}) {
  const { t } = useLanguage();
  const ref = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [fitResult, setFitResult] = useState<FitResult | undefined>();
  const [height, setHeight] = useState("");
  const [usualSize, setUsualSize] = useState("");
  const [photos, setPhotos] = useState<PhotoSlot[]>([]);
  const [clothing, setClothing] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photoNotice, setPhotoNotice] = useState<string | null>(null);

  // Open: fill the form from the existing review, and learn the category.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (!open) return;

    setRating(existing?.rating ?? 0);
    setBody(existing?.body ?? "");
    setFitResult(existing?.fit?.result);
    setHeight(existing?.fit?.heightCm ? String(existing.fit.heightCm) : "");
    setUsualSize(existing?.fit?.usualSize ?? "");
    setPhotos(
      (existing?.photos ?? []).map((p) => ({
        key: `existing-${p.id}`,
        status: "done" as const,
        preview: p.thumbUrl || p.url,
        photoId: p.id,
      }))
    );
    setShowErrors(false);
    setError(null);
    setPhotoNotice(null);
    setClothing(Boolean(existing?.fit));

    let cancelled = false;
    fetchProduct(line.productId)
      .then((p) => {
        if (!cancelled) setClothing(p.category === "clothing");
      })
      .catch(() => {
        // Without the category the fit question stays off unless the review
        // already had one; the backend refuses fit on a bag anyway.
      });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelled = true;
      document.body.style.overflow = previousOverflow;
    };
  }, [open, existing, line.productId]);

  // Revoke object URLs of picked photos when the drawer goes away.
  const photosRef = useRef<PhotoSlot[]>([]);
  photosRef.current = photos;
  useEffect(
    () => () => photosRef.current.forEach((p) => p.objectUrl && URL.revokeObjectURL(p.objectUrl)),
    []
  );

  const heightNumber = height.trim() === "" ? "" : Number(height);
  const draft: ReviewDraft = {
    rating,
    body,
    fit: clothing ? { result: fitResult, heightCm: heightNumber, usualSize } : undefined,
    photoIds: photos.filter((p) => p.status === "done" && p.photoId).map((p) => p.photoId!),
  };
  const errors = reviewDraftErrors(draft);
  const uploading = photos.some((p) => p.status === "uploading");
  const hidden = Boolean(existing?.hidden);
  const bodyLength = [...body.trim()].length;

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setPhotoNotice(null);
    const room = REVIEW_LIMITS.photos - photos.length;
    const picked = Array.from(files);
    if (picked.length > room) setPhotoNotice(t("reviews.write.photoMax"));
    for (const file of picked.slice(0, Math.max(room, 0))) {
      const problem = reviewPhotoProblem(file);
      if (problem) {
        setPhotoNotice(t(problem === "type" ? "reviews.write.photoType" : "reviews.write.photoSize"));
        continue;
      }
      const objectUrl = URL.createObjectURL(file);
      const key = `new-${++slotSeq}`;
      setPhotos((current) => [...current, { key, status: "uploading", preview: objectUrl, objectUrl }]);
      uploadReviewPhoto(file)
        .then((up) =>
          setPhotos((current) =>
            current.map((p) => (p.key === key ? { ...p, status: "done", photoId: up.photoId } : p))
          )
        )
        .catch((err: unknown) => {
          setPhotos((current) => current.map((p) => (p.key === key ? { ...p, status: "error" } : p)));
          setPhotoNotice(t(reviewErrorKey(err)));
        });
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function removePhoto(key: string) {
    setPhotos((current) => {
      const slot = current.find((p) => p.key === key);
      if (slot?.objectUrl) URL.revokeObjectURL(slot.objectUrl);
      return current.filter((p) => p.key !== key);
    });
  }

  async function submit() {
    setShowErrors(true);
    if (errors.length > 0 || uploading || hidden) return;
    setBusy("save");
    setError(null);
    try {
      const saved = existing ? await updateReview(existing.id, draft) : await createReview(line.productId, line, draft);
      onSaved(saved, !existing);
    } catch (err) {
      setError(t(reviewErrorKey(err)));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!existing || !window.confirm(t("reviews.write.deleteConfirm"))) return;
    setBusy("delete");
    setError(null);
    try {
      await deleteReview(existing.id);
      onDeleted(existing.id);
    } catch (err) {
      setError(t(reviewErrorKey(err)));
    } finally {
      setBusy(null);
    }
  }

  const fieldError = (key: DraftError) =>
    showErrors && errors.includes(key) ? (
      <p className="mt-1.5 text-[12px] text-alert" role="alert">
        {t(DRAFT_ERROR_KEYS[key])}
      </p>
    ) : null;

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={[
        "bg-white p-0 text-ink backdrop:bg-black/50",
        "sm:my-0 sm:ml-auto sm:mr-0 sm:h-svh sm:max-h-none sm:w-[480px] sm:max-w-full",
        "max-sm:mb-0 max-sm:mt-auto max-sm:w-full max-sm:max-w-none max-sm:rounded-t-xl",
      ].join(" ")}
    >
      <div className="flex max-h-[92svh] flex-col sm:h-full sm:max-h-none">
        <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-5 sm:px-8 sm:pt-7">
          <h2
            id={titleId}
            className="text-xl font-light tracking-tight text-zinc-950 sm:text-2xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {existing ? t("reviews.write.editTitle") : t("reviews.write.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("reviews.write.close")}
            className="-mr-2 -mt-1 flex size-10 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
          >
            <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
            </svg>
          </button>
        </div>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="flex-1 space-y-7 overflow-y-auto px-5 pb-6 sm:px-8">
            <div className="flex items-center gap-3 border-b border-zinc-100 pb-5">
              <div className="size-14 shrink-0 overflow-hidden bg-zinc-50">
                {imageUrl && <img src={imageUrl} alt="" className="h-full w-full object-cover" />}
              </div>
              <p className="min-w-0 text-sm font-medium text-zinc-950">{productName}</p>
            </div>

            {hidden && (
              <p className="rounded bg-ground px-4 py-3 text-[13px] leading-relaxed text-zinc-700" role="status">
                {t("reviews.write.hiddenNotice", { reason: existing?.hiddenReason ?? "" })}
              </p>
            )}

            <fieldset disabled={hidden} className="space-y-7 disabled:opacity-60">
              <div>
                <p id={`${titleId}-rating`} className="text-sm font-medium text-zinc-950">
                  {t("reviews.write.ratingLabel")}
                </p>
                <div className="mt-3 flex gap-1" role="radiogroup" aria-labelledby={`${titleId}-rating`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={rating === n}
                      aria-label={t("reviews.write.starButton", { n })}
                      onClick={() => setRating(n)}
                      className="p-0.5"
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24" className={`size-8 ${n <= rating ? "text-zinc-950" : "text-zinc-200"}`}>
                        <path fill="currentColor" d="M12 2.5l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.52l-5.88 3.09 1.12-6.55L2.48 9.42l6.58-.96z" />
                      </svg>
                    </button>
                  ))}
                </div>
                {fieldError("rating")}
              </div>

              {clothing && (
                <div>
                  <p className="text-sm font-medium text-zinc-950">{t("reviews.write.fitLabel")}</p>
                  <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("reviews.write.fitLabel")}>
                    {FIT_RESULTS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        role="radio"
                        aria-checked={fitResult === r}
                        onClick={() => setFitResult(fitResult === r ? undefined : r)}
                        className={`h-10 border text-[13px] transition ${
                          fitResult === r ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 text-zinc-700 hover:border-zinc-400"
                        }`}
                      >
                        {t(FIT_LABEL_KEYS[r])}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <label className="text-[12px] text-zinc-500">
                      {t("reviews.write.heightLabel")} · {t("reviews.write.optional")}
                      <input
                        type="number"
                        inputMode="numeric"
                        min={REVIEW_LIMITS.heightMin}
                        max={REVIEW_LIMITS.heightMax}
                        value={height}
                        onChange={(e) => setHeight(e.target.value)}
                        className="mt-1 h-10 w-full border border-zinc-200 px-3 text-sm text-zinc-950 outline-none focus:border-zinc-950"
                      />
                    </label>
                    <label className="text-[12px] text-zinc-500">
                      {t("reviews.write.usualSizeLabel")} · {t("reviews.write.optional")}
                      <input
                        type="text"
                        maxLength={REVIEW_LIMITS.usualSizeMax}
                        value={usualSize}
                        onChange={(e) => setUsualSize(e.target.value)}
                        className="mt-1 h-10 w-full border border-zinc-200 px-3 text-sm text-zinc-950 outline-none focus:border-zinc-950"
                      />
                    </label>
                  </div>
                  {fieldError("height")}
                  {fieldError("usualSize")}
                </div>
              )}

              <div>
                <label htmlFor={bodyId} className="text-sm font-medium text-zinc-950">
                  {t("reviews.write.bodyLabel")}
                </label>
                <textarea
                  id={bodyId}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  maxLength={REVIEW_LIMITS.bodyMax + 50}
                  placeholder={t("reviews.write.bodyPlaceholder")}
                  className="mt-3 w-full resize-none border border-zinc-200 p-3 text-sm leading-relaxed text-zinc-950 outline-none placeholder:text-zinc-400 focus:border-zinc-950"
                />
                <div className="mt-1 flex justify-between gap-2">
                  <span>{fieldError("bodyShort") ?? fieldError("bodyLong")}</span>
                  <span className={`shrink-0 text-[11px] tabular-nums ${bodyLength > REVIEW_LIMITS.bodyMax ? "text-alert" : "text-zinc-400"}`}>
                    {t("reviews.write.bodyCount", { count: bodyLength })}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-zinc-950">
                  {t("reviews.write.photosLabel")}{" "}
                  <span className="font-normal text-zinc-400">
                    {photos.length}/{REVIEW_LIMITS.photos}
                  </span>
                </p>
                <p className="mt-1 text-[12px] text-zinc-400">{t("reviews.write.photosHint")}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {photos.map((p) => (
                    <div key={p.key} className="relative size-20 overflow-hidden bg-zinc-50">
                      <img src={p.preview} alt="" className={`h-full w-full object-cover ${p.status === "done" ? "" : "opacity-40"}`} />
                      {p.status !== "done" && (
                        <span className={`absolute inset-x-0 bottom-0 bg-white/85 py-0.5 text-center text-[10px] ${p.status === "error" ? "text-alert" : "text-zinc-600"}`}>
                          {p.status === "error" ? t("reviews.write.uploadFailed") : t("reviews.write.uploading")}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removePhoto(p.key)}
                        aria-label={t("reviews.write.removePhoto")}
                        className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-zinc-950/70 text-white"
                      >
                        <svg aria-hidden="true" className="size-3" viewBox="0 0 24 24" fill="none">
                          <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  {photos.length < REVIEW_LIMITS.photos && (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="flex size-20 flex-col items-center justify-center gap-1 border border-dashed border-zinc-300 text-[11px] text-zinc-500 transition hover:border-zinc-950 hover:text-zinc-950"
                    >
                      <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none">
                        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
                      </svg>
                      {t("reviews.write.addPhoto")}
                    </button>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept={REVIEW_PHOTO_TYPES.join(",")}
                  multiple
                  hidden
                  onChange={(e) => void addFiles(e.target.files)}
                />
                {photoNotice && <p className="mt-2 text-[12px] text-alert" role="alert">{photoNotice}</p>}
              </div>
            </fieldset>

            <p className="text-[12px] leading-relaxed text-zinc-400">{t("reviews.write.note")}</p>
          </div>

          <div className="space-y-3 border-t border-zinc-100 px-5 py-4 sm:px-8">
            {error && (
              <p className="text-[12px] text-alert" role="alert">
                {error}
              </p>
            )}
            {!hidden && (
              <button
                type="submit"
                disabled={busy !== null || uploading}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-zinc-950 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
              >
                {busy === "save"
                  ? t("reviews.write.saving")
                  : existing
                    ? t("reviews.write.save")
                    : t("reviews.write.submit")}
              </button>
            )}
            {existing && (
              <button
                type="button"
                onClick={() => void remove()}
                disabled={busy !== null}
                className="w-full text-center text-[12px] text-zinc-500 underline underline-offset-4 hover:text-zinc-950 disabled:opacity-50"
              >
                {t("reviews.write.delete")}
              </button>
            )}
          </div>
        </form>
      </div>
    </dialog>
  );
}

import { useEffect, useId, useRef } from "react";

import { useLanguage } from "~/lib/i18n";
import { type SizeChartRow, formatCm, sizeChartColumns } from "~/lib/size-chart";

const COLUMN_LABEL_KEYS = {
  chestCm: "product.sizeChart.chest",
  lengthCm: "product.sizeChart.length",
  shoulderCm: "product.sizeChart.shoulder",
  sleeveCm: "product.sizeChart.sleeve",
} as const;

/**
 * The size chart in a modal: a bottom sheet on phones, a centered panel from
 * sm. A native <dialog> opened with showModal() renders in the top layer, so
 * the PDP's transformed bottom sheet cannot clip it, and it brings focus
 * trapping and Escape with it.
 */
export function SizeGuideDialog({
  open,
  rows,
  onClose,
}: {
  open: boolean;
  rows: SizeChartRow[];
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const noteId = useId();
  const columns = sizeChartColumns(rows);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={noteId}
      // Escape closes the dialog natively; keep `open` in step.
      onClose={onClose}
      // A click on the backdrop lands on the <dialog> itself.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={[
        "m-auto w-full max-w-lg bg-white p-0 text-ink backdrop:bg-black/50",
        "max-sm:mb-0 max-sm:max-w-none max-sm:rounded-t-xl",
      ].join(" ")}
    >
      <div className="max-h-[85svh] overflow-y-auto px-5 pb-6 pt-5 sm:px-8 sm:pb-8 sm:pt-7">
        <div className="flex items-start justify-between gap-4">
          <h2
            id={titleId}
            className="text-xl font-light tracking-tight text-zinc-950 sm:text-2xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("product.sizeGuide")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("product.sizeGuideClose")}
            className="-mr-2 -mt-1 flex size-10 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Five columns at most fit 390px; a wider table scrolls here, never the page */}
        <div className="mt-5 overflow-x-auto">
          <table className="w-full border-collapse text-center text-xs tabular-nums">
            <thead>
              <tr className="border-b border-zinc-950">
                <th scope="col" className="py-2.5 pr-2 text-left font-semibold uppercase tracking-widest text-zinc-950">
                  {t("product.size")}
                </th>
                {columns.map((key) => (
                  <th key={key} scope="col" className="px-2 py-2.5 font-semibold text-zinc-950">
                    {t(COLUMN_LABEL_KEYS[key])}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.size} className="border-b border-zinc-100">
                  <th scope="row" className="py-2.5 pr-2 text-left font-semibold text-zinc-950">
                    {row.size}
                  </th>
                  {columns.map((key) => (
                    <td key={key} className="px-2 py-2.5 text-zinc-600">
                      {formatCm(row[key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p id={noteId} className="mt-4 text-xs leading-relaxed text-zinc-500">
          {t("product.sizeGuideNote")}
        </p>
      </div>
    </dialog>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

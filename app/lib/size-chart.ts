import { compareSizes } from "./product-variants";

/**
 * A garment size guide: one row of measurements (cm) per size, from the
 * product parent's `sizeChart` (dupli1 product/pkg/domain/size_chart.go).
 */

export const SIZE_CHART_MEASUREMENTS = ["chestCm", "lengthCm", "shoulderCm", "sleeveCm"] as const;

export type SizeChartMeasurement = (typeof SIZE_CHART_MEASUREMENTS)[number];

export type SizeChartRow = { size: string } & Partial<Record<SizeChartMeasurement, number>>;

function positiveCm(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

/**
 * Rows with a size and at least one measurement, sorted XXS→XXL. Zero or
 * missing measurements mean "not given" and are dropped. Empty when the
 * product has no chart.
 */
export function normalizeSizeChart(raw: unknown): SizeChartRow[] {
  if (!Array.isArray(raw)) return [];
  const rows: SizeChartRow[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const size = typeof record.size === "string" ? record.size.trim().toUpperCase() : "";
    if (!size) continue;
    const row: SizeChartRow = { size };
    for (const key of SIZE_CHART_MEASUREMENTS) {
      const cm = positiveCm(record[key]);
      if (cm !== undefined) row[key] = cm;
    }
    if (SIZE_CHART_MEASUREMENTS.some((key) => row[key] !== undefined)) rows.push(row);
  }
  return rows.sort((a, b) => compareSizes(a.size, b.size));
}

/** The measurements at least one row gives, in a fixed column order. */
export function sizeChartColumns(rows: SizeChartRow[]): SizeChartMeasurement[] {
  return SIZE_CHART_MEASUREMENTS.filter((key) => rows.some((row) => row[key] !== undefined));
}

/** "52", "52.5"; "—" where this size does not give the measurement. */
export function formatCm(value: number | undefined): string {
  if (value === undefined) return "—";
  return String(Math.round(value * 10) / 10);
}

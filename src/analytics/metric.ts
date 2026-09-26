/**
 * Shared numeric helpers and the MetricResult contract.
 *
 * A metric is either computed (`ok`), computed from incomplete inputs (`partial`,
 * with warnings) or not computable (`missing`, value = null, with the reason and
 * the fields the user must supply). UI must render `missing` as "Không đủ dữ liệu",
 * never as 0.
 */

export type MetricUnit = 'vnd' | 'count' | 'ratio' | 'multiple';
export type MetricStatus = 'ok' | 'partial' | 'missing';

export interface Bilingual {
  vi: string;
  en: string;
}

export interface MetricResult {
  value: number | null;
  unit: MetricUnit;
  status: MetricStatus;
  /** Why the metric is missing or partial. */
  notes?: Bilingual[];
  /** Canonical fields that would make the metric computable/complete. */
  requires?: string[];
  /**
   * Replaces the metric's usual name when the value means something narrower, e.g.
   * "Lượt người mua (cộng theo ngày)" instead of "Người mua" for a sum of daily distinct counts.
   */
  label?: Bilingual;
  /**
   * Shown next to the value even when the metric is ok — e.g. the platform's period total
   * differs from the sum of its daily rows.
   */
  warning?: Bilingual;
}

export function ok(value: number, unit: MetricUnit): MetricResult {
  return { value, unit, status: 'ok' };
}

export function missing(unit: MetricUnit, note: Bilingual, requires: string[] = []): MetricResult {
  return { value: null, unit, status: 'missing', notes: [note], requires };
}

export function partial(value: number, unit: MetricUnit, notes: Bilingual[], requires: string[] = []): MetricResult {
  return { value, unit, status: 'partial', notes, requires };
}

/** Division that returns null instead of Infinity/NaN. */
export function safeDivide(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return numerator / denominator;
}

export function sum<T>(items: readonly T[], pick: (item: T) => number | undefined): number {
  let total = 0;
  for (const item of items) {
    const v = pick(item);
    if (typeof v === 'number' && Number.isFinite(v)) total += v;
  }
  return total;
}

/** True when at least one item carries a finite number for the field. */
export function hasAny<T>(items: readonly T[], pick: (item: T) => number | undefined): boolean {
  return items.some((item) => {
    const v = pick(item);
    return typeof v === 'number' && Number.isFinite(v);
  });
}

/** Ratio metric from two MetricResults, propagating missing/partial status. */
export function ratioMetric(
  numerator: MetricResult,
  denominator: MetricResult,
  unit: MetricUnit,
  zeroDenominatorNote: Bilingual,
): MetricResult {
  if (numerator.value === null || denominator.value === null) {
    const notes = [...(numerator.notes || []), ...(denominator.notes || [])];
    const requires = [...(numerator.requires || []), ...(denominator.requires || [])];
    return { value: null, unit, status: 'missing', notes, requires: Array.from(new Set(requires)) };
  }
  const value = safeDivide(numerator.value, denominator.value);
  if (value === null) return missing(unit, zeroDenominatorNote);
  const warning = numerator.warning ?? denominator.warning;
  if (warning && numerator.status !== 'partial' && denominator.status !== 'partial') return { ...ok(value, unit), warning };
  if (numerator.status === 'partial' || denominator.status === 'partial') {
    return partial(value, unit, [...(numerator.notes || []), ...(denominator.notes || [])], [
      ...(numerator.requires || []),
      ...(denominator.requires || []),
    ]);
  }
  return ok(value, unit);
}

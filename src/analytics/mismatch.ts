/**
 * "The file disagrees with itself" — one shape for every such finding, two levels:
 *  - within the rounding tolerance (money ±2đ or ±0,01%, orders ±0,05, printed rates ±0,01
 *    point, ROAS ±0,01): not reported at all;
 *  - beyond it: "Dữ liệu không khớp", shown in red, largest gaps first. Never described as
 *    platform rounding.
 * Counts that are not additive over days (visitors, buyers) are never compared with a sum.
 */
import type { Bilingual, MetricUnit } from './metric';
import { moneyTolerance, ORDER_TOLERANCE, type PeriodMismatch } from './periodRows';

export interface MismatchItem {
  key: string;
  label: Bilingual;
  unit: MetricUnit;
  /** The figure the app uses. */
  used: { label: Bilingual; value: number };
  /** The other copy that disagrees. */
  other: { label: Bilingual; value: number };
  /** |other − used| / |used| — used to show the largest gaps first. */
  gap: number;
}

export const MISMATCH_TITLE: Bilingual = { vi: 'Dữ liệu không khớp', en: 'Data does not match' };

/** Printed rates carry 2 decimals of a percent; ROAS 2 decimals. */
export const RATE_TOLERANCE = 0.0001;
export const MULTIPLE_TOLERANCE = 0.011;

export function toleranceFor(unit: MetricUnit, used: number): number {
  if (unit === 'vnd') return moneyTolerance(used);
  if (unit === 'count') return ORDER_TOLERANCE;
  if (unit === 'ratio') return RATE_TOLERANCE;
  return MULTIPLE_TOLERANCE;
}

/** A mismatch item, or null when the two copies agree within the tolerance. */
export function compareCopies(
  key: string,
  label: Bilingual,
  unit: MetricUnit,
  used: { label: Bilingual; value: number | null | undefined },
  other: { label: Bilingual; value: number | null | undefined },
): MismatchItem | null {
  if (used.value === null || used.value === undefined || other.value === null || other.value === undefined) return null;
  if (Math.abs(other.value - used.value) <= toleranceFor(unit, used.value)) return null;
  const gap = used.value === 0 ? Infinity : Math.abs(other.value - used.value) / Math.abs(used.value);
  return { key, label, unit, used: { label: used.label, value: used.value }, other: { label: other.label, value: other.value }, gap };
}

export const byGap = (a: MismatchItem, b: MismatchItem) => b.gap - a.gap;

const nf = (v: number, digits: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits }).format(v);

export function fmtMismatchValue(v: number, unit: MetricUnit): string {
  if (unit === 'ratio') return `${nf(v * 100, 2)}%`;
  if (unit === 'multiple') return `${nf(v, 2)}x`;
  if (unit === 'vnd') return `${nf(v, 0)}đ`;
  return nf(v, 2);
}

/** "Thẻ sản phẩm — doanh số: dòng tổng 51.310.459đ · cộng ngày 49.304.253đ (lệch 3,9%)". */
export function describeMismatch(m: MismatchItem): Bilingual {
  const pct = Number.isFinite(m.gap) ? ` (lệch ${nf(m.gap * 100, 1)}%)` : '';
  return {
    vi: `${m.label.vi}: ${m.used.label.vi} ${fmtMismatchValue(m.used.value, m.unit)} · ${m.other.label.vi} ${fmtMismatchValue(m.other.value, m.unit)}${pct}`,
    en: `${m.label.en}: ${m.used.label.en} ${fmtMismatchValue(m.used.value, m.unit)} · ${m.other.label.en} ${fmtMismatchValue(m.other.value, m.unit)}`,
  };
}

export const PERIOD_ROW_LABEL: Bilingual = { vi: 'dòng tổng', en: 'period row' };
export const DAILY_SUM_LABEL: Bilingual = { vi: 'cộng ngày', en: 'sum of days' };
export const RECOMPUTED_LABEL: Bilingual = { vi: 'tự tính', en: 'recomputed' };
export const FILE_RATE_LABEL: Bilingual = { vi: 'file ghi', en: 'file states' };

/** Period row vs its days, as mismatch items (already filtered by the tolerance). */
export function periodMismatchItems(list: PeriodMismatch[], label: (m: PeriodMismatch) => Bilingual, unit: (m: PeriodMismatch) => MetricUnit): MismatchItem[] {
  return list
    .map((m) => compareCopies(`${m.group}|${m.field}`, label(m), unit(m), { label: PERIOD_ROW_LABEL, value: m.periodValue }, { label: DAILY_SUM_LABEL, value: m.dailySum }))
    .filter((x): x is MismatchItem => x !== null)
    .sort(byGap);
}

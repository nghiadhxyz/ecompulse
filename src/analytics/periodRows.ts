/**
 * Period totals vs daily rows.
 *
 * Summary reports often give the same figure twice: one row for the whole report period
 * (periodStart … date) and one row per day. The platform rounds each day, so the days do
 * not always add up to its own total (Shopee: 391,51 vs 391,50 orders).
 *
 * Rule: when the range covers the whole period, the platform's period row is used and the
 * daily rows it covers are dropped; otherwise the daily rows inside the range are used and
 * the period row is left out (it is never spread across days).
 */
import type { Bilingual } from './metric';
import type { DateRange } from './period';

interface DatedRow {
  date: string;
  periodStart?: string;
}

/** Period row fully inside the range. */
export function periodInRange(row: DatedRow, range: DateRange): boolean {
  return row.periodStart !== undefined && row.periodStart >= range.start && row.date <= range.end;
}

/**
 * Picks, per group, the period rows covered by the range plus the daily rows in range
 * that no chosen period row already covers.
 */
export function selectPeriodOrDaily<T extends DatedRow>(rows: readonly T[], range: DateRange, groupKey: (row: T) => string): T[] {
  const spans = new Map<string, { start: string; end: string }[]>();
  for (const r of rows) {
    if (!periodInRange(r, range)) continue;
    const k = groupKey(r);
    const list = spans.get(k);
    const span = { start: r.periodStart!, end: r.date };
    if (list) list.push(span);
    else spans.set(k, [span]);
  }
  return rows.filter((r) => {
    if (r.periodStart !== undefined) return periodInRange(r, range);
    if (r.date < range.start || r.date > range.end) return false;
    const covered = spans.get(groupKey(r));
    return !covered || !covered.some((s) => r.date >= s.start && r.date <= s.end);
  });
}

/**
 * Tolerances for "days do not add up to the platform's total" warnings. Below them the gap
 * is the platform's own rounding and is not worth a warning.
 *   money  ±2đ or ±0,01% of the total, whichever is larger
 *   orders ±0,05 (attributed orders are reported with 2 decimals)
 * Distinct counts (visitors, buyers, existing / potential buyers) never get a warning: their
 * days are not supposed to add up to the period.
 */
export const moneyTolerance = (total: number) => Math.max(2, Math.abs(total) * 0.0001);
export const ORDER_TOLERANCE = 0.05;

export interface PeriodMismatch {
  group: string;
  field: string;
  periodValue: number;
  dailySum: number;
}

/**
 * For each period row the range uses, compares additive fields with the sum of the daily
 * rows of the same group over the same days. Differences above `tolerance` are returned.
 */
export function periodMismatches<T extends DatedRow>(
  rows: readonly T[],
  range: DateRange,
  groupKey: (row: T) => string,
  fields: { key: string; pick: (row: T) => number | undefined; tolerance: number | ((periodValue: number) => number) }[],
): PeriodMismatch[] {
  const out: PeriodMismatch[] = [];
  for (const p of rows) {
    if (!periodInRange(p, range)) continue;
    const k = groupKey(p);
    const days = rows.filter((r) => r.periodStart === undefined && groupKey(r) === k && r.date >= p.periodStart! && r.date <= p.date);
    if (days.length === 0) continue;
    for (const f of fields) {
      const pv = f.pick(p);
      if (pv === undefined || !days.some((d) => f.pick(d) !== undefined)) continue;
      const ds = days.reduce((s, d) => s + (f.pick(d) ?? 0), 0);
      const tol = typeof f.tolerance === 'function' ? f.tolerance(pv) : f.tolerance;
      if (Math.abs(ds - pv) > tol) out.push({ group: k, field: f.key, periodValue: pv, dailySum: ds });
    }
  }
  return out;
}

/** One note summarising mismatches, or none. `describe` names a mismatch in Vietnamese. */
export function mismatchNote(list: PeriodMismatch[], describe: (m: PeriodMismatch) => string): Bilingual | null {
  if (list.length === 0) return null;
  const shown = list.slice(0, 3).map(describe).join('; ');
  const more = list.length > 3 ? ` và ${list.length - 3} chỉ số khác` : '';
  return {
    vi: `Cộng các ngày lệch với dòng tổng của sàn (sàn làm tròn từng ngày): ${shown}${more}. Khi chọn trọn kỳ, số liệu dùng dòng tổng.`,
    en: `Daily rows do not add up to the platform's period total in ${list.length} place(s); the period total is used for the full period.`,
  };
}

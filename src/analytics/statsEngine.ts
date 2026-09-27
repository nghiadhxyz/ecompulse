/**
 * Advanced statistics (Analyst mode only — never shown in Seller mode).
 *
 * - Rates (cancel rate, CVR, refund rate): two-proportion z-test between periods, with a
 *   95% confidence interval for the difference.
 * - Daily amounts (GMV/day, orders/day): Welch's t-test on daily values (normal
 *   approximation for the p-value), 95% CI for the difference of means.
 * - Correlation of daily series (Pearson r with n). Correlation is not causation.
 * - Weekday index: average GMV per weekday relative to the overall daily average.
 */
import type { CanonicalDataset } from './model';
import type { DatasetFilter } from './filters';
import { breakdown, type BreakdownRow } from './breakdownEngine';
import { campaignCalendar, dayTypeOf, weekdayIndex } from './campaignEngine';
import { enumerateDays, type DateRange } from './period';
import { placedOnly } from './orderStage';
import type { Bilingual, MetricUnit } from './metric';

/** Standard normal CDF (Abramowitz–Stegun 7.1.26). */
export function normCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

const twoSidedP = (z: number) => 2 * (1 - normCdf(Math.abs(z)));

export interface TestResult {
  key: string;
  label: Bilingual;
  unit: MetricUnit;
  current: number | null;
  previous: number | null;
  difference: number | null;
  ciLow: number | null;
  ciHigh: number | null;
  pValue: number | null;
  /** n per side (orders / clicks / days). */
  nCurrent: number;
  nPrevious: number;
  /** no_comparison: the comparison period has no data at all (not a small sample). */
  verdict: 'significant' | 'not_significant' | 'insufficient' | 'no_comparison';
}

export function twoProportionTest(x1: number, n1: number, x0: number, n0: number): { diff: number; lo: number; hi: number; p: number } | null {
  if (n1 < 30 || n0 < 30) return null;
  const p1 = x1 / n1;
  const p0 = x0 / n0;
  const pooled = (x1 + x0) / (n1 + n0);
  const sePooled = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n0));
  const se = Math.sqrt((p1 * (1 - p1)) / n1 + (p0 * (1 - p0)) / n0);
  const diff = p1 - p0;
  const z = sePooled > 0 ? diff / sePooled : 0;
  return { diff, lo: diff - 1.96 * se, hi: diff + 1.96 * se, p: sePooled > 0 ? twoSidedP(z) : 1 };
}

export function welchTest(a: number[], b: number[]): { diff: number; lo: number; hi: number; p: number } | null {
  if (a.length < 5 || b.length < 5) return null;
  const mean = (x: number[]) => x.reduce((s, v) => s + v, 0) / x.length;
  const variance = (x: number[], m: number) => x.reduce((s, v) => s + (v - m) ** 2, 0) / (x.length - 1);
  const ma = mean(a);
  const mb = mean(b);
  const se = Math.sqrt(variance(a, ma) / a.length + variance(b, mb) / b.length);
  const diff = ma - mb;
  // Normal approximation; slightly optimistic for very small samples (≥ 5 days required).
  return { diff, lo: diff - 1.96 * se, hi: diff + 1.96 * se, p: se > 0 ? twoSidedP(diff / se) : diff === 0 ? 1 : 0 };
}

function verdictOf(p: number | null, nPrevious = 1): TestResult['verdict'] {
  if (nPrevious === 0) return 'no_comparison';
  return p === null ? 'insufficient' : p < 0.05 ? 'significant' : 'not_significant';
}

export interface CorrelationCell {
  a: string;
  b: string;
  r: number | null;
  n: number;
}

export interface AdvancedStats {
  tests: TestResult[];
  correlations: { series: { key: string; label: Bilingual }[]; cells: CorrelationCell[] };
  weekday: { weekday: number; label: Bilingual; index: number | null; days: number }[];
  notes: Bilingual[];
}

export function pearson(x: number[], y: number[]): number | null {
  const n = x.length;
  if (n < 10) return null;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}

const WD: Bilingual[] = [
  { vi: 'Thứ 2', en: 'Mon' },
  { vi: 'Thứ 3', en: 'Tue' },
  { vi: 'Thứ 4', en: 'Wed' },
  { vi: 'Thứ 5', en: 'Thu' },
  { vi: 'Thứ 6', en: 'Fri' },
  { vi: 'Thứ 7', en: 'Sat' },
  { vi: 'Chủ nhật', en: 'Sun' },
];

export function advancedStats(dataset: CanonicalDataset, requested: DatasetFilter, previousRange: DateRange): AdvancedStats {
  const filter = placedOnly(requested);
  const cur = breakdown(dataset, filter, 'day').rows;
  const prev = breakdown(dataset, { ...filter, range: previousRange }, 'day').rows;
  const sum = (rows: BreakdownRow[], f: (r: BreakdownRow) => number | null) => rows.reduce((s, r) => s + (f(r) ?? 0), 0);
  const tests: TestResult[] = [];

  const rateTest = (key: string, label: Bilingual, num: (r: BreakdownRow) => number, den: (r: BreakdownRow) => number | null) => {
    const hasDen = (rows: BreakdownRow[]) => rows.length > 0 && rows.every((r) => den(r) !== null);
    const x1 = sum(cur, num);
    const n1 = hasDen(cur) ? sum(cur, den) : 0;
    const x0 = sum(prev, num);
    const n0 = hasDen(prev) ? sum(prev, den) : 0;
    const t = twoProportionTest(x1, n1, x0, n0);
    tests.push({ key, label, unit: 'ratio', current: n1 ? x1 / n1 : null, previous: n0 ? x0 / n0 : null, difference: t?.diff ?? null, ciLow: t?.lo ?? null, ciHigh: t?.hi ?? null, pValue: t?.p ?? null, nCurrent: n1, nPrevious: n0, verdict: verdictOf(t?.p ?? null, n0) });
  };
  rateTest('cancelRate', { vi: 'Tỷ lệ hủy', en: 'Cancel rate' }, (r) => r.current.cancelled, (r) => r.current.placed);
  rateTest('refundRate', { vi: 'Tỷ lệ trả/hoàn', en: 'Refund rate' }, (r) => r.current.returned, (r) => r.current.valid);
  rateTest('cvr', { vi: 'CVR (đơn / lượt nhấp)', en: 'CVR' }, (r) => r.current.placed, (r) => r.current.clicks);

  const meanTest = (key: string, label: Bilingual, unit: MetricUnit, f: (r: BreakdownRow) => number) => {
    const fill = (rows: BreakdownRow[], range: DateRange) => {
      // No data at all for a period → no sample (never a run of zero days).
      if (rows.length === 0) return [];
      const m = new Map(rows.map((r) => [r.key, f(r)]));
      return enumerateDays(range).map((d) => m.get(d) ?? 0);
    };
    const a = fill(cur, filter.range);
    const b = fill(prev, previousRange);
    const t = welchTest(a, b);
    const mean = (x: number[]) => (x.length ? x.reduce((s, v) => s + v, 0) / x.length : null);
    tests.push({ key, label, unit, current: mean(a), previous: mean(b), difference: t?.diff ?? null, ciLow: t?.lo ?? null, ciHigh: t?.hi ?? null, pValue: t?.p ?? null, nCurrent: a.length, nPrevious: b.length, verdict: verdictOf(t?.p ?? null, b.length) });
  };
  meanTest('gmvPerDay', { vi: 'GMV mỗi ngày', en: 'GMV per day' }, 'vnd', (r) => r.current.gmv);
  meanTest('ordersPerDay', { vi: 'Đơn mỗi ngày', en: 'Orders per day' }, 'count', (r) => r.current.placed);

  // Daily correlations (current range)
  const days = enumerateDays(filter.range);
  const byDay = new Map(cur.map((r) => [r.key, r]));
  const adsByDay = new Map<string, number>();
  for (const a of dataset.ads) {
    if (a.periodStart || (filter.platforms?.length && !filter.platforms.includes(a.platform))) continue;
    if (a.date >= filter.range.start && a.date <= filter.range.end) adsByDay.set(a.date, (adsByDay.get(a.date) ?? 0) + (a.spend ?? 0));
  }
  const series: { key: string; label: Bilingual; values: (number | null)[] }[] = [
    { key: 'gmv', label: { vi: 'GMV', en: 'GMV' }, values: days.map((d) => byDay.get(d)?.current.gmv ?? 0) },
    { key: 'clicks', label: { vi: 'Lượt nhấp', en: 'Clicks' }, values: days.map((d) => byDay.get(d)?.current.clicks ?? null) },
    { key: 'ads', label: { vi: 'Chi phí Ads', en: 'Ad spend' }, values: days.map((d) => (adsByDay.size ? adsByDay.get(d) ?? 0 : null)) },
    { key: 'cancelRate', label: { vi: 'Tỷ lệ hủy', en: 'Cancel rate' }, values: days.map((d) => byDay.get(d)?.current.cancelRate ?? null) },
    { key: 'aov', label: { vi: 'AOV', en: 'AOV' }, values: days.map((d) => byDay.get(d)?.current.aov ?? null) },
  ].filter((s) => s.values.filter((v) => v !== null).length >= 10);
  const cells: CorrelationCell[] = [];
  for (let i = 0; i < series.length; i++) {
    for (let j = i + 1; j < series.length; j++) {
      const pairs = series[i].values.map((v, k) => [v, series[j].values[k]] as const).filter(([x, y]) => x !== null && y !== null) as [number, number][];
      cells.push({ a: series[i].key, b: series[j].key, r: pearson(pairs.map((p) => p[0]), pairs.map((p) => p[1])), n: pairs.length });
    }
  }

  // Weekday index over normal days only (sale days would distort it)
  const cal = campaignCalendar(dataset);
  const normal = cur.filter((r) => {
    const t = dayTypeOf(r.key, cal);
    return t === 'weekday' || t === 'weekend';
  });
  const avg = normal.length ? normal.reduce((s, r) => s + r.current.gmv, 0) / normal.length : 0;
  const weekday = WD.map((label, w) => {
    const xs = normal.filter((r) => weekdayIndex(r.key) === w);
    return { weekday: w, label, days: xs.length, index: xs.length >= 2 && avg ? xs.reduce((s, r) => s + r.current.gmv, 0) / xs.length / avg : null };
  });

  const notes: Bilingual[] = [
    { vi: 'p < 0,05: khác biệt khó xảy ra chỉ do dao động ngẫu nhiên. p ≥ 0,05: có thể chỉ là dao động — chưa nên kết luận.', en: 'p < 0.05: unlikely to be random variation.' },
    { vi: 'Kiểm định giả định các ngày/đơn độc lập; ngày sale, mùa vụ và thay đổi cách đo có thể làm sai lệch.', en: 'Tests assume independence; sale days and seasonality can bias them.' },
    { vi: 'Tương quan chỉ cho biết hai chỉ số đi cùng nhau, không chứng minh cái này gây ra cái kia.', en: 'Correlation is not causation.' },
  ];
  return { tests, correlations: { series: series.map(({ key, label }) => ({ key, label })), cells }, weekday, notes };
}

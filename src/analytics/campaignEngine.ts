/**
 * Campaign & Calendar Engine.
 *
 * Day types come from the dataset's campaign calendar (mega sale, double day, payday);
 * when none is defined, double days (d.d) are recognised from the calendar and paydays
 * are left undefined rather than guessed. Every bucket reports its sample size (days)
 * and the engine warns when the analysed period is too short to call something a
 * pattern.
 */
import type { CampaignType, CanonicalDataset, Platform } from './model';
import type { DatasetFilter } from './filters';
import { breakdown, type BreakdownRow } from './breakdownEngine';
import { computeKpis, type KpiSet } from './kpiEngine';
import { compareValues, type Comparison } from './comparisonEngine';
import { adsSummary } from './adsLiveEngine';
import { orderHealth, type ReasonRow } from './orderHealthEngine';
import { addDays, enumerateDays, isInRange, rangeLength, toDayNumber, type DateRange } from './period';
import type { Bilingual } from './metric';

export type DayType = 'mega_sale' | 'double_day' | 'payday' | 'weekend' | 'weekday';

export const DAY_TYPE_LABELS: Record<DayType, Bilingual> = {
  mega_sale: { vi: 'Siêu sale / chiến dịch lớn', en: 'Mega sale' },
  double_day: { vi: 'Ngày đôi (8.8, 9.9…)', en: 'Double day' },
  payday: { vi: 'Ngày lương', en: 'Payday' },
  weekend: { vi: 'Cuối tuần', en: 'Weekend' },
  weekday: { vi: 'Ngày thường trong tuần', en: 'Weekday' },
};

const WEEKDAY_LABELS: Bilingual[] = [
  { vi: 'Thứ 2', en: 'Mon' },
  { vi: 'Thứ 3', en: 'Tue' },
  { vi: 'Thứ 4', en: 'Wed' },
  { vi: 'Thứ 5', en: 'Thu' },
  { vi: 'Thứ 6', en: 'Fri' },
  { vi: 'Thứ 7', en: 'Sat' },
  { vi: 'Chủ nhật', en: 'Sun' },
];

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(date: string): number {
  return (toDayNumber(date) + 3) % 7;
}

export interface CalendarEntry {
  campaignId: string;
  name: string;
  type: CampaignType;
  range: DateRange;
  /** true = recognised from the calendar (no campaign data in the file). */
  auto: boolean;
}

/** Campaigns from the dataset, or auto-recognised double days when none are defined. */
export function campaignCalendar(dataset: CanonicalDataset, within?: DateRange): CalendarEntry[] {
  const defined: CalendarEntry[] = dataset.campaigns.map((c) => ({
    campaignId: c.campaignId,
    name: c.name,
    type: c.type ?? 'other',
    range: { start: c.startDate, end: c.endDate },
    auto: false,
  }));
  if (defined.length > 0) return defined.filter((c) => !within || (c.range.end >= within.start && c.range.start <= within.end));
  const bounds = within ?? dataRange(dataset);
  if (!bounds) return [];
  return enumerateDays(bounds)
    .filter((d) => Number(d.slice(5, 7)) === Number(d.slice(8, 10)))
    .map((d) => ({ campaignId: `AUTO-${d}`, name: `${Number(d.slice(8, 10))}.${Number(d.slice(5, 7))}`, type: 'double_day' as CampaignType, range: { start: d, end: d }, auto: true }));
}

function dataRange(dataset: CanonicalDataset): DateRange | null {
  const dates = dataset.orders.map((o) => o.orderDate);
  if (dates.length === 0) return null;
  dates.sort();
  return { start: dates[0], end: dates[dates.length - 1] };
}

export function dayTypeOf(date: string, calendar: CalendarEntry[]): DayType {
  const hits = calendar.filter((c) => isInRange(date, c.range));
  if (hits.some((c) => c.type === 'mega_sale' || c.type === 'flash_sale' || c.type === 'brand_day' || c.type === 'other')) return 'mega_sale';
  if (hits.some((c) => c.type === 'double_day')) return 'double_day';
  if (hits.some((c) => c.type === 'payday')) return 'payday';
  const wd = weekdayIndex(date);
  return wd >= 5 ? 'weekend' : 'weekday';
}

export interface BucketStats {
  key: string;
  label: Bilingual;
  days: number;
  gmvPerDay: number | null;
  ordersPerDay: number | null;
  profitPerDay: number | null;
  aov: number | null;
  cancelRate: number | null;
  /** GMV per day vs the weekday baseline (ratio − 1). */
  upliftVsWeekday: number | null;
}

interface DayFacts {
  date: string;
  gmv: number;
  placed: number;
  valid: number;
  cancelled: number;
  profit: number | null;
}

function dayFacts(rows: BreakdownRow[]): Map<string, DayFacts> {
  return new Map(
    rows.map((r) => [r.key, { date: r.key, gmv: r.current.gmv, placed: r.current.placed, valid: r.current.valid, cancelled: r.current.cancelled, profit: r.current.profit }]),
  );
}

function bucket(key: string, label: Bilingual, days: string[], facts: Map<string, DayFacts>): BucketStats {
  const f = days.map((d) => facts.get(d) ?? { date: d, gmv: 0, placed: 0, valid: 0, cancelled: 0, profit: 0 });
  const n = f.length;
  const gmv = f.reduce((s, x) => s + x.gmv, 0);
  const placed = f.reduce((s, x) => s + x.placed, 0);
  const valid = f.reduce((s, x) => s + x.valid, 0);
  const cancelled = f.reduce((s, x) => s + x.cancelled, 0);
  const profitKnown = f.every((x) => x.profit !== null);
  const profit = profitKnown ? f.reduce((s, x) => s + (x.profit ?? 0), 0) : null;
  return {
    key,
    label,
    days: n,
    gmvPerDay: n ? gmv / n : null,
    ordersPerDay: n ? placed / n : null,
    profitPerDay: n && profit !== null ? profit / n : null,
    aov: valid ? gmv / valid : null,
    cancelRate: placed ? cancelled / placed : null,
    upliftVsWeekday: null,
  };
}

export interface CalendarPerformance {
  range: DateRange;
  analyzedDays: number;
  months: number;
  calendar: CalendarEntry[];
  autoCalendar: boolean;
  byDayType: BucketStats[];
  /** Normal days only (sale days excluded) so a mega sale does not skew a weekday. */
  byWeekday: BucketStats[];
  byDayOfMonth: (BucketStats & { saleDays: number })[];
  saleVsNormal: { sale: BucketStats; normal: BucketStats; uplift: number | null };
  warnings: Bilingual[];
}

export function calendarPerformance(dataset: CanonicalDataset, filter: DatasetFilter): CalendarPerformance {
  const range = filter.range;
  const days = enumerateDays(range);
  const calendar = campaignCalendar(dataset, range);
  const autoCalendar = calendar.length > 0 && calendar.every((c) => c.auto);
  const facts = dayFacts(breakdown(dataset, filter, 'day').rows);
  const typeOf = new Map(days.map((d) => [d, dayTypeOf(d, calendar)]));

  const types: DayType[] = ['mega_sale', 'double_day', 'payday', 'weekend', 'weekday'];
  const byDayType = types
    .map((t) => bucket(t, DAY_TYPE_LABELS[t], days.filter((d) => typeOf.get(d) === t), facts))
    .filter((b) => b.days > 0);
  const weekdayBase = byDayType.find((b) => b.key === 'weekday')?.gmvPerDay ?? null;
  for (const b of byDayType) b.upliftVsWeekday = weekdayBase && b.gmvPerDay !== null ? b.gmvPerDay / weekdayBase - 1 : null;

  const normalDays = days.filter((d) => typeOf.get(d) === 'weekend' || typeOf.get(d) === 'weekday');
  const byWeekday = WEEKDAY_LABELS.map((label, i) => bucket(String(i), label, normalDays.filter((d) => weekdayIndex(d) === i), facts));
  const byDayOfMonth = Array.from({ length: 31 }, (_, i) => {
    const dom = i + 1;
    const ds = days.filter((d) => Number(d.slice(8, 10)) === dom);
    return { ...bucket(String(dom), { vi: `Ngày ${dom}`, en: `Day ${dom}` }, ds, facts), saleDays: ds.filter((d) => !['weekday', 'weekend'].includes(typeOf.get(d)!)).length };
  }).filter((b) => b.days > 0);

  const saleDays = days.filter((d) => !normalDays.includes(d));
  const sale = bucket('sale', { vi: 'Ngày sale / chiến dịch', en: 'Sale days' }, saleDays, facts);
  const normal = bucket('normal', { vi: 'Ngày thường', en: 'Normal days' }, normalDays, facts);

  const months = new Set(days.map((d) => d.slice(0, 7))).size;
  const warnings: Bilingual[] = [];
  if (months < 2 || rangeLength(range) < 56) {
    warnings.push({
      vi: `Chỉ phân tích ${rangeLength(range)} ngày — chưa đủ để kết luận một quy luật lặp lại (nên có từ 2 tháng trở lên). Xem các số dưới đây như quan sát của kỳ này.`,
      en: `Only ${rangeLength(range)} days analysed — not enough to call a recurring pattern (2+ months recommended).`,
    });
  }
  if (autoCalendar) {
    warnings.push({
      vi: 'Chưa có lịch chiến dịch trong dữ liệu — chỉ tự nhận diện ngày đôi (d.d). Ngày lương và siêu sale khác chưa được đánh dấu.',
      en: 'No campaign calendar in the data — only double days are recognised automatically.',
    });
  }
  const thin = byWeekday.filter((b) => b.days > 0 && b.days < 3);
  if (thin.length > 0) {
    warnings.push({ vi: 'Một số thứ trong tuần có dưới 3 ngày mẫu — chênh lệch có thể do ngẫu nhiên.', en: 'Some weekdays have fewer than 3 sample days.' });
  }

  return {
    range,
    analyzedDays: days.length,
    months,
    calendar,
    autoCalendar,
    byDayType,
    byWeekday,
    byDayOfMonth,
    saleVsNormal: { sale, normal, uplift: sale.gmvPerDay !== null && normal.gmvPerDay ? sale.gmvPerDay / normal.gmvPerDay - 1 : null },
    warnings,
  };
}

export interface CampaignResult {
  entry: CalendarEntry;
  kpis: KpiSet;
  /** Average GMV per normal day in the 14 days before the campaign (sale days excluded). */
  baselineGmvPerDay: number | null;
  gmvPerDay: number | null;
  uplift: number | null;
  adSpend: number | null;
  topSkus: BreakdownRow[];
  cancelReasons: ReasonRow[];
}

export function campaignResult(dataset: CanonicalDataset, entry: CalendarEntry, platforms?: Platform[]): CampaignResult {
  const filter: DatasetFilter = { range: entry.range, platforms };
  const kpis = computeKpis(dataset, filter);
  const calendar = campaignCalendar(dataset);
  const before = enumerateDays({ start: addDays(entry.range.start, -14), end: addDays(entry.range.start, -1) }).filter((d) => {
    const t = dayTypeOf(d, calendar);
    return t === 'weekday' || t === 'weekend';
  });
  const facts = dayFacts(breakdown(dataset, { range: { start: addDays(entry.range.start, -14), end: addDays(entry.range.start, -1) }, platforms }, 'day').rows);
  const covered = computeKpis(dataset, { range: { start: addDays(entry.range.start, -14), end: addDays(entry.range.start, -1) }, platforms }).coverage === 'full';
  const baseline = covered && before.length ? before.reduce((s, d) => s + (facts.get(d)?.gmv ?? 0), 0) / before.length : null;
  const days = rangeLength(entry.range);
  const gmv = kpis.metrics.gmv.value;
  const gmvPerDay = gmv !== null ? gmv / days : null;
  const ads = adsSummary(dataset, filter);
  return {
    entry,
    kpis,
    baselineGmvPerDay: baseline,
    gmvPerDay,
    uplift: baseline && gmvPerDay !== null ? gmvPerDay / baseline - 1 : null,
    adSpend: ads.available ? ads.totals.spend : null,
    topSkus: breakdown(dataset, filter, 'sku').rows.slice(0, 5),
    cancelReasons: orderHealth(dataset, filter).cancelReasons.slice(0, 3),
  };
}

export interface CampaignComparison {
  a: CampaignResult;
  b: CampaignResult;
  changes: Record<'gmv' | 'orders' | 'aov' | 'cancelRate' | 'refundRate' | 'profit' | 'margin' | 'uplift' | 'adSpend', Comparison>;
}

/** B compared with A (A is the reference, e.g. 8.8 → 9.9). */
export function compareCampaigns(dataset: CanonicalDataset, a: CalendarEntry, b: CalendarEntry, platforms?: Platform[]): CampaignComparison {
  const ra = campaignResult(dataset, a, platforms);
  const rb = campaignResult(dataset, b, platforms);
  const m = (r: CampaignResult) => r.kpis.metrics;
  return {
    a: ra,
    b: rb,
    changes: {
      gmv: compareValues(m(rb).gmv.value, m(ra).gmv.value, 'vnd'),
      orders: compareValues(m(rb).orders.value, m(ra).orders.value, 'count'),
      aov: compareValues(m(rb).aov.value, m(ra).aov.value, 'vnd'),
      cancelRate: compareValues(m(rb).cancelRate.value, m(ra).cancelRate.value, 'ratio'),
      refundRate: compareValues(m(rb).refundRate.value, m(ra).refundRate.value, 'ratio'),
      profit: compareValues(m(rb).profit.value, m(ra).profit.value, 'vnd'),
      margin: compareValues(m(rb).margin.value, m(ra).margin.value, 'ratio'),
      uplift: compareValues(rb.uplift, ra.uplift, 'ratio'),
      adSpend: compareValues(rb.adSpend, ra.adSpend, 'vnd'),
    },
  };
}

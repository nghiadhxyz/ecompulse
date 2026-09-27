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
import { placedOnly } from './orderStage';
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

/**
 * Campaigns from the dataset plus the sale days the user confirmed (Settings / Campaign page);
 * when the dataset defines no campaign, double days are recognised automatically.
 */
export function campaignCalendar(dataset: CanonicalDataset, within?: DateRange): CalendarEntry[] {
  const confirmed: CalendarEntry[] = (dataset.costSettings?.confirmedSaleDays ?? []).map((d) => ({
    campaignId: `CONFIRMED-${d}`,
    name: `${Number(d.slice(8, 10))}.${Number(d.slice(5, 7))}`,
    type: 'mega_sale' as CampaignType,
    range: { start: d, end: d },
    auto: false,
  }));
  const overlaps = (c: CalendarEntry) => !within || (c.range.end >= within.start && c.range.start <= within.end);
  const defined: CalendarEntry[] = dataset.campaigns.map((c) => ({
    campaignId: c.campaignId,
    name: c.name,
    type: c.type ?? 'other',
    range: { start: c.startDate, end: c.endDate },
    auto: false,
  }));
  if (defined.length > 0) return [...defined, ...confirmed].filter(overlaps);
  if (confirmed.length > 0) {
    const autoDays = autoDoubleDays(dataset, within).filter((a) => !confirmed.some((c) => c.range.start === a.range.start));
    return [...confirmed.filter(overlaps), ...autoDays];
  }
  return autoDoubleDays(dataset, within);
}

function autoDoubleDays(dataset: CanonicalDataset, within?: DateRange): CalendarEntry[] {
  const bounds = within ?? dataRange(dataset);
  if (!bounds) return [];
  return enumerateDays(bounds)
    .filter((d) => Number(d.slice(5, 7)) === Number(d.slice(8, 10)))
    .map((d) => ({ campaignId: `AUTO-${d}`, name: `${Number(d.slice(8, 10))}.${Number(d.slice(5, 7))}`, type: 'double_day' as CampaignType, range: { start: d, end: d }, auto: true }));
}

function dataRange(dataset: CanonicalDataset): DateRange | null {
  const dates = dataset.orders.length ? dataset.orders.map((o) => o.orderDate) : dataset.dailyMetrics.map((d) => d.date);
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
  /** Orders AOV divides by: valid orders (order exports), or every order of the stage (summary reports, Shopee's definition). */
  aovOrders: number;
  cancelled: number;
  profit: number | null;
}

function dayFacts(rows: BreakdownRow[], summary: boolean): Map<string, DayFacts> {
  return new Map(
    rows.map((r) => [
      r.key,
      { date: r.key, gmv: r.current.gmv, placed: r.current.placed, aovOrders: summary ? r.current.placed : r.current.valid, cancelled: r.current.cancelled, profit: r.current.profit },
    ]),
  );
}

function bucket(key: string, label: Bilingual, days: string[], facts: Map<string, DayFacts>): BucketStats {
  const f = days.map((d) => facts.get(d) ?? { date: d, gmv: 0, placed: 0, aovOrders: 0, cancelled: 0, profit: 0 });
  const n = f.length;
  const gmv = f.reduce((s, x) => s + x.gmv, 0);
  const placed = f.reduce((s, x) => s + x.placed, 0);
  const aovOrders = f.reduce((s, x) => s + x.aovOrders, 0);
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
    aov: aovOrders ? gmv / aovOrders : null,
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
  /** False with less than 2 months of data: a day of the month is seen only once. */
  showByDayOfMonth: boolean;
  /** Days that look like sale days and are not in the calendar yet (5.4). */
  suggestedSaleDays: SaleDaySuggestion[];
  saleVsNormal: { sale: BucketStats; normal: BucketStats; uplift: number | null };
  warnings: Bilingual[];
}

export function calendarPerformance(dataset: CanonicalDataset, requested: DatasetFilter): CalendarPerformance {
  const filter = placedOnly(requested);
  const range = filter.range;
  const days = enumerateDays(range);
  const calendar = campaignCalendar(dataset, range);
  const autoCalendar = calendar.length > 0 && calendar.every((c) => c.auto);
  const facts = dayFacts(breakdown(dataset, filter, 'day').rows, dataset.orders.length === 0);
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
  // Day-of-month patterns need each day of the month seen at least twice (5.3).
  const showByDayOfMonth = days.length >= MIN_DAYS_FOR_DAY_OF_MONTH;

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
    showByDayOfMonth,
    suggestedSaleDays: suggestSaleDays(dataset, range, calendar, facts),
    saleVsNormal: { sale, normal, uplift: sale.gmvPerDay !== null && normal.gmvPerDay ? sale.gmvPerDay / normal.gmvPerDay - 1 : null },
    warnings,
  };
}

export const MIN_DAYS_FOR_DAY_OF_MONTH = 56;
/** Sales at least this many times the median day look like a sale day. */
export const SALE_DAY_MULTIPLE = 2.5;

export interface SaleDaySuggestion {
  date: string;
  reasons: Bilingual[];
  /** Already a double day in the automatic calendar (shown for confirmation). */
  autoDoubleDay: boolean;
}

/**
 * Days that look like sales and are not confirmed yet: a campaign date in a live-session title
 * ("MEGA LIVE 25.7" → 25/07), or placed sales ≥ 2,5 × the median day of the range.
 * Suggestions only — the user confirms them or enters the calendar by hand.
 */
export function suggestSaleDays(dataset: CanonicalDataset, range: DateRange, calendar: CalendarEntry[], facts: Map<string, DayFacts>): SaleDaySuggestion[] {
  const confirmed = new Set(calendar.filter((c) => !c.auto).flatMap((c) => enumerateDays(c.range)));
  const auto = new Set(calendar.filter((c) => c.auto).map((c) => c.range.start));
  const out = new Map<string, SaleDaySuggestion>();
  const add = (date: string, reason: Bilingual) => {
    if (!isInRange(date, range) || confirmed.has(date)) return;
    const s = out.get(date) ?? { date, reasons: [], autoDoubleDay: auto.has(date) };
    s.reasons.push(reason);
    out.set(date, s);
  };
  for (const s of dataset.liveSessions) {
    const m = s.title?.match(/(?:^|[^\d])(\d{1,2})[./](\d{1,2})(?![\d./])/);
    if (!m) continue;
    const day = Number(m[1]);
    const month = Number(m[2]);
    if (day < 1 || day > 31 || month < 1 || month > 12) continue;
    // The year of the session's period (sessions are period rows in summary reports).
    const years = new Set([(s.periodStart ?? s.date).slice(0, 4), s.date.slice(0, 4)]);
    for (const y of years) add(`${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, { vi: `Tên phiên live "${s.title}"`, en: `Live title "${s.title}"` });
  }
  const gmvs = enumerateDays(range).map((d) => facts.get(d)?.gmv ?? 0).sort((a, b) => a - b);
  const median = gmvs.length ? (gmvs.length % 2 ? gmvs[(gmvs.length - 1) / 2] : (gmvs[gmvs.length / 2 - 1] + gmvs[gmvs.length / 2]) / 2) : 0;
  if (median > 0) {
    for (const d of enumerateDays(range)) {
      const g = facts.get(d)?.gmv ?? 0;
      if (g >= SALE_DAY_MULTIPLE * median) {
        const x = (g / median).toFixed(1).replace('.', ',');
        add(d, { vi: `Doanh số đơn đặt gấp ${x} lần ngày trung vị`, en: `Placed sales ${(g / median).toFixed(1)}× the median day` });
      }
    }
  }
  return [...out.values()].sort((a, b) => a.date.localeCompare(b.date));
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
  const facts = dayFacts(breakdown(dataset, { range: { start: addDays(entry.range.start, -14), end: addDays(entry.range.start, -1) }, platforms }, 'day').rows, dataset.orders.length === 0);
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

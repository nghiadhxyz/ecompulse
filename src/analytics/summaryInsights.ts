/**
 * Insights from platform summary reports that need no order lines:
 *
 * - Subsidy dependence: share of placed sales funded by the platform, by day / week.
 * - Source drivers: which channel / traffic source moved sales between two windows.
 * - Stage funnel: placed → confirmed → paid by channel and source.
 * - Channel by weekday: e.g. daily Live channel sales by day of week (sale days excluded).
 * - Customer trend: new vs existing buyers by day / week.
 *
 * Every rate is recomputed from its numerator and denominator. Distinct counts (buyers)
 * summed over several days are labelled as sums of daily values; the whole-period
 * distinct count comes from the platform's period row when the range covers it.
 */
import type { CanonicalDataset, DailyMetric, SummaryChannel, SummaryStage } from './model';
import { sliceDataset, type DatasetFilter } from './filters';
import { rangeLength, type DateRange } from './period';
import { weekStart } from './breakdownEngine';
import { safeDivide, type Bilingual } from './metric';
import { campaignCalendar, dayTypeOf, weekdayIndex } from './campaignEngine';
import { dailySummaryRows, summaryRowsInRange, SUMMARY_CHANNEL_LABELS, SUMMARY_STACKED_CHANNELS } from './summaryEngine';
import { usablePeriodTotals } from './kpiEngine';

export type SeriesGrain = 'day' | 'week';

function bucketKey(date: string, grain: SeriesGrain): string {
  return grain === 'day' ? date : weekStart(date);
}

// ------------------------------------------------------------------ B1 subsidy

export interface SubsidyPoint {
  key: string;
  /** Days of data in the bucket (a week at the edge of the range can be short). */
  days: number;
  gmv: number;
  noSubsidyGmv: number;
  subsidy: number;
  /** subsidy / gmv. */
  share: number | null;
}

export interface SubsidyDependence {
  available: boolean;
  total: SubsidyPoint | null;
  points: SubsidyPoint[];
  notes: Bilingual[];
}

/**
 * Share of placed sales funded by the platform ("Doanh số" − "Doanh số không bao gồm trợ
 * giá bởi Shopee"), per day or week, recomputed from the sums — never averaged.
 */
export function subsidyDependence(dataset: CanonicalDataset, filter: DatasetFilter, grain: SeriesGrain = 'day'): SubsidyDependence {
  const slice = sliceDataset(dataset, filter);
  const rows = slice.dailyMetrics.filter((d) => d.placedGmv !== undefined && d.placedNoSubsidyGmv !== undefined);
  if (rows.length === 0) {
    return { available: false, total: null, points: [], notes: [{ vi: 'Báo cáo không có cột "Doanh số không bao gồm trợ giá bởi Shopee".', en: 'The report has no sales-excluding-subsidy column.' }] };
  }
  const buckets = new Map<string, SubsidyPoint>();
  for (const d of rows) {
    const k = bucketKey(d.date, grain);
    const b = buckets.get(k) ?? { key: k, days: 0, gmv: 0, noSubsidyGmv: 0, subsidy: 0, share: null };
    b.days++;
    b.gmv += d.placedGmv!;
    b.noSubsidyGmv += d.placedNoSubsidyGmv!;
    buckets.set(k, b);
  }
  const finish = (b: SubsidyPoint): SubsidyPoint => ({ ...b, subsidy: b.gmv - b.noSubsidyGmv, share: safeDivide(b.gmv - b.noSubsidyGmv, b.gmv) });
  const points = [...buckets.values()].map(finish).sort((a, b) => a.key.localeCompare(b.key));
  const totals = usablePeriodTotals(slice, 'placed');
  const total =
    totals && totals.every((t) => t.gmv !== undefined && t.noSubsidyGmv !== undefined)
      ? finish({ key: 'total', days: rows.length, gmv: totals.reduce((s, t) => s + t.gmv!, 0), noSubsidyGmv: totals.reduce((s, t) => s + t.noSubsidyGmv!, 0), subsidy: 0, share: null })
      : finish({ key: 'total', days: rows.length, gmv: points.reduce((s, p) => s + p.gmv, 0), noSubsidyGmv: points.reduce((s, p) => s + p.noSubsidyGmv, 0), subsidy: 0, share: null });
  const notes: Bilingual[] = [
    {
      vi: 'Phần trợ giá = Doanh số − Doanh số không bao gồm trợ giá bởi Shopee (đơn đã đặt). Tỷ lệ cao nghĩa là doanh số phụ thuộc nhiều vào voucher/trợ giá của sàn — khi sàn giảm trợ giá, doanh số có thể giảm theo.',
      en: 'Subsidy = sales − sales excluding Shopee subsidy (placed orders).',
    },
  ];
  if (grain === 'week' && points.some((p) => p.days < 7)) notes.push({ vi: 'Tuần ở đầu/cuối kỳ không đủ 7 ngày — cột "Số ngày" cho biết cỡ mẫu.', en: 'Edge weeks have fewer than 7 days.' });
  return { available: true, total, points, notes };
}

// ------------------------------------------------------------------ B2 source drivers

export interface SourceDriver {
  channel: SummaryChannel;
  /** Traffic source, or the channel key for channels reported without sources. */
  source: string;
  /** Average sales per day in each window. */
  before: number;
  after: number;
  delta: number;
  /** delta / total delta of the four channels (null when the total did not move). */
  shareOfChange: number | null;
}

export interface SourceDrivers {
  available: boolean;
  stage: SummaryStage;
  before: { range: DateRange; days: number; gmvPerDay: number };
  after: { range: DateRange; days: number; gmvPerDay: number };
  /** Channel-level change (sums to the total change). */
  channels: { channel: SummaryChannel; before: number; after: number; delta: number; shareOfChange: number | null }[];
  /** Source-level change, largest absolute change first. */
  sources: SourceDriver[];
  notes: Bilingual[];
}

/**
 * Which channel and traffic source explain a change in sales between two windows, per day
 * (so windows of different length compare fairly). Uses the daily source rows only;
 * sources within a channel add up to the channel.
 */
export function sourceDrivers(
  dataset: CanonicalDataset,
  before: DateRange,
  after: DateRange,
  options: { platforms?: DatasetFilter['platforms']; stage?: SummaryStage; excludeDates?: Set<string> } = {},
): SourceDrivers {
  const stage = options.stage ?? 'placed';
  const ex = options.excludeDates;
  const window = (range: DateRange) => {
    const rows = dailySummaryRows(dataset, range, stage, options.platforms).filter((r) => !ex?.has(r.date));
    const days = new Set(rows.map((r) => r.date)).size;
    return { rows, days };
  };
  const b = window(before);
  const a = window(after);
  const empty: SourceDrivers = {
    available: false,
    stage,
    before: { range: before, days: b.days, gmvPerDay: 0 },
    after: { range: after, days: a.days, gmvPerDay: 0 },
    channels: [],
    sources: [],
    notes: [{ vi: 'Cần số liệu theo nguồn truy cập từng ngày ở cả hai giai đoạn (sheet "Theo nguồn…" của báo cáo Phân tích bán hàng).', en: 'Daily traffic-source rows are needed in both windows.' }],
  };
  if (b.days === 0 || a.days === 0) return empty;
  const perDay = (rows: typeof b.rows, days: number, pick: (r: (typeof b.rows)[number]) => boolean) => rows.filter(pick).reduce((s, r) => s + (r.gmv ?? 0), 0) / days;
  const channels = SUMMARY_STACKED_CHANNELS.map((channel) => {
    const isCh = (r: (typeof b.rows)[number]) => r.dimension === 'channel' && r.channel === channel;
    const bv = perDay(b.rows, b.days, isCh);
    const av = perDay(a.rows, a.days, isCh);
    return { channel, before: bv, after: av, delta: av - bv, shareOfChange: null as number | null };
  }).filter((c) => c.before !== 0 || c.after !== 0);
  const totalBefore = channels.reduce((s, c) => s + c.before, 0);
  const totalAfter = channels.reduce((s, c) => s + c.after, 0);
  const totalDelta = totalAfter - totalBefore;
  for (const c of channels) c.shareOfChange = safeDivide(c.delta, totalDelta);
  const keys = new Set([...b.rows, ...a.rows].filter((r) => r.dimension === 'source').map((r) => `${r.channel}|${r.key}`));
  const sources: SourceDriver[] = [...keys].map((k) => {
    const [channel, source] = k.split('|') as [SummaryChannel, string];
    const isSrc = (r: (typeof b.rows)[number]) => r.dimension === 'source' && r.channel === channel && r.key === source;
    const bv = perDay(b.rows, b.days, isSrc);
    const av = perDay(a.rows, a.days, isSrc);
    return { channel, source, before: bv, after: av, delta: av - bv, shareOfChange: safeDivide(av - bv, totalDelta) };
  });
  sources.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
  const notes: Bilingual[] = [
    { vi: 'So sánh doanh số trung bình mỗi ngày của từng kênh và nguồn truy cập (đơn đã đặt). Tỷ trọng thay đổi âm nghĩa là nguồn đó đi ngược chiều với tổng.', en: 'Average sales per day by channel and source; negative share = moved against the total.' },
    { vi: 'Đây là phân rã số học, không phải kết luận nguyên nhân.', en: 'Arithmetic decomposition, not a causal claim.' },
  ];
  if (ex && ex.size) notes.push({ vi: 'Đã bỏ các ngày sale khỏi cả hai giai đoạn.', en: 'Sale days excluded from both windows.' });
  return {
    available: true,
    stage,
    before: { range: before, days: b.days, gmvPerDay: totalBefore },
    after: { range: after, days: a.days, gmvPerDay: totalAfter },
    channels: channels.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta)),
    sources,
    notes,
  };
}

// ------------------------------------------------------------------ B3 stage funnel

export interface StageFunnelRow {
  channel: SummaryChannel;
  /** Null for the channel total row. */
  source: string | null;
  placed: { gmv: number; orders: number | null };
  confirmed: { gmv: number | null; orders: number | null };
  paid: { gmv: number | null; orders: number | null };
  /** paid / placed on sales. */
  paidRateGmv: number | null;
  /** paid / placed on orders. */
  paidRateOrders: number | null;
  confirmedRateGmv: number | null;
  /** Placed sales lost before payment. */
  lostGmv: number | null;
}

export interface StageFunnel {
  available: boolean;
  rows: StageFunnelRow[];
  notes: Bilingual[];
}

/** Placed → confirmed → paid by channel and traffic source, from the per-stage sheets. */
export function stageFunnel(dataset: CanonicalDataset, filter: DatasetFilter): StageFunnel {
  const byStage = (stage: SummaryStage) => summaryRowsInRange(dataset, filter, stage).filter((r) => r.dimension === 'channel' || r.dimension === 'source');
  const placed = byStage('placed');
  const confirmed = byStage('confirmed');
  const paid = byStage('paid');
  if (placed.length === 0) return { available: false, rows: [], notes: [{ vi: 'Không có số liệu theo kênh trong khoảng này.', en: 'No channel data in this range.' }] };
  const agg = (rows: typeof placed, channel: SummaryChannel, source: string | null) => {
    const xs = rows.filter((r) => r.channel === channel && (source === null ? r.dimension === 'channel' : r.dimension === 'source' && r.key === source));
    if (xs.length === 0) return null;
    return { gmv: xs.reduce((s, r) => s + (r.gmv ?? 0), 0), orders: xs.some((r) => r.orders !== undefined) ? xs.reduce((s, r) => s + (r.orders ?? 0), 0) : null };
  };
  const rows: StageFunnelRow[] = [];
  for (const channel of SUMMARY_STACKED_CHANNELS) {
    const sources = [null, ...new Set(placed.filter((r) => r.channel === channel && r.dimension === 'source').map((r) => r.key))];
    for (const source of sources) {
      const p = agg(placed, channel, source);
      if (!p) continue;
      const c = agg(confirmed, channel, source);
      const d = agg(paid, channel, source);
      rows.push({
        channel,
        source,
        placed: p,
        confirmed: { gmv: c?.gmv ?? null, orders: c?.orders ?? null },
        paid: { gmv: d?.gmv ?? null, orders: d?.orders ?? null },
        paidRateGmv: d ? safeDivide(d.gmv, p.gmv) : null,
        paidRateOrders: d && d.orders !== null && p.orders !== null ? safeDivide(d.orders, p.orders) : null,
        confirmedRateGmv: c ? safeDivide(c.gmv, p.gmv) : null,
        lostGmv: d ? p.gmv - d.gmv : null,
      });
    }
  }
  return {
    available: rows.length > 0,
    rows,
    notes: [
      { vi: 'Tỷ lệ giữ = đơn đã thanh toán / đơn đã đặt của cùng kênh, cùng nguồn (tính lại từ tổng, không lấy trung bình các ngày). Phần rơi gồm đơn hủy, đơn chưa thanh toán trong kỳ.', en: 'Retention = paid / placed for the same channel and source.' },
      { vi: 'Đơn đã thanh toán trong kỳ có thể gồm đơn đặt trước kỳ, nên tỷ lệ theo từng ngày có thể dao động; xem theo trọn kỳ sẽ ổn định hơn.', en: 'Paid orders in a window can include orders placed before it.' },
    ],
  };
}

// ------------------------------------------------------------------ B4 channel by weekday

export interface WeekdayBucket {
  weekday: number;
  label: Bilingual;
  /** Days of this weekday in the range (sample size). */
  days: number;
  /** Days with sales > 0. */
  activeDays: number;
  gmv: number;
  orders: number | null;
  gmvPerDay: number | null;
  /** Share of days with sales. */
  activeRate: number | null;
  /** Fewer than MIN_DAYS_PER_WEEKDAY sample days: averages are withheld ("Chưa đủ dữ liệu"). */
  insufficient: boolean;
}

/** Below this many days with sales in the range, the weekday view is not shown. */
export const MIN_ACTIVE_DAYS = 3;
/** Below this many sample days for a weekday, its averages are not shown. */
export const MIN_DAYS_PER_WEEKDAY = 2;

export interface ChannelWeekday {
  available: boolean;
  channel: SummaryChannel;
  buckets: WeekdayBucket[];
  /** Days with sales in the range (sale days excluded). */
  activeDays: number;
  excludedSaleDays: number;
  notes: Bilingual[];
}

const WEEKDAYS: Bilingual[] = [
  { vi: 'Thứ 2', en: 'Mon' },
  { vi: 'Thứ 3', en: 'Tue' },
  { vi: 'Thứ 4', en: 'Wed' },
  { vi: 'Thứ 5', en: 'Thu' },
  { vi: 'Thứ 6', en: 'Fri' },
  { vi: 'Thứ 7', en: 'Sat' },
  { vi: 'Chủ nhật', en: 'Sun' },
];

/**
 * A channel's daily sales (e.g. Live) by day of week, from the daily channel rows. Sale
 * days (double days, mega sales, paydays) are excluded so one 8.8 does not decide a weekday.
 * This is channel level — per-session and per-time-slot analysis need session dates/times.
 */
export function channelWeekday(dataset: CanonicalDataset, filter: DatasetFilter, channel: SummaryChannel): ChannelWeekday {
  const calendar = campaignCalendar(dataset, filter.range);
  const rows = dailySummaryRows(dataset, filter.range, 'placed', filter.platforms).filter((r) => r.dimension === 'channel' && r.channel === channel);
  const saleDays = new Set(rows.map((r) => r.date).filter((d) => !['weekday', 'weekend'].includes(dayTypeOf(d, calendar))));
  const byDate = new Map<string, { gmv: number; orders: number | null }>();
  for (const r of rows) {
    if (saleDays.has(r.date)) continue;
    const cur = byDate.get(r.date) ?? { gmv: 0, orders: null };
    cur.gmv += r.gmv ?? 0;
    if (r.orders !== undefined) cur.orders = (cur.orders ?? 0) + r.orders;
    byDate.set(r.date, cur);
  }
  const label = SUMMARY_CHANNEL_LABELS[channel];
  if (byDate.size === 0) {
    return { available: false, channel, buckets: [], activeDays: 0, excludedSaleDays: saleDays.size, notes: [{ vi: `Chưa có doanh số ${label.vi} theo ngày trong khoảng này.`, en: `No daily ${label.en} sales in this range.` }] };
  }
  const activeDays = [...byDate.values()].filter((v) => v.gmv > 0).length;
  if (activeDays < MIN_ACTIVE_DAYS) {
    return {
      available: false,
      channel,
      buckets: [],
      activeDays,
      excludedSaleDays: saleDays.size,
      notes: [
        {
          vi: `Chưa đủ dữ liệu: chỉ có ${activeDays} ngày có doanh số ${label.vi} trong khoảng này (cần ít nhất ${MIN_ACTIVE_DAYS} ngày) để so sánh theo thứ.`,
          en: `Not enough data: only ${activeDays} day(s) with ${label.en} sales (at least ${MIN_ACTIVE_DAYS} needed).`,
        },
      ],
    };
  }
  const buckets: WeekdayBucket[] = WEEKDAYS.map((l, weekday) => {
    const days = [...byDate.entries()].filter(([d]) => weekdayIndex(d) === weekday);
    const gmv = days.reduce((s, [, v]) => s + v.gmv, 0);
    const withOrders = days.filter(([, v]) => v.orders !== null);
    const insufficient = days.length < MIN_DAYS_PER_WEEKDAY;
    return {
      weekday,
      label: l,
      days: days.length,
      activeDays: days.filter(([, v]) => v.gmv > 0).length,
      gmv,
      orders: withOrders.length ? withOrders.reduce((s, [, v]) => s + (v.orders ?? 0), 0) : null,
      gmvPerDay: insufficient ? null : gmv / days.length,
      activeRate: insufficient ? null : days.filter(([, v]) => v.gmv > 0).length / days.length,
      insufficient,
    };
  });
  const notes: Bilingual[] = [
    { vi: `Doanh số ${label.vi} theo từng ngày, gom theo thứ trong tuần. Cột "Số ngày" là cỡ mẫu — thứ có dưới ${MIN_DAYS_PER_WEEKDAY} ngày mẫu hiện "Chưa đủ dữ liệu".`, en: 'Daily channel sales grouped by weekday; "Days" is the sample size.' },
    { vi: 'Báo cáo không có ngày giờ của từng phiên live nên chưa phân tích được theo từng phiên và theo khung giờ.', en: 'No per-session date/time: per-session and time-slot analysis are unavailable.' },
  ];
  if (saleDays.size) notes.push({ vi: `Đã bỏ ${saleDays.size} ngày sale (ngày đôi, siêu sale…).`, en: `${saleDays.size} sale days excluded.` });
  if (rangeLength(filter.range) < 28) notes.push({ vi: 'Kỳ dưới 4 tuần — mỗi thứ có rất ít ngày, chưa đủ để kết luận.', en: 'Under 4 weeks of data.' });
  return { available: true, channel, buckets, activeDays, excludedSaleDays: saleDays.size, notes };
}

// ------------------------------------------------------------------ B5 customers

export interface CustomerTrendPoint {
  key: string;
  days: number;
  /** For a single day: distinct buyers. For a week: sum of daily distinct buyers. */
  buyers: number | null;
  newBuyers: number | null;
  existingBuyers: number | null;
  /** newBuyers / (newBuyers + existingBuyers), recomputed from the counts. */
  newShare: number | null;
}

export interface CustomerTrend {
  available: boolean;
  grain: SeriesGrain;
  points: CustomerTrendPoint[];
  /** Whole report period: the platform's distinct counts. */
  periodTotal: { buyers: number | null; newBuyers: number | null; existingBuyers: number | null; potentialBuyers: number | null; repeatRate: number | null; newShare: number | null } | null;
  notes: Bilingual[];
}

export function customerTrend(dataset: CanonicalDataset, filter: DatasetFilter, grain: SeriesGrain = 'day'): CustomerTrend {
  const slice = sliceDataset(dataset, filter);
  const rows = slice.dailyMetrics.filter((d) => d.newBuyers !== undefined || d.existingBuyers !== undefined);
  const noRfm: Bilingual = {
    vi: 'Báo cáo tổng hợp không có mã người mua nên chưa phân nhóm RFM, cohort hay giá trị vòng đời được — cần file xuất đơn hàng.',
    en: 'No buyer IDs in summary reports: RFM / cohorts need an order export.',
  };
  if (rows.length === 0) return { available: false, grain, points: [], periodTotal: null, notes: [{ vi: 'Báo cáo không có số người mua mới / hiện tại theo ngày.', en: 'No new/existing buyer counts.' }, noRfm] };
  const buckets = new Map<string, CustomerTrendPoint>();
  const add = (a: number | null, b: number | undefined) => (b === undefined ? a : (a ?? 0) + b);
  for (const d of rows as DailyMetric[]) {
    const k = bucketKey(d.date, grain);
    const p = buckets.get(k) ?? { key: k, days: 0, buyers: null, newBuyers: null, existingBuyers: null, newShare: null };
    p.days++;
    p.buyers = add(p.buyers, d.buyers);
    p.newBuyers = add(p.newBuyers, d.newBuyers);
    p.existingBuyers = add(p.existingBuyers, d.existingBuyers);
    buckets.set(k, p);
  }
  const points = [...buckets.values()]
    .map((p) => ({ ...p, newShare: p.newBuyers !== null && p.existingBuyers !== null ? safeDivide(p.newBuyers, p.newBuyers + p.existingBuyers) : null }))
    .sort((a, b) => a.key.localeCompare(b.key));
  const totals = usablePeriodTotals(slice, 'placed');
  const one = totals?.length === 1 ? totals[0] : null;
  const periodTotal = one
    ? {
        buyers: one.buyers ?? null,
        newBuyers: one.newBuyers ?? null,
        existingBuyers: one.existingBuyers ?? null,
        potentialBuyers: one.potentialBuyers ?? null,
        repeatRate: one.repeatRate ?? null,
        newShare: one.newBuyers !== undefined && one.existingBuyers !== undefined ? safeDivide(one.newBuyers, one.newBuyers + one.existingBuyers) : null,
      }
    : null;
  const notes: Bilingual[] = [];
  if (grain === 'week') notes.push({ vi: 'Số theo tuần là cộng số người mua từng ngày — một người mua nhiều ngày trong tuần được đếm nhiều lần.', en: 'Weekly values are sums of daily distinct counts.' });
  if (!periodTotal) notes.push({ vi: 'Chọn trọn kỳ báo cáo để xem số người mua khác nhau, người mua tiềm năng và tỉ lệ quay lại của cả kỳ.', en: 'Select the whole report period for distinct totals.' });
  notes.push({ vi: 'Người mua hiện tại = khách đã từng mua trước đó (theo định nghĩa của Shopee).', en: 'Existing buyers = bought before (Shopee definition).' });
  notes.push(noRfm);
  return { available: true, grain, points, periodTotal, notes };
}

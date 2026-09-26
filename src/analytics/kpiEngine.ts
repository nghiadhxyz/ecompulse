/**
 * KPI Engine — the single implementation of business KPI formulas.
 *
 * Definitions (order grain)
 *   orders          = orders placed in the period (all statuses)
 *   validOrders     = orders − cancelled − failed delivery
 *   gmv             = Σ line gross amount of valid orders (before shop discount)
 *   netRevenue      = gmv − seller discount − refund            (see profitEngine)
 *   aov             = gmv / validOrders
 *   cancelRate      = cancelled (incl. failed delivery) / orders
 *   refundRate      = (returned + refunded) / validOrders
 *   completionRate  = (delivered + completed) / orders
 *   cvr             = orders / product clicks (product-page views) — Shopee's definition
 *   visits          = daily unique visitors; only reported for single-day periods
 *                     because unique visitors do not add up across days
 *
 * Daily grain (platform summary reports without order rows) uses the platform's
 * own aggregates and marks anything it cannot derive as missing.
 */
import type { CanonicalDataset, DailyMetric, ShopPeriodTotal, SummaryStage } from './model';
import { datasetDateBounds, sliceDataset, type DatasetFilter, type DatasetSlice } from './filters';
import { rangeLength, toDayNumber, type DateRange } from './period';
import { isCancelled, isCompleted, isValidOrder } from './status';
import { hasAny, missing, ok, partial, ratioMetric, sum, type Bilingual, type MetricResult, type MetricUnit } from './metric';
import { computeProfit, type ProfitResult } from './profitEngine';
import { moneyTolerance, ORDER_TOLERANCE } from './periodRows';

export type DataGrain = 'order' | 'daily' | 'none';

export const KPI_KEYS = [
  'gmv',
  'placedGmv',
  'netRevenue',
  'orders',
  'validOrders',
  'completedOrders',
  'cancelledOrders',
  'returnedOrders',
  'refundedOrders',
  'units',
  'aov',
  'cancelRate',
  'refundRate',
  'completionRate',
  'visits',
  'cvr',
  'buyers',
  'adSpend',
  'roas',
  'profit',
  'margin',
] as const;

export type KpiKey = (typeof KPI_KEYS)[number];

export const KPI_UNITS: Record<KpiKey, MetricUnit> = {
  gmv: 'vnd',
  placedGmv: 'vnd',
  netRevenue: 'vnd',
  orders: 'count',
  validOrders: 'count',
  completedOrders: 'count',
  cancelledOrders: 'count',
  returnedOrders: 'count',
  refundedOrders: 'count',
  units: 'count',
  aov: 'vnd',
  cancelRate: 'ratio',
  refundRate: 'ratio',
  completionRate: 'ratio',
  visits: 'count',
  cvr: 'ratio',
  buyers: 'count',
  adSpend: 'vnd',
  roas: 'multiple',
  profit: 'vnd',
  margin: 'ratio',
};

export type Coverage = 'full' | 'partial' | 'none';

export interface KpiSet {
  range: DateRange;
  grain: DataGrain;
  coverage: Coverage;
  metrics: Record<KpiKey, MetricResult>;
  profit: ProfitResult | null;
}

export function datasetGrain(dataset: CanonicalDataset): DataGrain {
  if (dataset.orders.length > 0) return 'order';
  if (dataset.dailyMetrics.length > 0) return 'daily';
  return 'none';
}

export function rangeCoverage(dataset: CanonicalDataset, range: DateRange): Coverage {
  const bounds = datasetDateBounds(dataset);
  if (!bounds || range.end < bounds.start || range.start > bounds.end) return 'none';
  if (range.start >= bounds.start && range.end <= bounds.end) return 'full';
  return 'partial';
}

const NO_DATA: Bilingual = {
  vi: 'Khoảng thời gian này nằm ngoài dữ liệu đã nhập.',
  en: 'This period is outside the imported data.',
};

const ZERO_DENOM: Bilingual = { vi: 'Mẫu số bằng 0.', en: 'Denominator is zero.' };

function allMissing(note: Bilingual): Record<KpiKey, MetricResult> {
  const out = {} as Record<KpiKey, MetricResult>;
  for (const k of KPI_KEYS) out[k] = missing(KPI_UNITS[k], note);
  return out;
}

function need(unit: MetricUnit, vi: string, en: string, ...requires: string[]): MetricResult {
  return missing(unit, { vi, en }, requires);
}

/**
 * Whole-period shop totals the range can use: every such period lies inside the range and
 * every daily row in the range belongs to one of them (no extra days to add). Null otherwise.
 */
export function usablePeriodTotals(slice: DatasetSlice, stage: SummaryStage): ShopPeriodTotal[] | null {
  const { range, platforms } = slice.filter;
  const all = (slice.dataset.periodTotals ?? []).filter((t) => t.stage === stage && (!platforms?.length || platforms.includes(t.platform)));
  const inside = all.filter((t) => t.start >= range.start && t.end <= range.end);
  if (inside.length === 0 || slice.dailyMetrics.length === 0) return null;
  const covered = slice.dailyMetrics.every((d) => inside.some((t) => t.platform === d.platform && d.date >= t.start && d.date <= t.end));
  return covered ? inside : null;
}

const PERIOD_TOTAL_NOTE: Bilingual = {
  vi: 'Theo dòng tổng cả kỳ của sàn (số người khác nhau, không cộng từ các ngày).',
  en: "The platform's whole-period total (distinct count, not a sum of days).",
};

/** Distinct counts summed over days: a buyer or visitor active on several days counts several times. */
function dailyDistinctSum(label: Bilingual, what: Bilingual): Bilingual[] {
  return [
    {
      vi: `${label.vi}: cộng số liệu từng ngày — một ${what.vi} xuất hiện nhiều ngày được đếm nhiều lần, không phải số ${what.vi} khác nhau. Chọn trọn kỳ báo cáo để có số ${what.vi} khác nhau.`,
      en: `${label.en}: sum of daily counts — not distinct ${what.en}. Select the whole report period for distinct ${what.en}.`,
    },
  ];
}

export const VISITS_DAILY_LABEL: Bilingual = { vi: 'Lượt truy cập (cộng theo ngày)', en: 'Visits (sum of daily)' };
export const BUYERS_DAILY_LABEL: Bilingual = { vi: 'Lượt người mua (cộng theo ngày)', en: 'Buyers (sum of daily)' };

/**
 * Unique visitors. Not additive across days: a multi-day range uses the platform's
 * period total when it covers the whole report period, otherwise the sum of daily
 * values, relabelled and marked partial.
 */
function trafficVisits(slice: DatasetSlice, totals: ShopPeriodTotal[] | null = null): MetricResult {
  if (totals && totals.every((t) => t.visits !== undefined)) {
    return { ...ok(totals.reduce((s, t) => s + (t.visits ?? 0), 0), 'count'), notes: [PERIOD_TOTAL_NOTE] };
  }
  const has = hasAny(slice.traffic, (t) => t.visits) || hasAny(slice.dailyMetrics, (d) => d.visits);
  if (!has) return need('count', 'Chưa có lượt truy cập (Visits).', 'Visits are unavailable.', 'traffic.visits');
  const value = sum(slice.traffic, (t) => t.visits) + sum(slice.dailyMetrics, (d) => d.visits);
  if (rangeLength(slice.filter.range) > 1) {
    return { ...partial(value, 'count', dailyDistinctSum(VISITS_DAILY_LABEL, { vi: 'khách', en: 'visitors' }), ['traffic.visits (period total)']), label: VISITS_DAILY_LABEL };
  }
  return ok(value, 'count');
}

/**
 * Additive figure from the platform's period totals, with a warning when the daily rows
 * do not add up to it. Null when there are no usable totals for this field.
 */
function fromPeriodTotals(
  slice: DatasetSlice,
  totals: ShopPeriodTotal[] | null,
  pick: (t: ShopPeriodTotal) => number | undefined,
  dailyPick: (d: DailyMetric) => number | undefined,
  unit: MetricUnit,
): MetricResult | null {
  if (!totals || !totals.every((t) => pick(t) !== undefined)) return null;
  const value = totals.reduce((s, t) => s + (pick(t) ?? 0), 0);
  if (!hasAny(slice.dailyMetrics, dailyPick)) return ok(value, unit);
  const daily = sum(slice.dailyMetrics, dailyPick);
  // Only additive figures come here (sales, orders, cancellations, clicks) — never distinct
  // counts such as visitors or buyers, whose days are not meant to add up.
  if (Math.abs(daily - value) <= (unit === 'vnd' ? moneyTolerance(value) : ORDER_TOLERANCE)) return ok(value, unit);
  const fmt = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(v);
  return {
    ...ok(value, unit),
    warning: {
      vi: `Cộng các ngày = ${fmt(daily)}, dòng tổng của sàn = ${fmt(value)} (lệch ${fmt(daily - value)}) — đang dùng dòng tổng.`,
      en: `Daily rows add up to ${fmt(daily)} but the platform's total is ${fmt(value)} — using the total.`,
    },
  };
}

/** Product-page clicks/views — additive, the denominator of CVR. */
function productClicks(slice: DatasetSlice): MetricResult {
  const pick = (t: { productClicks?: number; productViews?: number }) => t.productClicks ?? t.productViews;
  if (hasAny(slice.traffic, pick)) return ok(sum(slice.traffic, pick), 'count');
  if (hasAny(slice.dailyMetrics, (d) => d.productClicks)) return ok(sum(slice.dailyMetrics, (d) => d.productClicks), 'count');
  return need(
    'count',
    'Không tính được CVR vì chưa có lượt xem/nhấp sản phẩm (Product Views).',
    'CVR unavailable: no product views/clicks.',
    'traffic.productClicks',
  );
}

function adMetrics(slice: DatasetSlice): { adSpend: MetricResult; roas: MetricResult } {
  const { dataset } = slice;
  if (dataset.ads.length === 0) {
    if (dataset.costSettings?.noAdsDeclared) {
      return { adSpend: ok(0, 'vnd'), roas: need('multiple', 'Không chạy quảng cáo.', 'No ads were run.') };
    }
    const m = need('vnd', 'Chưa có dữ liệu quảng cáo.', 'No advertising data.', 'ads.spend');
    return { adSpend: m, roas: { ...m, unit: 'multiple' } };
  }
  if (!hasAny(slice.ads, (a) => a.spend)) {
    const m = need('vnd', 'Báo cáo quảng cáo không có chi phí trong khoảng này.', 'The ads report has no spend in this range.', 'ads.spend');
    return { adSpend: m, roas: { ...m, unit: 'multiple' } };
  }
  const spend = sum(slice.ads, (a) => a.spend);
  const adSpend = ok(spend, 'vnd');
  if (!hasAny(slice.ads, (a) => a.attributedRevenue)) {
    return { adSpend, roas: need('multiple', 'Báo cáo quảng cáo không có doanh thu quy đổi.', 'The ads report has no attributed revenue.', 'ads.attributedRevenue') };
  }
  const roas = ratioMetric(ok(sum(slice.ads, (a) => a.attributedRevenue), 'vnd'), adSpend, 'multiple', ZERO_DENOM);
  return { adSpend, roas };
}

function orderGrainMetrics(slice: DatasetSlice, profit: ProfitResult): Record<KpiKey, MetricResult> {
  const { orders, lines } = slice;
  const statusById = new Map(orders.map((o) => [o.orderId, o.status]));

  let cancelled = 0;
  let completed = 0;
  let returned = 0;
  let refunded = 0;
  for (const o of orders) {
    if (isCancelled(o.status)) cancelled++;
    if (isCompleted(o.status)) completed++;
    if (o.status === 'returned') returned++;
    if (o.status === 'refunded') refunded++;
  }
  const placed = orders.length;
  const valid = placed - cancelled;

  let placedGmv = 0;
  let units = 0;
  for (const l of lines) {
    placedGmv += l.grossAmount || 0;
    const status = statusById.get(l.orderId);
    if (status && isValidOrder(status)) units += l.quantity || 0;
  }

  const ordersM = ok(placed, 'count');
  const validM = ok(valid, 'count');
  const gmv = profit.gmv;
  const visits = trafficVisits(slice);
  const { adSpend, roas } = adMetrics(slice);

  const validWithCustomer = orders.filter((o) => isValidOrder(o.status) && o.customerId).length;
  const buyers =
    valid > 0 && validWithCustomer === valid
      ? ok(new Set(orders.filter((o) => isValidOrder(o.status)).map((o) => o.customerId)).size, 'count')
      : valid === 0
        ? ok(0, 'count')
        : need('count', 'Không có mã khách hàng cho tất cả đơn hợp lệ.', 'Customer identifier is missing on some valid orders.', 'order.customerId');

  return {
    gmv,
    placedGmv: ok(placedGmv, 'vnd'),
    netRevenue: profit.netRevenue,
    orders: ordersM,
    validOrders: validM,
    completedOrders: ok(completed, 'count'),
    cancelledOrders: ok(cancelled, 'count'),
    returnedOrders: ok(returned, 'count'),
    refundedOrders: ok(refunded, 'count'),
    units: ok(units, 'count'),
    aov: ratioMetric(gmv, validM, 'vnd', ZERO_DENOM),
    cancelRate: ratioMetric(ok(cancelled, 'count'), ordersM, 'ratio', ZERO_DENOM),
    refundRate: ratioMetric(ok(returned + refunded, 'count'), validM, 'ratio', ZERO_DENOM),
    completionRate: ratioMetric(ok(completed, 'count'), ordersM, 'ratio', ZERO_DENOM),
    visits,
    cvr: ratioMetric(ordersM, productClicks(slice), 'ratio', ZERO_DENOM),
    buyers,
    adSpend,
    roas,
    profit: profit.profit,
    margin: profit.margin,
  };
}

function dailySum(slice: DatasetSlice, pick: (d: DatasetSlice['dailyMetrics'][number]) => number | undefined, unit: MetricUnit, note: Bilingual, field: string): MetricResult {
  return hasAny(slice.dailyMetrics, pick) ? ok(sum(slice.dailyMetrics, pick), unit) : missing(unit, note, [field]);
}

function dailyGrainMetrics(slice: DatasetSlice, profit: ProfitResult): Record<KpiKey, MetricResult> {
  const ORDER_LEVEL: Bilingual = {
    vi: 'Báo cáo tổng hợp không có chỉ số này — cần file xuất đơn hàng.',
    en: 'Summary reports do not contain this metric — an order export is required.',
  };
  // Whole report period selected → the platform's own totals; otherwise the daily rows.
  const placedTotals = usablePeriodTotals(slice, 'placed');
  const paidTotals = usablePeriodTotals(slice, 'paid');
  const pick = (
    totals: ShopPeriodTotal[] | null,
    tPick: (t: ShopPeriodTotal) => number | undefined,
    dPick: (d: DailyMetric) => number | undefined,
    unit: MetricUnit,
    field: string,
  ) => fromPeriodTotals(slice, totals, tPick, dPick, unit) ?? dailySum(slice, dPick, unit, ORDER_LEVEL, field);
  const placedOrders = pick(placedTotals, (t) => t.orders, (d) => d.placedOrders, 'count', 'daily.placedOrders');
  const paidOrders = pick(paidTotals, (t) => t.orders, (d) => d.paidOrders, 'count', 'daily.paidOrders');
  const paidGmv = pick(paidTotals, (t) => t.gmv, (d) => d.paidGmv, 'vnd', 'daily.paidGmv');
  const placedGmv = pick(placedTotals, (t) => t.gmv, (d) => d.placedGmv, 'vnd', 'daily.placedGmv');
  const cancelled = pick(placedTotals, (t) => t.cancelledOrders, (d) => d.cancelledOrders, 'count', 'daily.cancelledOrders');
  const refundedOrders = pick(placedTotals, (t) => t.refundedOrders, (d) => d.refundedOrders, 'count', 'daily.refundedOrders');
  const refundedGmv = pick(placedTotals, (t) => t.refundedGmv, (d) => d.refundedGmv, 'vnd', 'daily.refundedGmv');
  const units = dailySum(slice, (d) => d.units, 'count', ORDER_LEVEL, 'daily.units');
  const clicks = fromPeriodTotals(slice, placedTotals, (t) => t.productClicks, (d) => d.productClicks, 'count') ?? productClicks(slice);
  // Distinct buyers are not additive across days (a buyer can order on several days).
  const hasDailyBuyers = hasAny(slice.dailyMetrics, (d) => d.buyers);
  const buyers: MetricResult =
    placedTotals && placedTotals.every((t) => t.buyers !== undefined)
      ? { ...ok(placedTotals.reduce((s, t) => s + (t.buyers ?? 0), 0), 'count'), notes: [PERIOD_TOTAL_NOTE] }
      : rangeLength(slice.filter.range) === 1 || !hasDailyBuyers
        ? dailySum(slice, (d) => d.buyers, 'count', ORDER_LEVEL, 'daily.buyers')
        : {
            ...partial(sum(slice.dailyMetrics, (d) => d.buyers), 'count', dailyDistinctSum(BUYERS_DAILY_LABEL, { vi: 'người mua', en: 'buyers' }), ['order.customerId']),
            label: BUYERS_DAILY_LABEL,
          };
  const visits = trafficVisits(slice, placedTotals);
  const { adSpend, roas } = adMetrics(slice);

  // GMV here is the platform's paid-order sales figure.
  const gmv: MetricResult =
    paidGmv.value !== null
      ? { ...paidGmv, notes: [{ vi: 'Theo doanh số đơn đã thanh toán của sàn.', en: "Platform's paid-order sales." }] }
      : paidGmv;

  const netRevenue: MetricResult =
    paidGmv.value !== null && refundedGmv.value !== null
      ? partial(paidGmv.value - refundedGmv.value, 'vnd', [
          { vi: 'Chưa trừ voucher shop chịu (báo cáo tổng hợp không có).', en: 'Seller vouchers not deducted (not in summary report).' },
        ])
      : missing('vnd', ORDER_LEVEL, ['orderLines.sellerDiscount', 'daily.refundedGmv']);

  return {
    gmv,
    placedGmv,
    netRevenue,
    orders: placedOrders,
    validOrders: paidOrders,
    completedOrders: missing('count', ORDER_LEVEL, ['order.status']),
    cancelledOrders: cancelled,
    returnedOrders: missing('count', ORDER_LEVEL, ['order.status']),
    refundedOrders: refundedOrders,
    units,
    aov: ratioMetric(paidGmv, paidOrders, 'vnd', ZERO_DENOM),
    cancelRate: ratioMetric(cancelled, placedOrders, 'ratio', ZERO_DENOM),
    refundRate: ratioMetric(refundedOrders, paidOrders, 'ratio', ZERO_DENOM),
    completionRate: missing('ratio', ORDER_LEVEL, ['order.status']),
    visits,
    // Recomputed from numerator and denominator — never the platform's rate or an average of days.
    cvr: ratioMetric(placedOrders, clicks, 'ratio', ZERO_DENOM),
    buyers,
    adSpend,
    roas,
    profit: profit.profit,
    margin: profit.margin,
  };
}

/** Marks every computed metric as partial when the range is only partly covered by data. */
function withPartialCoverage(metrics: Record<KpiKey, MetricResult>, dataset: CanonicalDataset, range: DateRange): Record<KpiKey, MetricResult> {
  const bounds = datasetDateBounds(dataset)!;
  const coveredStart = range.start > bounds.start ? range.start : bounds.start;
  const coveredEnd = range.end < bounds.end ? range.end : bounds.end;
  const coveredDays = toDayNumber(coveredEnd) - toDayNumber(coveredStart) + 1;
  const note: Bilingual = {
    vi: `Dữ liệu chỉ phủ ${coveredDays}/${rangeLength(range)} ngày của kỳ này.`,
    en: `Data covers only ${coveredDays}/${rangeLength(range)} days of this period.`,
  };
  const out = {} as Record<KpiKey, MetricResult>;
  for (const k of KPI_KEYS) {
    const m = metrics[k];
    out[k] = m.value === null ? m : { ...m, status: 'partial', notes: [...(m.notes || []), note] };
  }
  return out;
}

export function computeKpis(dataset: CanonicalDataset, filter: DatasetFilter): KpiSet {
  const grain = datasetGrain(dataset);
  const coverage = grain === 'none' ? 'none' : rangeCoverage(dataset, filter.range);
  if (grain === 'none' || coverage === 'none') {
    return { range: filter.range, grain, coverage: 'none', metrics: allMissing(NO_DATA), profit: null };
  }
  const slice = sliceDataset(dataset, filter);
  const profit = computeProfit(slice);
  const metrics = grain === 'order' ? orderGrainMetrics(slice, profit) : dailyGrainMetrics(slice, profit);
  return {
    range: filter.range,
    grain,
    coverage,
    metrics: coverage === 'partial' ? withPartialCoverage(metrics, dataset, filter.range) : metrics,
    profit,
  };
}

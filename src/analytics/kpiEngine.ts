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
import type { CanonicalDataset } from './model';
import { datasetDateBounds, sliceDataset, type DatasetFilter, type DatasetSlice } from './filters';
import { rangeLength, toDayNumber, type DateRange } from './period';
import { isCancelled, isCompleted, isValidOrder } from './status';
import { hasAny, missing, ok, partial, ratioMetric, sum, type Bilingual, type MetricResult, type MetricUnit } from './metric';
import { computeProfit, type ProfitResult } from './profitEngine';

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

/** Unique visitors. Not additive across days, so multi-day periods report it as missing. */
function trafficVisits(slice: DatasetSlice): MetricResult {
  const has = hasAny(slice.traffic, (t) => t.visits) || hasAny(slice.dailyMetrics, (d) => d.visits);
  if (!has) return need('count', 'Chưa có lượt truy cập (Visits).', 'Visits are unavailable.', 'traffic.visits');
  if (rangeLength(slice.filter.range) > 1) {
    return need(
      'count',
      'Lượt truy cập theo ngày là khách duy nhất, không cộng dồn được cho nhiều ngày.',
      'Daily visitors are unique counts and cannot be summed across days.',
      'traffic.visits (period total)',
    );
  }
  return ok(sum(slice.traffic, (t) => t.visits) + sum(slice.dailyMetrics, (d) => d.visits), 'count');
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
  const placedOrders = dailySum(slice, (d) => d.placedOrders, 'count', ORDER_LEVEL, 'daily.placedOrders');
  const paidOrders = dailySum(slice, (d) => d.paidOrders, 'count', ORDER_LEVEL, 'daily.paidOrders');
  const paidGmv = dailySum(slice, (d) => d.paidGmv, 'vnd', ORDER_LEVEL, 'daily.paidGmv');
  const placedGmv = dailySum(slice, (d) => d.placedGmv, 'vnd', ORDER_LEVEL, 'daily.placedGmv');
  const cancelled = dailySum(slice, (d) => d.cancelledOrders, 'count', ORDER_LEVEL, 'daily.cancelledOrders');
  const refundedOrders = dailySum(slice, (d) => d.refundedOrders, 'count', ORDER_LEVEL, 'daily.refundedOrders');
  const refundedGmv = dailySum(slice, (d) => d.refundedGmv, 'vnd', ORDER_LEVEL, 'daily.refundedGmv');
  const units = dailySum(slice, (d) => d.units, 'count', ORDER_LEVEL, 'daily.units');
  // Distinct buyers are not additive across days (a buyer can order on several days).
  const buyers =
    rangeLength(slice.filter.range) === 1
      ? dailySum(slice, (d) => d.buyers, 'count', ORDER_LEVEL, 'daily.buyers')
      : missing(
          'count',
          { vi: 'Số người mua theo ngày không cộng dồn được cho nhiều ngày — cần mã khách hàng cấp đơn.', en: 'Daily buyer counts cannot be summed across days — order-level customer IDs are required.' },
          ['order.customerId'],
        );
  const visits = trafficVisits(slice);
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
    cvr: ratioMetric(placedOrders, productClicks(slice), 'ratio', ZERO_DENOM),
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

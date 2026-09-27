/**
 * KPI Engine — the single implementation of business KPI formulas.
 *
 * Definitions (order grain) — placed orders, as the Shopee report counts them, so an order
 * export and a summary report of the same period give the same figures:
 *   orders          = orders placed in the period (all statuses)
 *   validOrders     = orders − cancelled − failed delivery
 *   gmv             = Σ line gross amount of every placed order, cancellations included
 *   netRevenue      = gmv − cancelled sales − refunds   (seller vouchers only in profit)
 *   aov             = gmv / orders
 *   cancelRate      = cancelled (incl. failed delivery) / orders
 *   refundRate      = (returned + refunded) / orders
 *   buyers          = distinct buyers of the placed orders (buyers of cancelled orders too)
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
import { stageDay, stageOf, STAGE_BASIS } from './orderStage';
import { compareCopies, DAILY_SUM_LABEL, FILE_RATE_LABEL, fmtMismatchValue, PERIOD_ROW_LABEL, RECOMPUTED_LABEL } from './mismatch';

export type DataGrain = 'order' | 'daily' | 'none';

export const KPI_KEYS = [
  'gmv',
  'placedGmv',
  'paidGmv',
  'paidOrders',
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
  paidGmv: 'vnd',
  paidOrders: 'count',
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
  const mismatch = compareCopies('period-vs-days', { vi: 'Số liệu', en: 'Figure' }, unit, { label: PERIOD_ROW_LABEL, value }, { label: DAILY_SUM_LABEL, value: daily });
  if (!mismatch) return ok(value, unit);
  const fmt = (v: number) => fmtMismatchValue(v, unit);
  return {
    ...ok(value, unit),
    mismatch,
    warning: {
      vi: `Dữ liệu không khớp: dòng tổng ${fmt(value)} · cộng ngày ${fmt(daily)} (lệch ${fmt(Math.abs(daily - value))}). Thẻ dùng dòng tổng, biểu đồ theo ngày dùng cộng ngày.`,
      en: `Data does not match: period row ${fmt(value)} vs sum of days ${fmt(daily)}. The card uses the period row, daily charts the days.`,
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
  let cancelledGmv = 0;
  let units = 0;
  const grossById = new Map<string, number>();
  for (const l of lines) {
    placedGmv += l.grossAmount || 0;
    grossById.set(l.orderId, (grossById.get(l.orderId) ?? 0) + (l.grossAmount || 0));
    const status = statusById.get(l.orderId);
    if (status && isCancelled(status)) cancelledGmv += l.grossAmount || 0;
    if (status && isValidOrder(status)) units += l.quantity || 0;
  }
  // Refunds of returned / refunded orders (the importer fills the amount when the file has none).
  let refundGmv = 0;
  for (const o of orders) if ((o.status === 'returned' || o.status === 'refunded') && !isCancelled(o.status)) refundGmv += o.refundAmount ?? grossById.get(o.orderId) ?? 0;

  const ordersM = ok(placed, 'count');
  const validM = ok(valid, 'count');
  // Placed-order sales, cancellations included — Shopee's "Tổng doanh số" (đơn đã đặt).
  const gmv = ok(placedGmv, 'vnd');
  // "Trọn kỳ" is judged per file: when a summary report covers the range, its period row
  // gives the distinct visitors (never a sum of days).
  const visits = trafficVisits(slice, usablePeriodTotals(slice, 'placed'));
  const { adSpend, roas } = adMetrics(slice);

  // Buyers of every placed order (a buyer whose order was cancelled still bought).
  const withCustomer = orders.filter((o) => o.customerId).length;
  const buyers =
    placed > 0 && withCustomer === placed
      ? ok(new Set(orders.map((o) => o.customerId)).size, 'count')
      : placed === 0
        ? ok(0, 'count')
        : need('count', 'Không có mã khách hàng cho tất cả đơn.', 'Customer identifier is missing on some orders.', 'order.customerId');
  const netRevenue: MetricResult = {
    ...ok(placedGmv - cancelledGmv - refundGmv, 'vnd'),
    notes: [
      {
        vi: `Doanh số đơn đặt ${fmtVnd(placedGmv)} − doanh số hủy ${fmtVnd(cancelledGmv)} − tiền hoàn ${fmtVnd(refundGmv)}. Voucher shop chịu được trừ ở phần lợi nhuận.`,
        en: 'Placed sales − cancelled sales − refunds. Seller vouchers are deducted in profit.',
      },
    ],
  };

  return {
    gmv,
    placedGmv: ok(placedGmv, 'vnd'),
    // "Tiền về" by payment day only exists in platform summary reports.
    paidGmv: need('vnd', 'Chỉ có trong báo cáo tổng hợp của sàn.', 'Summary reports only.'),
    paidOrders: need('count', 'Chỉ có trong báo cáo tổng hợp của sàn.', 'Summary reports only.'),
    netRevenue,
    orders: ordersM,
    validOrders: validM,
    completedOrders: ok(completed, 'count'),
    cancelledOrders: ok(cancelled, 'count'),
    returnedOrders: ok(returned, 'count'),
    // "Đơn đã hoàn trả / hoàn tiền": returns and refunds together, as in the Shopee report.
    refundedOrders: ok(returned + refunded, 'count'),
    units: ok(units, 'count'),
    aov: ratioMetric(gmv, ordersM, 'vnd', ZERO_DENOM),
    cancelRate: ratioMetric(ok(cancelled, 'count'), ordersM, 'ratio', ZERO_DENOM),
    refundRate: ratioMetric(ok(returned + refunded, 'count'), ordersM, 'ratio', ZERO_DENOM),
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
  // One order stage for every figure below (placed unless the filter asks otherwise), so
  // GMV, orders, AOV, cancellations and refunds always count the same orders.
  const stage = stageOf(slice.filter);
  const day = (d: DailyMetric) => stageDay(d, stage);
  // Whole report period selected → the platform's own totals; otherwise the daily rows.
  const totals = usablePeriodTotals(slice, stage);
  const placedTotals = usablePeriodTotals(slice, 'placed');
  const paidTotals = usablePeriodTotals(slice, 'paid');
  // The source is chosen once per set of totals: the period row when it covers the range,
  // the days otherwise. A field the period row lacks is missing — never filled from the days,
  // so a ratio never takes its numerator and denominator from two sources (canonicalSources.ts).
  const NOT_IN_PERIOD_ROW: Bilingual = { vi: 'Dòng tổng cả kỳ của sàn không có chỉ số này.', en: "The platform's period row lacks this figure." };
  const pick = (
    tot: ShopPeriodTotal[] | null,
    tPick: (t: ShopPeriodTotal) => number | undefined,
    dPick: (d: DailyMetric) => number | undefined,
    unit: MetricUnit,
    field: string,
  ) => (tot ? fromPeriodTotals(slice, tot, tPick, dPick, unit) ?? missing(unit, NOT_IN_PERIOD_ROW, [field]) : dailySum(slice, dPick, unit, ORDER_LEVEL, field));
  const gmvRaw = pick(totals, (t) => t.gmv, (d) => day(d).gmv, 'vnd', `daily.${stage}Gmv`);
  const orders = pick(totals, (t) => t.orders, (d) => day(d).orders, 'count', `daily.${stage}Orders`);
  const cancelled = pick(totals, (t) => t.cancelledOrders, (d) => day(d).cancelledOrders, 'count', 'daily.cancelledOrders');
  const refundedOrders = pick(totals, (t) => t.refundedOrders, (d) => day(d).refundedOrders, 'count', 'daily.refundedOrders');
  const refundedGmv = pick(totals, (t) => t.refundedGmv, (d) => day(d).refundedGmv, 'vnd', 'daily.refundedGmv');
  const cancelledGmv = pick(totals, (t) => t.cancelledGmv, (d) => day(d).cancelledGmv, 'vnd', 'daily.cancelledGmv');
  // Placed-order sales and "tiền về" (paid) are also offered on their own, always labelled.
  const placedGmv = pick(placedTotals, (t) => t.gmv, (d) => d.placedGmv, 'vnd', 'daily.placedGmv');
  const paidGmv = pick(paidTotals, (t) => t.gmv, (d) => d.paidGmv, 'vnd', 'daily.paidGmv');
  const paidOrders = pick(paidTotals, (t) => t.orders, (d) => d.paidOrders, 'count', 'daily.paidOrders');
  const units = dailySum(slice, (d) => d.units, 'count', ORDER_LEVEL, 'daily.units');
  const clicks = fromPeriodTotals(slice, totals, (t) => t.productClicks, (d) => d.productClicks, 'count') ?? productClicks(slice);
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
  const basis = STAGE_BASIS[stage];

  const gmv: MetricResult =
    gmvRaw.value !== null ? { ...gmvRaw, notes: [{ vi: `Doanh số ${basis.vi.toLowerCase()} của sàn.`, en: `Platform sales, ${basis.en.toLowerCase()}.` }] } : gmvRaw;

  // Sales still kept: the stage's sales minus its cancelled sales and its refunds — all three
  // from the same stage (and from the period row or the days, never mixed).
  const netRevenue: MetricResult =
    gmvRaw.value !== null && cancelledGmv.value !== null && refundedGmv.value !== null
      ? {
          ...partial(gmvRaw.value - cancelledGmv.value - refundedGmv.value, 'vnd', [
            {
              vi: `Doanh số ${basis.vi.toLowerCase()} ${fmtVnd(gmvRaw.value)} − doanh số hủy ${fmtVnd(cancelledGmv.value)} − tiền hoàn ${fmtVnd(refundedGmv.value)} (cùng mức đơn). Chưa trừ voucher shop chịu (báo cáo tổng hợp không có).`,
              en: 'Sales − cancelled sales − refunds, same order stage. Seller vouchers not deducted (not in summary report).',
            },
          ]),
          warning: gmvRaw.warning ?? cancelledGmv.warning ?? refundedGmv.warning,
          mismatch: gmvRaw.mismatch ?? cancelledGmv.mismatch ?? refundedGmv.mismatch,
        }
      : missing('vnd', ORDER_LEVEL, ['orderLines.sellerDiscount', 'daily.cancelledGmv', 'daily.refundedGmv']);

  // Recomputed from numerator and denominator — never the platform's rate or an average of days.
  // The platform's own figure is only compared, so a report that disagrees with itself is visible.
  const cvr = ratioMetric(orders, clicks, 'ratio', ZERO_DENOM);
  const reportedCvr = totals && totals.length === 1 ? totals[0].reportedCvr : undefined;
  if (cvr.value !== null && reportedCvr !== undefined && Math.abs(cvr.value - reportedCvr) > CVR_TOLERANCE) {
    const pct = (v: number) => new Intl.NumberFormat('vi-VN', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
    const count = (v: number | null) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(v ?? 0);
    const gap = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(Math.abs(cvr.value - reportedCvr) * 100);
    cvr.warning = {
      vi: `Dữ liệu không khớp: file ghi CVR ${pct(reportedCvr)}, tính lại ${basis.vi} ÷ Lượt nhấp sản phẩm = ${count(orders.value)} ÷ ${count(clicks.value)} = ${pct(cvr.value)} (lệch ${gap} điểm %). Đang dùng số tính lại.`,
      en: `Data does not match: the file states CVR ${pct(reportedCvr)} but orders ÷ product clicks = ${pct(cvr.value)}. Using the recomputed value.`,
    };
    cvr.mismatch = compareCopies('cvr', { vi: 'CVR', en: 'CVR' }, 'ratio', { label: RECOMPUTED_LABEL, value: cvr.value }, { label: FILE_RATE_LABEL, value: reportedCvr }) ?? undefined;
  }

  // Valid orders = orders of the stage that were not cancelled.
  const validOrders: MetricResult =
    orders.value !== null && cancelled.value !== null ? { ...ok(orders.value - cancelled.value, 'count'), warning: orders.warning ?? cancelled.warning, mismatch: orders.mismatch ?? cancelled.mismatch } : orders;

  const metrics: Record<KpiKey, MetricResult> = {
    gmv,
    placedGmv,
    paidGmv,
    paidOrders,
    netRevenue,
    orders,
    validOrders,
    completedOrders: missing('count', ORDER_LEVEL, ['order.status']),
    cancelledOrders: cancelled,
    returnedOrders: missing('count', ORDER_LEVEL, ['order.status']),
    refundedOrders,
    units,
    // Shopee's "Doanh số trên mỗi đơn hàng": sales ÷ orders of the same stage.
    aov: ratioMetric(gmvRaw, orders, 'vnd', ZERO_DENOM),
    cancelRate: ratioMetric(cancelled, orders, 'ratio', ZERO_DENOM),
    refundRate: ratioMetric(refundedOrders, orders, 'ratio', ZERO_DENOM),
    completionRate: missing('ratio', ORDER_LEVEL, ['order.status']),
    visits,
    cvr,
    buyers,
    adSpend,
    roas,
    profit: profit.profit,
    margin: profit.margin,
  };
  for (const k of STAGED_KPIS) if (metrics[k].value !== null) metrics[k] = { ...metrics[k], basis };
  if (placedGmv.value !== null) metrics.placedGmv = { ...placedGmv, basis: STAGE_BASIS.placed };
  if (paidGmv.value !== null) metrics.paidGmv = { ...paidGmv, basis: STAGE_BASIS.paid };
  if (paidOrders.value !== null) metrics.paidOrders = { ...paidOrders, basis: STAGE_BASIS.paid };
  return metrics;
}

const CVR_TOLERANCE = 0.0005; // 0,05 điểm %: the platform prints rates with 2 decimals

const fmtVnd = (v: number) => `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(v)}đ`;

/** KPIs that count the selected order stage (summary reports only). */
const STAGED_KPIS: KpiKey[] = ['gmv', 'netRevenue', 'orders', 'validOrders', 'cancelledOrders', 'refundedOrders', 'aov', 'cancelRate', 'refundRate', 'cvr'];

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

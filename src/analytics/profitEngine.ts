/**
 * Profit Engine — contribution profit waterfall.
 *
 *   GMV (non-cancelled orders, before shop discounts)
 * − Seller discount / voucher (shop-funded only; platform subsidies are not a shop cost)
 * − Refund
 * = Net Revenue
 * − COGS − Platform fee − Payment fee − Affiliate commission − Ads − Seller shipping − Other costs
 * = Contribution Profit
 *
 * Missing cost inputs are never silently treated as 0: each line reports its source,
 * and the result is `partial` (with warnings) or `insufficient`.
 */
import type { CanonicalDataset, Order, OrderLine, Platform } from './model';
import { PLATFORM_LABELS } from './model';
import type { DatasetSlice } from './filters';
import { getDatasetIndex } from './filters';
import { isCancelled, isReturnOrRefund, consumesCogs } from './status';
import { missing, ok, partial, safeDivide, type Bilingual, type MetricResult } from './metric';

export type ProfitLineKey =
  | 'gmv'
  | 'sellerDiscount'
  | 'refund'
  | 'netRevenue'
  | 'cogs'
  | 'platformFee'
  | 'paymentFee'
  | 'affiliate'
  | 'ads'
  | 'shipping'
  | 'otherCosts'
  | 'profit';

/**
 * data — from imported records · user_rate — user's fee rate × net revenue
 * declared_none — user declared the cost does not apply · not_applicable — no activity of that kind
 * assumed — derived by a documented rule · missing — unknown (counted as 0, flagged)
 */
export type CostSource = 'data' | 'user_rate' | 'declared_none' | 'not_applicable' | 'assumed' | 'missing' | 'computed';

export interface ProfitLine {
  key: ProfitLineKey;
  label: Bilingual;
  amount: number | null;
  source: CostSource;
  note?: Bilingual;
}

export type ProfitCompleteness = 'complete' | 'partial' | 'insufficient';

export interface ProfitResult {
  completeness: ProfitCompleteness;
  lines: ProfitLine[];
  gmv: MetricResult;
  sellerDiscount: MetricResult;
  refund: MetricResult;
  netRevenue: MetricResult;
  cogs: MetricResult;
  profit: MetricResult;
  margin: MetricResult;
  warnings: Bilingual[];
  /** SKUs sold in the slice that have no unit COGS. */
  missingCogsSkus: string[];
  /** Share of net line revenue whose COGS is unknown (0–1). */
  revenueShareWithoutCogs: number;
  assumedRefundOrders: number;
}

const LABELS: Record<ProfitLineKey, Bilingual> = {
  gmv: { vi: 'GMV', en: 'GMV' },
  sellerDiscount: { vi: 'Voucher/giảm giá shop chịu', en: 'Seller discount/voucher' },
  refund: { vi: 'Hoàn tiền', en: 'Refund' },
  netRevenue: { vi: 'Doanh thu thuần', en: 'Net revenue' },
  cogs: { vi: 'Giá vốn (COGS)', en: 'COGS' },
  platformFee: { vi: 'Phí sàn', en: 'Platform fees' },
  paymentFee: { vi: 'Phí thanh toán', en: 'Payment fees' },
  affiliate: { vi: 'Hoa hồng affiliate', en: 'Affiliate commission' },
  ads: { vi: 'Quảng cáo', en: 'Ads' },
  shipping: { vi: 'Phí vận chuyển shop chịu', en: 'Seller shipping' },
  otherCosts: { vi: 'Chi phí khác', en: 'Other costs' },
  profit: { vi: 'Lợi nhuận đóng góp', en: 'Contribution profit' },
};

export function resolveUnitCogs(dataset: CanonicalDataset, line: OrderLine): number | undefined {
  const override = dataset.costSettings?.skuCogs?.[line.sku];
  if (typeof override === 'number' && Number.isFinite(override)) return override;
  if (typeof line.unitCogs === 'number' && Number.isFinite(line.unitCogs)) return line.unitCogs;
  const product = catalogCogs(dataset).get(line.sku);
  return product;
}

const cogsCache = new WeakMap<CanonicalDataset, Map<string, number>>();
function catalogCogs(dataset: CanonicalDataset): Map<string, number> {
  let map = cogsCache.get(dataset);
  if (!map) {
    map = new Map();
    for (const p of dataset.products) {
      if (typeof p.unitCogs === 'number' && Number.isFinite(p.unitCogs)) map.set(p.sku, p.unitCogs);
    }
    cogsCache.set(dataset, map);
  }
  return map;
}

type FeeField = 'platformFee' | 'paymentFee' | 'affiliateCommission' | 'shippingFeeSeller';

/** Does the dataset carry this order-level fee for the platform at all? */
function datasetHasOrderFee(dataset: CanonicalDataset, platform: Platform, field: FeeField): boolean {
  return dataset.orders.some((o) => o.platform === platform && typeof o[field] === 'number');
}

interface OrderAccumulator {
  gmv: number;
  sellerDiscount: number;
  refund: number;
  cogs: number;
  cogsKnownRevenue: number;
  cogsUnknownRevenue: number;
  fees: Record<FeeField, number>;
  netByPlatform: Map<Platform, number>;
  assumedRefundOrders: number;
  missingCogsSkus: Set<string>;
}

function accumulateOrder(dataset: CanonicalDataset, order: Order, subset: OrderLine[], acc: OrderAccumulator) {
  if (isCancelled(order.status) || subset.length === 0) return;
  const allLines = getDatasetIndex(dataset).linesByOrder.get(order.orderId) || subset;
  const grossAll = allLines.reduce((s, l) => s + (l.grossAmount || 0), 0);
  const grossSubset = subset.reduce((s, l) => s + (l.grossAmount || 0), 0);
  const share = grossAll > 0 ? grossSubset / grossAll : subset.length / allLines.length;

  const lineDiscount = subset.reduce((s, l) => s + (l.sellerDiscount || 0), 0);
  const orderVoucher = (order.sellerVoucher || 0) * share;
  const discount = lineDiscount + orderVoucher;

  const explicitLineRefund = subset.some((l) => typeof l.refundAmount === 'number');
  const explicitOrderRefund = typeof order.refundAmount === 'number';
  let refund = 0;
  if (explicitLineRefund || explicitOrderRefund) {
    refund = subset.reduce((s, l) => s + (l.refundAmount || 0), 0) + (order.refundAmount || 0) * share;
  } else if (isReturnOrRefund(order.status)) {
    // Rule: a returned/refunded order without a refund amount is treated as fully refunded.
    refund = grossSubset - discount;
    acc.assumedRefundOrders++;
  }

  acc.gmv += grossSubset;
  acc.sellerDiscount += discount;
  acc.refund += refund;
  const net = grossSubset - discount - refund;
  acc.netByPlatform.set(order.platform, (acc.netByPlatform.get(order.platform) || 0) + net);

  for (const field of ['platformFee', 'paymentFee', 'affiliateCommission', 'shippingFeeSeller'] as FeeField[]) {
    acc.fees[field] += (order[field] || 0) * share;
  }

  const cogsApplies = consumesCogs(order.status);
  for (const line of subset) {
    const lineNet = (line.grossAmount || 0) - (line.sellerDiscount || 0);
    const unit = resolveUnitCogs(dataset, line);
    if (unit === undefined) {
      acc.cogsUnknownRevenue += lineNet;
      if (cogsApplies) acc.missingCogsSkus.add(line.sku);
    } else {
      acc.cogsKnownRevenue += lineNet;
      if (cogsApplies) acc.cogs += unit * (line.quantity || 0);
    }
  }
}

interface CostLineResult {
  line: ProfitLine;
  warning?: Bilingual;
}

function feeLine(
  key: 'platformFee' | 'paymentFee',
  field: FeeField,
  slice: DatasetSlice,
  acc: OrderAccumulator,
): CostLineResult {
  const { dataset } = slice;
  const rates = key === 'platformFee' ? dataset.costSettings?.platformFeeRate : dataset.costSettings?.paymentFeeRate;
  const settlementField = key === 'platformFee' ? 'platformFee' : 'paymentFee';
  let amount = 0;
  const missingPlatforms: Platform[] = [];
  const sources = new Set<CostSource>();

  for (const [platform, net] of acc.netByPlatform) {
    if (datasetHasOrderFee(dataset, platform, field)) {
      sources.add('data');
      continue; // already accumulated order-by-order
    }
    const settlementRows = slice.settlements.filter((s) => s.platform === platform && typeof s[settlementField] === 'number');
    const isScoped = !!(slice.filter.skus?.length || slice.filter.categories?.length);
    if (settlementRows.length > 0 && !isScoped) {
      amount += settlementRows.reduce((s, r) => s + (r[settlementField] || 0), 0);
      sources.add('data');
      continue;
    }
    const rate = rates?.[platform];
    if (typeof rate === 'number' && Number.isFinite(rate)) {
      amount += rate * net;
      sources.add('user_rate');
      continue;
    }
    missingPlatforms.push(platform);
  }
  amount += acc.fees[field];

  const label = LABELS[key];
  if (missingPlatforms.length > 0) {
    const names = missingPlatforms.map((p) => PLATFORM_LABELS[p]).join(', ');
    return {
      line: { key, label, amount, source: 'missing', note: { vi: `Thiếu dữ liệu cho: ${names}`, en: `Missing for: ${names}` } },
      warning: {
        vi: `Chưa có ${label.vi.toLowerCase()} cho ${names} — lợi nhuận đang chưa trừ khoản này. Nhập tỷ lệ phí trong Cài đặt chi phí.`,
        en: `No ${label.en.toLowerCase()} for ${names} — profit does not deduct it yet. Set a fee rate in cost settings.`,
      },
    };
  }
  const source: CostSource = sources.has('user_rate') ? 'user_rate' : 'data';
  return {
    line: {
      key,
      label,
      amount,
      source,
      note: source === 'user_rate' ? { vi: 'Ước tính theo tỷ lệ phí bạn nhập', en: 'Estimated from your fee rate' } : undefined,
    },
  };
}

function affiliateLine(slice: DatasetSlice, acc: OrderAccumulator): CostLineResult {
  const { dataset } = slice;
  const label = LABELS.affiliate;
  const hasOrderLevel = dataset.orders.some((o) => typeof o.affiliateCommission === 'number');
  if (hasOrderLevel) return { line: { key: 'affiliate', label, amount: acc.fees.affiliateCommission, source: 'data' } };
  const reported = slice.affiliates.filter((a) => typeof a.commission === 'number');
  if (reported.length > 0) {
    return { line: { key: 'affiliate', label, amount: reported.reduce((s, a) => s + (a.commission || 0), 0), source: 'data' } };
  }
  const hasAffiliateActivity =
    slice.affiliates.length > 0 || slice.orders.some((o) => (o.channel || '').toLowerCase().includes('affiliate'));
  if (!hasAffiliateActivity) {
    return { line: { key: 'affiliate', label, amount: 0, source: 'not_applicable' } };
  }
  return {
    line: { key: 'affiliate', label, amount: 0, source: 'missing' },
    warning: {
      vi: 'Có đơn từ affiliate nhưng chưa có dữ liệu hoa hồng — lợi nhuận chưa trừ khoản này.',
      en: 'Affiliate orders exist but commission data is missing — profit does not deduct it.',
    },
  };
}

function adsLine(slice: DatasetSlice): CostLineResult {
  const { dataset } = slice;
  const label = LABELS.ads;
  const isScoped = !!(slice.filter.skus?.length || slice.filter.categories?.length);
  if (dataset.ads.length > 0) {
    const amount = slice.ads.reduce((s, a) => s + (a.spend || 0), 0);
    const unallocated = isScoped && dataset.ads.some((a) => !a.sku);
    return {
      line: { key: 'ads', label, amount, source: 'data' },
      warning: unallocated
        ? {
            vi: 'Một phần chi phí Ads không gắn SKU nên chưa được phân bổ cho lựa chọn này.',
            en: 'Some ad spend is not tied to a SKU and is not allocated to this selection.',
          }
        : undefined,
    };
  }
  if (dataset.costSettings?.noAdsDeclared) {
    return { line: { key: 'ads', label, amount: 0, source: 'declared_none' } };
  }
  return {
    line: { key: 'ads', label, amount: 0, source: 'missing' },
    warning: {
      vi: 'Chưa có dữ liệu chi phí quảng cáo — lợi nhuận chưa trừ Ads. Nhập báo cáo Ads hoặc xác nhận "không chạy quảng cáo".',
      en: 'No ad spend data — profit does not deduct ads. Import an ads report or confirm "no ads".',
    },
  };
}

function shippingLine(slice: DatasetSlice, acc: OrderAccumulator): CostLineResult {
  const { dataset } = slice;
  const label = LABELS.shipping;
  if (dataset.orders.some((o) => typeof o.shippingFeeSeller === 'number')) {
    return { line: { key: 'shipping', label, amount: acc.fees.shippingFeeSeller, source: 'data' } };
  }
  const isScoped = !!(slice.filter.skus?.length || slice.filter.categories?.length);
  const rows = slice.settlements.filter((s) => typeof s.shippingFee === 'number');
  if (rows.length > 0 && !isScoped) {
    return { line: { key: 'shipping', label, amount: rows.reduce((s, r) => s + (r.shippingFee || 0), 0), source: 'data' } };
  }
  return {
    line: { key: 'shipping', label, amount: 0, source: 'missing' },
    warning: {
      vi: 'Chưa có phí vận chuyển shop chịu — lợi nhuận chưa trừ khoản này.',
      en: 'Seller-paid shipping is missing — profit does not deduct it.',
    },
  };
}

export function computeProfit(slice: DatasetSlice): ProfitResult {
  const { dataset } = slice;
  const warnings: Bilingual[] = [];

  if (dataset.orders.length === 0) {
    const need: Bilingual = {
      vi: 'Cần dữ liệu đơn hàng theo SKU (file xuất đơn hàng) để tính lợi nhuận.',
      en: 'Order-level data by SKU (order export) is required to compute profit.',
    };
    const m = missing('vnd', need, ['orders', 'orderLines']);
    return {
      completeness: 'insufficient',
      lines: [],
      gmv: m,
      sellerDiscount: m,
      refund: m,
      netRevenue: m,
      cogs: m,
      profit: m,
      margin: missing('ratio', need, ['orders', 'orderLines']),
      warnings: [need],
      missingCogsSkus: [],
      revenueShareWithoutCogs: 0,
      assumedRefundOrders: 0,
    };
  }

  const acc: OrderAccumulator = {
    gmv: 0,
    sellerDiscount: 0,
    refund: 0,
    cogs: 0,
    cogsKnownRevenue: 0,
    cogsUnknownRevenue: 0,
    fees: { platformFee: 0, paymentFee: 0, affiliateCommission: 0, shippingFeeSeller: 0 },
    netByPlatform: new Map(),
    assumedRefundOrders: 0,
    missingCogsSkus: new Set(),
  };

  const subsetByOrder = new Map<string, OrderLine[]>();
  for (const line of slice.lines) {
    const list = subsetByOrder.get(line.orderId);
    if (list) list.push(line);
    else subsetByOrder.set(line.orderId, [line]);
  }
  for (const order of slice.orders) accumulateOrder(dataset, order, subsetByOrder.get(order.orderId) || [], acc);

  const netRevenue = acc.gmv - acc.sellerDiscount - acc.refund;
  if (acc.assumedRefundOrders > 0) {
    warnings.push({
      vi: `${acc.assumedRefundOrders} đơn trả hàng/hoàn tiền không có số tiền hoàn — tạm tính hoàn toàn bộ giá trị đơn.`,
      en: `${acc.assumedRefundOrders} returned/refunded orders have no refund amount — treated as fully refunded.`,
    });
  }

  // COGS
  const missingCogsSkus = Array.from(acc.missingCogsSkus).sort();
  const lineRevenue = acc.cogsKnownRevenue + acc.cogsUnknownRevenue;
  const revenueShareWithoutCogs = lineRevenue > 0 ? acc.cogsUnknownRevenue / lineRevenue : 0;
  const noCogsAtAll = missingCogsSkus.length > 0 && acc.cogsKnownRevenue <= 0;
  let cogsMetric: MetricResult;
  let cogsLine: ProfitLine;
  if (noCogsAtAll) {
    const note: Bilingual = {
      vi: `Không đủ dữ liệu: ${missingCogsSkus.length} SKU chưa có giá vốn.`,
      en: `Insufficient data: ${missingCogsSkus.length} SKUs have no COGS.`,
    };
    cogsMetric = missing('vnd', note, ['product.unitCogs']);
    cogsLine = { key: 'cogs', label: LABELS.cogs, amount: null, source: 'missing', note };
  } else if (missingCogsSkus.length > 0) {
    const note: Bilingual = {
      vi: `Ước tính lợi nhuận chưa đầy đủ vì ${missingCogsSkus.length} SKU chưa có giá vốn.`,
      en: `Profit estimate is incomplete: ${missingCogsSkus.length} SKUs have no COGS.`,
    };
    warnings.push(note);
    cogsMetric = partial(acc.cogs, 'vnd', [note], ['product.unitCogs']);
    cogsLine = { key: 'cogs', label: LABELS.cogs, amount: acc.cogs, source: 'missing', note };
  } else {
    cogsMetric = ok(acc.cogs, 'vnd');
    cogsLine = { key: 'cogs', label: LABELS.cogs, amount: acc.cogs, source: 'data' };
  }

  const costResults = [
    feeLine('platformFee', 'platformFee', slice, acc),
    feeLine('paymentFee', 'paymentFee', slice, acc),
    affiliateLine(slice, acc),
    adsLine(slice),
    shippingLine(slice, acc),
  ];
  for (const r of costResults) if (r.warning) warnings.push(r.warning);

  const otherCosts = slice.costs.reduce((s, c) => s + (c.amount || 0), 0);
  const otherLine: ProfitLine = {
    key: 'otherCosts',
    label: LABELS.otherCosts,
    amount: otherCosts,
    source: dataset.costs.length > 0 ? 'data' : 'not_applicable',
    note: dataset.costs.length === 0 ? { vi: 'Chưa nhập chi phí khác', en: 'No other costs recorded' } : undefined,
  };

  const lines: ProfitLine[] = [
    { key: 'gmv', label: LABELS.gmv, amount: acc.gmv, source: 'data' },
    { key: 'sellerDiscount', label: LABELS.sellerDiscount, amount: acc.sellerDiscount, source: 'data' },
    {
      key: 'refund',
      label: LABELS.refund,
      amount: acc.refund,
      source: acc.assumedRefundOrders > 0 ? 'assumed' : 'data',
    },
    { key: 'netRevenue', label: LABELS.netRevenue, amount: netRevenue, source: 'computed' },
    cogsLine,
    ...costResults.map((r) => r.line),
    otherLine,
  ];

  const costTotal =
    (cogsLine.amount || 0) + costResults.reduce((s, r) => s + (r.line.amount || 0), 0) + otherCosts;
  const profitValue = netRevenue - costTotal;

  let completeness: ProfitCompleteness = warnings.length > 0 ? 'partial' : 'complete';
  let profit: MetricResult;
  let margin: MetricResult;
  if (noCogsAtAll) {
    completeness = 'insufficient';
    profit = cogsMetric;
    margin = missing('ratio', cogsMetric.notes![0], ['product.unitCogs']);
  } else {
    profit = completeness === 'complete' ? ok(profitValue, 'vnd') : partial(profitValue, 'vnd', warnings);
    const m = netRevenue > 0 ? safeDivide(profitValue, netRevenue) : null;
    margin =
      m === null
        ? missing('ratio', {
            vi: 'Doanh thu thuần bằng 0 hoặc âm nên không tính được biên lợi nhuận.',
            en: 'Net revenue is zero or negative; margin is undefined.',
          })
        : completeness === 'complete'
          ? ok(m, 'ratio')
          : partial(m, 'ratio', warnings);
  }
  lines.push({ key: 'profit', label: LABELS.profit, amount: profit.value, source: 'computed' });

  return {
    completeness,
    lines,
    gmv: ok(acc.gmv, 'vnd'),
    sellerDiscount: ok(acc.sellerDiscount, 'vnd'),
    refund: acc.assumedRefundOrders > 0 ? partial(acc.refund, 'vnd', [warnings[0]]) : ok(acc.refund, 'vnd'),
    netRevenue: ok(netRevenue, 'vnd'),
    cogs: cogsMetric,
    profit,
    margin,
    warnings,
    missingCogsSkus,
    revenueShareWithoutCogs,
    assumedRefundOrders: acc.assumedRefundOrders,
  };
}

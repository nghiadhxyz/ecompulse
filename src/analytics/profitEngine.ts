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
 *
 * `computeProfit` covers a whole slice; `computeProfitByGroup` computes the same
 * waterfall per SKU / live session / platform in one pass. Order-level fees are
 * allocated to lines by gross-amount share.
 */
import type { AdPerformance, CanonicalDataset, Order, OrderLine, Platform } from './model';
import { PLATFORM_LABELS } from './model';
import type { DatasetSlice } from './filters';
import { getDatasetIndex, isScopedFilter } from './filters';
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
 * unallocated — exists at shop level but cannot be attributed to this group
 */
export type CostSource =
  | 'data'
  | 'user_rate'
  | 'declared_none'
  | 'not_applicable'
  | 'assumed'
  | 'missing'
  | 'unallocated'
  | 'computed';

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
  /** Net revenue minus every variable cost except ads (basis for break-even ROAS). */
  profitBeforeAds: MetricResult;
  profit: MetricResult;
  margin: MetricResult;
  warnings: Bilingual[];
  /** SKUs sold in the slice that have no unit COGS. */
  missingCogsSkus: string[];
  /** Share of net line revenue whose COGS is unknown (0–1). */
  revenueShareWithoutCogs: number;
  assumedRefundOrders: number;
  /** Non-cancelled orders and units that contributed (for per-unit / per-order views). */
  validOrders: number;
  units: number;
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

export const PROFIT_LABELS = LABELS;

export function resolveUnitCogs(dataset: CanonicalDataset, line: OrderLine): number | undefined {
  const override = dataset.costSettings?.skuCogs?.[line.sku];
  if (typeof override === 'number' && Number.isFinite(override)) return override;
  if (typeof line.unitCogs === 'number' && Number.isFinite(line.unitCogs)) return line.unitCogs;
  return catalogCogs(dataset).get(line.sku);
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
const FEE_FIELDS: FeeField[] = ['platformFee', 'paymentFee', 'affiliateCommission', 'shippingFeeSeller'];

interface FeePresence {
  byPlatform: Set<string>; // `${platform}|${field}`
  any: Set<FeeField>;
}
const feePresenceCache = new WeakMap<CanonicalDataset, FeePresence>();
function feePresence(dataset: CanonicalDataset): FeePresence {
  let p = feePresenceCache.get(dataset);
  if (!p) {
    p = { byPlatform: new Set(), any: new Set() };
    for (const o of dataset.orders) {
      for (const f of FEE_FIELDS) {
        if (typeof o[f] === 'number') {
          p.byPlatform.add(`${o.platform}|${f}`);
          p.any.add(f);
        }
      }
    }
    feePresenceCache.set(dataset, p);
  }
  return p;
}

interface Accumulator {
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
  validOrders: number;
  units: number;
  hasAffiliateOrders: boolean;
}

function newAccumulator(): Accumulator {
  return {
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
    validOrders: 0,
    units: 0,
    hasAffiliateOrders: false,
  };
}

/** Adds the lines `subset` of `order` to the accumulator (fees allocated by gross share). */
function accumulateOrder(dataset: CanonicalDataset, order: Order, subset: OrderLine[], acc: Accumulator) {
  if (isCancelled(order.status) || subset.length === 0) return;
  const allLines = getDatasetIndex(dataset).linesByOrder.get(order.orderId) || subset;
  const grossAll = allLines.reduce((s, l) => s + (l.grossAmount || 0), 0);
  const grossSubset = subset.reduce((s, l) => s + (l.grossAmount || 0), 0);
  const share = grossAll > 0 ? grossSubset / grossAll : subset.length / allLines.length;

  const lineDiscount = subset.reduce((s, l) => s + (l.sellerDiscount || 0), 0);
  const discount = lineDiscount + (order.sellerVoucher || 0) * share;

  const explicitRefund = subset.some((l) => typeof l.refundAmount === 'number') || typeof order.refundAmount === 'number';
  let refund = 0;
  if (explicitRefund) {
    refund = subset.reduce((s, l) => s + (l.refundAmount || 0), 0) + (order.refundAmount || 0) * share;
  } else if (isReturnOrRefund(order.status)) {
    // Rule: a returned/refunded order without a refund amount is treated as fully refunded.
    refund = grossSubset - discount;
    acc.assumedRefundOrders++;
  }

  acc.gmv += grossSubset;
  acc.sellerDiscount += discount;
  acc.refund += refund;
  acc.validOrders++;
  const net = grossSubset - discount - refund;
  acc.netByPlatform.set(order.platform, (acc.netByPlatform.get(order.platform) || 0) + net);
  for (const field of FEE_FIELDS) acc.fees[field] += (order[field] || 0) * share;
  if ((order.channel || '').toLowerCase().includes('affiliate')) acc.hasAffiliateOrders = true;

  const cogsApplies = consumesCogs(order.status);
  for (const line of subset) {
    acc.units += line.quantity || 0;
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

/** Shop-level context that decides how non-order costs are attributed. */
interface ProfitContext {
  dataset: CanonicalDataset;
  /** Settlements may be used only when the result covers whole orders (no SKU scoping). */
  settlements: DatasetSlice['settlements'];
  allowShopLevel: boolean;
  /** Ads rows attributable to this result; null = ads exist but cannot be attributed. */
  ads: AdPerformance[] | null;
  affiliates: DatasetSlice['affiliates'];
  otherCosts: number;
}

interface CostLineResult {
  line: ProfitLine;
  warning?: Bilingual;
}

function feeLine(key: 'platformFee' | 'paymentFee', field: FeeField, ctx: ProfitContext, acc: Accumulator): CostLineResult {
  const { dataset } = ctx;
  const rates = key === 'platformFee' ? dataset.costSettings?.platformFeeRate : dataset.costSettings?.paymentFeeRate;
  const presence = feePresence(dataset);
  let amount = acc.fees[field];
  const missingPlatforms: Platform[] = [];
  let usedRate = false;

  for (const [platform, net] of acc.netByPlatform) {
    if (presence.byPlatform.has(`${platform}|${field}`)) continue; // accumulated order-by-order
    const rows = ctx.allowShopLevel ? ctx.settlements.filter((s) => s.platform === platform && typeof s[key] === 'number') : [];
    if (rows.length > 0) {
      amount += rows.reduce((s, r) => s + (r[key] || 0), 0);
      continue;
    }
    const rate = rates?.[platform];
    if (typeof rate === 'number' && Number.isFinite(rate)) {
      amount += rate * net;
      usedRate = true;
      continue;
    }
    missingPlatforms.push(platform);
  }

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
  return {
    line: {
      key,
      label,
      amount,
      source: usedRate ? 'user_rate' : 'data',
      note: usedRate ? { vi: 'Ước tính theo tỷ lệ phí bạn nhập', en: 'Estimated from your fee rate' } : undefined,
    },
  };
}

function affiliateLine(ctx: ProfitContext, acc: Accumulator): CostLineResult {
  const label = LABELS.affiliate;
  if (feePresence(ctx.dataset).any.has('affiliateCommission')) {
    return { line: { key: 'affiliate', label, amount: acc.fees.affiliateCommission, source: 'data' } };
  }
  const reported = ctx.allowShopLevel ? ctx.affiliates.filter((a) => typeof a.commission === 'number') : [];
  if (reported.length > 0) {
    return { line: { key: 'affiliate', label, amount: reported.reduce((s, a) => s + (a.commission || 0), 0), source: 'data' } };
  }
  const hasActivity = acc.hasAffiliateOrders || (ctx.allowShopLevel && ctx.affiliates.length > 0);
  if (!hasActivity) return { line: { key: 'affiliate', label, amount: 0, source: 'not_applicable' } };
  return {
    line: { key: 'affiliate', label, amount: 0, source: 'missing' },
    warning: {
      vi: 'Có đơn từ affiliate nhưng chưa có dữ liệu hoa hồng — lợi nhuận chưa trừ khoản này.',
      en: 'Affiliate orders exist but commission data is missing — profit does not deduct it.',
    },
  };
}

function adsLine(ctx: ProfitContext): CostLineResult {
  const { dataset } = ctx;
  const label = LABELS.ads;
  if (dataset.ads.length > 0) {
    if (ctx.ads === null) {
      return {
        line: { key: 'ads', label, amount: 0, source: 'unallocated', note: { vi: 'Không phân bổ được cho nhóm này', en: 'Not attributable to this group' } },
        warning: {
          vi: 'Chi phí Ads không gắn được với nhóm này nên chưa bị trừ — xem lợi nhuận toàn shop để thấy đủ chi phí.',
          en: 'Ad spend cannot be attributed to this group and is not deducted — see shop-level profit.',
        },
      };
    }
    return { line: { key: 'ads', label, amount: ctx.ads.reduce((s, a) => s + (a.spend || 0), 0), source: 'data' } };
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

function shippingLine(ctx: ProfitContext, acc: Accumulator): CostLineResult {
  const label = LABELS.shipping;
  if (feePresence(ctx.dataset).any.has('shippingFeeSeller')) {
    return { line: { key: 'shipping', label, amount: acc.fees.shippingFeeSeller, source: 'data' } };
  }
  const rows = ctx.allowShopLevel ? ctx.settlements.filter((s) => typeof s.shippingFee === 'number') : [];
  if (rows.length > 0) {
    return { line: { key: 'shipping', label, amount: rows.reduce((s, r) => s + (r.shippingFee || 0), 0), source: 'data' } };
  }
  if (ctx.dataset.costSettings?.noSellerShippingDeclared) {
    return { line: { key: 'shipping', label, amount: 0, source: 'declared_none' } };
  }
  return {
    line: { key: 'shipping', label, amount: 0, source: 'missing' },
    warning: {
      vi: 'Chưa có phí vận chuyển shop chịu — lợi nhuận chưa trừ khoản này.',
      en: 'Seller-paid shipping is missing — profit does not deduct it.',
    },
  };
}

function finalize(acc: Accumulator, ctx: ProfitContext): ProfitResult {
  const warnings: Bilingual[] = [];
  const netRevenue = acc.gmv - acc.sellerDiscount - acc.refund;
  if (acc.assumedRefundOrders > 0) {
    warnings.push({
      vi: `${acc.assumedRefundOrders} đơn trả hàng/hoàn tiền không có số tiền hoàn — tạm tính hoàn toàn bộ giá trị đơn.`,
      en: `${acc.assumedRefundOrders} returned/refunded orders have no refund amount — treated as fully refunded.`,
    });
  }

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

  const variable = [
    feeLine('platformFee', 'platformFee', ctx, acc),
    feeLine('paymentFee', 'paymentFee', ctx, acc),
    affiliateLine(ctx, acc),
    shippingLine(ctx, acc),
  ];
  const ads = adsLine(ctx);
  for (const r of [...variable.slice(0, 3), ads, variable[3]]) if (r.warning) warnings.push(r.warning);

  const otherLine: ProfitLine = ctx.allowShopLevel
    ? {
        key: 'otherCosts',
        label: LABELS.otherCosts,
        amount: ctx.otherCosts,
        source: ctx.dataset.costs.length > 0 ? 'data' : 'not_applicable',
        note: ctx.dataset.costs.length === 0 ? { vi: 'Chưa nhập chi phí khác', en: 'No other costs recorded' } : undefined,
      }
    : {
        key: 'otherCosts',
        label: LABELS.otherCosts,
        amount: 0,
        source: ctx.dataset.costs.length > 0 ? 'unallocated' : 'not_applicable',
        note: ctx.dataset.costs.length > 0 ? { vi: 'Chi phí chung không phân bổ theo nhóm', en: 'Overheads are not allocated to groups' } : undefined,
      };

  const lines: ProfitLine[] = [
    { key: 'gmv', label: LABELS.gmv, amount: acc.gmv, source: 'data' },
    { key: 'sellerDiscount', label: LABELS.sellerDiscount, amount: acc.sellerDiscount, source: 'data' },
    { key: 'refund', label: LABELS.refund, amount: acc.refund, source: acc.assumedRefundOrders > 0 ? 'assumed' : 'data' },
    { key: 'netRevenue', label: LABELS.netRevenue, amount: netRevenue, source: 'computed' },
    cogsLine,
    variable[0].line,
    variable[1].line,
    variable[2].line,
    ads.line,
    variable[3].line,
    otherLine,
  ];

  const variableTotal = variable.reduce((s, r) => s + (r.line.amount || 0), 0);
  const beforeAdsValue = netRevenue - (cogsLine.amount || 0) - variableTotal;
  const profitValue = beforeAdsValue - (ads.line.amount || 0) - (otherLine.amount || 0);

  let completeness: ProfitCompleteness = warnings.length > 0 ? 'partial' : 'complete';
  let profit: MetricResult;
  let margin: MetricResult;
  let profitBeforeAds: MetricResult;
  if (noCogsAtAll) {
    completeness = 'insufficient';
    profit = cogsMetric;
    profitBeforeAds = cogsMetric;
    margin = missing('ratio', cogsMetric.notes![0], ['product.unitCogs']);
  } else {
    const wrap = (v: number, unit: 'vnd' | 'ratio') => (completeness === 'complete' ? ok(v, unit) : partial(v, unit, warnings));
    profit = wrap(profitValue, 'vnd');
    profitBeforeAds = wrap(beforeAdsValue, 'vnd');
    const m = netRevenue > 0 ? safeDivide(profitValue, netRevenue) : null;
    margin =
      m === null
        ? missing('ratio', {
            vi: 'Doanh thu thuần bằng 0 hoặc âm nên không tính được biên lợi nhuận.',
            en: 'Net revenue is zero or negative; margin is undefined.',
          })
        : wrap(m, 'ratio');
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
    profitBeforeAds,
    profit,
    margin,
    warnings,
    missingCogsSkus,
    revenueShareWithoutCogs,
    assumedRefundOrders: acc.assumedRefundOrders,
    validOrders: acc.validOrders,
    units: acc.units,
  };
}

function insufficient(): ProfitResult {
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
    profitBeforeAds: m,
    profit: m,
    margin: missing('ratio', need, ['orders', 'orderLines']),
    warnings: [need],
    missingCogsSkus: [],
    revenueShareWithoutCogs: 0,
    assumedRefundOrders: 0,
    validOrders: 0,
    units: 0,
  };
}

function linesByOrderOf(slice: DatasetSlice): Map<string, OrderLine[]> {
  const map = new Map<string, OrderLine[]>();
  for (const line of slice.lines) {
    const list = map.get(line.orderId);
    if (list) list.push(line);
    else map.set(line.orderId, [line]);
  }
  return map;
}

function isScoped(slice: DatasetSlice): boolean {
  return isScopedFilter(slice.filter);
}

export function computeProfit(slice: DatasetSlice): ProfitResult {
  const { dataset } = slice;
  if (dataset.orders.length === 0) return insufficient();
  const acc = newAccumulator();
  const byOrder = linesByOrderOf(slice);
  for (const order of slice.orders) accumulateOrder(dataset, order, byOrder.get(order.orderId) || [], acc);

  const scoped = isScoped(slice);
  const skuSet = scoped ? new Set(slice.lines.map((l) => l.sku)) : null;
  const unattributedAds = scoped && dataset.ads.length > 0 && slice.ads.length === 0 && dataset.ads.every((a) => !a.sku);
  const result = finalize(acc, {
    dataset,
    settlements: slice.settlements,
    allowShopLevel: !scoped,
    ads: unattributedAds ? null : scoped ? slice.ads.filter((a) => a.sku && skuSet!.has(a.sku)) : slice.ads,
    affiliates: slice.affiliates,
    otherCosts: slice.costs.reduce((s, c) => s + (c.amount || 0), 0),
  });
  if (scoped && dataset.ads.some((a) => !a.sku) && !unattributedAds) {
    result.warnings.push({
      vi: 'Một phần chi phí Ads không gắn SKU nên chưa được phân bổ cho lựa chọn này.',
      en: 'Some ad spend is not tied to a SKU and is not allocated to this selection.',
    });
    if (result.completeness === 'complete') result.completeness = 'partial';
  }
  return result;
}

export type ProfitGroupKey = (order: Order, line: OrderLine) => string | null;

export interface ProfitGroupOptions {
  /** Ads rows that belong to a group; omit when ads cannot be attributed to this grouping. */
  adsFor?: (key: string) => AdPerformance[];
}

/**
 * Same waterfall per group in one pass (e.g. per SKU: `(o, l) => l.sku`).
 * Shop-level items (settlements, overheads, unattributed ads) are not allocated
 * and are reported as such on every group.
 */
export function computeProfitByGroup(slice: DatasetSlice, keyOf: ProfitGroupKey, options: ProfitGroupOptions = {}): Map<string, ProfitResult> {
  const { dataset } = slice;
  const out = new Map<string, ProfitResult>();
  if (dataset.orders.length === 0) return out;
  const accs = new Map<string, Accumulator>();
  const byOrder = linesByOrderOf(slice);
  for (const order of slice.orders) {
    const lines = byOrder.get(order.orderId) || [];
    const groups = new Map<string, OrderLine[]>();
    for (const l of lines) {
      const k = keyOf(order, l);
      if (k === null) continue;
      const g = groups.get(k);
      if (g) g.push(l);
      else groups.set(k, [l]);
    }
    for (const [k, subset] of groups) {
      let acc = accs.get(k);
      if (!acc) {
        acc = newAccumulator();
        accs.set(k, acc);
      }
      accumulateOrder(dataset, order, subset, acc);
    }
  }
  for (const [k, acc] of accs) {
    out.set(
      k,
      finalize(acc, {
        dataset,
        settlements: [],
        allowShopLevel: false,
        ads: options.adsFor ? options.adsFor(k) : null,
        affiliates: [],
        otherCosts: 0,
      }),
    );
  }
  return out;
}

/**
 * Product performance per SKU — one pass over the slice.
 *
 * There is deliberately no single "best product" score: `productLeaders` answers
 * "best" separately by units, revenue, profit, margin and growth.
 */
import type { CanonicalDataset } from './model';
import { sliceDataset, type DatasetFilter } from './filters';
import { computeProfitByGroup, type ProfitResult } from './profitEngine';
import { aggregateByDimension } from './contributionEngine';
import { compareValues, type Comparison } from './comparisonEngine';
import { isCancelled, isReturnOrRefund } from './status';
import { isInRange, type DateRange } from './period';
import type { MetricResult } from './metric';

export interface ProductRow {
  sku: string;
  name: string;
  category?: string;
  subcategory?: string;
  comboId?: string;
  units: number;
  /** Placed orders containing the SKU (all statuses). */
  placedOrders: number;
  /** Non-cancelled orders containing the SKU. */
  orders: number;
  cancelledOrders: number;
  returnedOrders: number;
  gmv: number;
  netRevenue: number | null;
  profit: MetricResult;
  margin: MetricResult;
  cancelRate: number | null;
  refundRate: number | null;
  hasCogs: boolean;
  /** GMV vs the comparable previous period. */
  growth: Comparison;
  profitDetail: ProfitResult | null;
}

export interface ProductPerformance {
  rows: ProductRow[];
  shopCancelRate: number | null;
  /** Ad spend in the period not tied to any SKU (not deducted from SKU profit). */
  unallocatedAdSpend: number;
  previousRange?: DateRange;
}

export function productPerformance(dataset: CanonicalDataset, filter: DatasetFilter, previousRange?: DateRange): ProductPerformance {
  if (dataset.orders.length === 0) return { rows: [], shopCancelRate: null, unallocatedAdSpend: 0, previousRange };
  const slice = sliceDataset(dataset, filter);
  const catalog = new Map(dataset.products.map((p) => [p.sku, p]));

  const adsBySku = new Map<string, typeof slice.ads>();
  for (const a of slice.ads) {
    if (!a.sku) continue;
    const list = adsBySku.get(a.sku);
    if (list) list.push(a);
    else adsBySku.set(a.sku, [a]);
  }
  const profits = computeProfitByGroup(slice, (_o, l) => l.sku, { adsFor: (sku) => adsBySku.get(sku) || [] });
  const unallocatedAdSpend = slice.ads.filter((a) => !a.sku).reduce((s, a) => s + (a.spend || 0), 0);

  // Order counts per SKU (distinct orders).
  const stats = new Map<string, { placed: number; valid: number; cancelled: number; returned: number; name?: string; comboId?: string }>();
  const statusById = new Map(slice.orders.map((o) => [o.orderId, o.status]));
  const seen = new Set<string>();
  for (const l of slice.lines) {
    const key = `${l.orderId}|${l.sku}`;
    let s = stats.get(l.sku);
    if (!s) {
      s = { placed: 0, valid: 0, cancelled: 0, returned: 0, name: l.productName, comboId: l.comboId };
      stats.set(l.sku, s);
    }
    if (seen.has(key)) continue;
    seen.add(key);
    const status = statusById.get(l.orderId)!;
    s.placed++;
    if (isCancelled(status)) s.cancelled++;
    else s.valid++;
    if (isReturnOrRefund(status)) s.returned++;
  }

  const prevGmv = previousRange ? aggregateByDimension(sliceDataset(dataset, { ...filter, range: previousRange }), 'sku', 'gmv') : new Map<string, number>();
  const prevCovered = previousRange ? dataset.orders.some((o) => isInRange(o.orderDate, previousRange)) : false;

  const rows: ProductRow[] = [];
  for (const [sku, s] of stats) {
    const p = profits.get(sku) || null;
    const product = catalog.get(sku);
    const gmv = p?.gmv.value ?? 0;
    rows.push({
      sku,
      name: product?.name || s.name || sku,
      category: product?.category,
      subcategory: product?.subcategory,
      comboId: s.comboId,
      units: p?.units ?? 0,
      placedOrders: s.placed,
      orders: s.valid,
      cancelledOrders: s.cancelled,
      returnedOrders: s.returned,
      gmv,
      netRevenue: p?.netRevenue.value ?? null,
      profit: p?.profit ?? { value: null, unit: 'vnd', status: 'missing' },
      margin: p?.margin ?? { value: null, unit: 'ratio', status: 'missing' },
      cancelRate: s.placed > 0 ? s.cancelled / s.placed : null,
      refundRate: s.valid > 0 ? s.returned / s.valid : null,
      hasCogs: !!p && p.missingCogsSkus.length === 0,
      growth: compareValues(gmv, prevCovered ? prevGmv.get(sku) ?? 0 : null, 'vnd'),
      profitDetail: p,
    });
  }
  rows.sort((a, b) => b.gmv - a.gmv);

  const placed = slice.orders.length;
  const cancelled = slice.orders.filter((o) => isCancelled(o.status)).length;
  return { rows, shopCancelRate: placed > 0 ? cancelled / placed : null, unallocatedAdSpend, previousRange };
}

export type ProductShortcut = 'bestSelling' | 'topRevenue' | 'topProfit' | 'highMargin' | 'growing' | 'declining' | 'losing' | 'highCancel';

export const SHORTCUT_LABELS: Record<ProductShortcut, { vi: string; en: string }> = {
  bestSelling: { vi: 'Bán chạy nhất', en: 'Best selling' },
  topRevenue: { vi: 'Doanh thu cao nhất', en: 'Top revenue' },
  topProfit: { vi: 'Lời nhiều nhất', en: 'Most profit' },
  highMargin: { vi: 'Margin cao', en: 'High margin' },
  growing: { vi: 'Đang tăng', en: 'Growing' },
  declining: { vi: 'Đang giảm', en: 'Declining' },
  losing: { vi: 'Đang lỗ', en: 'Losing money' },
  highCancel: { vi: 'Hủy cao', en: 'High cancellation' },
};

const MIN_ORDERS_FOR_RATE = 10;

export function applyShortcut(perf: ProductPerformance, shortcut: ProductShortcut): ProductRow[] {
  const rows = perf.rows;
  const v = (m: MetricResult) => m.value;
  switch (shortcut) {
    case 'bestSelling':
      return [...rows].sort((a, b) => b.units - a.units);
    case 'topRevenue':
      return [...rows].sort((a, b) => b.gmv - a.gmv);
    case 'topProfit':
      return rows.filter((r) => v(r.profit) !== null).sort((a, b) => v(b.profit)! - v(a.profit)!);
    case 'highMargin':
      return rows.filter((r) => v(r.margin) !== null && v(r.margin)! >= 0.3).sort((a, b) => v(b.margin)! - v(a.margin)!);
    case 'growing':
      return rows.filter((r) => (r.growth.percentageDelta ?? 0) >= 0.1).sort((a, b) => b.growth.percentageDelta! - a.growth.percentageDelta!);
    case 'declining':
      return rows.filter((r) => r.growth.percentageDelta !== null && r.growth.percentageDelta <= -0.1).sort((a, b) => a.growth.percentageDelta! - b.growth.percentageDelta!);
    case 'losing':
      return rows.filter((r) => v(r.profit) !== null && v(r.profit)! < 0).sort((a, b) => v(a.profit)! - v(b.profit)!);
    case 'highCancel': {
      const threshold = Math.max(0.1, (perf.shopCancelRate ?? 0) * 1.5);
      return rows
        .filter((r) => r.placedOrders >= MIN_ORDERS_FOR_RATE && (r.cancelRate ?? 0) >= threshold)
        .sort((a, b) => b.cancelRate! - a.cancelRate!);
    }
  }
}

export interface ProductLeaders {
  bestSelling?: ProductRow;
  topRevenue?: ProductRow;
  topProfit?: ProductRow;
  highestMargin?: ProductRow;
  fastestGrowth?: ProductRow;
}

/** "Best product" split by criterion — each may be a different SKU. */
export function productLeaders(perf: ProductPerformance): ProductLeaders {
  const withMargin = perf.rows.filter((r) => r.margin.value !== null && r.orders >= MIN_ORDERS_FOR_RATE);
  const withGrowth = perf.rows.filter((r) => r.growth.percentageDelta !== null && (r.growth.previous ?? 0) > 0);
  return {
    bestSelling: applyShortcut(perf, 'bestSelling')[0],
    topRevenue: applyShortcut(perf, 'topRevenue')[0],
    topProfit: applyShortcut(perf, 'topProfit')[0],
    highestMargin: [...withMargin].sort((a, b) => b.margin.value! - a.margin.value!)[0],
    fastestGrowth: [...withGrowth].sort((a, b) => b.growth.percentageDelta! - a.growth.percentageDelta!)[0],
  };
}

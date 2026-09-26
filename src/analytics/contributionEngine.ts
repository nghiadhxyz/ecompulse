/**
 * Contribution Engine — decomposes the change of an additive metric across a dimension.
 *
 *   GMV +30M = TikTok +22M + Shopee +11M + Lazada −3M
 *
 * shareOfChange = item delta / total delta. Shares always sum to 1; with negative
 * contributors individual shares can exceed 100% or be negative — that is correct.
 * When the total change is ~0, shareOfChange is null and shareOfMovement
 * (|delta| / Σ|delta|) tells where the offsetting movement happened.
 *
 * Only additive metrics are decomposed here. Ratio metrics (AOV, CVR) need a
 * mix/rate decomposition and must not be passed to this function.
 */
import type { CanonicalDataset, Order, OrderLine } from './model';
import { sliceDataset, type DatasetFilter, type DatasetSlice } from './filters';
import { isCancelled, isValidOrder } from './status';

export interface ContributionItem {
  key: string;
  current: number;
  previous: number;
  delta: number;
  /** delta / totalDelta. Null when totalDelta ≈ 0. */
  shareOfChange: number | null;
  /** |delta| / Σ|delta|. Null when nothing moved. */
  shareOfMovement: number | null;
}

export interface ContributionResult {
  totalCurrent: number;
  totalPrevious: number;
  totalDelta: number;
  positiveDelta: number;
  negativeDelta: number;
  /** Sorted by |delta| descending. */
  items: ContributionItem[];
}

const EPSILON = 1e-9;

export function computeContribution(
  current: Record<string, number> | Map<string, number>,
  previous: Record<string, number> | Map<string, number>,
): ContributionResult {
  const cur = current instanceof Map ? current : new Map(Object.entries(current));
  const prev = previous instanceof Map ? previous : new Map(Object.entries(previous));
  const keys = new Set([...cur.keys(), ...prev.keys()]);

  let totalCurrent = 0;
  let totalPrevious = 0;
  let positiveDelta = 0;
  let negativeDelta = 0;
  const raw: Omit<ContributionItem, 'shareOfChange' | 'shareOfMovement'>[] = [];
  for (const key of keys) {
    const c = cur.get(key) || 0;
    const p = prev.get(key) || 0;
    const delta = c - p;
    totalCurrent += c;
    totalPrevious += p;
    if (delta > 0) positiveDelta += delta;
    else negativeDelta += delta;
    raw.push({ key, current: c, previous: p, delta });
  }
  const totalDelta = totalCurrent - totalPrevious;
  const grossMovement = positiveDelta - negativeDelta;
  const items = raw
    .map((r) => ({
      ...r,
      shareOfChange: Math.abs(totalDelta) < EPSILON ? null : r.delta / totalDelta,
      shareOfMovement: grossMovement < EPSILON ? null : Math.abs(r.delta) / grossMovement,
    }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.key.localeCompare(b.key));

  return { totalCurrent, totalPrevious, totalDelta, positiveDelta, negativeDelta, items };
}

export type ContributionDimension = 'platform' | 'sku' | 'category' | 'subcategory' | 'combo' | 'campaign' | 'liveSession' | 'channel';
export type AdditiveMetric = 'gmv' | 'orders' | 'validOrders' | 'units' | 'cancelledOrders';

const UNKNOWN_KEY = '(không xác định)';

function orderKey(order: Order, dimension: ContributionDimension): string | null {
  switch (dimension) {
    case 'platform':
      return order.platform;
    case 'campaign':
      return order.campaignId || UNKNOWN_KEY;
    case 'liveSession':
      return order.liveSessionId || UNKNOWN_KEY;
    case 'channel':
      return order.channel || UNKNOWN_KEY;
    default:
      return null; // line-level dimension
  }
}

function lineKey(dataset: CanonicalDataset, line: OrderLine, dimension: ContributionDimension): string {
  if (dimension === 'sku') return line.sku;
  if (dimension === 'combo') return line.comboId || UNKNOWN_KEY;
  const product = productLookup(dataset).get(line.sku);
  if (dimension === 'category') return product?.category || UNKNOWN_KEY;
  if (dimension === 'subcategory') return product?.subcategory || UNKNOWN_KEY;
  return UNKNOWN_KEY;
}

const productCache = new WeakMap<CanonicalDataset, Map<string, CanonicalDataset['products'][number]>>();
function productLookup(dataset: CanonicalDataset) {
  let map = productCache.get(dataset);
  if (!map) {
    map = new Map(dataset.products.map((p) => [p.sku, p]));
    productCache.set(dataset, map);
  }
  return map;
}

/** Aggregates an additive metric by dimension over an order-grain slice. */
export function aggregateByDimension(slice: DatasetSlice, dimension: ContributionDimension, metric: AdditiveMetric): Map<string, number> {
  const out = new Map<string, number>();
  const add = (key: string, v: number) => out.set(key, (out.get(key) || 0) + v);
  const linesByOrder = new Map<string, OrderLine[]>();
  for (const l of slice.lines) {
    const list = linesByOrder.get(l.orderId);
    if (list) list.push(l);
    else linesByOrder.set(l.orderId, [l]);
  }

  for (const order of slice.orders) {
    const lines = linesByOrder.get(order.orderId) || [];
    const valid = isValidOrder(order.status);
    const orderLevelKey = orderKey(order, dimension);

    if (orderLevelKey !== null) {
      if (metric === 'orders') add(orderLevelKey, 1);
      else if (metric === 'validOrders') add(orderLevelKey, valid ? 1 : 0);
      else if (metric === 'cancelledOrders') add(orderLevelKey, isCancelled(order.status) ? 1 : 0);
      else if (valid) add(orderLevelKey, lines.reduce((s, l) => s + (metric === 'gmv' ? l.grossAmount || 0 : l.quantity || 0), 0));
      continue;
    }

    // Line-level dimension: order counts go to every key the order touches (distinct orders per key).
    const keys = new Set(lines.map((l) => lineKey(slice.dataset, l, dimension)));
    if (metric === 'orders' || metric === 'validOrders' || metric === 'cancelledOrders') {
      const counts =
        metric === 'orders' ? true : metric === 'validOrders' ? valid : isCancelled(order.status);
      for (const k of keys) add(k, counts ? 1 : 0);
    } else if (valid) {
      for (const l of lines) add(lineKey(slice.dataset, l, dimension), metric === 'gmv' ? l.grossAmount || 0 : l.quantity || 0);
    }
  }
  return out;
}

/**
 * Contribution of each dimension member to the change of `metric` between two filters.
 * Note: for line-level dimensions, order counts are not additive across keys
 * (a multi-SKU order counts once per SKU), so totals may exceed the shop total.
 */
export function contributionBetween(
  dataset: CanonicalDataset,
  currentFilter: DatasetFilter,
  previousFilter: DatasetFilter,
  dimension: ContributionDimension,
  metric: AdditiveMetric,
): ContributionResult {
  const cur = aggregateByDimension(sliceDataset(dataset, currentFilter), dimension, metric);
  const prev = aggregateByDimension(sliceDataset(dataset, previousFilter), dimension, metric);
  return computeContribution(cur, prev);
}

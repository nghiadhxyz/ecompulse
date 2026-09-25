import type { CanonicalDataset, Order, OrderLine, Platform } from './model';
import { isInRange, type DateRange } from './period';

export interface DatasetFilter {
  range: DateRange;
  /** Empty / undefined = all platforms. */
  platforms?: Platform[];
  skus?: string[];
  categories?: string[];
}

/** The subset of a dataset that falls inside a filter. Engines compute on this. */
export interface DatasetSlice {
  dataset: CanonicalDataset;
  filter: DatasetFilter;
  orders: Order[];
  /** Lines of `orders`, restricted to `filter.skus` / `filter.categories` when set. */
  lines: OrderLine[];
  dailyMetrics: CanonicalDataset['dailyMetrics'];
  traffic: CanonicalDataset['traffic'];
  ads: CanonicalDataset['ads'];
  liveSessions: CanonicalDataset['liveSessions'];
  affiliates: CanonicalDataset['affiliates'];
  costs: CanonicalDataset['costs'];
  settlements: CanonicalDataset['settlements'];
}

interface DatasetIndex {
  linesByOrder: Map<string, OrderLine[]>;
  categoryBySku: Map<string, string>;
}

const indexCache = new WeakMap<CanonicalDataset, DatasetIndex>();

export function getDatasetIndex(dataset: CanonicalDataset): DatasetIndex {
  const cached = indexCache.get(dataset);
  if (cached) return cached;
  const linesByOrder = new Map<string, OrderLine[]>();
  for (const line of dataset.orderLines) {
    const list = linesByOrder.get(line.orderId);
    if (list) list.push(line);
    else linesByOrder.set(line.orderId, [line]);
  }
  const categoryBySku = new Map<string, string>();
  for (const p of dataset.products) if (p.category) categoryBySku.set(p.sku, p.category);
  const index = { linesByOrder, categoryBySku };
  indexCache.set(dataset, index);
  return index;
}

function platformMatch(filter: DatasetFilter, platform: Platform | undefined): boolean {
  if (!filter.platforms || filter.platforms.length === 0) return true;
  return platform !== undefined && filter.platforms.includes(platform);
}

export function sliceDataset(dataset: CanonicalDataset, filter: DatasetFilter): DatasetSlice {
  const { range } = filter;
  const index = getDatasetIndex(dataset);
  const skuSet = filter.skus && filter.skus.length > 0 ? new Set(filter.skus) : null;
  const catSet = filter.categories && filter.categories.length > 0 ? new Set(filter.categories) : null;
  const lineMatch = (l: OrderLine) =>
    (!skuSet || skuSet.has(l.sku)) && (!catSet || catSet.has(index.categoryBySku.get(l.sku) || ''));

  const orders: Order[] = [];
  const lines: OrderLine[] = [];
  for (const o of dataset.orders) {
    if (!isInRange(o.orderDate, range) || !platformMatch(filter, o.platform)) continue;
    const orderLines = index.linesByOrder.get(o.orderId) || [];
    if (skuSet || catSet) {
      const matched = orderLines.filter(lineMatch);
      if (matched.length === 0) continue;
      orders.push(o);
      lines.push(...matched);
    } else {
      orders.push(o);
      lines.push(...orderLines);
    }
  }

  const inRange = <T extends { date?: string; platform?: Platform }>(rows: T[]) =>
    rows.filter((r) => r.date !== undefined && isInRange(r.date, range) && platformMatch(filter, r.platform));
  const skuScoped = <T extends { sku?: string }>(rows: T[]) => (skuSet ? rows.filter((r) => r.sku && skuSet.has(r.sku)) : rows);

  return {
    dataset,
    filter,
    orders,
    lines,
    dailyMetrics: skuSet || catSet ? [] : inRange(dataset.dailyMetrics),
    traffic: skuScoped(inRange(dataset.traffic)),
    ads: skuScoped(inRange(dataset.ads)),
    liveSessions: inRange(dataset.liveSessions),
    affiliates: inRange(dataset.affiliates),
    costs: skuSet || catSet ? [] : inRange(dataset.costs),
    settlements: dataset.settlements.filter(
      (s) => isInRange(s.settledDate, range) && platformMatch(filter, s.platform),
    ),
  };
}

/** Earliest and latest business date present in the dataset (orders, else daily metrics). */
export function datasetDateBounds(dataset: CanonicalDataset): DateRange | null {
  let min: string | null = null;
  let max: string | null = null;
  const visit = (d: string | undefined) => {
    if (!d) return;
    if (min === null || d < min) min = d;
    if (max === null || d > max) max = d;
  };
  for (const o of dataset.orders) visit(o.orderDate);
  if (dataset.orders.length === 0) for (const d of dataset.dailyMetrics) visit(d.date);
  return min && max ? { start: min, end: max } : null;
}

/** True when every day of `range` lies within the dataset's coverage. */
export function isRangeCovered(dataset: CanonicalDataset, range: DateRange): boolean {
  const bounds = datasetDateBounds(dataset);
  return !!bounds && range.start >= bounds.start && range.end <= bounds.end;
}

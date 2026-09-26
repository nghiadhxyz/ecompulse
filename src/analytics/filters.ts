import type { CanonicalDataset, Order, OrderLine, Platform } from './model';
import { isInRange, type DateRange } from './period';
import { selectPeriodOrDaily } from './periodRows';

export interface DatasetFilter {
  range: DateRange;
  /** Empty / undefined = all platforms. */
  platforms?: Platform[];
  // Line-level filters (product attributes)
  skus?: string[];
  categories?: string[];
  subcategories?: string[];
  comboIds?: string[];
  // Order-level filters
  campaignIds?: string[];
  liveSessionIds?: string[];
}

const nonEmpty = (a?: unknown[]) => !!a && a.length > 0;

/** Line-level filter present → only part of each order counts. */
export function hasLineFilter(f: DatasetFilter): boolean {
  return nonEmpty(f.skus) || nonEmpty(f.categories) || nonEmpty(f.subcategories) || nonEmpty(f.comboIds);
}

/** Any filter narrower than "whole shop on these platforms" — shop-level costs can't be attributed. */
export function isScopedFilter(f: DatasetFilter): boolean {
  return hasLineFilter(f) || nonEmpty(f.campaignIds) || nonEmpty(f.liveSessionIds);
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
  /** Daily ad rows only (no period totals) — for charts by day. */
  adsDaily: CanonicalDataset['ads'];
  liveSessions: CanonicalDataset['liveSessions'];
  affiliates: CanonicalDataset['affiliates'];
  costs: CanonicalDataset['costs'];
  settlements: CanonicalDataset['settlements'];
}

interface DatasetIndex {
  linesByOrder: Map<string, OrderLine[]>;
  categoryBySku: Map<string, string>;
  subcategoryBySku: Map<string, string>;
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
  const subcategoryBySku = new Map<string, string>();
  for (const p of dataset.products) {
    if (p.category) categoryBySku.set(p.sku, p.category);
    if (p.subcategory) subcategoryBySku.set(p.sku, p.subcategory);
  }
  const index = { linesByOrder, categoryBySku, subcategoryBySku };
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
  const toSet = (a?: string[]) => (a && a.length > 0 ? new Set(a) : null);
  const skuSet = toSet(filter.skus);
  const catSet = toSet(filter.categories);
  const subSet = toSet(filter.subcategories);
  const comboSet = toSet(filter.comboIds);
  const campaignSet = toSet(filter.campaignIds);
  const liveSet = toSet(filter.liveSessionIds);
  const lineFiltered = !!(skuSet || catSet || subSet || comboSet);
  const skuMatch = (sku: string) =>
    (!skuSet || skuSet.has(sku)) &&
    (!catSet || catSet.has(index.categoryBySku.get(sku) || '')) &&
    (!subSet || subSet.has(index.subcategoryBySku.get(sku) || ''));
  const lineMatch = (l: OrderLine) => skuMatch(l.sku) && (!comboSet || (!!l.comboId && comboSet.has(l.comboId)));

  const orders: Order[] = [];
  const lines: OrderLine[] = [];
  for (const o of dataset.orders) {
    if (!isInRange(o.orderDate, range) || !platformMatch(filter, o.platform)) continue;
    if (campaignSet && !(o.campaignId && campaignSet.has(o.campaignId))) continue;
    if (liveSet && !(o.liveSessionId && liveSet.has(o.liveSessionId))) continue;
    const orderLines = index.linesByOrder.get(o.orderId) || [];
    if (lineFiltered) {
      const matched = orderLines.filter(lineMatch);
      if (matched.length === 0) continue;
      orders.push(o);
      lines.push(...matched);
    } else {
      orders.push(o);
      lines.push(...orderLines);
    }
  }

  // Period-total rows (periodStart set) count only when the whole period is inside the range.
  const inRange = <T extends { date?: string; periodStart?: string; platform?: Platform }>(rows: T[]) =>
    rows.filter(
      (r) =>
        r.date !== undefined &&
        isInRange(r.date, range) &&
        (r.periodStart === undefined || r.periodStart >= range.start) &&
        platformMatch(filter, r.platform),
    );
  // When a report gives both a period total and daily rows for the same item, the whole
  // period uses the platform's total and a partial range uses the days (see periodRows.ts).
  const periodOrDaily = <T extends { date: string; periodStart?: string; platform?: Platform }>(rows: T[], key: (r: T) => string) =>
    selectPeriodOrDaily(inRange(rows), range, key);
  const adKey = (a: CanonicalDataset['ads'][number]) => `${a.platform}|${a.campaignId ?? ''}|${a.adName ?? ''}|${a.sku ?? ''}`;
  const adsScoped = (rows: CanonicalDataset['ads']) => productScoped(rows).filter((a) => !campaignSet || (!!a.campaignId && campaignSet.has(a.campaignId)));
  // Product-scoped rows (traffic, ads) follow the product filters; shop-level rows drop out.
  const productScoped = <T extends { sku?: string }>(rows: T[]) =>
    lineFiltered && !comboSet ? rows.filter((r) => r.sku && skuMatch(r.sku)) : comboSet ? rows.filter((r) => r.sku && comboSet.has(r.sku)) : rows;
  const orderScoped = !!(campaignSet || liveSet);

  return {
    dataset,
    filter,
    orders,
    lines,
    dailyMetrics: lineFiltered || orderScoped ? [] : inRange(dataset.dailyMetrics),
    traffic: orderScoped ? [] : productScoped(periodOrDaily(dataset.traffic, (t) => `${t.platform}|${t.sku ?? ''}`)),
    ads: adsScoped(periodOrDaily(dataset.ads, adKey)),
    adsDaily: adsScoped(inRange(dataset.ads).filter((a) => a.periodStart === undefined)),
    liveSessions: inRange(dataset.liveSessions).filter((s) => !liveSet || liveSet.has(s.sessionId)),
    affiliates: lineFiltered || orderScoped ? [] : inRange(dataset.affiliates),
    costs: lineFiltered || orderScoped ? [] : inRange(dataset.costs),
    settlements: orderScoped || lineFiltered ? [] : dataset.settlements.filter((s) => isInRange(s.settledDate, range) && platformMatch(filter, s.platform)),
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

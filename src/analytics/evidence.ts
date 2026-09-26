/**
 * Evidence — the numbers behind every insight, plus the exact filter that the
 * "Xem dữ liệu" button opens. Alerts, the daily brief and Dolphin AI only state
 * what an Evidence object supports.
 */
import type { CanonicalDataset, Order, OrderLine, OrderStatus, Platform } from './model';
import type { Bilingual, MetricUnit } from './metric';
import type { DateRange } from './period';
import { getDatasetIndex } from './filters';
import { isInRange } from './period';
import { isCancelled } from './status';

export interface EvidenceFilter {
  range: DateRange;
  platforms?: Platform[];
  skus?: string[];
  statuses?: OrderStatus[];
  /** Only cancelled/failed orders. */
  cancelledOnly?: boolean;
  /** Only returned/refunded orders. */
  returnedOnly?: boolean;
  liveSessionId?: string;
  campaignId?: string;
  /** Exact order channel, e.g. "affiliate:koc_meobeo" or "video:VID-TT-02". */
  channel?: string;
  /** Pseudonymous customer IDs (customer segments). */
  customerIds?: string[];
}

export interface Evidence {
  label: Bilingual;
  unit: MetricUnit;
  current: number | null;
  currentLabel: Bilingual;
  baseline?: number | null;
  baselineLabel?: Bilingual;
  /** Number of orders behind the current value (sample size). */
  sampleSize?: number;
  filter?: EvidenceFilter;
}

export interface EvidenceOrderRow {
  order: Order;
  lines: OrderLine[];
  gross: number;
}

/** Orders matching an evidence filter, newest first — the "Xem dữ liệu" drill-down. */
export function listEvidenceOrders(dataset: CanonicalDataset, filter: EvidenceFilter, limit = 500): { rows: EvidenceOrderRow[]; total: number } {
  const index = getDatasetIndex(dataset);
  const skuSet = filter.skus?.length ? new Set(filter.skus) : null;
  const statusSet = filter.statuses?.length ? new Set(filter.statuses) : null;
  const customerSet = filter.customerIds?.length ? new Set(filter.customerIds) : null;
  const rows: EvidenceOrderRow[] = [];
  for (const order of dataset.orders) {
    if (!isInRange(order.orderDate, filter.range)) continue;
    if (filter.platforms?.length && !filter.platforms.includes(order.platform)) continue;
    if (statusSet && !statusSet.has(order.status)) continue;
    if (filter.cancelledOnly && !isCancelled(order.status)) continue;
    if (filter.returnedOnly && order.status !== 'returned' && order.status !== 'refunded') continue;
    if (filter.liveSessionId && order.liveSessionId !== filter.liveSessionId) continue;
    if (filter.campaignId && order.campaignId !== filter.campaignId) continue;
    if (filter.channel && order.channel !== filter.channel) continue;
    if (customerSet && (!order.customerId || !customerSet.has(order.customerId))) continue;
    const all = index.linesByOrder.get(order.orderId) || [];
    const lines = skuSet ? all.filter((l) => skuSet.has(l.sku)) : all;
    if (skuSet && lines.length === 0) continue;
    rows.push({ order, lines, gross: lines.reduce((s, l) => s + (l.grossAmount || 0), 0) });
  }
  rows.sort((a, b) => (a.order.orderDate < b.order.orderDate ? 1 : a.order.orderDate > b.order.orderDate ? -1 : 0));
  return { rows: rows.slice(0, limit), total: rows.length };
}

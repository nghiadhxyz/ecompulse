/**
 * Order health — lifecycle counts and cancel/return breakdowns by SKU, platform,
 * date and reason. Rates use placed orders (cancel) and non-cancelled orders (return).
 */
import type { CanonicalDataset, OrderStatus, Platform } from './model';
import { sliceDataset, type DatasetFilter } from './filters';
import { isCancelled, isCompleted, isReturnOrRefund } from './status';
import { enumerateDays } from './period';

export interface LifecycleCounts {
  total: number;
  placed: number; // awaiting payment/confirmation
  paid: number; // confirmed, awaiting shipment
  shipped: number;
  delivered: number;
  completed: number;
  cancelled: number;
  failedDelivery: number;
  returned: number;
  refunded: number;
  unknown: number;
}

export interface RateRow {
  key: string;
  placed: number;
  valid: number;
  cancelled: number;
  returned: number;
  cancelRate: number | null;
  returnRate: number | null;
}

export interface ReasonRow {
  reason: string;
  count: number;
  share: number;
}

export interface OrderHealth {
  lifecycle: LifecycleCounts;
  cancelRate: number | null;
  returnRate: number | null;
  completionRate: number | null;
  bySku: RateRow[];
  byPlatform: RateRow[];
  byDate: RateRow[];
  cancelReasons: ReasonRow[];
  returnReasons: ReasonRow[];
  /** Cancelled/returned orders without any reason recorded. */
  withoutReason: number;
}

const STATUS_FIELD: Record<OrderStatus, keyof LifecycleCounts> = {
  placed: 'placed',
  paid: 'paid',
  shipped: 'shipped',
  delivered: 'delivered',
  completed: 'completed',
  cancelled: 'cancelled',
  failed_delivery: 'failedDelivery',
  returned: 'returned',
  refunded: 'refunded',
  unknown: 'unknown',
};

function newRate(key: string): RateRow {
  return { key, placed: 0, valid: 0, cancelled: 0, returned: 0, cancelRate: null, returnRate: null };
}

function finish(rows: Map<string, RateRow>): RateRow[] {
  return Array.from(rows.values()).map((r) => ({
    ...r,
    cancelRate: r.placed > 0 ? r.cancelled / r.placed : null,
    returnRate: r.valid > 0 ? r.returned / r.valid : null,
  }));
}

function reasons(counts: Map<string, number>): ReasonRow[] {
  const total = Array.from(counts.values()).reduce((s, n) => s + n, 0);
  return Array.from(counts.entries())
    .map(([reason, count]) => ({ reason, count, share: total > 0 ? count / total : 0 }))
    .sort((a, b) => b.count - a.count);
}

export function orderHealth(dataset: CanonicalDataset, filter: DatasetFilter): OrderHealth {
  const slice = sliceDataset(dataset, filter);
  const lifecycle: LifecycleCounts = {
    total: 0, placed: 0, paid: 0, shipped: 0, delivered: 0, completed: 0, cancelled: 0, failedDelivery: 0, returned: 0, refunded: 0, unknown: 0,
  };
  const bySku = new Map<string, RateRow>();
  const byPlatform = new Map<Platform, RateRow>();
  const byDate = new Map<string, RateRow>(enumerateDays(filter.range).map((d) => [d, newRate(d)]));
  const cancelReasons = new Map<string, number>();
  const returnReasons = new Map<string, number>();
  let withoutReason = 0;

  // Summary reports: rates per day / platform from the daily rows (no statuses, no reasons).
  if (slice.orders.length === 0 && slice.dailyMetrics.length > 0) {
    let placed = 0;
    let cancelled = 0;
    let valid = 0;
    let returned = 0;
    for (const d of slice.dailyMetrics) {
      const add = (row: RateRow) => {
        row.placed += d.placedOrders ?? 0;
        row.cancelled += d.cancelledOrders ?? 0;
        row.valid += d.paidOrders ?? 0;
        row.returned += d.refundedOrders ?? 0;
      };
      const day = byDate.get(d.date);
      if (day) add(day);
      let p = byPlatform.get(d.platform);
      if (!p) byPlatform.set(d.platform, (p = newRate(d.platform)));
      add(p);
      placed += d.placedOrders ?? 0;
      cancelled += d.cancelledOrders ?? 0;
      valid += d.paidOrders ?? 0;
      returned += d.refundedOrders ?? 0;
    }
    lifecycle.total = placed;
    lifecycle.cancelled = cancelled;
    lifecycle.refunded = returned;
    return {
      lifecycle,
      cancelRate: placed > 0 ? cancelled / placed : null,
      returnRate: valid > 0 ? returned / valid : null,
      completionRate: null,
      bySku: [],
      byPlatform: finish(byPlatform),
      byDate: finish(byDate),
      cancelReasons: [],
      returnReasons: [],
      withoutReason: 0,
    };
  }

  const skusByOrder = new Map<string, Set<string>>();
  for (const l of slice.lines) {
    let set = skusByOrder.get(l.orderId);
    if (!set) skusByOrder.set(l.orderId, (set = new Set()));
    set.add(l.sku);
  }

  const bump = (row: RateRow, cancelled: boolean, returned: boolean) => {
    row.placed++;
    if (cancelled) row.cancelled++;
    else row.valid++;
    if (returned) row.returned++;
  };

  for (const o of slice.orders) {
    lifecycle.total++;
    lifecycle[STATUS_FIELD[o.status]]++;
    const cancelled = isCancelled(o.status);
    const returned = isReturnOrRefund(o.status);

    let p = byPlatform.get(o.platform);
    if (!p) byPlatform.set(o.platform, (p = newRate(o.platform)));
    bump(p, cancelled, returned);
    const d = byDate.get(o.orderDate);
    if (d) bump(d, cancelled, returned);
    for (const sku of skusByOrder.get(o.orderId) || []) {
      let r = bySku.get(sku);
      if (!r) bySku.set(sku, (r = newRate(sku)));
      bump(r, cancelled, returned);
    }

    if (cancelled) {
      if (o.cancelReason) cancelReasons.set(o.cancelReason, (cancelReasons.get(o.cancelReason) || 0) + 1);
      else withoutReason++;
    } else if (returned) {
      const reason = o.returnReason || o.cancelReason;
      if (reason) returnReasons.set(reason, (returnReasons.get(reason) || 0) + 1);
      else withoutReason++;
    }
  }

  const cancelledAll = lifecycle.cancelled + lifecycle.failedDelivery;
  const valid = lifecycle.total - cancelledAll;
  const completed = slice.orders.filter((o) => isCompleted(o.status)).length;
  return {
    lifecycle,
    cancelRate: lifecycle.total > 0 ? cancelledAll / lifecycle.total : null,
    returnRate: valid > 0 ? (lifecycle.returned + lifecycle.refunded) / valid : null,
    completionRate: lifecycle.total > 0 ? completed / lifecycle.total : null,
    bySku: finish(bySku).sort((a, b) => b.cancelled - a.cancelled),
    byPlatform: finish(byPlatform),
    byDate: finish(byDate),
    cancelReasons: reasons(cancelReasons),
    returnReasons: reasons(returnReasons),
    withoutReason,
  };
}

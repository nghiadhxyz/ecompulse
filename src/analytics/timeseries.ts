/**
 * Daily series in one pass (for charts). Same definitions as the KPI engine:
 * GMV = gross of non-cancelled orders; orders = placed orders.
 */
import type { CanonicalDataset } from './model';
import { sliceDataset, type DatasetFilter } from './filters';
import { enumerateDays } from './period';
import { stageDay, stageOf } from './orderStage';
import { isCancelled } from './status';

export interface DailyPoint {
  date: string;
  gmv: number | null;
  orders: number | null;
  cancelled: number | null;
}

export function dailySeries(dataset: CanonicalDataset, filter: DatasetFilter): DailyPoint[] {
  const slice = sliceDataset(dataset, filter);
  const days = enumerateDays(filter.range);
  if (dataset.orders.length > 0) {
    const map = new Map(days.map((d) => [d, { date: d, gmv: 0, orders: 0, cancelled: 0 } as DailyPoint]));
    const statusById = new Map(slice.orders.map((o) => [o.orderId, o]));
    for (const o of slice.orders) {
      const p = map.get(o.orderDate);
      if (!p) continue;
      p.orders! += 1;
      if (isCancelled(o.status)) p.cancelled! += 1;
    }
    for (const l of slice.lines) {
      const o = statusById.get(l.orderId);
      if (!o || isCancelled(o.status)) continue;
      const p = map.get(o.orderDate);
      if (p) p.gmv! += l.grossAmount || 0;
    }
    return days.map((d) => map.get(d)!);
  }
  const stage = stageOf(filter);
  const byDate = new Map(days.map((d) => [d, { date: d, gmv: null, orders: null, cancelled: null } as DailyPoint]));
  for (const m of slice.dailyMetrics) {
    const p = byDate.get(m.date);
    if (!p) continue;
    // One order stage (placed by default) for sales, orders and cancellations of the day.
    const s = stageDay(m, stage);
    if (s.gmv !== undefined) p.gmv = (p.gmv ?? 0) + s.gmv;
    if (s.orders !== undefined) p.orders = (p.orders ?? 0) + s.orders;
    if (s.cancelledOrders !== undefined) p.cancelled = (p.cancelled ?? 0) + s.cancelledOrders;
  }
  return days.map((d) => byDate.get(d)!);
}

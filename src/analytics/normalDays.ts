/**
 * Normal-day statistics: averages that exclude campaign/sale dates, so a mega-sale in
 * one window does not fake growth or decline when comparing periods.
 */
import type { CanonicalDataset, Platform } from './model';
import { getDatasetIndex } from './filters';
import { addDays, isInRange, type DateRange } from './period';
import { isCancelled } from './status';

/** Every date covered by a campaign in the dataset (double days, paydays, mega sales). */
export function campaignDates(dataset: CanonicalDataset): Set<string> {
  const out = new Set<string>();
  for (const c of dataset.campaigns) {
    for (let d = c.startDate; d <= c.endDate; d = addDays(d, 1)) out.add(d);
  }
  return out;
}

export interface NormalDayStats {
  days: number;
  gmvPerDay: number;
  ordersPerDay: number;
  clicksPerDay: number | null;
}

/** Per-normal-day averages for one SKU (campaign dates excluded). */
export function normalDayStats(dataset: CanonicalDataset, sku: string, r: DateRange, saleDays: Set<string>, platforms?: Platform[]): NormalDayStats {
  const index = getDatasetIndex(dataset);
  let days = 0;
  for (let d = r.start; d <= r.end; d = addDays(d, 1)) if (!saleDays.has(d)) days++;
  let gmv = 0;
  let orders = 0;
  for (const o of dataset.orders) {
    if (!isInRange(o.orderDate, r) || saleDays.has(o.orderDate) || isCancelled(o.status)) continue;
    if (platforms?.length && !platforms.includes(o.platform)) continue;
    const lines = (index.linesByOrder.get(o.orderId) || []).filter((l) => l.sku === sku);
    if (lines.length === 0) continue;
    orders++;
    gmv += lines.reduce((sum, l) => sum + (l.grossAmount || 0), 0);
  }
  const trafficRows = dataset.traffic.filter(
    (t) => t.sku === sku && isInRange(t.date, r) && !saleDays.has(t.date) && (!platforms?.length || platforms.includes(t.platform)) && typeof (t.productClicks ?? t.productViews) === 'number',
  );
  const clicks = trafficRows.length > 0 ? trafficRows.reduce((sum, t) => sum + (t.productClicks ?? t.productViews ?? 0), 0) : null;
  return {
    days,
    gmvPerDay: days > 0 ? gmv / days : 0,
    ordersPerDay: days > 0 ? orders / days : 0,
    clicksPerDay: clicks !== null && days > 0 ? clicks / days : null,
  };
}

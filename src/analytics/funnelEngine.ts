/**
 * Funnel Engine — Impression → View → Product click → Add to cart → Order → Paid → Completed.
 *
 * Traffic stages come from TrafficDaily (or live-session facts), order stages from
 * orders. A stage without data is `null` and is skipped — conversion is only
 * computed between consecutive stages that both exist, and the gap is reported.
 * "Paid" = placed orders that are not cancelled and not still awaiting payment.
 */
import type { CanonicalDataset, Platform } from './model';
import { sliceDataset, type DatasetFilter } from './filters';
import { isCancelled, isCompleted } from './status';
import type { Bilingual } from './metric';
import type { DateRange } from './period';

export type FunnelStageKey = 'impressions' | 'views' | 'clicks' | 'addToCart' | 'orders' | 'paid' | 'completed';

export const FUNNEL_LABELS: Record<FunnelStageKey, Bilingual> = {
  impressions: { vi: 'Hiển thị', en: 'Impressions' },
  views: { vi: 'Lượt xem', en: 'Views' },
  clicks: { vi: 'Nhấp sản phẩm', en: 'Product clicks' },
  addToCart: { vi: 'Thêm giỏ hàng', en: 'Add to cart' },
  orders: { vi: 'Đặt hàng', en: 'Orders' },
  paid: { vi: 'Đã thanh toán', en: 'Paid' },
  completed: { vi: 'Hoàn tất', en: 'Completed' },
};

const ORDER: FunnelStageKey[] = ['impressions', 'views', 'clicks', 'addToCart', 'orders', 'paid', 'completed'];

export interface FunnelStep {
  from: FunnelStageKey;
  to: FunnelStageKey;
  /** to / from. */
  rate: number | null;
  /** 1 − rate. */
  dropOff: number | null;
  /** Stages between from and to that have no data. */
  skipped: FunnelStageKey[];
}

export interface Funnel {
  stages: Record<FunnelStageKey, number | null>;
  steps: FunnelStep[];
  /** Step with the lowest conversion among steps with data. */
  biggestLeak: FunnelStep | null;
  missing: FunnelStageKey[];
  /** Order stages are complete only for orders old enough to be delivered. */
  notes: Bilingual[];
}

function sumOrNull<T>(rows: T[], pick: (r: T) => number | undefined): number | null {
  let any = false;
  let s = 0;
  for (const r of rows) {
    const v = pick(r);
    if (typeof v === 'number') {
      any = true;
      s += v;
    }
  }
  return any ? s : null;
}

function build(stages: Record<FunnelStageKey, number | null>, notes: Bilingual[]): Funnel {
  const present = ORDER.filter((k) => stages[k] !== null);
  const steps: FunnelStep[] = [];
  for (let i = 0; i + 1 < present.length; i++) {
    const from = present[i];
    const to = present[i + 1];
    const a = stages[from]!;
    const b = stages[to]!;
    const rate = a > 0 ? b / a : null;
    steps.push({ from, to, rate, dropOff: rate === null ? null : 1 - rate, skipped: ORDER.slice(ORDER.indexOf(from) + 1, ORDER.indexOf(to)) });
  }
  const withRate = steps.filter((s) => s.rate !== null);
  const biggestLeak = withRate.length ? withRate.reduce((m, s) => (s.rate! < m.rate! ? s : m)) : null;
  return { stages, steps, biggestLeak, missing: ORDER.filter((k) => stages[k] === null), notes };
}

/** Shop / SKU / category / platform funnel for a filter. */
export function funnel(dataset: CanonicalDataset, filter: DatasetFilter): Funnel {
  const slice = sliceDataset(dataset, filter);
  const skuTraffic = slice.traffic.filter((t) => t.sku);
  const hasOrders = dataset.orders.length > 0;
  const orders = hasOrders ? slice.orders.length : sumOrNull(slice.dailyMetrics, (d) => d.placedOrders);
  const paid = hasOrders ? slice.orders.filter((o) => !isCancelled(o.status) && o.status !== 'placed').length : sumOrNull(slice.dailyMetrics, (d) => d.paidOrders);
  const completed = hasOrders ? slice.orders.filter((o) => isCompleted(o.status)).length : null;
  const notes: Bilingual[] = [];
  if (hasOrders && slice.orders.some((o) => o.status === 'placed' || o.status === 'paid' || o.status === 'shipped')) {
    notes.push({
      vi: 'Một số đơn gần đây vẫn đang xử lý/giao — tỷ lệ "Hoàn tất" của kỳ này sẽ còn tăng.',
      en: 'Some recent orders are still in progress — the completion rate will rise.',
    });
  }
  return build(
    {
      impressions: sumOrNull(skuTraffic, (t) => t.impressions),
      views: sumOrNull(skuTraffic, (t) => t.productViews),
      clicks: sumOrNull(skuTraffic, (t) => t.productClicks) ?? sumOrNull(slice.dailyMetrics, (d) => d.productClicks),
      addToCart: sumOrNull(skuTraffic, (t) => t.addToCart),
      orders,
      paid,
      completed,
    },
    notes,
  );
}

/** Live funnel: viewers → product clicks → add to cart → orders → paid. */
export function liveFunnel(dataset: CanonicalDataset, range: DateRange, platforms?: Platform[], sessionIds?: string[]): Funnel {
  const sessions = sliceDataset(dataset, { range, platforms }).liveSessions.filter((s) => !sessionIds?.length || sessionIds.includes(s.sessionId));
  return build(
    {
      impressions: sumOrNull(sessions, (s) => s.viewers),
      views: null,
      clicks: sumOrNull(sessions, (s) => s.productClicks),
      addToCart: sumOrNull(sessions, (s) => s.addToCart),
      orders: sumOrNull(sessions, (s) => s.orders),
      paid: sumOrNull(sessions, (s) => s.paidOrders),
      completed: null,
    },
    [{ vi: '"Hiển thị" của live là số người xem.', en: 'For live, "impressions" = viewers.' }],
  );
}

export interface FunnelComparison {
  current: Funnel;
  previous: Funnel;
  /** Per step: change in conversion rate, in percentage points. */
  stepChangesPp: { from: FunnelStageKey; to: FunnelStageKey; pp: number | null }[];
}

export function compareFunnels(current: Funnel, previous: Funnel): FunnelComparison {
  const stepChangesPp = current.steps.map((s) => {
    const p = previous.steps.find((x) => x.from === s.from && x.to === s.to);
    return { from: s.from, to: s.to, pp: s.rate !== null && p?.rate != null ? (s.rate - p.rate) * 100 : null };
  });
  return { current, previous, stepChangesPp };
}

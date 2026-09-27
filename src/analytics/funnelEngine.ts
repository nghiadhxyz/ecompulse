/**
 * Funnel Engine — Impression → View → Product click → Add to cart → Order → Paid → Completed.
 *
 * Traffic stages come from TrafficDaily (or live-session facts), order stages from
 * orders. A stage without data is `null` and is skipped — conversion is only
 * computed between consecutive stages that both exist, and the gap is reported.
 * "Paid" = placed orders that are not cancelled and not still awaiting payment.
 */
import type { CanonicalDataset, Platform, SummaryChannel } from './model';
import { channelMix, SUMMARY_CHANNEL_LABELS } from './summaryEngine';
import { sliceDataset, type DatasetFilter } from './filters';
import { isCancelled, isCompleted } from './status';
import type { Bilingual } from './metric';
import type { DateRange } from './period';
import { CROSS_PERIOD_NOTE } from './orderStage';

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
  /**
   * Lowest-converting step after the shopper reached the product (impression → click is
   * always the lowest and says little on its own; it is only used when nothing else exists).
   */
  biggestLeak: FunnelStep | null;
  missing: FunnelStageKey[];
  /** Order stages are complete only for orders old enough to be delivered. */
  notes: Bilingual[];
  /** Stage names that differ from FUNNEL_LABELS (e.g. live "Người xem"). */
  labels?: Partial<Record<FunnelStageKey, Bilingual>>;
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

/**
 * `noRateInto`: stages reached from a different count (summary paid orders are counted on the
 * payment day, not a subset of placed orders) — shown, but with no conversion rate (0.2).
 */
function build(stages: Record<FunnelStageKey, number | null>, notes: Bilingual[], labels?: Funnel['labels'], noRateInto: FunnelStageKey[] = []): Funnel {
  const present = ORDER.filter((k) => stages[k] !== null);
  const steps: FunnelStep[] = [];
  for (let i = 0; i + 1 < present.length; i++) {
    const from = present[i];
    const to = present[i + 1];
    const a = stages[from]!;
    const b = stages[to]!;
    const rate = a > 0 && !noRateInto.includes(to) ? b / a : null;
    steps.push({ from, to, rate, dropOff: rate === null ? null : 1 - rate, skipped: ORDER.slice(ORDER.indexOf(from) + 1, ORDER.indexOf(to)) });
  }
  // Rates above 100% (different counts, 0.5) say nothing about a leak.
  const withRate = steps.filter((s) => s.rate !== null && s.rate <= 1);
  const onSite = withRate.filter((s) => s.from !== 'impressions' && s.from !== 'views');
  const pool = onSite.length ? onSite : withRate;
  const biggestLeak = pool.length ? pool.reduce((m, s) => (s.rate! < m.rate! ? s : m)) : null;
  return { stages, steps, biggestLeak, missing: ORDER.filter((k) => stages[k] === null), notes, labels };
}

/** Shop / SKU / category / platform funnel for a filter. */
export function funnel(dataset: CanonicalDataset, filter: DatasetFilter): Funnel {
  const slice = sliceDataset(dataset, filter);
  const skuTraffic = slice.traffic.filter((t) => t.sku);
  const hasOrders = dataset.orders.length > 0;
  const orders = hasOrders ? slice.orders.length : sumOrNull(slice.dailyMetrics, (d) => d.placedOrders);
  // Summary reports count paid orders on the payment day: not a subset of the placed orders
  // of the same window, so they are not a funnel step (see orderStage.ts).
  const paid = hasOrders ? slice.orders.filter((o) => !isCancelled(o.status) && o.status !== 'placed').length : null;
  const completed = hasOrders ? slice.orders.filter((o) => isCompleted(o.status)).length : null;
  const notes: Bilingual[] = [];
  if (!hasOrders && slice.dailyMetrics.some((d) => d.paidOrders !== undefined)) notes.push(CROSS_PERIOD_NOTE);
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

/**
 * Funnel of one channel from the summary report's canonical channel row (0.3):
 * impressions (product card) or views (live / video / affiliate) → clicks → orders.
 * Live also shows its paid orders, without a rate (paid is not a subset of placed, 0.2).
 */
export function channelFunnel(dataset: CanonicalDataset, filter: DatasetFilter, channel: SummaryChannel): Funnel | null {
  const row = channelMix(dataset, filter, 'placed').channels.find((c) => c.channel === channel);
  if (!row || (row.impressions === null && row.views === null)) return null;
  const paid = channel === 'live' ? channelMix(dataset, filter, 'paid').channels.find((c) => c.channel === channel)?.orders ?? null : null;
  const notes: Bilingual[] = [];
  if (row.impressions === null && row.uniqueImpressions !== null) {
    notes.push({ vi: `Người xem (khác nhau): ${row.uniqueImpressions}. Lượt nhấp có thể nhiều hơn lượt xem vì Shopee đếm hai cột theo cách khác nhau.`, en: `Distinct viewers: ${row.uniqueImpressions}.` });
  }
  if (paid !== null) notes.push({ vi: 'Đơn thanh toán tính theo ngày tiền về — hiện để tham khảo, không tính tỷ lệ chuyển tiếp.', en: 'Paid orders are counted on the payment day — shown, no rate.' });
  const label = SUMMARY_CHANNEL_LABELS[channel];
  return build(
    { impressions: row.impressions, views: row.views, clicks: row.clicks, addToCart: null, orders: row.orders, paid, completed: null },
    notes,
    { views: { vi: `Lượt xem (${label.vi})`, en: `Views (${label.en})` } },
    ['paid'],
  );
}

/**
 * Live funnel. From the report's Live channel row when there is one (4.4); otherwise from the
 * sessions: viewers → product clicks → add to cart (sessions with viewers only) → orders → paid.
 */
export function liveFunnel(dataset: CanonicalDataset, range: DateRange, platforms?: Platform[], sessionIds?: string[]): Funnel {
  if (!sessionIds?.length) {
    const fromChannel = channelFunnel(dataset, { range, platforms }, 'live');
    if (fromChannel) return fromChannel;
  }
  const sessions = sliceDataset(dataset, { range, platforms }).liveSessions.filter((s) => !sessionIds?.length || sessionIds.includes(s.sessionId));
  // Add-to-cart in a session with no viewers is Shopee's own inconsistency (0.7): left out.
  const watched = sessions.filter((s) => (s.viewers ?? 0) > 0);
  return build(
    {
      impressions: sumOrNull(sessions, (s) => s.viewers),
      views: null,
      clicks: sumOrNull(sessions, (s) => s.productClicks),
      addToCart: sumOrNull(watched, (s) => s.addToCart),
      orders: sumOrNull(sessions, (s) => s.orders),
      paid: sumOrNull(sessions, (s) => s.paidOrders),
      completed: null,
    },
    [],
    { impressions: { vi: 'Người xem', en: 'Viewers' } },
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

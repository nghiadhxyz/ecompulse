/**
 * Order stage of summary-report figures — one place for the rule every page follows.
 *
 * Shopee summary reports count the same sales three times: placed ("Đơn đã đặt"),
 * confirmed and paid ("Đơn đã thanh toán"). Paid orders are counted on the day the money
 * arrives, so they lag the day the order was placed and are NOT a subset of the placed
 * orders of the same window (422 paid + 102 cancelled = 524 > 519 placed).
 *
 * Rules
 *  - Every figure defaults to PLACED orders: trends, anomalies, weekdays, correlations,
 *    briefs, KPI cards.
 *  - Paid orders are used only when the user picks them (filter.stage) or for the
 *    "tiền về" figures, and always carry the "Đơn đã thanh toán" label.
 *  - GMV, orders, AOV, cancellations and refunds shown together come from ONE stage.
 *  - No "X% of placed orders were paid" and no stage-to-stage rate above 100%.
 */
import type { DailyMetric, SummaryStage } from './model';
import type { Bilingual } from './metric';

/** Default order stage for summary-report figures. */
export const DEFAULT_STAGE: SummaryStage = 'placed';

export const STAGE_BASIS: Record<SummaryStage, Bilingual> = {
  placed: { vi: 'Đơn đặt', en: 'Placed orders' },
  confirmed: { vi: 'Đơn xác nhận', en: 'Confirmed orders' },
  paid: { vi: 'Đơn đã thanh toán', en: 'Paid orders' },
};

/** The stage a filter asks for (summary reports only). */
export function stageOf(filter: { stage?: SummaryStage }): SummaryStage {
  return filter.stage ?? DEFAULT_STAGE;
}

/** Daily figures of one stage. Cancellations and refunds exist per stage in Shopee's sheets. */
export interface StageDay {
  gmv?: number;
  orders?: number;
  cancelledOrders?: number;
  cancelledGmv?: number;
  refundedOrders?: number;
  refundedGmv?: number;
}

export function stageDay(d: DailyMetric, stage: SummaryStage): StageDay {
  if (stage === 'paid') {
    return { gmv: d.paidGmv, orders: d.paidOrders, cancelledOrders: d.paidCancelledOrders, cancelledGmv: d.paidCancelledGmv, refundedOrders: d.paidRefundedOrders, refundedGmv: d.paidRefundedGmv };
  }
  if (stage === 'confirmed') return { gmv: d.confirmedGmv, orders: d.confirmedOrders };
  return { gmv: d.placedGmv, orders: d.placedOrders, cancelledOrders: d.cancelledOrders, cancelledGmv: d.cancelledGmv, refundedOrders: d.refundedOrders, refundedGmv: d.refundedGmv };
}

/** Rate between two stages; above 100% the stages counted different orders (different days). */
export function crossStageRate(to: number | null | undefined, from: number | null | undefined): { rate: number | null; crossPeriod: boolean } {
  if (to === null || to === undefined || !from) return { rate: null, crossPeriod: false };
  const rate = to / from;
  return rate > 1 ? { rate: null, crossPeriod: true } : { rate, crossPeriod: false };
}

export const CROSS_PERIOD_NOTE: Bilingual = {
  vi: 'Khác kỳ đếm: đơn thanh toán tính theo ngày tiền về nên không phải tập con của đơn đặt cùng kỳ.',
  en: 'Different counting periods: paid orders are counted when paid, not a subset of placed orders.',
};

/**
 * Day-based analyses (anomalies, campaigns and calendar, statistics, the daily brief) always
 * count placed orders, whatever the stage picker says: paid orders land on the payment day,
 * not the day the sale happened.
 */
export function placedOnly<T extends { stage?: SummaryStage }>(filter: T): T {
  return { ...filter, stage: 'placed' };
}

export const PLACED_ONLY_NOTE: Bilingual = {
  vi: 'Trang này luôn dùng đơn đặt để đúng ngày phát sinh.',
  en: 'This page always uses placed orders, so sales fall on the day they happened.',
};

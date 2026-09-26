import { describe, expect, it } from 'vitest';
import { applyShortcut, productLeaders, productPerformance } from '../productEngine';
import { orderHealth } from '../orderHealthEngine';
import { adsSummary, liveSessions } from '../adsLiveEngine';
import { detectAlerts } from '../anomalyEngine';
import { buildDailyBrief } from '../dailyBrief';
import { listEvidenceOrders } from '../evidence';
import { computeProfitByGroup } from '../profitEngine';
import { sliceDataset } from '../filters';
import { fmtChange, fmtMoneyCompact, fmtPp, fmtRate } from '../format';
import { buildDemoCanonicalDataset } from '../../data/demoCanonicalDataset';
import { baseFixture, dataset, line, order, SEPT_1_2 } from './fixtures';

const K = 1000;

describe('product engine', () => {
  const perf = productPerformance(baseFixture(), { range: SEPT_1_2 });
  const bySku = Object.fromEntries(perf.rows.map((r) => [r.sku, r]));

  it('counts distinct orders, cancellations and GMV per SKU', () => {
    expect(bySku.A.placedOrders).toBe(2); // O1 + cancelled O2
    expect(bySku.A.orders).toBe(1);
    expect(bySku.A.cancelRate).toBeCloseTo(0.5, 10);
    expect(bySku.A.gmv).toBe(200 * K);
    expect(bySku.B.gmv).toBe(200 * K); // O1 line + returned O3
    expect(bySku.B.returnedOrders).toBe(1);
  });

  it('SKU without COGS has no profit and is flagged', () => {
    expect(bySku.C.hasCogs).toBe(false);
    expect(bySku.C.profit.value).toBeNull();
    expect(bySku.A.hasCogs).toBe(true);
  });

  it('growth is unknown (not zero) without a covered previous period', () => {
    expect(bySku.A.growth.percentageDelta).toBeNull();
    const withPrev = productPerformance(baseFixture(), { range: SEPT_1_2 }, { start: '2025-08-30', end: '2025-08-31' });
    expect(withPrev.rows[0].growth.previous).toBeNull();
  });

  it('per-SKU profit sums to the shop profit when every SKU has COGS and ads are declared none', () => {
    const ds = baseFixture();
    ds.costSettings = { skuCogs: { C: 60 * K }, platformFeeRate: { tiktok: 0.1 }, paymentFeeRate: { shopee: 0.02, tiktok: 0.02 }, noAdsDeclared: true };
    ds.orders = ds.orders.map((o) => (o.orderId === 'O3' ? { ...o, refundAmount: 100 * K } : o));
    const groups = computeProfitByGroup(sliceDataset(ds, { range: SEPT_1_2 }), (_o, l) => l.sku, { adsFor: () => [] });
    const total = [...groups.values()].reduce((s, p) => s + (p.profit.value || 0), 0);
    expect(total).toBeCloseTo(159.4 * K, 6);
  });

  it('answers "best product" per criterion on demo data', () => {
    const demo = buildDemoCanonicalDataset();
    const p = productPerformance(demo, { range: { start: '2025-09-01', end: '2025-09-30' } }, { start: '2025-08-01', end: '2025-08-31' });
    const leaders = productLeaders(p);
    expect(leaders.bestSelling?.sku).toBe('KHAN-UOT-100');
    expect(leaders.topProfit?.sku).toBe('SERUM-B5');
    expect(leaders.fastestGrowth?.sku).toBe('SERUM-B5');
    expect(applyShortcut(p, 'losing').map((r) => r.sku)).toContain('NOI-CHIEN-5L');
    expect(applyShortcut(p, 'losing').every((r) => (r.profit.value ?? 0) < 0)).toBe(true);
  });
});

describe('order health', () => {
  const h = orderHealth(baseFixture(), { range: SEPT_1_2 });
  it('counts the lifecycle and rates', () => {
    expect(h.lifecycle.total).toBe(4);
    expect(h.lifecycle.completed).toBe(1);
    expect(h.lifecycle.delivered).toBe(1);
    expect(h.lifecycle.cancelled).toBe(1);
    expect(h.lifecycle.returned).toBe(1);
    expect(h.cancelRate).toBeCloseTo(0.25, 10);
    expect(h.returnRate).toBeCloseTo(1 / 3, 10);
  });
  it('breaks down by reason, SKU, platform and date', () => {
    expect(h.cancelReasons).toEqual([{ reason: 'Đổi ý', count: 1, share: 1 }]);
    expect(h.withoutReason).toBe(1); // O3 returned without a reason
    expect(h.byPlatform.find((r) => r.key === 'tiktok')?.returned).toBe(1);
    expect(h.byDate).toHaveLength(2);
    expect(h.bySku.find((r) => r.key === 'A')?.cancelRate).toBeCloseTo(0.5, 10);
  });
});

describe('ads & live', () => {
  function adsDataset(cogs?: number) {
    return dataset(
      [order({ orderId: 'A1', orderDate: '2025-09-01', status: 'completed', platformFee: 10 * K, paymentFee: 0, shippingFeeSeller: 0, campaignId: 'C1' })],
      [line({ orderId: 'A1', sku: 'S', quantity: 1, grossAmount: 100 * K, unitCogs: cogs })],
      { ads: [{ date: '2025-09-01', platform: 'shopee', campaignId: 'C1', adName: 'Camp', sku: 'S', spend: 40 * K, clicks: 100, impressions: 5000, orders: 1, attributedRevenue: 100 * K }] },
    );
  }

  it('gives ROAS with break-even ROAS and profit after ads', () => {
    const s = adsSummary(adsDataset(50 * K), { range: { start: '2025-09-01', end: '2025-09-01' } });
    const r = s.rows[0];
    expect(r.roas).toBeCloseTo(2.5, 10);
    // margin before ads = (100 − 50 − 10) / 100 = 0.4 → break-even 2.5, profit after ads = 100×0.4 − 40 = 0
    expect(r.marginBeforeAds).toBeCloseTo(0.4, 10);
    expect(r.breakEvenRoas).toBeCloseTo(2.5, 10);
    expect(r.estimatedProfitAfterAds).toBeCloseTo(0, 6);
    expect(r.ctr).toBeCloseTo(0.02, 10);
    expect(r.cpa).toBe(40 * K);
  });

  it('does not estimate ad profit without COGS', () => {
    const r = adsSummary(adsDataset(undefined), { range: { start: '2025-09-01', end: '2025-09-01' } }).rows[0];
    expect(r.roas).toBeCloseTo(2.5, 10);
    expect(r.estimatedProfitAfterAds).toBeNull();
    expect(r.profitNote?.vi).toContain('chưa có giá vốn');
  });

  it('reports ads as unavailable when no ads data exists', () => {
    expect(adsSummary(baseFixture(), { range: SEPT_1_2 }).available).toBe(false);
  });

  it('flags a live session with more viewers but fewer orders', () => {
    const ds = dataset([], [], {
      liveSessions: [
        { sessionId: 'L1', platform: 'tiktok', date: '2025-09-01', viewers: 1000, orders: 30, gmv: 3_000_000, durationMinutes: 120 },
        { sessionId: 'L2', platform: 'tiktok', date: '2025-09-03', viewers: 1500, orders: 15, gmv: 1_500_000, durationMinutes: 120 },
      ],
    });
    const rows = liveSessions(ds, { range: { start: '2025-09-01', end: '2025-09-03' } });
    expect(rows[0].session.sessionId).toBe('L2');
    expect(rows[0].viewersUpOrdersDown).toBe(true);
    expect(rows[0].gmvPerHour).toBe(750_000);
    expect(rows[0].conversion).toBeCloseTo(0.01, 10);
  });
});

describe('smart alerts & daily brief on demo data', () => {
  const demo = buildDemoCanonicalDataset();
  const alerts = detectAlerts(demo, { day: '2025-09-29' });
  const types = alerts.map((a) => a.type);

  it('detects the built-in demo stories', () => {
    expect(types).toEqual(expect.arrayContaining(['sku_loss', 'ads_efficiency_drop', 'sku_cancel_spike', 'live_viewers_up_orders_down', 'growth_opportunity', 'missing_cogs']));
    expect(alerts.find((a) => a.type === 'sku_cancel_spike')?.sku).toBe('SON-LI-03');
    expect(alerts.find((a) => a.type === 'growth_opportunity')?.sku).toBe('SERUM-B5');
    expect(alerts.find((a) => a.type === 'sku_loss' && a.severity === 'critical')?.sku).toBe('NOI-CHIEN-5L');
  });

  it('orders alerts by severity', () => {
    const rank = { critical: 0, warning: 1, opportunity: 2, info: 3 };
    const ranks = alerts.map((a) => rank[a.severity]);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  it('uses plain, non-causal wording without statistical jargon', () => {
    for (const a of alerts) {
      const text = `${a.title.vi} ${a.message.vi} ${a.check.vi}`.toLowerCase();
      expect(text).not.toMatch(/gây ra|chắc chắn|z-score|độ lệch chuẩn|p-value/);
    }
  });

  it('evidence drill-down returns exactly the orders behind the number', () => {
    const spike = alerts.find((a) => a.type === 'sku_cancel_spike')!;
    const ev = spike.evidence[0];
    const { rows, total } = listEvidenceOrders(demo, ev.filter!);
    expect(total).toBeGreaterThan(0);
    expect(rows.every((r) => r.order.status === 'cancelled' || r.order.status === 'failed_delivery')).toBe(true);
    expect(rows.every((r) => r.lines.every((l) => l.sku === 'SON-LI-03'))).toBe(true);
    expect(total).toBe(Math.round((ev.current as number) * (ev.sampleSize as number)));
  });

  it('builds a brief with at most 3 items per section, each backed by evidence', () => {
    const brief = buildDailyBrief(demo, '2025-09-29');
    expect(brief.summary.vi).toContain('29/09');
    for (const section of [brief.positives, brief.concerns, brief.checks]) {
      expect(section.length).toBeGreaterThan(0);
      expect(section.length).toBeLessThanOrEqual(3);
    }
    for (const item of [...brief.positives, ...brief.concerns]) expect(item.evidence.length).toBeGreaterThan(0);
    expect(brief.headline.revenue.current).not.toBeNull();
  });

  it('explains a brief built on summary-only data', () => {
    const ds = dataset([], [], { dailyMetrics: [{ date: '2025-09-01', platform: 'shopee', paidGmv: 1 }, { date: '2025-09-02', platform: 'shopee', paidGmv: 2 }] });
    const brief = buildDailyBrief(ds, '2025-09-02');
    expect(brief.limitations.some((l) => l.vi.includes('file xuất đơn hàng'))).toBe(true);
    expect(brief.alerts).toEqual([]); // two days: no baseline yet
  });
});

describe('daily brief on summary reports', () => {
  // 7 typical days (1.000đ placed sales, 10 orders) then the day under review.
  const typical = Array.from({ length: 7 }, (_, i) => ({ date: `2025-09-0${i + 1}`, platform: 'shopee' as const, placedGmv: 1000, placedOrders: 10, cancelledOrders: 1, paidGmv: 800, paidOrders: 8 }));
  const withDay = (day: Partial<(typeof typical)[number]>) =>
    dataset([], [], { dailyMetrics: [...typical, { date: '2025-09-08', platform: 'shopee', placedGmv: 1000, placedOrders: 10, cancelledOrders: 1, paidGmv: 800, paidOrders: 8, ...day }] });

  it('keeps revenue and orders on placed orders and labels paid figures', () => {
    const brief = buildDailyBrief(withDay({ placedGmv: 950, paidGmv: 300, paidOrders: 3 }), '2025-09-08');
    expect(brief.stage?.vi).toBe('Đơn đặt');
    expect(brief.headline.revenue.current).toBe(950);
    expect(brief.headline.orders.current).toBe(10);
    expect(brief.paid?.revenue.current).toBe(300);
    expect(brief.summary.vi).toContain('Theo đơn đã thanh toán');
  });

  it('puts revenue more than 30% off its baseline under "Cần chú ý", either way, with a check', () => {
    for (const placedGmv of [600, 1400]) {
      const brief = buildDailyBrief(withDay({ placedGmv }), '2025-09-08');
      expect(brief.concerns[0].text.vi).toContain('trung bình 7 ngày trước');
      expect(brief.checks.length).toBeGreaterThan(0);
      expect(brief.positives.some((p) => p.text.vi.startsWith('Doanh thu'))).toBe(false);
    }
    // Within ±30%: no revenue concern.
    expect(buildDailyBrief(withDay({ placedGmv: 800 }), '2025-09-08').concerns).toEqual([]);
  });

  it('does not judge a rate on fewer than 30 orders', () => {
    const few = buildDailyBrief(withDay({ placedOrders: 16, cancelledOrders: 0 }), '2025-09-08');
    expect(few.positives.some((p) => p.text.vi.includes('Tỷ lệ hủy'))).toBe(false);
    expect(few.limitations.some((l) => l.vi.includes('dưới 30 đơn'))).toBe(true);
    const many = buildDailyBrief(withDay({ placedOrders: 40, cancelledOrders: 0 }), '2025-09-08');
    expect(many.positives.some((p) => p.text.vi.includes('Tỷ lệ hủy'))).toBe(true);
  });
});

describe('formatting', () => {
  it('formats Vietnamese money, rates and changes; missing → dash', () => {
    expect(fmtMoneyCompact(8_200_000)).toBe('8,2 triệu');
    expect(fmtMoneyCompact(1_250_000_000)).toBe('1,25 tỷ');
    expect(fmtMoneyCompact(-120_000)).toBe('−120k');
    expect(fmtMoneyCompact(null)).toBe('—');
    expect(fmtRate(0.092)).toBe('9,2%');
    expect(fmtChange(0.112)).toBe('↑ 11,2%');
    expect(fmtPp(2.7)).toBe('+2,7pp');
    expect(fmtPp(-0.03)).toBe('±0,0pp');
    expect(fmtChange(-0.0002)).toBe('→ 0,0%');
  });
});

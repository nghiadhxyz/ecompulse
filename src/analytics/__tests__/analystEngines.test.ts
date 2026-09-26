import { describe, expect, it } from 'vitest';
import { breakdown, weekStart, NONE_KEY, type BreakdownDimension } from '../breakdownEngine';
import { comboAnalytics, product360, productIntelligence } from '../productIntelligence';
import { compareFunnels, funnel, liveFunnel } from '../funnelEngine';
import { computeKpis } from '../kpiEngine';
import { subsidyDependence } from '../summaryInsights';
import { buildDemoCanonicalDataset } from '../../data/demoCanonicalDataset';
import { baseFixture, dataset, line, order, SEPT_1_2 } from './fixtures';

const demo = buildDemoCanonicalDataset();
const SEP = { start: '2025-09-01', end: '2025-09-30' };
const AUG = { start: '2025-08-01', end: '2025-08-31' };
const K = 1000;

describe('filters', () => {
  it('scopes traffic to the selected category (CVR is not shop-wide)', () => {
    const shop = computeKpis(demo, { range: SEP }).metrics;
    const beauty = computeKpis(demo, { range: SEP, categories: ['Làm đẹp'] }).metrics;
    expect(beauty.cvr.value).not.toBeNull();
    expect(Math.abs(beauty.cvr.value! - shop.cvr.value!)).toBeGreaterThan(1e-4);
    const expectedClicks = demo.traffic
      .filter((t) => t.date >= SEP.start && t.date <= SEP.end && t.sku && demo.products.find((p) => p.sku === t.sku)?.category === 'Làm đẹp')
      .reduce((s, t) => s + (t.productClicks || 0), 0);
    expect(beauty.cvr.value).toBeCloseTo(beauty.orders.value! / expectedClicks, 10);
  });

  it('filters by subcategory, campaign and live session', () => {
    const niche = computeKpis(demo, { range: SEP, subcategories: ['Tã bỉm'] }).metrics;
    expect(niche.gmv.value).toBeGreaterThan(0);
    const camp = computeKpis(demo, { range: SEP, campaignIds: ['ADS-TT-NOI'] }).metrics;
    expect(camp.orders.value).toBe(demo.orders.filter((o) => o.orderDate >= SEP.start && o.orderDate <= SEP.end && o.campaignId === 'ADS-TT-NOI').length);
    const s = demo.liveSessions.find((x) => x.date === '2025-09-27' && x.platform === 'tiktok')!;
    expect(computeKpis(demo, { range: SEP, liveSessionIds: [s.sessionId] }).metrics.orders.value).toBe(s.orders);
  });
});

describe('breakdown engine', () => {
  it('computes ISO week starts (Monday)', () => {
    expect(weekStart('2025-09-24')).toBe('2025-09-22'); // Wednesday
    expect(weekStart('2025-09-22')).toBe('2025-09-22'); // Monday
    expect(weekStart('2025-09-28')).toBe('2025-09-22'); // Sunday
  });

  it.each<BreakdownDimension>(['platform', 'category', 'subcategory', 'sku', 'combo', 'campaign', 'liveSession', 'channel', 'week', 'month'])(
    'GMV of every %s member adds up to the shop GMV',
    (dim) => {
      const b = breakdown(demo, { range: SEP }, dim, AUG);
      const shopGmv = computeKpis(demo, { range: SEP }).metrics.gmv.value!;
      expect(b.rows.reduce((s, r) => s + r.current.gmv, 0)).toBeCloseTo(shopGmv, 4);
    },
  );

  it('order-level dimensions add up to the shop order count; contributions sum to 100%', () => {
    const b = breakdown(demo, { range: SEP }, 'platform', AUG);
    const shop = computeKpis(demo, { range: SEP }).metrics;
    expect(b.rows.reduce((s, r) => s + r.current.placed, 0)).toBe(shop.orders.value);
    expect(b.rows.reduce((s, r) => s + (r.gmvContribution ?? 0), 0)).toBeCloseTo(1, 10);
    const aug = computeKpis(demo, { range: AUG }).metrics.gmv.value!;
    expect(b.totalGmvDelta).toBeCloseTo(shop.gmv.value! - aug, 4);
  });

  it('labels members and the "none" bucket', () => {
    const b = breakdown(demo, { range: SEP }, 'campaign');
    expect(b.rows.find((r) => r.key === NONE_KEY)?.label).toBe('Không qua quảng cáo');
    expect(breakdown(demo, { range: SEP }, 'platform').rows.map((r) => r.label)).toEqual(expect.arrayContaining(['Shopee', 'TikTok Shop', 'Lazada']));
  });

  it('drill-down: category → niche → SKU stays consistent', () => {
    const cat = breakdown(demo, { range: SEP }, 'category').rows.find((r) => r.key === 'Mẹ & Bé')!;
    const niches = breakdown(demo, { range: SEP, categories: ['Mẹ & Bé'] }, 'subcategory').rows;
    expect(niches.reduce((s, r) => s + r.current.gmv, 0)).toBeCloseTo(cat.current.gmv, 4);
    const skus = breakdown(demo, { range: SEP, categories: ['Mẹ & Bé'], subcategories: ['Tã bỉm'] }, 'sku').rows;
    const niche = niches.find((r) => r.key === 'Tã bỉm')!;
    expect(skus.reduce((s, r) => s + r.current.gmv, 0)).toBeCloseTo(niche.current.gmv, 4);
  });

  it('reports categories as unavailable when products have none', () => {
    const b = breakdown(baseFixture(), { range: SEPT_1_2 }, 'category');
    expect(b.unavailable).toBeUndefined(); // fixture has categories
    const noCat = baseFixture();
    noCat.products = noCat.products.map((p) => ({ ...p, category: undefined }));
    expect(breakdown(noCat, { range: SEPT_1_2 }, 'category').unavailable?.vi).toContain('ngành hàng');
  });

  it('attributes ads per SKU in the profit column', () => {
    const noi = breakdown(demo, { range: SEP }, 'sku').rows.find((r) => r.key === 'NOI-CHIEN-5L')!;
    expect(noi.current.profit).toBeLessThan(0);
  });
});

describe('product intelligence', () => {
  const pi = productIntelligence(demo, { range: SEP }, AUG);
  const by = Object.fromEntries(pi.rows.map((r) => [r.row.key, r]));

  it('classifies with reasons', () => {
    expect(by['NOI-CHIEN-5L'].classification).toBe('reconsider');
    expect(by['SERUM-VC'].classification).toBe('investigate'); // no COGS
    expect(by['SERUM-B5'].classification).toBe('scale');
    for (const r of pi.rows) expect(r.reasons.length).toBeGreaterThan(0);
    const total = Object.values(pi.counts).reduce((s, n) => s + n, 0);
    expect(total).toBe(pi.rows.length);
  });

  it('assigns ABC by cumulative GMV share', () => {
    const shares = pi.rows.map((r) => r.cumulativeShare);
    expect([...shares].sort((a, b) => a - b)).toEqual(shares);
    expect(pi.rows[0].abc).toBe('A');
    expect(pi.rows[pi.rows.length - 1].abc).toBe('C');
  });

  it('zombie detection needs traffic data', () => {
    expect(pi.trafficAvailable).toBe(true);
    const noTraffic = productIntelligence(baseFixture(), { range: SEPT_1_2 });
    expect(noTraffic.rows.every((r) => r.isZombie === null)).toBe(true);
  });

  it('product 360 bundles comparison, mix, ads and channel', () => {
    const p = product360(demo, { range: SEP }, 'SERUM-B5', 'mom', by['SERUM-B5']);
    expect(p.comparison.previousRange).toEqual(AUG);
    expect(p.series).toHaveLength(30);
    expect(p.ads.length).toBeGreaterThan(0);
    expect(p.byPlatform.reduce((s, r) => s + r.current.gmv, 0)).toBeCloseTo(p.comparison.current.metrics.gmv.value!, 4);
  });
});

describe('combo analytics', () => {
  it('compares combos with their component SKUs sold singly', () => {
    const { rows, available } = comboAnalytics(demo, { range: SEP }, AUG);
    expect(available).toBe(true);
    const ta = rows.find((r) => r.comboId === 'COMBO-TA-KHAN')!;
    expect(ta.components).toEqual(['TA-BIM-M', 'KHAN-UOT-100']);
    expect(ta.comboBasket).toBeGreaterThan(0);
    expect(ta.singles.basket).toBeGreaterThan(0);
    expect(ta.marginDiffPp).not.toBeNull();
  });

  it('is unavailable without combos', () => {
    expect(comboAnalytics(baseFixture(), { range: SEPT_1_2 }).available).toBe(false);
  });
});

describe('funnel engine', () => {
  it('builds the demo funnel and skips stages without data', () => {
    const f = funnel(demo, { range: SEP });
    expect(f.stages.views).toBeNull();
    expect(f.missing).toContain('views');
    expect(f.stages.impressions!).toBeGreaterThan(f.stages.clicks!);
    expect(f.stages.clicks!).toBeGreaterThanOrEqual(f.stages.addToCart!);
    expect(f.stages.orders!).toBeGreaterThanOrEqual(f.stages.paid!);
    const first = f.steps[0];
    expect(first.from).toBe('impressions');
    expect(first.to).toBe('clicks');
    expect(first.skipped).toEqual(['views']);
    expect(f.biggestLeak).not.toBeNull();
    expect(f.biggestLeak!.from).not.toBe('impressions'); // top-of-funnel CTR is excluded
    expect(f.biggestLeak!.rate).toBe(Math.min(...f.steps.filter((s) => s.from !== 'impressions').map((s) => s.rate!)));
  });

  it('computes step rates exactly on a small fixture', () => {
    const ds = dataset(
      [order({ orderId: 'a', orderDate: '2025-09-01', status: 'completed' }), order({ orderId: 'b', orderDate: '2025-09-01', status: 'cancelled' })],
      [line({ orderId: 'a', sku: 'X', quantity: 1, grossAmount: 10 * K }), line({ orderId: 'b', sku: 'X', quantity: 1, grossAmount: 10 * K })],
      { traffic: [{ date: '2025-09-01', platform: 'shopee', sku: 'X', impressions: 1000, productClicks: 50, addToCart: 10 }] },
    );
    const f = funnel(ds, { range: { start: '2025-09-01', end: '2025-09-01' } });
    expect(f.stages).toEqual({ impressions: 1000, views: null, clicks: 50, addToCart: 10, orders: 2, paid: 1, completed: 1 });
    expect(f.steps.map((s) => s.rate)).toEqual([0.05, 0.2, 0.2, 0.5, 1]);
    expect(f.biggestLeak?.from).toBe('clicks'); // first of the tied 20% steps after the click
  });

  it('compares funnels in percentage points and builds a live funnel', () => {
    const cur = funnel(demo, { range: SEP });
    const prev = funnel(demo, { range: AUG });
    const cmp = compareFunnels(cur, prev);
    expect(cmp.stepChangesPp.length).toBe(cur.steps.length);
    const live = liveFunnel(demo, SEP, ['tiktok']);
    expect(live.stages.impressions).toBeGreaterThan(live.stages.clicks!);
    expect(live.stages.orders).toBeGreaterThanOrEqual(live.stages.paid!);
  });

  it('summary-only data gives an order-only funnel', () => {
    const ds = dataset([], [], { dailyMetrics: [{ date: '2025-09-01', platform: 'shopee', placedOrders: 10, paidOrders: 8, productClicks: 200 }] });
    const f = funnel(ds, { range: { start: '2025-09-01', end: '2025-09-01' } });
    expect(f.stages.clicks).toBe(200);
    expect(f.stages.orders).toBe(10);
    expect(f.stages.completed).toBeNull();
  });
});

describe('summary reports that disagree with themselves', () => {
  const RANGE = { start: '2025-09-01', end: '2025-09-03' };
  const ds = dataset([], [], {
    dailyMetrics: [
      { date: '2025-09-01', platform: 'shopee', placedGmv: 1000, placedNoSubsidyGmv: 800, placedOrders: 10, paidGmv: 900, paidOrders: 9, paidRefundedGmv: 10 },
      // Impossible: sales excluding subsidy above sales (negative subsidy).
      { date: '2025-09-02', platform: 'shopee', placedGmv: 500, placedNoSubsidyGmv: 600, placedOrders: 5, paidGmv: 450, paidOrders: 4, paidRefundedGmv: 0 },
      { date: '2025-09-03', platform: 'shopee', placedGmv: 1000, placedNoSubsidyGmv: 900, placedOrders: 10, paidGmv: 950, paidOrders: 9, paidRefundedGmv: 5 },
    ],
    periodTotals: [
      { platform: 'shopee', start: '2025-09-01', end: '2025-09-03', stage: 'placed', gmv: 3000, noSubsidyGmv: 2300, orders: 25, cancelledGmv: 100, refundedGmv: 20 },
      { platform: 'shopee', start: '2025-09-01', end: '2025-09-03', stage: 'paid', gmv: 2290, orders: 22, refundedGmv: 12 },
    ],
  });

  it('leaves days with a negative subsidy out instead of drawing them below zero', () => {
    const s = subsidyDependence(ds, { range: RANGE });
    expect(s.invalidDays).toEqual(['2025-09-02']);
    expect(s.points.find((p) => p.key === '2025-09-02')!.share).toBeNull();
    expect(s.points.every((p) => p.share === null || p.share >= 0)).toBe(true);
    expect(s.warnings[0].vi).toContain('Dữ liệu không hợp lệ ở 1 ngày (02/09)');
    // Part of the period: no period row, total from the valid days only.
    const part = subsidyDependence(ds, { range: { start: '2025-09-01', end: '2025-09-02' } });
    expect(part.total!.gmv).toBe(1000);
    expect(part.total!.subsidy).toBe(200);
  });

  it('warns when the period row and the days give different placed sales', () => {
    const s = subsidyDependence(ds, { range: RANGE });
    expect(s.total!.gmv).toBe(3000);
    expect(s.warnings.some((w) => w.vi.includes('3.000 theo dòng tổng, 2.500 khi cộng ngày'))).toBe(true);
  });

  it('platform table uses the same period totals as the KPI cards', () => {
    const row = breakdown(ds, { range: RANGE }, 'platform').rows[0];
    const kpi = computeKpis(ds, { range: RANGE }).metrics;
    expect(row.current.gmv).toBe(3000); // placed period row, not the 2.500 sum of days
    expect(row.current.gmv).toBe(kpi.gmv.value);
    expect(row.current.netRevenue).toBe(3000 - 100 - 20);
    expect(row.current.netRevenue).toBe(kpi.netRevenue.value);
  });
});

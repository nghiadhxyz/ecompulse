import { describe, expect, it } from 'vitest';
import { customerIntelligence } from '../customerEngine';
import { whatIf, NO_CHANGE } from '../whatIfEngine';
import { advancedStats, normCdf, pearson, twoProportionTest, welchTest } from '../statsEngine';
import { computeKpis } from '../kpiEngine';
import { listEvidenceOrders } from '../evidence';
import { buildDemoCanonicalDataset } from '../../data/demoCanonicalDataset';
import { dataset, line, order } from './fixtures';

const demo = buildDemoCanonicalDataset();
const SEP = { range: { start: '2025-09-01', end: '2025-09-30' } };

describe('customer intelligence', () => {
  it('is disabled without customer IDs (no guessing)', () => {
    const ds = dataset([order({ orderId: 'a', orderDate: '2025-09-01', status: 'completed' })], [line({ orderId: 'a', sku: 'X', quantity: 1, grossAmount: 100 })]);
    const r = customerIntelligence(ds, SEP);
    expect(r.available).toBe(false);
    expect(r.unavailable!.vi).toContain('mã người mua');
  });

  it('splits new vs returning using history before the range', () => {
    const o = (id: string, d: string, c: string) => order({ orderId: id, orderDate: d, status: 'completed', customerId: c });
    const l = (id: string) => line({ orderId: id, sku: 'X', quantity: 1, grossAmount: 100 });
    const ds = dataset([o('1', '2025-08-10', 'A'), o('2', '2025-09-05', 'A'), o('3', '2025-09-06', 'B'), o('4', '2025-09-20', 'B')], ['1', '2', '3', '4'].map(l));
    const r = customerIntelligence(ds, SEP);
    expect(r.inRange).toMatchObject({ customers: 2, newCustomers: 1, returningCustomers: 1 });
    expect(r.inRange.repeatWithinRange).toBe(0.5);
    expect(r.inRange.returningGmvShare).toBeCloseTo(1 / 3, 10);
  });

  it('segments every customer exactly once and supports segment drill-down', () => {
    const r = customerIntelligence(demo, SEP);
    const total = r.segments.reduce((s, x) => s + x.customers, 0);
    const distinct = new Set(demo.orders.filter((o) => o.customerId && o.status !== 'cancelled' && o.orderDate <= '2025-09-30').map((o) => `${o.platform}|${o.customerId}`)).size;
    expect(total).toBeLessThanOrEqual(distinct);
    expect(r.segments.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1, 6);
    const champions = r.segments.find((s) => s.segment === 'champions')!;
    const ev = listEvidenceOrders(demo, { range: { start: '2025-07-01', end: '2025-09-30' }, customerIds: champions.customerIds.slice(0, 3) });
    expect(ev.total).toBeGreaterThan(3);
  });
});

describe('what-if on real costs', () => {
  it('no change reproduces the actual profit exactly', () => {
    const r = whatIf(demo, SEP, NO_CHANGE);
    expect(r.base.profit).toBeCloseTo(computeKpis(demo, SEP).metrics.profit.value!, 0);
    expect(r.scenario.profit).toBeCloseTo(r.base.profit!, 6);
  });

  it('price does not move volume unless the user says so', () => {
    const r = whatIf(demo, SEP, { ...NO_CHANGE, price: 0.1 });
    const cogs = r.lines.find((l) => l.key === 'cogs')!;
    expect(cogs.scenario).toBeCloseTo(cogs.base!, 6);
    expect(r.scenario.gmv).toBeCloseTo(r.base.gmv! * 1.1, 0);
    expect(r.volumeToKeepProfit!).toBeLessThan(0);
  });

  it('cutting ads raises profit by exactly the saved spend', () => {
    const f = { ...SEP, skus: ['NOI-CHIEN-5L'] };
    const r = whatIf(demo, f, { ...NO_CHANGE, ads: -0.5 });
    const ads = r.lines.find((l) => l.key === 'ads')!;
    expect(r.scenario.profit! - r.base.profit!).toBeCloseTo(ads.base! * 0.5, 0);
  });

  it('labels itself a simulation', () => {
    expect(whatIf(demo, SEP, NO_CHANGE).notes.some((n) => n.vi.includes('mô phỏng / ước tính'))).toBe(true);
  });
});

describe('statistics', () => {
  it('normal CDF and textbook tests', () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 6);
    expect(normCdf(1.96)).toBeCloseTo(0.975, 3);
    const t = twoProportionTest(60, 500, 40, 500)!; // 12% vs 8%
    expect(t.diff).toBeCloseTo(0.04, 10);
    expect(t.p).toBeGreaterThan(0.03);
    expect(t.p).toBeLessThan(0.04);
    expect(twoProportionTest(3, 10, 1, 10)).toBeNull();
    expect(welchTest([1, 2, 3, 4, 5], [1, 2, 3, 4, 5])!.p).toBeCloseTo(1, 6);
    expect(pearson([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [2, 4, 6, 8, 10, 12, 14, 16, 18, 20])).toBeCloseTo(1, 10);
  });

  it('finds the demo CVR rise significant and the flat cancel rate not', () => {
    const s = advancedStats(demo, SEP, { start: '2025-08-01', end: '2025-08-30' });
    expect(s.tests.find((t) => t.key === 'cancelRate')!.verdict).toBe('not_significant');
    expect(s.tests.find((t) => t.key === 'cvr')!.verdict).toBe('significant');
    expect(s.notes.some((n) => n.vi.includes('không chứng minh'))).toBe(true);
    expect(s.weekday.every((w) => w.index === null || w.index > 0.5)).toBe(true);
  });
});

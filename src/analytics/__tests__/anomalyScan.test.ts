import { describe, expect, it } from 'vitest';
import { anomalyScan, findOpportunities } from '../anomalyScan';
import { buildDemoCanonicalDataset } from '../../data/demoCanonicalDataset';
import { dataset, line, order } from './fixtures';

const demo = buildDemoCanonicalDataset();

describe('anomaly scan', () => {
  it('flags the double days and marks them as sale days (expected spikes)', () => {
    const r = anomalyScan(demo, { range: { start: '2025-08-01', end: '2025-09-30' } }, 'gmv');
    expect(r.flagged.map((p) => p.date)).toEqual(['2025-08-08', '2025-09-09']);
    expect(r.flagged.every((p) => p.saleDay && p.direction === 'up')).toBe(true);
  });

  it('excludes sale days from the baseline and needs 7 days of history', () => {
    const r = anomalyScan(demo, { range: { start: '2025-07-01', end: '2025-07-10' } }, 'gmv');
    expect(r.points[0].score).toBeNull(); // first day: no history
    const p10 = r.points.find((p) => p.date === '2025-07-10')!;
    expect(p10.sampleDays).toBeGreaterThanOrEqual(7);
    expect(p10.sampleDays).toBeLessThan(9); // 7.7 excluded
  });

  it('detects a sudden drop on a normal day', () => {
    const orders = [];
    const lines = [];
    for (let d = 1; d <= 20; d++) {
      const date = `2025-06-${String(d).padStart(2, '0')}`;
      const n = d === 20 ? 2 : 10;
      for (let i = 0; i < n; i++) {
        const id = `${date}-${i}`;
        orders.push(order({ orderId: id, orderDate: date, status: 'completed' }));
        lines.push(line({ orderId: id, sku: 'A', quantity: 1, grossAmount: 100 }));
      }
    }
    const r = anomalyScan(dataset(orders, lines), { range: { start: '2025-06-10', end: '2025-06-20' } }, 'orders');
    expect(r.flagged.map((p) => p.date)).toEqual(['2025-06-20']);
    expect(r.flagged[0].direction).toBe('down');
  });
});

describe('opportunities', () => {
  const ops = findOpportunities(demo, { range: { start: '2025-09-01', end: '2025-09-30' } }, { start: '2025-08-01', end: '2025-08-30' });
  it('finds SERUM-B5 growing faster than its exposure', () => {
    const o = ops.find((x) => x.kind === 'efficiency_growth')!;
    expect(o.sku).toBe('SERUM-B5');
    expect(o.metrics.gmvChange!).toBeGreaterThan(o.metrics.clicksChange! * 2);
    expect(o.message.vi).toContain('tăng nhanh hơn lượt tiếp cận');
  });
  it('does not flag every small SKU as an opportunity', () => {
    expect(ops.length).toBeLessThanOrEqual(4);
  });
});

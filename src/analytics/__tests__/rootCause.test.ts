import { describe, expect, it } from 'vitest';
import { rootCause } from '../rootCauseEngine';
import { computeKpis } from '../kpiEngine';
import { buildDemoCanonicalDataset } from '../../data/demoCanonicalDataset';
import { dataset, line, order } from './fixtures';

const demo = buildDemoCanonicalDataset();
const SEP = { range: { start: '2025-09-01', end: '2025-09-30' } };
const AUG = { start: '2025-08-01', end: '2025-08-30' };

describe('root cause — additive metrics', () => {
  const r = rootCause(demo, SEP, AUG, 'gmv');

  it('contributions at every level add up exactly to the level total', () => {
    expect(r.change).toBeCloseTo(r.current! - r.previous!, 6);
    const top = r.tree[0].nodes.reduce((s, n) => s + n.contribution, 0);
    expect(top).toBeCloseTo(r.change!, 2);
    // each deeper level sums to the change of the member chosen above it
    for (let i = 1; i < r.tree.length; i++) {
      const parent = r.tree[i - 1].nodes[0];
      const sum = r.tree[i].nodes.reduce((s, n) => s + n.contribution, 0);
      expect(sum).toBeCloseTo(parent.current! - parent.previous!, 2);
    }
  });

  it('follows the biggest contributor down to the SKU', () => {
    expect(r.tree.map((l) => l.dimension)).toEqual(['platform', 'category', 'subcategory', 'sku']);
    expect(r.path[r.path.length - 1].label).toContain('Nồi chiên');
    expect(r.concentration.find((c) => c.dimension === 'campaign')?.nodes[0].label).toContain('GMV Max');
  });

  it('decomposes GMV into traffic × conversion × retention × basket (sums to ΔGMV)', () => {
    expect(r.drivers).not.toBeNull();
    const sum = r.drivers!.reduce((s, d) => s + (d.contribution ?? 0), 0);
    expect(sum).toBeCloseTo(r.change!, 2);
  });

  it('never labels anything a proven cause', () => {
    expect(r.notes.some((n) => n.vi.includes('không chứng minh NGUYÊN NHÂN'))).toBe(true);
    const roles = r.tree.flatMap((l) => l.nodes.map((n) => n.role));
    expect(roles.every((x) => ['main', 'contributing', 'minor', 'offsetting'].includes(x))).toBe(true);
  });
});

describe('root cause — rates', () => {
  it('platform contributions sum exactly to the cancel-rate change (mix + rate effect)', () => {
    const cur = { range: { start: '2025-09-20', end: '2025-09-29' } };
    const prev = { start: '2025-09-06', end: '2025-09-15' };
    const r = rootCause(demo, cur, prev, 'cancelRate');
    const k1 = computeKpis(demo, cur).metrics.cancelRate.value!;
    const k0 = computeKpis(demo, { range: prev }).metrics.cancelRate.value!;
    expect(r.change).toBeCloseTo(k1 - k0, 10);
    expect(r.tree[0].dimension).toBe('platform');
    expect(r.tree[0].nodes.reduce((s, n) => s + n.contribution, 0)).toBeCloseTo(k1 - k0, 10);
  });

  it('handles the exact textbook case', () => {
    // shopee: 1/10 → 3/10 cancels, tiktok 1/10 → 1/10: total 2/20 → 4/20 = +10pp, all from shopee
    const orders = [];
    const lines = [];
    let n = 0;
    const add = (date: string, platform: 'shopee' | 'tiktok', cancelled: boolean) => {
      n++;
      orders.push(order({ orderId: `o${n}`, orderDate: date, platform, status: cancelled ? 'cancelled' : 'completed' }));
      lines.push(line({ orderId: `o${n}`, sku: 'A', quantity: 1, grossAmount: 100 }));
    };
    for (let i = 0; i < 10; i++) {
      add('2025-09-01', 'shopee', i < 1);
      add('2025-09-01', 'tiktok', i < 1);
      add('2025-09-02', 'shopee', i < 3);
      add('2025-09-02', 'tiktok', i < 1);
    }
    const ds = dataset(orders, lines);
    const r = rootCause(ds, { range: { start: '2025-09-02', end: '2025-09-02' } }, { start: '2025-09-01', end: '2025-09-01' }, 'cancelRate');
    expect(r.change).toBeCloseTo(0.1, 10);
    const shopee = r.tree[0].nodes.find((x) => x.key === 'shopee')!;
    expect(shopee.contribution).toBeCloseTo(0.1, 10);
    expect(shopee.role).toBe('main');
    expect(r.tree[0].nodes.find((x) => x.key === 'tiktok')!.contribution).toBeCloseTo(0, 10);
  });

  it('flags very small changes as noise', () => {
    const r = rootCause(demo, { range: { start: '2025-09-20', end: '2025-09-29' } }, { start: '2025-09-10', end: '2025-09-19' }, 'cancelRate');
    expect(Math.abs(r.change!)).toBeLessThan(0.002);
    expect(r.notes[0].vi).toContain('Thay đổi rất nhỏ');
  });

  it('reports insufficient data instead of guessing', () => {
    const r = rootCause(demo, SEP, { start: '2025-05-01', end: '2025-05-30' }, 'gmv');
    expect(r.unavailable?.vi).toContain('Kỳ so sánh chưa có dữ liệu');
  });
});

import { describe, expect, it } from 'vitest';
import { compareMetric, comparePeriods, compareValues } from '../comparisonEngine';
import { computeContribution, contributionBetween } from '../contributionEngine';
import { missing, ok } from '../metric';
import { dataset, line, order } from './fixtures';
import type { Order, OrderLine } from '../model';

describe('comparison engine', () => {
  it('distinguishes percentage points from relative change (CVR 4.2% → 4.6%)', () => {
    const r = compareValues(0.046, 0.042, 'ratio');
    expect(r.direction).toBe('up');
    expect(r.percentagePointDelta).toBeCloseTo(0.4, 10);
    expect(r.percentageDelta).toBeCloseTo(0.0952381, 6);
    expect(r.absoluteDelta).toBeCloseTo(0.004, 10);
  });

  it('computes MoM growth for amounts and omits pp for non-rates', () => {
    const r = compareValues(8_200_000, 7_374_100, 'vnd');
    expect(r.percentageDelta).toBeCloseTo(0.112, 3);
    expect(r).not.toHaveProperty('percentagePointDelta');
  });

  it('returns null % change when the previous value is zero', () => {
    expect(compareValues(100, 0, 'vnd').percentageDelta).toBeNull();
    expect(compareValues(0, 0, 'vnd').percentageDelta).toBe(0);
  });

  it('uses |previous| so a smaller loss reads as improvement', () => {
    const r = compareValues(-50, -100, 'vnd');
    expect(r.direction).toBe('up');
    expect(r.percentageDelta).toBeCloseTo(0.5, 10);
  });

  it('explains a missing previous period', () => {
    const c = compareMetric(ok(10, 'vnd'), missing('vnd', { vi: 'x', en: 'x' }));
    expect(c.percentageDelta).toBeNull();
    expect(c.direction).toBe('unknown');
    expect(c.notes[0].vi).toContain('kỳ trước');
  });

  it('compares month-to-date with the same days of last month', () => {
    const orders: Order[] = [];
    const lines: OrderLine[] = [];
    const add = (id: string, date: string, gross: number) => {
      orders.push(order({ orderId: id, orderDate: date, status: 'completed' }));
      lines.push(line({ orderId: id, sku: 'A', quantity: 1, grossAmount: gross }));
    };
    add('a1', '2025-08-05', 100);
    add('a2', '2025-08-20', 900); // outside 01–15/08, must not be compared
    add('s1', '2025-09-05', 150);
    add('s2', '2025-09-15', 50);
    const cmp = comparePeriods(dataset(orders, lines), { range: { start: '2025-09-01', end: '2025-09-15' } }, 'mom');
    expect(cmp.previousRange).toEqual({ start: '2025-08-01', end: '2025-08-15' });
    expect(cmp.metrics.gmv.current).toBe(200);
    expect(cmp.metrics.gmv.previous).toBe(100);
    expect(cmp.metrics.gmv.percentageDelta).toBeCloseTo(1, 10);
  });
});

describe('contribution engine', () => {
  it('decomposes +30M into platform contributions (negative contributor handled)', () => {
    const r = computeContribution(
      { tiktok: 72, shopee: 61, lazada: 7 },
      { tiktok: 50, shopee: 50, lazada: 10 },
    );
    expect(r.totalDelta).toBe(30);
    const byKey = Object.fromEntries(r.items.map((i) => [i.key, i]));
    expect(byKey.tiktok.delta).toBe(22);
    expect(byKey.shopee.delta).toBe(11);
    expect(byKey.lazada.delta).toBe(-3);
    expect(byKey.lazada.shareOfChange).toBeCloseTo(-0.1, 10);
    expect(r.items.reduce((s, i) => s + (i.shareOfChange || 0), 0)).toBeCloseTo(1, 10);
    expect(r.items[0].key).toBe('tiktok'); // sorted by |delta|
    expect(r.positiveDelta).toBe(33);
    expect(r.negativeDelta).toBe(-3);
  });

  it('includes keys that only exist in one period', () => {
    const r = computeContribution({ newSku: 10 }, { oldSku: 4 });
    expect(r.items.find((i) => i.key === 'oldSku')?.delta).toBe(-4);
    expect(r.totalDelta).toBe(6);
  });

  it('share of change is null when the total is flat; movement share still works', () => {
    const r = computeContribution({ a: 15, b: 5 }, { a: 10, b: 10 });
    expect(r.totalDelta).toBe(0);
    expect(r.items.every((i) => i.shareOfChange === null)).toBe(true);
    expect(r.items.find((i) => i.key === 'a')?.shareOfMovement).toBeCloseTo(0.5, 10);
  });

  it('aggregates GMV by platform and category from orders', () => {
    const ds = dataset(
      [
        order({ orderId: 'p1', orderDate: '2025-08-01', status: 'completed', platform: 'shopee' }),
        order({ orderId: 'c1', orderDate: '2025-09-01', status: 'completed', platform: 'shopee' }),
        order({ orderId: 'c2', orderDate: '2025-09-01', status: 'completed', platform: 'tiktok' }),
        order({ orderId: 'c3', orderDate: '2025-09-01', status: 'cancelled', platform: 'tiktok' }),
      ],
      [
        line({ orderId: 'p1', sku: 'A', quantity: 1, grossAmount: 100 }),
        line({ orderId: 'c1', sku: 'A', quantity: 1, grossAmount: 80 }),
        line({ orderId: 'c2', sku: 'B', quantity: 1, grossAmount: 50 }),
        line({ orderId: 'c3', sku: 'B', quantity: 1, grossAmount: 999 }),
      ],
      { products: [{ sku: 'A', category: 'Mẹ & Bé' }, { sku: 'B', category: 'Làm đẹp' }] },
    );
    const cur = { range: { start: '2025-09-01', end: '2025-09-01' } };
    const prev = { range: { start: '2025-08-01', end: '2025-08-01' } };
    const byPlatform = contributionBetween(ds, cur, prev, 'platform', 'gmv');
    expect(byPlatform.totalDelta).toBe(30);
    expect(byPlatform.items.find((i) => i.key === 'tiktok')?.delta).toBe(50);
    const byCat = contributionBetween(ds, cur, prev, 'category', 'gmv');
    expect(byCat.items.find((i) => i.key === 'Mẹ & Bé')?.delta).toBe(-20);
    const cancels = contributionBetween(ds, cur, prev, 'platform', 'cancelledOrders');
    expect(cancels.items.find((i) => i.key === 'tiktok')?.current).toBe(1);
  });
});

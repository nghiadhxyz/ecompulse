import { describe, expect, it } from 'vitest';
import { moneyTolerance, ORDER_TOLERANCE, periodMismatches, selectPeriodOrDaily } from '../periodRows';

type Row = { date: string; periodStart?: string; key: string; gmv?: number; orders?: number };
const FULL = { start: '2026-07-01', end: '2026-07-02' };
const rows = (periodGmv: number, periodOrders: number, dayGmv: [number, number], dayOrders: [number, number]): Row[] => [
  { date: '2026-07-02', periodStart: '2026-07-01', key: 'a', gmv: periodGmv, orders: periodOrders },
  { date: '2026-07-01', key: 'a', gmv: dayGmv[0], orders: dayOrders[0] },
  { date: '2026-07-02', key: 'a', gmv: dayGmv[1], orders: dayOrders[1] },
];
const check = (r: Row[]) =>
  periodMismatches(r, FULL, (x) => x.key, [
    { key: 'gmv', pick: (x) => x.gmv, tolerance: moneyTolerance },
    { key: 'orders', pick: (x) => x.orders, tolerance: ORDER_TOLERANCE },
  ]).map((m) => m.field);

describe('period vs daily rows', () => {
  it('uses the period row for the whole period and daily rows otherwise', () => {
    const r = rows(100, 3, [40, 60], [1, 2]);
    expect(selectPeriodOrDaily(r, FULL, (x) => x.key).map((x) => x.periodStart ?? x.date)).toEqual(['2026-07-01']);
    expect(selectPeriodOrDaily(r, { start: '2026-07-02', end: '2026-07-02' }, (x) => x.key)).toEqual([r[2]]);
  });

  it('money: warns only beyond ±2đ and ±0,01%', () => {
    expect(check(rows(10_000, 3, [5_000, 5_002], [1, 2]))).toEqual([]); // 2đ
    expect(check(rows(10_000, 3, [5_000, 5_003], [1, 2]))).toEqual(['gmv']); // 3đ > max(2, 1)
    expect(check(rows(100_000_000, 3, [50_000_000, 50_010_000], [1, 2]))).toEqual([]); // 10.000đ = 0,01%
    expect(check(rows(100_000_000, 3, [50_000_000, 50_010_001], [1, 2]))).toEqual(['gmv']);
  });

  it('orders: warns only beyond ±0,05', () => {
    expect(check(rows(100, 391.5, [40, 60], [200, 191.54]))).toEqual([]); // 0,04
    expect(check(rows(100, 391.5, [40, 60], [200, 191.56]))).toEqual(["orders"]); // 0,06
  });
});

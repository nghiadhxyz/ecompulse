import { describe, expect, it } from 'vitest';
import { computeKpis } from '../kpiEngine';
import { normalizeOrderStatus } from '../status';
import { safeDivide } from '../metric';
import { baseFixture, dataset, line, order, SEPT_1_2 } from './fixtures';

const K = 1000;

describe('order status normalization', () => {
  it.each([
    ['Đã hủy', 'cancelled'],
    ['Hoàn thành', 'completed'],
    ['Đã giao', 'delivered'],
    ['Giao hàng thành công', 'delivered'],
    ['Giao không thành công', 'failed_delivery'],
    ['Trả hàng/Hoàn tiền', 'returned'],
    ['Đã hoàn tiền', 'refunded'],
    ['Đang giao', 'shipped'],
    ['Chờ lấy hàng', 'paid'],
    ['Chờ xác nhận', 'placed'],
    ['Awaiting shipment', 'paid'],
    ['In transit', 'shipped'],
    ['Cancelled', 'cancelled'],
    ['canceled', 'cancelled'],
    ['Completed', 'completed'],
    ['ready_to_ship', 'paid'],
    ['Chờ vận chuyển', 'paid'],
    ['Đang vận chuyển', 'shipped'],
    ['Yêu cầu hủy', 'cancelled'],
    ['Hủy bởi người mua', 'cancelled'],
    ['Đã hoàn thành', 'completed'],
    ['packed', 'paid'],
    ['Package Returned', 'returned'],
    ['Shipped back', 'returned'],
    ['failed delivery', 'failed_delivery'],
    ['Unpaid', 'placed'],
    ['', 'unknown'],
    ['Xyz lạ', 'unknown'],
  ])('%s → %s', (raw, expected) => {
    expect(normalizeOrderStatus(raw)).toBe(expected);
  });
});

describe('safeDivide', () => {
  it('returns null on zero or non-finite denominators', () => {
    expect(safeDivide(1, 0)).toBeNull();
    expect(safeDivide(1, Number.NaN)).toBeNull();
    expect(safeDivide(0, 5)).toBe(0);
  });
});

describe('KPI engine — order grain', () => {
  const kpis = computeKpis(baseFixture(), { range: SEPT_1_2 });
  const m = kpis.metrics;

  it('counts orders by lifecycle', () => {
    expect(kpis.grain).toBe('order');
    expect(m.orders.value).toBe(4);
    expect(m.validOrders.value).toBe(3);
    expect(m.cancelledOrders.value).toBe(1);
    expect(m.returnedOrders.value).toBe(1);
    expect(m.completedOrders.value).toBe(2);
  });

  it('GMV excludes cancelled orders and counts multi-item orders fully', () => {
    expect(m.gmv.value).toBe(700 * K);
    expect(m.placedGmv.value).toBe(800 * K);
    expect(m.units.value).toBe(7);
  });

  it('net revenue = GMV − seller discount − refund', () => {
    expect(m.netRevenue.value).toBe(530 * K);
  });

  it('computes AOV and rates', () => {
    expect(m.aov.value).toBeCloseTo((700 * K) / 3, 6);
    expect(m.cancelRate.value).toBeCloseTo(0.25, 10);
    expect(m.refundRate.value).toBeCloseTo(1 / 3, 10);
    expect(m.completionRate.value).toBeCloseTo(0.5, 10);
  });

  it('counts distinct buyers when every valid order has a customer ID', () => {
    expect(m.buyers.value).toBe(2); // c1 (O1, O3), c3 (O4); c2 only cancelled
  });

  it('does not fabricate CVR without traffic data', () => {
    expect(m.cvr.status).toBe('missing');
    expect(m.cvr.value).toBeNull();
    expect(m.cvr.notes?.[0].vi).toContain('lượt xem/nhấp sản phẩm');
  });

  it('computes CVR as orders / product clicks', () => {
    const ds = baseFixture();
    ds.traffic = [
      { date: '2025-09-01', platform: 'shopee', visits: 40, productClicks: 50 },
      { date: '2025-09-02', platform: 'tiktok', visits: 25, productClicks: 30 },
    ];
    const k = computeKpis(ds, { range: SEPT_1_2 }).metrics;
    expect(k.cvr.value).toBeCloseTo(4 / 80, 10);
    // unique visitors summed across days are labelled as such, never shown as distinct visitors
    expect(k.visits.status).toBe('partial');
    expect(k.visits.value).toBe(65);
    expect(k.visits.label?.vi).toBe('Lượt truy cập (cộng theo ngày)');
    expect(computeKpis(ds, { range: { start: '2025-09-01', end: '2025-09-01' } }).metrics.visits.value).toBe(40);
  });

  it('filters by platform', () => {
    const tiktok = computeKpis(baseFixture(), { range: SEPT_1_2, platforms: ['tiktok'] }).metrics;
    expect(tiktok.orders.value).toBe(2);
    expect(tiktok.gmv.value).toBe(400 * K);
  });

  it('filters by SKU (multi-item order contributes only matching lines)', () => {
    const skuB = computeKpis(baseFixture(), { range: SEPT_1_2, skus: ['B'] }).metrics;
    expect(skuB.gmv.value).toBe(200 * K); // O1 line B + O3
    expect(skuB.orders.value).toBe(2);
  });

  it('marks ads as missing (not zero) when no ads data exists', () => {
    expect(m.adSpend.status).toBe('missing');
    expect(m.roas.value).toBeNull();
  });
});

describe('KPI engine — edge cases', () => {
  it('division by zero: covered day without orders gives 0 orders and missing AOV', () => {
    const ds = dataset(
      [order({ orderId: 'X', orderDate: '2025-09-01', status: 'completed' }), order({ orderId: 'Y', orderDate: '2025-09-03', status: 'completed' })],
      [line({ orderId: 'X', sku: 'A', quantity: 1, grossAmount: 100 }), line({ orderId: 'Y', sku: 'A', quantity: 1, grossAmount: 100 })],
    );
    const m = computeKpis(ds, { range: { start: '2025-09-02', end: '2025-09-02' } }).metrics;
    expect(m.orders.value).toBe(0);
    expect(m.gmv.value).toBe(0);
    expect(m.aov.status).toBe('missing');
    expect(m.cancelRate.value).toBeNull();
  });

  it('range outside imported data is missing, never zero', () => {
    const k = computeKpis(baseFixture(), { range: { start: '2025-08-01', end: '2025-08-02' } });
    expect(k.coverage).toBe('none');
    expect(k.metrics.gmv.value).toBeNull();
    expect(k.metrics.gmv.notes?.[0].vi).toContain('ngoài dữ liệu');
  });

  it('partially covered range is flagged partial', () => {
    const k = computeKpis(baseFixture(), { range: { start: '2025-08-31', end: '2025-09-02' } });
    expect(k.coverage).toBe('partial');
    expect(k.metrics.gmv.status).toBe('partial');
    expect(k.metrics.gmv.value).toBe(700 * K);
  });

  it('all-cancelled period has zero GMV and 100% cancel rate', () => {
    const ds = dataset([order({ orderId: 'Z', orderDate: '2025-09-01', status: 'cancelled' })], [line({ orderId: 'Z', sku: 'A', quantity: 1, grossAmount: 100 })]);
    const m = computeKpis(ds, { range: { start: '2025-09-01', end: '2025-09-01' } }).metrics;
    expect(m.gmv.value).toBe(0);
    expect(m.cancelRate.value).toBe(1);
    expect(m.aov.value).toBeNull();
  });
});

describe('KPI engine — daily grain (summary reports)', () => {
  const ds = dataset([], [], {
    dailyMetrics: [
      { date: '2025-09-01', platform: 'shopee', placedGmv: 1000, placedOrders: 10, paidOrders: 8, paidGmv: 800, cancelledOrders: 2, refundedOrders: 1, refundedGmv: 100, paidRefundedOrders: 1, paidRefundedGmv: 40, visits: 150, productClicks: 200, buyers: 7 },
      { date: '2025-09-02', platform: 'shopee', placedGmv: 2000, placedOrders: 20, paidOrders: 16, paidGmv: 1600, cancelledOrders: 3, refundedOrders: 0, refundedGmv: 0, paidRefundedOrders: 0, paidRefundedGmv: 0, visits: 250, productClicks: 300, buyers: 15 },
    ],
  });
  const m = computeKpis(ds, { range: SEPT_1_2 }).metrics;

  it('uses platform aggregates', () => {
    expect(m.gmv.value).toBe(3000);
    expect(m.orders.value).toBe(30);
    expect(m.aov.value).toBe(100);
    expect(m.cancelRate.value).toBeCloseTo(5 / 30, 10);
    expect(m.cvr.value).toBeCloseTo(30 / 500, 10);
  });

  it('counts one order stage everywhere — placed by default', () => {
    for (const k of ['gmv', 'netRevenue', 'orders', 'aov', 'cancelRate', 'refundRate', 'cvr'] as const) expect(m[k].basis?.vi).toBe('Đơn đặt');
    expect(m.netRevenue.value).toBe(3000 - 100); // placed sales − refunds of placed orders
    expect(m.refundRate.value).toBeCloseTo(1 / 30, 10);
    // "Tiền về" stays available, labelled.
    expect(m.paidGmv.value).toBe(2400);
    expect(m.paidOrders.value).toBe(24);
    expect(m.paidGmv.basis?.vi).toBe('Đơn đã thanh toán');
  });

  it('switches every figure together when paid orders are asked for', () => {
    const p = computeKpis(ds, { range: SEPT_1_2, stage: 'paid' }).metrics;
    expect(p.gmv.value).toBe(2400);
    expect(p.orders.value).toBe(24);
    expect(p.aov.value).toBe(100);
    expect(p.netRevenue.value).toBe(2400 - 40); // refunds of paid orders, not of placed (100)
    expect(p.refundRate.value).toBeCloseTo(1 / 24, 10);
    for (const k of ['gmv', 'netRevenue', 'orders', 'aov', 'refundRate'] as const) expect(p[k].basis?.vi).toBe('Đơn đã thanh toán');
  });

  it("flags a platform CVR that its own orders and clicks do not give", () => {
    const withTotal = { ...ds, periodTotals: [{ platform: 'shopee' as const, start: '2025-09-01', end: '2025-09-02', stage: 'placed' as const, orders: 30, productClicks: 500, reportedCvr: 0.08 }] };
    const cvr = computeKpis(withTotal, { range: SEPT_1_2 }).metrics.cvr;
    expect(cvr.value).toBeCloseTo(0.06, 10);
    expect(cvr.warning?.vi).toContain('File ghi CVR 8,00%');
    const agreeing = { ...withTotal, periodTotals: [{ ...withTotal.periodTotals[0], reportedCvr: 0.06 }] };
    expect(computeKpis(agreeing, { range: SEPT_1_2 }).metrics.cvr.warning).toBeUndefined();
  });

  it('does not present summed daily buyers as distinct buyers', () => {
    expect(m.buyers.status).toBe('partial');
    expect(m.buyers.value).toBe(22);
    expect(m.buyers.label?.vi).toBe('Lượt người mua (cộng theo ngày)');
    expect(m.buyers.notes?.[0].vi).toContain('không phải số người mua khác nhau');
    expect(computeKpis(ds, { range: { start: '2025-09-01', end: '2025-09-01' } }).metrics.buyers.value).toBe(7);
  });

  it('profit is not computable without order-level data', () => {
    expect(m.profit.status).toBe('missing');
    expect(m.profit.notes?.[0].vi).toContain('đơn hàng theo SKU');
  });
});

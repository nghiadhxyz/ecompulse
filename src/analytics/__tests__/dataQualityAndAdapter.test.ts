import { describe, expect, it } from 'vitest';
import { assessDataQuality } from '../dataQuality';
import { canonicalFromParsedStoreData } from '../adapters/fromParsedStoreData';
import { computeKpis } from '../kpiEngine';
import { toIsoDate, toNumber, findHeader } from '../parse';
import { SAMPLE_DATASETS } from '../../data/sampleDatasets';
import type { ParsedStoreData } from '../../types';
import { baseFixture, dataset, line, order } from './fixtures';

describe('value parsers', () => {
  it.each([
    ['1.234.567 ₫', 1234567],
    ['1,234,567', 1234567],
    ['250.000', 250000],
    ['12,5', 12.5],
    ['0.123', 0.123],
    ['1.234,5', 1234.5],
    ['(1.000)', -1000],
    ['-', undefined],
    ['', undefined],
    [42, 42],
  ])('toNumber(%s) = %s', (input, expected) => {
    expect(toNumber(input)).toBe(expected);
  });

  it.each([
    ['2025-08-01', '2025-08-01'],
    ['2025-08-01 10:22:00', '2025-08-01'],
    ['01/08/2025', '2025-08-01'],
    ['1-8-2025', '2025-08-01'],
    ['31/02/2025', undefined],
    ['24-07-2026-22-08-2026', undefined], // Shopee period-total row, not a day
    ['24-07-2026 10:15', '2026-07-24'],
    [45870, '2025-08-01'],
    ['abc', undefined],
  ])('toIsoDate(%s) = %s', (input, expected) => {
    expect(toIsoDate(input)).toBe(expected);
  });

  it('prefers exact header matches', () => {
    expect(findHeader(['số người mua mới', 'số người mua'], ['số người mua'])).toBe('số người mua');
  });
});

describe('data quality', () => {
  it('reports capabilities for the base fixture', () => {
    const r = assessDataQuality(baseFixture());
    const caps = Object.fromEntries(r.capabilities.map((c) => [c.key, c]));
    expect(r.grain).toBe('order');
    expect(r.coverage).toEqual({ start: '2025-09-01', end: '2025-09-02' });
    expect(caps.profit.status).toBe('partial');
    expect(caps.profit.reason?.vi).toBe('1 SKU chưa có giá vốn.');
    expect(caps.conversion.status).toBe('unavailable');
    expect(caps.conversion.reason?.vi).toContain('Product Views');
    expect(caps.customers.status).toBe('available');
    expect(caps.ads.status).toBe('unavailable');
    expect(caps.cancelReasons.status).toBe('partial'); // O2 has a reason, O3 (returned) does not
    expect(r.skusMissingCogs).toEqual(['C']);
  });

  it('disables customer analytics without identifiers', () => {
    const ds = baseFixture();
    ds.orders = ds.orders.map((o) => ({ ...o, customerId: undefined }));
    const caps = assessDataQuality(ds).capabilities;
    expect(caps.find((c) => c.key === 'customers')?.status).toBe('unavailable');
  });

  it('detects duplicates, unknown statuses and refunds above order value', () => {
    const ds = dataset(
      [
        order({ orderId: 'D', orderDate: '2025-09-01', status: 'completed' }),
        order({ orderId: 'D', orderDate: '2025-09-01', status: 'completed' }),
        order({ orderId: 'U', orderDate: '2025-09-01', status: 'unknown', rawStatus: 'Trạng thái lạ' }),
        order({ orderId: 'R', orderDate: '2025-09-01', status: 'refunded', refundAmount: 500 }),
      ],
      [
        line({ orderId: 'D', sku: 'A', quantity: 1, grossAmount: 100 }),
        line({ orderId: 'D', sku: 'A', quantity: 1, grossAmount: 100 }),
        line({ orderId: 'U', sku: 'A', quantity: 1, grossAmount: 100 }),
        line({ orderId: 'R', sku: 'A', quantity: 1, grossAmount: 100 }),
      ],
    );
    const codes = assessDataQuality(ds).issues.map((i) => i.code);
    expect(codes[0]).toBe('duplicate_orders'); // errors first
    expect(codes).toContain('duplicate_lines');
    expect(codes).toContain('unknown_status');
    expect(codes).toContain('refund_exceeds_order');
  });
});

describe('ParsedStoreData adapter', () => {
  it('maps the Shopee demo summary dataset to daily grain', () => {
    const ds = canonicalFromParsedStoreData(SAMPLE_DATASETS['mega-8-8'], 'shopee');
    expect(ds.orders).toHaveLength(0);
    expect(ds.dailyMetrics.length).toBeGreaterThan(20);
    expect(ds.dailyMetrics[0].date).toBe('2025-08-01');
    const k = computeKpis(ds, { range: { start: '2025-08-01', end: '2025-08-03' } });
    expect(k.grain).toBe('daily');
    // GMV counts placed orders; the paid ("tiền về") figure is kept apart.
    expect(k.metrics.gmv.value).toBe(ds.dailyMetrics.slice(0, 3).reduce((s, d) => s + (d.placedGmv ?? 0), 0));
    expect(k.metrics.paidGmv.value).toBe(15_200_000 + 14_800_000 + 16_500_000);
    expect(k.metrics.profit.status).toBe('missing');
  });

  it('reads daily visits/cancellations from Shopee overview raw sheets', () => {
    const headers = ['Ngày', 'Tổng doanh số (VND)', 'Doanh số trên mỗi đơn hàng', 'Tổng số đơn hàng', 'Lượt nhấp vào sản phẩm', 'Số lượt truy cập', 'Đơn đã hủy', 'Doanh số đơn hủy', 'số người mua', 'số người mua mới'];
    const placed = { sheetName: 'Đơn hàng đã đặt', groupName: 'Group 1: Executive Overview', headerRowIndex: 0, headers, totalRowCount: 3, rows: [
      { 'Ngày': '01-09-2025-02-09-2025', 'Tổng doanh số (VND)': '999', 'Tổng số đơn hàng': '9', 'Đơn đã hủy': '99' },
      { 'Ngày': 'Ngày', 'Tổng doanh số (VND)': 'Tổng doanh số (VND)' }, // repeated header row
      { 'Ngày': '01-09-2025', 'Tổng doanh số (VND)': '1.000.000', 'Doanh số trên mỗi đơn hàng': '100.000', 'Tổng số đơn hàng': '10', 'Lượt nhấp vào sản phẩm': '300', 'Số lượt truy cập': '400', 'Đơn đã hủy': '2', 'số người mua': '9', 'số người mua mới': '4' },
      { 'Ngày': '02-09-2025', 'Tổng doanh số (VND)': '500.000', 'Tổng số đơn hàng': '5', 'Lượt nhấp vào sản phẩm': '200', 'Số lượt truy cập': '100', 'Đơn đã hủy': '0' },
    ] };
    const paid = { ...placed, sheetName: 'Đơn Đã Thanh Toán', rows: [
      { 'Ngày': '01-09-2025', 'Tổng doanh số (VND)': '800.000', 'Tổng số đơn hàng': '8' },
      { 'Ngày': '02-09-2025', 'Tổng doanh số (VND)': '500.000', 'Tổng số đơn hàng': '5' },
    ] };
    const legacy = { ...SAMPLE_DATASETS['mega-8-8'], dailyTimeline: [], rawSheets: { [placed.sheetName]: placed, [paid.sheetName]: paid } } as ParsedStoreData;
    const ds = canonicalFromParsedStoreData(legacy, 'shopee');
    expect(ds.dailyMetrics).toEqual([
      { date: '2025-09-01', platform: 'shopee', placedGmv: 1_000_000, placedOrders: 10, paidGmv: 800_000, paidOrders: 8, visits: 400, productClicks: 300, cancelledOrders: 2, cancelledGmv: undefined, refundedOrders: undefined, refundedGmv: undefined, buyers: 9, newBuyers: 4 },
      { date: '2025-09-02', platform: 'shopee', placedGmv: 500_000, placedOrders: 5, paidGmv: 500_000, paidOrders: 5, visits: 100, productClicks: 200, cancelledOrders: 0, cancelledGmv: undefined, refundedOrders: undefined, refundedGmv: undefined, buyers: undefined, newBuyers: undefined },
    ]);
    // The period row is kept apart as the platform's total, not as a day.
    expect(ds.periodTotals).toEqual([{ platform: 'shopee', start: '2025-09-01', end: '2025-09-02', stage: 'placed', gmv: 999, orders: 9, cancelledOrders: 99 }]);
    // Part of the period → daily rows, rates recomputed from sums.
    const day = computeKpis(ds, { range: { start: '2025-09-01', end: '2025-09-01' } }).metrics;
    expect(day.cancelRate.value).toBeCloseTo(2 / 10, 10);
    expect(day.cvr.value).toBeCloseTo(10 / 300, 10);
    // Whole period → the platform's total, with a warning that the days add up differently.
    const m = computeKpis(ds, { range: { start: '2025-09-01', end: '2025-09-02' } }).metrics;
    expect(m.orders.value).toBe(9);
    expect(m.orders.warning?.vi).toContain('Cộng các ngày = 15, dòng tổng của sàn = 9');
    expect(m.cancelRate.warning).toBeDefined();
    expect(m.cancelRate.value).toBeCloseTo(99 / 9, 10);
  });

  it('maps legacy order rows to orders + lines and ignores fabricated ads', () => {
    const legacy = {
      ...SAMPLE_DATASETS['mega-8-8'],
      orders: [
        { orderId: 'X1', orderDate: '2025-09-01', orderStatus: 'Hoàn thành', channel: 'shopee', buyerId: 'b1', productName: 'P', sku: 'S1', quantity: 2, originalPrice: 200, paidAmount: 180, shopeeSubsidy: 5, voucherSeller: 20, shippingFee: 0, actualRevenue: 180 },
        { orderId: 'X1', orderDate: '2025-09-01', orderStatus: 'Hoàn thành', channel: 'shopee', buyerId: 'b1', productName: 'Q', sku: 'S2', quantity: 1, originalPrice: 50, paidAmount: 50, shopeeSubsidy: 0, voucherSeller: 0, shippingFee: 0, actualRevenue: 50 },
      ],
    } as ParsedStoreData;
    const ds = canonicalFromParsedStoreData(legacy, 'shopee');
    expect(ds.orders).toHaveLength(1);
    expect(ds.orders[0].status).toBe('completed');
    expect(ds.orderLines).toHaveLength(2);
    expect(ds.ads).toHaveLength(0);
    expect(ds.importNotes?.some((n) => n.vi.includes('quảng cáo'))).toBe(true);
    expect(computeKpis(ds, { range: { start: '2025-09-01', end: '2025-09-01' } }).metrics.gmv.value).toBe(250);
  });
});

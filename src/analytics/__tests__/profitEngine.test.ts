import { describe, expect, it } from 'vitest';
import { computeProfit } from '../profitEngine';
import { sliceDataset, type DatasetFilter } from '../filters';
import { breakEvenRoas, cpa, cpc, ctr, profitAfterAds, roas } from '../adsFormulas';
import { baseFixture, dataset, line, order, SEPT_1_2 } from './fixtures';

const K = 1000;
const profitOf = (ds = baseFixture(), filter: DatasetFilter = { range: SEPT_1_2 }) => computeProfit(sliceDataset(ds, filter));

function completeFixture() {
  const ds = baseFixture();
  ds.orders = ds.orders.map((o) => (o.orderId === 'O3' ? { ...o, refundAmount: 100 * K } : o));
  ds.costSettings = {
    skuCogs: { C: 60 * K },
    platformFeeRate: { tiktok: 0.1 },
    paymentFeeRate: { shopee: 0.02, tiktok: 0.02 },
    noAdsDeclared: true,
  };
  return ds;
}

describe('profit engine — complete inputs', () => {
  const p = profitOf(completeFixture());

  it('builds the waterfall', () => {
    expect(p.completeness).toBe('complete');
    expect(p.gmv.value).toBe(700 * K);
    expect(p.sellerDiscount.value).toBe(20 * K);
    expect(p.refund.value).toBe(150 * K);
    expect(p.netRevenue.value).toBe(530 * K);
    // COGS: O1 A 2×40 + B 30 = 110; O3 returned → none; O4 C 3×60 = 180
    expect(p.cogs.value).toBe(290 * K);
  });

  it('uses order fees, user fee rates and declared "no ads"', () => {
    const byKey = Object.fromEntries(p.lines.map((l) => [l.key, l]));
    // platform fee: shopee order-level 30 + tiktok 10% × net 250 = 55
    expect(byKey.platformFee.amount).toBeCloseTo(55 * K, 6);
    expect(byKey.platformFee.source).toBe('user_rate');
    // payment fee: 2% × (shopee net 280 + tiktok net 250)
    expect(byKey.paymentFee.amount).toBeCloseTo(10.6 * K, 6);
    expect(byKey.ads.amount).toBe(0);
    expect(byKey.ads.source).toBe('declared_none');
    expect(byKey.affiliate.source).toBe('not_applicable');
    expect(byKey.shipping.amount).toBe(15 * K);
  });

  it('contribution profit and margin', () => {
    expect(p.profit.value).toBeCloseTo(159.4 * K, 6);
    expect(p.margin.value).toBeCloseTo(159.4 / 530, 10);
    expect(p.warnings).toHaveLength(0);
  });
});

describe('profit engine — missing data is never silently zero', () => {
  it('warns with the number of SKUs missing COGS', () => {
    const p = profitOf();
    expect(p.completeness).toBe('partial');
    expect(p.missingCogsSkus).toEqual(['C']);
    expect(p.warnings.map((w) => w.vi)).toContain('Ước tính lợi nhuận chưa đầy đủ vì 1 SKU chưa có giá vốn.');
    expect(p.profit.status).toBe('partial');
  });

  it('flags missing ads, payment fee and TikTok platform fee', () => {
    const text = profitOf().warnings.map((w) => w.vi).join(' | ');
    expect(text).toContain('quảng cáo');
    expect(text).toContain('phí thanh toán');
    expect(text).toContain('TikTok Shop');
  });

  it('assumes full refund for returned orders without an amount — and says so', () => {
    const p = profitOf();
    expect(p.assumedRefundOrders).toBe(1);
    expect(p.warnings[0].vi).toContain('tạm tính hoàn toàn bộ');
  });

  it('is insufficient when no SKU has COGS', () => {
    const ds = baseFixture();
    ds.products = ds.products.map((p) => ({ ...p, unitCogs: undefined }));
    const p = profitOf(ds);
    expect(p.completeness).toBe('insufficient');
    expect(p.profit.value).toBeNull();
    expect(p.margin.value).toBeNull();
    expect(p.profit.notes?.[0].vi).toContain('3 SKU chưa có giá vốn');
  });

  it('user-entered COGS overrides the catalog', () => {
    const ds = completeFixture();
    ds.costSettings!.skuCogs = { ...ds.costSettings!.skuCogs, A: 50 * K };
    expect(profitOf(ds).cogs.value).toBe((100 + 30 + 180) * K);
  });

  it('requires order-level data', () => {
    const p = profitOf(dataset([], [], { dailyMetrics: [{ date: '2025-09-01', platform: 'shopee', paidGmv: 1 }] }));
    expect(p.completeness).toBe('insufficient');
    expect(p.netRevenue.value).toBeNull();
  });
});

describe('profit engine — edge cases', () => {
  it('negative profit is reported as negative', () => {
    const ds = dataset(
      [order({ orderId: 'L1', orderDate: '2025-09-01', status: 'completed', platformFee: 0, paymentFee: 0, shippingFeeSeller: 0 })],
      [line({ orderId: 'L1', sku: 'X', quantity: 1, grossAmount: 100 * K, unitCogs: 150 * K })],
      { costSettings: { noAdsDeclared: true } },
    );
    const p = profitOf(ds, { range: { start: '2025-09-01', end: '2025-09-01' } });
    expect(p.completeness).toBe('complete');
    expect(p.profit.value).toBe(-50 * K);
    expect(p.margin.value).toBeCloseTo(-0.5, 10);
  });

  it('refund greater than revenue gives negative net revenue and undefined margin', () => {
    const ds = dataset(
      [order({ orderId: 'R1', orderDate: '2025-09-01', status: 'refunded', refundAmount: 150 * K, platformFee: 0, paymentFee: 0, shippingFeeSeller: 0 })],
      [line({ orderId: 'R1', sku: 'X', quantity: 1, grossAmount: 100 * K, unitCogs: 10 * K })],
      { costSettings: { noAdsDeclared: true } },
    );
    const p = profitOf(ds, { range: { start: '2025-09-01', end: '2025-09-01' } });
    expect(p.netRevenue.value).toBe(-50 * K);
    expect(p.margin.value).toBeNull();
  });

  it('allocates order-level fees to the SKU subset by gross share', () => {
    const ds = completeFixture();
    const p = profitOf(ds, { range: SEPT_1_2, skus: ['A'] });
    const fee = p.lines.find((l) => l.key === 'platformFee')!;
    expect(fee.amount).toBeCloseTo(20 * K, 6); // O1 fee 30 × (200 / 300)
  });

  it('handles combo lines like any SKU line', () => {
    const ds = dataset(
      [order({ orderId: 'C1', orderDate: '2025-09-01', status: 'completed', platformFee: 0, paymentFee: 0, shippingFeeSeller: 0 })],
      [line({ orderId: 'C1', sku: 'COMBO-AB', comboId: 'COMBO-AB', quantity: 2, grossAmount: 500 * K, unitCogs: 120 * K })],
      { costSettings: { noAdsDeclared: true } },
    );
    expect(profitOf(ds, { range: { start: '2025-09-01', end: '2025-09-01' } }).profit.value).toBe(260 * K);
  });
});

describe('ads formulas', () => {
  it('computes ROAS, CPA, CTR, CPC', () => {
    expect(roas(500, 100)).toBe(5);
    expect(cpa(100, 4)).toBe(25);
    expect(ctr(30, 1000)).toBeCloseTo(0.03, 10);
    expect(cpc(90, 30)).toBe(3);
    expect(roas(500, 0)).toBeNull();
    expect(cpa(100, 0)).toBeNull();
  });

  it('break-even ROAS = 1 / margin before ads', () => {
    expect(breakEvenRoas(0.25)).toBe(4);
    expect(breakEvenRoas(0)).toBeNull();
    expect(breakEvenRoas(-0.1)).toBeNull();
    expect(breakEvenRoas(null)).toBeNull();
  });

  it('a high ROAS can still lose money', () => {
    // ROAS 3 but break-even 4 → loss
    expect(profitAfterAds(300, 100, 0.25)).toBe(-25);
  });
});

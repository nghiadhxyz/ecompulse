import { describe, expect, it } from 'vitest';
import { buildDemoCanonicalDataset, DEMO_RANGE } from '../../data/demoCanonicalDataset';
import { assessDataQuality } from '../dataQuality';
import { computeKpis } from '../kpiEngine';
import { isCancelled } from '../status';

const ds = buildDemoCanonicalDataset();

describe('demo dataset — internal consistency', () => {
  it('covers 3 months on 3 platforms with realistic volume', () => {
    expect(new Set(ds.orders.map((o) => o.platform))).toEqual(new Set(['shopee', 'tiktok', 'lazada']));
    const dates = ds.orders.map((o) => o.orderDate).sort();
    expect(dates[0]).toBe(DEMO_RANGE.start);
    expect(dates[dates.length - 1]).toBe(DEMO_RANGE.end);
    expect(ds.orders.length).toBeGreaterThan(8_000);
  });

  it('is deterministic', () => {
    expect(buildDemoCanonicalDataset()).toBe(ds);
    expect(ds.orders[0].orderId).toMatch(/^25250701/);
  });

  it('has unique orders, every order has lines, no data-quality errors', () => {
    expect(new Set(ds.orders.map((o) => o.orderId)).size).toBe(ds.orders.length);
    const withLines = new Set(ds.orderLines.map((l) => l.orderId));
    expect(ds.orders.every((o) => withLines.has(o.orderId))).toBe(true);
    const report = assessDataQuality(ds);
    expect(report.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(report.issues.map((i) => i.code)).not.toContain('refund_exceeds_order');
  });

  it('lifecycle counts never exceed placed orders', () => {
    const m = computeKpis(ds, { range: DEMO_RANGE }).metrics;
    const sum = (m.completedOrders.value || 0) + (m.cancelledOrders.value || 0) + (m.returnedOrders.value || 0) + (m.refundedOrders.value || 0);
    expect(sum).toBeLessThanOrEqual(m.orders.value!);
    expect(m.cancelRate.value!).toBeGreaterThan(0.03);
    expect(m.cancelRate.value!).toBeLessThan(0.15);
  });

  it('live session facts equal the orders tagged with the session', () => {
    for (const s of ds.liveSessions) {
      const tagged = ds.orders.filter((o) => o.liveSessionId === s.sessionId);
      expect(s.orders).toBe(tagged.length);
      expect((s.paidOrders || 0) + (s.cancelledOrders || 0)).toBe(tagged.length);
      expect(s.cancelledOrders).toBe(tagged.filter((o) => isCancelled(o.status)).length);
    }
  });

  it('ad-attributed orders are real non-cancelled orders of the promoted SKU', () => {
    for (const a of ds.ads.slice(0, 200)) {
      const real = ds.orders.filter((o) => o.orderDate === a.date && o.campaignId === a.campaignId && !isCancelled(o.status));
      expect(a.orders).toBe(real.length);
      expect(a.clicks || 0).toBeGreaterThanOrEqual(a.orders || 0);
    }
  });

  it('affiliate commission equals order-level commission', () => {
    const fromRows = ds.affiliates.reduce((s, a) => s + (a.commission || 0), 0);
    const fromOrders = ds.orders.filter((o) => !isCancelled(o.status)).reduce((s, o) => s + (o.affiliateCommission || 0), 0);
    expect(fromRows).toBe(fromOrders);
  });

  it('cancelled orders carry no fees and returned orders carry a refund', () => {
    for (const o of ds.orders) {
      if (isCancelled(o.status)) expect(o.platformFee).toBe(0);
      if (o.status === 'returned' || o.status === 'refunded') expect(o.refundAmount).toBeGreaterThan(0);
    }
  });

  it('SERUM-VC is sold without COGS (profit completeness demo)', () => {
    expect(assessDataQuality(ds).skusMissingCogs).toEqual(['SERUM-VC']);
  });
});

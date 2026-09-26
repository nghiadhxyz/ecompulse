/**
 * Golden test for the full Shopee "Phân tích bán hàng" workbook (all 21 sheets).
 * Uses the real export in samples/ or the repo root; skipped when neither is present.
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { importShopeeSalesAnalysis } from '../importers/shopeeSalesAnalysis';
import { parseShopeeExcelFile } from '../../utils/excelParser';
import { canonicalFromParsedStoreData } from '../adapters/fromParsedStoreData';
import { mergeIntoWorkspace } from '../workspace';
import { computeKpis } from '../kpiEngine';
import { channelMix, summaryProducts } from '../summaryEngine';
import { adsIntelligence, liveAudit, videoAffiliate } from '../growthEngines';
import { breakdown } from '../breakdownEngine';
import { anomalyScan } from '../anomalyScan';
import { planProgress } from '../planningEngine';
import { beforeAfter } from '../changeImpact';
import { advancedStats } from '../statsEngine';
import { orderHealth } from '../orderHealthEngine';
import { askDolphin } from '../dolphinEvidence';
import { campaignCalendar } from '../campaignEngine';

const CANDIDATES = [resolve(__dirname, '../../../samples/t7-t8 (1).xlsx'), resolve(__dirname, '../../../Báo cáo mẫu.xlsx')];
const FILE = CANDIDATES.find((f) => existsSync(f));
const FULL = { range: { start: '2026-07-24', end: '2026-08-22' } };

describe.skipIf(!FILE)('Shopee sales-analysis workbook — every sheet', async () => {
  const buf = readFileSync(FILE!);
  const wb = XLSX.read(buf, { type: 'buffer', dense: true });
  const sheets = wb.SheetNames.map((name) => ({ name, rows: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: '' }) }));
  const r = importShopeeSalesAnalysis({ fileName: 'x.xlsx', sheets });
  const file = { name: 'x.xlsx', arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) } as unknown as File;
  const parsed = await parseShopeeExcelFile(file);
  const ds = mergeIntoWorkspace(mergeIntoWorkspace(null, canonicalFromParsedStoreData(parsed, 'shopee')), r.dataset);

  it('recognises all 21 sheets with the right order stage', () => {
    expect(r.period).toEqual({ start: '2026-07-24', end: '2026-08-22' });
    expect(r.sheets).toHaveLength(21);
    expect(r.sheets.filter((s) => s.kind === 'skipped')).toHaveLength(0);
    expect(r.sheets.filter((s) => s.kind === 'live').map((s) => s.stage)).toEqual(['placed', 'confirmed', 'paid']);
    expect(r.sheets.filter((s) => s.kind === 'affiliate').map((s) => s.stage)).toEqual(['placed', 'confirmed', 'paid']);
  });

  it('channels add up to Shopee\'s total and daily rows match period totals', () => {
    const mix = channelMix(ds, FULL, 'placed');
    expect(mix.total).toBe(67_348_702);
    expect(mix.channels.find((c) => c.channel === 'product_card')!.gmv).toBe(50_197_987);
    expect(mix.channels.find((c) => c.channel === 'affiliate')!.gmv).toBe(15_807_915);
    expect(mix.adsGmv).toBe(63_564_662);
    expect(channelMix(ds, FULL, 'paid').total).toBe(51_302_716);
    // Daily KPIs are unchanged by the extra sheets (no double counting)
    expect(computeKpis(ds, FULL).metrics.orders.value).toBe(519);
  });

  it('reads daily Shopee Ads spend without double counting the period total', () => {
    const ai = adsIntelligence(ds, FULL);
    expect(ai.totals.spend).toBeGreaterThan(5_174_000);
    expect(ai.totals.spend).toBeLessThan(5_176_000);
    expect(ai.campaigns).toHaveLength(3);
    expect(computeKpis(ds, FULL).metrics.roas.value!).toBeCloseTo(63_564_662 / ai.totals.spend, 6);
  });

  it('products, live sessions, videos and affiliates', () => {
    const sp = summaryProducts(ds, FULL);
    expect(sp.rows[0].sku).toBe('26061744778');
    expect(sp.rows[0].gmv).toBe(6_798_809 + 4_003_187);
    expect(sp.coverage!).toBeLessThan(1);
    const la = liveAudit(ds, FULL);
    expect(la.sessions).toHaveLength(5);
    expect(la.sessions.find((s) => s.session.title?.includes('MEGA LIVE'))!.session.paidOrders).toBe(2);
    const va = videoAffiliate(ds, FULL);
    expect(va.creators.length).toBeGreaterThanOrEqual(5);
    expect(va.videos.length).toBeGreaterThanOrEqual(5);
    // Period rows disappear for a partial range instead of being spread across days
    expect(summaryProducts(ds, { range: { start: '2026-08-01', end: '2026-08-22' } }).available).toBe(false);
  });

  describe('daily-grain features (no order lines)', () => {
    const W2 = { start: '2026-08-09', end: '2026-08-22' };
    const W1 = { start: '2026-07-26', end: '2026-08-08' };
    it('breakdown by day / platform uses the daily rows', () => {
      const day = breakdown(ds, FULL, 'day');
      expect(day.rows).toHaveLength(30);
      expect(day.totalGmv).toBe(51_302_716);
      expect(breakdown(ds, FULL, 'platform').rows[0].current.placed).toBe(519);
      expect(breakdown(ds, FULL, 'sku').unavailable).toBeDefined();
    });
    it('order health, anomaly scan, calendar', () => {
      expect(orderHealth(ds, FULL).cancelRate).toBeCloseTo(102 / 519, 10);
      const scan = anomalyScan(ds, FULL, 'gmv');
      expect(scan.points.some((p) => p.score !== null)).toBe(true);
      expect(anomalyScan(ds, FULL, 'profit').notes[0].vi).toContain('giá vốn');
      expect(campaignCalendar(ds).map((c) => c.name)).toContain('8.8');
    });
    it('planning, change impact and statistics', () => {
      const p = planProgress(ds, { month: '2026-08', targetGmv: 60_000_000, events: [] });
      expect(p.lastDataDay).toBe('2026-08-22');
      expect(p.toDate!.actual).toBeGreaterThan(0);
      const ba = beforeAfter(ds, {}, '2026-08-09', [7, 14]);
      expect(ba.windows.map((w) => w.days)).toEqual([7, 14]);
      expect(beforeAfter(ds, { skus: ['26061744778'] }, '2026-08-09').unavailable!.vi).toContain('SKU');
      const st = advancedStats(ds, { range: W2 }, W1);
      const gmv = st.tests.find((t) => t.key === 'gmvPerDay')!;
      expect(gmv.current!).toBeGreaterThan(1_000_000); // was wrongly 0 before
      expect(st.tests.find((t) => t.key === 'cancelRate')!.verdict).not.toBe('insufficient');
    });
    it('Dolphin answers overview, ads and best product from the summary report', () => {
      const ctx = { range: W2, previousRange: W1 };
      for (const q of ['Tháng này doanh thu thế nào?', 'Quảng cáo có hiệu quả không?', 'Sản phẩm nào tốt nhất?']) {
        const a = askDolphin(ds, q, { ...ctx, range: q.includes('tốt nhất') ? FULL.range : W2 });
        expect(a.unavailable, q).toBeUndefined();
      }
      expect(askDolphin(ds, 'Quảng cáo có hiệu quả không?', ctx).insight.vi).toContain('Chưa biết chiến dịch nào có lời');
      expect(askDolphin(ds, 'Sản phẩm nào đang lỗ?', ctx).unavailable).toBeDefined();
      expect(askDolphin(ds, 'Live nào có conversion thấp?', { range: FULL.range, previousRange: W1 }).unavailable!.vi).toContain('200 người xem');
    });
  });
});

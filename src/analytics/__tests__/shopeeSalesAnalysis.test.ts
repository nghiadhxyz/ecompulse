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
});

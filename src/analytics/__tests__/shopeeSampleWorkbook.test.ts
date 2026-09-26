/**
 * Golden test against a real Shopee "Phân tích bán hàng" export (Báo cáo mẫu.xlsx).
 * The engine rebuilds the period from daily rows and must match the period-total row
 * Shopee itself prints. Skipped when the workbook is not present (it is not committed).
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { parseShopeeExcelFile } from '../../utils/excelParser';
import { canonicalFromParsedStoreData } from '../adapters/fromParsedStoreData';
import { computeKpis } from '../kpiEngine';
import { datasetDateBounds } from '../filters';

const WORKBOOK = resolve(__dirname, '../../../Báo cáo mẫu.xlsx');

describe.skipIf(!existsSync(WORKBOOK))('Shopee sample workbook (golden)', () => {
  it('matches Shopee period totals: 519 orders, 102 cancelled, CVR 4.90%, paid GMV 51,302,716', async () => {
    const buf = readFileSync(WORKBOOK);
    const file = {
      name: 'Báo cáo mẫu.xlsx',
      arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    } as unknown as File;
    const parsed = await parseShopeeExcelFile(file);

    // No fabricated ads / MoM in the legacy result any more.
    expect(parsed.ads).toHaveLength(0);
    expect(parsed.kpis.revenueGrowthMoM).toBeUndefined();

    const ds = canonicalFromParsedStoreData(parsed, 'shopee');
    const bounds = datasetDateBounds(ds)!;
    expect(bounds).toEqual({ start: '2026-07-24', end: '2026-08-22' });

    const m = computeKpis(ds, { range: bounds }).metrics;
    expect(m.orders.value).toBe(519);
    expect(m.cancelledOrders.value).toBe(102);
    expect(m.cancelRate.value).toBeCloseTo(102 / 519, 10);
    expect(m.gmv.value).toBe(51_302_716);
    expect(m.validOrders.value).toBe(422);
    expect(m.cvr.value).toBeCloseTo(0.049, 3); // Shopee shows 4,90%
    // Unique visitors are not additive: the whole period uses Shopee's own total (daily sum is 9.622).
    expect(m.visits.value).toBe(7362);
    expect(m.buyers.value).toBe(453);
    expect(m.profit.status).toBe('missing'); // summary report has no COGS / order lines
  });
});

/**
 * Golden test against a real Shopee "Phân tích bán hàng" export (Báo cáo mẫu.xlsx).
 * The engine rebuilds the period from daily rows and must match the period-total row
 * Shopee itself prints. Skipped when the workbook is not present (it is not committed).
 */
import { existsSync, readFileSync } from 'fs';
import { basename, resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { parseShopeeExcelFile } from '../../utils/excelParser';
import { canonicalFromParsedStoreData } from '../adapters/fromParsedStoreData';
import { computeKpis } from '../kpiEngine';
import { datasetDateBounds } from '../filters';
import { subsidyDependence } from '../summaryInsights';
import { breakdown } from '../breakdownEngine';
import * as XLSX from 'xlsx';
import { importShopeeSalesAnalysis } from '../importers/shopeeSalesAnalysis';
import { mergeIntoWorkspace } from '../workspace';
import { buildDailyBrief } from '../dailyBrief';
import { questionUnavailable } from '../dolphinEvidence';

const WORKBOOK = resolve(__dirname, '../../../Báo cáo mẫu.xlsx');
/** A later export whose period rows disagree with its own days (samples/ is not committed). */
const NEW_WORKBOOK = resolve(__dirname, '../../../samples/t7-t8_so_lieu_moi.xlsx');

async function parseWorkbook(path: string) {
  const buf = readFileSync(path);
  const file = {
    name: basename(path),
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  } as unknown as File;
  return parseShopeeExcelFile(file);
}

describe.skipIf(!existsSync(NEW_WORKBOOK))('Shopee workbook with inconsistent rows (golden)', () => {
  it('keeps order stages apart and flags what the file gets wrong', async () => {
    const ds = canonicalFromParsedStoreData(await parseWorkbook(NEW_WORKBOOK), 'shopee');
    const range = datasetDateBounds(ds)!;
    const m = computeKpis(ds, { range }).metrics;

    // (1) Every card says which orders it counts.
    expect(m.gmv.basis?.vi).toBe('Đơn đã thanh toán');
    expect(m.aov.basis?.vi).toBe('Đơn đã thanh toán');
    expect(m.orders.basis?.vi).toBe('Đơn đặt');
    expect(m.cancelRate.basis?.vi).toBe('Đơn đặt');
    expect(m.cvr.basis?.vi).toBe('Đơn đặt');

    // (2) Net revenue deducts refunds of paid orders, not of placed orders.
    expect(m.gmv.value).toBe(50_505_501);
    expect(m.netRevenue.value).toBe(50_505_501 - 321_918);

    // (3) CVR is recomputed (519 / 10.601) and the file's 5,97% is flagged.
    expect(m.cvr.value).toBeCloseTo(519 / 10_601, 10);
    expect(m.cvr.warning?.vi).toContain('5,97%');
    expect(m.cvr.warning?.vi).toContain('4,90%');

    // (4) + (5) Subsidy: period row vs days, and days with a negative subsidy.
    const s = subsidyDependence(ds, { range });
    expect(s.total?.gmv).toBe(78_626_020);
    expect(s.warnings.some((w) => w.vi.includes('78.626.020') && w.vi.includes('63.713.950'))).toBe(true);
    expect(s.invalidDays).toEqual(['2026-07-25', '2026-07-26', '2026-08-01', '2026-08-07', '2026-08-19', '2026-08-21']);
    expect(s.points.every((p) => p.share === null || p.share >= 0)).toBe(true);
    expect(s.points.find((p) => p.key === '2026-07-25')?.share).toBeNull();

    // (6) The platform table uses the same period total as the GMV card.
    const byPlatform = breakdown(ds, { range }, 'platform');
    expect(byPlatform.rows[0].current.gmv).toBe(50_505_501);
    expect(byPlatform.rows[0].current.netRevenue).toBe(50_183_583);
  });
});

/** The workspace the app builds from a summary export: daily sheets + every other sheet. */
async function summaryWorkspace(path: string) {
  const wb = XLSX.read(readFileSync(path));
  const sheets = wb.SheetNames.map((name) => ({ name, rows: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: '' }) }));
  const daily = mergeIntoWorkspace(null, canonicalFromParsedStoreData(await parseWorkbook(path), 'shopee'));
  return mergeIntoWorkspace(daily, importShopeeSalesAnalysis({ fileName: basename(path), sheets }).dataset);
}

describe.skipIf(!existsSync(NEW_WORKBOOK))('Daily brief & alerts on a summary export (golden, 21/08)', () => {
  it('uses one order stage, compares with baselines and flags summary-level problems', async () => {
    const ds = await summaryWorkspace(NEW_WORKBOOK);
    const brief = buildDailyBrief(ds, '2026-08-21');

    // (1) Placed orders throughout: 1.268.039 from 16 orders, −49,4% vs 20/08; paid shown apart.
    expect(brief.stage?.vi).toBe('Đơn đặt');
    expect(brief.headline.revenue.current).toBe(1_268_039);
    expect(brief.headline.revenue.percentageDelta).toBeCloseTo(1_268_039 / 2_505_683 - 1, 10);
    expect(brief.headline.orders.current).toBe(16);
    expect(brief.paid?.orders.current).toBe(5);
    expect(brief.paid?.orders.previous).toBe(14);
    expect(brief.summary.vi).toContain('Theo đơn đã thanh toán');

    // (2) Baselines, and no verdict on a rate from 16 orders.
    expect(brief.revenueBaseline.avg7).toBeCloseTo(13_279_263 / 7, 6);
    expect(brief.revenueBaseline.avgPeriod).not.toBeNull();
    expect(brief.summary.vi).toContain('trung bình 7 ngày trước');
    expect(brief.summary.vi).toContain('trung bình cả kỳ');
    expect(brief.limitations.some((l) => l.vi.includes('1/16 đơn') && l.vi.includes('chưa đủ để kết luận'))).toBe(true);
    expect([...brief.positives, ...brief.concerns].some((i) => i.text.vi.includes('Tỷ lệ hủy'))).toBe(false);

    // (3) −33% vs the 7-day average → first concern, with a check.
    expect(brief.concerns[0].alertId).toBe('revenue_drop-2026-08-21');
    expect(brief.checks[0].alertId).toBe('revenue_drop-2026-08-21');

    // (4) Summary-report alerts: ≥ 3 on this day, none needing order rows.
    const types = brief.alerts.map((a) => a.type);
    expect(brief.alerts.length).toBeGreaterThanOrEqual(3);
    expect(types).toEqual(expect.arrayContaining(['revenue_drop', 'ads_day_change', 'source_change', 'data_negative_subsidy', 'data_period_mismatch', 'data_cvr_mismatch']));

    // (5) Questions that need an order export are flagged, the overview is not.
    const ctx = { range: { start: '2026-08-09', end: '2026-08-22' }, previousRange: { start: '2026-07-26', end: '2026-08-08' } };
    expect(questionUnavailable(ds, 'Tháng này doanh thu thế nào?', ctx)).toBeNull();
    expect(questionUnavailable(ds, 'Sản phẩm nào đang lỗ?', ctx)).not.toBeNull();
    expect(questionUnavailable(ds, 'SKU nào đang tăng trưởng?', ctx)).not.toBeNull();
  });
});

describe.skipIf(!existsSync(WORKBOOK))('Shopee sample workbook (golden)', () => {
  it('matches Shopee period totals: 519 orders, 102 cancelled, CVR 4.90%, paid GMV 51,302,716', async () => {
    const parsed = await parseWorkbook(WORKBOOK);

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

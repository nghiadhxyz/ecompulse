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
import { funnel } from '../funnelEngine';
import { sourceChecks, type SourceCheck } from '../canonicalSources';
import { channelMix, summaryProducts } from '../summaryEngine';
import { adsIntelligence } from '../growthEngines';
import { dailySeries } from '../timeseries';
import { describeMismatch, type MismatchItem } from '../mismatch';
import { fmtPerViewer, fmtShare } from '../format';
import { anomalyScan } from '../anomalyScan';
import { calendarPerformance } from '../campaignEngine';
import { advancedStats } from '../statsEngine';
import { stageFunnel } from '../summaryInsights';
import { orderHealth } from '../orderHealthEngine';

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

    // (1) Every card counts placed orders and says so; "tiền về" is its own labelled figure.
    for (const k of ['gmv', 'netRevenue', 'aov', 'orders', 'cancelRate', 'refundRate', 'cvr'] as const) expect(m[k].basis?.vi).toBe('Đơn đặt');
    expect(m.paidGmv.value).toBe(50_505_501);
    expect(m.paidGmv.basis?.vi).toBe('Đơn đã thanh toán');

    // (2) Net revenue deducts cancelled sales and refunds of the same orders as GMV.
    expect(m.gmv.value).toBe(78_626_020);
    expect(m.netRevenue.value).toBe(55_423_617); // 78.626.020 − 22.421.831 − 780.572
    expect(m.aov.value).toBeCloseTo(78_626_020 / 519, 6);
    expect(m.refundRate.value).toBeCloseTo(7 / 519, 10);
    const paid = computeKpis(ds, { range, stage: 'paid' }).metrics;
    expect(paid.gmv.value).toBe(50_505_501);
    expect(paid.netRevenue.value).toBe(47_517_323); // 50.505.501 − 2.666.260 − 321.918
    expect(paid.refundRate.value).toBeCloseTo(4 / 422, 10);

    // (3) CVR is recomputed (519 / 10.601) and the file's 5,97% is flagged.
    expect(m.cvr.value).toBeCloseTo(519 / 10_601, 10);
    expect(m.cvr.warning?.vi).toContain('5,97%');
    expect(m.cvr.warning?.vi).toContain('4,90%');

    // (4) + (5) Subsidy: period row vs days, and days with a negative subsidy.
    const s = subsidyDependence(ds, { range });
    expect(s.total?.gmv).toBe(78_626_020);
    expect(s.mismatches.find((m) => m.key === 'subsidy|gmv')).toMatchObject({ used: { value: 78_626_020 }, other: { value: 63_713_950 } });
    expect(s.invalidDays).toEqual(['2026-07-25', '2026-07-26', '2026-08-01', '2026-08-07', '2026-08-19', '2026-08-21']);
    expect(s.points.every((p) => p.share === null || p.share >= 0)).toBe(true);
    expect(s.points.find((p) => p.key === '2026-07-25')?.share).toBeNull();

    // (6) The platform table uses the same period total as the GMV card.
    const byPlatform = breakdown(ds, { range }, 'platform');
    expect(byPlatform.rows[0].current.gmv).toBe(78_626_020);
    expect(byPlatform.rows[0].current.netRevenue).toBe(55_423_617);
  });

  it('day-based pages always use placed orders: anomalies 02, 03, 05, 06/08; 08/08 is a sale day', async () => {
    const ds = await summaryWorkspace(NEW_WORKBOOK);
    const range = datasetDateBounds(ds)!;
    const scan = anomalyScan(ds, { range }, 'gmv');
    expect(scan.flagged.filter((p) => !p.saleDay).map((p) => p.date)).toEqual(['2026-08-02', '2026-08-03', '2026-08-05', '2026-08-06']);
    expect(scan.points.find((p) => p.date === '2026-08-08')!.saleDay).toBe(true);
    expect(scan.points.find((p) => p.date === '2026-08-12')!.flagged).toBe(false);
    // The stage picker does not move them.
    const paid = { range, stage: 'paid' as const };
    expect(anomalyScan(ds, paid, 'gmv').flagged).toEqual(scan.flagged);
    expect(calendarPerformance(ds, paid).byWeekday).toEqual(calendarPerformance(ds, { range }).byWeekday);
    const prev = { start: '2026-06-24', end: '2026-07-23' };
    expect(advancedStats(ds, paid, prev).correlations).toEqual(advancedStats(ds, { range }, prev).correlations);
  });

  it('0.2 — paid orders are not a subset of placed orders', async () => {
    const ds = await summaryWorkspace(NEW_WORKBOOK);
    const range = datasetDateBounds(ds)!;
    // No "placed → paid" funnel step and no share of placed orders.
    const f = funnel(ds, { range });
    expect(f.stages.paid).toBeNull();
    expect(f.steps.some((s) => s.to === 'paid')).toBe(false);
    // Affiliate: 94,21 placed vs 102,5 paid orders → above 100%, shown as "—".
    const aff = stageFunnel(ds, { range }).rows.find((r) => r.channel === 'affiliate' && r.source === null)!;
    expect(aff.paidRateOrders).toBeNull();
    expect(aff.crossPeriod).toBe(true);
    expect(stageFunnel(ds, { range }).rows.every((r) => (r.paidRateOrders ?? 0) <= 1 && (r.paidRateGmv ?? 0) <= 1)).toBe(true);
    // Refund rate of the same orders: 7 / 519.
    expect(orderHealth(ds, { range }).returnRate).toBeCloseTo(7 / 519, 10);
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
    expect(m.gmv.value).toBe(67_348_702); // placed orders
    expect(m.paidGmv.value).toBe(51_302_716);
    expect(m.paidOrders.value).toBe(422);
    expect(m.cvr.value).toBeCloseTo(0.049, 3); // Shopee shows 4,90%
    // Unique visitors are not additive: the whole period uses Shopee's own total (daily sum is 9.622).
    expect(m.visits.value).toBe(7362);
    expect(m.buyers.value).toBe(453);
    expect(m.profit.status).toBe('missing'); // summary report has no COGS / order lines
  });
});

describe.skipIf(!existsSync(WORKBOOK))('Clean Shopee export (golden, order stages)', () => {
  it('has no stage rate above 100% and no placed → paid funnel step', async () => {
    const ds = await summaryWorkspace(WORKBOOK);
    const range = datasetDateBounds(ds)!;
    expect(stageFunnel(ds, { range }).rows.some((r) => r.crossPeriod)).toBe(false);
    expect(funnel(ds, { range }).stages.paid).toBeNull();
    expect(orderHealth(ds, { range }).returnRate).toBeCloseTo(7 / 519, 10);
  });
});

describe('0.3 — canonical sources', () => {
  const find = (checks: SourceCheck[], id: string) => checks.find((c) => c.id.startsWith(id))!;
  const other = (c: SourceCheck, source: string) => c.others.find((o) => o.source === source)?.value;

  it.skipIf(!existsSync(NEW_WORKBOOK))('uses one source per figure and flags every other copy (inconsistent file)', async () => {
    const ds = await summaryWorkspace(NEW_WORKBOOK);
    const range = datasetDateBounds(ds)!;
    // Ads layer = sum of the ad rows, not the sheet header (76.096.018 = 108,7%).
    const mix = channelMix(ds, { range });
    expect(mix.adsGmv).toBe(62_864_872);
    expect(mix.adsAssistedShare).toBeCloseTo(62_864_872 / 70_013_491, 10);
    // Subsidy share: numerator and denominator both from the period row.
    expect(subsidyDependence(ds, { range }).total!.share).toBeCloseTo((78_626_020 - 63_173_888) / 78_626_020, 12);

    const checks = sourceChecks(ds);
    const card = find(checks, 'channel|shopee|2026-07-24|placed|product_card');
    expect(card.canonical.value).toBe(51_310_459);
    expect([other(card, 'product_header'), other(card, 'traffic_header'), other(card, 'daily_sheet_total')]).toEqual([60_198_730, 45_821_352, 40_851_945]);
    const spend = find(checks, 'ad|shopee|2026-07-24|Quảng cáo GMV tối đa ROAS tùy chỉnh cho sản phẩm|spend');
    expect([spend.canonical.value, other(spend, 'daily_sheet_total'), other(spend, 'daily_sum')]).toEqual([5_229_292, 4_404_537, 4_454_077]);
    const sales = find(checks, 'ad|shopee|2026-07-24|Quảng cáo GMV tối đa ROAS tùy chỉnh cho sản phẩm|gmv');
    expect([sales.canonical.value, other(sales, 'daily_sheet_total'), other(sales, 'daily_sum')]).toEqual([55_227_941, 64_581_695, 56_963_603]);
    expect(other(find(checks, 'ads_total'), 'traffic_header')).toBe(76_096_018);
    const live = find(checks, 'channel|shopee|2026-07-24|placed|live');
    expect([live.canonical.value, other(live, 'traffic_header'), other(live, 'daily_sheet_total'), other(live, 'daily_sum')]).toEqual([21_673, 29_859, 25_335, 32_048]);
    const sessions = find(checks, 'live_sessions');
    expect(other(sessions, 'live_sessions')).toBe(22_223);
    expect(sessions.invalid?.vi).toContain('không thể xảy ra');
    expect(other(find(checks, 'shop|shopee|2026-07-24|placed|gmv'), 'daily_sum')).toBe(63_713_950);
    const cancelled = find(checks, 'shop|shopee|2026-07-24|placed|cancelledGmv');
    expect([cancelled.canonical.value, other(cancelled, 'daily_sum')]).toEqual([22_421_831, 19_935_288]);
    expect(checks.filter((c) => c.invalid).map((c) => c.metric)).toEqual(['liveSessions']);
  });

  it.skipIf(!existsSync(WORKBOOK))('finds no disagreement in a clean export', async () => {
    const ds = await summaryWorkspace(WORKBOOK);
    const checks = sourceChecks(ds);
    expect(checks.length).toBeGreaterThan(30);
    expect(checks.filter((c) => c.mismatch)).toEqual([]);
    expect(checks.filter((c) => c.invalid)).toEqual([]);
    const sessions = find(checks, 'live_sessions');
    expect([sessions.canonical.value, other(sessions, 'live_sessions')]).toEqual([27_000, 27_000]);
  });
});

describe('0.4–0.5 — mismatch warnings and rates', () => {
  const noRounding = (items: MismatchItem[]) => items.every((m) => !describeMismatch(m).vi.includes('làm tròn'));
  const sortedByGap = (items: MismatchItem[]) => items.every((m, i) => i === 0 || items[i - 1].gap >= m.gap);

  it.skipIf(!existsSync(NEW_WORKBOOK))('flags every disagreement in red, largest first (inconsistent file)', async () => {
    const ds = await summaryWorkspace(NEW_WORKBOOK);
    const range = datasetDateBounds(ds)!;
    const m = computeKpis(ds, { range }).metrics;
    // KPI card: both numbers, never "rounding".
    expect(m.gmv.mismatch).toMatchObject({ used: { value: 78_626_020 }, other: { value: 63_713_950 } });
    expect(m.gmv.warning?.vi).toContain('Dữ liệu không khớp');
    expect(m.gmv.warning?.vi).not.toContain('làm tròn');
    expect(m.cvr.mismatch!.other.value).toBeCloseTo(0.0597, 10);
    // Distinct counts are never compared with a sum of days.
    expect(m.visits.mismatch).toBeUndefined();
    expect(m.buyers.mismatch).toBeUndefined();
    // Chart total (days) ≠ KPI (period row).
    expect(dailySeries(ds, { range }).reduce((s, p) => s + (p.gmv ?? 0), 0)).toBe(63_713_950);

    const mix = channelMix(ds, { range });
    expect(mix.mismatches.length).toBeGreaterThan(3);
    expect(sortedByGap(mix.mismatches) && noRounding(mix.mismatches)).toBe(true);
    // Printed CTR / CVR of the products vs recomputed (1.2).
    const prod = summaryProducts(ds, { range }).mismatches;
    const ctr = prod.find((x) => x.key.endsWith('|26061744778|CTR'))!;
    const cvr = prod.find((x) => x.key.endsWith('|26061744778|CVR'))!;
    expect([ctr.used.value, ctr.other.value, cvr.used.value, cvr.other.value].map((v) => Math.round(v * 10_000) / 100)).toEqual([2.61, 4.08, 3.45, 4.02]);
    // Printed ROAS vs revenue ÷ spend.
    const ads = adsIntelligence(ds, { range }).mismatches;
    expect(ads.find((x) => x.key.startsWith('roas|') && x.label.vi.startsWith('Quảng cáo GMV tối đa'))).toMatchObject({ used: { value: 55_227_941 / 5_229_292 } });
    expect(sortedByGap(ads)).toBe(true);
    // The Dolphin data alert lists the three largest gaps.
    const alert = buildDailyBrief(ds, '2026-08-21').alerts.find((a) => a.type === 'data_period_mismatch')!;
    expect(alert.title.vi).toContain('Dữ liệu không khớp');
    expect(alert.message.vi).toMatch(/Và \d+ chỗ khác/);
  });

  it.skipIf(!existsSync(WORKBOOK))('shows no mismatch at all for a clean export', async () => {
    const ds = await summaryWorkspace(WORKBOOK);
    const range = datasetDateBounds(ds)!;
    const m = computeKpis(ds, { range }).metrics;
    expect(Object.values(m).filter((x) => x.mismatch)).toEqual([]);
    expect(channelMix(ds, { range }).mismatches).toEqual([]);
    expect(channelMix(ds, { range }, 'paid').mismatches).toEqual([]);
    expect(summaryProducts(ds, { range }).mismatches).toEqual([]);
    expect(adsIntelligence(ds, { range }).mismatches).toEqual([]);
    expect(subsidyDependence(ds, { range }).mismatches).toEqual([]);
    expect(buildDailyBrief(ds, '2026-08-21').alerts.filter((a) => a.type === 'data_period_mismatch' || a.type === 'data_cvr_mismatch')).toEqual([]);
  });

  it('never shows a share above 100% and never a per-viewer count as %', () => {
    expect(fmtShare(20 / 14)).toBe('—');
    expect(fmtShare(0.049)).toBe('4,9%');
    expect(fmtPerViewer(13 / 6)).toBe('2,17 nhấp/người xem');
  });
});

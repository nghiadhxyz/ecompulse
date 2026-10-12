import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { detectKeywordReport, importKeywordReport, parseMatchType } from '../importers/keywordReport';
import { detectTableReport } from '../importers/reportImporters';
import { detectReport, type WorkbookInput } from '../importers/orderExport';
import { keywordIntelligence, KW_MIN_CLICKS } from '../keywordEngine';
import { mergeIntoWorkspace, withCostSettings } from '../workspace';
import { emptyDataset, type CanonicalDataset, type KeywordPerformance } from '../model';
import { enumerateDays } from '../period';

function run(input: WorkbookInput) {
  const d = detectKeywordReport(input);
  if (!d) throw new Error('not detected');
  return importKeywordReport(input, d);
}

const HEADER = ['#', 'Tên Dịch vụ Hiển thị', 'Mã sản phẩm', 'SKU', 'Từ khóa', 'Loại đối sánh', 'Giá thầu (VND)', 'Thứ hạng trung bình', 'Số lượt xem', 'Số lượt click', 'Tỷ lệ click', 'Lượt chuyển đổi', 'Sản phẩm đã bán', 'GMV', 'Chi phí', 'ROAS'];

describe('keyword report import', () => {
  const periodFile: WorkbookInput = {
    fileName: 'Shopee-Tu-khoa.xlsx',
    sheets: [
      {
        name: 'Từ khóa',
        rows: [
          ['Tên Shop', 'Shop A'],
          ['Khoảng thời gian', '01/09/2026 - 30/09/2026'],
          [],
          HEADER,
          [1, 'Tìm kiếm · Serum', '111', 'SERUM', 'serum b5', 'Đối sánh rộng', '1.500', '3,2', '10.000', '300', '3,00%', '12', '13', '3.600.000', '450.000', '8,00'],
          [2, 'Tìm kiếm · Serum', '111', 'SERUM', 'serum', 'Đối sánh chính xác', 900, '-', 0, 0, '-', 0, 0, 0, 0, '-'],
          ['Tổng', '', '', '', '', '', '', '', '10.000', '300', '', '12', '', '3.600.000', '450.000', ''],
        ],
      },
    ],
  };

  it('reads a period keyword export as period totals, recomputing nothing from the rate columns', () => {
    const r = run(periodFile);
    expect(r.kind).toBe('keywords');
    expect(r.platform).toBe('shopee');
    expect(r.periodTotals).toBe(true);
    expect(r.period).toEqual({ start: '2026-09-01', end: '2026-09-30' });
    expect(r.dataset.keywords).toHaveLength(2); // total row skipped
    expect(r.dataset.keywords![0]).toMatchObject({
      date: '2026-09-30',
      periodStart: '2026-09-01',
      keyword: 'serum b5',
      matchType: 'broad',
      adName: 'Tìm kiếm · Serum',
      sku: 'SERUM',
      bid: 1500,
      avgPosition: 3.2,
      impressions: 10_000,
      clicks: 300,
      orders: 12,
      units: 13,
      gmv: 3_600_000,
      spend: 450_000,
    });
    expect(r.dataset.keywords![1].avgPosition).toBeUndefined(); // "-" is no data, not 0
    expect(r.dataset.ads).toHaveLength(0);
  });

  it('wins over the generic Ads importer, which would read the same file as ad rows', () => {
    // Without the keyword importer the file looks like an Ads report and its spend would be added to Ads.
    expect(detectTableReport(periodFile)?.spec.kind).toBe('ads');
    expect(detectKeywordReport(periodFile)).not.toBeNull();
    // An ordinary Ads report is not a keyword report.
    const adsOnly: WorkbookInput = {
      fileName: 'Shopee-Ads.csv',
      sheets: [{ name: 's', rows: [['Tên quảng cáo', 'Loại quảng cáo', 'Số lượt xem', 'Số lượt click', 'Lượt chuyển đổi', 'Doanh số', 'Chi phí'], ['A', 'Tìm kiếm', 1, 1, 1, 1, 1]] }],
    };
    expect(detectKeywordReport(adsOnly)).toBeNull();
  });

  it('imports only the by-day sheet when the file also has the period sheet, plus the planner sheet', () => {
    const r = run({
      fileName: 'kw.xlsx',
      sheets: [
        { name: 'Huong_dan', rows: [['Báo cáo từ khóa — dữ liệu giả lập']] },
        { name: 'Tong_hop', rows: [['Khoảng thời gian', '01/09/2026 - 02/09/2026'], [], HEADER.slice(1), ['Ad', '1', 'S1', 'kw a', 'Đối sánh rộng', 1000, 2, 100, 10, '10%', 1, 1, 50_000, 9_000, 5.5]] },
        {
          name: 'Theo_ngay',
          rows: [
            ['Ngày', 'Tên Dịch vụ Hiển thị', 'SKU', 'Từ khóa', 'Loại đối sánh', 'Giá thầu', 'Số lượt xem', 'Số lượt click', 'Lượt chuyển đổi', 'GMV', 'Chi phí'],
            ['01/09/2026', 'Ad', 'S1', 'kw a', 'Đối sánh rộng', 1000, 40, 4, 0, 0, 3_600],
            ['02/09/2026', 'Ad', 'S1', 'kw a', 'Đối sánh rộng', 1000, 60, 6, 1, 50_000, 5_400],
          ],
        },
        {
          name: 'Goi_y',
          rows: [
            ['Từ khóa', 'Lượt tìm kiếm (30 ngày gần nhất)', 'Lượt tìm kiếm (30 ngày trước)', 'Giá thầu đề xuất (VND)', 'Trạng thái'],
            ['kw a', '12.000', '10.000', 1_100, 'Đang chạy'],
            ['kw b', 5_000, 2_500, 700, 'Chưa chạy'],
          ],
        },
      ],
    });
    expect(r.periodTotals).toBe(false);
    expect(r.dataset.keywords!.map((k) => k.date)).toEqual(['2026-09-01', '2026-09-02']);
    expect(r.period).toEqual({ start: '2026-09-01', end: '2026-09-02' });
    expect(r.warnings.some((w) => w.vi.includes('Tong_hop') && w.vi.includes('cộng trùng'))).toBe(true);
    expect(r.dataset.keywordSuggestions).toEqual([
      { platform: 'shopee', keyword: 'kw a', searchVolume: 12_000, previousSearchVolume: 10_000, suggestedBid: 1_100, running: true },
      { platform: 'shopee', keyword: 'kw b', searchVolume: 5_000, previousSearchVolume: 2_500, suggestedBid: 700, running: false },
    ]);
  });

  it('skips a period report whose period cannot be found', () => {
    const r = run({ fileName: 'kw.xlsx', sheets: [{ name: 's', rows: [HEADER, [1, 'Ad', '1', 'S', 'kw', 'Đối sánh rộng', 1, 1, 1, 1, '', 0, 0, 0, 1, '']] }] });
    expect(r.dataset.keywords).toBeUndefined();
    expect(r.stats.skipped).toBe(1);
    expect(r.warnings[0].vi).toContain('không xác định được khoảng thời gian');
  });

  it('parses match types', () => {
    expect(parseMatchType('Đối sánh rộng')).toBe('broad');
    expect(parseMatchType('Exact match')).toBe('exact');
    expect(parseMatchType('Đối sánh cụm từ')).toBe('phrase');
    expect(parseMatchType('')).toBeUndefined();
  });

  it('re-importing the same file replaces keyword rows and planner rows', () => {
    const r = run(periodFile);
    const once = mergeIntoWorkspace(null, r.dataset);
    const twice = mergeIntoWorkspace(once, run(periodFile).dataset);
    expect(twice.keywords).toHaveLength(2);
  });
});

// ---------------------------------------------------------------- engine

const SEP = { start: '2026-09-01', end: '2026-09-28' };

function daily(keyword: string, perDay: Partial<KeywordPerformance> | ((i: number) => Partial<KeywordPerformance>), extra: Partial<KeywordPerformance> = {}): KeywordPerformance[] {
  return enumerateDays(SEP).map((date, i) => ({
    date,
    platform: 'shopee',
    keyword,
    adName: 'Ad',
    sku: 'SKU-A',
    matchType: 'broad',
    spend: 0,
    ...(typeof perDay === 'function' ? perDay(i) : perDay),
    ...extra,
  }));
}

function withKeywords(keywords: KeywordPerformance[], extra: Partial<CanonicalDataset> = {}): CanonicalDataset {
  return { ...emptyDataset('t', 't'), keywords, ...extra };
}

describe('keyword intelligence', () => {
  it('classifies keywords with their reasons (no COGS → fallback thresholds)', () => {
    const ds = withKeywords([
      // 28 days × 2 clicks = 56 clicks, no order → waste
      ...daily('mắm tôm', { impressions: 100, clicks: 2, orders: 0, gmv: 0, spend: 2_000 }),
      // 1 click per 4 days, no order → little data
      ...daily('quà tết', (i) => ({ impressions: 10, clicks: i % 4 === 0 ? 1 : 0, orders: 0, gmv: 0, spend: i % 4 === 0 ? 1_000 : 0 })),
      // ROAS 1 → below the 1,5 likely-loss line
      ...daily('nước mắm', { impressions: 50, clicks: 2, orders: 1, gmv: 2_000, spend: 2_000 }),
      // ROAS 20 with many orders → scale
      ...daily('ba làng', { impressions: 20, clicks: 3, orders: 1, gmv: 100_000, spend: 5_000 }),
      // Huge impressions, tiny CTR, ROAS ok → too broad
      ...daily('rộng', { impressions: 2_000, clicks: 3, orders: 1, gmv: 30_000, spend: 6_000 }),
    ]);
    const ki = keywordIntelligence(ds, { range: SEP });
    const by = Object.fromEntries(ki.rows.map((r) => [r.keyword, r]));
    expect(by['mắm tôm'].classification).toBe('waste');
    expect(by['mắm tôm'].clicks).toBeGreaterThanOrEqual(KW_MIN_CLICKS);
    expect(by['quà tết'].classification).toBe('little_data');
    expect(by['nước mắm'].classification).toBe('below_break_even');
    expect(by['ba làng'].classification).toBe('scale');
    expect(by['rộng'].classification).toBe('too_broad');
    expect(by['rộng'].reasons.some((r) => r.vi.includes('quá rộng'))).toBe(true);
    expect(ki.counts.waste).toBe(1);
    expect(ki.spendByClass.waste).toBe(56_000);
    expect(ki.totals.spend).toBe(ki.rows.reduce((s, r) => s + r.spend, 0));
    expect(ki.notes.some((n) => n.vi.includes('Chưa tính được ROAS hòa vốn'))).toBe(true);
  });

  it('uses the Settings margin for break-even when COGS are missing', () => {
    const ds = withCostSettings(withKeywords(daily('kw', { impressions: 50, clicks: 2, orders: 1, gmv: 3_000, spend: 1_000 })), { estimatedGrossMargin: 0.3, estimatedFeeRate: 0.1 });
    const row = keywordIntelligence(ds, { range: SEP }).rows[0];
    expect(row.marginIsEstimate).toBe(true);
    expect(row.breakEvenRoas).toBeCloseTo(5); // 1 / (0,3 − 0,1)
    expect(row.roas).toBeCloseTo(3);
    expect(row.classification).toBe('below_break_even');
  });

  it('measures the trend on normal days only, so a sale day does not fake growth', () => {
    const rising = daily('giảm mặn', (i) => ({ impressions: i < 14 ? 50 : 100, clicks: 2, orders: 1, gmv: 10_000, spend: 1_000 }));
    // 9.9 (auto double day) in the second half would add to growth if it were counted.
    const spike = daily('phẳng', (i) => ({ impressions: enumerateDays(SEP)[i] === '2026-09-09' ? 5_000 : 50, clicks: 2, orders: 1, gmv: 10_000, spend: 1_000 }));
    const ki = keywordIntelligence(withKeywords([...rising, ...spike]), { range: SEP });
    const by = Object.fromEntries(ki.rows.map((r) => [r.keyword, r]));
    expect(by['giảm mặn'].trend).toBeGreaterThan(0.8);
    expect(by['phẳng'].trend).toBeCloseTo(0);
    expect(ki.dailyByKey[by['giảm mặn'].key]).toHaveLength(28);
  });

  it('counts period totals only when the whole period is selected', () => {
    const row: KeywordPerformance = { date: '2026-09-28', periodStart: '2026-09-01', platform: 'shopee', keyword: 'kw', spend: 10_000, clicks: 40, orders: 2, gmv: 50_000 };
    const ds = withKeywords([row]);
    expect(keywordIntelligence(ds, { range: SEP }).rows).toHaveLength(1);
    const partial = keywordIntelligence(ds, { range: { start: '2026-09-10', end: '2026-09-28' } });
    expect(partial.rows).toHaveLength(0);
    expect(partial.periodRowsOutside).toBe(1);
  });

  it('scores planner keywords: demand, growth and bid-based competition', () => {
    const ds = withKeywords(daily('nước mắm', { impressions: 100, clicks: 3, orders: 1, gmv: 10_000, spend: 1_000 }), {
      keywordSuggestions: [
        { platform: 'shopee', keyword: 'nước mắm', searchVolume: 180_000, previousSearchVolume: 180_000, suggestedBid: 1_900 },
        { platform: 'shopee', keyword: 'nước mắm cho bé', searchVolume: 24_000, previousSearchVolume: 15_000, suggestedBid: 900, running: false },
        { platform: 'shopee', keyword: 'nước mắm phú quốc', searchVolume: 60_000, previousSearchVolume: 60_000, suggestedBid: 2_400, running: false },
        { platform: 'shopee', keyword: 'mắm tôm', searchVolume: 50_000, previousSearchVolume: 60_000, suggestedBid: 1_200, running: false },
      ],
    });
    const ki = keywordIntelligence(ds, { range: SEP });
    const by = Object.fromEntries(ki.opportunities.map((o) => [o.keyword, o]));
    expect(ki.medianSuggestedBid).toBe(1_550);
    expect(by['nước mắm'].running).toBe(true); // bid on in the keyword rows
    expect(by['nước mắm'].performance).not.toBeNull();
    expect(by['nước mắm cho bé']).toMatchObject({ verdict: 'new', competition: 'low' });
    expect(by['nước mắm cho bé'].growth).toBeCloseTo(0.6);
    expect(by['nước mắm phú quốc']).toMatchObject({ verdict: 'crowded', competition: 'high' });
    expect(by['mắm tôm'].verdict).toBe('declining');
    for (const o of ki.opportunities) expect(o.score).toBeGreaterThanOrEqual(0);
    expect(ki.opportunities[0].score).toBeGreaterThanOrEqual(ki.opportunities[ki.opportunities.length - 1].score!);
  });

  it('is unavailable without keyword data', () => {
    expect(keywordIntelligence(emptyDataset('t', 't'), { range: SEP }).available).toBe(false);
  });
});

// ---------------------------------------------------------------- demo workbook

/** Simulated Shopee keyword export for the sample shop (samples/, not committed). */
const DEMO = resolve(__dirname, '../../../samples/Shopee_Ads_Tu_khoa_demo.xlsx');

describe.skipIf(!existsSync(DEMO))('demo keyword workbook', () => {
  it('is recognised as a keyword report and keeps the planted cases', () => {
    const wb = XLSX.read(readFileSync(DEMO), { dense: true });
    const input: WorkbookInput = {
      fileName: 'Shopee_Ads_Tu_khoa_demo.xlsx',
      sheets: wb.SheetNames.map((name) => ({ name, rows: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: '' }) })),
    };
    expect(detectReport(input).kind).not.toBe('orders');
    const r = run(input);
    expect(r.periodTotals).toBe(false);
    expect(r.period).toEqual({ start: '2026-07-24', end: '2026-08-22' });
    expect(r.dataset.keywords).toHaveLength(19 * 30);
    expect(r.dataset.keywordSuggestions).toHaveLength(28);

    const ki = keywordIntelligence(mergeIntoWorkspace(null, r.dataset), { range: r.period! });
    // The by-day sheet adds up to the period sheet.
    const sheet = input.sheets.find((s) => s.name === 'Tu_khoa_tong_hop')!;
    const header = sheet.rows.findIndex((row) => row.includes('Từ khóa'));
    const spendCol = sheet.rows[header].indexOf('Chi phí');
    const periodSpend = sheet.rows.slice(header + 1).reduce((s, row) => s + (Number(row[spendCol]) || 0), 0);
    expect(ki.totals.spend).toBe(periodSpend);

    const by = Object.fromEntries(ki.rows.map((x) => [x.keyword, x]));
    expect(by['nước mắm chinsu'].classification).toBe('waste');
    expect(by['mắm tôm'].classification).toBe('waste');
    expect(by['nước mắm phú quốc'].classification).toBe('below_break_even');
    expect(by['nước mắm ba làng'].classification).toBe('scale');
    expect(by['nước mắm giảm mặn'].trend).toBeGreaterThan(0.2);
    const opp = Object.fromEntries(ki.opportunities.map((o) => [o.keyword, o]));
    expect(opp['nước mắm cho bé'].verdict).toBe('new');
    expect(opp['nước mắm phú quốc'].competition).toBe('high');
  });
});

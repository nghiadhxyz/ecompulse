import { describe, expect, it } from 'vitest';
import { detectTableReport, importTableReport, parseDurationMinutes, detectPeriod } from '../importers/reportImporters';
import type { WorkbookInput } from '../importers/orderExport';
import { sliceDataset } from '../filters';
import { mergeIntoWorkspace, withCostSettings } from '../workspace';
import { adsSummary } from '../adsLiveEngine';
import { emptyDataset } from '../model';

function run(input: WorkbookInput) {
  const d = detectTableReport(input);
  if (!d) throw new Error('not detected');
  return importTableReport(input, d);
}

describe('ads reports', () => {
  it('Shopee Ads report without dates becomes a period total from the title row', () => {
    const r = run({
      fileName: 'Shopee-Ads.csv',
      sheets: [{
        name: 's',
        rows: [
          ['Báo cáo Quảng cáo Shopee'],
          ['Khoảng thời gian: 01/09/2025 - 30/09/2025'],
          [],
          ['Tên quảng cáo', 'Loại quảng cáo', 'Mã sản phẩm', 'Số lượt xem', 'Số lượt click', 'Lượt chuyển đổi', 'Doanh số', 'Chi phí'],
          ['Serum B5 - tìm kiếm', 'Tìm kiếm', 'SERUM-B5', '120.000', '3.000', '150', '37.350.000', '7.800.000'],
          ['Tổng', '', '', '120.000', '3.000', '150', '37.350.000', '7.800.000'],
        ],
      }],
    });
    expect(r.kind).toBe('ads');
    expect(r.platform).toBe('shopee');
    expect(r.periodTotals).toBe(true);
    expect(r.period).toEqual({ start: '2025-09-01', end: '2025-09-30' });
    expect(r.dataset.ads).toHaveLength(1); // total row skipped
    expect(r.dataset.ads[0]).toMatchObject({ date: '2025-09-30', periodStart: '2025-09-01', spend: 7_800_000, attributedRevenue: 37_350_000, sku: 'SERUM-B5' });
    expect(r.warnings[0].vi).toContain('số tổng cho cả kỳ');
  });

  it('period totals count only when the whole period is selected — never spread across days', () => {
    const r = run({
      fileName: 'ads.csv',
      sheets: [{ name: 's', rows: [['Khoảng thời gian: 01/09/2025 - 30/09/2025'], ['Tên quảng cáo', 'Số lượt click', 'Chi phí', 'Doanh số'], ['A', '10', '100000', '500000']] }],
    });
    const ds = mergeIntoWorkspace(null, r.dataset);
    expect(sliceDataset(ds, { range: { start: '2025-09-01', end: '2025-09-30' } }).ads).toHaveLength(1);
    expect(sliceDataset(ds, { range: { start: '2025-08-15', end: '2025-10-15' } }).ads).toHaveLength(1);
    expect(sliceDataset(ds, { range: { start: '2025-09-15', end: '2025-09-30' } }).ads).toHaveLength(0);
    expect(adsSummary(ds, { range: { start: '2025-09-01', end: '2025-09-30' } }).totals.roas).toBe(5);
  });

  it('reads daily TikTok ads rows', () => {
    const r = run({
      fileName: 'tiktok_ads.xlsx',
      sheets: [{ name: 's', rows: [['Date', 'Campaign name', 'Cost', 'Impressions', 'Clicks', 'Orders', 'Gross revenue'], ['2025-09-01', 'GMV Max · Nồi', '1,200,000', '50,000', '700', '8', '9,600,000'], ['2025-09-02', 'GMV Max · Nồi', '1,100,000', '48,000', '650', '6', '7,200,000']] }],
    });
    expect(r.platform).toBe('tiktok');
    expect(r.periodTotals).toBe(false);
    expect(r.dataset.ads.map((a) => a.date)).toEqual(['2025-09-01', '2025-09-02']);
    expect(r.dataset.ads[0].spend).toBe(1_200_000);
  });

  it('skips undated rows when no period can be found', () => {
    const r = run({ fileName: 'ads.csv', sheets: [{ name: 's', rows: [['Tên quảng cáo', 'Số lượt click', 'Chi phí'], ['A', '1', '100']] }] });
    expect(r.stats.imported).toBe(0);
    expect(r.warnings[0].vi).toContain('không xác định được khoảng thời gian');
  });
});

describe('live, traffic, affiliate, catalog', () => {
  it('reads a Shopee live report with start time and duration', () => {
    const r = run({
      fileName: 'shopee_live.xlsx',
      sheets: [{ name: 's', rows: [['Tiêu đề', 'Thời gian bắt đầu', 'Thời lượng', 'Người xem', 'Lượt nhấp sản phẩm', 'Thêm vào giỏ hàng', 'Đơn hàng', 'Doanh số'], ['Live tối', '27/09/2025 21:00', '02:30:00', '2.400', '260', '80', '12', '3.600.000']] }],
    });
    expect(r.kind).toBe('live');
    expect(r.dataset.liveSessions[0]).toMatchObject({ date: '2025-09-27', startTime: '21:00', durationMinutes: 150, viewers: 2400, orders: 12, gmv: 3_600_000 });
  });

  it('reads TikTok product analytics as traffic', () => {
    const r = run({
      fileName: 'tt_products.xlsx',
      sheets: [{ name: 's', rows: [['Date', 'Seller SKU', 'Product impressions', 'Product page views', 'Product clicks', 'Add-to-cart'], ['2025-09-01', 'SON-LI-03', '9000', '600', '400', '60']] }],
    });
    expect(r.kind).toBe('traffic');
    expect(r.dataset.traffic[0]).toMatchObject({ sku: 'SON-LI-03', impressions: 9000, productViews: 600, productClicks: 400, addToCart: 60 });
  });

  it('reads a TikTok creator/video report', () => {
    const r = run({
      fileName: 'tt_affiliate.xlsx',
      sheets: [{ name: 's', rows: [['Date', 'Creator username', 'Video ID', 'Video title', 'Video views', 'Product clicks', 'Orders', 'Affiliate GMV', 'Est. commission'], ['2025-09-05', 'bep_nha_minh', 'v1', 'Review nồi', '50000', '900', '20', '25,800,000', '3,096,000']] }],
    });
    expect(r.kind).toBe('affiliate');
    expect(r.dataset.affiliates[0]).toMatchObject({ creatorId: 'bep_nha_minh', contentId: 'v1', orders: 20, commission: 3_096_000 });
  });

  it('reads a catalog with category and niche, and user overrides win', () => {
    const r = run({ fileName: 'danh_muc.xlsx', sheets: [{ name: 's', rows: [['SKU', 'Tên sản phẩm', 'Ngành hàng', 'Nhóm hàng'], ['A', 'Áo', 'Thời trang', 'Áo thun'], ['B', 'Quần', 'Thời trang', 'Quần jean'], ['Tông-đơ-01', 'Tông đơ', 'Điện máy', 'Chăm sóc tóc']] }] });
    expect(r.kind).toBe('catalog');
    expect(r.catalog?.withCategory).toBe(3); // "Tông đơ" is not mistaken for a total row
    const ws = withCostSettings(mergeIntoWorkspace(emptyDataset('x', 'x'), r.dataset), { skuCategory: { B: 'Phụ kiện' } });
    expect(ws.products.find((p) => p.sku === 'A')?.subcategory).toBe('Áo thun');
    expect(ws.products.find((p) => p.sku === 'B')?.category).toBe('Phụ kiện');
  });
});

describe('helpers', () => {
  it.each([
    ['01:30:00', '', 90],
    ['1:30', '', 90],
    ['1h30m', '', 90],
    ['90', 'Thời lượng (phút)', 90],
    ['5400', 'Duration (s)', 90],
  ])('duration %s (%s) → %s min', (v, h, expected) => {
    expect(parseDurationMinutes(v, h)).toBe(expected);
  });

  it('reads the period from the file name', () => {
    expect(detectPeriod({ fileName: 'Shopee_Ads_20250901_20250930.csv', sheets: [] }, { name: 's', rows: [[]] }, 0)).toEqual({ start: '2025-09-01', end: '2025-09-30' });
  });
});

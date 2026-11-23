import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { AFFILIATE_HEADERS, applyAffiliateMapping, detectTikTokAffiliate, importTikTokAffiliate, mergeAffiliateOrders } from '../importers/tiktokAffiliate';
import { affiliateDailyReview, affiliateGroup, affiliateProductMatrix, affiliateTimeSeries, askAffiliateDolphin, groupAffiliate, reviewAffiliate, summarizeAffiliate } from '../tiktokAffiliate';
import { affiliateSettlement } from '../affiliateSettlement';
import { buildDemoCanonicalDataset } from '../../data/demoCanonicalDataset';
import { askDolphin } from '../dolphinEvidence';
import { computeKpis } from '../kpiEngine';
import { emptyDataset } from '../model';
import { mergeIntoWorkspace } from '../workspace';
import { parseShopeeExcelFile } from '../../utils/excelParser';

const fixturePath = process.env.ECOMPULSE_AFFILIATE_FIXTURE;
const header = Object.values(AFFILIATE_HEADERS);
function parseRows(rows: unknown[][]) {
  const detected = detectTikTokAffiliate([{ name: 'Any sheet', rows }]);
  expect(detected?.ambiguous).toEqual([]);
  return importTikTokAffiliate(detected!);
}
function row(overrides: Partial<Record<keyof typeof AFFILIATE_HEADERS, unknown>> = {}) {
  const fields = {
    orderId: '7701771192566925077', skuId: '7901771192566925078', currency: 'VND',
    gmv: '248.399', quantity: '1', refundedQuantity: '0',
    settlementStatus: 'Chờ xử lý', orderedAt: '24/10/2026 23:43:07', settledAt: '/',
    estimatedStandard: '12.420', estimatedShopAds: '0', actualStandard: '', actualShopAds: null,
    ...overrides,
  };
  return Object.keys(AFFILIATE_HEADERS).map((field) => fields[field as keyof typeof fields]);
}

describe('TikTok Affiliate', () => {
  it('normalizes 48 headers by name and preserves VND, local dates, long IDs and missing-cell states', () => {
    const result = parseRows([header, row()]);
    expect(result.mappedColumns).toBe(48);
    expect(result.rows[0]).toMatchObject({
      orderId: '7701771192566925077', skuId: '7901771192566925078', gmv: 248399,
      status: 'pending', orderDay: '2026-10-24', settlementDay: null, refundedQuantity: 0,
      estimatedStandard: 12420, estimatedShopAds: 0, actualStandard: null,
      missing: { settledAt: 'slash', actualStandard: 'blank', actualShopAds: 'null' },
    });
    const ambiguous = detectTikTokAffiliate([{ name: 'Affiliate', rows: [header.filter((h) => h !== 'ID SKU')] }]);
    expect(ambiguous?.ambiguous).toContain('ID SKU');
    expect(detectTikTokAffiliate([{ name: 'Affiliate', rows: [['Order ID', 'SKU ID', 'Order Status']] }])).toBeNull();
  });

  it('requires a distinct explicit mapping for an unrecognized required column', () => {
    const headers = [...header];
    const skuColumn = headers.indexOf('ID SKU');
    const renamed = headers.map((name) => name === 'ID SKU' ? 'Variant identifier' : name);
    const detected = detectTikTokAffiliate([{ name: 'Sheet', rows: [renamed, row()] }])!;
    expect(detected.needsMapping).toEqual(['skuId']);
    expect(applyAffiliateMapping(detected, { skuId: 0 })).toBeNull();
    const mapped = applyAffiliateMapping(detected, { skuId: skuColumn });
    expect(importTikTokAffiliate(mapped!).rows[0].skuId).toBe('7901771192566925078');
  });

  it('accepts optional, reordered and new columns while retaining ambiguous rate strings', () => {
    const columns = Object.keys(AFFILIATE_HEADERS) as (keyof typeof AFFILIATE_HEADERS)[];
    const order = columns.map((_, i) => i).filter((i) => !['estimatedBonus', 'actualBonus', 'estimatedBasis', 'actualBasis'].includes(columns[i])).reverse();
    const source = row({ standardRate: '7%/8%' });
    const imported = parseRows([
      [' New field ', ...order.map((i) => columns[i] === 'skuId' ? '  Mã   SKU ' : header[i])],
      ['ignored', ...order.map((i) => source[i])],
    ]);
    expect(imported.rows[0]).toMatchObject({ standardRate: null, raw: { standardRate: '7%/8%' }, missing: { standardRate: 'multiple_rates', estimatedBonus: 'absent' } });
    expect(imported.rows[0].skuId).toBe('7901771192566925078');
  });

  it('merges overlapping snapshots while retaining multi-SKU orders and preventing settlement downgrade', () => {
    const pending = parseRows([header, row(), row({ skuId: '2' })]).rows;
    const settled = parseRows([header, row({
      settlementStatus: 'Đã quyết toán', settledAt: '29/10/2026 08:26:17',
      actualStandard: '11.000', actualPit: '-200', finalReceived: '10.800',
    }), row({ orderId: 'another-order', skuId: '2' })]).rows;
    const overlap = mergeAffiliateOrders(pending, settled);
    expect(overlap.conflicts).toBe(0);
    expect(mergeAffiliateOrders(overlap.rows, pending).rows).toEqual(overlap.rows);
    expect(mergeAffiliateOrders(overlap.rows, settled).rows).toEqual(overlap.rows);
    expect(summarizeAffiliate(overlap.rows)).toMatchObject({ rows: 3, orders: 2, finalReceived: 10800, actualPit: -200 });
    expect(affiliateTimeSeries(overlap.rows).settled[0].label).toBe('2026-10-29');
    expect(mergeAffiliateOrders(overlap.rows, [{ ...settled[0], orderDay: '2026-10-25' }]).conflicts).toBe(1);
  });

  it('keeps Affiliate out of seller KPI and handles unknown and ineligible rows separately', () => {
    const seller = buildDemoCanonicalDataset();
    const affiliate = parseRows([header, row({ settlementStatus: 'Không đủ điều kiện', finalReceived: '0' }),
      row({ skuId: '2', settlementStatus: 'FutureStatus', finalReceived: '999' })]).rows;
    const range = { start: '2025-09-01', end: '2025-09-30' };
    const combined = { ...seller, tiktokAffiliateOrders: affiliate };
    const kpis = (data: typeof seller) => computeKpis(data, { range }).metrics;
    expect(kpis(combined)).toEqual(kpis(seller));
    expect(mergeIntoWorkspace(combined, emptyDataset('test', 'test')).tiktokAffiliateOrders).toEqual(affiliate);
    expect(summarizeAffiliate(affiliate)).toMatchObject({ estimated: null, finalReceived: null, status: { unknown: { rows: 1 } } });
    expect(askDolphin(combined, 'Có bao nhiêu đơn không đủ điều kiện?', { range, previousRange: range })).toMatchObject({
      intent: 'affiliate', evidence: [expect.objectContaining({ current: 1 }), expect.objectContaining({ current: 1 })],
    });
  });

  it('retains source fields when an updated settlement leaves them blank', () => {
    const previous = parseRows([header, row({ shopName: 'A', contentId: '9000000000000000123', finalReceived: 0 })]).rows;
    const incoming = parseRows([header, row({ settlementStatus: 'Đã quyết toán', settledAt: '28/10/2026 10:00:00', estimatedStandard: null })]).rows;
    expect(mergeAffiliateOrders(previous, incoming).rows[0]).toMatchObject({
      shopName: 'A', contentId: '9000000000000000123', estimatedStandard: 12420, finalReceived: null, status: 'settled',
    });
  });

  it('uses explicit settled values and signed adjustments, and excludes unknown inputs from reconciliation', () => {
    const rows = parseRows([header,
      row({ settlementStatus: 'Đã quyết toán', settledAt: '29/10/2026 10:00:00', estimatedPit: '-20', actualStandard: '100', actualPit: '-15', actualBonus: '5', finalReceived: '90' }),
      row({ skuId: '2', settlementStatus: 'Đã quyết toán', settledAt: '30/10/2026', actualStandard: '100', actualPit: '-15', actualBonus: '0', finalReceived: '90' }),
      row({ skuId: '3', settlementStatus: 'Đã quyết toán', actualStandard: '100', actualBonus: '0', finalReceived: '85' }),
      row({ skuId: '4' }),
    ]).rows;
    const finance = affiliateSettlement(rows, '2026-11-10', 14);
    expect(finance).toMatchObject({ matched: 1, differences: 1, incomplete: 1, averageDays: 5.5, coveredRows: 1, afterTax: 12400 });
    expect(finance.aging).toHaveLength(1);
    expect(summarizeAffiliate(rows).finalReceived).toBe(265);
    expect(finance.reconciliation.get(rows[1])?.difference).toBe(5);
  });

  it('flags actual settlement and coverage issues, and routes free-form file questions in an Affiliate-only workspace', () => {
    const affiliate = parseRows([header, row(), row({ skuId: '2', settlementStatus: 'Đã quyết toán', refundedQuantity: '1' }),
      row({ orderId: 'another', skuId: '3', settlementStatus: 'Không đủ điều kiện' }),
      row({ orderId: 'unknown', skuId: '4', settlementStatus: 'NewStatus' })]).rows;
    expect(reviewAffiliate(affiliate)).toHaveLength(4);
    const dataset = { ...emptyDataset('aff', 'Affiliate'), tiktokAffiliateOrders: affiliate };
    const range = { start: '2026-10-24', end: '2026-10-24' };
    const answer = askDolphin(dataset, 'File này có vấn đề gì?', { range, previousRange: range });
    expect(answer.intent).toBe('affiliate');
    expect(answer.nextChecks).toHaveLength(4);
    expect(answer.evidence.some((item) => item.label.vi.includes('thiếu số thực nhận') && item.current === 1)).toBe(true);
    expect(askAffiliateDolphin(affiliate, 'Thời tiết hôm nay?', { vi: '', en: '' }, true)).toBeNull();
  });

  it('uses the seven-day median and Seller severity thresholds without turning missing days into zero', () => {
    const rows = parseRows([header, ...Array.from({ length: 8 }, (_, index) => row({
      orderId: `order-${index}`, orderedAt: `${18 + index}/10/2026 12:00:00`,
      gmv: index === 7 ? '50.000' : index === 1 ? '900.000' : '100.000',
    }))]).rows;
    const brief = affiliateDailyReview(rows);
    expect(brief).toMatchObject({
      day: '2026-10-25', baseline: 100000, alert: { severity: 'critical', evidence: [{ current: 50000, baseline: 100000 }] },
    });
    expect(affiliateDailyReview(rows.slice(1))).toMatchObject({ baseline: null, alert: null });
    expect(affiliateDailyReview(rows.map((item, index) => index === 0 ? { ...item, gmv: null } : item))).toMatchObject({ baseline: null, alert: null });
    expect(reviewAffiliate(rows, brief.alert).find((item) => item.id === 'awaiting-settlement')?.severity).toBe('info');
  });

  it.skipIf(!fixturePath)('reconciles the original workbook and keeps it out of the classic Seller parser', async () => {
    const contents = readFileSync(fixturePath!);
    const workbook = XLSX.read(contents, { type: 'buffer' });
    const sheets = workbook.SheetNames.map((name) => ({
      name, rows: XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, raw: true, defval: null }),
    }));
    const detected = detectTikTokAffiliate(sheets)!;
    expect(detected.ambiguous).toEqual([]);
    const imported = importTikTokAffiliate(detected);
    expect(imported).toMatchObject({ mappedColumns: 48, invalid: 0, invalidValues: 0, conflicts: 0 });
    const totals = summarizeAffiliate(imported.rows);
    expect(totals).toMatchObject({
      rows: 2107, orders: 2078, gmv: 506040865, quantity: 2205, refundedQuantity: 27,
      products: 267, skus: 482, shops: 43, contents: 580, estimatedStandardAll: 41222994,
      estimatedShopAdsAll: 5171399, estimatedAll: 46394393, estimatedPitAll: -382875,
      actualStandard: 28423723, actualShopAds: 3692498, actualPit: -268537, finalReceived: 31847684,
      status: { settled: { rows: 1517 }, ineligible: { rows: 413 }, pending: { rows: 152 }, awaiting_payment: { rows: 25 } },
    });
    expect(totals.actualStandard! + totals.actualShopAds! + totals.actualPit!).toBe(totals.finalReceived);
    const { orders } = affiliateTimeSeries(imported.rows);
    expect(orders.reduce((sum, day) => sum + (day.gmv ?? 0), 0)).toBe(totals.gmv);
    expect(groupAffiliate(imported.rows, (row) => affiliateGroup(row, 'skuId')).reduce((sum, sku) => sum + (sku.gmv ?? 0), 0)).toBe(totals.gmv);
    expect(affiliateProductMatrix(imported.rows).rows.length).toBeGreaterThan(0);
    expect([orders[0].key, orders.at(-1)?.key]).toEqual(['2026-10-18', '2026-10-24']);
    const context = { vi: 'Dữ liệu file mẫu', en: 'Sample workbook' };
    for (const question of [
      'Tôi đã kiếm được bao nhiêu hoa hồng thực nhận?', 'Còn bao nhiêu hoa hồng đang chờ quyết toán?',
      'Sản phẩm nào tạo nhiều hoa hồng nhất?', 'Video hay Live đóng góp nhiều hoa hồng hơn?',
      'Cửa hàng nào mang lại hoa hồng cao nhất?', 'Có bao nhiêu đơn không đủ điều kiện?',
      'Hoa hồng thay đổi như thế nào theo thời gian?',
    ]) {
      const answer = askAffiliateDolphin(imported.rows, question, context);
      expect(answer?.evidence.length).toBeGreaterThan(0);
    }
    expect(mergeAffiliateOrders(imported.rows, imported.rows).rows).toHaveLength(2107);
    const diagnosis = askAffiliateDolphin(imported.rows, 'File này có vấn đề gì?', context, true);
    expect(diagnosis?.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ current: 413 }),
      expect.objectContaining({ current: 27 }),
      expect.objectContaining({ current: 31847684 }),
    ]));
    expect(askAffiliateDolphin(imported.rows, 'Tại sao GMV Affiliate giảm?', context)?.insight.vi).toContain('ngày đặt');
    expect(askAffiliateDolphin(imported.rows, 'Thực nhận thay đổi theo ngày thế nào?', context, true)?.insight.vi).toContain('ngày quyết toán');
    await expect(parseShopeeExcelFile(new File([new Uint8Array(contents)], 'input.xlsx'))).rejects.toThrow('TikTok Affiliate');
  });
});

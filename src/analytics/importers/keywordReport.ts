/**
 * Search-ad keyword reports: Shopee Ads "Từ khóa" exports (per ad, per keyword — for a
 * period or by day) and the keyword planner ("Gợi ý từ khóa": search volume, suggested bid).
 *
 * Checked before the generic Ads importer: a keyword export also has "Tên Dịch vụ Hiển thị",
 * "Chi phí"… and would otherwise be read as ad rows, adding its spend to the Ads totals.
 *
 * One workbook may carry the same keywords twice (a period sheet and a by-day sheet); only
 * one of them is imported — the by-day sheet when present — so nothing is counted twice.
 * Column names follow the published export layout, not verified shop files.
 */
import { emptyDataset, type KeywordMatchType, type KeywordPerformance, type KeywordSuggestion, type Platform } from '../model';
import { normalizeHeader, toIsoDate, toNumber } from '../parse';
import type { Bilingual } from '../metric';
import type { SheetInput, WorkbookInput } from './orderExport';
import { detectPeriod, type ReportImportResult } from './reportImporters';

const KEYWORD = ['Từ khóa', 'Từ khoá', 'Từ khóa/Vị trí', 'Từ khoá/Vị trí', 'Keyword', 'Keywords', 'Search term', 'Search keyword'];

const PERFORMANCE_COLUMNS: Record<string, string[]> = {
  date: ['Ngày', 'Date'],
  keyword: KEYWORD,
  match: ['Loại đối sánh', 'Match type'],
  adName: ['Tên Dịch vụ Hiển thị', 'Tên quảng cáo', 'Tên chiến dịch', 'Campaign name', 'Ad group name', 'Ad name'],
  productId: ['Mã sản phẩm', 'ID sản phẩm', 'Product ID'],
  sku: ['SKU', 'SKU sản phẩm', 'Seller SKU'],
  bid: ['Giá thầu', 'Giá thầu tối đa', 'Bid', 'Max bid'],
  position: ['Thứ hạng trung bình', 'Vị trí trung bình', 'Average position', 'Avg. rank', 'Average rank'],
  impressions: ['Số lượt xem', 'Lượt hiển thị', 'Impressions'],
  clicks: ['Số lượt click', 'Lượt click', 'Lượt nhấp', 'Clicks'],
  orders: ['Lượt chuyển đổi', 'Đơn hàng', 'Số đơn hàng', 'Conversions', 'Orders'],
  units: ['Sản phẩm đã bán', 'Items sold', 'Units sold'],
  gmv: ['GMV', 'Doanh số', 'Doanh thu', 'Gross revenue', 'Sales'],
  spend: ['Chi phí', 'Cost', 'Spend'],
};

const SUGGESTION_COLUMNS: Record<string, string[]> = {
  keyword: KEYWORD,
  volume: ['Lượt tìm kiếm (30 ngày gần nhất)', 'Lượt tìm kiếm', 'Lượng tìm kiếm', 'Search volume', 'Monthly searches'],
  previous: ['Lượt tìm kiếm (30 ngày trước)', 'Lượng tìm kiếm kỳ trước', 'Previous search volume'],
  suggestedBid: ['Giá thầu đề xuất', 'Suggested bid', 'Recommended bid'],
  status: ['Trạng thái', 'Status'],
};

/** First-cell labels of total rows. */
const TOTAL_LABELS = new Set(['tong', 'tongcong', 'total', 'grandtotal']);

interface FoundTable {
  sheet: SheetInput;
  headerRow: number;
  columns: Record<string, number>;
}

export interface DetectedKeywordReport {
  /** The keyword table that is imported (by-day preferred). */
  performance: FoundTable | null;
  /** Other keyword tables in the file, left out so nothing is counted twice. */
  skippedPerformance: FoundTable[];
  suggestions: FoundTable | null;
}

/** "Giá thầu (VND)" → "Giá thầu": a trailing unit in brackets does not change the column. */
const withoutUnit = (h: unknown) => normalizeHeader(String(h ?? '').replace(/\s*\((vnd|vnđ|đ|d|₫|%)\)\s*$/i, ''));

function resolve(headers: unknown[], columns: Record<string, string[]>): Record<string, number> {
  const norm = headers.map(normalizeHeader);
  const bare = headers.map(withoutUnit);
  const out: Record<string, number> = {};
  for (const [field, candidates] of Object.entries(columns)) {
    for (const c of candidates) {
      let i = norm.indexOf(normalizeHeader(c));
      if (i < 0) i = bare.indexOf(normalizeHeader(c));
      if (i >= 0) {
        out[field] = i;
        break;
      }
    }
  }
  return out;
}

export function detectKeywordReport(input: WorkbookInput): DetectedKeywordReport | null {
  const performance: FoundTable[] = [];
  let suggestions: FoundTable | null = null;
  for (const sheet of input.sheets) {
    for (let r = 0; r < Math.min(15, sheet.rows.length); r++) {
      const headers = sheet.rows[r] || [];
      const p = resolve(headers, PERFORMANCE_COLUMNS);
      // A keyword table: keyword + something only keyword reports have + money and clicks.
      if (p.keyword !== undefined && (p.match !== undefined || p.bid !== undefined || p.position !== undefined) && p.spend !== undefined && p.clicks !== undefined) {
        performance.push({ sheet, headerRow: r, columns: p });
        break;
      }
      const s = resolve(headers, SUGGESTION_COLUMNS);
      if (!suggestions && s.keyword !== undefined && (s.volume !== undefined || s.suggestedBid !== undefined)) {
        suggestions = { sheet, headerRow: r, columns: s };
        break;
      }
    }
  }
  if (performance.length === 0 && !suggestions) return null;
  const chosen = performance.find((t) => t.columns.date !== undefined) ?? performance[0] ?? null;
  return { performance: chosen, skippedPerformance: performance.filter((t) => t !== chosen), suggestions };
}

function platformOf(fileName: string): Platform {
  const s = normalizeHeader(fileName);
  if (s.includes('tiktok')) return 'tiktok';
  if (s.includes('lazada')) return 'lazada';
  // The column names are Shopee's: a keyword file without a platform in its name is Shopee.
  return 'shopee';
}

export function parseMatchType(value: unknown): KeywordMatchType | undefined {
  const s = normalizeHeader(value);
  if (!s) return undefined;
  if (s.includes('rong') || s.includes('broad')) return 'broad';
  if (s.includes('chinhxac') || s.includes('exact')) return 'exact';
  if (s.includes('cum') || s.includes('phrase')) return 'phrase';
  return 'other';
}

/** "Đang chạy" / "Running" → true · "Chưa chạy" / "Paused" → false. */
function parseRunning(value: unknown): boolean | undefined {
  const s = normalizeHeader(value);
  if (!s) return undefined;
  if (s.includes('chua') || s.includes('tamdung') || s.includes('not') || s.includes('paused') || s.includes('khong')) return false;
  if (s.includes('dangchay') || s.includes('running') || s.includes('active') || s.includes('dangbat')) return true;
  return undefined;
}

export function importKeywordReport(input: WorkbookInput, detected: DetectedKeywordReport): ReportImportResult {
  const platform = platformOf(input.fileName);
  const ds = emptyDataset(`import-keywords-${Date.now()}`, input.fileName);
  const warnings: Bilingual[] = [];
  const columnsUsed: Record<string, string> = {};
  let dataRows = 0;
  let imported = 0;
  let skipped = 0;
  const keywords: KeywordPerformance[] = [];
  const suggestionsOut: KeywordSuggestion[] = [];
  const perf = detected.performance;
  let period = perf ? detectPeriod(input, perf.sheet, perf.headerRow) : null;
  const periodTotals = !!perf && perf.columns.date === undefined;

  const isBlankOrTotal = (row: unknown[], headers: unknown[]) => {
    if (!row || row.every((v) => String(v ?? '').trim() === '')) return true;
    const first = normalizeHeader(row[0]);
    return first === normalizeHeader(headers[0]) || TOTAL_LABELS.has(first);
  };

  if (perf) {
    const { sheet, headerRow, columns: c } = perf;
    const headers = sheet.rows[headerRow] || [];
    const rows = sheet.rows.slice(headerRow + 1);
    const cell = (row: unknown[], f: string) => (c[f] === undefined ? undefined : row[c[f]]);
    const text = (row: unknown[], f: string) => String(cell(row, f) ?? '').trim();
    const num = (row: unknown[], f: string) => toNumber(cell(row, f));
    for (const [f, idx] of Object.entries(c)) columnsUsed[f] = String(headers[idx] ?? '');

    if (periodTotals && !period) {
      warnings.push({
        vi: 'Báo cáo từ khóa không có cột ngày và không xác định được khoảng thời gian (dòng tiêu đề hoặc tên file) — đã bỏ qua số liệu từ khóa.',
        en: 'The keyword report has no date column and no report period — keyword rows were skipped.',
      });
      dataRows += rows.length;
      skipped += rows.length;
    } else {
      for (const row of rows) {
        if (isBlankOrTotal(row, headers)) continue;
        dataRows++;
        const keyword = text(row, 'keyword');
        const spend = num(row, 'spend');
        const date = periodTotals ? period!.end : toIsoDate(cell(row, 'date'));
        if (!keyword || !date || spend === undefined) {
          skipped++;
          continue;
        }
        keywords.push({
          date,
          periodStart: periodTotals ? period!.start : undefined,
          platform,
          keyword,
          matchType: parseMatchType(cell(row, 'match')),
          adName: text(row, 'adName') || undefined,
          productId: text(row, 'productId') || undefined,
          sku: text(row, 'sku') || undefined,
          bid: num(row, 'bid'),
          avgPosition: num(row, 'position'),
          impressions: num(row, 'impressions'),
          clicks: num(row, 'clicks'),
          orders: num(row, 'orders'),
          units: num(row, 'units'),
          gmv: num(row, 'gmv'),
          spend,
        });
        imported++;
      }
      if (periodTotals && period) {
        warnings.push({
          vi: `Số liệu từ khóa là tổng cả kỳ ${period.start} → ${period.end} (không theo ngày) — chỉ được tính khi bạn xem trọn kỳ đó hoặc kỳ dài hơn, và không vẽ được xu hướng theo ngày.`,
          en: `Keyword rows are totals for ${period.start} → ${period.end} — counted only when the whole period is selected; no daily trend.`,
        });
      }
      if (!periodTotals && keywords.length > 0) {
        const dates = keywords.map((k) => k.date).sort();
        period = { start: dates[0], end: dates[dates.length - 1] };
      }
    }
  }
  if (detected.skippedPerformance.length > 0) {
    warnings.push({
      vi: `Sheet ${detected.skippedPerformance.map((t) => `"${t.sheet.name}"`).join(', ')} chứa cùng số liệu từ khóa ở dạng khác — không nhập để tránh cộng trùng.`,
      en: `Sheet(s) ${detected.skippedPerformance.map((t) => `"${t.sheet.name}"`).join(', ')} repeat the keyword data — not imported, to avoid double counting.`,
    });
  }

  const sug = detected.suggestions;
  if (sug) {
    const { sheet, headerRow, columns: c } = sug;
    const headers = sheet.rows[headerRow] || [];
    const running = new Set(keywords.map((k) => normalizeHeader(k.keyword)));
    for (const [f, idx] of Object.entries(c)) columnsUsed[`suggest.${f}`] = String(headers[idx] ?? '');
    for (const row of sheet.rows.slice(headerRow + 1)) {
      if (isBlankOrTotal(row, headers)) continue;
      dataRows++;
      const keyword = String(row[c.keyword] ?? '').trim();
      if (!keyword) {
        skipped++;
        continue;
      }
      const at = (f: string) => (c[f] === undefined ? undefined : row[c[f]]);
      suggestionsOut.push({
        platform,
        keyword,
        searchVolume: toNumber(at('volume')),
        previousSearchVolume: toNumber(at('previous')),
        suggestedBid: toNumber(at('suggestedBid')),
        running: parseRunning(at('status')) ?? (running.has(normalizeHeader(keyword)) ? true : undefined),
      });
      imported++;
    }
  }

  if (perf && keywords.length > 0 && keywords.every((k) => k.gmv === undefined)) {
    warnings.push({ vi: 'Báo cáo từ khóa không có GMV — không tính được ROAS theo từ khóa.', en: 'No GMV column — keyword ROAS unavailable.' });
  }
  if (skipped > 0) warnings.push({ vi: `${skipped} dòng thiếu từ khóa, ngày hoặc chi phí — đã bỏ qua.`, en: `${skipped} rows lacked keyword, date or spend — skipped.` });

  if (keywords.length) ds.keywords = keywords;
  if (suggestionsOut.length) ds.keywordSuggestions = suggestionsOut;
  ds.sources = [{ fileName: input.fileName, platform, reportType: 'keywords', importedAt: new Date().toISOString(), rowCount: dataRows }];
  const sheetNames = [perf?.sheet.name, sug?.sheet.name].filter(Boolean).join(' + ');
  const label = `${platform === 'tiktok' ? 'TikTok Ads' : platform === 'lazada' ? 'Lazada Ads' : 'Shopee Ads'} · ${[
    keywords.length ? 'từ khóa' : '',
    suggestionsOut.length ? 'gợi ý từ khóa' : '',
  ]
    .filter(Boolean)
    .join(' + ')}`;
  return {
    kind: 'keywords',
    platform,
    label,
    sheetName: sheetNames,
    dataset: ds,
    period,
    periodTotals,
    stats: { dataRows, imported, skipped },
    warnings,
    columnsUsed,
  };
}

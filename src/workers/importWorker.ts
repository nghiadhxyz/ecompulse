/**
 * Import worker: decodes Excel/CSV off the main thread, detects the report type and
 * maps order exports to the canonical model. The file never leaves the browser.
 * Cancel = the caller terminates the worker.
 */
import * as XLSX from 'xlsx';
import { detectReport, importOrderExport, type SheetInput } from '../analytics/importers/orderExport';
import { detectTableReport, importTableReport } from '../analytics/importers/reportImporters';
import { detectKeywordReport, importKeywordReport } from '../analytics/importers/keywordReport';
import { importShopeeSalesAnalysis } from '../analytics/importers/shopeeSalesAnalysis';
import { applyAffiliateMapping, detectTikTokAffiliate, importTikTokAffiliate, type AffiliateColumnMapping } from '../analytics/importers/tiktokAffiliate';

export type ImportWorkerRequest = { file: File; affiliateMapping?: AffiliateColumnMapping };

export type ImportWorkerMessage =
  | { type: 'progress'; stage: 'reading' | 'parsing' | 'mapping'; fraction: number }
  | { type: 'orders'; result: ReturnType<typeof importOrderExport> }
  | { type: 'report'; result: ReturnType<typeof importTableReport> }
  | { type: 'shopee_summary'; extra: ReturnType<typeof importShopeeSalesAnalysis> }
  | { type: 'tiktok_affiliate_orders'; result: ReturnType<typeof importTikTokAffiliate>; mergeConflicts?: number }
  | { type: 'tiktok_affiliate_mapping'; headers: string[]; fields: NonNullable<ReturnType<typeof detectTikTokAffiliate>>['needsMapping']; used: number[] }
  | { type: 'error'; message: { vi: string; en: string } };

// Minimal worker scope typing (the project compiles against DOM, not the webworker lib).
const ctx = self as unknown as {
  postMessage: (message: ImportWorkerMessage) => void;
  onmessage: ((e: MessageEvent<ImportWorkerRequest>) => void) | null;
};
const post = (m: ImportWorkerMessage) => ctx.postMessage(m);

ctx.onmessage = async (e: MessageEvent<ImportWorkerRequest>) => {
  const { file, affiliateMapping } = e.data;
  try {
    post({ type: 'progress', stage: 'reading', fraction: 0 });
    const buf = await file.arrayBuffer();
    post({ type: 'progress', stage: 'parsing', fraction: 0.15 });
    const isText = /\.(csv|txt|tsv)$/i.test(file.name);
    // raw for text files keeps "25/09/2025" as text (no US-style date guessing).
    const wb = XLSX.read(buf, { type: 'array', raw: isText, dense: true });
    const sheets: SheetInput[] = wb.SheetNames.map((name) => ({
      name,
      rows: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: '' }),
    }));
    post({ type: 'progress', stage: 'parsing', fraction: 0.4 });

    let affiliate = detectTikTokAffiliate(sheets);
    if (affiliate) {
      if (affiliate.needsMapping.length && !affiliateMapping) {
        const { needsMapping: fields, columns } = affiliate;
        post({
          type: 'tiktok_affiliate_mapping', fields,
          headers: affiliate.sheet.rows[affiliate.headerRow].map((cell) => String(cell ?? '')),
          used: Object.entries(columns).flatMap(([field, index]) => index >= 0 && !fields.some((f) => f === field) ? [index] : []),
        });
        return;
      }
      if (affiliateMapping) affiliate = applyAffiliateMapping(affiliate, affiliateMapping);
      if (affiliate) {
        const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[affiliate.sheet.name], { header: 1, raw: true, defval: null });
        const result = importTikTokAffiliate(affiliate, rows.slice(affiliate.headerRow + 1));
        if (!result.rows.length) {
          post({ type: 'error', message: { vi: 'Báo cáo TikTok Affiliate không có dòng VND hợp lệ.', en: 'No valid VND rows in the TikTok Affiliate report.' } });
        } else {
          post({ type: 'tiktok_affiliate_orders', result });
        }
      } else post({ type: 'error', message: { vi: 'Ánh xạ cột Affiliate không hợp lệ hoặc bị trùng.', en: 'Affiliate column mapping is invalid or duplicated.' } });
      return;
    }

    const detected = detectReport({ fileName: file.name, sheets });
    if (detected.kind === 'orders') {
      // Long numeric order IDs (TikTok) lose precision as numbers — use the displayed text.
      const idCol = detected.columns.orderId!;
      const unsafe = detected.sheet.rows.some((r) => typeof r[idCol] === 'number' && !Number.isSafeInteger(r[idCol] as number));
      if (unsafe) {
        const text = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[detected.sheet.name], { header: 1, raw: false, defval: '' });
        detected.sheet.rows.forEach((row, i) => {
          if (typeof row[idCol] === 'number') row[idCol] = text[i]?.[idCol] ?? row[idCol];
        });
      }
      const result = importOrderExport({ fileName: file.name, sheets }, detected, (f) =>
        post({ type: 'progress', stage: 'mapping', fraction: 0.4 + f * 0.6 }),
      );
      post({ type: 'orders', result });
    } else if (detected.kind === 'shopee_summary') {
      // Daily shop sheets go through the classic parser (main thread); every other sheet
      // (channels, sources, ads, products, live, video, affiliate) is read here.
      post({ type: 'progress', stage: 'mapping', fraction: 0.6 });
      post({ type: 'shopee_summary', extra: importShopeeSalesAnalysis({ fileName: file.name, sheets }) });
    } else {
      // Keyword reports first: they also carry the Ads columns and would be read as ad rows.
      const keywords = detectKeywordReport({ fileName: file.name, sheets });
      // Ads / live / traffic / affiliate reports and product catalogs.
      const table = keywords ? null : detectTableReport({ fileName: file.name, sheets });
      if (keywords) {
        post({ type: 'progress', stage: 'mapping', fraction: 0.7 });
        post({ type: 'report', result: importKeywordReport({ fileName: file.name, sheets }, keywords) });
      } else if (table) {
        post({ type: 'progress', stage: 'mapping', fraction: 0.7 });
        post({ type: 'report', result: importTableReport({ fileName: file.name, sheets }, table) });
      } else {
        post({ type: 'error', message: detected.reason });
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    post({ type: 'error', message: { vi: `Không đọc được file: ${msg}`, en: `Could not read the file: ${msg}` } });
  }
};

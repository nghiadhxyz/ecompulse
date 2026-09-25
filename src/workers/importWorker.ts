/**
 * Import worker: decodes Excel/CSV off the main thread, detects the report type and
 * maps order exports to the canonical model. The file never leaves the browser.
 * Cancel = the caller terminates the worker.
 */
import * as XLSX from 'xlsx';
import { detectReport, importCogsSheet, importOrderExport, type SheetInput } from '../analytics/importers/orderExport';

export type ImportWorkerRequest = { file: File };

export type ImportWorkerMessage =
  | { type: 'progress'; stage: 'reading' | 'parsing' | 'mapping'; fraction: number }
  | { type: 'orders'; result: ReturnType<typeof importOrderExport> }
  | { type: 'cogs'; result: ReturnType<typeof importCogsSheet> }
  | { type: 'shopee_summary' }
  | { type: 'error'; message: { vi: string; en: string } };

// Minimal worker scope typing (the project compiles against DOM, not the webworker lib).
const ctx = self as unknown as {
  postMessage: (message: ImportWorkerMessage) => void;
  onmessage: ((e: MessageEvent<ImportWorkerRequest>) => void) | null;
};
const post = (m: ImportWorkerMessage) => ctx.postMessage(m);

ctx.onmessage = async (e: MessageEvent<ImportWorkerRequest>) => {
  const { file } = e.data;
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
    } else if (detected.kind === 'cogs') {
      post({ type: 'cogs', result: importCogsSheet(detected) });
    } else if (detected.kind === 'shopee_summary') {
      post({ type: 'shopee_summary' });
    } else {
      post({ type: 'error', message: detected.reason });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    post({ type: 'error', message: { vi: `Không đọc được file: ${msg}`, en: `Could not read the file: ${msg}` } });
  }
};

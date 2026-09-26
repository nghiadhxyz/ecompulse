/**
 * Report exports — all generated in the browser from a structured Report, so every
 * format carries the same numbers. Nothing is uploaded.
 *
 * - CSV (UTF-8 with BOM, opens in Excel and Google Sheets → File → Import)
 * - Excel (.xlsx, one sheet per table, numbers kept as numbers)
 * - PDF via the browser's print dialog ("Save as PDF")
 * - Calendar (.ics) for plan events and action deadlines (Google Calendar → Import)
 */
import * as XLSX from 'xlsx';
import { cellText, type Cell, type Report } from '../analytics/reportEngine';
import type { ActionItem, MonthlyPlan } from '../analytics/planningEngine';

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function reportFileBase(r: Report): string {
  return `EcomPulse_${r.title}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^\w-]+/g, '_').slice(0, 80);
}

/** Raw value for machine formats: numbers stay numbers, ratios stay ratios (0.123). */
function rawValue(c: Cell): string | number | null {
  return 't' in c ? c.t : c.v;
}

const csvEscape = (v: string | number | null) => {
  if (v === null) return '';
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function reportToCsv(r: Report): string {
  const lines: string[] = [csvEscape(r.title), csvEscape(`Kỳ: ${r.period}`), csvEscape(`Nguồn: ${r.generatedFrom}`), ''];
  for (const s of r.summary) lines.push(csvEscape(s));
  for (const tb of r.tables) {
    lines.push('', csvEscape(tb.title), tb.columns.map(csvEscape).join(','));
    for (const row of tb.rows) lines.push(row.map((c) => csvEscape(rawValue(c))).join(','));
    for (const note of tb.notes ?? []) lines.push(csvEscape(`Ghi chú: ${note}`));
  }
  lines.push('', csvEscape('Tỷ lệ ghi dạng thập phân (0,123 = 12,3%). Ô trống = không đủ dữ liệu.'));
  return '\uFEFF' + lines.join('\r\n');
}

export function downloadCsv(r: Report) {
  download(new Blob([reportToCsv(r)], { type: 'text/csv;charset=utf-8' }), `${reportFileBase(r)}.csv`);
}

export function reportToWorkbook(r: Report): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const summary = [[r.title], [`Kỳ: ${r.period}`], [`Nguồn: ${r.generatedFrom}`], [], ...r.summary.map((s) => [s])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'Tóm tắt');
  const used = new Set<string>();
  for (const tb of r.tables) {
    const aoa: (string | number | null)[][] = [tb.columns, ...tb.rows.map((row) => row.map(rawValue)), ...(tb.notes ?? []).map((x) => [`Ghi chú: ${x}`])];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Percent format for ratio cells so Excel shows 12.3% but keeps the number.
    tb.rows.forEach((row, ri) =>
      row.forEach((c, ci) => {
        if (!('t' in c) && c.v !== null) {
          const addr = XLSX.utils.encode_cell({ r: ri + 1, c: ci });
          if (ws[addr]) ws[addr].z = c.unit === 'ratio' ? '0.0%' : c.unit === 'vnd' ? '#,##0' : c.unit === 'multiple' ? '0.00"x"' : '#,##0';
        }
      }),
    );
    let name = tb.title.replace(/[\\/?*[\]:]/g, ' ').slice(0, 28);
    while (used.has(name)) name = `${name.slice(0, 26)}_${used.size}`;
    used.add(name);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  return wb;
}

export function downloadXlsx(r: Report) {
  XLSX.writeFile(reportToWorkbook(r), `${reportFileBase(r)}.xlsx`);
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function reportToHtml(r: Report): string {
  const tables = r.tables
    .map(
      (tb) => `<h2>${esc(tb.title)}</h2><table><thead><tr>${tb.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${tb.rows
        .map((row) => `<tr>${row.map((c) => `<td class="${'t' in c ? '' : 'num'}">${esc(cellText(c))}</td>`).join('')}</tr>`)
        .join('')}</tbody></table>${(tb.notes ?? []).map((x) => `<p class="note">${esc(x)}</p>`).join('')}`,
    )
    .join('');
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(r.title)}</title><style>
body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#111;margin:24px;font-size:12px}
h1{font-size:20px;margin:0}h2{font-size:14px;margin:18px 0 6px}
.meta{color:#555;margin:4px 0 12px}ul{margin:0 0 8px;padding-left:18px}
table{border-collapse:collapse;width:100%;margin-bottom:4px}th,td{border:1px solid #ccc;padding:3px 6px;text-align:left}
th{background:#f2f4f7}td.num{text-align:right;white-space:nowrap}.note{color:#666;font-size:11px;margin:2px 0}
@page{margin:14mm}tr{page-break-inside:avoid}
</style></head><body><h1>${esc(r.title)}</h1><p class="meta">Kỳ: ${esc(r.period)} · Nguồn: ${esc(r.generatedFrom)} · Tạo bởi EcomPulse trên máy của bạn</p>
<ul>${r.summary.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>${tables}
<p class="note">"—" = không đủ dữ liệu. Nhận định chỉ mô tả số liệu đi cùng nhau, không khẳng định nguyên nhân.</p></body></html>`;
}

/** Opens the report in a print window; the user saves it as PDF from the dialog. */
export function printReport(r: Report): boolean {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open();
  w.document.write(reportToHtml(r));
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
  return true;
}

// ─── Calendar ───────────────────────────────────────────────────────────────

const icsDate = (iso: string) => iso.replace(/-/g, '');
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function planToIcs(plan: MonthlyPlan | null, actions: ActionItem[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const events: string[] = [];
  const add = (uid: string, date: string, summary: string, desc?: string) =>
    events.push(['BEGIN:VEVENT', `UID:${uid}@ecompulse`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${icsDate(date)}`, `DTEND;VALUE=DATE:${icsDate(nextDay(date))}`, `SUMMARY:${icsText(summary)}`, ...(desc ? [`DESCRIPTION:${icsText(desc)}`] : []), 'END:VEVENT'].join('\r\n'));
  for (const e of plan?.events ?? []) add(`plan-${e.id}`, e.date, e.title, `Kế hoạch tháng ${plan!.month}`);
  for (const a of actions) if (a.deadline && a.status !== 'done' && a.status !== 'dropped') add(`action-${a.id}`, a.deadline, `Hạn: ${a.title}`, [a.owner ? `Phụ trách: ${a.owner}` : '', a.insight ?? ''].filter(Boolean).join('\n'));
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//EcomPulse//Planning//VI', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR'].join('\r\n');
}

export function downloadIcs(plan: MonthlyPlan | null, actions: ActionItem[], name = 'EcomPulse_lich_ke_hoach') {
  download(new Blob([planToIcs(plan, actions)], { type: 'text/calendar;charset=utf-8' }), `${name}.ics`);
}

/**
 * Dependency-free value parsers for importers and adapters.
 * They return `undefined` for blanks/garbage so callers can keep "missing" distinct from 0.
 */
import { fromDayNumber, isIsoDate } from './period';

const EMPTY = new Set(['', '-', '--', '—', 'n/a', 'na', 'null', 'undefined']);

/**
 * Parses numbers in Vietnamese or English formatting:
 * "1.234.567 ₫" → 1234567 · "1,234,567" → 1234567 · "12,5" → 12.5 · "(1.000)" → -1000.
 * Percent signs are stripped; the caller decides whether the value is a percentage.
 */
export function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;
  let s = value.trim().toLowerCase();
  if (EMPTY.has(s)) return undefined;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[^\d.,\-]/g, '');
  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1);
  }
  if (!s || !/\d/.test(s)) return undefined;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    // Both present: the later one is the decimal separator.
    const decimal = lastDot > lastComma ? '.' : ',';
    const thousands = decimal === '.' ? ',' : '.';
    s = s.split(thousands).join('').replace(decimal, '.');
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? '.' : ',';
    const groups = s.split(sep);
    // "1.234.567" or "1,234" with 3-digit groups → thousands separators.
    const looksLikeThousands = groups.length > 2 || (groups.length === 2 && groups[1].length === 3 && groups[0].length <= 3 && groups[0] !== '0');
    s = looksLikeThousands ? groups.join('') : groups.join('.');
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return undefined;
  return negative ? -n : n;
}

/**
 * Parses a rate into a ratio: "4,90%" → 0.049 · "10,60%" → 0.106 · 0.049 → 0.049.
 * Numbers without a percent sign are read as ratios when ≤ 1, else as percentages
 * (Excel stores %-formatted cells as fractions). "-" → undefined.
 */
export function toRate(value: unknown): number | undefined {
  if (typeof value === 'string' && value.includes('%')) {
    const n = toNumber(value);
    return n === undefined ? undefined : n / 100;
  }
  const n = toNumber(value);
  if (n === undefined) return undefined;
  return Math.abs(n) <= 1 ? n : n / 100;
}

/**
 * Report period cell → {start, end}: "24-07-2026-22-08-2026" (Shopee) or
 * "01/08/2025 - 31/08/2025". Undefined for anything else.
 */
export function toIsoPeriod(value: unknown): { start: string; end: string } | undefined {
  const s = String(value ?? '').trim();
  const m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\s*[-–~]\s*(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
  if (!m) return undefined;
  const start = validIso(m[3], m[2], m[1]);
  const end = validIso(m[6], m[5], m[4]);
  return start && end && start <= end ? { start, end } : undefined;
}

/**
 * Converts common marketplace date formats to YYYY-MM-DD:
 * ISO ("2025-08-01", "2025-08-01 10:22"), "01/08/2025", "01-08-2025", "01.08.2025",
 * "2025/08/01", Excel serials (45870) and Date objects. Day-first is assumed for
 * dd/mm/yyyy, as in all Vietnamese seller-centre exports.
 */
export function toIsoDate(value: unknown): string | undefined {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 20000 || value > 80000) return undefined;
    return fromDayNumber(Math.floor(value) - 25569); // Excel serial → Unix day
  }
  if (typeof value !== 'string') return undefined;
  const s = value.trim();
  // The date must be followed by nothing or a time — "24-07-2026-22-08-2026" is a
  // period range (Shopee summary row), not a day.
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?=$|[ T]\d)/.exec(s);
  if (m) return validIso(m[1], m[2], m[3]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?=$|[ T]\d)/.exec(s);
  if (m) return validIso(m[3], m[2], m[1]);
  if (/^\d{5}(\.\d+)?$/.test(s)) return toIsoDate(Number(s));
  // Lazada: "29 Sep 2025 10:22" · "Sep 29, 2025"
  m = /^(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})(?=$|[ ,T]\d?)/.exec(s);
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()]) return validIso(m[3], MONTHS[m[2].slice(0, 3).toLowerCase()], m[1]);
  m = /^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/.exec(s);
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()]) return validIso(m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], m[2]);
  return undefined;
}

const MONTHS: Record<string, string> = {
  jan: '1', feb: '2', mar: '3', apr: '4', may: '5', jun: '6', jul: '7', aug: '8', sep: '9', oct: '10', nov: '11', dec: '12',
};

/**
 * Stable pseudonymous ID (cyrb53 hash, hex). Buyer usernames, names or phone numbers
 * are never stored — only this hash, which still links repeat purchases locally.
 */
export function pseudonymize(value: string, namespace = ''): string {
  const input = `${namespace}:${value.trim().toLowerCase()}`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hash = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return `c_${hash.toString(16).padStart(14, '0')}`;
}

function validIso(y: string, m: string, d: string): string | undefined {
  const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  return isIsoDate(iso) ? iso : undefined;
}

/** Lowercase, strip Vietnamese diacritics and non-alphanumerics — for header matching. */
export function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Finds a header by normalized candidates: exact match wins over substring match,
 * so "Số người mua" does not grab "Số người mua mới".
 */
export function findHeader(headers: string[], candidates: string[], exclude: string[] = []): string | undefined {
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  const excl = exclude.map(normalizeHeader);
  const allowed = normalized.filter((h) => !excl.some((e) => h.norm.includes(e)));
  for (const c of candidates.map(normalizeHeader)) {
    const exact = allowed.find((h) => h.norm === c);
    if (exact) return exact.raw;
  }
  for (const c of candidates.map(normalizeHeader)) {
    const partialMatch = allowed.find((h) => h.norm.includes(c));
    if (partialMatch) return partialMatch.raw;
  }
  return undefined;
}

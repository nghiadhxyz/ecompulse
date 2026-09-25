/**
 * Calendar periods and comparable-period resolution.
 *
 * All arithmetic is done on UTC day numbers so results never depend on the
 * browser timezone. Ranges are inclusive on both ends.
 */

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD, inclusive
}

export type PeriodPreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'custom';

/**
 * previous — the window of equal length right before the current one
 * dod / wow — shift back 1 / 7 days
 * mom / yoy — same calendar days one month / one year earlier (clamped to month length)
 */
export type ComparisonMode = 'previous' | 'dod' | 'wow' | 'mom' | 'yoy';

const DAY_MS = 86_400_000;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = ISO_RE.exec(value);
  if (!m) return false;
  const month = Number(m[2]);
  const day = Number(m[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(Number(m[1]), month);
}

function parts(iso: string): [number, number, number] {
  const m = ISO_RE.exec(iso);
  if (!m) throw new Error(`Invalid ISO date: ${iso}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function toDayNumber(iso: string): number {
  const [y, m, d] = parts(iso);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function fromDayNumber(n: number): string {
  const dt = new Date(n * DAY_MS);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(iso: string, days: number): string {
  return fromDayNumber(toDayNumber(iso) + days);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function rangeLength(range: DateRange): number {
  return toDayNumber(range.end) - toDayNumber(range.start) + 1;
}

export function isInRange(date: string, range: DateRange): boolean {
  return date >= range.start && date <= range.end;
}

export function enumerateDays(range: DateRange): string[] {
  const out: string[] = [];
  const end = toDayNumber(range.end);
  for (let n = toDayNumber(range.start); n <= end; n++) out.push(fromDayNumber(n));
  return out;
}

export function startOfMonth(iso: string): string {
  const [y, m] = parts(iso);
  return `${y}-${String(m).padStart(2, '0')}-01`;
}

export function endOfMonth(iso: string): string {
  const [y, m] = parts(iso);
  return `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth(y, m)).padStart(2, '0')}`;
}

export function isFullMonth(range: DateRange): boolean {
  return range.start === startOfMonth(range.start) && range.end === endOfMonth(range.start);
}

/** Shift by whole months, clamping the day to the target month's length (31/03 − 1 month → 28/02). */
export function shiftMonths(iso: string, months: number): string {
  const [y, m, d] = parts(iso);
  const total = y * 12 + (m - 1) + months;
  const ty = Math.floor(total / 12);
  const tm = (total % 12) + 1;
  const td = Math.min(d, daysInMonth(ty, tm));
  return `${ty}-${String(tm).padStart(2, '0')}-${String(td).padStart(2, '0')}`;
}

export function resolvePreset(preset: PeriodPreset, asOf: string, custom?: DateRange): DateRange {
  switch (preset) {
    case 'today':
      return { start: asOf, end: asOf };
    case 'yesterday': {
      const y = addDays(asOf, -1);
      return { start: y, end: y };
    }
    case 'last7':
      return { start: addDays(asOf, -6), end: asOf };
    case 'last30':
      return { start: addDays(asOf, -29), end: asOf };
    case 'thisMonth':
      return { start: startOfMonth(asOf), end: asOf };
    case 'lastMonth': {
      const prev = shiftMonths(startOfMonth(asOf), -1);
      return { start: prev, end: endOfMonth(prev) };
    }
    case 'custom':
      if (!custom) throw new Error('Custom preset requires a range');
      return custom.start <= custom.end ? custom : { start: custom.end, end: custom.start };
  }
}

function shiftCalendar(range: DateRange, months: number): DateRange {
  const start = shiftMonths(range.start, months);
  // A complete calendar month compares to the complete target month (Mar 1–31 → Feb 1–28).
  if (isFullMonth(range)) return { start, end: endOfMonth(start) };
  return { start, end: shiftMonths(range.end, months) };
}

export function comparableRange(range: DateRange, mode: ComparisonMode): DateRange {
  switch (mode) {
    case 'previous': {
      const len = rangeLength(range);
      return { start: addDays(range.start, -len), end: addDays(range.start, -1) };
    }
    case 'dod':
      return { start: addDays(range.start, -1), end: addDays(range.end, -1) };
    case 'wow':
      return { start: addDays(range.start, -7), end: addDays(range.end, -7) };
    case 'mom':
      return shiftCalendar(range, -1);
    case 'yoy':
      return shiftCalendar(range, -12);
  }
}

/** Comparison that matches the user's mental model for each preset. */
export function defaultComparisonMode(preset: PeriodPreset): ComparisonMode {
  switch (preset) {
    case 'today':
    case 'yesterday':
      return 'dod';
    case 'thisMonth':
    case 'lastMonth':
      return 'mom';
    default:
      return 'previous';
  }
}

/** "01–15/09/2025" or "15/09/2025" — compact Vietnamese range label. */
export function formatRangeVi(range: DateRange): string {
  const [ys, ms, ds] = parts(range.start);
  const [ye, me, de] = parts(range.end);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (range.start === range.end) return `${pad(ds)}/${pad(ms)}/${ys}`;
  if (ys === ye && ms === me) return `${pad(ds)}–${pad(de)}/${pad(me)}/${ye}`;
  if (ys === ye) return `${pad(ds)}/${pad(ms)}–${pad(de)}/${pad(me)}/${ye}`;
  return `${pad(ds)}/${pad(ms)}/${ys}–${pad(de)}/${pad(me)}/${ye}`;
}

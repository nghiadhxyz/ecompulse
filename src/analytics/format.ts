/**
 * Number formatting shared by engine messages and UI. Missing values render as "—",
 * never as 0.
 */
import type { MetricResult, MetricUnit } from './metric';

export type Lang = 'vi' | 'en';
export const DASH = '—';

function trimZeros(s: string): string {
  return s.replace(/([.,]\d*?)0+$/, '$1').replace(/[.,]$/, '');
}

/** "8,2 triệu" / "1,25 tỷ" / "350k" (vi) — "8.2M" / "1.25B" / "350K" (en). */
export function fmtMoneyCompact(v: number | null | undefined, lang: Lang = 'vi'): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH;
  const sign = v < 0 ? '−' : '';
  const a = Math.abs(v);
  const sep = lang === 'vi' ? ',' : '.';
  const num = (x: number, digits: number) => trimZeros(x.toFixed(digits)).replace('.', sep);
  if (a >= 1e9) return `${sign}${num(a / 1e9, 2)} ${lang === 'vi' ? 'tỷ' : 'B'}`;
  if (a >= 1e6) return `${sign}${num(a / 1e6, a >= 1e8 ? 0 : 1)} ${lang === 'vi' ? 'triệu' : 'M'}`;
  if (a >= 1e3) return `${sign}${Math.round(a / 1e3)}${lang === 'vi' ? 'k' : 'K'}`;
  return `${sign}${Math.round(a)}`;
}

/** Full amount: "8.200.000đ" (vi) / "8,200,000₫" (en). */
export function fmtMoney(v: number | null | undefined, lang: Lang = 'vi'): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH;
  const s = new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US').format(Math.round(v));
  return lang === 'vi' ? `${s}đ` : `${s}₫`;
}

export function fmtCount(v: number | null | undefined, lang: Lang = 'vi'): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH;
  return new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US', { maximumFractionDigits: 1 }).format(v);
}

/** Ratio → "9,2%". */
export function fmtRate(v: number | null | undefined, lang: Lang = 'vi', digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH;
  return `${(v * 100).toFixed(digits).replace('.', lang === 'vi' ? ',' : '.')}%`;
}

/** Signed relative change → "↑ 11,2%" / "↓ 3%". */
export function fmtChange(ratio: number | null | undefined, lang: Lang = 'vi'): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return DASH;
  // Changes that round to 0,0% show as flat, not as a tiny arrow.
  const arrow = Math.abs(ratio) < 0.0005 ? '→' : ratio > 0 ? '↑' : '↓';
  return `${arrow} ${fmtRate(Math.abs(ratio), lang)}`;
}

/** Percentage-point change → "+2,7pp". */
export function fmtPp(pp: number | null | undefined, lang: Lang = 'vi'): string {
  if (pp === null || pp === undefined || !Number.isFinite(pp)) return DASH;
  const sign = Math.abs(pp) < 0.05 ? '±' : pp > 0 ? '+' : '−';
  return `${sign}${Math.abs(pp).toFixed(1).replace('.', lang === 'vi' ? ',' : '.')}pp`;
}

export function fmtMultiple(v: number | null | undefined, lang: Lang = 'vi'): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH;
  return `${v.toFixed(2).replace('.', lang === 'vi' ? ',' : '.')}x`;
}

export function fmtByUnit(v: number | null | undefined, unit: MetricUnit, lang: Lang = 'vi', compact = true): string {
  switch (unit) {
    case 'vnd':
      return compact ? fmtMoneyCompact(v, lang) : fmtMoney(v, lang);
    case 'ratio':
      return fmtRate(v, lang);
    case 'multiple':
      return fmtMultiple(v, lang);
    default:
      return fmtCount(v, lang);
  }
}

export function fmtMetric(m: MetricResult, lang: Lang = 'vi', compact = true): string {
  return fmtByUnit(m.value, m.unit, lang, compact);
}

/** "29/09" from "2025-09-29". */
export function fmtDay(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

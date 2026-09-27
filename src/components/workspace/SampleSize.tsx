/** Sample-size markers (analytics/sampleSize.ts) shared by every table. */
import React from 'react';
import { fmtRate, MIN_RATE_ORDERS, SAMPLE_LABELS, sampleLevel, SMALL_RATE_NOTE, type Lang } from '../../analytics';

/** "chưa đủ mẫu" (< 3) or "tham khảo" (4–5) next to a group label. */
export const SampleTag: React.FC<{ n: number; lang: Lang }> = ({ n, lang }) => {
  const level = sampleLevel(n);
  if (level === 'ok' || n === 0) return null;
  return (
    <span className={`ml-1.5 text-[10px] font-semibold px-1 py-px rounded border ${level === 'insufficient' ? 'border-white/15 text-slate-400' : 'border-white/10 text-slate-500'}`}>
      {SAMPLE_LABELS[level][lang]}
    </span>
  );
};

/** A rate cell, dimmed and never coloured when it rests on fewer than 30 orders. */
export const SmallRateCell: React.FC<{ rate: number | null; orders: number; lang: Lang; className?: string }> = ({ rate, orders, lang, className = 'px-2.5 py-2' }) => {
  const small = orders < MIN_RATE_ORDERS;
  return (
    <td className={`${className} text-right ${small ? 'text-slate-500' : ''}`} title={small ? SMALL_RATE_NOTE[lang] : undefined}>
      {fmtRate(rate, lang)}
    </td>
  );
};

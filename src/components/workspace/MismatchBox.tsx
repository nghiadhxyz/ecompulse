/**
 * "Dữ liệu không khớp" — the file prints different values for the same figure (beyond
 * rounding). Red, the three largest gaps first, the rest behind "Xem tất cả".
 */
import React, { useState } from 'react';
import { AlertOctagon } from 'lucide-react';
import { describeMismatch, fmtMoneyCompact, MISMATCH_TITLE, type Lang, type MismatchItem } from '../../analytics';

const TOP = 3;

export const MismatchBox: React.FC<{ items: MismatchItem[]; lang: Lang; note?: string }> = ({ items, lang, note }) => {
  const [all, setAll] = useState(false);
  if (items.length === 0) return null;
  const vi = lang === 'vi';
  const shown = all ? items : items.slice(0, TOP);
  return (
    <div className="mt-3 rounded-control bg-mismatch-soft px-3 py-2.5 text-small text-mismatch" role="alert">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-mismatch">
        <AlertOctagon className="h-4 w-4" aria-hidden />
        {MISMATCH_TITLE[lang]} ({items.length})
      </div>
      <ul className="mt-1 space-y-0.5">
        {shown.map((m) => (
          <li key={m.key}>• {describeMismatch(m)[lang]}</li>
        ))}
      </ul>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-note">
        {note && <span>{note}</span>}
        {items.length > TOP && (
          <button type="button" onClick={() => setAll(!all)} className="inline-flex min-h-10 items-center font-semibold text-primary hover:underline">
            {all ? (vi ? 'Thu gọn' : 'Show less') : vi ? `Xem tất cả ${items.length}` : `Show all ${items.length}`}
          </button>
        )}
      </div>
    </div>
  );
};

/** One line under a daily chart whose total differs from the KPI card above it. */
export const ChartTotalNote: React.FC<{ chartTotal: number | null; kpi: number | null; lang: Lang; tolerance: number }> = ({ chartTotal, kpi, lang, tolerance }) => {
  if (chartTotal === null || kpi === null || Math.abs(chartTotal - kpi) <= tolerance) return null;
  return (
    <p className="mt-2 inline-flex rounded-control bg-mismatch-soft px-2.5 py-1 text-small text-mismatch">
      {lang === 'vi'
        ? `Tổng biểu đồ ${fmtMoneyCompact(chartTotal, lang)} ≠ KPI ${fmtMoneyCompact(kpi, lang)} — dữ liệu không khớp: biểu đồ cộng các ngày, thẻ KPI dùng dòng tổng cả kỳ.`
        : `Chart total ${fmtMoneyCompact(chartTotal, lang)} ≠ KPI ${fmtMoneyCompact(kpi, lang)} — the chart adds the days, the card uses the period row.`}
    </p>
  );
};

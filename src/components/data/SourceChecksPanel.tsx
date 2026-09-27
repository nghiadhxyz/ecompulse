/**
 * Where each summary-report figure comes from (canonicalSources.ts) and where the file's
 * other copies of it disagree. Invalid relations (impossible in a real export) are red.
 */
import React, { useMemo, useState } from 'react';
import { CANONICAL_SOURCES, fmtMoney, fmtOrders, SOURCE_LABELS, sourceChecks, type CanonicalDataset, type Lang, type Platform, type SourceCheck } from '../../analytics';

const fmtValue = (c: SourceCheck, v: number, lang: Lang) => (c.unit === 'vnd' ? fmtMoney(v, lang) : fmtOrders(v, lang));

export const SourceChecksPanel: React.FC<{ dataset: CanonicalDataset; lang: Lang; platforms?: Platform[]; only?: SourceCheck['metric'][] }> = ({ dataset, lang, platforms, only }) => {
  const vi = lang === 'vi';
  const all = useMemo(() => sourceChecks(dataset, platforms).filter((c) => !only || only.includes(c.metric)), [dataset, platforms, only]);
  const [showAll, setShowAll] = useState(false);
  if (all.length === 0) return null;
  const flagged = all.filter((c) => c.invalid || c.mismatch);
  const rows = showAll ? all : flagged;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-black text-white">{vi ? 'Đối chiếu nguồn số liệu' : 'Source cross-check'}</h3>
      <ul className="text-[11px] text-slate-400 space-y-0.5">
        {Object.values(CANONICAL_SOURCES).map((s) => (
          <li key={s.label.vi}>
            • <b className="text-slate-200">{s.label[lang]}</b>: {SOURCE_LABELS[s.canonical][lang]}
            {s.dailyCanonical ? (vi ? `; theo ngày / một phần kỳ: ${SOURCE_LABELS[s.dailyCanonical].vi.toLowerCase()}` : `; by day: ${SOURCE_LABELS[s.dailyCanonical].en.toLowerCase()}`) : ''}
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-300">
        {flagged.length === 0
          ? vi ? `${all.length} số liệu đã đối chiếu — các nguồn khớp nhau (trong mức làm tròn).` : `${all.length} figures checked — all sources agree.`
          : vi ? `${flagged.length}/${all.length} số liệu có nguồn khác trong file không khớp với nguồn chuẩn.` : `${flagged.length}/${all.length} figures disagree with another copy in the file.`}
        {' '}
        <button onClick={() => setShowAll(!showAll)} className="text-sky-300 underline underline-offset-2">
          {showAll ? (vi ? 'Chỉ xem chỗ lệch' : 'Only mismatches') : vi ? 'Xem tất cả' : 'Show all'}
        </button>
      </p>
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-xs">
            <thead className="bg-white/[0.04] text-slate-400">
              <tr>
                <th className="px-2.5 py-1.5 text-left">{vi ? 'Số liệu' : 'Figure'}</th>
                <th className="px-2.5 py-1.5 text-right">{vi ? 'Nguồn chuẩn' : 'Canonical'}</th>
                <th className="px-2.5 py-1.5 text-left">{vi ? 'Nguồn khác trong file' : 'Other copies'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className={`border-t border-white/5 align-top ${c.invalid ? 'bg-[#d03b3b]/[0.08]' : ''}`}>
                  <td className="px-2.5 py-1.5 text-slate-100">
                    {c.label[lang]}
                    {c.invalid && <div className="text-[11px] font-semibold text-[#f08080] mt-0.5">{vi ? 'Không hợp lệ: ' : 'Invalid: '}{c.invalid[lang]}</div>}
                  </td>
                  <td className="px-2.5 py-1.5 text-right whitespace-nowrap text-white font-semibold" title={SOURCE_LABELS[c.canonical.source][lang]}>
                    {fmtValue(c, c.canonical.value, lang)}
                  </td>
                  <td className="px-2.5 py-1.5 text-slate-300">
                    {c.others.map((o) => (
                      <div key={o.source} className={o.withinTolerance ? 'text-slate-500' : ''}>
                        {SOURCE_LABELS[o.source][lang]}: <b className={o.withinTolerance ? '' : 'text-white'}>{fmtValue(c, o.value, lang)}</b>
                        {o.withinTolerance ? (vi ? ' (khớp)' : ' (matches)') : ` (${o.diff > 0 ? '+' : '−'}${fmtValue(c, Math.abs(o.diff), lang)})`}
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

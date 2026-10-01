/**
 * Where each summary-report figure comes from (canonicalSources.ts) and where the file's
 * other copies of it disagree. Invalid relations (impossible in a real export) are red.
 */
import React, { useMemo, useState } from 'react';
import { CANONICAL_SOURCES, fmtMoney, fmtOrders, SOURCE_LABELS, sourceChecks, type CanonicalDataset, type Lang, type Platform, type SourceCheck } from '../../analytics';
import { TABLE } from '../ui/data';

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
      <h3 className="text-sm font-semibold text-fg">{vi ? 'Đối chiếu nguồn số liệu' : 'Source cross-check'}</h3>
      <ul className="space-y-0.5 text-small text-muted">
        {Object.values(CANONICAL_SOURCES).map((s) => (
          <li key={s.label.vi}>
            • <b className="font-semibold text-fg">{s.label[lang]}</b>: {SOURCE_LABELS[s.canonical][lang]}
            {s.dailyCanonical ? (vi ? `; theo ngày / một phần kỳ: ${SOURCE_LABELS[s.dailyCanonical].vi.toLowerCase()}` : `; by day: ${SOURCE_LABELS[s.dailyCanonical].en.toLowerCase()}`) : ''}
          </li>
        ))}
      </ul>
      <p className="flex flex-wrap items-center gap-x-2 text-sm text-fg">
        {flagged.length === 0
          ? vi
            ? `${all.length} số liệu đã đối chiếu — các nguồn khớp nhau (trong mức làm tròn).`
            : `${all.length} figures checked — all sources agree.`
          : vi
            ? `${flagged.length}/${all.length} số liệu có nguồn khác trong file không khớp với nguồn chuẩn.`
            : `${flagged.length}/${all.length} figures disagree with another copy in the file.`}
        <button type="button" onClick={() => setShowAll(!showAll)} className="inline-flex min-h-10 items-center font-semibold text-primary hover:underline">
          {showAll ? (vi ? 'Chỉ xem chỗ lệch' : 'Only mismatches') : vi ? 'Xem tất cả' : 'Show all'}
        </button>
      </p>
      {rows.length > 0 && (
        <div className={TABLE.frame}>
          <table className={TABLE.table}>
            <thead className={TABLE.thead}>
              <tr>
                <th scope="col" className={`${TABLE.th} text-left`}>{vi ? 'Số liệu' : 'Figure'}</th>
                <th scope="col" className={`${TABLE.th} text-right`}>{vi ? 'Nguồn chuẩn' : 'Canonical'}</th>
                <th scope="col" className={`${TABLE.th} text-left`}>{vi ? 'Nguồn khác trong file' : 'Other copies'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className={`border-t border-line align-top ${c.invalid ? 'bg-mismatch-soft' : ''}`}>
                  <td className="px-3 py-2 text-fg">
                    {c.label[lang]}
                    {c.invalid && (
                      <div className="mt-0.5 text-small font-semibold text-mismatch">
                        {vi ? 'Không hợp lệ: ' : 'Invalid: '}
                        {c.invalid[lang]}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-fg" title={SOURCE_LABELS[c.canonical.source][lang]}>
                    {fmtValue(c, c.canonical.value, lang)}
                  </td>
                  <td className="px-3 py-2 text-muted">
                    {c.others.map((o) => (
                      <div key={o.source} className={o.withinTolerance ? '' : 'text-fg'}>
                        {SOURCE_LABELS[o.source][lang]}: <b className={o.withinTolerance ? 'font-medium' : 'font-semibold text-mismatch'}>{fmtValue(c, o.value, lang)}</b>
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

/**
 * Page lead of the overview pages: the Dolphin brief exactly as the Alerts / Dolphin page
 * builds it (the day before the latest date), set as a paragraph — reused, not rewritten.
 */
import React, { useMemo } from 'react';
import { addDays, buildDailyBrief, fmtDay, type CanonicalDataset, type Lang, type Platform } from '../../analytics';
import { Button } from '../ui/primitives';

export const BriefLead: React.FC<{ dataset: CanonicalDataset; asOf: string; platforms?: Platform[]; lang: Lang; onOpen: () => void }> = ({ dataset, asOf, platforms, lang, onOpen }) => {
  const vi = lang === 'vi';
  const day = addDays(asOf, -1);
  const brief = useMemo(() => buildDailyBrief(dataset, day, platforms), [dataset, day, platforms]);
  if (!brief.summary[lang]) return null;
  return (
    <section aria-labelledby="brief-title" className="max-w-[72ch]">
      <h2 id="brief-title" className="text-small text-muted">
        {vi ? `Bản tin Dolphin ngày ${fmtDay(day)}` : `Dolphin brief, ${fmtDay(day)}`}
      </h2>
      <p className="mt-1 text-lead text-fg">{brief.summary[lang]}</p>
      {brief.limitations.length > 0 && <p className="mt-1 text-small text-muted">{brief.limitations.map((l) => l[lang]).join(' ')}</p>}
      <Button variant="ghost" className="-ml-3 mt-1" onClick={onOpen}>
        {vi ? 'Xem bản tin và cảnh báo' : 'Open the brief and alerts'}
      </Button>
    </section>
  );
};

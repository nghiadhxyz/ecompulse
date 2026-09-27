/** "Lưu ý" (grey) and "Không hợp lệ" (red) markers for odd records — analytics/dataNotices.ts. */
import React from 'react';
import { NOTICE_LABELS, NOTICE_TOOLTIP, type DataNotice, type Lang, type NoticeLevel } from '../../analytics';

export const NoticeBadge: React.FC<{ level: NoticeLevel; lang: Lang; detail?: string }> = ({ level, lang, detail }) => (
  <span
    className={`ml-1.5 inline-block text-[10px] font-bold px-1 py-px rounded border whitespace-nowrap ${level === 'invalid' ? 'border-[#d03b3b]/50 text-[#f08080] bg-[#d03b3b]/10' : 'border-white/15 text-slate-400 bg-white/[0.04]'}`}
    title={[detail, level === 'notice' ? NOTICE_TOOLTIP[lang] : undefined].filter(Boolean).join('\n')}
  >
    {NOTICE_LABELS[level][lang]}
  </span>
);

export const DataNoticesList: React.FC<{ notices: DataNotice[]; lang: Lang }> = ({ notices, lang }) => {
  if (notices.length === 0) return null;
  const sorted = [...notices].sort((a, b) => (a.level === b.level ? 0 : a.level === 'invalid' ? -1 : 1));
  return (
    <ul className="space-y-1">
      {sorted.map((n) => (
        <li key={n.id} className={`text-[11px] leading-snug ${n.level === 'invalid' ? 'text-[#f08080]' : 'text-slate-400'}`}>
          <NoticeBadge level={n.level} lang={lang} />{' '}
          <b className={n.level === 'invalid' ? 'text-[#f08080]' : 'text-slate-300'}>{n.title[lang]}</b> — {n.detail[lang]}
        </li>
      ))}
    </ul>
  );
};

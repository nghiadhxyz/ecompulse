/** "Lưu ý" (grey) and "Không hợp lệ" (red) markers for odd records — analytics/dataNotices.ts. */
import React from 'react';
import { NOTICE_LABELS, NOTICE_TOOLTIP, type DataNotice, type Lang, type NoticeLevel } from '../../analytics';
import { Badge } from '../ui/primitives';

/** Grey "Lưu ý" (Shopee's own inconsistencies) or red "Không hợp lệ" (impossible values). */
export const NoticeBadge: React.FC<{ level: NoticeLevel; lang: Lang; detail?: string }> = ({ level, lang, detail }) => (
  <Badge tone={level === 'invalid' ? 'mismatch' : 'note'} className="ml-1.5" title={[detail, level === 'notice' ? NOTICE_TOOLTIP[lang] : undefined].filter(Boolean).join('\n')}>
    {NOTICE_LABELS[level][lang]}
  </Badge>
);

export const DataNoticesList: React.FC<{ notices: DataNotice[]; lang: Lang }> = ({ notices, lang }) => {
  if (notices.length === 0) return null;
  const sorted = [...notices].sort((a, b) => (a.level === b.level ? 0 : a.level === 'invalid' ? -1 : 1));
  return (
    <ul className="space-y-1">
      {sorted.map((n) => (
        <li key={n.id} className={`text-small leading-snug ${n.level === 'invalid' ? 'text-mismatch' : 'text-muted'}`}>
          <NoticeBadge level={n.level} lang={lang} />{' '}
          <b className={n.level === 'invalid' ? 'text-mismatch' : 'text-fg'}>{n.title[lang]}</b> — {n.detail[lang]}
        </li>
      ))}
    </ul>
  );
};

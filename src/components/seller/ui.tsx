/**
 * Workspace UI helpers shared by the Seller and Analyst pages. Same names and props as
 * before; the look comes from the redesign components (src/components/ui) and tokens.
 */
import React from 'react';
import { AlertOctagon, AlertTriangle, Sparkles, Info, ChevronRight, CircleHelp } from 'lucide-react';
import type { AlertSeverity, Bilingual, CostSource, Lang, MetricComparison, MetricResult } from '../../analytics';
import { fmtByUnit } from '../../analytics';
import { Badge, Button, EmptyState, SectionCard, TONE_CLASS, type Tone } from '../ui/primitives';
import { DeltaBadge, KpiCard as KpiCardView } from '../ui/data';

export type { Lang };

export function tr(lang: Lang, v: Bilingual | string): string {
  return typeof v === 'string' ? v : v[lang];
}

/** Status colours are reserved for state and always paired with an icon + label.
 * Red is kept for data mismatches: a critical business alert is orange (down). */
const SEVERITY_TONE: Record<AlertSeverity, Tone> = { critical: 'down', warning: 'warn', opportunity: 'up', info: 'info' };
export const SEVERITY_STYLE: Record<AlertSeverity, { icon: typeof Info; label: Bilingual; text: string; ring: string; bg: string; dot: string; tone: Tone }> = {
  critical: { icon: AlertOctagon, label: { vi: 'Nghiêm trọng', en: 'Critical' }, text: 'text-down', ring: 'border-down/30', bg: 'bg-down-soft', dot: 'bg-down', tone: SEVERITY_TONE.critical },
  warning: { icon: AlertTriangle, label: { vi: 'Cần chú ý', en: 'Warning' }, text: 'text-warn', ring: 'border-warn/30', bg: 'bg-warn-soft', dot: 'bg-warn', tone: SEVERITY_TONE.warning },
  opportunity: { icon: Sparkles, label: { vi: 'Cơ hội', en: 'Opportunity' }, text: 'text-up', ring: 'border-up/30', bg: 'bg-up-soft', dot: 'bg-up', tone: SEVERITY_TONE.opportunity },
  info: { icon: Info, label: { vi: 'Thông tin', en: 'Info' }, text: 'text-info', ring: 'border-info/30', bg: 'bg-info-soft', dot: 'bg-info', tone: SEVERITY_TONE.info },
};

export const SeverityBadge: React.FC<{ severity: AlertSeverity; lang: Lang }> = ({ severity, lang }) => {
  const s = SEVERITY_STYLE[severity];
  const Icon = s.icon;
  return (
    <Badge tone={s.tone} icon={<Icon className="h-3 w-3" aria-hidden />}>
      {tr(lang, s.label)}
    </Badge>
  );
};

const SOURCE_LABEL: Record<CostSource, Bilingual> = {
  data: { vi: 'Từ dữ liệu', en: 'From data' },
  user_rate: { vi: 'Tỷ lệ bạn nhập', en: 'Your rate' },
  declared_none: { vi: 'Bạn xác nhận = 0', en: 'Confirmed 0' },
  not_applicable: { vi: 'Không phát sinh', en: 'Not applicable' },
  assumed: { vi: 'Tạm tính', en: 'Assumed' },
  missing: { vi: 'Chưa có dữ liệu', en: 'Missing' },
  unallocated: { vi: 'Chưa phân bổ', en: 'Unallocated' },
  computed: { vi: 'Tính toán', en: 'Computed' },
};

export const SourceBadge: React.FC<{ source: CostSource; lang: Lang }> = ({ source, lang }) => {
  const warn = source === 'missing' || source === 'assumed' || source === 'unallocated';
  return <Badge tone={warn ? 'warn' : 'neutral'}>{tr(lang, SOURCE_LABEL[source])}</Badge>;
};

/** Renders a metric; missing values show "Không đủ dữ liệu", never 0. */
export function metricText(m: MetricResult, lang: Lang, compact = true): string {
  if (m.value === null) return lang === 'vi' ? 'Không đủ dữ liệu' : 'Not enough data';
  return fmtByUnit(m.value, m.unit, lang, compact);
}

/** Change badge: ↑/↓ + % for amounts, pp for rates; green when good, orange when bad. */
export const DeltaChip: React.FC<{ cmp: MetricComparison; lang: Lang; goodWhenUp?: boolean }> = (props) => <DeltaBadge {...props} />;

/** KPI card (fixed height, stage tag, data flag) — see ui/data.tsx. */
export const KpiCard = KpiCardView;

/** Card with title, one-line description and tools on the right. */
export const Section: React.FC<{ title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode; id?: string }> = ({ title, subtitle, right, children, id }) => (
  <SectionCard title={title} description={subtitle} tools={right} id={id}>
    {children}
  </SectionCard>
);

export const NotEnoughData: React.FC<{ lang: Lang; reason: string; action?: React.ReactNode; title?: string }> = ({ lang, reason, action, title }) => (
  <EmptyState title={title ?? (lang === 'vi' ? 'Không đủ dữ liệu' : 'Not enough data')} reason={reason} action={action} />
);

export const EvidenceButton: React.FC<{ lang: Lang; onClick: () => void; compact?: boolean }> = ({ lang, onClick, compact }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex min-h-10 items-center gap-1 rounded-control font-semibold whitespace-nowrap text-primary hover:bg-primary-soft ${compact ? 'px-2 text-small' : 'px-3 text-sm'}`}
  >
    {lang === 'vi' ? 'Xem dữ liệu' : 'View data'} <ChevronRight className="h-3.5 w-3.5" aria-hidden />
  </button>
);

export const HelpTip: React.FC<{ text: string }> = ({ text }) => (
  <span title={text} className="inline-flex cursor-help align-middle text-muted hover:text-fg">
    <CircleHelp className="h-3.5 w-3.5" aria-label={text} />
  </span>
);

export const PrimaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = (props) => <Button variant="primary" {...props} />;

export const GhostButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = (props) => <Button variant="secondary" {...props} />;

export { TONE_CLASS };

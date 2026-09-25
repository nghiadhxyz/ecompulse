import React from 'react';
import { AlertOctagon, AlertTriangle, Sparkles, Info, Database, ChevronRight, CircleHelp } from 'lucide-react';
import type { AlertSeverity, Bilingual, CostSource, Lang, MetricComparison, MetricResult } from '../../analytics';
import { fmtByUnit, fmtPp, fmtRate } from '../../analytics';

export type { Lang };

export function tr(lang: Lang, v: Bilingual | string): string {
  return typeof v === 'string' ? v : v[lang];
}

/** Status colors are reserved for state and always paired with an icon + label. */
export const SEVERITY_STYLE: Record<AlertSeverity, { icon: typeof Info; label: Bilingual; text: string; ring: string; bg: string; dot: string }> = {
  critical: { icon: AlertOctagon, label: { vi: 'Nghiêm trọng', en: 'Critical' }, text: 'text-[#f08080]', ring: 'border-[#d03b3b]/50', bg: 'bg-[#d03b3b]/10', dot: 'bg-[#d03b3b]' },
  warning: { icon: AlertTriangle, label: { vi: 'Cần chú ý', en: 'Warning' }, text: 'text-[#fab219]', ring: 'border-[#fab219]/40', bg: 'bg-[#fab219]/10', dot: 'bg-[#fab219]' },
  opportunity: { icon: Sparkles, label: { vi: 'Cơ hội', en: 'Opportunity' }, text: 'text-[#4ade80]', ring: 'border-[#0ca30c]/50', bg: 'bg-[#0ca30c]/10', dot: 'bg-[#0ca30c]' },
  info: { icon: Info, label: { vi: 'Thông tin', en: 'Info' }, text: 'text-sky-300', ring: 'border-sky-400/30', bg: 'bg-sky-500/10', dot: 'bg-sky-400' },
};

export const SeverityBadge: React.FC<{ severity: AlertSeverity; lang: Lang }> = ({ severity, lang }) => {
  const s = SEVERITY_STYLE[severity];
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold whitespace-nowrap ${s.text} ${s.ring} ${s.bg}`}>
      <Icon className="w-3 h-3" aria-hidden /> {tr(lang, s.label)}
    </span>
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
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap ${warn ? 'text-[#fab219] border-[#fab219]/40 bg-[#fab219]/10' : 'text-slate-400 border-white/10 bg-white/[0.03]'}`}>
      {tr(lang, SOURCE_LABEL[source])}
    </span>
  );
};

/** Renders a metric; missing values show "Không đủ dữ liệu", never 0. */
export function metricText(m: MetricResult, lang: Lang, compact = true): string {
  if (m.value === null) return lang === 'vi' ? 'Không đủ dữ liệu' : 'Not enough data';
  return fmtByUnit(m.value, m.unit, lang, compact);
}

/** Delta chip: relative % for amounts, percentage points for rates. */
export const DeltaChip: React.FC<{ cmp: MetricComparison; lang: Lang; goodWhenUp?: boolean }> = ({ cmp, lang, goodWhenUp = true }) => {
  if (cmp.direction === 'unknown' || cmp.absoluteDelta === null) {
    return <span className="text-[11px] text-slate-500">{lang === 'vi' ? 'Chưa có kỳ trước để so sánh' : 'No previous period'}</span>;
  }
  const isRate = cmp.unit === 'ratio';
  const up = cmp.direction === 'up';
  const flat = cmp.direction === 'flat';
  const good = flat ? null : up === goodWhenUp;
  const color = good === null ? 'text-slate-400' : good ? 'text-[#4ade80]' : 'text-[#f08080]';
  const arrow = flat ? '→' : up ? '↑' : '↓';
  const main = isRate
    ? fmtPp(cmp.percentagePointDelta ?? null, lang)
    : cmp.percentageDelta === null
      ? lang === 'vi' ? 'mới phát sinh' : 'new'
      : `${arrow} ${fmtRate(Math.abs(cmp.percentageDelta), lang)}`;
  const abs = isRate ? null : fmtByUnit(cmp.absoluteDelta, cmp.unit, lang);
  return (
    <span className={`text-[11px] font-semibold ${color}`}>
      {main}
      {abs && <span className="text-slate-400 font-normal"> ({cmp.absoluteDelta > 0 ? '+' : ''}{abs})</span>}
    </span>
  );
};

export const KpiCard: React.FC<{
  label: string;
  metric: MetricResult;
  cmp?: MetricComparison;
  lang: Lang;
  compareLabel?: string;
  goodWhenUp?: boolean;
  sub?: React.ReactNode;
  emphasis?: boolean;
}> = ({ label, metric, cmp, lang, compareLabel, goodWhenUp, sub, emphasis }) => {
  const missing = metric.value === null;
  return (
    <div className={`rounded-2xl border p-3.5 sm:p-4 flex flex-col gap-1 min-w-0 ${emphasis ? 'border-sky-400/30 bg-sky-500/[0.06]' : 'border-white/10 bg-white/[0.03]'}`}>
      <div className="text-xs font-semibold text-slate-400 flex items-center gap-1">
        {label}
        {metric.status === 'partial' && (
          <span className="text-[10px] font-bold text-[#fab219]" title={(metric.notes || []).map((n) => n[lang]).join('\n')}>
            • {lang === 'vi' ? 'chưa đầy đủ' : 'partial'}
          </span>
        )}
      </div>
      <div className={`font-black tracking-tight truncate ${missing ? 'text-base text-slate-500' : 'text-xl sm:text-2xl text-white'}`}>{metricText(metric, lang)}</div>
      {missing && metric.notes?.[0] && <div className="text-[11px] text-slate-500 leading-snug">{metric.notes[0][lang]}</div>}
      {!missing && cmp && (
        <div className="leading-snug">
          <DeltaChip cmp={cmp} lang={lang} goodWhenUp={goodWhenUp} />
          {compareLabel && cmp.direction !== 'unknown' && <span className="text-[11px] text-slate-500"> {compareLabel}</span>}
        </div>
      )}
      {sub}
    </div>
  );
};

export const Section: React.FC<{ title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode; id?: string }> = ({ title, subtitle, right, children, id }) => (
  <section className="glass-panel rounded-2xl p-4 sm:p-5" id={id} aria-label={title}>
    <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
      <div className="min-w-0">
        <h2 className="text-base sm:text-lg font-black text-white">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
    {children}
  </section>
);

export const NotEnoughData: React.FC<{ lang: Lang; reason: string; action?: React.ReactNode }> = ({ lang, reason, action }) => (
  <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-4 text-center">
    <Database className="w-5 h-5 mx-auto text-slate-500" aria-hidden />
    <div className="text-sm font-bold text-slate-300 mt-1.5">{lang === 'vi' ? 'Không đủ dữ liệu' : 'Not enough data'}</div>
    <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">{reason}</p>
    {action && <div className="mt-3">{action}</div>}
  </div>
);

export const EvidenceButton: React.FC<{ lang: Lang; onClick: () => void; compact?: boolean }> = ({ lang, onClick, compact }) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center gap-1 rounded-lg border border-sky-400/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 font-semibold whitespace-nowrap ${compact ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1'}`}
  >
    {lang === 'vi' ? 'Xem dữ liệu' : 'View data'} <ChevronRight className="w-3 h-3" aria-hidden />
  </button>
);

export const HelpTip: React.FC<{ text: string }> = ({ text }) => (
  <span title={text} className="inline-flex text-slate-500 hover:text-slate-300 cursor-help align-middle">
    <CircleHelp className="w-3.5 h-3.5" aria-label={text} />
  </span>
);

export const PrimaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', ...props }) => (
  <button
    {...props}
    className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
  />
);

export const GhostButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', ...props }) => (
  <button
    {...props}
    className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-white/15 bg-white/[0.04] hover:bg-white/[0.1] text-slate-200 disabled:opacity-50 ${className}`}
  />
);

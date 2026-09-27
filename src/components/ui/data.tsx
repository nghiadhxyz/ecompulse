/**
 * Data display components of the light redesign: KPI cards and grid, change badges, data
 * flags with a popover, the alert stack, tables, share bars and funnel bars.
 * Presentation only — every figure comes from the analytics engines unchanged.
 */
import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Info } from 'lucide-react';
import type { Bilingual, Lang, MetricComparison, MetricResult, SummaryChannel } from '../../analytics';
import { fmtByUnit, fmtPp, fmtRate } from '../../analytics';
import { CHANNEL_COLOR } from '../../theme/chart';
import { Badge, TONE_CLASS, TONE_DOT, type Tone } from './primitives';

const t = (lang: Lang, v: Bilingual | string) => (typeof v === 'string' ? v : v[lang]);

// ------------------------------------------------------------------ change badge

/** ↑/↓ + % (or pp for rates), coloured by good/bad; the arrow always shows the direction. */
export const DeltaBadge: React.FC<{ cmp: MetricComparison; lang: Lang; goodWhenUp?: boolean }> = ({ cmp, lang, goodWhenUp = true }) => {
  const vi = lang === 'vi';
  if (cmp.direction === 'unknown' || cmp.absoluteDelta === null) return <span className="text-small text-muted">{vi ? 'Không có kỳ so sánh' : 'No comparison period'}</span>;
  const up = cmp.direction === 'up';
  const flat = cmp.direction === 'flat';
  const tone: Tone = flat ? 'neutral' : up === goodWhenUp ? 'up' : 'down';
  const arrow = flat ? '→' : up ? '↑' : '↓';
  const isRate = cmp.unit === 'ratio';
  const main = isRate
    ? fmtPp(cmp.percentagePointDelta ?? null, lang).replace(/^[+−-]/, '')
    : cmp.percentageDelta === null
      ? vi ? 'mới' : 'new'
      : fmtRate(Math.abs(cmp.percentageDelta), lang);
  const abs = isRate ? undefined : `${cmp.absoluteDelta > 0 ? '+' : '−'}${fmtByUnit(Math.abs(cmp.absoluteDelta), cmp.unit, lang)}`;
  return (
    <Badge tone={tone} title={abs}>
      <span aria-hidden>{arrow}</span>
      <span className="sr-only">{flat ? (vi ? 'không đổi' : 'flat') : up ? (vi ? 'tăng' : 'up') : vi ? 'giảm' : 'down'}</span>
      {main}
    </Badge>
  );
};

// ------------------------------------------------------------------ data flag + popover

export type FlagLevel = 'mismatch' | 'warn' | 'note';
const FLAG_LABEL: Record<FlagLevel, Bilingual> = {
  mismatch: { vi: 'Dữ liệu không khớp', en: 'Data does not match' },
  warn: { vi: 'Cần lưu ý', en: 'Check this' },
  note: { vi: 'Ghi chú', en: 'Note' },
};

/** A coloured dot in a corner; click / Enter opens the detail (two figures, gap, source). */
export const DataFlag: React.FC<{ level: FlagLevel; lang: Lang; children: React.ReactNode; label?: string }> = ({ level, lang, children, label }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const name = label ?? t(lang, FLAG_LABEL[level]);
  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={id}
        aria-label={name}
        title={name}
        className="-m-3 inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-hover"
      >
        <span className={`h-2.5 w-2.5 rounded-full ${TONE_DOT[level]}`} aria-hidden />
      </button>
      {open && (
        <div id={id} role="dialog" aria-label={name} className="absolute right-0 top-8 z-40 w-72 rounded-control border border-line bg-surface p-3 text-left shadow-card">
          <div className={`mb-1.5 inline-flex rounded-full px-2 py-0.5 text-small ${TONE_CLASS[level]}`}>{name}</div>
          <div className="text-sm text-fg">{children}</div>
        </div>
      )}
    </span>
  );
};

// ------------------------------------------------------------------ KPI card + grid

const SHORT_STAGE: Record<string, Bilingual> = {
  'Đơn đặt': { vi: 'Đặt', en: 'Placed' },
  'Đơn xác nhận': { vi: 'Xác nhận', en: 'Confirmed' },
  'Đơn đã thanh toán': { vi: 'Thanh toán', en: 'Paid' },
};

export interface KpiItem {
  key: string;
  label: string;
  metric: MetricResult;
  cmp?: MetricComparison;
  goodWhenUp?: boolean;
  /** Definition shown in the ⓘ tooltip. */
  definition?: string;
  /** What to do when the metric is missing (chip link). */
  missingAction?: { label: string; onClick: () => void };
}

/**
 * KPI card, fixed height (128px) so a row stays even: label + ⓘ, big number, comparison line.
 * Order stage as a small tag top-right; data problems as a dot that opens a popover.
 */
export const KpiCard: React.FC<{
  label: string;
  metric: MetricResult;
  cmp?: MetricComparison;
  lang: Lang;
  compareLabel?: string;
  goodWhenUp?: boolean;
  sub?: React.ReactNode;
  emphasis?: boolean;
  definition?: string;
}> = ({ label, metric, cmp, lang, compareLabel, goodWhenUp, sub, emphasis, definition }) => {
  const vi = lang === 'vi';
  const missing = metric.value === null;
  const stage = metric.basis ? SHORT_STAGE[metric.basis.vi] : undefined;
  const notes = (metric.notes ?? []).map((n) => n[lang]);
  const flag: FlagLevel | null = metric.mismatch ? 'mismatch' : metric.warning ? 'warn' : metric.status === 'partial' ? 'note' : null;
  const tip = [definition, ...notes].filter(Boolean).join('\n');
  return (
    <div className={`flex h-32 min-w-0 flex-col rounded-card border bg-surface px-4 py-3.5 shadow-card ${emphasis ? 'border-primary/40' : 'border-line'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1 text-small text-muted">
          <span className="truncate">{metric.label ? metric.label[lang] : label}</span>
          {tip && (
            <span title={tip} className="inline-flex shrink-0 cursor-help" aria-label={tip}>
              <Info className="h-3.5 w-3.5" aria-hidden />
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {stage && <span className="rounded-full bg-surface-2 px-1.5 py-px text-[11px] font-medium text-muted">{stage[lang]}</span>}
          {flag && (
            <DataFlag level={flag} lang={lang}>
              {metric.warning ? metric.warning[lang] : notes.join(' ')}
            </DataFlag>
          )}
        </div>
      </div>
      <div className={`mt-1 truncate ${missing ? 'text-base font-semibold text-muted' : 'text-kpi text-fg'}`}>
        {missing ? (vi ? 'Không đủ dữ liệu' : 'Not enough data') : fmtByUnit(metric.value, metric.unit, lang, true)}
      </div>
      <div className="mt-auto flex min-w-0 items-center gap-1.5 truncate">
        {!missing && cmp && <DeltaBadge cmp={cmp} lang={lang} goodWhenUp={goodWhenUp} />}
        {!missing && cmp && compareLabel && cmp.direction !== 'unknown' && <span className="truncate text-small text-muted">{compareLabel}</span>}
        {missing && notes[0] && <span className="truncate text-small text-muted" title={notes[0]}>{notes[0]}</span>}
        {sub && <span className="truncate text-small text-muted">{sub}</span>}
      </div>
    </div>
  );
};

/**
 * KPI grid: 2 columns on mobile, 3 ≥ 900px, 4 ≥ 1200px, 5 ≥ 1440px. Metrics without data
 * are not cards: they are gathered in one chip line at the end ("Chưa đủ dữ liệu: …").
 */
export const KpiGrid: React.FC<{ items: KpiItem[]; lang: Lang; compareLabel?: string }> = ({ items, lang, compareLabel }) => {
  const vi = lang === 'vi';
  const shown = items.filter((i) => i.metric.value !== null);
  const missing = items.filter((i) => i.metric.value === null);
  const action = missing.find((m) => m.missingAction)?.missingAction;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-4 min-[900px]:grid-cols-3 min-[1200px]:grid-cols-4 min-[1440px]:grid-cols-5">
        {shown.map((i) => (
          <KpiCard key={i.key} label={i.label} metric={i.metric} cmp={i.cmp} lang={lang} compareLabel={compareLabel} goodWhenUp={i.goodWhenUp} definition={i.definition} />
        ))}
      </div>
      {missing.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-muted">
          <span>{vi ? 'Chưa đủ dữ liệu:' : 'Not enough data:'}</span>
          <span className="text-fg" title={missing.map((m) => `${m.label}: ${m.metric.notes?.[0]?.[lang] ?? ''}`).join('\n')}>
            {missing.map((m) => m.label).join(' · ')}
          </span>
          {action && (
            <button type="button" onClick={action.onClick} className="inline-flex min-h-10 items-center font-semibold text-primary hover:underline">
              — {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ------------------------------------------------------------------ alert stack

export interface StackItem {
  id: string;
  tone: 'mismatch' | 'warn' | 'note' | 'info';
  title: React.ReactNode;
  detail?: React.ReactNode;
}
const ORDER: StackItem['tone'][] = ['mismatch', 'warn', 'note', 'info'];

/** One frame instead of stacked banners: a summary line, expandable, red → yellow → grey → info. */
export const AlertStack: React.FC<{ items: StackItem[]; lang: Lang; defaultOpen?: boolean; label?: (n: number) => string }> = ({ items, lang, defaultOpen = false, label }) => {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  if (items.length === 0) return null;
  const sorted = [...items].sort((a, b) => ORDER.indexOf(a.tone) - ORDER.indexOf(b.tone));
  const worst = sorted[0].tone;
  const summary = label ? label(items.length) : lang === 'vi' ? `${items.length} lưu ý về dữ liệu` : `${items.length} data notes`;
  return (
    <div className="rounded-card border border-line bg-surface shadow-card">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={id} className="flex min-h-11 w-full items-center gap-2 px-4 text-left">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TONE_DOT[worst]}`} aria-hidden />
        <span className="flex-1 text-sm font-semibold text-fg">{summary}</span>
        <span className="hidden gap-1 sm:flex">
          {ORDER.map((tone) => {
            const n = items.filter((i) => i.tone === tone).length;
            return n ? (
              <Badge key={tone} tone={tone}>
                {n}
              </Badge>
            ) : null;
          })}
        </span>
        <ChevronDown className={`h-4 w-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <ul id={id} className="divide-y divide-line border-t border-line">
          {sorted.map((i) => (
            <li key={i.id} className="flex gap-2.5 px-4 py-2.5">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE_DOT[i.tone]}`} aria-hidden />
              <div className="min-w-0 text-sm">
                <div className="font-semibold text-fg">{i.title}</div>
                {i.detail && <div className="mt-0.5 text-muted">{i.detail}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ------------------------------------------------------------------ tables

/** Class names for hand-written tables, so every table looks the same. */
export const TABLE = {
  frame: 'overflow-x-auto rounded-control border border-line',
  table: 'w-full border-collapse text-sm tabular',
  thead: 'sticky top-0 z-10 bg-surface-2',
  th: 'h-10 px-3 text-small font-semibold text-muted whitespace-nowrap',
  tr: 'h-11 border-t border-line hover:bg-hover',
  td: 'px-3 whitespace-nowrap',
} as const;

export const Th: React.FC<{ children?: React.ReactNode; left?: boolean; title?: string; className?: string }> = ({ children, left, title, className = '' }) => (
  <th scope="col" title={title} className={`${TABLE.th} ${left ? 'text-left' : 'text-right'} ${className}`}>
    {children}
  </th>
);

export interface Column<R> {
  key: string;
  header: React.ReactNode;
  title?: string;
  align?: 'left' | 'right';
  render: (row: R) => React.ReactNode;
  /** Value used to decide whether the column is empty (hidden when every row is null). */
  value?: (row: R) => unknown;
  /** Keep the column even when empty. */
  keepEmpty?: boolean;
  /** Text for the "…" tooltip of long names. */
  fullText?: (row: R) => string | undefined;
}

/**
 * Data table: sticky header on --surface-2, 44px rows, numbers right-aligned, first column
 * sticky with "…" + tooltip, empty columns hidden. Scrolls vertically past `maxHeight`.
 */
export function DataTable<R>({
  rows,
  columns,
  rowKey,
  lang,
  empty,
  onRowClick,
  maxHeight,
  caption,
}: {
  rows: R[];
  columns: Column<R>[];
  rowKey: (r: R, i: number) => string;
  lang: Lang;
  empty?: React.ReactNode;
  onRowClick?: (r: R) => void;
  maxHeight?: number;
  caption?: string;
}) {
  if (rows.length === 0) return <p className="rounded-control bg-surface-2 px-4 py-3 text-sm text-muted">{empty ?? (lang === 'vi' ? 'Không có dòng nào trong khoảng này.' : 'No rows in this range.')}</p>;
  const cols = columns.filter((c) => c.keepEmpty || !c.value || rows.some((r) => {
    const v = c.value!(r);
    return v !== null && v !== undefined && v !== '';
  }));
  return (
    <div className={TABLE.frame} style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}>
      <table className={TABLE.table}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className={TABLE.thead}>
          <tr>
            {cols.map((c, i) => (
              <th key={c.key} scope="col" title={c.title} className={`${TABLE.th} ${(c.align ?? (i === 0 ? 'left' : 'right')) === 'left' ? 'text-left' : 'text-right'} ${i === 0 ? 'sticky left-0 z-20 bg-surface-2' : ''}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={rowKey(r, ri)} className={`${TABLE.tr} ${onRowClick ? 'cursor-pointer' : ''}`} onClick={onRowClick ? () => onRowClick(r) : undefined}>
              {cols.map((c, i) => {
                const left = (c.align ?? (i === 0 ? 'left' : 'right')) === 'left';
                const full = c.fullText?.(r);
                return (
                  <td key={c.key} className={`${TABLE.td} ${left ? 'text-left' : 'text-right'} ${i === 0 ? 'sticky left-0 z-10 max-w-[280px] truncate bg-surface font-medium text-fg' : 'text-fg'}`} title={full}>
                    {c.render(r)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------------ share bar

/** 6px rounded bar; channel colour when given. */
export const ShareBar: React.FC<{ share: number | null; channel?: SummaryChannel; width?: number }> = ({ share, channel, width = 56 }) => (
  <span className="ml-2 inline-block h-1.5 rounded-full bg-surface-2 align-middle" style={{ width }} aria-hidden>
    <span className="block h-1.5 rounded-full" style={{ width: `${Math.max(0, Math.min(1, share ?? 0)) * 100}%`, background: channel ? CHANNEL_COLOR[channel].fill : 'var(--primary)' }} />
  </span>
);

// ------------------------------------------------------------------ funnel bars

export interface FunnelBarStep {
  key: string;
  label: string;
  value: number | null;
  /** Conversion from the previous step (null → "—"). */
  rate?: number | null;
  rateNote?: string;
  highlight?: boolean;
  format: (v: number) => string;
}

/**
 * Funnel as horizontal bars, width proportional to the value; the step rate sits between two
 * bars; steps without data collapse into one dim line.
 */
export const FunnelBars: React.FC<{ steps: FunnelBarStep[]; lang: Lang; color?: string }> = ({ steps, lang, color = 'var(--primary)' }) => {
  const vi = lang === 'vi';
  const max = Math.max(1, ...steps.map((s) => s.value ?? 0));
  return (
    <ol className="space-y-1">
      {steps.map((s, i) => {
        if (s.value === null) {
          return (
            <li key={s.key} className="flex min-h-7 items-center gap-2 px-1 text-small text-muted opacity-70">
              <span className="h-px flex-1 border-t border-dashed border-line" aria-hidden />
              {s.label} · {vi ? 'không đủ dữ liệu' : 'no data'}
            </li>
          );
        }
        const prevShown = steps.slice(0, i).some((p) => p.value !== null);
        return (
          <li key={s.key}>
            {prevShown && s.rate !== undefined && (
              <div className={`py-0.5 pl-3 text-small ${s.highlight ? 'font-semibold text-down' : 'text-muted'}`} title={s.rateNote}>
                ↓ {s.rate === null ? '—' : fmtRate(s.rate, lang, 2)} {vi ? 'chuyển tiếp' : 'convert'}
                {s.rateNote ? ` · ${s.rateNote}` : ''}
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="relative h-9 flex-1 overflow-hidden rounded-control bg-surface-2">
                <div className="h-full rounded-control border-l-4" style={{ width: `${Math.max(2, (s.value / max) * 100)}%`, background: `color-mix(in srgb, ${color} 22%, transparent)`, borderColor: color }} />
                <span className="absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-fg">{s.label}</span>
              </div>
              <span className="w-24 shrink-0 text-right text-sm font-semibold text-fg tabular">{s.format(s.value)}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, GitCompare } from 'lucide-react';
import { Tabs } from '../ui/primitives';
import type { SummaryStage } from '../../analytics';
import { formatRangeVi, PLATFORM_LABELS, type ComparisonMode, type DateRange, type Lang, type PeriodPreset, type Platform } from '../../analytics';

export type AnalystCompare = ComparisonMode | 'custom' | 'auto';

const PRESETS: { key: PeriodPreset; vi: string; en: string }[] = [
  { key: 'yesterday', vi: 'Hôm qua', en: 'Yesterday' },
  { key: 'last7', vi: '7 ngày', en: '7 days' },
  { key: 'last30', vi: '30 ngày', en: '30 days' },
  { key: 'thisMonth', vi: 'Tháng này', en: 'This month' },
  { key: 'lastMonth', vi: 'Tháng trước', en: 'Last month' },
  { key: 'custom', vi: 'Tùy chọn', en: 'Custom' },
];

const COMPARES: { key: AnalystCompare; vi: string; en: string }[] = [
  { key: 'auto', vi: 'Tự động (kỳ tương đương)', en: 'Auto (comparable period)' },
  { key: 'previous', vi: 'Kỳ liền trước', en: 'Previous period' },
  { key: 'dod', vi: 'DoD (ngày trước)', en: 'DoD' },
  { key: 'wow', vi: 'WoW (tuần trước)', en: 'WoW' },
  { key: 'mom', vi: 'MoM (tháng trước)', en: 'MoM' },
  { key: 'yoy', vi: 'YoY (năm trước)', en: 'YoY' },
  { key: 'custom', vi: 'Tự chọn kỳ so sánh', en: 'Custom comparison' },
];

interface Props {
  lang: Lang;
  bounds: DateRange;
  preset: PeriodPreset;
  onPreset: (p: PeriodPreset) => void;
  custom: DateRange;
  onCustom: (r: DateRange) => void;
  compare: AnalystCompare;
  onCompare: (c: AnalystCompare) => void;
  customCompare: DateRange;
  onCustomCompare: (r: DateRange) => void;
  range: DateRange;
  previousRange: DateRange;
  platforms: Platform[];
  onPlatforms: (p: Platform[]) => void;
  availablePlatforms: Platform[];
  categories: string[];
  onCategories: (c: string[]) => void;
  availableCategories: string[];
  /** Order stage picker, shown for summary reports only. */
  stage?: SummaryStage;
  onStage?: (s: SummaryStage) => void;
}

/** Why a filter does not apply to the current page (dimmed + tooltip). */
export interface FilterDisabled {
  compare?: string;
  platforms?: string;
  categories?: string;
  stage?: string;
}

const field = 'min-h-10 rounded-control border border-line bg-surface px-2.5 text-sm text-fg';

/** Multi-select as a small popover of checkboxes, so the bar stays on one row. */
const MultiSelect: React.FC<{ label: string; all: string; options: { key: string; label: string }[]; value: string[]; onChange: (v: string[]) => void; disabled?: string; clearLabel: string }> = ({ label, all, options, value, onChange, disabled, clearLabel }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
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
  const text = value.length === 0 ? all : value.length === 1 ? options.find((o) => o.key === value[0])?.label ?? value[0] : `${value.length}`;
  return (
    <div ref={ref} className="relative" title={disabled}>
      <button type="button" disabled={!!disabled} onClick={() => setOpen(!open)} aria-expanded={open} className={`${field} inline-flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50`}>
        <span className="text-muted">{label}:</span>
        <span className={value.length ? 'font-semibold text-primary' : ''}>{text}</span>
        <ChevronDown className="h-4 w-4 text-muted" aria-hidden />
      </button>
      {open && (
        <div role="group" aria-label={label} className="absolute left-0 top-11 z-40 min-w-56 rounded-control border border-line bg-surface p-1.5 shadow-card">
          {options.map((o) => (
            <label key={o.key} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-control px-2 text-sm text-fg hover:bg-hover">
              <input type="checkbox" className="h-4 w-4 accent-primary" checked={value.includes(o.key)} onChange={() => onChange(value.includes(o.key) ? value.filter((x) => x !== o.key) : [...value, o.key])} />
              {o.label}
            </label>
          ))}
          {value.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="mt-1 min-h-10 w-full rounded-control px-2 text-left text-sm font-semibold text-primary hover:bg-primary-soft">
              {clearLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Filter bar: sticky at the top of the content, white, one row when wide enough.
 * Left: period · middle: comparison, platform, category, order stage · right: dates in view.
 */
export const AnalystFilterBar: React.FC<Props & { disabled?: FilterDisabled }> = (p) => {
  const vi = p.lang === 'vi';
  const d = p.disabled ?? {};
  const dim = (reason?: string) => (reason ? 'opacity-50' : '');
  return (
    <div className="sticky top-16 z-20 -mx-1 rounded-card border border-line bg-surface px-3 py-2 shadow-card">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-1">
          <CalendarDays className="h-4 w-4 text-muted" aria-hidden />
          <Tabs
            label={vi ? 'Khoảng thời gian' : 'Date range'}
            value={p.preset}
            onChange={p.onPreset}
            options={PRESETS.map((x) => ({ key: x.key, label: vi ? x.vi : x.en }))}
          />
        </div>
        {p.preset === 'custom' && (
          <span className="flex items-center gap-1 text-sm text-muted">
            <input type="date" className={field} value={p.custom.start} min={p.bounds.start} max={p.bounds.end} onChange={(e) => e.target.value && p.onCustom({ ...p.custom, start: e.target.value })} aria-label={vi ? 'Từ ngày' : 'From'} />
            –
            <input type="date" className={field} value={p.custom.end} min={p.bounds.start} max={p.bounds.end} onChange={(e) => e.target.value && p.onCustom({ ...p.custom, end: e.target.value })} aria-label={vi ? 'Đến ngày' : 'To'} />
          </span>
        )}

        <div className={`flex items-center gap-1 ${dim(d.compare)}`} title={d.compare}>
          <GitCompare className="h-4 w-4 text-muted" aria-hidden />
          <label className="sr-only" htmlFor="compare-mode">{vi ? 'So sánh với' : 'Compare with'}</label>
          <select id="compare-mode" value={p.compare} disabled={!!d.compare} onChange={(e) => p.onCompare(e.target.value as AnalystCompare)} className={field}>
            {COMPARES.map((c) => (
              <option key={c.key} value={c.key}>{vi ? c.vi : c.en}</option>
            ))}
          </select>
          {p.compare === 'custom' && (
            <span className="flex items-center gap-1 text-sm text-muted">
              <input type="date" className={field} value={p.customCompare.start} max={p.bounds.end} onChange={(e) => e.target.value && p.onCustomCompare({ ...p.customCompare, start: e.target.value })} aria-label={vi ? 'Kỳ so sánh từ' : 'Compare from'} />
              –
              <input type="date" className={field} value={p.customCompare.end} max={p.bounds.end} onChange={(e) => e.target.value && p.onCustomCompare({ ...p.customCompare, end: e.target.value })} aria-label={vi ? 'Kỳ so sánh đến' : 'Compare to'} />
            </span>
          )}
        </div>

        <MultiSelect
          label={vi ? 'Sàn' : 'Platform'}
          all={vi ? 'Tất cả' : 'All'}
          options={p.availablePlatforms.map((pl) => ({ key: pl, label: PLATFORM_LABELS[pl] }))}
          value={p.platforms}
          onChange={(v) => p.onPlatforms(v as Platform[])}
          disabled={d.platforms ?? (p.availablePlatforms.length < 2 ? (vi ? 'Dữ liệu chỉ có một sàn' : 'Only one platform in the data') : undefined)}
          clearLabel={vi ? 'Tất cả sàn' : 'All platforms'}
        />
        <MultiSelect
          label={vi ? 'Ngành' : 'Category'}
          all={vi ? 'Tất cả' : 'All'}
          options={p.availableCategories.map((c) => ({ key: c, label: c }))}
          value={p.categories}
          onChange={p.onCategories}
          disabled={d.categories ?? (p.availableCategories.length === 0 ? (vi ? 'Cần file đơn hàng hoặc danh mục có ngành hàng' : 'Needs an order file or a catalog with categories') : undefined)}
          clearLabel={vi ? 'Bỏ lọc ngành' : 'Clear'}
        />
        <div className={`flex items-center gap-1 ${dim(d.stage ?? (p.stage ? undefined : 'x'))}`} title={d.stage ?? (p.stage ? undefined : vi ? 'Chỉ áp dụng cho báo cáo tổng hợp của sàn (file đơn hàng luôn tính theo đơn đặt)' : 'Summary reports only')}>
          <span className="text-small text-muted">{vi ? 'Mức đơn' : 'Orders'}</span>
          <Tabs
            label={vi ? 'Mức đơn' : 'Order stage'}
            value={p.stage ?? 'placed'}
            onChange={(s) => p.onStage?.(s)}
            options={(['placed', 'paid'] as SummaryStage[]).map((s) => ({ key: s, label: s === 'placed' ? (vi ? 'Đặt' : 'Placed') : vi ? 'Thanh toán' : 'Paid', disabled: !p.stage || !!d.stage }))}
          />
        </div>

        <span className="ml-auto text-small text-muted tabular">
          <b className="font-semibold text-fg">{formatRangeVi(p.range)}</b> {vi ? 'so với' : 'vs'} <b className="font-semibold text-fg">{formatRangeVi(p.previousRange)}</b>
        </span>
      </div>
    </div>
  );
};

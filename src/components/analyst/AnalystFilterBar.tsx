import React from 'react';
import { CalendarDays, GitCompare } from 'lucide-react';
import { OrderStagePicker } from '../workspace/OrderStagePicker';
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

const dateInput = 'bg-white/[0.06] border border-white/15 rounded-lg px-2 py-1 text-xs text-slate-100 [color-scheme:dark]';

export const AnalystFilterBar: React.FC<Props> = (p) => {
  const vi = p.lang === 'vi';
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  return (
    <div className="glass-panel rounded-2xl p-3 space-y-2.5">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={vi ? 'Khoảng thời gian' : 'Date range'}>
        <CalendarDays className="w-4 h-4 text-slate-400" aria-hidden />
        {PRESETS.map((x) => (
          <button
            key={x.key}
            onClick={() => p.onPreset(x.key)}
            aria-pressed={p.preset === x.key}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${p.preset === x.key ? 'bg-sky-600 border-sky-500 text-white' : 'border-white/10 text-slate-300 hover:bg-white/[0.06]'}`}
          >
            {vi ? x.vi : x.en}
          </button>
        ))}
        {p.preset === 'custom' && (
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <input type="date" className={dateInput} value={p.custom.start} min={p.bounds.start} max={p.bounds.end} onChange={(e) => e.target.value && p.onCustom({ ...p.custom, start: e.target.value })} aria-label={vi ? 'Từ ngày' : 'From'} />
            –
            <input type="date" className={dateInput} value={p.custom.end} min={p.bounds.start} max={p.bounds.end} onChange={(e) => e.target.value && p.onCustom({ ...p.custom, end: e.target.value })} aria-label={vi ? 'Đến ngày' : 'To'} />
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <GitCompare className="w-4 h-4 text-slate-400" aria-hidden />
        <label className="sr-only" htmlFor="compare-mode">{vi ? 'So sánh với' : 'Compare with'}</label>
        <select
          id="compare-mode"
          value={p.compare}
          onChange={(e) => p.onCompare(e.target.value as AnalystCompare)}
          className="bg-white/[0.06] border border-white/15 rounded-lg px-2 py-1 text-xs text-slate-100 [color-scheme:dark]"
        >
          {COMPARES.map((c) => (
            <option key={c.key} value={c.key}>{vi ? c.vi : c.en}</option>
          ))}
        </select>
        {p.compare === 'custom' && (
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <input type="date" className={dateInput} value={p.customCompare.start} max={p.bounds.end} onChange={(e) => e.target.value && p.onCustomCompare({ ...p.customCompare, start: e.target.value })} aria-label={vi ? 'Kỳ so sánh từ' : 'Compare from'} />
            –
            <input type="date" className={dateInput} value={p.customCompare.end} max={p.bounds.end} onChange={(e) => e.target.value && p.onCustomCompare({ ...p.customCompare, end: e.target.value })} aria-label={vi ? 'Kỳ so sánh đến' : 'Compare to'} />
          </span>
        )}
        <span className="text-[11px] text-slate-400 ml-auto">
          <b className="text-slate-100">{formatRangeVi(p.range)}</b> {vi ? 'so với' : 'vs'} <b className="text-slate-300">{formatRangeVi(p.previousRange)}</b>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label={vi ? 'Sàn' : 'Platforms'}>
          <span className="text-[11px] text-slate-500 mr-1">{vi ? 'Sàn' : 'Platform'}</span>
          {(['shopee', 'tiktok', 'lazada'] as Platform[]).map((pl) => {
            const disabled = !p.availablePlatforms.includes(pl);
            const on = p.platforms.includes(pl);
            return (
              <button
                key={pl}
                disabled={disabled}
                aria-pressed={on}
                onClick={() => p.onPlatforms(toggle(p.platforms, pl))}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${on ? 'bg-white/15 border-white/30 text-white' : 'border-white/10 text-slate-400'} disabled:opacity-30`}
              >
                {PLATFORM_LABELS[pl]}
              </button>
            );
          })}
          {p.platforms.length > 0 && (
            <button onClick={() => p.onPlatforms([])} className="text-[11px] text-sky-300 ml-1">{vi ? 'Tất cả' : 'All'}</button>
          )}
        </div>
        {p.stage && p.onStage && <OrderStagePicker stage={p.stage} onChange={p.onStage} lang={p.lang} compact />}
        {p.availableCategories.length > 0 && (
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label={vi ? 'Ngành hàng' : 'Categories'}>
            <span className="text-[11px] text-slate-500 mr-1">{vi ? 'Ngành' : 'Category'}</span>
            {p.availableCategories.map((c) => {
              const on = p.categories.includes(c);
              return (
                <button
                  key={c}
                  aria-pressed={on}
                  onClick={() => p.onCategories(toggle(p.categories, c))}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${on ? 'bg-white/15 border-white/30 text-white' : 'border-white/10 text-slate-400'}`}
                >
                  {c}
                </button>
              );
            })}
            {p.categories.length > 0 && (
              <button onClick={() => p.onCategories([])} className="text-[11px] text-sky-300 ml-1">{vi ? 'Bỏ lọc' : 'Clear'}</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

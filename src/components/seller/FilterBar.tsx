import React from 'react';
import { CalendarDays } from 'lucide-react';
import { OrderStagePicker } from '../workspace/OrderStagePicker';
import type { SummaryStage } from '../../analytics';
import { formatRangeVi, fmtDay, PLATFORM_LABELS, type DateRange, type Lang, type PeriodPreset, type Platform } from '../../analytics';

const PRESETS: { key: PeriodPreset; vi: string; en: string }[] = [
  { key: 'today', vi: 'Hôm nay', en: 'Today' },
  { key: 'yesterday', vi: 'Hôm qua', en: 'Yesterday' },
  { key: 'last7', vi: '7 ngày', en: '7 days' },
  { key: 'last30', vi: '30 ngày', en: '30 days' },
  { key: 'thisMonth', vi: 'Tháng này', en: 'This month' },
  { key: 'custom', vi: 'Tùy chọn', en: 'Custom' },
];

interface FilterBarProps {
  lang: Lang;
  preset: PeriodPreset;
  onPreset: (p: PeriodPreset) => void;
  custom: DateRange;
  onCustom: (r: DateRange) => void;
  bounds: DateRange;
  range: DateRange;
  previousRange: DateRange;
  platform: Platform | 'all';
  onPlatform: (p: Platform | 'all') => void;
  /** Order stage picker, shown for summary reports only. */
  stage?: SummaryStage;
  onStage?: (s: SummaryStage) => void;
  availablePlatforms: Platform[];
}

export const FilterBar: React.FC<FilterBarProps> = ({ lang, preset, onPreset, custom, onCustom, bounds, range, previousRange, platform, onPlatform, availablePlatforms, stage, onStage }) => {
  const vi = lang === 'vi';
  const platformOptions: (Platform | 'all')[] = ['all', 'shopee', 'tiktok', 'lazada'];
  return (
    <div className="glass-panel rounded-2xl p-3 flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={vi ? 'Khoảng thời gian' : 'Date range'}>
        <CalendarDays className="w-4 h-4 text-slate-400 mr-0.5" aria-hidden />
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => onPreset(p.key)}
            aria-pressed={preset === p.key}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
              preset === p.key ? 'bg-sky-600 border-sky-500 text-white' : 'bg-white/[0.04] border-white/10 text-slate-300 hover:bg-white/[0.08]'
            }`}
          >
            {vi ? p.vi : p.en}
            {p.key === 'today' && <span className="font-normal opacity-80"> ({fmtDay(bounds.end)})</span>}
          </button>
        ))}
        {preset === 'custom' && (
          <span className="flex items-center gap-1.5 text-xs text-slate-300">
            <input
              type="date"
              value={custom.start}
              min={bounds.start}
              max={bounds.end}
              onChange={(e) => e.target.value && onCustom({ ...custom, start: e.target.value })}
              className="bg-white/[0.06] border border-white/15 rounded-lg px-2 py-1 text-slate-100 [color-scheme:dark]"
              aria-label={vi ? 'Từ ngày' : 'From'}
            />
            –
            <input
              type="date"
              value={custom.end}
              min={bounds.start}
              max={bounds.end}
              onChange={(e) => e.target.value && onCustom({ ...custom, end: e.target.value })}
              className="bg-white/[0.06] border border-white/15 rounded-lg px-2 py-1 text-slate-100 [color-scheme:dark]"
              aria-label={vi ? 'Đến ngày' : 'To'}
            />
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={vi ? 'Sàn' : 'Platform'}>
          {platformOptions.map((p) => {
            const disabled = p !== 'all' && !availablePlatforms.includes(p);
            return (
              <button
                key={p}
                disabled={disabled}
                onClick={() => onPlatform(p)}
                aria-pressed={platform === p}
                title={disabled ? (vi ? 'Chưa có dữ liệu sàn này' : 'No data for this platform') : undefined}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                  platform === p ? 'bg-white/15 border-white/30 text-white' : 'bg-transparent border-white/10 text-slate-400 hover:text-white'
                } disabled:opacity-35 disabled:cursor-not-allowed`}
              >
                {p === 'all' ? (vi ? 'Tất cả' : 'All') : PLATFORM_LABELS[p]}
              </button>
            );
          })}
          {stage && onStage && <OrderStagePicker stage={stage} onChange={onStage} lang={lang} />}
        </div>
        <div className="text-[11px] text-slate-400">
          <span className="text-slate-200 font-semibold">{formatRangeVi(range)}</span>
          {' · '}
          {vi ? 'so với' : 'vs'} {formatRangeVi(previousRange)}
        </div>
      </div>
    </div>
  );
};

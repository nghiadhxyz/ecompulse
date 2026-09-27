import React from 'react';
import { CalendarDays } from 'lucide-react';
import { OrderStagePicker } from '../workspace/OrderStagePicker';
import { Tabs } from '../ui/primitives';
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
  const field = 'min-h-10 rounded-control border border-line bg-surface px-2.5 text-sm text-fg';
  return (
    <div className="sticky top-16 z-20 rounded-card border border-line bg-surface px-3 py-2 shadow-card">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-1">
          <CalendarDays className="h-4 w-4 text-muted" aria-hidden />
          <Tabs
            label={vi ? 'Khoảng thời gian' : 'Date range'}
            value={preset}
            onChange={onPreset}
            options={PRESETS.map((p) => ({ key: p.key, label: <>{vi ? p.vi : p.en}{p.key === 'today' && <span className="ml-1 font-normal opacity-80">({fmtDay(bounds.end)})</span>}</> }))}
          />
        </div>
        {preset === 'custom' && (
          <span className="flex items-center gap-1 text-sm text-muted">
            <input type="date" value={custom.start} min={bounds.start} max={bounds.end} onChange={(e) => e.target.value && onCustom({ ...custom, start: e.target.value })} className={field} aria-label={vi ? 'Từ ngày' : 'From'} />
            –
            <input type="date" value={custom.end} min={bounds.start} max={bounds.end} onChange={(e) => e.target.value && onCustom({ ...custom, end: e.target.value })} className={field} aria-label={vi ? 'Đến ngày' : 'To'} />
          </span>
        )}
        <div className="flex items-center gap-1">
          <span className="text-small text-muted">{vi ? 'Sàn' : 'Platform'}</span>
          <Tabs
            label={vi ? 'Sàn' : 'Platform'}
            value={platform}
            onChange={onPlatform}
            options={platformOptions.map((p) => {
              const disabled = p !== 'all' && !availablePlatforms.includes(p);
              return { key: p, label: p === 'all' ? (vi ? 'Tất cả' : 'All') : PLATFORM_LABELS[p], disabled, title: disabled ? (vi ? 'Chưa có dữ liệu sàn này' : 'No data for this platform') : undefined };
            })}
          />
        </div>
        {stage && onStage && <OrderStagePicker stage={stage} onChange={onStage} lang={lang} />}
        <span className="ml-auto text-small text-muted tabular">
          <b className="font-semibold text-fg">{formatRangeVi(range)}</b> {vi ? 'so với' : 'vs'} <b className="font-semibold text-fg">{formatRangeVi(previousRange)}</b>
        </span>
      </div>
    </div>
  );
};

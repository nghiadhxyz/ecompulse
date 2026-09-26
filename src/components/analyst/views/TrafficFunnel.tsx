import React, { useMemo, useState } from 'react';
import { ArrowDown, AlertTriangle } from 'lucide-react';
import {
  breakdown,
  compareFunnels,
  fmtCount,
  fmtPp,
  fmtRate,
  formatRangeVi,
  funnel,
  FUNNEL_LABELS,
  liveFunnel,
  type DatasetFilter,
  type Funnel,
  type FunnelStageKey,
  type Platform,
} from '../../../analytics';
import { useWorkspace } from '../../seller/SellerContext';
import { NotEnoughData, Section, tr } from '../../seller/ui';
import { SummaryChannelsPanel } from '../../workspace/SummaryPanels';
import { StageFunnelPanel } from '../../workspace/SummaryInsightPanels';
import { Th } from '../ui';

type Segment = 'platform' | 'category' | 'sku';

export const FunnelView: React.FC<{ f: Funnel; lang: 'vi' | 'en'; ppByStep?: Map<string, number | null> }> = ({ f, lang, ppByStep }) => {
  const vi = lang === 'vi';
  const keys = Object.keys(f.stages) as FunnelStageKey[];
  return (
    <ol className="space-y-1.5">
      {keys.map((k) => {
        const v = f.stages[k];
        const step = f.steps.find((s) => s.to === k);
        const leak = f.biggestLeak && f.biggestLeak.to === k;
        const pp = step ? ppByStep?.get(`${step.from}>${step.to}`) : undefined;
        return (
          <li key={k}>
            {step && (
              <div className={`flex items-center gap-2 pl-3 text-[11px] ${leak ? 'text-[#fab219] font-bold' : 'text-slate-400'}`}>
                <ArrowDown className="w-3 h-3" aria-hidden />
                <span>
                  {fmtRate(step.rate, lang, 2)} {vi ? 'chuyển tiếp' : 'convert'}
                  {step.skipped.length > 0 && ` (${vi ? 'bỏ qua' : 'skips'} ${step.skipped.map((x) => tr(lang, FUNNEL_LABELS[x])).join(', ')})`}
                  {pp !== undefined && pp !== null && <span className={pp >= 0 ? 'text-[#4ade80]' : 'text-[#f08080]'}> · {fmtPp(pp, lang)} {vi ? 'so với kỳ trước' : 'vs prev'}</span>}
                  {leak && (
                    <>
                      {' '}
                      · <AlertTriangle className="inline w-3 h-3" aria-hidden /> {vi ? 'rơi nhiều nhất' : 'biggest leak'}
                    </>
                  )}
                </span>
              </div>
            )}
            <div className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${v === null ? 'border-dashed border-white/10 text-slate-500' : leak ? 'border-[#fab219]/40 bg-[#fab219]/[0.06]' : 'border-white/10 bg-white/[0.03]'}`}>
              <span className="text-sm font-semibold">{tr(lang, FUNNEL_LABELS[k])}</span>
              <span className={`text-sm font-black ${v === null ? 'font-normal text-xs' : 'text-white'}`}>{v === null ? (vi ? 'Không đủ dữ liệu' : 'Not enough data') : fmtCount(v, lang)}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
};

export const TrafficFunnel: React.FC = () => {
  const { lang, dataset, baseFilter, previousRange, range } = useWorkspace();
  const vi = lang === 'vi';
  const [segment, setSegment] = useState<Segment>('platform');
  const cur = useMemo(() => funnel(dataset, baseFilter), [dataset, baseFilter]);
  const prev = useMemo(() => funnel(dataset, { ...baseFilter, range: previousRange }), [dataset, baseFilter, previousRange]);
  const cmp = useMemo(() => compareFunnels(cur, prev), [cur, prev]);
  const ppByStep = new Map(cmp.stepChangesPp.map((s) => [`${s.from}>${s.to}`, s.pp]));
  const live = useMemo(() => liveFunnel(dataset, range, baseFilter.platforms), [dataset, range, baseFilter.platforms]);

  const segments = useMemo(() => {
    const members =
      segment === 'platform'
        ? breakdown(dataset, baseFilter, 'platform').rows.map((r) => ({ label: r.label, filter: { ...baseFilter, platforms: [r.key as Platform] } as DatasetFilter }))
        : segment === 'category'
          ? breakdown(dataset, baseFilter, 'category').rows.map((r) => ({ label: r.label, filter: { ...baseFilter, categories: [r.key] } as DatasetFilter }))
          : breakdown(dataset, baseFilter, 'sku').rows.slice(0, 12).map((r) => ({ label: r.label, filter: { ...baseFilter, skus: [r.key] } as DatasetFilter }));
    return members.map((m) => ({ label: m.label, f: funnel(dataset, m.filter) }));
  }, [dataset, baseFilter, segment]);

  const noTraffic = cur.stages.clicks === null && cur.stages.impressions === null;

  return (
    <div className="space-y-4">
      <SummaryChannelsPanel title={vi ? 'Doanh thu theo kênh & nguồn truy cập' : 'Revenue by channel & source'} />
      <StageFunnelPanel />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Section title={vi ? 'Phễu chuyển đổi' : 'Conversion funnel'} subtitle={`${formatRangeVi(range)} · ${vi ? 'so với' : 'vs'} ${formatRangeVi(previousRange)}`}>
          {noTraffic && (
            <p className="text-xs text-[#fab219] mb-2">
              {vi ? 'Chưa có dữ liệu traffic (hiển thị/nhấp sản phẩm) — chỉ phân tích được phần đơn hàng. Nhập báo cáo traffic theo sản phẩm để có phễu đầy đủ.' : 'No traffic data — only the order part of the funnel is available.'}
            </p>
          )}
          <FunnelView f={cur} lang={lang} ppByStep={ppByStep} />
          {cur.notes.map((n, i) => (
            <p key={i} className="text-[11px] text-slate-500 mt-2">{tr(lang, n)}</p>
          ))}
          {cur.biggestLeak && (
            <p className="text-sm text-slate-200 mt-3">
              {vi ? 'Điểm rơi lớn nhất (sau khi khách đã nhấp vào sản phẩm): ' : 'Biggest leak (after the product click): '}
              <b>{tr(lang, FUNNEL_LABELS[cur.biggestLeak.from])} → {tr(lang, FUNNEL_LABELS[cur.biggestLeak.to])}</b> ({fmtRate(cur.biggestLeak.rate, lang, 2)}).{' '}
              <span className="text-slate-400 text-xs">{vi ? 'So với kỳ trước và với sàn/ngành khác để biết mức này cao hay thấp.' : 'Compare with other periods and segments to judge it.'}</span>
            </p>
          )}
        </Section>
        <Section title={vi ? 'Phễu livestream' : 'Live funnel'} subtitle={formatRangeVi(range)}>
          {live.stages.impressions === null && live.stages.orders === null ? (
            <NotEnoughData lang={lang} reason={vi ? 'Chưa có dữ liệu phiên live trong khoảng này.' : 'No live sessions in this range.'} />
          ) : (
            <>
              <FunnelView f={live} lang={lang} />
              {live.notes.map((n, i) => (
                <p key={i} className="text-[11px] text-slate-500 mt-2">{tr(lang, n)}</p>
              ))}
            </>
          )}
        </Section>
      </div>

      <Section
        title={vi ? 'So sánh phễu theo nhóm' : 'Funnel by segment'}
        right={
          <div className="flex gap-1" role="group">
            {(['platform', 'category', 'sku'] as Segment[]).map((s) => (
              <button
                key={s}
                aria-pressed={segment === s}
                onClick={() => setSegment(s)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${segment === s ? 'bg-sky-600 border-sky-500 text-white' : 'border-white/10 text-slate-300'}`}
              >
                {s === 'platform' ? (vi ? 'Sàn' : 'Platform') : s === 'category' ? (vi ? 'Ngành' : 'Category') : vi ? 'Top SKU' : 'Top SKU'}
              </button>
            ))}
          </div>
        }
      >
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-xs">
            <thead className="bg-white/[0.04] text-slate-400">
              <tr>
                <Th left>{vi ? 'Nhóm' : 'Segment'}</Th>
                <Th>{vi ? 'Hiển thị' : 'Impr.'}</Th>
                <Th>{vi ? 'Nhấp SP' : 'Clicks'}</Th>
                <Th>{vi ? 'Giỏ hàng' : 'ATC'}</Th>
                <Th>{vi ? 'Đặt' : 'Orders'}</Th>
                <Th>{vi ? 'Thanh toán' : 'Paid'}</Th>
                <Th>{vi ? 'Hoàn tất' : 'Completed'}</Th>
                <Th title={vi ? 'Đơn đặt ÷ nhấp sản phẩm' : 'Orders ÷ clicks'}>CVR</Th>
                <Th left>{vi ? 'Rơi nhiều nhất' : 'Biggest leak'}</Th>
              </tr>
            </thead>
            <tbody>
              {segments.map(({ label, f }) => (
                <tr key={label} className="border-t border-white/5 text-slate-200">
                  <td className="px-2.5 py-2 font-semibold text-white max-w-[220px] truncate">{label}</td>
                  <td className="px-2.5 py-2 text-right">{fmtCount(f.stages.impressions, lang)}</td>
                  <td className="px-2.5 py-2 text-right">{fmtCount(f.stages.clicks, lang)}</td>
                  <td className="px-2.5 py-2 text-right">{fmtCount(f.stages.addToCart, lang)}</td>
                  <td className="px-2.5 py-2 text-right">{fmtCount(f.stages.orders, lang)}</td>
                  <td className="px-2.5 py-2 text-right">{fmtCount(f.stages.paid, lang)}</td>
                  <td className="px-2.5 py-2 text-right">{fmtCount(f.stages.completed, lang)}</td>
                  <td className="px-2.5 py-2 text-right">{fmtRate(f.stages.clicks && f.stages.orders !== null ? f.stages.orders / f.stages.clicks : null, lang, 2)}</td>
                  <td className="px-2.5 py-2 text-slate-300 whitespace-nowrap">
                    {f.biggestLeak ? `${tr(lang, FUNNEL_LABELS[f.biggestLeak.from])} → ${tr(lang, FUNNEL_LABELS[f.biggestLeak.to])} (${fmtRate(f.biggestLeak.rate, lang, 1)})` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
};

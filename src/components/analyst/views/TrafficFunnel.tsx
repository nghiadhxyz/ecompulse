import React, { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  breakdown,
  channelFunnel,
  compareFunnels,
  SUMMARY_CHANNEL_LABELS,
  type SummaryChannel,
  fmtCount,
  fmtPp,
  fmtRate,
  fmtShare,
  isOverFull,
  OVER_FULL_NOTE,
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
import { NotEnoughData, tr } from '../../seller/ui';
import { SummaryChannelsPanel } from '../../workspace/SummaryPanels';
import { StageFunnelPanel } from '../../workspace/SummaryInsightPanels';
import { CardGrid, SectionCard, Tabs } from '../../ui/primitives';
import { TABLE } from '../../ui/data';
import { CHANNEL_COLOR } from '../../../theme/chart';
import { Th } from '../ui';

type Segment = 'platform' | 'category' | 'sku';

/**
 * Funnel as horizontal bars proportional to the value, the step rate between two bars.
 * `showLeak`: mark the lowest step only when there is something to compare it with (4.3).
 */
export const FunnelView: React.FC<{ f: Funnel; lang: 'vi' | 'en'; ppByStep?: Map<string, number | null>; showLeak?: boolean; color?: string }> = ({ f, lang, ppByStep, showLeak = false, color = 'var(--primary)' }) => {
  const vi = lang === 'vi';
  const keys = (Object.keys(f.stages) as FunnelStageKey[]).filter((k) => f.stages[k] !== null || !f.labels);
  const name = (k: FunnelStageKey) => tr(lang, f.labels?.[k] ?? FUNNEL_LABELS[k]);
  const max = Math.max(1, ...keys.map((k) => f.stages[k] ?? 0));
  return (
    <ol className="space-y-1">
      {keys.map((k) => {
        const v = f.stages[k];
        const step = f.steps.find((s) => s.to === k);
        const leak = showLeak && f.biggestLeak && f.biggestLeak.to === k;
        const pp = step ? ppByStep?.get(`${step.from}>${step.to}`) : undefined;
        if (v === null) {
          return (
            <li key={k} className="flex min-h-7 items-center gap-2 px-1 text-small text-muted opacity-70">
              <span className="h-px flex-1 border-t border-dashed border-line" aria-hidden />
              {name(k)} · {vi ? 'không đủ dữ liệu' : 'no data'}
            </li>
          );
        }
        return (
          <li key={k}>
            {step && (
              <div className={`py-0.5 pl-3 text-small ${leak ? 'font-semibold text-down' : 'text-muted'}`}>
                ↓ <span title={isOverFull(step.rate) ? tr(lang, OVER_FULL_NOTE) : undefined}>{fmtShare(step.rate, lang, 2)}</span> {vi ? 'chuyển tiếp' : 'convert'}
                {step.skipped.length > 0 && !f.labels && ` (${vi ? 'bỏ qua' : 'skips'} ${step.skipped.map((x) => tr(lang, FUNNEL_LABELS[x])).join(', ')})`}
                {pp !== undefined && pp !== null && (
                  <span className={`font-medium ${pp >= 0 ? 'text-up' : 'text-down'}`}>
                    {' '}
                    · <span aria-hidden>{pp >= 0 ? '↑' : '↓'}</span> {fmtPp(pp, lang)} {vi ? 'so với kỳ trước' : 'vs prev'}
                  </span>
                )}
                {leak && (
                  <>
                    {' '}
                    · <AlertTriangle className="inline h-3.5 w-3.5 align-[-2px]" aria-hidden /> {vi ? 'rơi nhiều nhất' : 'biggest leak'}
                  </>
                )}
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="relative h-9 flex-1 overflow-hidden rounded-control bg-surface-2">
                <div className="h-full rounded-control border-l-4" style={{ width: `${Math.max(2, (v / max) * 100)}%`, background: `color-mix(in srgb, ${color} 22%, transparent)`, borderColor: color }} />
                <span className="absolute inset-y-0 left-3 right-2 flex items-center text-sm font-semibold text-fg" title={name(k)}>
                  <span className="truncate">{name(k)}</span>
                </span>
              </div>
              <span className="w-24 shrink-0 text-right text-sm font-semibold tabular text-fg">{fmtCount(v, lang)}</span>
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
  // "Biggest leak" is only a conclusion when the previous period has the same steps.
  const hasBaseline = cmp.stepChangesPp.some((s) => s.pp !== null);
  const channelOptions = useMemo(
    () => (['product_card', 'affiliate', 'video', 'live'] as SummaryChannel[]).map((c) => ({ c, f: channelFunnel(dataset, baseFilter, c) })).filter((x) => x.f !== null),
    [dataset, baseFilter],
  );
  const [channel, setChannel] = useState<SummaryChannel>('product_card');
  const chosen = channelOptions.find((x) => x.c === channel) ?? channelOptions[0];

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
  const notesLabel = vi ? 'Ghi chú' : 'Notes';

  return (
    <div className="space-y-4">
      <SummaryChannelsPanel title={vi ? 'Doanh thu theo kênh & nguồn truy cập' : 'Revenue by channel & source'} />
      <StageFunnelPanel />
      <CardGrid>
        <SectionCard
          span={6}
          title={vi ? 'Phễu chuyển đổi' : 'Conversion funnel'}
          description={`${formatRangeVi(range)} · ${vi ? 'so với' : 'vs'} ${formatRangeVi(previousRange)}`}
          notesLabel={notesLabel}
          notes={[
            ...cur.notes.map((n) => tr(lang, n)),
            !hasBaseline && cur.steps.length > 0 ? (vi ? 'Không có kỳ so sánh nên chưa kết luận bước nào rơi nhiều nhất.' : 'No comparison period, so no step is called the biggest leak.') : null,
          ]}
        >
          {noTraffic && (
            <p className="mb-3 inline-flex rounded-control bg-warn-soft px-2.5 py-1 text-small text-warn">
              {vi ? 'Chưa có dữ liệu traffic (hiển thị/nhấp sản phẩm) — chỉ phân tích được phần đơn hàng. Nhập báo cáo traffic theo sản phẩm để có phễu đầy đủ.' : 'No traffic data — only the order part of the funnel is available.'}
            </p>
          )}
          <FunnelView f={cur} lang={lang} ppByStep={ppByStep} showLeak={hasBaseline} />
          {hasBaseline && cur.biggestLeak && (
            <p className="mt-3 text-sm text-fg">
              {vi ? 'Điểm rơi lớn nhất (sau khi khách đã nhấp vào sản phẩm): ' : 'Biggest leak (after the product click): '}
              <b className="font-semibold">
                {tr(lang, FUNNEL_LABELS[cur.biggestLeak.from])} → {tr(lang, FUNNEL_LABELS[cur.biggestLeak.to])}
              </b>{' '}
              ({fmtRate(cur.biggestLeak.rate, lang, 2)}). <span className="text-small text-muted">{vi ? 'So với kỳ trước và với sàn/ngành khác để biết mức này cao hay thấp.' : 'Compare with other periods and segments to judge it.'}</span>
            </p>
          )}
        </SectionCard>
        {chosen && (
          <SectionCard
            span={6}
            title={vi ? 'Phễu theo kênh' : 'Funnel by channel'}
            description={`${formatRangeVi(range)} · ${vi ? 'dòng kênh trong sheet nguồn truy cập, đơn đặt' : 'channel row, placed orders'}`}
            tools={
              <Tabs<SummaryChannel>
                size="sm"
                label={vi ? 'Kênh' : 'Channel'}
                value={chosen.c}
                onChange={setChannel}
                options={channelOptions.map((x) => ({ key: x.c, label: tr(lang, SUMMARY_CHANNEL_LABELS[x.c]).split(' (')[0] }))}
              />
            }
            notesLabel={notesLabel}
            notes={chosen.f!.notes.map((n) => tr(lang, n))}
          >
            <FunnelView f={chosen.f!} lang={lang} color={CHANNEL_COLOR[chosen.c].line} />
          </SectionCard>
        )}
        <SectionCard span={6} title={vi ? 'Phễu livestream' : 'Live funnel'} description={formatRangeVi(range)} notesLabel={notesLabel} notes={live.notes.map((n) => tr(lang, n))}>
          {live.stages.impressions === null && live.stages.orders === null ? (
            <NotEnoughData lang={lang} reason={vi ? 'Chưa có dữ liệu phiên live trong khoảng này.' : 'No live sessions in this range.'} />
          ) : (
            <FunnelView f={live} lang={lang} color={CHANNEL_COLOR.live.line} />
          )}
        </SectionCard>
      </CardGrid>

      <SectionCard
        title={vi ? 'So sánh phễu theo nhóm' : 'Funnel by segment'}
        tools={
          <Tabs<Segment>
            size="sm"
            label={vi ? 'Nhóm' : 'Segment'}
            value={segment}
            onChange={setSegment}
            options={[
              { key: 'platform', label: vi ? 'Sàn' : 'Platform' },
              { key: 'category', label: vi ? 'Ngành' : 'Category' },
              { key: 'sku', label: 'Top SKU' },
            ]}
          />
        }
      >
        <div className={TABLE.frame}>
          <table className={TABLE.table}>
            <thead className={TABLE.thead}>
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
                <tr key={label} className={`${TABLE.tr} text-fg`}>
                  <td className={`${TABLE.td} max-w-[220px] truncate font-medium`} title={label}>
                    {label}
                  </td>
                  <td className={`${TABLE.td} text-right`}>{fmtCount(f.stages.impressions, lang)}</td>
                  <td className={`${TABLE.td} text-right`}>{fmtCount(f.stages.clicks, lang)}</td>
                  <td className={`${TABLE.td} text-right`}>{fmtCount(f.stages.addToCart, lang)}</td>
                  <td className={`${TABLE.td} text-right`}>{fmtCount(f.stages.orders, lang)}</td>
                  <td className={`${TABLE.td} text-right`}>{fmtCount(f.stages.paid, lang)}</td>
                  <td className={`${TABLE.td} text-right`}>{fmtCount(f.stages.completed, lang)}</td>
                  <td className={`${TABLE.td} text-right`}>{fmtShare(f.stages.clicks && f.stages.orders !== null ? f.stages.orders / f.stages.clicks : null, lang, 2)}</td>
                  <td className={`${TABLE.td} text-muted`}>{f.biggestLeak ? `${tr(lang, FUNNEL_LABELS[f.biggestLeak.from])} → ${tr(lang, FUNNEL_LABELS[f.biggestLeak.to])} (${fmtRate(f.biggestLeak.rate, lang, 1)})` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
};

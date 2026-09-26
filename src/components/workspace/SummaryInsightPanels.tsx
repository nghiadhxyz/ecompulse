/**
 * Panels for insights from platform summary reports (no order lines needed):
 * subsidy dependence, source drivers of a change, placed → paid by channel/source,
 * a channel's sales by weekday, and new vs existing buyers.
 * Each panel renders nothing when the dataset has no such data.
 */
import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  channelWeekday,
  customerTrend,
  fmtCount,
  fmtDay,
  fmtMoneyCompact,
  fmtOrders,
  fmtRate,
  formatRangeVi,
  sourceDrivers,
  stageFunnel,
  subsidyDependence,
  SUMMARY_CHANNEL_LABELS,
  type DateRange,
  type SeriesGrain,
  type SummaryChannel,
} from '../../analytics';
import { useWorkspace } from '../seller/SellerContext';
import { NotEnoughData, Section, tr } from '../seller/ui';
import { ShareBar, Th } from '../analyst/ui';
import { SummaryNotes } from './SummaryPanels';

const BAR = '#3987e5';
const SECOND = '#8b93a3';
const tooltipStyle = { background: '#0b1024', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, fontSize: 12 };
const axisTick = { fill: '#94a3b8', fontSize: 10 };

const GrainPicker: React.FC<{ grain: SeriesGrain; onChange: (g: SeriesGrain) => void; vi: boolean }> = ({ grain, onChange, vi }) => (
  <div className="flex gap-1" role="group" aria-label={vi ? 'Theo' : 'By'}>
    {(['day', 'week'] as SeriesGrain[]).map((g) => (
      <button key={g} onClick={() => onChange(g)} aria-pressed={grain === g} className={`px-2 py-1 rounded-lg text-xs font-semibold border ${grain === g ? 'bg-white/15 border-white/30 text-white' : 'border-white/10 text-slate-400'}`}>
        {g === 'day' ? (vi ? 'Ngày' : 'Day') : vi ? 'Tuần' : 'Week'}
      </button>
    ))}
  </div>
);

const bucketLabel = (key: string, grain: SeriesGrain, vi: boolean) => (grain === 'day' ? fmtDay(key) : `${vi ? 'Tuần' : 'Wk'} ${fmtDay(key)}`);
const signed = (v: number, lang: 'vi' | 'en') => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmtMoneyCompact(Math.abs(v), lang)}`;

// ------------------------------------------------------------------ B1

export const SubsidyPanel: React.FC = () => {
  const { lang, dataset, range, platforms } = useWorkspace();
  const vi = lang === 'vi';
  const [grain, setGrain] = useState<SeriesGrain>('day');
  const s = useMemo(() => subsidyDependence(dataset, { range, platforms }, grain), [dataset, range, platforms, grain]);
  if (!dataset.dailyMetrics.some((d) => d.placedNoSubsidyGmv !== undefined)) return null;
  return (
    <Section
      title={vi ? 'Mức phụ thuộc trợ giá Shopee' : 'Dependence on Shopee subsidy'}
      subtitle={s.total ? `${vi ? 'Cả khoảng' : 'Whole range'}: ${fmtRate(s.total.share, lang)} ${vi ? 'doanh số đơn đặt là trợ giá' : 'of placed sales is subsidy'} (${fmtMoneyCompact(s.total.subsidy, lang)})` : formatRangeVi(range)}
      right={<GrainPicker grain={grain} onChange={setGrain} vi={vi} />}
    >
      {!s.available ? (
        <NotEnoughData lang={lang} reason={tr(lang, s.notes[0])} />
      ) : (
        <>
          {s.warnings.map((w) => (
            <p key={w.vi} className="text-[11px] text-[#fab219] leading-snug mb-2">
              ⚠ {w[lang]}
            </p>
          ))}
          <div className="h-48" role="img" aria-label={vi ? '% phụ thuộc trợ giá theo thời gian' : 'Subsidy share over time'}>
            <ResponsiveContainer width="100%" height="100%">
              {/* Invalid days have no share: the line breaks there instead of dipping below zero. */}
              <LineChart data={s.points.map((p) => ({ label: bucketLabel(p.key, grain, vi), share: p.share }))}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="label" tick={axisTick} tickLine={false} minTickGap={16} axisLine={{ stroke: 'rgba(255,255,255,0.12)' }} />
                <YAxis tickFormatter={(v: number) => fmtRate(v, lang, 0)} tick={axisTick} width={40} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmtRate(v, lang), vi ? '% trợ giá' : 'Subsidy share']} />
                <Line isAnimationActive={false} type="monotone" dataKey="share" stroke={BAR} strokeWidth={2} dot={grain === 'week'} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {grain === 'week' && (
            <div className="overflow-x-auto rounded-xl border border-white/10 mt-2">
              <table className="w-full text-xs">
                <thead className="bg-white/[0.04] text-slate-400">
                  <tr>
                    <Th left>{vi ? 'Tuần bắt đầu' : 'Week of'}</Th>
                    <Th title={vi ? 'Cỡ mẫu' : 'Sample size'}>{vi ? 'Số ngày' : 'Days'}</Th>
                    <Th>{vi ? 'Doanh số' : 'Sales'}</Th>
                    <Th>{vi ? 'Không gồm trợ giá' : 'Excl. subsidy'}</Th>
                    <Th>{vi ? 'Trợ giá' : 'Subsidy'}</Th>
                    <Th>{vi ? '% trợ giá' : 'Share'}</Th>
                  </tr>
                </thead>
                <tbody>
                  {s.points.map((p) => (
                    <tr key={p.key} className="border-t border-white/5 text-slate-200">
                      <td className="px-2.5 py-1.5">{fmtDay(p.key)}</td>
                      <td className="px-2.5 py-1.5 text-right">{p.days}</td>
                      <td className="px-2.5 py-1.5 text-right">{fmtMoneyCompact(p.gmv, lang)}</td>
                      <td className="px-2.5 py-1.5 text-right">{fmtMoneyCompact(p.noSubsidyGmv, lang)}</td>
                      <td className="px-2.5 py-1.5 text-right">{fmtMoneyCompact(p.subsidy, lang)}</td>
                      <td className="px-2.5 py-1.5 text-right">{fmtRate(p.share, lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <SummaryNotes notes={s.notes} lang={lang} />
        </>
      )}
    </Section>
  );
};

// ------------------------------------------------------------------ B2

export const SourceDriversPanel: React.FC<{ before: DateRange; after: DateRange; title?: string; excludeDates?: Set<string> }> = ({ before, after, title, excludeDates }) => {
  const { lang, dataset, platforms } = useWorkspace();
  const vi = lang === 'vi';
  const d = useMemo(() => sourceDrivers(dataset, before, after, { platforms, excludeDates }), [dataset, before, after, platforms, excludeDates]);
  if (!(dataset.salesSummaries ?? []).some((r) => r.dimension === 'source' && r.periodStart === undefined)) return null;
  const top = d.sources.filter((s) => Math.abs(s.delta) >= 1).slice(0, 8);
  return (
    <Section
      title={title ?? (vi ? 'Doanh số tăng/giảm do nguồn nào' : 'Which sources moved sales')}
      subtitle={
        d.available
          ? `${formatRangeVi(before)} → ${formatRangeVi(after)} · ${vi ? 'doanh số TB/ngày' : 'avg sales/day'} ${fmtMoneyCompact(d.before.gmvPerDay, lang)} → ${fmtMoneyCompact(d.after.gmvPerDay, lang)}`
          : `${formatRangeVi(before)} → ${formatRangeVi(after)}`
      }
    >
      {!d.available ? (
        <NotEnoughData lang={lang} reason={tr(lang, d.notes[0])} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-xs">
              <thead className="bg-white/[0.04] text-slate-400">
                <tr>
                  <Th left>{vi ? 'Kênh / nguồn' : 'Channel / source'}</Th>
                  <Th>{vi ? 'Trước (TB/ngày)' : 'Before (/day)'}</Th>
                  <Th>{vi ? 'Sau (TB/ngày)' : 'After (/day)'}</Th>
                  <Th>{vi ? 'Thay đổi' : 'Change'}</Th>
                  <Th title={vi ? 'Phần của tổng thay đổi; âm = đi ngược chiều tổng' : 'Share of the total change'}>{vi ? 'Tỷ trọng thay đổi' : 'Share of change'}</Th>
                </tr>
              </thead>
              <tbody>
                {d.channels.map((c) => (
                  <tr key={c.channel} className="border-t border-white/5 text-slate-100 font-semibold">
                    <td className="px-2.5 py-1.5">{tr(lang, SUMMARY_CHANNEL_LABELS[c.channel])}</td>
                    <td className="px-2.5 py-1.5 text-right">{fmtMoneyCompact(c.before, lang)}</td>
                    <td className="px-2.5 py-1.5 text-right">{fmtMoneyCompact(c.after, lang)}</td>
                    <td className={`px-2.5 py-1.5 text-right ${c.delta < 0 ? 'text-[#f08080]' : 'text-[#4ade80]'}`}>{signed(c.delta, lang)}</td>
                    <td className="px-2.5 py-1.5 text-right">{fmtRate(c.shareOfChange, lang, 0)}</td>
                  </tr>
                ))}
                <tr className="border-t border-white/10 text-slate-400">
                  <td colSpan={5} className="px-2.5 py-1 text-[11px]">{vi ? 'Nguồn thay đổi nhiều nhất' : 'Largest source changes'}</td>
                </tr>
                {top.map((s) => (
                  <tr key={`${s.channel}|${s.source}`} className="border-t border-white/5 text-slate-300">
                    <td className="px-2.5 py-1 pl-6">
                      {s.source} <span className="text-slate-500">· {tr(lang, SUMMARY_CHANNEL_LABELS[s.channel]).split(' (')[0]}</span>
                    </td>
                    <td className="px-2.5 py-1 text-right">{fmtMoneyCompact(s.before, lang)}</td>
                    <td className="px-2.5 py-1 text-right">{fmtMoneyCompact(s.after, lang)}</td>
                    <td className={`px-2.5 py-1 text-right ${s.delta < 0 ? 'text-[#f08080]' : 'text-[#4ade80]'}`}>{signed(s.delta, lang)}</td>
                    <td className="px-2.5 py-1 text-right">{fmtRate(s.shareOfChange, lang, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {vi ? `Cỡ mẫu: ${d.before.days} ngày trước, ${d.after.days} ngày sau.` : `Sample: ${d.before.days} days before, ${d.after.days} after.`}
          </p>
          <SummaryNotes notes={d.notes} lang={lang} />
        </>
      )}
    </Section>
  );
};

// ------------------------------------------------------------------ B3

export const StageFunnelPanel: React.FC = () => {
  const { lang, dataset, range, platforms } = useWorkspace();
  const vi = lang === 'vi';
  const [open, setOpen] = useState<SummaryChannel | null>(null);
  const f = useMemo(() => stageFunnel(dataset, { range, platforms }), [dataset, range, platforms]);
  if (!(dataset.salesSummaries ?? []).some((r) => r.stage === 'paid')) return null;
  const channelRows = f.rows.filter((r) => r.source === null);
  return (
    <Section title={vi ? 'Từ đơn đặt đến đơn thanh toán, theo kênh và nguồn' : 'Placed → paid by channel and source'} subtitle={formatRangeVi(range)}>
      {!f.available ? (
        <NotEnoughData lang={lang} reason={tr(lang, f.notes[0])} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-xs">
              <thead className="bg-white/[0.04] text-slate-400">
                <tr>
                  <Th left>{vi ? 'Kênh / nguồn' : 'Channel / source'}</Th>
                  <Th>{vi ? 'Đặt' : 'Placed'}</Th>
                  <Th>{vi ? 'Xác nhận' : 'Confirmed'}</Th>
                  <Th>{vi ? 'Thanh toán' : 'Paid'}</Th>
                  <Th title={vi ? 'Doanh số thanh toán / doanh số đặt' : 'Paid / placed sales'}>{vi ? 'Giữ (doanh số)' : 'Kept (sales)'}</Th>
                  <Th title={vi ? 'Đơn thanh toán / đơn đặt (có thể lẻ)' : 'Paid / placed orders'}>{vi ? 'Giữ (đơn)' : 'Kept (orders)'}</Th>
                  <Th>{vi ? 'Rơi' : 'Lost'}</Th>
                </tr>
              </thead>
              <tbody>
                {channelRows.map((c) => {
                  const expanded = open === c.channel;
                  const sources = f.rows.filter((r) => r.channel === c.channel && r.source !== null);
                  const row = (r: typeof c, sub: boolean) => (
                    <tr
                      key={`${r.channel}|${r.source ?? ''}`}
                      className={`border-t border-white/5 ${sub ? 'text-slate-300 bg-white/[0.015]' : 'text-slate-100 font-semibold cursor-pointer hover:bg-white/[0.03]'}`}
                      onClick={sub ? undefined : () => setOpen(expanded ? null : c.channel)}
                      aria-expanded={sub ? undefined : expanded}
                    >
                      <td className={`px-2.5 py-1.5 whitespace-nowrap ${sub ? 'pl-8' : ''}`}>{sub ? r.source : tr(lang, SUMMARY_CHANNEL_LABELS[r.channel])}</td>
                      <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{fmtMoneyCompact(r.placed.gmv, lang)} <span className="text-slate-500">· {fmtOrders(r.placed.orders, lang)}</span></td>
                      <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{fmtMoneyCompact(r.confirmed.gmv, lang)}</td>
                      <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{fmtMoneyCompact(r.paid.gmv, lang)} <span className="text-slate-500">· {fmtOrders(r.paid.orders, lang)}</span></td>
                      <td className="px-2.5 py-1.5 whitespace-nowrap"><div className="flex items-center justify-end gap-2">{fmtRate(r.paidRateGmv, lang)}<ShareBar share={r.paidRateGmv} /></div></td>
                      <td className="px-2.5 py-1.5 text-right">{fmtRate(r.paidRateOrders, lang)}</td>
                      <td className="px-2.5 py-1.5 text-right text-[#f08080]">{r.lostGmv === null ? '—' : fmtMoneyCompact(r.lostGmv, lang)}</td>
                    </tr>
                  );
                  return (
                    <React.Fragment key={c.channel}>
                      {row(c, false)}
                      {expanded && sources.map((s) => row(s, true))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <SummaryNotes notes={f.notes} lang={lang} />
        </>
      )}
    </Section>
  );
};

// ------------------------------------------------------------------ B4

export const ChannelWeekdayPanel: React.FC<{ channel: SummaryChannel }> = ({ channel }) => {
  const { lang, dataset, range, platforms } = useWorkspace();
  const vi = lang === 'vi';
  const w = useMemo(() => channelWeekday(dataset, { range, platforms }, channel), [dataset, range, platforms, channel]);
  if (!(dataset.salesSummaries ?? []).some((r) => r.dimension === 'channel' && r.channel === channel && r.periodStart === undefined)) return null;
  const label = tr(lang, SUMMARY_CHANNEL_LABELS[channel]);
  return (
    <Section title={vi ? `${label} theo thứ trong tuần (mức kênh)` : `${label} by weekday (channel level)`} subtitle={formatRangeVi(range)}>
      {!w.available ? (
        <NotEnoughData lang={lang} title={vi ? 'Chưa đủ dữ liệu' : 'Not enough data yet'} reason={tr(lang, w.notes[0])} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-xs">
              <thead className="bg-white/[0.04] text-slate-400">
                <tr>
                  <Th left>{vi ? 'Thứ' : 'Weekday'}</Th>
                  <Th title={vi ? 'Cỡ mẫu' : 'Sample size'}>{vi ? 'Số ngày' : 'Days'}</Th>
                  <Th>{vi ? 'Ngày có doanh số' : 'Days with sales'}</Th>
                  <Th>{vi ? 'Doanh số' : 'Sales'}</Th>
                  <Th>{vi ? 'TB/ngày' : 'Avg/day'}</Th>
                  <Th>{vi ? 'Đơn' : 'Orders'}</Th>
                </tr>
              </thead>
              <tbody>
                {w.buckets.map((b) => (
                  <tr key={b.weekday} className={`border-t border-white/5 ${b.insufficient ? 'text-slate-500' : 'text-slate-200'}`}>
                    <td className="px-2.5 py-1.5">{tr(lang, b.label)}</td>
                    <td className="px-2.5 py-1.5 text-right">{b.days}</td>
                    {b.insufficient ? (
                      <td colSpan={4} className="px-2.5 py-1.5 text-right italic">{vi ? 'Chưa đủ dữ liệu' : 'Not enough data'}</td>
                    ) : (
                      <>
                        <td className="px-2.5 py-1.5 text-right">{`${b.activeDays}/${b.days}`}</td>
                        <td className="px-2.5 py-1.5 text-right">{fmtMoneyCompact(b.gmv, lang)}</td>
                        <td className="px-2.5 py-1.5 text-right">{fmtMoneyCompact(b.gmvPerDay, lang)}</td>
                        <td className="px-2.5 py-1.5 text-right">{fmtOrders(b.orders, lang)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <SummaryNotes notes={w.notes} lang={lang} />
        </>
      )}
    </Section>
  );
};

// ------------------------------------------------------------------ B5

export const CustomerTrendPanel: React.FC = () => {
  const { lang, dataset, range, platforms } = useWorkspace();
  const vi = lang === 'vi';
  const [grain, setGrain] = useState<SeriesGrain>('day');
  const t = useMemo(() => customerTrend(dataset, { range, platforms }, grain), [dataset, range, platforms, grain]);
  if (!dataset.dailyMetrics.some((d) => d.newBuyers !== undefined || d.existingBuyers !== undefined)) return null;
  const pt = t.periodTotal;
  return (
    <Section title={vi ? 'Khách mới và khách cũ (mức tổng)' : 'New vs existing buyers (totals)'} subtitle={formatRangeVi(range)} right={<GrainPicker grain={grain} onChange={setGrain} vi={vi} />}>
      {!t.available ? (
        <NotEnoughData lang={lang} reason={tr(lang, t.notes[0])} />
      ) : (
        <>
          {pt && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
              {[
                { l: vi ? 'Người mua (khác nhau)' : 'Buyers (distinct)', v: fmtCount(pt.buyers, lang) },
                { l: vi ? 'Người mua mới' : 'New buyers', v: `${fmtCount(pt.newBuyers, lang)} (${fmtRate(pt.newShare, lang, 0)})` },
                { l: vi ? 'Người mua hiện tại' : 'Existing buyers', v: fmtCount(pt.existingBuyers, lang) },
                { l: vi ? 'Người mua tiềm năng' : 'Potential buyers', v: fmtCount(pt.potentialBuyers, lang) },
                { l: vi ? 'Tỉ lệ quay lại' : 'Repeat rate', v: fmtRate(pt.repeatRate, lang) },
              ].map((x) => (
                <div key={x.l} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <div className="text-[11px] text-slate-400">{x.l}</div>
                  <div className="text-base font-bold text-white">{x.v}</div>
                </div>
              ))}
            </div>
          )}
          <div className="h-52" role="img" aria-label={vi ? 'Người mua mới và hiện tại theo thời gian' : 'New and existing buyers over time'}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={t.points.map((p) => ({ label: bucketLabel(p.key, grain, vi), newBuyers: p.newBuyers, existingBuyers: p.existingBuyers }))} barCategoryGap={2}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="label" tick={axisTick} tickLine={false} minTickGap={16} axisLine={{ stroke: 'rgba(255,255,255,0.12)' }} />
                <YAxis tick={axisTick} width={32} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [fmtCount(v, lang), n === 'newBuyers' ? (vi ? 'Mới' : 'New') : vi ? 'Hiện tại' : 'Existing']} />
                <Legend formatter={(n: string) => (n === 'newBuyers' ? (vi ? 'Người mua mới' : 'New') : vi ? 'Người mua hiện tại' : 'Existing')} wrapperStyle={{ fontSize: 11 }} />
                <Bar isAnimationActive={false} dataKey="newBuyers" stackId="b" fill={BAR} maxBarSize={20} />
                <Bar isAnimationActive={false} dataKey="existingBuyers" stackId="b" fill={SECOND} radius={[4, 4, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <SummaryNotes notes={t.notes} lang={lang} />
        </>
      )}
    </Section>
  );
};


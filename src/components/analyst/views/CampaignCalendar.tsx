import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  calendarPerformance,
  campaignCalendar,
  compareCampaigns,
  fmtChange,
  fmtCount,
  fmtMoney,
  fmtMoneyCompact,
  fmtRate,
  formatRangeVi,
  type BucketStats,
  type CampaignResult,
  type Comparison,
} from '../../../analytics';
import { useWorkspace } from '../../seller/SellerContext';
import { EvidenceButton, NotEnoughData, Section, tr } from '../../seller/ui';
import { ChangeCell, Th } from '../ui';

const BAR = '#3987e5';

export const CampaignCalendar: React.FC = () => {
  const { lang, dataset, baseFilter, range, openEvidence } = useWorkspace();
  const vi = lang === 'vi';
  const perf = useMemo(() => calendarPerformance(dataset, baseFilter), [dataset, baseFilter]);
  const all = useMemo(() => campaignCalendar(dataset).sort((a, b) => a.range.start.localeCompare(b.range.start)), [dataset]);
  const majors = all.filter((c) => c.type !== 'payday');
  const [aId, setAId] = useState<string | null>(null);
  const [bId, setBId] = useState<string | null>(null);
  const a = all.find((c) => c.campaignId === aId) ?? majors[majors.length - 2] ?? all[0];
  const b = all.find((c) => c.campaignId === bId) ?? majors[majors.length - 1] ?? all[1];
  const cmp = useMemo(() => (a && b && a !== b ? compareCampaigns(dataset, a, b, baseFilter.platforms) : null), [dataset, a, b, baseFilter.platforms]);

  if (dataset.orders.length === 0) {
    return (
      <Section title="Campaign & Calendar">
        <NotEnoughData lang={lang} reason={vi ? 'Cần file xuất đơn hàng để phân tích theo ngày.' : 'Needs an order export.'} />
      </Section>
    );
  }

  const bucketRow = (x: BucketStats) => (
    <tr key={x.key} className="border-t border-white/5 text-slate-200">
      <td className="px-2.5 py-2 font-semibold text-white">{tr(lang, x.label)}</td>
      <td className="px-2.5 py-2 text-right">{x.days}</td>
      <td className="px-2.5 py-2 text-right whitespace-nowrap">{fmtMoneyCompact(x.gmvPerDay, lang)}</td>
      <td className="px-2.5 py-2 text-right">{fmtCount(x.ordersPerDay === null ? null : Math.round(x.ordersPerDay), lang)}</td>
      <td className="px-2.5 py-2 text-right whitespace-nowrap">{fmtMoneyCompact(x.aov, lang)}</td>
      <td className="px-2.5 py-2 text-right">{fmtRate(x.cancelRate, lang)}</td>
      <td className="px-2.5 py-2 text-right whitespace-nowrap">{fmtMoneyCompact(x.profitPerDay, lang)}</td>
      <td className="px-2.5 py-2 text-right whitespace-nowrap">{x.upliftVsWeekday === null ? '—' : x.key === 'weekday' ? (vi ? 'mốc' : 'base') : fmtChange(x.upliftVsWeekday, lang)}</td>
    </tr>
  );

  const metricRows: { label: string; get: (r: CampaignResult) => string; change?: Comparison; rate?: boolean; goodWhenUp?: boolean }[] = cmp
    ? [
        { label: 'GMV', get: (r) => fmtMoneyCompact(r.kpis.metrics.gmv.value, lang), change: cmp.changes.gmv },
        { label: vi ? 'GMV / ngày' : 'GMV / day', get: (r) => fmtMoneyCompact(r.gmvPerDay, lang) },
        { label: vi ? 'Mức tăng so với ngày thường trước đó' : 'Uplift vs normal days before', get: (r) => (r.uplift === null ? (vi ? 'Không đủ dữ liệu' : 'N/A') : fmtChange(r.uplift, lang)), change: cmp.changes.uplift, rate: true },
        { label: vi ? 'Đơn đặt' : 'Orders', get: (r) => fmtCount(r.kpis.metrics.orders.value, lang), change: cmp.changes.orders },
        { label: 'AOV', get: (r) => fmtMoneyCompact(r.kpis.metrics.aov.value, lang), change: cmp.changes.aov },
        { label: vi ? 'Tỷ lệ hủy' : 'Cancel rate', get: (r) => fmtRate(r.kpis.metrics.cancelRate.value, lang), change: cmp.changes.cancelRate, rate: true, goodWhenUp: false },
        { label: vi ? 'Tỷ lệ trả/hoàn' : 'Refund rate', get: (r) => fmtRate(r.kpis.metrics.refundRate.value, lang), change: cmp.changes.refundRate, rate: true, goodWhenUp: false },
        { label: vi ? 'Lợi nhuận đóng góp' : 'Contribution profit', get: (r) => fmtMoneyCompact(r.kpis.metrics.profit.value, lang), change: cmp.changes.profit },
        { label: 'Margin', get: (r) => fmtRate(r.kpis.metrics.margin.value, lang), change: cmp.changes.margin, rate: true },
        { label: vi ? 'Chi phí Ads' : 'Ad spend', get: (r) => fmtMoneyCompact(r.adSpend, lang), change: cmp.changes.adSpend, goodWhenUp: false },
      ]
    : [];

  return (
    <div className="space-y-4">
      {perf.warnings.map((w, i) => (
        <p key={i} className="text-xs text-[#fab219] rounded-xl border border-[#fab219]/30 bg-[#fab219]/[0.06] px-3 py-2">{tr(lang, w)}</p>
      ))}

      <Section
        title={vi ? 'Hiệu quả theo loại ngày' : 'Performance by day type'}
        subtitle={vi ? `${formatRangeVi(range)} · ${perf.analyzedDays} ngày · ${perf.months} tháng · cột "Ngày" là cỡ mẫu` : `${formatRangeVi(range)} · ${perf.analyzedDays} days`}
      >
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-xs">
            <thead className="bg-white/[0.04] text-slate-400">
              <tr>
                <Th left>{vi ? 'Loại ngày' : 'Day type'}</Th>
                <Th title={vi ? 'Số ngày trong mẫu' : 'Sample size'}>{vi ? 'Ngày' : 'Days'}</Th>
                <Th>{vi ? 'GMV/ngày' : 'GMV/day'}</Th>
                <Th>{vi ? 'Đơn/ngày' : 'Orders/day'}</Th>
                <Th>AOV</Th>
                <Th>{vi ? 'Hủy' : 'Cancel'}</Th>
                <Th>{vi ? 'LN/ngày' : 'Profit/day'}</Th>
                <Th title={vi ? 'GMV/ngày so với ngày thường trong tuần' : 'GMV/day vs weekdays'}>{vi ? 'So với ngày thường' : 'Vs weekday'}</Th>
              </tr>
            </thead>
            <tbody>
              {perf.byDayType.map(bucketRow)}
              <tr className="border-t border-white/15 bg-white/[0.03]">
                <td className="px-2.5 py-2 font-bold text-white" colSpan={8}>
                  {vi ? 'Ngày sale so với ngày thường: ' : 'Sale vs normal days: '}
                  <span className="text-sky-300">{fmtMoneyCompact(perf.saleVsNormal.sale.gmvPerDay, lang)}</span> {vi ? 'so với' : 'vs'}{' '}
                  <span className="text-slate-300">{fmtMoneyCompact(perf.saleVsNormal.normal.gmvPerDay, lang)}</span> / {vi ? 'ngày' : 'day'} ({fmtChange(perf.saleVsNormal.uplift, lang)}) ·{' '}
                  {vi ? 'hủy' : 'cancel'} {fmtRate(perf.saleVsNormal.sale.cancelRate, lang)} {vi ? 'so với' : 'vs'} {fmtRate(perf.saleVsNormal.normal.cancelRate, lang)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Section title={vi ? 'Theo thứ trong tuần' : 'By day of week'} subtitle={vi ? 'Chỉ ngày thường (đã loại ngày sale, ngày lương)' : 'Normal days only'}>
          <div className="h-52" role="img" aria-label={vi ? 'GMV trung bình mỗi ngày theo thứ' : 'Average GMV per weekday'}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perf.byWeekday.map((w) => ({ label: tr(lang, w.label), gmv: w.gmvPerDay, days: w.days }))}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.12)' }} />
                <YAxis tickFormatter={(v: number) => fmtMoneyCompact(v, lang)} tick={{ fill: '#94a3b8', fontSize: 11 }} width={60} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: '#0b1024', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, fontSize: 12 }}
                  formatter={(v: number, _n: string, p: { payload?: { days?: number } }) => [`${fmtMoney(v, lang)} (${p.payload?.days ?? 0} ${vi ? 'ngày mẫu' : 'days'})`, vi ? 'GMV/ngày' : 'GMV/day']}
                />
                <Bar isAnimationActive={false} dataKey="gmv" fill={BAR} radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
        <Section title={vi ? 'Theo ngày trong tháng' : 'By day of month'} subtitle={vi ? '● = có ngày sale trong mẫu' : '● = includes sale days'}>
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs max-h-52 overflow-y-auto pr-1">
            {perf.byDayOfMonth.map((d) => {
              const max = Math.max(...perf.byDayOfMonth.map((x) => x.gmvPerDay ?? 0)) || 1;
              return (
                <li key={d.key} className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-6 text-right">{d.key}</span>
                  <span className="flex-1 h-1.5 rounded-full bg-white/[0.06]"><span className="block h-1.5 rounded-full bg-[#3987e5]" style={{ width: `${((d.gmvPerDay ?? 0) / max) * 100}%` }} /></span>
                  <span className="w-16 text-right whitespace-nowrap">{fmtMoneyCompact(d.gmvPerDay, lang)}</span>
                  <span className={`w-2 ${d.saleDays ? 'text-[#fab219]' : 'text-transparent'}`} aria-label={d.saleDays ? (vi ? 'có ngày sale' : 'sale day') : undefined}>●</span>
                </li>
              );
            })}
          </ul>
        </Section>
      </div>

      <Section
        title={vi ? 'So sánh chiến dịch' : 'Campaign comparison'}
        subtitle={vi ? 'Mức tăng = GMV/ngày của chiến dịch so với trung bình các ngày thường trong 14 ngày trước đó' : 'Uplift = campaign GMV/day vs the normal days in the 14 days before'}
      >
        {all.length < 2 ? (
          <NotEnoughData lang={lang} reason={vi ? 'Cần ít nhất 2 chiến dịch/ngày sale trong dữ liệu.' : 'At least 2 campaigns are needed.'} />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-3 text-xs text-slate-300">
              {[
                { label: vi ? 'Kỳ gốc (A)' : 'Reference (A)', value: a?.campaignId, set: setAId },
                { label: vi ? 'So với (B)' : 'Compare (B)', value: b?.campaignId, set: setBId },
              ].map((s) => (
                <label key={s.label} className="flex items-center gap-1.5">
                  {s.label}
                  <select value={s.value} onChange={(e) => s.set(e.target.value)} className="bg-white/[0.06] border border-white/15 rounded-lg px-2 py-1 text-slate-100 [color-scheme:dark]">
                    {all.map((c) => (
                      <option key={c.campaignId} value={c.campaignId}>{c.name} · {formatRangeVi(c.range)}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            {cmp && (
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full text-xs">
                    <thead className="bg-white/[0.04] text-slate-400">
                      <tr>
                        <Th left>{vi ? 'Chỉ số' : 'Metric'}</Th>
                        <Th>A · {cmp.a.entry.name}</Th>
                        <Th>B · {cmp.b.entry.name}</Th>
                        <Th>{vi ? 'B so với A' : 'B vs A'}</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {metricRows.map((m) => (
                        <tr key={m.label} className="border-t border-white/5 text-slate-200">
                          <td className="px-2.5 py-2">{m.label}</td>
                          <td className="px-2.5 py-2 text-right whitespace-nowrap">{m.get(cmp.a)}</td>
                          <td className="px-2.5 py-2 text-right whitespace-nowrap font-semibold text-white">{m.get(cmp.b)}</td>
                          <td className="px-2.5 py-2 text-right whitespace-nowrap">{m.change ? <ChangeCell c={m.change} rate={m.rate} goodWhenUp={m.goodWhenUp} lang={lang} /> : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="space-y-3 text-xs">
                  {[cmp.a, cmp.b].map((r, i) => (
                    <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <b className="text-white">{i === 0 ? 'A' : 'B'} · {r.entry.name}</b>
                        <EvidenceButton compact lang={lang} onClick={() => openEvidence({ title: r.entry.name, filter: { range: r.entry.range, platforms: baseFilter.platforms } })} />
                      </div>
                      <div className="text-slate-400 mt-1">{vi ? 'Top SKU:' : 'Top SKUs:'} {r.topSkus.slice(0, 3).map((s) => `${s.label} (${fmtMoneyCompact(s.current.gmv, lang)})`).join(', ')}</div>
                      {r.cancelReasons.length > 0 && (
                        <div className="text-slate-400 mt-1">{vi ? 'Lý do hủy nhiều nhất:' : 'Top cancel reasons:'} {r.cancelReasons.map((c) => `${c.reason} (${fmtRate(c.share, lang, 0)})`).join(', ')}</div>
                      )}
                    </div>
                  ))}
                  <p className="text-[11px] text-slate-500">{vi ? 'So sánh 2 chiến dịch chỉ là 2 quan sát — chênh lệch có thể đến từ sản phẩm, ngân sách hoặc thời điểm, không phải từ bản thân chiến dịch.' : 'Two campaigns are two observations — differences may come from products, budget or timing.'}</p>
                </div>
              </div>
            )}
          </>
        )}
      </Section>
    </div>
  );
};

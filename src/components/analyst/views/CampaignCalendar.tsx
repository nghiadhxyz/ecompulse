import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  calendarPerformance,
  campaignCalendar,
  compareCampaigns,
  fmtChange,
  fmtCount,
  fmtDay,
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
import { PlacedOnlyNote } from '../../workspace/OrderStagePicker';
import { SampleTag, SmallRateCell } from '../../workspace/SampleSize';
import { REFERENCE_MAX_SAMPLES } from '../../../analytics';
import { ChangeCell, Th } from '../ui';

const BAR = '#3987e5';

export const CampaignCalendar: React.FC = () => {
  const { lang, dataset, baseFilter, range, openEvidence, settings, updateSettings } = useWorkspace();
  const [manualDay, setManualDay] = useState('');
  // Confirmed / hand-entered sale days live in the settings (5.4).
  const confirmedDays = settings?.confirmedSaleDays ?? [];
  const setConfirmed = (days: string[]) => updateSettings?.({ ...(settings ?? {}), confirmedSaleDays: [...new Set(days)].sort() });
  const vi = lang === 'vi';
  const perf = useMemo(() => calendarPerformance(dataset, baseFilter), [dataset, baseFilter]);
  const all = useMemo(() => campaignCalendar(dataset).sort((a, b) => a.range.start.localeCompare(b.range.start)), [dataset]);
  const majors = all.filter((c) => c.type !== 'payday');
  const [aId, setAId] = useState<string | null>(null);
  const [bId, setBId] = useState<string | null>(null);
  const a = all.find((c) => c.campaignId === aId) ?? majors[majors.length - 2] ?? all[0];
  const b = all.find((c) => c.campaignId === bId) ?? majors[majors.length - 1] ?? all[1];
  const cmp = useMemo(() => (a && b && a !== b ? compareCampaigns(dataset, a, b, baseFilter.platforms) : null), [dataset, a, b, baseFilter.platforms]);

  if (dataset.orders.length === 0 && dataset.dailyMetrics.length === 0) {
    return (
      <Section title="Campaign & Calendar">
        <NotEnoughData lang={lang} reason={vi ? 'Cần file xuất đơn hàng để phân tích theo ngày.' : 'Needs an order export.'} />
      </Section>
    );
  }

  // Profit per day needs COGS: without it the column is hidden (one note below the table).
  const hasProfit = perf.byDayType.some((b) => b.profitPerDay !== null);
  const bucketRow = (x: BucketStats) => (
    <tr key={x.key} className="border-t border-white/5 text-slate-200">
      <td className="px-2.5 py-2 font-semibold text-white">
        {tr(lang, x.label)}
        <SampleTag n={x.days} lang={lang} />
      </td>
      <td className="px-2.5 py-2 text-right">{x.days}</td>
      <td className="px-2.5 py-2 text-right whitespace-nowrap">{fmtMoneyCompact(x.gmvPerDay, lang)}</td>
      <td className="px-2.5 py-2 text-right">{fmtCount(x.ordersPerDay === null ? null : Math.round(x.ordersPerDay), lang)}</td>
      <td className="px-2.5 py-2 text-right whitespace-nowrap">{fmtMoneyCompact(x.aov, lang)}</td>
      <SmallRateCell rate={x.cancelRate} orders={x.ordersPerDay === null ? 0 : x.ordersPerDay * x.days} lang={lang} />
      {hasProfit && <td className="px-2.5 py-2 text-right whitespace-nowrap">{fmtMoneyCompact(x.profitPerDay, lang)}</td>}
      <td className="px-2.5 py-2 text-right whitespace-nowrap">{x.upliftVsWeekday === null ? '—' : x.key === 'weekday' ? (vi ? 'mốc' : 'base') : fmtChange(x.upliftVsWeekday, lang)}</td>
    </tr>
  );

  const metricRows: { label: string; get: (r: CampaignResult) => string; change?: Comparison; rate?: boolean; goodWhenUp?: boolean }[] = cmp
    ? [
        { label: 'GMV', get: (r) => fmtMoneyCompact(r.kpis.metrics.gmv.value, lang), change: cmp.changes.gmv },
        { label: vi ? 'GMV / ngày' : 'GMV / day', get: (r) => fmtMoneyCompact(r.gmvPerDay, lang) },
        { label: vi ? 'Mức tăng so với 14 ngày trước chiến dịch' : 'Uplift vs the 14 days before', get: (r) => (r.uplift === null ? (vi ? 'Không đủ dữ liệu' : 'N/A') : fmtChange(r.uplift, lang)), change: cmp.changes.uplift, rate: true },
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
      <PlacedOnlyNote lang={lang} show={dataset.orders.length === 0 && dataset.dailyMetrics.length > 0} />
      {perf.warnings.map((w, i) => (
        <p key={i} className="text-xs text-[#fab219] rounded-xl border border-[#fab219]/30 bg-[#fab219]/[0.06] px-3 py-2">{tr(lang, w)}</p>
      ))}

      {(perf.suggestedSaleDays.length > 0 || confirmedDays.length > 0 || updateSettings) && (
        <Section
          title={vi ? 'Lịch ngày sale' : 'Sale-day calendar'}
          subtitle={vi ? 'Ngày được xác nhận là ngày sale sẽ bị loại khỏi mốc "ngày thường" ở mọi bảng trên trang này.' : 'Confirmed sale days are left out of every "normal day" baseline on this page.'}
        >
          {perf.suggestedSaleDays.length > 0 && (
            <>
              <div className="text-xs font-bold text-slate-300 mb-1">{vi ? 'Ngày nghi là sale — cần bạn xác nhận' : 'Possible sale days — please confirm'}</div>
              <ul className="space-y-1 mb-3">
                {perf.suggestedSaleDays.map((s) => (
                  <li key={s.date} className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                    <b className="text-white w-14">{fmtDay(s.date)}</b>
                    <span className="text-slate-400">{s.reasons.map((r) => tr(lang, r)).join(' · ')}{s.autoDoubleDay ? (vi ? ' · đang được tự nhận là ngày đôi' : ' · auto double day') : ''}</span>
                    {updateSettings && (
                      <button onClick={() => setConfirmed([...confirmedDays, s.date])} className="px-2 py-0.5 rounded-md border border-sky-400/40 text-sky-200 font-semibold">
                        {vi ? 'Xác nhận là ngày sale' : 'Confirm sale day'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          {confirmedDays.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-300 mb-2">
              {vi ? 'Đã xác nhận:' : 'Confirmed:'}
              {confirmedDays.map((d) => (
                <span key={d} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-white/15">
                  {fmtDay(d)}
                  {updateSettings && (
                    <button onClick={() => setConfirmed(confirmedDays.filter((x) => x !== d))} aria-label={vi ? `Bỏ ${fmtDay(d)}` : `Remove ${fmtDay(d)}`} className="text-slate-500 hover:text-white">×</button>
                  )}
                </span>
              ))}
            </div>
          )}
          {updateSettings && (
            <form
              className="flex items-center gap-2 text-xs text-slate-300"
              onSubmit={(e) => {
                e.preventDefault();
                if (/^\d{4}-\d{2}-\d{2}$/.test(manualDay)) setConfirmed([...confirmedDays, manualDay]);
                setManualDay('');
              }}
            >
              {vi ? 'Nhập ngày sale thủ công:' : 'Add a sale day:'}
              <input type="date" value={manualDay} onChange={(e) => setManualDay(e.target.value)} className="bg-white/[0.06] border border-white/15 rounded-lg px-2 py-1 text-slate-100 [color-scheme:dark]" />
              <button type="submit" className="px-2 py-1 rounded-md border border-white/15 font-semibold">{vi ? 'Thêm' : 'Add'}</button>
            </form>
          )}
        </Section>
      )}

      <Section
        title={vi ? 'Hiệu quả theo loại ngày' : 'Performance by day type'}
        subtitle={vi ? `${formatRangeVi(range)} · ${perf.analyzedDays} ngày · cột "Ngày" là cỡ mẫu · mức tăng so với ngày thường cả kỳ` : `${formatRangeVi(range)} · ${perf.analyzedDays} days · uplift vs weekdays of the whole period`}
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
                {hasProfit && <Th>{vi ? 'LN/ngày' : 'Profit/day'}</Th>}
                <Th title={vi ? 'GMV/ngày so với ngày thường trong tuần của cả kỳ' : 'GMV/day vs weekdays of the whole period'}>{vi ? 'So với ngày thường cả kỳ' : 'Vs weekdays (period)'}</Th>
              </tr>
            </thead>
            <tbody>
              {perf.byDayType.map(bucketRow)}
              <tr className="border-t border-white/15 bg-white/[0.03]">
                <td className="px-2.5 py-2 font-bold text-white" colSpan={hasProfit ? 8 : 7}>
                  {vi ? 'Ngày sale so với ngày thường: ' : 'Sale vs normal days: '}
                  <span className="text-sky-300">{fmtMoneyCompact(perf.saleVsNormal.sale.gmvPerDay, lang)}</span> {vi ? 'so với' : 'vs'}{' '}
                  <span className="text-slate-300">{fmtMoneyCompact(perf.saleVsNormal.normal.gmvPerDay, lang)}</span> / {vi ? 'ngày' : 'day'} ({fmtChange(perf.saleVsNormal.uplift, lang)}) ·{' '}
                  {vi ? 'hủy' : 'cancel'} {fmtRate(perf.saleVsNormal.sale.cancelRate, lang)} {vi ? 'so với' : 'vs'} {fmtRate(perf.saleVsNormal.normal.cancelRate, lang)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {!hasProfit && <p className="text-[11px] text-slate-500 mt-1.5">{vi ? 'Chưa có giá vốn nên chưa tính lợi nhuận theo ngày.' : 'No COGS yet, so no profit per day.'}</p>}
      </Section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Section
          title={vi ? 'Theo thứ trong tuần' : 'By day of week'}
          subtitle={
            vi
              ? `Chỉ ngày không sale${perf.byWeekday.some((w) => w.days > 0 && w.days <= REFERENCE_MAX_SAMPLES) ? ` · mỗi thứ chỉ có ${Math.min(...perf.byWeekday.filter((w) => w.days > 0).map((w) => w.days))}–${Math.max(...perf.byWeekday.map((w) => w.days))} ngày: tham khảo` : ''}`
              : 'Non-sale days only'
          }
        >
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
        {perf.showByDayOfMonth ? (
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
        ) : (
          <Section title={vi ? 'Theo ngày trong tháng' : 'By day of month'}>
            <p className="text-sm text-slate-400">{vi ? 'Không đủ dữ liệu: cần từ 2 tháng trở lên để mỗi ngày trong tháng có ít nhất 2 mẫu.' : 'Not enough data: needs 2+ months.'}</p>
          </Section>
        )}
      </div>

      <Section
        title={vi ? 'So sánh chiến dịch' : 'Campaign comparison'}
        subtitle={vi ? 'Mức tăng so với 14 ngày trước chiến dịch (chỉ ngày thường, đã loại ngày sale đã xác nhận)' : 'Uplift vs the normal days in the 14 days before the campaign'}
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

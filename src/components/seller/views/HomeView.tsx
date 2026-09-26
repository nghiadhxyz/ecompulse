import React, { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight, Wallet } from 'lucide-react';
import {
  addDays,
  compareValues,
  comparePeriods,
  dailySeries,
  detectAlerts,
  fmtDay,
  fmtMoney,
  fmtMoneyCompact,
  fmtRate,
  formatRangeVi,
  type MetricComparison,
  type MetricResult,
  type ProfitResult,
} from '../../../analytics';
import { useSeller } from '../SellerContext';
import { EvidenceButton, GhostButton, HelpTip, KpiCard, NotEnoughData, Section, SeverityBadge, SourceBadge, tr } from '../ui';
import { SummaryChannelsPanel } from '../../workspace/SummaryPanels';
import { SubsidyPanel } from '../../workspace/SummaryInsightPanels';

const BAR_COLOR = '#3987e5';

function sumMetrics(a: MetricResult, b: MetricResult): MetricResult {
  if (a.value === null || b.value === null) return { ...a, value: null, status: 'missing', notes: a.notes ?? b.notes };
  return { value: a.value + b.value, unit: a.unit, status: a.status === 'ok' && b.status === 'ok' ? 'ok' : 'partial', notes: [...(a.notes || []), ...(b.notes || [])] };
}

function sumComparison(a: MetricComparison, b: MetricComparison): MetricComparison {
  const cur = a.current !== null && b.current !== null ? a.current + b.current : null;
  const prev = a.previous !== null && b.previous !== null ? a.previous + b.previous : null;
  return { ...compareValues(cur, prev, 'count'), unit: 'count', currentStatus: a.currentStatus, previousStatus: a.previousStatus, notes: a.notes };
}

export const HomeView: React.FC = () => {
  const { lang, dataset, range, previousRange, compareMode, platforms, stage, asOf, openEvidence, goTo } = useSeller();
  const vi = lang === 'vi';
  const cmp = useMemo(() => comparePeriods(dataset, { range, platforms, stage }, compareMode), [dataset, range, platforms, stage, compareMode]);
  const series = useMemo(() => dailySeries(dataset, { range, platforms, stage }), [dataset, range, platforms, stage]);
  const alertDay = addDays(asOf, -1);
  const alerts = useMemo(() => detectAlerts(dataset, { day: alertDay, platforms }), [dataset, alertDay, platforms]);

  const k = cmp.current.metrics;
  const c = cmp.metrics;
  const compareLabel = vi ? `so với ${formatRangeVi(previousRange)}` : `vs ${formatRangeVi(previousRange)}`;
  const returns = sumMetrics(k.returnedOrders, k.refundedOrders);
  const returnsCmp = sumComparison(c.returnedOrders, c.refundedOrders);
  const topAlerts = alerts.filter((a) => a.severity !== 'info').slice(0, 3);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5 sm:gap-3">
        <KpiCard lang={lang} label={vi ? 'Doanh thu' : 'Revenue'} metric={k.gmv} cmp={c.gmv} compareLabel={compareLabel} emphasis />
        <KpiCard
          lang={lang}
          label={vi ? 'Doanh thu thực nhận' : 'Net revenue'}
          metric={k.netRevenue}
          cmp={c.netRevenue}
          compareLabel={compareLabel}
          sub={<HelpTip text={vi ? 'Doanh thu − voucher shop chịu − tiền hoàn cho khách' : 'Revenue − seller vouchers − refunds'} />}
        />
        <KpiCard lang={lang} label={vi ? 'Lợi nhuận ước tính' : 'Est. profit'} metric={k.profit} cmp={c.profit} compareLabel={compareLabel} emphasis />
        <KpiCard lang={lang} label={vi ? 'Biên lợi nhuận' : 'Margin'} metric={k.margin} cmp={c.margin} compareLabel={compareLabel} />
        <KpiCard lang={lang} label={vi ? 'Đơn hàng' : 'Orders'} metric={k.orders} cmp={c.orders} compareLabel={compareLabel} />
        <KpiCard lang={lang} label={vi ? 'Sản phẩm bán ra' : 'Units sold'} metric={k.units} cmp={c.units} compareLabel={compareLabel} />
        <KpiCard lang={lang} label={vi ? 'Giá trị TB/đơn (AOV)' : 'AOV'} metric={k.aov} cmp={c.aov} compareLabel={compareLabel} />
        <KpiCard
          lang={lang}
          label={vi ? 'Đơn hủy' : 'Cancelled'}
          metric={k.cancelledOrders}
          cmp={c.cancelRate}
          goodWhenUp={false}
          compareLabel={compareLabel}
          sub={k.cancelRate.value !== null ? <span className="text-[11px] text-slate-400">{vi ? 'Tỷ lệ hủy' : 'Rate'} {fmtRate(k.cancelRate.value, lang)}</span> : undefined}
        />
        <KpiCard
          lang={lang}
          label={vi ? 'Đơn hoàn/trả' : 'Returns'}
          metric={returns}
          cmp={returnsCmp}
          goodWhenUp={false}
          compareLabel={compareLabel}
          sub={k.refundRate.value !== null ? <span className="text-[11px] text-slate-400">{vi ? 'Tỷ lệ' : 'Rate'} {fmtRate(k.refundRate.value, lang)}</span> : undefined}
        />
      </div>

      {cmp.previous.coverage !== 'full' && (
        <p className="text-xs text-slate-400">
          {vi
            ? `Kỳ so sánh ${formatRangeVi(previousRange)} ${cmp.previous.coverage === 'none' ? 'chưa có dữ liệu' : 'chỉ có một phần dữ liệu'} — một số chỉ số không so sánh được.`
            : `Comparison period ${formatRangeVi(previousRange)} is ${cmp.previous.coverage === 'none' ? 'not in the data' : 'only partly covered'}.`}
        </p>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3">
          <Section title={vi ? 'Doanh thu theo ngày' : 'Daily revenue'} subtitle={formatRangeVi(range)}>
            {series.length <= 1 ? (
              <p className="text-sm text-slate-400">{vi ? 'Chọn khoảng từ 2 ngày trở lên để xem xu hướng.' : 'Pick 2+ days to see a trend.'}</p>
            ) : series.every((p) => p.gmv === null) ? (
              <NotEnoughData lang={lang} reason={vi ? 'Chưa có doanh thu theo ngày trong khoảng này.' : 'No daily revenue in this range.'} />
            ) : (
              <div className="h-56" role="img" aria-label={vi ? 'Biểu đồ doanh thu theo ngày' : 'Daily revenue chart'}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={series.map((p) => ({ ...p, label: fmtDay(p.date) }))} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap={2}>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.12)' }} minTickGap={16} />
                    <YAxis tickFormatter={(v: number) => fmtMoneyCompact(v, lang)} tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} width={64} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      contentStyle={{ background: '#0b1024', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, fontSize: 12 }}
                      labelStyle={{ color: '#e2e8f0', fontWeight: 700 }}
                      itemStyle={{ color: '#cbd5e1' }}
                      formatter={(v: number) => [fmtMoney(v, lang), vi ? 'Doanh thu' : 'Revenue']}
                    />
                    <Bar isAnimationActive={false} dataKey="gmv" fill={BAR_COLOR} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Section>
        </div>
        <div className="xl:col-span-2">
          <Section
            title={vi ? 'Cảnh báo' : 'Alerts'}
            subtitle={vi ? `Tính đến ngày ${fmtDay(alertDay)}` : `As of ${fmtDay(alertDay)}`}
            right={
              <button onClick={() => goTo('dolphin')} className="text-xs text-sky-300 hover:text-sky-200 inline-flex items-center gap-1">
                {vi ? 'Xem tất cả' : 'See all'} <ArrowRight className="w-3 h-3" />
              </button>
            }
          >
            {dataset.orders.length === 0 && dataset.dailyMetrics.length === 0 ? (
              <NotEnoughData lang={lang} reason={vi ? 'Chưa có dữ liệu để tạo cảnh báo.' : 'No data for alerts yet.'} />
            ) : topAlerts.length === 0 ? (
              <p className="text-sm text-slate-400">{vi ? 'Không có điểm bất thường cần chú ý.' : 'Nothing unusual to flag.'}</p>
            ) : (
              <ul className="space-y-2.5">
                {topAlerts.map((a) => (
                  <li key={a.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-bold text-white leading-snug">{tr(lang, a.title)}</div>
                      <SeverityBadge severity={a.severity} lang={lang} />
                    </div>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">{tr(lang, a.message)}</p>
                    {a.evidence[0]?.filter && (
                      <div className="mt-2">
                        <EvidenceButton compact lang={lang} onClick={() => openEvidence({ title: tr(lang, a.title), filter: a.evidence.find((e) => e.filter)!.filter!, evidence: a.evidence })} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>

      <SummaryChannelsPanel />
      <SubsidyPanel />

      <ProfitSection profit={cmp.current.profit} />
    </div>
  );
};

const ProfitSection: React.FC<{ profit: ProfitResult | null }> = ({ profit }) => {
  const { lang, range, platforms, goTo, openEvidence } = useSeller();
  const vi = lang === 'vi';
  const title = vi ? 'Lời / Lỗ thật' : 'Real profit';
  if (!profit || profit.completeness === 'insufficient') {
    const reason = profit?.warnings[0]?.[lang] ?? (vi ? 'Cần file xuất đơn hàng có SKU và giá vốn.' : 'Needs an order export with SKUs and COGS.');
    return (
      <Section title={title}>
        <NotEnoughData
          lang={lang}
          reason={reason}
          action={
            <GhostButton onClick={() => goTo(profit && profit.missingCogsSkus.length ? 'settings' : 'data')}>
              {profit && profit.missingCogsSkus.length ? (vi ? 'Nhập giá vốn' : 'Enter COGS') : vi ? 'Nhập dữ liệu' : 'Import data'}
            </GhostButton>
          }
        />
      </Section>
    );
  }
  const costKeys = new Set(['sellerDiscount', 'refund', 'cogs', 'platformFee', 'paymentFee', 'affiliate', 'ads', 'shipping', 'otherCosts']);
  return (
    <Section
      title={title}
      subtitle={vi ? 'Doanh thu trừ đi mọi chi phí đã biết — xem nguồn của từng khoản' : 'Revenue minus every known cost — with the source of each line'}
      right={<EvidenceButton lang={lang} onClick={() => openEvidence({ title, filter: { range, platforms } })} />}
    >
      {profit.warnings.length > 0 && (
        <div className="mb-3 rounded-xl border border-[#fab219]/40 bg-[#fab219]/10 p-3 space-y-1">
          {profit.warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-100 leading-snug">• {w[lang]}</p>
          ))}
          <div className="flex flex-wrap gap-2 pt-1">
            {profit.missingCogsSkus.length > 0 && <GhostButton className="!text-xs !py-1" onClick={() => goTo('settings')}>{vi ? 'Nhập giá vốn' : 'Enter COGS'}</GhostButton>}
            <GhostButton className="!text-xs !py-1" onClick={() => goTo('settings')}>{vi ? 'Cài đặt phí & chi phí' : 'Fees & costs'}</GhostButton>
          </div>
        </div>
      )}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        {profit.lines.map((l) => {
          const isTotal = l.key === 'netRevenue' || l.key === 'profit';
          const isCost = costKeys.has(l.key);
          return (
            <div key={l.key} className={`flex items-center justify-between gap-3 px-3 py-2 text-sm border-t border-white/5 first:border-t-0 ${isTotal ? 'bg-white/[0.05] font-black text-white' : 'text-slate-200'}`}>
              <span className="flex items-center gap-2 min-w-0">
                <span className="truncate">{isCost ? '− ' : isTotal ? '= ' : ''}{tr(lang, l.label)}</span>
                {!isTotal && l.key !== 'gmv' && <SourceBadge source={l.source} lang={lang} />}
              </span>
              <span className={`whitespace-nowrap ${l.key === 'profit' && (l.amount ?? 0) < 0 ? 'text-[#f08080]' : ''}`}>{l.amount === null ? '—' : fmtMoney(l.amount, lang)}</span>
            </div>
          );
        })}
        <div className="flex items-center justify-between px-3 py-2 text-sm bg-white/[0.05] border-t border-white/10">
          <span className="font-bold text-white">{vi ? 'Biên lợi nhuận' : 'Margin'}</span>
          <span className="font-black text-white">{profit.margin.value === null ? '—' : fmtRate(profit.margin.value, lang)}</span>
        </div>
      </div>
      <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
        <Wallet className="w-3 h-3" aria-hidden />
        {vi ? 'Lợi nhuận đóng góp = trước thuế, chưa gồm chi phí không nhập vào EcomPulse.' : 'Contribution profit, before tax, excluding costs not entered in EcomPulse.'}
      </p>
    </Section>
  );
};

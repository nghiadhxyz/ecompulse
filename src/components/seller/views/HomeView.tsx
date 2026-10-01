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
  moneyTolerance,
  type MetricComparison,
  type MetricResult,
  type ProfitResult,
} from '../../../analytics';
import { useSeller } from '../SellerContext';
import { EvidenceButton, GhostButton, HelpTip, KpiCard, NotEnoughData, Section, SeverityBadge, SourceBadge, tr } from '../ui';
import { SummaryChannelsPanel } from '../../workspace/SummaryPanels';
import { ChartTotalNote } from '../../workspace/MismatchBox';
import { SubsidyPanel } from '../../workspace/SummaryInsightPanels';
import { AlertStack } from '../../ui/data';
import { CHART, axisProps, gridProps, tooltipProps } from '../../../theme/chart';


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
      <AlertStack
        lang={lang}
        items={
          cmp.previous.coverage !== 'full'
            ? [
                {
                  id: 'cmp',
                  tone: cmp.previous.coverage === 'none' ? 'info' : 'warn',
                  title: vi ? (cmp.previous.coverage === 'none' ? 'Không có kỳ so sánh' : 'Kỳ so sánh chỉ có một phần dữ liệu') : 'Comparison period not fully covered',
                  detail: vi ? `${formatRangeVi(previousRange)} — một số chỉ số không so sánh được.` : formatRangeVi(previousRange),
                },
              ]
            : []
        }
      />
      <div className="grid grid-cols-2 gap-4 min-[900px]:grid-cols-3 min-[1200px]:grid-cols-4 min-[1440px]:grid-cols-5">
        <KpiCard lang={lang} label={vi ? 'Doanh thu' : 'Revenue'} metric={k.gmv} cmp={c.gmv} compareLabel={compareLabel} emphasis />
        <KpiCard
          lang={lang}
          label={vi ? 'Doanh thu thực nhận' : 'Net revenue'}
          metric={k.netRevenue}
          cmp={c.netRevenue}
          compareLabel={compareLabel}
          definition={vi ? 'Doanh thu − doanh số hủy − tiền hoàn cho khách' : 'Revenue − cancelled sales − refunds'}
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
          sub={k.cancelRate.value !== null ? `${vi ? 'Tỷ lệ hủy' : 'Rate'} ${fmtRate(k.cancelRate.value, lang)}` : undefined}
        />
        <KpiCard
          lang={lang}
          label={vi ? 'Đơn hoàn/trả' : 'Returns'}
          metric={returns}
          cmp={returnsCmp}
          goodWhenUp={false}
          compareLabel={compareLabel}
          sub={k.refundRate.value !== null ? `${vi ? 'Tỷ lệ' : 'Rate'} ${fmtRate(k.refundRate.value, lang)}` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3">
          <Section title={vi ? 'Doanh thu theo ngày' : 'Daily revenue'} subtitle={formatRangeVi(range)}>
            {series.length <= 1 ? (
              <p className="text-sm text-muted">{vi ? 'Chọn khoảng từ 2 ngày trở lên để xem xu hướng.' : 'Pick 2+ days to see a trend.'}</p>
            ) : series.every((p) => p.gmv === null) ? (
              <NotEnoughData lang={lang} reason={vi ? 'Chưa có doanh thu theo ngày trong khoảng này.' : 'No daily revenue in this range.'} />
            ) : (
              <div className="h-56" role="img" aria-label={vi ? 'Biểu đồ doanh thu theo ngày' : 'Daily revenue chart'}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={series.map((p) => ({ ...p, label: fmtDay(p.date) }))} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap={2}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="label" tick={axisProps.tick} tickLine={false} axisLine={{ stroke: CHART.grid }} minTickGap={16} />
                    <YAxis tickFormatter={(v: number) => fmtMoneyCompact(v, lang)} tick={axisProps.tick} tickLine={false} axisLine={false} width={64} />
                    <Tooltip {...tooltipProps}
                      cursor={{ fill: 'var(--hover)' }}
                      formatter={(v: number) => [fmtMoney(v, lang), vi ? 'Doanh thu' : 'Revenue']}
                    />
                    <Bar isAnimationActive={false} dataKey="gmv" fill={CHART.primary} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <ChartTotalNote chartTotal={series.reduce((s, p) => s + (p.gmv ?? 0), 0)} kpi={k.gmv.value} lang={lang} tolerance={moneyTolerance(k.gmv.value ?? 0)} />
          </Section>
        </div>
        <div className="xl:col-span-2">
          <Section
            title={vi ? 'Cảnh báo' : 'Alerts'}
            subtitle={vi ? `Tính đến ngày ${fmtDay(alertDay)}` : `As of ${fmtDay(alertDay)}`}
            right={
              <button type="button" onClick={() => goTo('dolphin')} className="inline-flex min-h-10 items-center gap-1 rounded-control px-2 text-sm font-semibold text-primary hover:bg-primary-soft">
                {vi ? 'Xem tất cả' : 'See all'} <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            }
          >
            {dataset.orders.length === 0 && dataset.dailyMetrics.length === 0 ? (
              <NotEnoughData lang={lang} reason={vi ? 'Chưa có dữ liệu để tạo cảnh báo.' : 'No data for alerts yet.'} />
            ) : topAlerts.length === 0 ? (
              <p className="text-sm text-muted">{vi ? 'Không có điểm bất thường cần chú ý.' : 'Nothing unusual to flag.'}</p>
            ) : (
              <ul className="space-y-2.5">
                {topAlerts.map((a) => (
                  <li key={a.id} className="rounded-control border border-line p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-semibold leading-snug text-fg">{tr(lang, a.title)}</div>
                      <SeverityBadge severity={a.severity} lang={lang} />
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{tr(lang, a.message)}</p>
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
        <div className="mb-3 space-y-1 rounded-control bg-warn-soft p-3">
          {profit.warnings.map((w, i) => (
            <p key={i} className="text-sm leading-snug text-warn">• {w[lang]}</p>
          ))}
          <div className="flex flex-wrap gap-2 pt-1">
            {profit.missingCogsSkus.length > 0 && <GhostButton onClick={() => goTo('settings')}>{vi ? 'Nhập giá vốn' : 'Enter COGS'}</GhostButton>}
            <GhostButton onClick={() => goTo('settings')}>{vi ? 'Cài đặt phí & chi phí' : 'Fees & costs'}</GhostButton>
          </div>
        </div>
      )}
      <div className="overflow-hidden rounded-control border border-line tabular">
        {profit.lines.map((l) => {
          const isTotal = l.key === 'netRevenue' || l.key === 'profit';
          const isCost = costKeys.has(l.key);
          return (
            <div key={l.key} className={`flex min-h-11 items-center justify-between gap-3 border-t border-line px-3 text-sm first:border-t-0 ${isTotal ? 'bg-surface-2 font-semibold text-fg' : 'text-fg'}`}>
              <span className="flex items-center gap-2 min-w-0">
                <span className="truncate">{isCost ? '− ' : isTotal ? '= ' : ''}{tr(lang, l.label)}</span>
                {!isTotal && l.key !== 'gmv' && <SourceBadge source={l.source} lang={lang} />}
              </span>
              <span className={`whitespace-nowrap ${l.key === 'profit' && (l.amount ?? 0) < 0 ? 'text-down' : ''}`}>{l.amount === null ? '—' : fmtMoney(l.amount, lang)}</span>
            </div>
          );
        })}
        <div className="flex min-h-11 items-center justify-between border-t border-line bg-surface-2 px-3 text-sm">
          <span className="font-semibold text-fg">{vi ? 'Biên lợi nhuận' : 'Margin'}</span>
          <span className="font-semibold text-fg">{profit.margin.value === null ? '—' : fmtRate(profit.margin.value, lang)}</span>
        </div>
      </div>
      <p className="mt-2 flex items-center gap-1 text-small text-muted">
        <Wallet className="h-3.5 w-3.5" aria-hidden />
        {vi ? 'Lợi nhuận đóng góp = trước thuế, chưa gồm chi phí không nhập vào EcomPulse.' : 'Contribution profit, before tax, excluding costs not entered in EcomPulse.'}
      </p>
    </Section>
  );
};

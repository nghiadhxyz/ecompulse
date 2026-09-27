import React, { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtDay, fmtMoney, fmtMoneyCompact, fmtMultiple, fmtRate, formatRangeVi, PRODUCT_CLASS_LABELS, product360, type ProductInsight } from '../../analytics';
import { useWorkspace } from '../seller/SellerContext';
import { EvidenceButton, KpiCard, Section, tr } from '../seller/ui';
import { Badge } from '../ui/primitives';
import { axisProps, CHART, gridProps, tooltipProps } from '../../theme/chart';
import { BreakdownTable } from './ui';

export const Product360Panel: React.FC<{ sku: string; insight?: ProductInsight }> = ({ sku, insight }) => {
  const { lang, dataset, baseFilter, previousRange, openEvidence } = useWorkspace();
  const vi = lang === 'vi';
  // Same comparison period as the rest of the workspace (MoM, YoY or custom).
  const p = useMemo(() => product360(dataset, baseFilter, sku, previousRange, insight), [dataset, baseFilter, sku, previousRange, insight]);
  const comparison = p.comparison;
  const m = comparison.current.metrics;
  const c = comparison.metrics;
  const compareLabel = vi ? `so với ${formatRangeVi(comparison.previousRange)}` : `vs ${formatRangeVi(comparison.previousRange)}`;
  const gmv = m.gmv.value ?? 0;

  return (
    <Section
      title={`${p.name}`}
      subtitle={[sku, p.category, p.subcategory].filter(Boolean).join(' · ')}
      right={<EvidenceButton lang={lang} onClick={() => openEvidence({ title: `${p.name} (${sku})`, filter: { range: baseFilter.range, platforms: baseFilter.platforms, skus: [sku] } })} />}
    >
      {insight && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge tone="primary">{tr(lang, PRODUCT_CLASS_LABELS[insight.classification])}</Badge>
          <Badge>ABC: {insight.abc}</Badge>
          {insight.isHero && <Badge tone="up">Hero</Badge>}
          {insight.isZombie && <Badge tone="down">Zombie</Badge>}
          <span className="text-small text-muted">{insight.reasons.map((r) => tr(lang, r)).join(' ')}</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 2xl:grid-cols-7">
        <KpiCard lang={lang} label="GMV" metric={m.gmv} cmp={c.gmv} compareLabel={compareLabel} />
        <KpiCard lang={lang} label={vi ? 'Lợi nhuận' : 'Profit'} metric={m.profit} cmp={c.profit} compareLabel={compareLabel} />
        <KpiCard lang={lang} label="Margin" metric={m.margin} cmp={c.margin} compareLabel={compareLabel} />
        <KpiCard lang={lang} label={vi ? 'Đơn' : 'Orders'} metric={m.orders} cmp={c.orders} compareLabel={compareLabel} />
        <KpiCard lang={lang} label="CVR" metric={m.cvr} cmp={c.cvr} compareLabel={compareLabel} />
        <KpiCard lang={lang} label={vi ? 'Tỷ lệ hủy' : 'Cancel'} metric={m.cancelRate} cmp={c.cancelRate} goodWhenUp={false} compareLabel={compareLabel} />
        <KpiCard lang={lang} label={vi ? 'Trả/hoàn' : 'Refund'} metric={m.refundRate} cmp={c.refundRate} goodWhenUp={false} compareLabel={compareLabel} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-fg">{vi ? 'GMV theo ngày' : 'Daily GMV'}</h3>
          <div className="h-44" role="img" aria-label={vi ? 'GMV theo ngày của sản phẩm' : 'Product daily GMV'}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={p.series.map((d) => ({ label: fmtDay(d.date), gmv: d.gmv }))} barCategoryGap={2}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" tick={axisProps.tick} tickLine={false} axisLine={{ stroke: CHART.grid }} minTickGap={16} />
                <YAxis tickFormatter={(v: number) => fmtMoneyCompact(v, lang)} tick={axisProps.tick} tickLine={false} axisLine={false} width={68} />
                <Tooltip {...tooltipProps} cursor={{ fill: 'var(--hover)' }} formatter={(v: number) => [fmtMoney(v, lang), 'GMV']} />
                <Bar isAnimationActive={false} dataKey="gmv" fill={CHART.primary} radius={[4, 4, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-control border border-line bg-surface-2 p-3">
              <div className="text-small text-muted">{vi ? 'Từ livestream' : 'From live'}</div>
              <div className="font-semibold tabular text-fg">
                {fmtMoneyCompact(p.liveGmv, lang)} <span className="text-small font-normal text-muted">({fmtRate(gmv > 0 ? p.liveGmv / gmv : null, lang)})</span>
              </div>
            </div>
            <div className="rounded-control border border-line bg-surface-2 p-3">
              <div className="text-small text-muted">{vi ? 'Từ affiliate' : 'From affiliate'}</div>
              <div className="font-semibold tabular text-fg">
                {fmtMoneyCompact(p.affiliateGmv, lang)} <span className="text-small font-normal text-muted">({fmtRate(gmv > 0 ? p.affiliateGmv / gmv : null, lang)})</span>
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <BreakdownTable rows={p.byPlatform} lang={lang} firstHeader={vi ? 'Sàn' : 'Platform'} columns={['gmv', 'share', 'gmvChange', 'profit']} />
          <BreakdownTable rows={p.byChannel} lang={lang} firstHeader={vi ? 'Kênh' : 'Channel'} columns={['gmv', 'share', 'gmvChange', 'cancel']} />
          {p.ads.length > 0 && (
            <div className="space-y-1 rounded-control border border-line p-3 text-small text-muted">
              {p.ads.map((a) => (
                <div key={a.key} className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium text-fg">{a.name}</span>
                  <span className="tabular">
                    {vi ? 'Chi phí' : 'Spend'} {fmtMoneyCompact(a.spend, lang)} · ROAS {fmtMultiple(a.roas, lang)} · {vi ? 'hòa vốn' : 'break-even'} {fmtMultiple(a.breakEvenRoas, lang)} ·{' '}
                    <span className={`font-medium ${(a.estimatedProfitAfterAds ?? 0) < 0 ? 'text-down' : 'text-up'}`}>
                      {vi ? 'lời sau Ads' : 'profit after ads'} {fmtMoneyCompact(a.estimatedProfitAfterAds, lang)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Section>
  );
};

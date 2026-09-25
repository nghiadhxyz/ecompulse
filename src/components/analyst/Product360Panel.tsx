import React, { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtDay, fmtMoney, fmtMoneyCompact, fmtMultiple, fmtRate, formatRangeVi, PRODUCT_CLASS_LABELS, product360, type ProductInsight } from '../../analytics';
import { useWorkspace } from '../seller/SellerContext';
import { EvidenceButton, KpiCard, Section, tr } from '../seller/ui';
import { BreakdownTable } from './ui';

const BAR = '#3987e5';

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
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-white font-bold">{tr(lang, PRODUCT_CLASS_LABELS[insight.classification])}</span>
          <span className="px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/10 text-slate-300">ABC: {insight.abc}</span>
          {insight.isHero && <span className="px-2 py-0.5 rounded-full bg-[#0ca30c]/15 border border-[#0ca30c]/40 text-[#4ade80]">Hero</span>}
          {insight.isZombie && <span className="px-2 py-0.5 rounded-full bg-[#d03b3b]/15 border border-[#d03b3b]/40 text-[#f08080]">Zombie</span>}
          <span className="text-slate-400">{insight.reasons.map((r) => tr(lang, r)).join(' ')}</span>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 2xl:grid-cols-7 gap-2">
        <KpiCard lang={lang} label="GMV" metric={m.gmv} cmp={c.gmv} compareLabel={compareLabel} />
        <KpiCard lang={lang} label={vi ? 'Lợi nhuận' : 'Profit'} metric={m.profit} cmp={c.profit} compareLabel={compareLabel} />
        <KpiCard lang={lang} label="Margin" metric={m.margin} cmp={c.margin} compareLabel={compareLabel} />
        <KpiCard lang={lang} label={vi ? 'Đơn' : 'Orders'} metric={m.orders} cmp={c.orders} compareLabel={compareLabel} />
        <KpiCard lang={lang} label="CVR" metric={m.cvr} cmp={c.cvr} compareLabel={compareLabel} />
        <KpiCard lang={lang} label={vi ? 'Tỷ lệ hủy' : 'Cancel'} metric={m.cancelRate} cmp={c.cancelRate} goodWhenUp={false} compareLabel={compareLabel} />
        <KpiCard lang={lang} label={vi ? 'Trả/hoàn' : 'Refund'} metric={m.refundRate} cmp={c.refundRate} goodWhenUp={false} compareLabel={compareLabel} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
        <div>
          <h3 className="text-xs font-bold text-slate-300 mb-1.5">{vi ? 'GMV theo ngày' : 'Daily GMV'}</h3>
          <div className="h-44" role="img" aria-label={vi ? 'GMV theo ngày của sản phẩm' : 'Product daily GMV'}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={p.series.map((d) => ({ label: fmtDay(d.date), gmv: d.gmv }))} barCategoryGap={2}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} minTickGap={16} axisLine={{ stroke: 'rgba(255,255,255,0.12)' }} />
                <YAxis tickFormatter={(v: number) => fmtMoneyCompact(v, lang)} tick={{ fill: '#94a3b8', fontSize: 10 }} width={56} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: '#0b1024', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, fontSize: 12 }} formatter={(v: number) => [fmtMoney(v, lang), 'GMV']} />
                <Bar isAnimationActive={false} dataKey="gmv" fill={BAR} radius={[4, 4, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
            <div className="rounded-lg bg-white/[0.03] border border-white/10 p-2">
              <div className="text-slate-500">{vi ? 'Từ livestream' : 'From live'}</div>
              <div className="text-white font-bold">{fmtMoneyCompact(p.liveGmv, lang)} <span className="text-slate-400 font-normal">({fmtRate(gmv > 0 ? p.liveGmv / gmv : null, lang)})</span></div>
            </div>
            <div className="rounded-lg bg-white/[0.03] border border-white/10 p-2">
              <div className="text-slate-500">{vi ? 'Từ affiliate' : 'From affiliate'}</div>
              <div className="text-white font-bold">{fmtMoneyCompact(p.affiliateGmv, lang)} <span className="text-slate-400 font-normal">({fmtRate(gmv > 0 ? p.affiliateGmv / gmv : null, lang)})</span></div>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <BreakdownTable rows={p.byPlatform} lang={lang} firstHeader={vi ? 'Sàn' : 'Platform'} columns={['gmv', 'share', 'gmvChange', 'profit']} />
          <BreakdownTable rows={p.byChannel} lang={lang} firstHeader={vi ? 'Kênh' : 'Channel'} columns={['gmv', 'share', 'gmvChange', 'cancel']} />
          {p.ads.length > 0 && (
            <div className="rounded-xl border border-white/10 p-2.5 text-xs text-slate-300 space-y-1">
              {p.ads.map((a) => (
                <div key={a.key} className="flex flex-wrap justify-between gap-2">
                  <span className="text-white">{a.name}</span>
                  <span>
                    {vi ? 'Chi phí' : 'Spend'} {fmtMoneyCompact(a.spend, lang)} · ROAS {fmtMultiple(a.roas, lang)} · {vi ? 'hòa vốn' : 'break-even'} {fmtMultiple(a.breakEvenRoas, lang)} ·{' '}
                    <span className={(a.estimatedProfitAfterAds ?? 0) < 0 ? 'text-[#f08080]' : 'text-[#4ade80]'}>{vi ? 'lời sau Ads' : 'profit after ads'} {fmtMoneyCompact(a.estimatedProfitAfterAds, lang)}</span>
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

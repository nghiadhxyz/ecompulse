import React, { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { adsIntelligence, moneyTolerance, fmtCount, fmtDay, fmtMoney, fmtMoneyCompact, fmtMultiple, fmtRate, formatRangeVi, PLATFORM_LABELS, type AdEfficiency } from '../../../analytics';
import { useWorkspace } from '../../seller/SellerContext';
import { EvidenceButton, GhostButton, NotEnoughData, Section, tr } from '../../seller/ui';
import { ChartTotalNote, MismatchBox } from '../../workspace/MismatchBox';
import { ShareBar, Th } from '../ui';

const BAR = '#3987e5';
const EFF: Record<AdEfficiency, { vi: string; en: string; cls: string }> = {
  profitable: { vi: 'Trên hòa vốn', en: 'Above break-even', cls: 'border-[#0ca30c]/40 bg-[#0ca30c]/10 text-[#4ade80]' },
  below_break_even: { vi: 'Dưới hòa vốn', en: 'Below break-even', cls: 'border-[#d03b3b]/40 bg-[#d03b3b]/10 text-[#f08080]' },
  unknown: { vi: 'Chưa đánh giá được', en: 'Unknown', cls: 'border-white/15 bg-white/[0.04] text-slate-400' },
};
const tooltipStyle = { background: '#0b1024', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, fontSize: 12 };

export const AdsIntelligenceView: React.FC = () => {
  const { lang, dataset, baseFilter, range, openEvidence, goTo } = useWorkspace();
  const vi = lang === 'vi';
  const ai = useMemo(() => adsIntelligence(dataset, baseFilter), [dataset, baseFilter]);

  if (!ai.available) {
    return (
      <Section title="Ads Intelligence">
        <NotEnoughData
          lang={lang}
          reason={vi ? 'Chưa có báo cáo quảng cáo. Nhập báo cáo Ads của Shopee / TikTok / Lazada ở Data Hub.' : 'No ads report. Import one in the Data Hub.'}
          action={<GhostButton onClick={() => goTo('dataHub')}>Data Hub</GhostButton>}
        />
      </Section>
    );
  }
  if (ai.campaigns.length === 0) {
    const periods = Array.from(new Set(dataset.ads.filter((x) => x.periodStart).map((x) => `${x.periodStart}|${x.date}`))).map((k) => {
      const [start, end] = k.split('|');
      return formatRangeVi({ start, end });
    });
    return (
      <Section title="Ads Intelligence">
        <NotEnoughData
          lang={lang}
          reason={
            periods.length > 0
              ? vi
                ? `Không có số liệu Ads trong khoảng ${formatRangeVi(range)}. Báo cáo đã nhập là số tổng cho kỳ ${periods.join(', ')} — hãy chọn trọn kỳ đó (hoặc dài hơn) để xem; EcomPulse không chia nhỏ số tổng theo ngày.`
                : `No ad data in ${formatRangeVi(range)}. The imported report is a total for ${periods.join(', ')} — select that whole period.`
              : vi
                ? `Không có số liệu Ads trong khoảng ${formatRangeVi(range)}.`
                : `No ad data in ${formatRangeVi(range)}.`
          }
        />
      </Section>
    );
  }
  const t = ai.totals;
  // Margin from the shop-wide estimates in Settings (0.9), not from COGS.
  const est = t.marginIsEstimate ? ` · ${vi ? 'ước tính theo số bạn nhập' : 'estimate from your inputs'}` : '';
  const tiles = [
    { l: vi ? 'Chi phí Ads' : 'Spend', v: fmtMoneyCompact(t.spend, lang) },
    { l: vi ? 'Doanh thu quy đổi' : 'Attributed revenue', v: fmtMoneyCompact(t.attributedRevenue, lang) },
    { l: 'ROAS', v: fmtMultiple(t.roas, lang) },
    { l: `${vi ? 'ROAS hòa vốn (shop)' : 'Break-even ROAS'}${est}`, v: fmtMultiple(t.breakEvenRoas, lang) },
    { l: `${vi ? 'Lời sau Ads (ước tính)' : 'Profit after ads'}${est}`, v: t.estimatedProfitAfterAds === null ? (vi ? 'Không đủ dữ liệu' : 'N/A') : fmtMoneyCompact(t.estimatedProfitAfterAds, lang), bad: (t.estimatedProfitAfterAds ?? 0) < 0 },
    { l: vi ? 'Ngân sách dưới hòa vốn' : 'Spend below break-even', v: ai.campaigns.some((c) => c.breakEvenRoas !== null) ? `${fmtMoneyCompact(ai.spendBelowBreakEven, lang)} (${fmtRate(t.spend ? ai.spendBelowBreakEven / t.spend : null, lang, 0)})` : '—', bad: ai.spendBelowBreakEven > 0 },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
        {tiles.map((x) => (
          <div key={x.l} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="text-[11px] text-slate-400">{x.l}</div>
            <div className={`text-lg font-black ${x.bad ? 'text-[#f08080]' : 'text-white'}`}>{x.v}</div>
          </div>
        ))}
      </div>
      <MismatchBox items={ai.mismatches} lang={lang} note={vi ? 'Bảng dùng dòng tổng cả kỳ; biểu đồ dùng số từng ngày.' : 'The table uses the period rows; the charts use the days.'} />
      {ai.notes.map((n, i) => (
        <p key={i} className="text-xs text-[#fab219]">{tr(lang, n)}</p>
      ))}

      <Section title={vi ? 'Chiến dịch' : 'Campaigns'} subtitle={`${formatRangeVi(range)} · ${vi ? 'ROAS chỉ có ý nghĩa khi so với ROAS hòa vốn của sản phẩm được quảng cáo' : 'ROAS only matters against break-even ROAS'}`}>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-xs">
            <thead className="bg-white/[0.04] text-slate-400">
              <tr>
                <Th left>{vi ? 'Chiến dịch' : 'Campaign'}</Th>
                <Th left>{vi ? 'Đánh giá' : 'Status'}</Th>
                <Th>{vi ? 'Chi phí' : 'Spend'}</Th>
                <Th>{vi ? 'Tỷ trọng NS' : 'Budget share'}</Th>
                <Th>{vi ? 'Doanh thu' : 'Revenue'}</Th>
                <Th>ROAS</Th>
                <Th>{vi ? 'Hòa vốn' : 'Break-even'}</Th>
                <Th>{vi ? 'Lời sau Ads' : 'Profit after ads'}</Th>
                <Th>{vi ? 'Hiển thị' : 'Impr.'}</Th>
                <Th>CTR</Th>
                <Th>CPC</Th>
                <Th>CVR</Th>
                <Th>CPA</Th>
                <th className="px-2.5 py-2" />
              </tr>
            </thead>
            <tbody>
              {ai.campaigns.map((c) => (
                <tr key={c.key} className="border-t border-white/5 text-slate-200">
                  <td className="px-2.5 py-2 max-w-[220px]">
                    <div className="font-semibold text-white truncate">{c.name}</div>
                    <div className="text-[11px] text-slate-500">{PLATFORM_LABELS[c.platform]}{c.sku ? ` · ${c.sku}` : ''}</div>
                  </td>
                  <td className="px-2.5 py-2"><span className={`px-2 py-0.5 rounded-full border text-[11px] font-bold whitespace-nowrap ${EFF[c.efficiency].cls}`}>{vi ? EFF[c.efficiency].vi : EFF[c.efficiency].en}</span></td>
                  <td className="px-2.5 py-2 text-right whitespace-nowrap">{fmtMoneyCompact(c.spend, lang)}</td>
                  <td className="px-2.5 py-2 text-right whitespace-nowrap">{fmtRate(c.spendShare, lang, 0)}<ShareBar share={c.spendShare} /></td>
                  <td className="px-2.5 py-2 text-right whitespace-nowrap">{fmtMoneyCompact(c.attributedRevenue, lang)}</td>
                  <td className="px-2.5 py-2 text-right whitespace-nowrap font-semibold">{fmtMultiple(c.roas, lang)}</td>
                  <td className="px-2.5 py-2 text-right whitespace-nowrap text-slate-400">{fmtMultiple(c.breakEvenRoas, lang)}</td>
                  <td className={`px-2.5 py-2 text-right whitespace-nowrap ${(c.estimatedProfitAfterAds ?? 0) < 0 ? 'text-[#f08080]' : 'text-[#4ade80]'}`} title={c.profitNote?.[lang]}>
                    {c.estimatedProfitAfterAds === null ? <span className="text-slate-500">—</span> : fmtMoneyCompact(c.estimatedProfitAfterAds, lang)}
                    {c.marginIsPartial && <span className="text-[#fab219]">*</span>}
                  </td>
                  <td className="px-2.5 py-2 text-right">{fmtCount(c.impressions, lang)}</td>
                  <td className="px-2.5 py-2 text-right">{fmtRate(c.ctr, lang, 2)}</td>
                  <td className="px-2.5 py-2 text-right whitespace-nowrap">{fmtMoneyCompact(c.cpc, lang)}</td>
                  <td className="px-2.5 py-2 text-right">{fmtRate(c.cvr, lang, 2)}</td>
                  <td className="px-2.5 py-2 text-right whitespace-nowrap">{fmtMoneyCompact(c.cpa, lang)}</td>
                  <td className="px-2.5 py-2 text-right">
                    <EvidenceButton compact lang={lang} onClick={() => openEvidence({ title: c.name, filter: { range: baseFilter.range, platforms: baseFilter.platforms, campaignId: c.key.split('|')[1] } })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-slate-500 mt-2">
          {vi
            ? `Lời sau Ads = doanh thu quy đổi × biên lợi nhuận trước Ads${t.marginIsEstimate ? ' (biên gộp − phí sàn bạn nhập ở Cài đặt, ước tính theo số bạn nhập)' : ' của SKU'} − chi phí. Doanh thu quy đổi do sàn báo cáo, có thể trùng với đơn tự nhiên. * = thiếu một số chi phí.`
            : 'Profit after ads = attributed revenue × margin before ads − spend. Attribution is the platform’s own.'}
        </p>
      </Section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Section title={vi ? 'Chi phí Ads theo ngày' : 'Daily ad spend'}>
          <div className="h-48" role="img" aria-label={vi ? 'Chi phí quảng cáo theo ngày' : 'Daily ad spend'}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ai.daily.map((d) => ({ label: fmtDay(d.date), spend: d.spend }))} barCategoryGap={2}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} minTickGap={16} axisLine={{ stroke: 'rgba(255,255,255,0.12)' }} />
                <YAxis tickFormatter={(v: number) => fmtMoneyCompact(v, lang)} tick={{ fill: '#94a3b8', fontSize: 10 }} width={56} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmtMoney(v, lang), vi ? 'Chi phí' : 'Spend']} />
                <Bar isAnimationActive={false} dataKey="spend" fill={BAR} radius={[4, 4, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ChartTotalNote chartTotal={ai.daily.reduce((s, d) => s + d.spend, 0)} kpi={t.spend} lang={lang} tolerance={moneyTolerance(t.spend ?? 0)} />
        </Section>
        <Section title={vi ? 'ROAS theo ngày' : 'Daily ROAS'} subtitle={vi ? `Đường nét đứt: ROAS hòa vốn của shop (${fmtMultiple(t.breakEvenRoas, lang)})` : 'Dashed: shop break-even ROAS'}>
          <div className="h-48" role="img" aria-label={vi ? 'ROAS theo ngày' : 'Daily ROAS'}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ai.daily.map((d) => ({ label: fmtDay(d.date), roas: d.roas, be: t.breakEvenRoas }))}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} minTickGap={16} axisLine={{ stroke: 'rgba(255,255,255,0.12)' }} />
                <YAxis tickFormatter={(v: number) => `${v}x`} tick={{ fill: '#94a3b8', fontSize: 10 }} width={36} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [fmtMultiple(v, lang), n === 'be' ? (vi ? 'Hòa vốn' : 'Break-even') : 'ROAS']} />
                <Line isAnimationActive={false} type="monotone" dataKey="roas" stroke={BAR} strokeWidth={2} dot={false} connectNulls />
                <Line isAnimationActive={false} type="monotone" dataKey="be" stroke="#8b93a3" strokeWidth={2} strokeDasharray="5 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>

      <Section title={vi ? 'Theo sàn' : 'By platform'}>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-xs">
            <thead className="bg-white/[0.04] text-slate-400">
              <tr>
                <Th left>{vi ? 'Sàn' : 'Platform'}</Th>
                <Th>{vi ? 'Chi phí' : 'Spend'}</Th>
                <Th>{vi ? 'Doanh thu' : 'Revenue'}</Th>
                <Th>ROAS</Th>
                <Th>{vi ? 'Lời sau Ads' : 'Profit after ads'}</Th>
              </tr>
            </thead>
            <tbody>
              {ai.byPlatform.map((p) => (
                <tr key={p.platform} className="border-t border-white/5 text-slate-200">
                  <td className="px-2.5 py-2 font-semibold text-white">{PLATFORM_LABELS[p.platform]}</td>
                  <td className="px-2.5 py-2 text-right">{fmtMoneyCompact(p.spend, lang)}</td>
                  <td className="px-2.5 py-2 text-right">{fmtMoneyCompact(p.revenue, lang)}</td>
                  <td className="px-2.5 py-2 text-right">{fmtMultiple(p.roas, lang)}</td>
                  <td className={`px-2.5 py-2 text-right ${(p.profitAfterAds ?? 0) < 0 ? 'text-[#f08080]' : 'text-[#4ade80]'}`}>{p.profitAfterAds === null ? '—' : fmtMoneyCompact(p.profitAfterAds, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
};

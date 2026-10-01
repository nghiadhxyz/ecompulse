import React, { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { adsIntelligence, moneyTolerance, fmtCount, fmtDay, fmtMoney, fmtMoneyCompact, fmtMultiple, fmtRate, formatRangeVi, PLATFORM_LABELS, type AdEfficiency } from '../../../analytics';
import { useWorkspace } from '../../seller/SellerContext';
import { EvidenceButton, GhostButton, NotEnoughData, Section, tr } from '../../seller/ui';
import { ChartTotalNote, MismatchBox } from '../../workspace/MismatchBox';
import { Badge, CardGrid, SectionCard, type Tone } from '../../ui/primitives';
import { TABLE } from '../../ui/data';
import { axisProps, CHART, gridProps, tooltipProps } from '../../../theme/chart';
import { ShareBar, Th } from '../ui';

/** Above break-even = good; below / likely loss = bad (orange, never red); unknown = grey. */
const EFF: Record<AdEfficiency, { vi: string; en: string; tone: Tone }> = {
  profitable: { vi: 'Trên hòa vốn', en: 'Above break-even', tone: 'up' },
  below_break_even: { vi: 'Dưới hòa vốn', en: 'Below break-even', tone: 'down' },
  likely_loss: { vi: 'Gần như chắc chắn lỗ', en: 'Almost surely losing', tone: 'down' },
  unknown: { vi: 'Chưa đánh giá được', en: 'Unknown', tone: 'neutral' },
};
const profitClass = (v: number | null) => (v === null ? '' : v < 0 ? 'text-down' : 'text-up');

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
  const est = t.marginIsEstimate ? (vi ? 'Ước tính theo số bạn nhập' : 'Estimate from your inputs') : undefined;
  const tiles: { l: string; v: string; bad?: boolean; sub?: string; missing?: boolean }[] = [
    { l: vi ? 'Chi phí Ads' : 'Spend', v: fmtMoneyCompact(t.spend, lang) },
    { l: vi ? 'Doanh thu quy đổi' : 'Attributed revenue', v: fmtMoneyCompact(t.attributedRevenue, lang) },
    { l: vi ? 'ROAS (đơn đặt)' : 'ROAS (placed)', v: fmtMultiple(t.roas, lang) },
    { l: vi ? 'ROAS (đơn đã thanh toán)' : 'ROAS (paid)', v: t.paidRoas === null ? (vi ? 'Chọn trọn kỳ báo cáo' : 'Select the whole period') : fmtMultiple(t.paidRoas, lang), missing: t.paidRoas === null },
    { l: vi ? 'ROAS hòa vốn (shop)' : 'Break-even ROAS', v: fmtMultiple(t.breakEvenRoas, lang), sub: est },
    { l: vi ? 'Lời sau Ads (ước tính)' : 'Profit after ads', v: t.estimatedProfitAfterAds === null ? (vi ? 'Không đủ dữ liệu' : 'N/A') : fmtMoneyCompact(t.estimatedProfitAfterAds, lang), bad: (t.estimatedProfitAfterAds ?? 0) < 0, sub: est, missing: t.estimatedProfitAfterAds === null },
    { l: vi ? 'Ngân sách dưới hòa vốn' : 'Spend below break-even', v: ai.campaigns.some((c) => c.breakEvenRoas !== null) ? `${fmtMoneyCompact(ai.spendBelowBreakEven, lang)} (${fmtRate(t.spend ? ai.spendBelowBreakEven / t.spend : null, lang, 0)})` : '—', bad: ai.spendBelowBreakEven > 0 },
  ];

  return (
    <div className="space-y-4">
      <p className="text-small text-muted">
        {vi
          ? 'Nguồn: tổng các dòng quảng cáo trong sheet "Nguồn truy cập cho Đơn hàng…" (không dùng dòng "Doanh thu từ quảng cáo Shopee" ở đầu sheet). ROAS đơn đặt gồm cả đơn sau đó bị hủy; ROAS đơn đã thanh toán = doanh thu Ads của đơn đã thanh toán ÷ chi phí.'
          : 'Source: sum of the ad rows in the traffic-source sheet. Placed ROAS includes orders cancelled later; paid ROAS uses paid-order ad revenue.'}
      </p>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
        {tiles.map((x) => (
          <div key={x.l} className="flex min-h-28 min-w-0 flex-col rounded-card border border-line bg-surface px-4 py-3.5 shadow-card">
            <div className="text-small text-muted">{x.l}</div>
            <div className={`mt-1 ${x.missing ? 'text-sm font-semibold text-muted' : `text-xl font-bold tabular ${x.bad ? 'text-down' : 'text-fg'}`}`}>{x.v}</div>
            {x.sub && <div className="mt-auto truncate text-small text-muted" title={x.sub}>{x.sub}</div>}
          </div>
        ))}
      </div>
      <MismatchBox items={ai.mismatches} lang={lang} note={vi ? 'Bảng dùng dòng tổng cả kỳ; biểu đồ dùng số từng ngày.' : 'The table uses the period rows; the charts use the days.'} />
      {ai.notes.map((n, i) => (
        <p key={i} className="rounded-control bg-warn-soft px-3 py-2 text-small text-warn">
          {tr(lang, n)}
        </p>
      ))}

      <SectionCard
        title={vi ? 'Chiến dịch' : 'Campaigns'}
        description={`${formatRangeVi(range)} · ${vi ? 'ROAS chỉ có ý nghĩa khi so với ROAS hòa vốn của sản phẩm được quảng cáo' : 'ROAS only matters against break-even ROAS'}`}
        notesLabel={vi ? 'Ghi chú' : 'Notes'}
        notes={[
          vi
            ? `Lời sau Ads = doanh thu quy đổi × biên lợi nhuận trước Ads${t.marginIsEstimate ? ' (biên gộp − phí sàn bạn nhập ở Cài đặt, ước tính theo số bạn nhập)' : ' của SKU'} − chi phí. Doanh thu quy đổi do sàn báo cáo, có thể trùng với đơn tự nhiên. * = thiếu một số chi phí.`
            : 'Profit after ads = attributed revenue × margin before ads − spend. Attribution is the platform’s own.',
        ]}
      >
        <div className={TABLE.frame}>
          <table className={TABLE.table}>
            <thead className={TABLE.thead}>
              <tr>
                <Th left className="sticky left-0 z-20 bg-surface-2">{vi ? 'Chiến dịch' : 'Campaign'}</Th>
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
                <th className={TABLE.th} />
              </tr>
            </thead>
            <tbody>
              {ai.campaigns.map((c) => (
                <tr key={c.key} className={`${TABLE.tr} text-fg`}>
                  <td className="sticky left-0 z-10 max-w-[220px] bg-surface px-3 py-1.5" title={c.name}>
                    <div className="truncate font-medium text-fg">{c.name}</div>
                    <div className="text-small text-muted">
                      {PLATFORM_LABELS[c.platform]}
                      {c.sku ? ` · ${c.sku}` : ''}
                    </div>
                  </td>
                  <td className={TABLE.td}>
                    <Badge tone={EFF[c.efficiency].tone}>{vi ? EFF[c.efficiency].vi : EFF[c.efficiency].en}</Badge>
                  </td>
                  <td className={`${TABLE.td} text-right`}>{fmtMoneyCompact(c.spend, lang)}</td>
                  <td className={`${TABLE.td} text-right`}>
                    {fmtRate(c.spendShare, lang, 0)}
                    <ShareBar share={c.spendShare} />
                  </td>
                  <td className={`${TABLE.td} text-right`}>{fmtMoneyCompact(c.attributedRevenue, lang)}</td>
                  <td className={`${TABLE.td} text-right font-semibold`}>{fmtMultiple(c.roas, lang)}</td>
                  <td className={`${TABLE.td} text-right text-muted`}>{fmtMultiple(c.breakEvenRoas, lang)}</td>
                  <td className={`${TABLE.td} text-right font-medium ${profitClass(c.estimatedProfitAfterAds)}`} title={c.profitNote?.[lang]}>
                    {c.estimatedProfitAfterAds === null ? <span className="text-muted">—</span> : fmtMoneyCompact(c.estimatedProfitAfterAds, lang)}
                    {c.marginIsPartial && <span className="text-warn">*</span>}
                  </td>
                  <td className={`${TABLE.td} text-right`}>{fmtCount(c.impressions, lang)}</td>
                  <td className={`${TABLE.td} text-right`}>{fmtRate(c.ctr, lang, 2)}</td>
                  <td className={`${TABLE.td} text-right`}>{fmtMoneyCompact(c.cpc, lang)}</td>
                  <td className={`${TABLE.td} text-right`}>{fmtRate(c.cvr, lang, 2)}</td>
                  <td className={`${TABLE.td} text-right`}>{fmtMoneyCompact(c.cpa, lang)}</td>
                  <td className={`${TABLE.td} text-right`}>
                    <EvidenceButton compact lang={lang} onClick={() => openEvidence({ title: c.name, filter: { range: baseFilter.range, platforms: baseFilter.platforms, campaignId: c.key.split('|')[1] } })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <CardGrid>
        <SectionCard span={6} title={vi ? 'Chi phí Ads theo ngày' : 'Daily ad spend'}>
          <div className="h-48" role="img" aria-label={vi ? 'Chi phí quảng cáo theo ngày' : 'Daily ad spend'}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ai.daily.map((d) => ({ label: fmtDay(d.date), spend: d.spend }))} barCategoryGap={2}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" tick={axisProps.tick} tickLine={false} minTickGap={16} axisLine={{ stroke: CHART.grid }} />
                <YAxis tickFormatter={(v: number) => fmtMoneyCompact(v, lang)} tick={axisProps.tick} width={64} tickLine={false} axisLine={false} />
                <Tooltip {...tooltipProps} cursor={{ fill: 'var(--hover)' }} formatter={(v: number) => [fmtMoney(v, lang), vi ? 'Chi phí' : 'Spend']} />
                <Bar isAnimationActive={false} dataKey="spend" fill={CHART.primary} radius={[4, 4, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ChartTotalNote chartTotal={ai.daily.reduce((s, d) => s + d.spend, 0)} kpi={t.spend} lang={lang} tolerance={moneyTolerance(t.spend ?? 0)} />
        </SectionCard>
        <SectionCard span={6} title={vi ? 'ROAS theo ngày' : 'Daily ROAS'} description={vi ? `Đường nét đứt: ROAS hòa vốn của shop (${fmtMultiple(t.breakEvenRoas, lang)})` : 'Dashed: shop break-even ROAS'}>
          <div className="h-48" role="img" aria-label={vi ? 'ROAS theo ngày' : 'Daily ROAS'}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ai.daily.map((d) => ({ label: fmtDay(d.date), roas: d.roas, be: t.breakEvenRoas, outlier: d.roasOutlier }))}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" tick={axisProps.tick} tickLine={false} minTickGap={16} axisLine={{ stroke: CHART.grid }} />
                <YAxis tickFormatter={(v: number) => `${v}x`} tick={axisProps.tick} width={40} tickLine={false} axisLine={false} />
                <Tooltip {...tooltipProps} formatter={(v: number, n: string) => [fmtMultiple(v, lang), n === 'be' ? (vi ? 'Hòa vốn' : 'Break-even') : 'ROAS']} />
                <Line
                  isAnimationActive={false}
                  type="monotone"
                  dataKey="roas"
                  stroke={CHART.primary}
                  strokeWidth={2}
                  connectNulls
                  dot={(p: { cx?: number; cy?: number; index?: number; payload?: { outlier?: boolean } }) =>
                    p.payload?.outlier ? <circle key={p.index} cx={p.cx} cy={p.cy} r={4} fill={CHART.anomaly} stroke="var(--surface)" strokeWidth={1.5} /> : <g key={p.index} />
                  }
                />
                <Line isAnimationActive={false} type="monotone" dataKey="be" stroke={CHART.muted} strokeWidth={1.5} strokeDasharray={CHART.compareDash} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {ai.daily.some((d) => d.roasOutlier) && (
            <p className="mt-2 text-small text-muted">
              <span className="font-medium text-down">{vi ? 'ROAS bất thường (chấm cam): ' : 'Unusual ROAS (orange dots): '}</span>
              {ai.daily
                .filter((d) => d.roasOutlier)
                .map((d) => `${fmtDay(d.date)} ${fmtMultiple(d.roas, lang)}`)
                .join(' · ')}
              {vi ? ' — kiểm tra đơn lớn hoặc số liệu ngày này trước khi dùng để kết luận.' : ' — check large orders or the data before drawing conclusions.'}
            </p>
          )}
        </SectionCard>
      </CardGrid>

      <SectionCard title={vi ? 'Theo sàn' : 'By platform'}>
        <div className={TABLE.frame}>
          <table className={TABLE.table}>
            <thead className={TABLE.thead}>
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
                <tr key={p.platform} className={`${TABLE.tr} text-fg`}>
                  <td className={`${TABLE.td} font-medium`}>{PLATFORM_LABELS[p.platform]}</td>
                  <td className={`${TABLE.td} text-right`}>{fmtMoneyCompact(p.spend, lang)}</td>
                  <td className={`${TABLE.td} text-right`}>{fmtMoneyCompact(p.revenue, lang)}</td>
                  <td className={`${TABLE.td} text-right`}>{fmtMultiple(p.roas, lang)}</td>
                  <td className={`${TABLE.td} text-right font-medium ${profitClass(p.profitAfterAds)}`}>{p.profitAfterAds === null ? '—' : fmtMoneyCompact(p.profitAfterAds, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
};

import React, { useMemo } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  breakdown,
  compareRanges,
  dailySeries,
  fmtMoney,
  fmtMoneyCompact,
  formatRangeVi,
  moneyTolerance,
  type KpiKey,
} from '../../../analytics';
import { useWorkspace } from '../../seller/SellerContext';
import { NotEnoughData, tr } from '../../seller/ui';
import { CardGrid, SectionCard } from '../../ui/primitives';
import { AlertStack, DeltaBadge, KpiGrid, type KpiItem, type StackItem } from '../../ui/data';
import { axisProps, CHART, gridProps, legendProps, tooltipProps, xAxisProps } from '../../../theme/chart';
import { SourceDriversPanel, SubsidyPanel } from '../../workspace/SummaryInsightPanels';
import { ChartTotalNote } from '../../workspace/MismatchBox';
import { BreakdownTable, ChangeCell } from '../ui';

const KPIS: { key: KpiKey; vi: string; en: string; goodWhenUp?: boolean; defVi?: string }[] = [
  { key: 'gmv', vi: 'GMV', en: 'GMV', defVi: 'Tổng giá trị đơn đặt trong kỳ, gồm cả đơn sau đó bị hủy (như báo cáo Shopee).' },
  { key: 'netRevenue', vi: 'Doanh thu thuần', en: 'Net revenue', defVi: 'GMV − doanh số hủy − tiền hoàn, cùng mức đơn.' },
  { key: 'profit', vi: 'Lợi nhuận đóng góp', en: 'Contribution profit', defVi: 'Doanh thu thuần − giá vốn − phí sàn − Ads − chi phí khác đã biết.' },
  { key: 'margin', vi: 'Margin', en: 'Margin', defVi: 'Lợi nhuận đóng góp ÷ doanh thu thuần.' },
  { key: 'orders', vi: 'Đơn đặt', en: 'Orders', defVi: 'Số đơn đặt trong kỳ, mọi trạng thái.' },
  { key: 'units', vi: 'Sản phẩm bán', en: 'Units' },
  { key: 'aov', vi: 'AOV', en: 'AOV', defVi: 'GMV ÷ số đơn (cùng mức đơn).' },
  { key: 'cvr', vi: 'CVR', en: 'CVR', defVi: 'Số đơn ÷ lượt nhấp sản phẩm.' },
  { key: 'cancelRate', vi: 'Tỷ lệ hủy', en: 'Cancel rate', goodWhenUp: false, defVi: 'Đơn hủy ÷ số đơn.' },
  { key: 'refundRate', vi: 'Tỷ lệ trả/hoàn', en: 'Refund rate', goodWhenUp: false, defVi: 'Đơn trả hàng/hoàn tiền ÷ số đơn.' },
  { key: 'visits', vi: 'Lượt truy cập', en: 'Visits', defVi: 'Số khách truy cập khác nhau trong kỳ.' },
  { key: 'buyers', vi: 'Người mua', en: 'Buyers', defVi: 'Số người mua khác nhau, gồm cả người có đơn hủy.' },
];

export const ExecutiveOverview: React.FC = () => {
  const { lang, dataset, baseFilter, range, previousRange, goTo } = useWorkspace();
  const vi = lang === 'vi';
  const cmp = useMemo(() => compareRanges(dataset, baseFilter, previousRange), [dataset, baseFilter, previousRange]);
  const cur = useMemo(() => dailySeries(dataset, baseFilter), [dataset, baseFilter]);
  const prev = useMemo(() => dailySeries(dataset, { ...baseFilter, range: previousRange }), [dataset, baseFilter, previousRange]);
  const byPlatform = useMemo(() => breakdown(dataset, baseFilter, 'platform', previousRange, lang), [dataset, baseFilter, previousRange, lang]);
  const gmvBasis = cmp.current.metrics.gmv.basis;
  const byCategory = useMemo(() => breakdown(dataset, baseFilter, 'category', previousRange, lang), [dataset, baseFilter, previousRange, lang]);

  // No data in the comparison period: no Δ anywhere, and say so instead of "chưa đủ mẫu".
  const noComparison = cmp.previous.coverage === 'none';
  const compareLabel = noComparison ? (vi ? 'Không có kỳ so sánh' : 'No comparison period') : vi ? `so với ${formatRangeVi(previousRange)}` : `vs ${formatRangeVi(previousRange)}`;

  const chart = Array.from({ length: Math.max(cur.length, prev.length) }, (_, i) => ({
    idx: i + 1,
    label: cur[i] ? `${cur[i].date.slice(8)}/${cur[i].date.slice(5, 7)}` : `+${i + 1}`,
    current: cur[i]?.gmv ?? null,
    previous: prev[i]?.gmv ?? null,
  }));

  const negatives = [...byPlatform.rows, ...byCategory.rows].filter((r) => (r.change.gmv.absoluteDelta ?? 0) < 0).sort((a, b) => (a.change.gmv.absoluteDelta ?? 0) - (b.change.gmv.absoluteDelta ?? 0));

  const alerts: StackItem[] = [];
  if (noComparison) alerts.push({ id: 'no-cmp', tone: 'info', title: vi ? 'Không có kỳ so sánh' : 'No comparison period', detail: vi ? `${formatRangeVi(previousRange)} nằm ngoài dữ liệu.` : `${formatRangeVi(previousRange)} is outside the data.` });
  if (cmp.previous.coverage === 'partial') alerts.push({ id: 'partial-cmp', tone: 'warn', title: vi ? 'Kỳ so sánh chỉ có một phần dữ liệu' : 'Comparison period partly covered', detail: vi ? `${formatRangeVi(previousRange)} — so sánh có thể không đại diện.` : formatRangeVi(previousRange) });

  const kpiItems: KpiItem[] = KPIS.map((k) => ({
    key: k.key,
    label: vi ? k.vi : k.en,
    metric: cmp.current.metrics[k.key],
    cmp: noComparison ? undefined : cmp.metrics[k.key],
    goodWhenUp: k.goodWhenUp,
    definition: vi ? k.defVi : undefined,
    missingAction: k.key === 'profit' || k.key === 'margin' ? { label: vi ? 'Nhập giá vốn' : 'Enter COGS', onClick: () => goTo('settings') } : undefined,
  }));
  const changedKpis = KPIS.filter((k) => !noComparison && cmp.metrics[k.key].direction !== 'unknown' && cmp.current.metrics[k.key].value !== null);

  return (
    <div className="space-y-4">
      <AlertStack items={alerts} lang={lang} label={(n) => (vi ? `${n} lưu ý về kỳ so sánh` : `${n} notes on the comparison`)} />
      <KpiGrid items={kpiItems} lang={lang} compareLabel={compareLabel} />

      <CardGrid>
        <SectionCard
          span={12}
          title={vi ? '1 · Điều gì đã thay đổi?' : '1 · What changed?'}
          description={noComparison ? `${formatRangeVi(range)} · ${compareLabel}` : `${formatRangeVi(range)} ${compareLabel}`}
          notes={[chart.length > 1 && gmvBasis ? (vi ? `Biểu đồ: GMV theo ngày, ${gmvBasis.vi.toLowerCase()}.` : `Chart: daily GMV, ${gmvBasis.en.toLowerCase()}.`) : null]}
        >
          {changedKpis.length === 0 ? (
            <p className="text-sm text-muted">{vi ? 'Không có kỳ so sánh.' : 'No comparison period.'}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {changedKpis.map((k) => (
                <span key={k.key} className="inline-flex items-center gap-1.5 rounded-control border border-line bg-surface px-2.5 py-1 text-sm text-fg">
                  {vi ? k.vi : k.en}
                  <DeltaBadge cmp={cmp.metrics[k.key]} lang={lang} goodWhenUp={k.goodWhenUp} />
                </span>
              ))}
            </div>
          )}
          {chart.length > 1 && (
            <ChartTotalNote chartTotal={cur.reduce((s, p) => s + (p.gmv ?? 0), 0)} kpi={cmp.current.metrics.gmv.value} lang={lang} tolerance={moneyTolerance(cmp.current.metrics.gmv.value ?? 0)} />
          )}
          {chart.length > 1 && (
            <div className="mt-4 h-64" role="img" aria-label={vi ? 'GMV theo ngày: kỳ này và kỳ so sánh' : 'Daily GMV: current vs comparison'}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="label" {...xAxisProps} />
                  <YAxis tickFormatter={(v: number) => fmtMoneyCompact(v, lang)} {...axisProps} width={64} />
                  <Tooltip {...tooltipProps} formatter={(v: number, name: string) => [fmtMoney(v, lang), name]} />
                  <Legend {...legendProps} />
                  <Line isAnimationActive={false} type="monotone" dataKey="current" name={vi ? `Kỳ này (${formatRangeVi(range)})` : `Current (${formatRangeVi(range)})`} stroke={CHART.primary} strokeWidth={2} dot={false} connectNulls />
                  <Line
                    isAnimationActive={false}
                    type="monotone"
                    dataKey="previous"
                    name={vi ? `Kỳ so sánh (${formatRangeVi(previousRange)})` : `Comparison (${formatRangeVi(previousRange)})`}
                    stroke={CHART.primary}
                    strokeOpacity={CHART.compareOpacity}
                    strokeWidth={2}
                    strokeDasharray={CHART.compareDash}
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        <SectionCard span={6} title={vi ? '2 · Thay đổi nằm ở sàn nào?' : '2 · Where — by platform'} description={vi ? 'Đóng góp Δ = phần của thay đổi GMV toàn shop do sàn đó tạo ra' : 'Contribution = share of the total GMV change'}>
          {byPlatform.unavailable ? (
            <NotEnoughData lang={lang} reason={tr(lang, byPlatform.unavailable)} />
          ) : (
            <BreakdownTable rows={byPlatform.rows} lang={lang} firstHeader={vi ? 'Sàn' : 'Platform'} columns={['gmv', 'gmvChange', 'contribution', 'profit', 'margin', 'cancel']} />
          )}
        </SectionCard>
        <SectionCard span={6} title={vi ? '3 · Ngành hàng nào đóng góp?' : '3 · What contributed — by category'} description={vi ? 'Bấm để đi sâu Ngành → Nhóm → SKU' : 'Click to drill into niche → SKU'}>
          {byCategory.unavailable ? (
            <NotEnoughData lang={lang} reason={tr(lang, byCategory.unavailable)} />
          ) : (
            <BreakdownTable
              rows={byCategory.rows}
              lang={lang}
              firstHeader={vi ? 'Ngành hàng' : 'Category'}
              columns={['gmv', 'gmvChange', 'contribution', 'profit', 'margin', 'cancel']}
              onRowClick={(r) => goTo('category', { categories: [r.key] })}
            />
          )}
        </SectionCard>

        {negatives.length > 0 && (
          <SectionCard
            span={12}
            title={vi ? '4 · Nên điều tra gì?' : '4 · What to investigate'}
            notes={[vi ? 'Đây là phân rã đóng góp, không phải nguyên nhân. Đi sâu theo ngành/SKU để tìm yếu tố đi cùng.' : 'This is a contribution breakdown, not a cause.']}
          >
            <ul className="space-y-2 text-sm text-fg">
              {negatives.slice(0, 4).map((r) => (
                <li key={r.key} className="flex flex-wrap items-center gap-1.5">
                  <b className="font-semibold">{r.label}</b>
                  <ChangeCell c={r.change.gmv} lang={lang} />
                  <span className="text-muted">
                    {fmtMoneyCompact(r.change.gmv.absoluteDelta, lang)}
                    {r.gmvContribution !== null && (vi ? ` · chiếm ${Math.round(Math.abs(r.gmvContribution) * 100)}% độ lớn thay đổi toàn shop` : ` · ${Math.round(Math.abs(r.gmvContribution) * 100)}% of the total change`)}
                  </span>
                </li>
              ))}
            </ul>
          </SectionCard>
        )}
        <div className="col-span-12">
          <SourceDriversPanel before={previousRange} after={range} title={vi ? 'Doanh số thay đổi do kênh / nguồn nào (so với kỳ so sánh)' : 'Which channel / source moved sales (vs comparison period)'} />
        </div>
        <div className="col-span-12">
          <SubsidyPanel />
        </div>
      </CardGrid>
    </div>
  );
};

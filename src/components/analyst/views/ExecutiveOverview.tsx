import React, { useMemo } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  breakdown,
  compareRanges,
  dailySeries,
  fmtChange,
  fmtMoney,
  fmtMoneyCompact,
  fmtPp,
  formatRangeVi,
  type KpiKey,
  type MetricComparison,
} from '../../../analytics';
import { useWorkspace } from '../../seller/SellerContext';
import { KpiCard, NotEnoughData, Section, tr } from '../../seller/ui';
import { BreakdownTable } from '../ui';

const CURRENT_COLOR = '#3987e5';
const PREVIOUS_COLOR = '#8b93a3';

const KPIS: { key: KpiKey; vi: string; en: string; goodWhenUp?: boolean }[] = [
  { key: 'gmv', vi: 'GMV', en: 'GMV' },
  { key: 'netRevenue', vi: 'Doanh thu thuần', en: 'Net revenue' },
  { key: 'profit', vi: 'Lợi nhuận đóng góp', en: 'Contribution profit' },
  { key: 'margin', vi: 'Margin', en: 'Margin' },
  { key: 'orders', vi: 'Đơn đặt', en: 'Orders' },
  { key: 'units', vi: 'Sản phẩm bán', en: 'Units' },
  { key: 'aov', vi: 'AOV', en: 'AOV' },
  { key: 'cvr', vi: 'CVR', en: 'CVR' },
  { key: 'cancelRate', vi: 'Tỷ lệ hủy', en: 'Cancel rate', goodWhenUp: false },
  { key: 'refundRate', vi: 'Tỷ lệ trả/hoàn', en: 'Refund rate', goodWhenUp: false },
];

function changeSentence(label: string, c: MetricComparison, lang: 'vi' | 'en'): string | null {
  if (c.direction === 'unknown') return null;
  if (c.unit === 'ratio') {
    if (c.percentagePointDelta === null || c.percentagePointDelta === undefined) return null;
    return `${label} ${fmtPp(c.percentagePointDelta, lang)}`;
  }
  if (c.percentageDelta === null) return null;
  return `${label} ${fmtChange(c.percentageDelta, lang)}`;
}

export const ExecutiveOverview: React.FC = () => {
  const { lang, dataset, baseFilter, range, previousRange, goTo } = useWorkspace();
  const vi = lang === 'vi';
  const cmp = useMemo(() => compareRanges(dataset, baseFilter, previousRange), [dataset, baseFilter, previousRange]);
  const cur = useMemo(() => dailySeries(dataset, baseFilter), [dataset, baseFilter]);
  const prev = useMemo(() => dailySeries(dataset, { ...baseFilter, range: previousRange }), [dataset, baseFilter, previousRange]);
  const byPlatform = useMemo(() => breakdown(dataset, baseFilter, 'platform', previousRange, lang), [dataset, baseFilter, previousRange, lang]);
  const byCategory = useMemo(() => breakdown(dataset, baseFilter, 'category', previousRange, lang), [dataset, baseFilter, previousRange, lang]);

  const compareLabel = vi ? `so với ${formatRangeVi(previousRange)}` : `vs ${formatRangeVi(previousRange)}`;
  const changed = KPIS.map((k) => changeSentence(vi ? k.vi : k.en, cmp.metrics[k.key], lang)).filter(Boolean) as string[];

  const chart = Array.from({ length: Math.max(cur.length, prev.length) }, (_, i) => ({
    idx: i + 1,
    label: cur[i] ? `${cur[i].date.slice(8)}/${cur[i].date.slice(5, 7)}` : `+${i + 1}`,
    current: cur[i]?.gmv ?? null,
    previous: prev[i]?.gmv ?? null,
  }));

  const negatives = [...byPlatform.rows, ...byCategory.rows].filter((r) => (r.change.gmv.absoluteDelta ?? 0) < 0).sort((a, b) => (a.change.gmv.absoluteDelta ?? 0) - (b.change.gmv.absoluteDelta ?? 0));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5">
        {KPIS.map((k) => (
          <KpiCard key={k.key} lang={lang} label={vi ? k.vi : k.en} metric={cmp.current.metrics[k.key]} cmp={cmp.metrics[k.key]} compareLabel={compareLabel} goodWhenUp={k.goodWhenUp} />
        ))}
      </div>
      {cmp.previous.coverage !== 'full' && (
        <p className="text-xs text-[#fab219]">
          {vi
            ? `Kỳ so sánh ${formatRangeVi(previousRange)} ${cmp.previous.coverage === 'none' ? 'nằm ngoài dữ liệu' : 'chỉ có một phần dữ liệu'} — so sánh có thể không đại diện.`
            : `Comparison period ${formatRangeVi(previousRange)} is ${cmp.previous.coverage === 'none' ? 'outside the data' : 'only partly covered'}.`}
        </p>
      )}

      <Section title={vi ? '1 · Điều gì đã thay đổi?' : '1 · What changed?'} subtitle={`${formatRangeVi(range)} ${compareLabel}`}>
        {changed.length === 0 ? (
          <p className="text-sm text-slate-400">{vi ? 'Chưa có kỳ so sánh để xác định thay đổi.' : 'No comparison period available.'}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {changed.map((s) => (
              <span key={s} className="text-xs px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/10 text-slate-100">{s}</span>
            ))}
          </div>
        )}
        {chart.length > 1 && (
          <div className="h-60 mt-4" role="img" aria-label={vi ? 'GMV theo ngày: kỳ này và kỳ so sánh' : 'Daily GMV: current vs comparison'}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.12)' }} minTickGap={16} />
                <YAxis tickFormatter={(v: number) => fmtMoneyCompact(v, lang)} tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} width={64} />
                <Tooltip
                  contentStyle={{ background: '#0b1024', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, fontSize: 12 }}
                  labelStyle={{ color: '#e2e8f0', fontWeight: 700 }}
                  itemStyle={{ color: '#cbd5e1' }}
                  formatter={(v: number, name: string) => [fmtMoney(v, lang), name]}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: '#cbd5e1' }} />
                <Line isAnimationActive={false} type="monotone" dataKey="current" name={vi ? `Kỳ này (${formatRangeVi(range)})` : `Current (${formatRangeVi(range)})`} stroke={CURRENT_COLOR} strokeWidth={2} dot={false} connectNulls />
                <Line isAnimationActive={false} type="monotone" dataKey="previous" name={vi ? `Kỳ so sánh (${formatRangeVi(previousRange)})` : `Comparison (${formatRangeVi(previousRange)})`} stroke={PREVIOUS_COLOR} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>

      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
        <Section title={vi ? '2 · Thay đổi nằm ở sàn nào?' : '2 · Where — by platform'} subtitle={vi ? 'Đóng góp Δ = phần của thay đổi GMV toàn shop do sàn đó tạo ra' : 'Contribution = share of the total GMV change'}>
          {byPlatform.unavailable ? (
            <NotEnoughData lang={lang} reason={tr(lang, byPlatform.unavailable)} />
          ) : (
            <BreakdownTable rows={byPlatform.rows} lang={lang} firstHeader={vi ? 'Sàn' : 'Platform'} columns={['gmv', 'gmvChange', 'contribution', 'profit', 'margin', 'cancel']} />
          )}
        </Section>
        <Section title={vi ? '3 · Ngành hàng nào đóng góp?' : '3 · What contributed — by category'} subtitle={vi ? 'Bấm để đi sâu Ngành → Nhóm → SKU' : 'Click to drill into niche → SKU'}>
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
        </Section>
      </div>

      {negatives.length > 0 && (
        <Section title={vi ? '4 · Nên điều tra gì?' : '4 · What to investigate'}>
          <ul className="space-y-1.5 text-sm text-slate-200">
            {negatives.slice(0, 4).map((r) => (
              <li key={r.key}>
                • <b>{r.label}</b>: GMV {fmtChange(r.change.gmv.percentageDelta, lang)} ({fmtMoneyCompact(r.change.gmv.absoluteDelta, lang)})
                {r.gmvContribution !== null && (vi ? `, chiếm ${Math.round(Math.abs(r.gmvContribution) * 100)}% độ lớn thay đổi toàn shop` : `, ${Math.round(Math.abs(r.gmvContribution) * 100)}% of the total change`)}.
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-slate-500 mt-2">{vi ? 'Đây là phân rã đóng góp, không phải nguyên nhân. Đi sâu theo ngành/SKU để tìm yếu tố đi cùng.' : 'This is a contribution breakdown, not a cause.'}</p>
        </Section>
      )}
    </div>
  );
};

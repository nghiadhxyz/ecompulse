import React, { useMemo } from 'react';
import { CheckCircle2, HelpCircle, MinusCircle } from 'lucide-react';
import { advancedStats, fmtByUnit, formatRangeVi, type TestResult } from '../../../analytics';
import { useWorkspace } from '../../seller/SellerContext';
import { Section, tr } from '../../seller/ui';
import { PlacedOnlyNote } from '../../workspace/OrderStagePicker';
import { SampleTag } from '../../workspace/SampleSize';
import { Th } from '../ui';

const VERDICT = {
  significant: { icon: CheckCircle2, vi: 'Khác biệt rõ (p < 0,05)', en: 'Significant (p < 0.05)', cls: 'text-sky-300' },
  not_significant: { icon: MinusCircle, vi: 'Có thể chỉ là dao động', en: 'Could be noise', cls: 'text-slate-400' },
  insufficient: { icon: HelpCircle, vi: 'Chưa đủ mẫu', en: 'Too few samples', cls: 'text-[#fab219]' },
  no_comparison: { icon: HelpCircle, vi: 'Không có kỳ so sánh', en: 'No comparison period', cls: 'text-slate-400' },
};

export const AdvancedStatsView: React.FC = () => {
  const { lang, dataset, baseFilter, range, previousRange } = useWorkspace();
  const vi = lang === 'vi';
  const st = useMemo(() => advancedStats(dataset, baseFilter, previousRange), [dataset, baseFilter, previousRange]);

  const diffText = (t: TestResult, v: number | null) => (v === null ? '—' : t.unit === 'ratio' ? `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(2).replace('.', vi ? ',' : '.')}pp` : `${v >= 0 ? '+' : '−'}${fmtByUnit(Math.abs(v), t.unit, lang)}`);
  const label = (key: string) => st.correlations.series.find((s) => s.key === key)!;

  // No data at all in the comparison period: no Δ columns, no "so với" line.
  const hasComparison = st.tests.some((t) => t.verdict !== 'no_comparison');
  return (
    <div className="space-y-4">
      <PlacedOnlyNote lang={lang} show={dataset.orders.length === 0 && dataset.dailyMetrics.length > 0} />
      <Section
        title={vi ? 'Kiểm định khác biệt giữa hai kỳ' : 'Period difference tests'}
        subtitle={hasComparison ? `${formatRangeVi(range)} ${vi ? 'so với' : 'vs'} ${formatRangeVi(previousRange)}` : `${formatRangeVi(range)} · ${vi ? 'Không có kỳ so sánh' : 'No comparison period'}`}
      >
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-xs">
            <thead className="bg-white/[0.04] text-slate-400">
              <tr>
                <Th left>{vi ? 'Chỉ số' : 'Metric'}</Th>
                {hasComparison && <Th>{vi ? 'Kỳ so sánh' : 'Comparison'}</Th>}
                <Th>{vi ? 'Kỳ này' : 'Current'}</Th>
                {hasComparison && <Th>{vi ? 'Chênh lệch' : 'Difference'}</Th>}
                {hasComparison && <Th title={vi ? 'Khoảng tin cậy 95% của chênh lệch' : '95% confidence interval'}>{vi ? 'Khoảng tin cậy 95%' : '95% CI'}</Th>}
                {hasComparison && <Th>p</Th>}
                <Th title={vi ? 'Cỡ mẫu (đơn / lượt nhấp / ngày)' : 'Sample size'}>n</Th>
                <Th left>{vi ? 'Kết luận' : 'Verdict'}</Th>
              </tr>
            </thead>
            <tbody>
              {st.tests.map((t) => {
                const V = VERDICT[t.verdict];
                return (
                  <tr key={t.key} className="border-t border-white/5 text-slate-200">
                    <td className="px-2.5 py-1.5 whitespace-nowrap">{tr(lang, t.label)}</td>
                    {hasComparison && <td className="px-2.5 py-1.5 text-right whitespace-nowrap text-slate-400">{fmtByUnit(t.previous, t.unit, lang)}</td>}
                    <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{fmtByUnit(t.current, t.unit, lang)}</td>
                    {hasComparison && <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{diffText(t, t.difference)}</td>}
                    {hasComparison && <td className="px-2.5 py-1.5 text-right whitespace-nowrap text-slate-400">{t.ciLow === null ? '—' : `${diffText(t, t.ciLow)} … ${diffText(t, t.ciHigh)}`}</td>}
                    {hasComparison && <td className="px-2.5 py-1.5 text-right">{t.pValue === null ? '—' : t.pValue < 0.001 ? '< 0,001' : t.pValue.toFixed(3).replace('.', vi ? ',' : '.')}</td>}
                    <td className="px-2.5 py-1.5 text-right whitespace-nowrap text-slate-400">{t.nCurrent.toLocaleString('vi-VN')} / {t.nPrevious.toLocaleString('vi-VN')}</td>
                    <td className={`px-2.5 py-1.5 whitespace-nowrap ${V.cls}`}>
                      <span className="inline-flex items-center gap-1"><V.icon className="w-3.5 h-3.5" aria-hidden /> {vi ? V.vi : V.en}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Section title={vi ? 'Tương quan theo ngày' : 'Daily correlation'} subtitle={vi ? 'Hệ số Pearson r (−1 … 1) giữa các chỉ số trong kỳ này' : 'Pearson r between daily series'}>
          {st.correlations.cells.length === 0 ? (
            <p className="text-sm text-slate-400">{vi ? 'Cần ít nhất 10 ngày dữ liệu.' : 'At least 10 days needed.'}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-xs">
                <thead className="bg-white/[0.04] text-slate-400">
                  <tr><Th left>{vi ? 'Cặp chỉ số' : 'Pair'}</Th><Th>r</Th><Th>n</Th><Th left>{vi ? 'Mức độ đi cùng' : 'Strength'}</Th></tr>
                </thead>
                <tbody>
                  {[...st.correlations.cells].sort((a, b) => Math.abs(b.r ?? 0) - Math.abs(a.r ?? 0)).map((c) => {
                    const a = Math.abs(c.r ?? 0);
                    return (
                      <tr key={`${c.a}-${c.b}`} className="border-t border-white/5 text-slate-200">
                        <td className="px-2.5 py-1.5 whitespace-nowrap">{tr(lang, label(c.a).label)} × {tr(lang, label(c.b).label)}</td>
                        <td className="px-2.5 py-1.5 text-right">{c.r === null ? '—' : c.r.toFixed(2).replace('.', vi ? ',' : '.')}</td>
                        <td className="px-2.5 py-1.5 text-right">{c.n}</td>
                        <td className="px-2.5 py-1.5 text-slate-400 whitespace-nowrap">
                          {c.r === null ? '—' : a >= 0.7 ? (vi ? 'Đi cùng mạnh' : 'Strong') : a >= 0.4 ? (vi ? 'Đi cùng vừa' : 'Moderate') : a >= 0.2 ? (vi ? 'Yếu' : 'Weak') : vi ? 'Gần như không' : 'None'}
                          {c.r !== null && a >= 0.2 ? (c.r > 0 ? (vi ? ' (cùng chiều)' : ' (same direction)') : vi ? ' (ngược chiều)' : ' (opposite)') : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title={vi ? 'Chỉ số theo thứ trong tuần' : 'Weekday index'} subtitle={vi ? 'GMV trung bình từng thứ so với trung bình ngày thường (không tính ngày sale)' : 'Average GMV per weekday vs overall (sale days excluded)'}>
          <div className="space-y-1.5">
            {st.weekday.map((w) => (
              <div key={w.weekday} className="flex items-center gap-2 text-xs">
                <span className="w-28 text-slate-300">{tr(lang, w.label)}<SampleTag n={w.days} lang={lang} /></span>
                <div className="flex-1 h-2 rounded bg-white/[0.06] overflow-hidden" aria-hidden>
                  <div className="h-full bg-[#3987e5]" style={{ width: `${Math.min(100, ((w.index ?? 0) / 1.5) * 100)}%` }} />
                </div>
                <span className="w-24 text-right text-slate-200">{w.index === null ? '—' : `×${w.index.toFixed(2).replace('.', vi ? ',' : '.')}`} <span className="text-slate-500">({w.days}d)</span></span>
              </div>
            ))}
          </div>
        </Section>
      </div>
      <ul className="space-y-1">
        {st.notes.map((n, i) => (
          <li key={i} className="text-xs text-slate-400">• {tr(lang, n)}</li>
        ))}
      </ul>
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import { CheckCircle2, HelpCircle, MinusCircle } from 'lucide-react';
import { advancedStats, fmtByUnit, formatRangeVi, type TestResult } from '../../../analytics';
import { useWorkspace } from '../../seller/SellerContext';
import { NotEnoughData, Section, tr } from '../../seller/ui';
import { PlacedOnlyNote } from '../../workspace/OrderStagePicker';
import { SampleTag } from '../../workspace/SampleSize';
import { Badge, CardGrid, SectionCard, type Tone } from '../../ui/primitives';
import { TABLE } from '../../ui/data';
import { Th } from '../ui';

const VERDICT: Record<TestResult['verdict'], { icon: typeof CheckCircle2; vi: string; en: string; tone: Tone }> = {
  significant: { icon: CheckCircle2, vi: 'Khác biệt rõ (p < 0,05)', en: 'Significant (p < 0.05)', tone: 'primary' },
  not_significant: { icon: MinusCircle, vi: 'Có thể chỉ là dao động', en: 'Could be noise', tone: 'neutral' },
  insufficient: { icon: HelpCircle, vi: 'Chưa đủ mẫu', en: 'Too few samples', tone: 'warn' },
  no_comparison: { icon: HelpCircle, vi: 'Không có kỳ so sánh', en: 'No comparison period', tone: 'neutral' },
};

export const AdvancedStatsView: React.FC = () => {
  const { lang, dataset, baseFilter, range, previousRange } = useWorkspace();
  const vi = lang === 'vi';
  const [excludeSale, setExcludeSale] = useState(false);
  const st = useMemo(() => advancedStats(dataset, baseFilter, previousRange, { excludeSaleDays: excludeSale }), [dataset, baseFilter, previousRange, excludeSale]);

  const diffText = (t: TestResult, v: number | null) => (v === null ? '—' : t.unit === 'ratio' ? `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(2).replace('.', vi ? ',' : '.')}pp` : `${v >= 0 ? '+' : '−'}${fmtByUnit(Math.abs(v), t.unit, lang)}`);
  const label = (key: string) => st.correlations.series.find((s) => s.key === key)!;

  // No data at all in the comparison period: no Δ columns, no "so với" line.
  const hasComparison = st.tests.some((t) => t.verdict !== 'no_comparison');
  return (
    <div className="space-y-4">
      <PlacedOnlyNote lang={lang} show={dataset.orders.length === 0 && dataset.dailyMetrics.length > 0} />
      <SectionCard
        title={vi ? 'Kiểm định khác biệt giữa hai kỳ' : 'Period difference tests'}
        description={hasComparison ? `${formatRangeVi(range)} ${vi ? 'so với' : 'vs'} ${formatRangeVi(previousRange)}` : `${formatRangeVi(range)} · ${vi ? 'Không có kỳ so sánh' : 'No comparison period'}`}
        notesLabel={vi ? 'Ghi chú' : 'Notes'}
        notes={st.notes.map((n) => tr(lang, n))}
      >
        <div className={TABLE.frame}>
          <table className={TABLE.table}>
            <thead className={TABLE.thead}>
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
                  <tr key={t.key} className={`${TABLE.tr} text-fg`}>
                    <td className={`${TABLE.td} font-medium`}>{tr(lang, t.label)}</td>
                    {hasComparison && <td className={`${TABLE.td} text-right text-muted`}>{fmtByUnit(t.previous, t.unit, lang)}</td>}
                    <td className={`${TABLE.td} text-right`}>{fmtByUnit(t.current, t.unit, lang)}</td>
                    {hasComparison && <td className={`${TABLE.td} text-right`}>{diffText(t, t.difference)}</td>}
                    {hasComparison && <td className={`${TABLE.td} text-right text-muted`}>{t.ciLow === null ? '—' : `${diffText(t, t.ciLow)} … ${diffText(t, t.ciHigh)}`}</td>}
                    {hasComparison && <td className={`${TABLE.td} text-right`}>{t.pValue === null ? '—' : t.pValue < 0.001 ? '< 0,001' : t.pValue.toFixed(3).replace('.', vi ? ',' : '.')}</td>}
                    <td className={`${TABLE.td} text-right text-muted`}>
                      {t.nCurrent.toLocaleString('vi-VN')} / {t.nPrevious.toLocaleString('vi-VN')}
                    </td>
                    <td className={TABLE.td}>
                      <Badge tone={V.tone} icon={<V.icon className="h-3.5 w-3.5" aria-hidden />}>
                        {vi ? V.vi : V.en}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <CardGrid>
        <SectionCard
          span={6}
          title={vi ? 'Tương quan theo ngày' : 'Daily correlation'}
          description={vi ? 'Pearson r và Spearman ρ (−1 … 1) giữa các chỉ số trong kỳ này · tương quan không phải nhân quả' : 'Pearson r and Spearman ρ · correlation is not causation'}
          tools={
            <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={excludeSale} onChange={(e) => setExcludeSale(e.target.checked)} className="h-4 w-4 accent-primary" />
              {vi ? 'Bỏ ngày sale' : 'Exclude sale days'}
            </label>
          }
        >
          {st.correlations.cells.length === 0 ? (
            <NotEnoughData lang={lang} reason={vi ? 'Cần ít nhất 10 ngày dữ liệu.' : 'At least 10 days needed.'} />
          ) : (
            <div className={TABLE.frame}>
              <table className={TABLE.table}>
                <thead className={TABLE.thead}>
                  <tr>
                    <Th left>{vi ? 'Cặp chỉ số' : 'Pair'}</Th>
                    <Th title="Pearson">r</Th>
                    <Th title="Spearman">ρ</Th>
                    <Th>n</Th>
                    <Th left>{vi ? 'Mức độ đi cùng' : 'Strength'}</Th>
                  </tr>
                </thead>
                <tbody>
                  {[...st.correlations.cells]
                    .sort((a, b) => Number(a.formulaLinked) - Number(b.formulaLinked) || Math.abs(b.r ?? 0) - Math.abs(a.r ?? 0))
                    .map((c) => {
                      const a = Math.abs(c.r ?? 0);
                      const num = (v: number | null) => (v === null ? '—' : v.toFixed(2).replace('.', vi ? ',' : '.'));
                      return (
                        <tr key={`${c.a}-${c.b}`} className={`${TABLE.tr} ${c.formulaLinked ? 'text-muted' : 'text-fg'}`}>
                          <td className={TABLE.td}>
                            {tr(lang, label(c.a).label)} × {tr(lang, label(c.b).label)}
                          </td>
                          <td className={`${TABLE.td} text-right`}>{num(c.r)}</td>
                          <td className={`${TABLE.td} text-right`}>{num(c.rho)}</td>
                          <td className={`${TABLE.td} text-right`}>{c.n}</td>
                          <td className="px-3 py-1.5 leading-snug text-muted">
                            {c.formulaLinked ? (
                              <span title={vi ? 'GMV = số đơn × AOV nên hai chỉ số này luôn liên quan' : 'GMV = orders × AOV'}>{vi ? 'Liên quan theo công thức' : 'Linked by formula'}</span>
                            ) : (
                              <>
                                {c.r === null ? '—' : a >= 0.7 ? (vi ? 'Đi cùng mạnh' : 'Strong') : a >= 0.4 ? (vi ? 'Đi cùng vừa' : 'Moderate') : a >= 0.2 ? (vi ? 'Yếu' : 'Weak') : vi ? 'Gần như không' : 'None'}
                                {c.r !== null && a >= 0.2 ? (c.r > 0 ? (vi ? ' (cùng chiều)' : ' (same direction)') : vi ? ' (ngược chiều)' : ' (opposite)') : ''}
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard span={6} title={vi ? 'Chỉ số theo thứ trong tuần' : 'Weekday index'} description={vi ? 'GMV trung bình từng thứ so với trung bình ngày thường (không tính ngày sale)' : 'Average GMV per weekday vs overall (sale days excluded)'}>
          <div className="space-y-2">
            {st.weekday.map((w) => (
              <div key={w.weekday} className="flex items-center gap-3 text-sm">
                <span className="w-36 shrink-0 whitespace-nowrap text-fg">
                  {tr(lang, w.label)}
                  <SampleTag n={w.days} lang={lang} />
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, ((w.index ?? 0) / 1.5) * 100)}%` }} />
                </div>
                <span className="w-28 shrink-0 text-right tabular text-fg">
                  {w.index === null ? '—' : `×${w.index.toFixed(2).replace('.', vi ? ',' : '.')}`} <span className="text-small text-muted">({w.days}d)</span>
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      </CardGrid>
    </div>
  );
};

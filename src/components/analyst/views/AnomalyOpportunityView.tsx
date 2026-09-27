import React, { useMemo, useState } from 'react';
import { AlertTriangle, Lightbulb, CalendarDays } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { addDays, anomalyScan, findOpportunities, fmtByUnit, fmtChange, fmtDay, fmtRate, formatRangeVi, type ScanMetric } from '../../../analytics';
import { useWorkspace } from '../../seller/SellerContext';
import { EvidenceButton, NotEnoughData, Section, tr } from '../../seller/ui';
import { Th } from '../ui';
import { PlacedOnlyNote } from '../../workspace/OrderStagePicker';
import { SourceDriversPanel } from '../../workspace/SummaryInsightPanels';

const CURRENT_COLOR = '#3987e5';
const BASELINE_COLOR = '#8b93a3';

const METRICS: { key: ScanMetric; vi: string; en: string; unit: 'vnd' | 'count' | 'ratio' }[] = [
  { key: 'gmv', vi: 'GMV', en: 'GMV', unit: 'vnd' },
  { key: 'orders', vi: 'Số đơn', en: 'Orders', unit: 'count' },
  { key: 'cancelRate', vi: 'Tỷ lệ hủy', en: 'Cancel rate', unit: 'ratio' },
  { key: 'profit', vi: 'Lợi nhuận', en: 'Profit', unit: 'vnd' },
];

const KIND_LABEL = {
  efficiency_growth: { vi: 'Hiệu quả tăng', en: 'Efficiency up' },
  high_cvr_low_traffic: { vi: 'Chuyển đổi cao, ít traffic', en: 'High CVR, low traffic' },
  high_margin_low_share: { vi: 'Biên cao, tỷ trọng nhỏ', en: 'High margin, small share' },
  low_ctr_high_reach: { vi: 'CTR thấp, hiển thị cao', en: 'Low CTR, high reach' },
  high_ctr_low_reach: { vi: 'CTR cao, hiển thị thấp', en: 'High CTR, low reach' },
  new_buyers: { vi: 'Giữ chân khách', en: 'Retention' },
  strong_koc: { vi: 'KOC hiệu quả', en: 'Strong KOC' },
};

export const AnomalyOpportunityView: React.FC = () => {
  const { lang, dataset, baseFilter, range, previousRange, platforms, openEvidence } = useWorkspace();
  const vi = lang === 'vi';
  const [metric, setMetric] = useState<ScanMetric>('gmv');
  const spec = METRICS.find((m) => m.key === metric)!;
  const scan = useMemo(() => anomalyScan(dataset, baseFilter, metric), [dataset, baseFilter, metric]);
  const opps = useMemo(() => findOpportunities(dataset, baseFilter, previousRange), [dataset, baseFilter, previousRange]);
  const fmt = (v: number | null) => fmtByUnit(v, spec.unit, lang);
  // Source breakdown of a flagged day vs the 14 days before it (sale days left out of the baseline).
  const hasSources = (dataset.salesSummaries ?? []).some((r) => r.dimension === 'source' && r.periodStart === undefined);
  const [driverDay, setDriverDay] = useState<string | null>(null);
  const flaggedDay = scan.flagged.find((p) => p.date === driverDay)?.date ?? (scan.flagged.find((p) => !p.saleDay) ?? scan.flagged[0])?.date ?? null;
  const saleDays = useMemo(() => new Set(scan.points.filter((p) => p.saleDay && p.date !== flaggedDay).map((p) => p.date)), [scan, flaggedDay]);
  const driverWindows = useMemo(
    () => (flaggedDay ? { before: { start: addDays(flaggedDay, -14), end: addDays(flaggedDay, -1) }, after: { start: flaggedDay, end: flaggedDay } } : null),
    [flaggedDay],
  );

  const chart = scan.points.map((p) => ({ date: p.date, label: fmtDay(p.date), value: p.value, baseline: p.baseline }));
  const unexpected = scan.flagged.filter((p) => !p.saleDay);

  return (
    <div className="space-y-4">
      <PlacedOnlyNote lang={lang} show={dataset.orders.length === 0 && dataset.dailyMetrics.length > 0} />
      <Section
        title={vi ? 'Phát hiện bất thường' : 'Anomaly scan'}
        subtitle={vi ? `${formatRangeVi(range)} · mỗi ngày so với trung vị 14 ngày thường trước đó (không tính ngày sale)` : `${formatRangeVi(range)} · each day vs the median of the previous 14 normal days`}
      >
        <div className="flex flex-wrap gap-1.5 mb-3" role="group" aria-label={vi ? 'Chỉ số' : 'Metric'}>
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              aria-pressed={metric === m.key}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${metric === m.key ? 'bg-sky-600 border-sky-500 text-white' : 'border-white/10 text-slate-300 hover:text-white'}`}
            >
              {vi ? m.vi : m.en}
            </button>
          ))}
        </div>
        {scan.points.length === 0 ? (
          <NotEnoughData lang={lang} reason={tr(lang, scan.notes[0] ?? { vi: 'Không đủ dữ liệu.', en: 'Not enough data.' })} />
        ) : (
          <>
            <div className="h-64" role="img" aria-label={vi ? `Biểu đồ ${spec.vi} theo ngày và mức nền` : `${spec.en} per day and baseline`}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.12)' }} minTickGap={16} />
                  <YAxis tickFormatter={(v: number) => fmt(v)} tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} width={64} />
                  <Tooltip
                    contentStyle={{ background: '#0b1024', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, fontSize: 12 }}
                    labelStyle={{ color: '#e2e8f0', fontWeight: 700 }}
                    itemStyle={{ color: '#cbd5e1' }}
                    formatter={(v: number, name: string) => [fmt(v), name]}
                  />
                  <Line isAnimationActive={false} type="monotone" dataKey="value" name={vi ? spec.vi : spec.en} stroke={CURRENT_COLOR} strokeWidth={2} dot={false} connectNulls />
                  <Line isAnimationActive={false} type="monotone" dataKey="baseline" name={vi ? 'Mức nền (trung vị ngày thường)' : 'Baseline'} stroke={BASELINE_COLOR} strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls />
                  {scan.flagged.map((p) => (
                    <ReferenceDot key={p.date} x={fmtDay(p.date)} y={p.value ?? 0} r={5} fill={p.saleDay ? '#8b93a3' : '#fab219'} stroke="#0b1024" strokeWidth={1.5} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {vi ? 'Chấm vàng: bất thường ngoài lịch sale. Chấm xám: ngày sale (tăng/giảm là dự kiến).' : 'Amber dot: unexpected anomaly. Gray dot: sale day (expected).'}
            </p>

            <h3 className="text-xs font-bold text-slate-300 mt-4 mb-1.5">
              {vi ? `Ngày được đánh dấu (${scan.flagged.length}; ${unexpected.length} ngoài lịch sale)` : `Flagged days (${scan.flagged.length}; ${unexpected.length} unexpected)`}
            </h3>
            {scan.flagged.length === 0 ? (
              <p className="text-sm text-slate-400">{vi ? 'Không có ngày nào lệch mạnh so với mức nền.' : 'No day deviates strongly from the baseline.'}</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-xs">
                  <thead className="bg-white/[0.04] text-slate-400">
                    <tr>
                      <Th left>{vi ? 'Ngày' : 'Day'}</Th>
                      <Th>{vi ? 'Giá trị' : 'Value'}</Th>
                      <Th>{vi ? 'Mức nền' : 'Baseline'}</Th>
                      <Th>{vi ? 'Chênh lệch' : 'Difference'}</Th>
                      <Th title={vi ? 'Điểm lệch chuẩn hóa (median/MAD); ≥ 3,5 là bất thường' : 'Robust score; ≥ 3.5 flagged'}>{vi ? 'Điểm lệch' : 'Score'}</Th>
                      <Th left>{vi ? 'Bối cảnh' : 'Context'}</Th>
                      <Th>{''}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {scan.flagged.map((p) => (
                      <tr key={p.date} className="border-t border-white/5 text-slate-200">
                        <td className="px-2.5 py-1.5 whitespace-nowrap">{fmtDay(p.date)}</td>
                        <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{fmt(p.value)}</td>
                        <td className="px-2.5 py-1.5 text-right whitespace-nowrap text-slate-400">{fmt(p.baseline)}</td>
                        <td className="px-2.5 py-1.5 text-right whitespace-nowrap">
                          {spec.unit === 'ratio' ? `${p.value !== null && p.baseline !== null ? ((p.value - p.baseline) * 100).toFixed(1).replace('.', vi ? ',' : '.') : '—'}pp` : fmtChange(p.value !== null && p.baseline ? (p.value - p.baseline) / Math.abs(p.baseline) : null, lang)}
                        </td>
                        <td className="px-2.5 py-1.5 text-right">{p.score === null ? '—' : p.score.toFixed(1).replace('.', vi ? ',' : '.')}</td>
                        <td className="px-2.5 py-1.5 whitespace-nowrap">
                          {p.saleDay ? (
                            <span className="inline-flex items-center gap-1 text-slate-400"><CalendarDays className="w-3 h-3" aria-hidden /> {vi ? 'Ngày sale — dự kiến' : 'Sale day — expected'}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[#fab219]"><AlertTriangle className="w-3 h-3" aria-hidden /> {vi ? 'Cần kiểm tra' : 'Check'}</span>
                          )}
                        </td>
                        <td className="px-2.5 py-1.5 text-right whitespace-nowrap">
                          {hasSources && (
                            <button
                              onClick={() => setDriverDay(p.date)}
                              aria-pressed={flaggedDay === p.date}
                              className={`mr-1.5 px-2 py-0.5 rounded-lg text-[11px] font-semibold border ${flaggedDay === p.date ? 'bg-white/15 border-white/30 text-white' : 'border-white/10 text-slate-400'}`}
                            >
                              {vi ? 'Theo nguồn' : 'By source'}
                            </button>
                          )}
                          <EvidenceButton compact lang={lang} onClick={() => openEvidence({ title: `${vi ? spec.vi : spec.en} · ${fmtDay(p.date)}`, filter: { range: { start: p.date, end: p.date }, platforms, cancelledOnly: metric === 'cancelRate' || undefined } })} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {scan.notes.map((n, i) => (
              <p key={i} className="text-[11px] text-slate-500 mt-2">• {tr(lang, n)}</p>
            ))}
          </>
        )}
      </Section>

      {hasSources && driverWindows && (
        <SourceDriversPanel
          before={driverWindows.before}
          after={driverWindows.after}
          excludeDates={saleDays}
          title={vi ? `Ngày ${fmtDay(flaggedDay!)}: doanh số lệch do kênh / nguồn nào (so với TB 14 ngày trước)` : `${fmtDay(flaggedDay!)}: which channel / source moved sales (vs prior 14-day average)`}
        />
      )}

      <Section
        title={vi ? 'Cơ hội' : 'Opportunities'}
        subtitle={
          dataset.orders.length === 0
            ? vi ? `${formatRangeVi(range)} · từ báo cáo tổng hợp (Top 5 sản phẩm, người mua cả kỳ, Top 5 affiliate)` : `${formatRangeVi(range)} · from the summary report`
            : vi ? `${formatRangeVi(range)} so với ${formatRangeVi(previousRange)} · SKU có ít nhất 20 đơn` : `${formatRangeVi(range)} vs ${formatRangeVi(previousRange)} · SKUs with ≥ 20 orders`
        }
      >
        {opps.length === 0 ? (
          <p className="text-sm text-slate-400">{vi ? 'Không đủ dữ liệu để tìm cơ hội trong khoảng này.' : 'Not enough data to find opportunities in this range.'}</p>
        ) : (
          <ul className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
            {opps.map((o) => (
              <li key={`${o.kind}-${o.sku}-${o.label}`} className="rounded-xl border border-[#0ca30c]/30 bg-[#0ca30c]/[0.04] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-bold text-white flex items-center gap-1.5"><Lightbulb className="w-4 h-4 text-[#4ade80] shrink-0" aria-hidden /> {tr(lang, o.title)}</div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-[#0ca30c]/40 text-[#4ade80] whitespace-nowrap">{tr(lang, KIND_LABEL[o.kind])}</span>
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">{tr(lang, o.message)}</p>
                <p className="text-xs text-sky-200 mt-1.5"><b>{vi ? 'Nên kiểm tra: ' : 'Check: '}</b>{tr(lang, o.check)}</p>
                <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                  <span className="text-[11px] text-slate-500">
                    {o.metrics.gmvShare !== null && `${vi ? 'Tỷ trọng GMV' : 'GMV share'} ${fmtRate(o.metrics.gmvShare, lang)}`}
                    {o.metrics.margin !== null && ` · margin ${fmtRate(o.metrics.margin, lang)}`}
                  </span>
                  {o.sku && dataset.orders.length > 0 && <EvidenceButton compact lang={lang} onClick={() => openEvidence({ title: tr(lang, o.title), filter: { range, platforms, skus: [o.sku] } })} />}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-slate-500 mt-3">
          {vi ? 'Cơ hội là gợi ý để kiểm tra dựa trên số liệu quá khứ, không đảm bảo kết quả khi tăng hiển thị.' : 'Opportunities are checks suggested by past data, not guaranteed results.'}
        </p>
      </Section>
    </div>
  );
};

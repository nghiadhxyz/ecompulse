import React, { useMemo, useState } from 'react';
import { AlertTriangle, Lightbulb, CalendarDays } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { addDays, anomalyScan, findOpportunities, fmtByUnit, fmtChange, fmtDay, fmtRate, formatRangeVi, type ScanMetric } from '../../../analytics';
import { useWorkspace } from '../../seller/SellerContext';
import { EvidenceButton, NotEnoughData, tr } from '../../seller/ui';
import { Badge, Chip, SectionCard } from '../../ui/primitives';
import { TABLE } from '../../ui/data';
import { axisProps, CHART, gridProps, legendProps, tooltipProps } from '../../../theme/chart';
import { Th } from '../ui';
import { PlacedOnlyNote } from '../../workspace/OrderStagePicker';
import { SourceDriversPanel } from '../../workspace/SummaryInsightPanels';
import { Legend } from 'recharts';

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
  const dot = (color: string) => <span className="inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: color }} aria-hidden />;

  return (
    <div className="space-y-4">
      <PlacedOnlyNote lang={lang} show={dataset.orders.length === 0 && dataset.dailyMetrics.length > 0} />
      <SectionCard
        title={vi ? 'Phát hiện bất thường' : 'Anomaly scan'}
        description={vi ? `${formatRangeVi(range)} · mỗi ngày so với trung vị 14 ngày thường trước đó (không tính ngày sale)` : `${formatRangeVi(range)} · each day vs the median of the previous 14 normal days`}
        notesLabel={vi ? 'Ghi chú' : 'Notes'}
        notes={scan.points.length === 0 ? [] : scan.notes.map((n) => tr(lang, n))}
      >
        <div className="mb-4 flex flex-wrap gap-1" role="group" aria-label={vi ? 'Chỉ số' : 'Metric'}>
          {METRICS.map((m) => (
            <Chip key={m.key} selected={metric === m.key} onClick={() => setMetric(m.key)}>
              {vi ? m.vi : m.en}
            </Chip>
          ))}
        </div>
        {scan.points.length === 0 ? (
          <NotEnoughData lang={lang} reason={tr(lang, scan.notes[0] ?? { vi: 'Không đủ dữ liệu.', en: 'Not enough data.' })} />
        ) : (
          <>
            <div className="h-64" role="img" aria-label={vi ? `Biểu đồ ${spec.vi} theo ngày và mức nền` : `${spec.en} per day and baseline`}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="label" tick={axisProps.tick} tickLine={false} axisLine={{ stroke: CHART.grid }} minTickGap={16} />
                  <YAxis tickFormatter={(v: number) => fmt(v)} tick={axisProps.tick} tickLine={false} axisLine={false} width={64} />
                  <Tooltip {...tooltipProps} formatter={(v: number, name: string) => [fmt(v), name]} />
                  <Legend {...legendProps} />
                  <Line isAnimationActive={false} type="monotone" dataKey="value" name={vi ? spec.vi : spec.en} stroke={CHART.primary} strokeWidth={2} dot={false} connectNulls />
                  <Line isAnimationActive={false} type="monotone" dataKey="baseline" name={vi ? 'Mức nền (trung vị ngày thường)' : 'Baseline'} stroke={CHART.muted} strokeWidth={1.5} strokeDasharray={CHART.compareDash} dot={false} connectNulls />
                  {scan.flagged.map((p) => (
                    <ReferenceDot key={p.date} x={fmtDay(p.date)} y={p.value ?? 0} r={5} fill={p.saleDay ? CHART.saleDay : CHART.anomaly} stroke="var(--surface)" strokeWidth={1.5} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-muted">
              <span className="inline-flex items-center gap-1.5">
                {dot(CHART.anomaly)} {vi ? 'Chấm cam: bất thường ngoài lịch sale' : 'Orange dot: unexpected anomaly'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                {dot(CHART.saleDay)} {vi ? 'Chấm xám: ngày sale (tăng/giảm là dự kiến)' : 'Gray dot: sale day (expected)'}
              </span>
            </p>

            <h3 className="mb-2 mt-5 text-sm font-semibold text-fg">{vi ? `Ngày được đánh dấu (${scan.flagged.length}; ${unexpected.length} ngoài lịch sale)` : `Flagged days (${scan.flagged.length}; ${unexpected.length} unexpected)`}</h3>
            {scan.flagged.length === 0 ? (
              <p className="text-sm text-muted">{vi ? 'Không có ngày nào lệch mạnh so với mức nền.' : 'No day deviates strongly from the baseline.'}</p>
            ) : (
              <div className={TABLE.frame}>
                <table className={TABLE.table}>
                  <thead className={TABLE.thead}>
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
                      <tr key={p.date} className={`${TABLE.tr} text-fg`}>
                        <td className={`${TABLE.td} font-medium`}>{fmtDay(p.date)}</td>
                        <td className={`${TABLE.td} text-right`}>{fmt(p.value)}</td>
                        <td className={`${TABLE.td} text-right text-muted`}>{fmt(p.baseline)}</td>
                        <td className={`${TABLE.td} text-right`}>
                          {spec.unit === 'ratio' ? `${p.value !== null && p.baseline !== null ? ((p.value - p.baseline) * 100).toFixed(1).replace('.', vi ? ',' : '.') : '—'}pp` : fmtChange(p.value !== null && p.baseline ? (p.value - p.baseline) / Math.abs(p.baseline) : null, lang)}
                        </td>
                        <td className={`${TABLE.td} text-right`}>{p.score === null ? '—' : p.score.toFixed(1).replace('.', vi ? ',' : '.')}</td>
                        <td className={TABLE.td}>
                          {p.saleDay ? (
                            <Badge tone="note" icon={<CalendarDays className="h-3 w-3" aria-hidden />}>
                              {vi ? 'Ngày sale — dự kiến' : 'Sale day — expected'}
                            </Badge>
                          ) : (
                            <Badge tone="warn" icon={<AlertTriangle className="h-3 w-3" aria-hidden />}>
                              {vi ? 'Cần kiểm tra' : 'Check'}
                            </Badge>
                          )}
                        </td>
                        <td className={`${TABLE.td} text-right`}>
                          <div className="flex items-center justify-end gap-1">
                            {hasSources && (
                              <Chip selected={flaggedDay === p.date} onClick={() => setDriverDay(p.date)}>
                                {vi ? 'Theo nguồn' : 'By source'}
                              </Chip>
                            )}
                            <EvidenceButton compact lang={lang} onClick={() => openEvidence({ title: `${vi ? spec.vi : spec.en} · ${fmtDay(p.date)}`, filter: { range: { start: p.date, end: p.date }, platforms, cancelledOnly: metric === 'cancelRate' || undefined } })} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </SectionCard>

      {hasSources && driverWindows && (
        <SourceDriversPanel
          before={driverWindows.before}
          after={driverWindows.after}
          excludeDates={saleDays}
          title={vi ? `Ngày ${fmtDay(flaggedDay!)}: doanh số lệch do kênh / nguồn nào (so với TB 14 ngày trước)` : `${fmtDay(flaggedDay!)}: which channel / source moved sales (vs prior 14-day average)`}
        />
      )}

      <SectionCard
        title={vi ? 'Cơ hội' : 'Opportunities'}
        description={
          dataset.orders.length === 0
            ? vi
              ? `${formatRangeVi(range)} · từ báo cáo tổng hợp (Top 5 sản phẩm, người mua cả kỳ, Top 5 affiliate)`
              : `${formatRangeVi(range)} · from the summary report`
            : vi
              ? `${formatRangeVi(range)} so với ${formatRangeVi(previousRange)} · SKU có ít nhất 20 đơn`
              : `${formatRangeVi(range)} vs ${formatRangeVi(previousRange)} · SKUs with ≥ 20 orders`
        }
        notesLabel={vi ? 'Ghi chú' : 'Notes'}
        notes={[vi ? 'Cơ hội là gợi ý để kiểm tra dựa trên số liệu quá khứ, không đảm bảo kết quả khi tăng hiển thị.' : 'Opportunities are checks suggested by past data, not guaranteed results.']}
      >
        {opps.length === 0 ? (
          <NotEnoughData lang={lang} reason={vi ? 'Không đủ dữ liệu để tìm cơ hội trong khoảng này.' : 'Not enough data to find opportunities in this range.'} />
        ) : (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {opps.map((o) => (
              <li key={`${o.kind}-${o.sku}-${o.label}`} className="flex flex-col rounded-control border border-line p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-fg">
                    <Lightbulb className="h-4 w-4 shrink-0 text-up" aria-hidden /> {tr(lang, o.title)}
                  </div>
                  <Badge tone="up">{tr(lang, KIND_LABEL[o.kind])}</Badge>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted">{tr(lang, o.message)}</p>
                <p className="mt-2 text-sm text-fg">
                  <b className="font-semibold">{vi ? 'Nên kiểm tra: ' : 'Check: '}</b>
                  {tr(lang, o.check)}
                </p>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                  <span className="text-small tabular text-muted">
                    {o.metrics.gmvShare !== null && `${vi ? 'Tỷ trọng GMV' : 'GMV share'} ${fmtRate(o.metrics.gmvShare, lang)}`}
                    {o.metrics.margin !== null && ` · margin ${fmtRate(o.metrics.margin, lang)}`}
                  </span>
                  {o.sku && dataset.orders.length > 0 && <EvidenceButton compact lang={lang} onClick={() => openEvidence({ title: tr(lang, o.title), filter: { range, platforms, skus: [o.sku] } })} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
};

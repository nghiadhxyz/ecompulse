import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronRight } from 'lucide-react';
import {
  DIMENSION_LABELS,
  fmtByUnit,
  fmtChange,
  fmtMoneyCompact,
  fmtPp,
  fmtRate,
  formatRangeVi,
  rootCause,
  ROOT_CAUSE_METRICS,
  type NodeRole,
  type RootCauseLevel,
  type RootCauseMetric,
} from '../../../analytics';
import { useWorkspace } from '../../seller/SellerContext';
import { EvidenceButton, NotEnoughData, Section, tr } from '../../seller/ui';
import { Badge, Chip, SectionCard, type Tone } from '../../ui/primitives';
import { TABLE } from '../../ui/data';
import { Th } from '../ui';

const METRICS: RootCauseMetric[] = ['gmv', 'orders', 'profit', 'aov', 'cancelRate', 'refundRate', 'margin', 'cvr'];

const ROLE: Record<NodeRole, { vi: string; en: string; tone: Tone }> = {
  main: { vi: 'Đóng góp chính', en: 'Main contributor', tone: 'primary' },
  contributing: { vi: 'Có đóng góp', en: 'Contributing', tone: 'neutral' },
  minor: { vi: 'Nhỏ', en: 'Minor', tone: 'note' },
  offsetting: { vi: 'Ngược chiều', en: 'Offsetting', tone: 'warn' },
};

export const RootCauseView: React.FC = () => {
  const { lang, dataset, baseFilter, range, previousRange, openEvidence } = useWorkspace();
  const vi = lang === 'vi';
  const [metric, setMetric] = useState<RootCauseMetric>('gmv');
  const r = useMemo(() => rootCause(dataset, baseFilter, previousRange, metric, lang), [dataset, baseFilter, previousRange, metric, lang]);
  const spec = ROOT_CAUSE_METRICS[metric];
  const isRate = spec.unit === 'ratio';
  const fmtContribution = (v: number | null) => (v === null ? '—' : isRate ? fmtPp(v * 100, lang) : fmtByUnit(v, spec.unit, lang));
  const fmtValue = (v: number | null) => fmtByUnit(v, spec.unit, lang);
  const good = (v: number) => (spec.goodWhenUp ? v > 0 : v < 0);
  /** Green when the change helps, orange when it hurts; the arrow gives the direction. */
  const toneClass = (v: number, tiny: boolean) => (tiny ? 'text-muted' : good(v) ? 'text-up' : 'text-down');
  const arrow = (v: number) => (v > 0 ? '↑ ' : v < 0 ? '↓ ' : '');

  const levelTable = (level: RootCauseLevel, title: string) => {
    const maxAbs = Math.max(...level.nodes.map((n) => Math.abs(n.contribution)), 1e-12);
    return (
      <div key={title}>
        <h3 className="mb-2 text-sm font-semibold text-fg">{title}</h3>
        <div className={TABLE.frame}>
          <table className={TABLE.table}>
            <thead className={TABLE.thead}>
              <tr>
                <Th left>{tr(lang, DIMENSION_LABELS[level.dimension])}</Th>
                <Th>{vi ? 'Kỳ so sánh' : 'Comparison'}</Th>
                <Th>{vi ? 'Kỳ này' : 'Current'}</Th>
                <Th title={vi ? 'Phần thay đổi của toàn shop nằm ở nhóm này (tổng các dòng = tổng thay đổi)' : 'Share of the total change sitting in this member'}>{vi ? 'Đóng góp' : 'Contribution'}</Th>
                <Th left>{vi ? 'Vai trò' : 'Role'}</Th>
                <Th>{''}</Th>
              </tr>
            </thead>
            <tbody>
              {level.nodes.slice(0, 8).map((n) => {
                const tiny = Math.abs(n.contribution) < maxAbs * 0.02;
                return (
                  <tr key={n.key} className={`${TABLE.tr} text-fg`}>
                    <td className={`${TABLE.td} max-w-[240px] truncate font-medium`} title={n.label}>
                      {n.label}
                    </td>
                    <td className={`${TABLE.td} text-right text-muted`}>{fmtValue(n.previous)}</td>
                    <td className={`${TABLE.td} text-right`}>{fmtValue(n.current)}</td>
                    <td className={TABLE.td}>
                      <div className="flex items-center justify-end gap-2">
                        <span className={`font-semibold ${toneClass(n.contribution, tiny)}`}>
                          {!tiny && <span aria-hidden>{arrow(n.contribution)}</span>}
                          {fmtContribution(n.contribution)}
                        </span>
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                          <span className="block h-full rounded-full bg-primary" style={{ width: `${(Math.abs(n.contribution) / maxAbs) * 100}%` }} />
                        </span>
                      </div>
                    </td>
                    <td className={TABLE.td}>
                      <Badge tone={ROLE[n.role].tone}>{vi ? ROLE[n.role].vi : ROLE[n.role].en}</Badge>
                    </td>
                    <td className={`${TABLE.td} text-right`}>{n.evidence && <EvidenceButton compact lang={lang} onClick={() => openEvidence({ title: `${tr(lang, spec.label)} · ${n.label}`, filter: n.evidence! })} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <SectionCard
        title="Root Cause"
        description={vi ? `Thay đổi nằm ở đâu: ${formatRangeVi(range)} so với ${formatRangeVi(previousRange)}` : `Where the change sits: ${formatRangeVi(range)} vs ${formatRangeVi(previousRange)}`}
        notesLabel={vi ? 'Ghi chú' : 'Notes'}
        notes={r.unavailable ? [] : r.notes.map((n) => tr(lang, n))}
      >
        <div className="mb-4 flex flex-wrap gap-1" role="group" aria-label={vi ? 'Chỉ số' : 'Metric'}>
          {METRICS.map((m) => (
            <Chip key={m} selected={metric === m} onClick={() => setMetric(m)}>
              {tr(lang, ROOT_CAUSE_METRICS[m].label)}
            </Chip>
          ))}
        </div>

        {r.unavailable ? (
          <NotEnoughData lang={lang} reason={tr(lang, r.unavailable)} />
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-x-6 gap-y-2 rounded-control border border-line bg-surface-2 p-4">
              <div>
                <div className="text-small text-muted">{vi ? 'Kỳ so sánh' : 'Comparison'}</div>
                <div className="text-xl font-bold tabular text-muted">{fmtValue(r.previous)}</div>
              </div>
              <ChevronRight className="mb-2 h-4 w-4 text-muted" aria-hidden />
              <div>
                <div className="text-small text-muted">{vi ? 'Kỳ này' : 'Current'}</div>
                <div className="text-kpi text-fg">{fmtValue(r.current)}</div>
              </div>
              {r.change !== null && (
                <div className={`mb-1 flex items-center gap-1 text-sm font-semibold tabular ${toneClass(r.change, Math.abs(r.change) < 1e-9)}`}>
                  {r.change > 0 ? <ArrowUp className="h-4 w-4" aria-hidden /> : r.change < 0 ? <ArrowDown className="h-4 w-4" aria-hidden /> : null}
                  {fmtContribution(r.change)}
                  {!isRate && r.previous ? <span>({fmtChange(r.change / Math.abs(r.previous), lang)})</span> : null}
                </div>
              )}
            </div>

            {r.path.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 text-sm font-semibold text-fg">{vi ? 'Chuỗi đóng góp chính' : 'Main contribution path'}</h3>
                <ol className="flex flex-wrap items-center gap-1.5 text-sm text-fg">
                  {r.path.map((p, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      {i > 0 && <ChevronRight className="h-4 w-4 text-muted" aria-hidden />}
                      <span className="rounded-control border border-primary/30 bg-primary-soft px-2.5 py-1.5">
                        <span className="block text-small text-muted">{tr(lang, DIMENSION_LABELS[p.dimension])}</span>
                        <b className="font-semibold">{p.label}</b>{' '}
                        <span className="text-small tabular text-muted">
                          {fmtContribution(p.contribution)}
                          {p.share !== null ? ` · ${fmtRate(Math.abs(p.share), lang, 0)}` : ''}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        )}
      </SectionCard>

      {!r.unavailable && r.drivers && (
        <Section
          title={vi ? 'Động lực GMV' : 'GMV drivers'}
          subtitle={vi ? 'GMV = lượt click sản phẩm × tỷ lệ đặt đơn × tỷ lệ giữ đơn × giá trị đơn. Tổng đóng góp = thay đổi GMV.' : 'GMV = clicks × order rate × retention × basket. Contributions sum to ΔGMV.'}
        >
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {r.drivers.map((d) => (
              <div key={d.key} className="rounded-control border border-line bg-surface-2 p-3">
                <div className="text-small text-muted">{tr(lang, d.label)}</div>
                <div className="mt-0.5 text-sm tabular text-muted">
                  {d.key === 'basket' ? fmtMoneyCompact(d.previous, lang) : d.key === 'traffic' ? fmtByUnit(d.previous, 'count', lang) : fmtRate(d.previous, lang, 2)}
                  {' → '}
                  <b className="font-semibold text-fg">{d.key === 'basket' ? fmtMoneyCompact(d.current, lang) : d.key === 'traffic' ? fmtByUnit(d.current, 'count', lang) : fmtRate(d.current, lang, 2)}</b>
                </div>
                <div className={`mt-1 text-xl font-bold tabular ${d.contribution === null ? 'text-muted' : d.contribution >= 0 ? 'text-up' : 'text-down'}`}>
                  {d.contribution !== null && <span aria-hidden>{d.contribution >= 0 ? '↑ ' : '↓ '}</span>}
                  {fmtMoneyCompact(d.contribution, lang)}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {!r.unavailable && r.tree.length > 0 && (
        <Section title={vi ? 'Phân rã từng tầng' : 'Level by level'} subtitle={vi ? 'Mỗi tầng phân rã phần thay đổi của nhóm đóng góp chính ở tầng trên.' : 'Each level splits the change of the main member above.'}>
          <div className="space-y-5">{r.tree.map((l, i) => levelTable(l, `${i + 1}. ${tr(lang, DIMENSION_LABELS[l.dimension])}${i > 0 ? ` — ${vi ? 'trong' : 'within'} ${r.tree[i - 1].nodes[0]?.label ?? ''}` : ''}`))}</div>
        </Section>
      )}

      {!r.unavailable && r.concentration.length > 0 && (
        <Section title={vi ? 'Thay đổi tập trung ở đâu' : 'Where it concentrates'} subtitle={vi ? `Trong "${r.path[r.path.length - 1]?.label ?? ''}": theo chiến dịch, phiên live, kênh và ngày.` : 'By campaign, live session, channel and day.'}>
          <div className="space-y-5">{r.concentration.map((l) => levelTable({ ...l, nodes: l.nodes.slice(0, 5) }, tr(lang, DIMENSION_LABELS[l.dimension])))}</div>
        </Section>
      )}
    </div>
  );
};

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
import { Th } from '../ui';

const METRICS: RootCauseMetric[] = ['gmv', 'orders', 'profit', 'aov', 'cancelRate', 'refundRate', 'margin', 'cvr'];

const ROLE: Record<NodeRole, { vi: string; en: string; cls: string }> = {
  main: { vi: 'Đóng góp chính', en: 'Main contributor', cls: 'bg-sky-500/15 text-sky-200 border-sky-400/30' },
  contributing: { vi: 'Có đóng góp', en: 'Contributing', cls: 'bg-white/[0.06] text-slate-200 border-white/15' },
  minor: { vi: 'Nhỏ', en: 'Minor', cls: 'text-slate-500 border-white/10' },
  offsetting: { vi: 'Ngược chiều', en: 'Offsetting', cls: 'bg-[#fab219]/10 text-[#fab219] border-[#fab219]/30' },
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

  const levelTable = (level: RootCauseLevel, title: string) => {
    const maxAbs = Math.max(...level.nodes.map((n) => Math.abs(n.contribution)), 1e-12);
    return (
      <div key={title}>
        <h3 className="text-xs font-bold text-slate-300 mb-1.5">{title}</h3>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-xs">
            <thead className="bg-white/[0.04] text-slate-400">
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
              {level.nodes.slice(0, 8).map((n) => (
                <tr key={n.key} className="border-t border-white/5 text-slate-200">
                  <td className="px-2.5 py-1.5 max-w-[240px] truncate" title={n.label}>{n.label}</td>
                  <td className="px-2.5 py-1.5 text-right whitespace-nowrap text-slate-400">{fmtValue(n.previous)}</td>
                  <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{fmtValue(n.current)}</td>
                  <td className="px-2.5 py-1.5 whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      <span className={`font-bold ${Math.abs(n.contribution) < maxAbs * 0.02 ? 'text-slate-400' : good(n.contribution) ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>{fmtContribution(n.contribution)}</span>
                      <span className="w-16 h-1.5 rounded bg-white/[0.06] overflow-hidden" aria-hidden>
                        <span className="block h-full bg-[#3987e5]" style={{ width: `${(Math.abs(n.contribution) / maxAbs) * 100}%` }} />
                      </span>
                    </div>
                  </td>
                  <td className="px-2.5 py-1.5">
                    <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-bold whitespace-nowrap ${ROLE[n.role].cls}`}>{vi ? ROLE[n.role].vi : ROLE[n.role].en}</span>
                  </td>
                  <td className="px-2.5 py-1.5 text-right">
                    {n.evidence && <EvidenceButton compact lang={lang} onClick={() => openEvidence({ title: `${tr(lang, spec.label)} · ${n.label}`, filter: n.evidence! })} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Section
        title="Root Cause"
        subtitle={vi ? `Thay đổi nằm ở đâu: ${formatRangeVi(range)} so với ${formatRangeVi(previousRange)}` : `Where the change sits: ${formatRangeVi(range)} vs ${formatRangeVi(previousRange)}`}
      >
        <div className="flex flex-wrap gap-1.5 mb-3" role="group" aria-label={vi ? 'Chỉ số' : 'Metric'}>
          {METRICS.map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              aria-pressed={metric === m}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${metric === m ? 'bg-sky-600 border-sky-500 text-white' : 'border-white/10 text-slate-300 hover:text-white'}`}
            >
              {tr(lang, ROOT_CAUSE_METRICS[m].label)}
            </button>
          ))}
        </div>

        {r.unavailable ? (
          <NotEnoughData lang={lang} reason={tr(lang, r.unavailable)} />
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-x-6 gap-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div>
                <div className="text-[11px] text-slate-400">{vi ? 'Kỳ so sánh' : 'Comparison'}</div>
                <div className="text-lg font-black text-slate-300">{fmtValue(r.previous)}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 mb-2" aria-hidden />
              <div>
                <div className="text-[11px] text-slate-400">{vi ? 'Kỳ này' : 'Current'}</div>
                <div className="text-lg font-black text-white">{fmtValue(r.current)}</div>
              </div>
              {r.change !== null && (
                <div className={`flex items-center gap-1 text-sm font-bold mb-1 ${Math.abs(r.change) < 1e-9 ? 'text-slate-400' : good(r.change) ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
                  {r.change > 0 ? <ArrowUp className="w-4 h-4" aria-hidden /> : r.change < 0 ? <ArrowDown className="w-4 h-4" aria-hidden /> : null}
                  {fmtContribution(r.change)}
                  {!isRate && r.previous ? <span className="font-semibold">({fmtChange(r.change / Math.abs(r.previous), lang)})</span> : null}
                </div>
              )}
            </div>

            {r.path.length > 0 && (
              <div className="mt-3 rounded-xl border border-sky-400/20 bg-sky-500/[0.05] p-3">
                <div className="text-[11px] font-black uppercase tracking-wider text-sky-300 mb-1.5">{vi ? 'Chuỗi đóng góp chính' : 'Main contribution path'}</div>
                <ol className="flex flex-wrap items-center gap-1.5 text-sm text-slate-100">
                  {r.path.map((p, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-500" aria-hidden />}
                      <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1">
                        <span className="text-[10px] text-slate-400 block">{tr(lang, DIMENSION_LABELS[p.dimension])}</span>
                        <b>{p.label}</b> <span className="text-xs text-slate-300">{fmtContribution(p.contribution)}{p.share !== null ? ` · ${fmtRate(Math.abs(p.share), lang, 0)}` : ''}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {r.notes.length > 0 && (
              <ul className="mt-3 space-y-1">
                {r.notes.map((n, i) => (
                  <li key={i} className="text-xs text-slate-400">• {tr(lang, n)}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </Section>

      {!r.unavailable && r.drivers && (
        <Section
          title={vi ? 'Động lực GMV' : 'GMV drivers'}
          subtitle={vi ? 'GMV = lượt click sản phẩm × tỷ lệ đặt đơn × tỷ lệ giữ đơn × giá trị đơn. Tổng đóng góp = thay đổi GMV.' : 'GMV = clicks × order rate × retention × basket. Contributions sum to ΔGMV.'}
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {r.drivers.map((d) => (
              <div key={d.key} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-[11px] text-slate-400">{tr(lang, d.label)}</div>
                <div className="text-sm text-slate-200 mt-0.5">
                  {d.key === 'basket' ? fmtMoneyCompact(d.previous, lang) : d.key === 'traffic' ? fmtByUnit(d.previous, 'count', lang) : fmtRate(d.previous, lang, 2)}
                  {' → '}
                  <b className="text-white">{d.key === 'basket' ? fmtMoneyCompact(d.current, lang) : d.key === 'traffic' ? fmtByUnit(d.current, 'count', lang) : fmtRate(d.current, lang, 2)}</b>
                </div>
                <div className={`text-lg font-black mt-1 ${d.contribution === null ? 'text-slate-400' : d.contribution >= 0 ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>{fmtMoneyCompact(d.contribution, lang)}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {!r.unavailable && r.tree.length > 0 && (
        <Section title={vi ? 'Phân rã từng tầng' : 'Level by level'} subtitle={vi ? 'Mỗi tầng phân rã phần thay đổi của nhóm đóng góp chính ở tầng trên.' : 'Each level splits the change of the main member above.'}>
          <div className="space-y-4">{r.tree.map((l, i) => levelTable(l, `${i + 1}. ${tr(lang, DIMENSION_LABELS[l.dimension])}${i > 0 ? ` — ${vi ? 'trong' : 'within'} ${r.tree[i - 1].nodes[0]?.label ?? ''}` : ''}`))}</div>
        </Section>
      )}

      {!r.unavailable && r.concentration.length > 0 && (
        <Section title={vi ? 'Thay đổi tập trung ở đâu' : 'Where it concentrates'} subtitle={vi ? `Trong "${r.path[r.path.length - 1]?.label ?? ''}": theo chiến dịch, phiên live, kênh và ngày.` : 'By campaign, live session, channel and day.'}>
          <div className="space-y-4">{r.concentration.map((l) => levelTable({ ...l, nodes: l.nodes.slice(0, 5) }, tr(lang, DIMENSION_LABELS[l.dimension])))}</div>
        </Section>
      )}
    </div>
  );
};

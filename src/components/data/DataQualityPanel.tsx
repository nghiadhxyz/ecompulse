import React, { useMemo, useState } from 'react';
import { ShieldCheck, AlertTriangle, XCircle, Info, CheckCircle2, CircleDashed, ChevronDown } from 'lucide-react';
import { assessDataQuality, formatRangeVi, PLATFORM_LABELS, type CanonicalDataset, type Capability, type DataIssue } from '../../analytics';
import { formatNumber } from '../../utils/formatters';
import { SourceChecksPanel } from './SourceChecksPanel';

interface DataQualityPanelProps {
  dataset: CanonicalDataset;
  language: 'vi' | 'en';
}

const CAP_STYLE: Record<Capability['status'], { icon: typeof CheckCircle2; cls: string; vi: string; en: string }> = {
  available: { icon: CheckCircle2, cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-400/25', vi: 'Có', en: 'Yes' },
  partial: { icon: CircleDashed, cls: 'text-amber-300 bg-amber-500/10 border-amber-400/25', vi: 'Một phần', en: 'Partial' },
  unavailable: { icon: XCircle, cls: 'text-slate-400 bg-white/[0.04] border-white/10', vi: 'Không đủ dữ liệu', en: 'Insufficient data' },
};

const ISSUE_STYLE: Record<DataIssue['severity'], { icon: typeof Info; cls: string }> = {
  error: { icon: XCircle, cls: 'text-rose-300 border-rose-400/30 bg-rose-500/10' },
  warning: { icon: AlertTriangle, cls: 'text-amber-300 border-amber-400/30 bg-amber-500/10' },
  info: { icon: Info, cls: 'text-sky-300 border-sky-400/30 bg-sky-500/10' },
};

/** What the imported data supports, what is missing, and what looks wrong. */
export const DataQualityPanel: React.FC<DataQualityPanelProps> = ({ dataset, language }) => {
  const report = useMemo(() => assessDataQuality(dataset), [dataset]);
  const [expanded, setExpanded] = useState(true);
  const t = (v: { vi: string; en: string }) => v[language];
  const vi = language === 'vi';

  const grainLabel =
    report.grain === 'order'
      ? vi ? 'Cấp đơn hàng' : 'Order level'
      : report.grain === 'daily'
        ? vi ? 'Báo cáo tổng hợp theo ngày' : 'Daily summary report'
        : vi ? 'Chưa có dữ liệu' : 'No data';
  const available = report.capabilities.filter((c) => c.status === 'available').length;

  return (
    <section className="glass-panel rounded-2xl p-4 sm:p-5 shadow-xl" aria-labelledby="dq-title">
      <button
        className="w-full flex items-start sm:items-center justify-between gap-3 text-left"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-sky-500/15 text-sky-300 border border-sky-400/25 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 id="dq-title" className="text-base font-bold text-white">
              {vi ? 'Chất lượng dữ liệu & khả năng phân tích' : 'Data quality & analysis coverage'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {grainLabel}
              {report.coverage && ` · ${formatRangeVi(report.coverage)} (${report.coverageDays} ${vi ? 'ngày' : 'days'})`}
              {report.platforms.length > 0 && ` · ${report.platforms.map((p) => PLATFORM_LABELS[p]).join(', ')}`}
              {` · ${available}/${report.capabilities.length} ${vi ? 'nhóm phân tích sẵn sàng' : 'analyses ready'}`}
            </p>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          {report.grain === 'order' && (
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: vi ? 'Đơn hàng' : 'Orders', value: report.counts.orders },
                { label: vi ? 'Dòng sản phẩm' : 'Line items', value: report.counts.orderLines },
                { label: 'SKU', value: report.counts.skus },
              ].map((c) => (
                <div key={c.label} className="rounded-xl bg-white/[0.04] border border-white/10 py-2">
                  <div className="text-sm sm:text-base font-black text-white">{formatNumber(c.value)}</div>
                  <div className="text-[11px] text-slate-400">{c.label}</div>
                </div>
              ))}
            </div>
          )}

          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {report.capabilities.map((c) => {
              const style = CAP_STYLE[c.status];
              const Icon = style.icon;
              return (
                <li key={c.key} className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-200">{t(c.label)}</span>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${style.cls}`}>
                      <Icon className="w-3 h-3" /> {vi ? style.vi : style.en}
                    </span>
                  </div>
                  {c.reason && <p className="text-[11px] text-slate-400 mt-1 leading-snug">{t(c.reason)}</p>}
                </li>
              );
            })}
          </ul>

          {report.issues.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide">{vi ? 'Cần lưu ý' : 'Issues'}</h4>
              {report.issues.map((issue, idx) => {
                const style = ISSUE_STYLE[issue.severity];
                const Icon = style.icon;
                return (
                  <div key={`${issue.code}-${idx}`} className={`flex items-start gap-2 rounded-xl border px-3 py-2 ${style.cls}`}>
                    <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs leading-snug text-slate-100">{t(issue.message)}</p>
                      {issue.samples && issue.samples.length > 0 && issue.code !== 'estimated_fields' && (
                        <p className="text-[11px] text-slate-400 mt-0.5 break-words">
                          {vi ? 'Ví dụ: ' : 'e.g. '}
                          {issue.samples.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> {vi ? 'Không phát hiện lỗi dữ liệu.' : 'No data issues found.'}
            </p>
          )}
        </div>
      )}
      {dataset.reportedFigures?.length ? (
        <div className="mt-4 border-t border-white/10 pt-4">
          <SourceChecksPanel dataset={dataset} lang={language} />
        </div>
      ) : null}
    </section>
  );
};

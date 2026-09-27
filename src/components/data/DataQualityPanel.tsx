import React, { useMemo, useState } from 'react';
import { ShieldCheck, AlertTriangle, XCircle, Info, CheckCircle2, CircleDashed, ChevronDown } from 'lucide-react';
import { assessDataQuality, dataNotices, datasetDateBounds, formatRangeVi, PLATFORM_LABELS, type CanonicalDataset, type Capability, type DataIssue } from '../../analytics';
import { formatNumber } from '../../utils/formatters';
import { DataNoticesList } from '../workspace/DataNotices';
import { Badge, type Tone } from '../ui/primitives';
import { SourceChecksPanel } from './SourceChecksPanel';

interface DataQualityPanelProps {
  dataset: CanonicalDataset;
  language: 'vi' | 'en';
}

const CAP_STYLE: Record<Capability['status'], { icon: typeof CheckCircle2; tone: Tone; vi: string; en: string }> = {
  available: { icon: CheckCircle2, tone: 'up', vi: 'Có', en: 'Yes' },
  partial: { icon: CircleDashed, tone: 'warn', vi: 'Một phần', en: 'Partial' },
  unavailable: { icon: XCircle, tone: 'neutral', vi: 'Không đủ dữ liệu', en: 'Insufficient data' },
};

/** Errors are invalid data (red is allowed only for that); warnings yellow; info blue. */
const ISSUE_STYLE: Record<DataIssue['severity'], { icon: typeof Info; cls: string }> = {
  error: { icon: XCircle, cls: 'bg-mismatch-soft text-mismatch' },
  warning: { icon: AlertTriangle, cls: 'bg-warn-soft text-warn' },
  info: { icon: Info, cls: 'bg-info-soft text-info' },
};

/** What the imported data supports, what is missing, and what looks wrong. */
export const DataQualityPanel: React.FC<DataQualityPanelProps> = ({ dataset, language }) => {
  const report = useMemo(() => assessDataQuality(dataset), [dataset]);
  const notices = useMemo(() => {
    const b = datasetDateBounds(dataset);
    return b ? dataNotices(dataset, b) : [];
  }, [dataset]);
  const [expanded, setExpanded] = useState(true);
  const t = (v: { vi: string; en: string }) => v[language];
  const vi = language === 'vi';

  const grainLabel =
    report.grain === 'order'
      ? vi
        ? 'Cấp đơn hàng'
        : 'Order level'
      : report.grain === 'daily'
        ? vi
          ? 'Báo cáo tổng hợp theo ngày'
          : 'Daily summary report'
        : vi
          ? 'Chưa có dữ liệu'
          : 'No data';
  const available = report.capabilities.filter((c) => c.status === 'available').length;

  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-card" aria-labelledby="dq-title">
      <button type="button" className="flex w-full items-start justify-between gap-3 text-left sm:items-center" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded}>
        <div className="flex min-w-0 items-start gap-3 sm:items-center">
          <div className="shrink-0 rounded-control bg-primary-soft p-2 text-primary">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 id="dq-title" className="text-card-title text-fg">
              {vi ? 'Chất lượng dữ liệu & khả năng phân tích' : 'Data quality & analysis coverage'}
            </h3>
            <p className="mt-0.5 text-small text-muted">
              {grainLabel}
              {report.coverage && ` · ${formatRangeVi(report.coverage)} (${report.coverageDays} ${vi ? 'ngày' : 'days'})`}
              {report.platforms.length > 0 && ` · ${report.platforms.map((p) => PLATFORM_LABELS[p]).join(', ')}`}
              {` · ${available}/${report.capabilities.length} ${vi ? 'nhóm phân tích sẵn sàng' : 'analyses ready'}`}
            </p>
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {expanded && (
        <div className="mt-5 space-y-5">
          {report.grain === 'order' && (
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: vi ? 'Đơn hàng' : 'Orders', value: report.counts.orders },
                { label: vi ? 'Dòng sản phẩm' : 'Line items', value: report.counts.orderLines },
                { label: 'SKU', value: report.counts.skus },
              ].map((c) => (
                <div key={c.label} className="rounded-control border border-line bg-surface-2 py-2.5">
                  <div className="text-xl font-bold tabular text-fg">{formatNumber(c.value)}</div>
                  <div className="text-small text-muted">{c.label}</div>
                </div>
              ))}
            </div>
          )}

          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {report.capabilities.map((c) => {
              const style = CAP_STYLE[c.status];
              const Icon = style.icon;
              return (
                <li key={c.key} className="rounded-control border border-line px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-fg">{t(c.label)}</span>
                    <Badge tone={style.tone} icon={<Icon className="h-3 w-3" aria-hidden />}>
                      {vi ? style.vi : style.en}
                    </Badge>
                  </div>
                  {c.reason && <p className="mt-1 text-small leading-snug text-muted">{t(c.reason)}</p>}
                </li>
              );
            })}
          </ul>

          {report.issues.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-fg">{vi ? 'Cần lưu ý' : 'Issues'}</h4>
              {report.issues.map((issue, idx) => {
                const style = ISSUE_STYLE[issue.severity];
                const Icon = style.icon;
                return (
                  <div key={`${issue.code}-${idx}`} className={`flex items-start gap-2 rounded-control px-3 py-2.5 ${style.cls}`}>
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-sm leading-snug">{t(issue.message)}</p>
                      {issue.samples && issue.samples.length > 0 && issue.code !== 'estimated_fields' && (
                        <p className="mt-0.5 break-words text-small text-muted">
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
            <p className="flex items-center gap-1.5 text-sm text-up">
              <CheckCircle2 className="h-4 w-4" aria-hidden /> {vi ? 'Không phát hiện lỗi dữ liệu.' : 'No data issues found.'}
            </p>
          )}
        </div>
      )}
      {dataset.reportedFigures?.length ? (
        <div className="mt-5 border-t border-line pt-5">
          <SourceChecksPanel dataset={dataset} lang={language} />
          {notices.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-1 text-sm font-semibold text-fg">{vi ? 'Bản ghi bất thường' : 'Odd records'}</h3>
              <DataNoticesList notices={notices} lang={language} />
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
};

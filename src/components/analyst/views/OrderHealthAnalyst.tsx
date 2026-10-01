import React, { useMemo, useState } from 'react';
import {
  breakdown,
  compareRanges,
  DIMENSION_LABELS,
  fmtRate,
  formatRangeVi,
  NONE_KEY,
  orderHealth,
  type BreakdownDimension,
  type BreakdownRow,
  type DatasetFilter,
  type EvidenceFilter,
  type Platform,
} from '../../../analytics';
import { useWorkspace } from '../../seller/SellerContext';
import { EvidenceButton, KpiCard, NotEnoughData, Section, tr } from '../../seller/ui';
import { Button } from '../../ui/primitives';
import { TABLE } from '../../ui/data';
import { DailyOrderHealthPanel } from '../../workspace/DailyOrderHealthPanel';
import { BreakdownTable } from '../ui';

const DIMS: BreakdownDimension[] = ['platform', 'category', 'subcategory', 'sku', 'combo', 'campaign', 'liveSession', 'channel'];

function memberFilter(dim: BreakdownDimension, key: string, base: DatasetFilter): DatasetFilter | null {
  if (key === NONE_KEY) return null;
  switch (dim) {
    case 'platform':
      return { ...base, platforms: [key as Platform] };
    case 'category':
      return { ...base, categories: [key] };
    case 'subcategory':
      return { ...base, subcategories: [key] };
    case 'sku':
      return { ...base, skus: [key] };
    case 'combo':
      return { ...base, comboIds: [key] };
    case 'campaign':
      return { ...base, campaignIds: [key] };
    case 'liveSession':
      return { ...base, liveSessionIds: [key] };
    default:
      return null;
  }
}

export const OrderHealthAnalyst: React.FC = () => {
  const { lang, dataset, baseFilter, previousRange, range, openEvidence } = useWorkspace();
  const vi = lang === 'vi';
  const [dim, setDim] = useState<BreakdownDimension>('platform');
  const [member, setMember] = useState<BreakdownRow | null>(null);
  const cmp = useMemo(() => compareRanges(dataset, baseFilter, previousRange), [dataset, baseFilter, previousRange]);
  const b = useMemo(() => breakdown(dataset, baseFilter, dim, previousRange, lang), [dataset, baseFilter, dim, previousRange, lang]);
  const focusFilter = useMemo(() => (member ? memberFilter(dim, member.key, baseFilter) : baseFilter), [member, dim, baseFilter]);
  const health = useMemo(() => (focusFilter ? orderHealth(dataset, focusFilter) : null), [dataset, focusFilter]);
  const prevHealth = useMemo(() => (focusFilter ? orderHealth(dataset, { ...focusFilter, range: previousRange }) : null), [dataset, focusFilter, previousRange]);

  if (dataset.orders.length === 0 && dataset.dailyMetrics.length > 0) return <DailyOrderHealthPanel />;
  if (dataset.orders.length === 0) {
    return (
      <Section title={vi ? 'Sức khỏe đơn hàng' : 'Order health'}>
        <NotEnoughData lang={lang} reason={vi ? 'Cần file xuất đơn hàng có trạng thái đơn.' : 'Needs an order export with statuses.'} />
      </Section>
    );
  }

  const compareLabel = vi ? `so với ${formatRangeVi(previousRange)}` : `vs ${formatRangeVi(previousRange)}`;
  const m = cmp.current.metrics;
  const c = cmp.metrics;
  const evidenceFor = (key: string, extra: Partial<EvidenceFilter>): EvidenceFilter | null => {
    const base: EvidenceFilter = { range, platforms: baseFilter.platforms, ...extra };
    if (key === NONE_KEY) return null;
    if (dim === 'platform') return { ...base, platforms: [key as Platform] };
    if (dim === 'sku') return { ...base, skus: [key] };
    if (dim === 'campaign') return { ...base, campaignId: key };
    if (dim === 'liveSession') return { ...base, liveSessionId: key };
    if (dim === 'category' || dim === 'subcategory') {
      const skus = dataset.products.filter((p) => (dim === 'category' ? p.category : p.subcategory) === key).map((p) => p.sku);
      return { ...base, skus };
    }
    if (dim === 'combo') return { ...base, skus: [key] };
    return null;
  };
  const prevReason = new Map((prevHealth?.cancelReasons ?? []).map((r) => [r.reason, r.share]));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard lang={lang} label={vi ? 'Đơn đặt' : 'Orders'} metric={m.orders} cmp={c.orders} compareLabel={compareLabel} />
        <KpiCard lang={lang} label={vi ? 'Tỷ lệ hủy' : 'Cancel rate'} metric={m.cancelRate} cmp={c.cancelRate} goodWhenUp={false} compareLabel={compareLabel} />
        <KpiCard lang={lang} label={vi ? 'Tỷ lệ trả/hoàn' : 'Return/refund rate'} metric={m.refundRate} cmp={c.refundRate} goodWhenUp={false} compareLabel={compareLabel} />
        <KpiCard lang={lang} label={vi ? 'Tỷ lệ hoàn tất' : 'Completion rate'} metric={m.completionRate} cmp={c.completionRate} compareLabel={compareLabel} />
      </div>

      <Section
        title={vi ? 'Hủy & hoàn theo chiều' : 'Cancels & returns by dimension'}
        subtitle={vi ? 'Bấm một dòng để xem lý do hủy của nhóm đó' : 'Click a row to see its reasons'}
        right={
          <label className="flex items-center gap-2 text-sm text-muted">
            {vi ? 'Phân theo' : 'By'}
            <select
              value={dim}
              onChange={(e) => {
                setDim(e.target.value as BreakdownDimension);
                setMember(null);
              }}
              className="min-h-10 rounded-control border border-line bg-surface px-2.5 text-sm text-fg"
            >
              {DIMS.map((d) => (
                <option key={d} value={d}>{tr(lang, DIMENSION_LABELS[d])}</option>
              ))}
            </select>
          </label>
        }
      >
        {b.unavailable ? (
          <NotEnoughData lang={lang} reason={tr(lang, b.unavailable)} />
        ) : (
          <BreakdownTable
            rows={[...b.rows].sort((x, y) => y.current.cancelled - x.current.cancelled)}
            lang={lang}
            firstHeader={tr(lang, DIMENSION_LABELS[dim])}
            columns={['orders', 'cancel', 'refund', 'gmv', 'share']}
            onRowClick={(r) => setMember(r)}
            rowAction={(r) => {
              const ev = evidenceFor(r.key, { cancelledOnly: true });
              return ev ? <EvidenceButton compact lang={lang} onClick={() => openEvidence({ title: `${vi ? 'Đơn hủy' : 'Cancelled'} · ${r.label}`, filter: ev })} /> : null;
            }}
          />
        )}
      </Section>

      <Section
        title={member ? `${vi ? 'Lý do hủy/hoàn' : 'Reasons'} · ${member.label}` : vi ? 'Lý do hủy/hoàn (toàn bộ)' : 'Reasons (all)'}
        right={member && <Button variant="ghost" onClick={() => setMember(null)}>{vi ? 'Xem toàn bộ' : 'Show all'}</Button>}
      >
        {!health ? (
          <NotEnoughData lang={lang} reason={vi ? 'Không lọc được lý do cho nhóm này.' : 'Reasons are not filterable for this group.'} />
        ) : health.cancelReasons.length === 0 && health.returnReasons.length === 0 ? (
          <p className="text-sm text-muted">{vi ? 'Không có lý do được ghi nhận.' : 'No reasons recorded.'}</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-fg">{vi ? 'Lý do hủy' : 'Cancel reasons'} ({health.lifecycle.cancelled + health.lifecycle.failedDelivery})</h3>
              <table className="w-full text-sm tabular">
                <tbody>
                  {health.cancelReasons.map((r) => {
                    const prev = prevReason.get(r.reason);
                    return (
                      <tr key={r.reason} className={`${TABLE.tr} text-fg`}>
                        <td className="py-1.5 pr-3">{r.reason}</td>
                        <td className="py-1.5 text-right">{r.count}</td>
                        <td className="py-1.5 text-right w-16">{fmtRate(r.share, lang, 0)}</td>
                        <td className="w-28 py-1.5 text-right text-small text-muted">{prev !== undefined ? `${vi ? 'kỳ trước' : 'prev'} ${fmtRate(prev, lang, 0)}` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-fg">{vi ? 'Lý do trả hàng/hoàn tiền' : 'Return reasons'} ({health.lifecycle.returned + health.lifecycle.refunded})</h3>
              <table className="w-full text-sm tabular">
                <tbody>
                  {health.returnReasons.map((r) => (
                    <tr key={r.reason} className={`${TABLE.tr} text-fg`}>
                      <td className="py-1.5 pr-3">{r.reason}</td>
                      <td className="py-1.5 text-right">{r.count}</td>
                      <td className="py-1.5 text-right w-16">{fmtRate(r.share, lang, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {health && health.withoutReason > 0 && <p className="mt-3 text-small text-muted">{vi ? `${health.withoutReason} đơn hủy/trả không ghi lý do.` : `${health.withoutReason} without a reason.`}</p>}
      </Section>
    </div>
  );
};

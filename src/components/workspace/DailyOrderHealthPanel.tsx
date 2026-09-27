/**
 * Order health from a daily summary report (no order lines): placed → paid, cancelled and
 * refunded counts per day. Statuses per order, reasons and per-SKU rates need an order export.
 */
import React, { useMemo } from 'react';
import { computeKpis, MIN_DAY_ORDERS, MIN_RATE_ORDERS, SMALL_RATE_NOTE, fmtCount, fmtDay, fmtMoneyCompact, fmtRate, formatRangeVi, orderHealth, PLATFORM_LABELS, stageCancellations, STAGE_BASIS, type Platform } from '../../analytics';
import { useWorkspace } from '../seller/SellerContext';
import { tr } from '../seller/ui';
import { Th } from '../analyst/ui';
import { TABLE } from '../ui/data';
import { Button, SectionCard } from '../ui/primitives';

export const DailyOrderHealthPanel: React.FC = () => {
  const { lang, dataset, range, platforms, stage, goTo } = useWorkspace();
  const vi = lang === 'vi';
  const h = useMemo(() => orderHealth(dataset, { range, platforms, stage }), [dataset, range, platforms, stage]);
  const days = h.byDate.filter((d) => d.placed > 0);
  const maxRate = Math.max(0.0001, ...days.map((d) => d.cancelRate ?? 0));
  // Cards: the canonical source (period row for the whole report period, days otherwise).
  const k = useMemo(() => computeKpis(dataset, { range, platforms, stage }).metrics, [dataset, range, platforms, stage]);
  const kPaid = useMemo(() => computeKpis(dataset, { range, platforms, stage: 'paid' }).metrics, [dataset, range, platforms]);
  const sc = useMemo(() => stageCancellations(dataset, { range, platforms, stage }), [dataset, range, platforms, stage]);
  const basis = STAGE_BASIS[stage ?? 'placed'];
  const hasStageCancels = sc.byStage.some((s) => s.cancelled !== null);
  // Days are compared with the period's cancel rate (same stage): ↑ orange when higher, ↓ green when lower.
  const avgRate = k.cancelRate.value;
  const rateTone = (r: number | null, n: number): 'high' | 'low' | null => {
    if (r === null || avgRate === null || n < MIN_RATE_ORDERS) return null;
    return r > avgRate * 1.2 ? 'high' : r < avgRate * 0.8 ? 'low' : null;
  };

  return (
    <div className="space-y-4">
      <SectionCard
        title={vi ? 'Sức khỏe đơn hàng' : 'Order health'}
        description={`${formatRangeVi(range)} · ${vi ? 'theo báo cáo tổng hợp của sàn' : 'from the platform summary report'}`}
        tools={<Button onClick={() => goTo('dataHub')}>{vi ? 'Nhập file đơn hàng' : 'Import orders'}</Button>}
        notesLabel={vi ? 'Ghi chú' : 'Notes'}
        notes={[
          vi
            ? 'Báo cáo tổng hợp không có trạng thái từng đơn, lý do hủy và hủy theo sản phẩm. Muốn biết vì sao hủy và SKU nào hủy nhiều, hãy nhập file xuất đơn hàng.'
            : 'Statuses, cancel reasons and per-SKU rates need an order export.',
          hasStageCancels
            ? vi
              ? 'Hủy theo mức đơn là ước lượng: mỗi sheet đếm đơn hủy của mức đơn đó, nên số này gợi ý đơn bị hủy ở giai đoạn nào (trước hay sau khi xác nhận / thanh toán). Báo cáo tổng hợp không có lý do hủy.'
              : 'Cancellations by stage are an estimate: each sheet counts cancellations of its own stage. The summary report has no cancel reasons.'
            : null,
        ]}
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            { l: basis[lang], v: fmtCount(k.orders.value, lang) },
            { l: vi ? 'Đơn thanh toán trong kỳ' : 'Paid in period', v: fmtCount(k.paidOrders.value, lang), sub: vi ? 'Tính theo ngày tiền về — không phải tập con của đơn đặt' : 'Counted on payment day' },
            { l: vi ? 'Đơn hủy' : 'Cancelled', v: fmtCount(k.cancelledOrders.value, lang), sub: `${vi ? 'Tỷ lệ hủy' : 'Cancel rate'} ${fmtRate(k.cancelRate.value, lang)} (${fmtCount(k.cancelledOrders.value, lang)}/${fmtCount(k.orders.value, lang)})` },
            {
              l: vi ? 'Tỷ lệ hủy theo giá trị' : 'Cancel rate by value',
              v: fmtRate(sc.valueRate, lang),
              sub: `${fmtMoneyCompact(sc.cancelledGmv, lang)} / ${fmtMoneyCompact(sc.gmv, lang)}`,
            },
            {
              l: vi ? 'Trả hàng / hoàn tiền' : 'Returns / refunds',
              v: fmtCount(k.refundedOrders.value, lang),
              sub: `${vi ? 'Tỷ lệ' : 'Rate'} ${fmtRate(k.refundRate.value, lang)} (${fmtCount(k.refundedOrders.value, lang)}/${fmtCount(k.orders.value, lang)})${
                (stage ?? 'placed') !== 'paid' && kPaid.refundRate.value !== null
                  ? ` · ${vi ? 'đơn thanh toán' : 'paid'}: ${fmtRate(kPaid.refundRate.value, lang)} (${fmtCount(kPaid.refundedOrders.value, lang)}/${fmtCount(kPaid.orders.value, lang)})`
                  : ''
              }`,
            },
          ].map((x) => (
            <div key={x.l} className="min-w-0 rounded-control border border-line bg-surface-2 p-3">
              <div className="truncate text-small text-muted">{x.l}</div>
              <div className="mt-0.5 text-xl font-bold tabular text-fg">{x.v}</div>
              {x.sub && <div className="text-small text-muted">{x.sub}</div>}
            </div>
          ))}
        </div>

        {hasStageCancels && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fg">
            <span className="text-small font-semibold text-muted">{vi ? 'Hủy theo mức đơn (ước lượng)' : 'Cancellations by order stage (estimate)'}</span>
            {sc.byStage.map((s) => (
              <span key={s.stage} className="tabular">
                <span className="text-small text-muted">{STAGE_BASIS[s.stage][lang]}:</span> <b className="font-semibold">{fmtCount(s.cancelled, lang)}</b>
              </span>
            ))}
          </div>
        )}

        <h3 className="mb-2 mt-5 text-sm font-semibold text-fg">
          {vi ? 'Tỷ lệ hủy theo ngày' : 'Cancel rate by day'}
          {avgRate !== null && (
            <span className="text-small font-normal text-muted">
              {' '}
              · {vi ? `so với trung bình kỳ ${fmtRate(avgRate, lang)} (↑ cao hơn 20%, ↓ thấp hơn 20%)` : `vs period average ${fmtRate(avgRate, lang)} (↑ 20% higher, ↓ 20% lower)`}
            </span>
          )}
        </h3>
        <div className={TABLE.frame}>
          <table className={TABLE.table}>
            <thead className={TABLE.thead}>
              <tr>
                <Th left>{vi ? 'Ngày' : 'Day'}</Th>
                <Th>{vi ? 'Đơn đặt' : 'Placed'}</Th>
                <Th>{vi ? 'Hủy' : 'Cancelled'}</Th>
                <Th>{vi ? 'Tỷ lệ hủy' : 'Cancel %'}</Th>
                <Th>{vi ? 'Doanh số hủy' : 'Cancelled sales'}</Th>
                <Th>{vi ? 'Trả/hoàn' : 'Returns'}</Th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => {
                const tone = rateTone(d.cancelRate, d.placed);
                return (
                  <tr key={d.key} className={`${TABLE.tr} ${d.placed < MIN_DAY_ORDERS ? 'text-muted' : 'text-fg'}`} title={d.placed < MIN_DAY_ORDERS ? (vi ? `Dưới ${MIN_DAY_ORDERS} đơn trong ngày` : `Fewer than ${MIN_DAY_ORDERS} orders`) : undefined}>
                    <td className={TABLE.td}>{fmtDay(d.key)}</td>
                    <td className={`${TABLE.td} text-right`}>{d.placed}</td>
                    <td className={`${TABLE.td} text-right`}>{d.cancelled}</td>
                    <td className={TABLE.td} title={d.placed < MIN_RATE_ORDERS ? tr(lang, SMALL_RATE_NOTE) : undefined}>
                      <div className={`flex items-center justify-end gap-2 ${d.placed < MIN_RATE_ORDERS ? 'opacity-60' : ''} ${tone === 'high' ? 'font-medium text-down' : tone === 'low' ? 'font-medium text-up' : ''}`}>
                        {tone && <span aria-hidden>{tone === 'high' ? '↑' : '↓'}</span>}
                        {fmtRate(d.cancelRate, lang)}
                        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                          <span className="block h-full rounded-full bg-primary" style={{ width: `${((d.cancelRate ?? 0) / maxRate) * 100}%` }} />
                        </span>
                      </div>
                    </td>
                    <td className={`${TABLE.td} text-right`}>{fmtMoneyCompact(d.cancelledGmv ?? null, lang)}</td>
                    <td className={`${TABLE.td} text-right`}>{d.returned}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {h.byPlatform.length > 1 && <p className="mt-2 text-small text-muted">{h.byPlatform.map((p) => `${PLATFORM_LABELS[p.key as Platform] ?? p.key}: ${fmtRate(p.cancelRate, lang)} hủy`).join(' · ')}</p>}
      </SectionCard>
    </div>
  );
};

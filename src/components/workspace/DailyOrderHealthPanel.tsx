/**
 * Order health from a daily summary report (no order lines): placed → paid, cancelled and
 * refunded counts per day. Statuses per order, reasons and per-SKU rates need an order export.
 */
import React, { useMemo } from 'react';
import { computeKpis, MIN_DAY_ORDERS, MIN_RATE_ORDERS, SMALL_RATE_NOTE, fmtCount, fmtDay, fmtRate, formatRangeVi, orderHealth, PLATFORM_LABELS, type Platform } from '../../analytics';
import { useWorkspace } from '../seller/SellerContext';
import { GhostButton, Section, tr } from '../seller/ui';
import { Th } from '../analyst/ui';

export const DailyOrderHealthPanel: React.FC = () => {
  const { lang, dataset, range, platforms, stage, goTo } = useWorkspace();
  const vi = lang === 'vi';
  const h = useMemo(() => orderHealth(dataset, { range, platforms, stage }), [dataset, range, platforms, stage]);
  const days = h.byDate.filter((d) => d.placed > 0);
  const maxRate = Math.max(0.0001, ...days.map((d) => d.cancelRate ?? 0));
  const placed = h.lifecycle.total;
  // "Tiền về" orders of the window — counted on the payment day, not a share of placed orders.
  const paid = useMemo(() => computeKpis(dataset, { range, platforms }).metrics.paidOrders.value, [dataset, range, platforms]);

  return (
    <div className="space-y-4">
      <Section title={vi ? 'Sức khỏe đơn hàng' : 'Order health'} subtitle={`${formatRangeVi(range)} · ${vi ? 'theo báo cáo tổng hợp của sàn' : 'from the platform summary report'}`}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {[
            { l: vi ? 'Đơn đã đặt' : 'Placed', v: fmtCount(placed, lang) },
            { l: vi ? 'Đơn thanh toán trong kỳ' : 'Paid in period', v: fmtCount(paid, lang), sub: vi ? 'Tính theo ngày tiền về — không phải tập con của đơn đặt' : 'Counted on payment day' },
            { l: vi ? 'Đơn hủy' : 'Cancelled', v: fmtCount(h.lifecycle.cancelled, lang), sub: `${vi ? 'Tỷ lệ hủy' : 'Cancel rate'} ${fmtRate(h.cancelRate, lang)}` },
            { l: vi ? 'Trả hàng / hoàn tiền' : 'Returns / refunds', v: fmtCount(h.lifecycle.refunded, lang), sub: `${vi ? 'Tỷ lệ' : 'Rate'} ${fmtRate(h.returnRate, lang)}` },
          ].map((x) => (
            <div key={x.l} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="text-[11px] text-slate-400">{x.l}</div>
              <div className="text-lg font-black text-white">{x.v}</div>
              {x.sub && <div className="text-[11px] text-slate-400">{x.sub}</div>}
            </div>
          ))}
        </div>

        <h3 className="text-xs font-bold text-slate-300 mt-4 mb-1.5">{vi ? 'Tỷ lệ hủy theo ngày' : 'Cancel rate by day'}</h3>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-xs">
            <thead className="bg-white/[0.04] text-slate-400">
              <tr>
                <Th left>{vi ? 'Ngày' : 'Day'}</Th>
                <Th>{vi ? 'Đơn đặt' : 'Placed'}</Th>
                <Th>{vi ? 'Hủy' : 'Cancelled'}</Th>
                <Th>{vi ? 'Tỷ lệ hủy' : 'Cancel %'}</Th>
                <Th>{vi ? 'Trả/hoàn' : 'Returns'}</Th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.key} className={`border-t border-white/5 ${d.placed < MIN_DAY_ORDERS ? 'text-slate-500' : 'text-slate-200'}`} title={d.placed < MIN_DAY_ORDERS ? (vi ? `Dưới ${MIN_DAY_ORDERS} đơn trong ngày` : `Fewer than ${MIN_DAY_ORDERS} orders`) : undefined}>
                  <td className="px-2.5 py-1 whitespace-nowrap">{fmtDay(d.key)}</td>
                  <td className="px-2.5 py-1 text-right">{d.placed}</td>
                  <td className="px-2.5 py-1 text-right">{d.cancelled}</td>
                  <td className="px-2.5 py-1" title={d.placed < MIN_RATE_ORDERS ? tr(lang, SMALL_RATE_NOTE) : undefined}>
                    <div className={`flex items-center justify-end gap-2 ${d.placed < MIN_RATE_ORDERS ? 'opacity-60' : ''}`}>
                      {fmtRate(d.cancelRate, lang)}
                      <span className="w-20 h-1.5 rounded bg-white/[0.06] overflow-hidden" aria-hidden>
                        <span className="block h-full bg-[#3987e5]" style={{ width: `${((d.cancelRate ?? 0) / maxRate) * 100}%` }} />
                      </span>
                    </div>
                  </td>
                  <td className="px-2.5 py-1 text-right">{d.returned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {h.byPlatform.length > 1 && (
          <p className="text-xs text-slate-400 mt-2">
            {h.byPlatform.map((p) => `${PLATFORM_LABELS[p.key as Platform] ?? p.key}: ${fmtRate(p.cancelRate, lang)} hủy`).join(' · ')}
          </p>
        )}
        <p className="text-[11px] text-slate-500 mt-3">
          {vi
            ? 'Báo cáo tổng hợp không có trạng thái từng đơn, lý do hủy và hủy theo sản phẩm. Muốn biết vì sao hủy và SKU nào hủy nhiều, hãy nhập file xuất đơn hàng.'
            : 'Statuses, cancel reasons and per-SKU rates need an order export.'}{' '}
          <GhostButton onClick={() => goTo('dataHub')} className="!py-0.5 !px-2 !text-[11px] ml-1">{vi ? 'Nhập file đơn hàng' : 'Import orders'}</GhostButton>
        </p>
      </Section>
    </div>
  );
};

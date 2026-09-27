/**
 * Order health from a daily summary report (no order lines): placed → paid, cancelled and
 * refunded counts per day. Statuses per order, reasons and per-SKU rates need an order export.
 */
import React, { useMemo } from 'react';
import { computeKpis, MIN_DAY_ORDERS, MIN_RATE_ORDERS, SMALL_RATE_NOTE, fmtCount, fmtDay, fmtMoneyCompact, fmtRate, formatRangeVi, orderHealth, PLATFORM_LABELS, stageCancellations, STAGE_BASIS, type Platform } from '../../analytics';
import { useWorkspace } from '../seller/SellerContext';
import { GhostButton, Section, tr } from '../seller/ui';
import { Th } from '../analyst/ui';

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
  // Days are coloured against the period's cancel rate (same stage).
  const avgRate = k.cancelRate.value;
  const rateColor = (r: number | null, n: number) => {
    if (r === null || avgRate === null || n < MIN_RATE_ORDERS) return '';
    return r > avgRate * 1.2 ? 'text-[#f08080]' : r < avgRate * 0.8 ? 'text-[#4ade80]' : '';
  };

  return (
    <div className="space-y-4">
      <Section title={vi ? 'Sức khỏe đơn hàng' : 'Order health'} subtitle={`${formatRangeVi(range)} · ${vi ? 'theo báo cáo tổng hợp của sàn' : 'from the platform summary report'}`}>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
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
            <div key={x.l} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="text-[11px] text-slate-400">{x.l}</div>
              <div className="text-lg font-black text-white">{x.v}</div>
              {x.sub && <div className="text-[11px] text-slate-400">{x.sub}</div>}
            </div>
          ))}
        </div>

        {sc.byStage.some((s) => s.cancelled !== null) && (
          <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="text-xs font-bold text-slate-300">{vi ? 'Hủy theo mức đơn' : 'Cancellations by order stage'}</div>
            <div className="flex flex-wrap gap-4 mt-1 text-sm text-white">
              {sc.byStage.map((s) => (
                <span key={s.stage}>
                  <span className="text-slate-400 text-xs">{STAGE_BASIS[s.stage][lang]}:</span> <b>{fmtCount(s.cancelled, lang)}</b>
                </span>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {vi
                ? 'Ước lượng: mỗi sheet đếm đơn hủy của mức đơn đó, nên số này gợi ý đơn bị hủy ở giai đoạn nào (trước hay sau khi xác nhận / thanh toán). Báo cáo tổng hợp không có lý do hủy.'
                : 'Estimate: each sheet counts cancellations of its own stage. The summary report has no cancel reasons.'}
            </p>
          </div>
        )}

        <h3 className="text-xs font-bold text-slate-300 mt-4 mb-1.5">
          {vi ? 'Tỷ lệ hủy theo ngày' : 'Cancel rate by day'}
          {avgRate !== null && <span className="font-normal text-slate-500"> · {vi ? `so với trung bình kỳ ${fmtRate(avgRate, lang)} (đỏ: cao hơn 20%, xanh: thấp hơn 20%)` : `vs period average ${fmtRate(avgRate, lang)}`}</span>}
        </h3>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-xs">
            <thead className="bg-white/[0.04] text-slate-400">
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
              {days.map((d) => (
                <tr key={d.key} className={`border-t border-white/5 ${d.placed < MIN_DAY_ORDERS ? 'text-slate-500' : 'text-slate-200'}`} title={d.placed < MIN_DAY_ORDERS ? (vi ? `Dưới ${MIN_DAY_ORDERS} đơn trong ngày` : `Fewer than ${MIN_DAY_ORDERS} orders`) : undefined}>
                  <td className="px-2.5 py-1 whitespace-nowrap">{fmtDay(d.key)}</td>
                  <td className="px-2.5 py-1 text-right">{d.placed}</td>
                  <td className="px-2.5 py-1 text-right">{d.cancelled}</td>
                  <td className="px-2.5 py-1" title={d.placed < MIN_RATE_ORDERS ? tr(lang, SMALL_RATE_NOTE) : undefined}>
                    <div className={`flex items-center justify-end gap-2 ${d.placed < MIN_RATE_ORDERS ? 'opacity-60' : ''} ${rateColor(d.cancelRate, d.placed)}`}>
                      {fmtRate(d.cancelRate, lang)}
                      <span className="w-20 h-1.5 rounded bg-white/[0.06] overflow-hidden" aria-hidden>
                        <span className="block h-full bg-[#3987e5]" style={{ width: `${((d.cancelRate ?? 0) / maxRate) * 100}%` }} />
                      </span>
                    </div>
                  </td>
                  <td className="px-2.5 py-1 text-right whitespace-nowrap">{fmtMoneyCompact(d.cancelledGmv ?? null, lang)}</td>
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

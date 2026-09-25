import React, { useEffect, useMemo } from 'react';
import { X, ListOrdered } from 'lucide-react';
import { fmtByUnit, fmtDay, fmtMoney, formatRangeVi, listEvidenceOrders, PLATFORM_LABELS, type CanonicalDataset, type Lang, type OrderStatus } from '../../analytics';
import type { EvidenceRequest } from './SellerContext';
import { tr } from './ui';

export const STATUS_LABEL: Record<OrderStatus, { vi: string; en: string }> = {
  placed: { vi: 'Chờ xác nhận', en: 'Placed' },
  paid: { vi: 'Chờ giao', en: 'To ship' },
  shipped: { vi: 'Đang giao', en: 'Shipped' },
  delivered: { vi: 'Đã giao', en: 'Delivered' },
  completed: { vi: 'Hoàn tất', en: 'Completed' },
  cancelled: { vi: 'Đã hủy', en: 'Cancelled' },
  failed_delivery: { vi: 'Giao thất bại', en: 'Failed delivery' },
  returned: { vi: 'Trả hàng', en: 'Returned' },
  refunded: { vi: 'Hoàn tiền', en: 'Refunded' },
  unknown: { vi: 'Không rõ', en: 'Unknown' },
};

const SHOW = 200;

export const EvidenceDrawer: React.FC<{ dataset: CanonicalDataset; request: EvidenceRequest | null; onClose: () => void; lang: Lang }> = ({ dataset, request, onClose, lang }) => {
  useEffect(() => {
    if (!request) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [request, onClose]);

  const data = useMemo(() => (request ? listEvidenceOrders(dataset, request.filter, SHOW) : null), [dataset, request]);
  if (!request || !data) return null;
  const vi = lang === 'vi';
  const f = request.filter;
  const chips = [
    formatRangeVi(f.range),
    ...(f.platforms?.map((p) => PLATFORM_LABELS[p]) || []),
    ...(f.skus || []),
    f.cancelledOnly ? (vi ? 'Chỉ đơn hủy' : 'Cancelled only') : null,
    f.returnedOnly ? (vi ? 'Chỉ đơn trả/hoàn' : 'Returned only') : null,
    f.liveSessionId ? `Live ${f.liveSessionId}` : null,
    f.campaignId ? `Ads ${f.campaignId}` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/60" role="dialog" aria-modal="true" aria-labelledby="evidence-title" onClick={onClose}>
      <div className="w-full max-w-3xl h-full overflow-y-auto bg-[#0b1024] border-l border-white/10 p-4 sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-sky-300 font-bold">{vi ? 'Dữ liệu chứng minh' : 'Evidence'}</div>
            <h2 id="evidence-title" className="text-lg font-black text-white mt-0.5">{request.title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10" aria-label={vi ? 'Đóng' : 'Close'}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {chips.map((c) => (
            <span key={c} className="text-[11px] px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-slate-300">{c}</span>
          ))}
        </div>

        {request.evidence && request.evidence.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
            {request.evidence.map((e, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs text-slate-400 font-semibold">{tr(lang, e.label)}</div>
                <div className="mt-1 text-sm text-white">
                  <span className="font-black">{fmtByUnit(e.current, e.unit, lang)}</span>
                  <span className="text-slate-400"> · {tr(lang, e.currentLabel)}</span>
                </div>
                {e.baseline !== undefined && e.baselineLabel && (
                  <div className="text-xs text-slate-300 mt-0.5">
                    {fmtByUnit(e.baseline, e.unit, lang)} <span className="text-slate-500">· {tr(lang, e.baselineLabel)}</span>
                  </div>
                )}
                {e.sampleSize !== undefined && <div className="text-[11px] text-slate-500 mt-1">{vi ? `Cỡ mẫu: ${e.sampleSize} đơn` : `Sample: ${e.sampleSize} orders`}</div>}
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 flex items-center gap-2 text-sm font-bold text-slate-200">
          <ListOrdered className="w-4 h-4 text-slate-400" aria-hidden />
          {vi ? `${data.total} đơn hàng liên quan` : `${data.total} related orders`}
          {data.total > SHOW && <span className="text-xs font-normal text-slate-500">({vi ? `hiển thị ${SHOW} đơn mới nhất` : `showing latest ${SHOW}`})</span>}
        </div>

        {data.total === 0 ? (
          <p className="text-sm text-slate-400 mt-2">{vi ? 'Không có đơn hàng nào khớp bộ lọc này.' : 'No orders match this filter.'}</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-xs">
              <thead className="bg-white/[0.04] text-slate-400">
                <tr>
                  <th className="text-left font-semibold px-2.5 py-2">{vi ? 'Ngày' : 'Date'}</th>
                  <th className="text-left font-semibold px-2.5 py-2">{vi ? 'Mã đơn' : 'Order'}</th>
                  <th className="text-left font-semibold px-2.5 py-2">{vi ? 'Sàn' : 'Platform'}</th>
                  <th className="text-left font-semibold px-2.5 py-2">{vi ? 'Trạng thái' : 'Status'}</th>
                  <th className="text-left font-semibold px-2.5 py-2">{vi ? 'Sản phẩm' : 'Items'}</th>
                  <th className="text-right font-semibold px-2.5 py-2">{vi ? 'Giá trị' : 'Value'}</th>
                  <th className="text-left font-semibold px-2.5 py-2">{vi ? 'Lý do' : 'Reason'}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map(({ order, lines, gross }) => (
                  <tr key={order.orderId} className="border-t border-white/5 text-slate-200">
                    <td className="px-2.5 py-1.5 whitespace-nowrap">{fmtDay(order.orderDate)}</td>
                    <td className="px-2.5 py-1.5 font-mono text-[11px]">{order.orderId}</td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">{PLATFORM_LABELS[order.platform]}</td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">{tr(lang, STATUS_LABEL[order.status])}</td>
                    <td className="px-2.5 py-1.5">{lines.map((l) => `${l.sku} ×${l.quantity}`).join(', ')}</td>
                    <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{fmtMoney(gross, lang)}</td>
                    <td className="px-2.5 py-1.5 text-slate-400">{order.cancelReason || order.returnReason || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

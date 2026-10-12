import React, { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { addDays, detectAlerts, fmtCount, fmtDay, fmtRate, formatRangeVi, orderHealth, PLATFORM_LABELS, type Platform, type RateRow } from '../../../analytics';
import { useSeller } from '../SellerContext';
import { DailyOrderHealthPanel } from '../../workspace/DailyOrderHealthPanel';
import { EvidenceButton, GhostButton, NotEnoughData, Section, SeverityBadge, tr } from '../ui';
import { CardGrid, SectionCard } from '../../ui/primitives';
import { TABLE, Th } from '../../ui/data';

export const OrdersView: React.FC = () => {
  const { lang, dataset, range, platforms, stage, asOf, openEvidence, goTo } = useSeller();
  const vi = lang === 'vi';
  const health = useMemo(() => orderHealth(dataset, { range, platforms, stage }), [dataset, range, platforms, stage]);
  const spikes = useMemo(
    () => detectAlerts(dataset, { day: addDays(asOf, -1), platforms }).filter((a) => a.type === 'sku_cancel_spike' || a.type === 'sku_refund_spike' || a.type === 'cancel_spike'),
    [dataset, asOf, platforms],
  );

  if (dataset.orders.length === 0 && dataset.dailyMetrics.length > 0) return <DailyOrderHealthPanel />;
  if (dataset.orders.length === 0) {
    return (
      <Section title={vi ? 'Đơn hàng' : 'Orders'}>
        <NotEnoughData
          lang={lang}
          reason={vi ? 'Vòng đời đơn, hủy/hoàn theo SKU và lý do cần file xuất đơn hàng.' : 'Order lifecycle analysis needs an order export.'}
          action={<GhostButton onClick={() => goTo('data')}>{vi ? 'Nhập file đơn hàng' : 'Import orders'}</GhostButton>}
        />
      </Section>
    );
  }

  const L = health.lifecycle;
  const flow = [
    { key: 'placed', vi: 'Chờ xác nhận', en: 'Placed', n: L.placed, statuses: ['placed'] as const },
    { key: 'paid', vi: 'Chờ giao', en: 'To ship', n: L.paid, statuses: ['paid'] as const },
    { key: 'shipped', vi: 'Đang giao', en: 'Shipped', n: L.shipped, statuses: ['shipped'] as const },
    { key: 'delivered', vi: 'Đã giao', en: 'Delivered', n: L.delivered, statuses: ['delivered'] as const },
    { key: 'completed', vi: 'Hoàn tất', en: 'Completed', n: L.completed, statuses: ['completed'] as const },
  ];
  const exits = [
    { key: 'cancelled', vi: 'Đã hủy', en: 'Cancelled', n: L.cancelled + L.failedDelivery, filter: { cancelledOnly: true } },
    { key: 'returned', vi: 'Trả hàng', en: 'Returned', n: L.returned, filter: { statuses: ['returned' as const] } },
    { key: 'refunded', vi: 'Hoàn tiền', en: 'Refunded', n: L.refunded, filter: { statuses: ['refunded' as const] } },
  ];
  const skuName = (sku: string) => dataset.products.find((p) => p.sku === sku)?.name || sku;
  const topSkus = health.bySku.filter((r) => r.cancelled + r.returned > 0).slice(0, 8);
  const maxDay = Math.max(1, ...health.byDate.map((d) => d.cancelled));

  const rateTable = (rows: RateRow[], label: (k: string) => string, filterFor: (k: string) => { skus?: string[]; platforms?: Platform[] }) => (
    <div className={TABLE.frame}>
      <table className={TABLE.table}>
        <thead className={TABLE.thead}>
          <tr>
            <Th left>{vi ? 'Nhóm' : 'Group'}</Th>
            <Th>{vi ? 'Đơn' : 'Orders'}</Th>
            <Th>{vi ? 'Hủy' : 'Cancelled'}</Th>
            <Th>{vi ? 'Tỷ lệ hủy' : 'Cancel %'}</Th>
            <Th>{vi ? 'Trả/hoàn' : 'Returns'}</Th>
            <Th>{vi ? 'Tỷ lệ trả/hoàn' : 'Return %'}</Th>
            <th className={TABLE.th} />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={`${TABLE.tr} text-fg`}>
              <td className={`${TABLE.td} max-w-[240px] truncate font-medium`} title={label(r.key)}>
                {label(r.key)}
              </td>
              <td className={`${TABLE.td} text-right`}>{fmtCount(r.placed, lang)}</td>
              <td className={`${TABLE.td} text-right`}>{fmtCount(r.cancelled, lang)}</td>
              <td className={`${TABLE.td} text-right font-semibold`}>{fmtRate(r.cancelRate, lang)}</td>
              <td className={`${TABLE.td} text-right`}>{fmtCount(r.returned, lang)}</td>
              <td className={`${TABLE.td} text-right`}>{fmtRate(r.returnRate, lang)}</td>
              <td className={`${TABLE.td} text-right`}>
                <EvidenceButton compact lang={lang} onClick={() => openEvidence({ title: `${vi ? 'Đơn hủy' : 'Cancelled'}: ${label(r.key)}`, filter: { range, platforms, ...filterFor(r.key), cancelledOnly: true } })} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-4">
      <Section title={vi ? 'Tình trạng đơn hàng' : 'Order lifecycle'} subtitle={`${formatRangeVi(range)}, ${fmtCount(L.total, lang)} ${vi ? 'đơn' : 'orders'}`}>
        <ol className="grid grid-cols-2 border-y border-line sm:grid-cols-3 lg:grid-cols-5" aria-label={vi ? 'Các bước của đơn hàng' : 'Order steps'}>
          {flow.map((s, i) => (
            <li key={s.key} className="relative border-line max-lg:border-b max-lg:[&:nth-last-child(-n+1)]:border-b-0 lg:border-l lg:first:border-l-0">
              <button
                type="button"
                onClick={() => openEvidence({ title: vi ? s.vi : s.en, filter: { range, platforms, statuses: [...s.statuses] } })}
                title={vi ? 'Xem các đơn ở bước này' : 'Show these orders'}
                className="flex w-full flex-col px-3 py-3 text-left hover:bg-hover lg:px-4"
              >
                <span className="text-small text-muted">{vi ? s.vi : s.en}</span>
                <span className="text-kpi text-fg">{fmtCount(s.n, lang)}</span>
              </button>
              {i < flow.length - 1 && <ChevronRight className="absolute -right-2 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 rounded-full bg-surface text-muted lg:block" aria-hidden />}
            </li>
          ))}
        </ol>
        <ul className="mt-4 grid grid-cols-3 border-y border-line" aria-label={vi ? 'Đơn không hoàn tất' : 'Exits'}>
          {exits.map((s) => (
            <li key={s.key} className="border-l border-line first:border-l-0">
              <button
                type="button"
                onClick={() => openEvidence({ title: vi ? s.vi : s.en, filter: { range, platforms, ...s.filter } })}
                title={vi ? 'Xem các đơn này' : 'Show these orders'}
                className="flex w-full flex-col px-3 py-3 text-left hover:bg-hover lg:px-4"
              >
                <span className="flex items-center gap-1.5 text-small text-muted">
                  <span className="h-2 w-2 rounded-full bg-down" aria-hidden />
                  {vi ? s.vi : s.en}
                </span>
                <span className="text-kpi text-fg">{fmtCount(s.n, lang)}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
          <span>
            {vi ? 'Tỷ lệ hủy' : 'Cancel rate'}: <b className="font-semibold tabular text-fg">{fmtRate(health.cancelRate, lang)}</b>
          </span>
          <span>
            {vi ? 'Tỷ lệ trả/hoàn' : 'Return rate'}: <b className="font-semibold tabular text-fg">{fmtRate(health.returnRate, lang)}</b>
          </span>
          <span>
            {vi ? 'Tỷ lệ hoàn tất' : 'Completion'}: <b className="font-semibold tabular text-fg">{fmtRate(health.completionRate, lang)}</b>
          </span>
        </div>
      </Section>

      {spikes.length > 0 && (
        <Section title={vi ? 'Hủy / hoàn tăng bất thường' : 'Unusual cancel/return spikes'}>
          <ul className="space-y-2.5">
            {spikes.map((a) => (
              <li key={a.id} className="rounded-control border border-line p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-semibold text-fg">{tr(lang, a.title)}</div>
                  <SeverityBadge severity={a.severity} lang={lang} />
                </div>
                <p className="mt-1 text-sm text-muted">{tr(lang, a.message)}</p>
                {a.evidence[0]?.filter && (
                  <div className="mt-2">
                    <EvidenceButton compact lang={lang} onClick={() => openEvidence({ title: tr(lang, a.title), filter: a.evidence[0].filter!, evidence: a.evidence })} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <CardGrid>
        <SectionCard
          span={6}
          title={vi ? 'Lý do hủy' : 'Cancel reasons'}
          notesLabel={vi ? 'Ghi chú' : 'Notes'}
          notes={health.withoutReason > 0 ? [vi ? `${health.withoutReason} đơn hủy/trả không ghi lý do.` : `${health.withoutReason} orders have no reason.`] : []}
        >
          {health.cancelReasons.length === 0 ? (
            <p className="text-sm text-muted">{vi ? 'File không có lý do hủy hoặc không có đơn hủy.' : 'No cancel reasons in the data.'}</p>
          ) : (
            <ul className="space-y-2.5">
              {health.cancelReasons.slice(0, 8).map((r) => (
                <li key={r.reason} className="text-sm">
                  <div className="flex justify-between text-fg">
                    <span className="truncate pr-2">{r.reason}</span>
                    <span className="whitespace-nowrap tabular text-muted">
                      {r.count} {vi ? 'đơn' : ''}, {fmtRate(r.share, lang, 0)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-surface-2">
                    <div className="h-1.5 rounded-full bg-note" style={{ width: `${Math.max(2, r.share * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {health.returnReasons.length > 0 && (
            <>
              <h3 className="mb-2 mt-5 text-sm font-semibold text-fg">{vi ? 'Lý do trả hàng/hoàn tiền' : 'Return reasons'}</h3>
              <ul className="space-y-1.5">
                {health.returnReasons.slice(0, 5).map((r) => (
                  <li key={r.reason} className="flex justify-between text-sm text-fg">
                    <span>{r.reason}</span>
                    <span className="tabular text-muted">
                      {r.count} {vi ? 'đơn' : ''}, {fmtRate(r.share, lang, 0)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </SectionCard>

        <SectionCard span={6} title={vi ? 'Đơn hủy theo ngày' : 'Cancellations by day'}>
          <ul className="max-h-72 space-y-0.5 overflow-y-auto pr-1">
            {[...health.byDate].reverse().map((d) => (
              <li key={d.key}>
                <button
                  type="button"
                  onClick={() => d.cancelled > 0 && openEvidence({ title: `${vi ? 'Đơn hủy ngày' : 'Cancelled on'} ${fmtDay(d.key)}`, filter: { range: { start: d.key, end: d.key }, platforms, cancelledOnly: true } })}
                  className="flex min-h-8 w-full items-center gap-2 rounded-control px-1 text-small text-muted hover:bg-hover hover:text-fg"
                >
                  <span className="w-11 text-left tabular">{fmtDay(d.key)}</span>
                  <span className="h-2 flex-1 rounded-full bg-surface-2">
                    <span className="block h-2 rounded-full bg-down" style={{ width: `${(d.cancelled / maxDay) * 100}%` }} />
                  </span>
                  <span className="w-28 whitespace-nowrap text-right tabular" title={vi ? `${d.cancelled} đơn hủy trên ${d.placed} đơn đặt` : undefined}>
                    {d.cancelled}/{d.placed}, {fmtRate(d.cancelRate, lang)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </SectionCard>
      </CardGrid>

      <Section title={vi ? 'Hủy/hoàn theo sản phẩm' : 'Cancels & returns by product'} subtitle={vi ? 'Sản phẩm có nhiều đơn hủy nhất' : 'Products with most cancellations'}>
        {rateTable(topSkus, skuName, (k) => ({ skus: [k] }))}
      </Section>
      <Section title={vi ? 'Hủy/hoàn theo sàn' : 'By platform'}>{rateTable(health.byPlatform, (k) => PLATFORM_LABELS[k as Platform] ?? k, (k) => ({ platforms: [k as Platform] }))}</Section>
    </div>
  );
};

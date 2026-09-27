import React, { useMemo, useState } from 'react';
import { dataNotices, FEW_BUYERS, fmtOrders, fmtPortion, CONTENT_KIND_LABELS, fmtShare, isOverFull, OVER_FULL_NOTE, fmtCount, fmtMoneyCompact, fmtRate, formatRangeVi, PLATFORM_LABELS, videoAffiliate, type ContentRow } from '../../../analytics';
import { useWorkspace } from '../../seller/SellerContext';
import { EvidenceButton, GhostButton, NotEnoughData, Section, tr } from '../../seller/ui';
import { NoticeBadge } from '../../workspace/DataNotices';
import { ChangeCell, Th } from '../ui';

export const VideoAffiliateView: React.FC = () => {
  const { lang, dataset, baseFilter, previousRange, range, openEvidence, goTo } = useWorkspace();
  const vi = lang === 'vi';
  const va = useMemo(() => videoAffiliate(dataset, baseFilter, previousRange), [dataset, baseFilter, previousRange]);
  const notices = useMemo(() => dataNotices(dataset, baseFilter.range, baseFilter.platforms).filter((n) => n.kind === 'gmv_without_orders'), [dataset, baseFilter.range, baseFilter.platforms]);
  const noticeFor = (id?: string) => notices.find((n) => n.ref.contentId === id);
  // Sortable tables (8.4): one sort per table kind.
  type SortKey = 'views' | 'clicks' | 'ctr' | 'orders' | 'buyers' | 'cvr' | 'gmv';
  const [sort, setSort] = useState<Record<'creator' | 'video', { key: SortKey; desc: boolean }>>({ creator: { key: 'gmv', desc: true }, video: { key: 'gmv', desc: true } });
  const sorted = (rows: ContentRow[], kind: 'creator' | 'video') => {
    const { key, desc } = sort[kind];
    return [...rows].sort((a, b) => ((a[key] ?? -Infinity) - (b[key] ?? -Infinity)) * (desc ? -1 : 1));
  };
  const SortTh: React.FC<{ kind: 'creator' | 'video'; k: SortKey; title?: string; children: React.ReactNode }> = ({ kind, k, title, children }) => {
    const s = sort[kind];
    const active = s.key === k;
    return (
      <th className="px-2.5 py-2 text-right font-semibold whitespace-nowrap" title={title} aria-sort={active ? (s.desc ? 'descending' : 'ascending') : 'none'}>
        <button onClick={() => setSort({ ...sort, [kind]: { key: k, desc: active ? !s.desc : true } })} className={active ? 'text-white' : ''}>
          {children}
          {active ? (s.desc ? ' ↓' : ' ↑') : ''}
        </button>
      </th>
    );
  };
  const noOrderFile = dataset.orders.length === 0;
  const fromSalesReport = dataset.sources.some((s) => s.reportType === 'shopee_sales_analysis');

  if (!va.available) {
    return (
      <Section title="Video & Affiliate">
        <NotEnoughData
          lang={lang}
          reason={vi ? 'Chưa có báo cáo affiliate / video. Nhập báo cáo Affiliate của Shopee hoặc Creators/Videos của TikTok Shop ở Data Hub.' : 'No affiliate/video report. Import one in the Data Hub.'}
          action={<GhostButton onClick={() => goTo('dataHub')}>Data Hub</GhostButton>}
        />
      </Section>
    );
  }

  const table = (all: ContentRow[], kind: 'creator' | 'video') => {
    const rows = sorted(all, kind);
    // No COGS / no order file → no profit columns (0.8), one note below the table.
    const hasProfit = rows.some((r) => r.profit !== null);
    const hasDelta = rows.some((r) => r.gmvChange.direction !== 'unknown');
    const hasCommission = rows.some((r) => r.commission !== null);
    return (
    <>
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-xs">
        <thead className="bg-white/[0.04] text-slate-400">
          <tr>
            <Th left>{kind === 'creator' ? (vi ? 'Nhà sáng tạo' : 'Creator') : 'Video'}</Th>
            <SortTh kind={kind} k="views">{vi ? 'Lượt xem' : 'Views'}</SortTh>
            <SortTh kind={kind} k="clicks">{vi ? 'Nhấp SP' : 'Clicks'}</SortTh>
            <SortTh kind={kind} k="ctr" title={vi ? 'Lượt nhấp sản phẩm ÷ lượt xem' : 'Product clicks ÷ views'}>{vi ? 'Nhấp / lượt xem' : 'Clicks / views'}</SortTh>
            <SortTh kind={kind} k="orders">{vi ? 'Đơn' : 'Orders'}</SortTh>
            <SortTh kind={kind} k="buyers">{vi ? 'Người mua' : 'Buyers'}</SortTh>
            <SortTh kind={kind} k="cvr">CVR</SortTh>
            <SortTh kind={kind} k="gmv">GMV</SortTh>
            {hasDelta && <Th>Δ GMV</Th>}
            {kind === 'creator' && hasCommission && <Th>{vi ? 'Hoa hồng' : 'Commission'}</Th>}
            {kind === 'creator' && hasCommission && <Th>{vi ? 'Tỷ lệ HH' : 'Rate'}</Th>}
            {hasProfit && <Th title={vi ? 'Lợi nhuận đóng góp của các đơn gắn với nội dung này (đã trừ hoa hồng)' : 'Contribution profit of attributed orders'}>{vi ? 'Lợi nhuận' : 'Profit'}</Th>}
            {hasProfit && <Th>Margin</Th>}
            {hasProfit && <th className="px-2.5 py-2" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const channel = kind === 'creator' ? `affiliate:${r.creatorId}` : `video:${r.contentId}`;
            return (
              <tr key={r.key} className="border-t border-white/5 text-slate-200">
                <td className="px-2.5 py-1.5 max-w-[260px]">
                  <div className="font-semibold text-white truncate">
                    {kind === 'creator' ? r.creatorId : r.title ?? r.contentId}
                    {noticeFor(kind === 'creator' ? r.creatorId : r.contentId) && <NoticeBadge level="notice" lang={lang} detail={noticeFor(kind === 'creator' ? r.creatorId : r.contentId)!.detail[lang]} />}
                    {r.buyers !== null && r.buyers > 0 && r.buyers <= FEW_BUYERS && (r.gmv ?? 0) > 0 && (
                      <span className="ml-1.5 text-[10px] font-semibold px-1 py-px rounded border border-[#fab219]/40 text-[#fab219]" title={vi ? `Chỉ ${r.buyers} người mua — doanh số phụ thuộc vào 1–2 đơn lớn` : `Only ${r.buyers} buyers`}>
                        {vi ? 'phụ thuộc 1–2 đơn lớn' : 'hinges on 1–2 orders'}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500">{PLATFORM_LABELS[r.platform]}{kind === 'video' ? ` · ${r.contentId} · ${tr(lang, CONTENT_KIND_LABELS[r.kind])}` : ''}</div>
                </td>
                <td className="px-2.5 py-1.5 text-right">{fmtCount(r.views, lang)}</td>
                <td className="px-2.5 py-1.5 text-right">{fmtCount(r.clicks, lang)}</td>
                <td className="px-2.5 py-1.5 text-right" title={isOverFull(r.ctr) ? tr(lang, OVER_FULL_NOTE) : undefined}>{fmtShare(r.ctr, lang, 2)}</td>
                <td className="px-2.5 py-1.5 text-right">{fmtOrders(r.orders, lang)}</td>
                <td className="px-2.5 py-1.5 text-right">{fmtCount(r.buyers, lang)}</td>
                <td className="px-2.5 py-1.5 text-right" title={isOverFull(r.cvr) ? tr(lang, OVER_FULL_NOTE) : undefined}>{fmtShare(r.cvr, lang, 2)}</td>
                <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{fmtMoneyCompact(r.gmv, lang)}</td>
                {hasDelta && <td className="px-2.5 py-1.5 text-right whitespace-nowrap"><ChangeCell c={r.gmvChange} lang={lang} /></td>}
                {kind === 'creator' && hasCommission && <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{fmtMoneyCompact(r.commission, lang)}</td>}
                {kind === 'creator' && hasCommission && <td className="px-2.5 py-1.5 text-right">{fmtRate(r.commissionRate, lang)}</td>}
                {hasProfit && <td className={`px-2.5 py-1.5 text-right whitespace-nowrap ${(r.profit ?? 0) < 0 ? 'text-[#f08080]' : ''}`}>{fmtMoneyCompact(r.profit, lang)}</td>}
                {hasProfit && <td className="px-2.5 py-1.5 text-right">{fmtRate(r.margin, lang)}</td>}
                {hasProfit && (
                  <td className="px-2.5 py-1.5 text-right">
                    {r.profit !== null && (
                      <EvidenceButton compact lang={lang} onClick={() => openEvidence({ title: kind === 'creator' ? r.creatorId : r.title ?? String(r.contentId), filter: { range: baseFilter.range, platforms: baseFilter.platforms, channel } })} />
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    {!hasProfit && <p className="text-[11px] text-slate-500 mt-1.5">{vi ? 'Chưa có file đơn hàng và giá vốn nên chưa tính lợi nhuận theo nội dung.' : 'No order file / COGS yet, so no profit per content.'}</p>}
    </>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {va.byKind.map((k) => (
          <div key={k.kind} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="text-[11px] text-slate-400">{tr(lang, CONTENT_KIND_LABELS[k.kind])} · {k.items} {vi ? 'mục' : 'items'}</div>
            <div className="text-lg font-black text-white">{fmtMoneyCompact(k.gmv, lang)}</div>
            <div className="text-[11px] text-slate-400">{fmtOrders(k.orders, lang)} {vi ? 'đơn' : 'orders'}{k.commission ? ` · ${vi ? 'HH' : 'comm.'} ${fmtMoneyCompact(k.commission, lang)}` : ''}</div>
            {fromSalesReport && k.channelShare !== null && (
              <div className="text-[11px] text-slate-300 mt-0.5" title={vi ? `${fmtMoneyCompact(k.gmv, lang)} / doanh số kênh ${fmtMoneyCompact(k.channelGmv, lang)}` : undefined}>
                {vi ? `Top ${k.items} · chiếm ${fmtPortion(k.channelShare, lang)} kênh` : `Top ${k.items} · ${fmtPortion(k.channelShare, lang)} of channel`}
              </div>
            )}
          </div>
        ))}
      </div>
      {dataset.sources.some((s) => s.reportType === 'shopee_sales_analysis') && (
        <p className="text-xs text-slate-300">
          {vi ? 'Số theo video và affiliate từ báo cáo Phân tích bán hàng là Top 5 video và Top 5 affiliate — Shopee không liệt kê tất cả.' : 'Videos and affiliates from the Shopee sales report are the top 5 only.'}
        </p>
      )}
      {va.notes.map((n, i) => (
        <p key={i} className="text-xs text-[#fab219]">{tr(lang, n)}</p>
      ))}
      {va.creators.length > 0 && (
        <Section title={dataset.sources.some((s) => s.reportType === 'shopee_sales_analysis') ? (vi ? 'Nhà sáng tạo / KOC (Top 5 affiliate)' : 'Creators / KOC (top 5)') : vi ? 'Nhà sáng tạo / KOC' : 'Creators / KOC'} subtitle={`${formatRangeVi(range)} · ${vi ? 'so với' : 'vs'} ${formatRangeVi(previousRange)}`}>
          {table(va.creators, 'creator')}
        </Section>
      )}
      {va.videos.length > 0 && (
        <Section
          title={fromSalesReport ? (vi ? 'Video (Top 5)' : 'Videos (top 5)') : vi ? 'Video' : 'Videos'}
          subtitle={
            va.videos.every((v) => v.kind === 'shop_video')
              ? vi ? `Cả ${va.videos.length} video đều là video của shop` : `All ${va.videos.length} are shop videos`
              : vi ? 'Video của shop và video affiliate có mã nội dung' : 'Shop and affiliate videos with a content ID'
          }
        >
          {table(va.videos, 'video')}
        </Section>
      )}
      <p className="text-[11px] text-slate-500">
        {noOrderFile
          ? vi
            ? 'Lượt xem, nhấp, số đơn và người mua lấy từ báo cáo của sàn (số đơn có thể lẻ vì sàn chia đơn cho nhiều nguồn). Chưa có file đơn hàng.'
            : 'Views, clicks, orders and buyers come from the platform report. No order file yet.'
          : vi
            ? 'Lượt xem/nhấp theo báo cáo của sàn; đơn và lợi nhuận tính từ các đơn có ghi nguồn nội dung. Hai nguồn có thể lệch nhau do cách sàn quy đổi đơn.'
            : 'Views/clicks from platform reports; orders and profit from attributed orders — the two can differ by attribution rules.'}
      </p>
    </div>
  );
};

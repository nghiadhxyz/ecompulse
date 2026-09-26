import React, { useMemo } from 'react';
import { CONTENT_KIND_LABELS, fmtShare, isOverFull, OVER_FULL_NOTE, fmtCount, fmtMoneyCompact, fmtRate, formatRangeVi, PLATFORM_LABELS, videoAffiliate, type ContentRow } from '../../../analytics';
import { useWorkspace } from '../../seller/SellerContext';
import { EvidenceButton, GhostButton, NotEnoughData, Section, tr } from '../../seller/ui';
import { ChangeCell, Th } from '../ui';

export const VideoAffiliateView: React.FC = () => {
  const { lang, dataset, baseFilter, previousRange, range, openEvidence, goTo } = useWorkspace();
  const vi = lang === 'vi';
  const va = useMemo(() => videoAffiliate(dataset, baseFilter, previousRange), [dataset, baseFilter, previousRange]);

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

  const table = (rows: ContentRow[], kind: 'creator' | 'video') => (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-xs">
        <thead className="bg-white/[0.04] text-slate-400">
          <tr>
            <Th left>{kind === 'creator' ? (vi ? 'Nhà sáng tạo' : 'Creator') : 'Video'}</Th>
            <Th>{vi ? 'Lượt xem' : 'Views'}</Th>
            <Th>{vi ? 'Nhấp SP' : 'Clicks'}</Th>
            <Th title={vi ? 'Lượt nhấp sản phẩm ÷ lượt xem' : 'Product clicks ÷ views'}>{vi ? 'Nhấp / lượt xem' : 'Clicks / views'}</Th>
            <Th>{vi ? 'Đơn' : 'Orders'}</Th>
            <Th>CVR</Th>
            <Th>GMV</Th>
            <Th>Δ GMV</Th>
            {kind === 'creator' && <Th>{vi ? 'Hoa hồng' : 'Commission'}</Th>}
            {kind === 'creator' && <Th>{vi ? 'Tỷ lệ HH' : 'Rate'}</Th>}
            <Th title={vi ? 'Lợi nhuận đóng góp của các đơn gắn với nội dung này (đã trừ hoa hồng)' : 'Contribution profit of attributed orders'}>{vi ? 'Lợi nhuận' : 'Profit'}</Th>
            <Th>Margin</Th>
            <th className="px-2.5 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const channel = kind === 'creator' ? `affiliate:${r.creatorId}` : `video:${r.contentId}`;
            return (
              <tr key={r.key} className="border-t border-white/5 text-slate-200">
                <td className="px-2.5 py-1.5 max-w-[260px]">
                  <div className="font-semibold text-white truncate">{kind === 'creator' ? r.creatorId : r.title ?? r.contentId}</div>
                  <div className="text-[11px] text-slate-500">{PLATFORM_LABELS[r.platform]}{kind === 'video' ? ` · ${r.contentId} · ${tr(lang, CONTENT_KIND_LABELS[r.kind])}` : ''}</div>
                </td>
                <td className="px-2.5 py-1.5 text-right">{fmtCount(r.views, lang)}</td>
                <td className="px-2.5 py-1.5 text-right">{fmtCount(r.clicks, lang)}</td>
                <td className="px-2.5 py-1.5 text-right" title={isOverFull(r.ctr) ? tr(lang, OVER_FULL_NOTE) : undefined}>{fmtShare(r.ctr, lang, 2)}</td>
                <td className="px-2.5 py-1.5 text-right">{fmtCount(r.orders, lang)}</td>
                <td className="px-2.5 py-1.5 text-right" title={isOverFull(r.cvr) ? tr(lang, OVER_FULL_NOTE) : undefined}>{fmtShare(r.cvr, lang, 2)}</td>
                <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{fmtMoneyCompact(r.gmv, lang)}</td>
                <td className="px-2.5 py-1.5 text-right whitespace-nowrap"><ChangeCell c={r.gmvChange} lang={lang} /></td>
                {kind === 'creator' && <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{fmtMoneyCompact(r.commission, lang)}</td>}
                {kind === 'creator' && <td className="px-2.5 py-1.5 text-right">{fmtRate(r.commissionRate, lang)}</td>}
                <td className={`px-2.5 py-1.5 text-right whitespace-nowrap ${(r.profit ?? 0) < 0 ? 'text-[#f08080]' : ''}`}>{fmtMoneyCompact(r.profit, lang)}</td>
                <td className="px-2.5 py-1.5 text-right">{fmtRate(r.margin, lang)}</td>
                <td className="px-2.5 py-1.5 text-right">
                  {r.profit !== null && (
                    <EvidenceButton compact lang={lang} onClick={() => openEvidence({ title: kind === 'creator' ? r.creatorId : r.title ?? String(r.contentId), filter: { range: baseFilter.range, platforms: baseFilter.platforms, channel } })} />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {va.byKind.map((k) => (
          <div key={k.kind} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="text-[11px] text-slate-400">{tr(lang, CONTENT_KIND_LABELS[k.kind])} · {k.items} {vi ? 'mục' : 'items'}</div>
            <div className="text-lg font-black text-white">{fmtMoneyCompact(k.gmv, lang)}</div>
            <div className="text-[11px] text-slate-400">{fmtCount(k.orders, lang)} {vi ? 'đơn' : 'orders'}{k.commission ? ` · ${vi ? 'HH' : 'comm.'} ${fmtMoneyCompact(k.commission, lang)}` : ''}</div>
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
        <Section title={dataset.sources.some((s) => s.reportType === 'shopee_sales_analysis') ? (vi ? 'Video (Top 5)' : 'Videos (top 5)') : vi ? 'Video' : 'Videos'} subtitle={vi ? 'Video của shop và video affiliate có mã nội dung' : 'Shop and affiliate videos with a content ID'}>
          {table(va.videos, 'video')}
        </Section>
      )}
      <p className="text-[11px] text-slate-500">
        {vi
          ? 'Lượt xem/nhấp theo báo cáo của sàn; đơn và lợi nhuận tính từ các đơn có ghi nguồn nội dung. Hai nguồn có thể lệch nhau do cách sàn quy đổi đơn.'
          : 'Views/clicks from platform reports; orders and profit from attributed orders — the two can differ by attribution rules.'}
      </p>
    </div>
  );
};

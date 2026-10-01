import React, { useMemo, useState } from 'react';
import { dataNotices, FEW_BUYERS, fmtOrders, fmtPortion, CONTENT_KIND_LABELS, fmtShare, isOverFull, OVER_FULL_NOTE, fmtCount, fmtMoneyCompact, fmtRate, formatRangeVi, PLATFORM_LABELS, videoAffiliate, type ContentRow } from '../../../analytics';
import { useWorkspace } from '../../seller/SellerContext';
import { EvidenceButton, GhostButton, NotEnoughData, Section, tr } from '../../seller/ui';
import { NoticeBadge } from '../../workspace/DataNotices';
import { Badge, SectionCard } from '../../ui/primitives';
import { TABLE } from '../../ui/data';
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
      <th scope="col" className={`${TABLE.th} text-right`} title={title} aria-sort={active ? (s.desc ? 'descending' : 'ascending') : 'none'}>
        <button type="button" onClick={() => setSort({ ...sort, [kind]: { key: k, desc: active ? !s.desc : true } })} className={`inline-flex min-h-8 items-center font-semibold hover:text-fg ${active ? 'text-primary' : ''}`}>
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

  const sourceNote = noOrderFile
    ? vi
      ? 'Lượt xem, nhấp, số đơn và người mua lấy từ báo cáo của sàn (số đơn có thể lẻ vì sàn chia đơn cho nhiều nguồn). Chưa có file đơn hàng.'
      : 'Views, clicks, orders and buyers come from the platform report. No order file yet.'
    : vi
      ? 'Lượt xem/nhấp theo báo cáo của sàn; đơn và lợi nhuận tính từ các đơn có ghi nguồn nội dung. Hai nguồn có thể lệch nhau do cách sàn quy đổi đơn.'
      : 'Views/clicks from platform reports; orders and profit from attributed orders — the two can differ by attribution rules.';
  // No COGS / no order file → no profit columns (0.8), one note in the card footer.
  const notesFor = (rows: ContentRow[]) => [sourceNote, rows.some((r) => r.profit !== null) ? null : vi ? 'Chưa có file đơn hàng và giá vốn nên chưa tính lợi nhuận theo nội dung.' : 'No order file / COGS yet, so no profit per content.'];

  const table = (all: ContentRow[], kind: 'creator' | 'video') => {
    const rows = sorted(all, kind);
    const hasProfit = rows.some((r) => r.profit !== null);
    const hasDelta = rows.some((r) => r.gmvChange.direction !== 'unknown');
    const hasCommission = rows.some((r) => r.commission !== null);
    return (
      <div className={TABLE.frame}>
        <table className={TABLE.table}>
          <thead className={TABLE.thead}>
            <tr>
              <Th left className="sticky left-0 z-20 bg-surface-2">{kind === 'creator' ? (vi ? 'Nhà sáng tạo' : 'Creator') : 'Video'}</Th>
              <SortTh kind={kind} k="views">{vi ? 'Lượt xem' : 'Views'}</SortTh>
              <SortTh kind={kind} k="clicks">{vi ? 'Nhấp SP' : 'Clicks'}</SortTh>
              <SortTh kind={kind} k="ctr" title={vi ? 'Lượt nhấp sản phẩm ÷ lượt xem' : 'Product clicks ÷ views'}>
                {vi ? 'Nhấp / lượt xem' : 'Clicks / views'}
              </SortTh>
              <SortTh kind={kind} k="orders">{vi ? 'Đơn' : 'Orders'}</SortTh>
              <SortTh kind={kind} k="buyers">{vi ? 'Người mua' : 'Buyers'}</SortTh>
              <SortTh kind={kind} k="cvr">CVR</SortTh>
              <SortTh kind={kind} k="gmv">GMV</SortTh>
              {hasDelta && <Th>Δ GMV</Th>}
              {kind === 'creator' && hasCommission && <Th>{vi ? 'Hoa hồng' : 'Commission'}</Th>}
              {kind === 'creator' && hasCommission && <Th>{vi ? 'Tỷ lệ HH' : 'Rate'}</Th>}
              {hasProfit && <Th title={vi ? 'Lợi nhuận đóng góp của các đơn gắn với nội dung này (đã trừ hoa hồng)' : 'Contribution profit of attributed orders'}>{vi ? 'Lợi nhuận' : 'Profit'}</Th>}
              {hasProfit && <Th>Margin</Th>}
              {hasProfit && <th className={TABLE.th} />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const channel = kind === 'creator' ? `affiliate:${r.creatorId}` : `video:${r.contentId}`;
              const name = kind === 'creator' ? r.creatorId : r.title ?? r.contentId;
              const notice = noticeFor(kind === 'creator' ? r.creatorId : r.contentId);
              return (
                <tr key={r.key} className={`${TABLE.tr} text-fg`}>
                  <td className="sticky left-0 z-10 max-w-[300px] bg-surface px-3 py-1.5">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate font-medium text-fg" title={name ?? undefined}>{name}</span>
                      {notice && <NoticeBadge level="notice" lang={lang} detail={notice.detail[lang]} />}
                      {r.buyers !== null && r.buyers > 0 && r.buyers <= FEW_BUYERS && (r.gmv ?? 0) > 0 && (
                        <Badge tone="warn" title={vi ? `Chỉ ${r.buyers} người mua — doanh số phụ thuộc vào 1–2 đơn lớn` : `Only ${r.buyers} buyers`}>
                          {vi ? 'phụ thuộc 1–2 đơn lớn' : 'hinges on 1–2 orders'}
                        </Badge>
                      )}
                    </div>
                    <div className="truncate text-small text-muted">
                      {PLATFORM_LABELS[r.platform]}
                      {kind === 'video' ? ` · ${r.contentId} · ${tr(lang, CONTENT_KIND_LABELS[r.kind])}` : ''}
                    </div>
                  </td>
                  <td className={`${TABLE.td} text-right`}>{fmtCount(r.views, lang)}</td>
                  <td className={`${TABLE.td} text-right`}>{fmtCount(r.clicks, lang)}</td>
                  <td className={`${TABLE.td} text-right`} title={isOverFull(r.ctr) ? tr(lang, OVER_FULL_NOTE) : undefined}>
                    {fmtShare(r.ctr, lang, 2)}
                  </td>
                  <td className={`${TABLE.td} text-right`}>{fmtOrders(r.orders, lang)}</td>
                  <td className={`${TABLE.td} text-right`}>{fmtCount(r.buyers, lang)}</td>
                  <td className={`${TABLE.td} text-right`} title={isOverFull(r.cvr) ? tr(lang, OVER_FULL_NOTE) : undefined}>
                    {fmtShare(r.cvr, lang, 2)}
                  </td>
                  <td className={`${TABLE.td} text-right font-semibold`}>{fmtMoneyCompact(r.gmv, lang)}</td>
                  {hasDelta && (
                    <td className={`${TABLE.td} text-right`}>
                      <ChangeCell c={r.gmvChange} lang={lang} />
                    </td>
                  )}
                  {kind === 'creator' && hasCommission && <td className={`${TABLE.td} text-right`}>{fmtMoneyCompact(r.commission, lang)}</td>}
                  {kind === 'creator' && hasCommission && <td className={`${TABLE.td} text-right`}>{fmtRate(r.commissionRate, lang)}</td>}
                  {hasProfit && <td className={`${TABLE.td} text-right ${(r.profit ?? 0) < 0 ? 'text-down' : ''}`}>{fmtMoneyCompact(r.profit, lang)}</td>}
                  {hasProfit && <td className={`${TABLE.td} text-right`}>{fmtRate(r.margin, lang)}</td>}
                  {hasProfit && (
                    <td className={`${TABLE.td} text-right`}>
                      {r.profit !== null && <EvidenceButton compact lang={lang} onClick={() => openEvidence({ title: kind === 'creator' ? r.creatorId : r.title ?? String(r.contentId), filter: { range: baseFilter.range, platforms: baseFilter.platforms, channel } })} />}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {va.byKind.map((k) => (
          <div key={k.kind} className="min-w-0 rounded-card border border-line bg-surface px-4 py-3.5 shadow-card">
            <div className="truncate text-small text-muted">
              {tr(lang, CONTENT_KIND_LABELS[k.kind])} · {k.items} {vi ? 'mục' : 'items'}
            </div>
            <div className="mt-1 text-kpi text-fg">{fmtMoneyCompact(k.gmv, lang)}</div>
            <div className="text-small tabular text-muted">
              {fmtOrders(k.orders, lang)} {vi ? 'đơn' : 'orders'}
              {k.commission ? ` · ${vi ? 'HH' : 'comm.'} ${fmtMoneyCompact(k.commission, lang)}` : ''}
            </div>
            {fromSalesReport && k.channelShare !== null && (
              <div className="mt-0.5 text-small text-muted" title={vi ? `${fmtMoneyCompact(k.gmv, lang)} / doanh số kênh ${fmtMoneyCompact(k.channelGmv, lang)}` : undefined}>
                {vi ? `Top ${k.items} · chiếm ${fmtPortion(k.channelShare, lang)} kênh` : `Top ${k.items} · ${fmtPortion(k.channelShare, lang)} of channel`}
              </div>
            )}
          </div>
        ))}
      </div>
      {fromSalesReport && <p className="text-small text-muted">{vi ? 'Số theo video và affiliate từ báo cáo Phân tích bán hàng là Top 5 video và Top 5 affiliate — Shopee không liệt kê tất cả.' : 'Videos and affiliates from the Shopee sales report are the top 5 only.'}</p>}
      {va.notes.map((n, i) => (
        <p key={i} className="rounded-control bg-warn-soft px-3 py-2 text-small text-warn">
          {tr(lang, n)}
        </p>
      ))}
      {va.creators.length > 0 && (
        <SectionCard
          title={fromSalesReport ? (vi ? 'Nhà sáng tạo / KOC (Top 5 affiliate)' : 'Creators / KOC (top 5)') : vi ? 'Nhà sáng tạo / KOC' : 'Creators / KOC'}
          description={`${formatRangeVi(range)} · ${vi ? 'so với' : 'vs'} ${formatRangeVi(previousRange)}`}
          notesLabel={vi ? 'Ghi chú' : 'Notes'}
          notes={notesFor(va.creators)}
        >
          {table(va.creators, 'creator')}
        </SectionCard>
      )}
      {va.videos.length > 0 && (
        <SectionCard
          title={fromSalesReport ? (vi ? 'Video (Top 5)' : 'Videos (top 5)') : vi ? 'Video' : 'Videos'}
          description={va.videos.every((v) => v.kind === 'shop_video') ? (vi ? `Cả ${va.videos.length} video đều là video của shop` : `All ${va.videos.length} are shop videos`) : vi ? 'Video của shop và video affiliate có mã nội dung' : 'Shop and affiliate videos with a content ID'}
          notesLabel={vi ? 'Ghi chú' : 'Notes'}
          notes={notesFor(va.videos)}
        >
          {table(va.videos, 'video')}
        </SectionCard>
      )}
    </div>
  );
};

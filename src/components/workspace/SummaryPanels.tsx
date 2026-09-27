/**
 * Panels for platform summary reports (no order lines): revenue by channel / source and
 * the Top 5 products the platform lists per channel. Shared by Seller and Analyst modes.
 */
import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { channelMix, dataNotices, fmtPortion, describeMismatch, fmtPerViewer, fmtShare, isOverFull, OVER_FULL_NOTE, fmtCount, fmtMoneyCompact, fmtOrders, fmtRate, formatRangeVi, STAGE_BASIS, summaryProducts, SUMMARY_CHANNEL_LABELS, SUMMARY_TOP_N, type SummaryChannel, type SummaryStage } from '../../analytics';
import { useWorkspace } from '../seller/SellerContext';
import { NotEnoughData, Section, tr } from '../seller/ui';
import { MismatchBox } from './MismatchBox';
import { NoticeBadge } from './DataNotices';
import { ShareBar, Th } from '../analyst/ui';

export const SUMMARY_STAGES: { key: SummaryStage; vi: string; en: string }[] = [
  { key: 'placed', vi: 'Đơn đã đặt', en: 'Placed' },
  { key: 'confirmed', vi: 'Đã xác nhận', en: 'Confirmed' },
  { key: 'paid', vi: 'Đã thanh toán', en: 'Paid' },
];

export const StagePicker: React.FC<{ stage: SummaryStage; onChange: (s: SummaryStage) => void; vi: boolean }> = ({ stage, onChange, vi }) => (
  <div className="flex gap-1" role="group" aria-label={vi ? 'Loại đơn' : 'Order stage'}>
    {SUMMARY_STAGES.map((s) => (
      <button key={s.key} onClick={() => onChange(s.key)} aria-pressed={stage === s.key} className={`px-2 py-1 rounded-lg text-xs font-semibold border ${stage === s.key ? 'bg-white/15 border-white/30 text-white' : 'border-white/10 text-slate-400'}`}>
        {vi ? s.vi : s.en}
      </button>
    ))}
  </div>
);

export const SummaryNotes: React.FC<{ notes: { vi: string; en: string }[]; lang: 'vi' | 'en' }> = ({ notes, lang }) => (
  <ul className="mt-2 space-y-0.5">
    {notes.map((n, i) => (
      <li key={i} className="text-[11px] text-slate-500">
        • {tr(lang, n)}
      </li>
    ))}
  </ul>
);

/** A rate that cannot exceed 100%: above it, "—" with the reason. */
const RateCell: React.FC<{ v: number | null; lang: 'vi' | 'en'; digits?: number; small?: boolean }> = ({ v, lang, digits = 1, small }) => (
  <td className={`px-2.5 ${small ? 'py-1' : 'py-1.5'} text-right`} title={isOverFull(v) ? tr(lang, OVER_FULL_NOTE) : undefined}>
    {fmtShare(v, lang, digits)}
  </td>
);

/**
 * Unique clicks ÷ unique viewers. On the product card both are people (a share, %); on
 * Live / Video / Affiliate the denominator is viewers, so it is clicks per viewer — never a %.
 */
const UniqueCell: React.FC<{ channel: SummaryChannel; v: number | null; lang: 'vi' | 'en'; small?: boolean }> = ({ channel, v, lang, small }) =>
  channel === 'product_card' ? (
    <RateCell v={v} lang={lang} small={small} />
  ) : (
    <td className={`px-2.5 ${small ? 'py-1' : 'py-1.5'} text-right whitespace-nowrap`}>{fmtPerViewer(v, lang)}</td>
  );

export const SummaryChannelsPanel: React.FC<{ title?: string }> = ({ title }) => {
  // Follows the app-wide order stage picker (placed by default).
  const { lang, dataset, range, platforms, stage } = useWorkspace();
  const vi = lang === 'vi';
  const [open, setOpen] = useState<string | null>(null);
  const mix = useMemo(() => channelMix(dataset, { range, platforms }, stage), [dataset, range, platforms, stage]);
  const notices = useMemo(() => dataNotices(dataset, range, platforms), [dataset, range, platforms]);
  if (!(dataset.salesSummaries?.length)) return null;
  const uniqueTitle = mix.uniqueIsDistinct
    ? vi
      ? 'Lượt nhấp duy nhất / lượt hiển thị duy nhất (theo người, cả kỳ)'
      : 'Unique clicks / unique impressions (per person, whole period)'
    : vi
      ? 'Một phần kỳ: cộng lượt duy nhất từng ngày — chỉ mang tính tham khảo'
      : 'Part of the period: sums of daily unique counts';

  return (
    <Section title={title ?? (vi ? 'Doanh thu đến từ đâu' : 'Where revenue comes from')} subtitle={vi ? `Theo kênh và nguồn truy cập · ${formatRangeVi(range)}` : `By channel and traffic source · ${formatRangeVi(range)}`} right={<span className="text-[11px] text-slate-400">{STAGE_BASIS[stage][lang]}</span>}>
      {!mix.available ? (
        <NotEnoughData lang={lang} reason={tr(lang, mix.notes[0] ?? { vi: 'Không có số liệu theo kênh trong khoảng này.', en: 'No channel data in this range.' })} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-xs">
              <thead className="bg-white/[0.04] text-slate-400">
                <tr>
                  <Th left>{vi ? 'Kênh / nguồn' : 'Channel / source'}</Th>
                  <Th>{vi ? 'Doanh số' : 'Sales'}</Th>
                  <Th>{vi ? 'Tỷ trọng' : 'Share'}</Th>
                  <Th title={vi ? 'Shopee chia một đơn cho nhiều nguồn theo mức đóng góp nên số đơn có thể lẻ' : 'Can be fractional'}>{vi ? 'Đơn' : 'Orders'}</Th>
                  <Th>{vi ? 'Lượt nhấp' : 'Clicks'}</Th>
                  <Th title={vi ? 'Đơn / lượt nhấp' : 'Orders / clicks'}>{vi ? 'Chuyển đổi' : 'Conv.'}</Th>
                  <Th title={uniqueTitle}>{vi ? 'CTR duy nhất · nhấp/người xem' : 'Unique CTR · clicks/viewer'}{mix.uniqueIsDistinct ? '' : '*'}</Th>
                </tr>
              </thead>
              <tbody>
                {mix.channels.map((c) => {
                  const expanded = open === c.channel;
                  return (
                    <React.Fragment key={c.channel}>
                      <tr className="border-t border-white/5 text-slate-100 cursor-pointer hover:bg-white/[0.03]" onClick={() => setOpen(expanded ? null : c.channel)} aria-expanded={expanded}>
                        <td className="px-2.5 py-1.5 font-semibold whitespace-nowrap">
                          {c.sources.length > 0 ? expanded ? <ChevronDown className="inline w-3.5 h-3.5 mr-1" aria-hidden /> : <ChevronRight className="inline w-3.5 h-3.5 mr-1" aria-hidden /> : <span className="inline-block w-[18px]" />}
                          {tr(lang, SUMMARY_CHANNEL_LABELS[c.channel])}
                          {notices.filter((n) => n.ref.channel === c.channel && n.kind === 'unique_clicks_over_viewers').map((n) => (
                            <NoticeBadge key={n.id} level={n.level} lang={lang} detail={n.detail[lang]} />
                          ))}
                        </td>
                        <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{fmtMoneyCompact(c.gmv, lang)}</td>
                        <td className="px-2.5 py-1.5 whitespace-nowrap"><div className="flex items-center justify-end gap-2">{fmtPortion(c.share, lang)}<ShareBar share={c.share} /></div></td>
                        <td className="px-2.5 py-1.5 text-right">{fmtOrders(c.orders, lang)}</td>
                        <td className="px-2.5 py-1.5 text-right">{fmtCount(c.clicks, lang)}</td>
                        <RateCell v={c.clicks && c.orders !== null ? c.orders / c.clicks : null} lang={lang} digits={2} />
                        <UniqueCell channel={c.channel} v={c.uniqueCtr} lang={lang} />
                      </tr>
                      {expanded &&
                        c.sources.map((s) => (
                          <tr key={s.key} className="border-t border-white/5 text-slate-300 bg-white/[0.015]">
                            <td className="px-2.5 py-1 pl-9 whitespace-nowrap">{s.key}</td>
                            <td className="px-2.5 py-1 text-right whitespace-nowrap">{fmtMoneyCompact(s.gmv, lang)}</td>
                            <td className="px-2.5 py-1 text-right text-slate-400 whitespace-nowrap">{fmtPortion(s.share, lang)} {vi ? 'của kênh' : 'of channel'}</td>
                            <td className="px-2.5 py-1 text-right">{fmtOrders(s.orders, lang)}</td>
                            <td className="px-2.5 py-1 text-right">{fmtCount(s.clicks, lang)}</td>
                            <RateCell v={s.clicks && s.orders !== null ? s.orders / s.clicks : null} lang={lang} digits={2} small />
                            <UniqueCell channel={c.channel} v={s.uniqueCtr} lang={lang} small />
                          </tr>
                        ))}
                    </React.Fragment>
                  );
                })}
                <tr className="border-t border-white/10 font-bold text-white">
                  <td className="px-2.5 py-1.5">{vi ? 'Tổng 4 kênh' : 'Total (4 channels)'}</td>
                  <td className="px-2.5 py-1.5 text-right">{fmtMoneyCompact(mix.total, lang)}</td>
                  <td colSpan={5} />
                </tr>
              </tbody>
            </table>
          </div>
          {mix.adsGmv !== null && (
            <div className="mt-2 rounded-xl border border-dashed border-white/15 px-3 py-2 text-xs text-slate-300">
              <span className="font-semibold text-white">{vi ? 'Lớp Quảng cáo Shopee (không phải kênh riêng, tổng các dòng quảng cáo): ' : 'Shopee Ads layer (not a separate channel, sum of the ad rows): '}</span>
              <b className="text-white">{fmtMoneyCompact(mix.adsGmv, lang)}</b> — <b className="text-white" title={isOverFull(mix.adsAssistedShare) ? tr(lang, OVER_FULL_NOTE) : undefined}>{fmtShare(mix.adsAssistedShare, lang)}</b> {vi ? 'doanh số có ads hỗ trợ' : 'of sales ads-assisted'} ({vi ? 'đã nằm trong 4 kênh trên' : 'already inside the 4 channels'}). {vi ? 'Xem chi phí và ROAS ở mục Quảng cáo.' : 'See spend and ROAS in Ads.'}
            </div>
          )}
          <MismatchBox items={mix.mismatches} lang={lang} />
          <SummaryNotes notes={mix.notes} lang={lang} />
        </>
      )}
    </Section>
  );
};

export const SummaryProductsPanel: React.FC = () => {
  const { lang, dataset, range, platforms } = useWorkspace();
  const vi = lang === 'vi';
  const sp = useMemo(() => summaryProducts(dataset, { range, platforms }), [dataset, range, platforms]);
  const [channel, setChannel] = useState<SummaryChannel | null>(null);
  if (!(dataset.salesSummaries?.some((r) => r.dimension === 'sku'))) return null;
  const current = sp.byChannel.find((c) => c.channel === channel) ?? sp.byChannel[0];
  // Printed rate ≠ recomputed rate, by "channel|sku|CTR" (see rateMismatches).
  const flagged = new Map(sp.mismatches.map((m) => {
    const parts = m.key.split('|');
    return [`${parts[4]}|${parts[5]}|${parts[6]}`, m] as const;
  }));
  const flag = (sku: string, what: string) => {
    const m = current ? flagged.get(`${current.channel}|${sku}|${what}`) : undefined;
    return m ? <span className="text-[#f08080] font-bold ml-0.5" title={describeMismatch(m)[lang]}>⚠</span> : null;
  };

  return (
    <Section
      title={vi ? `Top ${SUMMARY_TOP_N} sản phẩm mỗi kênh (báo cáo Shopee)` : `Top ${SUMMARY_TOP_N} products per channel (Shopee report)`}
      subtitle={sp.period ? (vi ? `Tổng cả kỳ ${formatRangeVi(sp.period)} · Shopee chỉ liệt kê ${SUMMARY_TOP_N} sản phẩm đầu mỗi kênh, không phải tất cả` : `Period ${formatRangeVi(sp.period)} · Shopee lists only the top ${SUMMARY_TOP_N}`) : undefined}
      right={
        sp.byChannel.length > 1 ? (
          <div className="flex flex-wrap gap-1" role="group" aria-label={vi ? 'Kênh' : 'Channel'}>
            {sp.byChannel.map((c) => (
              <button key={c.channel} onClick={() => setChannel(c.channel)} aria-pressed={current?.channel === c.channel} className={`px-2 py-1 rounded-lg text-xs font-semibold border ${current?.channel === c.channel ? 'bg-white/15 border-white/30 text-white' : 'border-white/10 text-slate-400'}`}>
                {tr(lang, SUMMARY_CHANNEL_LABELS[c.channel]).split(' (')[0]}
              </button>
            ))}
          </div>
        ) : undefined
      }
    >
      {!sp.available || !current ? (
        <NotEnoughData lang={lang} reason={tr(lang, sp.notes[0] ?? { vi: 'Không đủ dữ liệu.', en: 'Not enough data.' })} />
      ) : (
        <>
          <p className="text-xs text-slate-400 mb-2">
            {vi ? `Top ${current.rows.length} · ${tr(lang, SUMMARY_CHANNEL_LABELS[current.channel])} · chiếm ${fmtRate(current.coverage, lang, 0)} doanh số kênh` : `Top ${current.rows.length} · ${fmtRate(current.coverage, lang, 0)} of channel sales`}
          </p>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-xs">
              <thead className="bg-white/[0.04] text-slate-400">
                <tr>
                  <Th left>#</Th>
                  <Th left>{vi ? 'Sản phẩm' : 'Product'}</Th>
                  <Th>{vi ? 'Doanh số (đặt)' : 'Sales (placed)'}</Th>
                  <Th>{vi ? 'Đã thanh toán' : 'Paid'}</Th>
                  <Th title={vi ? 'Có thể lẻ do Shopee chia đơn theo nguồn' : 'Can be fractional'}>{vi ? 'Đơn' : 'Orders'}</Th>
                  <Th>{vi ? 'Đã bán' : 'Units'}</Th>
                  <Th>{vi ? 'Người mua' : 'Buyers'}</Th>
                  <Th>CTR</Th>
                  <Th title={vi ? 'Đơn / lượt nhấp' : 'Orders / clicks'}>{vi ? 'Chuyển đổi' : 'Conv.'}</Th>
                  <Th title={vi ? 'Lượt nhấp duy nhất / lượt hiển thị duy nhất' : 'Unique clicks / unique impressions'}>{vi ? 'CTR duy nhất' : 'Unique CTR'}</Th>
                </tr>
              </thead>
              <tbody>
                {current.rows.map((r, i) => (
                  <tr key={r.sku} className="border-t border-white/5 text-slate-200">
                    <td className="px-2.5 py-1.5 text-slate-500">{i + 1}</td>
                    <td className="px-2.5 py-1.5 max-w-[320px]">
                      <div className="truncate" title={r.name}>{r.name}</div>
                      <div className="text-[10px] text-slate-500">{r.sku}</div>
                    </td>
                    <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{fmtMoneyCompact(r.gmv, lang)}</td>
                    <td className="px-2.5 py-1.5 text-right whitespace-nowrap">
                      {r.paidGmv === null ? (
                        <span className="text-slate-500" title={vi ? 'Sản phẩm này không nằm trong Top 5 của sheet đơn đã thanh toán, nên file không có số.' : 'Not in the paid-orders Top 5, so the file has no figure.'}>
                          {vi ? 'Ngoài top 5' : 'Not in top 5'}
                        </span>
                      ) : (
                        fmtMoneyCompact(r.paidGmv, lang)
                      )}
                    </td>
                    <td className="px-2.5 py-1.5 text-right">{fmtOrders(r.orders, lang)}</td>
                    <td className="px-2.5 py-1.5 text-right">{fmtCount(r.units, lang)}</td>
                    <td className="px-2.5 py-1.5 text-right">{fmtCount(r.buyers, lang)}</td>
                    <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{fmtShare(r.ctr, lang, 2)}{flag(r.sku, 'CTR')}</td>
                    <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{fmtShare(r.cvr, lang, 2)}{flag(r.sku, 'CVR')}</td>
                    <td className="px-2.5 py-1.5 text-right">{fmtShare(r.uniqueCtr, lang, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <MismatchBox items={sp.mismatches} lang={lang} note={vi ? 'Bảng dùng số tự tính từ tử số và mẫu số.' : 'The table uses recomputed rates.'} />
          <SummaryNotes notes={sp.notes} lang={lang} />
        </>
      )}
    </Section>
  );
};

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
import { TABLE } from '../ui/data';
import { Badge } from '../ui/primitives';
import { CHANNEL_COLOR } from '../../theme/chart';

export const SUMMARY_STAGES: { key: SummaryStage; vi: string; en: string }[] = [
  { key: 'placed', vi: 'Đơn đã đặt', en: 'Placed' },
  { key: 'confirmed', vi: 'Đã xác nhận', en: 'Confirmed' },
  { key: 'paid', vi: 'Đã thanh toán', en: 'Paid' },
];

export const StagePicker: React.FC<{ stage: SummaryStage; onChange: (s: SummaryStage) => void; vi: boolean }> = ({ stage, onChange, vi }) => (
  <div className="flex gap-1" role="group" aria-label={vi ? 'Loại đơn' : 'Order stage'}>
    {SUMMARY_STAGES.map((s) => (
      <button key={s.key} onClick={() => onChange(s.key)} aria-pressed={stage === s.key} className={`px-2 py-1 rounded-lg text-xs font-semibold border ${stage === s.key ? 'bg-primary-soft border-primary/30 text-primary' : 'border-line text-muted'}`}>
        {vi ? s.vi : s.en}
      </button>
    ))}
  </div>
);

/** Long notes go in a collapsible "Ghi chú" footer, never in the body of a card. */
export const SummaryNotes: React.FC<{ notes: { vi: string; en: string }[]; lang: 'vi' | 'en' }> = ({ notes, lang }) => {
  const [open, setOpen] = useState(false);
  if (notes.length === 0) return null;
  return (
    <div className="mt-3 border-t border-line pt-1">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="inline-flex min-h-10 items-center gap-1 text-small text-muted hover:text-fg">
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        {lang === 'vi' ? 'Ghi chú' : 'Notes'} ({notes.length})
      </button>
      {open && (
        <ul className="mt-1 space-y-1">
          {notes.map((n, i) => (
            <li key={i} className="text-small text-muted">
              • {tr(lang, n)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/** A rate that cannot exceed 100%: above it, "—" with the reason. */
const RateCell: React.FC<{ v: number | null; lang: 'vi' | 'en'; digits?: number; small?: boolean }> = ({ v, lang, digits = 1, small }) => (
  <td className={`${TABLE.td} text-right`} title={isOverFull(v) ? tr(lang, OVER_FULL_NOTE) : undefined}>
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
    <td className={`${TABLE.td} text-right`}>{fmtPerViewer(v, lang)}</td>
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
    <Section title={title ?? (vi ? 'Doanh thu đến từ đâu' : 'Where revenue comes from')} subtitle={vi ? `Theo kênh và nguồn truy cập · ${formatRangeVi(range)}` : `By channel and traffic source · ${formatRangeVi(range)}`} right={<Badge>{STAGE_BASIS[stage][lang]}</Badge>}>
      {!mix.available ? (
        <NotEnoughData lang={lang} reason={tr(lang, mix.notes[0] ?? { vi: 'Không có số liệu theo kênh trong khoảng này.', en: 'No channel data in this range.' })} />
      ) : (
        <>
          <div className={TABLE.frame}>
            <table className={TABLE.table}>
              <thead className={TABLE.thead}>
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
                      <tr className={`${TABLE.tr} cursor-pointer text-fg`} onClick={() => setOpen(expanded ? null : c.channel)} aria-expanded={expanded}>
                        <td className={`${TABLE.td} font-medium`}>
                          {c.sources.length > 0 ? expanded ? <ChevronDown className="mr-1 inline h-4 w-4 text-muted" aria-hidden /> : <ChevronRight className="mr-1 inline h-4 w-4 text-muted" aria-hidden /> : <span className="inline-block w-5" />}
                          <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: CHANNEL_COLOR[c.channel].fill }} aria-hidden />
                          {tr(lang, SUMMARY_CHANNEL_LABELS[c.channel])}
                          {notices.filter((n) => n.ref.channel === c.channel && n.kind === 'unique_clicks_over_viewers').map((n) => (
                            <NoticeBadge key={n.id} level={n.level} lang={lang} detail={n.detail[lang]} />
                          ))}
                        </td>
                        <td className={`${TABLE.td} text-right`}>{fmtMoneyCompact(c.gmv, lang)}</td>
                        <td className={TABLE.td}><div className="flex items-center justify-end">{fmtPortion(c.share, lang)}<ShareBar share={c.share} channel={c.channel} /></div></td>
                        <td className={`${TABLE.td} text-right`}>{fmtOrders(c.orders, lang)}</td>
                        <td className={`${TABLE.td} text-right`}>{fmtCount(c.clicks, lang)}</td>
                        <RateCell v={c.clicks && c.orders !== null ? c.orders / c.clicks : null} lang={lang} digits={2} />
                        <UniqueCell channel={c.channel} v={c.uniqueCtr} lang={lang} />
                      </tr>
                      {expanded &&
                        c.sources.map((s) => (
                          <tr key={s.key} className={`${TABLE.tr} bg-surface-2 text-fg`}>
                            <td className={`${TABLE.td} pl-14`}>{s.key}</td>
                            <td className={`${TABLE.td} text-right`}>{fmtMoneyCompact(s.gmv, lang)}</td>
                            <td className={`${TABLE.td} text-right text-muted`}>{fmtPortion(s.share, lang)} {vi ? 'của kênh' : 'of channel'}</td>
                            <td className={`${TABLE.td} text-right`}>{fmtOrders(s.orders, lang)}</td>
                            <td className={`${TABLE.td} text-right`}>{fmtCount(s.clicks, lang)}</td>
                            <RateCell v={s.clicks && s.orders !== null ? s.orders / s.clicks : null} lang={lang} digits={2} small />
                            <UniqueCell channel={c.channel} v={s.uniqueCtr} lang={lang} small />
                          </tr>
                        ))}
                    </React.Fragment>
                  );
                })}
                <tr className="h-11 h-11 border-t border-line hover:bg-hover bg-surface-2 font-semibold text-fg">
                  <td className={TABLE.td}>{vi ? 'Tổng 4 kênh' : 'Total (4 channels)'}</td>
                  <td className={`${TABLE.td} text-right`}>{fmtMoneyCompact(mix.total, lang)}</td>
                  <td colSpan={5} />
                </tr>
              </tbody>
            </table>
          </div>
          {mix.adsGmv !== null && (
            <div className="mt-3 rounded-control border-2 border-dashed px-3 py-2 text-sm text-fg" style={{ borderColor: CHANNEL_COLOR.ads.line }}>
              <span className="font-semibold text-fg">{vi ? 'Lớp Quảng cáo Shopee (không phải kênh riêng, tổng các dòng quảng cáo): ' : 'Shopee Ads layer (not a separate channel, sum of the ad rows): '}</span>
              <b className="text-fg">{fmtMoneyCompact(mix.adsGmv, lang)}</b> — <b className="text-fg" title={isOverFull(mix.adsAssistedShare) ? tr(lang, OVER_FULL_NOTE) : undefined}>{fmtShare(mix.adsAssistedShare, lang)}</b> {vi ? 'doanh số có ads hỗ trợ' : 'of sales ads-assisted'} ({vi ? 'đã nằm trong 4 kênh trên' : 'already inside the 4 channels'}). {vi ? 'Xem chi phí và ROAS ở mục Quảng cáo.' : 'See spend and ROAS in Ads.'}
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
    return m ? <span className="text-down font-bold ml-0.5" title={describeMismatch(m)[lang]}>⚠</span> : null;
  };

  return (
    <Section
      title={vi ? `Top ${SUMMARY_TOP_N} sản phẩm mỗi kênh (báo cáo Shopee)` : `Top ${SUMMARY_TOP_N} products per channel (Shopee report)`}
      subtitle={sp.period ? (vi ? `Tổng cả kỳ ${formatRangeVi(sp.period)} · Shopee chỉ liệt kê ${SUMMARY_TOP_N} sản phẩm đầu mỗi kênh, không phải tất cả` : `Period ${formatRangeVi(sp.period)} · Shopee lists only the top ${SUMMARY_TOP_N}`) : undefined}
      right={
        sp.byChannel.length > 1 ? (
          <div className="flex flex-wrap gap-1" role="group" aria-label={vi ? 'Kênh' : 'Channel'}>
            {sp.byChannel.map((c) => (
              <button key={c.channel} onClick={() => setChannel(c.channel)} aria-pressed={current?.channel === c.channel} className={`px-2 py-1 rounded-lg text-xs font-semibold border ${current?.channel === c.channel ? 'bg-primary-soft border-primary/30 text-primary' : 'border-line text-muted'}`}>
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
          <p className="text-xs text-muted mb-2">
            {vi ? `Top ${current.rows.length} · ${tr(lang, SUMMARY_CHANNEL_LABELS[current.channel])} · chiếm ${fmtRate(current.coverage, lang, 0)} doanh số kênh` : `Top ${current.rows.length} · ${fmtRate(current.coverage, lang, 0)} of channel sales`}
          </p>
          <div className={TABLE.frame}>
            <table className={TABLE.table}>
              <thead className={TABLE.thead}>
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
                  <tr key={r.sku} className="h-11 border-t border-line hover:bg-hover text-fg">
                    <td className="px-3 text-muted">{i + 1}</td>
                    <td className="px-3 max-w-[320px]">
                      <div className="truncate" title={r.name}>{r.name}</div>
                      <div className="text-[10px] text-muted">{r.sku}</div>
                    </td>
                    <td className="px-3 text-right whitespace-nowrap">{fmtMoneyCompact(r.gmv, lang)}</td>
                    <td className="px-3 text-right whitespace-nowrap">
                      {r.paidGmv === null ? (
                        <span className="text-muted" title={vi ? 'Sản phẩm này không nằm trong Top 5 của sheet đơn đã thanh toán, nên file không có số.' : 'Not in the paid-orders Top 5, so the file has no figure.'}>
                          {vi ? 'Ngoài top 5' : 'Not in top 5'}
                        </span>
                      ) : (
                        fmtMoneyCompact(r.paidGmv, lang)
                      )}
                    </td>
                    <td className="px-3 text-right">{fmtOrders(r.orders, lang)}</td>
                    <td className="px-3 text-right">{fmtCount(r.units, lang)}</td>
                    <td className="px-3 text-right">{fmtCount(r.buyers, lang)}</td>
                    <td className="px-3 text-right whitespace-nowrap">{fmtShare(r.ctr, lang, 2)}{flag(r.sku, 'CTR')}</td>
                    <td className="px-3 text-right whitespace-nowrap">{fmtShare(r.cvr, lang, 2)}{flag(r.sku, 'CVR')}</td>
                    <td className="px-3 text-right">{fmtShare(r.uniqueCtr, lang, 1)}</td>
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

/**
 * Panels for platform summary reports (no order lines): revenue by channel / source and
 * the top products the platform lists. Shared by Seller and Analyst modes.
 */
import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { channelMix, fmtCount, fmtMoneyCompact, fmtRate, formatRangeVi, summaryProducts, SUMMARY_CHANNEL_LABELS, type SummaryStage } from '../../analytics';
import { useWorkspace } from '../seller/SellerContext';
import { NotEnoughData, Section, tr } from '../seller/ui';
import { ShareBar, Th } from '../analyst/ui';

const STAGES: { key: SummaryStage; vi: string; en: string }[] = [
  { key: 'placed', vi: 'Đơn đã đặt', en: 'Placed' },
  { key: 'confirmed', vi: 'Đã xác nhận', en: 'Confirmed' },
  { key: 'paid', vi: 'Đã thanh toán', en: 'Paid' },
];

export const SummaryChannelsPanel: React.FC<{ title?: string }> = ({ title }) => {
  const { lang, dataset, range, platforms } = useWorkspace();
  const vi = lang === 'vi';
  const [stage, setStage] = useState<SummaryStage>('placed');
  const [open, setOpen] = useState<string | null>(null);
  const mix = useMemo(() => channelMix(dataset, { range, platforms }, stage), [dataset, range, platforms, stage]);
  if (!(dataset.salesSummaries?.length)) return null;

  return (
    <Section
      title={title ?? (vi ? 'Doanh thu đến từ đâu' : 'Where revenue comes from')}
      subtitle={vi ? `Theo kênh và nguồn truy cập · ${formatRangeVi(range)}` : `By channel and traffic source · ${formatRangeVi(range)}`}
      right={
        <div className="flex gap-1" role="group" aria-label={vi ? 'Loại đơn' : 'Order stage'}>
          {STAGES.map((s) => (
            <button key={s.key} onClick={() => setStage(s.key)} aria-pressed={stage === s.key} className={`px-2 py-1 rounded-lg text-xs font-semibold border ${stage === s.key ? 'bg-white/15 border-white/30 text-white' : 'border-white/10 text-slate-400'}`}>
              {vi ? s.vi : s.en}
            </button>
          ))}
        </div>
      }
    >
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
                  <Th title={vi ? 'Shopee có thể chia một đơn cho nhiều nguồn nên số đơn có thể lẻ' : 'Can be fractional'}>{vi ? 'Đơn' : 'Orders'}</Th>
                  <Th>{vi ? 'Lượt nhấp' : 'Clicks'}</Th>
                  <Th title={vi ? 'Đơn / lượt nhấp' : 'Orders / clicks'}>{vi ? 'Chuyển đổi' : 'Conv.'}</Th>
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
                        </td>
                        <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{fmtMoneyCompact(c.gmv, lang)}</td>
                        <td className="px-2.5 py-1.5 whitespace-nowrap"><div className="flex items-center justify-end gap-2">{fmtRate(c.share, lang)}<ShareBar share={c.share} /></div></td>
                        <td className="px-2.5 py-1.5 text-right">{c.orders === null ? '—' : fmtCount(Math.round(c.orders), lang)}</td>
                        <td className="px-2.5 py-1.5 text-right">{fmtCount(c.clicks, lang)}</td>
                        <td className="px-2.5 py-1.5 text-right">{c.clicks && c.orders !== null ? fmtRate(c.orders / c.clicks, lang, 2) : '—'}</td>
                      </tr>
                      {expanded &&
                        c.sources.map((s) => (
                          <tr key={s.key} className="border-t border-white/5 text-slate-300 bg-white/[0.015]">
                            <td className="px-2.5 py-1 pl-9 whitespace-nowrap">{s.key}</td>
                            <td className="px-2.5 py-1 text-right whitespace-nowrap">{fmtMoneyCompact(s.gmv, lang)}</td>
                            <td className="px-2.5 py-1 text-right text-slate-400 whitespace-nowrap">{fmtRate(s.share, lang)} {vi ? 'của kênh' : 'of channel'}</td>
                            <td className="px-2.5 py-1 text-right">{s.orders === null ? '—' : fmtCount(Math.round(s.orders), lang)}</td>
                            <td className="px-2.5 py-1 text-right">{fmtCount(s.clicks, lang)}</td>
                            <td className="px-2.5 py-1 text-right">{s.clicks && s.orders !== null ? fmtRate(s.orders / s.clicks, lang, 2) : '—'}</td>
                          </tr>
                        ))}
                    </React.Fragment>
                  );
                })}
                <tr className="border-t border-white/10 font-bold text-white">
                  <td className="px-2.5 py-1.5">{vi ? 'Tổng' : 'Total'}</td>
                  <td className="px-2.5 py-1.5 text-right">{fmtMoneyCompact(mix.total, lang)}</td>
                  <td colSpan={4} />
                </tr>
              </tbody>
            </table>
          </div>
          {mix.adsGmv !== null && (
            <p className="text-xs text-slate-300 mt-2">
              {vi ? 'Trong đó doanh số có tham gia Quảng cáo Shopee: ' : 'Of which with Shopee Ads involved: '}
              <b className="text-white">{fmtMoneyCompact(mix.adsGmv, lang)}</b> ({fmtRate(mix.total ? mix.adsGmv / mix.total : null, lang)}) — {vi ? 'xem chi phí và ROAS ở mục Quảng cáo.' : 'see spend and ROAS in Ads.'}
            </p>
          )}
          <ul className="mt-2 space-y-0.5">
            {mix.notes.map((n, i) => (
              <li key={i} className="text-[11px] text-slate-500">• {tr(lang, n)}</li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
};

export const SummaryProductsPanel: React.FC = () => {
  const { lang, dataset, range, platforms } = useWorkspace();
  const vi = lang === 'vi';
  const sp = useMemo(() => summaryProducts(dataset, { range, platforms }), [dataset, range, platforms]);
  if (!(dataset.salesSummaries?.some((r) => r.dimension === 'sku'))) return null;

  return (
    <Section
      title={vi ? 'Sản phẩm đứng đầu (báo cáo Shopee)' : 'Top products (Shopee report)'}
      subtitle={sp.period ? (vi ? `Tổng cả kỳ ${formatRangeVi(sp.period)}` : `Period ${formatRangeVi(sp.period)}`) : undefined}
    >
      {!sp.available ? (
        <NotEnoughData lang={lang} reason={tr(lang, sp.notes[0] ?? { vi: 'Không đủ dữ liệu.', en: 'Not enough data.' })} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-xs">
              <thead className="bg-white/[0.04] text-slate-400">
                <tr>
                  <Th left>{vi ? 'Sản phẩm' : 'Product'}</Th>
                  <Th>{vi ? 'Doanh số (đặt)' : 'Sales (placed)'}</Th>
                  <Th>{vi ? 'Đã thanh toán' : 'Paid'}</Th>
                  <Th>{vi ? 'Đã bán' : 'Units'}</Th>
                  <Th>{vi ? 'Người mua' : 'Buyers'}</Th>
                  <Th>{vi ? 'Lượt xem' : 'Impr.'}</Th>
                  <Th>CTR</Th>
                  <Th title={vi ? 'Đơn / lượt nhấp trên thẻ sản phẩm' : 'Orders / clicks on product card'}>{vi ? 'Chuyển đổi' : 'Conv.'}</Th>
                  <Th left>{vi ? 'Kênh chính' : 'Main channel'}</Th>
                </tr>
              </thead>
              <tbody>
                {sp.rows.map((r) => {
                  const main = Object.entries(r.byChannel).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0];
                  return (
                    <tr key={r.sku} className="border-t border-white/5 text-slate-200">
                      <td className="px-2.5 py-1.5 max-w-[320px]">
                        <div className="truncate" title={r.name}>{r.name}</div>
                        <div className="text-[10px] text-slate-500">{r.sku}</div>
                      </td>
                      <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{fmtMoneyCompact(r.gmv, lang)}</td>
                      <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{fmtMoneyCompact(r.paidGmv, lang)}</td>
                      <td className="px-2.5 py-1.5 text-right">{fmtCount(r.units, lang)}</td>
                      <td className="px-2.5 py-1.5 text-right">{fmtCount(r.buyers, lang)}</td>
                      <td className="px-2.5 py-1.5 text-right">{fmtCount(r.impressions, lang)}</td>
                      <td className="px-2.5 py-1.5 text-right">{fmtRate(r.ctr, lang, 2)}</td>
                      <td className="px-2.5 py-1.5 text-right">{fmtRate(r.cvr, lang, 2)}</td>
                      <td className="px-2.5 py-1.5 whitespace-nowrap text-slate-400">{main ? `${tr(lang, SUMMARY_CHANNEL_LABELS[main[0] as keyof typeof SUMMARY_CHANNEL_LABELS])} (${fmtRate(r.gmv ? (main[1] ?? 0) / r.gmv : null, lang, 0)})` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ul className="mt-2 space-y-0.5">
            {sp.notes.map((n, i) => (
              <li key={i} className="text-[11px] text-slate-500">• {tr(lang, n)}</li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
};

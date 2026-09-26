import React, { useMemo, useState } from 'react';
import { ChevronDown, Radio } from 'lucide-react';
import {
  adsSummary,
  fmtChange,
  fmtCount,
  fmtDay,
  sessionDateLabel,
  fmtMoneyCompact,
  fmtMultiple,
  fmtRate,
  formatRangeVi,
  liveSessions,
  PLATFORM_LABELS,
  type AdCampaignRow,
} from '../../../analytics';
import { useSeller } from '../SellerContext';
import { EvidenceButton, GhostButton, HelpTip, NotEnoughData, Section } from '../ui';

export const AdsLiveView: React.FC = () => {
  const { lang, dataset, range, platforms, openEvidence, goTo } = useSeller();
  const vi = lang === 'vi';
  const ads = useMemo(() => adsSummary(dataset, { range, platforms }), [dataset, range, platforms]);
  const lives = useMemo(() => liveSessions(dataset, { range, platforms }), [dataset, range, platforms]);
  const [advanced, setAdvanced] = useState(false);

  const profitCell = (r: Pick<AdCampaignRow, 'estimatedProfitAfterAds' | 'profitNote' | 'marginIsPartial'>) =>
    r.estimatedProfitAfterAds === null ? (
      <span className="text-slate-500" title={r.profitNote?.[lang]}>{vi ? 'Không đủ dữ liệu' : 'Not enough data'}</span>
    ) : (
      <span className={`font-bold ${r.estimatedProfitAfterAds < 0 ? 'text-[#f08080]' : 'text-[#4ade80]'}`}>
        {fmtMoneyCompact(r.estimatedProfitAfterAds, lang)}
        {r.marginIsPartial && <span className="text-[10px] text-[#fab219] font-normal"> *</span>}
      </span>
    );

  return (
    <div className="space-y-4">
      <Section
        title={vi ? 'Quảng cáo' : 'Ads'}
        subtitle={formatRangeVi(range)}
        right={
          ads.available && (
            <button onClick={() => setAdvanced((a) => !a)} aria-expanded={advanced} className="text-xs text-sky-300 inline-flex items-center gap-1">
              {vi ? 'Chỉ số nâng cao' : 'Advanced metrics'} <ChevronDown className={`w-3.5 h-3.5 transition-transform ${advanced ? 'rotate-180' : ''}`} />
            </button>
          )
        }
      >
        {!ads.available ? (
          <NotEnoughData
            lang={lang}
            reason={vi ? 'Chưa có báo cáo quảng cáo. Nếu shop không chạy quảng cáo, hãy xác nhận trong Cài đặt để lợi nhuận được tính đủ.' : 'No ads report. If you run no ads, confirm it in Settings.'}
            action={<GhostButton onClick={() => goTo('settings')}>{vi ? 'Mở Cài đặt' : 'Open Settings'}</GhostButton>}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
              {[
                { l: vi ? 'Chi phí Ads' : 'Ad spend', v: fmtMoneyCompact(ads.totals.spend, lang) },
                { l: vi ? 'Doanh thu từ Ads' : 'Attributed revenue', v: fmtMoneyCompact(ads.totals.attributedRevenue, lang) },
                { l: vi ? 'Đơn từ Ads' : 'Orders', v: fmtCount(ads.totals.orders, lang) },
                { l: 'ROAS', v: fmtMultiple(ads.totals.roas, lang) },
                { l: vi ? 'Lợi nhuận sau Ads (ước tính)' : 'Est. profit after ads', v: ads.totals.estimatedProfitAfterAds === null ? (vi ? 'Không đủ dữ liệu' : 'N/A') : fmtMoneyCompact(ads.totals.estimatedProfitAfterAds, lang), bad: (ads.totals.estimatedProfitAfterAds ?? 0) < 0 },
              ].map((x) => (
                <div key={x.l} className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                  <div className="text-[11px] text-slate-400">{x.l}</div>
                  <div className={`text-base font-black ${x.bad ? 'text-[#f08080]' : 'text-white'}`}>{x.v}</div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mb-2 flex items-center gap-1">
              {vi ? 'ROAS cao chưa chắc có lời — so với "ROAS hòa vốn" (mức tối thiểu để không lỗ sau giá vốn và phí).' : 'High ROAS is not profit — compare with break-even ROAS.'}
              <HelpTip text={vi ? 'ROAS hòa vốn = 1 ÷ biên lợi nhuận trước quảng cáo của sản phẩm' : 'Break-even ROAS = 1 ÷ margin before ads'} />
            </p>
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-xs">
                <thead className="bg-white/[0.04] text-slate-400">
                  <tr>
                    <th className="text-left font-semibold px-2.5 py-2">{vi ? 'Chiến dịch' : 'Campaign'}</th>
                    <th className="text-right font-semibold px-2.5 py-2">{vi ? 'Chi phí' : 'Spend'}</th>
                    <th className="text-right font-semibold px-2.5 py-2">{vi ? 'Doanh thu' : 'Revenue'}</th>
                    <th className="text-right font-semibold px-2.5 py-2">{vi ? 'Đơn' : 'Orders'}</th>
                    <th className="text-right font-semibold px-2.5 py-2">ROAS</th>
                    <th className="text-right font-semibold px-2.5 py-2">{vi ? 'ROAS hòa vốn' : 'Break-even'}</th>
                    <th className="text-right font-semibold px-2.5 py-2">{vi ? 'Lời sau Ads' : 'Profit after ads'}</th>
                    {advanced && ['Impr.', 'Clicks', 'CTR', 'CPC', 'CVR', 'CPA'].map((h) => <th key={h} className="text-right font-semibold px-2.5 py-2">{h}</th>)}
                    <th className="px-2.5 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {ads.rows.map((r) => (
                    <tr key={r.key} className="border-t border-white/5 text-slate-200">
                      <td className="px-2.5 py-2 max-w-[240px]">
                        <div className="font-semibold text-white truncate">{r.name}</div>
                        <div className="text-[11px] text-slate-500">{PLATFORM_LABELS[r.platform]}{r.sku ? ` · ${r.sku}` : ''}</div>
                      </td>
                      <td className="px-2.5 py-2 text-right">{fmtMoneyCompact(r.spend, lang)}</td>
                      <td className="px-2.5 py-2 text-right">{fmtMoneyCompact(r.attributedRevenue, lang)}</td>
                      <td className="px-2.5 py-2 text-right">{fmtCount(r.orders, lang)}</td>
                      <td className={`px-2.5 py-2 text-right font-semibold ${r.roas !== null && r.breakEvenRoas !== null ? (r.roas < r.breakEvenRoas ? 'text-[#f08080]' : 'text-[#4ade80]') : ''}`}>{fmtMultiple(r.roas, lang)}</td>
                      <td className="px-2.5 py-2 text-right text-slate-400">{fmtMultiple(r.breakEvenRoas, lang)}</td>
                      <td className="px-2.5 py-2 text-right">{profitCell(r)}</td>
                      {advanced && (
                        <>
                          <td className="px-2.5 py-2 text-right">{fmtCount(r.impressions, lang)}</td>
                          <td className="px-2.5 py-2 text-right">{fmtCount(r.clicks, lang)}</td>
                          <td className="px-2.5 py-2 text-right">{fmtRate(r.ctr, lang, 2)}</td>
                          <td className="px-2.5 py-2 text-right">{fmtMoneyCompact(r.cpc, lang)}</td>
                          <td className="px-2.5 py-2 text-right">{fmtRate(r.cvr, lang, 2)}</td>
                          <td className="px-2.5 py-2 text-right">{fmtMoneyCompact(r.cpa, lang)}</td>
                        </>
                      )}
                      <td className="px-2.5 py-2 text-right">
                        <EvidenceButton compact lang={lang} onClick={() => openEvidence({ title: r.name, filter: { range, platforms, campaignId: r.key.split('|')[1] } })} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {ads.rows.some((r) => r.marginIsPartial) && (
              <p className="text-[11px] text-[#fab219] mt-2">* {vi ? 'Ước tính chưa đầy đủ vì thiếu một số chi phí (phí sàn/vận chuyển).' : 'Partial estimate: some costs are missing.'}</p>
            )}
          </>
        )}
      </Section>

      <Section title={vi ? 'Livestream' : 'Livestream'} subtitle={formatRangeVi(range)}>
        {lives.length === 0 ? (
          <NotEnoughData lang={lang} reason={vi ? 'Chưa có dữ liệu phiên live có ngày diễn ra trong khoảng này.' : 'No dated live sessions in this range.'} />
        ) : (
          <ul className="space-y-2.5">
            {lives.map((r) => {
              const s = r.session;
              return (
                <li key={s.sessionId} className={`rounded-xl border p-3 ${r.viewersUpOrdersDown ? 'border-[#fab219]/40 bg-[#fab219]/[0.05]' : 'border-white/10 bg-white/[0.02]'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5 text-rose-300" aria-hidden />
                        {sessionDateLabel(s, lang)} · {PLATFORM_LABELS[s.platform]}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">{s.title}{r.durationHours ? ` · ${r.durationHours.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US', { maximumFractionDigits: 1 })}h` : ''}</div>
                    </div>
                    <EvidenceButton compact lang={lang} onClick={() => openEvidence({ title: `Live ${sessionDateLabel(s, lang)} · ${PLATFORM_LABELS[s.platform]}`, filter: { range: { start: s.periodStart ?? s.date, end: s.date }, liveSessionId: s.sessionId } })} />
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2 mt-2 text-xs">
                    {[
                      { l: vi ? 'Người xem' : 'Viewers', v: fmtCount(s.viewers, lang), d: r.viewersChange },
                      { l: vi ? 'Nhấp SP' : 'Clicks', v: fmtCount(s.productClicks, lang) },
                      { l: vi ? 'Đơn' : 'Orders', v: fmtCount(s.orders, lang), d: r.ordersChange },
                      { l: vi ? 'Đã TT' : 'Paid', v: fmtCount(s.paidOrders, lang) },
                      { l: vi ? 'Hủy' : 'Cancelled', v: fmtCount(s.cancelledOrders, lang) },
                      { l: 'GMV', v: fmtMoneyCompact(s.gmv, lang) },
                      { l: 'GMV/h', v: fmtMoneyCompact(r.gmvPerHour, lang) },
                      { l: vi ? 'Chuyển đổi' : 'Conversion', v: fmtRate(r.conversion, lang, 2) },
                      { l: vi ? 'Lợi nhuận ƯT' : 'Est. profit', v: r.estimatedProfit === null ? '—' : `${fmtMoneyCompact(r.estimatedProfit, lang)}${r.profitComplete ? '' : '*'}` },
                    ].map((x) => (
                      <div key={x.l}>
                        <div className="text-slate-500">{x.l}</div>
                        <div className="text-white font-semibold">{x.v}</div>
                        {x.d !== undefined && x.d !== null && <div className={`text-[10px] ${x.d >= 0 ? 'text-[#4ade80]' : 'text-[#f08080]'}`}>{fmtChange(x.d, lang)}</div>}
                      </div>
                    ))}
                  </div>
                  {r.previous && (
                    <p className="text-[11px] text-slate-400 mt-2">
                      {vi ? `So với phiên trước (${fmtDay(r.previous.date)}): ${r.previous.viewers ?? '—'} người xem, ${r.previous.orders ?? '—'} đơn.` : `Previous session (${fmtDay(r.previous.date)}): ${r.previous.viewers ?? '—'} viewers, ${r.previous.orders ?? '—'} orders.`}
                      {r.viewersUpOrdersDown && <b className="text-[#fab219]"> {vi ? 'Người xem tăng nhưng đơn giảm — cần kiểm tra.' : 'More viewers but fewer orders — worth checking.'}</b>}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
};

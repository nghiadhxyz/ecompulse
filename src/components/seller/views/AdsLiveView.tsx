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
import { ChannelWeekdayPanel } from '../../workspace/SummaryInsightPanels';
import { Button, SectionCard } from '../../ui/primitives';
import { TABLE, Th } from '../../ui/data';
import { CHANNEL_COLOR } from '../../../theme/chart';

export const AdsLiveView: React.FC = () => {
  const { lang, dataset, range, platforms, openEvidence, goTo } = useSeller();
  const vi = lang === 'vi';
  const ads = useMemo(() => adsSummary(dataset, { range, platforms }), [dataset, range, platforms]);
  const lives = useMemo(() => liveSessions(dataset, { range, platforms }), [dataset, range, platforms]);
  const [advanced, setAdvanced] = useState(false);

  const profitCell = (r: Pick<AdCampaignRow, 'estimatedProfitAfterAds' | 'profitNote' | 'marginIsPartial'>) =>
    r.estimatedProfitAfterAds === null ? (
      <span className="text-muted" title={r.profitNote?.[lang]}>
        {vi ? 'Không đủ dữ liệu' : 'Not enough data'}
      </span>
    ) : (
      <span className={`font-semibold ${r.estimatedProfitAfterAds < 0 ? 'text-down' : 'text-up'}`}>
        {fmtMoneyCompact(r.estimatedProfitAfterAds, lang)}
        {r.marginIsPartial && <span className="font-normal text-warn"> *</span>}
      </span>
    );

  return (
    <div className="space-y-4">
      <SectionCard
        title={vi ? 'Quảng cáo' : 'Ads'}
        description={formatRangeVi(range)}
        tools={
          ads.available && (
            <Button variant="ghost" onClick={() => setAdvanced((a) => !a)} aria-expanded={advanced}>
              {vi ? 'Chỉ số nâng cao' : 'Advanced metrics'} <ChevronDown className={`h-4 w-4 transition-transform ${advanced ? 'rotate-180' : ''}`} aria-hidden />
            </Button>
          )
        }
        notesLabel={vi ? 'Ghi chú' : 'Notes'}
        notes={ads.available && ads.rows.some((r) => r.marginIsPartial) ? [`* ${vi ? 'Ước tính chưa đầy đủ vì thiếu một số chi phí (phí sàn/vận chuyển).' : 'Partial estimate: some costs are missing.'}`] : []}
      >
        {!ads.available ? (
          <NotEnoughData
            lang={lang}
            reason={vi ? 'Chưa có báo cáo quảng cáo. Nếu shop không chạy quảng cáo, hãy xác nhận trong Cài đặt để lợi nhuận được tính đủ.' : 'No ads report. If you run no ads, confirm it in Settings.'}
            action={<GhostButton onClick={() => goTo('settings')}>{vi ? 'Mở Cài đặt' : 'Open Settings'}</GhostButton>}
          />
        ) : (
          <>
            <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                { l: vi ? 'Chi phí Ads' : 'Ad spend', v: fmtMoneyCompact(ads.totals.spend, lang) },
                { l: vi ? 'Doanh thu từ Ads' : 'Attributed revenue', v: fmtMoneyCompact(ads.totals.attributedRevenue, lang) },
                { l: vi ? 'Đơn từ Ads' : 'Orders', v: fmtCount(ads.totals.orders, lang) },
                { l: 'ROAS', v: fmtMultiple(ads.totals.roas, lang) },
                { l: vi ? 'Lợi nhuận sau Ads (ước tính)' : 'Est. profit after ads', v: ads.totals.estimatedProfitAfterAds === null ? (vi ? 'Không đủ dữ liệu' : 'N/A') : fmtMoneyCompact(ads.totals.estimatedProfitAfterAds, lang), bad: (ads.totals.estimatedProfitAfterAds ?? 0) < 0 },
              ].map((x) => (
                <div key={x.l} className="min-w-0 rounded-control border border-line bg-surface-2 p-3">
                  <div className="truncate text-small text-muted" title={x.l}>{x.l}</div>
                  <div className={`mt-0.5 text-xl font-bold tabular ${x.bad ? 'text-down' : 'text-fg'}`}>{x.v}</div>
                </div>
              ))}
            </div>
            <p className="mb-3 flex items-center gap-1 text-small text-muted">
              {vi ? 'ROAS cao chưa chắc có lời — so với "ROAS hòa vốn" (mức tối thiểu để không lỗ sau giá vốn và phí).' : 'High ROAS is not profit — compare with break-even ROAS.'}
              <HelpTip text={vi ? 'ROAS hòa vốn = 1 ÷ biên lợi nhuận trước quảng cáo của sản phẩm' : 'Break-even ROAS = 1 ÷ margin before ads'} />
            </p>
            <div className={TABLE.frame}>
              <table className={TABLE.table}>
                <thead className={TABLE.thead}>
                  <tr>
                    <Th left className="sticky left-0 z-20 bg-surface-2">{vi ? 'Chiến dịch' : 'Campaign'}</Th>
                    <Th>{vi ? 'Chi phí' : 'Spend'}</Th>
                    <Th>{vi ? 'Doanh thu' : 'Revenue'}</Th>
                    <Th>{vi ? 'Đơn' : 'Orders'}</Th>
                    <Th>ROAS</Th>
                    <Th>{vi ? 'ROAS hòa vốn' : 'Break-even'}</Th>
                    <Th>{vi ? 'Lời sau Ads' : 'Profit after ads'}</Th>
                    {advanced && ['Impr.', 'Clicks', 'CTR', 'CPC', 'CVR', 'CPA'].map((h) => <Th key={h}>{h}</Th>)}
                    <th className={TABLE.th} />
                  </tr>
                </thead>
                <tbody>
                  {ads.rows.map((r) => {
                    const below = r.roas !== null && r.breakEvenRoas !== null ? r.roas < r.breakEvenRoas : null;
                    return (
                      <tr key={r.key} className={`${TABLE.tr} text-fg`}>
                        <td className="sticky left-0 z-10 max-w-[240px] bg-surface px-3 py-1.5" title={r.name}>
                          <div className="truncate font-medium text-fg">{r.name}</div>
                          <div className="text-small text-muted">
                            {PLATFORM_LABELS[r.platform]}
                            {r.sku ? ` · ${r.sku}` : ''}
                          </div>
                        </td>
                        <td className={`${TABLE.td} text-right`}>{fmtMoneyCompact(r.spend, lang)}</td>
                        <td className={`${TABLE.td} text-right`}>{fmtMoneyCompact(r.attributedRevenue, lang)}</td>
                        <td className={`${TABLE.td} text-right`}>{fmtCount(r.orders, lang)}</td>
                        <td className={`${TABLE.td} text-right font-semibold ${below === null ? '' : below ? 'text-down' : 'text-up'}`} title={below === null ? undefined : below ? (vi ? 'Dưới hòa vốn' : 'Below break-even') : vi ? 'Trên hòa vốn' : 'Above break-even'}>
                          {below !== null && <span aria-hidden>{below ? '↓ ' : '↑ '}</span>}
                          {fmtMultiple(r.roas, lang)}
                        </td>
                        <td className={`${TABLE.td} text-right text-muted`}>{fmtMultiple(r.breakEvenRoas, lang)}</td>
                        <td className={`${TABLE.td} text-right`}>{profitCell(r)}</td>
                        {advanced && (
                          <>
                            <td className={`${TABLE.td} text-right`}>{fmtCount(r.impressions, lang)}</td>
                            <td className={`${TABLE.td} text-right`}>{fmtCount(r.clicks, lang)}</td>
                            <td className={`${TABLE.td} text-right`}>{fmtRate(r.ctr, lang, 2)}</td>
                            <td className={`${TABLE.td} text-right`}>{fmtMoneyCompact(r.cpc, lang)}</td>
                            <td className={`${TABLE.td} text-right`}>{fmtRate(r.cvr, lang, 2)}</td>
                            <td className={`${TABLE.td} text-right`}>{fmtMoneyCompact(r.cpa, lang)}</td>
                          </>
                        )}
                        <td className={`${TABLE.td} text-right`}>
                          <EvidenceButton compact lang={lang} onClick={() => openEvidence({ title: r.name, filter: { range, platforms, campaignId: r.key.split('|')[1] } })} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </SectionCard>

      <Section
        title={vi ? 'Livestream' : 'Livestream'}
        subtitle={
          lives.length > 0 && lives.every((r) => r.session.periodStart !== undefined)
            ? `${formatRangeVi(range)} · ${vi ? `Top ${lives.length} phiên theo báo cáo Shopee, không phải tất cả phiên` : `top ${lives.length} sessions from the Shopee report`}`
            : formatRangeVi(range)
        }
      >
        {lives.length === 0 ? (
          <NotEnoughData lang={lang} reason={vi ? 'Chưa có dữ liệu phiên live có ngày diễn ra trong khoảng này.' : 'No dated live sessions in this range.'} />
        ) : (
          <ul className="space-y-2.5">
            {lives.map((r) => {
              const s = r.session;
              return (
                <li key={s.sessionId} className="rounded-control border border-line p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-fg">
                        <Radio className="h-4 w-4" style={{ color: CHANNEL_COLOR.live.line }} aria-hidden />
                        {sessionDateLabel(s, lang)} · {PLATFORM_LABELS[s.platform]}
                      </div>
                      <div className="truncate text-small text-muted">
                        {s.title}
                        {r.durationHours ? ` · ${r.durationHours.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US', { maximumFractionDigits: 1 })}h` : ''}
                      </div>
                    </div>
                    <EvidenceButton compact lang={lang} onClick={() => openEvidence({ title: `Live ${sessionDateLabel(s, lang)} · ${PLATFORM_LABELS[s.platform]}`, filter: { range: { start: s.periodStart ?? s.date, end: s.date }, liveSessionId: s.sessionId } })} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-3 text-small sm:grid-cols-5 lg:grid-cols-9">
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
                      <div key={x.l} className="min-w-0">
                        <div className="text-muted">{x.l}</div>
                        <div className="text-sm font-semibold tabular text-fg">{x.v}</div>
                        {x.d !== undefined && x.d !== null && <div className={`font-medium tabular ${x.d >= 0 ? 'text-up' : 'text-down'}`}>{fmtChange(x.d, lang)}</div>}
                      </div>
                    ))}
                  </div>
                  {r.previous && (
                    <p className="mt-3 text-small text-muted">
                      {vi ? `So với phiên trước (${fmtDay(r.previous.date)}): ${r.previous.viewers ?? '—'} người xem, ${r.previous.orders ?? '—'} đơn.` : `Previous session (${fmtDay(r.previous.date)}): ${r.previous.viewers ?? '—'} viewers, ${r.previous.orders ?? '—'} orders.`}
                      {r.viewersUpOrdersDown && <span className="ml-1 inline-flex rounded-full bg-warn-soft px-2 py-0.5 font-medium text-warn">{vi ? 'Người xem tăng nhưng đơn giảm — cần kiểm tra.' : 'More viewers but fewer orders — worth checking.'}</span>}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>
      <ChannelWeekdayPanel channel="live" />
    </div>
  );
};

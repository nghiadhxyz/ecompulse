import React, { useMemo, useState } from 'react';
import { sessionDateLabel, compareSessions, fmtCount, fmtMoneyCompact, fmtRate, formatRangeVi, liveAudit, PLATFORM_LABELS, type LiveGroupStats, type LiveSessionRow } from '../../../analytics';
import { useWorkspace } from '../../seller/SellerContext';
import { EvidenceButton, GhostButton, NotEnoughData, Section, tr } from '../../seller/ui';
import { ChangeCell, Th } from '../ui';
import { FunnelView } from './TrafficFunnel';

const label = (r: LiveSessionRow) => `${sessionDateLabel(r.session)} · ${PLATFORM_LABELS[r.session.platform]}`;

export const LiveAuditor: React.FC = () => {
  const { lang, dataset, baseFilter, range, openEvidence, goTo } = useWorkspace();
  const vi = lang === 'vi';
  const la = useMemo(() => liveAudit(dataset, baseFilter), [dataset, baseFilter]);
  const [aId, setAId] = useState<string | null>(null);
  const [bId, setBId] = useState<string | null>(null);

  if (la.sessions.length === 0) {
    return (
      <Section title="Live Session Auditor">
        <NotEnoughData
          lang={lang}
          reason={vi ? 'Chưa có dữ liệu phiên live trong khoảng này. Nhập báo cáo Livestream của Shopee / TikTok ở Data Hub.' : 'No live sessions. Import a live report in the Data Hub.'}
          action={<GhostButton onClick={() => goTo('dataHub')}>Data Hub</GhostButton>}
        />
      </Section>
    );
  }
  const b = la.sessions.find((s) => s.session.sessionId === bId) ?? la.sessions[0];
  // Default A = the previous session of B on the same platform (when it is in range).
  const defaultA = (b.previous && la.sessions.find((s) => s.session.sessionId === b.previous!.sessionId)) || la.sessions.find((s) => s !== b);
  const a = (aId && la.sessions.find((s) => s.session.sessionId === aId)) || defaultA;
  const cmp = a && b && a !== b ? compareSessions(a, b) : null;

  const groupTable = (title: string, rows: LiveGroupStats[]) => (
    <div>
      <h3 className="text-xs font-bold text-slate-300 mb-1.5">{title}</h3>
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-xs">
          <thead className="bg-white/[0.04] text-slate-400">
            <tr>
              <Th left>{vi ? 'Nhóm' : 'Group'}</Th>
              <Th title={vi ? 'Số phiên (cỡ mẫu)' : 'Sessions'}>{vi ? 'Phiên' : 'Sess.'}</Th>
              <Th>{vi ? 'Người xem TB' : 'Avg viewers'}</Th>
              <Th>GMV/h</Th>
              <Th>{vi ? 'Đơn/h' : 'Orders/h'}</Th>
              <Th>{vi ? 'Chuyển đổi' : 'Conv.'}</Th>
              <Th>{vi ? 'LN/h' : 'Profit/h'}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.key} className="border-t border-white/5 text-slate-200">
                <td className="px-2.5 py-1.5 whitespace-nowrap">{tr(lang, g.label)}</td>
                <td className="px-2.5 py-1.5 text-right">{g.sessions}</td>
                <td className="px-2.5 py-1.5 text-right">{fmtCount(g.avgViewers === null ? null : Math.round(g.avgViewers), lang)}</td>
                <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{fmtMoneyCompact(g.gmvPerHour, lang)}</td>
                <td className="px-2.5 py-1.5 text-right">{g.ordersPerHour === null ? '—' : g.ordersPerHour.toFixed(1)}</td>
                <td className="px-2.5 py-1.5 text-right">{fmtRate(g.conversion, lang, 2)}</td>
                <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{fmtMoneyCompact(g.profitPerHour, lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[
          { l: vi ? 'Số phiên' : 'Sessions', v: String(la.totals.sessions) },
          { l: vi ? 'Tổng giờ live' : 'Hours', v: la.totals.hours === null ? '—' : la.totals.hours.toFixed(1) },
          { l: 'GMV', v: fmtMoneyCompact(la.totals.gmv, lang) },
          { l: vi ? 'Đơn' : 'Orders', v: fmtCount(la.totals.orders, lang) },
          { l: 'GMV/h', v: fmtMoneyCompact(la.totals.gmvPerHour, lang) },
        ].map((x) => (
          <div key={x.l} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="text-[11px] text-slate-400">{x.l}</div>
            <div className="text-lg font-black text-white">{x.v}</div>
          </div>
        ))}
      </div>
      {la.notes.map((n, i) => (
        <p key={i} className="text-xs text-[#fab219]">{tr(lang, n)}</p>
      ))}

      <Section title={vi ? 'Xếp hạng phiên theo GMV/giờ' : 'Sessions ranked by GMV/hour'} subtitle={`${formatRangeVi(range)} · ${vi ? 'đã chuẩn hóa theo thời lượng' : 'normalized by duration'}`}>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-xs">
            <thead className="bg-white/[0.04] text-slate-400">
              <tr>
                <Th left>{vi ? 'Phiên' : 'Session'}</Th>
                <Th>{vi ? 'Thời lượng' : 'Duration'}</Th>
                <Th>{vi ? 'Lượt xem' : 'Views'}</Th>
                <Th>{vi ? 'Người xem' : 'Viewers'}</Th>
                <Th>{vi ? 'Xem TB' : 'Avg watch'}</Th>
                <Th>{vi ? 'Nhấp SP' : 'Clicks'}</Th>
                <Th>CTR</Th>
                <Th>{vi ? 'Giỏ' : 'ATC'}</Th>
                <Th>{vi ? 'Đơn' : 'Orders'}</Th>
                <Th>{vi ? 'Đã TT' : 'Paid'}</Th>
                <Th>{vi ? 'Hủy' : 'Canc.'}</Th>
                <Th>GMV</Th>
                <Th>GMV/h</Th>
                <Th>{vi ? 'LN' : 'Profit'}</Th>
                <Th>{vi ? 'LN/h' : 'Profit/h'}</Th>
                <th className="px-2.5 py-2" />
              </tr>
            </thead>
            <tbody>
              {la.ranking.map((r) => (
                <tr key={r.session.sessionId} className={`border-t border-white/5 text-slate-200 ${r.viewersUpOrdersDown ? 'bg-[#fab219]/[0.05]' : ''}`}>
                  <td className="px-2.5 py-1.5 max-w-[220px]">
                    <div className="font-semibold text-white whitespace-nowrap">{label(r)}</div>
                    <div className="text-[11px] text-slate-500 truncate">{r.session.title}</div>
                  </td>
                  <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{r.session.durationMinutes ? `${Math.round(r.session.durationMinutes)}′` : '—'}</td>
                  <td className="px-2.5 py-1.5 text-right">{fmtCount(r.session.views, lang)}</td>
                  <td className="px-2.5 py-1.5 text-right">{fmtCount(r.session.viewers, lang)}</td>
                  <td className="px-2.5 py-1.5 text-right">{r.session.avgWatchSeconds ? `${r.session.avgWatchSeconds}s` : '—'}</td>
                  <td className="px-2.5 py-1.5 text-right">{fmtCount(r.session.productClicks, lang)}</td>
                  <td className="px-2.5 py-1.5 text-right">{fmtRate(r.clickThrough, lang)}</td>
                  <td className="px-2.5 py-1.5 text-right">{fmtCount(r.session.addToCart, lang)}</td>
                  <td className="px-2.5 py-1.5 text-right">{fmtCount(r.session.orders, lang)}</td>
                  <td className="px-2.5 py-1.5 text-right">{fmtCount(r.session.paidOrders, lang)}</td>
                  <td className="px-2.5 py-1.5 text-right">{fmtCount(r.session.cancelledOrders, lang)}</td>
                  <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{fmtMoneyCompact(r.session.gmv, lang)}</td>
                  <td className="px-2.5 py-1.5 text-right whitespace-nowrap font-semibold">{fmtMoneyCompact(r.gmvPerHour, lang)}</td>
                  <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{fmtMoneyCompact(r.estimatedProfit, lang)}{r.estimatedProfit !== null && !r.profitComplete && <span className="text-[#fab219]">*</span>}</td>
                  <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{fmtMoneyCompact(r.profitPerHour, lang)}</td>
                  <td className="px-2.5 py-1.5 text-right">
                    <EvidenceButton compact lang={lang} onClick={() => openEvidence({ title: `Live ${label(r)}`, filter: { range: { start: r.session.periodStart ?? r.session.date, end: r.session.date }, liveSessionId: r.session.sessionId } })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-slate-500 mt-2">{vi ? 'Dòng tô vàng: người xem tăng nhưng đơn giảm so với phiên trước. Lợi nhuận live = đơn gắn với phiên, chưa trừ chi phí tổ chức live (host, quà tặng) nếu chưa nhập.' : 'Highlighted: more viewers but fewer orders than the previous session.'}</p>
      </Section>

      <Section title={vi ? 'So sánh hai phiên' : 'Compare two sessions'}>
        <div className="flex flex-wrap items-center gap-2 mb-3 text-xs text-slate-300">
          {[
            { l: 'A', v: a?.session.sessionId, set: setAId },
            { l: 'B', v: b.session.sessionId, set: setBId },
          ].map((s) => (
            <label key={s.l} className="flex items-center gap-1.5">
              {s.l}
              <select value={s.v} onChange={(e) => s.set(e.target.value)} className="bg-white/[0.06] border border-white/15 rounded-lg px-2 py-1 text-slate-100 [color-scheme:dark] max-w-[260px]">
                {la.sessions.map((r) => (
                  <option key={r.session.sessionId} value={r.session.sessionId}>{label(r)}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
        {cmp && (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-xs">
              <thead className="bg-white/[0.04] text-slate-400">
                <tr>
                  <Th left>{vi ? 'Chỉ số' : 'Metric'}</Th>
                  <Th>A · {label(cmp.a)}</Th>
                  <Th>B · {label(cmp.b)}</Th>
                  <Th>{vi ? 'B so với A' : 'B vs A'}</Th>
                </tr>
              </thead>
              <tbody>
                {([
                  [vi ? 'Người xem' : 'Viewers', 'viewers', false, (r: LiveSessionRow) => fmtCount(r.session.viewers, lang)],
                  [vi ? 'Đơn' : 'Orders', 'orders', false, (r: LiveSessionRow) => fmtCount(r.session.orders, lang)],
                  ['GMV', 'gmv', false, (r: LiveSessionRow) => fmtMoneyCompact(r.session.gmv, lang)],
                  ['GMV/h', 'gmvPerHour', false, (r: LiveSessionRow) => fmtMoneyCompact(r.gmvPerHour, lang)],
                  [vi ? 'Chuyển đổi (đơn/người xem)' : 'Conversion', 'conversion', true, (r: LiveSessionRow) => fmtRate(r.conversion, lang, 2)],
                  [vi ? 'Tỷ lệ nhấp SP' : 'Click-through', 'clickThrough', true, (r: LiveSessionRow) => fmtRate(r.clickThrough, lang)],
                  [vi ? 'Lợi nhuận ước tính' : 'Est. profit', 'profit', false, (r: LiveSessionRow) => fmtMoneyCompact(r.estimatedProfit, lang)],
                ] as const).map(([name, key, rate, get]) => (
                  <tr key={key} className="border-t border-white/5 text-slate-200">
                    <td className="px-2.5 py-1.5">{name}</td>
                    <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{get(cmp.a)}</td>
                    <td className="px-2.5 py-1.5 text-right whitespace-nowrap font-semibold text-white">{get(cmp.b)}</td>
                    <td className="px-2.5 py-1.5 text-right whitespace-nowrap"><ChangeCell c={cmp.changes[key]} rate={rate} lang={lang} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
        <Section title={vi ? 'Hiệu quả theo nhóm' : 'Performance by group'} subtitle={vi ? 'Cột "Phiên" là cỡ mẫu — nhóm ít phiên chỉ mang tính tham khảo' : '"Sess." is the sample size'}>
          <div className="space-y-4">
            {la.byTimeSlot.length > 0 && groupTable(vi ? 'Khung giờ bắt đầu' : 'Start time slot', la.byTimeSlot)}
            {groupTable(vi ? 'Thứ trong tuần' : 'Weekday', la.byWeekday)}
            {la.byDuration.length > 0 && groupTable(vi ? 'Thời lượng' : 'Duration', la.byDuration)}
          </div>
        </Section>
        <Section title={vi ? 'Phễu livestream' : 'Live funnel'}>
          <FunnelView f={la.funnel} lang={lang} />
        </Section>
      </div>
    </div>
  );
};

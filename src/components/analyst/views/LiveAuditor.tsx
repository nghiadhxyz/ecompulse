import React, { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { sessionDateLabel, compareSessions, fmtCount, fmtDay, fmtMoneyCompact, fmtRate, formatRangeVi, liveAudit, PLATFORM_LABELS, type LiveGroupStats, type LiveSessionRow } from '../../../analytics';
import { useWorkspace } from '../../seller/SellerContext';
import { EvidenceButton, GhostButton, NotEnoughData, Section, tr } from '../../seller/ui';
import { SectionCard } from '../../ui/primitives';
import { TABLE } from '../../ui/data';
import { CHANNEL_COLOR } from '../../../theme/chart';
import { ChangeCell, Th } from '../ui';
import { FunnelView } from './TrafficFunnel';
import { dataNotices } from '../../../analytics';
import { SampleTag } from '../../workspace/SampleSize';
import { DataNoticesList } from '../../workspace/DataNotices';
import { ChannelWeekdayPanel } from '../../workspace/SummaryInsightPanels';

const field = 'min-h-10 max-w-[260px] rounded-control border border-line bg-surface px-2.5 text-sm text-fg';

export const LiveAuditor: React.FC = () => {
  const { lang, dataset, baseFilter, range, openEvidence, goTo } = useWorkspace();
  const vi = lang === 'vi';
  const la = useMemo(() => liveAudit(dataset, baseFilter), [dataset, baseFilter]);
  // An inferred air date is always labelled as such (7.1).
  const dateOf = (r: LiveSessionRow) => {
    const d = la.inferredDates[r.session.sessionId];
    return d ? `${fmtDay(d)} (${vi ? 'ngày suy luận' : 'inferred date'})` : sessionDateLabel(r.session, lang);
  };
  const label = (r: LiveSessionRow) => `${dateOf(r)} · ${PLATFORM_LABELS[r.session.platform]}`;
  // Session picker: title + id, so sessions with the same date stay distinguishable (7.4).
  const optionLabel = (r: LiveSessionRow) => `${r.session.title ?? (vi ? 'Không tên' : 'Untitled')} · ${r.session.sessionId.replace(/^.*-/, '')}`;
  // Odd live records: grey notes (Shopee's own inconsistencies) and red invalid relations.
  const liveNotices = useMemo(
    () => dataNotices(dataset, baseFilter.range, baseFilter.platforms).filter((n) => n.kind === 'atc_without_viewers' || n.kind === 'sessions_over_channel' || (n.kind === 'unique_clicks_over_viewers' && n.ref.channel === 'live')),
    [dataset, baseFilter.range, baseFilter.platforms],
  );
  const [aId, setAId] = useState<string | null>(null);
  const [bId, setBId] = useState<string | null>(null);

  if (la.sessions.length === 0) {
    return (
      <div className="space-y-4">
        <Section title="Live Session Auditor">
          <NotEnoughData
            lang={lang}
            reason={vi ? 'Chưa có dữ liệu phiên live trong khoảng này (phiên live của báo cáo Phân tích bán hàng chỉ có tổng cả kỳ — chọn trọn kỳ). Nhập báo cáo Livestream của Shopee / TikTok ở Data Hub.' : 'No live sessions in this range. Import a live report in the Data Hub.'}
            action={<GhostButton onClick={() => goTo('dataHub')}>Data Hub</GhostButton>}
          />
        </Section>
        <ChannelWeekdayPanel channel="live" />
      </div>
    );
  }
  const topListOnly = la.sessions.every((s) => s.session.periodStart !== undefined);
  // Sessions with no viewers cannot be compared (7.4).
  const comparable = la.sessions.filter((s) => (s.session.viewers ?? 0) > 0);
  const b = comparable.find((s) => s.session.sessionId === bId) ?? comparable[0];
  // Default A = the previous session of B on the same platform (when it is in range).
  const defaultA = b && ((b.previous && comparable.find((s) => s.session.sessionId === b.previous!.sessionId)) || comparable.find((s) => s !== b));
  const a = (aId && comparable.find((s) => s.session.sessionId === aId)) || defaultA;
  const cmp = a && b && a !== b ? compareSessions(a, b) : null;
  const byGmv = la.rankedBy === 'gmv';

  const groupTable = (title: string, rows: LiveGroupStats[]) => (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-fg">{title}</h3>
      <div className={TABLE.frame}>
        <table className={TABLE.table}>
          <thead className={TABLE.thead}>
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
              <tr key={g.key} className={`${TABLE.tr} text-fg`}>
                <td className={TABLE.td}>
                  {tr(lang, g.label)}
                  <SampleTag n={g.sessions} lang={lang} />
                </td>
                <td className={`${TABLE.td} text-right`}>{g.sessions}</td>
                <td className={`${TABLE.td} text-right`}>{fmtCount(g.avgViewers === null ? null : Math.round(g.avgViewers), lang)}</td>
                <td className={`${TABLE.td} text-right`}>{fmtMoneyCompact(g.gmvPerHour, lang)}</td>
                <td className={`${TABLE.td} text-right`}>{g.ordersPerHour === null ? '—' : g.ordersPerHour.toFixed(1)}</td>
                <td className={`${TABLE.td} text-right`}>{fmtRate(g.conversion, lang, 2)}</td>
                <td className={`${TABLE.td} text-right`}>{fmtMoneyCompact(g.profitPerHour, lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {[
          { l: vi ? 'Số phiên' : 'Sessions', v: String(la.totals.sessions) },
          { l: vi ? 'Tổng giờ live' : 'Hours', v: la.totals.hours === null ? '—' : la.totals.hours.toFixed(1) },
          { l: 'GMV', v: fmtMoneyCompact(la.totals.gmv, lang) },
          { l: vi ? 'Đơn' : 'Orders', v: fmtCount(la.totals.orders, lang) },
          { l: 'GMV/h', v: fmtMoneyCompact(la.totals.gmvPerHour, lang) },
        ].map((x) => (
          <div key={x.l} className="min-w-0 rounded-card border border-line bg-surface px-4 py-3.5 shadow-card">
            <div className="text-small text-muted">{x.l}</div>
            <div className="mt-1 text-kpi text-fg">{x.v}</div>
          </div>
        ))}
      </div>
      {la.insight && (
        <p className="flex items-start gap-2 rounded-control bg-down-soft px-3 py-2.5 text-sm font-medium text-down">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {tr(lang, la.insight)}
        </p>
      )}
      {/* One box for every note about the session list (7.2). */}
      <div className="space-y-1.5 rounded-card border border-line bg-surface px-4 py-3 shadow-card">
        <p className="text-sm font-semibold text-fg">
          {vi ? `${la.watchedSessions}/${la.sessions.length} phiên có người xem` : `${la.watchedSessions}/${la.sessions.length} sessions had viewers`}
          {topListOnly && <span className="text-small font-normal text-muted"> · {vi ? `Top ${la.sessions.length} phiên theo báo cáo Shopee (Shopee chỉ liệt kê Top 5)` : `Top ${la.sessions.length} from the Shopee report`}</span>}
        </p>
        <DataNoticesList notices={liveNotices} lang={lang} />
        {la.notes.map((n, i) => (
          <p key={i} className="text-small text-muted">
            • {tr(lang, n)}
          </p>
        ))}
      </div>
      <ChannelWeekdayPanel channel="live" />

      <SectionCard
        title={byGmv ? (vi ? 'Xếp hạng phiên theo GMV' : 'Sessions ranked by GMV') : vi ? 'Xếp hạng phiên theo GMV/giờ' : 'Sessions ranked by GMV/hour'}
        description={`${formatRangeVi(range)} · ${byGmv ? (vi ? 'báo cáo không có thời lượng phiên nên chưa tính được GMV/giờ' : 'no durations in the report, so no GMV/hour') : vi ? 'đã chuẩn hóa theo thời lượng' : 'normalized by duration'}`}
        notesLabel={vi ? 'Ghi chú' : 'Notes'}
        notes={[vi ? 'Dòng tô vàng: người xem tăng nhưng đơn giảm so với phiên trước. Lợi nhuận live = đơn gắn với phiên, chưa trừ chi phí tổ chức live (host, quà tặng) nếu chưa nhập.' : 'Highlighted: more viewers but fewer orders than the previous session.']}
      >
        <div className={TABLE.frame}>
          <table className={TABLE.table}>
            <thead className={TABLE.thead}>
              <tr>
                <Th left className="sticky left-0 z-20 bg-surface-2">{vi ? 'Phiên' : 'Session'}</Th>
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
                {!byGmv && <Th>GMV/h</Th>}
                <Th>{vi ? 'LN' : 'Profit'}</Th>
                {!byGmv && <Th>{vi ? 'LN/h' : 'Profit/h'}</Th>}
                <th className={TABLE.th} />
              </tr>
            </thead>
            <tbody>
              {la.ranking.map((r) => {
                const bg = r.viewersUpOrdersDown ? 'bg-warn-soft' : 'bg-surface';
                return (
                  <tr key={r.session.sessionId} className={`${TABLE.tr} text-fg ${r.viewersUpOrdersDown ? 'bg-warn-soft' : ''}`} title={r.viewersUpOrdersDown ? (vi ? 'Người xem tăng nhưng đơn giảm so với phiên trước' : 'More viewers but fewer orders than the previous session') : undefined}>
                    <td className={`sticky left-0 z-10 max-w-[220px] px-3 py-1.5 ${bg}`}>
                      <div className="truncate font-medium text-fg" title={label(r)}>{label(r)}</div>
                      <div className="truncate text-small text-muted" title={r.session.title}>{r.session.title}</div>
                    </td>
                    <td className={`${TABLE.td} text-right`}>{r.session.durationMinutes ? `${Math.round(r.session.durationMinutes)}′` : '—'}</td>
                    <td className={`${TABLE.td} text-right`}>{fmtCount(r.session.views, lang)}</td>
                    <td className={`${TABLE.td} text-right`}>{fmtCount(r.session.viewers, lang)}</td>
                    <td className={`${TABLE.td} text-right`}>{r.session.avgWatchSeconds ? `${r.session.avgWatchSeconds}s` : '—'}</td>
                    <td className={`${TABLE.td} text-right`}>{fmtCount(r.session.productClicks, lang)}</td>
                    <td className={`${TABLE.td} text-right`}>{fmtRate(r.clickThrough, lang)}</td>
                    <td className={`${TABLE.td} text-right`}>{fmtCount(r.session.addToCart, lang)}</td>
                    <td className={`${TABLE.td} text-right`}>{fmtCount(r.session.orders, lang)}</td>
                    <td className={`${TABLE.td} text-right`}>{fmtCount(r.session.paidOrders, lang)}</td>
                    <td className={`${TABLE.td} text-right`}>{fmtCount(r.session.cancelledOrders, lang)}</td>
                    <td className={`${TABLE.td} text-right`}>{fmtMoneyCompact(r.session.gmv, lang)}</td>
                    {!byGmv && <td className={`${TABLE.td} text-right font-semibold`}>{fmtMoneyCompact(r.gmvPerHour, lang)}</td>}
                    <td className={`${TABLE.td} text-right`}>
                      {fmtMoneyCompact(r.estimatedProfit, lang)}
                      {r.estimatedProfit !== null && !r.profitComplete && <span className="text-warn">*</span>}
                    </td>
                    {!byGmv && <td className={`${TABLE.td} text-right`}>{fmtMoneyCompact(r.profitPerHour, lang)}</td>}
                    <td className={`${TABLE.td} text-right`}>
                      <EvidenceButton compact lang={lang} onClick={() => openEvidence({ title: `Live ${label(r)}`, filter: { range: { start: r.session.periodStart ?? r.session.date, end: r.session.date }, liveSessionId: r.session.sessionId } })} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <Section title={vi ? 'So sánh hai phiên' : 'Compare two sessions'} subtitle={vi ? 'Chỉ chọn được phiên có người xem' : 'Only sessions with viewers'}>
        {comparable.length < 2 && (
          <NotEnoughData lang={lang} reason={vi ? `Cần ít nhất 2 phiên có người xem để so sánh — hiện có ${comparable.length}.` : `Needs at least 2 sessions with viewers (${comparable.length}).`} />
        )}
        {comparable.length >= 2 && (
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-muted">
            {[
              { l: 'A', v: a?.session.sessionId, set: setAId },
              { l: 'B', v: b.session.sessionId, set: setBId },
            ].map((s) => (
              <label key={s.l} className="flex items-center gap-2">
                {s.l}
                <select value={s.v} onChange={(e) => s.set(e.target.value)} className={field}>
                  {la.sessions.map((r) => (
                    <option key={r.session.sessionId} value={r.session.sessionId} disabled={(r.session.viewers ?? 0) === 0}>
                      {optionLabel(r)}
                      {(r.session.viewers ?? 0) === 0 ? (vi ? ' (0 người xem)' : ' (0 viewers)') : ''}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}
        {cmp && (
          <div className={TABLE.frame}>
            <table className={TABLE.table}>
              <thead className={TABLE.thead}>
                <tr>
                  <Th left>{vi ? 'Chỉ số' : 'Metric'}</Th>
                  <Th>A · {label(cmp.a)}</Th>
                  <Th>B · {label(cmp.b)}</Th>
                  <Th>{vi ? 'B so với A' : 'B vs A'}</Th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    [vi ? 'Người xem' : 'Viewers', 'viewers', false, (r: LiveSessionRow) => fmtCount(r.session.viewers, lang)],
                    [vi ? 'Đơn' : 'Orders', 'orders', false, (r: LiveSessionRow) => fmtCount(r.session.orders, lang)],
                    ['GMV', 'gmv', false, (r: LiveSessionRow) => fmtMoneyCompact(r.session.gmv, lang)],
                    ['GMV/h', 'gmvPerHour', false, (r: LiveSessionRow) => fmtMoneyCompact(r.gmvPerHour, lang)],
                    [vi ? 'Chuyển đổi (đơn/người xem)' : 'Conversion', 'conversion', true, (r: LiveSessionRow) => fmtRate(r.conversion, lang, 2)],
                    [vi ? 'Tỷ lệ nhấp SP' : 'Click-through', 'clickThrough', true, (r: LiveSessionRow) => fmtRate(r.clickThrough, lang)],
                    [vi ? 'Lợi nhuận ước tính' : 'Est. profit', 'profit', false, (r: LiveSessionRow) => fmtMoneyCompact(r.estimatedProfit, lang)],
                  ] as const
                ).map(([name, key, rate, get]) => (
                  <tr key={key} className={`${TABLE.tr} text-fg`}>
                    <td className={TABLE.td}>{name}</td>
                    <td className={`${TABLE.td} text-right`}>{get(cmp.a)}</td>
                    <td className={`${TABLE.td} text-right font-semibold`}>{get(cmp.b)}</td>
                    <td className={`${TABLE.td} text-right`}>
                      <ChangeCell c={cmp.changes[key]} rate={rate} lang={lang} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <Section title={vi ? 'Hiệu quả theo nhóm' : 'Performance by group'} subtitle={vi ? 'Cột "Phiên" là cỡ mẫu — nhóm ít phiên chỉ mang tính tham khảo' : '"Sess." is the sample size'}>
          <div className="space-y-5">
            {la.byTimeSlot.length > 0 && groupTable(vi ? 'Khung giờ bắt đầu' : 'Start time slot', la.byTimeSlot)}
            {groupTable(vi ? 'Thứ trong tuần' : 'Weekday', la.undated ? [...la.byWeekday, la.undated] : la.byWeekday)}
            {la.byDuration.length > 0 && groupTable(vi ? 'Thời lượng' : 'Duration', la.byDuration)}
          </div>
        </Section>
        <Section title={vi ? 'Phễu livestream' : 'Live funnel'}>
          <FunnelView f={la.funnel} lang={lang} color={CHANNEL_COLOR.live.line} />
        </Section>
      </div>
    </div>
  );
};

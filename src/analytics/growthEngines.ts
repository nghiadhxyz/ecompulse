/**
 * Growth engines: Ads Intelligence, Live Auditor, Video & Affiliate.
 * All built on the same slice / profit engine as the rest of the analytics.
 */
import type { AdPerformance, AffiliatePerformance, CanonicalDataset, LiveSession, Platform } from './model';
import { sliceDataset, type DatasetFilter } from './filters';
import { adsSummary, isUndatedSession, liveSessions, type AdCampaignRow, type LiveSessionRow } from './adsLiveEngine';
import { computeProfitByGroup } from './profitEngine';
import { liveFunnel, type Funnel } from './funnelEngine';
import { compareValues, type Comparison } from './comparisonEngine';
import { safeDivide, type Bilingual } from './metric';
import { enumerateDays } from './period';
import { weekdayIndex } from './campaignEngine';
import { moneyTolerance, ORDER_TOLERANCE, periodMismatches } from './periodRows';
import { byGap, compareCopies, FILE_RATE_LABEL, periodMismatchItems, RECOMPUTED_LABEL, type MismatchItem } from './mismatch';
import { fmtMoney, fmtOrders } from './format';

// ============================================================ ADS INTELLIGENCE

/** likely_loss: ROAS below 1,5 with no margin known — almost surely losing money. */
export type AdEfficiency = 'profitable' | 'below_break_even' | 'likely_loss' | 'unknown';

/** Robust score above which a day's ROAS is marked unusual. */
export const ROAS_OUTLIER_SCORE = 3.5;

/** Below this ROAS a campaign almost surely loses money, whatever the margin (6.3). */
export const LIKELY_LOSS_ROAS = 1.5;

export interface AdsIntelligence {
  available: boolean;
  campaigns: (AdCampaignRow & { efficiency: AdEfficiency; spendShare: number | null })[];
  totals: ReturnType<typeof adsSummary>['totals'];
  daily: { date: string; spend: number; revenue: number | null; roas: number | null; clicks: number | null; roasOutlier: boolean }[];
  byPlatform: { platform: Platform; spend: number; revenue: number | null; roas: number | null; profitAfterAds: number | null }[];
  /** Spend on campaigns below break-even ROAS. */
  spendBelowBreakEven: number;
  /** Period-total rows cannot be split by day and are excluded from the daily chart. */
  periodRowsExcludedFromDaily: number;
  /** Ad rows whose days do not add up to the period row, and printed ROAS ≠ revenue ÷ spend. */
  mismatches: MismatchItem[];
  notes: Bilingual[];
}

export function adsIntelligence(dataset: CanonicalDataset, filter: DatasetFilter): AdsIntelligence {
  const summary = adsSummary(dataset, filter);
  const slice = sliceDataset(dataset, filter);
  const totalSpend = summary.totals.spend;
  const campaigns = summary.rows.map((r) => ({
    ...r,
    efficiency: (r.roas === null
      ? 'unknown'
      : r.breakEvenRoas !== null
        ? r.roas >= r.breakEvenRoas
          ? 'profitable'
          : 'below_break_even'
        : r.roas < LIKELY_LOSS_ROAS
          ? 'likely_loss'
          : 'unknown') as AdEfficiency,
    spendShare: totalSpend && r.spend !== null ? r.spend / totalSpend : null,
  }));
  // The chart by day always uses the daily rows, even when the totals above use the
  // platform's period rows (full period selected).
  const dailyRows = slice.adsDaily;
  const daily = enumerateDays(filter.range).map((date) => {
    const rows = dailyRows.filter((a) => a.date === date);
    const spend = rows.reduce((s, a) => s + (a.spend || 0), 0);
    const hasRev = rows.some((a) => typeof a.attributedRevenue === 'number');
    const revenue = hasRev ? rows.reduce((s, a) => s + (a.attributedRevenue || 0), 0) : null;
    const hasClicks = rows.some((a) => typeof a.clicks === 'number');
    return { date, spend, revenue, roas: revenue !== null ? safeDivide(revenue, spend) : null, clicks: hasClicks ? rows.reduce((s, a) => s + (a.clicks || 0), 0) : null, roasOutlier: false };
  });
  // Unusual ROAS days (6.4): robust score against the median day, as in anomalyScan.ts.
  const roasDays = daily.filter((d) => d.roas !== null && d.spend > 0);
  if (roasDays.length >= 7) {
    const med = (xs: number[]) => {
      const s = [...xs].sort((a, b) => a - b);
      return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
    };
    const m = med(roasDays.map((d) => d.roas!));
    const mad = Math.max(med(roasDays.map((d) => Math.abs(d.roas! - m))), m * 0.1);
    for (const d of roasDays) d.roasOutlier = mad > 0 && Math.abs((0.6745 * (d.roas! - m)) / mad) >= ROAS_OUTLIER_SCORE;
  }
  const platforms = Array.from(new Set(campaigns.map((c) => c.platform)));
  const byPlatform = platforms.map((platform) => {
    const rows = campaigns.filter((c) => c.platform === platform);
    const spend = rows.reduce((s, c) => s + (c.spend ?? 0), 0);
    const revKnown = rows.every((c) => c.attributedRevenue !== null);
    const revenue = revKnown ? rows.reduce((s, c) => s + (c.attributedRevenue ?? 0), 0) : null;
    const profitKnown = rows.every((c) => c.estimatedProfitAfterAds !== null);
    return {
      platform,
      spend,
      revenue,
      roas: revenue !== null ? safeDivide(revenue, spend) : null,
      profitAfterAds: profitKnown ? rows.reduce((s, c) => s + (c.estimatedProfitAfterAds ?? 0), 0) : null,
    };
  });
  const periodUsed = slice.ads.filter((a) => a.periodStart !== undefined);
  const periodRows = periodUsed.filter((p) => !dailyRows.some((d) => d.campaignId === p.campaignId && d.platform === p.platform)).length;
  const notes: Bilingual[] = [];
  if (periodRows > 0) {
    notes.push({
      vi: `${periodRows} dòng Ads là số tổng cả kỳ (không theo ngày) — có trong bảng chiến dịch nhưng không vẽ được theo ngày.`,
      en: `${periodRows} ad rows are period totals — included in campaign totals, not in the daily chart.`,
    });
  }
  const adKey = (a: { platform: string; campaignId?: string; adName?: string; sku?: string }) => `${a.platform}|${a.campaignId ?? ''}|${a.adName ?? ''}|${a.sku ?? ''}`;
  const scopedAds = dataset.ads.filter((a) => !filter.platforms?.length || filter.platforms.includes(a.platform));
  const mm = periodMismatches<AdPerformance>(scopedAds, filter.range, adKey, [
    { key: 'spend', pick: (a) => a.spend, tolerance: moneyTolerance },
    { key: 'attributedRevenue', pick: (a) => a.attributedRevenue, tolerance: moneyTolerance },
    { key: 'orders', pick: (a) => a.orders, tolerance: ORDER_TOLERANCE },
  ]);
  const FIELD: Record<string, Bilingual> = { spend: { vi: 'chi phí', en: 'spend' }, attributedRevenue: { vi: 'doanh số', en: 'sales' }, orders: { vi: 'số đơn', en: 'orders' } };
  const mismatches = periodMismatchItems(
    mm,
    (m) => {
      const name = m.group.split('|')[2] || m.group.split('|')[1];
      return { vi: `${name} — ${FIELD[m.field].vi}`, en: `${name} — ${FIELD[m.field].en}` };
    },
    (m) => (m.field === 'orders' ? 'count' : 'vnd'),
  );
  // The report's own ROAS column vs revenue ÷ spend of the same row.
  for (const a of slice.ads.filter((x) => x.periodStart !== undefined && x.reportedRoas !== undefined)) {
    const m = compareCopies(
      `roas|${adKey(a)}`,
      { vi: `${a.adName ?? a.campaignId} — ROAS`, en: `${a.adName ?? a.campaignId} — ROAS` },
      'multiple',
      { label: RECOMPUTED_LABEL, value: a.spend ? (a.attributedRevenue ?? 0) / a.spend : null },
      { label: FILE_RATE_LABEL, value: a.reportedRoas },
    );
    if (m) mismatches.push(m);
  }
  mismatches.sort(byGap);
  return {
    available: summary.available,
    campaigns,
    totals: summary.totals,
    daily,
    byPlatform,
    spendBelowBreakEven: campaigns.filter((c) => c.efficiency === 'below_break_even').reduce((s, c) => s + (c.spend ?? 0), 0),
    periodRowsExcludedFromDaily: periodRows,
    mismatches,
    notes,
  };
}

// ============================================================ LIVE AUDITOR

export interface LiveGroupStats {
  key: string;
  label: Bilingual;
  sessions: number;
  avgViewers: number | null;
  gmvPerHour: number | null;
  ordersPerHour: number | null;
  conversion: number | null;
  profitPerHour: number | null;
}

export interface LiveAudit {
  sessions: LiveSessionRow[];
  ranking: LiveSessionRow[];
  byTimeSlot: LiveGroupStats[];
  byWeekday: LiveGroupStats[];
  /** Sessions without an air date ("Không rõ ngày") — never placed on a day or weekday. */
  undated: LiveGroupStats | null;
  byDuration: LiveGroupStats[];
  funnel: Funnel;
  totals: { sessions: number; hours: number | null; gmv: number; orders: number; gmvPerHour: number | null };
  notes: Bilingual[];
  /** Sessions with at least one viewer (7.2). */
  watchedSessions: number;
  /** Air date inferred for a period-total session (7.1), by session id — always labelled. */
  inferredDates: Record<string, string>;
  /** No session has a duration: the ranking is by GMV and the "/giờ" columns are hidden (7.3). */
  rankedBy: 'gmvPerHour' | 'gmv';
  /** ROAS of the live ads (e.g. "Dịch Vụ Hiển Thị Live"), when there are any. */
  liveAdsRoas: number | null;
  /** Automatic conclusion (7.6), null when nothing stands out. */
  insight: Bilingual | null;
}

const SLOTS: { key: string; label: Bilingual; from: number; to: number }[] = [
  { key: 'morning', label: { vi: 'Sáng (trước 11h)', en: 'Morning (<11h)' }, from: 0, to: 11 },
  { key: 'noon', label: { vi: 'Trưa (11–14h)', en: 'Noon (11–14h)' }, from: 11, to: 14 },
  { key: 'afternoon', label: { vi: 'Chiều (14–18h)', en: 'Afternoon (14–18h)' }, from: 14, to: 18 },
  { key: 'evening', label: { vi: 'Tối (18–21h)', en: 'Evening (18–21h)' }, from: 18, to: 21 },
  { key: 'late', label: { vi: 'Khuya (từ 21h)', en: 'Late (21h+)' }, from: 21, to: 24 },
];

const DURATIONS: { key: string; label: Bilingual; from: number; to: number }[] = [
  { key: 'lt60', label: { vi: 'Dưới 1 giờ', en: '< 1h' }, from: 0, to: 60 },
  { key: '60', label: { vi: '1–2 giờ', en: '1–2h' }, from: 60, to: 120 },
  { key: '120', label: { vi: '2–3 giờ', en: '2–3h' }, from: 120, to: 180 },
  { key: '180', label: { vi: 'Từ 3 giờ', en: '3h+' }, from: 180, to: Infinity },
];

const WEEKDAYS: Bilingual[] = [
  { vi: 'Thứ 2', en: 'Mon' },
  { vi: 'Thứ 3', en: 'Tue' },
  { vi: 'Thứ 4', en: 'Wed' },
  { vi: 'Thứ 5', en: 'Thu' },
  { vi: 'Thứ 6', en: 'Fri' },
  { vi: 'Thứ 7', en: 'Sat' },
  { vi: 'Chủ nhật', en: 'Sun' },
];

function groupStats(key: string, label: Bilingual, rows: LiveSessionRow[]): LiveGroupStats {
  const withHours = rows.filter((r) => r.durationHours);
  const hours = withHours.reduce((s, r) => s + (r.durationHours || 0), 0);
  const gmv = withHours.reduce((s, r) => s + (r.session.gmv || 0), 0);
  const orders = withHours.reduce((s, r) => s + (r.session.orders || 0), 0);
  // Sessions with 0 viewers say nothing about how many people watch (7.5).
  const viewersRows = rows.filter((r) => typeof r.session.viewers === 'number' && r.session.viewers > 0);
  const viewers = viewersRows.reduce((s, r) => s + (r.session.viewers || 0), 0);
  const ordersAll = viewersRows.reduce((s, r) => s + (r.session.orders || 0), 0);
  const profitRows = withHours.filter((r) => r.estimatedProfit !== null);
  return {
    key,
    label,
    sessions: rows.length,
    avgViewers: viewersRows.length ? viewers / viewersRows.length : null,
    gmvPerHour: hours ? gmv / hours : null,
    ordersPerHour: hours ? orders / hours : null,
    conversion: viewers ? ordersAll / viewers : null,
    profitPerHour: profitRows.length === withHours.length && hours ? profitRows.reduce((s, r) => s + (r.estimatedProfit || 0), 0) / hours : null,
  };
}

/**
 * Air date of a period-total session (7.1), when exactly one listed session had viewers:
 * the date in its title ("MEGA LIVE 25.7") if the Live channel had views that day, otherwise
 * the only day the Live channel had views. Always shown as "ngày suy luận".
 */
function inferSessionDates(dataset: CanonicalDataset, filter: DatasetFilter, sessions: LiveSessionRow[]): Record<string, string> {
  const watched = sessions.filter((r) => isUndatedSession(r.session) && (r.session.viewers ?? 0) > 0);
  if (watched.length !== 1) return {};
  const s = watched[0].session;
  const days = new Set(
    (dataset.salesSummaries ?? [])
      .filter((r) => r.channel === 'live' && r.dimension === 'channel' && r.stage === 'placed' && r.periodStart === undefined && r.platform === s.platform)
      .filter((r) => r.date >= (s.periodStart ?? filter.range.start) && r.date <= s.date && ((r.views ?? 0) > 0 || (r.uniqueImpressions ?? 0) > 0))
      .map((r) => r.date),
  );
  const m = s.title?.match(/(?:^|[^\d])(\d{1,2})[./](\d{1,2})(?![\d./])/);
  if (m) {
    const titled = [...days].find((d) => Number(d.slice(8, 10)) === Number(m[1]) && Number(d.slice(5, 7)) === Number(m[2]));
    if (titled) return { [s.sessionId]: titled };
  }
  return days.size === 1 ? { [s.sessionId]: [...days][0] } : {};
}

export function liveAudit(dataset: CanonicalDataset, filter: DatasetFilter): LiveAudit {
  const sessions = liveSessions(dataset, filter);
  const inferredDates = inferSessionDates(dataset, filter, sessions);
  const anyDuration = sessions.some((r) => r.gmvPerHour !== null);
  const ranking = anyDuration
    ? [...sessions].filter((r) => r.gmvPerHour !== null).sort((a, b) => (b.gmvPerHour ?? 0) - (a.gmvPerHour ?? 0))
    : [...sessions].sort((a, b) => (b.session.gmv ?? 0) - (a.session.gmv ?? 0));
  const hourOf = (s: LiveSession) => (s.startTime ? Number(s.startTime.slice(0, 2)) : null);
  const withTime = sessions.filter((r) => !isUndatedSession(r.session) && hourOf(r.session) !== null);
  const byTimeSlot = SLOTS.map((slot) => groupStats(slot.key, slot.label, withTime.filter((r) => hourOf(r.session)! >= slot.from && hourOf(r.session)! < slot.to))).filter((g) => g.sessions > 0);
  // Period-total sessions carry the report's last day as `date`, not the day they aired.
  const dated = sessions.filter((r) => !isUndatedSession(r.session));
  const undatedRows = sessions.filter((r) => isUndatedSession(r.session));
  const undated = undatedRows.length ? groupStats('undated', { vi: 'Không rõ ngày', en: 'Unknown date' }, undatedRows) : null;
  const byWeekday = WEEKDAYS.map((label, i) => groupStats(String(i), label, dated.filter((r) => weekdayIndex(r.session.date) === i))).filter((g) => g.sessions > 0);
  const byDuration = DURATIONS.map((d) =>
    groupStats(d.key, d.label, sessions.filter((r) => r.session.durationMinutes !== undefined && r.session.durationMinutes >= d.from && r.session.durationMinutes < d.to)),
  ).filter((g) => g.sessions > 0);
  const withHours = sessions.filter((r) => r.durationHours);
  const hours = withHours.length ? withHours.reduce((s, r) => s + (r.durationHours || 0), 0) : null;
  const gmv = sessions.reduce((s, r) => s + (r.session.gmv || 0), 0);
  const notes: Bilingual[] = [];
  if (dated.length < sessions.length) {
    notes.push({
      vi: `${sessions.length - dated.length} phiên chỉ có số tổng cả kỳ, không có ngày diễn ra — xếp vào nhóm "Không rõ ngày", không xếp được theo ngày, thứ hay khung giờ.`,
      en: `${sessions.length - dated.length} sessions are period totals without a date — not grouped by weekday.`,
    });
  }
  if (sessions.length > 0 && withTime.length < sessions.length) {
    notes.push({ vi: `${sessions.length - withTime.length} phiên không có giờ bắt đầu — không xếp được vào khung giờ.`, en: `${sessions.length - withTime.length} sessions have no start time.` });
  }
  if (sessions.length > 0 && sessions.length < 8) {
    notes.push({ vi: 'Số phiên live còn ít — so sánh theo khung giờ/thứ chỉ mang tính tham khảo.', en: 'Few sessions — slot/weekday comparisons are indicative only.' });
  }
  const watchedSessions = sessions.filter((r) => (r.session.viewers ?? 0) > 0).length;
  // Live ads: campaigns whose name says Live (Shopee "Dịch Vụ Hiển Thị Live").
  const liveAds = adsSummary(dataset, filter).rows.filter((r) => /live/i.test(r.name) && r.spend);
  const liveSpend = liveAds.reduce((s, r) => s + (r.spend ?? 0), 0);
  const liveAdsRoas = liveAds.length && liveAds.every((r) => r.attributedRevenue !== null) ? safeDivide(liveAds.reduce((s, r) => s + (r.attributedRevenue ?? 0), 0), liveSpend) : null;
  const insight: Bilingual | null =
    sessions.length > 0 && watchedSessions <= 1 && liveAdsRoas !== null && liveAdsRoas < LIKELY_LOSS_ROAS
      ? {
          vi: `Kênh Live gần như chưa hoạt động (${watchedSessions}/${sessions.length} phiên có người xem, ROAS quảng cáo Live ${liveAdsRoas.toFixed(2).replace('.', ',')}x), cân nhắc dừng quảng cáo Live hoặc lập lịch live đều đặn.`,
          en: `Live is barely active (${watchedSessions}/${sessions.length} sessions with viewers, live ads ROAS ${liveAdsRoas.toFixed(2)}x): consider pausing live ads or scheduling regular lives.`,
        }
      : null;
  return {
    sessions,
    ranking,
    byTimeSlot,
    byWeekday,
    undated,
    byDuration,
    funnel: liveFunnel(dataset, filter.range, filter.platforms),
    totals: { sessions: sessions.length, hours, gmv, orders: sessions.reduce((s, r) => s + (r.session.orders || 0), 0), gmvPerHour: hours ? withHours.reduce((s, r) => s + (r.session.gmv || 0), 0) / hours : null },
    notes,
    watchedSessions,
    inferredDates,
    rankedBy: anyDuration ? 'gmvPerHour' : 'gmv',
    liveAdsRoas,
    insight,
  };
}

export interface SessionComparison {
  a: LiveSessionRow;
  b: LiveSessionRow;
  changes: Record<'viewers' | 'orders' | 'gmv' | 'gmvPerHour' | 'conversion' | 'clickThrough' | 'profit', Comparison>;
}

/** B vs A. */
export function compareSessions(a: LiveSessionRow, b: LiveSessionRow): SessionComparison {
  return {
    a,
    b,
    changes: {
      viewers: compareValues(b.session.viewers ?? null, a.session.viewers ?? null, 'count'),
      orders: compareValues(b.session.orders ?? null, a.session.orders ?? null, 'count'),
      gmv: compareValues(b.session.gmv ?? null, a.session.gmv ?? null, 'vnd'),
      gmvPerHour: compareValues(b.gmvPerHour, a.gmvPerHour, 'vnd'),
      conversion: compareValues(b.conversion, a.conversion, 'ratio'),
      clickThrough: compareValues(b.clickThrough, a.clickThrough, 'ratio'),
      profit: compareValues(b.estimatedProfit, a.estimatedProfit, 'vnd'),
    },
  };
}

// ============================================================ VIDEO & AFFILIATE

export type ContentKind = 'affiliate' | 'shop_video' | 'organic_video' | 'creator';

export const CONTENT_KIND_LABELS: Record<ContentKind, Bilingual> = {
  affiliate: { vi: 'Affiliate / KOC', en: 'Affiliate / KOC' },
  shop_video: { vi: 'Video của shop', en: 'Shop video' },
  organic_video: { vi: 'Video tự nhiên', en: 'Organic video' },
  creator: { vi: 'Nhà sáng tạo (live)', en: 'Creator (live)' },
};

export interface ContentRow {
  key: string;
  kind: ContentKind;
  platform: Platform;
  creatorId: string;
  contentId?: string;
  title?: string;
  views: number | null;
  clicks: number | null;
  orders: number | null;
  gmv: number | null;
  commission: number | null;
  ctr: number | null;
  cvr: number | null;
  commissionRate: number | null;
  /** Contribution profit of the orders attributed to this content (after commission), when orders carry the attribution. */
  profit: number | null;
  margin: number | null;
  gmvChange: Comparison;
}

export interface VideoAffiliate {
  available: boolean;
  byKind: { kind: ContentKind; gmv: number; orders: number; commission: number; items: number }[];
  creators: ContentRow[];
  videos: ContentRow[];
  notes: Bilingual[];
}

function sumOrNull(rows: AffiliatePerformance[], pick: (r: AffiliatePerformance) => number | undefined): number | null {
  return rows.some((r) => typeof pick(r) === 'number') ? rows.reduce((s, r) => s + (pick(r) || 0), 0) : null;
}

export function videoAffiliate(dataset: CanonicalDataset, filter: DatasetFilter, previousRange?: { start: string; end: string }): VideoAffiliate {
  const slice = sliceDataset(dataset, filter);
  const prevSlice = previousRange ? sliceDataset(dataset, { ...filter, range: previousRange }) : null;
  const notes: Bilingual[] = [];
  if (dataset.affiliates.length === 0) return { available: false, byKind: [], creators: [], videos: [], notes };

  // Profit by attribution key on orders: "affiliate:<creator>" / "video:<id>".
  const profits = computeProfitByGroup(slice, (o) => (o.channel && o.channel.includes(':') ? o.channel : null), { adsFor: () => [] });
  const attributed = profits.size > 0;
  if (!attributed) {
    notes.push({
      vi: 'Đơn hàng không ghi nguồn affiliate/video cụ thể — chưa tính được lợi nhuận theo từng nhà sáng tạo/video (chỉ có số liệu từ báo cáo).',
      en: 'Orders do not carry creator/video attribution — profit per creator/video unavailable.',
    });
  }

  const build = (key: string, rows: AffiliatePerformance[], prevRows: AffiliatePerformance[], attributionKey: string): ContentRow => {
    const r0 = rows[0];
    const views = sumOrNull(rows, (r) => r.views);
    const clicks = sumOrNull(rows, (r) => r.clicks);
    const orders = sumOrNull(rows, (r) => r.orders);
    const gmv = sumOrNull(rows, (r) => r.gmv);
    const commission = sumOrNull(rows, (r) => r.commission);
    const p = profits.get(attributionKey);
    return {
      key,
      kind: (r0.contentType ?? 'affiliate') as ContentKind,
      platform: r0.platform,
      creatorId: r0.creatorId,
      contentId: r0.contentId,
      title: r0.contentTitle,
      views,
      clicks,
      orders,
      gmv,
      commission,
      ctr: views && clicks !== null ? clicks / views : null,
      cvr: clicks && orders !== null ? orders / clicks : null,
      commissionRate: gmv && commission !== null ? commission / gmv : null,
      profit: p?.profit.value ?? null,
      margin: p?.margin.value ?? null,
      // No content data at all in the previous period → no comparison (not "new").
      gmvChange: compareValues(gmv, prevSlice && prevSlice.affiliates.length > 0 ? sumOrNull(prevRows, (r) => r.gmv) ?? 0 : null, 'vnd'),
    };
  };

  const group = (rows: AffiliatePerformance[], keyOf: (r: AffiliatePerformance) => string) => {
    const map = new Map<string, AffiliatePerformance[]>();
    for (const r of rows) {
      const k = keyOf(r);
      const list = map.get(k);
      if (list) list.push(r);
      else map.set(k, [r]);
    }
    return map;
  };

  const creatorRows = slice.affiliates.filter((a) => (a.contentType ?? 'affiliate') === 'affiliate' || a.contentType === 'creator');
  const videoRows = slice.affiliates.filter((a) => a.contentType === 'shop_video' || a.contentType === 'organic_video' || (a.contentId && (a.contentType ?? 'affiliate') === 'affiliate'));
  const prevCreators = prevSlice ? group(prevSlice.affiliates, (a) => `${a.platform}|${a.creatorId}`) : new Map();
  const prevVideos = prevSlice ? group(prevSlice.affiliates.filter((a) => a.contentId), (a) => `${a.platform}|${a.contentId}`) : new Map();

  const creators = [...group(creatorRows, (a) => `${a.platform}|${a.creatorId}`)].map(([k, rows]) => build(k, rows, prevCreators.get(k) ?? [], `affiliate:${rows[0].creatorId}`));
  const videos = [...group(videoRows.filter((a) => a.contentId), (a) => `${a.platform}|${a.contentId}`)].map(([k, rows]) => build(k, rows, prevVideos.get(k) ?? [], `video:${rows[0].contentId}`));
  creators.sort((a, b) => (b.gmv ?? 0) - (a.gmv ?? 0));
  videos.sort((a, b) => (b.gmv ?? 0) - (a.gmv ?? 0));

  const kinds: ContentKind[] = ['affiliate', 'shop_video', 'organic_video', 'creator'];
  const byKind = kinds
    .map((kind) => {
      const rows = slice.affiliates.filter((a) => (a.contentType ?? 'affiliate') === kind);
      return {
        kind,
        gmv: rows.reduce((s, r) => s + (r.gmv || 0), 0),
        orders: rows.reduce((s, r) => s + (r.orders || 0), 0),
        commission: rows.reduce((s, r) => s + (r.commission || 0), 0),
        items: new Set(rows.map((r) => r.contentId ?? r.creatorId)).size,
      };
    })
    .filter((k) => k.items > 0);

  if (slice.affiliates.some((a) => a.periodStart)) {
    notes.push({ vi: 'Một số dòng là số tổng cả kỳ — chỉ được tính khi bạn chọn trọn kỳ báo cáo.', en: 'Some rows are period totals — counted only for the full report period.' });
  }
  return { available: true, byKind, creators, videos, notes };
}

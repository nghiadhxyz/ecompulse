/**
 * Growth engines: Ads Intelligence, Live Auditor, Video & Affiliate.
 * All built on the same slice / profit engine as the rest of the analytics.
 */
import type { AffiliatePerformance, CanonicalDataset, LiveSession, Platform } from './model';
import { sliceDataset, type DatasetFilter } from './filters';
import { adsSummary, liveSessions, type AdCampaignRow, type LiveSessionRow } from './adsLiveEngine';
import { computeProfitByGroup } from './profitEngine';
import { liveFunnel, type Funnel } from './funnelEngine';
import { compareValues, type Comparison } from './comparisonEngine';
import { safeDivide, type Bilingual } from './metric';
import { enumerateDays } from './period';
import { weekdayIndex } from './campaignEngine';

// ============================================================ ADS INTELLIGENCE

export type AdEfficiency = 'profitable' | 'below_break_even' | 'unknown';

export interface AdsIntelligence {
  available: boolean;
  campaigns: (AdCampaignRow & { efficiency: AdEfficiency; spendShare: number | null })[];
  totals: ReturnType<typeof adsSummary>['totals'];
  daily: { date: string; spend: number; revenue: number | null; roas: number | null; clicks: number | null }[];
  byPlatform: { platform: Platform; spend: number; revenue: number | null; roas: number | null; profitAfterAds: number | null }[];
  /** Spend on campaigns below break-even ROAS. */
  spendBelowBreakEven: number;
  /** Period-total rows cannot be split by day and are excluded from the daily chart. */
  periodRowsExcludedFromDaily: number;
  notes: Bilingual[];
}

export function adsIntelligence(dataset: CanonicalDataset, filter: DatasetFilter): AdsIntelligence {
  const summary = adsSummary(dataset, filter);
  const slice = sliceDataset(dataset, filter);
  const totalSpend = summary.totals.spend;
  const campaigns = summary.rows.map((r) => ({
    ...r,
    efficiency: (r.roas === null || r.breakEvenRoas === null ? 'unknown' : r.roas >= r.breakEvenRoas ? 'profitable' : 'below_break_even') as AdEfficiency,
    spendShare: totalSpend > 0 ? r.spend / totalSpend : null,
  }));
  const dailyRows = slice.ads.filter((a) => a.periodStart === undefined);
  const daily = enumerateDays(filter.range).map((date) => {
    const rows = dailyRows.filter((a) => a.date === date);
    const spend = rows.reduce((s, a) => s + (a.spend || 0), 0);
    const hasRev = rows.some((a) => typeof a.attributedRevenue === 'number');
    const revenue = hasRev ? rows.reduce((s, a) => s + (a.attributedRevenue || 0), 0) : null;
    const hasClicks = rows.some((a) => typeof a.clicks === 'number');
    return { date, spend, revenue, roas: revenue !== null ? safeDivide(revenue, spend) : null, clicks: hasClicks ? rows.reduce((s, a) => s + (a.clicks || 0), 0) : null };
  });
  const platforms = Array.from(new Set(campaigns.map((c) => c.platform)));
  const byPlatform = platforms.map((platform) => {
    const rows = campaigns.filter((c) => c.platform === platform);
    const spend = rows.reduce((s, c) => s + c.spend, 0);
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
  const periodRows = slice.ads.length - dailyRows.length;
  const notes: Bilingual[] = [];
  if (periodRows > 0) {
    notes.push({
      vi: `${periodRows} dòng Ads là số tổng cả kỳ (không theo ngày) — có trong bảng chiến dịch nhưng không vẽ được theo ngày.`,
      en: `${periodRows} ad rows are period totals — included in campaign totals, not in the daily chart.`,
    });
  }
  return {
    available: summary.available,
    campaigns,
    totals: summary.totals,
    daily,
    byPlatform,
    spendBelowBreakEven: campaigns.filter((c) => c.efficiency === 'below_break_even').reduce((s, c) => s + c.spend, 0),
    periodRowsExcludedFromDaily: periodRows,
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
  byDuration: LiveGroupStats[];
  funnel: Funnel;
  totals: { sessions: number; hours: number | null; gmv: number; orders: number; gmvPerHour: number | null };
  notes: Bilingual[];
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
  const viewersRows = rows.filter((r) => typeof r.session.viewers === 'number');
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

export function liveAudit(dataset: CanonicalDataset, filter: DatasetFilter): LiveAudit {
  const sessions = liveSessions(dataset, filter);
  const ranking = [...sessions].filter((r) => r.gmvPerHour !== null).sort((a, b) => (b.gmvPerHour ?? 0) - (a.gmvPerHour ?? 0));
  const hourOf = (s: LiveSession) => (s.startTime ? Number(s.startTime.slice(0, 2)) : null);
  const withTime = sessions.filter((r) => hourOf(r.session) !== null);
  const byTimeSlot = SLOTS.map((slot) => groupStats(slot.key, slot.label, withTime.filter((r) => hourOf(r.session)! >= slot.from && hourOf(r.session)! < slot.to))).filter((g) => g.sessions > 0);
  const byWeekday = WEEKDAYS.map((label, i) => groupStats(String(i), label, sessions.filter((r) => weekdayIndex(r.session.date) === i))).filter((g) => g.sessions > 0);
  const byDuration = DURATIONS.map((d) =>
    groupStats(d.key, d.label, sessions.filter((r) => r.session.durationMinutes !== undefined && r.session.durationMinutes >= d.from && r.session.durationMinutes < d.to)),
  ).filter((g) => g.sessions > 0);
  const withHours = sessions.filter((r) => r.durationHours);
  const hours = withHours.length ? withHours.reduce((s, r) => s + (r.durationHours || 0), 0) : null;
  const gmv = sessions.reduce((s, r) => s + (r.session.gmv || 0), 0);
  const notes: Bilingual[] = [];
  if (sessions.length > 0 && withTime.length < sessions.length) {
    notes.push({ vi: `${sessions.length - withTime.length} phiên không có giờ bắt đầu — không xếp được vào khung giờ.`, en: `${sessions.length - withTime.length} sessions have no start time.` });
  }
  if (sessions.length > 0 && sessions.length < 8) {
    notes.push({ vi: 'Số phiên live còn ít — so sánh theo khung giờ/thứ chỉ mang tính tham khảo.', en: 'Few sessions — slot/weekday comparisons are indicative only.' });
  }
  return {
    sessions,
    ranking,
    byTimeSlot,
    byWeekday,
    byDuration,
    funnel: liveFunnel(dataset, filter.range, filter.platforms),
    totals: { sessions: sessions.length, hours, gmv, orders: sessions.reduce((s, r) => s + (r.session.orders || 0), 0), gmvPerHour: hours ? withHours.reduce((s, r) => s + (r.session.gmv || 0), 0) / hours : null },
    notes,
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
      gmvChange: compareValues(gmv, prevSlice ? sumOrNull(prevRows, (r) => r.gmv) ?? (previousRange ? 0 : null) : null, 'vnd'),
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

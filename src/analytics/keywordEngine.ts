/**
 * Keyword Explorer — the shop-level take on Amazon's Product Opportunity Explorer.
 *
 * Performance (search-ad keyword rows), each keyword gets one class with its reasons:
 *   little_data       — fewer than KW_MIN_CLICKS clicks and no order yet
 *   waste             — ≥ KW_MIN_CLICKS clicks, no order
 *   below_break_even  — ROAS < break-even ROAS of the advertised SKU
 *                       (or < LIKELY_LOSS_ROAS when no margin is known)
 *   too_broad         — CTR < half the keywords' CTR on ≥ KW_BROAD_IMPRESSIONS impressions
 *   scale             — ≥ KW_SCALE_MIN_ORDERS orders and ROAS ≥ KW_SCALE_FACTOR × break-even
 *                       (× the keywords' ROAS when no margin is known)
 *   keep              — everything else
 * Trend: impressions per normal day (sale days left out), second half of the range vs first.
 *
 * Opportunities (keyword planner snapshot): demand = search volume, trend = vs the window
 * before, competition = suggested bid against the median suggested bid. The score is a
 * transparent weighting of the three, not a forecast. Marketplace-wide data (other
 * sellers' sales) is not available to a shop — competition is an estimate from bids.
 */
import type { CanonicalDataset, KeywordMatchType, KeywordPerformance, Platform } from './model';
import { getDatasetIndex, sliceDataset, type DatasetFilter } from './filters';
import { adMarginResolver } from './adsLiveEngine';
import { breakEvenRoas, profitAfterAds } from './adsFormulas';
import { LIKELY_LOSS_ROAS } from './growthEngines';
import { campaignCalendar } from './campaignEngine';
import { enumerateDays, isInRange } from './period';
import { normalizeHeader } from './parse';
import { safeDivide, type Bilingual } from './metric';
import { fmtMultiple, fmtRate } from './format';

export type KeywordClass = 'scale' | 'keep' | 'too_broad' | 'below_break_even' | 'waste' | 'little_data';

/** Clicks needed before "no order" means something. */
export const KW_MIN_CLICKS = 30;
export const KW_BROAD_IMPRESSIONS = 1000;
export const KW_SCALE_FACTOR = 1.5;
export const KW_SCALE_MIN_ORDERS = 3;
/** Normal days needed in each half of the range to show a trend. */
const TREND_MIN_DAYS = 5;

export const KEYWORD_CLASS_LABELS: Record<KeywordClass, { label: Bilingual; action: Bilingual }> = {
  scale: { label: { vi: 'Đẩy mạnh', en: 'Scale' }, action: { vi: 'Tăng giá thầu hoặc ngân sách', en: 'Raise the bid or budget' } },
  keep: { label: { vi: 'Duy trì', en: 'Keep' }, action: { vi: 'Giữ nguyên và theo dõi', en: 'Keep and monitor' } },
  too_broad: { label: { vi: 'Quá rộng', en: 'Too broad' }, action: { vi: 'Thu hẹp: dùng đối sánh chính xác hoặc từ khóa dài hơn', en: 'Narrow it: exact match or a longer keyword' } },
  below_break_even: { label: { vi: 'Dưới hòa vốn', en: 'Below break-even' }, action: { vi: 'Giảm giá thầu hoặc tạm dừng', en: 'Lower the bid or pause' } },
  waste: { label: { vi: 'Lãng phí', en: 'Wasted spend' }, action: { vi: 'Tạm dừng hoặc thêm vào từ khóa loại trừ', en: 'Pause or add as a negative keyword' } },
  little_data: { label: { vi: 'Chưa đủ dữ liệu', en: 'Not enough data' }, action: { vi: `Chờ đủ ${KW_MIN_CLICKS} lượt click rồi đánh giá`, en: `Wait for ${KW_MIN_CLICKS} clicks` } },
};

export const MATCH_TYPE_LABELS: Record<KeywordMatchType, Bilingual> = {
  broad: { vi: 'Đối sánh rộng', en: 'Broad' },
  exact: { vi: 'Đối sánh chính xác', en: 'Exact' },
  phrase: { vi: 'Đối sánh cụm từ', en: 'Phrase' },
  other: { vi: 'Khác', en: 'Other' },
};

export interface KeywordRow {
  key: string;
  keyword: string;
  platform: Platform;
  matchType?: KeywordMatchType;
  adName?: string;
  sku?: string;
  /** Bid on the latest day of the range. */
  bid: number | null;
  impressions: number | null;
  clicks: number | null;
  orders: number | null;
  gmv: number | null;
  spend: number;
  spendShare: number | null;
  ctr: number | null;
  cpc: number | null;
  cvr: number | null;
  cpa: number | null;
  roas: number | null;
  acos: number | null;
  /** Impression-weighted average position. */
  avgPosition: number | null;
  breakEvenRoas: number | null;
  marginIsEstimate: boolean;
  profitAfterAds: number | null;
  /** Normal-day impressions, second half vs first half of the range; null = not measurable. */
  trend: number | null;
  classification: KeywordClass;
  reasons: Bilingual[];
}

export type Competition = 'low' | 'medium' | 'high';
export type OpportunityVerdict = 'new' | 'rising' | 'crowded' | 'declining' | 'stable';

export const COMPETITION_LABELS: Record<Competition, Bilingual> = {
  low: { vi: 'Thấp', en: 'Low' },
  medium: { vi: 'Trung bình', en: 'Medium' },
  high: { vi: 'Cao', en: 'High' },
};

export const VERDICT_LABELS: Record<OpportunityVerdict, Bilingual> = {
  new: { vi: 'Cơ hội mới', en: 'New opportunity' },
  rising: { vi: 'Nhu cầu đang lên', en: 'Rising demand' },
  crowded: { vi: 'Cạnh tranh cao', en: 'Crowded' },
  declining: { vi: 'Nhu cầu đang giảm', en: 'Declining' },
  stable: { vi: 'Ổn định', en: 'Stable' },
};

export interface KeywordOpportunity {
  keyword: string;
  platform: Platform;
  searchVolume: number | null;
  previousSearchVolume: number | null;
  growth: number | null;
  suggestedBid: number | null;
  competition: Competition | null;
  running: boolean;
  /** 0–100: demand 45%, growth 35%, low bid 20%. */
  score: number | null;
  verdict: OpportunityVerdict;
  reasons: Bilingual[];
  /** The running keyword's class in the analysed range, when it runs. */
  performance: KeywordClass | null;
  roas: number | null;
}

export interface KeywordDailyPoint {
  date: string;
  impressions: number;
  clicks: number;
  orders: number;
  spend: number;
  saleDay: boolean;
}

export interface KeywordIntelligence {
  /** Any keyword rows or planner rows in the dataset. */
  available: boolean;
  /** Keyword rows inside the selected range. */
  rows: KeywordRow[];
  totals: {
    impressions: number | null;
    clicks: number | null;
    orders: number | null;
    gmv: number | null;
    spend: number;
    ctr: number | null;
    cvr: number | null;
    cpc: number | null;
    roas: number | null;
    acos: number | null;
  };
  counts: Record<KeywordClass, number>;
  spendByClass: Record<KeywordClass, number>;
  /** Days of each keyword (daily rows only), for the trend chart. */
  dailyByKey: Record<string, KeywordDailyPoint[]>;
  /** Keyword rows of the dataset that are period totals outside the range. */
  periodRowsOutside: number;
  opportunities: KeywordOpportunity[];
  medianSuggestedBid: number | null;
  notes: Bilingual[];
}

const CLASSES: KeywordClass[] = ['scale', 'keep', 'too_broad', 'below_break_even', 'waste', 'little_data'];
const zeroByClass = () => Object.fromEntries(CLASSES.map((c) => [c, 0])) as Record<KeywordClass, number>;

function sumOrNull(rows: KeywordPerformance[], pick: (k: KeywordPerformance) => number | undefined): number | null {
  return rows.some((r) => typeof pick(r) === 'number') ? rows.reduce((s, r) => s + (pick(r) || 0), 0) : null;
}

const median = (xs: number[]) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/** Keyword rows of the range: days inside it, period totals only when the whole period is inside. */
function keywordsInRange(dataset: CanonicalDataset, filter: DatasetFilter): KeywordPerformance[] {
  const index = getDatasetIndex(dataset);
  const set = (a?: string[]) => (a && a.length > 0 ? new Set(a) : null);
  const skus = set(filter.skus);
  const cats = set(filter.categories);
  const subs = set(filter.subcategories);
  const productFiltered = !!(skus || cats || subs);
  return (dataset.keywords ?? []).filter((k) => {
    if (!isInRange(k.date, filter.range)) return false;
    if (k.periodStart !== undefined && k.periodStart < filter.range.start) return false;
    if (filter.platforms?.length && !filter.platforms.includes(k.platform)) return false;
    if (!productFiltered) return true;
    if (!k.sku) return false;
    return (!skus || skus.has(k.sku)) && (!cats || cats.has(index.categoryBySku.get(k.sku) || '')) && (!subs || subs.has(index.subcategoryBySku.get(k.sku) || ''));
  });
}

export function keywordIntelligence(dataset: CanonicalDataset, filter: DatasetFilter): KeywordIntelligence {
  const all = dataset.keywords ?? [];
  const suggestions = (dataset.keywordSuggestions ?? []).filter((s) => !filter.platforms?.length || filter.platforms.includes(s.platform));
  const rowsInRange = keywordsInRange(dataset, filter);
  const marginOf = adMarginResolver(dataset, sliceDataset(dataset, filter));
  const notes: Bilingual[] = [];

  // Sale days are left out of the trend so a mega sale does not fake growth.
  const saleDays = new Set<string>();
  for (const c of campaignCalendar(dataset, filter.range)) for (const d of enumerateDays(c.range)) saleDays.add(d);
  const normalDays = enumerateDays(filter.range).filter((d) => !saleDays.has(d));
  const half = Math.floor(normalDays.length / 2);
  const firstHalf = new Set(normalDays.slice(0, half));
  const secondHalf = new Set(normalDays.slice(normalDays.length - half));

  const groups = new Map<string, KeywordPerformance[]>();
  for (const k of rowsInRange) {
    const key = `${k.platform}|${k.adName ?? ''}|${k.sku ?? ''}|${normalizeHeader(k.keyword)}|${k.matchType ?? ''}`;
    const list = groups.get(key);
    if (list) list.push(k);
    else groups.set(key, [k]);
  }

  const totalSpend = rowsInRange.reduce((s, k) => s + (k.spend ?? 0), 0);
  const totalImpr = sumOrNull(rowsInRange, (k) => k.impressions);
  const totalClicks = sumOrNull(rowsInRange, (k) => k.clicks);
  const totalOrders = sumOrNull(rowsInRange, (k) => k.orders);
  const totalGmv = sumOrNull(rowsInRange, (k) => k.gmv);
  const avgCtr = totalClicks !== null && totalImpr !== null ? safeDivide(totalClicks, totalImpr) : null;
  const avgRoas = totalGmv !== null ? safeDivide(totalGmv, totalSpend) : null;

  const dailyByKey: Record<string, KeywordDailyPoint[]> = {};
  const rows: KeywordRow[] = Array.from(groups.entries()).map(([key, list]) => {
    const first = list[0];
    const spend = list.reduce((s, k) => s + (k.spend ?? 0), 0);
    const impressions = sumOrNull(list, (k) => k.impressions);
    const clicks = sumOrNull(list, (k) => k.clicks);
    const orders = sumOrNull(list, (k) => k.orders);
    const gmv = sumOrNull(list, (k) => k.gmv);
    const positioned = list.filter((k) => k.avgPosition !== undefined && (k.impressions ?? 0) > 0);
    const posWeight = positioned.reduce((s, k) => s + (k.impressions ?? 0), 0);
    const latest = [...list].sort((a, b) => b.date.localeCompare(a.date)).find((k) => k.bid !== undefined);
    const m = marginOf(first.sku);
    const be = breakEvenRoas(m.margin);
    const roas = gmv !== null ? safeDivide(gmv, spend) : null;
    const ctr = clicks !== null && impressions !== null ? safeDivide(clicks, impressions) : null;

    const daily = list.filter((k) => k.periodStart === undefined);
    let trend: number | null = null;
    if (daily.length > 0) {
      dailyByKey[key] = enumerateDays(filter.range).map((date) => {
        const day = daily.filter((k) => k.date === date);
        return {
          date,
          impressions: day.reduce((s, k) => s + (k.impressions ?? 0), 0),
          clicks: day.reduce((s, k) => s + (k.clicks ?? 0), 0),
          orders: day.reduce((s, k) => s + (k.orders ?? 0), 0),
          spend: day.reduce((s, k) => s + (k.spend ?? 0), 0),
          saleDay: saleDays.has(date),
        };
      });
      if (half >= TREND_MIN_DAYS) {
        const perDay = (days: Set<string>) => daily.filter((k) => days.has(k.date)).reduce((s, k) => s + (k.impressions ?? 0), 0) / days.size;
        const a = perDay(firstHalf);
        const b = perDay(secondHalf);
        // Below ~3 impressions a day the ratio is noise.
        trend = a >= 3 ? b / a - 1 : null;
      }
    }

    const reasons: Bilingual[] = [];
    let classification: KeywordClass;
    const fewClicks = (clicks ?? 0) < KW_MIN_CLICKS;
    const noOrder = !orders;
    const broad = avgCtr !== null && ctr !== null && (impressions ?? 0) >= KW_BROAD_IMPRESSIONS && ctr < avgCtr / 2;
    if (noOrder && fewClicks) {
      classification = 'little_data';
      reasons.push({ vi: `Mới có ${clicks ?? 0} lượt click và chưa có đơn — chưa đủ để kết luận.`, en: `Only ${clicks ?? 0} clicks, no order yet.` });
    } else if (noOrder) {
      classification = 'waste';
      reasons.push({ vi: `${clicks} lượt click nhưng không có đơn nào.`, en: `${clicks} clicks, no order.` });
    } else if (roas !== null && (be !== null ? roas < be : roas < LIKELY_LOSS_ROAS)) {
      classification = 'below_break_even';
      reasons.push(
        be !== null
          ? { vi: `ROAS ${fmtMultiple(roas, 'vi')} thấp hơn ROAS hòa vốn ${fmtMultiple(be, 'vi')} của sản phẩm.`, en: `ROAS ${fmtMultiple(roas, 'en')} below break-even ${fmtMultiple(be, 'en')}.` }
          : { vi: `ROAS ${fmtMultiple(roas, 'vi')} dưới ${fmtMultiple(LIKELY_LOSS_ROAS, 'vi')} — gần như chắc chắn lỗ.`, en: `ROAS ${fmtMultiple(roas, 'en')} below ${fmtMultiple(LIKELY_LOSS_ROAS, 'en')}.` },
      );
    } else if (broad) {
      classification = 'too_broad';
    } else if (roas !== null && (orders ?? 0) >= KW_SCALE_MIN_ORDERS && (be ?? avgRoas) !== null && roas >= KW_SCALE_FACTOR * (be ?? avgRoas!)) {
      classification = 'scale';
      reasons.push(
        be !== null
          ? { vi: `ROAS ${fmtMultiple(roas, 'vi')} ≥ ${KW_SCALE_FACTOR} × hòa vốn (${fmtMultiple(be, 'vi')}) với ${orders} đơn.`, en: `ROAS ${fmtMultiple(roas, 'en')} ≥ ${KW_SCALE_FACTOR} × break-even with ${orders} orders.` }
          : { vi: `ROAS ${fmtMultiple(roas, 'vi')} ≥ ${KW_SCALE_FACTOR} × ROAS chung của các từ khóa với ${orders} đơn (chưa có giá vốn để tính hòa vốn).`, en: `ROAS ${fmtMultiple(roas, 'en')} ≥ ${KW_SCALE_FACTOR} × the keywords' ROAS (no COGS for break-even).` },
      );
    } else {
      classification = 'keep';
    }
    if (broad) {
      reasons.push({
        vi: `CTR ${fmtRate(ctr, 'vi', 2)} chưa bằng một nửa CTR chung (${fmtRate(avgCtr, 'vi', 2)}) trên ${impressions?.toLocaleString('vi-VN')} lượt xem — từ khóa có thể quá rộng.`,
        en: `CTR ${fmtRate(ctr, 'en', 2)} is under half the average (${fmtRate(avgCtr, 'en', 2)}) — possibly too broad.`,
      });
    }
    if (trend !== null && Math.abs(trend) >= 0.2) {
      reasons.push(
        trend > 0
          ? { vi: `Lượt xem ngày thường tăng ${fmtRate(trend, 'vi', 0)} ở nửa sau của kỳ.`, en: `Normal-day impressions up ${fmtRate(trend, 'en', 0)} in the second half.` }
          : { vi: `Lượt xem ngày thường giảm ${fmtRate(-trend, 'vi', 0)} ở nửa sau của kỳ.`, en: `Normal-day impressions down ${fmtRate(-trend, 'en', 0)} in the second half.` },
      );
    }
    if (classification !== 'little_data' && (orders ?? 0) > 0 && (orders ?? 0) < 5) {
      reasons.push({ vi: `Chỉ có ${orders} đơn — kết luận còn dễ thay đổi.`, en: `Only ${orders} orders — tentative.` });
    }

    return {
      key,
      keyword: first.keyword,
      platform: first.platform,
      matchType: first.matchType,
      adName: first.adName,
      sku: first.sku,
      bid: latest?.bid ?? null,
      impressions,
      clicks,
      orders,
      gmv,
      spend,
      spendShare: totalSpend ? spend / totalSpend : null,
      ctr,
      cpc: clicks !== null ? safeDivide(spend, clicks) : null,
      cvr: orders !== null && clicks !== null ? safeDivide(orders, clicks) : null,
      cpa: orders !== null ? safeDivide(spend, orders) : null,
      roas,
      acos: gmv !== null ? safeDivide(spend, gmv) : null,
      avgPosition: posWeight > 0 ? positioned.reduce((s, k) => s + k.avgPosition! * (k.impressions ?? 0), 0) / posWeight : null,
      breakEvenRoas: be,
      marginIsEstimate: m.isEstimate,
      profitAfterAds: gmv !== null ? profitAfterAds(gmv, spend, m.margin) : null,
      trend,
      classification,
      reasons,
    };
  });
  rows.sort((a, b) => b.spend - a.spend);

  const counts = zeroByClass();
  const spendByClass = zeroByClass();
  for (const r of rows) {
    counts[r.classification]++;
    spendByClass[r.classification] += r.spend;
  }

  // ---------------- Opportunities (planner snapshot)
  const bids = suggestions.map((s) => s.suggestedBid).filter((b): b is number => typeof b === 'number' && b > 0);
  const medianBid = median(bids);
  const maxBid = bids.length ? Math.max(...bids) : null;
  const volumes = suggestions.map((s) => s.searchVolume).filter((v): v is number => typeof v === 'number' && v > 0);
  const maxLogVolume = volumes.length ? Math.log10(Math.max(...volumes) + 1) : null;
  const runningKeywords = new Map<string, KeywordRow>();
  for (const r of rows) {
    const k = normalizeHeader(r.keyword);
    const prev = runningKeywords.get(k);
    if (!prev || r.spend > prev.spend) runningKeywords.set(k, r);
  }
  const everRunning = new Set(all.map((k) => normalizeHeader(k.keyword)));

  const opportunities: KeywordOpportunity[] = suggestions.map((s) => {
    const norm = normalizeHeader(s.keyword);
    const volume = s.searchVolume ?? null;
    const previous = s.previousSearchVolume ?? null;
    const growth = volume !== null && previous ? volume / previous - 1 : null;
    const bid = s.suggestedBid ?? null;
    const competition: Competition | null = bid === null || medianBid === null ? null : bid <= 0.8 * medianBid ? 'low' : bid >= 1.25 * medianBid ? 'high' : 'medium';
    const running = s.running ?? everRunning.has(norm);
    const perf = runningKeywords.get(norm) ?? null;
    let score: number | null = null;
    if (volume !== null && maxLogVolume) {
      const demand = Math.log10(volume + 1) / maxLogVolume;
      const g = growth === null ? 0.5 / 1.5 : (Math.min(Math.max(growth, -0.5), 1) + 0.5) / 1.5;
      const cheap = bid !== null && maxBid ? 1 - bid / maxBid : 0.5;
      score = Math.round(100 * (0.45 * demand + 0.35 * g + 0.2 * cheap));
    }
    const reasons: Bilingual[] = [];
    if (growth !== null) {
      reasons.push(
        growth >= 0
          ? { vi: `Lượt tìm kiếm tăng ${fmtRate(growth, 'vi', 0)} so với 30 ngày trước.`, en: `Searches up ${fmtRate(growth, 'en', 0)} vs the window before.` }
          : { vi: `Lượt tìm kiếm giảm ${fmtRate(-growth, 'vi', 0)} so với 30 ngày trước.`, en: `Searches down ${fmtRate(-growth, 'en', 0)}.` },
      );
    }
    if (competition && medianBid !== null) {
      reasons.push({
        vi: `Giá thầu đề xuất ${bid!.toLocaleString('vi-VN')}đ so với trung vị ${Math.round(medianBid).toLocaleString('vi-VN')}đ → cạnh tranh ${COMPETITION_LABELS[competition].vi.toLowerCase()}.`,
        en: `Suggested bid ${bid} vs median ${Math.round(medianBid)} → ${COMPETITION_LABELS[competition].en.toLowerCase()} competition.`,
      });
    }
    if (perf) {
      reasons.push({
        vi: `Đang chạy: ${KEYWORD_CLASS_LABELS[perf.classification].label.vi.toLowerCase()}${perf.roas !== null ? `, ROAS ${fmtMultiple(perf.roas, 'vi')}` : ''}.`,
        en: `Running: ${KEYWORD_CLASS_LABELS[perf.classification].label.en.toLowerCase()}${perf.roas !== null ? `, ROAS ${fmtMultiple(perf.roas, 'en')}` : ''}.`,
      });
    }
    const verdict: OpportunityVerdict =
      !running && growth !== null && growth >= 0.2 && competition !== 'high'
        ? 'new'
        : growth !== null && growth >= 0.2
          ? 'rising'
          : competition === 'high'
            ? 'crowded'
            : growth !== null && growth <= -0.1
              ? 'declining'
              : 'stable';
    return {
      keyword: s.keyword,
      platform: s.platform,
      searchVolume: volume,
      previousSearchVolume: previous,
      growth,
      suggestedBid: bid,
      competition,
      running,
      score,
      verdict,
      reasons,
      performance: perf?.classification ?? null,
      roas: perf?.roas ?? null,
    };
  });
  opportunities.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  const periodRowsOutside = all.filter((k) => k.periodStart !== undefined).length - rowsInRange.filter((k) => k.periodStart !== undefined).length;
  if (rows.some((r) => r.marginIsEstimate)) {
    notes.push({ vi: 'Chưa có giá vốn cho một số SKU — ROAS hòa vốn dùng biên lợi nhuận ước tính bạn nhập ở Cài đặt.', en: 'Some SKUs lack COGS — break-even uses your Settings estimate.' });
  }
  if (rows.length > 0 && rows.every((r) => r.breakEvenRoas === null)) {
    notes.push({
      vi: `Chưa tính được ROAS hòa vốn (thiếu giá vốn) — "Dưới hòa vốn" dùng ngưỡng ROAS ${fmtMultiple(LIKELY_LOSS_ROAS, 'vi')}, "Đẩy mạnh" so với ROAS chung của các từ khóa. Nhập danh mục giá vốn để đánh giá chính xác hơn.`,
      en: `No break-even ROAS (COGS missing) — fallback thresholds used. Import a COGS catalog for a sharper verdict.`,
    });
  }

  return {
    available: all.length > 0 || suggestions.length > 0,
    rows,
    totals: {
      impressions: totalImpr,
      clicks: totalClicks,
      orders: totalOrders,
      gmv: totalGmv,
      spend: totalSpend,
      ctr: avgCtr,
      cvr: totalOrders !== null && totalClicks !== null ? safeDivide(totalOrders, totalClicks) : null,
      cpc: totalClicks !== null ? safeDivide(totalSpend, totalClicks) : null,
      roas: avgRoas,
      acos: totalGmv !== null ? safeDivide(totalSpend, totalGmv) : null,
    },
    counts,
    spendByClass,
    dailyByKey,
    periodRowsOutside,
    opportunities,
    medianSuggestedBid: medianBid,
    notes,
  };
}

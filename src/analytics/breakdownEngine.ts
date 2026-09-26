/**
 * Breakdown Engine — the same KPI set for every member of a dimension, with the
 * comparable previous period, comparison and contribution to the GMV change.
 *
 * Powers Category → Niche → SKU drill-down, Revenue & Profit by dimension and
 * Order Health by dimension. Built on the profit engine (one pass per period).
 *
 * Counting rule for line-level dimensions (category, SKU, combo…): an order that
 * contains several members counts once for each member, so member order counts can
 * add up to more than the shop total. GMV, units and profit always add up.
 */
import type { AdPerformance, CanonicalDataset, Order, OrderLine, Platform } from './model';
import { PLATFORM_LABELS } from './model';
import { getDatasetIndex, sliceDataset, type DatasetFilter, type DatasetSlice } from './filters';
import { computeProfitByGroup, type ProfitResult } from './profitEngine';
import { computeContribution } from './contributionEngine';
import { compareValues, type Comparison } from './comparisonEngine';
import { isCancelled, isReturnOrRefund } from './status';
import { addDays, isInRange, toDayNumber, type DateRange } from './period';
import { fmtDay, sessionDateLabel } from './format';

export type BreakdownDimension =
  | 'platform'
  | 'category'
  | 'subcategory'
  | 'sku'
  | 'combo'
  | 'campaign'
  | 'liveSession'
  | 'channel'
  | 'day'
  | 'week'
  | 'month';

export const DIMENSION_LABELS: Record<BreakdownDimension, { vi: string; en: string }> = {
  platform: { vi: 'Sàn', en: 'Platform' },
  category: { vi: 'Ngành hàng', en: 'Category' },
  subcategory: { vi: 'Nhóm hàng (niche)', en: 'Niche' },
  sku: { vi: 'SKU', en: 'SKU' },
  combo: { vi: 'Combo', en: 'Combo' },
  campaign: { vi: 'Chiến dịch Ads', en: 'Ad campaign' },
  liveSession: { vi: 'Phiên live', en: 'Live session' },
  channel: { vi: 'Kênh bán', en: 'Channel' },
  day: { vi: 'Ngày', en: 'Day' },
  week: { vi: 'Tuần', en: 'Week' },
  month: { vi: 'Tháng', en: 'Month' },
};

export const NONE_KEY = '__none__';

const LINE_LEVEL: BreakdownDimension[] = ['category', 'subcategory', 'sku', 'combo'];

/** Monday of the ISO week containing `date`. */
export function weekStart(date: string): string {
  const dow = (toDayNumber(date) + 3) % 7; // 1970-01-01 was a Thursday → Monday = 0
  return addDays(date, -dow);
}

function keyFn(dataset: CanonicalDataset, dim: BreakdownDimension): (o: Order, l: OrderLine) => string {
  const index = getDatasetIndex(dataset);
  switch (dim) {
    case 'platform':
      return (o) => o.platform;
    case 'category':
      return (_o, l) => index.categoryBySku.get(l.sku) ?? NONE_KEY;
    case 'subcategory':
      return (_o, l) => index.subcategoryBySku.get(l.sku) ?? NONE_KEY;
    case 'sku':
      return (_o, l) => l.sku;
    case 'combo':
      return (_o, l) => l.comboId ?? NONE_KEY;
    case 'campaign':
      return (o) => o.campaignId ?? NONE_KEY;
    case 'liveSession':
      return (o) => o.liveSessionId ?? NONE_KEY;
    case 'channel':
      return (o) => (o.channel ? o.channel.split(':')[0] : NONE_KEY);
    case 'day':
      return (o) => o.orderDate;
    case 'week':
      return (o) => weekStart(o.orderDate);
    case 'month':
      return (o) => o.orderDate.slice(0, 7);
  }
}

export function dimensionMemberLabel(dataset: CanonicalDataset, dim: BreakdownDimension, key: string, lang: 'vi' | 'en' = 'vi'): string {
  if (key === NONE_KEY) {
    const none: Partial<Record<BreakdownDimension, { vi: string; en: string }>> = {
      combo: { vi: 'Sản phẩm lẻ (không combo)', en: 'Single items (no combo)' },
      campaign: { vi: 'Không qua quảng cáo', en: 'Not from ads' },
      liveSession: { vi: 'Ngoài livestream', en: 'Outside live' },
      category: { vi: 'Chưa phân ngành', en: 'Uncategorized' },
      subcategory: { vi: 'Chưa phân nhóm', en: 'No niche' },
      channel: { vi: 'Không rõ kênh', en: 'Unknown channel' },
    };
    return none[dim]?.[lang] ?? (lang === 'vi' ? '(không xác định)' : '(unknown)');
  }
  switch (dim) {
    case 'platform':
      return PLATFORM_LABELS[key as Platform] ?? key;
    case 'sku':
      return dataset.products.find((p) => p.sku === key)?.name ?? key;
    case 'combo':
      return dataset.combos.find((c) => c.comboId === key)?.name ?? key;
    case 'campaign':
      return dataset.campaigns.find((c) => c.campaignId === key)?.name ?? dataset.ads.find((a) => a.campaignId === key)?.adName ?? key;
    case 'liveSession': {
      const s = dataset.liveSessions.find((x) => x.sessionId === key);
      return s ? `${sessionDateLabel(s)} · ${PLATFORM_LABELS[s.platform]}${s.title ? ` · ${s.title}` : ''}` : key;
    }
    case 'channel': {
      const channels: Record<string, { vi: string; en: string }> = {
        search: { vi: 'Tìm kiếm', en: 'Search' },
        recommend: { vi: 'Gợi ý / khám phá', en: 'Recommendation' },
        affiliate: { vi: 'Affiliate', en: 'Affiliate' },
        video: { vi: 'Video', en: 'Video' },
        ads: { vi: 'Quảng cáo', en: 'Ads' },
        live: { vi: 'Livestream', en: 'Live' },
      };
      return channels[key]?.[lang] ?? key;
    }
    case 'day':
      return fmtDay(key);
    case 'week':
      return lang === 'vi' ? `Tuần ${fmtDay(key)}` : `Week of ${fmtDay(key)}`;
    case 'month':
      return lang === 'vi' ? `Tháng ${key.slice(5, 7)}/${key.slice(0, 4)}` : `${key.slice(5, 7)}/${key.slice(0, 4)}`;
    default:
      return key;
  }
}

export interface MemberMetrics {
  gmv: number;
  netRevenue: number | null;
  profit: number | null;
  margin: number | null;
  profitComplete: boolean;
  units: number;
  placed: number;
  valid: number;
  cancelled: number;
  returned: number;
  aov: number | null;
  cancelRate: number | null;
  refundRate: number | null;
  clicks: number | null;
  cvr: number | null;
  profitDetail: ProfitResult | null;
}

export interface BreakdownRow {
  key: string;
  label: string;
  current: MemberMetrics;
  previous: MemberMetrics | null;
  /** Share of total GMV in the current period. */
  gmvShare: number | null;
  change: {
    gmv: Comparison;
    orders: Comparison;
    profit: Comparison;
    margin: Comparison;
    aov: Comparison;
    cancelRate: Comparison;
    refundRate: Comparison;
    cvr: Comparison;
  };
  /** This member's delta ÷ total GMV delta (sums to 1 across members). */
  gmvContribution: number | null;
}

export interface Breakdown {
  dimension: BreakdownDimension;
  lineLevel: boolean;
  range: DateRange;
  previousRange?: DateRange;
  previousCovered: boolean;
  rows: BreakdownRow[];
  totalGmv: number;
  totalGmvDelta: number | null;
  /** Dimension needs data the dataset lacks (e.g. categories), with the reason. */
  unavailable?: { vi: string; en: string };
}

function adsAttribution(dim: BreakdownDimension, slice: DatasetSlice, dataset: CanonicalDataset): ((key: string) => AdPerformance[]) | undefined {
  const index = getDatasetIndex(dataset);
  const by = (pick: (a: AdPerformance) => string | undefined) => {
    const map = new Map<string, AdPerformance[]>();
    for (const a of slice.ads) {
      const k = pick(a);
      if (k === undefined) continue;
      const list = map.get(k);
      if (list) list.push(a);
      else map.set(k, [a]);
    }
    return (key: string) => map.get(key) || [];
  };
  switch (dim) {
    case 'platform':
      return by((a) => a.platform);
    case 'sku':
      return by((a) => a.sku);
    case 'category':
      return by((a) => (a.sku ? index.categoryBySku.get(a.sku) ?? NONE_KEY : undefined));
    case 'subcategory':
      return by((a) => (a.sku ? index.subcategoryBySku.get(a.sku) ?? NONE_KEY : undefined));
    case 'campaign':
      return by((a) => a.campaignId);
    case 'day':
      return by((a) => a.date);
    case 'week':
      return by((a) => weekStart(a.date));
    case 'month':
      return by((a) => a.date.slice(0, 7));
    default:
      return undefined; // combo, live, channel: ads cannot be attributed
  }
}

function trafficClicks(dim: BreakdownDimension, slice: DatasetSlice, dataset: CanonicalDataset): Map<string, number> | null {
  const index = getDatasetIndex(dataset);
  const keyOf = (t: DatasetSlice['traffic'][number]): string | undefined => {
    switch (dim) {
      case 'platform':
        return t.sku ? t.platform : undefined;
      case 'sku':
        return t.sku;
      case 'category':
        return t.sku ? index.categoryBySku.get(t.sku) ?? NONE_KEY : undefined;
      case 'subcategory':
        return t.sku ? index.subcategoryBySku.get(t.sku) ?? NONE_KEY : undefined;
      case 'combo':
        return t.sku && dataset.combos.some((c) => c.comboId === t.sku) ? t.sku : undefined;
      case 'day':
        return t.sku ? t.date : undefined;
      case 'week':
        return t.sku ? weekStart(t.date) : undefined;
      case 'month':
        return t.sku ? t.date.slice(0, 7) : undefined;
      default:
        return undefined;
    }
  };
  const map = new Map<string, number>();
  let any = false;
  for (const t of slice.traffic) {
    const v = t.productClicks ?? t.productViews;
    if (typeof v !== 'number') continue;
    const k = keyOf(t);
    if (k === undefined) continue;
    any = true;
    map.set(k, (map.get(k) || 0) + v);
  }
  return any ? map : null;
}

function memberMetrics(slice: DatasetSlice, dim: BreakdownDimension): Map<string, MemberMetrics> {
  const { dataset } = slice;
  const key = keyFn(dataset, dim);
  const profits = computeProfitByGroup(slice, key, { adsFor: adsAttribution(dim, slice, dataset) });
  const clicks = trafficClicks(dim, slice, dataset);

  const counts = new Map<string, { placed: number; valid: number; cancelled: number; returned: number }>();
  const linesByOrder = new Map<string, OrderLine[]>();
  for (const l of slice.lines) {
    const list = linesByOrder.get(l.orderId);
    if (list) list.push(l);
    else linesByOrder.set(l.orderId, [l]);
  }
  for (const o of slice.orders) {
    const keys = new Set((linesByOrder.get(o.orderId) || []).map((l) => key(o, l)));
    const cancelled = isCancelled(o.status);
    const returned = isReturnOrRefund(o.status);
    for (const k of keys) {
      let c = counts.get(k);
      if (!c) counts.set(k, (c = { placed: 0, valid: 0, cancelled: 0, returned: 0 }));
      c.placed++;
      if (cancelled) c.cancelled++;
      else c.valid++;
      if (returned) c.returned++;
    }
  }

  const out = new Map<string, MemberMetrics>();
  for (const [k, c] of counts) {
    const p = profits.get(k) ?? null;
    const gmv = p?.gmv.value ?? 0;
    const memberClicks = clicks ? clicks.get(k) ?? null : null;
    out.set(k, {
      gmv,
      netRevenue: p?.netRevenue.value ?? (c.valid === 0 ? 0 : null),
      profit: p?.profit.value ?? null,
      margin: p?.margin.value ?? null,
      profitComplete: !!p && p.completeness === 'complete',
      units: p?.units ?? 0,
      placed: c.placed,
      valid: c.valid,
      cancelled: c.cancelled,
      returned: c.returned,
      aov: c.valid > 0 ? gmv / c.valid : null,
      cancelRate: c.placed > 0 ? c.cancelled / c.placed : null,
      refundRate: c.valid > 0 ? c.returned / c.valid : null,
      clicks: memberClicks,
      cvr: memberClicks ? c.placed / memberClicks : null,
      profitDetail: p,
    });
  }
  return out;
}

/** Dimensions a daily summary report can be split by (no order lines needed). */
const DAILY_DIMS: BreakdownDimension[] = ['day', 'week', 'month', 'platform'];

/**
 * Member metrics from daily summary rows (Shopee "Phân tích bán hàng" etc.), mirroring the
 * daily-grain KPI rules: GMV = paid-order sales, placed = placed orders, valid = paid orders.
 * Profit and units stay unknown — the report does not have them.
 */
function dailyMemberMetrics(slice: DatasetSlice, dim: BreakdownDimension): Map<string, MemberMetrics> {
  const keyOf = (d: DatasetSlice['dailyMetrics'][number]) =>
    dim === 'day' ? d.date : dim === 'week' ? weekStart(d.date) : dim === 'month' ? d.date.slice(0, 7) : d.platform;
  const acc = new Map<string, { gmv: number; refunded: number | null; placed: number; valid: number; cancelled: number; returned: number; clicks: number | null; units: number }>();
  for (const d of slice.dailyMetrics) {
    const k = keyOf(d);
    const a = acc.get(k) ?? { gmv: 0, refunded: 0, placed: 0, valid: 0, cancelled: 0, returned: 0, clicks: null, units: 0 };
    a.gmv += d.paidGmv ?? 0;
    a.refunded = a.refunded === null || d.refundedGmv === undefined ? null : a.refunded + d.refundedGmv;
    a.placed += d.placedOrders ?? 0;
    a.valid += d.paidOrders ?? 0;
    a.cancelled += d.cancelledOrders ?? 0;
    a.returned += d.refundedOrders ?? 0;
    a.units += d.units ?? 0;
    if (d.productClicks !== undefined) a.clicks = (a.clicks ?? 0) + d.productClicks;
    acc.set(k, a);
  }
  const out = new Map<string, MemberMetrics>();
  for (const [k, a] of acc) {
    out.set(k, {
      gmv: a.gmv,
      netRevenue: a.refunded === null ? null : a.gmv - a.refunded,
      profit: null,
      margin: null,
      profitComplete: false,
      units: a.units,
      placed: a.placed,
      valid: a.valid,
      cancelled: a.cancelled,
      returned: a.returned,
      aov: a.valid > 0 ? a.gmv / a.valid : null,
      cancelRate: a.placed > 0 ? a.cancelled / a.placed : null,
      refundRate: a.valid > 0 ? a.returned / a.valid : null,
      clicks: a.clicks,
      cvr: a.clicks ? a.placed / a.clicks : null,
      profitDetail: null,
    });
  }
  return out;
}

export function breakdown(dataset: CanonicalDataset, filter: DatasetFilter, dimension: BreakdownDimension, previousRange?: DateRange, lang: 'vi' | 'en' = 'vi'): Breakdown {
  const lineLevel = LINE_LEVEL.includes(dimension);
  const base: Breakdown = { dimension, lineLevel, range: filter.range, previousRange, previousCovered: false, rows: [], totalGmv: 0, totalGmvDelta: null };
  const dailyGrain = dataset.orders.length === 0 && dataset.dailyMetrics.length > 0 && DAILY_DIMS.includes(dimension);
  if (dataset.orders.length === 0 && !dailyGrain) {
    return { ...base, unavailable: { vi: 'Cần file xuất đơn hàng để phân tích theo chiều này.', en: 'An order export is required for this breakdown.' } };
  }
  if ((dimension === 'category' || dimension === 'subcategory') && !dataset.products.some((p) => (dimension === 'category' ? p.category : p.subcategory))) {
    return { ...base, unavailable: { vi: 'Chưa có thông tin ngành hàng/nhóm hàng cho SKU. Bổ sung cột Ngành hàng trong file hoặc danh mục sản phẩm.', en: 'No category data for SKUs.' } };
  }

  const members = dailyGrain ? dailyMemberMetrics : memberMetrics;
  const cur = members(sliceDataset(dataset, filter), dimension);
  const previousCovered =
    !!previousRange && (dailyGrain ? dataset.dailyMetrics.some((d) => isInRange(d.date, previousRange)) : dataset.orders.some((o) => isInRange(o.orderDate, previousRange)));
  const prev = previousRange && previousCovered ? members(sliceDataset(dataset, { ...filter, range: previousRange }), dimension) : null;
  // Time dimensions do not repeat across periods — comparing member-to-member makes no sense.
  const timeDim = dimension === 'day' || dimension === 'week' || dimension === 'month';

  const contribution = prev && !timeDim
    ? computeContribution(new Map([...cur].map(([k, m]) => [k, m.gmv])), new Map([...prev].map(([k, m]) => [k, m.gmv])))
    : null;
  const contributionByKey = new Map(contribution?.items.map((i) => [i.key, i.shareOfChange]) ?? []);
  const totalGmv = [...cur.values()].reduce((s, m) => s + m.gmv, 0);

  const keys = new Set([...cur.keys(), ...(prev && !timeDim ? prev.keys() : [])]);
  const empty: MemberMetrics = {
    gmv: 0, netRevenue: 0, profit: null, margin: null, profitComplete: false, units: 0, placed: 0, valid: 0, cancelled: 0, returned: 0,
    aov: null, cancelRate: null, refundRate: null, clicks: null, cvr: null, profitDetail: null,
  };
  const rows: BreakdownRow[] = [];
  for (const k of keys) {
    const c = cur.get(k) ?? empty;
    const p = prev && !timeDim ? prev.get(k) ?? empty : null;
    rows.push({
      key: k,
      label: dimensionMemberLabel(dataset, dimension, k, lang),
      current: c,
      previous: p,
      gmvShare: totalGmv > 0 ? c.gmv / totalGmv : null,
      change: {
        gmv: compareValues(c.gmv, p ? p.gmv : null, 'vnd'),
        orders: compareValues(c.placed, p ? p.placed : null, 'count'),
        profit: compareValues(c.profit, p ? p.profit : null, 'vnd'),
        margin: compareValues(c.margin, p ? p.margin : null, 'ratio'),
        aov: compareValues(c.aov, p ? p.aov : null, 'vnd'),
        cancelRate: compareValues(c.cancelRate, p ? p.cancelRate : null, 'ratio'),
        refundRate: compareValues(c.refundRate, p ? p.refundRate : null, 'ratio'),
        cvr: compareValues(c.cvr, p ? p.cvr : null, 'ratio'),
      },
      gmvContribution: contributionByKey.get(k) ?? null,
    });
  }
  if (timeDim) rows.sort((a, b) => a.key.localeCompare(b.key));
  else rows.sort((a, b) => b.current.gmv - a.current.gmv || (b.previous?.gmv ?? 0) - (a.previous?.gmv ?? 0));

  return {
    ...base,
    previousCovered,
    rows,
    totalGmv,
    totalGmvDelta: contribution ? contribution.totalDelta : null,
  };
}

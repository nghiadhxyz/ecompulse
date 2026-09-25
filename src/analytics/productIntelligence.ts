/**
 * Product & Combo Intelligence (Analyst Mode).
 *
 * Classification (transparent rules, each row carries its reasons):
 *   Reconsider  — contribution profit ≤ 0 (COGS known)
 *   Investigate — no COGS yet, or GMV down ≥ 10%, or cancel rate ≥ max(10%, 1.5× shop)
 *   Scale       — GMV (or normal-day momentum) up ≥ 10/20% and margin ≥ shop margin
 *   Maintain    — everything else
 * ABC: cumulative GMV share ≤ 80% → A, ≤ 95% → B, else C.
 * Hero: class A with margin ≥ shop margin and not declining.
 * Zombie: ≥ 200 product clicks but ≤ 1 valid order (only when traffic data exists).
 */
import type { CanonicalDataset } from './model';
import type { DatasetFilter } from './filters';
import { sliceDataset, getDatasetIndex } from './filters';
import { breakdown, type BreakdownRow } from './breakdownEngine';
import { computeKpis } from './kpiEngine';
import { comparePeriods, type PeriodComparison } from './comparisonEngine';
import { adsSummary, type AdCampaignRow } from './adsLiveEngine';
import { dailySeries, type DailyPoint } from './timeseries';
import { campaignDates, normalDayStats } from './normalDays';
import { isCancelled } from './status';
import { addDays, type ComparisonMode, type DateRange } from './period';
import { fmtChange, fmtRate } from './format';
import type { Bilingual } from './metric';

export type ProductClass = 'scale' | 'maintain' | 'investigate' | 'reconsider';

export const PRODUCT_CLASS_LABELS: Record<ProductClass, Bilingual> = {
  scale: { vi: 'Đẩy mạnh (Scale)', en: 'Scale' },
  maintain: { vi: 'Duy trì (Maintain)', en: 'Maintain' },
  investigate: { vi: 'Cần xem xét (Investigate)', en: 'Investigate' },
  reconsider: { vi: 'Cân nhắc lại (Reconsider)', en: 'Reconsider' },
};

export interface ProductInsight {
  row: BreakdownRow;
  abc: 'A' | 'B' | 'C';
  cumulativeShare: number;
  isHero: boolean;
  /** null = no traffic data to judge. */
  isZombie: boolean | null;
  /** Normal-day GMV growth, last 14 vs previous 14 days ending at the range end. */
  momentum: number | null;
  classification: ProductClass;
  reasons: Bilingual[];
}

export interface ProductIntelligence {
  rows: ProductInsight[];
  shopMargin: number | null;
  shopCancelRate: number | null;
  counts: Record<ProductClass, number>;
  abcCounts: Record<'A' | 'B' | 'C', number>;
  trafficAvailable: boolean;
}

const MIN_ORDERS = 10;

export function productIntelligence(dataset: CanonicalDataset, filter: DatasetFilter, previousRange?: DateRange): ProductIntelligence {
  const b = breakdown(dataset, filter, 'sku', previousRange);
  const shop = computeKpis(dataset, filter).metrics;
  const shopMargin = shop.margin.value;
  const shopCancelRate = shop.cancelRate.value;
  const trafficAvailable = dataset.traffic.some((t) => t.sku && typeof (t.productClicks ?? t.productViews) === 'number');
  const saleDays = campaignDates(dataset);
  const end = filter.range.end;
  const cur14 = { start: addDays(end, -13), end };
  const prev14 = { start: addDays(end, -27), end: addDays(end, -14) };

  let cumulative = 0;
  const total = b.totalGmv || 1;
  const counts: Record<ProductClass, number> = { scale: 0, maintain: 0, investigate: 0, reconsider: 0 };
  const abcCounts = { A: 0, B: 0, C: 0 };
  const rows: ProductInsight[] = [];

  for (const row of b.rows) {
    const c = row.current;
    if (c.gmv === 0 && c.placed === 0) continue; // only in the previous period
    cumulative += c.gmv;
    const cumulativeShare = cumulative / total;
    const abc: 'A' | 'B' | 'C' = cumulativeShare <= 0.8 + 1e-9 ? 'A' : cumulativeShare <= 0.95 + 1e-9 ? 'B' : 'C';
    abcCounts[abc]++;

    const cur = normalDayStats(dataset, row.key, cur14, saleDays, filter.platforms);
    const prev = normalDayStats(dataset, row.key, prev14, saleDays, filter.platforms);
    const momentum = cur.days > 0 && prev.days > 0 && prev.gmvPerDay > 0 ? (cur.gmvPerDay - prev.gmvPerDay) / prev.gmvPerDay : null;

    const growth = row.change.gmv.percentageDelta;
    const marginBar = shopMargin ?? 0.25;
    const reasons: Bilingual[] = [];
    let cls: ProductClass;
    const highCancel = c.placed >= MIN_ORDERS && c.cancelRate !== null && c.cancelRate >= Math.max(0.1, (shopCancelRate ?? 0) * 1.5);

    if (c.profit !== null && c.profit <= 0) {
      cls = 'reconsider';
      reasons.push({ vi: 'Lợi nhuận đóng góp âm hoặc bằng 0 sau giá vốn, phí và Ads gắn SKU.', en: 'Contribution profit ≤ 0 after COGS, fees and SKU ads.' });
    } else if (c.profit === null || (growth !== null && growth <= -0.1) || highCancel) {
      cls = 'investigate';
      if (c.profit === null) reasons.push({ vi: 'Chưa có giá vốn — chưa đánh giá được lợi nhuận.', en: 'No COGS — profit unknown.' });
      if (growth !== null && growth <= -0.1) reasons.push({ vi: `Doanh thu giảm ${fmtChange(growth)} so với kỳ trước.`, en: `Revenue ${fmtChange(growth, 'en')} vs previous period.` });
      if (highCancel) reasons.push({ vi: `Tỷ lệ hủy ${fmtRate(c.cancelRate)} cao hơn mức chung của shop.`, en: `Cancel rate ${fmtRate(c.cancelRate, 'en')} above shop level.` });
    } else if (((growth !== null && growth >= 0.1) || (momentum !== null && momentum >= 0.2)) && c.margin !== null && c.margin >= marginBar) {
      cls = 'scale';
      reasons.push({
        vi: `Đang tăng (${growth !== null ? `kỳ ${fmtChange(growth)}` : ''}${momentum !== null ? `${growth !== null ? ', ' : ''}ngày thường ${fmtChange(momentum)}` : ''}) với biên ${fmtRate(c.margin)} ≥ mức shop.`,
        en: `Growing with margin ${fmtRate(c.margin, 'en')} ≥ shop level.`,
      });
    } else {
      cls = 'maintain';
      reasons.push({ vi: 'Có lời, tăng trưởng ổn định.', en: 'Profitable and stable.' });
    }
    counts[cls]++;

    const isZombie = trafficAvailable ? (c.clicks ?? 0) >= 200 && c.valid <= 1 : null;
    rows.push({
      row,
      abc,
      cumulativeShare,
      isHero: abc === 'A' && c.margin !== null && c.margin >= marginBar && (growth === null || growth >= 0),
      isZombie,
      momentum,
      classification: cls,
      reasons,
    });
  }
  return { rows, shopMargin, shopCancelRate, counts, abcCounts, trafficAvailable };
}

export interface Product360 {
  sku: string;
  name: string;
  category?: string;
  subcategory?: string;
  comparison: PeriodComparison;
  series: DailyPoint[];
  byPlatform: BreakdownRow[];
  byChannel: BreakdownRow[];
  ads: AdCampaignRow[];
  /** GMV share of live / affiliate orders for this SKU. */
  liveGmv: number;
  affiliateGmv: number;
  insight?: ProductInsight;
}

export function product360(dataset: CanonicalDataset, filter: DatasetFilter, sku: string, mode: ComparisonMode, insight?: ProductInsight): Product360 {
  const f: DatasetFilter = { ...filter, skus: [sku] };
  const comparison = comparePeriods(dataset, f, mode);
  const product = dataset.products.find((p) => p.sku === sku);
  const slice = sliceDataset(dataset, f);
  const statusOk = new Map(slice.orders.map((o) => [o.orderId, o]));
  let liveGmv = 0;
  let affiliateGmv = 0;
  for (const l of slice.lines) {
    const o = statusOk.get(l.orderId);
    if (!o || isCancelled(o.status)) continue;
    if (o.liveSessionId) liveGmv += l.grossAmount || 0;
    if (o.channel?.startsWith('affiliate')) affiliateGmv += l.grossAmount || 0;
  }
  return {
    sku,
    name: product?.name ?? sku,
    category: product?.category,
    subcategory: product?.subcategory,
    comparison,
    series: dailySeries(dataset, f),
    byPlatform: breakdown(dataset, f, 'platform', comparison.previousRange).rows,
    byChannel: breakdown(dataset, f, 'channel', comparison.previousRange).rows,
    ads: adsSummary(dataset, f).rows,
    liveGmv,
    affiliateGmv,
    insight,
  };
}

export interface ComboRow {
  comboId: string;
  name: string;
  components: string[];
  price?: number;
  combo: BreakdownRow;
  /** Average basket (all lines) of orders containing the combo. */
  comboBasket: number | null;
  /** Same metrics for the component SKUs sold on their own. */
  singles: {
    gmv: number;
    margin: number | null;
    cancelRate: number | null;
    basket: number | null;
    orders: number;
  };
  marginDiffPp: number | null;
  basketRatio: number | null;
}

export function comboAnalytics(dataset: CanonicalDataset, filter: DatasetFilter, previousRange?: DateRange): { rows: ComboRow[]; available: boolean } {
  if (dataset.combos.length === 0 && !dataset.orderLines.some((l) => l.comboId)) return { rows: [], available: false };
  const combos = breakdown(dataset, filter, 'combo', previousRange).rows.filter((r) => r.key !== '__none__');
  const skus = new Map(breakdown(dataset, filter, 'sku').rows.map((r) => [r.key, r]));
  const slice = sliceDataset(dataset, filter);
  const index = getDatasetIndex(dataset);

  const basketOf = (predicate: (skusInOrder: Set<string>, comboIds: Set<string>) => boolean) => {
    let sum = 0;
    let n = 0;
    for (const o of slice.orders) {
      if (isCancelled(o.status)) continue;
      const lines = index.linesByOrder.get(o.orderId) || [];
      const s = new Set(lines.map((l) => l.sku));
      const c = new Set(lines.map((l) => l.comboId).filter(Boolean) as string[]);
      if (!predicate(s, c)) continue;
      n++;
      sum += lines.reduce((t, l) => t + (l.grossAmount || 0), 0);
    }
    return n > 0 ? sum / n : null;
  };

  const rows: ComboRow[] = combos.map((row) => {
    const def = dataset.combos.find((c) => c.comboId === row.key);
    const components = Array.from(new Set(def?.skus ?? []));
    const singleRows = components.map((s) => skus.get(s)).filter((r): r is BreakdownRow => !!r);
    const gmv = singleRows.reduce((s, r) => s + r.current.gmv, 0);
    const profitRows = singleRows.filter((r) => r.current.profit !== null && r.current.netRevenue);
    const net = profitRows.reduce((s, r) => s + (r.current.netRevenue || 0), 0);
    const profit = profitRows.reduce((s, r) => s + (r.current.profit || 0), 0);
    const placed = singleRows.reduce((s, r) => s + r.current.placed, 0);
    const cancelled = singleRows.reduce((s, r) => s + r.current.cancelled, 0);
    const singleMargin = profitRows.length === singleRows.length && net > 0 ? profit / net : null;
    const comboBasket = basketOf((_s, c) => c.has(row.key));
    const singleBasket = basketOf((s, c) => !c.has(row.key) && components.some((x) => s.has(x)));
    return {
      comboId: row.key,
      name: row.label,
      components,
      price: def?.price,
      combo: row,
      comboBasket,
      singles: { gmv, margin: singleMargin, cancelRate: placed > 0 ? cancelled / placed : null, basket: singleBasket, orders: singleRows.reduce((s, r) => s + r.current.valid, 0) },
      marginDiffPp: row.current.margin !== null && singleMargin !== null ? (row.current.margin - singleMargin) * 100 : null,
      basketRatio: comboBasket !== null && singleBasket ? comboBasket / singleBasket : null,
    };
  });
  return { rows, available: true };
}


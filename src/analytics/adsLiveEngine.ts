/**
 * Ads & Live performance.
 *
 * Ads: ROAS is never shown alone — each campaign gets an estimated profit after ads
 * (attributed revenue × margin before ads − spend) and a break-even ROAS, both only
 * when the promoted SKU has COGS. Margin before ads is measured on GMV so it is on
 * the same basis as the platform's attributed revenue.
 *
 * Live: per-session metrics normalized by duration, compared with the previous
 * session on the same platform.
 */
import type { AdPerformance, CanonicalDataset, LiveSession, Platform } from './model';
import { sliceDataset, type DatasetFilter } from './filters';
import { computeProfit, computeProfitByGroup } from './profitEngine';
import { adCvr, breakEvenRoas, cpa, cpc, ctr, profitAfterAds, roas } from './adsFormulas';
import { safeDivide } from './metric';

export interface AdCampaignRow {
  key: string;
  name: string;
  platform: Platform;
  sku?: string;
  spend: number;
  attributedRevenue: number | null;
  orders: number | null;
  roas: number | null;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  cpc: number | null;
  cvr: number | null;
  cpa: number | null;
  /** (Net revenue − variable costs except ads) / GMV for the promoted SKU (or shop). */
  marginBeforeAds: number | null;
  breakEvenRoas: number | null;
  estimatedProfitAfterAds: number | null;
  /** True when some variable costs (fees, shipping…) were missing for the margin. */
  marginIsPartial: boolean;
  /** Why profit after ads is unavailable, if it is. */
  profitNote?: { vi: string; en: string };
}

export interface AdsSummary {
  available: boolean;
  rows: AdCampaignRow[];
  totals: Omit<AdCampaignRow, 'key' | 'name' | 'platform' | 'sku' | 'profitNote'>;
}

function sumOrNull(rows: AdPerformance[], pick: (a: AdPerformance) => number | undefined): number | null {
  return rows.some((r) => typeof pick(r) === 'number') ? rows.reduce((s, r) => s + (pick(r) || 0), 0) : null;
}

export function adsSummary(dataset: CanonicalDataset, filter: DatasetFilter): AdsSummary {
  const slice = sliceDataset(dataset, filter);
  const empty = {
    spend: 0, attributedRevenue: null, orders: null, roas: null, impressions: null, clicks: null, ctr: null, cpc: null, cvr: null, cpa: null,
    marginBeforeAds: null, breakEvenRoas: null, estimatedProfitAfterAds: null, marginIsPartial: false,
  };
  if (dataset.ads.length === 0) return { available: false, rows: [], totals: empty };

  // Margin before ads per SKU and for the shop, from the profit engine.
  const bySku = computeProfitByGroup(slice, (_o, l) => l.sku, { adsFor: () => [] });
  const skuMargin = (sku: string): number | null => {
    const p = bySku.get(sku);
    if (!p || p.completeness === 'insufficient' || p.missingCogsSkus.length > 0) return null;
    return safeDivide(p.profitBeforeAds.value ?? NaN, p.gmv.value ?? 0);
  };
  const skuPartial = (sku: string) => (bySku.get(sku)?.warnings.length ?? 0) > 0;
  const shop = computeProfit(slice);
  const shopMargin = shop.missingCogsSkus.length === 0 && shop.completeness !== 'insufficient' ? safeDivide(shop.profitBeforeAds.value ?? NaN, shop.gmv.value ?? 0) : null;
  const shopPartial = shop.warnings.some((w) => !w.vi.includes('quảng cáo') && !w.vi.includes('Ads'));

  const groups = new Map<string, AdPerformance[]>();
  for (const a of slice.ads) {
    const key = `${a.platform}|${a.campaignId ?? a.adName ?? 'ads'}`;
    const list = groups.get(key);
    if (list) list.push(a);
    else groups.set(key, [a]);
  }

  const build = (key: string, rows: AdPerformance[], name: string, platform: Platform, sku?: string): AdCampaignRow => {
    const spend = rows.reduce((s, r) => s + (r.spend || 0), 0);
    const revenue = sumOrNull(rows, (r) => r.attributedRevenue);
    const orders = sumOrNull(rows, (r) => r.orders);
    const impressions = sumOrNull(rows, (r) => r.impressions);
    const clicks = sumOrNull(rows, (r) => r.clicks);
    const margin = sku ? skuMargin(sku) : shopMargin;
    let profitNote: AdCampaignRow['profitNote'];
    if (revenue === null) profitNote = { vi: 'Báo cáo Ads không có doanh thu quy đổi.', en: 'The ads report has no attributed revenue.' };
    else if (margin === null) {
      profitNote = sku
        ? { vi: `Không đủ dữ liệu: ${sku} chưa có giá vốn hoặc chưa có đơn trong kỳ.`, en: `Insufficient data: ${sku} lacks COGS or orders in this period.` }
        : { vi: 'Không đủ dữ liệu: thiếu giá vốn để tính biên lợi nhuận.', en: 'Insufficient data: COGS missing for margin.' };
    }
    return {
      key,
      name,
      platform,
      sku,
      spend,
      attributedRevenue: revenue,
      orders,
      roas: revenue !== null ? roas(revenue, spend) : null,
      impressions,
      clicks,
      ctr: clicks !== null && impressions !== null ? ctr(clicks, impressions) : null,
      cpc: clicks !== null ? cpc(spend, clicks) : null,
      cvr: orders !== null && clicks !== null ? adCvr(orders, clicks) : null,
      cpa: orders !== null ? cpa(spend, orders) : null,
      marginBeforeAds: margin,
      breakEvenRoas: breakEvenRoas(margin),
      estimatedProfitAfterAds: revenue !== null ? profitAfterAds(revenue, spend, margin) : null,
      marginIsPartial: margin !== null && (sku ? skuPartial(sku) : shopPartial),
      profitNote,
    };
  };

  const rows = Array.from(groups.entries())
    .map(([key, list]) => {
      const skus = new Set(list.map((a) => a.sku).filter(Boolean));
      return build(key, list, list[0].adName || list[0].campaignId || 'Ads', list[0].platform, skus.size === 1 ? [...skus][0] : undefined);
    })
    .sort((a, b) => b.spend - a.spend);

  const total = build('total', slice.ads, 'Tổng', 'other');
  // Shop-level profit after ads = sum of campaign estimates when every campaign has one.
  const allKnown = rows.length > 0 && rows.every((r) => r.estimatedProfitAfterAds !== null);
  const { key: _k, name: _n, platform: _p, sku: _s, profitNote: _pn, ...totals } = {
    ...total,
    estimatedProfitAfterAds: allKnown ? rows.reduce((s, r) => s + (r.estimatedProfitAfterAds || 0), 0) : null,
    marginBeforeAds: shopMargin,
    breakEvenRoas: breakEvenRoas(shopMargin),
  };
  return { available: true, rows, totals };
}

export interface LiveSessionRow {
  session: LiveSession;
  durationHours: number | null;
  gmvPerHour: number | null;
  ordersPerHour: number | null;
  /** Orders / viewers. */
  conversion: number | null;
  clickThrough: number | null;
  estimatedProfit: number | null;
  profitPerHour: number | null;
  profitComplete: boolean;
  previous?: LiveSession;
  viewersChange: number | null;
  ordersChange: number | null;
  /** More viewers than the previous session but fewer orders. */
  viewersUpOrdersDown: boolean;
}

export function liveSessions(dataset: CanonicalDataset, filter: DatasetFilter): LiveSessionRow[] {
  const slice = sliceDataset(dataset, filter);
  if (slice.liveSessions.length === 0) return [];
  const profits = computeProfitByGroup(slice, (o) => o.liveSessionId ?? null, { adsFor: () => [] });
  // Previous-session lookup uses all sessions of the platform (the previous one may be outside the range).
  const byPlatform = new Map<Platform, LiveSession[]>();
  for (const s of dataset.liveSessions) {
    const list = byPlatform.get(s.platform);
    if (list) list.push(s);
    else byPlatform.set(s.platform, [s]);
  }
  for (const list of byPlatform.values()) list.sort((a, b) => a.date.localeCompare(b.date) || a.sessionId.localeCompare(b.sessionId));

  return slice.liveSessions
    .map((s) => {
      const list = byPlatform.get(s.platform) || [];
      const idx = list.findIndex((x) => x.sessionId === s.sessionId);
      // Period-total sessions have no real date, so "previous session" is undefined.
      const previous = idx > 0 && !s.periodStart && !list[idx - 1].periodStart ? list[idx - 1] : undefined;
      const hours = s.durationMinutes ? s.durationMinutes / 60 : null;
      const p = profits.get(s.sessionId);
      const profit = p && p.profit.value !== null ? p.profit.value : null;
      const change = (cur?: number, prev?: number) => (cur !== undefined && prev !== undefined && prev > 0 ? (cur - prev) / prev : null);
      const viewersChange = change(s.viewers, previous?.viewers);
      const ordersChange = change(s.orders, previous?.orders);
      return {
        session: s,
        durationHours: hours,
        gmvPerHour: hours && s.gmv !== undefined ? s.gmv / hours : null,
        ordersPerHour: hours && s.orders !== undefined ? s.orders / hours : null,
        conversion: s.orders !== undefined && s.viewers ? s.orders / s.viewers : null,
        clickThrough: s.productClicks !== undefined && s.viewers ? s.productClicks / s.viewers : null,
        estimatedProfit: profit,
        profitPerHour: hours && profit !== null ? profit / hours : null,
        profitComplete: !!p && p.completeness === 'complete',
        previous,
        viewersChange,
        ordersChange,
        viewersUpOrdersDown: (viewersChange ?? 0) > 0.1 && (ordersChange ?? 0) < -0.1,
      };
    })
    .sort((a, b) => b.session.date.localeCompare(a.session.date));
}

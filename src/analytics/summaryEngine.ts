/**
 * Summary-report analytics (no order lines): revenue by channel / traffic source and the
 * top products the platform lists. Period rows count only when the whole report period
 * lies inside the range; daily rows are summed day by day.
 */
import type { CanonicalDataset, SalesSummaryRow, SummaryChannel, SummaryStage } from './model';
import type { DatasetFilter } from './filters';
import { isInRange, type DateRange } from './period';
import type { Bilingual } from './metric';

export const SUMMARY_CHANNEL_LABELS: Record<SummaryChannel, Bilingual> = {
  product_card: { vi: 'Thẻ sản phẩm (tự nhiên & tìm kiếm)', en: 'Product card' },
  live: { vi: 'Livestream của shop', en: 'Shop live' },
  video: { vi: 'Video của shop', en: 'Shop video' },
  affiliate: { vi: 'Affiliate / KOC', en: 'Affiliate' },
  ads: { vi: 'Quảng cáo Shopee', en: 'Shopee Ads' },
};

const STACKED: SummaryChannel[] = ['product_card', 'live', 'video', 'affiliate'];

function rowsInRange(dataset: CanonicalDataset, filter: DatasetFilter, stage: SummaryStage): SalesSummaryRow[] {
  const plat = filter.platforms?.length ? new Set(filter.platforms) : null;
  return (dataset.salesSummaries ?? []).filter(
    (r) => r.stage === stage && (!plat || plat.has(r.platform)) && isInRange(r.date, filter.range) && (r.periodStart === undefined || r.periodStart >= filter.range.start),
  );
}

export function hasSalesSummaries(dataset: CanonicalDataset): boolean {
  return (dataset.salesSummaries?.length ?? 0) > 0;
}

export interface ChannelRow {
  channel: SummaryChannel;
  gmv: number;
  share: number | null;
  orders: number | null;
  clicks: number | null;
  views: number | null;
  impressions: number | null;
  sources: { key: string; gmv: number; share: number | null; orders: number | null; clicks: number | null; impressions: number | null; views: number | null }[];
}

export interface ChannelMix {
  available: boolean;
  stage: SummaryStage;
  total: number;
  channels: ChannelRow[];
  /** GMV attributed to Shopee Ads (overlaps the channels above). */
  adsGmv: number | null;
  /** Report period covered only partly by the range → period rows excluded. */
  notes: Bilingual[];
}

const sumOrNull = (rows: SalesSummaryRow[], k: 'orders' | 'clicks' | 'views' | 'impressions') => (rows.some((r) => r[k] !== undefined) ? rows.reduce((s, r) => s + (r[k] ?? 0), 0) : null);

export function channelMix(dataset: CanonicalDataset, filter: DatasetFilter, stage: SummaryStage = 'placed'): ChannelMix {
  const rows = rowsInRange(dataset, filter, stage);
  const notes: Bilingual[] = [];
  const excludedPeriod = (dataset.salesSummaries ?? []).some((r) => r.periodStart && r.stage === stage && r.date >= filter.range.start && r.periodStart <= filter.range.end && !(r.periodStart >= filter.range.start && r.date <= filter.range.end));
  if (excludedPeriod) notes.push({ vi: 'Một số số liệu chỉ có tổng cả kỳ báo cáo — chọn trọn kỳ báo cáo để xem đầy đủ.', en: 'Some rows are period totals; select the full report period to include them.' });
  const channels: ChannelRow[] = [];
  for (const ch of STACKED) {
    const chRows = rows.filter((r) => r.dimension === 'channel' && r.channel === ch);
    const srcRows = rows.filter((r) => r.dimension === 'source' && r.channel === ch);
    if (chRows.length === 0 && srcRows.length === 0) continue;
    const gmv = chRows.length ? chRows.reduce((s, r) => s + (r.gmv ?? 0), 0) : srcRows.reduce((s, r) => s + (r.gmv ?? 0), 0);
    const bySource = new Map<string, SalesSummaryRow[]>();
    for (const r of srcRows) bySource.set(r.key, [...(bySource.get(r.key) ?? []), r]);
    channels.push({
      channel: ch,
      gmv,
      share: null,
      orders: sumOrNull(chRows, 'orders'),
      clicks: sumOrNull(chRows, 'clicks'),
      views: sumOrNull(chRows, 'views'),
      impressions: sumOrNull(chRows, 'impressions'),
      sources: [...bySource.entries()]
        .map(([key, xs]) => {
          const g = xs.reduce((s, r) => s + (r.gmv ?? 0), 0);
          return { key, gmv: g, share: gmv ? g / gmv : null, orders: sumOrNull(xs, 'orders'), clicks: sumOrNull(xs, 'clicks'), impressions: sumOrNull(xs, 'impressions'), views: sumOrNull(xs, 'views') };
        })
        .sort((a, b) => b.gmv - a.gmv),
    });
  }
  const total = channels.reduce((s, c) => s + c.gmv, 0);
  for (const c of channels) c.share = total ? c.gmv / total : null;
  const adsRows = rows.filter((r) => r.dimension === 'channel' && r.channel === 'ads');
  const adsFromAds = dataset.ads.filter((a) => (!filter.platforms?.length || filter.platforms.includes(a.platform)) && isInRange(a.date, filter.range) && (a.periodStart === undefined || a.periodStart >= filter.range.start));
  const adsGmv = adsRows.length ? adsRows.reduce((s, r) => s + (r.gmv ?? 0), 0) : adsFromAds.some((a) => a.attributedRevenue !== undefined) ? adsFromAds.reduce((s, a) => s + (a.attributedRevenue ?? 0), 0) : null;
  if (channels.length) notes.push({ vi: 'Doanh thu từ Quảng cáo Shopee trùng với các kênh trên (khách bấm quảng cáo rồi mua qua thẻ sản phẩm), nên không cộng vào tổng.', en: 'Ads revenue overlaps the channels above and is not added to the total.' });
  return { available: channels.length > 0, stage, total, channels: channels.sort((a, b) => b.gmv - a.gmv), adsGmv, notes };
}

export interface SummaryProductRow {
  sku: string;
  name: string;
  gmv: number;
  paidGmv: number | null;
  orders: number | null;
  units: number | null;
  buyers: number | null;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  cvr: number | null;
  byChannel: Partial<Record<SummaryChannel, number>>;
}

export interface SummaryProducts {
  available: boolean;
  period: DateRange | null;
  rows: SummaryProductRow[];
  /** Share of channel GMV covered by the listed products. */
  coverage: number | null;
  notes: Bilingual[];
}

export function summaryProducts(dataset: CanonicalDataset, filter: DatasetFilter): SummaryProducts {
  const placed = rowsInRange(dataset, filter, 'placed').filter((r) => r.dimension === 'sku');
  const paid = rowsInRange(dataset, filter, 'paid').filter((r) => r.dimension === 'sku');
  const notes: Bilingual[] = [];
  const anySku = (dataset.salesSummaries ?? []).some((r) => r.dimension === 'sku');
  if (placed.length === 0) {
    if (anySku) notes.push({ vi: 'Số liệu sản phẩm là tổng cả kỳ báo cáo — hãy chọn khoảng thời gian bao trọn kỳ đó.', en: 'Product rows are period totals — select a range covering the whole report period.' });
    const p = (dataset.salesSummaries ?? []).find((r) => r.dimension === 'sku' && r.periodStart);
    return { available: false, period: p ? { start: p.periodStart!, end: p.date } : null, rows: [], coverage: null, notes };
  }
  const map = new Map<string, SummaryProductRow>();
  for (const r of placed) {
    const row = map.get(r.key) ?? { sku: r.key, name: r.label ?? r.key, gmv: 0, paidGmv: null, orders: 0, units: 0, buyers: 0, impressions: null, clicks: null, ctr: null, cvr: null, byChannel: {} };
    row.gmv += r.gmv ?? 0;
    row.orders = (row.orders ?? 0) + (r.orders ?? 0);
    row.units = (row.units ?? 0) + (r.units ?? 0);
    row.buyers = (row.buyers ?? 0) + (r.buyers ?? 0);
    row.byChannel[r.channel] = (row.byChannel[r.channel] ?? 0) + (r.gmv ?? 0);
    // Impressions / clicks of the product page come from the product-card block.
    if (r.channel === 'product_card') {
      row.impressions = r.impressions ?? null;
      row.clicks = r.clicks ?? null;
    }
    map.set(r.key, row);
  }
  for (const r of paid) {
    const row = map.get(r.key);
    if (row) row.paidGmv = (row.paidGmv ?? 0) + (r.gmv ?? 0);
  }
  for (const row of map.values()) row.ctr = row.impressions && row.clicks !== null ? row.clicks / row.impressions : null;
  // CVR on the product card = product-card orders / product-card clicks.
  for (const r of placed.filter((x) => x.channel === 'product_card')) {
    const row = map.get(r.key)!;
    row.cvr = r.clicks ? (r.orders ?? 0) / r.clicks : null;
  }
  const mix = channelMix(dataset, filter, 'placed');
  const listed = [...map.values()].reduce((s, r) => s + r.gmv, 0);
  const coverage = mix.total ? Math.min(1, listed / mix.total) : null;
  notes.push({
    vi: `Shopee chỉ liệt kê vài sản phẩm đứng đầu mỗi kênh — các sản phẩm dưới đây chiếm khoảng ${coverage === null ? '—' : Math.round(coverage * 100) + '%'} doanh số. Số đơn có thể lẻ vì Shopee chia đơn cho nhiều nguồn.`,
    en: `Shopee lists only the top products per channel (≈${coverage === null ? '—' : Math.round(coverage * 100) + '%'} of sales).`,
  });
  notes.push({ vi: 'Chưa có giá vốn theo đơn nên chưa tính được lợi nhuận sản phẩm — cần file xuất đơn hàng.', en: 'No per-order COGS: product profit needs an order export.' });
  const p = placed.find((r) => r.periodStart);
  return { available: true, period: p ? { start: p.periodStart!, end: p.date } : null, rows: [...map.values()].sort((a, b) => b.gmv - a.gmv), coverage, notes };
}

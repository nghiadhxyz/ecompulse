/**
 * Summary-report analytics (no order lines): revenue by channel / traffic source and the
 * top products the platform lists.
 *
 * The report gives most figures twice — one row for the whole period and one per day.
 * When the range covers the whole period the platform's period row is used; otherwise the
 * daily rows in the range are summed (periodRows.ts). Rates are always recomputed from
 * their numerator and denominator. Distinct counts (unique impressions / clicks) only
 * exist in period rows: over part of the period they are sums of daily values and are
 * flagged as such.
 */
import type { CanonicalDataset, SalesSummaryRow, SummaryChannel, SummaryStage } from './model';
import { sliceDataset, type DatasetFilter } from './filters';
import { isInRange, type DateRange } from './period';
import type { Bilingual } from './metric';
import { moneyTolerance, ORDER_TOLERANCE, periodMismatches, selectPeriodOrDaily } from './periodRows';
import { byGap, compareCopies, FILE_RATE_LABEL, periodMismatchItems, RECOMPUTED_LABEL, type MismatchItem } from './mismatch';
import { fmtMoney, fmtOrders } from './format';

export const SUMMARY_CHANNEL_LABELS: Record<SummaryChannel, Bilingual> = {
  product_card: { vi: 'Thẻ sản phẩm (tự nhiên & tìm kiếm)', en: 'Product card' },
  live: { vi: 'Livestream của shop', en: 'Shop live' },
  video: { vi: 'Video của shop', en: 'Shop video' },
  affiliate: { vi: 'Affiliate / KOC', en: 'Affiliate' },
  ads: { vi: 'Quảng cáo Shopee', en: 'Shopee Ads' },
};

/** The four channels that add up to total sales. Ads overlaps them and is never added. */
export const SUMMARY_STACKED_CHANNELS: SummaryChannel[] = ['product_card', 'live', 'video', 'affiliate'];

/** Shopee's product, video, affiliate and live-session tables list at most this many rows. */
export const SUMMARY_TOP_N = 5;

export const summaryRowKey = (r: SalesSummaryRow) => `${r.platform}|${r.stage}|${r.dimension}|${r.channel}|${r.key}`;

function stageRows(dataset: CanonicalDataset, filter: DatasetFilter, stage: SummaryStage): SalesSummaryRow[] {
  const plat = filter.platforms?.length ? new Set(filter.platforms) : null;
  return (dataset.salesSummaries ?? []).filter((r) => r.stage === stage && (!plat || plat.has(r.platform)));
}

/** Rows the range uses: period rows for a whole period, daily rows otherwise. */
export function summaryRowsInRange(dataset: CanonicalDataset, filter: DatasetFilter, stage: SummaryStage): SalesSummaryRow[] {
  return selectPeriodOrDaily(stageRows(dataset, filter, stage), filter.range, summaryRowKey);
}

/** True when the range uses at least one whole-period row (distinct counts are real). */
function usesPeriodRows(rows: SalesSummaryRow[]): boolean {
  return rows.some((r) => r.periodStart !== undefined);
}

export function hasSalesSummaries(dataset: CanonicalDataset): boolean {
  return (dataset.salesSummaries?.length ?? 0) > 0;
}

/** Channel / source rows whose days do not add up to the platform's period row. */
export function summaryMismatches(dataset: CanonicalDataset, filter: DatasetFilter, stage: SummaryStage): MismatchItem[] {
  const rows = stageRows(dataset, filter, stage).filter((r) => r.dimension !== 'sku');
  const mm = periodMismatches(rows, filter.range, summaryRowKey, [
    { key: 'gmv', pick: (r) => r.gmv, tolerance: moneyTolerance },
    { key: 'orders', pick: (r) => r.orders, tolerance: ORDER_TOLERANCE },
  ]);
  return periodMismatchItems(
    mm,
    (m) => {
      const [, , , channel, key] = m.group.split('|');
      const name = key === channel ? SUMMARY_CHANNEL_LABELS[channel as SummaryChannel] ?? { vi: key, en: key } : { vi: key, en: key };
      return m.field === 'orders' ? { vi: `${name.vi} — số đơn`, en: `${name.en} — orders` } : { vi: `${name.vi} — doanh số`, en: `${name.en} — sales` };
    },
    (m) => (m.field === 'orders' ? 'count' : 'vnd'),
  );
}

/**
 * Printed rates of period rows (CTR, CVR, share of the channel) that differ from the ones
 * recomputed from their own numerator and denominator. Product-card rows only: the other
 * channels define their "CTR" on viewers and do not print comparable rates.
 */
export function rateMismatches(rows: SalesSummaryRow[], channelGmv: (r: SalesSummaryRow) => number | null): MismatchItem[] {
  const out: MismatchItem[] = [];
  for (const r of rows) {
    if (!r.reported || r.periodStart === undefined || r.channel !== 'product_card' || r.dimension === 'channel') continue;
    const name = r.dimension === 'sku' ? `${r.label ?? r.key} (${r.key})` : r.key;
    const add = (what: string, reported: number | undefined, computed: number | null) => {
      const m = compareCopies(`rate|${summaryRowKey(r)}|${what}`, { vi: `${name} — ${what}`, en: `${name} — ${what}` }, 'ratio', { label: RECOMPUTED_LABEL, value: computed }, { label: FILE_RATE_LABEL, value: reported });
      if (m) out.push(m);
    };
    add('CTR', r.reported.ctr, r.impressions ? (r.clicks ?? 0) / r.impressions : null);
    add('CVR', r.reported.cvr, r.clicks ? (r.orders ?? 0) / r.clicks : null);
    const ch = channelGmv(r);
    add('tỷ lệ doanh số', r.reported.share, ch ? (r.gmv ?? 0) / ch : null);
  }
  return out.sort(byGap);
}

export interface SourceMetrics {
  gmv: number;
  share: number | null;
  /** Platform-attributed, can be fractional — never rounded. */
  orders: number | null;
  clicks: number | null;
  views: number | null;
  impressions: number | null;
  uniqueImpressions: number | null;
  uniqueClicks: number | null;
  /** Unique clicks / unique impressions (per distinct user). */
  uniqueCtr: number | null;
}

export interface ChannelRow extends SourceMetrics {
  channel: SummaryChannel;
  sources: (SourceMetrics & { key: string })[];
}

export interface ChannelMix {
  available: boolean;
  stage: SummaryStage;
  total: number;
  channels: ChannelRow[];
  /** GMV attributed to Shopee Ads (overlaps the channels above). */
  adsGmv: number | null;
  /** adsGmv / total — "share of sales with ads involved", not a channel share. */
  adsAssistedShare: number | null;
  /** False over part of the period: unique counts are then sums of daily values. */
  uniqueIsDistinct: boolean;
  /** Where the file disagrees with itself (days vs period row, printed vs recomputed rates). */
  mismatches: MismatchItem[];
  notes: Bilingual[];
}

type NumKey = 'orders' | 'clicks' | 'views' | 'impressions' | 'uniqueImpressions' | 'uniqueClicks';
const sumOrNull = (rows: SalesSummaryRow[], k: NumKey) => (rows.some((r) => r[k] !== undefined) ? rows.reduce((s, r) => s + (r[k] ?? 0), 0) : null);

function metricsOf(rows: SalesSummaryRow[], parentGmv: number | null): SourceMetrics {
  const gmv = rows.reduce((s, r) => s + (r.gmv ?? 0), 0);
  const uniqueImpressions = sumOrNull(rows, 'uniqueImpressions');
  const uniqueClicks = sumOrNull(rows, 'uniqueClicks');
  return {
    gmv,
    share: parentGmv ? gmv / parentGmv : null,
    orders: sumOrNull(rows, 'orders'),
    clicks: sumOrNull(rows, 'clicks'),
    views: sumOrNull(rows, 'views'),
    impressions: sumOrNull(rows, 'impressions'),
    uniqueImpressions,
    uniqueClicks,
    uniqueCtr: uniqueImpressions && uniqueClicks !== null ? uniqueClicks / uniqueImpressions : null,
  };
}

export function channelMix(dataset: CanonicalDataset, filter: DatasetFilter, stage: SummaryStage = 'placed'): ChannelMix {
  const rows = summaryRowsInRange(dataset, filter, stage);
  const notes: Bilingual[] = [];
  const channels: ChannelRow[] = [];
  for (const ch of SUMMARY_STACKED_CHANNELS) {
    const chRows = rows.filter((r) => r.dimension === 'channel' && r.channel === ch);
    const srcRows = rows.filter((r) => r.dimension === 'source' && r.channel === ch);
    if (chRows.length === 0 && srcRows.length === 0) continue;
    const base = metricsOf(chRows.length ? chRows : srcRows, null);
    const bySource = new Map<string, SalesSummaryRow[]>();
    for (const r of srcRows) bySource.set(r.key, [...(bySource.get(r.key) ?? []), r]);
    channels.push({
      channel: ch,
      ...base,
      sources: [...bySource.entries()].map(([key, xs]) => ({ key, ...metricsOf(xs, base.gmv) })).sort((a, b) => b.gmv - a.gmv),
    });
  }
  const total = channels.reduce((s, c) => s + c.gmv, 0);
  for (const c of channels) c.share = total ? c.gmv / total : null;

  // Canonical Ads sales = the sum of the ad rows (canonicalSources.ts), never the sheet header.
  // Ad rows exist for placed orders only.
  const slicedAds = sliceDataset(dataset, filter).ads;
  const adsGmv = stage === 'placed' && slicedAds.some((a) => a.attributedRevenue !== undefined) ? slicedAds.reduce((s, a) => s + (a.attributedRevenue ?? 0), 0) : null;

  const whole = usesPeriodRows(rows);
  const partialPeriod = (dataset.salesSummaries ?? []).some(
    (r) => r.periodStart && r.stage === stage && r.date >= filter.range.start && r.periodStart <= filter.range.end && !(r.periodStart >= filter.range.start && r.date <= filter.range.end),
  );
  if (partialPeriod && channels.length === 0) notes.push({ vi: 'Một số số liệu chỉ có tổng cả kỳ báo cáo — chọn trọn kỳ báo cáo để xem đầy đủ.', en: 'Some rows are period totals; select the full report period to include them.' });
  if (channels.length) {
    notes.push({
      vi: 'Doanh số có Quảng cáo Shopee hỗ trợ nằm sẵn trong các kênh trên (khách bấm quảng cáo rồi mua qua thẻ sản phẩm, live…) — là một lớp chồng lên, không phải kênh thứ năm, nên không cộng vào tổng.',
      en: 'Ads-assisted sales overlap the channels above and are not added to the total.',
    });
    notes.push({ vi: 'Số đơn theo kênh/nguồn có thể lẻ: Shopee chia một đơn cho các nguồn theo mức đóng góp, nên tổng các nguồn không nhất thiết bằng tổng đơn.', en: 'Orders by source can be fractional (shared attribution).' });
  }
  if (!whole && channels.some((c) => c.uniqueImpressions !== null)) {
    notes.push({ vi: 'Lượt hiển thị/nhấp duy nhất khi chọn một phần kỳ là cộng từng ngày (một người xem nhiều ngày được đếm nhiều lần). Chọn trọn kỳ để có số người duy nhất.', en: 'Unique counts over part of the period are sums of daily values.' });
  }
  const channelRowGmv = (r: SalesSummaryRow) => rows.find((x) => x.dimension === 'channel' && x.channel === r.channel)?.gmv ?? null;
  const mismatches = [...summaryMismatches(dataset, filter, stage), ...rateMismatches(rows.filter((r) => r.dimension === 'source'), channelRowGmv)].sort(byGap);
  return { available: channels.length > 0, stage, total, channels: channels.sort((a, b) => b.gmv - a.gmv), adsGmv, adsAssistedShare: adsGmv !== null && total ? adsGmv / total : null, uniqueIsDistinct: whole, mismatches, notes };
}

export interface SummaryProductRow {
  sku: string;
  name: string;
  gmv: number;
  paidGmv: number | null;
  orders: number | null;
  units: number | null;
  /** Null when the product appears in several channels (buyers are not additive across channels). */
  buyers: number | null;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  cvr: number | null;
  byChannel: Partial<Record<SummaryChannel, number>>;
}

export interface ChannelTopProducts {
  channel: SummaryChannel;
  rows: {
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
    uniqueCtr: number | null;
  }[];
  /** Listed products' share of the channel's sales. */
  coverage: number | null;
}

export interface SummaryProducts {
  available: boolean;
  period: DateRange | null;
  /** Products merged across channels (for "best product" answers). */
  rows: SummaryProductRow[];
  /** Shopee's own Top 5 per channel. */
  byChannel: ChannelTopProducts[];
  /** Share of channel GMV covered by the listed products. */
  coverage: number | null;
  /** Printed CTR / CVR / share of the listed products that differ from the recomputed ones. */
  mismatches: MismatchItem[];
  notes: Bilingual[];
}

export function summaryProducts(dataset: CanonicalDataset, filter: DatasetFilter): SummaryProducts {
  const placed = summaryRowsInRange(dataset, filter, 'placed').filter((r) => r.dimension === 'sku');
  const paid = summaryRowsInRange(dataset, filter, 'paid').filter((r) => r.dimension === 'sku');
  const notes: Bilingual[] = [];
  const anySku = (dataset.salesSummaries ?? []).some((r) => r.dimension === 'sku');
  if (placed.length === 0) {
    if (anySku) notes.push({ vi: 'Số liệu Top 5 sản phẩm là tổng cả kỳ báo cáo — hãy chọn khoảng thời gian bao trọn kỳ đó.', en: 'Top-5 product rows are period totals — select a range covering the whole report period.' });
    const p = (dataset.salesSummaries ?? []).find((r) => r.dimension === 'sku' && r.periodStart);
    return { available: false, period: p ? { start: p.periodStart!, end: p.date } : null, rows: [], byChannel: [], coverage: null, mismatches: [], notes };
  }
  const paidBy = (channel: SummaryChannel, sku: string) => paid.find((r) => r.channel === channel && r.key === sku)?.gmv ?? null;
  const map = new Map<string, SummaryProductRow & { channels: Set<SummaryChannel> }>();
  for (const r of placed) {
    const row = map.get(r.key) ?? { sku: r.key, name: r.label ?? r.key, gmv: 0, paidGmv: null, orders: 0, units: 0, buyers: 0, impressions: null, clicks: null, ctr: null, cvr: null, byChannel: {}, channels: new Set<SummaryChannel>() };
    row.gmv += r.gmv ?? 0;
    row.orders = (row.orders ?? 0) + (r.orders ?? 0);
    row.units = (row.units ?? 0) + (r.units ?? 0);
    row.buyers = (row.buyers ?? 0) + (r.buyers ?? 0);
    row.channels.add(r.channel);
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
  for (const row of map.values()) {
    row.ctr = row.impressions && row.clicks !== null ? row.clicks / row.impressions : null;
    // The same buyer can appear in several channels.
    if (row.channels.size > 1) row.buyers = null;
  }
  // CVR on the product card = product-card orders / product-card clicks.
  for (const r of placed.filter((x) => x.channel === 'product_card')) {
    const row = map.get(r.key)!;
    row.cvr = r.clicks ? (r.orders ?? 0) / r.clicks : null;
  }
  const mix = channelMix(dataset, filter, 'placed');
  const byChannel: ChannelTopProducts[] = SUMMARY_STACKED_CHANNELS.map((channel) => {
    const rows = placed
      .filter((r) => r.channel === channel)
      .map((r) => ({
        sku: r.key,
        name: r.label ?? r.key,
        gmv: r.gmv ?? 0,
        paidGmv: paidBy(channel, r.key),
        orders: r.orders ?? null,
        units: r.units ?? null,
        buyers: r.buyers ?? null,
        impressions: r.impressions ?? null,
        clicks: r.clicks ?? null,
        ctr: r.impressions && r.clicks !== undefined ? r.clicks / r.impressions : null,
        cvr: r.clicks ? (r.orders ?? 0) / r.clicks : null,
        uniqueCtr: r.uniqueImpressions && r.uniqueClicks !== undefined ? r.uniqueClicks / r.uniqueImpressions : null,
      }))
      .sort((a, b) => b.gmv - a.gmv);
    const chGmv = mix.channels.find((c) => c.channel === channel)?.gmv ?? null;
    return { channel, rows, coverage: chGmv ? Math.min(1, rows.reduce((s, r) => s + r.gmv, 0) / chGmv) : null };
  }).filter((c) => c.rows.length > 0);
  const listed = [...map.values()].reduce((s, r) => s + r.gmv, 0);
  const coverage = mix.total ? Math.min(1, listed / mix.total) : null;
  notes.push({
    vi: `Shopee chỉ liệt kê Top ${SUMMARY_TOP_N} sản phẩm mỗi kênh — không phải tất cả sản phẩm. Các sản phẩm này chiếm khoảng ${coverage === null ? '—' : Math.round(coverage * 100) + '%'} doanh số. Số đơn có thể lẻ vì Shopee chia đơn cho nhiều nguồn.`,
    en: `Shopee lists only the top ${SUMMARY_TOP_N} products per channel (≈${coverage === null ? '—' : Math.round(coverage * 100) + '%'} of sales).`,
  });
  notes.push({ vi: 'Chưa có giá vốn theo đơn nên chưa tính được lợi nhuận sản phẩm — cần file xuất đơn hàng.', en: 'No per-order COGS: product profit needs an order export.' });
  const p = placed.find((r) => r.periodStart);
  const rows = [...map.values()].map(({ channels: _c, ...r }) => r).sort((a, b) => b.gmv - a.gmv);
  const mismatches = rateMismatches(placed, (r) => mix.channels.find((c) => c.channel === r.channel)?.gmv ?? null);
  return { available: true, period: p ? { start: p.periodStart!, end: p.date } : null, rows, byChannel, coverage, mismatches, notes };
}

/** Daily rows of one stage in a range (never period rows) — for series by day. */
export function dailySummaryRows(dataset: CanonicalDataset, range: DateRange, stage: SummaryStage, platforms?: DatasetFilter['platforms']): SalesSummaryRow[] {
  return stageRows(dataset, { range, platforms }, stage).filter((r) => r.periodStart === undefined && isInRange(r.date, range));
}

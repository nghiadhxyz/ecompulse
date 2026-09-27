/**
 * Canonical source of every summary-report figure — the one place that decides which of the
 * file's copies of a number the app uses. Shopee's "Phân tích bán hàng" export prints most
 * figures 3–5 times (period row, header rows, undated block totals, day rows, sessions) and
 * they do not always agree. Every page reads the canonical source; the other copies are only
 * compared, so a file that disagrees with itself is flagged instead of silently mixed.
 *
 * Rules
 *  - Whole report period selected → the canonical period figure. Days or part of the
 *    period → the sum of the day rows (`dailyCanonical`).
 *  - A calculation takes its numerator and denominator from the same source
 *    (e.g. subsidy share = (sales − sales excl. subsidy) / sales, all from the period row).
 *  - Channel and Ads figures come from the channel sheet "Nguồn truy cập cho Đơn hàng…".
 *  - Live sessions (top 5 only) are a subset of the Live channel: more session sales than
 *    channel sales cannot happen in a real export and is flagged as invalid.
 */
import type { CanonicalDataset, DailyMetric, Platform, ReportedFigure, SummaryChannel, SummaryStage } from './model';
import type { Bilingual } from './metric';
import type { DateRange } from './period';
import { moneyTolerance, ORDER_TOLERANCE } from './periodRows';
import { STAGE_BASIS } from './orderStage';

export type SourceId =
  | 'period_row'
  | 'daily_sum'
  | 'channel_row'
  | 'ad_rows'
  | 'ad_row'
  | 'traffic_header'
  | 'product_header'
  | 'daily_sheet_total'
  | 'live_sessions';

export const SOURCE_LABELS: Record<SourceId, Bilingual> = {
  period_row: { vi: 'Dòng tổng cả kỳ (sheet Đơn hàng đã đặt / Đơn Đã Thanh Toán)', en: 'Period row of the order sheets' },
  daily_sum: { vi: 'Cộng các ngày', en: 'Sum of the day rows' },
  channel_row: { vi: 'Dòng kênh trong sheet "Nguồn truy cập cho Đơn hàng…"', en: 'Channel row of the channel sheet' },
  ad_rows: { vi: 'Tổng các dòng quảng cáo trong sheet "Nguồn truy cập cho Đơn hàng…"', en: 'Sum of the ad rows of the channel sheet' },
  ad_row: { vi: 'Dòng quảng cáo trong sheet "Nguồn truy cập cho Đơn hàng…"', en: 'Ad row of the channel sheet' },
  traffic_header: { vi: 'Dòng đầu sheet "Nguồn truy cập cho Đơn hàng…"', en: 'Header row of the channel sheet' },
  product_header: { vi: 'Dòng đầu sheet "Theo sản phẩm"', en: 'Header row of the product sheet' },
  daily_sheet_total: { vi: 'Dòng tổng không ngày của sheet theo nguồn từng ngày', en: 'Undated total row of the daily source sheet' },
  live_sessions: { vi: 'Cộng các phiên live (sheet "Session Contribution", Top 5)', en: 'Sum of the live sessions (top 5)' },
};

export type CanonicalMetric = 'shop' | 'channel' | 'adsTotal' | 'adType' | 'liveSessions';

/** The configuration: canonical source per metric, and the copies that are only compared. */
export const CANONICAL_SOURCES: Record<CanonicalMetric, { label: Bilingual; canonical: SourceId; dailyCanonical?: SourceId; compared: SourceId[] }> = {
  shop: {
    label: { vi: 'Doanh số, đơn, hủy, hoàn của shop', en: 'Shop sales, orders, cancellations, refunds' },
    canonical: 'period_row',
    dailyCanonical: 'daily_sum',
    compared: ['daily_sum', 'traffic_header', 'product_header'],
  },
  channel: {
    label: { vi: 'Doanh số theo kênh / nguồn truy cập', en: 'Sales by channel / traffic source' },
    canonical: 'channel_row',
    dailyCanonical: 'daily_sum',
    compared: ['traffic_header', 'product_header', 'daily_sheet_total', 'daily_sum'],
  },
  adsTotal: {
    label: { vi: 'Doanh số có Quảng cáo Shopee (tổng)', en: 'Shopee Ads sales (total)' },
    canonical: 'ad_rows',
    dailyCanonical: 'daily_sum',
    compared: ['traffic_header', 'product_header', 'daily_sum'],
  },
  adType: {
    label: { vi: 'Chi phí và doanh số từng loại quảng cáo', en: 'Spend and sales per ad type' },
    canonical: 'ad_row',
    dailyCanonical: 'daily_sum',
    compared: ['daily_sheet_total', 'daily_sum'],
  },
  liveSessions: {
    label: { vi: 'Doanh số Live (kênh so với các phiên)', en: 'Live sales (channel vs sessions)' },
    canonical: 'channel_row',
    compared: ['live_sessions'],
  },
};

export interface SourceValue {
  source: SourceId;
  value: number;
  diff: number;
  withinTolerance: boolean;
}

export interface SourceCheck {
  id: string;
  metric: CanonicalMetric;
  label: Bilingual;
  platform: Platform;
  stage: SummaryStage;
  unit: 'vnd' | 'count';
  period: DateRange;
  canonical: { source: SourceId; value: number };
  others: SourceValue[];
  /** Some copy differs from the canonical figure by more than the rounding tolerance. */
  mismatch: boolean;
  /** A relation that cannot hold in a real export (e.g. sessions above their channel). */
  invalid: Bilingual | null;
}

type ShopField = 'gmv' | 'orders' | 'cancelledOrders' | 'cancelledGmv' | 'refundedOrders' | 'refundedGmv' | 'noSubsidyGmv' | 'productClicks';

const SHOP_FIELDS: { field: ShopField; unit: 'vnd' | 'count'; vi: string; en: string }[] = [
  { field: 'gmv', unit: 'vnd', vi: 'Doanh số', en: 'Sales' },
  { field: 'orders', unit: 'count', vi: 'Số đơn', en: 'Orders' },
  { field: 'cancelledOrders', unit: 'count', vi: 'Đơn hủy', en: 'Cancelled orders' },
  { field: 'cancelledGmv', unit: 'vnd', vi: 'Doanh số hủy', en: 'Cancelled sales' },
  { field: 'refundedOrders', unit: 'count', vi: 'Đơn hoàn', en: 'Refunded orders' },
  { field: 'refundedGmv', unit: 'vnd', vi: 'Doanh số hoàn', en: 'Refunded sales' },
  { field: 'noSubsidyGmv', unit: 'vnd', vi: 'Doanh số không gồm trợ giá', en: 'Sales excl. subsidy' },
  { field: 'productClicks', unit: 'count', vi: 'Lượt nhấp sản phẩm', en: 'Product clicks' },
];

function dayField(d: DailyMetric, stage: SummaryStage, field: ShopField): number | undefined {
  if (field === 'productClicks') return d.productClicks;
  if (stage === 'placed') {
    return { gmv: d.placedGmv, orders: d.placedOrders, cancelledOrders: d.cancelledOrders, cancelledGmv: d.cancelledGmv, refundedOrders: d.refundedOrders, refundedGmv: d.refundedGmv, noSubsidyGmv: d.placedNoSubsidyGmv }[field];
  }
  if (stage === 'paid') {
    return { gmv: d.paidGmv, orders: d.paidOrders, cancelledOrders: d.paidCancelledOrders, cancelledGmv: d.paidCancelledGmv, refundedOrders: d.paidRefundedOrders, refundedGmv: d.paidRefundedGmv, noSubsidyGmv: undefined }[field];
  }
  return field === 'gmv' ? d.confirmedGmv : field === 'orders' ? d.confirmedOrders : undefined;
}

const sumDefined = (xs: (number | undefined)[]) => (xs.some((x) => x !== undefined) ? xs.reduce<number>((s, x) => s + (x ?? 0), 0) : undefined);

const CHANNELS: SummaryChannel[] = ['product_card', 'live', 'video', 'affiliate'];

/**
 * Compares every canonical figure of each report period with the file's other copies of it.
 * Only whole report periods are checked: that is where the copies describe the same thing.
 */
export function sourceChecks(dataset: CanonicalDataset, platforms?: Platform[]): SourceCheck[] {
  const out: SourceCheck[] = [];
  const inPlatforms = (p: Platform) => !platforms?.length || platforms.includes(p);
  const reported = (dataset.reportedFigures ?? []).filter((r) => inPlatforms(r.platform));
  const periods = new Map<string, { platform: Platform; start: string; end: string }>();
  for (const t of dataset.periodTotals ?? []) if (inPlatforms(t.platform)) periods.set(`${t.platform}|${t.start}|${t.end}`, { platform: t.platform, start: t.start, end: t.end });
  for (const r of dataset.salesSummaries ?? []) if (r.periodStart && inPlatforms(r.platform)) periods.set(`${r.platform}|${r.periodStart}|${r.date}`, { platform: r.platform, start: r.periodStart, end: r.date });

  for (const { platform, start, end } of periods.values()) {
    const period = { start, end };
    const inPeriod = (date: string) => date >= start && date <= end;
    const days = dataset.dailyMetrics.filter((d) => d.platform === platform && inPeriod(d.date));
    const rep = (pred: (r: ReportedFigure) => boolean) => reported.filter((r) => r.platform === platform && r.start === start && r.end === end && pred(r));

    const push = (
      metric: CanonicalMetric,
      id: string,
      label: Bilingual,
      stage: SummaryStage,
      unit: 'vnd' | 'count',
      canonical: { source: SourceId; value: number | undefined },
      others: { source: SourceId; value: number | undefined }[],
      invalid: Bilingual | null = null,
    ) => {
      if (canonical.value === undefined) return;
      const tol = unit === 'vnd' ? moneyTolerance(canonical.value) : ORDER_TOLERANCE;
      const vals: SourceValue[] = others
        .filter((o): o is { source: SourceId; value: number } => o.value !== undefined)
        .map((o) => ({ source: o.source, value: o.value, diff: o.value - canonical.value!, withinTolerance: Math.abs(o.value - canonical.value!) <= tol }));
      if (vals.length === 0 && !invalid) return;
      out.push({ id, metric, label, platform, stage, unit, period, canonical: { source: canonical.source, value: canonical.value }, others: vals, mismatch: vals.some((v) => !v.withinTolerance), invalid });
    };

    // ---- shop totals: period row vs days (and the header rows for sales)
    for (const t of (dataset.periodTotals ?? []).filter((x) => x.platform === platform && x.start === start && x.end === end)) {
      for (const f of SHOP_FIELDS) {
        if (f.field === 'productClicks' && t.stage !== 'placed') continue;
        const header = f.field === 'gmv' ? (src: ReportedFigure['source']) => rep((r) => r.source === src && r.stage === t.stage && r.scope === 'shop')[0]?.value : () => undefined;
        push(
          'shop',
          `shop|${platform}|${start}|${t.stage}|${f.field}`,
          { vi: `${f.vi} (${STAGE_BASIS[t.stage].vi.toLowerCase()})`, en: `${f.en} (${STAGE_BASIS[t.stage].en.toLowerCase()})` },
          t.stage,
          f.unit,
          { source: 'period_row', value: t[f.field] },
          [
            { source: 'daily_sum', value: sumDefined(days.map((d) => dayField(d, t.stage, f.field))) },
            { source: 'traffic_header', value: header('traffic_header') },
            { source: 'product_header', value: header('product_header') },
          ],
        );
      }
    }

    // ---- channels: channel row vs header rows, undated block total, days
    const summaries = (dataset.salesSummaries ?? []).filter((r) => r.platform === platform && r.dimension === 'channel');
    for (const stage of ['placed', 'confirmed', 'paid'] as SummaryStage[]) {
      for (const channel of CHANNELS) {
        const row = summaries.find((r) => r.stage === stage && r.channel === channel && r.periodStart === start && r.date === end);
        if (!row) continue;
        const reportedOf = (src: ReportedFigure['source']) => rep((r) => r.source === src && r.stage === stage && r.scope === 'channel' && r.key === channel)[0]?.value;
        const daily = summaries.filter((r) => r.stage === stage && r.channel === channel && r.periodStart === undefined && inPeriod(r.date));
        const name = CHANNEL_NAMES[channel];
        push(
          'channel',
          `channel|${platform}|${start}|${stage}|${channel}`,
          { vi: `Doanh số kênh ${name.vi} (${STAGE_BASIS[stage].vi.toLowerCase()})`, en: `${name.en} sales (${STAGE_BASIS[stage].en.toLowerCase()})` },
          stage,
          'vnd',
          { source: 'channel_row', value: row.gmv },
          [
            { source: 'traffic_header', value: reportedOf('traffic_header') },
            { source: 'product_header', value: reportedOf('product_header') },
            { source: 'daily_sheet_total', value: reportedOf('daily_sheet_total') },
            { source: 'daily_sum', value: daily.length ? sumDefined(daily.map((r) => r.gmv)) : undefined },
          ],
        );
        // Live sessions are part of the Live channel: more session sales than channel sales is impossible.
        if (channel === 'live' && stage === 'placed') {
          const sessions = dataset.liveSessions.filter((s) => s.platform === platform && s.periodStart === start && s.date === end && s.gmv !== undefined);
          if (sessions.length && row.gmv !== undefined) {
            const total = sessions.reduce((s, x) => s + (x.gmv ?? 0), 0);
            const over = total - row.gmv > moneyTolerance(row.gmv);
            push(
              'liveSessions',
              `live_sessions|${platform}|${start}`,
              { vi: `Doanh số Live: kênh so với Top ${sessions.length} phiên`, en: `Live sales: channel vs top ${sessions.length} sessions` },
              'placed',
              'vnd',
              { source: 'channel_row', value: row.gmv },
              [{ source: 'live_sessions', value: total }],
              over
                ? {
                    vi: `Tổng ${sessions.length} phiên (${fmt(total)}) lớn hơn doanh số cả kênh Live (${fmt(row.gmv)}) — không thể xảy ra vì phiên là một phần của kênh.`,
                    en: `The ${sessions.length} sessions add up to more than the whole Live channel — impossible, sessions are part of the channel.`,
                  }
                : null,
            );
          }
        }
      }
    }

    // ---- Shopee Ads (placed only): ad rows vs header rows, undated block totals, days
    const adRows = dataset.ads.filter((a) => a.platform === platform);
    const periodAds = adRows.filter((a) => a.periodStart === start && a.date === end);
    const dailyAds = adRows.filter((a) => a.periodStart === undefined && inPeriod(a.date));
    if (periodAds.length) {
      const adsTotal = (src: ReportedFigure['source']) => rep((r) => r.source === src && r.stage === 'placed' && r.scope === 'ads_total')[0]?.value;
      push(
        'adsTotal',
        `ads_total|${platform}|${start}`,
        { vi: 'Doanh số có Quảng cáo Shopee (tổng)', en: 'Shopee Ads sales (total)' },
        'placed',
        'vnd',
        { source: 'ad_rows', value: sumDefined(periodAds.map((a) => a.attributedRevenue)) },
        [
          { source: 'traffic_header', value: adsTotal('traffic_header') },
          { source: 'product_header', value: adsTotal('product_header') },
          { source: 'daily_sum', value: dailyAds.length ? sumDefined(dailyAds.map((a) => a.attributedRevenue)) : undefined },
        ],
      );
      for (const ad of periodAds) {
        const name = ad.adName ?? ad.campaignId ?? 'ads';
        const theseDays = dailyAds.filter((a) => a.adName === ad.adName);
        for (const [field, value, vi, en] of [
          ['spend', ad.spend, 'Chi phí', 'Spend'],
          ['gmv', ad.attributedRevenue, 'Doanh số', 'Sales'],
        ] as const) {
          push(
            'adType',
            `ad|${platform}|${start}|${name}|${field}`,
            { vi: `${vi} · ${name}`, en: `${en} · ${name}` },
            'placed',
            'vnd',
            { source: 'ad_row', value },
            [
              { source: 'daily_sheet_total', value: rep((r) => r.source === 'daily_sheet_total' && r.scope === 'ad' && r.key === name && r.field === field)[0]?.value },
              { source: 'daily_sum', value: theseDays.length ? sumDefined(theseDays.map((a) => (field === 'spend' ? a.spend : a.attributedRevenue))) : undefined },
            ],
          );
        }
      }
    }
  }
  return out;
}

const CHANNEL_NAMES: Record<SummaryChannel, Bilingual> = {
  product_card: { vi: 'Thẻ sản phẩm', en: 'Product card' },
  live: { vi: 'Live', en: 'Live' },
  video: { vi: 'Video', en: 'Video' },
  affiliate: { vi: 'Affiliate', en: 'Affiliate' },
  ads: { vi: 'Quảng cáo Shopee', en: 'Shopee Ads' },
};

const fmt = (v: number) => `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(v)}đ`;

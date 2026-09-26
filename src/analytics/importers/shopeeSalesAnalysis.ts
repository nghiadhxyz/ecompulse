/**
 * Shopee "Phân tích bán hàng" (Business Insights → Sales) multi-sheet export.
 *
 * The daily shop sheets ("Đơn hàng đã đặt", "Đơn đã xác nhận", "Đơn Đã Thanh Toán") are
 * handled by the classic parser + adapter. This importer reads everything else:
 *
 * - Traffic-source sheets (period and daily): revenue by channel (product card, live,
 *   video, affiliate) and by source inside each channel (Đề xuất, Tìm kiếm, …).
 * - Shopee Ads block inside those sheets: daily spend, impressions, orders, GMV per ad type.
 * - Product sheets: top products per channel (Shopee lists only the top few).
 * - Live session, video and affiliate contribution sheets (period totals, top 5).
 *
 * Sheets are recognised by their header rows, not by their (truncated) names. Every row
 * of a period sheet carries periodStart, so it only counts when the whole period is inside
 * the analysed range.
 */
import { emptyDataset, type AdPerformance, type AffiliatePerformance, type CanonicalDataset, type LiveSession, type Product, type ReportedFigure, type SalesSummaryRow, type SummaryChannel, type SummaryStage } from '../model';
import { normalizeHeader, toIsoDate, toNumber } from '../parse';
import type { SheetInput } from './orderExport';

export interface SheetReadInfo {
  name: string;
  kind: 'daily_shop' | 'sources_period' | 'sources_daily' | 'products' | 'live' | 'video' | 'affiliate' | 'skipped';
  stage?: SummaryStage;
  rows: number;
}

export interface ShopeeSalesAnalysisResult {
  dataset: CanonicalDataset;
  period: { start: string; end: string } | null;
  sheets: SheetReadInfo[];
}

const CHANNEL_TITLES: Record<string, SummaryChannel> = {
  thesanpham: 'product_card',
  live: 'live',
  video: 'video',
  tiepthilienket: 'affiliate',
  dichvuhienthishopee: 'ads',
};

/**
 * Columns of the header row every channel / product sheet starts with. These totals repeat
 * figures found elsewhere in the file (and do not always agree with them), so they are only
 * kept as reported figures for mismatch checks — see canonicalSources.ts.
 */
const HEADER_COLUMNS: [string, ReportedFigure['scope'], string][] = [
  ['Doanh số (VND)', 'shop', 'shop'],
  ['Doanh thu từ thẻ sản phẩm', 'channel', 'product_card'],
  ['Doanh thu từ Livestream của người bán', 'channel', 'live'],
  ['Doanh thu từ Video của người bán', 'channel', 'video'],
  ['Doanh thu từ đối tác liên kết', 'channel', 'affiliate'],
  ['Doanh thu từ quảng cáo Shopee', 'ads_total', 'ads'],
];

const PERIOD_RE = /^(\d{2})-(\d{2})-(\d{4})\s*-\s*(\d{2})-(\d{2})-(\d{4})$/;
const DAY_RE = /^\d{2}-\d{2}-\d{4}$/;

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
const num = (v: unknown): number | undefined => {
  const s = str(v);
  if (!s || s === '-') return undefined;
  return toNumber(v);
};

function parsePeriod(v: unknown): { start: string; end: string } | null {
  const m = PERIOD_RE.exec(str(v));
  return m ? { start: `${m[3]}-${m[2]}-${m[1]}`, end: `${m[6]}-${m[5]}-${m[4]}` } : null;
}

function stageFromText(text: string): SummaryStage | undefined {
  // Sheet names are cut at 31 characters: "(pla…", "(con…", "(pai…".
  const raw = text.toLowerCase();
  const paren = /\((pai|con|pla)/.exec(raw);
  if (paren) return paren[1] === 'pai' ? 'paid' : paren[1] === 'con' ? 'confirmed' : 'placed';
  const t = normalizeHeader(text);
  if (/thanhtoan|paid/.test(t)) return 'paid';
  if (/xacnhan|confirm/.test(t)) return 'confirmed';
  if (/dadat|placed|place/.test(t)) return 'placed';
  return undefined;
}

type Row = unknown[];

function headerIndex(header: Row): (name: string) => number {
  const norm = header.map((h) => normalizeHeader(h));
  return (name: string) => norm.indexOf(normalizeHeader(name));
}

export function isShopeeSalesAnalysis(sheets: SheetInput[]): boolean {
  return sheets.some((s) => s.rows.some((r) => normalizeHeader(r[0]) === 'nguonluuluong')) || sheets.some((s) => s.rows.some((r) => normalizeHeader(r[0]) === 'maphienchat'));
}

export function importShopeeSalesAnalysis(input: { fileName: string; sheets: SheetInput[] }): ShopeeSalesAnalysisResult {
  const ds = emptyDataset(`shopee-sales-${input.fileName}`, input.fileName);
  const platform = 'shopee' as const;
  const summaries: SalesSummaryRow[] = [];
  const ads: AdPerformance[] = [];
  const live = new Map<string, LiveSession>();
  const content = new Map<string, AffiliatePerformance>();
  const products = new Map<string, Product>();
  const reported: ReportedFigure[] = [];
  const info: SheetReadInfo[] = [];

  // Report period: first "dd-mm-yyyy-dd-mm-yyyy" cell anywhere in column A.
  let period: { start: string; end: string } | null = null;
  for (const s of input.sheets) {
    for (const r of s.rows.slice(0, 5)) {
      period = parsePeriod(r[0]);
      if (period) break;
    }
    if (period) break;
  }
  let lastStage: SummaryStage = 'placed';
  const readHeader = (rows: Row[], stage: SummaryStage, source: ReportedFigure['source']) => {
    if (!period || !rows[1] || !parsePeriod(rows[1][0])) return;
    const col = headerIndex(rows[0]);
    for (const [name, scope, key] of HEADER_COLUMNS) {
      const i = col(name);
      const value = i >= 0 ? num(rows[1][i]) : undefined;
      if (value !== undefined) reported.push({ platform, stage, start: period.start, end: period.end, source, scope, key, field: 'gmv', value });
    }
  };

  for (const sheet of input.sheets) {
    const rows = sheet.rows as Row[];
    const first = normalizeHeader(rows[0]?.[0]);
    const hasSourceHeader = rows.some((r) => normalizeHeader(r[0]) === 'nguonluuluong');
    const productHeaderIdx = rows.findIndex((r) => normalizeHeader(r[0]) === 'masanpham');
    const stageRow = rows[1] && parsePeriod(rows[1][0]) ? stageFromText(str(rows[1][1])) : undefined;
    const stage = stageRow ?? stageFromText(sheet.name) ?? lastStage;
    const push = (kind: SheetReadInfo['kind'], n: number, st?: SummaryStage) => info.push({ name: sheet.name, kind, stage: st, rows: n });

    // Daily shop sheets → classic parser (listed so the user sees them as read).
    if (first === 'ngay' && normalizeHeader(rows[0]?.[1]).startsWith('tongdoanhso')) {
      push('daily_shop', rows.filter((r) => DAY_RE.test(str(r[0]))).length, stageFromText(sheet.name));
      continue;
    }

    // Channel / source sheets
    if (hasSourceHeader && productHeaderIdx < 0) {
      if (stageRow) lastStage = stageRow;
      const daily = rows.some((r) => DAY_RE.test(str(r[0])));
      let channel: SummaryChannel | null = null;
      let col: (n: string) => number = () => -1;
      let current: { source: string; isChannelTotal: boolean } | null = null;
      let count = 0;
      // The header row repeats channel and Ads totals; the canonical figures are the channel
      // rows and the ad rows below (canonicalSources.ts), the header is only cross-checked.
      if (stageRow) readHeader(rows, stage, 'traffic_header');
      for (const r of rows) {
        const a = str(r[0]);
        const na = normalizeHeader(a);
        if (!a) continue;
        if (r.slice(1).every((v) => str(v) === '') && CHANNEL_TITLES[na]) {
          channel = CHANNEL_TITLES[na];
          continue;
        }
        if (na === 'nguonluuluong') {
          col = headerIndex(r);
          continue;
        }
        if (!channel || parsePeriod(a) || na === 'ngay') continue;
        const gmvI = col('Doanh số (VND)');
        const ordersI = col('Tổng số đơn hàng');
        const unitsI = col('Sản phẩm');
        const buyersI = col('Người mua');
        const imprI = [col('Lượt hiển thị sản phẩm'), col('Ads Impression')].find((i) => i >= 0) ?? -1;
        const viewsI = [col('Lượt xem Livestream'), col('Lượt xem Video'), col('Lượt xem nội dung')].find((i) => i >= 0) ?? -1;
        const clicksI = col('Lượt nhấp vào sản phẩm');
        const spendI = col('Chi phí quảng cáo');
        const uImprI = [col('Lượt hiển thị sản phẩm duy nhất'), col('Người xem Livestream'), col('Người xem Video'), col('Người xem nội dung')].find((i) => i >= 0) ?? -1;
        const uClickI = col('Lượt nhấp sản phẩm duy nhất');
        const metrics = {
          gmv: num(r[gmvI]),
          orders: num(r[ordersI]),
          units: unitsI >= 0 ? num(r[unitsI]) : undefined,
          buyers: buyersI >= 0 ? num(r[buyersI]) : undefined,
          impressions: imprI >= 0 ? num(r[imprI]) : undefined,
          views: viewsI >= 0 ? num(r[viewsI]) : undefined,
          clicks: clicksI >= 0 ? num(r[clicksI]) : undefined,
          uniqueImpressions: uImprI >= 0 ? num(r[uImprI]) : undefined,
          uniqueClicks: uClickI >= 0 ? num(r[uClickI]) : undefined,
        };
        if (DAY_RE.test(a)) {
          if (!current) continue;
          const date = toIsoDate(a);
          if (!date) continue;
          if (channel === 'ads') {
            // "-" stays undefined (no data), which is not 0. The "Khác" block is kept too.
            const spend = spendI >= 0 ? num(r[spendI]) : undefined;
            if (stage === 'placed') {
              ads.push({ date, platform, campaignId: `shopee-ads:${current.source}`, adName: current.source, adType: current.source, spend, impressions: metrics.impressions, orders: metrics.orders, attributedRevenue: metrics.gmv });
            }
            continue;
          }
          summaries.push({ platform, date, stage, dimension: current.isChannelTotal ? 'channel' : 'source', channel, key: current.isChannelTotal ? channel : current.source, label: current.source, ...metrics });
          count++;
          continue;
        }
        // A source (or channel-total) row.
        const isChannelTotal = CHANNEL_TITLES[na] === channel && channel !== 'ads';
        current = { source: a, isChannelTotal };
        // Daily sheets open each block with an undated total — another copy of the period
        // figure, kept for mismatch checks only.
        if (daily && period) {
          const base = { platform, stage, start: period.start, end: period.end, source: 'daily_sheet_total' as const };
          if (channel === 'ads') {
            if (metrics.gmv !== undefined) reported.push({ ...base, scope: 'ad', key: a, field: 'gmv', value: metrics.gmv });
            const spend = spendI >= 0 ? num(r[spendI]) : undefined;
            if (spend !== undefined) reported.push({ ...base, scope: 'ad', key: a, field: 'spend', value: spend });
          } else if (isChannelTotal && metrics.gmv !== undefined) {
            reported.push({ ...base, scope: 'channel', key: channel, field: 'gmv', value: metrics.gmv });
          }
        }
        if (!daily && period) {
          if (channel === 'ads') {
            const spend = spendI >= 0 ? num(r[spendI]) : undefined;
            if (stage === 'placed') {
              ads.push({ date: period.end, periodStart: period.start, platform, campaignId: `shopee-ads:${a}`, adName: a, adType: a, spend, impressions: metrics.impressions, orders: metrics.orders, attributedRevenue: metrics.gmv });
            }
            continue;
          }
          summaries.push({
            platform,
            date: period.end,
            periodStart: period.start,
            stage,
            dimension: isChannelTotal ? 'channel' : 'source',
            channel,
            key: isChannelTotal ? channel : a,
            label: a,
            ...metrics,
          });
          count++;
        }
      }
      push(daily ? 'sources_daily' : 'sources_period', count, stage);
      continue;
    }

    // Product sheets
    if (productHeaderIdx >= 0 && period) {
      if (stageRow) lastStage = stageRow;
      if (stageRow) readHeader(rows, stage, 'product_header');
      let channel: SummaryChannel | null = null;
      let col: (n: string) => number = () => -1;
      let count = 0;
      for (const r of rows) {
        const a = str(r[0]);
        const na = normalizeHeader(a);
        if (!a) continue;
        if (r.slice(1).every((v) => str(v) === '') && CHANNEL_TITLES[na]) {
          channel = CHANNEL_TITLES[na];
          continue;
        }
        if (na === 'masanpham') {
          col = headerIndex(r);
          continue;
        }
        if (!channel || !/^\d{5,}$/.test(a)) continue;
        const name = str(r[col('Sản phẩm')]) || undefined;
        if (!products.has(a)) products.set(a, { sku: a, productId: a, name });
        summaries.push({
          platform,
          date: period.end,
          periodStart: period.start,
          stage,
          dimension: 'sku',
          channel,
          key: a,
          label: name,
          gmv: num(r[col('Doanh số (VND)')]),
          orders: num(r[col('Tổng số đơn hàng')]),
          // Two "Sản phẩm" columns: the name (first) and units sold (second).
          units: num(r[headerUnitsIndex(rows[productHeaderIdx] as Row)]),
          buyers: num(r[col('Người mua')]),
          impressions: num(r[col('Lượt hiển thị sản phẩm')]),
          clicks: num(r[col('Lượt nhấp vào sản phẩm')]),
          uniqueImpressions: num(r[col('Lượt hiển thị sản phẩm duy nhất')]),
          uniqueClicks: num(r[col('Lượt nhấp sản phẩm duy nhất')]),
        });
        count++;
      }
      push('products', count, stage);
      continue;
    }

    // Live sessions
    const liveHead = rows.findIndex((r) => normalizeHeader(r[0]) === 'maphienchat');
    if (liveHead >= 0 && period) {
      const st = stageFromText(sheet.name) ?? 'placed';
      const col = headerIndex(rows[liveHead]);
      let count = 0;
      for (const r of rows.slice(liveHead + 1)) {
        const id = str(r[0]);
        if (!id) continue;
        const s = live.get(id) ?? { sessionId: `shopee-live-${id}`, platform, date: period.end, periodStart: period.start, title: str(r[col('Session Title')]) || undefined };
        const orders = num(r[col('psd_label_orders')]);
        if (st === 'placed') {
          const watch = str(r[col('Avg. Watch Duration')]);
          const hms = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(watch);
          Object.assign(s, {
            gmv: num(r[col('Doanh số (VND)')]),
            orders,
            views: num(r[col('Lượt xem Livestream')]),
            viewers: num(r[col('Người xem Livestream')]),
            avgWatchSeconds: hms ? Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3]) : undefined,
            productClicks: num(r[col('Lượt nhấp vào sản phẩm')]),
            addToCart: num(r[col('ATC')]),
          });
        } else if (st === 'paid') s.paidOrders = orders;
        live.set(id, s);
        count++;
      }
      push('live', count, st);
      continue;
    }

    // Shop videos and affiliates (period, top list)
    const videoHead = rows.findIndex((r) => normalizeHeader(r[0]) === 'psdlabelvideoid');
    const affHead = rows.findIndex((r) => normalizeHeader(r[0]) === 'affiliateusername');
    if ((videoHead >= 0 || affHead >= 0) && period) {
      const st = stageFromText(sheet.name) ?? 'placed';
      const head = videoHead >= 0 ? videoHead : affHead;
      const col = headerIndex(rows[head]);
      let count = 0;
      for (const r of rows.slice(head + 1)) {
        const id = str(r[0]);
        if (!id) continue;
        count++;
        if (st !== 'placed') continue; // placed-order contribution, consistent with the other channels
        const key = `${videoHead >= 0 ? 'video' : 'aff'}|${id}`;
        content.set(
          key,
          videoHead >= 0
            ? {
                date: period.end,
                periodStart: period.start,
                platform,
                creatorId: 'shop',
                contentType: 'shop_video',
                contentId: id,
                contentTitle: str(r[col('Video')]) || undefined,
                views: num(r[col('Lượt xem Video')]),
                clicks: num(r[col('Lượt nhấp vào sản phẩm')]),
                orders: num(r[col('psd_label_orders')]),
                gmv: num(r[col('Doanh số (VND)')]),
              }
            : {
                date: period.end,
                periodStart: period.start,
                platform,
                creatorId: id,
                contentType: 'affiliate',
                views: num(r[col('Lượt xem nội dung')]),
                clicks: num(r[col('Lượt nhấp vào sản phẩm')]),
                orders: num(r[col('psd_label_orders')]),
                gmv: num(r[col('Doanh số (VND)')]),
              },
        );
      }
      push(videoHead >= 0 ? 'video' : 'affiliate', count, st);
      continue;
    }

    push('skipped', 0);
  }

  // Period totals and daily rows describe the same sales. Both are kept: engines use the
  // period row when the whole period is selected and the daily rows otherwise (periodRows.ts),
  // so nothing is counted twice and the platform's own totals are not re-derived by summing
  // rounded days.
  ds.salesSummaries = summaries;
  ds.reportedFigures = reported;
  ds.ads = ads;
  ds.liveSessions = [...live.values()];
  ds.affiliates = [...content.values()];
  ds.products = [...products.values()];
  ds.sources = [{ fileName: input.fileName, platform, reportType: 'shopee_sales_analysis', importedAt: new Date().toISOString(), rowCount: summaries.length + ads.length }];
  const notes: { vi: string; en: string }[] = [];
  if (products.size) notes.push({ vi: 'Báo cáo Phân tích bán hàng của Shopee chỉ có Top 5 sản phẩm mỗi kênh, Top 5 video, Top 5 affiliate và Top 5 phiên live — không phải toàn bộ.', en: 'Shopee lists only the top 5 products per channel, top 5 videos, affiliates and live sessions.' });
  if (live.size) notes.push({ vi: 'Phiên live không có ngày giờ — số theo phiên chỉ xem được khi chọn trọn kỳ, không xếp được theo khung giờ. Doanh số kênh Live theo từng ngày vẫn có (phân tích theo thứ ở mức kênh).', en: 'Live sessions have no date/time: per-session figures need the full period; daily Live channel sales are available.' });
  ds.importNotes = notes;
  return { dataset: ds, period, sheets: info };
}

function headerUnitsIndex(header: Row): number {
  const norm = header.map((h) => normalizeHeader(h));
  const first = norm.indexOf('sanpham');
  return norm.indexOf('sanpham', first + 1);
}

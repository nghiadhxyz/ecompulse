/**
 * Report importers: Ads, Livestream, Product traffic, Affiliate/Video and Product
 * catalog (SKU → name, category, niche, COGS) for Shopee / TikTok Shop / Lazada and
 * the EcomPulse template.
 *
 * Column names follow each seller centre's public export formats (Vietnamese and
 * English). NOTE: written against published formats, not verified shop files — adjust
 * the SPECS candidate lists when real exports differ.
 *
 * Period totals: when a report has no date column, its rows are stored as one total
 * for the report period (read from the title rows or the file name). They are never
 * spread across days (see `periodStart` in the model).
 */
import {
  emptyDataset,
  type AdPerformance,
  type AffiliatePerformance,
  type CanonicalDataset,
  type LiveSession,
  type Platform,
  type Product,
  type TrafficDaily,
} from '../model';
import { normalizeHeader, toIsoDate, toNumber } from '../parse';
import type { Bilingual } from '../metric';
import type { DateRange } from '../period';
import type { SheetInput, WorkbookInput } from './orderExport';

export type ReportKind = 'ads' | 'live' | 'traffic' | 'affiliate' | 'catalog';

export const REPORT_KIND_LABELS: Record<ReportKind, Bilingual> = {
  ads: { vi: 'Báo cáo quảng cáo', en: 'Ads report' },
  live: { vi: 'Báo cáo livestream', en: 'Live report' },
  traffic: { vi: 'Báo cáo traffic sản phẩm', en: 'Product traffic report' },
  affiliate: { vi: 'Báo cáo affiliate / video', en: 'Affiliate / video report' },
  catalog: { vi: 'Danh mục sản phẩm', en: 'Product catalog' },
};

interface TableSpec {
  kind: ReportKind;
  platform: Platform | 'generic';
  label: string;
  /** Normalized headers; at least `minSignature` must be present. */
  signature: string[];
  minSignature?: number;
  columns: Record<string, string[]>;
  required: string[][]; // each inner list: at least one of these fields
}


const SPECS: TableSpec[] = [
  // ---------------- ADS
  {
    kind: 'ads',
    platform: 'shopee',
    label: 'Shopee Ads',
    signature: ['Tên quảng cáo', 'Tên Dịch vụ Hiển thị', 'Lượt chuyển đổi', 'Số lượt xem', 'Số lượt click'],
    minSignature: 2,
    columns: {
      date: ['Ngày'],
      name: ['Tên quảng cáo', 'Tên Dịch vụ Hiển thị', 'Tên chiến dịch'],
      campaignId: ['Mã quảng cáo', 'ID quảng cáo'],
      adType: ['Loại quảng cáo', 'Loại Dịch vụ Hiển thị'],
      sku: ['SKU', 'Mã sản phẩm', 'ID sản phẩm'],
      impressions: ['Số lượt xem', 'Lượt hiển thị'],
      clicks: ['Số lượt click', 'Lượt click', 'Lượt nhấp'],
      orders: ['Lượt chuyển đổi', 'Số đơn hàng', 'Đơn hàng'],
      revenue: ['Doanh số', 'Doanh thu', 'GMV'],
      spend: ['Chi phí'],
    },
    required: [['name', 'campaignId'], ['spend']],
  },
  {
    kind: 'ads',
    platform: 'tiktok',
    label: 'TikTok Ads / GMV Max',
    signature: ['Campaign name', 'Cost', 'Gross revenue', 'Total purchase value', 'Tên chiến dịch'],
    minSignature: 2,
    columns: {
      date: ['Date', 'By Day', 'Ngày'],
      name: ['Campaign name', 'Tên chiến dịch'],
      campaignId: ['Campaign ID', 'ID chiến dịch'],
      sku: ['Seller SKU', 'Product ID'],
      impressions: ['Impressions', 'Lượt hiển thị'],
      clicks: ['Clicks', 'Lượt nhấp'],
      orders: ['Orders', 'SKU orders', 'Conversions', 'Đơn hàng'],
      revenue: ['Gross revenue', 'Total purchase value', 'Doanh thu gộp'],
      spend: ['Cost', 'Total cost', 'Chi phí'],
    },
    required: [['name', 'campaignId'], ['spend']],
  },
  {
    kind: 'ads',
    platform: 'lazada',
    label: 'Lazada Sponsored',
    signature: ['Campaign Name', 'Spend', 'Store Revenue'],
    minSignature: 2,
    columns: {
      date: ['Date'],
      name: ['Campaign Name'],
      campaignId: ['Campaign ID'],
      sku: ['Seller SKU', 'SKU'],
      impressions: ['Impressions'],
      clicks: ['Clicks'],
      orders: ['Orders', 'Units Sold'],
      revenue: ['Store Revenue', 'Revenue'],
      spend: ['Spend'],
    },
    required: [['name', 'campaignId'], ['spend']],
  },
  {
    kind: 'ads',
    platform: 'generic',
    label: 'Mẫu EcomPulse · Ads',
    signature: ['ad_spend', 'spend', 'campaign'],
    minSignature: 2,
    columns: {
      date: ['date', 'Ngày'],
      platform: ['platform', 'Sàn'],
      name: ['campaign', 'campaign_name', 'Chiến dịch'],
      sku: ['sku'],
      impressions: ['impressions'],
      clicks: ['clicks'],
      orders: ['orders'],
      revenue: ['revenue', 'attributed_revenue'],
      spend: ['spend', 'ad_spend'],
    },
    required: [['name'], ['spend']],
  },
  // ---------------- LIVE
  {
    kind: 'live',
    platform: 'shopee',
    label: 'Shopee Live',
    signature: ['Tiêu đề', 'Thời gian bắt đầu', 'Người xem', 'Thời lượng'],
    minSignature: 3,
    columns: {
      id: ['ID phiên', 'Mã phiên', 'Session ID'],
      title: ['Tiêu đề', 'Tên phiên live'],
      start: ['Thời gian bắt đầu'],
      duration: ['Thời lượng'],
      viewers: ['Người xem', 'Số người xem'],
      views: ['Lượt xem'],
      avgWatch: ['Thời gian xem trung bình'],
      clicks: ['Lượt nhấp sản phẩm', 'Lượt click sản phẩm'],
      atc: ['Thêm vào giỏ hàng'],
      orders: ['Đơn hàng', 'Số đơn hàng'],
      paid: ['Đơn đã thanh toán'],
      gmv: ['Doanh số', 'Doanh thu'],
    },
    required: [['start'], ['viewers', 'orders', 'gmv']],
  },
  {
    kind: 'live',
    platform: 'tiktok',
    label: 'TikTok LIVE',
    signature: ['LIVE name', 'LIVE title', 'Start time', 'Launched time', 'Viewers'],
    minSignature: 2,
    columns: {
      id: ['LIVE ID', 'Room ID'],
      title: ['LIVE name', 'LIVE title'],
      start: ['Start time', 'Launched time'],
      duration: ['Duration'],
      viewers: ['Viewers', 'Unique viewers'],
      views: ['Views', 'Total views'],
      avgWatch: ['Avg. viewing duration', 'Average viewing duration'],
      clicks: ['Product clicks'],
      atc: ['Add to cart'],
      orders: ['Orders', 'SKU orders', 'Created orders'],
      paid: ['Paid orders'],
      gmv: ['GMV', 'Gross revenue'],
    },
    required: [['start'], ['viewers', 'orders', 'gmv']],
  },
  {
    kind: 'live',
    platform: 'generic',
    label: 'Mẫu EcomPulse · Live',
    signature: ['session_id', 'start_time', 'viewers', 'duration_minutes'],
    minSignature: 2,
    columns: {
      id: ['session_id'],
      platform: ['platform'],
      title: ['title'],
      start: ['start_time', 'date'],
      duration: ['duration_minutes'],
      viewers: ['viewers'],
      views: ['views'],
      clicks: ['product_clicks'],
      atc: ['add_to_cart'],
      orders: ['orders'],
      paid: ['paid_orders'],
      cancelled: ['cancelled_orders'],
      gmv: ['gmv'],
    },
    required: [['start'], ['viewers', 'orders', 'gmv']],
  },
  // ---------------- TRAFFIC
  {
    kind: 'traffic',
    platform: 'shopee',
    label: 'Shopee · Hiệu quả sản phẩm',
    signature: ['Lượt xem trang sản phẩm', 'Lượt truy cập sản phẩm', 'Lượt hiển thị sản phẩm', 'Thêm vào giỏ hàng'],
    minSignature: 2,
    columns: {
      date: ['Ngày'],
      sku: ['SKU', 'SKU sản phẩm', 'Mã sản phẩm'],
      impressions: ['Lượt hiển thị sản phẩm'],
      views: ['Lượt xem trang sản phẩm'],
      visits: ['Lượt truy cập sản phẩm'],
      clicks: ['Lượt nhấp vào sản phẩm', 'Lượt click'],
      atc: ['Thêm vào giỏ hàng', 'Số sản phẩm thêm vào giỏ hàng'],
    },
    required: [['sku'], ['views', 'clicks', 'impressions']],
  },
  {
    kind: 'traffic',
    platform: 'tiktok',
    label: 'TikTok Shop · Product analytics',
    signature: ['Product impressions', 'Product page views', 'Product clicks'],
    minSignature: 2,
    columns: {
      date: ['Date'],
      sku: ['Seller SKU', 'SKU ID', 'Product ID'],
      impressions: ['Product impressions', 'Impressions'],
      views: ['Product page views', 'Page views'],
      clicks: ['Product clicks', 'Clicks'],
      atc: ['Add-to-cart', 'Add to cart'],
    },
    required: [['sku'], ['views', 'clicks', 'impressions']],
  },
  {
    kind: 'traffic',
    platform: 'generic',
    label: 'Mẫu EcomPulse · Traffic',
    signature: ['product_views', 'product_clicks', 'add_to_cart', 'impressions'],
    minSignature: 2,
    columns: {
      date: ['date'],
      platform: ['platform'],
      sku: ['sku'],
      impressions: ['impressions'],
      views: ['product_views'],
      clicks: ['product_clicks'],
      atc: ['add_to_cart'],
      visits: ['visits'],
    },
    required: [['sku'], ['views', 'clicks', 'impressions']],
  },
  // ---------------- AFFILIATE / VIDEO
  {
    kind: 'affiliate',
    platform: 'shopee',
    label: 'Shopee Affiliate',
    signature: ['Tên người dùng nhà sáng tạo', 'Tên nhà sáng tạo', 'Affiliate Username', 'Hoa hồng ước tính', 'Hoa hồng'],
    minSignature: 2,
    columns: {
      date: ['Ngày'],
      creator: ['Tên người dùng nhà sáng tạo', 'Affiliate Username', 'Tên nhà sáng tạo'],
      contentId: ['ID Video', 'Video ID', 'Mã nội dung'],
      title: ['Tiêu đề video', 'Tên video'],
      views: ['Lượt xem'],
      clicks: ['Lượt nhấp', 'Lượt click'],
      orders: ['Đơn hàng', 'Số đơn hàng'],
      gmv: ['Doanh số', 'Doanh thu'],
      commission: ['Hoa hồng ước tính', 'Hoa hồng', 'Chi phí hoa hồng'],
    },
    required: [['creator'], ['gmv', 'orders', 'commission']],
  },
  {
    kind: 'affiliate',
    platform: 'tiktok',
    label: 'TikTok Shop · Creators / Videos',
    signature: ['Creator username', 'Creator name', 'Video ID', 'Est. commission', 'Affiliate GMV'],
    minSignature: 2,
    columns: {
      date: ['Date'],
      creator: ['Creator username', 'Creator name', 'Creator'],
      contentId: ['Video ID', 'Content ID'],
      title: ['Video title', 'Content title'],
      contentType: ['Content type'],
      views: ['Video views', 'Views'],
      clicks: ['Product clicks'],
      orders: ['Orders', 'SKU orders'],
      gmv: ['Affiliate GMV', 'GMV'],
      commission: ['Est. commission', 'Estimated commission', 'Commission'],
    },
    required: [['creator'], ['gmv', 'orders', 'commission']],
  },
  {
    kind: 'affiliate',
    platform: 'generic',
    label: 'Mẫu EcomPulse · Affiliate',
    signature: ['creator_id', 'commission', 'content_type', 'content_id'],
    minSignature: 2,
    columns: {
      date: ['date'],
      platform: ['platform'],
      creator: ['creator_id'],
      contentType: ['content_type'],
      contentId: ['content_id'],
      title: ['content_title'],
      views: ['views'],
      clicks: ['clicks'],
      orders: ['orders'],
      gmv: ['gmv'],
      commission: ['commission'],
    },
    required: [['creator'], ['gmv', 'orders', 'commission']],
  },
  // ---------------- CATALOG (SKU + category / niche / COGS)
  {
    kind: 'catalog',
    platform: 'generic',
    label: 'Danh mục sản phẩm',
    signature: ['SKU', 'Mã SKU', 'Seller SKU', 'SKU phân loại hàng', 'sku'],
    minSignature: 1,
    columns: {
      sku: ['SKU', 'Mã SKU', 'Seller SKU', 'SKU phân loại hàng', 'sku'],
      name: ['Tên sản phẩm', 'Product name', 'Tên', 'product_name'],
      category: ['Ngành hàng', 'Danh mục', 'Category', 'category'],
      subcategory: ['Nhóm hàng', 'Danh mục con', 'Niche', 'Subcategory', 'subcategory'],
      cogs: ['Giá vốn', 'Giá vốn đơn vị', 'COGS', 'Unit COGS', 'unit_cogs', 'Cost', 'Unit cost'],
      price: ['Giá bán', 'Giá niêm yết', 'list_price'],
    },
    required: [['sku'], ['category', 'subcategory', 'cogs']],
  },
];

/** First-cell labels of total rows (exact match — "Tông đơ…" is a product, not a total). */
const TOTAL_LABELS = new Set(['tong', 'tongcong', 'tongket', 'total', 'grandtotal', 'sum']);

export interface DetectedTable {
  spec: TableSpec;
  sheet: SheetInput;
  headerRow: number;
  columns: Record<string, number>;
}

function resolve(headers: unknown[], spec: TableSpec): Record<string, number> {
  const norm = headers.map(normalizeHeader);
  const out: Record<string, number> = {};
  for (const [field, candidates] of Object.entries(spec.columns)) {
    for (const c of candidates) {
      const i = norm.indexOf(normalizeHeader(c));
      if (i >= 0) {
        out[field] = i;
        break;
      }
    }
  }
  return out;
}

export function detectTableReport(input: WorkbookInput): DetectedTable | null {
  let best: (DetectedTable & { score: number }) | null = null;
  for (const sheet of input.sheets) {
    for (let r = 0; r < Math.min(15, sheet.rows.length); r++) {
      const headers = sheet.rows[r] || [];
      const norm = new Set(headers.map(normalizeHeader));
      if (norm.size < 2) continue;
      for (const spec of SPECS) {
        const sig = spec.signature.filter((s) => norm.has(normalizeHeader(s))).length;
        if (sig < (spec.minSignature ?? 1)) continue;
        const columns = resolve(headers, spec);
        if (!spec.required.every((alts) => alts.some((f) => columns[f] !== undefined))) continue;
        // Catalog is the fallback: it only wins when nothing more specific matches.
        const score = Object.keys(columns).length + sig + (spec.platform === 'generic' ? 0 : 2) - (spec.kind === 'catalog' ? 5 : 0);
        if (!best || score > best.score) best = { spec, sheet, headerRow: r, columns, score };
      }
    }
  }
  if (!best) return null;
  const { score: _s, ...rest } = best;
  return rest;
}

/** Report period from title rows ("Khoảng thời gian: 01/09/2025 - 30/09/2025") or the file name ("20250901_20250930"). */
export function detectPeriod(input: WorkbookInput, sheet: SheetInput, headerRow: number): DateRange | null {
  const texts = sheet.rows.slice(0, headerRow).flat().map((v) => String(v ?? ''));
  for (const t of texts) {
    const m = t.match(/(\d{1,2}[/.-]\d{1,2}[/.-]\d{4}|\d{4}-\d{2}-\d{2})\s*(?:-|–|~|đến|to)\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4}|\d{4}-\d{2}-\d{2})/);
    if (m) {
      const a = toIsoDate(m[1]);
      const b = toIsoDate(m[2]);
      if (a && b) return a <= b ? { start: a, end: b } : { start: b, end: a };
    }
  }
  const f = input.fileName.match(/(20\d{6})\D+(20\d{6})/);
  if (f) {
    const iso = (s: string) => toIsoDate(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`);
    const a = iso(f[1]);
    const b = iso(f[2]);
    if (a && b) return a <= b ? { start: a, end: b } : { start: b, end: a };
  }
  return null;
}

/** "01:30:00" / "1:30" → 90 · "90" → 90 (minutes) · with a seconds header → seconds / 60. */
export function parseDurationMinutes(value: unknown, header = ''): number | undefined {
  const s = String(value ?? '').trim();
  if (!s) return undefined;
  const hms = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (hms) return Number(hms[1]) * 60 + Number(hms[2]) + (hms[3] ? Number(hms[3]) / 60 : 0);
  const hm = /^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m(?:in)?)?$/i.exec(s);
  if (hm && (hm[1] || hm[2])) return Number(hm[1] || 0) * 60 + Number(hm[2] || 0);
  const n = toNumber(s);
  if (n === undefined) return undefined;
  return /\(s\)|giây|giay|sec/i.test(header) ? n / 60 : n;
}

function platformOf(value: string, fallback: Platform): Platform {
  const s = normalizeHeader(value);
  if (s.includes('tiktok')) return 'tiktok';
  if (s.includes('lazada')) return 'lazada';
  if (s.includes('shopee')) return 'shopee';
  return fallback;
}

function fileNamePlatform(fileName: string): Platform {
  return platformOf(fileName, 'other');
}

export interface ReportImportResult {
  kind: ReportKind;
  platform: Platform;
  label: string;
  sheetName: string;
  /** Records to merge into the workspace (ads / live / traffic / affiliates / products). */
  dataset: CanonicalDataset;
  /** Catalog files: values that go into the catalog. */
  catalog?: { withCategory: number; withCogs: number };
  period: DateRange | null;
  /** True when rows are period totals (no date column). */
  periodTotals: boolean;
  stats: { dataRows: number; imported: number; skipped: number };
  warnings: Bilingual[];
  columnsUsed: Record<string, string>;
}

export function importTableReport(input: WorkbookInput, detected: DetectedTable): ReportImportResult {
  const { spec, sheet, headerRow, columns: c } = detected;
  const headers = sheet.rows[headerRow] || [];
  const rows = sheet.rows.slice(headerRow + 1);
  const basePlatform: Platform = spec.platform === 'generic' ? fileNamePlatform(input.fileName) : spec.platform;
  const period = detectPeriod(input, sheet, headerRow);
  const hasDate = c.date !== undefined || c.start !== undefined;
  const periodTotals = !hasDate && spec.kind !== 'catalog';
  const warnings: Bilingual[] = [];
  const ds = emptyDataset(`import-${spec.kind}-${Date.now()}`, input.fileName);
  const cell = (row: unknown[], f: string) => (c[f] === undefined ? undefined : row[c[f]]);
  const text = (row: unknown[], f: string) => {
    const v = cell(row, f);
    return v === undefined || v === null ? '' : String(v).trim();
  };
  const num = (row: unknown[], f: string) => toNumber(cell(row, f));
  let imported = 0;
  let skipped = 0;
  const catalog = { withCategory: 0, withCogs: 0 };

  if (periodTotals && !period) {
    warnings.push({
      vi: 'Báo cáo không có cột ngày và không xác định được khoảng thời gian (dòng tiêu đề hoặc tên file) — không thể đặt số liệu vào đúng kỳ nên đã bỏ qua.',
      en: 'No date column and no report period found — rows cannot be placed in time and were skipped.',
    });
    return { kind: spec.kind, platform: basePlatform, label: spec.label, sheetName: sheet.name, dataset: ds, period, periodTotals, stats: { dataRows: rows.length, imported: 0, skipped: rows.length }, warnings, columnsUsed: {} };
  }
  if (periodTotals && period) {
    warnings.push({
      vi: `Báo cáo là số tổng cho cả kỳ ${period.start} → ${period.end} (không theo ngày) — chỉ được tính khi bạn xem trọn kỳ đó hoặc kỳ dài hơn.`,
      en: `Rows are totals for ${period.start} → ${period.end} — counted only when the whole period is selected.`,
    });
  }

  const dateOf = (row: unknown[]): { date?: string; periodStart?: string } => {
    if (hasDate) return { date: toIsoDate(cell(row, c.date !== undefined ? 'date' : 'start')) };
    return period ? { date: period.end, periodStart: period.start } : {};
  };

  rows.forEach((row, i) => {
    if (!row || row.every((v) => String(v ?? '').trim() === '')) return;
    // skip repeated header / total rows
    const first = normalizeHeader(row[0]);
    if (first === normalizeHeader(headers[0]) || TOTAL_LABELS.has(first)) return;
    const platform = c.platform !== undefined ? platformOf(text(row, 'platform'), basePlatform) : basePlatform;
    const when = dateOf(row);

    if (spec.kind === 'catalog') {
      const sku = text(row, 'sku');
      if (!sku) return;
      const cogs = num(row, 'cogs');
      const p: Product = {
        sku,
        name: text(row, 'name') || undefined,
        category: text(row, 'category') || undefined,
        subcategory: text(row, 'subcategory') || undefined,
        unitCogs: cogs !== undefined && cogs >= 0 ? cogs : undefined,
        listPrice: num(row, 'price'),
      };
      if (p.category) catalog.withCategory++;
      if (p.unitCogs !== undefined) catalog.withCogs++;
      if (cogs !== undefined && cogs < 0) skipped++;
      ds.products.push(p);
      imported++;
      return;
    }

    if (!when.date) {
      if (i > 0 || hasDate) skipped++;
      return;
    }

    if (spec.kind === 'ads') {
      const spend = num(row, 'spend');
      const name = text(row, 'name') || text(row, 'campaignId');
      if (spend === undefined || !name) {
        skipped++;
        return;
      }
      const ad: AdPerformance = {
        date: when.date,
        periodStart: when.periodStart,
        platform,
        campaignId: text(row, 'campaignId') || `${platform}:${name}`,
        adName: name,
        adType: text(row, 'adType') || undefined,
        sku: text(row, 'sku') || undefined,
        spend,
        impressions: num(row, 'impressions'),
        clicks: num(row, 'clicks'),
        orders: num(row, 'orders'),
        attributedRevenue: num(row, 'revenue'),
      };
      ds.ads.push(ad);
    } else if (spec.kind === 'live') {
      const rawStart = String(cell(row, 'start') ?? '');
      const startTime = /(\d{1,2}):(\d{2})/.exec(rawStart.slice(10))?.slice(1, 3).map((x) => x.padStart(2, '0')).join(':');
      const title = text(row, 'title') || undefined;
      const s: LiveSession = {
        sessionId: text(row, 'id') || `${platform}-${when.date}-${startTime ?? i}`,
        platform,
        date: when.date,
        startTime,
        title,
        durationMinutes: parseDurationMinutes(cell(row, 'duration'), String(headers[c.duration] ?? '')),
        viewers: num(row, 'viewers'),
        views: num(row, 'views'),
        avgWatchSeconds: (() => {
          const m = parseDurationMinutes(cell(row, 'avgWatch'), String(headers[c.avgWatch] ?? ''));
          return m === undefined ? undefined : Math.round(m * 60);
        })(),
        productClicks: num(row, 'clicks'),
        addToCart: num(row, 'atc'),
        orders: num(row, 'orders'),
        paidOrders: num(row, 'paid'),
        cancelledOrders: num(row, 'cancelled'),
        gmv: num(row, 'gmv'),
      };
      ds.liveSessions.push(s);
    } else if (spec.kind === 'traffic') {
      const sku = text(row, 'sku');
      if (!sku) {
        skipped++;
        return;
      }
      const t: TrafficDaily = {
        date: when.date,
        periodStart: when.periodStart,
        platform,
        sku,
        impressions: num(row, 'impressions'),
        productViews: num(row, 'views'),
        productClicks: num(row, 'clicks'),
        addToCart: num(row, 'atc'),
        visits: num(row, 'visits'),
      };
      ds.traffic.push(t);
    } else if (spec.kind === 'affiliate') {
      const creator = text(row, 'creator');
      if (!creator) {
        skipped++;
        return;
      }
      const rawType = normalizeHeader(text(row, 'contentType'));
      const a: AffiliatePerformance = {
        date: when.date,
        periodStart: when.periodStart,
        platform,
        // Creators are business partners the shop manages by handle, so the handle is kept.
        creatorId: creator,
        contentType: rawType.includes('live') ? 'creator' : rawType.includes('shop') ? 'shop_video' : rawType.includes('organic') ? 'organic_video' : 'affiliate',
        contentId: text(row, 'contentId') || undefined,
        contentTitle: text(row, 'title') || undefined,
        views: num(row, 'views'),
        clicks: num(row, 'clicks'),
        orders: num(row, 'orders'),
        gmv: num(row, 'gmv'),
        commission: num(row, 'commission'),
      };
      ds.affiliates.push(a);
    }
    imported++;
  });

  if (spec.kind === 'live' && ds.liveSessions.some((s) => s.durationMinutes === undefined)) {
    warnings.push({ vi: 'Một số phiên live không có thời lượng — không tính được GMV/giờ cho các phiên đó.', en: 'Some sessions have no duration — GMV/hour unavailable for them.' });
  }
  if (spec.kind === 'ads' && ds.ads.every((a) => a.attributedRevenue === undefined)) {
    warnings.push({ vi: 'Báo cáo Ads không có doanh thu quy đổi — không tính được ROAS.', en: 'No attributed revenue — ROAS unavailable.' });
  }
  if (skipped > 0) warnings.push({ vi: `${skipped} dòng thiếu thông tin bắt buộc — đã bỏ qua.`, en: `${skipped} rows lacked required fields — skipped.` });

  const columnsUsed: Record<string, string> = {};
  for (const [f, idx] of Object.entries(c)) columnsUsed[f] = String(headers[idx] ?? '');
  ds.sources = [{ fileName: input.fileName, platform: basePlatform, reportType: spec.kind, importedAt: new Date().toISOString(), rowCount: rows.length }];

  return {
    kind: spec.kind,
    platform: basePlatform,
    label: spec.label,
    sheetName: sheet.name,
    dataset: ds,
    catalog: spec.kind === 'catalog' ? catalog : undefined,
    period,
    periodTotals,
    stats: { dataRows: rows.length, imported, skipped },
    warnings,
    columnsUsed,
  };
}


/**
 * Adapter: legacy ParsedStoreData → CanonicalDataset.
 *
 * Lets every existing import path (Shopee 21-sheet reports, the universal
 * standardizer, sample datasets) feed the shared analytics engine without changing
 * the parsers. Only facts present in the source are carried over; legacy fields the
 * parser estimated are listed in `estimatedFields` and ignored.
 */
import type { ParsedStoreData, RawSheetTable } from '../../types';
import { emptyDataset, type CanonicalDataset, type DailyMetric, type Order, type OrderLine, type Platform } from '../model';
import { normalizeOrderStatus } from '../status';
import { findHeader, normalizeHeader, toIsoDate, toNumber } from '../parse';

export function platformFromString(value: string | null | undefined): Platform {
  const s = normalizeHeader(value);
  if (s.includes('tiktok')) return 'tiktok';
  if (s.includes('lazada')) return 'lazada';
  if (s.includes('shopee')) return 'shopee';
  if (s.includes('internal') || s.includes('noibo')) return 'internal';
  return 'other';
}

type OverviewKind = 'placed' | 'confirmed' | 'paid';

function overviewKind(sheet: RawSheetTable): OverviewKind | null {
  if (!sheet.groupName?.includes('Executive Overview')) return null;
  const n = normalizeHeader(sheet.sheetName);
  if (n.includes('dadat') || n.includes('placed')) return 'placed';
  if (n.includes('xacnhan') || n.includes('confirm')) return 'confirmed';
  if (n.includes('thanhtoan') || n.includes('paid')) return 'paid';
  return null;
}

/** Period-total rows: "24-07-2026-22-08-2026", "01/08/2025 - 31/08/2025", "Tổng". */
function isSummaryRow(dateValue: unknown): boolean {
  const s = String(dateValue ?? '').toLowerCase();
  const dateLike = s.match(/\d{1,4}[-/.]\d{1,2}[-/.]\d{2,4}/g) || [];
  return dateLike.length >= 2 || s.includes(' - ') || s.includes('tổng') || s.includes('total') || s.includes('toàn bộ');
}

/** Reads Shopee "Tổng quan" daily sheets (one row per day) into DailyMetric rows. */
function dailyFromOverviewSheets(rawSheets: Record<string, RawSheetTable>, platform: Platform): DailyMetric[] {
  const byDate = new Map<string, DailyMetric>();
  const get = (date: string) => {
    let row = byDate.get(date);
    if (!row) {
      row = { date, platform };
      byDate.set(date, row);
    }
    return row;
  };

  // Placed sheet first so its cancel/refund/traffic columns win over the other two.
  const order: OverviewKind[] = ['placed', 'paid', 'confirmed'];
  const sheets = Object.values(rawSheets)
    .map((s) => ({ sheet: s, kind: overviewKind(s) }))
    .filter((x): x is { sheet: RawSheetTable; kind: OverviewKind } => x.kind !== null)
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));

  for (const { sheet, kind } of sheets) {
    const h = sheet.headers;
    const col = {
      date: findHeader(h, ['Ngày', 'Date']),
      gmv: findHeader(h, ['Tổng doanh số (VND)', 'Tổng doanh số', 'Doanh số (VND)'], ['khong bao gom', 'huy', 'tra hang', 'moi don']),
      orders: findHeader(h, ['Tổng số đơn hàng', 'Số đơn hàng']),
      visits: findHeader(h, ['Số lượt truy cập', 'Lượt truy cập']),
      clicks: findHeader(h, ['Lượt nhấp vào sản phẩm']),
      cancelled: findHeader(h, ['Đơn đã hủy', 'Đơn hủy']),
      cancelledGmv: findHeader(h, ['Doanh số đơn hủy']),
      refunded: findHeader(h, ['Đơn đã hoàn trả / hoàn tiền', 'Đơn hoàn trả']),
      refundedGmv: findHeader(h, ['Doanh số các đơn Trả hàng/Hoàn tiền', 'Doanh số đơn hoàn']),
      buyers: findHeader(h, ['số người mua'], ['moi', 'hientai', 'tiemnang']),
      newBuyers: findHeader(h, ['số người mua mới']),
    };
    if (!col.date) continue;

    for (const r of sheet.rows) {
      const rawDate = r[col.date];
      if (isSummaryRow(rawDate)) continue;
      const date = toIsoDate(rawDate);
      if (!date) continue;
      const row = get(date);
      const num = (c?: string) => (c ? toNumber(r[c]) : undefined);
      if (kind === 'placed') {
        row.placedGmv = num(col.gmv);
        row.placedOrders = num(col.orders);
      } else if (kind === 'paid') {
        row.paidGmv = num(col.gmv);
        row.paidOrders = num(col.orders);
      }
      row.visits ??= num(col.visits);
      row.productClicks ??= num(col.clicks);
      row.cancelledOrders ??= num(col.cancelled);
      row.cancelledGmv ??= num(col.cancelledGmv);
      row.refundedOrders ??= num(col.refunded);
      row.refundedGmv ??= num(col.refundedGmv);
      row.buyers ??= num(col.buyers);
      row.newBuyers ??= num(col.newBuyers);
    }
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function dailyFromTimeline(data: ParsedStoreData, platform: Platform): DailyMetric[] {
  const out: DailyMetric[] = [];
  for (const d of data.dailyTimeline || []) {
    const date = toIsoDate(d.date);
    if (!date) continue;
    out.push({ date, platform, paidGmv: d.revenue, paidOrders: d.orders, placedGmv: d.placedRevenue });
  }
  return out;
}

function ordersFromLegacy(data: ParsedStoreData, platform: Platform): { orders: Order[]; lines: OrderLine[] } {
  const orders = new Map<string, Order>();
  const lines: OrderLine[] = [];
  for (const row of data.orders || []) {
    const date = toIsoDate(row.orderDate);
    if (!row.orderId || !date) continue;
    if (!orders.has(row.orderId)) {
      orders.set(row.orderId, {
        orderId: row.orderId,
        platform: platformFromString(row.channel) !== 'other' ? platformFromString(row.channel) : platform,
        orderDate: date,
        status: normalizeOrderStatus(row.orderStatus),
        rawStatus: row.orderStatus,
        customerId: row.buyerId || undefined,
        channel: row.channel || undefined,
      });
    }
    lines.push({
      orderId: row.orderId,
      sku: row.sku || row.productName || 'UNKNOWN',
      productName: row.productName,
      quantity: row.quantity || 0,
      grossAmount: row.originalPrice || row.paidAmount || 0,
      sellerDiscount: row.voucherSeller || undefined,
      platformDiscount: row.shopeeSubsidy || undefined,
    });
  }
  return { orders: Array.from(orders.values()), lines };
}

export function canonicalFromParsedStoreData(data: ParsedStoreData, platformHint?: string | null): CanonicalDataset {
  const platform = platformHint ? platformFromString(platformHint) : 'shopee';
  const ds = emptyDataset(data.datasetId, data.periodLabel || data.fileName);
  ds.sources.push({
    fileName: data.fileName,
    platform,
    reportType: data.orders?.length ? 'legacy_orders' : 'shopee_summary',
    importedAt: new Date().toISOString(),
  });

  const { orders, lines } = ordersFromLegacy(data, platform);
  ds.orders = orders;
  ds.orderLines = lines;

  if (orders.length === 0) {
    const fromSheets = data.rawSheets ? dailyFromOverviewSheets(data.rawSheets, platform) : [];
    ds.dailyMetrics = fromSheets.length > 0 ? fromSheets : dailyFromTimeline(data, platform);
  }

  const seen = new Set<string>();
  for (const p of data.abcProducts || []) {
    if (!p.sku || seen.has(p.sku)) continue;
    seen.add(p.sku);
    ds.products.push({ sku: p.sku, name: p.name, platform });
  }
  for (const l of lines) {
    if (seen.has(l.sku)) continue;
    seen.add(l.sku);
    ds.products.push({ sku: l.sku, name: l.productName, platform });
  }

  ds.estimatedFields = data.estimatedFields ? [...data.estimatedFields] : [];
  const notes: CanonicalDataset['importNotes'] = [];
  if (data.liveSessions?.length) {
    notes.push({
      vi: `${data.liveSessions.length} phiên live trong báo cáo không có ngày diễn ra nên chưa dùng cho phân tích theo thời gian.`,
      en: `${data.liveSessions.length} live sessions have no date and are not used in time-based analysis.`,
    });
  }
  if (data.ads?.length) {
    notes.push({
      vi: 'Dữ liệu quảng cáo trong báo cáo không có ngày/chi tiết chiến dịch nên chưa được dùng. Hãy nhập báo cáo Ads riêng.',
      en: 'Ads data in this report has no dates/campaign detail and is not used. Import a dedicated ads report.',
    });
  }
  ds.importNotes = notes;
  return ds;
}

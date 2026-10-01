/**
 * Data Quality — what the imported data can and cannot support, and what looks wrong.
 *
 * Capabilities drive graceful degradation: a module whose capability is unavailable
 * shows "Không đủ dữ liệu" plus the reason, instead of rendering zeros.
 */
import type { CanonicalDataset, Platform } from './model';
import { datasetDateBounds } from './filters';
import { datasetGrain, type DataGrain } from './kpiEngine';
import { rangeLength, isIsoDate, type DateRange } from './period';
import { isCancelled, consumesCogs } from './status';
import { resolveUnitCogs } from './profitEngine';
import type { Bilingual } from './metric';

export type CapabilityKey =
  | 'revenue'
  | 'orderLifecycle'
  | 'skuAnalysis'
  | 'profit'
  | 'conversion'
  | 'customers'
  | 'categories'
  | 'ads'
  | 'live'
  | 'affiliate'
  | 'cancelReasons'
  | 'periodComparison';

export interface Capability {
  key: CapabilityKey;
  label: Bilingual;
  status: 'available' | 'partial' | 'unavailable';
  reason?: Bilingual;
  requires?: string[];
}

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface DataIssue {
  code: string;
  severity: IssueSeverity;
  message: Bilingual;
  count: number;
  samples?: string[];
}

export interface DataQualityReport {
  grain: DataGrain;
  coverage: DateRange | null;
  coverageDays: number;
  platforms: Platform[];
  counts: { orders: number; orderLines: number; skus: number; dailyRows: number };
  capabilities: Capability[];
  issues: DataIssue[];
  /** SKUs with sales but no unit COGS (for the COGS entry screen). */
  skusMissingCogs: string[];
}

const LABELS: Record<CapabilityKey, Bilingual> = {
  revenue: { vi: 'Doanh thu & đơn hàng', en: 'Revenue & orders' },
  orderLifecycle: { vi: 'Vòng đời đơn (hủy/hoàn/hoàn tất)', en: 'Order lifecycle' },
  skuAnalysis: { vi: 'Phân tích theo SKU', en: 'SKU analysis' },
  profit: { vi: 'Lợi nhuận', en: 'Profit' },
  conversion: { vi: 'Tỷ lệ chuyển đổi (CVR)', en: 'Conversion rate' },
  customers: { vi: 'Phân tích khách hàng', en: 'Customer analytics' },
  categories: { vi: 'Ngành hàng', en: 'Categories' },
  ads: { vi: 'Quảng cáo', en: 'Advertising' },
  live: { vi: 'Livestream', en: 'Livestream' },
  affiliate: { vi: 'Affiliate & video', en: 'Affiliate & video' },
  cancelReasons: { vi: 'Lý do hủy/hoàn', en: 'Cancel/return reasons' },
  periodComparison: { vi: 'So sánh kỳ trước', en: 'Period comparison' },
};

function cap(key: CapabilityKey, status: Capability['status'], reason?: Bilingual, requires?: string[]): Capability {
  return { key, label: LABELS[key], status, reason, requires };
}

const ORDER_EXPORT: Bilingual = {
  vi: 'Cần file xuất đơn hàng (order-level). Báo cáo tổng hợp không có thông tin này.',
  en: 'Requires an order-level export. Summary reports do not contain this.',
};

export function assessDataQuality(dataset: CanonicalDataset): DataQualityReport {
  const grain = datasetGrain(dataset);
  const coverage = datasetDateBounds(dataset);
  const coverageDays = coverage ? rangeLength(coverage) : 0;
  const platforms = Array.from(
    new Set<Platform>([...dataset.orders.map((o) => o.platform), ...dataset.dailyMetrics.map((d) => d.platform)]),
  );
  const skus = new Set(dataset.orderLines.map((l) => l.sku));
  const issues: DataIssue[] = [];
  const capabilities: Capability[] = [];
  const hasOrders = grain === 'order';

  // ---------- issues ----------
  const seenOrders = new Map<string, number>();
  for (const o of dataset.orders) seenOrders.set(o.orderId, (seenOrders.get(o.orderId) || 0) + 1);
  const dupOrders = [...seenOrders].filter(([, n]) => n > 1).map(([id]) => id);
  if (dupOrders.length > 0) {
    issues.push({
      code: 'duplicate_orders',
      severity: 'error',
      message: { vi: `${dupOrders.length} mã đơn bị lặp — số đơn và doanh thu có thể bị tính trùng.`, en: `${dupOrders.length} order IDs are duplicated — totals may be double counted.` },
      count: dupOrders.length,
      samples: dupOrders.slice(0, 5),
    });
  }

  const lineKeys = new Map<string, number>();
  for (const l of dataset.orderLines) {
    const k = `${l.orderId}|${l.sku}|${l.quantity}|${l.grossAmount}`;
    lineKeys.set(k, (lineKeys.get(k) || 0) + 1);
  }
  const dupLines = [...lineKeys].filter(([, n]) => n > 1);
  if (dupLines.length > 0) {
    issues.push({
      code: 'duplicate_lines',
      severity: 'warning',
      message: { vi: `${dupLines.length} dòng sản phẩm giống hệt nhau trong cùng đơn — kiểm tra file có bị nhập 2 lần không.`, en: `${dupLines.length} identical line items within the same order — check for a double import.` },
      count: dupLines.length,
      samples: dupLines.slice(0, 5).map(([k]) => k.split('|')[0]),
    });
  }

  const orderIds = new Set(dataset.orders.map((o) => o.orderId));
  const orphanLines = dataset.orderLines.filter((l) => !orderIds.has(l.orderId));
  if (orphanLines.length > 0) {
    issues.push({
      code: 'orphan_lines',
      severity: 'warning',
      message: { vi: `${orphanLines.length} dòng sản phẩm không có đơn hàng tương ứng — bị loại khỏi phân tích.`, en: `${orphanLines.length} line items have no matching order — excluded.` },
      count: orphanLines.length,
      samples: orphanLines.slice(0, 5).map((l) => l.orderId),
    });
  }
  const orderIdsWithLines = new Set(dataset.orderLines.map((l) => l.orderId));
  const emptyOrders = dataset.orders.filter((o) => !orderIdsWithLines.has(o.orderId));
  if (emptyOrders.length > 0) {
    issues.push({
      code: 'orders_without_lines',
      severity: 'warning',
      message: { vi: `${emptyOrders.length} đơn không có dòng sản phẩm — không có doanh thu.`, en: `${emptyOrders.length} orders have no line items — no revenue.` },
      count: emptyOrders.length,
      samples: emptyOrders.slice(0, 5).map((o) => o.orderId),
    });
  }

  const badQty = dataset.orderLines.filter((l) => !(l.quantity > 0) || l.grossAmount < 0);
  if (badQty.length > 0) {
    issues.push({
      code: 'invalid_line_values',
      severity: 'warning',
      message: { vi: `${badQty.length} dòng có số lượng ≤ 0 hoặc giá trị âm.`, en: `${badQty.length} lines have quantity ≤ 0 or negative amounts.` },
      count: badQty.length,
      samples: badQty.slice(0, 5).map((l) => l.orderId),
    });
  }

  const badDates = dataset.orders.filter((o) => !isIsoDate(o.orderDate));
  if (badDates.length > 0) {
    issues.push({
      code: 'invalid_dates',
      severity: 'error',
      message: { vi: `${badDates.length} đơn có ngày không hợp lệ — bị loại khỏi phân tích theo thời gian.`, en: `${badDates.length} orders have invalid dates — excluded from time analysis.` },
      count: badDates.length,
      samples: badDates.slice(0, 5).map((o) => `${o.orderId}: ${o.orderDate}`),
    });
  }

  const unknownStatus = dataset.orders.filter((o) => o.status === 'unknown');
  if (unknownStatus.length > 0) {
    const raws = Array.from(new Set(unknownStatus.map((o) => o.rawStatus || '(trống)'))).slice(0, 5);
    issues.push({
      code: 'unknown_status',
      severity: 'warning',
      message: { vi: `${unknownStatus.length} đơn có trạng thái chưa nhận diện được — được tính là đơn hợp lệ nhưng không vào hoàn tất/hủy.`, en: `${unknownStatus.length} orders have an unrecognized status — counted as valid, not as completed/cancelled.` },
      count: unknownStatus.length,
      samples: raws,
    });
  }

  // Refund larger than what the order was worth.
  const linesByOrder = new Map<string, number>();
  for (const l of dataset.orderLines) linesByOrder.set(l.orderId, (linesByOrder.get(l.orderId) || 0) + (l.grossAmount || 0));
  const lineRefunds = new Map<string, number>();
  for (const l of dataset.orderLines) if (l.refundAmount) lineRefunds.set(l.orderId, (lineRefunds.get(l.orderId) || 0) + l.refundAmount);
  const overRefund = dataset.orders.filter((o) => {
    const refund = (o.refundAmount || 0) + (lineRefunds.get(o.orderId) || 0);
    return refund > (linesByOrder.get(o.orderId) || 0) + 0.5;
  });
  if (overRefund.length > 0) {
    issues.push({
      code: 'refund_exceeds_order',
      severity: 'warning',
      message: { vi: `${overRefund.length} đơn có số tiền hoàn lớn hơn giá trị đơn — doanh thu thuần có thể âm.`, en: `${overRefund.length} orders have refunds above order value — net revenue may be negative.` },
      count: overRefund.length,
      samples: overRefund.slice(0, 5).map((o) => o.orderId),
    });
  }

  for (const d of dataset.dailyMetrics) {
    if (d.placedOrders !== undefined && d.cancelledOrders !== undefined && d.cancelledOrders > d.placedOrders) {
      issues.push({
        code: 'daily_cancel_exceeds_placed',
        severity: 'warning',
        message: { vi: `Ngày ${d.date}: số đơn hủy lớn hơn số đơn đặt.`, en: `${d.date}: cancelled orders exceed placed orders.` },
        count: 1,
      });
    }
  }

  if (dataset.estimatedFields && dataset.estimatedFields.length > 0) {
    issues.push({
      code: 'estimated_fields',
      severity: 'info',
      message: {
        vi: `File thiếu một số chỉ số, màn hình cũ đang hiển thị giá trị ước tính: ${dataset.estimatedFields.map((f) => ESTIMATED_FIELD_LABELS[f]?.vi ?? f).join(', ')}. Phân tích mới coi các chỉ số này là "không đủ dữ liệu".`,
        en: `Some metrics are missing from the file; legacy screens show estimates: ${dataset.estimatedFields.map((f) => ESTIMATED_FIELD_LABELS[f]?.en ?? f).join(', ')}. New analytics treat them as missing.`,
      },
      count: dataset.estimatedFields.length,
      samples: dataset.estimatedFields.map((f) => ESTIMATED_FIELD_LABELS[f]?.vi ?? f),
    });
  }
  for (const note of dataset.importNotes || []) {
    issues.push({ code: 'import_note', severity: 'info', message: note, count: 1 });
  }

  // ---------- capabilities ----------
  capabilities.push(grain === 'none' ? cap('revenue', 'unavailable', { vi: 'Chưa có dữ liệu bán hàng.', en: 'No sales data yet.' }) : cap('revenue', 'available'));

  capabilities.push(hasOrders ? cap('orderLifecycle', unknownStatus.length > 0 ? 'partial' : 'available') : cap('orderLifecycle', 'unavailable', ORDER_EXPORT, ['order.status']));
  capabilities.push(hasOrders && skus.size > 0 ? cap('skuAnalysis', 'available') : cap('skuAnalysis', 'unavailable', ORDER_EXPORT, ['orderLines.sku']));

  // COGS coverage for SKUs that actually consumed stock.
  const statusById = new Map(dataset.orders.map((o) => [o.orderId, o.status]));
  const skusMissingCogs = new Set<string>();
  const skusSold = new Set<string>();
  for (const l of dataset.orderLines) {
    const st = statusById.get(l.orderId);
    if (!st || !consumesCogs(st)) continue;
    skusSold.add(l.sku);
    if (resolveUnitCogs(dataset, l) === undefined) skusMissingCogs.add(l.sku);
  }
  if (!hasOrders) {
    capabilities.push(cap('profit', 'unavailable', ORDER_EXPORT, ['orderLines', 'product.unitCogs']));
  } else if (skusSold.size > 0 && skusMissingCogs.size === skusSold.size) {
    capabilities.push(cap('profit', 'unavailable', { vi: `Không đủ dữ liệu: cả ${skusMissingCogs.size} SKU chưa có giá vốn.`, en: `Insufficient data: all ${skusMissingCogs.size} SKUs lack COGS.` }, ['product.unitCogs']));
  } else if (skusMissingCogs.size > 0) {
    capabilities.push(cap('profit', 'partial', { vi: `${skusMissingCogs.size} SKU chưa có giá vốn.`, en: `${skusMissingCogs.size} SKUs lack COGS.` }, ['product.unitCogs']));
  } else {
    capabilities.push(cap('profit', 'available'));
  }

  const hasProductClicks =
    dataset.traffic.some((t) => typeof t.productClicks === 'number' || typeof t.productViews === 'number') ||
    dataset.dailyMetrics.some((d) => typeof d.productClicks === 'number');
  capabilities.push(
    hasProductClicks
      ? cap('conversion', 'available')
      : cap('conversion', 'unavailable', { vi: 'Không tính được CVR vì chưa có lượt xem/nhấp sản phẩm (Product Views).', en: 'CVR unavailable: no product views/clicks.' }, ['traffic.productClicks']),
  );

  const validOrders = dataset.orders.filter((o) => !isCancelled(o.status));
  const withCustomer = validOrders.filter((o) => o.customerId).length;
  if (!hasOrders || withCustomer === 0) {
    capabilities.push(cap('customers', 'unavailable', { vi: 'Không tính được RFM / khách quay lại vì chưa có mã khách hàng.', en: 'RFM / repeat analysis unavailable: no customer identifier.' }, ['order.customerId']));
  } else if (withCustomer < validOrders.length) {
    capabilities.push(cap('customers', 'partial', { vi: `${validOrders.length - withCustomer} đơn không có mã khách hàng.`, en: `${validOrders.length - withCustomer} orders lack a customer ID.` }, ['order.customerId']));
  } else {
    capabilities.push(cap('customers', 'available'));
  }

  const catSkus = dataset.products.filter((p) => p.category && skus.has(p.sku)).length;
  capabilities.push(
    !hasOrders || catSkus === 0
      ? cap('categories', 'unavailable', { vi: 'Chưa có thông tin ngành hàng cho SKU.', en: 'No category information for SKUs.' }, ['product.category'])
      : catSkus < skus.size
        ? cap('categories', 'partial', { vi: `${skus.size - catSkus} SKU chưa có ngành hàng.`, en: `${skus.size - catSkus} SKUs lack a category.` }, ['product.category'])
        : cap('categories', 'available'),
  );

  capabilities.push(dataset.ads.length > 0 ? cap('ads', 'available') : cap('ads', 'unavailable', { vi: 'Chưa nhập báo cáo quảng cáo.', en: 'No ads report imported.' }, ['ads']));
  capabilities.push(dataset.liveSessions.length > 0 ? cap('live', 'available') : cap('live', 'unavailable', { vi: 'Chưa có dữ liệu phiên live có ngày.', en: 'No dated live session data.' }, ['liveSessions']));
  capabilities.push(dataset.affiliates.length > 0 ? cap('affiliate', 'available') : cap('affiliate', 'unavailable', { vi: 'Chưa có dữ liệu affiliate/video.', en: 'No affiliate/video data.' }, ['affiliates']));

  const cancelledOrReturned = dataset.orders.filter((o) => isCancelled(o.status) || o.status === 'returned' || o.status === 'refunded');
  const withReason = cancelledOrReturned.filter((o) => o.cancelReason || o.returnReason).length;
  capabilities.push(
    !hasOrders
      ? cap('cancelReasons', 'unavailable', ORDER_EXPORT, ['order.cancelReason'])
      : cancelledOrReturned.length === 0
        ? cap('cancelReasons', 'available')
        : withReason === 0
          ? cap('cancelReasons', 'unavailable', { vi: 'File không có cột lý do hủy/hoàn.', en: 'The file has no cancel/return reason column.' }, ['order.cancelReason'])
          : withReason < cancelledOrReturned.length
            ? cap('cancelReasons', 'partial', { vi: `${cancelledOrReturned.length - withReason} đơn hủy/hoàn không có lý do.`, en: `${cancelledOrReturned.length - withReason} cancelled/returned orders lack a reason.` })
            : cap('cancelReasons', 'available'),
  );

  capabilities.push(
    coverageDays >= 14
      ? cap('periodComparison', 'available')
      : coverageDays >= 2
        ? cap('periodComparison', 'partial', { vi: `Dữ liệu chỉ có ${coverageDays} ngày — chỉ so sánh được theo ngày/tuần ngắn.`, en: `Only ${coverageDays} days of data — only short comparisons are possible.` })
        : cap('periodComparison', 'unavailable', { vi: 'Cần ít nhất 2 ngày dữ liệu để so sánh.', en: 'At least 2 days of data are needed to compare.' }),
  );

  const severityRank: Record<IssueSeverity, number> = { error: 0, warning: 1, info: 2 };
  issues.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  return {
    grain,
    coverage,
    coverageDays,
    platforms,
    counts: { orders: dataset.orders.length, orderLines: dataset.orderLines.length, skus: skus.size, dailyRows: dataset.dailyMetrics.length },
    capabilities,
    issues,
    skusMissingCogs: Array.from(skusMissingCogs).sort(),
  };
}

/** Readable names for the legacy parser's estimated fields — never show internal keys. */
const ESTIMATED_FIELD_LABELS: Record<string, { vi: string; en: string }> = {
  totalUnits: { vi: 'Tổng số sản phẩm bán ra', en: 'Units sold' },
  productUnits: { vi: 'Số sản phẩm theo từng mặt hàng', en: 'Units per product' },
  confirmedOrders: { vi: 'Đơn đã xác nhận', en: 'Confirmed orders' },
  confirmedRevenue: { vi: 'Doanh số đơn đã xác nhận', en: 'Confirmed-order sales' },
  placedOrders: { vi: 'Đơn đã đặt', en: 'Placed orders' },
  placedRevenue: { vi: 'Doanh số đơn đã đặt', en: 'Placed-order sales' },
  actualRevenue: { vi: 'Doanh thu thực nhận', en: 'Actual revenue' },
  channels: { vi: 'Doanh số theo kênh', en: 'Sales by channel' },
};

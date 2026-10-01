/**
 * Order-export importer: Shopee / TikTok Shop / Lazada / EcomPulse template → canonical.
 *
 * Column names follow each seller centre's public "Export orders" format (Vietnamese
 * and English variants). Matching is by normalized header, so small wording changes
 * still map; unknown layouts fall back to the generic template.
 * NOTE: mappings were written against published formats, not verified shop files —
 * adjust the candidate lists when real exports differ.
 *
 * Privacy: recipient name, phone and address columns are never read. The buyer
 * username/e-mail is replaced by a local pseudonymous hash.
 *
 * Pure function over row arrays — XLSX decoding happens in the import worker.
 */
import { emptyDataset, type CanonicalDataset, type Order, type OrderLine, type Platform, type Product } from '../model';
import { normalizeOrderStatus, isCancelled } from '../status';
import { normalizeHeader, pseudonymize, toIsoDate, toNumber } from '../parse';
import type { Bilingual } from '../metric';

export interface SheetInput {
  name: string;
  /** Row arrays as decoded (numbers stay numbers, text stays text). */
  rows: unknown[][];
}

export interface WorkbookInput {
  fileName: string;
  sheets: SheetInput[];
}

type Field =
  | 'orderId'
  | 'orderDate'
  | 'status'
  | 'returnType'
  | 'returnStatus'
  | 'returnedQty'
  | 'productId'
  | 'cancelReason'
  | 'returnReason'
  | 'sku'
  | 'skuFallback'
  | 'productName'
  | 'variation'
  | 'category'
  | 'quantity'
  | 'lineGross'
  | 'lineNet'
  | 'unitPrice'
  | 'dealPrice'
  | 'lineSellerDiscount'
  | 'linePlatformDiscount'
  | 'orderSellerVoucher'
  | 'orderRefund'
  | 'platformFee'
  | 'serviceFee'
  | 'paymentFee'
  | 'buyer'
  | 'platformName'
  | 'unitCogs'
  | 'lineCogs';

interface PlatformSpec {
  key: Platform | 'generic';
  label: string;
  /** At least one of these normalized headers must be present to consider the spec. */
  signature: string[];
  columns: Partial<Record<Field, string[]>>;
  required: Field[];
  /** Order-level values are repeated on every item row (take them once per order). */
  orderLevelRepeated: boolean;
}

const SPECS: PlatformSpec[] = [
  {
    key: 'shopee',
    label: 'Shopee',
    signature: ['Mã đơn hàng', 'Trạng Thái Đơn Hàng'],
    required: ['orderId', 'orderDate', 'status', 'quantity'],
    orderLevelRepeated: true,
    columns: {
      orderId: ['Mã đơn hàng'],
      orderDate: ['Ngày đặt hàng', 'Thời gian đặt hàng'],
      status: ['Trạng Thái Đơn Hàng'],
      cancelReason: ['Lý do hủy'],
      returnReason: ['Lý do trả hàng', 'Trạng thái Trả hàng/Hoàn tiền'],
      returnStatus: ['Trạng thái Trả hàng/Hoàn tiền'],
      returnedQty: ['Số lượng sản phẩm được hoàn trả'],
      sku: ['SKU phân loại hàng'],
      skuFallback: ['SKU sản phẩm', 'Mã sản phẩm'],
      productId: ['Mã sản phẩm'],
      productName: ['Tên sản phẩm'],
      variation: ['Tên phân loại hàng'],
      quantity: ['Số lượng'],
      lineGross: ['Tổng giá bán (sản phẩm)'],
      unitPrice: ['Giá gốc'],
      dealPrice: ['Giá ưu đãi'],
      orderSellerVoucher: ['Mã giảm giá của Shop'],
      orderRefund: ['Số tiền hoàn lại', 'Số tiền hoàn trả', 'Số tiền được hoàn'],
      platformFee: ['Phí cố định'],
      serviceFee: ['Phí Dịch Vụ'],
      paymentFee: ['Phí thanh toán'],
      buyer: ['Người Mua', 'Tên người mua'],
    },
  },
  {
    key: 'tiktok',
    label: 'TikTok Shop',
    signature: ['Order ID', 'ID đơn hàng', 'Seller SKU', 'SKU người bán'],
    required: ['orderId', 'orderDate', 'status', 'quantity'],
    orderLevelRepeated: true,
    columns: {
      orderId: ['Order ID', 'ID đơn hàng'],
      orderDate: ['Created Time', 'Thời gian tạo'],
      status: ['Order Status', 'Trạng thái đơn hàng'],
      returnType: ['Cancelation/Return Type', 'Cancellation/Return Type', 'Loại hủy/trả hàng'],
      cancelReason: ['Cancel Reason', 'Lý do hủy'],
      sku: ['Seller SKU', 'SKU người bán'],
      skuFallback: ['SKU ID'],
      productName: ['Product Name', 'Tên sản phẩm'],
      variation: ['Variation', 'Biến thể'],
      quantity: ['Quantity', 'Số lượng'],
      lineGross: ['SKU Subtotal Before Discount', 'Tổng phụ SKU trước giảm giá'],
      unitPrice: ['SKU Unit Original Price', 'Giá gốc đơn vị SKU'],
      lineSellerDiscount: ['SKU Seller Discount', 'Giảm giá của người bán SKU'],
      linePlatformDiscount: ['SKU Platform Discount', 'Giảm giá của nền tảng SKU'],
      orderRefund: ['Order Refund Amount', 'Số tiền hoàn lại của đơn hàng'],
      buyer: ['Buyer Username', 'Tên người dùng của người mua'],
    },
  },
  {
    key: 'lazada',
    label: 'Lazada',
    signature: ['Order Item Id', 'orderItemId', 'Order Number', 'orderNumber'],
    required: ['orderId', 'orderDate', 'status'],
    orderLevelRepeated: false,
    columns: {
      orderId: ['Order Number', 'orderNumber'],
      orderDate: ['Created at', 'createTime'],
      status: ['Status', 'status'],
      cancelReason: ['Reason', 'Buyer Failed Delivery Reason', 'buyerFailedDeliveryReason'],
      sku: ['Seller SKU', 'sellerSku'],
      skuFallback: ['Lazada SKU', 'lazadaSku'],
      productName: ['Item Name', 'itemName'],
      variation: ['Variation', 'variation'],
      unitPrice: ['Unit Price', 'unitPrice'],
      lineSellerDiscount: ['Seller Discount Total', 'sellerDiscountTotal'],
      buyer: ['Customer Email', 'customerEmail', 'Customer Name', 'customerName'],
    },
  },
  {
    key: 'generic',
    label: 'Mẫu EcomPulse',
    signature: ['order_id', 'Mã đơn hàng', 'Mã đơn'],
    required: ['orderId', 'orderDate', 'quantity'],
    orderLevelRepeated: true,
    columns: {
      orderId: ['order_id', 'Mã đơn hàng', 'Mã đơn'],
      orderDate: ['order_date', 'Ngày đặt hàng', 'Ngày'],
      status: ['order_status', 'Trạng thái', 'Trạng thái đơn hàng'],
      platformName: ['platform', 'Sàn', 'Kênh bán'],
      cancelReason: ['cancel_reason', 'Lý do hủy'],
      sku: ['sku', 'Mã SKU', 'SKU'],
      productName: ['product_name', 'Tên sản phẩm'],
      category: ['category', 'Ngành hàng', 'Danh mục'],
      quantity: ['quantity', 'Số lượng'],
      lineGross: ['gross_revenue', 'Doanh thu trước giảm', 'Thành tiền'],
      unitPrice: ['unit_price', 'Đơn giá'],
      lineSellerDiscount: ['discount', 'Giảm giá'],
      unitCogs: ['unit_cogs', 'Giá vốn đơn vị'],
      lineCogs: ['cogs', 'Giá vốn', 'Tổng giá vốn'],
      buyer: ['customer_id', 'Mã khách hàng'],
    },
  },
];

/** Headers we deliberately never read (PII). Listed so the mapping report can say so. */
const PII_HEADERS = ['Tên Người nhận', 'Số điện thoại', 'Địa chỉ nhận hàng', 'Recipient', 'Phone #', 'Detail Address', 'Shipping Address', 'Customer Name', 'Billing Address'];

export type DetectedReport =
  | { kind: 'orders'; platform: Platform; spec: PlatformSpec; sheet: SheetInput; headerRow: number; columns: Partial<Record<Field, number>> }
  | { kind: 'shopee_summary' }
  | { kind: 'unknown'; reason: Bilingual };

function resolveColumns(headers: unknown[], spec: PlatformSpec): Partial<Record<Field, number>> {
  const norm = headers.map(normalizeHeader);
  const out: Partial<Record<Field, number>> = {};
  for (const [field, candidates] of Object.entries(spec.columns) as [Field, string[]][]) {
    for (const c of candidates) {
      const idx = norm.indexOf(normalizeHeader(c));
      if (idx >= 0) {
        out[field] = idx;
        break;
      }
    }
  }
  return out;
}

const HEADER_SCAN_ROWS = 15;

export function detectReport(input: WorkbookInput): DetectedReport {
  let best: { spec: PlatformSpec; sheet: SheetInput; headerRow: number; columns: Partial<Record<Field, number>>; score: number } | null = null;

  for (const sheet of input.sheets) {
    for (let r = 0; r < Math.min(HEADER_SCAN_ROWS, sheet.rows.length); r++) {
      const headers = sheet.rows[r] || [];
      const norm = new Set(headers.map(normalizeHeader));
      if (norm.size < 2) continue;

      // Shopee "Phân tích bán hàng" summary → legacy parser.
      if (norm.has(normalizeHeader('Tổng doanh số (VND)')) && norm.has(normalizeHeader('Ngày')) && !norm.has(normalizeHeader('Mã đơn hàng'))) {
        return { kind: 'shopee_summary' };
      }

      for (const spec of SPECS) {
        if (!spec.signature.some((s) => norm.has(normalizeHeader(s)))) continue;
        const columns = resolveColumns(headers, spec);
        const hasSku = columns.sku !== undefined || columns.skuFallback !== undefined || columns.productName !== undefined;
        if (!hasSku || !spec.required.every((f) => columns[f] !== undefined)) continue;
        // Specific platforms win over the generic template on ties.
        const score = Object.keys(columns).length + (spec.key === 'generic' ? 0 : 3);
        if (!best || score > best.score) best = { spec, sheet, headerRow: r, columns, score };
      }
    }
  }

  if (best) {
    return {
      kind: 'orders',
      platform: best.spec.key === 'generic' ? 'other' : best.spec.key,
      spec: best.spec,
      sheet: best.sheet,
      headerRow: best.headerRow,
      columns: best.columns,
    };
  }
  return {
    kind: 'unknown',
    reason: {
      vi: 'Không nhận diện được file. Hỗ trợ: file xuất đơn hàng, báo cáo Quảng cáo, Livestream, Hiệu quả sản phẩm (traffic), Affiliate/Video của Shopee / TikTok Shop / Lazada; báo cáo Phân tích bán hàng Shopee; danh mục sản phẩm (SKU + Ngành hàng / Giá vốn) hoặc mẫu EcomPulse.',
      en: 'Unrecognized file. Supported: order, ads, live, product traffic and affiliate/video exports of Shopee / TikTok Shop / Lazada, Shopee sales analysis, product catalog (SKU + category / COGS) or the EcomPulse templates.',
    },
  };
}

export interface OrderImportStats {
  dataRows: number;
  importedLines: number;
  orders: number;
  skipped: Record<string, number>;
  partiallyCancelledItems: number;
}

export interface OrderImportResult {
  platform: Platform;
  platformLabel: string;
  sheetName: string;
  dataset: CanonicalDataset;
  stats: OrderImportStats;
  warnings: Bilingual[];
  /** Canonical field → source header, for the Data Mapping view. */
  columnsUsed: Record<string, string>;
  /** Headers present in the file that were intentionally not read (PII). */
  ignoredPersonalColumns: string[];
  coverage: { start: string; end: string } | null;
}

interface PendingOrder {
  order: Order;
  lines: OrderLine[];
  /** Lazada: per-item statuses before resolving the order status. */
  itemStatuses: { status: Order['status']; line: OrderLine }[];
}

const cell = (row: unknown[], idx: number | undefined) => (idx === undefined ? undefined : row[idx]);
const text = (v: unknown) => (v === undefined || v === null ? '' : String(v).trim());

export function importOrderExport(
  input: WorkbookInput,
  detected: Extract<DetectedReport, { kind: 'orders' }>,
  onProgress?: (fraction: number) => void,
): OrderImportResult {
  const { spec, sheet, headerRow, columns: c, platform: detectedPlatform } = detected;
  const headers = sheet.rows[headerRow] || [];
  const dataRows = sheet.rows.slice(headerRow + 1);
  const skipped: Record<string, number> = {};
  const skip = (reason: string) => (skipped[reason] = (skipped[reason] || 0) + 1);
  const pending = new Map<string, PendingOrder>();
  const products = new Map<string, Product>();
  let importedLines = 0;

  const progressEvery = Math.max(500, Math.floor(dataRows.length / 50));
  dataRows.forEach((row, i) => {
    if (onProgress && i % progressEvery === 0) onProgress(i / Math.max(1, dataRows.length));
    if (!row || row.every((v) => text(v) === '')) return;

    const orderId = text(cell(row, c.orderId));
    if (!orderId || !/[0-9A-Za-z]/.test(orderId) || normalizeHeader(orderId) === normalizeHeader(headers[c.orderId!])) {
      skip('missing_order_id');
      return;
    }
    const date = toIsoDate(cell(row, c.orderDate));
    if (!date) {
      // TikTok exports put a column-description row right under the headers.
      skip(i === 0 ? 'description_row' : 'invalid_date');
      return;
    }
    const sku = text(cell(row, c.sku)) || text(cell(row, c.skuFallback)) || text(cell(row, c.productName));
    if (!sku) {
      skip('missing_sku');
      return;
    }

    const platform: Platform =
      spec.key === 'generic' ? platformOf(text(cell(row, c.platformName))) : detectedPlatform;
    const rawStatus = text(cell(row, c.status));
    let status = c.status === undefined ? 'completed' : normalizeOrderStatus(rawStatus);
    const returnType = normalizeHeader(cell(row, c.returnType));
    if (returnType && (returnType.includes('return') || returnType.includes('refund') || returnType.includes('trahang')) && !isCancelled(status)) {
      status = returnType.includes('refundonly') || returnType.includes('hoantien') ? 'refunded' : 'returned';
    }
    // Shopee: a return / refund shows as status "Trả hàng/Hoàn tiền", OR a value in
    // "Trạng thái Trả hàng/Hoàn tiền", OR items returned > 0 (the order status can still say
    // "Hoàn thành"). Any of them makes a non-cancelled order a return.
    const returnedQty = toNumber(cell(row, c.returnedQty)) ?? 0;
    if (!isCancelled(status) && status !== 'refunded' && (text(cell(row, c.returnStatus)) !== '' || returnedQty > 0)) status = 'returned';

    const qty = spec.key === 'lazada' ? 1 : toNumber(cell(row, c.quantity)) ?? 1;
    const unitPrice = toNumber(cell(row, c.dealPrice)) ?? toNumber(cell(row, c.unitPrice));
    // GMV uses the actual selling price (Shopee "Tổng giá bán"), not inflated list prices.
    const gross = toNumber(cell(row, c.lineGross)) ?? (unitPrice !== undefined ? unitPrice * qty : undefined);
    if (gross === undefined) {
      skip('missing_amount');
      return;
    }
    const sellerDiscount = toNumber(cell(row, c.lineSellerDiscount));
    const platformDiscount = toNumber(cell(row, c.linePlatformDiscount));
    const unitCogs = toNumber(cell(row, c.unitCogs)) ?? (toNumber(cell(row, c.lineCogs)) !== undefined && qty > 0 ? toNumber(cell(row, c.lineCogs))! / qty : undefined);
    const productName = [text(cell(row, c.productName)), text(cell(row, c.variation))].filter(Boolean).join(' — ') || undefined;

    const line: OrderLine = {
      orderId,
      sku,
      productName,
      quantity: qty,
      grossAmount: gross,
      sellerDiscount: sellerDiscount !== undefined ? Math.abs(sellerDiscount) : undefined,
      platformDiscount: platformDiscount !== undefined ? Math.abs(platformDiscount) : undefined,
      unitCogs,
    };

    let p = pending.get(orderId);
    if (!p) {
      const buyer = text(cell(row, c.buyer));
      const platformFee = sumDefined(toNumber(cell(row, c.platformFee)), toNumber(cell(row, c.serviceFee)));
      const paymentFee = toNumber(cell(row, c.paymentFee));
      const voucher = toNumber(cell(row, c.orderSellerVoucher));
      const refund = toNumber(cell(row, c.orderRefund));
      p = {
        order: {
          orderId,
          platform,
          orderDate: date,
          status,
          rawStatus: rawStatus || undefined,
          cancelReason: text(cell(row, c.cancelReason)) || undefined,
          returnReason: text(cell(row, c.returnReason)) || undefined,
          customerId: buyer ? pseudonymize(buyer, platform) : undefined,
          sellerVoucher: voucher !== undefined ? Math.abs(voucher) : undefined,
          refundAmount: refund !== undefined && refund !== 0 ? Math.abs(refund) : undefined,
          platformFee: platformFee !== undefined ? Math.abs(platformFee) : undefined,
          paymentFee: paymentFee !== undefined ? Math.abs(paymentFee) : undefined,
        },
        lines: [],
        itemStatuses: [],
      };
      pending.set(orderId, p);
    } else if (!spec.orderLevelRepeated) {
      // Lazada: each item row carries its own status/reason.
      if (!p.order.cancelReason) p.order.cancelReason = text(cell(row, c.cancelReason)) || undefined;
    } else if (status === 'returned' && !isCancelled(p.order.status) && p.order.status !== 'refunded') {
      // Shopee: only the returned item row may say so — the whole order is a return.
      p.order.status = 'returned';
      for (const s of p.itemStatuses) s.status = 'returned';
    }
    p.lines.push(line);
    p.itemStatuses.push({ status, line });
    importedLines++;

    if (!products.has(sku)) {
      products.set(sku, {
        sku,
        productId: text(cell(row, c.productId)) || undefined,
        name: productName,
        category: text(cell(row, c.category)) || undefined,
        unitCogs,
        platform,
      });
    }
  });
  onProgress?.(1);

  // Resolve per-item statuses (Lazada partial cancellations).
  let partiallyCancelledItems = 0;
  let refundFromOrderValue = 0;
  const orders: Order[] = [];
  const lines: OrderLine[] = [];
  for (const p of pending.values()) {
    const live = p.itemStatuses.filter((s) => !isCancelled(s.status));
    if (live.length > 0 && live.length < p.itemStatuses.length) {
      partiallyCancelledItems += p.itemStatuses.length - live.length;
      p.order.status = live[0].status;
      p.lines = live.map((s) => s.line);
    } else if (live.length === 0 && p.itemStatuses.length > 0) {
      p.order.status = p.itemStatuses[0].status;
    } else if (live.length > 0) {
      p.order.status = mostAdvanced(live.map((s) => s.status));
    }
    // No refund-amount column: a returned / refunded order counts its whole value, as the
    // Shopee report's "Doanh số các đơn Trả hàng/Hoàn tiền" does.
    if (c.orderRefund === undefined && (p.order.status === 'returned' || p.order.status === 'refunded') && p.order.refundAmount === undefined) {
      p.order.refundAmount = p.lines.reduce((s, l) => s + (l.grossAmount || 0), 0);
      refundFromOrderValue++;
    }
    orders.push(p.order);
    lines.push(...p.lines);
  }

  const dataset = emptyDataset(`import-${detected.platform}-${Date.now()}`, input.fileName);
  dataset.orders = orders;
  dataset.orderLines = lines;
  dataset.products = Array.from(products.values());
  dataset.sources = [
    { fileName: input.fileName, platform: detectedPlatform, reportType: 'orders', importedAt: new Date().toISOString(), rowCount: dataRows.length },
  ];

  const warnings: Bilingual[] = [];
  const totalSkipped = Object.values(skipped).reduce((s, n) => s + n, 0);
  if (skipped.invalid_date) {
    warnings.push({ vi: `${skipped.invalid_date} dòng có ngày không đọc được — đã bỏ qua.`, en: `${skipped.invalid_date} rows had unreadable dates — skipped.` });
  }
  if (skipped.missing_amount) {
    warnings.push({ vi: `${skipped.missing_amount} dòng không có giá bán — đã bỏ qua.`, en: `${skipped.missing_amount} rows had no price — skipped.` });
  }
  if (partiallyCancelledItems > 0) {
    warnings.push({
      vi: `${partiallyCancelledItems} sản phẩm bị hủy lẻ trong đơn còn hiệu lực — không tính vào doanh thu.`,
      en: `${partiallyCancelledItems} items were cancelled inside otherwise valid orders — excluded from revenue.`,
    });
  }
  if (refundFromOrderValue > 0) {
    warnings.push({
      vi: `File không có cột "Số tiền hoàn lại" — ${refundFromOrderValue} đơn trả hàng/hoàn tiền được tính hoàn toàn bộ giá trị đơn (như báo cáo Shopee).`,
      en: `No refund-amount column — ${refundFromOrderValue} returned orders count their whole value.`,
    });
  }
  if (c.status === undefined) {
    warnings.push({
      vi: 'File không có cột trạng thái đơn — tất cả đơn được coi là hoàn tất. Tỷ lệ hủy/hoàn sẽ không chính xác.',
      en: 'No order status column — all orders are treated as completed. Cancel/return rates will be wrong.',
    });
  }
  if (c.cancelReason === undefined) {
    warnings.push({ vi: 'File không có cột lý do hủy.', en: 'The file has no cancellation reason column.' });
  }
  if (c.platformFee === undefined && c.paymentFee === undefined) {
    warnings.push({
      vi: 'File không có phí sàn/phí thanh toán — hãy nhập tỷ lệ phí trong Cài đặt để tính lợi nhuận.',
      en: 'No platform/payment fees in the file — set fee rates in Settings to compute profit.',
    });
  }
  if (totalSkipped > 0 && orders.length === 0) {
    warnings.push({ vi: 'Không đọc được đơn hàng nào từ file.', en: 'No orders could be read from the file.' });
  }

  const columnsUsed: Record<string, string> = {};
  for (const [field, idx] of Object.entries(c)) columnsUsed[field] = String(headers[idx as number] ?? '');
  const headerNorm = new Set(headers.map(normalizeHeader));
  const dates = orders.map((o) => o.orderDate).sort();

  return {
    platform: detectedPlatform,
    platformLabel: spec.label,
    sheetName: sheet.name,
    dataset,
    stats: { dataRows: dataRows.length, importedLines, orders: orders.length, skipped, partiallyCancelledItems },
    warnings,
    columnsUsed,
    ignoredPersonalColumns: PII_HEADERS.filter((h) => headerNorm.has(normalizeHeader(h))),
    coverage: dates.length > 0 ? { start: dates[0], end: dates[dates.length - 1] } : null,
  };
}

const STATUS_RANK: Record<Order['status'], number> = {
  unknown: 0,
  placed: 1,
  paid: 2,
  shipped: 3,
  delivered: 4,
  completed: 5,
  returned: 6,
  refunded: 6,
  failed_delivery: 0,
  cancelled: 0,
};

function mostAdvanced(statuses: Order['status'][]): Order['status'] {
  return statuses.reduce((a, b) => (STATUS_RANK[b] > STATUS_RANK[a] ? b : a));
}

function sumDefined(...values: (number | undefined)[]): number | undefined {
  const defined = values.filter((v): v is number => v !== undefined);
  return defined.length === 0 ? undefined : defined.reduce((s, v) => s + v, 0);
}

function platformOf(value: string): Platform {
  const s = normalizeHeader(value);
  if (s.includes('tiktok')) return 'tiktok';
  if (s.includes('lazada')) return 'lazada';
  if (s.includes('shopee')) return 'shopee';
  return 'other';
}

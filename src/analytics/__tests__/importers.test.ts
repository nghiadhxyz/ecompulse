import { describe, expect, it } from 'vitest';
import { detectReport, importOrderExport, type WorkbookInput } from '../importers/orderExport';
import { detectTableReport, importTableReport } from '../importers/reportImporters';
import { mergeIntoWorkspace } from '../workspace';
import { computeKpis } from '../kpiEngine';
import { pseudonymize, toIsoDate } from '../parse';

function importOrders(input: WorkbookInput) {
  const d = detectReport(input);
  if (d.kind !== 'orders') throw new Error(`expected orders, got ${d.kind}`);
  return importOrderExport(input, d);
}

const SHOPEE_HEADERS = [
  'Mã đơn hàng', 'Ngày đặt hàng', 'Trạng Thái Đơn Hàng', 'Lý do hủy', 'SKU sản phẩm', 'Tên sản phẩm', 'SKU phân loại hàng', 'Tên phân loại hàng',
  'Giá gốc', 'Giá ưu đãi', 'Số lượng', 'Tổng giá bán (sản phẩm)', 'Mã giảm giá của Shop', 'Phí cố định', 'Phí Dịch Vụ', 'Phí thanh toán',
  'Người Mua', 'Tên Người nhận', 'Số điện thoại', 'Địa chỉ nhận hàng',
];
const shopee: WorkbookInput = {
  fileName: 'Order.all.20250901_20250930.xlsx',
  sheets: [{
    name: 'orders',
    rows: [
      SHOPEE_HEADERS,
      ['250901ABC', '2025-09-01 10:15', 'Hoàn thành', '', 'SP1', 'Serum B5', 'SERUM-B5', '30ml', '300.000', '259.000', '2', '518.000', '20.000', '15.000', '10.000', '5.000', 'buyer_one', 'Nguyễn Văn A', '0901234567', '12 Lê Lợi'],
      // second item of the same order: order-level values repeat and must be counted once
      ['250901ABC', '2025-09-01 10:15', 'Hoàn thành', '', 'SP2', 'Khăn ướt', 'KHAN-100', '', '50.000', '45.000', '1', '45.000', '20.000', '15.000', '10.000', '5.000', 'buyer_one', 'Nguyễn Văn A', '0901234567', '12 Lê Lợi'],
      ['250902XYZ', '02/09/2025 08:00', 'Đã hủy', 'Người mua đổi ý', 'SP1', 'Serum B5', 'SERUM-B5', '30ml', '300.000', '259.000', '1', '259.000', '', '', '', '', 'buyer_two', 'Trần B', '0912345678', 'Hà Nội'],
      ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ],
  }],
};

describe('order export detection & import', () => {
  it('detects and imports a Shopee order export', () => {
    const r = importOrders(shopee);
    expect(r.platform).toBe('shopee');
    expect(r.stats.orders).toBe(2);
    expect(r.stats.importedLines).toBe(3);
    const o1 = r.dataset.orders.find((o) => o.orderId === '250901ABC')!;
    expect(o1.status).toBe('completed');
    expect(o1.sellerVoucher).toBe(20_000); // once per order, not per line
    expect(o1.platformFee).toBe(25_000);
    expect(o1.paymentFee).toBe(5_000);
    expect(r.dataset.orders.find((o) => o.orderId === '250902XYZ')!.cancelReason).toBe('Người mua đổi ý');
    expect(r.dataset.orderLines.find((l) => l.sku === 'SERUM-B5' && l.orderId === '250901ABC')!.grossAmount).toBe(518_000);
    expect(r.coverage).toEqual({ start: '2025-09-01', end: '2025-09-02' });
  });

  it('never stores buyer names, phones or addresses', () => {
    const r = importOrders(shopee);
    const json = JSON.stringify(r.dataset);
    expect(json).not.toContain('Nguyễn Văn A');
    expect(json).not.toContain('0901234567');
    expect(json).not.toContain('buyer_one');
    expect(json).not.toContain('Lê Lợi');
    expect(r.dataset.orders[0].customerId).toBe(pseudonymize('buyer_one', 'shopee'));
    expect(r.ignoredPersonalColumns).toEqual(expect.arrayContaining(['Tên Người nhận', 'Số điện thoại', 'Địa chỉ nhận hàng']));
  });

  it('feeds the KPI engine end-to-end', () => {
    const r = importOrders(shopee);
    const m = computeKpis(r.dataset, { range: { start: '2025-09-01', end: '2025-09-02' } }).metrics;
    expect(m.orders.value).toBe(2);
    expect(m.cancelledOrders.value).toBe(1);
    expect(m.gmv.value).toBe(563_000);
    expect(m.netRevenue.value).toBe(543_000);
  });

  it('imports a TikTok Shop export, skipping the description row and mapping returns', () => {
    const headers = ['Order ID', 'Order Status', 'Order Substatus', 'Cancelation/Return Type', 'SKU ID', 'Seller SKU', 'Product Name', 'Variation', 'Quantity',
      'SKU Unit Original Price', 'SKU Subtotal Before Discount', 'SKU Platform Discount', 'SKU Seller Discount', 'Order Refund Amount', 'Created Time', 'Cancel Reason', 'Buyer Username', 'Recipient', 'Phone #'];
    const input: WorkbookInput = {
      fileName: 'tiktok_orders.xlsx',
      sheets: [{
        name: 'OrderSKUList',
        rows: [
          headers,
          ['Platform unique order ID.', 'Current order status.', '', '', '', '', '', '', '', '', '', '', '', '', 'Time the order was created.', '', '', '', ''],
          ['576512345678901234', 'Completed', '', '', '1729', 'SON-LI-03', 'Son lì', '#03', '2', '159000', '318000', '10000', '20000', '', '25/09/2025 20:41:10', '', 'tt_user', 'Lê C', '0987'],
          ['576512345678905678', 'Completed', '', 'Return/Refund', '1729', 'SON-LI-03', 'Son lì', '#03', '1', '159000', '159000', '0', '0', '159000', '26/09/2025 21:00:00', '', 'tt_user2', 'Phạm D', '0988'],
          ['576512345678909999', 'Canceled', '', 'Cancel', '1729', 'SON-LI-03', 'Son lì', '#03', '1', '159000', '159000', '0', '0', '', '27/09/2025 21:00:00', 'Buyer changed mind', 'tt_user3', 'Hồ E', '0989'],
        ],
      }],
    };
    const r = importOrders(input);
    expect(r.platform).toBe('tiktok');
    expect(r.stats.orders).toBe(3);
    expect(r.stats.skipped).toEqual({ description_row: 1 });
    expect(r.warnings.some((w) => w.vi.includes('ngày không đọc được'))).toBe(false);
    const byId = Object.fromEntries(r.dataset.orders.map((o) => [o.orderId, o]));
    expect(byId['576512345678905678'].status).toBe('returned');
    expect(byId['576512345678905678'].refundAmount).toBe(159_000);
    expect(byId['576512345678909999'].status).toBe('cancelled');
    const line = r.dataset.orderLines.find((l) => l.orderId === '576512345678901234')!;
    expect(line.sellerDiscount).toBe(20_000);
    expect(line.platformDiscount).toBe(10_000);
    expect(r.warnings.some((w) => w.vi.includes('phí sàn'))).toBe(true);
  });

  it('imports Lazada item rows and excludes partially cancelled items', () => {
    const headers = ['Order Item Id', 'Order Type', 'Seller SKU', 'Lazada SKU', 'Created at', 'Order Number', 'Customer Name', 'Customer Email', 'Unit Price', 'Seller Discount Total', 'Item Name', 'Variation', 'Status', 'Reason'];
    const input: WorkbookInput = {
      fileName: 'lazada.xlsx',
      sheets: [{
        name: 'sheet1',
        rows: [
          headers,
          ['1', 'Normal', 'HOP-TP', 'LZ1', '29 Sep 2025 10:22', '800111', 'Khách A', 'a@mail.vn', '159000', '-10000', 'Hộp thực phẩm', '', 'delivered', ''],
          ['2', 'Normal', 'HOP-TP', 'LZ1', '29 Sep 2025 10:22', '800111', 'Khách A', 'a@mail.vn', '159000', '-10000', 'Hộp thực phẩm', '', 'canceled', 'Out of stock'],
          ['3', 'Normal', 'BINH', 'LZ2', '30 Sep 2025 09:00', '800222', 'Khách B', 'b@mail.vn', '199000', '0', 'Bình giữ nhiệt', '', 'canceled', 'Customer request'],
        ],
      }],
    };
    const r = importOrders(input);
    expect(r.platform).toBe('lazada');
    expect(r.stats.orders).toBe(2);
    expect(r.stats.partiallyCancelledItems).toBe(1);
    const o = r.dataset.orders.find((x) => x.orderId === '800111')!;
    expect(o.status).toBe('delivered');
    expect(r.dataset.orderLines.filter((l) => l.orderId === '800111')).toHaveLength(1);
    expect(r.dataset.orderLines.find((l) => l.orderId === '800111')!.sellerDiscount).toBe(10_000);
    expect(r.dataset.orders.find((x) => x.orderId === '800222')!.status).toBe('cancelled');
    expect(JSON.stringify(r.dataset)).not.toContain('a@mail.vn');
  });

  it('imports the generic EcomPulse template with COGS and platform column', () => {
    const input: WorkbookInput = {
      fileName: 'template.csv',
      sheets: [{
        name: 'Sheet1',
        rows: [
          ['Báo cáo đơn hàng tháng 9'], // title row before the header
          ['order_id', 'order_date', 'order_status', 'platform', 'sku', 'product_name', 'category', 'quantity', 'gross_revenue', 'discount', 'unit_cogs'],
          ['A1', '2025-09-01', 'Hoàn thành', 'TikTok Shop', 'X', 'Sản phẩm X', 'Làm đẹp', 2, 200000, 0, 60000],
        ],
      }],
    };
    const r = importOrders(input);
    expect(r.dataset.orders[0].platform).toBe('tiktok');
    expect(r.dataset.products[0]).toMatchObject({ sku: 'X', category: 'Làm đẹp', unitCogs: 60_000 });
  });

  it('reads a COGS sheet as a product catalog, and detects the Shopee summary report', () => {
    const cogs: WorkbookInput = { fileName: 'gia_von.xlsx', sheets: [{ name: 'Giá vốn', rows: [['SKU', 'Tên sản phẩm', 'Giá vốn'], ['SERUM-B5', 'Serum', '68.000'], ['BAD', 'x', 'abc']] }] };
    expect(detectReport(cogs).kind).toBe('unknown'); // not an order export
    const t = detectTableReport(cogs)!;
    expect(t.spec.kind).toBe('catalog');
    const res = importTableReport(cogs, t);
    expect(res.dataset.products.find((p) => p.sku === 'SERUM-B5')?.unitCogs).toBe(68_000);
    expect(res.dataset.products.find((p) => p.sku === 'BAD')?.unitCogs).toBeUndefined();

    const summary: WorkbookInput = { fileName: 'x.xlsx', sheets: [{ name: 'Đơn hàng đã đặt', rows: [['Ngày', 'Tổng doanh số (VND)', 'Tổng số đơn hàng']] }] };
    expect(detectReport(summary).kind).toBe('shopee_summary');

    const junk: WorkbookInput = { fileName: 'x.xlsx', sheets: [{ name: 's', rows: [['a', 'b'], [1, 2]] }] };
    const u = detectReport(junk);
    expect(u.kind).toBe('unknown');
  });

  it('parses Lazada-style month-name dates', () => {
    expect(toIsoDate('29 Sep 2025 10:22')).toBe('2025-09-29');
    expect(toIsoDate('Sep 29, 2025')).toBe('2025-09-29');
  });
});

describe('workspace merge', () => {
  it('re-importing overlapping orders replaces them instead of double counting', () => {
    const first = importOrders(shopee).dataset;
    const second = importOrders(shopee).dataset;
    const ws = mergeIntoWorkspace(mergeIntoWorkspace(null, first), second);
    expect(ws.orders).toHaveLength(2);
    expect(ws.orderLines).toHaveLength(3);
    expect(ws.sources).toHaveLength(2);
  });

  it('keeps orders from different platforms apart even if ids collide', () => {
    const a = importOrders(shopee).dataset;
    const b = { ...a, orders: a.orders.map((o) => ({ ...o, platform: 'lazada' as const })) };
    const ws = mergeIntoWorkspace(mergeIntoWorkspace(null, a), b);
    expect(ws.orders).toHaveLength(4);
    expect(new Set(ws.orders.map((o) => o.orderId)).size).toBe(4);
    expect(ws.orderLines).toHaveLength(6);
  });
});

import { useState } from 'react';
import { fmtByUnit, fmtCount, type Lang } from '../../analytics';
import { AFFILIATE_STATUS } from '../../analytics/tiktokAffiliate';
import { affiliateOrderKey, type AffiliateOrder } from '../../analytics/importers/tiktokAffiliate';
import { estimatedCommission, type AffiliateReconciliation } from '../../analytics/affiliateSettlement';
import { downloadCsv, downloadXlsx } from '../../utils/reportExport';
import { Button, SectionCard } from '../ui/primitives';
import { DataTable, type Column } from '../ui/data';

type Row = AffiliateOrder;
export function AffiliateOrderDetail({ rows, lang, title, period, reconciliation }: {
  rows: readonly Row[]; lang: Lang; title: string; period: string; reconciliation: ReadonlyMap<Row, AffiliateReconciliation>;
}) {
  const vi = lang === 'vi';
  const [page, setPage] = useState(0);
  const pageSize = 40;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const status = (row: Row) => row.status === 'unknown' ? row.settlementStatus ?? AFFILIATE_STATUS.unknown[lang] : AFFILIATE_STATUS[row.status][lang];
  const audit = (row: Row) => {
    const entry = reconciliation.get(row);
    if (!entry) return '—';
    if (entry.status === 'incomplete') return vi ? 'Thiếu thành phần' : 'Missing inputs';
    if (entry.status === 'matched') return vi ? 'Khớp' : 'Matched';
    return `${vi ? 'Chênh lệch' : 'Difference'}: ${fmtByUnit(entry.difference, 'vnd', lang, false)}`;
  };
  const fields: { label: string; value: (row: Row) => string | number | null; unit?: 'vnd' | 'count' }[] = [
    { label: vi ? 'ID đơn hàng' : 'Order ID', value: (r) => r.orderId },
    { label: vi ? 'Sản phẩm' : 'Product', value: (r) => r.productName },
    { label: 'ID SKU', value: (r) => r.skuId },
    { label: vi ? 'ID sản phẩm' : 'Product ID', value: (r) => r.productId },
    { label: vi ? 'Cửa hàng' : 'Shop', value: (r) => r.shopName },
    { label: vi ? 'Loại nội dung' : 'Content type', value: (r) => r.contentType },
    { label: vi ? 'ID nội dung' : 'Content ID', value: (r) => r.contentId },
    { label: vi ? 'Loại đơn hàng' : 'Order type', value: (r) => r.orderType },
    { label: vi ? 'Ngày đặt' : 'Ordered at', value: (r) => r.orderedAt },
    { label: vi ? 'Ngày quyết toán' : 'Settled at', value: (r) => r.settledAt },
    { label: vi ? 'Trạng thái' : 'Status', value: status },
    { label: vi ? 'Giá giao dịch' : 'Transaction price', value: (r) => r.price, unit: 'vnd' },
    { label: vi ? 'Đã bán' : 'Units sold', value: (r) => r.quantity, unit: 'count' },
    { label: vi ? 'Đã hoàn' : 'Units refunded', value: (r) => r.refundedQuantity, unit: 'count' },
    { label: 'GMV', value: (r) => r.gmv, unit: 'vnd' },
    { label: vi ? 'Hoa hồng dự kiến' : 'Estimated commission', value: estimatedCommission, unit: 'vnd' },
    { label: vi ? 'Hoa hồng tiêu chuẩn' : 'Standard commission', value: (r) => r.actualStandard, unit: 'vnd' },
    { label: vi ? 'Hoa hồng quảng cáo' : 'Shop Ads commission', value: (r) => r.actualShopAds, unit: 'vnd' },
    { label: vi ? 'Thưởng TikTok' : 'TikTok bonus', value: (r) => r.actualBonus, unit: 'vnd' },
    { label: vi ? 'Thưởng đối tác' : 'Partner bonus', value: (r) => r.actualPartnerBonus, unit: 'vnd' },
    { label: 'PIT', value: (r) => r.actualPit, unit: 'vnd' },
    { label: vi ? 'Thực nhận theo file' : 'Final received in report', value: (r) => r.finalReceived, unit: 'vnd' },
    { label: vi ? 'Đối soát' : 'Reconciliation', value: audit },
  ];
  const columns: Column<Row>[] = fields.map(({ label, value, unit }) => ({
    key: label, header: label, render: (row) => unit ? fmtByUnit(value(row) as number | null, unit, lang, false) : value(row) ?? '—',
  }));
  const exportRows = (format: 'csv' | 'xlsx') => {
    const report = {
      type: 'monthly' as const, title: 'TikTok Affiliate', period, generatedFrom: 'TikTok Affiliate Orders', summary: [title],
      tables: [{ title, columns: fields.map((f) => f.label), rows: rows.map((row) => fields.map((f) => f.unit
        ? { v: f.value(row) as number | null, unit: f.unit } : { t: String(f.value(row) ?? '') })) }],
    };
    if (format === 'xlsx') downloadXlsx(report);
    else downloadCsv(report);
  };
  return (
    <SectionCard title={title} description={vi ? `${fmtCount(rows.length, lang)} dòng SKU · Mỗi đơn có thể có nhiều dòng` : `${fmtCount(rows.length, lang)} SKU rows · Orders may have multiple rows`}
      tools={<><Button disabled={!rows.length} onClick={() => exportRows('csv')}>CSV</Button><Button disabled={!rows.length} onClick={() => exportRows('xlsx')}>Excel</Button></>}>
      <DataTable rows={rows.slice(current * pageSize, (current + 1) * pageSize)} rowKey={affiliateOrderKey} columns={columns} lang={lang} maxHeight={400} />
      {pageCount > 1 && <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <Button disabled={current === 0} onClick={() => setPage(current - 1)}>{vi ? 'Trang trước' : 'Previous'}</Button>
        <span>{current + 1} / {pageCount}</span>
        <Button disabled={current + 1 === pageCount} onClick={() => setPage(current + 1)}>{vi ? 'Trang sau' : 'Next'}</Button>
      </div>}
    </SectionCard>
  );
}

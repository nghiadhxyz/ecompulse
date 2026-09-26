/**
 * Change Impact — before / after comparison around a logged change (price, voucher,
 * ads budget, live time…).
 *
 * For each window w (7 / 14 / 30 days) the w days from the change date are compared
 * with the w days just before it. When the data does not yet cover the full "after"
 * window, both sides are shortened to the days available so they stay comparable.
 * For a SKU-level change, the rest of the shop over the same days is the reference:
 * if everything moved the same way, the change is less likely to be the reason.
 *
 * Wording: "Sau thay đổi…, X đi cùng …" — a before/after difference is never presented
 * as proof that the change caused it.
 */
import type { CanonicalDataset, ChangeEvent, ChangeType } from './model';
import { datasetDateBounds, type DatasetFilter } from './filters';
import { computeKpis, type KpiKey, KPI_UNITS } from './kpiEngine';
import { compareValues, type Comparison } from './comparisonEngine';
import { campaignCalendar, dayTypeOf } from './campaignEngine';
import { addDays, enumerateDays, formatRangeVi, type DateRange } from './period';
import { fmtChange, fmtMoneyCompact, fmtPp, fmtRate } from './format';
import type { Bilingual, MetricUnit } from './metric';

export const CHANGE_TYPE_LABELS: Record<ChangeType, Bilingual> = {
  price: { vi: 'Đổi giá', en: 'Price' },
  voucher: { vi: 'Voucher / khuyến mãi', en: 'Voucher' },
  combo: { vi: 'Combo', en: 'Combo' },
  ads_budget: { vi: 'Ngân sách Ads', en: 'Ads budget' },
  live_time: { vi: 'Giờ live', en: 'Live time' },
  campaign: { vi: 'Chiến dịch', en: 'Campaign' },
  product: { vi: 'Sản phẩm / listing', en: 'Product / listing' },
  other: { vi: 'Khác', en: 'Other' },
};

export const IMPACT_METRICS: { key: KpiKey; label: Bilingual; goodWhenUp: boolean }[] = [
  { key: 'gmv', label: { vi: 'GMV', en: 'GMV' }, goodWhenUp: true },
  { key: 'orders', label: { vi: 'Số đơn', en: 'Orders' }, goodWhenUp: true },
  { key: 'units', label: { vi: 'Sản phẩm bán', en: 'Units' }, goodWhenUp: true },
  { key: 'aov', label: { vi: 'AOV', en: 'AOV' }, goodWhenUp: true },
  { key: 'cvr', label: { vi: 'CVR', en: 'CVR' }, goodWhenUp: true },
  { key: 'cancelRate', label: { vi: 'Tỷ lệ hủy', en: 'Cancel rate' }, goodWhenUp: false },
  { key: 'profit', label: { vi: 'Lợi nhuận', en: 'Profit' }, goodWhenUp: true },
  { key: 'margin', label: { vi: 'Margin', en: 'Margin' }, goodWhenUp: true },
];

export interface ImpactMetric {
  key: KpiKey;
  label: Bilingual;
  unit: MetricUnit;
  goodWhenUp: boolean;
  change: Comparison;
}

export interface ImpactWindow {
  days: number;
  /** Days actually compared on each side (≤ days when the data ends early). */
  usedDays: number;
  before: DateRange;
  after: DateRange;
  complete: boolean;
  metrics: ImpactMetric[];
  /** Rest of the shop (same platform scope, excluding the SKU) over the same days. */
  reference: { gmv: Comparison; orders: Comparison } | null;
  saleDaysBefore: number;
  saleDaysAfter: number;
  summary: Bilingual;
}

export interface ChangeImpactResult {
  event: ChangeEvent;
  scopeLabel: Bilingual;
  windows: ImpactWindow[];
  unavailable?: Bilingual;
  notes: Bilingual[];
}

export function eventScope(event: Pick<ChangeEvent, 'platform' | 'sku'>): Omit<DatasetFilter, 'range'> {
  return { platforms: event.platform ? [event.platform] : undefined, skus: event.sku ? [event.sku] : undefined };
}

function countSaleDays(dataset: CanonicalDataset, range: DateRange): number {
  const cal = campaignCalendar(dataset, range);
  return enumerateDays(range).filter((d) => {
    const t = dayTypeOf(d, cal);
    return t !== 'weekday' && t !== 'weekend';
  }).length;
}

function scopeName(dataset: CanonicalDataset, event: Pick<ChangeEvent, 'platform' | 'sku'>): Bilingual {
  const product = event.sku ? dataset.products.find((p) => p.sku === event.sku)?.name ?? event.sku : null;
  const plat = event.platform ? ` · ${event.platform === 'shopee' ? 'Shopee' : event.platform === 'tiktok' ? 'TikTok Shop' : event.platform === 'lazada' ? 'Lazada' : event.platform}` : '';
  return product ? { vi: `${product}${plat}`, en: `${product}${plat}` } : { vi: `Toàn shop${plat}`, en: `Whole shop${plat}` };
}

/** Before/after for one scope and one change date. Used for change events and actions. */
export function beforeAfter(
  dataset: CanonicalDataset,
  scope: Omit<DatasetFilter, 'range'>,
  date: string,
  windows: number[] = [7, 14, 30],
): { windows: ImpactWindow[]; unavailable?: Bilingual } {
  const bounds = datasetDateBounds(dataset);
  if (!bounds || dataset.orders.length === 0) return { windows: [], unavailable: { vi: 'Cần file xuất đơn hàng để so sánh trước/sau.', en: 'An order export is required.' } };
  if (date > bounds.end) return { windows: [], unavailable: { vi: 'Chưa có dữ liệu sau ngày thay đổi.', en: 'No data after the change date yet.' } };
  if (date <= bounds.start) return { windows: [], unavailable: { vi: 'Chưa có dữ liệu trước ngày thay đổi để so sánh.', en: 'No data before the change date.' } };

  const out: ImpactWindow[] = [];
  for (const days of windows) {
    const afterDays = Math.min(days, enumerateDays({ start: date, end: bounds.end }).length);
    const beforeDays = Math.min(days, enumerateDays({ start: bounds.start, end: addDays(date, -1) }).length);
    const used = Math.min(afterDays, beforeDays);
    if (used < 3) continue;
    const after = { start: date, end: addDays(date, used - 1) };
    const before = { start: addDays(date, -used), end: addDays(date, -1) };
    const k1 = computeKpis(dataset, { ...scope, range: after }).metrics;
    const k0 = computeKpis(dataset, { ...scope, range: before }).metrics;
    const metrics: ImpactMetric[] = IMPACT_METRICS.map((m) => ({
      key: m.key,
      label: m.label,
      unit: KPI_UNITS[m.key],
      goodWhenUp: m.goodWhenUp,
      change: compareValues(k1[m.key].value, k0[m.key].value, KPI_UNITS[m.key]),
    }));

    let reference: ImpactWindow['reference'] = null;
    if (scope.skus?.length) {
      // Rest of the shop = scope without the SKU filter minus the SKU itself.
      const wide1 = computeKpis(dataset, { platforms: scope.platforms, range: after }).metrics;
      const wide0 = computeKpis(dataset, { platforms: scope.platforms, range: before }).metrics;
      const sub = (a: number | null, b: number | null) => (a === null || b === null ? null : a - b);
      reference = {
        gmv: compareValues(sub(wide1.gmv.value, k1.gmv.value), sub(wide0.gmv.value, k0.gmv.value), 'vnd'),
        orders: compareValues(sub(wide1.orders.value, k1.orders.value), sub(wide0.orders.value, k0.orders.value), 'count'),
      };
    }
    const saleDaysBefore = countSaleDays(dataset, before);
    const saleDaysAfter = countSaleDays(dataset, after);
    const gmv = metrics[0].change;
    const orders = metrics[1].change;
    const cancel = metrics.find((m) => m.key === 'cancelRate')!.change;
    const dir = (c: Comparison) =>
      c.percentageDelta === null ? 'không so được' : c.percentageDelta > 0.005 ? `tăng ${fmtRate(c.percentageDelta)}` : c.percentageDelta < -0.005 ? `giảm ${fmtRate(-c.percentageDelta)}` : 'gần như không đổi';
    const refText = reference?.gmv.percentageDelta != null ? ` Cùng thời gian, phần còn lại của shop ${dir(reference.gmv)}.` : '';
    const saleText = saleDaysBefore !== saleDaysAfter ? ` Lưu ý: ${saleDaysAfter} ngày sale sau so với ${saleDaysBefore} ngày sale trước — hai bên không cùng điều kiện.` : '';
    out.push({
      days,
      usedDays: used,
      before,
      after,
      complete: used === days,
      metrics,
      reference,
      saleDaysBefore,
      saleDaysAfter,
      summary: {
        vi: !gmv.previous
          ? `Sau thay đổi (${used} ngày, ${formatRangeVi(after)}): GMV ${fmtMoneyCompact(gmv.current)}, ${orders.current ?? 0} đơn. ${used} ngày trước đó chưa có doanh số nên không so sánh được.${refText}`
          : `Sau thay đổi (${used} ngày, ${formatRangeVi(after)}), GMV ${dir(gmv)}, số đơn ${dir(orders)}, tỷ lệ hủy ${fmtPp(cancel.percentagePointDelta ?? null)} so với ${used} ngày trước đó.${refText}${saleText}`,
        en: `After the change (${used} days), GMV ${fmtChange(gmv.percentageDelta, 'en')}, orders ${fmtChange(orders.percentageDelta, 'en')} vs the ${used} days before.`,
      },
    });
  }
  if (out.length === 0) {
    const after = enumerateDays({ start: date, end: bounds.end }).length;
    return {
      windows: [],
      unavailable: { vi: `Mới có ${after} ngày dữ liệu từ ngày áp dụng — cần ít nhất 3 ngày trước và sau để so sánh. Nhập thêm dữ liệu mới để đo.`, en: `Only ${after} day(s) of data since the date; at least 3 are needed.` },
    };
  }
  return { windows: out };
}

export function changeImpact(dataset: CanonicalDataset, event: ChangeEvent, windows: number[] = [7, 14, 30]): ChangeImpactResult {
  const r = beforeAfter(dataset, eventScope(event), event.date, windows);
  const notes: Bilingual[] = [];
  if (r.windows.some((w) => !w.complete)) {
    notes.push({ vi: 'Dữ liệu sau thay đổi chưa đủ số ngày của cửa sổ — hai bên được rút ngắn bằng nhau để so sánh công bằng.', en: 'Windows shortened to the days available after the change.' });
  }
  const w = r.windows.find((x) => x.days === 14) ?? r.windows[0];
  if (w?.reference && w.reference.gmv.percentageDelta !== null && w.metrics[0].change.percentageDelta !== null) {
    const gap = w.metrics[0].change.percentageDelta - w.reference.gmv.percentageDelta;
    notes.push(
      Math.abs(gap) < 0.05
        ? { vi: 'GMV của phạm vi thay đổi đi cùng xu hướng chung của shop — chưa thấy khác biệt rõ gắn với thay đổi này.', en: 'The scope moved with the rest of the shop.' }
        : { vi: `GMV của phạm vi thay đổi ${gap > 0 ? 'tốt hơn' : 'kém hơn'} phần còn lại của shop ${Math.abs(gap * 100).toFixed(0)} điểm % — khác biệt này đi cùng thay đổi, cần kiểm tra thêm các yếu tố khác (Ads, tồn kho, mùa vụ).`, en: `The scope did ${gap > 0 ? 'better' : 'worse'} than the rest of the shop.` },
    );
  }
  notes.push({ vi: 'So sánh trước/sau cho biết điều gì thay đổi cùng lúc, không chứng minh thay đổi là nguyên nhân.', en: 'Before/after shows what moved together, not causation.' });
  return { event, scopeLabel: scopeName(dataset, event), windows: r.windows, unavailable: r.unavailable, notes };
}

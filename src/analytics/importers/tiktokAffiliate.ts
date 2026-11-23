import { toIsoDate, toNumber } from '../parse';
import type { SheetInput } from './orderExport';

export const AFFILIATE_HEADERS = {
  orderId: 'ID đơn hàng', skuId: 'ID SKU', productName: 'Tên sản phẩm', productId: 'ID sản phẩm',
  price: 'Giá', quantity: 'Số món bán ra', refundedQuantity: 'Số món đã hoàn tiền',
  shopName: 'Tên cửa hàng', shopId: 'Mã cửa hàng', partner: 'Đối tác liên kết', agency: 'Agency',
  currency: 'Đơn vị tiền tệ', orderType: 'Loại đơn hàng', settlementStatus: 'Trạng thái quyết toán đơn hàng',
  indirect: 'Gián tiếp', commissionType: 'Loại hoa hồng', contentType: 'Loại nội dung', carousel: 'Bài xoay vòng',
  contentId: 'Id nội dung', standardRate: 'Tiêu chuẩn', shopAdsRate: 'Quảng cáo cửa hàng',
  tiktokBonusRate: 'TikTok thưởng', partnerBonusRate: 'Đối tác thưởng', shareRate: 'Phần chia doanh thu',
  gmv: 'GMV', estimatedBasis: 'Cơ sở hoa hồng ước tính', estimatedStandard: 'Hoa hồng tiêu chuẩn ước tính',
  estimatedShopAds: 'Hoa hồng Quảng cáo cửa hàng ước tính', estimatedBonus: 'Thưởng ước tính',
  estimatedPartnerBonus: 'Thưởng ước tính của đối tác liên kết', estimatedIva: 'IVA ước tính',
  estimatedIsr: 'ISR ước tính', estimatedCedularTax: 'Est. CedularTax', estimatedPit: 'PIT ước tính',
  estimatedShare: 'Ước tính phần chia doanh thu', actualBasis: 'Cơ sở hoa hồng thực tế',
  actualStandard: 'Hoa hồng tiêu chuẩn', actualShopAds: 'Hoa hồng Quảng cáo cửa hàng', actualBonus: 'Thưởng',
  actualPartnerBonus: 'Thưởng của đối tác liên kết', actualIsr: 'Thuế - ISR', actualIva: 'Thuế - IVA',
  actualCedularTax: 'cedular_tax', actualPit: 'Thuế - PIT', actualShare: 'Đã chia sẻ với đối tác',
  finalReceived: 'Tổng số tiền nhận được cuối cùng', orderedAt: 'Ngày đặt hàng', settledAt: 'Ngày quyết toán hoa hồng',
} as const;

type Field = keyof typeof AFFILIATE_HEADERS;
export type AffiliateColumnMapping = Partial<Record<Field, number>>;
const amounts = [
  'price', 'quantity', 'refundedQuantity', 'gmv', 'estimatedBasis', 'estimatedStandard', 'estimatedShopAds',
  'estimatedBonus', 'estimatedPartnerBonus', 'estimatedIva', 'estimatedIsr', 'estimatedCedularTax',
  'estimatedPit', 'estimatedShare', 'actualBasis', 'actualStandard', 'actualShopAds', 'actualBonus',
  'actualPartnerBonus', 'actualIsr', 'actualIva', 'actualCedularTax', 'actualPit', 'actualShare', 'finalReceived',
] as const satisfies readonly Field[];
const rates = ['standardRate', 'shopAdsRate', 'tiktokBonusRate', 'partnerBonusRate', 'shareRate'] as const;
const ids = ['orderId', 'skuId', 'productId', 'shopId', 'contentId'] as const;
type NumericField = typeof amounts[number] | typeof rates[number];
export type AffiliateStatus = 'settled' | 'pending' | 'awaiting_payment' | 'ineligible' | 'unknown';
type AffiliateFields = Record<Exclude<Field, NumericField>, string | null> & Record<NumericField, number | null>;
export type AffiliateOrder = AffiliateFields & {
  orderId: string; skuId: string; orderDay: string; settlementDay: string | null; status: AffiliateStatus;
  missing: Partial<Record<Field, 'blank' | 'slash' | 'null' | 'absent' | 'invalid' | 'multiple_rates'>>;
  raw?: Partial<Record<Field, string | number | boolean | null>>;
};

const key = (text: unknown) => String(text ?? '').normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
const identifying = ['settlementStatus', 'estimatedBasis', 'actualBasis', 'finalReceived'] as const;
const required = ['orderId', 'skuId', 'currency', 'orderedAt', 'gmv', 'settlementStatus'] as const;
const fields = Object.keys(AFFILIATE_HEADERS) as Field[];
const aliases: Partial<Record<Field, string[]>> = {
  orderId: ['Mã đơn hàng'], skuId: ['Mã SKU'], settlementStatus: ['Trạng thái quyết toán'],
  settledAt: ['Ngày quyết toán'], contentId: ['Mã nội dung'],
};
const headerFields = new Map(fields.flatMap((field) =>
  [AFFILIATE_HEADERS[field], ...(aliases[field] ?? [])].map((name) => [key(name), field] as const)));
const commissionFields = ['estimatedBasis', 'actualBasis', 'finalReceived', 'estimatedStandard', 'estimatedShopAds', 'actualStandard', 'actualShopAds'] as const;

export function detectTikTokAffiliate(sheets: SheetInput[]) {
  for (const sheet of sheets) {
    for (const [headerRow, row] of sheet.rows.slice(0, 20).entries()) {
      const matches = new Map<Field, number[]>();
      row.forEach((header, index) => {
        const field = headerFields.get(key(header));
        if (!field) return;
        const positions = matches.get(field) ?? [];
        positions.push(index);
        matches.set(field, positions);
      });
      const signatures = identifying.filter((field) => matches.has(field)).length;
      if (!commissionFields.some((field) => matches.has(field)) ||
        (signatures < 2 && !(matches.has('settlementStatus') && matches.has('orderId') && matches.has('skuId')))) continue;
      const columns = Object.fromEntries(fields.map((f) => [f, matches.get(f)?.[0] ?? -1])) as Record<Field, number>;
      const needsMapping = fields.filter((f) => ((required as readonly Field[]).includes(f) && columns[f] < 0) ||
        (matches.get(f)?.length ?? 0) > 1);
      return { sheet, headerRow, columns, needsMapping, ambiguous: needsMapping.map((f) => AFFILIATE_HEADERS[f]) };
    }
  }
  return null;
}

export function affiliateOrderKey(row: AffiliateOrder) {
  return JSON.stringify([row.orderId, row.skuId]);
}

function statusOf(value: unknown): AffiliateStatus {
  switch (key(value)) {
    case 'đã quyết toán': case 'settled': return 'settled';
    case 'chờ xử lý': case 'pending': return 'pending';
    case 'awaitingpayment': case 'awaiting payment': return 'awaiting_payment';
    case 'không đủ điều kiện': case 'ineligible': return 'ineligible';
    default: return 'unknown';
  }
}

export function mergeAffiliateOrders(base: readonly AffiliateOrder[], incoming: readonly AffiliateOrder[]) {
  const rows = new Map(base.map((row) => [affiliateOrderKey(row), row]));
  let conflicts = 0;
  for (const next of incoming) {
    const id = affiliateOrderKey(next);
    const previous = rows.get(id);
    if (!previous) { rows.set(id, next); continue; }
    if (JSON.stringify(previous) === JSON.stringify(next)) continue;
    if (previous.orderDay !== next.orderDay || (['productId', 'shopId', 'contentId'] as const)
      .some((f) => previous[f] && next[f] && previous[f] !== next[f])) { conflicts++; continue; }
    if (previous.status === 'settled' && next.status !== 'settled') continue;
    if (previous.status === 'ineligible' && (next.status === 'pending' || next.status === 'awaiting_payment')) continue;
    if (previous.status !== 'unknown' && next.status === 'unknown') continue;
    if (previous.status === 'settled' && next.status === 'settled') {
      if ((next.settledAt ?? '') < (previous.settledAt ?? '')) continue;
      if (next.settledAt === previous.settledAt && fields.some((f) => previous[f] != null && next[f] != null && previous[f] !== next[f])) { conflicts++; continue; }
    }
    const merged = { ...next, missing: { ...next.missing }, raw: { ...next.raw } };
    for (const field of fields) {
      if (next[field] != null || previous[field] == null) continue;
      if (next.status === 'settled' && previous.status !== 'settled' &&
        (field.startsWith('actual') || field === 'finalReceived' || field === 'settledAt')) continue;
      // Carry source facts forward when the newer export leaves cells empty.
      Object.assign(merged, { [field]: previous[field] });
      delete merged.missing[field];
      if (previous.raw && field in previous.raw) merged.raw[field] = previous.raw[field];
    }
    if (merged.status === 'settled') merged.settlementDay ??= previous.settlementDay;
    rows.set(id, merged);
  }
  return { rows: [...rows.values()], conflicts };
}

type Detection = NonNullable<ReturnType<typeof detectTikTokAffiliate>>;

export function applyAffiliateMapping(detected: Detection, mapping: AffiliateColumnMapping): Detection | null {
  const columns = { ...detected.columns };
  const header = detected.sheet.rows[detected.headerRow];
  for (const field of detected.needsMapping) {
    const index = mapping[field];
    if (index === undefined || !Number.isInteger(index) || index < 0 || !key(header[index])) return null;
    columns[field] = index;
  }
  const assigned = Object.values(columns).filter((index) => index >= 0);
  return new Set(assigned).size === assigned.length ? { ...detected, columns, needsMapping: [], ambiguous: [] } : null;
}
export function importTikTokAffiliate(detected: Detection, rows = detected.sheet.rows.slice(detected.headerRow + 1)) {
  const valid: AffiliateOrder[] = [];
  let invalid = 0;
  let invalidValues = 0;
  for (const raw of rows) {
    if (raw.every((cell) => cell == null || cell === '')) continue;
    const missing: AffiliateOrder['missing'] = {};
    const original: NonNullable<AffiliateOrder['raw']> = {};
    const mapped = Object.fromEntries(fields.map((f) => {
      const col = detected.columns[f];
      const cell = raw[col];
      if (col >= 0) original[f] = typeof cell === 'string' || typeof cell === 'number' || typeof cell === 'boolean' ? cell : null;
      if (col < 0) missing[f] = 'absent';
      else if (cell == null) missing[f] = 'null';
      else if (String(cell).trim() === '') missing[f] = 'blank';
      else if (String(cell).trim() === '/') missing[f] = 'slash';
      if (missing[f]) return [f, null];
      let value: string | number | undefined;
      if ((ids as readonly Field[]).includes(f) && typeof cell === 'number' && !Number.isSafeInteger(cell)) value = undefined;
      else if ((amounts as readonly Field[]).includes(f)) {
        const text = typeof cell === 'string' ? cell.trim() : null;
        if (text !== null && !/^\(?[+-]?\d[\d.,\s]*(?:VND|₫|đ)?\)?$/i.test(text)) value = undefined;
        else value = text !== null && /^-?\d{1,3}(\.\d{3})+$/.test(text)
          ? Number(text.replaceAll('.', '')) : toNumber(cell);
      }
      else if ((rates as readonly Field[]).includes(f)) {
        if (typeof cell === 'string' && /^\d+(?:[.,]\d+)?\s*%(?:\s*\/\s*\d+(?:[.,]\d+)?\s*%)+$/.test(cell.trim())) {
          missing[f] = 'multiple_rates';
          return [f, null];
        }
        // Percent cells can be formatted strings or numeric Excel ratios.
        const amount = typeof cell === 'string' && !/^[+-]?\d+(?:[.,]\d+)?\s*%?$/.test(cell.trim()) ? undefined : toNumber(cell);
        value = amount === undefined ? undefined : ((typeof cell === 'string' && cell.includes('%')) || Math.abs(amount) > 1) ? amount / 100 : amount;
      } else value = String(cell).trim();
      if (value === undefined) { missing[f] = 'invalid'; invalidValues++; }
      return [f, value ?? null];
    })) as Record<Field, string | number | null> as AffiliateFields;
    const orderDay = toIsoDate(raw[detected.columns.orderedAt]);
    const settlementDay = toIsoDate(raw[detected.columns.settledAt]) ?? null;
    if (mapped.settledAt && !settlementDay) { missing.settledAt = 'invalid'; invalidValues++; }
    // Put local wall-clock timestamps in chronological sort order without timezone conversion.
    if (settlementDay) mapped.settledAt = [settlementDay, mapped.settledAt?.match(/\d{2}:\d{2}:\d{2}/)?.[0]].filter(Boolean).join(' ');
    if (!mapped.orderId || !mapped.skuId || !orderDay || mapped.currency?.toUpperCase() !== 'VND') { invalid++; continue; }
    valid.push({ ...mapped, orderId: mapped.orderId, skuId: mapped.skuId, orderDay, settlementDay, status: statusOf(mapped.settlementStatus), missing, raw: original });
  }
  const { rows: uniqueRows, conflicts } = mergeAffiliateOrders([], valid);
  return {
    sourceType: 'tiktok_affiliate_orders' as const,
    rows: uniqueRows, invalid, invalidValues, conflicts,
    mappedColumns: fields.filter((f) => detected.columns[f] >= 0).length,
  };
}

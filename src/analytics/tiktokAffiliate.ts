import type { AffiliateOrder, AffiliateStatus } from './importers/tiktokAffiliate';
import { fmtChange, fmtCount, fmtMoney, fmtRate } from './format';
import { addDays } from './period';
import { DEFAULT_THRESHOLDS, median, type AlertSeverity } from './anomalyEngine';
import { actualCommission, affiliateSettlement, estimatedCommission, sumPresent } from './affiliateSettlement';
export { actualCommission, estimatedCommission } from './affiliateSettlement';
import type { Bilingual } from './metric';
import type { Evidence } from './evidence';

export const AFFILIATE_STATUS: Record<AffiliateStatus, Bilingual> = {
  settled: { vi: 'Đã quyết toán', en: 'Settled' },
  pending: { vi: 'Chờ xử lý', en: 'Pending' },
  awaiting_payment: { vi: 'Đang chờ thanh toán', en: 'Awaiting payment' },
  ineligible: { vi: 'Không đủ điều kiện', en: 'Ineligible' },
  unknown: { vi: 'Chưa xác định', en: 'Unknown' },
};

export const affiliateRatio = (numerator: number | null, denominator: number | null) =>
  numerator !== null && denominator !== null && denominator > 0 ? numerator / denominator : null;

export function summarizeAffiliate(rows: readonly AffiliateOrder[]) {
  const settled = rows.filter((row) => row.status === 'settled');
  const pending = rows.filter((row) => row.status === 'pending' || row.status === 'awaiting_payment');
  const eligible = rows.filter((row) => row.status === 'settled' || row.status === 'pending' || row.status === 'awaiting_payment');
  const total = (field: keyof AffiliateOrder, selected = rows) =>
    sumPresent(selected.map((row) => typeof row[field] === 'number' ? row[field] : null));
  const status = Object.fromEntries(Object.keys(AFFILIATE_STATUS).map((key) => {
    const matching = rows.filter((row) => row.status === key);
    return [key, { rows: matching.length, orders: new Set(matching.map((row) => row.orderId)).size }];
  })) as Record<AffiliateStatus, { rows: number; orders: number }>;
  const orders = new Set(rows.map((row) => row.orderId)).size;
  const gmv = total('gmv');
  const finalReceived = total('finalReceived', settled);
  const quantity = total('quantity');
  return {
    rows: rows.length,
    orders,
    products: new Set(rows.flatMap((row) => row.productId ? [row.productId] : [])).size,
    skus: new Set(rows.map((row) => row.skuId)).size,
    shops: new Set(rows.flatMap((row) => row.shopId ? [row.shopId] : [])).size,
    contents: new Set(rows.flatMap((row) => row.contentId ? [row.contentId] : [])).size,
    pendingOrders: new Set(pending.map((row) => row.orderId)).size,
    settledWithoutFinal: settled.filter((row) => row.finalReceived === null).length,
    gmv, quantity, refundedQuantity: total('refundedQuantity'),
    aov: affiliateRatio(gmv, orders),
    effectiveRate: affiliateRatio(finalReceived, gmv),
    receivedPerUnit: affiliateRatio(finalReceived, quantity),
    receivedPerOrder: affiliateRatio(finalReceived, orders),
    settledOrderRate: affiliateRatio(status.settled.orders, orders),
    ineligibleOrderRate: affiliateRatio(status.ineligible.orders, orders),
    estimatedStandardAll: total('estimatedStandard'), estimatedShopAdsAll: total('estimatedShopAds'),
    estimatedAll: sumPresent(rows.map(estimatedCommission)), estimatedPitAll: total('estimatedPit'),
    ineligibleEstimate: sumPresent(rows.filter((row) => row.status === 'ineligible').map(estimatedCommission)),
    estimatedShopAdsPending: total('estimatedShopAds', pending),
    estimated: sumPresent(eligible.map(estimatedCommission)),
    pendingEstimated: sumPresent(pending.map(estimatedCommission)),
    actual: sumPresent(settled.map(actualCommission)),
    actualStandard: total('actualStandard', settled), actualShopAds: total('actualShopAds', settled),
    estimatedBonus: total('estimatedBonus', eligible), estimatedPartnerBonus: total('estimatedPartnerBonus', eligible),
    estimatedPit: total('estimatedPit', eligible), estimatedIsr: total('estimatedIsr', eligible),
    estimatedIva: total('estimatedIva', eligible), estimatedCedularTax: total('estimatedCedularTax', eligible),
    estimatedShare: total('estimatedShare', eligible),
    actualBonus: total('actualBonus', settled), actualPartnerBonus: total('actualPartnerBonus', settled),
    actualPit: total('actualPit', settled), actualIsr: total('actualIsr', settled), actualIva: total('actualIva', settled),
    actualCedularTax: total('actualCedularTax', settled), actualShare: total('actualShare', settled),
    finalReceived,
    status,
  };
}

export function groupAffiliate(
  rows: readonly AffiliateOrder[],
  group: (row: AffiliateOrder) => { key: string; label: string } | null,
) {
  const groups = new Map<string, { key: string; label: string; rows: AffiliateOrder[] }>();
  for (const row of rows) {
    const item = group(row);
    if (!item) continue;
    const existing = groups.get(item.key);
    if (existing) existing.rows.push(row);
    else groups.set(item.key, { ...item, rows: [row] });
  }
  return [...groups.values()].map(({ key, label, rows }) => ({ key, label, ...summarizeAffiliate(rows) }));
}

export function affiliateGroup(row: AffiliateOrder, keyField: 'productId' | 'skuId' | 'shopId' | 'contentId' | 'contentType') {
  const key = row[keyField];
  if (!key) return null;
  const label = keyField === 'productId' || keyField === 'skuId' ? row.productName : keyField === 'shopId' ? row.shopName : null;
  return { key, label: label ? `${label} · ${key}` : key };
}

export function affiliateLatestDay(rows: readonly AffiliateOrder[]): string {
  return rows.reduce((day, row) => [day, row.orderDay, row.settlementDay ?? ''].sort().at(-1)!, '');
}

export function affiliateProductMatrix(rows: readonly AffiliateOrder[], configured?: { gmv?: number | null; received?: number | null }) {
  const products = groupAffiliate(rows, (row) => affiliateGroup(row, 'productId'))
    .filter((row) => row.gmv !== null && row.finalReceived !== null);
  const gmv = configured?.gmv ?? median(products.map((row) => row.gmv!));
  const received = configured?.received ?? median(products.map((row) => row.finalReceived!));
  return {
    gmv, received,
    rows: gmv === null || received === null ? [] : products.map((row) => ({
      ...row, highGmv: row.gmv! >= gmv, highReceived: row.finalReceived! >= received,
    })),
  };
}

export function affiliateDeepChecks(rows: readonly AffiliateOrder[], waitDays = 14): AffiliateReviewItem[] {
  const totals = summarizeAffiliate(rows);
  const notes: AffiliateReviewItem[] = [];
  const products = groupAffiliate(rows, (row) => affiliateGroup(row, 'productId'));
  const comparable = products.filter((row) => row.effectiveRate !== null);
  const typicalRate = median(comparable.map((row) => row.effectiveRate!));
  const typicalGmv = median(comparable.map((row) => row.gmv!));
  const weak = comparable.filter((row) => row.gmv! >= typicalGmv! && row.effectiveRate! < typicalRate!)
    .sort((a, b) => b.gmv! - a.gmv!)[0];
  if (weak && comparable.length > 1) notes.push({
    id: 'affiliate-product-yield', severity: 'opportunity',
    trace: { field: 'productId', key: weak.key },
    title: pair(`${weak.label}: GMV cao, tỷ suất thực nhận dưới trung vị`, `${weak.label}: high GMV, below-median received rate`),
    evidence: [
      affiliateEvidence(pair('GMV sản phẩm', 'Product GMV'), weak.gmv, 'vnd'),
      { ...affiliateEvidence(pair('Thực nhận / GMV', 'Received / GMV'), weak.effectiveRate, 'ratio'), baseline: typicalRate, baselineLabel: pair('Trung vị sản phẩm', 'Product median') },
    ],
    check: pair('Mở Sản phẩm, chọn ID sản phẩm này và kiểm tra trạng thái quyết toán và tỷ lệ hoa hồng theo từng đơn.', 'Open Products, select this product ID and review settlement status and commission rates by order.'),
  });
  const contents = groupAffiliate(rows, (row) => affiliateGroup(row, 'contentId'));
  const typicalOrders = median(contents.map((row) => row.orders));
  const pending = contents.filter((row) => row.pendingOrders > 0 && row.orders > (typicalOrders ?? 0))
    .sort((a, b) => b.pendingOrders - a.pendingOrders)[0];
  if (pending && contents.length > 1) notes.push({
    id: 'affiliate-content-pending', severity: 'info',
    trace: { field: 'contentId', key: pending.key },
    title: pair(`Nội dung ${pending.key} có đơn đang chờ quyết toán`, `Content ${pending.key} has orders awaiting settlement`),
    evidence: [
      { ...affiliateEvidence(pair('Đơn của nội dung', 'Content orders'), pending.orders, 'count'), baseline: typicalOrders, baselineLabel: pair('Trung vị theo ID nội dung', 'Content-ID median') },
      affiliateEvidence(pair('Đơn đang chờ', 'Pending orders'), pending.pendingOrders, 'count'),
      affiliateEvidence(pair('Tỷ trọng đơn đang chờ', 'Pending order share'), affiliateRatio(pending.pendingOrders, pending.orders), 'ratio'),
    ],
    check: pair('Tìm ID này trong Quảng cáo & nội dung rồi mở chi tiết ngày đặt và quyết toán.', 'Find this ID in Ads & content and review order and settlement dates.'),
  });
  const shops = groupAffiliate(rows, (row) => affiliateGroup(row, 'shopId')).filter((row) => row.finalReceived !== null)
    .sort((a, b) => b.finalReceived! - a.finalReceived!);
  if (shops.length > 1 && (totals.finalReceived ?? 0) > 0) notes.push({
    id: 'affiliate-shop-concentration', severity: 'info',
    trace: { field: 'shopId', key: shops[0].key },
    title: pair(`${shops[0].label} đứng đầu về hoa hồng thực nhận`, `${shops[0].label} leads in received commission`),
    evidence: [
      { ...affiliateEvidence(pair('Tỷ trọng thực nhận toàn báo cáo', 'Share of report receipts'), affiliateRatio(shops[0].finalReceived, totals.finalReceived), 'ratio'),
        baseline: affiliateRatio(shops[1].finalReceived, totals.finalReceived), baselineLabel: pair('Cửa hàng kế tiếp', 'Next shop') },
    ],
    check: pair('Chọn Cửa hàng trong trang Sản phẩm để kiểm tra các SKU đóng góp và mức phụ thuộc.', 'Group by Shop on Products to check contributing SKUs and concentration.'),
  });
  const finance = affiliateSettlement(rows, affiliateLatestDay(rows), waitDays);
  if (finance.aging.length || finance.differences || finance.incomplete ||
      (finance.comparisonRows && finance.comparableEstimate !== finance.comparableActual)) notes.push({
    id: 'affiliate-settlement-validation', severity: finance.differences ? 'warning' : 'info',
    title: pair('Các dòng quyết toán cần đối chiếu', 'Settlement rows to reconcile'),
    evidence: [
      affiliateEvidence(pair(`Dòng chờ quá ${waitDays} ngày theo ngày cuối báo cáo`, `Rows pending over ${waitDays} days at report end`), finance.aging.length, 'count'),
      affiliateEvidence(pair('Dòng có chênh lệch', 'Rows with differences'), finance.differences, 'count'),
      affiliateEvidence(pair('Dòng thiếu thành phần đối soát', 'Rows missing reconciliation inputs'), finance.incomplete, 'count'),
      affiliateEvidence(pair('Số ngày quyết toán trung bình', 'Average days to settlement'), finance.averageDays, 'count'),
      { ...affiliateEvidence(pair('Hoa hồng thực tế trước điều chỉnh', 'Actual commission before adjustments'), finance.comparableActual, 'vnd'),
        baseline: finance.comparableEstimate, baselineLabel: pair('Ước tính trên cùng dòng', 'Estimate for the same rows'), sampleSize: finance.comparisonRows },
    ],
    check: pair('Mở chi tiết quyết toán để đối chiếu số tiền, thuế và ngày theo từng dòng SKU.', 'Review per-SKU settlement amounts, taxes and dates in the settlement detail.'),
  });
  return notes;
}

export function affiliateTimeSeries(rows: readonly AffiliateOrder[]) {
  const days = (field: 'orderDay' | 'settlementDay', selected: readonly AffiliateOrder[]) =>
    groupAffiliate(selected, (row) => row[field] ? { key: row[field], label: row[field] } : null)
      .sort((a, b) => a.key.localeCompare(b.key));
  return { orders: days('orderDay', rows), settled: days('settlementDay', rows.filter((row) => row.status === 'settled')) };
}

const pair = (vi: string, en: string): Bilingual => ({ vi, en });
function affiliateEvidence(label: Bilingual, current: number | null, unit: Evidence['unit'], currentLabel = pair('TikTok Affiliate', 'TikTok Affiliate')): Evidence {
  return { label, current, unit, currentLabel };
}

interface AffiliateReviewItem {
  id: string;
  severity: AlertSeverity;
  title: Bilingual;
  evidence: Evidence[];
  check: Bilingual;
  trace?: { field: 'productId' | 'contentId' | 'shopId' | 'orderDay'; key: string };
}

export function reviewAffiliate(rows: readonly AffiliateOrder[], dailyAlert?: AffiliateReviewItem | null) {
  const totals = summarizeAffiliate(rows);
  const issues: AffiliateReviewItem[] = [];
  if (dailyAlert) issues.push(dailyAlert);
  if (totals.pendingOrders > 0) issues.push({
    id: 'awaiting-settlement', severity: 'info',
    title: pair('Hoa hồng còn chờ quyết toán', 'Commission awaiting settlement'),
    evidence: [
      affiliateEvidence(pair('Đơn chưa quyết toán', 'Orders awaiting settlement'), totals.pendingOrders, 'count'),
      affiliateEvidence(pair('Hoa hồng dự kiến đang chờ', 'Pending estimated commission'), totals.pendingEstimated, 'vnd'),
    ],
    check: pair('Lọc Chờ xử lý và AwaitingPayment, rồi đối chiếu với bản xuất TikTok mới nhất.', 'Filter pending and AwaitingPayment rows, then compare with the latest TikTok export.'),
  });
  if (totals.status.ineligible.rows > 0) issues.push({
    id: 'ineligible', severity: 'info',
    title: pair('Có đơn không đủ điều kiện nhận hoa hồng', 'Some orders are ineligible for commission'),
    evidence: [
      affiliateEvidence(pair('Đơn không đủ điều kiện', 'Ineligible orders'), totals.status.ineligible.orders, 'count'),
      affiliateEvidence(pair('Dòng SKU không đủ điều kiện', 'Ineligible SKU rows'), totals.status.ineligible.rows, 'count'),
    ],
    check: pair('Lọc trạng thái Không đủ điều kiện và đối chiếu lý do trên TikTok Shop.', 'Filter ineligible rows and check their reasons in TikTok Shop.'),
  });
  if ((totals.refundedQuantity ?? 0) > 0) issues.push({
    id: 'refunded', severity: 'info',
    title: pair('Có sản phẩm đã hoàn tiền', 'Some units were refunded'),
    evidence: [
      affiliateEvidence(pair('Số món đã hoàn tiền', 'Refunded units'), totals.refundedQuantity, 'count'),
      affiliateEvidence(pair('Số món bán ra', 'Units sold'), totals.quantity, 'count'),
    ],
    check: pair('Mở Sản phẩm · TikTok Affiliate để xem SKU nào có số món hoàn cao.', 'Open Products · TikTok Affiliate to check which SKUs have the most refunded units.'),
  });
  if (totals.settledWithoutFinal || totals.status.unknown.rows) issues.push({
    id: 'settlement-quality', severity: 'warning',
    title: pair('Có dòng cần kiểm tra chất lượng dữ liệu quyết toán', 'Some settlement rows need verification'),
    evidence: [
      affiliateEvidence(pair('Dòng đã quyết toán thiếu số thực nhận', 'Settled rows without a final amount'), totals.settledWithoutFinal, 'count'),
      affiliateEvidence(pair('Dòng có trạng thái chưa xác định', 'Rows with unknown status'), totals.status.unknown.rows, 'count'),
    ],
    check: pair('Đối chiếu trạng thái và cột tổng tiền cuối cùng của các dòng này với báo cáo TikTok gốc.', 'Check these rows against the original TikTok settlement status and final amount.'),
  });
  const order: Record<AlertSeverity, number> = { critical: 0, warning: 1, opportunity: 2, info: 3 };
  return issues.sort((a, b) => order[a.severity] - order[b.severity]);
}

/** Weekly baseline from reported order days, following the Seller GMV alert thresholds. */
export function affiliateDailyReview(rows: readonly AffiliateOrder[], selectedDay?: string) {
  const byDay = new Map<string, AffiliateOrder[]>();
  for (const row of rows) {
    const group = byDay.get(row.orderDay);
    if (group) group.push(row);
    else byDay.set(row.orderDay, [row]);
  }
  const days = [...byDay.keys()].sort();
  const day = selectedDay && byDay.has(selectedDay) ? selectedDay : days.at(-1);
  const dailyRows = day ? byDay.get(day)! : [];
  const daily = summarizeAffiliate(dailyRows);
  const previousDays = day ? Array.from({ length: 7 }, (_, i) => byDay.get(addDays(day, -(i + 1)))) : [];
  const complete = (group: AffiliateOrder[] | undefined): group is AffiliateOrder[] =>
    !!group?.length && group.every((row) => row.gmv !== null);
  const baseline = previousDays.length && previousDays.every(complete)
    ? median(previousDays.map((group) => group.reduce((total, row) => total + row.gmv!, 0))) : null;
  const change = complete(dailyRows) && daily.gmv !== null && baseline !== null && baseline > 0
    ? (daily.gmv - baseline) / baseline : null;
  const t = DEFAULT_THRESHOLDS;
  let alert: AffiliateReviewItem | null = null;
  if (day && change !== null && (change <= -t.revenueDrop || change >= t.revenueRise)) {
    const drop = change < 0;
    alert = {
      id: `daily-affiliate-gmv-${day}`,
      trace: { field: 'orderDay', key: day },
      severity: drop ? (change <= -t.revenueDropCritical ? 'critical' : 'warning') : 'opportunity',
      title: drop ? pair('GMV Affiliate thấp hơn mức thường ngày', 'Affiliate GMV below a typical day')
        : pair('GMV Affiliate cao hơn mức thường ngày', 'Affiliate GMV above a typical day'),
      evidence: [{
        ...affiliateEvidence(pair('GMV Affiliate theo ngày đặt', 'Affiliate GMV by order date'), daily.gmv, 'vnd', pair(day, day)),
        baseline, baselineLabel: pair('Trung vị 7 ngày trước', 'Previous 7-day median'), sampleSize: daily.orders,
      }],
      check: drop ? pair('Đối chiếu GMV theo SKU và loại nội dung trong hai kỳ để xem nhóm nào giảm.', 'Compare GMV by SKU and content type to locate the decline.')
        : pair('Kiểm tra SKU và loại nội dung đóng góp vào mức tăng GMV.', 'Check which SKUs and content types contributed to the increase.'),
    };
  }
  const note = change === null ? pair('Cần GMV đầy đủ của ngày chọn và 7 ngày liền trước, với trung vị lớn hơn 0, để đánh giá biến động.', 'GMV comparison needs complete figures for the selected day and the previous seven days, with a positive median.')
    : pair(`GMV ngày chọn thay đổi ${fmtChange(change)} so với trung vị 7 ngày trước.`, `Selected-day GMV changed ${fmtChange(change, 'en')} versus the previous seven-day median.`);
  return { day, days, daily, baseline, note, alert };
}

const normalizeQuestion = (question: string) => question.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd');
export const isAffiliateQuestion = (question: string) =>
  /\baffiliate\b|hoa hong|quyet toan|khong du dieu kien|\bcommission\b/.test(normalizeQuestion(question));

export function askAffiliateDolphin(rows: readonly AffiliateOrder[], question: string, context: Bilingual, scoped = false, selectedDay?: string) {
  const q = normalizeQuestion(question);
  const diagnosis = /van de|bat thuong|rui ro|can kiem tra|phan tich|chan doan|kiem tra file|canh bao|anomal|issues|diagnos/.test(q);
  const overview = /tong quan|tom tat|tinh hinh|overview|summary/.test(q);
  if (!rows.length || (!isAffiliateQuestion(question) && (!scoped || !(diagnosis || overview ||
      /\bgmv\b|doanh so|doanh thu|ineligible|pending|hoan tien|so don|bao nhieu don|ban chay|thuc nhan/.test(q))))) return null;
  const totals = summarizeAffiliate(rows);
  const money = (value: number | null): Bilingual => ({
    vi: value === null ? 'Chưa có số liệu' : fmtMoney(value, 'vi'),
    en: value === null ? 'No data' : fmtMoney(value, 'en'),
  });
  const evidence: Evidence[] = [];
  let interpretation: Bilingual | undefined;
  let nextChecks: Bilingual[] = [];
  function add(vi: string, en: string, current: number | null, unit: Evidence['unit'] = 'vnd') {
    evidence.push(affiliateEvidence(pair(vi, en), current, unit));
  }
  let headline: Bilingual;
  const summarizeMoney = (vi: string, en: string, number: number | null) => {
    add(vi, en, number);
    const value = money(number);
    return { vi: `${vi}: ${value.vi}.`, en: `${en}: ${value.en}.` };
  };
  const isGmv = /\bgmv\b|doanh so|doanh thu/.test(q);
  const trend = /thoi gian|theo ngay|xu huong|thay doi|\btrend\b|\bgiam\b|\btut\b|\btang\b|\bdrop\b/.test(q);
  if (diagnosis || overview) {
    add('GMV Affiliate', 'Affiliate GMV', totals.gmv);
    add('Hoa hồng thực nhận', 'Final received commission', totals.finalReceived);
    add('Đơn duy nhất', 'Unique orders', totals.orders, 'count');
    const daily = affiliateDailyReview(rows, selectedDay);
    const target = /san pham|mat hang|product/.test(q) ? 'affiliate-product-yield'
      : /noi dung|video|live|content/.test(q) ? 'affiliate-content-pending'
      : /cua hang|doi tac|\bshop\b/.test(q) ? 'affiliate-shop-concentration'
      : /quyet toan|doi soat|settlement/.test(q) ? 'affiliate-settlement-validation' : null;
    const issues = target ? affiliateDeepChecks(rows).filter((item) => item.id === target)
      : reviewAffiliate(rows, daily.alert).filter((item) => item.severity !== 'opportunity');
    for (const issue of issues) evidence.push(...issue.evidence);
    headline = issues.length
      ? pair(`Dolphin tìm thấy ${issues.length} điểm cần kiểm tra trong dữ liệu TikTok Affiliate.`, `Dolphin found ${issues.length} items to review in the TikTok Affiliate data.`)
      : pair('Chưa thấy điểm cần kiểm tra trong các chỉ số đã đọc.', 'The checked metrics did not reveal any items to review.');
    interpretation = pair(
      [...issues.map(({ title }) => title.vi), daily.note.vi].join(' · '),
      [...issues.map(({ title }) => title.en), daily.note.en].join(' · '),
    );
    nextChecks = issues.map(({ check }) => check);
  } else if (/khong du dieu kien|ineligible/.test(q)) {
    const count = totals.status.ineligible;
    add('Đơn không đủ điều kiện', 'Ineligible orders', count.orders, 'count');
    add('Dòng SKU không đủ điều kiện', 'Ineligible SKU rows', count.rows, 'count');
    headline = { vi: `Có ${fmtCount(count.orders)} đơn có dòng SKU không đủ điều kiện.`, en: `${fmtCount(count.orders, 'en')} orders have ineligible SKU rows.` };
    nextChecks = [pair('Kiểm tra lý do của các dòng không đủ điều kiện trên TikTok Shop.', 'Check the ineligibility reasons for these rows in TikTok Shop.')];
  } else if (/\b(cho|chua)\b.*(quyet toan|thanh toan|xu ly|tra tien)|\bpending\b/.test(q)) {
    const estimate = summarizeMoney('Hoa hồng dự kiến đang chờ quyết toán', 'Pending estimated commission', totals.pendingEstimated);
    add('Đơn chưa quyết toán', 'Orders awaiting settlement', totals.pendingOrders, 'count');
    headline = /bao nhieu don|so don|may don|how many orders/.test(q)
      ? pair(`Có ${fmtCount(totals.pendingOrders)} đơn chưa quyết toán.`, `${fmtCount(totals.pendingOrders, 'en')} orders are awaiting settlement.`) : estimate;
  } else if (/du kien|uoc tinh|estimated/.test(q) && !trend) {
    headline = summarizeMoney('Hoa hồng dự kiến của các đơn đủ điều kiện', 'Estimated commission for eligible orders', totals.estimated);
    add('Trong đó, dự kiến đang chờ quyết toán', 'Of which, estimated commission awaiting settlement', totals.pendingEstimated);
  } else if (/quang cao|shop ads/.test(q) && !trend && /hoa hong|commission/.test(q)) {
    headline = summarizeMoney('Hoa hồng quảng cáo cửa hàng thực tế', 'Actual Shop Ads commission', totals.actualShopAds);
    interpretation = pair('Dùng cột hoa hồng quảng cáo của các dòng đã quyết toán.', 'Uses the Shop Ads commission column on settled rows.');
  } else if (/hoan tien|tra hang|refund/.test(q)) {
    add('Số món đã hoàn tiền', 'Refunded units', totals.refundedQuantity, 'count');
    add('Số món bán ra', 'Units sold', totals.quantity, 'count');
    headline = totals.refundedQuantity === null ? pair('File chưa có số món hoàn tiền.', 'The report has no refunded-unit figures.')
      : pair(`Có ${fmtCount(totals.refundedQuantity)} món đã hoàn tiền.`, `${fmtCount(totals.refundedQuantity, 'en')} units were refunded.`);
    nextChecks = [pair('Mở trang Sản phẩm để đối chiếu số món hoàn theo SKU.', 'Check refunded units by SKU on the Products page.')];
  } else if (trend) {
    const series = affiliateTimeSeries(rows);
    const metric = isGmv ? 'gmv' : 'finalReceived';
    const days = (isGmv ? series.orders : series.settled).filter((day) => day[metric] !== null);
    const last = days.at(-1);
    const baseline = last && days.find((day) => day.key === addDays(last.key, -1));
    const label = isGmv ? pair('GMV Affiliate theo ngày đặt', 'Affiliate GMV by order date') : pair('Thực nhận theo ngày quyết toán', 'Final received by settlement date');
    if (last) {
      const value = money(last[metric]);
      headline = pair(`${label.vi} ${last.key}: ${value.vi}.`, `${label.en} on ${last.key}: ${value.en}.`);
      for (const day of days.slice(-7)) add(day.label, day.label, day[metric]);
      if (baseline) {
        const earlier = money(baseline[metric]);
        const delta = baseline[metric] === 0 ? null : (last[metric]! - baseline[metric]!) / Math.abs(baseline[metric]!);
        interpretation = pair(
          `Ngày liền trước (${baseline.key}): ${earlier.vi}${delta === null ? '' : `. Thay đổi: ${fmtRate(delta)}`}. So sánh này cho thấy mức biến động theo ngày.`,
          `Previous calendar day (${baseline.key}): ${earlier.en}${delta === null ? '' : `. Change: ${fmtRate(delta, 'en')}`}. This compares the reported daily totals.`,
        );
      } else interpretation = pair('Ngày liền trước chưa có số liệu để so sánh.', 'The previous calendar day has no comparison value.');
      nextChecks = [isGmv
        ? pair('Lọc hai ngày đặt hàng để đối chiếu GMV theo SKU và loại nội dung.', 'Filter both order dates to compare GMV by SKU and content type.')
        : pair('Đối chiếu số dòng được quyết toán mỗi ngày và các đơn còn chờ thanh toán.', 'Compare the number of rows settled on each date and orders still awaiting payment.')];
    } else headline = pair('Chưa có số liệu theo ngày cho chỉ số này.', 'No daily figures are available for this metric.');
  } else if (/san pham|mat hang|sku|cua hang|shop|video|live|noi dung/.test(q)) {
    const dimension = /video|live|noi dung/.test(q) ? 'contentType' : /cua hang|shop/.test(q) ? 'shopName' : 'productName';
    const metric = isGmv ? 'gmv' : 'finalReceived';
    const groups = groupAffiliate(rows, (row) => {
      const label = row[dimension];
      const key = dimension === 'shopName' ? row.shopId || label : dimension === 'productName' ? row.productId || label : label;
      return key && label ? { key, label } : null;
    }).filter((item) => item[metric] !== null).sort((a, b) => b[metric]! - a[metric]!);
    for (const item of groups.slice(0, 5)) add(item.label, item.label, item[metric]);
    const first = groups[0];
    if (first) {
      const value = money(first[metric]);
      headline = isGmv ? pair(`${first.label} có GMV Affiliate cao nhất: ${value.vi}.`, `${first.label} has the highest Affiliate GMV: ${value.en}.`)
        : pair(`${first.label} có hoa hồng thực nhận cao nhất: ${value.vi}.`, `${first.label} has the highest final received commission: ${value.en}.`);
    } else headline = pair('Chưa có số liệu cho nhóm này.', 'No figures are available for this grouping.');
  } else if (isGmv) {
    headline = summarizeMoney('GMV Affiliate', 'Affiliate GMV', totals.gmv);
  } else if (/so don|bao nhieu don|\borders\b/.test(q)) {
    add('Đơn duy nhất', 'Unique orders', totals.orders, 'count');
    headline = pair(`Có ${fmtCount(totals.orders)} đơn Affiliate duy nhất.`, `There are ${fmtCount(totals.orders, 'en')} unique Affiliate orders.`);
  } else if (/thuc te|actual/.test(q) && !/thuc nhan|received/.test(q)) {
    headline = summarizeMoney('Hoa hồng thực tế trước điều chỉnh', 'Actual commission before adjustments', totals.actual);
    add('Hoa hồng thực nhận đã quyết toán', 'Final received commission', totals.finalReceived);
  } else if (/hoa hong|commission|thuc nhan/.test(q)) {
    headline = summarizeMoney('Hoa hồng thực nhận đã quyết toán', 'Final received commission', totals.finalReceived);
    add('Hoa hồng thực tế trước điều chỉnh', 'Actual commission before adjustments', totals.actual);
  } else return null;
  return {
    insight: headline,
    evidence,
    interpretation: {
      vi: `${context.vi}. ${interpretation?.vi ?? 'Số thực nhận lấy từ cột tổng tiền cuối cùng của các dòng đã quyết toán.'}`,
      en: `${context.en}. ${interpretation?.en ?? 'Final received comes from the final amount column on settled rows.'}`,
    },
    nextChecks: nextChecks.length ? nextChecks : [pair('Mở báo cáo TikTok Affiliate để kiểm tra theo ngày, nội dung hoặc SKU.', 'Open the TikTok Affiliate report to check by date, content or SKU.')],
  };
}

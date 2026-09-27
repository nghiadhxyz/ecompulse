/**
 * What-If simulation on the shop's REAL profit waterfall (Simulation / Estimate).
 *
 * The baseline is the actual profit of the selected scope and period. Each lever is an
 * explicit user assumption — the engine never guesses demand response: if the user
 * raises the price, volume stays the same unless they also enter a volume change.
 *
 * Scaling rules (per line of the waterfall):
 *   GMV            × (1 + price) × (1 + volume)
 *   discount       = GMV' × (discount rate + Δ discount pp)
 *   refund         × (1 + price) × (1 + volume) × (refund rate factor)
 *   COGS           × (1 + volume) × (1 + Δ COGS)            (units, not price)
 *   platform fee   = net' × (fee rate + Δ fee pp)
 *   payment / affiliate: same rate on net'
 *   shipping       × (1 + volume)
 *   ads            × (1 + Δ ads)
 *   other costs    unchanged (fixed)
 * Lines that are missing in the data stay missing and make the result partial.
 */
import type { CanonicalDataset } from './model';
import type { DatasetFilter } from './filters';
import { computeKpis } from './kpiEngine';
import { adsSummary } from './adsLiveEngine';
import { stageCancellations } from './orderHealthEngine';
import type { ProfitLineKey, ProfitResult } from './profitEngine';
import type { Bilingual } from './metric';

export interface WhatIfLevers {
  /** Price change as a ratio (0.05 = +5%). */
  price: number;
  /** Order volume change assumed by the user (ratio). */
  volume: number;
  /** Change of the seller discount rate in percentage points of GMV (0.02 = +2pp). */
  discountPp: number;
  /** COGS per unit change (ratio). */
  cogs: number;
  /** Ad spend change (ratio). */
  ads: number;
  /** Platform fee rate change in percentage points of net revenue. */
  platformFeePp: number;
}

export const NO_CHANGE: WhatIfLevers = { price: 0, volume: 0, discountPp: 0, cogs: 0, ads: 0, platformFeePp: 0 };

export interface WhatIfLine {
  key: ProfitLineKey;
  label: Bilingual;
  base: number | null;
  scenario: number | null;
}

export interface WhatIfResult {
  available: boolean;
  unavailable?: Bilingual;
  completeness: ProfitResult['completeness'] | null;
  lines: WhatIfLine[];
  base: { gmv: number | null; net: number | null; profit: number | null; margin: number | null; breakEvenRoas: number | null };
  scenario: { gmv: number | null; net: number | null; profit: number | null; margin: number | null; breakEvenRoas: number | null };
  /** Order volume change needed to keep the baseline profit under the other levers (null if impossible). */
  volumeToKeepProfit: number | null;
  notes: Bilingual[];
}

const COST_KEYS: ProfitLineKey[] = ['cogs', 'platformFee', 'paymentFee', 'affiliate', 'ads', 'shipping', 'otherCosts'];

function scenarioProfit(p: ProfitResult, lv: WhatIfLevers) {
  const amt = (k: ProfitLineKey) => p.lines.find((l) => l.key === k)?.amount ?? null;
  const gmv0 = amt('gmv');
  const disc0 = amt('sellerDiscount') ?? 0;
  const refund0 = amt('refund') ?? 0;
  const net0 = amt('netRevenue');
  if (gmv0 === null || net0 === null) return null;
  const scale = (1 + lv.price) * (1 + lv.volume);
  const gmv = gmv0 * scale;
  const discRate = gmv0 ? disc0 / gmv0 : 0;
  const disc = gmv * Math.max(0, discRate + lv.discountPp);
  const refund = refund0 * scale;
  const net = gmv - disc - refund;
  const rate = (k: ProfitLineKey) => {
    const a = amt(k);
    return a === null ? null : net0 ? a / net0 : 0;
  };
  const lines = new Map<ProfitLineKey, number | null>();
  lines.set('gmv', gmv);
  lines.set('sellerDiscount', disc);
  lines.set('refund', refund);
  lines.set('netRevenue', net);
  const cogs0 = amt('cogs');
  lines.set('cogs', cogs0 === null ? null : cogs0 * (1 + lv.volume) * (1 + lv.cogs));
  const pf = rate('platformFee');
  lines.set('platformFee', pf === null ? null : net * Math.max(0, pf + lv.platformFeePp));
  const pay = rate('paymentFee');
  lines.set('paymentFee', pay === null ? null : net * pay);
  const aff = rate('affiliate');
  lines.set('affiliate', aff === null ? null : net * aff);
  const ads0 = amt('ads');
  lines.set('ads', ads0 === null ? null : ads0 * (1 + lv.ads));
  const ship0 = amt('shipping');
  lines.set('shipping', ship0 === null ? null : ship0 * (1 + lv.volume));
  lines.set('otherCosts', amt('otherCosts'));
  const costs = COST_KEYS.map((k) => lines.get(k) ?? null);
  const profit = costs.some((c) => c === null) && p.completeness === 'insufficient' ? null : net - costs.reduce<number>((s, c) => s + (c ?? 0), 0);
  lines.set('profit', profit);
  const beforeAds = profit === null ? null : profit + (lines.get('ads') ?? 0);
  return { lines, gmv, net, profit, margin: profit !== null && net ? profit / net : null, breakEvenRoas: beforeAds && beforeAds > 0 && gmv ? gmv / beforeAds : null };
}

export function whatIf(dataset: CanonicalDataset, filter: DatasetFilter, levers: WhatIfLevers): WhatIfResult {
  const p = computeKpis(dataset, filter).profit;
  const empty = (reason: Bilingual): WhatIfResult => ({
    available: false,
    unavailable: reason,
    completeness: p?.completeness ?? null,
    lines: [],
    base: { gmv: null, net: null, profit: null, margin: null, breakEvenRoas: null },
    scenario: { gmv: null, net: null, profit: null, margin: null, breakEvenRoas: null },
    volumeToKeepProfit: null,
    notes: [],
  });
  if (!p || p.completeness === 'insufficient') return empty({ vi: 'Chưa đủ dữ liệu chi phí để mô phỏng (cần file đơn hàng và giá vốn).', en: 'Not enough cost data (orders and COGS needed).' });
  const base = scenarioProfit(p, NO_CHANGE);
  const sc = scenarioProfit(p, levers);
  if (!base || !sc) return empty({ vi: 'Không có doanh thu trong phạm vi này.', en: 'No revenue in this scope.' });

  const lines: WhatIfLine[] = p.lines.map((l) => ({ key: l.key, label: l.label, base: base.lines.get(l.key) ?? l.amount, scenario: sc.lines.get(l.key) ?? null }));

  // Volume needed to keep the baseline profit (profit is linear in volume under these rules).
  let volumeToKeepProfit: number | null = null;
  if (base.profit !== null) {
    const at0 = scenarioProfit(p, { ...levers, volume: 0 });
    const at1 = scenarioProfit(p, { ...levers, volume: 1 });
    if (at0?.profit != null && at1?.profit != null) {
      const slope = at1.profit - at0.profit;
      if (slope > 0) volumeToKeepProfit = (base.profit - at0.profit) / slope;
    }
  }

  const notes: Bilingual[] = [
    { vi: 'Đây là mô phỏng / ước tính dựa trên chi phí thực tế của kỳ đã chọn và các giả định bạn nhập — không phải dự báo.', en: 'Simulation / estimate from the period\'s actual costs and your assumptions — not a forecast.' },
    { vi: 'Số đơn không tự thay đổi khi đổi giá: nếu bạn nghĩ tăng giá sẽ làm giảm đơn, hãy nhập mức thay đổi số đơn.', en: 'Volume does not react to price unless you enter a volume change.' },
    { vi: 'Chi phí khác (cố định) được giữ nguyên.', en: 'Other (fixed) costs stay unchanged.' },
  ];
  if (p.completeness === 'partial') notes.unshift({ vi: 'Lợi nhuận gốc chưa đầy đủ (thiếu giá vốn hoặc phí) — kết quả mô phỏng cũng chưa đầy đủ.', en: 'Baseline profit is partial, so is the simulation.' });
  return {
    available: true,
    completeness: p.completeness,
    lines,
    base: { gmv: base.gmv, net: base.net, profit: base.profit, margin: base.margin, breakEvenRoas: base.breakEvenRoas },
    scenario: { gmv: sc.gmv, net: sc.net, profit: sc.profit, margin: sc.margin, breakEvenRoas: sc.breakEvenRoas },
    volumeToKeepProfit,
    notes,
  };
}

// ============================================================ SUMMARY REPORTS (no order file)

export interface SummaryWhatIfLevers {
  /** Average price change (ratio). */
  price: number;
  /** Order volume change assumed by the user (ratio). */
  volume: number;
  /** Ad spend change (ratio). */
  ads: number;
  /** Change of the cancel rate by value, in percentage points (−0.085 = 28,5% → 20%). */
  cancelPp: number;
}

export const NO_SUMMARY_CHANGE: SummaryWhatIfLevers = { price: 0, volume: 0, ads: 0, cancelPp: 0 };

/** [low, high]: extra Ads spend earns between the paid-order ROAS and the placed-order ROAS. */
export type Span = [number, number];

export interface SummaryWhatIf {
  available: boolean;
  unavailable?: Bilingual;
  /** 1: sales, orders, Ads, ROAS. 2: plus profit from the margin and fees entered in Settings (0.9). */
  level: 1 | 2;
  base: { gmv: number; orders: number; adSpend: number | null; roas: number | null; paidRoas: number | null; cancelValueRate: number | null; keptSales: number | null; profit: number | null };
  scenario: { gmv: Span; orders: Span; adSpend: number | null; roas: Span | null; cancelValueRate: number | null; keptSales: Span | null; profit: Span | null };
  /** Extra Ads spend and the sales it may bring (ceiling = the placed-order ROAS). */
  adsEffect: { spend: number; sales: Span } | null;
  /** Sales kept by the cancel-rate change alone (at the scenario's sales). */
  cancelEffect: number | null;
  notes: Bilingual[];
}

/**
 * What-If on a summary report: no COGS needed. Baseline = the period's placed-order sales,
 * orders, Ads spend and cancel rate by value (canonical sources, 0.3).
 *   sales      × (1 + price) × (1 + volume), plus extra Ads spend × [paid ROAS ; placed ROAS]
 *   orders     × (1 + volume), plus extra Ads sales ÷ AOV
 *   kept sales = sales × (1 − cancel rate by value) − refunds (scaled like sales)
 *   profit     = kept sales × (gross margin − fees) − Ads spend      (level 2, estimate)
 * The upper end of the Ads range assumes every extra đồng earns today's average ROAS — a ceiling.
 */
export function summaryWhatIf(dataset: CanonicalDataset, filter: DatasetFilter, lv: SummaryWhatIfLevers): SummaryWhatIf {
  const f: DatasetFilter = { ...filter, stage: 'placed' };
  const m = computeKpis(dataset, f).metrics;
  const gmv = m.gmv.value;
  const orders = m.orders.value;
  const empty = (reason: Bilingual): SummaryWhatIf => ({
    available: false,
    unavailable: reason,
    level: 1,
    base: { gmv: 0, orders: 0, adSpend: null, roas: null, paidRoas: null, cancelValueRate: null, keptSales: null, profit: null },
    scenario: { gmv: [0, 0], orders: [0, 0], adSpend: null, roas: null, cancelValueRate: null, keptSales: null, profit: null },
    adsEffect: null,
    cancelEffect: null,
    notes: [],
  });
  if (gmv === null || orders === null || gmv <= 0) return empty({ vi: 'Không có doanh số trong khoảng này.', en: 'No sales in this range.' });

  const ads = adsSummary(dataset, f);
  const spend0 = ads.available && ads.totals.spend > 0 ? ads.totals.spend : null;
  const roas0 = spend0 !== null ? ads.totals.roas : null;
  const paidRoas0 = spend0 !== null ? ads.totals.paidRoas : null;
  const cancel = stageCancellations(dataset, f);
  const cancel0 = cancel.valueRate;
  // Refunds of the same orders: net revenue = sales − cancelled sales − refunds (kpiEngine).
  const refundGmv = m.netRevenue.value !== null && cancel.cancelledGmv !== null ? Math.max(0, gmv - cancel.cancelledGmv - m.netRevenue.value) : 0;

  const settings = dataset.costSettings;
  const margin = settings?.estimatedGrossMargin !== undefined ? settings.estimatedGrossMargin - (settings.estimatedFeeRate ?? 0) : null;
  const level: 1 | 2 = margin !== null ? 2 : 1;

  const scale = (1 + lv.price) * (1 + lv.volume);
  const aov = gmv / (orders || 1);
  const extraSpend = spend0 !== null ? spend0 * lv.ads : 0;
  const lowRoas = Math.min(paidRoas0 ?? roas0 ?? 0, roas0 ?? 0);
  const highRoas = roas0 ?? 0;
  const extraSales: Span = extraSpend >= 0 ? [extraSpend * lowRoas, extraSpend * highRoas] : [extraSpend * highRoas, extraSpend * lowRoas];
  const gmvS: Span = [gmv * scale + extraSales[0], gmv * scale + extraSales[1]];
  const ordersS: Span = [orders * (1 + lv.volume) + extraSales[0] / (aov * (1 + lv.price)), orders * (1 + lv.volume) + extraSales[1] / (aov * (1 + lv.price))];
  const spendS = spend0 !== null ? spend0 + extraSpend : null;
  const cancelS = cancel0 !== null ? Math.min(1, Math.max(0, cancel0 + lv.cancelPp)) : null;
  const kept = (g: number, c: number | null) => (c === null ? null : g * (1 - c) - refundGmv * scale);
  const keptBase = kept(gmv, cancel0);
  const keptS: Span | null = cancelS === null ? null : [kept(gmvS[0], cancelS)!, kept(gmvS[1], cancelS)!];
  const profit = (k: number | null, s: number | null) => (margin === null || k === null ? null : k * margin - (s ?? 0));
  // ROAS as a range: paid-order ROAS to placed-order ROAS (the ceiling, 10.2).
  const roasS: Span | null = spendS && roas0 !== null ? [lowRoas, highRoas] : null;

  const notes: Bilingual[] = [
    { vi: 'Mô phỏng trên báo cáo tổng hợp của kỳ đã chọn (đơn đặt) và các giả định bạn nhập — không phải dự báo.', en: 'Simulation on the summary report (placed orders) and your assumptions — not a forecast.' },
    { vi: 'Số đơn không tự thay đổi khi đổi giá: nếu bạn nghĩ tăng giá sẽ làm giảm đơn, hãy nhập mức thay đổi số đơn.', en: 'Volume does not react to price unless you enter a volume change.' },
  ];
  if (spend0 !== null && lv.ads !== 0) {
    notes.push({
      vi: `Doanh số thêm từ Ads là một khoảng: đầu thấp theo ROAS đơn đã thanh toán (${(paidRoas0 ?? lowRoas).toFixed(2).replace('.', ',')}x), đầu cao theo ROAS đơn đặt (${highRoas.toFixed(2).replace('.', ',')}x) — mức trần, vì đồng Ads thêm thường kém hiệu quả hơn mức trung bình.`,
      en: 'Extra Ads sales are a range from paid-order ROAS to placed-order ROAS (a ceiling).',
    });
  }
  if (level === 2) notes.push({ vi: 'Lợi nhuận: ước tính theo số bạn nhập (biên gộp − phí sàn ở Cài đặt), trừ chi phí Ads.', en: 'Profit: estimate from your margin and fee inputs, minus Ads.' });
  else notes.push({ vi: 'Nhập "Biên lợi nhuận gộp ước tính" và "Phí sàn" ở Cài đặt để xem lợi nhuận ước tính.', en: 'Enter a gross margin and fees in Settings for an estimated profit.' });

  return {
    available: true,
    level,
    base: { gmv, orders, adSpend: spend0, roas: roas0, paidRoas: paidRoas0, cancelValueRate: cancel0, keptSales: keptBase, profit: profit(keptBase, spend0) },
    scenario: {
      gmv: gmvS,
      orders: ordersS,
      adSpend: spendS,
      roas: roasS,
      cancelValueRate: cancelS,
      keptSales: keptS,
      profit: keptS ? [profit(keptS[0], spendS)!, profit(keptS[1], spendS)!] : null,
    },
    adsEffect: spend0 !== null && lv.ads !== 0 ? { spend: extraSpend, sales: extraSales } : null,
    cancelEffect: cancelS !== null && lv.cancelPp !== 0 ? -lv.cancelPp * gmvS[0] : null,
    notes,
  };
}

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

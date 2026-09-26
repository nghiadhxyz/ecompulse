/**
 * Root Cause Engine — deterministic "what changed → where → what contributed → what to check".
 *
 * Every metric is written as Σnumerator / Σdenominator over members of a dimension
 * (additive metrics have denominator 1). The contribution of member i to the change of
 * the aggregate is
 *
 *     c_i = num1_i / DEN1 − num0_i / DEN0
 *
 * which sums EXACTLY to the total change, for amounts and for rates alike (it includes
 * both the member's own change and its mix effect). The tree follows the member that
 * explains most of the change in the direction of the total, level by level.
 *
 * Wording: contribution is not causation. Nodes are labelled main contributor /
 * contributing / offsetting — the engine never labels anything a proven cause.
 */
import type { CanonicalDataset, Platform } from './model';
import type { DatasetFilter } from './filters';
import { breakdown, NONE_KEY, type BreakdownDimension, type BreakdownRow, type MemberMetrics } from './breakdownEngine';
import { computeKpis } from './kpiEngine';
import { funnel } from './funnelEngine';
import type { DateRange } from './period';
import type { Bilingual, MetricUnit } from './metric';
import type { EvidenceFilter } from './evidence';

export type RootCauseMetric = 'gmv' | 'orders' | 'profit' | 'cancelRate' | 'refundRate' | 'aov' | 'margin' | 'cvr';

export const ROOT_CAUSE_METRICS: Record<RootCauseMetric, { label: Bilingual; unit: MetricUnit; goodWhenUp: boolean }> = {
  gmv: { label: { vi: 'GMV', en: 'GMV' }, unit: 'vnd', goodWhenUp: true },
  orders: { label: { vi: 'Số đơn', en: 'Orders' }, unit: 'count', goodWhenUp: true },
  profit: { label: { vi: 'Lợi nhuận đóng góp', en: 'Contribution profit' }, unit: 'vnd', goodWhenUp: true },
  cancelRate: { label: { vi: 'Tỷ lệ hủy', en: 'Cancel rate' }, unit: 'ratio', goodWhenUp: false },
  refundRate: { label: { vi: 'Tỷ lệ trả/hoàn', en: 'Refund rate' }, unit: 'ratio', goodWhenUp: false },
  aov: { label: { vi: 'AOV', en: 'AOV' }, unit: 'vnd', goodWhenUp: true },
  margin: { label: { vi: 'Margin', en: 'Margin' }, unit: 'ratio', goodWhenUp: true },
  cvr: { label: { vi: 'CVR', en: 'CVR' }, unit: 'ratio', goodWhenUp: true },
};

/** numerator / denominator of a metric for one member. */
function parts(m: MemberMetrics | null, metric: RootCauseMetric): { num: number; den: number } | null {
  if (!m) return { num: 0, den: 0 };
  switch (metric) {
    case 'gmv':
      return { num: m.gmv, den: 1 };
    case 'orders':
      return { num: m.placed, den: 1 };
    case 'profit':
      return m.profit === null ? null : { num: m.profit, den: 1 };
    case 'cancelRate':
      return { num: m.cancelled, den: m.placed };
    case 'refundRate':
      return { num: m.returned, den: m.valid };
    case 'aov':
      return { num: m.gmv, den: m.valid };
    case 'margin':
      return m.profit === null || m.netRevenue === null ? null : { num: m.profit, den: m.netRevenue };
    case 'cvr':
      return m.clicks === null ? null : { num: m.placed, den: m.clicks };
  }
}

export type NodeRole = 'main' | 'contributing' | 'minor' | 'offsetting';

export interface RootCauseNode {
  dimension: BreakdownDimension;
  key: string;
  label: string;
  /** Member's own metric value in each period. */
  current: number | null;
  previous: number | null;
  /** Contribution to the aggregate change (in the metric's unit; ×100 = pp for rates). */
  contribution: number;
  /** contribution ÷ total change of the parent level. */
  share: number | null;
  role: NodeRole;
  evidence: EvidenceFilter | null;
  children: RootCauseLevel[];
}

export interface RootCauseLevel {
  dimension: BreakdownDimension;
  nodes: RootCauseNode[];
}

export interface DriverStep {
  key: 'traffic' | 'conversion' | 'retention' | 'basket';
  label: Bilingual;
  previous: number | null;
  current: number | null;
  /** GMV change attributed to this driver (log/LMDI decomposition). */
  contribution: number | null;
}

export interface RootCauseResult {
  metric: RootCauseMetric;
  unit: MetricUnit;
  current: number | null;
  previous: number | null;
  change: number | null;
  /** Main path: level → member followed down the hierarchy. */
  tree: RootCauseLevel[];
  /** Where the main leaf concentrates: campaign, live, channel, day. */
  concentration: RootCauseLevel[];
  /** GMV = traffic × CVR × retention × AOV (only for GMV, when traffic data exists). */
  drivers: DriverStep[] | null;
  path: { dimension: BreakdownDimension; label: string; contribution: number; share: number | null }[];
  unavailable?: Bilingual;
  notes: Bilingual[];
}

const HIERARCHY: BreakdownDimension[] = ['platform', 'category', 'subcategory', 'sku'];
const CONCENTRATION: BreakdownDimension[] = ['campaign', 'liveSession', 'channel', 'day'];

function narrow(filter: DatasetFilter, dim: BreakdownDimension, key: string): DatasetFilter | null {
  if (key === NONE_KEY) return null;
  switch (dim) {
    case 'platform':
      return { ...filter, platforms: [key as Platform] };
    case 'category':
      return { ...filter, categories: [key] };
    case 'subcategory':
      return { ...filter, subcategories: [key] };
    case 'sku':
      return { ...filter, skus: [key] };
    case 'combo':
      return { ...filter, comboIds: [key] };
    case 'campaign':
      return { ...filter, campaignIds: [key] };
    case 'liveSession':
      return { ...filter, liveSessionIds: [key] };
    default:
      return null;
  }
}

function evidenceFor(dataset: CanonicalDataset, filter: DatasetFilter, metric: RootCauseMetric): EvidenceFilter {
  // EvidenceFilter speaks SKUs; category / niche filters are expanded to their SKUs.
  let skus = filter.skus;
  if (!skus && (filter.categories?.length || filter.subcategories?.length)) {
    skus = dataset.products
      .filter((p) => (!filter.categories?.length || filter.categories.includes(p.category ?? '')) && (!filter.subcategories?.length || filter.subcategories.includes(p.subcategory ?? '')))
      .map((p) => p.sku);
  }
  return {
    range: filter.range,
    platforms: filter.platforms,
    skus,
    campaignId: filter.campaignIds?.[0],
    liveSessionId: filter.liveSessionIds?.[0],
    cancelledOnly: metric === 'cancelRate' ? true : undefined,
    returnedOnly: metric === 'refundRate' ? true : undefined,
  };
}

function roleOf(contribution: number, total: number): { role: NodeRole; share: number | null } {
  if (Math.abs(total) < 1e-12) return { role: 'minor', share: null };
  const share = contribution / total;
  if (share < 0) return { role: 'offsetting', share };
  if (share >= 0.5) return { role: 'main', share };
  if (share >= 0.15) return { role: 'contributing', share };
  return { role: 'minor', share };
}

function levelNodes(
  dataset: CanonicalDataset,
  filter: DatasetFilter,
  previousRange: DateRange,
  dim: BreakdownDimension,
  metric: RootCauseMetric,
  totalChange: number,
  lang: 'vi' | 'en',
): RootCauseNode[] | null {
  const b = breakdown(dataset, filter, dim, previousRange, lang);
  if (b.unavailable || b.rows.length === 0) return null;
  const denoms = (rows: BreakdownRow[], which: 'current' | 'previous') => {
    let den = 0;
    for (const r of rows) {
      const p = parts(which === 'current' ? r.current : r.previous, metric);
      if (!p) return null;
      den += p.den;
    }
    return den;
  };
  // Additive metrics (GMV, orders, profit) have one shared denominator of 1, not one per member.
  const additive = metric === 'gmv' || metric === 'orders' || metric === 'profit';
  const D1 = additive ? (b.rows.every((r) => parts(r.current, metric)) ? 1 : null) : denoms(b.rows, 'current');
  const D0 = additive ? (b.rows.every((r) => parts(r.previous, metric)) ? 1 : null) : denoms(b.rows, 'previous');
  if (D1 === null || D0 === null || D1 === 0 || D0 === 0) return null;
  const nodes = b.rows.map((r) => {
    const p1 = parts(r.current, metric)!;
    const p0 = parts(r.previous, metric)!;
    const contribution = p1.num / D1 - p0.num / D0;
    const { role, share } = roleOf(contribution, totalChange);
    const f = narrow(filter, dim, r.key);
    return {
      dimension: dim,
      key: r.key,
      label: r.label,
      current: p1.den ? p1.num / p1.den : null,
      previous: p0.den ? p0.num / p0.den : null,
      contribution,
      share,
      role,
      evidence: f ? evidenceFor(dataset, f, metric) : null,
      children: [],
    } as RootCauseNode;
  });
  // Largest movers in the direction of the total first; then the offsetting ones.
  const dir = Math.sign(totalChange) || 1;
  nodes.sort((a, b2) => b2.contribution * dir - a.contribution * dir);
  return nodes;
}

function aggregate(dataset: CanonicalDataset, filter: DatasetFilter, metric: RootCauseMetric): number | null {
  const m = computeKpis(dataset, filter).metrics;
  switch (metric) {
    case 'gmv':
      return m.gmv.value;
    case 'orders':
      return m.orders.value;
    case 'profit':
      return m.profit.value;
    case 'cancelRate':
      return m.cancelRate.value;
    case 'refundRate':
      return m.refundRate.value;
    case 'aov':
      return m.aov.value;
    case 'margin':
      return m.margin.value;
    case 'cvr':
      return m.cvr.value;
  }
}

function gmvDrivers(dataset: CanonicalDataset, filter: DatasetFilter, previousRange: DateRange): DriverStep[] | null {
  const f1 = funnel(dataset, filter);
  const f0 = funnel(dataset, { ...filter, range: previousRange });
  const g1 = computeKpis(dataset, filter).metrics.gmv.value;
  const g0 = computeKpis(dataset, { ...filter, range: previousRange }).metrics.gmv.value;
  const c1 = f1.stages.clicks;
  const c0 = f0.stages.clicks;
  const o1 = f1.stages.orders;
  const o0 = f0.stages.orders;
  const v1 = o1 !== null ? o1 - (computeKpis(dataset, filter).metrics.cancelledOrders.value ?? 0) : null;
  const v0 = o0 !== null ? o0 - (computeKpis(dataset, { ...filter, range: previousRange }).metrics.cancelledOrders.value ?? 0) : null;
  if (!g1 || !g0 || !c1 || !c0 || !o1 || !o0 || !v1 || !v0) return null;
  const factors: [DriverStep['key'], Bilingual, number, number][] = [
    ['traffic', { vi: 'Traffic (lượt nhấp sản phẩm)', en: 'Traffic (product clicks)' }, c0, c1],
    ['conversion', { vi: 'Chuyển đổi (đơn đặt / lượt nhấp)', en: 'Conversion (orders / clicks)' }, o0 / c0, o1 / c1],
    ['retention', { vi: 'Giữ đơn (đơn không hủy / đơn đặt)', en: 'Retention (valid / placed)' }, v0 / o0, v1 / o1],
    ['basket', { vi: 'Giá trị đơn (GMV / đơn hợp lệ)', en: 'Basket (GMV / valid order)' }, g0 / v0, g1 / v1],
  ];
  // LMDI: ΔG · ln(x1/x0) / ln(G1/G0) — sums exactly to ΔG.
  const lg = Math.log(g1 / g0);
  const dG = g1 - g0;
  return factors.map(([key, label, x0, x1]) => ({
    key,
    label,
    previous: x0,
    current: x1,
    contribution: Math.abs(lg) < 1e-12 ? 0 : (dG * Math.log(x1 / x0)) / lg,
  }));
}

export function rootCause(
  dataset: CanonicalDataset,
  filter: DatasetFilter,
  previousRange: DateRange,
  metric: RootCauseMetric,
  lang: 'vi' | 'en' = 'vi',
  maxDepth = 4,
): RootCauseResult {
  const spec = ROOT_CAUSE_METRICS[metric];
  const notes: Bilingual[] = [];
  const empty = (reason: Bilingual): RootCauseResult => ({ metric, unit: spec.unit, current: null, previous: null, change: null, tree: [], concentration: [], drivers: null, path: [], unavailable: reason, notes });
  if (dataset.orders.length === 0) return empty({ vi: 'Cần file xuất đơn hàng để phân rã thay đổi.', en: 'An order export is required.' });
  const current = aggregate(dataset, filter, metric);
  const previous = aggregate(dataset, { ...filter, range: previousRange }, metric);
  if (current === null || previous === null) {
    return empty(
      metric === 'profit' || metric === 'margin'
        ? { vi: 'Không đủ dữ liệu: thiếu giá vốn hoặc kỳ so sánh.', en: 'Insufficient data: COGS or comparison period missing.' }
        : metric === 'cvr'
          ? { vi: 'Không đủ dữ liệu: cần traffic (lượt nhấp sản phẩm) ở cả hai kỳ.', en: 'Needs product clicks in both periods.' }
          : { vi: 'Kỳ so sánh chưa có dữ liệu.', en: 'No data for the comparison period.' },
    );
  }
  const change = current - previous;
  const tiny = spec.unit === 'ratio' ? Math.abs(change) < 0.002 : Math.abs(previous) > 0 && Math.abs(change / previous) < 0.01;
  if (tiny) {
    notes.push({
      vi: 'Thay đổi rất nhỏ (dưới 0,2 điểm % hoặc 1%) — các con số dưới đây chủ yếu phản ánh dao động giữa các nhóm bù trừ nhau, không nên xem là có vấn đề.',
      en: 'The change is very small — the breakdown mostly shows offsetting noise between groups.',
    });
  }

  // Main path down the hierarchy.
  const tree: RootCauseLevel[] = [];
  const path: RootCauseResult['path'] = [];
  let f: DatasetFilter = filter;
  let parentChange = change;
  let lastFilter = filter;
  let levels = 0;
  for (const dim of HIERARCHY) {
    if (levels >= maxDepth) break;
    const nodes = levelNodes(dataset, f, previousRange, dim, metric, parentChange, lang);
    if (!nodes) continue;
    // Contributions at a narrowed level are relative to that subset's own aggregate.
    tree.push({ dimension: dim, nodes });
    levels++;
    const top = nodes[0];
    if (!top || top.key === NONE_KEY || Math.abs(top.contribution) < 1e-12 || Math.sign(top.contribution) !== Math.sign(parentChange || 1)) break;
    path.push({ dimension: dim, label: top.label, contribution: top.contribution, share: top.share });
    const next = narrow(f, dim, top.key);
    if (!next) break;
    lastFilter = next;
    f = next;
    // Re-base: the change of the chosen member's own metric becomes the next level's total.
    const c1 = aggregate(dataset, next, metric);
    const c0 = aggregate(dataset, { ...next, range: previousRange }, metric);
    if (c1 === null || c0 === null) break;
    parentChange = c1 - c0;
    if (Math.abs(parentChange) < 1e-12) break;
  }

  // Where the leaf's change concentrates (campaign / live / channel / day).
  const concentration: RootCauseLevel[] = [];
  if (path.length > 0) {
    for (const dim of CONCENTRATION) {
      const nodes = levelNodes(dataset, lastFilter, previousRange, dim, metric, parentChange, lang);
      if (nodes && nodes.length > 1) concentration.push({ dimension: dim, nodes: nodes.slice(0, 5) });
    }
  }
  if (tree.length > 1) {
    notes.push({
      vi: 'Mỗi tầng phân rã thay đổi của nhóm được chọn ở tầng trên (con số ở tầng dưới cộng lại bằng thay đổi của nhóm cha).',
      en: 'Each level decomposes the change of the member chosen above it.',
    });
  }
  if ((metric === 'profit' || metric === 'margin') && tree.length > 0) {
    notes.push({
      vi: 'Chi phí chung (lương, thuê kho…) không phân bổ theo sàn/ngành, nên tổng đóng góp của các nhóm có thể chênh với thay đổi lợi nhuận toàn shop đúng bằng phần thay đổi của chi phí chung.',
      en: 'Overheads are not allocated to groups, so group contributions differ from the shop total by the overhead change.',
    });
  }
  if (['cancelRate', 'refundRate', 'aov', 'cvr'].includes(metric) && tree.some((l) => l.dimension !== 'platform')) {
    notes.push({
      vi: 'Ở tầng ngành/nhóm/SKU, đơn có nhiều sản phẩm được tính cho mỗi nhóm nên tổng đóng góp có thể lệch nhẹ so với thay đổi chung.',
      en: 'At category/niche/SKU level, multi-item orders count for each group, so contributions may not add up exactly.',
    });
  }
  notes.push({
    vi: 'Đây là phân rã đóng góp: cho biết thay đổi NẰM Ở ĐÂU, không chứng minh NGUYÊN NHÂN. Hãy kiểm tra các yếu tố đi cùng (giá, tồn kho, Ads, lý do hủy) trước khi kết luận.',
    en: 'This is a contribution breakdown: it shows WHERE the change is, not WHY.',
  });

  return {
    metric,
    unit: spec.unit,
    current,
    previous,
    change,
    tree,
    concentration,
    drivers: metric === 'gmv' ? gmvDrivers(dataset, filter, previousRange) : null,
    path,
    notes,
  };
}

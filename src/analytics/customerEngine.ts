/**
 * Customer Intelligence — only when orders carry a customer identifier.
 *
 * Identifiers are pseudonymous (hashed on import); names, phones and addresses are never
 * read. The same person on two platforms has two different IDs, so every figure is
 * "customers per platform account", which the UI states.
 *
 * - New vs returning: returning = a valid order before the range start. With less than
 *   90 days of history before the range, "new" may include older customers (noted).
 * - RFM as of the range end over all history up to that day: R = days since last valid
 *   order (score by quintile, recent = 5), F = valid orders (1 → 1, 2 → 3, 3 → 4, 4+ → 5),
 *   M = GMV (quintile). Segments use common, readable rules.
 * - Monthly cohorts: share of a month's first-time customers who order again in later months.
 */
import type { CanonicalDataset, Platform } from './model';
import { getDatasetIndex } from './filters';
import { isValidOrder } from './status';
import { addDays, isInRange, toDayNumber, type DateRange } from './period';
import type { Bilingual } from './metric';

export type RfmSegment = 'champions' | 'loyal' | 'potential' | 'new' | 'need_attention' | 'at_risk' | 'hibernating';

export const RFM_SEGMENTS: Record<RfmSegment, { label: Bilingual; hint: Bilingual }> = {
  champions: { label: { vi: 'Khách tốt nhất', en: 'Champions' }, hint: { vi: 'Mua gần đây, mua nhiều lần', en: 'Recent and frequent' } },
  loyal: { label: { vi: 'Trung thành', en: 'Loyal' }, hint: { vi: 'Mua nhiều lần, chưa quay lại gần đây', en: 'Frequent, less recent' } },
  potential: { label: { vi: 'Tiềm năng', en: 'Potential' }, hint: { vi: 'Mua gần đây, 2–3 đơn', en: 'Recent, 2–3 orders' } },
  new: { label: { vi: 'Khách mới', en: 'New' }, hint: { vi: 'Mua lần đầu gần đây', en: 'First order, recent' } },
  need_attention: { label: { vi: 'Cần chú ý', en: 'Need attention' }, hint: { vi: 'Ở mức trung bình', en: 'Middle of the pack' } },
  at_risk: { label: { vi: 'Có nguy cơ rời đi', en: 'At risk' }, hint: { vi: 'Từng mua nhiều, lâu chưa quay lại', en: 'Used to buy often, gone quiet' } },
  hibernating: { label: { vi: 'Ngủ đông', en: 'Hibernating' }, hint: { vi: 'Ít mua, lâu chưa quay lại', en: 'Few orders, long ago' } },
};

export interface CustomerFacts {
  customerId: string;
  platform: Platform;
  firstOrder: string;
  lastOrder: string;
  orders: number;
  gmv: number;
  recencyDays: number;
  r: number;
  f: number;
  m: number;
  segment: RfmSegment;
}

export interface SegmentRow {
  segment: RfmSegment;
  customers: number;
  share: number;
  gmv: number;
  gmvShare: number;
  avgOrders: number;
  avgRecency: number;
  customerIds: string[];
}

export interface CohortRow {
  cohort: string;
  customers: number;
  /** retention[k] = share of the cohort ordering in month cohort + k (k ≥ 1). */
  retention: (number | null)[];
}

export interface CustomerIntelligence {
  available: boolean;
  unavailable?: Bilingual;
  coverage: number;
  inRange: {
    customers: number;
    newCustomers: number;
    returningCustomers: number;
    returningGmvShare: number | null;
    repeatWithinRange: number | null;
    ordersPerCustomer: number | null;
    gmvPerCustomer: number | null;
  };
  segments: SegmentRow[];
  cohorts: CohortRow[];
  byPlatform: { platform: Platform; customers: number; returningShare: number | null }[];
  notes: Bilingual[];
}

const MIN_COVERAGE = 0.8;

function quintileScore(values: number[], v: number, higherIsBetter: boolean): number {
  // values sorted ascending
  let lo = 0;
  let hi = values.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (values[mid] < v) lo = mid + 1;
    else hi = mid;
  }
  const pct = values.length > 1 ? lo / (values.length - 1) : 0.5;
  const q = Math.min(5, Math.floor(pct * 5) + 1);
  return higherIsBetter ? q : 6 - q;
}

function segmentOf(r: number, f: number): RfmSegment {
  if (r >= 4 && f >= 4) return 'champions';
  if (f >= 4) return r >= 3 ? 'loyal' : 'at_risk';
  if (r >= 4 && f >= 3) return 'potential';
  if (r >= 4 && f === 1) return 'new';
  if (r <= 2 && f >= 3) return 'at_risk';
  if (r <= 2) return 'hibernating';
  return 'need_attention';
}

export function customerIntelligence(dataset: CanonicalDataset, filter: { range: DateRange; platforms?: Platform[] }): CustomerIntelligence {
  const notes: Bilingual[] = [];
  const empty = (reason: Bilingual, coverage = 0): CustomerIntelligence => ({
    available: false,
    unavailable: reason,
    coverage,
    inRange: { customers: 0, newCustomers: 0, returningCustomers: 0, returningGmvShare: null, repeatWithinRange: null, ordersPerCustomer: null, gmvPerCustomer: null },
    segments: [],
    cohorts: [],
    byPlatform: [],
    notes: [],
  });
  if (dataset.orders.length === 0) return empty({ vi: 'Cần file xuất đơn hàng có mã người mua.', en: 'An order export with buyer IDs is required.' });

  const index = getDatasetIndex(dataset);
  const plat = filter.platforms?.length ? new Set(filter.platforms) : null;
  const valid = dataset.orders.filter((o) => isValidOrder(o.status) && o.orderDate <= filter.range.end && (!plat || plat.has(o.platform)));
  const inRange = valid.filter((o) => isInRange(o.orderDate, filter.range));
  const withId = inRange.filter((o) => o.customerId).length;
  const coverage = inRange.length ? withId / inRange.length : 0;
  if (inRange.length === 0) return empty({ vi: 'Không có đơn hợp lệ trong khoảng này.', en: 'No valid orders in range.' });
  if (coverage < MIN_COVERAGE) {
    return empty(
      { vi: `Chỉ ${Math.round(coverage * 100)}% đơn có mã người mua (cần ≥ 80%). File xuất của sàn cần có cột "Người mua"/"Buyer username" — EcomPulse chỉ lưu mã đã băm.`, en: `Only ${Math.round(coverage * 100)}% of orders carry a buyer ID (≥ 80% needed).` },
      coverage,
    );
  }

  const gmvOf = (orderId: string) => (index.linesByOrder.get(orderId) ?? []).reduce((s, l) => s + l.grossAmount, 0);
  const byCustomer = new Map<string, { platform: Platform; dates: string[]; gmv: number; gmvInRange: number; ordersInRange: number }>();
  for (const o of valid) {
    if (!o.customerId) continue;
    const key = `${o.platform}|${o.customerId}`;
    const c = byCustomer.get(key) ?? { platform: o.platform, dates: [], gmv: 0, gmvInRange: 0, ordersInRange: 0 };
    const g = gmvOf(o.orderId);
    c.dates.push(o.orderDate);
    c.gmv += g;
    if (isInRange(o.orderDate, filter.range)) {
      c.gmvInRange += g;
      c.ordersInRange += 1;
    }
    byCustomer.set(key, c);
  }

  // In-range new vs returning
  let customers = 0;
  let newC = 0;
  let returningC = 0;
  let repeatC = 0;
  let gmvIn = 0;
  let gmvReturning = 0;
  let ordersIn = 0;
  const platStats = new Map<Platform, { customers: number; returning: number }>();
  for (const c of byCustomer.values()) {
    if (c.ordersInRange === 0) continue;
    customers++;
    ordersIn += c.ordersInRange;
    gmvIn += c.gmvInRange;
    const returning = c.dates.some((d) => d < filter.range.start);
    if (returning) {
      returningC++;
      gmvReturning += c.gmvInRange;
    } else newC++;
    if (c.ordersInRange >= 2) repeatC++;
    const ps = platStats.get(c.platform) ?? { customers: 0, returning: 0 };
    ps.customers++;
    if (returning) ps.returning++;
    platStats.set(c.platform, ps);
  }

  // RFM over customers active at any time up to range end
  const endN = toDayNumber(filter.range.end);
  const facts: CustomerFacts[] = [];
  for (const [key, c] of byCustomer) {
    c.dates.sort();
    facts.push({
      customerId: key.split('|')[1],
      platform: c.platform,
      firstOrder: c.dates[0],
      lastOrder: c.dates[c.dates.length - 1],
      orders: c.dates.length,
      gmv: c.gmv,
      recencyDays: endN - toDayNumber(c.dates[c.dates.length - 1]),
      r: 0,
      f: 0,
      m: 0,
      segment: 'need_attention',
    });
  }
  const recSorted = facts.map((x) => x.recencyDays).sort((a, b) => a - b);
  const monSorted = facts.map((x) => x.gmv).sort((a, b) => a - b);
  for (const x of facts) {
    x.r = quintileScore(recSorted, x.recencyDays, false);
    x.f = x.orders >= 4 ? 5 : x.orders === 3 ? 4 : x.orders === 2 ? 3 : 1;
    x.m = quintileScore(monSorted, x.gmv, true);
    x.segment = segmentOf(x.r, x.f);
  }
  const totalGmv = facts.reduce((s, x) => s + x.gmv, 0);
  const segments: SegmentRow[] = (Object.keys(RFM_SEGMENTS) as RfmSegment[])
    .map((segment) => {
      const xs = facts.filter((x) => x.segment === segment);
      const gmv = xs.reduce((s, x) => s + x.gmv, 0);
      return {
        segment,
        customers: xs.length,
        share: facts.length ? xs.length / facts.length : 0,
        gmv,
        gmvShare: totalGmv ? gmv / totalGmv : 0,
        avgOrders: xs.length ? xs.reduce((s, x) => s + x.orders, 0) / xs.length : 0,
        avgRecency: xs.length ? xs.reduce((s, x) => s + x.recencyDays, 0) / xs.length : 0,
        customerIds: xs.map((x) => x.customerId),
      };
    })
    .filter((s) => s.customers > 0);

  // Monthly cohorts (first order month)
  const monthsOf = (d: string) => d.slice(0, 7);
  const cohortMap = new Map<string, { members: Set<string>; activeByMonth: Map<string, Set<string>> }>();
  for (const [key, c] of byCustomer) {
    const first = monthsOf(c.dates[0]);
    const entry = cohortMap.get(first) ?? { members: new Set(), activeByMonth: new Map() };
    entry.members.add(key);
    for (const d of c.dates) {
      const m = monthsOf(d);
      if (m === first) continue;
      const set = entry.activeByMonth.get(m) ?? new Set();
      set.add(key);
      entry.activeByMonth.set(m, set);
    }
    cohortMap.set(first, entry);
  }
  const allMonths = [...new Set(valid.map((o) => monthsOf(o.orderDate)))].sort();
  const lastMonth = monthsOf(filter.range.end);
  const monthIdx = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7));
  const cohorts: CohortRow[] = [...cohortMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cohort, e]) => {
      const span = monthIdx(lastMonth) - monthIdx(cohort);
      const retention: (number | null)[] = [];
      for (let k = 1; k <= Math.min(span, 6); k++) {
        const m = allMonths.find((x) => monthIdx(x) === monthIdx(cohort) + k);
        retention.push(m ? (e.activeByMonth.get(m)?.size ?? 0) / e.members.size : 0);
      }
      return { cohort, customers: e.members.size, retention };
    });

  const dataStart = valid.reduce((m, o) => (o.orderDate < m ? o.orderDate : m), filter.range.end);
  if (toDayNumber(filter.range.start) - toDayNumber(dataStart) < 90) {
    notes.push({
      vi: `Dữ liệu chỉ có từ ${dataStart} — chưa đủ 90 ngày trước kỳ phân tích, nên "khách mới" có thể gồm cả khách cũ đã mua trước thời điểm đó.`,
      en: `History starts ${dataStart}; "new" may include older customers.`,
    });
  }
  if (cohorts.length > 0) notes.push({ vi: 'Tháng đầu tiên trong dữ liệu gồm cả khách cũ (không biết lần mua trước đó) — cohort đầu tiên không phải khách mới thật sự.', en: 'The first cohort mixes in older customers.' });
  notes.push({ vi: 'Mã khách hàng là mã ẩn danh theo từng sàn: cùng một người trên hai sàn được tính là hai khách.', en: 'Customer IDs are pseudonymous per platform account.' });
  if (coverage < 1) notes.push({ vi: `${Math.round((1 - coverage) * 100)}% đơn không có mã người mua và không được tính.`, en: `${Math.round((1 - coverage) * 100)}% of orders lack a buyer ID.` });

  return {
    available: true,
    coverage,
    inRange: {
      customers,
      newCustomers: newC,
      returningCustomers: returningC,
      returningGmvShare: gmvIn ? gmvReturning / gmvIn : null,
      repeatWithinRange: customers ? repeatC / customers : null,
      ordersPerCustomer: customers ? ordersIn / customers : null,
      gmvPerCustomer: customers ? gmvIn / customers : null,
    },
    segments,
    cohorts,
    byPlatform: [...platStats.entries()].map(([platform, s]) => ({ platform, customers: s.customers, returningShare: s.customers ? s.returning / s.customers : null })),
    notes,
  };
}

/** Evidence range for a segment: all history up to the range end. */
export function segmentEvidenceRange(dataset: CanonicalDataset, end: string): DateRange {
  const start = dataset.orders.reduce((m, o) => (o.orderDate < m ? o.orderDate : m), end);
  return { start, end: addDays(end, 0) };
}

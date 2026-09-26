/**
 * Analyst anomaly scan & opportunity finder.
 *
 * Anomaly: each day is compared with the median of the previous 14 normal days
 * (sale / payday dates excluded from the baseline). Spread is measured with the MAD,
 * robust score = 0.6745 · (x − median) / MAD (MAD floored at 10% of the median, or 1pp for
 * the cancel rate); |score| ≥ 3.5 is flagged. Days that are
 * themselves campaign days are marked as such (an expected spike, not a surprise).
 *
 * Opportunity: SKUs whose sales efficiency grew faster than their exposure, SKUs with
 * high conversion but a small share of traffic, and high-margin SKUs with a small
 * share of GMV. Each comes with the numbers that support it.
 */
import type { CanonicalDataset } from './model';
import { datasetDateBounds, type DatasetFilter } from './filters';
import { breakdown, type BreakdownRow } from './breakdownEngine';
import { computeKpis } from './kpiEngine';
import { campaignCalendar, dayTypeOf } from './campaignEngine';
import { addDays, enumerateDays, type DateRange } from './period';
import { fmtChange, fmtRate } from './format';
import { placedOnly } from './orderStage';
import type { Bilingual } from './metric';

export type ScanMetric = 'gmv' | 'orders' | 'cancelRate' | 'profit';

export interface AnomalyPoint {
  date: string;
  value: number | null;
  baseline: number | null;
  score: number | null;
  flagged: boolean;
  direction: 'up' | 'down' | null;
  saleDay: boolean;
  sampleDays: number;
}

export interface AnomalyScanResult {
  metric: ScanMetric;
  points: AnomalyPoint[];
  flagged: AnomalyPoint[];
  notes: Bilingual[];
}

const THRESHOLD = 3.5;
const BASELINE_DAYS = 14;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function dayValue(rows: Map<string, BreakdownRow>, date: string, metric: ScanMetric): number | null {
  const r = rows.get(date);
  if (!r) return metric === 'cancelRate' ? null : 0;
  const c = r.current;
  switch (metric) {
    case 'gmv':
      return c.gmv;
    case 'orders':
      return c.placed;
    case 'cancelRate':
      return c.placed >= 10 ? c.cancelRate : null; // too few orders for a daily rate
    case 'profit':
      return c.profit;
  }
}

export function anomalyScan(dataset: CanonicalDataset, requested: DatasetFilter, metric: ScanMetric): AnomalyScanResult {
  const filter = placedOnly(requested);
  const notes: Bilingual[] = [];
  if (dataset.orders.length === 0 && dataset.dailyMetrics.length === 0) return { metric, points: [], flagged: [], notes: [{ vi: 'Cần dữ liệu doanh thu theo ngày hoặc file xuất đơn hàng.', en: 'Daily sales or an order export is required.' }] };
  if (metric === 'profit' && dataset.orders.length === 0) {
    return { metric, points: [], flagged: [], notes: [{ vi: 'Lợi nhuận theo ngày cần file xuất đơn hàng và giá vốn — báo cáo tổng hợp không có.', en: 'Daily profit needs an order export with COGS.' }] };
  }
  const start = addDays(filter.range.start, -40);
  const wide = breakdown(dataset, { ...filter, range: { start, end: filter.range.end } }, 'day');
  const rows = new Map(wide.rows.map((r) => [r.key, r]));
  const calendar = campaignCalendar(dataset);
  const isSale = (d: string) => {
    const t = dayTypeOf(d, calendar);
    return t !== 'weekday' && t !== 'weekend';
  };
  const bounds = computeKpis(dataset, { range: { start, end: filter.range.end } });
  const firstDataDay = datasetDateBounds(dataset)?.start ?? filter.range.end;

  const points: AnomalyPoint[] = enumerateDays(filter.range).map((date) => {
    const value = dayValue(rows, date, metric);
    const history: number[] = [];
    for (let back = 1; history.length < BASELINE_DAYS && back <= 40; back++) {
      const d = addDays(date, -back);
      if (d < firstDataDay) break;
      if (isSale(d)) continue;
      const v = dayValue(rows, d, metric);
      if (v !== null) history.push(v);
    }
    if (value === null || history.length < 7) {
      return { date, value, baseline: history.length ? median(history) : null, score: null, flagged: false, direction: null, saleDay: isSale(date), sampleDays: history.length };
    }
    const med = median(history);
    const mad = median(history.map((h) => Math.abs(h - med)));
    // Minimum spread so ordinary day-to-day noise on a flat history is not flagged:
    // 10% of the median for amounts/counts, 1 percentage point for the cancel rate.
    const floor = metric === 'cancelRate' ? 0.01 : Math.max(Math.abs(med) * 0.1, 1);
    const spread = Math.max(mad, floor);
    const score = (0.6745 * (value - med)) / spread;
    return { date, value, baseline: med, score, flagged: Math.abs(score) >= THRESHOLD, direction: value >= med ? 'up' : 'down', saleDay: isSale(date), sampleDays: history.length };
  });
  if (bounds.coverage !== 'full') {
    notes.push({ vi: 'Đầu khoảng phân tích chưa đủ 7 ngày lịch sử để so — các ngày đó không được chấm điểm.', en: 'Early days lack 7 days of history and are not scored.' });
  }
  if (metric === 'cancelRate') notes.push({ vi: 'Ngày có dưới 10 đơn không được chấm tỷ lệ hủy (mẫu quá nhỏ).', en: 'Days with fewer than 10 orders are not scored.' });
  return { metric, points, flagged: points.filter((p) => p.flagged), notes };
}

export type OpportunityKind = 'efficiency_growth' | 'high_cvr_low_traffic' | 'high_margin_low_share';

export interface Opportunity {
  kind: OpportunityKind;
  sku: string;
  label: string;
  title: Bilingual;
  message: Bilingual;
  check: Bilingual;
  metrics: { gmvChange: number | null; cvr: number | null; cvrChange: number | null; margin: number | null; clicksChange: number | null; gmvShare: number | null; clickShare: number | null };
}

export function findOpportunities(dataset: CanonicalDataset, filter: DatasetFilter, previousRange: DateRange): Opportunity[] {
  if (dataset.orders.length === 0) return [];
  const rows = breakdown(dataset, filter, 'sku', previousRange).rows.filter((r) => r.current.placed >= 20);
  const shop = computeKpis(dataset, filter).metrics;
  const shopCvr = shop.cvr.value;
  const shopMargin = shop.margin.value;
  const totalClicks = rows.reduce((s, r) => s + (r.current.clicks ?? 0), 0);
  const totalGmv = rows.reduce((s, r) => s + r.current.gmv, 0);
  const out: Opportunity[] = [];

  for (const r of rows) {
    const c = r.current;
    const p = r.previous;
    const gmvChange = r.change.gmv.percentageDelta;
    const clicksChange = c.clicks !== null && p?.clicks ? (c.clicks - p.clicks) / p.clicks : null;
    const cvrChange = r.change.cvr.percentageDelta;
    const gmvShare = totalGmv ? c.gmv / totalGmv : null;
    const clickShare = totalClicks && c.clicks !== null ? c.clicks / totalClicks : null;
    const metrics = { gmvChange, cvr: c.cvr, cvrChange, margin: c.margin, clicksChange, gmvShare, clickShare };
    const marginOk = c.margin !== null && (shopMargin === null || c.margin >= shopMargin);
    const facts = [
      `GMV ${fmtChange(gmvChange)}`,
      cvrChange !== null ? `CVR ${fmtChange(cvrChange)}` : null,
      c.margin !== null ? `margin ${fmtRate(c.margin)}` : null,
      clicksChange !== null ? `traffic ${fmtChange(clicksChange)}` : null,
    ].filter(Boolean).join(', ');

    if (gmvChange !== null && gmvChange >= 0.2 && marginOk && clicksChange !== null && clicksChange < gmvChange / 2) {
      out.push({
        kind: 'efficiency_growth',
        sku: r.key,
        label: r.label,
        title: { vi: `${r.label}: hiệu quả tăng nhanh hơn lượt tiếp cận`, en: `${r.label}: efficiency grew faster than exposure` },
        message: { vi: `${facts}. Hiệu quả bán tăng nhanh hơn lượt tiếp cận — có thể còn dư địa nếu tăng hiển thị.`, en: `${facts}. Performance improved faster than exposure.` },
        check: { vi: 'Kiểm tra tồn kho và thử tăng hiển thị (Ads, live, affiliate) có kiểm soát.', en: 'Check stock and test more exposure.' },
        metrics,
      });
      continue;
    }
    if (shopCvr && c.cvr !== null && c.cvr >= shopCvr * 1.3 && marginOk && gmvShare !== null && clickShare !== null && clickShare < gmvShare * 0.8) {
      out.push({
        kind: 'high_cvr_low_traffic',
        sku: r.key,
        label: r.label,
        title: { vi: `${r.label}: chuyển đổi cao nhưng ít traffic`, en: `${r.label}: high conversion, little traffic` },
        message: {
          vi: `CVR ${fmtRate(c.cvr, 'vi', 2)} (shop ${fmtRate(shopCvr, 'vi', 2)}), margin ${fmtRate(c.margin)}, chiếm ${fmtRate(clickShare)} traffic nhưng ${fmtRate(gmvShare)} GMV.`,
          en: `CVR ${fmtRate(c.cvr, 'en', 2)} vs shop ${fmtRate(shopCvr, 'en', 2)}, ${fmtRate(clickShare, 'en')} of traffic but ${fmtRate(gmvShare, 'en')} of GMV.`,
        },
        check: { vi: 'Cân nhắc tăng hiển thị cho SKU này và theo dõi CVR có giữ được không.', en: 'Consider more exposure and watch whether CVR holds.' },
        metrics,
      });
      continue;
    }
    // "Small share" = below half of the average SKU share; margin clearly above the shop.
    if (shopMargin !== null && c.margin !== null && c.margin >= shopMargin + 0.15 && gmvShare !== null && gmvShare < 0.5 / rows.length) {
      out.push({
        kind: 'high_margin_low_share',
        sku: r.key,
        label: r.label,
        title: { vi: `${r.label}: biên cao, doanh thu còn nhỏ`, en: `${r.label}: high margin, small share` },
        message: { vi: `Margin ${fmtRate(c.margin)} (shop ${fmtRate(shopMargin)}) nhưng chỉ chiếm ${fmtRate(gmvShare)} GMV.`, en: `Margin ${fmtRate(c.margin, 'en')} vs shop ${fmtRate(shopMargin, 'en')}, only ${fmtRate(gmvShare, 'en')} of GMV.` },
        check: { vi: 'Xem có thể đưa vào combo, live hoặc chiến dịch để tăng tỷ trọng không.', en: 'Consider combos, live or campaigns to grow its share.' },
        metrics,
      });
    }
  }
  return out;
}

/**
 * Daily Business Brief — "Hôm qua xảy ra chuyện gì và hôm nay tôi cần kiểm tra gì?"
 *
 * Built deterministically from the KPI, product and anomaly engines. Every sentence
 * carries Evidence; Dolphin AI may rephrase it but never adds facts. Correlational
 * wording only ("đi cùng", "cần kiểm tra").
 *
 * - One order stage throughout. Summary reports: placed orders, the only stage that has
 *   orders and cancellations; paid-order figures are shown apart and labelled.
 * - The day is compared with a baseline (7-day and whole-period averages), not only the
 *   day before.
 * - A rate is only called good or bad with at least MIN_RATE_ORDERS orders behind it.
 * - Revenue more than ±30% from its baseline goes to "Cần chú ý", with a check.
 */
import type { CanonicalDataset, Platform } from './model';
import { comparePeriods, type MetricComparison } from './comparisonEngine';
import { productPerformance, productLeaders } from './productEngine';
import { detectAlerts, type SmartAlert } from './anomalyEngine';
import { addDays } from './period';
import { computeKpis } from './kpiEngine';
import { STAGE_BASIS } from './orderStage';
import { MIN_RATE_ORDERS, revenueBaseline, type Baseline } from './summaryAlerts';
import { fmtChange, fmtCount, fmtDay, fmtMoneyCompact, fmtPp, fmtRate } from './format';
import type { Bilingual } from './metric';
import type { Evidence } from './evidence';

export interface BriefItem {
  text: Bilingual;
  evidence: Evidence[];
  alertId?: string;
}

export interface DailyBrief {
  day: string;
  compareDay: string;
  /** Revenue, orders and cancel rate count the same orders; `stage` names them. */
  headline: {
    revenue: MetricComparison;
    profit: MetricComparison;
    orders: MetricComparison;
    cancelRate: MetricComparison;
  };
  /** "Đơn đặt" for summary reports; null for order exports. */
  stage: Bilingual | null;
  /** Paid-order figures of a summary report, shown apart and labelled. */
  paid: { revenue: MetricComparison; orders: MetricComparison } | null;
  /** Revenue baselines of the day (7-day and whole-period averages). */
  revenueBaseline: Baseline;
  summary: Bilingual;
  positives: BriefItem[];
  concerns: BriefItem[];
  checks: BriefItem[];
  alerts: SmartAlert[];
  /** Why the brief is limited, when data is thin. */
  limitations: Bilingual[];
}

const MAX_ITEMS = 3;

function changeText(c: MetricComparison, lang: 'vi' | 'en'): string {
  if (c.percentageDelta === null) return lang === 'vi' ? 'chưa có số so sánh' : 'no comparison';
  const word = lang === 'vi' ? (c.percentageDelta >= 0 ? 'tăng' : 'giảm') : c.percentageDelta >= 0 ? 'up' : 'down';
  return `${word} ${fmtRate(Math.abs(c.percentageDelta), lang)}`;
}

/** "giảm 33,2%" — same wording as the day-over-day change in the same sentence. */
const pctWord = (ratio: number) => `${ratio >= 0 ? 'tăng' : 'giảm'} ${fmtRate(Math.abs(ratio))}`;

const isRevenueAlert = (a: SmartAlert) => a.type === 'revenue_drop' || a.type === 'revenue_rise';

export function buildDailyBrief(dataset: CanonicalDataset, day: string, platforms?: Platform[]): DailyBrief {
  const compareDay = addDays(day, -1);
  const cmp = comparePeriods(dataset, { range: { start: day, end: day }, platforms }, 'dod');
  const m = cmp.metrics;
  const summaryGrain = cmp.current.grain === 'daily';
  const headline = { revenue: summaryGrain ? m.placedGmv : m.gmv, profit: m.profit, orders: m.orders, cancelRate: m.cancelRate };
  const stage = summaryGrain ? STAGE_BASIS.placed : null;
  const paid = summaryGrain && m.paidGmv.current !== null ? { revenue: m.paidGmv, orders: m.paidOrders } : null;
  const base = revenueBaseline(dataset, day, platforms);
  const limitations: Bilingual[] = [];
  if (cmp.current.coverage !== 'full') {
    limitations.push({ vi: `Chưa có dữ liệu cho ngày ${fmtDay(day)}.`, en: `No data for ${fmtDay(day)}.` });
  }
  if (summaryGrain) {
    limitations.push({
      vi: 'Đang dùng báo cáo tổng hợp — chưa phân tích được lợi nhuận và sản phẩm. Nhập file xuất đơn hàng để có bản tin đầy đủ.',
      en: 'Using a summary report — profit and product analysis unavailable. Import an order export for a full brief.',
    });
  }

  // ---- summary sentence
  const rev = headline.revenue;
  const vi: string[] = [];
  const en: string[] = [];
  const vsAvg7 = rev.current !== null && base.avg7 ? (rev.current - base.avg7) / base.avg7 : null;
  const vsPeriod = rev.current !== null && base.avgPeriod ? (rev.current - base.avgPeriod) / base.avgPeriod : null;
  if (rev.current !== null) {
    const what = stage ? `doanh thu ${stage.vi.toLowerCase()}` : 'doanh thu';
    const orders = summaryGrain && m.orders.current !== null ? ` từ ${fmtCount(m.orders.current)} đơn` : '';
    const baselines = [
      vsAvg7 !== null ? `${pctWord(vsAvg7)} so với trung bình 7 ngày trước (${fmtMoneyCompact(base.avg7)})` : null,
      vsPeriod !== null ? `${pctWord(vsPeriod)} so với trung bình cả kỳ (${fmtMoneyCompact(base.avgPeriod)})` : null,
    ].filter(Boolean);
    vi.push(`Ngày ${fmtDay(day)} ${what} đạt ${fmtMoneyCompact(rev.current)}${orders}, ${changeText(rev, 'vi')} so với ngày ${fmtDay(compareDay)}${baselines.length ? `; ${baselines.join(', ')}` : ''}.`);
    en.push(
      `On ${fmtDay(day)} revenue${stage ? ` (${stage.en.toLowerCase()})` : ''} was ${fmtMoneyCompact(rev.current, 'en')}, ${changeText(rev, 'en')} vs ${fmtDay(compareDay)}${vsAvg7 !== null ? `, ${fmtChange(vsAvg7, 'en')} vs the 7-day average` : ''}.`,
    );
  }
  if (paid) {
    vi.push(`Theo đơn đã thanh toán: ${fmtMoneyCompact(paid.revenue.current)} từ ${fmtCount(paid.orders.current)} đơn (ngày ${fmtDay(compareDay)}: ${fmtCount(paid.orders.previous)} đơn).`);
    en.push(`Paid orders: ${fmtMoneyCompact(paid.revenue.current, 'en')} from ${fmtCount(paid.orders.current, 'en')} orders (${fmtDay(compareDay)}: ${fmtCount(paid.orders.previous, 'en')}).`);
  }
  const pr = m.profit;
  if (pr.current !== null && rev.percentageDelta !== null && pr.percentageDelta !== null) {
    const r = rev.percentageDelta;
    const p = pr.percentageDelta;
    const amount = fmtMoneyCompact(pr.current);
    let viText: string;
    let enText: string;
    if (r >= 0 && p < 0) {
      viText = `Tuy nhiên lợi nhuận ước tính lại ${changeText(pr, 'vi')} (${amount}).`;
      enText = `However, estimated profit fell ${fmtRate(Math.abs(p), 'en')} (${fmtMoneyCompact(pr.current, 'en')}).`;
    } else if (r >= 0 && p < r - 0.05) {
      viText = `Tuy nhiên lợi nhuận ước tính chỉ ${changeText(pr, 'vi')} (${amount}).`;
      enText = `However, estimated profit only rose ${fmtRate(p, 'en')} (${fmtMoneyCompact(pr.current, 'en')}).`;
    } else if (r < 0 && p < r - 0.05) {
      viText = `Lợi nhuận ước tính giảm mạnh hơn doanh thu: ${changeText(pr, 'vi')} (${amount}).`;
      enText = `Estimated profit fell faster than revenue: ${fmtRate(Math.abs(p), 'en')} down (${fmtMoneyCompact(pr.current, 'en')}).`;
    } else {
      viText = `Lợi nhuận ước tính ${changeText(pr, 'vi')} (${amount}).`;
      enText = `Estimated profit ${changeText(pr, 'en')} (${fmtMoneyCompact(pr.current, 'en')}).`;
    }
    vi.push(viText);
    en.push(enText);
  } else if (pr.current === null && cmp.current.grain === 'order') {
    vi.push('Chưa tính được lợi nhuận vì thiếu giá vốn.');
    en.push('Profit unavailable: COGS missing.');
  }

  // ---- alerts for the day. Revenue far from its baseline, either way, leads "Cần chú ý".
  const alerts = detectAlerts(dataset, { day, platforms });
  const needsAttention = (a: SmartAlert) => a.severity === 'critical' || a.severity === 'warning' || isRevenueAlert(a);
  const attention = [...alerts.filter((a) => needsAttention(a) && isRevenueAlert(a)), ...alerts.filter((a) => needsAttention(a) && !isRevenueAlert(a))];
  const concerns: BriefItem[] = attention.slice(0, MAX_ITEMS).map((a) => ({ text: a.message, evidence: a.evidence, alertId: a.id }));

  // ---- positives
  const positives: BriefItem[] = [];
  const dayRange = { start: day, end: day };
  const dayLabel: Bilingual = { vi: fmtDay(day), en: fmtDay(day) };
  // Above a typical day, but not so far above that it needs checking (that is a concern).
  if (vsAvg7 !== null && vsAvg7 >= 0.05 && !alerts.some(isRevenueAlert) && rev.current !== null) {
    positives.push({
      text: {
        vi: `Doanh thu ${fmtChange(vsAvg7)} so với trung bình 7 ngày trước (${fmtMoneyCompact(base.avg7)} → ${fmtMoneyCompact(rev.current)}).`,
        en: `Revenue ${fmtChange(vsAvg7, 'en')} vs the 7-day average (${fmtMoneyCompact(base.avg7, 'en')} → ${fmtMoneyCompact(rev.current, 'en')}).`,
      },
      evidence: [
        {
          label: stage ? { vi: `Doanh thu (${stage.vi.toLowerCase()})`, en: `Revenue (${stage.en.toLowerCase()})` } : { vi: 'Doanh thu', en: 'Revenue' },
          unit: 'vnd',
          current: rev.current,
          currentLabel: dayLabel,
          baseline: base.avg7,
          baselineLabel: { vi: 'Trung bình 7 ngày trước', en: 'Previous 7-day average' },
          filter: { range: dayRange, platforms },
        },
      ],
    });
  }
  // A rate is only called good (or bad) with enough orders behind it.
  const cr = m.cancelRate;
  const placed = m.orders.current ?? 0;
  if (cr.current !== null && placed < MIN_RATE_ORDERS) {
    limitations.push({
      vi: `Tỷ lệ hủy ${fmtRate(cr.current)} (${fmtCount(m.cancelledOrders.current)}/${fmtCount(placed)} đơn) tính trên dưới ${MIN_RATE_ORDERS} đơn — chưa đủ để kết luận tốt hay xấu.`,
      en: `The cancel rate rests on fewer than ${MIN_RATE_ORDERS} orders — too few to judge.`,
    });
  } else if (cr.current !== null) {
    const week = computeKpis(dataset, { range: { start: addDays(day, -7), end: compareDay }, platforms });
    const crBase = week.coverage === 'full' ? week.metrics.cancelRate.value : null;
    const pp = crBase !== null ? (cr.current - crBase) * 100 : null;
    if (pp !== null && pp <= -2) {
      positives.push({
        text: {
          vi: `Tỷ lệ hủy ${fmtRate(cr.current)} (${fmtCount(m.cancelledOrders.current)}/${fmtCount(placed)} đơn), thấp hơn mức 7 ngày trước ${fmtRate(crBase)} (${fmtPp(pp)}).`,
          en: `Cancel rate ${fmtRate(cr.current, 'en')}, below the previous 7 days' ${fmtRate(crBase, 'en')} (${fmtPp(pp, 'en')}).`,
        },
        evidence: [
          {
            label: { vi: 'Tỷ lệ hủy', en: 'Cancel rate' },
            unit: 'ratio',
            current: cr.current,
            currentLabel: dayLabel,
            baseline: crBase,
            baselineLabel: { vi: '7 ngày trước', en: 'Previous 7 days' },
            sampleSize: placed,
            filter: { range: dayRange, platforms, cancelledOnly: true },
          },
        ],
      });
    }
  }
  for (const a of alerts.filter((x) => x.severity === 'opportunity')) {
    if (positives.length >= MAX_ITEMS) break;
    positives.push({ text: a.message, evidence: a.evidence, alertId: a.id });
  }
  if (positives.length < MAX_ITEMS && cmp.current.grain === 'order') {
    const leaders = productLeaders(productPerformance(dataset, { range: dayRange, platforms }));
    const top = leaders.topProfit ?? leaders.topRevenue;
    if (top && (top.profit.value ?? top.gmv) > 0) {
      const byProfit = top.profit.value !== null && leaders.topProfit === top;
      positives.push({
        text: byProfit
          ? { vi: `${top.name} mang lại nhiều lợi nhuận nhất trong ngày: ${fmtMoneyCompact(top.profit.value)} từ ${top.orders} đơn.`, en: `${top.name} was the most profitable product: ${fmtMoneyCompact(top.profit.value, 'en')} from ${top.orders} orders.` }
          : { vi: `${top.name} có doanh thu cao nhất trong ngày: ${fmtMoneyCompact(top.gmv)} từ ${top.orders} đơn.`, en: `${top.name} had the highest revenue: ${fmtMoneyCompact(top.gmv, 'en')} from ${top.orders} orders.` },
        evidence: [{ label: byProfit ? { vi: 'Lợi nhuận', en: 'Profit' } : { vi: 'Doanh thu', en: 'Revenue' }, unit: 'vnd', current: byProfit ? top.profit.value : top.gmv, currentLabel: dayLabel, sampleSize: top.orders, filter: { range: dayRange, platforms, skus: [top.sku] } }],
      });
    }
  }

  // ---- checks: one per concern, then opportunities
  const checks: BriefItem[] = [];
  for (const a of [...attention, ...alerts.filter((x) => x.severity === 'opportunity')]) {
    if (checks.length >= MAX_ITEMS) break;
    checks.push({ text: a.check, evidence: a.evidence, alertId: a.id });
  }
  const cogsAlert = alerts.find((a) => a.type === 'missing_cogs');
  if (checks.length < MAX_ITEMS && cogsAlert) checks.push({ text: cogsAlert.check, evidence: [], alertId: cogsAlert.id });

  return {
    day,
    compareDay,
    headline,
    stage,
    paid,
    revenueBaseline: base,
    summary: { vi: vi.join(' '), en: en.join(' ') },
    positives: positives.slice(0, MAX_ITEMS),
    concerns,
    checks,
    alerts,
    limitations,
  };
}

/**
 * Daily Business Brief — "Hôm qua xảy ra chuyện gì và hôm nay tôi cần kiểm tra gì?"
 *
 * Built deterministically from the KPI, product and anomaly engines. Every sentence
 * carries Evidence; Dolphin AI may rephrase it but never adds facts. Correlational
 * wording only ("đi cùng", "cần kiểm tra").
 */
import type { CanonicalDataset, Platform } from './model';
import { comparePeriods, type MetricComparison } from './comparisonEngine';
import { productPerformance, productLeaders } from './productEngine';
import { detectAlerts, type SmartAlert } from './anomalyEngine';
import { addDays } from './period';
import { fmtDay, fmtMoneyCompact, fmtPp, fmtRate } from './format';
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
  headline: {
    revenue: MetricComparison;
    profit: MetricComparison;
    orders: MetricComparison;
    cancelRate: MetricComparison;
  };
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

export function buildDailyBrief(dataset: CanonicalDataset, day: string, platforms?: Platform[]): DailyBrief {
  const compareDay = addDays(day, -1);
  const cmp = comparePeriods(dataset, { range: { start: day, end: day }, platforms }, 'dod');
  const m = cmp.metrics;
  const headline = { revenue: m.gmv, profit: m.profit, orders: m.orders, cancelRate: m.cancelRate };
  const limitations: Bilingual[] = [];
  if (cmp.current.coverage !== 'full') {
    limitations.push({ vi: `Chưa có dữ liệu cho ngày ${fmtDay(day)}.`, en: `No data for ${fmtDay(day)}.` });
  }
  if (cmp.current.grain === 'daily') {
    limitations.push({
      vi: 'Đang dùng báo cáo tổng hợp — chưa phân tích được lợi nhuận và sản phẩm. Nhập file xuất đơn hàng để có bản tin đầy đủ.',
      en: 'Using a summary report — profit and product analysis unavailable. Import an order export for a full brief.',
    });
  }

  // ---- summary sentence
  const rev = m.gmv;
  const vi: string[] = [];
  const en: string[] = [];
  if (rev.current !== null) {
    vi.push(`Ngày ${fmtDay(day)} doanh thu đạt ${fmtMoneyCompact(rev.current)}, ${changeText(rev, 'vi')} so với ngày ${fmtDay(compareDay)}.`);
    en.push(`On ${fmtDay(day)} revenue was ${fmtMoneyCompact(rev.current, 'en')}, ${changeText(rev, 'en')} vs ${fmtDay(compareDay)}.`);
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

  // ---- alerts for the day
  const alerts = detectAlerts(dataset, { day, platforms });
  const concerns: BriefItem[] = alerts
    .filter((a) => a.severity === 'critical' || a.severity === 'warning')
    .slice(0, MAX_ITEMS)
    .map((a) => ({ text: a.message, evidence: a.evidence, alertId: a.id }));

  // ---- positives
  const positives: BriefItem[] = [];
  const dayRange = { start: day, end: day };
  if (rev.percentageDelta !== null && rev.percentageDelta >= 0.05 && rev.current !== null) {
    positives.push({
      text: {
        vi: `Doanh thu ${changeText(rev, 'vi')} so với ngày trước (${fmtMoneyCompact(rev.previous)} → ${fmtMoneyCompact(rev.current)}).`,
        en: `Revenue ${changeText(rev, 'en')} vs the previous day (${fmtMoneyCompact(rev.previous, 'en')} → ${fmtMoneyCompact(rev.current, 'en')}).`,
      },
      evidence: [{ label: { vi: 'Doanh thu', en: 'Revenue' }, unit: 'vnd', current: rev.current, currentLabel: { vi: fmtDay(day), en: fmtDay(day) }, baseline: rev.previous, baselineLabel: { vi: fmtDay(compareDay), en: fmtDay(compareDay) }, filter: { range: dayRange, platforms } }],
    });
  }
  const cr = m.cancelRate;
  if (cr.percentagePointDelta !== null && cr.percentagePointDelta !== undefined && cr.percentagePointDelta <= -2 && cr.current !== null) {
    positives.push({
      text: {
        vi: `Tỷ lệ hủy giảm còn ${fmtRate(cr.current)} (${fmtPp(cr.percentagePointDelta)}).`,
        en: `Cancel rate down to ${fmtRate(cr.current, 'en')} (${fmtPp(cr.percentagePointDelta, 'en')}).`,
      },
      evidence: [{ label: { vi: 'Tỷ lệ hủy', en: 'Cancel rate' }, unit: 'ratio', current: cr.current, currentLabel: { vi: fmtDay(day), en: fmtDay(day) }, baseline: cr.previous, baselineLabel: { vi: fmtDay(compareDay), en: fmtDay(compareDay) }, filter: { range: dayRange, platforms, cancelledOnly: true } }],
    });
  }
  for (const a of alerts.filter((x) => x.severity === 'opportunity' || x.type === 'revenue_rise')) {
    if (positives.length >= MAX_ITEMS) break;
    if (a.type === 'revenue_rise' && positives.length > 0 && positives[0].text.vi.startsWith('Doanh thu')) continue;
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
        evidence: [{ label: byProfit ? { vi: 'Lợi nhuận', en: 'Profit' } : { vi: 'Doanh thu', en: 'Revenue' }, unit: 'vnd', current: byProfit ? top.profit.value : top.gmv, currentLabel: { vi: fmtDay(day), en: fmtDay(day) }, sampleSize: top.orders, filter: { range: dayRange, platforms, skus: [top.sku] } }],
      });
    }
  }

  // ---- checks: one per concern, then opportunities
  const checks: BriefItem[] = [];
  for (const a of alerts) {
    if (checks.length >= MAX_ITEMS) break;
    if (a.severity === 'info') continue;
    checks.push({ text: a.check, evidence: a.evidence, alertId: a.id });
  }
  const cogsAlert = alerts.find((a) => a.type === 'missing_cogs');
  if (checks.length < MAX_ITEMS && cogsAlert) checks.push({ text: cogsAlert.check, evidence: [], alertId: cogsAlert.id });

  return {
    day,
    compareDay,
    headline,
    summary: { vi: vi.join(' '), en: en.join(' ') },
    positives: positives.slice(0, MAX_ITEMS),
    concerns,
    checks,
    alerts,
    limitations,
  };
}


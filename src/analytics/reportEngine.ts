/**
 * Report Center — builds structured reports from the same engines the screens use.
 * A report is plain data (sections of tables with typed cells), so every export format
 * (CSV, Excel, printable PDF) shows exactly the same numbers. Missing values stay
 * null ("—"), never 0.
 */
import type { CanonicalDataset, Platform } from './model';
import { compareRanges } from './comparisonEngine';
import type { KpiKey } from './kpiEngine';
import { breakdown } from './breakdownEngine';
import { productPerformance } from './productEngine';
import { orderHealth } from './orderHealthEngine';
import { buildDailyBrief } from './dailyBrief';
import { adsIntelligence, liveAudit } from './growthEngines';
import { campaignCalendar, campaignResult, type CalendarEntry } from './campaignEngine';
import { planProgress, type MonthlyPlan, type ActionItem, ACTION_STATUS_LABELS } from './planningEngine';
import { addDays, comparableRange, endOfMonth, formatRangeVi, type DateRange } from './period';
import type { MetricUnit } from './metric';
import { fmtByUnit, fmtDay } from './format';

export type ReportType = 'daily' | 'weekly' | 'monthly' | 'campaign' | 'live' | 'planning';

export const REPORT_TYPES: { key: ReportType; vi: string; en: string }[] = [
  { key: 'daily', vi: 'Báo cáo ngày', en: 'Daily report' },
  { key: 'weekly', vi: 'Báo cáo tuần', en: 'Weekly report' },
  { key: 'monthly', vi: 'Báo cáo tháng', en: 'Monthly report' },
  { key: 'campaign', vi: 'Báo cáo chiến dịch', en: 'Campaign report' },
  { key: 'live', vi: 'Báo cáo livestream', en: 'Livestream report' },
  { key: 'planning', vi: 'Báo cáo kế hoạch', en: 'Planning report' },
];

export type Cell = { v: number | null; unit: MetricUnit } | { t: string };

export interface ReportTable {
  title: string;
  columns: string[];
  rows: Cell[][];
  notes?: string[];
}

export interface Report {
  type: ReportType;
  title: string;
  period: string;
  generatedFrom: string;
  summary: string[];
  tables: ReportTable[];
}

const t = (s: string): Cell => ({ t: s });
const n = (v: number | null | undefined, unit: MetricUnit): Cell => ({ v: v ?? null, unit });

export function cellText(c: Cell, lang: 'vi' | 'en' = 'vi'): string {
  return 't' in c ? c.t : fmtByUnit(c.v, c.unit, lang, false);
}

const KPI_ROWS: { key: KpiKey; label: string }[] = [
  { key: 'gmv', label: 'GMV (đơn hợp lệ)' },
  { key: 'netRevenue', label: 'Doanh thu thuần' },
  { key: 'profit', label: 'Lợi nhuận ước tính' },
  { key: 'margin', label: 'Margin' },
  { key: 'orders', label: 'Số đơn đặt' },
  { key: 'aov', label: 'AOV' },
  { key: 'cancelRate', label: 'Tỷ lệ hủy' },
  { key: 'refundRate', label: 'Tỷ lệ trả/hoàn' },
  { key: 'cvr', label: 'CVR (đơn / lượt nhấp)' },
  { key: 'adSpend', label: 'Chi phí Ads' },
  { key: 'roas', label: 'ROAS' },
];

function kpiTable(dataset: CanonicalDataset, range: DateRange, previous: DateRange, platforms?: Platform[]): ReportTable {
  const cmp = compareRanges(dataset, { range, platforms }, previous);
  return {
    title: 'Chỉ số chính',
    columns: ['Chỉ số', `Kỳ này (${formatRangeVi(range)})`, `Kỳ so sánh (${formatRangeVi(previous)})`, 'Thay đổi', 'Thay đổi %'],
    rows: KPI_ROWS.map((k) => {
      const m = cmp.metrics[k.key];
      const isRate = m.unit === 'ratio';
      return [
        t(k.label),
        n(m.current, m.unit),
        n(m.previous, m.unit),
        isRate ? n(m.percentagePointDelta === null || m.percentagePointDelta === undefined ? null : m.percentagePointDelta / 100, 'ratio') : n(m.absoluteDelta, m.unit),
        isRate ? t('') : n(m.percentageDelta, 'ratio'),
      ];
    }),
    notes: ['Tỷ lệ: cột "Thay đổi" là chênh lệch điểm % (pp).'],
  };
}

function platformTable(dataset: CanonicalDataset, range: DateRange, previous: DateRange, platforms?: Platform[]): ReportTable {
  const rows = breakdown(dataset, { range, platforms }, 'platform', previous).rows;
  return {
    title: 'Theo sàn',
    columns: ['Sàn', 'GMV', 'Tỷ trọng', 'Thay đổi GMV %', 'Đơn', 'Tỷ lệ hủy', 'Lợi nhuận'],
    rows: rows.map((r) => [t(r.label), n(r.current.gmv, 'vnd'), n(r.gmvShare, 'ratio'), n(r.change.gmv.percentageDelta, 'ratio'), n(r.current.placed, 'count'), n(r.current.cancelRate, 'ratio'), n(r.current.profit, 'vnd')]),
  };
}

function productTable(dataset: CanonicalDataset, range: DateRange, previous: DateRange, platforms?: Platform[], limit = 15): ReportTable {
  const perf = productPerformance(dataset, { range, platforms }, previous);
  return {
    title: `Sản phẩm (top ${limit} theo GMV)`,
    columns: ['SKU', 'Tên', 'Đã bán', 'GMV', 'Thay đổi GMV %', 'Lợi nhuận', 'Margin', 'Tỷ lệ hủy'],
    rows: [...perf.rows]
      .sort((a, b) => b.gmv - a.gmv)
      .slice(0, limit)
      .map((r) => [t(r.sku), t(r.name), n(r.units, 'count'), n(r.gmv, 'vnd'), n(r.growth.percentageDelta, 'ratio'), n(r.profit.value, 'vnd'), n(r.margin.value, 'ratio'), n(r.cancelRate, 'ratio')]),
    notes: perf.rows.some((r) => !r.hasCogs) ? ['SKU chưa có giá vốn: lợi nhuận và margin để trống.'] : undefined,
  };
}

function orderHealthTable(dataset: CanonicalDataset, range: DateRange, platforms?: Platform[]): ReportTable {
  const h = orderHealth(dataset, { range, platforms });
  return {
    title: 'Lý do hủy',
    columns: ['Lý do', 'Số đơn', 'Tỷ trọng'],
    rows: h.cancelReasons.slice(0, 8).map((r) => [t(r.reason), n(r.count, 'count'), n(r.share, 'ratio')]),
  };
}

function periodReport(type: ReportType, title: string, dataset: CanonicalDataset, range: DateRange, previous: DateRange, platforms?: Platform[]): Report {
  const cmp = compareRanges(dataset, { range, platforms }, previous).metrics;
  const pct = (v: number | null) => (v === null ? '—' : `${v >= 0 ? 'tăng' : 'giảm'} ${fmtByUnit(Math.abs(v), 'ratio')}`);
  return {
    type,
    title,
    period: `${formatRangeVi(range)} so với ${formatRangeVi(previous)}`,
    generatedFrom: dataset.label,
    summary: [
      `GMV ${fmtByUnit(cmp.gmv.current, 'vnd')} (${pct(cmp.gmv.percentageDelta)}), lợi nhuận ước tính ${fmtByUnit(cmp.profit.current, 'vnd')} (${pct(cmp.profit.percentageDelta)}).`,
      `${cmp.orders.current ?? '—'} đơn, tỷ lệ hủy ${fmtByUnit(cmp.cancelRate.current, 'ratio')}.`,
    ],
    tables: [kpiTable(dataset, range, previous, platforms), platformTable(dataset, range, previous, platforms), productTable(dataset, range, previous, platforms), orderHealthTable(dataset, range, platforms)],
  };
}

export interface ReportOptions {
  asOf: string;
  platforms?: Platform[];
  /** daily: the day; weekly/monthly: any day inside the period (defaults to asOf). */
  day?: string;
  month?: string;
  campaign?: CalendarEntry;
  range?: DateRange;
  plan?: MonthlyPlan;
  actions?: ActionItem[];
}

export function buildReport(dataset: CanonicalDataset, type: ReportType, o: ReportOptions): Report | null {
  const platforms = o.platforms;
  switch (type) {
    case 'daily': {
      const day = o.day ?? o.asOf;
      const brief = buildDailyBrief(dataset, day, platforms);
      const r = periodReport('daily', `Báo cáo ngày ${fmtDay(day)}`, dataset, { start: day, end: day }, comparableRange({ start: day, end: day }, 'dod'), platforms);
      r.summary = [brief.summary.vi, ...brief.concerns.map((c) => `Cần chú ý: ${c.text.vi}`), ...brief.checks.map((c) => `Nên kiểm tra: ${c.text.vi}`)].filter(Boolean);
      r.tables.push({ title: 'Cảnh báo', columns: ['Mức độ', 'Cảnh báo', 'Nên kiểm tra'], rows: brief.alerts.map((a) => [t(a.severity), t(a.title.vi), t(a.check.vi)]) });
      return r;
    }
    case 'weekly': {
      const end = o.day ?? o.asOf;
      const wk = { start: addDays(end, -6), end };
      return periodReport('weekly', `Báo cáo tuần ${formatRangeVi(wk)}`, dataset, wk, comparableRange(wk, 'previous'), platforms);
    }
    case 'monthly': {
      const month = o.month ?? o.asOf.slice(0, 7);
      const start = `${month}-01`;
      const endFull = endOfMonth(start);
      const end = endFull > o.asOf ? o.asOf : endFull;
      const range = { start, end };
      return periodReport('monthly', `Báo cáo tháng ${month.slice(5)}/${month.slice(0, 4)}`, dataset, range, comparableRange(range, 'mom'), platforms);
    }
    case 'campaign': {
      const entry = o.campaign ?? campaignCalendar(dataset).filter((c) => c.range.end <= o.asOf).sort((a, b) => b.range.start.localeCompare(a.range.start))[0];
      if (!entry) return null;
      const res = campaignResult(dataset, entry, platforms);
      const k = res.kpis.metrics;
      return {
        type,
        title: `Báo cáo chiến dịch ${entry.name}`,
        period: formatRangeVi(entry.range),
        generatedFrom: dataset.label,
        summary: [
          `GMV ${fmtByUnit(k.gmv.value, 'vnd')}, ${k.orders.value ?? '—'} đơn, tỷ lệ hủy ${fmtByUnit(k.cancelRate.value, 'ratio')}.`,
          res.uplift !== null ? `GMV/ngày gấp ${(res.uplift + 1).toFixed(1).replace('.', ',')} lần ngày thường 14 ngày trước (${fmtByUnit(res.baselineGmvPerDay, 'vnd')}/ngày).` : 'Chưa đủ ngày thường trước chiến dịch để so sánh.',
        ],
        tables: [
          { title: 'Chỉ số', columns: ['Chỉ số', 'Giá trị'], rows: KPI_ROWS.map((r) => [t(r.label), n(k[r.key].value, k[r.key].unit)]) },
          { title: 'SKU dẫn đầu', columns: ['SKU', 'GMV', 'Đơn', 'Tỷ lệ hủy'], rows: res.topSkus.map((r) => [t(r.label), n(r.current.gmv, 'vnd'), n(r.current.placed, 'count'), n(r.current.cancelRate, 'ratio')]) },
          { title: 'Lý do hủy', columns: ['Lý do', 'Số đơn', 'Tỷ trọng'], rows: res.cancelReasons.map((r) => [t(r.reason), n(r.count, 'count'), n(r.share, 'ratio')]) },
        ],
      };
    }
    case 'live': {
      const range = o.range ?? { start: addDays(o.asOf, -29), end: o.asOf };
      const la = liveAudit(dataset, { range, platforms });
      if (la.sessions.length === 0) return null;
      return {
        type,
        title: 'Báo cáo livestream',
        period: formatRangeVi(range),
        generatedFrom: dataset.label,
        summary: [`${la.totals.sessions} phiên, GMV ${fmtByUnit(la.totals.gmv, 'vnd')}, ${la.totals.orders} đơn, GMV/giờ ${fmtByUnit(la.totals.gmvPerHour, 'vnd')}.`, ...la.notes.map((x) => x.vi)],
        tables: [
          {
            title: 'Xếp hạng phiên (GMV/giờ)',
            columns: ['Ngày', 'Giờ', 'Sàn', 'Người xem', 'Đơn', 'GMV', 'GMV/giờ', 'Chuyển đổi'],
            rows: la.ranking.map((r) => [t(fmtDay(r.session.date)), t(r.session.startTime ?? ''), t(r.session.platform), n(r.session.viewers ?? null, 'count'), n(r.session.orders ?? null, 'count'), n(r.session.gmv ?? null, 'vnd'), n(r.gmvPerHour, 'vnd'), n(r.conversion, 'ratio')]),
          },
          { title: 'Theo khung giờ', columns: ['Khung giờ', 'Số phiên', 'GMV/giờ', 'Chuyển đổi'], rows: la.byTimeSlot.map((g) => [t(g.label.vi), n(g.sessions, 'count'), n(g.gmvPerHour, 'vnd'), n(g.conversion, 'ratio')]) },
        ],
      };
    }
    case 'planning': {
      if (!o.plan) return null;
      const p = planProgress(dataset, o.plan, platforms);
      const ads = adsIntelligence(dataset, { range: p.range, platforms });
      return {
        type,
        title: `Kế hoạch tháng ${o.plan.month.slice(5)}/${o.plan.month.slice(0, 4)}`,
        period: formatRangeVi(p.range),
        generatedFrom: dataset.label,
        summary: [
          `Mục tiêu GMV ${fmtByUnit(o.plan.targetGmv, 'vnd')}.`,
          p.toDate ? `Đến ${fmtDay(p.lastDataDay!)}: thực tế ${fmtByUnit(p.toDate.actual, 'vnd')} / kế hoạch ${fmtByUnit(p.toDate.target, 'vnd')} (${fmtByUnit(p.toDate.ratio, 'ratio')}).` : 'Chưa có dữ liệu trong tháng.',
          p.projection !== null ? `Ước tính cuối tháng (không phải cam kết): ${fmtByUnit(p.projection, 'vnd')}.` : '',
          ads.available ? `Chi phí Ads trong tháng: ${fmtByUnit(ads.totals.spend, 'vnd')}.` : '',
        ].filter(Boolean),
        tables: [
          { title: 'Theo ngày', columns: ['Ngày', 'Loại ngày', 'Mục tiêu', 'Thực tế', 'Lũy kế mục tiêu', 'Lũy kế thực tế'], rows: p.days.map((d) => [t(fmtDay(d.date)), t(d.dayType), n(d.target, 'vnd'), n(d.actual, 'vnd'), n(d.cumTarget, 'vnd'), n(d.cumActual, 'vnd')]) },
          ...(p.platforms.length ? [{ title: 'Theo sàn', columns: ['Sàn', 'Mục tiêu tháng', 'Thực tế đến nay', 'So với tiến độ'], rows: p.platforms.map((x) => [t(x.platform), n(x.target, 'vnd'), n(x.actual, 'vnd'), n(x.ratio, 'ratio')]) }] : []),
          ...(o.plan.events.length ? [{ title: 'Lịch sự kiện', columns: ['Ngày', 'Sự kiện', 'Loại'], rows: o.plan.events.map((e) => [t(fmtDay(e.date)), t(e.title), t(e.kind)]) }] : []),
          ...(o.actions?.length
            ? [{ title: 'Hành động', columns: ['Việc', 'Người phụ trách', 'Hạn', 'Trạng thái'], rows: o.actions.map((a) => [t(a.title), t(a.owner ?? ''), t(a.deadline ? fmtDay(a.deadline) : ''), t(ACTION_STATUS_LABELS[a.status].vi)]) }]
            : []),
        ],
      };
    }
  }
}

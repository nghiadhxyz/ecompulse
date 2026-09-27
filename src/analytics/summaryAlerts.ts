/**
 * Smart alerts for platform summary reports (no order rows): shop revenue and cancellations
 * against a baseline, daily Ads, daily channel sales, and data-quality problems the file
 * itself shows. Product-level alerts still need an order export (anomalyEngine.ts).
 *
 * One order stage throughout: placed orders ("Đơn đặt"), the stage every summary sheet has
 * and the one cancellations, CVR and channel sales are reported on.
 *
 * Baselines (the day itself is never part of its baseline)
 *  - 7 ngày: mean of the previous 7 days that have data (at least 3)
 *  - cả kỳ: mean of every other day of the imported data
 *  - rates: pooled over the previous 7 days, and only judged with ≥ MIN_RATE_ORDERS orders
 */
import type { CanonicalDataset, DailyMetric, Platform, SummaryChannel } from './model';
import { computeKpis, type KpiSet } from './kpiEngine';
import { STAGE_BASIS } from './orderStage';
import { datasetDateBounds, sliceDataset } from './filters';
import { dailySummaryRows, SUMMARY_CHANNEL_LABELS, SUMMARY_STACKED_CHANNELS } from './summaryEngine';
import { addDays, type DateRange } from './period';
import { fmtChange, fmtDay, fmtMoneyCompact, fmtMultiple, fmtRate } from './format';
import { safeDivide, type Bilingual } from './metric';
import type { Evidence } from './evidence';
import type { AlertThresholds, SmartAlert } from './anomalyEngine';
import { sourceChecks, type SourceId } from './canonicalSources';
import { byGap, compareCopies, describeMismatch, type MismatchItem } from './mismatch';

const SOURCE_SHORT: Record<SourceId, Bilingual> = {
  period_row: { vi: 'dòng tổng', en: 'period row' },
  daily_sum: { vi: 'cộng ngày', en: 'sum of days' },
  channel_row: { vi: 'dòng kênh', en: 'channel row' },
  ad_rows: { vi: 'tổng dòng quảng cáo', en: 'ad rows' },
  ad_row: { vi: 'dòng quảng cáo', en: 'ad row' },
  traffic_header: { vi: 'đầu sheet kênh', en: 'channel sheet header' },
  product_header: { vi: 'đầu sheet sản phẩm', en: 'product sheet header' },
  daily_sheet_total: { vi: 'dòng tổng không ngày', en: 'undated total' },
  live_sessions: { vi: 'cộng các phiên', en: 'sum of sessions' },
};

/** Fewer orders than this and a rate (cancel, refund…) is not called good or bad. */
import { MIN_RATE_ORDERS } from './sampleSize';
export { MIN_RATE_ORDERS };
/** Revenue further than this from its baseline goes to "Cần chú ý". */
export const REVENUE_BASELINE_CHANGE = 0.3;
const MIN_BASELINE_DAYS = 3;
const ADS_MIN_SPEND_PER_DAY = 50_000;
/** A channel must carry this share of a typical day's sales before its swings are flagged. */
const CHANNEL_MIN_SHARE = 0.05;
const CHANNEL_MIN_DELTA = 100_000;

export interface Baseline {
  /** Mean of the previous 7 days with data, or null with fewer than 3 such days. */
  avg7: number | null;
  days7: number;
  /** Mean of every other day of the imported data. */
  avgPeriod: number | null;
  daysPeriod: number;
  period: DateRange | null;
}

const mean = (values: number[]) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : null);

/** Placed-order sales of each day (summary grain) — the daily rows, never a period total. */
function dailyValues(dataset: CanonicalDataset, platforms: Platform[] | undefined, pick: (d: DailyMetric) => number | undefined): Map<string, number> {
  const out = new Map<string, number>();
  for (const d of dataset.dailyMetrics) {
    if (platforms?.length && !platforms.includes(d.platform)) continue;
    const v = pick(d);
    if (v === undefined) continue;
    out.set(d.date, (out.get(d.date) ?? 0) + v);
  }
  return out;
}

/**
 * Baselines of a daily figure for `day`. Summary grain reads the daily rows; order grain
 * computes the figure per day from orders.
 */
export function dayBaseline(dataset: CanonicalDataset, day: string, platforms: Platform[] | undefined, pick: { daily: (d: DailyMetric) => number | undefined; kpi: (k: KpiSet) => number | null }): Baseline {
  const bounds = datasetDateBounds(dataset);
  const prev7 = Array.from({ length: 7 }, (_, i) => addDays(day, -(i + 1)));
  let values: Map<string, number>;
  if (dataset.orders.length === 0) {
    values = dailyValues(dataset, platforms, pick.daily);
  } else {
    values = new Map();
    if (bounds) {
      for (let d = bounds.start; d <= bounds.end; d = addDays(d, 1)) {
        const k = computeKpis(dataset, { range: { start: d, end: d }, platforms });
        const v = pick.kpi(k);
        if (v !== null) values.set(d, v);
      }
    }
  }
  const last7 = prev7.map((d) => values.get(d)).filter((v): v is number => v !== undefined);
  const others = [...values].filter(([d]) => d !== day).map(([, v]) => v);
  return {
    avg7: last7.length >= MIN_BASELINE_DAYS ? mean(last7) : null,
    days7: last7.length,
    avgPeriod: mean(others),
    daysPeriod: others.length,
    period: bounds,
  };
}

/** The revenue a brief or alert uses: placed-order sales for summary reports, GMV otherwise. */
export const revenueOf = (k: KpiSet) => (k.grain === 'daily' ? k.metrics.placedGmv.value : k.metrics.gmv.value);
export const revenueBaseline = (dataset: CanonicalDataset, day: string, platforms?: Platform[]) =>
  dayBaseline(dataset, day, platforms, { daily: (d) => d.placedGmv, kpi: revenueOf });

const AVG7_LABEL: Bilingual = { vi: 'Trung bình 7 ngày trước', en: 'Previous 7-day average' };

export function summaryAlerts(dataset: CanonicalDataset, day: string, platforms: Platform[] | undefined, t: AlertThresholds): SmartAlert[] {
  const alerts: SmartAlert[] = [];
  const dayRange = { start: day, end: day };
  const today = computeKpis(dataset, { range: dayRange, platforms });
  if (today.coverage !== 'full') return [];
  const dayLabel: Bilingual = { vi: `Ngày ${fmtDay(day)}`, en: fmtDay(day) };
  const basis = STAGE_BASIS.placed;

  // ---- revenue (placed orders) vs baseline
  const rev = today.metrics.placedGmv.value;
  const base = revenueBaseline(dataset, day, platforms);
  if (rev !== null && base.avg7 !== null && base.avg7 > 0) {
    const change = (rev - base.avg7) / base.avg7;
    const periodChange = base.avgPeriod ? (rev - base.avgPeriod) / base.avgPeriod : null;
    if (change < -t.revenueDrop || change > t.revenueRise) {
      const drop = change < 0;
      const periodText = periodChange !== null ? ` và ${fmtChange(periodChange)} so với trung bình cả kỳ ${fmtMoneyCompact(base.avgPeriod)}` : '';
      alerts.push({
        id: `${drop ? 'revenue_drop' : 'revenue_rise'}-${day}`,
        type: drop ? 'revenue_drop' : 'revenue_rise',
        severity: drop ? (change <= -t.revenueDropCritical ? 'critical' : 'warning') : 'warning',
        title: drop ? { vi: 'Doanh thu thấp hơn mức nền', en: 'Revenue below baseline' } : { vi: 'Doanh thu cao bất thường so với mức nền', en: 'Revenue well above baseline' },
        message: {
          vi: `Doanh thu đơn đặt ngày ${fmtDay(day)} là ${fmtMoneyCompact(rev)}, ${fmtChange(change)} so với trung bình 7 ngày trước ${fmtMoneyCompact(base.avg7)}${periodText}.`,
          en: `Placed-order sales on ${fmtDay(day)} were ${fmtMoneyCompact(rev, 'en')}, ${fmtChange(change, 'en')} vs the previous 7-day average ${fmtMoneyCompact(base.avg7, 'en')}.`,
        },
        check: drop
          ? { vi: 'Xem kênh/nguồn nào giảm nhiều nhất (Thẻ sản phẩm, Affiliate, Ads) và ngày này có ngay sau ngày sale không.', en: 'See which channel/source fell most (product card, affiliate, ads) and whether the day follows a sale.' }
          : { vi: 'Xác nhận doanh thu tăng đến từ ngày sale, chiến dịch hay nguồn nào — và kiểm tra số liệu ngày này trước khi dùng làm mốc.', en: 'Confirm whether a sale, campaign or source drove the rise, and check the day’s data before using it as a benchmark.' },
        evidence: [
          {
            label: { vi: `Doanh thu (${basis.vi.toLowerCase()})`, en: `Revenue (${basis.en.toLowerCase()})` },
            unit: 'vnd',
            current: rev,
            currentLabel: dayLabel,
            baseline: base.avg7,
            baselineLabel: { vi: `Trung bình ${base.days7} ngày trước`, en: `Previous ${base.days7}-day average` },
            sampleSize: today.metrics.orders.value ?? undefined,
            filter: { range: dayRange, platforms },
          },
          ...(base.avgPeriod !== null
            ? [{ label: { vi: `Doanh thu (${basis.vi.toLowerCase()})`, en: 'Revenue' }, unit: 'vnd' as const, current: rev, currentLabel: dayLabel, baseline: base.avgPeriod, baselineLabel: { vi: `Trung bình cả kỳ (${base.daysPeriod} ngày khác)`, en: `Period average (${base.daysPeriod} other days)` } }]
            : []),
        ],
      });
    }
  }

  // ---- cancellations vs the previous 7 days, only with enough orders to judge a rate
  const placed = today.metrics.orders.value ?? 0;
  const cr = today.metrics.cancelRate.value;
  const week = computeKpis(dataset, { range: { start: addDays(day, -7), end: addDays(day, -1) }, platforms });
  const crBase = week.coverage === 'full' ? week.metrics.cancelRate.value : null;
  if (cr !== null && crBase !== null && placed >= MIN_RATE_ORDERS) {
    const diffPp = (cr - crBase) * 100;
    if (diffPp >= t.cancelSpikePp && cr >= crBase * 1.5) {
      alerts.push({
        id: `cancel_spike-${day}`,
        type: 'cancel_spike',
        severity: diffPp >= t.cancelSpikeCriticalPp ? 'critical' : 'warning',
        title: { vi: 'Tỷ lệ hủy cao hơn mức nền', en: 'Cancel rate above baseline' },
        message: {
          vi: `Tỷ lệ hủy ngày ${fmtDay(day)} là ${fmtRate(cr)} (${today.metrics.cancelledOrders.value}/${placed} đơn đặt), so với ${fmtRate(crBase)} của 7 ngày trước.`,
          en: `Cancel rate on ${fmtDay(day)} was ${fmtRate(cr, 'en')} (${today.metrics.cancelledOrders.value}/${placed}) vs ${fmtRate(crBase, 'en')} over the previous 7 days.`,
        },
        check: { vi: 'Xem danh sách đơn hủy trên Kênh người bán (lý do hủy, người hủy).', en: 'Review cancelled orders in Seller Centre.' },
        evidence: [{ label: { vi: 'Tỷ lệ hủy', en: 'Cancel rate' }, unit: 'ratio', current: cr, currentLabel: dayLabel, baseline: crBase, baselineLabel: AVG7_LABEL, sampleSize: placed }],
      });
    }
  }

  alerts.push(...adsAlerts(dataset, day, platforms));
  alerts.push(...channelAlerts(dataset, day, platforms, base.avg7));
  alerts.push(...dataQualityAlerts(dataset, day, platforms));
  alerts.push(...customerOpportunityAlerts(dataset, day, platforms));
  return alerts;
}

// ------------------------------------------------------------------ Ads by day

function adsDay(dataset: CanonicalDataset, range: DateRange, platforms?: Platform[]) {
  const rows = sliceDataset(dataset, { range, platforms }).adsDaily;
  const has = (pick: (a: (typeof rows)[number]) => number | undefined) => rows.some((a) => pick(a) !== undefined);
  return {
    days: new Set(rows.map((a) => a.date)).size,
    spend: has((a) => a.spend) ? rows.reduce((s, a) => s + (a.spend ?? 0), 0) : null,
    gmv: has((a) => a.attributedRevenue) ? rows.reduce((s, a) => s + (a.attributedRevenue ?? 0), 0) : null,
  };
}

function adsAlerts(dataset: CanonicalDataset, day: string, platforms?: Platform[]): SmartAlert[] {
  if (dataset.ads.length === 0) return [];
  const cur = adsDay(dataset, { start: day, end: day }, platforms);
  const prev = adsDay(dataset, { start: addDays(day, -7), end: addDays(day, -1) }, platforms);
  if (cur.days === 0 || prev.days < MIN_BASELINE_DAYS || cur.spend === null || prev.spend === null || cur.gmv === null || prev.gmv === null) return [];
  const spendAvg = prev.spend / prev.days;
  const gmvAvg = prev.gmv / prev.days;
  if (spendAvg < ADS_MIN_SPEND_PER_DAY) return [];
  const roas = safeDivide(cur.gmv, cur.spend);
  const roasBase = safeDivide(prev.gmv, prev.spend);
  const gmvChange = gmvAvg > 0 ? (cur.gmv - gmvAvg) / gmvAvg : null;
  const spendChange = (cur.spend - spendAvg) / spendAvg;
  const roasChange = roas !== null && roasBase ? (roas - roasBase) / roasBase : null;
  const worse = (gmvChange !== null && gmvChange <= -REVENUE_BASELINE_CHANGE) || (roasChange !== null && roasChange <= -REVENUE_BASELINE_CHANGE);
  const better = !worse && ((gmvChange !== null && gmvChange >= REVENUE_BASELINE_CHANGE) || (roasChange !== null && roasChange >= REVENUE_BASELINE_CHANGE));
  const spendJump = Math.abs(spendChange) >= 0.5;
  if (!worse && !better && !spendJump) return [];
  const label: Bilingual = { vi: `Ngày ${fmtDay(day)}`, en: fmtDay(day) };
  const evidence: Evidence[] = [
    { label: { vi: 'Doanh số từ Ads', en: 'Ads sales' }, unit: 'vnd', current: cur.gmv, currentLabel: label, baseline: gmvAvg, baselineLabel: AVG7_LABEL },
    { label: { vi: 'Chi phí Ads', en: 'Ad spend' }, unit: 'vnd', current: cur.spend, currentLabel: label, baseline: spendAvg, baselineLabel: AVG7_LABEL },
    { label: { vi: 'ROAS', en: 'ROAS' }, unit: 'multiple', current: roas, currentLabel: label, baseline: roasBase, baselineLabel: { vi: '7 ngày trước (gộp)', en: 'Previous 7 days (pooled)' } },
  ];
  return [
    {
      id: `ads_day-${day}`,
      type: 'ads_day_change',
      severity: worse ? 'warning' : 'info',
      title: worse ? { vi: 'Quảng cáo Shopee kém hơn mức nền', en: 'Shopee Ads below baseline' } : better ? { vi: 'Quảng cáo Shopee tốt hơn mức nền', en: 'Shopee Ads above baseline' } : { vi: 'Chi phí Ads thay đổi mạnh', en: 'Ad spend changed sharply' },
      message: {
        vi: `Ngày ${fmtDay(day)}: doanh số từ Ads ${fmtMoneyCompact(cur.gmv)} (${fmtChange(gmvChange)} so với TB 7 ngày ${fmtMoneyCompact(gmvAvg)}), chi phí ${fmtMoneyCompact(cur.spend)} (${fmtChange(spendChange)}), ROAS ${fmtMultiple(roas)} so với ${fmtMultiple(roasBase)}.`,
        en: `${fmtDay(day)}: Ads sales ${fmtMoneyCompact(cur.gmv, 'en')} (${fmtChange(gmvChange, 'en')}), spend ${fmtMoneyCompact(cur.spend, 'en')} (${fmtChange(spendChange, 'en')}), ROAS ${fmtMultiple(roas, 'en')} vs ${fmtMultiple(roasBase, 'en')}.`,
      },
      check: worse
        ? { vi: 'Xem loại quảng cáo nào giảm (Tìm kiếm, Khám phá, GMV Max…), ngân sách có hết sớm và giá thầu có đổi không.', en: 'See which ad type fell, whether budget ran out and whether bids changed.' }
        : { vi: 'Xem loại quảng cáo nào tạo ra thay đổi và ngân sách ngày hôm đó.', en: 'See which ad type drove the change and that day’s budget.' },
      evidence,
    },
  ];
}

// ------------------------------------------------------------------ channels by day

function channelAlerts(dataset: CanonicalDataset, day: string, platforms: Platform[] | undefined, shopAvg7: number | null): SmartAlert[] {
  if (!dataset.salesSummaries?.length || !shopAvg7) return [];
  const rows = dailySummaryRows(dataset, { start: addDays(day, -7), end: day }, 'placed', platforms).filter((r) => r.dimension === 'channel');
  const out: { channel: SummaryChannel; cur: number; avg: number; change: number; delta: number }[] = [];
  for (const channel of SUMMARY_STACKED_CHANNELS) {
    const mine = rows.filter((r) => r.channel === channel && r.gmv !== undefined);
    const todayRow = mine.filter((r) => r.date === day);
    const before = new Map<string, number>();
    for (const r of mine) if (r.date !== day) before.set(r.date, (before.get(r.date) ?? 0) + r.gmv!);
    if (todayRow.length === 0 || before.size < MIN_BASELINE_DAYS) continue;
    const cur = todayRow.reduce((s, r) => s + r.gmv!, 0);
    const avg = mean([...before.values()])!;
    if (avg < shopAvg7 * CHANNEL_MIN_SHARE) continue;
    const change = (cur - avg) / avg;
    if (Math.abs(change) < REVENUE_BASELINE_CHANGE || Math.abs(cur - avg) < CHANNEL_MIN_DELTA) continue;
    out.push({ channel, cur, avg, change, delta: cur - avg });
  }
  const label: Bilingual = { vi: `Ngày ${fmtDay(day)}`, en: fmtDay(day) };
  return out
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3)
    .map((c) => {
      const name = SUMMARY_CHANNEL_LABELS[c.channel];
      const drop = c.change < 0;
      return {
        id: `source_change-${c.channel}-${day}`,
        type: 'source_change' as const,
        severity: drop ? ('warning' as const) : ('info' as const),
        title: { vi: `${name.vi}: doanh số ${drop ? 'giảm' : 'tăng'} mạnh`, en: `${name.en}: sales ${drop ? 'down' : 'up'} sharply` },
        message: {
          vi: `Doanh số đơn đặt từ ${name.vi} ngày ${fmtDay(day)} là ${fmtMoneyCompact(c.cur)}, ${fmtChange(c.change)} so với trung bình 7 ngày trước ${fmtMoneyCompact(c.avg)} (${drop ? '' : '+'}${fmtMoneyCompact(c.delta)}).`,
          en: `Placed-order sales from ${name.en} on ${fmtDay(day)} were ${fmtMoneyCompact(c.cur, 'en')}, ${fmtChange(c.change, 'en')} vs the previous 7-day average.`,
        },
        check:
          c.channel === 'affiliate'
            ? { vi: 'Xem affiliate/KOC nào ngừng đăng hoặc hết link trong ngày này.', en: 'See which affiliates stopped posting that day.' }
            : c.channel === 'product_card'
              ? { vi: 'Xem nguồn trong Thẻ sản phẩm (Tìm kiếm, Đề xuất, Trang shop) nguồn nào giảm, và giá/tồn kho sản phẩm chủ lực.', en: 'See which product-card source fell and check key products’ price/stock.' }
              : { vi: `Xem lịch đăng ${name.vi.toLowerCase()} trong ngày này.`, en: `Check the ${name.en.toLowerCase()} schedule that day.` },
        evidence: [{ label: { vi: `Doanh số ${name.vi}`, en: `${name.en} sales` }, unit: 'vnd' as const, current: c.cur, currentLabel: label, baseline: c.avg, baselineLabel: AVG7_LABEL }],
      };
    });
}

// ------------------------------------------------------------------ customers

/** At least this share of new buyers, with a low repeat rate, is an opportunity to bring buyers back. */
export const NEW_BUYER_SHARE_OPPORTUNITY = 0.75;
export const LOW_REPEAT_RATE = 0.2;

function customerOpportunityAlerts(dataset: CanonicalDataset, day: string, platforms?: Platform[]): SmartAlert[] {
  // Whole-period figures only: buyer counts are distinct, and the repeat rate is Shopee's own.
  const period = (dataset.periodTotals ?? []).find((p) => p.stage === 'placed' && p.start <= day && p.end >= day && (!platforms?.length || platforms.includes(p.platform)));
  if (!period || period.newBuyers === undefined || period.existingBuyers === undefined) return [];
  const buyers = period.newBuyers + period.existingBuyers;
  if (buyers < MIN_RATE_ORDERS) return [];
  const newShare = period.newBuyers / buyers;
  if (newShare < NEW_BUYER_SHARE_OPPORTUNITY || (period.repeatRate !== undefined && period.repeatRate >= LOW_REPEAT_RATE)) return [];
  const periodText = `${fmtDay(period.start)}–${fmtDay(period.end)}`;
  const repeat = period.repeatRate !== undefined ? `, tỉ lệ quay lại ${fmtRate(period.repeatRate)}` : '';
  return [
    {
      id: `repeat_buyers-${period.start}-${period.end}`,
      type: 'repeat_buyers_opportunity',
      severity: 'opportunity',
      title: { vi: `${Math.round(newShare * 100)}% người mua là khách mới (kỳ ${periodText})`, en: `${Math.round(newShare * 100)}% of buyers are new (${periodText})` },
      message: {
        vi: `${period.newBuyers} khách mới, ${period.existingBuyers} khách cũ (đơn đặt)${repeat}. Tỷ lệ quay lại thấp với hàng tiêu dùng mua lặp lại — còn dư địa giữ chân khách.`,
        en: `${period.newBuyers} new, ${period.existingBuyers} existing buyers (placed orders). Few buyers come back for a repeat-purchase product.`,
      },
      check: { vi: 'Xem có voucher/tin nhắn mời mua lại cho khách đã mua chưa; so với tỉ lệ quay lại của kỳ trước.', en: 'Check follow-up vouchers or messages to past buyers; compare with the previous period.' },
      evidence: [
        { label: { vi: 'Khách mới', en: 'New buyers' }, unit: 'ratio', current: newShare, currentLabel: { vi: `Kỳ ${periodText}`, en: periodText } },
      ],
    },
  ];
}

// ------------------------------------------------------------------ data quality

function dataQualityAlerts(dataset: CanonicalDataset, day: string, platforms?: Platform[]): SmartAlert[] {
  const out: SmartAlert[] = [];
  const rows = dataset.dailyMetrics.filter((d) => d.date === day && (!platforms?.length || platforms.includes(d.platform)));
  const bad = rows.filter((d) => d.placedGmv !== undefined && d.placedNoSubsidyGmv !== undefined && d.placedNoSubsidyGmv > d.placedGmv);
  if (bad.length > 0) {
    const gmv = bad.reduce((s, d) => s + d.placedGmv!, 0);
    const noSub = bad.reduce((s, d) => s + d.placedNoSubsidyGmv!, 0);
    out.push({
      id: `negative_subsidy-${day}`,
      type: 'data_negative_subsidy',
      severity: 'warning',
      title: { vi: `Dữ liệu ngày ${fmtDay(day)} không hợp lệ: trợ giá âm`, en: `Invalid data on ${fmtDay(day)}: negative subsidy` },
      message: {
        vi: `Doanh số không gồm trợ giá (${fmtMoneyCompact(noSub)}) lớn hơn doanh số (${fmtMoneyCompact(gmv)}). Ngày này bị loại khỏi phân tích trợ giá.`,
        en: `Sales excluding subsidy (${fmtMoneyCompact(noSub, 'en')}) exceed sales (${fmtMoneyCompact(gmv, 'en')}). The day is left out of subsidy analysis.`,
      },
      check: { vi: 'Xuất lại báo cáo ngày này từ Kênh người bán và đối chiếu hai cột doanh số.', en: 'Re-export this day from Seller Centre and compare the two sales columns.' },
      evidence: [{ label: { vi: 'Doanh số không gồm trợ giá', en: 'Sales excl. subsidy' }, unit: 'vnd', current: noSub, currentLabel: { vi: `Ngày ${fmtDay(day)}`, en: fmtDay(day) }, baseline: gmv, baselineLabel: { vi: 'Doanh số (đơn đặt)', en: 'Sales (placed)' } }],
    });
  }

  // File-level checks for the report period that contains the day.
  const totals = (dataset.periodTotals ?? []).filter((p) => p.start <= day && p.end >= day && (!platforms?.length || platforms.includes(p.platform)));
  const period = totals[0];
  if (!period) return out;
  const whole = computeKpis(dataset, { range: { start: period.start, end: period.end }, platforms });
  // Every figure of this period whose copies in the file disagree beyond rounding, largest first.
  const items = sourceChecks(dataset, platforms)
    .filter((c) => c.period.start === period.start && c.period.end === period.end && c.mismatch)
    .flatMap((c) =>
      c.others
        .filter((o) => !o.withinTolerance)
        .map((o) => compareCopies(c.id + o.source, c.label, c.unit, { label: SOURCE_SHORT[c.canonical.source], value: c.canonical.value }, { label: SOURCE_SHORT[o.source], value: o.value })),
    )
    .filter((m): m is MismatchItem => m !== null)
    .sort(byGap);
  const periodText = `${fmtDay(period.start)}–${fmtDay(period.end)}`;
  if (items.length > 0) {
    const top = items.slice(0, 3).map(describeMismatch);
    const more = items.length > 3 ? { vi: ` Và ${items.length - 3} chỗ khác — xem Chất lượng dữ liệu.`, en: ` And ${items.length - 3} more — see Data Quality.` } : { vi: '', en: '' };
    out.push({
      id: `period_mismatch-${period.start}-${period.end}`,
      type: 'data_period_mismatch',
      severity: 'info',
      title: { vi: `Dữ liệu không khớp trong file (kỳ ${periodText})`, en: `Data does not match within the file (${periodText})` },
      message: {
        vi: top.map((t) => t.vi).join('; ') + '.' + more.vi,
        en: top.map((t) => t.en).join('; ') + '.' + more.en,
      },
      check: { vi: 'Xuất lại báo cáo từ Kênh người bán; các bảng trong file đang không cùng một bộ dữ liệu.', en: 'Re-export the report; the tables of the file do not come from the same data.' },
      evidence: [],
    });
  }
  const cvrWarning = whole.metrics.cvr.warning;
  if (cvrWarning) {
    out.push({
      id: `cvr_mismatch-${period.start}-${period.end}`,
      type: 'data_cvr_mismatch',
      severity: 'info',
      title: { vi: `CVR trong file khác số tự tính (kỳ ${periodText})`, en: `File CVR differs from the recomputed CVR (${periodText})` },
      message: cvrWarning,
      check: { vi: 'Dùng CVR tính lại (đơn đặt ÷ lượt nhấp sản phẩm) khi so sánh; hỏi Shopee nếu cần con số của sàn.', en: 'Use the recomputed CVR when comparing.' },
      evidence: [],
    });
  }
  return out;
}

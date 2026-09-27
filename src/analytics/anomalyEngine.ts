/**
 * Smart alerts — deterministic anomaly & opportunity detection.
 *
 * Every alert carries Evidence (current value, baseline, window, sample size and the
 * drill-down filter). Wording states what the data shows ("đi cùng", "cần kiểm tra"),
 * never a cause the data cannot prove. Seller-facing text avoids statistical jargon.
 *
 * Baselines
 *  - daily revenue/profit: median of the previous 7 days (robust to a sale day)
 *  - daily rates: pooled rate of the previous 7 days
 *  - SKU rates: last 7 days vs the 4 weeks before
 *  - ads: last 7 days vs the 14 days before
 */
import type { CanonicalDataset, Platform } from './model';
import { PLATFORM_LABELS } from './model';
import { computeKpis } from './kpiEngine';
import { addDays, isInRange, type DateRange } from './period';
import { campaignDates, normalDayStats } from './normalDays';
import { orderHealth } from './orderHealthEngine';
import { productPerformance } from './productEngine';
import { adsSummary, isUndatedSession, liveSessions } from './adsLiveEngine';
import { assessDataQuality } from './dataQuality';
import { fmtChange, fmtDay, fmtMoneyCompact, fmtMultiple, fmtRate } from './format';
import type { Bilingual } from './metric';
import type { Evidence } from './evidence';
import { MIN_RATE_ORDERS, REVENUE_BASELINE_CHANGE, summaryAlerts } from './summaryAlerts';

export type AlertSeverity = 'critical' | 'warning' | 'opportunity' | 'info';

export type AlertType =
  | 'revenue_drop'
  | 'revenue_rise'
  | 'profit_drop'
  | 'daily_loss'
  | 'margin_drop'
  | 'cancel_spike'
  | 'sku_cancel_spike'
  | 'sku_refund_spike'
  | 'ads_efficiency_drop'
  | 'sku_loss'
  | 'growth_opportunity'
  | 'live_drop'
  | 'live_viewers_up_orders_down'
  | 'missing_cogs'
  // Summary reports (no order rows): see summaryAlerts.ts
  | 'ads_day_change'
  | 'source_change'
  | 'data_negative_subsidy'
  | 'data_period_mismatch'
  | 'data_cvr_mismatch'
  | 'repeat_buyers_opportunity';

export interface SmartAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: Bilingual;
  message: Bilingual;
  /** What to check next — a check, not a prescription. */
  check: Bilingual;
  evidence: Evidence[];
  sku?: string;
  platform?: Platform;
}

export interface AlertThresholds {
  revenueDrop: number;
  revenueDropCritical: number;
  revenueRise: number;
  profitDrop: number;
  marginDropPp: number;
  cancelSpikePp: number;
  cancelSpikeCriticalPp: number;
  minOrdersDay: number;
  skuRateSpikePp: number;
  skuMinOrders: number;
  adsRoasDrop: number;
  adsMinSpend: number;
  growthMin: number;
  growthMinMargin: number;
  liveOrdersDrop: number;
}

export const DEFAULT_THRESHOLDS: AlertThresholds = {
  revenueDrop: REVENUE_BASELINE_CHANGE,
  revenueDropCritical: 0.4,
  revenueRise: REVENUE_BASELINE_CHANGE,
  profitDrop: 0.3,
  marginDropPp: 5,
  cancelSpikePp: 5,
  cancelSpikeCriticalPp: 10,
  minOrdersDay: MIN_RATE_ORDERS,
  skuRateSpikePp: 5,
  skuMinOrders: 15,
  adsRoasDrop: 0.3,
  adsMinSpend: 200_000,
  growthMin: 0.2,
  growthMinMargin: 0.25,
  liveOrdersDrop: 0.3,
};

export interface AnomalyOptions {
  /** The day being reviewed (usually "yesterday"). */
  day: string;
  platforms?: Platform[];
  thresholds?: Partial<AlertThresholds>;
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = { critical: 0, warning: 1, opportunity: 2, info: 3 };

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const range = (start: string, end: string): DateRange => ({ start, end });

function productLabel(dataset: CanonicalDataset, sku: string): string {
  const name = dataset.products.find((p) => p.sku === sku)?.name;
  return name ? `${name} (${sku})` : sku;
}

function campaignDay(dataset: CanonicalDataset, day: string): string | undefined {
  return dataset.campaigns.find((c) => isInRange(day, { start: c.startDate, end: c.endDate }))?.name;
}

export function detectAlerts(dataset: CanonicalDataset, options: AnomalyOptions): SmartAlert[] {
  const t = { ...DEFAULT_THRESHOLDS, ...options.thresholds };
  if (dataset.orders.length === 0) {
    // Summary reports: shop, Ads, channel and data-quality alerts; product alerts need orders.
    if (dataset.dailyMetrics.length === 0) return [];
    return summaryAlerts(dataset, options.day, options.platforms, t).sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  }
  const { day, platforms } = options;
  const alerts: SmartAlert[] = [];
  const f = (r: DateRange) => ({ range: r, platforms });
  const dayLabel: Bilingual = { vi: `Ngày ${fmtDay(day)}`, en: fmtDay(day) };

  const today = computeKpis(dataset, f(range(day, day)));
  if (today.coverage !== 'full') return [];
  const prevDays = Array.from({ length: 7 }, (_, i) => addDays(day, -(i + 1)));
  const prevKpis = prevDays.map((d) => computeKpis(dataset, f(range(d, d))));
  const baselineCovered = prevKpis.every((k) => k.coverage === 'full');
  const week = computeKpis(dataset, f(range(prevDays[6], prevDays[0])));
  const campaign = campaignDay(dataset, day);

  if (baselineCovered) {
    // ---- revenue
    const gmv = today.metrics.gmv.value;
    const gmvBase = median(prevKpis.map((k) => k.metrics.gmv.value ?? 0));
    if (gmv !== null && gmvBase && gmvBase > 0) {
      const change = (gmv - gmvBase) / gmvBase;
      const ev: Evidence = {
        label: { vi: 'Doanh thu (GMV)', en: 'Revenue (GMV)' },
        unit: 'vnd',
        current: gmv,
        currentLabel: dayLabel,
        baseline: gmvBase,
        baselineLabel: { vi: 'Mức thường ngày (trung vị 7 ngày trước)', en: 'Typical day (median of previous 7 days)' },
        sampleSize: today.metrics.orders.value ?? undefined,
        filter: { range: range(day, day), platforms },
      };
      if (change <= -t.revenueDrop) {
        alerts.push({
          id: `revenue_drop-${day}`,
          type: 'revenue_drop',
          severity: change <= -t.revenueDropCritical ? 'critical' : 'warning',
          title: { vi: 'Doanh thu giảm so với ngày thường', en: 'Revenue below a typical day' },
          message: {
            vi: `Doanh thu ngày ${fmtDay(day)} đạt ${fmtMoneyCompact(gmv)}, thấp hơn mức thường ngày ${fmtMoneyCompact(gmvBase)} (${fmtChange(change)}).`,
            en: `Revenue on ${fmtDay(day)} was ${fmtMoneyCompact(gmv, 'en')}, below the typical ${fmtMoneyCompact(gmvBase, 'en')} (${fmtChange(change, 'en')}).`,
          },
          check: { vi: 'Kiểm tra sản phẩm/sàn nào giảm nhiều nhất và tình trạng tồn kho, giá bán.', en: 'Check which products/platforms fell most, stock and prices.' },
          evidence: [ev],
        });
      } else if (change >= t.revenueRise) {
        alerts.push({
          id: `revenue_rise-${day}`,
          type: 'revenue_rise',
          severity: 'info',
          title: { vi: campaign ? `Doanh thu tăng mạnh ngày ${campaign}` : 'Doanh thu cao hơn ngày thường', en: campaign ? `Strong revenue on ${campaign}` : 'Revenue above a typical day' },
          message: {
            vi: `Doanh thu ngày ${fmtDay(day)} đạt ${fmtMoneyCompact(gmv)}, cao hơn mức thường ngày ${fmtMoneyCompact(gmvBase)} (${fmtChange(change)}).`,
            en: `Revenue on ${fmtDay(day)} was ${fmtMoneyCompact(gmv, 'en')} vs a typical ${fmtMoneyCompact(gmvBase, 'en')} (${fmtChange(change, 'en')}).`,
          },
          check: { vi: 'Xem sản phẩm nào đóng góp nhiều nhất để giữ đà.', en: 'See which products contributed most.' },
          evidence: [ev],
        });
      }
    }

    // ---- profit & margin (only when profit is computable)
    const profit = today.metrics.profit;
    if (profit.value !== null) {
      const profitBase = median(prevKpis.map((k) => k.metrics.profit.value ?? 0));
      const ev: Evidence = {
        label: { vi: 'Lợi nhuận ước tính', en: 'Estimated profit' },
        unit: 'vnd',
        current: profit.value,
        currentLabel: dayLabel,
        baseline: profitBase,
        baselineLabel: { vi: 'Mức thường ngày (trung vị 7 ngày trước)', en: 'Typical day (median of previous 7 days)' },
        filter: { range: range(day, day), platforms },
      };
      if (profit.value < 0) {
        alerts.push({
          id: `daily_loss-${day}`,
          type: 'daily_loss',
          severity: 'critical',
          title: { vi: `Shop lỗ trong ngày ${fmtDay(day)}`, en: `Shop lost money on ${fmtDay(day)}` },
          message: {
            vi: `Lợi nhuận ước tính ngày ${fmtDay(day)} là ${fmtMoneyCompact(profit.value)} sau giá vốn, phí và chi phí đã nhập.`,
            en: `Estimated profit on ${fmtDay(day)} was ${fmtMoneyCompact(profit.value, 'en')} after COGS, fees and recorded costs.`,
          },
          check: { vi: 'Xem Lời/Lỗ theo sản phẩm để tìm SKU lỗ và khoản chi phí lớn nhất.', en: 'Open profit by product to find loss-making SKUs and the largest cost.' },
          evidence: [ev],
        });
      } else if (profitBase && profitBase > 0 && (profit.value - profitBase) / profitBase <= -t.profitDrop) {
        alerts.push({
          id: `profit_drop-${day}`,
          type: 'profit_drop',
          severity: 'warning',
          title: { vi: 'Lợi nhuận giảm so với ngày thường', en: 'Profit below a typical day' },
          message: {
            vi: `Lợi nhuận ước tính ngày ${fmtDay(day)} là ${fmtMoneyCompact(profit.value)}, thấp hơn mức thường ngày ${fmtMoneyCompact(profitBase)} (${fmtChange((profit.value - profitBase) / profitBase)}).`,
            en: `Estimated profit on ${fmtDay(day)} was ${fmtMoneyCompact(profit.value, 'en')} vs a typical ${fmtMoneyCompact(profitBase, 'en')}.`,
          },
          check: { vi: 'So sánh chi phí Ads, voucher và cơ cấu sản phẩm với ngày thường.', en: 'Compare ads, vouchers and product mix with a typical day.' },
          evidence: [ev],
        });
      }
      const m = today.metrics.margin.value;
      const mBase = week.metrics.margin.value;
      if (m !== null && mBase !== null && (m - mBase) * 100 <= -t.marginDropPp) {
        alerts.push({
          id: `margin_drop-${day}`,
          type: 'margin_drop',
          severity: 'warning',
          title: { vi: 'Biên lợi nhuận thấp hơn tuần trước', en: 'Margin below last week' },
          message: {
            vi: `Mỗi 100 đồng doanh thu thuần ngày ${fmtDay(day)} còn lại ${fmtRate(m)} lợi nhuận, so với ${fmtRate(mBase)} trung bình 7 ngày trước.`,
            en: `Margin on ${fmtDay(day)} was ${fmtRate(m, 'en')} vs ${fmtRate(mBase, 'en')} over the previous 7 days.`,
          },
          check: { vi: 'Kiểm tra voucher, giá bán và sản phẩm biên thấp bán nhiều hơn.', en: 'Check vouchers, prices and low-margin product mix.' },
          evidence: [
            { label: { vi: 'Biên lợi nhuận', en: 'Margin' }, unit: 'ratio', current: m, currentLabel: dayLabel, baseline: mBase, baselineLabel: { vi: 'Trung bình 7 ngày trước', en: 'Previous 7 days' }, filter: { range: range(day, day), platforms } },
          ],
        });
      }
    }

    // ---- shop cancel spike
    const cr = today.metrics.cancelRate.value;
    const crBase = week.metrics.cancelRate.value;
    const placed = today.metrics.orders.value ?? 0;
    if (cr !== null && crBase !== null && placed >= t.minOrdersDay) {
      const diffPp = (cr - crBase) * 100;
      if (diffPp >= t.cancelSpikePp && cr >= crBase * 1.5) {
        alerts.push({
          id: `cancel_spike-${day}`,
          type: 'cancel_spike',
          severity: diffPp >= t.cancelSpikeCriticalPp ? 'critical' : 'warning',
          title: { vi: 'Đơn hủy tăng', en: 'Cancellations up' },
          message: {
            vi: `Tỷ lệ hủy ngày ${fmtDay(day)} là ${fmtRate(cr)} (${today.metrics.cancelledOrders.value}/${placed} đơn), cao hơn mức trung bình 7 ngày trước là ${fmtRate(crBase)}.`,
            en: `Cancel rate on ${fmtDay(day)} was ${fmtRate(cr, 'en')} (${today.metrics.cancelledOrders.value}/${placed}), vs ${fmtRate(crBase, 'en')} over the previous 7 days.`,
          },
          check: { vi: 'Xem danh sách đơn hủy và lý do hủy.', en: 'Review cancelled orders and reasons.' },
          evidence: [
            { label: { vi: 'Tỷ lệ hủy', en: 'Cancel rate' }, unit: 'ratio', current: cr, currentLabel: dayLabel, baseline: crBase, baselineLabel: { vi: 'Trung bình 7 ngày trước', en: 'Previous 7 days' }, sampleSize: placed, filter: { range: range(day, day), platforms, cancelledOnly: true } },
          ],
        });
      }
    }
  }

  // ---- SKU cancel / refund spikes: last 7 days vs the 4 weeks before
  const recent = range(addDays(day, -6), day);
  const base = range(addDays(day, -34), addDays(day, -7));
  const baseCovered = computeKpis(dataset, f(base)).coverage === 'full';
  if (baseCovered) {
    const hRecent = orderHealth(dataset, f(recent));
    const hBase = new Map(orderHealth(dataset, f(base)).bySku.map((r) => [r.key, r]));
    for (const r of hRecent.bySku) {
      const b = hBase.get(r.key);
      if (!b) continue;
      const label = productLabel(dataset, r.key);
      if (r.placed >= t.skuMinOrders && r.cancelRate !== null && b.cancelRate !== null) {
        const diffPp = (r.cancelRate - b.cancelRate) * 100;
        if (diffPp >= t.skuRateSpikePp && r.cancelRate >= Math.max(0.08, b.cancelRate * 1.5)) {
          const reasons = orderHealth(dataset, { range: recent, platforms, skus: [r.key] }).cancelReasons;
          const top = reasons[0];
          alerts.push({
            id: `sku_cancel_spike-${r.key}-${day}`,
            type: 'sku_cancel_spike',
            // Critical only with enough orders to trust the rate.
            severity: diffPp >= 10 && r.placed >= 30 ? 'critical' : 'warning',
            sku: r.key,
            title: { vi: `Đơn hủy tăng ở ${label}`, en: `Cancellations up for ${label}` },
            message: {
              vi: `Tỷ lệ hủy của ${label} trong 7 ngày gần nhất là ${fmtRate(r.cancelRate)} (${r.cancelled}/${r.placed} đơn), cao hơn mức trung bình 4 tuần trước là ${fmtRate(b.cancelRate)}.${top ? ` Lý do được ghi nhiều nhất: "${top.reason}" (${fmtRate(top.share, 'vi', 0)} số đơn hủy).` : ''}`,
              en: `${label} cancel rate over the last 7 days is ${fmtRate(r.cancelRate, 'en')} (${r.cancelled}/${r.placed}), vs ${fmtRate(b.cancelRate, 'en')} in the 4 weeks before.${top ? ` Most recorded reason: "${top.reason}" (${fmtRate(top.share, 'en', 0)}).` : ''}`,
            },
            check: { vi: `Kiểm tra lý do hủy của ${r.key}, thời gian giao hàng và mô tả sản phẩm.`, en: `Check ${r.key} cancel reasons, delivery time and listing accuracy.` },
            evidence: [
              {
                label: { vi: 'Tỷ lệ hủy', en: 'Cancel rate' },
                unit: 'ratio',
                current: r.cancelRate,
                currentLabel: { vi: '7 ngày gần nhất', en: 'Last 7 days' },
                baseline: b.cancelRate,
                baselineLabel: { vi: '4 tuần trước đó', en: 'Previous 4 weeks' },
                sampleSize: r.placed,
                filter: { range: recent, platforms, skus: [r.key], cancelledOnly: true },
              },
            ],
          });
        }
      }
      if (r.valid >= t.skuMinOrders && r.returnRate !== null && b.returnRate !== null) {
        const diffPp = (r.returnRate - b.returnRate) * 100;
        if (diffPp >= t.skuRateSpikePp && r.returnRate >= Math.max(0.05, b.returnRate * 1.5)) {
          alerts.push({
            id: `sku_refund_spike-${r.key}-${day}`,
            type: 'sku_refund_spike',
            severity: 'warning',
            sku: r.key,
            title: { vi: `Trả hàng/hoàn tiền tăng ở ${label}`, en: `Returns up for ${label}` },
            message: {
              vi: `Tỷ lệ trả hàng/hoàn tiền của ${label} trong 7 ngày gần nhất là ${fmtRate(r.returnRate)}, cao hơn mức 4 tuần trước là ${fmtRate(b.returnRate)}.`,
              en: `${label} return rate over the last 7 days is ${fmtRate(r.returnRate, 'en')} vs ${fmtRate(b.returnRate, 'en')} before.`,
            },
            check: { vi: `Kiểm tra lý do trả hàng và chất lượng lô hàng của ${r.key}.`, en: `Check return reasons and batch quality for ${r.key}.` },
            evidence: [
              {
                label: { vi: 'Tỷ lệ trả hàng/hoàn tiền', en: 'Return rate' },
                unit: 'ratio',
                current: r.returnRate,
                currentLabel: { vi: '7 ngày gần nhất', en: 'Last 7 days' },
                baseline: b.returnRate,
                baselineLabel: { vi: '4 tuần trước đó', en: 'Previous 4 weeks' },
                sampleSize: r.valid,
                filter: { range: recent, platforms, skus: [r.key], returnedOnly: true },
              },
            ],
          });
        }
      }
    }
  }

  // ---- SKU loss (30 days) and growth opportunity (14 vs 14 days)
  const last30 = range(addDays(day, -29), day);
  if (computeKpis(dataset, f(last30)).coverage === 'full') {
    const perf = productPerformance(dataset, f(last30));
    for (const row of perf.rows) {
      const p = row.profit.value;
      if (p === null || p >= 0 || !row.hasCogs) continue;
      const lossShare = row.gmv > 0 ? -p / row.gmv : 0;
      const label = productLabel(dataset, row.sku);
      alerts.push({
        id: `sku_loss-${row.sku}-${day}`,
        type: 'sku_loss',
        severity: lossShare >= 0.1 || -p >= 10_000_000 ? 'critical' : 'warning',
        sku: row.sku,
        title: { vi: `${label} đang lỗ`, en: `${label} is losing money` },
        message: {
          vi: `Trong 30 ngày, ${label} bán ${row.units} sản phẩm, doanh thu ${fmtMoneyCompact(row.gmv)} nhưng lợi nhuận đóng góp khoảng ${fmtMoneyCompact(p)} (sau giá vốn, phí sàn, vận chuyển và Ads gắn với SKU).`,
          en: `Over 30 days ${label} sold ${row.units} units, ${fmtMoneyCompact(row.gmv, 'en')} revenue, but contribution profit is about ${fmtMoneyCompact(p, 'en')}.`,
        },
        check: { vi: `Xem khoản chi phí lớn nhất của ${row.sku} (Ads, giá vốn, voucher) và giá bán.`, en: `Check the largest cost for ${row.sku} (ads, COGS, vouchers) and its price.` },
        evidence: [
          { label: { vi: 'Lợi nhuận đóng góp', en: 'Contribution profit' }, unit: 'vnd', current: p, currentLabel: { vi: '30 ngày gần nhất', en: 'Last 30 days' }, sampleSize: row.orders, filter: { range: last30, platforms, skus: [row.sku] } },
          { label: { vi: 'Doanh thu', en: 'Revenue' }, unit: 'vnd', current: row.gmv, currentLabel: { vi: '30 ngày gần nhất', en: 'Last 30 days' } },
        ],
      });
    }
  }

  // Growth is measured per normal day (sale/payday dates excluded from both windows),
  // so a mega-sale inside one window does not fake growth or decline.
  const cur14 = range(addDays(day, -13), day);
  const prev14 = range(addDays(day, -27), addDays(day, -14));
  if (computeKpis(dataset, f(prev14)).coverage === 'full') {
    const perf = productPerformance(dataset, f(cur14));
    const saleDays = campaignDates(dataset);
    for (const row of perf.rows) {
      const margin = row.margin.value;
      if (margin === null || margin < t.growthMinMargin) continue;
      const cur = normalDayStats(dataset, row.sku, cur14, saleDays, platforms);
      const prev = normalDayStats(dataset, row.sku, prev14, saleDays, platforms);
      if (cur.days === 0 || prev.days === 0 || prev.gmvPerDay * prev.days < 1_000_000 || prev.gmvPerDay <= 0) continue;
      const g = (cur.gmvPerDay - prev.gmvPerDay) / prev.gmvPerDay;
      if (g < t.growthMin) continue;
      // Ignore changes within normal day-to-day noise: the rise in daily orders must be
      // at least ~2 standard errors (Poisson counts), so small SKUs don't trigger on luck.
      const se = Math.sqrt(cur.ordersPerDay / cur.days + prev.ordersPerDay / prev.days);
      if (se === 0 || (cur.ordersPerDay - prev.ordersPerDay) / se < 2) continue;
      const trafficChange = cur.clicksPerDay !== null && prev.clicksPerDay ? (cur.clicksPerDay - prev.clicksPerDay) / prev.clicksPerDay : null;
      if (trafficChange !== null && trafficChange > g / 2) continue; // growth mostly explained by more traffic
      const cvrCur = cur.clicksPerDay ? cur.ordersPerDay / cur.clicksPerDay : null;
      const cvrPrev = prev.clicksPerDay ? prev.ordersPerDay / prev.clicksPerDay : null;
      const cvrChange = cvrCur !== null && cvrPrev ? (cvrCur - cvrPrev) / cvrPrev : null;
      const label = productLabel(dataset, row.sku);
      const parts = [`GMV ${fmtChange(g)}`, cvrChange !== null ? `CVR ${fmtChange(cvrChange)}` : null, `margin ${fmtRate(margin)}`, trafficChange !== null ? `traffic ${fmtChange(trafficChange)}` : null].filter(Boolean);
      const basis: Bilingual = { vi: 'trung bình ngày thường, không tính ngày sale', en: 'normal-day average, sale days excluded' };
      alerts.push({
        id: `growth_opportunity-${row.sku}-${day}`,
        type: 'growth_opportunity',
        severity: 'opportunity',
        sku: row.sku,
        title: { vi: `${label} đang tăng tốt`, en: `${label} is growing` },
        message: {
          vi: `${label} — 14 ngày gần nhất so với 14 ngày trước (${basis.vi}): ${parts.join(', ')}.${trafficChange !== null ? ' Hiệu quả bán tăng nhanh hơn lượt tiếp cận — có thể còn dư địa nếu tăng hiển thị.' : ''}`,
          en: `${label} — last 14 vs previous 14 days (${basis.en}): ${parts.join(', ')}.${trafficChange !== null ? ' Sales efficiency grew faster than exposure — possible room to grow with more visibility.' : ''}`,
        },
        check: { vi: `Kiểm tra tồn kho ${row.sku} và khả năng tăng hiển thị (Ads, live, affiliate).`, en: `Check ${row.sku} stock and options to increase exposure.` },
        evidence: [
          {
            label: { vi: 'Doanh thu mỗi ngày thường', en: 'Revenue per normal day' },
            unit: 'vnd',
            current: cur.gmvPerDay,
            currentLabel: { vi: `14 ngày gần nhất (${cur.days} ngày thường)`, en: `Last 14 days (${cur.days} normal days)` },
            baseline: prev.gmvPerDay,
            baselineLabel: { vi: `14 ngày trước đó (${prev.days} ngày thường)`, en: `Previous 14 days (${prev.days} normal days)` },
            sampleSize: row.orders,
            filter: { range: cur14, platforms, skus: [row.sku] },
          },
          ...(cur.clicksPerDay !== null
            ? [{ label: { vi: 'Lượt nhấp sản phẩm mỗi ngày thường', en: 'Product clicks per normal day' }, unit: 'count' as const, current: cur.clicksPerDay, currentLabel: { vi: '14 ngày gần nhất', en: 'Last 14 days' }, baseline: prev.clicksPerDay, baselineLabel: { vi: '14 ngày trước đó', en: 'Previous 14 days' } }]
            : []),
        ],
      });
    }
  }

  // ---- ads efficiency: last 7 days vs the 14 days before
  if (dataset.ads.length > 0) {
    const recentAds = adsSummary(dataset, f(recent));
    const baseAds = new Map(adsSummary(dataset, f(range(addDays(day, -20), addDays(day, -7)))).rows.map((r) => [r.key, r]));
    for (const r of recentAds.rows) {
      const b = baseAds.get(r.key);
      if (!b || r.roas === null || !b.roas || (r.spend ?? 0) < t.adsMinSpend) continue;
      const change = (r.roas - b.roas) / b.roas;
      if (change > -t.adsRoasDrop) continue;
      alerts.push({
        id: `ads_efficiency_drop-${r.key}-${day}`,
        type: 'ads_efficiency_drop',
        severity: r.breakEvenRoas !== null && r.roas < r.breakEvenRoas ? 'critical' : 'warning',
        platform: r.platform,
        sku: r.sku,
        title: { vi: `Quảng cáo kém hiệu quả hơn: ${r.name}`, en: `Ads efficiency down: ${r.name}` },
        message: {
          vi: `7 ngày gần nhất, mỗi 1 đồng quảng cáo mang về ${fmtMultiple(r.roas)} doanh thu (ROAS), so với ${fmtMultiple(b.roas)} ở 2 tuần trước.${r.cpc !== null && b.cpc && Math.abs((r.cpc - b.cpc) / b.cpc) >= 0.05 ? ` Giá mỗi lượt nhấp ${fmtChange((r.cpc - b.cpc) / b.cpc)}.` : ''}${r.breakEvenRoas !== null ? ` Mức hòa vốn ước tính: ${fmtMultiple(r.breakEvenRoas)}.` : ''}`,
          en: `Last 7 days ROAS ${fmtMultiple(r.roas, 'en')} vs ${fmtMultiple(b.roas, 'en')} in the 2 weeks before.${r.breakEvenRoas !== null ? ` Estimated break-even: ${fmtMultiple(r.breakEvenRoas, 'en')}.` : ''}`,
        },
        check: { vi: `Kiểm tra giá thầu, từ khóa và ngân sách của chiến dịch ${r.name}.`, en: `Check bids, keywords and budget of ${r.name}.` },
        evidence: [
          { label: { vi: 'ROAS', en: 'ROAS' }, unit: 'multiple', current: r.roas, currentLabel: { vi: '7 ngày gần nhất', en: 'Last 7 days' }, baseline: b.roas, baselineLabel: { vi: '14 ngày trước đó', en: 'Previous 14 days' }, filter: { range: recent, platforms, campaignId: r.key.split('|')[1] } },
          { label: { vi: 'Chi phí quảng cáo', en: 'Ad spend' }, unit: 'vnd', current: r.spend, currentLabel: { vi: '7 ngày gần nhất', en: 'Last 7 days' }, baseline: b.spend, baselineLabel: { vi: '14 ngày trước đó', en: 'Previous 14 days' } },
        ],
      });
    }
  }

  // ---- live: latest session per platform up to `day`
  if (dataset.liveSessions.length > 0) {
    // Sessions without an air date cannot be "the latest session" of any day.
    const rows = liveSessions(dataset, f(range(addDays(day, -6), day))).filter((r) => !isUndatedSession(r.session));
    const latestByPlatform = new Map<Platform, (typeof rows)[number]>();
    for (const r of rows) if (!latestByPlatform.has(r.session.platform)) latestByPlatform.set(r.session.platform, r);
    for (const r of latestByPlatform.values()) {
      const s = r.session;
      const title = s.title || s.sessionId;
      const where = PLATFORM_LABELS[s.platform];
      if (r.viewersUpOrdersDown && r.previous) {
        alerts.push({
          id: `live_viewers_up_orders_down-${s.sessionId}`,
          type: 'live_viewers_up_orders_down',
          severity: 'warning',
          platform: s.platform,
          title: { vi: `Live ${where} ${fmtDay(s.date)}: người xem tăng nhưng đơn giảm`, en: `${where} live ${fmtDay(s.date)}: more viewers, fewer orders` },
          message: {
            vi: `Phiên "${title}" có ${s.viewers} người xem (${fmtChange(r.viewersChange)} so với phiên trước) nhưng chỉ ${s.orders} đơn (${fmtChange(r.ordersChange)}).`,
            en: `Session "${title}" had ${s.viewers} viewers (${fmtChange(r.viewersChange, 'en')}) but ${s.orders} orders (${fmtChange(r.ordersChange, 'en')}).`,
          },
          check: { vi: 'Xem lại sản phẩm được ghim, giá deal và thời điểm chốt đơn trong phiên live.', en: 'Review pinned products, deal prices and closing moments in the live.' },
          evidence: [
            { label: { vi: 'Người xem', en: 'Viewers' }, unit: 'count', current: s.viewers ?? null, currentLabel: { vi: `Phiên ${fmtDay(s.date)}`, en: fmtDay(s.date) }, baseline: r.previous.viewers ?? null, baselineLabel: { vi: `Phiên ${fmtDay(r.previous.date)}`, en: fmtDay(r.previous.date) } },
            { label: { vi: 'Đơn hàng', en: 'Orders' }, unit: 'count', current: s.orders ?? null, currentLabel: { vi: `Phiên ${fmtDay(s.date)}`, en: fmtDay(s.date) }, baseline: r.previous.orders ?? null, baselineLabel: { vi: `Phiên ${fmtDay(r.previous.date)}`, en: fmtDay(r.previous.date) }, filter: { range: range(s.date, s.date), liveSessionId: s.sessionId } },
          ],
        });
        continue;
      }
      const prior = dataset.liveSessions
        .filter((x) => x.platform === s.platform && !isUndatedSession(x) && x.date < s.date && x.orders !== undefined)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 3);
      if (prior.length === 3 && s.orders !== undefined) {
        const avg = prior.reduce((sum, x) => sum + (x.orders || 0), 0) / 3;
        if (avg > 0 && (s.orders - avg) / avg <= -t.liveOrdersDrop) {
          alerts.push({
            id: `live_drop-${s.sessionId}`,
            type: 'live_drop',
            severity: 'warning',
            platform: s.platform,
            title: { vi: `Live ${where} ${fmtDay(s.date)} ra ít đơn hơn`, en: `${where} live ${fmtDay(s.date)} had fewer orders` },
            message: {
              vi: `Phiên "${title}" có ${s.orders} đơn, thấp hơn trung bình 3 phiên trước (${avg.toFixed(0)} đơn).`,
              en: `Session "${title}" had ${s.orders} orders vs an average of ${avg.toFixed(0)} in the previous 3.`,
            },
            check: { vi: 'So sánh khung giờ, thời lượng và sản phẩm với các phiên trước.', en: 'Compare time slot, duration and products with earlier sessions.' },
            evidence: [
              { label: { vi: 'Đơn hàng', en: 'Orders' }, unit: 'count', current: s.orders, currentLabel: { vi: `Phiên ${fmtDay(s.date)}`, en: fmtDay(s.date) }, baseline: avg, baselineLabel: { vi: 'Trung bình 3 phiên trước', en: 'Average of previous 3' }, filter: { range: range(s.date, s.date), liveSessionId: s.sessionId } },
            ],
          });
        }
      }
    }
  }

  // ---- data completeness
  const missingCogs = assessDataQuality(dataset).skusMissingCogs;
  if (missingCogs.length > 0) {
    alerts.push({
      id: 'missing_cogs',
      type: 'missing_cogs',
      severity: 'info',
      title: { vi: `${missingCogs.length} SKU chưa có giá vốn`, en: `${missingCogs.length} SKUs have no COGS` },
      message: {
        vi: `Lợi nhuận đang chưa đầy đủ vì ${missingCogs.slice(0, 3).join(', ')}${missingCogs.length > 3 ? '…' : ''} chưa có giá vốn.`,
        en: `Profit is incomplete: ${missingCogs.slice(0, 3).join(', ')}${missingCogs.length > 3 ? '…' : ''} have no COGS.`,
      },
      check: { vi: 'Nhập giá vốn trong Cài đặt → Giá vốn.', en: 'Enter COGS in Settings → COGS.' },
      evidence: [],
    });
  }

  return alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

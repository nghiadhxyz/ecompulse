/**
 * Dolphin Evidence Mode — answers business questions from computed analytics only.
 *
 * Every answer has four parts: INSIGHT (what the numbers say), EVIDENCE (the numbers,
 * each with a drill-down filter), INTERPRETATION (correlational wording only) and NEXT
 * CHECK. The router is deterministic; an AI model may later rephrase an answer, but it
 * only ever receives this structured answer — never order rows.
 */
import type { CanonicalDataset, Platform } from './model';
import type { DatasetFilter } from './filters';
import { compareRanges } from './comparisonEngine';
import { rootCause, ROOT_CAUSE_METRICS, type RootCauseMetric } from './rootCauseEngine';
import { productLeaders, productPerformance, applyShortcut } from './productEngine';
import { findOpportunities } from './anomalyScan';
import { campaignCalendar, campaignResult, dayTypeOf, type CalendarEntry } from './campaignEngine';
import { liveAudit, adsIntelligence } from './growthEngines';
import { summaryProducts } from './summaryEngine';
import { detectAlerts } from './anomalyEngine';
import { breakdown } from './breakdownEngine';
import { orderHealth } from './orderHealthEngine';
import { addDays, enumerateDays, formatRangeVi, type DateRange } from './period';
import { fmtByUnit, fmtChange, fmtDay, fmtMoneyCompact, fmtMultiple, fmtPp, fmtRate, sessionDateLabel } from './format';
import type { Bilingual } from './metric';
import type { Evidence } from './evidence';

export type DolphinIntent =
  | 'overview'
  | 'why_change'
  | 'growing_skus'
  | 'best_product'
  | 'campaign_cancel'
  | 'live_conversion'
  | 'cost_increase'
  | 'losing_products'
  | 'ads'
  | 'unknown';

export interface DolphinAnswer {
  intent: DolphinIntent;
  question: string;
  insight: Bilingual;
  evidence: Evidence[];
  interpretation: Bilingual;
  nextChecks: Bilingual[];
  /** Set when the data cannot answer — the reason and what is needed. */
  unavailable?: Bilingual;
  followUps: string[];
}

export interface DolphinContext {
  range: DateRange;
  previousRange: DateRange;
  platforms?: Platform[];
}

function norm(q: string): string {
  return q
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');
}

const has = (q: string, ...words: string[]) => words.some((w) => q.includes(w));

export function detectIntent(question: string): { intent: DolphinIntent; metric?: RootCauseMetric; campaignHint?: string } {
  const q = norm(question);
  const metric: RootCauseMetric | undefined = has(q, 'huy', 'cancel')
    ? 'cancelRate'
    : has(q, 'hoan', 'tra hang', 'refund')
      ? 'refundRate'
      : has(q, 'margin', 'bien loi')
        ? 'margin'
        : has(q, 'loi nhuan', 'profit', ' lai', 'lai ')
          ? 'profit'
          : has(q, 'aov', 'gia tri don', 'gio hang')
            ? 'aov'
            : has(q, 'cvr', 'chuyen doi', 'conversion')
              ? 'cvr'
              : has(q, 'so don', 'don hang', 'orders')
                ? 'orders'
                : has(q, 'gmv', 'doanh thu', 'doanh so', 'revenue')
                  ? 'gmv'
                  : undefined;
  const campaign = /(\d{1,2})[.\/](\d{1,2})/.exec(q);
  if (has(q, 'live') && has(q, 'chuyen doi', 'conversion', 'cvr', 'thap', 'kem')) return { intent: 'live_conversion' };
  if (campaign && has(q, 'huy', 'cancel')) return { intent: 'campaign_cancel', campaignHint: `${Number(campaign[1])}.${Number(campaign[2])}` };
  if (has(q, 'chi phi') && has(q, 'tang', 'nhieu', 'manh')) return { intent: 'cost_increase' };
  if (has(q, 'tai sao', 'vi sao', 'nguyen nhan', 'tai vi', 'why')) return { intent: 'why_change', metric: metric ?? 'gmv' };
  if (has(q, 'tot nhat', 'best', 'chu luc')) return { intent: 'best_product' };
  if (has(q, 'lo ', ' lo', 'dang lo', 'thua lo', 'losing')) return { intent: 'losing_products' };
  if ((has(q, 'sku', 'san pham') && has(q, 'tang', 'growth', 'tang truong')) || has(q, 'co hoi')) return { intent: 'growing_skus' };
  if (has(q, 'quang cao', 'ads', 'roas')) return { intent: 'ads' };
  if (has(q, 'the nao', 'ra sao', 'tong quan', 'tinh hinh', 'sao roi', 'on khong', 'thang nay', 'tuan nay', 'hom qua')) return { intent: 'overview' };
  return { intent: 'unknown' };
}

const FOLLOW_UPS = ['Tháng này doanh thu thế nào?', 'Tại sao GMV thay đổi?', 'SKU nào đang tăng trưởng?', 'Sản phẩm nào tốt nhất?', 'Chi phí nào tăng mạnh?', 'Live nào có conversion thấp?'];

function answer(intent: DolphinIntent, question: string, a: Omit<DolphinAnswer, 'intent' | 'question' | 'followUps'>): DolphinAnswer {
  return { intent, question, followUps: FOLLOW_UPS.filter((f) => f !== question).slice(0, 4), ...a };
}

function noData(intent: DolphinIntent, question: string, reason: Bilingual): DolphinAnswer {
  return answer(intent, question, {
    insight: { vi: 'Không đủ dữ liệu để trả lời câu hỏi này.', en: 'Not enough data to answer this.' },
    evidence: [],
    interpretation: reason,
    nextChecks: [],
    unavailable: reason,
  });
}

function findCampaign(dataset: CanonicalDataset, hint: string): CalendarEntry | undefined {
  const [d, m] = hint.split('.').map(Number);
  const all = campaignCalendar(dataset);
  return (
    all.filter((c) => Number(c.range.start.slice(8, 10)) === d && Number(c.range.start.slice(5, 7)) === m).sort((a, b) => b.range.start.localeCompare(a.range.start))[0] ??
    all.find((c) => c.name.includes(hint))
  );
}

export function askDolphin(dataset: CanonicalDataset, question: string, ctx: DolphinContext): DolphinAnswer {
  const { intent, metric, campaignHint } = detectIntent(question);
  const filter: DatasetFilter = { range: ctx.range, platforms: ctx.platforms };
  const period = `${formatRangeVi(ctx.range)} so với ${formatRangeVi(ctx.previousRange)}`;
  const periodEn = `${formatRangeVi(ctx.range)} vs ${formatRangeVi(ctx.previousRange)}`;
  const baseEv = { range: ctx.range, platforms: ctx.platforms };

  // Summary reports (daily totals, channels, ads, live, top products) answer the overview,
  // ads, live and best-product questions; the rest needs order-level rows.
  const ORDER_ONLY: DolphinIntent[] = ['growing_skus', 'losing_products', 'campaign_cancel', 'cost_increase'];
  if (dataset.orders.length === 0 && (ORDER_ONLY.includes(intent) || (dataset.dailyMetrics.length === 0 && intent !== 'unknown' && intent !== 'best_product'))) {
    return noData(intent, question, {
      vi: 'Câu hỏi này cần file xuất đơn hàng (từng đơn, có SKU và giá vốn) — báo cáo tổng hợp của sàn không có số liệu đó.',
      en: 'This question needs an order-level export.',
    });
  }

  switch (intent) {
    case 'overview': {
      const cmp = compareRanges(dataset, filter, ctx.previousRange);
      const m = cmp.metrics;
      if (m.gmv.current === null) return noData(intent, question, { vi: 'Khoảng thời gian này chưa có dữ liệu.', en: 'No data for this period.' });
      const plat = breakdown(dataset, filter, 'platform', ctx.previousRange).rows;
      const top = [...plat].sort((a, b) => Math.abs(b.change.gmv.absoluteDelta ?? 0) - Math.abs(a.change.gmv.absoluteDelta ?? 0))[0];
      const alerts = detectAlerts(dataset, { day: addDays(ctx.range.end, -1), platforms: ctx.platforms }).filter((a) => a.severity !== 'info');
      return answer(intent, question, {
        insight: {
          vi: `${period}: GMV ${fmtMoneyCompact(m.gmv.current)} (${fmtChange(m.gmv.percentageDelta)})${m.profit.current !== null ? `, lợi nhuận ước tính ${fmtMoneyCompact(m.profit.current)} (${fmtChange(m.profit.percentageDelta)})` : ''}, ${m.orders.current} đơn (${fmtChange(m.orders.percentageDelta)}), tỷ lệ hủy ${fmtRate(m.cancelRate.current)} (${fmtPp(m.cancelRate.percentagePointDelta ?? null)})${m.adSpend.current ? `, chi phí Ads ${fmtMoneyCompact(m.adSpend.current)} (ROAS ${fmtMultiple(m.roas.current)})` : ''}.${m.profit.current === null ? ' Chưa tính được lợi nhuận (cần file đơn hàng và giá vốn).' : ''}`,
          en: `${periodEn}: GMV ${fmtMoneyCompact(m.gmv.current, 'en')} (${fmtChange(m.gmv.percentageDelta, 'en')}), profit ${fmtMoneyCompact(m.profit.current, 'en')}, ${m.orders.current} orders.`,
        },
        evidence: [
          { label: { vi: 'GMV', en: 'GMV' }, unit: 'vnd', current: m.gmv.current, currentLabel: { vi: 'Kỳ này', en: 'Current' }, baseline: m.gmv.previous, baselineLabel: { vi: 'Kỳ so sánh', en: 'Comparison' }, filter: baseEv },
          ...(m.profit.current !== null
            ? [
                { label: { vi: 'Lợi nhuận ước tính', en: 'Est. profit' }, unit: 'vnd' as const, current: m.profit.current, currentLabel: { vi: 'Kỳ này', en: 'Current' }, baseline: m.profit.previous, baselineLabel: { vi: 'Kỳ so sánh', en: 'Comparison' } },
                { label: { vi: 'Margin', en: 'Margin' }, unit: 'ratio' as const, current: m.margin.current, currentLabel: { vi: 'Kỳ này', en: 'Current' }, baseline: m.margin.previous, baselineLabel: { vi: 'Kỳ so sánh', en: 'Comparison' } },
              ]
            : [{ label: { vi: 'Số đơn', en: 'Orders' }, unit: 'count' as const, current: m.orders.current, currentLabel: { vi: 'Kỳ này', en: 'Current' }, baseline: m.orders.previous, baselineLabel: { vi: 'Kỳ so sánh', en: 'Comparison' } }]),
          { label: { vi: 'Tỷ lệ hủy', en: 'Cancel rate' }, unit: 'ratio', current: m.cancelRate.current, currentLabel: { vi: 'Kỳ này', en: 'Current' }, baseline: m.cancelRate.previous, baselineLabel: { vi: 'Kỳ so sánh', en: 'Comparison' }, filter: { ...baseEv, cancelledOnly: true } },
        ],
        interpretation: top
          ? {
              vi: `Thay đổi GMV lớn nhất nằm ở ${top.label} (${fmtMoneyCompact(top.change.gmv.absoluteDelta)}${top.gmvContribution !== null ? `, ${fmtRate(Math.abs(top.gmvContribution), 'vi', 0)} tổng thay đổi` : ''}).${m.profit.percentageDelta !== null && m.gmv.percentageDelta !== null && m.profit.percentageDelta < m.gmv.percentageDelta - 0.05 ? ' Lợi nhuận tăng chậm hơn doanh thu — chi phí đang tăng nhanh hơn.' : ''}`,
              en: `The largest GMV change is on ${top.label}.`,
            }
          : { vi: 'Chưa có kỳ so sánh.', en: 'No comparison period.' },
        nextChecks: alerts.slice(0, 3).map((a) => a.check),
      });
    }

    case 'why_change': {
      const mt = metric ?? 'gmv';
      const r = rootCause(dataset, filter, ctx.previousRange, mt);
      if (r.unavailable) return noData(intent, question, r.unavailable);
      const spec = ROOT_CAUSE_METRICS[mt];
      const changeText = spec.unit === 'ratio' ? fmtPp((r.change ?? 0) * 100) : `${fmtByUnit(r.change, spec.unit)} (${fmtChange(r.previous ? (r.change ?? 0) / Math.abs(r.previous) : null)})`;
      const pathText = r.path.map((p) => `${p.label} (${spec.unit === 'ratio' ? fmtPp(p.contribution * 100) : fmtByUnit(p.contribution, spec.unit)})`).join(' → ');
      const leaf = r.tree[r.tree.length - 1]?.nodes[0];
      const drivers = r.drivers?.slice().sort((a, b) => Math.abs(b.contribution ?? 0) - Math.abs(a.contribution ?? 0));
      const evidence: Evidence[] = [
        { label: spec.label, unit: spec.unit, current: r.current, currentLabel: { vi: 'Kỳ này', en: 'Current' }, baseline: r.previous, baselineLabel: { vi: 'Kỳ so sánh', en: 'Comparison' }, filter: { ...baseEv, cancelledOnly: mt === 'cancelRate' || undefined } },
        ...r.path.map((p, i) => ({
          label: { vi: `Tầng ${i + 1}: ${p.label}`, en: `Level ${i + 1}: ${p.label}` },
          unit: spec.unit,
          current: p.contribution,
          currentLabel: { vi: 'Đóng góp vào thay đổi', en: 'Contribution' },
          filter: r.tree[i]?.nodes[0]?.evidence ?? undefined,
        })),
      ];
      const small = r.notes.some((n) => n.vi.startsWith('Thay đổi rất nhỏ'));
      return answer(intent, question, {
        insight: {
          vi: `${spec.label.vi} ${period}: ${fmtByUnit(r.previous, spec.unit)} → ${fmtByUnit(r.current, spec.unit)} (${changeText}).${small ? ' Mức thay đổi rất nhỏ.' : ''}`,
          en: `${spec.label.en} ${periodEn}: ${fmtByUnit(r.previous, spec.unit, 'en')} → ${fmtByUnit(r.current, spec.unit, 'en')}.`,
        },
        evidence,
        interpretation: {
          vi: `${pathText ? `Thay đổi tập trung theo chuỗi: ${pathText}.` : 'Thay đổi phân tán, không tập trung ở một nhóm.'}${drivers ? ` Về động lực GMV: ${drivers.map((d) => `${d.label.vi.split(' (')[0].toLowerCase()} ${fmtMoneyCompact(d.contribution)}`).join(', ')}.` : ''} Đây là phân rã đóng góp — cho biết thay đổi nằm ở đâu, không chứng minh nguyên nhân.`,
          en: `${pathText ? `The change concentrates along: ${pathText}.` : 'The change is spread out.'} This shows where, not why.`,
        },
        nextChecks: leaf
          ? [
              { vi: `Xem danh sách đơn của "${leaf.label}" trong kỳ (nút Xem dữ liệu).`, en: `Review the orders of "${leaf.label}".` },
              mt === 'cancelRate'
                ? { vi: `Kiểm tra lý do hủy, thời gian giao và tồn kho của "${leaf.label}".`, en: 'Check cancel reasons, delivery time and stock.' }
                : { vi: `Kiểm tra giá bán, tồn kho, Ads và traffic của "${leaf.label}" trong kỳ.`, en: 'Check price, stock, ads and traffic.' },
            ]
          : [],
      });
    }

    case 'growing_skus': {
      const perf = productPerformance(dataset, filter, ctx.previousRange);
      const growing = applyShortcut(perf, 'growing').slice(0, 5);
      const opps = findOpportunities(dataset, filter, ctx.previousRange);
      if (growing.length === 0) {
        return answer(intent, question, {
          insight: { vi: `Không có SKU nào tăng GMV từ 10% trở lên (${period}).`, en: 'No SKU grew GMV by 10% or more.' },
          evidence: [],
          interpretation: { vi: 'Có thể kỳ so sánh chứa ngày sale lớn — thử so theo tuần hoặc theo ngày thường.', en: 'The comparison period may contain big sale days.' },
          nextChecks: [],
        });
      }
      return answer(intent, question, {
        insight: { vi: `${growing.length} SKU tăng GMV mạnh nhất ${period}: ${growing.map((r) => `${r.name} (${fmtChange(r.growth.percentageDelta)})`).join(', ')}.`, en: `Top growing SKUs: ${growing.map((r) => r.sku).join(', ')}.` },
        evidence: growing.map((r) => ({
          label: { vi: r.name, en: r.name },
          unit: 'vnd' as const,
          current: r.gmv,
          currentLabel: { vi: 'GMV kỳ này', en: 'GMV' },
          baseline: r.growth.previous,
          baselineLabel: { vi: 'GMV kỳ so sánh', en: 'Previous GMV' },
          sampleSize: r.orders,
          filter: { ...baseEv, skus: [r.sku] },
        })),
        interpretation: opps.find((o) => o.kind === 'efficiency_growth')
          ? { vi: opps.find((o) => o.kind === 'efficiency_growth')!.message.vi, en: opps.find((o) => o.kind === 'efficiency_growth')!.message.en }
          : { vi: 'Tăng trưởng đi cùng mức tăng traffic tương ứng — chưa thấy dấu hiệu hiệu quả vượt trội.', en: 'Growth moved with traffic.' },
        nextChecks: [{ vi: 'Kiểm tra tồn kho các SKU đang tăng để tránh hết hàng.', en: 'Check stock of growing SKUs.' }, ...(opps[0] ? [opps[0].check] : [])],
      });
    }

    case 'best_product': {
      if (dataset.orders.length === 0) {
        const sp = summaryProducts(dataset, filter);
        if (!sp.available) return noData(intent, question, sp.notes[0] ?? { vi: 'Chưa có số liệu sản phẩm.', en: 'No product data.' });
        const by = (f: (r: (typeof sp.rows)[number]) => number | null) => [...sp.rows].filter((r) => f(r) !== null).sort((a, b) => (f(b) ?? 0) - (f(a) ?? 0))[0];
        const top = by((r) => r.gmv);
        const units = by((r) => r.units);
        const cvr = by((r) => ((r.clicks ?? 0) >= 100 ? r.cvr : null));
        return answer(intent, question, {
          insight: { vi: `"Tốt nhất" tùy tiêu chí — theo báo cáo Shopee ${sp.period ? formatRangeVi(sp.period) : ''}:`, en: '"Best" depends on the criterion:' },
          evidence: [
            { label: { vi: `Doanh số cao nhất: ${top?.name ?? '—'}`, en: `Top sales: ${top?.name ?? '—'}` }, unit: 'vnd' as const, current: top?.gmv ?? null, currentLabel: { vi: 'Doanh số (đơn đã đặt)', en: 'Placed sales' } },
            { label: { vi: `Bán nhiều nhất: ${units?.name ?? '—'}`, en: `Most units: ${units?.name ?? '—'}` }, unit: 'count' as const, current: units?.units ?? null, currentLabel: { vi: 'Sản phẩm bán ra', en: 'Units' } },
            { label: { vi: `Chuyển đổi cao nhất (từ 100 lượt nhấp): ${cvr?.name ?? '—'}`, en: `Best conversion: ${cvr?.name ?? '—'}` }, unit: 'ratio' as const, current: cvr?.cvr ?? null, currentLabel: { vi: 'Đơn / lượt nhấp', en: 'Orders / clicks' } },
          ],
          interpretation: { vi: `${sp.notes[0]?.vi ?? ''} Chưa xếp hạng được theo lợi nhuận vì chưa có giá vốn theo đơn.`, en: 'Profit ranking needs an order export.' },
          nextChecks: [{ vi: 'Nhập file xuất đơn hàng và giá vốn để biết sản phẩm nào lời nhất.', en: 'Import orders and COGS to rank by profit.' }],
        });
      }
      const leaders = productLeaders(productPerformance(dataset, filter, ctx.previousRange));
      const items: [string, string, string | undefined, string][] = [
        ['Bán nhiều nhất', 'Most units', leaders.bestSelling?.name, leaders.bestSelling ? `${leaders.bestSelling.units} sp` : ''],
        ['Doanh thu cao nhất', 'Top revenue', leaders.topRevenue?.name, leaders.topRevenue ? fmtMoneyCompact(leaders.topRevenue.gmv) : ''],
        ['Lợi nhuận cao nhất', 'Top profit', leaders.topProfit?.name, leaders.topProfit ? fmtMoneyCompact(leaders.topProfit.profit.value) : ''],
        ['Biên lợi nhuận cao nhất', 'Best margin', leaders.highestMargin?.name, leaders.highestMargin ? fmtRate(leaders.highestMargin.margin.value) : ''],
        ['Tăng trưởng mạnh nhất', 'Fastest growth', leaders.fastestGrowth?.name, leaders.fastestGrowth ? fmtChange(leaders.fastestGrowth.growth.percentageDelta) : ''],
      ];
      return answer(intent, question, {
        insight: { vi: `"Tốt nhất" tùy tiêu chí — ${period}:`, en: '"Best" depends on the criterion:' },
        evidence: items.map(([vi, en, name, value]) => ({
          label: { vi: `${vi}: ${name ?? 'Không đủ dữ liệu'}`, en: `${en}: ${name ?? 'N/A'}` },
          unit: 'count' as const,
          current: null,
          currentLabel: { vi: value, en: value },
        })),
        interpretation: {
          vi: leaders.topRevenue && leaders.topProfit && leaders.topRevenue.sku !== leaders.topProfit.sku ? `Sản phẩm doanh thu cao nhất (${leaders.topRevenue.name}) không phải là sản phẩm lời nhất (${leaders.topProfit.name}).` : 'Các tiêu chí cho kết quả khá thống nhất.',
          en: 'Revenue leader and profit leader may differ.',
        },
        nextChecks: [{ vi: 'Mở trang Sản phẩm để xem đầy đủ theo từng tiêu chí.', en: 'Open Products for the full table.' }],
      });
    }

    case 'losing_products': {
      const losing = applyShortcut(productPerformance(dataset, filter), 'losing');
      return answer(intent, question, {
        insight: losing.length
          ? { vi: `${losing.length} SKU đang lỗ ${formatRangeVi(ctx.range)}: ${losing.map((r) => `${r.name} (${fmtMoneyCompact(r.profit.value)})`).join(', ')}.`, en: `${losing.length} SKUs are losing money.` }
          : { vi: `Không có SKU nào lỗ trong ${formatRangeVi(ctx.range)} (với các SKU đã có giá vốn).`, en: 'No SKU is losing money.' },
        evidence: losing.map((r) => ({ label: { vi: r.name, en: r.name }, unit: 'vnd' as const, current: r.profit.value, currentLabel: { vi: 'Lợi nhuận đóng góp', en: 'Contribution profit' }, sampleSize: r.orders, filter: { ...baseEv, skus: [r.sku] } })),
        interpretation: { vi: 'Lợi nhuận đã trừ giá vốn, phí sàn, vận chuyển và Ads gắn với SKU. SKU chưa có giá vốn không được xét.', en: 'Profit after COGS, fees, shipping and SKU ads.' },
        nextChecks: losing.slice(0, 2).map((r) => ({ vi: `Xem khoản chi phí lớn nhất của ${r.sku} (Ads, giá vốn, voucher).`, en: `Check the largest cost of ${r.sku}.` })),
      });
    }

    case 'campaign_cancel': {
      const entry = campaignHint ? findCampaign(dataset, campaignHint) : undefined;
      if (!entry) return noData(intent, question, { vi: `Không tìm thấy chiến dịch/ngày sale "${campaignHint}" trong dữ liệu.`, en: `Campaign "${campaignHint}" not found.` });
      const res = campaignResult(dataset, entry, ctx.platforms);
      const cal = campaignCalendar(dataset);
      const normal = enumerateDays({ start: addDays(entry.range.start, -14), end: addDays(entry.range.start, -1) }).filter((d) => ['weekday', 'weekend'].includes(dayTypeOf(d, cal)));
      const normalHealth = normal.length ? orderHealth(dataset, { range: { start: normal[0], end: normal[normal.length - 1] }, platforms: ctx.platforms }) : null;
      const bySku = breakdown(dataset, { range: entry.range, platforms: ctx.platforms }, 'sku').rows.sort((a, b) => b.current.cancelled - a.current.cancelled).slice(0, 3);
      const cr = res.kpis.metrics.cancelRate.value;
      return answer(intent, question, {
        insight: {
          vi: `${entry.name} (${formatRangeVi(entry.range)}): tỷ lệ hủy ${fmtRate(cr)} (${res.kpis.metrics.cancelledOrders.value}/${res.kpis.metrics.orders.value} đơn)${normalHealth ? `, so với ${fmtRate(normalHealth.cancelRate)} ở các ngày thường 14 ngày trước` : ''}.`,
          en: `${entry.name}: cancel rate ${fmtRate(cr, 'en')}.`,
        },
        evidence: [
          { label: { vi: 'Tỷ lệ hủy ngày sale', en: 'Cancel rate (sale)' }, unit: 'ratio', current: cr, currentLabel: { vi: entry.name, en: entry.name }, baseline: normalHealth?.cancelRate ?? null, baselineLabel: { vi: 'Ngày thường trước đó', en: 'Normal days before' }, sampleSize: res.kpis.metrics.orders.value ?? undefined, filter: { range: entry.range, platforms: ctx.platforms, cancelledOnly: true } },
          ...bySku.map((r) => ({ label: { vi: `Đơn hủy · ${r.label}`, en: `Cancelled · ${r.label}` }, unit: 'count' as const, current: r.current.cancelled, currentLabel: { vi: `${fmtRate(r.current.cancelRate)} của ${r.current.placed} đơn`, en: `${fmtRate(r.current.cancelRate, 'en')} of ${r.current.placed}` }, filter: { range: entry.range, platforms: ctx.platforms, skus: [r.key], cancelledOnly: true } })),
        ],
        interpretation: {
          vi: `Lý do hủy được ghi nhiều nhất: ${res.cancelReasons.map((c) => `"${c.reason}" (${fmtRate(c.share, 'vi', 0)})`).join(', ') || 'không có dữ liệu lý do'}. Hủy nhiều đi cùng các SKU ở trên; lý do ghi nhận là do người mua/sàn chọn, cần đọc kỹ đơn trước khi kết luận.`,
          en: `Top recorded reasons: ${res.cancelReasons.map((c) => c.reason).join(', ')}.`,
        },
        nextChecks: [
          { vi: 'Kiểm tra tồn kho và thời gian chuẩn bị hàng trong ngày sale.', en: 'Check stock and preparation time on sale days.' },
          { vi: 'Xem các đơn hủy của SKU hủy nhiều nhất (nút Xem dữ liệu).', en: 'Review cancelled orders of the top SKU.' },
        ],
      });
    }

    case 'live_conversion': {
      const la = liveAudit(dataset, filter);
      const rows = la.sessions.filter((r) => r.conversion !== null && (r.session.viewers ?? 0) >= 200).sort((a, b) => (a.conversion ?? 0) - (b.conversion ?? 0));
      if (rows.length === 0) {
        return noData(
          intent,
          question,
          la.sessions.length > 0
            ? { vi: `Có ${la.sessions.length} phiên live nhưng phiên nào cũng dưới 200 người xem — quá ít để so tỷ lệ chuyển đổi. Xem chi tiết ở mục Livestream.`, en: 'Sessions have too few viewers to compare conversion.' }
            : { vi: 'Chưa có dữ liệu phiên live (người xem và đơn) trong khoảng này.', en: 'No live session data.' },
        );
      }
      const avg = rows.reduce((s, r) => s + (r.session.orders ?? 0), 0) / rows.reduce((s, r) => s + (r.session.viewers ?? 0), 0);
      const low = rows.slice(0, 3);
      return answer(intent, question, {
        insight: { vi: `Các phiên live chuyển đổi thấp nhất (đơn/người xem): ${low.map((r) => `${sessionDateLabel(r.session)} (${fmtRate(r.conversion, 'vi', 2)})`).join(', ')} — trung bình ${fmtRate(avg, 'vi', 2)}.`, en: `Lowest-converting sessions: ${low.map((r) => sessionDateLabel(r.session, 'en')).join(', ')}.` },
        evidence: low.map((r) => ({
          label: { vi: `Live ${sessionDateLabel(r.session)}`, en: `Live ${sessionDateLabel(r.session, 'en')}` },
          unit: 'ratio' as const,
          current: r.conversion,
          currentLabel: { vi: `${r.session.orders} đơn / ${r.session.viewers} người xem`, en: `${r.session.orders} / ${r.session.viewers}` },
          baseline: avg,
          baselineLabel: { vi: 'Trung bình các phiên', en: 'Average' },
          filter: { range: { start: r.session.periodStart ?? r.session.date, end: r.session.date }, liveSessionId: r.session.sessionId },
        })),
        interpretation: low.some((r) => r.viewersUpOrdersDown)
          ? { vi: 'Có phiên người xem tăng nhưng đơn giảm so với phiên trước — lượng người xem không đi cùng khả năng chốt đơn.', en: 'Some sessions had more viewers but fewer orders.' }
          : { vi: 'Chuyển đổi thấp đi cùng các phiên này; so sánh sản phẩm ghim, giá deal và thời lượng với phiên tốt nhất.', en: 'Compare these with the best sessions.' },
        nextChecks: [{ vi: `So sánh với phiên tốt nhất (${la.ranking[0] ? sessionDateLabel(la.ranking[0].session) : '—'}) ở trang Livestream.`, en: 'Compare with the best session in Livestream.' }],
      });
    }

    case 'cost_increase': {
      const cmp = compareRanges(dataset, filter, ctx.previousRange);
      const cur = cmp.current.profit;
      const prev = cmp.previous.profit;
      if (!cur || !prev || cur.completeness === 'insufficient') return noData(intent, question, { vi: 'Không đủ dữ liệu chi phí (cần file đơn hàng có giá vốn).', en: 'Cost data insufficient.' });
      const costKeys = ['sellerDiscount', 'refund', 'cogs', 'platformFee', 'paymentFee', 'affiliate', 'ads', 'shipping', 'otherCosts'];
      const prevMap = new Map(prev.lines.map((l) => [l.key, l.amount]));
      const netNow = cur.netRevenue.value || 1;
      const netPrev = prev.netRevenue.value || 1;
      const changes = cur.lines
        .filter((l) => costKeys.includes(l.key) && l.amount !== null && prevMap.get(l.key) != null)
        .map((l) => ({ l, delta: (l.amount ?? 0) - (prevMap.get(l.key) ?? 0), shareNow: (l.amount ?? 0) / netNow, sharePrev: (prevMap.get(l.key) ?? 0) / netPrev }))
        .sort((a, b) => b.delta - a.delta);
      const top = changes.slice(0, 3);
      return answer(intent, question, {
        insight: { vi: `Chi phí tăng nhiều nhất ${period}: ${top.map((c) => `${c.l.label.vi} ${fmtMoneyCompact(c.delta)} (${fmtRate(c.sharePrev)} → ${fmtRate(c.shareNow)} doanh thu thuần)`).join(', ')}.`, en: `Largest cost increases: ${top.map((c) => c.l.label.en).join(', ')}.` },
        evidence: top.map((c) => ({ label: c.l.label, unit: 'vnd' as const, current: c.l.amount, currentLabel: { vi: 'Kỳ này', en: 'Current' }, baseline: prevMap.get(c.l.key) ?? null, baselineLabel: { vi: 'Kỳ so sánh', en: 'Comparison' } })),
        interpretation: {
          vi: `Nên nhìn tỷ lệ trên doanh thu thuần: chi phí tăng theo doanh thu là bình thường; ${top.filter((c) => c.shareNow > c.sharePrev + 0.01).map((c) => c.l.label.vi).join(', ') || 'không khoản nào'} tăng nhanh hơn doanh thu.`,
          en: 'Look at cost as a share of net revenue.',
        },
        nextChecks: top.filter((c) => c.shareNow > c.sharePrev + 0.01).map((c) => (c.l.key === 'ads' ? { vi: 'Mở Ads Intelligence để xem chiến dịch dưới hòa vốn.', en: 'Open Ads Intelligence.' } : { vi: `Kiểm tra ${c.l.label.vi.toLowerCase()} theo SKU ở trang Doanh thu & Lợi nhuận.`, en: `Check ${c.l.label.en} by SKU.` })),
      });
    }

    case 'ads': {
      const ai = adsIntelligence(dataset, filter);
      if (!ai.available || ai.campaigns.length === 0) return noData(intent, question, { vi: 'Chưa có dữ liệu quảng cáo trong khoảng này.', en: 'No ads data.' });
      const bad = ai.campaigns.filter((c) => c.efficiency === 'below_break_even');
      return answer(intent, question, {
        insight: {
          vi: `Chi phí Ads ${fmtMoneyCompact(ai.totals.spend)}, doanh thu từ Ads ${fmtMoneyCompact(ai.totals.attributedRevenue)}, ROAS ${fmtMultiple(ai.totals.roas)}${ai.totals.breakEvenRoas !== null ? ` (hòa vốn ${fmtMultiple(ai.totals.breakEvenRoas)})` : ''}. ${
            ai.campaigns.some((c) => c.breakEvenRoas !== null)
              ? `${bad.length} chiến dịch dưới hòa vốn, chiếm ${fmtRate(ai.totals.spend ? ai.spendBelowBreakEven / ai.totals.spend : null, 'vi', 0)} ngân sách.`
              : 'Chưa biết chiến dịch nào có lời vì chưa có giá vốn để tính ROAS hòa vốn.'
          }`, en: `Ad spend ${fmtMoneyCompact(ai.totals.spend, 'en')}, ${bad.length} campaigns below break-even.` },
        evidence: ai.campaigns.slice(0, 4).map((c) => ({ label: { vi: c.name, en: c.name }, unit: 'multiple' as const, current: c.roas, currentLabel: { vi: 'ROAS', en: 'ROAS' }, baseline: c.breakEvenRoas, baselineLabel: { vi: 'ROAS hòa vốn', en: 'Break-even' }, filter: { ...baseEv, campaignId: c.key.split('|')[1] } })),
        interpretation: { vi: 'ROAS cao chưa chắc có lời — chỉ chiến dịch có ROAS trên mức hòa vốn của SKU mới tạo lợi nhuận sau Ads.', en: 'ROAS only matters against break-even.' },
        nextChecks: ai.campaigns.some((c) => c.breakEvenRoas !== null)
          ? bad.slice(0, 2).map((c) => ({ vi: `Kiểm tra giá thầu và ngân sách "${c.name}".`, en: `Check bids and budget of "${c.name}".` }))
          : [{ vi: 'Nhập giá vốn (và file đơn hàng) để tính ROAS hòa vốn — khi đó mới biết Ads có lời không.', en: 'Enter COGS to compute break-even ROAS.' }],
      });
    }

    default:
      return answer('unknown', question, {
        insight: { vi: 'Dolphin chưa hiểu câu hỏi này.', en: 'Dolphin did not understand this question.' },
        evidence: [],
        interpretation: { vi: 'Dolphin chỉ trả lời từ số liệu đã tính trong EcomPulse (không đoán). Hãy thử một câu hỏi gợi ý bên dưới.', en: 'Dolphin answers only from computed numbers. Try a suggested question.' },
        nextChecks: [],
      });
  }
}

/** Compact, aggregate-only payload for an AI rephrase (no order rows, no customer data). */
export function answerToAiPayload(a: DolphinAnswer, lang: 'vi' | 'en') {
  return {
    question: a.question,
    insight: a.insight[lang],
    evidence: a.evidence.map((e) => ({
      label: e.label[lang],
      current: e.current === null ? null : fmtByUnit(e.current, e.unit, lang),
      currentLabel: e.currentLabel[lang],
      baseline: e.baseline === undefined || e.baseline === null ? null : fmtByUnit(e.baseline, e.unit, lang),
      baselineLabel: e.baselineLabel?.[lang],
      sampleSize: e.sampleSize,
    })),
    interpretation: a.interpretation[lang],
    nextChecks: a.nextChecks.map((c) => c[lang]),
    unavailable: a.unavailable?.[lang],
  };
}

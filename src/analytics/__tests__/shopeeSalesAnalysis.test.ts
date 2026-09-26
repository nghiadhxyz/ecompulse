/**
 * Golden test for the full Shopee "Phân tích bán hàng" workbook (all 21 sheets).
 * Uses the real export in samples/ or the repo root; skipped when neither is present.
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { importShopeeSalesAnalysis } from '../importers/shopeeSalesAnalysis';
import { parseShopeeExcelFile } from '../../utils/excelParser';
import { canonicalFromParsedStoreData } from '../adapters/fromParsedStoreData';
import { mergeIntoWorkspace } from '../workspace';
import { computeKpis } from '../kpiEngine';
import { channelMix, summaryProducts } from '../summaryEngine';
import { adsIntelligence, liveAudit, videoAffiliate } from '../growthEngines';
import { breakdown } from '../breakdownEngine';
import { anomalyScan } from '../anomalyScan';
import { planProgress } from '../planningEngine';
import { beforeAfter } from '../changeImpact';
import { advancedStats } from '../statsEngine';
import { orderHealth } from '../orderHealthEngine';
import { askDolphin } from '../dolphinEvidence';
import { campaignCalendar } from '../campaignEngine';
import { channelWeekday, customerTrend, sourceDrivers, stageFunnel, subsidyDependence } from '../summaryInsights';
import { toNumber, toRate } from '../parse';
import { sessionDateLabel } from '../format';
import { detectAlerts } from '../anomalyEngine';

const CANDIDATES = [resolve(__dirname, '../../../samples/t7-t8 (1).xlsx'), resolve(__dirname, '../../../Báo cáo mẫu.xlsx')];
const FILE = CANDIDATES.find((f) => existsSync(f));
const FULL = { range: { start: '2026-07-24', end: '2026-08-22' } };

describe.skipIf(!FILE)('Shopee sales-analysis workbook — every sheet', async () => {
  const buf = readFileSync(FILE!);
  const wb = XLSX.read(buf, { type: 'buffer', dense: true });
  const sheets = wb.SheetNames.map((name) => ({ name, rows: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: '' }) }));
  const r = importShopeeSalesAnalysis({ fileName: 'x.xlsx', sheets });
  const file = { name: 'x.xlsx', arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) } as unknown as File;
  const parsed = await parseShopeeExcelFile(file);
  const ds = mergeIntoWorkspace(mergeIntoWorkspace(null, { ...canonicalFromParsedStoreData(parsed, 'shopee'), importNotes: [] }), r.dataset);

  it('recognises all 21 sheets with the right order stage', () => {
    expect(r.period).toEqual({ start: '2026-07-24', end: '2026-08-22' });
    expect(r.sheets).toHaveLength(21);
    expect(r.sheets.filter((s) => s.kind === 'skipped')).toHaveLength(0);
    expect(r.sheets.filter((s) => s.kind === 'live').map((s) => s.stage)).toEqual(['placed', 'confirmed', 'paid']);
    expect(r.sheets.filter((s) => s.kind === 'affiliate').map((s) => s.stage)).toEqual(['placed', 'confirmed', 'paid']);
  });

  it('channels add up to Shopee\'s total and daily rows match period totals', () => {
    const mix = channelMix(ds, FULL, 'placed');
    expect(mix.total).toBe(67_348_702);
    expect(mix.channels.find((c) => c.channel === 'product_card')!.gmv).toBe(50_197_987);
    expect(mix.channels.find((c) => c.channel === 'affiliate')!.gmv).toBe(15_807_915);
    expect(mix.adsGmv).toBe(63_564_662);
    expect(channelMix(ds, FULL, 'paid').total).toBe(51_302_716);
    // Daily KPIs are unchanged by the extra sheets (no double counting)
    expect(computeKpis(ds, FULL).metrics.orders.value).toBe(519);
  });

  it('reads daily Shopee Ads spend without double counting the period total', () => {
    const ai = adsIntelligence(ds, FULL);
    expect(ai.totals.spend).toBeGreaterThan(5_174_000);
    expect(ai.totals.spend).toBeLessThan(5_176_000);
    expect(ai.campaigns).toHaveLength(4); // 3 ad types + "Khác" (no spend data)
    expect(computeKpis(ds, FULL).metrics.roas.value!).toBeCloseTo(63_564_662 / ai.totals.spend, 6);
  });

  it('products, live sessions, videos and affiliates', () => {
    const sp = summaryProducts(ds, FULL);
    expect(sp.rows[0].sku).toBe('26061744778');
    expect(sp.rows[0].gmv).toBe(6_798_809 + 4_003_187);
    expect(sp.coverage!).toBeLessThan(1);
    const la = liveAudit(ds, FULL);
    expect(la.sessions).toHaveLength(5);
    expect(la.sessions.find((s) => s.session.title?.includes('MEGA LIVE'))!.session.paidOrders).toBe(2);
    const va = videoAffiliate(ds, FULL);
    expect(va.creators.length).toBeGreaterThanOrEqual(5);
    expect(va.videos.length).toBeGreaterThanOrEqual(5);
    // Period rows disappear for a partial range instead of being spread across days
    expect(summaryProducts(ds, { range: { start: '2026-08-01', end: '2026-08-22' } }).available).toBe(false);
  });

  describe('daily-grain features (no order lines)', () => {
    const W2 = { start: '2026-08-09', end: '2026-08-22' };
    const W1 = { start: '2026-07-26', end: '2026-08-08' };
    it('breakdown by day / platform uses the daily rows', () => {
      const day = breakdown(ds, FULL, 'day');
      expect(day.rows).toHaveLength(30);
      expect(day.totalGmv).toBe(51_302_716);
      expect(breakdown(ds, FULL, 'platform').rows[0].current.placed).toBe(519);
      expect(breakdown(ds, FULL, 'sku').unavailable).toBeDefined();
    });
    it('order health, anomaly scan, calendar', () => {
      expect(orderHealth(ds, FULL).cancelRate).toBeCloseTo(102 / 519, 10);
      const scan = anomalyScan(ds, FULL, 'gmv');
      expect(scan.points.some((p) => p.score !== null)).toBe(true);
      expect(anomalyScan(ds, FULL, 'profit').notes[0].vi).toContain('giá vốn');
      expect(campaignCalendar(ds).map((c) => c.name)).toContain('8.8');
    });
    it('planning, change impact and statistics', () => {
      const p = planProgress(ds, { month: '2026-08', targetGmv: 60_000_000, events: [] });
      expect(p.lastDataDay).toBe('2026-08-22');
      expect(p.toDate!.actual).toBeGreaterThan(0);
      const ba = beforeAfter(ds, {}, '2026-08-09', [7, 14]);
      expect(ba.windows.map((w) => w.days)).toEqual([7, 14]);
      expect(beforeAfter(ds, { skus: ['26061744778'] }, '2026-08-09').unavailable!.vi).toContain('SKU');
      const st = advancedStats(ds, { range: W2 }, W1);
      const gmv = st.tests.find((t) => t.key === 'gmvPerDay')!;
      expect(gmv.current!).toBeGreaterThan(1_000_000); // was wrongly 0 before
      expect(st.tests.find((t) => t.key === 'cancelRate')!.verdict).not.toBe('insufficient');
    });
    it('Dolphin answers overview, ads and best product from the summary report', () => {
      const ctx = { range: W2, previousRange: W1 };
      for (const q of ['Tháng này doanh thu thế nào?', 'Quảng cáo có hiệu quả không?', 'Sản phẩm nào tốt nhất?']) {
        const a = askDolphin(ds, q, { ...ctx, range: q.includes('tốt nhất') ? FULL.range : W2 });
        expect(a.unavailable, q).toBeUndefined();
      }
      expect(askDolphin(ds, 'Quảng cáo có hiệu quả không?', ctx).insight.vi).toContain('Chưa biết chiến dịch nào có lời');
      expect(askDolphin(ds, 'Sản phẩm nào đang lỗ?', ctx).unavailable).toBeDefined();
      expect(askDolphin(ds, 'Live nào có conversion thấp?', { range: FULL.range, previousRange: W1 }).unavailable!.vi).toContain('200 người xem');
    });
  });

  // ------------------------------------------------------------------ exact values (t7-t8)
  describe('exact values for 24/07–22/08/2026', () => {
    const k = computeKpis(ds, FULL).metrics;
    const placed = ds.periodTotals!.find((t) => t.stage === 'placed')!;
    const confirmed = ds.periodTotals!.find((t) => t.stage === 'confirmed')!;

    it('period totals, placed orders', () => {
      expect(k.placedGmv.value).toBe(67_348_702);
      expect(placed.noSubsidyGmv).toBe(54_364_855);
      expect(subsidyDependence(ds, FULL).total!.noSubsidyGmv).toBe(54_364_855);
      expect(k.orders.value).toBe(519);
      expect(k.cancelledOrders.value).toBe(102);
      expect(placed.cancelledGmv).toBe(18_954_280);
      expect(k.refundedOrders.value).toBe(7);
      expect(placed.refundedGmv).toBe(834_912);
      expect(k.buyers.value).toBe(453); // not the 479 the days add up to
      expect(k.buyers.status).toBe('ok');
      expect(customerTrend(ds, FULL).periodTotal!.newBuyers).toBe(372);
      expect(Math.round(k.cvr.value! * 10_000) / 100).toBe(4.9);
    });

    it('confirmed and paid stages', () => {
      expect(confirmed.gmv).toBe(57_006_822);
      expect(confirmed.orders).toBe(466);
      expect(ds.dailyMetrics.reduce((s, d) => s + (d.confirmedGmv ?? 0), 0)).toBe(57_006_822);
      expect(ds.dailyMetrics.reduce((s, d) => s + (d.confirmedOrders ?? 0), 0)).toBe(466);
      expect(channelMix(ds, FULL, 'confirmed').total).toBe(57_006_822);
      expect(k.gmv.value).toBe(51_302_716);
      expect(k.validOrders.value).toBe(422);
    });

    it('A1 — four channels add up to total sales; Ads is a layer, not a fifth channel', () => {
      const mix = channelMix(ds, FULL, 'placed');
      const gmv = (c: string) => mix.channels.find((x) => x.channel === c)!.gmv;
      expect(gmv('product_card')).toBe(50_197_987);
      expect(gmv('live')).toBe(27_000);
      expect(gmv('video')).toBe(1_315_800);
      expect(gmv('affiliate')).toBe(15_807_915);
      expect(mix.channels.map((c) => c.channel)).not.toContain('ads');
      expect(mix.total).toBe(67_348_702);
      expect(mix.adsGmv).toBe(63_564_662);
      expect(mix.adsAssistedShare).toBeCloseTo(63_564_662 / 67_348_702, 10);
      expect(mix.channels.reduce((s, c) => s + (c.share ?? 0), 0)).toBeCloseTo(1, 10);
    });

    it('Ads spend from the period rows; ROAS computed, not read', () => {
      const ai = adsIntelligence(ds, FULL);
      const spend = (name: string) => ai.campaigns.find((c) => c.name.startsWith(name))!.spend;
      expect(spend('Quảng cáo GMV tối đa ROAS tùy chỉnh')).toBe(4_371_746);
      expect(spend('Product Ads (GMV Max-Shop)')).toBe(779_002);
      expect(spend('Dịch Vụ Hiển Thị Live')).toBe(24_241);
      expect(ai.totals.spend).toBe(5_174_989);
      expect(ai.totals.roas).toBeCloseTo(63_564_662 / 5_174_989, 10);
      expect(Math.round(ai.totals.roas! * 100) / 100).toBe(12.28);
      expect(k.adSpend.value).toBe(5_174_989);
      // Days add up to 4.371.748 / 779.003: a 1–2đ rounding gap, inside the ±2đ tolerance → no warning,
      // and the period row is what is used.
      expect(ai.notes.some((n) => n.vi.startsWith('Cộng các ngày lệch'))).toBe(false);
      expect(channelMix(ds, FULL).notes.some((n) => n.vi.startsWith('Cộng các ngày lệch'))).toBe(false); // 391,51 vs 391,50
      for (const key of ['placedGmv', 'orders', 'gmv', 'validOrders', 'cancelledOrders', 'cvr', 'buyers', 'visits'] as const) expect(k[key].warning, key).toBeUndefined();
      // The daily chart still has every day.
      expect(ai.daily.filter((d) => d.spend > 0)).toHaveLength(30);
    });

    it('daily values', () => {
      const d = ds.dailyMetrics.find((x) => x.date === '2026-07-25')!;
      expect(d.placedGmv).toBe(7_330_600);
      expect(d.placedNoSubsidyGmv).toBe(5_888_500);
      expect(d.placedOrders).toBe(40);
      expect(d.visits).toBe(2045);
      expect(d.newBuyers).toBe(26);
      const ad = ds.ads.find((a) => a.date === '2026-08-08' && a.periodStart === undefined && a.adName?.startsWith('Quảng cáo GMV tối đa ROAS tùy chỉnh'))!;
      expect(ad.attributedRevenue).toBe(6_132_728);
      expect(ad.spend).toBe(460_119);
      const row = (key: string, channel: string, dimension: string, date: string) =>
        ds.salesSummaries!.find((x) => x.stage === 'placed' && x.key === key && x.channel === channel && x.dimension === dimension && x.date === date && x.periodStart === undefined)!;
      expect(row('Đề xuất', 'product_card', 'source', '2026-07-24').gmv).toBe(291_440);
      expect(row('live', 'live', 'channel', '2026-07-25').gmv).toBe(27_000);
    });

    it('A2 — fractional orders are kept, never rounded', () => {
      const mix = channelMix(ds, FULL, 'placed');
      const card = mix.channels.find((c) => c.channel === 'product_card')!;
      expect(card.orders).toBe(391.5); // the days add up to 391,51
      expect(card.sources.find((x) => x.key === 'Đề xuất')!.orders).toBe(127.92);
      expect(mix.channels.find((c) => c.channel === 'affiliate')!.orders).toBe(110);
      // Shared attribution: channel orders need not add up to the shop's orders (here they happen to: 519).
    });

    it('A3 — Vietnamese number formats and "-" as missing', () => {
      expect(toNumber('67.348.702')).toBe(67_348_702);
      expect(toNumber('129.766,29')).toBe(129_766.29);
      expect(toRate('4,90%')).toBeCloseTo(0.049, 10);
      expect(toNumber('-')).toBeUndefined();
      expect(ds.liveSessions.find((x) => x.title?.includes('MEGA LIVE'))!.avgWatchSeconds).toBe(32);
      const khac = ds.ads.find((a) => a.adName === 'Khác' && a.date === '2026-07-31' && a.periodStart === undefined)!;
      expect(khac.spend).toBeUndefined(); // null, not 0
      expect(khac.orders).toBeUndefined();
      expect(khac.impressions).toBeUndefined();
      expect(khac.attributedRevenue).toBe(0); // the file says "0" for sales on that row
      expect(ds.ads.filter((a) => a.adName === 'Khác' && a.periodStart === undefined)).toHaveLength(30); // 24/07 … 22/08, no shift
      const row = adsIntelligence(ds, FULL).campaigns.find((c) => c.name === 'Khác')!;
      expect(row.spend).toBeNull();
      expect(row.roas).toBeNull();
    });

    it('A4 — shares are recomputed from sales', () => {
      const card = channelMix(ds, FULL, 'placed').channels.find((c) => c.channel === 'product_card')!;
      expect(card.sources.find((x) => x.key === 'Đề xuất')!.share).toBeCloseTo(17_408_530 / 50_197_987, 10);
    });

    it('A5 — distinct counts over part of the period are labelled; rates from sums', () => {
      const part = computeKpis(ds, { range: { start: '2026-08-01', end: '2026-08-07' } }).metrics;
      expect(part.buyers.status).toBe('partial');
      expect(part.buyers.label?.vi).toBe('Lượt người mua (cộng theo ngày)');
      expect(part.visits.label?.vi).toBe('Lượt truy cập (cộng theo ngày)');
      const days = ds.dailyMetrics.filter((d) => d.date >= '2026-08-01' && d.date <= '2026-08-07');
      const sum = (f: (d: (typeof days)[number]) => number | undefined) => days.reduce((s, d) => s + (f(d) ?? 0), 0);
      expect(part.cvr.value).toBeCloseTo(sum((d) => d.placedOrders) / sum((d) => d.productClicks), 12);
      expect(part.aov.value).toBeCloseTo(sum((d) => d.paidGmv) / sum((d) => d.paidOrders), 8);
      // Channel table over part of the period = the shop's daily sales, nothing counted twice.
      expect(channelMix(ds, { range: { start: '2026-08-01', end: '2026-08-07' } }).total).toBe(sum((d) => d.placedGmv));
      expect(channelMix(ds, { range: { start: '2026-08-01', end: '2026-08-07' } }).uniqueIsDistinct).toBe(false);
    });

    it('A6 — top lists hold exactly 5 rows', () => {
      const sp = summaryProducts(ds, FULL);
      expect(sp.byChannel.map((c) => c.rows.length)).toEqual([5, 5, 5, 5]);
      expect(ds.liveSessions).toHaveLength(5);
      expect(ds.affiliates.filter((a) => a.contentType === 'shop_video')).toHaveLength(5);
      expect(ds.affiliates.filter((a) => a.contentType === 'affiliate')).toHaveLength(5);
      expect(sp.notes[0].vi).toContain('Top 5');
      // A product in two channels has no summed buyer count.
      expect(sp.rows.find((x) => x.sku === '26061744778')!.buyers).toBeNull();
    });

    it('period-only live sessions go to "Không rõ ngày", never onto a day or weekday', () => {
      const la = liveAudit(ds, FULL);
      expect(la.sessions).toHaveLength(5);
      expect(la.byWeekday).toHaveLength(0);
      expect(la.byTimeSlot).toHaveLength(0);
      expect(la.undated!.label.vi).toBe('Không rõ ngày');
      expect(la.undated!.sessions).toBe(5);
      expect(la.notes.some((n) => n.vi.includes('"Không rõ ngày"'))).toBe(true);
      expect(sessionDateLabel(la.sessions[0].session)).toBe('Không rõ ngày (tổng kỳ 24/07–22/08)');
      expect(breakdown(ds, FULL, 'liveSession').rows.every((r) => !r.label.startsWith('22/08'))).toBe(true);
      // Not used by any day-based alert either.
      expect(detectAlerts(ds, { day: '2026-08-22' }).some((a) => a.type.startsWith('live'))).toBe(false);
    });
  });

  describe('B — features from data already in the file', () => {
    it('B1 subsidy dependence by day and week', () => {
      const day = subsidyDependence(ds, FULL, 'day');
      expect(day.points).toHaveLength(30);
      const d25 = day.points.find((p) => p.key === '2026-07-25')!;
      expect(d25.subsidy).toBe(7_330_600 - 5_888_500);
      expect(d25.share).toBeCloseTo((7_330_600 - 5_888_500) / 7_330_600, 12);
      expect(day.total!.share).toBeCloseTo((67_348_702 - 54_364_855) / 67_348_702, 12);
      const week = subsidyDependence(ds, FULL, 'week');
      expect(week.points.reduce((s, p) => s + p.days, 0)).toBe(30);
      expect(week.points.reduce((s, p) => s + p.gmv, 0)).toBe(67_348_702);
    });

    it('B2 source drivers add up to the change', () => {
      const d = sourceDrivers(ds, { start: '2026-07-26', end: '2026-08-08' }, { start: '2026-08-09', end: '2026-08-22' });
      expect(d.available).toBe(true);
      const total = d.after.gmvPerDay - d.before.gmvPerDay;
      expect(d.channels.reduce((s, c) => s + c.delta, 0)).toBeCloseTo(total, 6);
      expect(d.channels.reduce((s, c) => s + (c.shareOfChange ?? 0), 0)).toBeCloseTo(1, 10);
      const cardSources = d.sources.filter((x) => x.channel === 'product_card');
      const card = d.channels.find((c) => c.channel === 'product_card')!;
      expect(cardSources.reduce((s, x) => s + x.delta, 0)).toBeCloseTo(card.delta, 6);
    });

    it('B3 placed → paid by channel and source', () => {
      const f = stageFunnel(ds, FULL);
      const card = f.rows.find((r) => r.channel === 'product_card' && r.source === null)!;
      expect(card.placed.gmv).toBe(50_197_987);
      expect(card.confirmed.gmv).toBe(41_562_507);
      expect(card.paid.gmv).toBe(37_672_177);
      expect(card.paidRateGmv).toBeCloseTo(37_672_177 / 50_197_987, 12);
      expect(f.rows.some((r) => r.channel === 'product_card' && r.source === 'Đề xuất')).toBe(true);
    });

    it('B4 Live channel by weekday: fewer than 3 days with live sales → not enough data', () => {
      // The shop sold through Live on one day only (25/07).
      const w = channelWeekday(ds, FULL, 'live');
      expect(w.activeDays).toBe(1);
      expect(w.available).toBe(false);
      expect(w.buckets).toHaveLength(0);
      expect(w.notes[0].vi).toContain('Chưa đủ dữ liệu');
      // Product-card sales exist every day → weekday view is shown, weekdays with < 2 sample days are withheld.
      const card = channelWeekday(ds, { range: { start: '2026-07-24', end: '2026-08-02' } }, 'product_card');
      expect(card.available).toBe(true);
      for (const b of card.buckets) {
        expect(b.insufficient).toBe(b.days < 2);
        if (b.insufficient) expect(b.gmvPerDay).toBeNull();
      }
      expect(card.buckets.some((b) => b.insufficient)).toBe(true);
      expect(card.buckets.some((b) => !b.insufficient)).toBe(true);
    });

    it('B5 new vs existing buyers', () => {
      const t = customerTrend(ds, FULL, 'day');
      expect(t.points.find((p) => p.key === '2026-07-25')!.newBuyers).toBe(26);
      expect(t.periodTotal).toEqual({ buyers: 453, newBuyers: 372, existingBuyers: 81, potentialBuyers: 1031, repeatRate: 0.106, newShare: 372 / 453 });
      expect(t.notes.some((n) => n.vi.includes('RFM'))).toBe(true);
    });

    it('B6 unique CTR from distinct impressions / clicks', () => {
      const card = channelMix(ds, FULL).channels.find((c) => c.channel === 'product_card')!;
      expect(card.uniqueImpressions).toBe(50_270);
      expect(card.uniqueClicks).toBe(3_512);
      expect(card.uniqueCtr).toBeCloseTo(3_512 / 50_270, 12);
    });
  });

  // ------------------------------------------------------------------ part of the period
  describe('part of the period 24/07–31/07 (daily rows, no period totals)', () => {
    const WEEK = { range: { start: '2026-07-24', end: '2026-07-31' } };
    const m = computeKpis(ds, WEEK).metrics;

    it('additive figures are sums of the 8 days', () => {
      expect(m.placedGmv.value).toBe(14_074_320);
      expect(m.orders.value).toBe(119);
      expect(m.gmv.value).toBe(13_394_344);
      expect(m.validOrders.value).toBe(114);
      expect(m.cancelledOrders.value).toBe(24);
      expect(m.refundedOrders.value).toBe(1);
      const days = ds.dailyMetrics.filter((d) => d.date >= '2026-07-24' && d.date <= '2026-07-31');
      expect(days).toHaveLength(8);
      expect(days.reduce((s, d) => s + (d.confirmedGmv ?? 0), 0)).toBe(10_882_560);
      expect(days.reduce((s, d) => s + (d.confirmedOrders ?? 0), 0)).toBe(108);
      expect(subsidyDependence(ds, WEEK).total!.noSubsidyGmv).toBe(11_613_840);
      expect(channelMix(ds, WEEK).total).toBe(14_074_320);
    });

    it('conversion = orders / clicks = 119 / 2.530 = 4,70%', () => {
      expect(m.cvr.value).toBe(119 / 2530);
      expect(Math.round(m.cvr.value! * 10_000) / 100).toBe(4.7);
      expect(m.aov.value).toBe(13_394_344 / 114);
      expect(m.cancelRate.value).toBe(24 / 119);
    });

    it('distinct counts are relabelled sums of daily values, without mismatch warnings', () => {
      expect(m.buyers.value).toBe(110);
      expect(m.buyers.status).toBe('partial');
      expect(m.buyers.label?.vi).toBe('Lượt người mua (cộng theo ngày)');
      expect(m.visits.value).toBe(4056);
      expect(m.visits.label?.vi).toBe('Lượt truy cập (cộng theo ngày)');
      for (const key of ['buyers', 'visits', 'orders', 'placedGmv', 'cvr'] as const) expect(m[key].warning, key).toBeUndefined();
      const t = customerTrend(ds, WEEK);
      expect(t.periodTotal).toBeNull(); // no distinct totals for part of the period
      expect(t.points.reduce((s, p) => s + (p.newBuyers ?? 0), 0)).toBe(86);
      expect(t.points.reduce((s, p) => s + (p.existingBuyers ?? 0), 0)).toBe(24);
    });

    it('period-only rows (Top 5 products, live sessions) are left out', () => {
      expect(summaryProducts(ds, WEEK).available).toBe(false);
      expect(liveAudit(ds, WEEK).sessions).toHaveLength(0);
      expect(channelMix(ds, WEEK).uniqueIsDistinct).toBe(false);
    });
  });
});

import { describe, expect, it } from 'vitest';
import { calendarPerformance, campaignCalendar, compareCampaigns, dayTypeOf, weekdayIndex } from '../campaignEngine';
import { adsIntelligence, compareSessions, liveAudit, videoAffiliate } from '../growthEngines';
import { computeKpis } from '../kpiEngine';
import { buildDemoCanonicalDataset } from '../../data/demoCanonicalDataset';
import { baseFixture, dataset, line, order } from './fixtures';

const demo = buildDemoCanonicalDataset();
const ALL = { range: { start: '2025-07-01', end: '2025-09-30' } };
const SEP = { range: { start: '2025-09-01', end: '2025-09-30' } };

describe('campaign & calendar', () => {
  it('weekday index is Monday-based', () => {
    expect(weekdayIndex('2025-09-22')).toBe(0); // Monday
    expect(weekdayIndex('2025-09-28')).toBe(6); // Sunday
  });

  it('classifies days from the campaign calendar, weekends otherwise', () => {
    const cal = campaignCalendar(demo);
    expect(dayTypeOf('2025-09-09', cal)).toBe('double_day');
    expect(dayTypeOf('2025-09-15', cal)).toBe('payday');
    expect(dayTypeOf('2025-09-20', cal)).toBe('weekend');
    expect(dayTypeOf('2025-09-17', cal)).toBe('weekday');
  });

  it('auto-recognises only double days when no calendar exists (paydays are not guessed)', () => {
    const noCal = { ...demo, campaigns: [] };
    const cal = campaignCalendar(noCal, SEP.range);
    expect(cal.map((c) => c.range.start)).toEqual(['2025-09-09']);
    expect(cal[0].auto).toBe(true);
    const perf = calendarPerformance(noCal, SEP);
    expect(perf.byDayType.find((b) => b.key === 'payday')).toBeUndefined();
    expect(perf.warnings.some((w) => w.vi.includes('tự nhận diện ngày đôi'))).toBe(true);
  });

  it('buckets add up to every analysed day and GMV', () => {
    const perf = calendarPerformance(demo, ALL);
    expect(perf.byDayType.reduce((s, b) => s + b.days, 0)).toBe(92);
    const total = perf.byDayType.reduce((s, b) => s + (b.gmvPerDay ?? 0) * b.days, 0);
    expect(total).toBeCloseTo(computeKpis(demo, ALL).metrics.gmv.value!, 2);
    expect(perf.byDayType.find((b) => b.key === 'weekday')?.upliftVsWeekday).toBe(0);
    expect(perf.byDayType.find((b) => b.key === 'double_day')!.upliftVsWeekday!).toBeGreaterThan(1);
    // weekday table excludes sale days
    expect(perf.byWeekday.reduce((s, b) => s + b.days, 0)).toBe(perf.saleVsNormal.normal.days);
  });

  it('warns that one month is not enough to infer a pattern', () => {
    const perf = calendarPerformance(demo, SEP);
    expect(perf.warnings[0].vi).toContain('chưa đủ để kết luận một quy luật');
  });

  it('compares 8.8 with 9.9 including uplift vs the normal days before', () => {
    const cal = campaignCalendar(demo).filter((c) => c.type === 'double_day');
    const cmp = compareCampaigns(demo, cal[1], cal[2]);
    expect(cmp.a.entry.range.start).toBe('2025-08-08');
    expect(cmp.b.entry.range.start).toBe('2025-09-09');
    expect(cmp.a.baselineGmvPerDay).toBeGreaterThan(0);
    expect(cmp.b.uplift!).toBeGreaterThan(1);
    expect(cmp.changes.gmv.current).toBe(cmp.b.kpis.metrics.gmv.value);
    expect(cmp.b.topSkus.length).toBeGreaterThan(0);
    // 7.7 has no 14 days of history before it → no baseline instead of a guess
    expect(compareCampaigns(demo, cal[0], cal[1]).a.baselineGmvPerDay).toBeNull();
  });
});

describe('ads intelligence', () => {
  const ai = adsIntelligence(demo, SEP);
  it('flags spend below break-even ROAS', () => {
    const noi = ai.campaigns.find((c) => c.sku === 'NOI-CHIEN-5L')!;
    expect(noi.efficiency).toBe('below_break_even');
    expect(ai.spendBelowBreakEven).toBeCloseTo(noi.spend, 6);
    expect(ai.campaigns.reduce((s, c) => s + (c.spendShare ?? 0), 0)).toBeCloseTo(1, 10);
  });
  it('builds a daily series and per-platform totals', () => {
    expect(ai.daily).toHaveLength(30);
    expect(ai.daily.reduce((s, d) => s + d.spend, 0)).toBeCloseTo(ai.totals.spend, 4);
    expect(ai.byPlatform.reduce((s, p) => s + p.spend, 0)).toBeCloseTo(ai.totals.spend, 4);
  });
});

describe('live auditor', () => {
  const la = liveAudit(demo, SEP);
  it('normalizes by duration and groups by slot, weekday and length', () => {
    expect(la.totals.sessions).toBe(la.sessions.length);
    expect(la.byTimeSlot.reduce((s, g) => s + g.sessions, 0)).toBe(la.sessions.length);
    expect(la.byDuration.reduce((s, g) => s + g.sessions, 0)).toBe(la.sessions.length);
    const ranks = la.ranking.map((r) => r.gmvPerHour!);
    expect([...ranks].sort((a, b) => b - a)).toEqual(ranks);
  });
  it('compares two sessions', () => {
    const [b, a] = la.sessions;
    const cmp = compareSessions(a, b);
    expect(cmp.changes.viewers.current).toBe(b.session.viewers);
    expect(cmp.changes.viewers.previous).toBe(a.session.viewers);
  });
  it('reports sessions without a start time', () => {
    const ds = dataset([], [], { liveSessions: [{ sessionId: 'x', platform: 'tiktok', date: '2025-09-01', viewers: 10, orders: 1, gmv: 100, durationMinutes: 60 }] });
    const r = liveAudit(ds, { range: { start: '2025-09-01', end: '2025-09-01' } });
    expect(r.byTimeSlot).toEqual([]);
    expect(r.notes[0].vi).toContain('không có giờ bắt đầu');
  });
});

describe('video & affiliate', () => {
  const va = videoAffiliate(demo, SEP, { start: '2025-08-01', end: '2025-08-31' });
  it('splits content by kind and computes rates', () => {
    expect(va.byKind.map((k) => k.kind)).toEqual(['affiliate', 'shop_video']);
    const c = va.creators[0];
    expect(c.commissionRate).toBeGreaterThan(0.09);
    expect(c.cvr).not.toBeNull();
    expect(c.gmvChange.previous).not.toBeNull();
  });
  it('attributes profit to creators and videos from the orders', () => {
    const creatorProfit = va.creators.reduce((s, c) => s + (c.profit ?? 0), 0);
    expect(creatorProfit).toBeGreaterThan(0);
    const v = va.videos[0];
    expect(v.kind).toBe('shop_video');
    expect(v.profit).not.toBeNull();
    expect(v.title).toBeTruthy();
  });
  it('is unavailable without affiliate data and notes missing attribution', () => {
    expect(videoAffiliate(baseFixture(), { range: { start: '2025-09-01', end: '2025-09-02' } }).available).toBe(false);
    const ds = dataset(
      [order({ orderId: 'a', orderDate: '2025-09-01', status: 'completed' })],
      [line({ orderId: 'a', sku: 'X', quantity: 1, grossAmount: 100 })],
      { affiliates: [{ date: '2025-09-01', platform: 'tiktok', creatorId: 'k1', orders: 1, gmv: 100, commission: 10 }] },
    );
    const r = videoAffiliate(ds, { range: { start: '2025-09-01', end: '2025-09-01' } });
    expect(r.creators[0].profit).toBeNull();
    expect(r.notes[0].vi).toContain('không ghi nguồn affiliate');
  });
});

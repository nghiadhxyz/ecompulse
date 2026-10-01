import { describe, expect, it } from 'vitest';
import { beforeAfter, changeImpact } from '../changeImpact';
import { measureAction, planProgress, dayTypeWeights, isOverdue, type ActionItem } from '../planningEngine';
import { buildReport } from '../reportEngine';
import { computeKpis } from '../kpiEngine';
import { buildDemoCanonicalDataset } from '../../data/demoCanonicalDataset';
import { reportToCsv, reportToWorkbook, planToIcs } from '../../utils/reportExport';

const demo = buildDemoCanonicalDataset();

describe('change impact', () => {
  const ev = demo.changeEvents.find((e) => e.id === 'chg-2')!; // ads budget +50% Nồi chiên, 01/09

  it('compares equal-length windows right before and after the change', () => {
    const r = changeImpact(demo, ev);
    const w14 = r.windows.find((w) => w.days === 14)!;
    expect(w14.before).toEqual({ start: '2025-08-18', end: '2025-08-31' });
    expect(w14.after).toEqual({ start: '2025-09-01', end: '2025-09-14' });
    const gmvAfter = computeKpis(demo, { range: w14.after, skus: ['NOI-CHIEN-5L'], platforms: ['tiktok'] }).metrics.gmv.value;
    expect(w14.metrics[0].change.current).toBe(gmvAfter);
  });

  it('shortens both sides when the data ends early', () => {
    const r = beforeAfter(demo, {}, '2025-09-20', [30]);
    expect(r.windows[0].usedDays).toBe(11);
    expect(r.windows[0].complete).toBe(false);
    expect(r.windows[0].before.start).toBe('2025-09-09');
  });

  it('uses the rest of the shop as a reference for SKU changes and never claims causation', () => {
    const r = changeImpact(demo, ev);
    expect(r.windows[0].reference).not.toBeNull();
    expect(r.notes.some((n) => n.vi.includes('không chứng minh'))).toBe(true);
    expect(r.windows.map((w) => w.summary.vi).join(' ')).not.toMatch(/do thay đổi|gây ra/);
  });

  it('handles a new product without inventing a comparison', () => {
    const r = changeImpact(demo, demo.changeEvents.find((e) => e.id === 'chg-4')!);
    expect(r.windows[0].summary.vi).toContain('chưa có doanh số');
  });

  it('reports missing data around the date', () => {
    expect(beforeAfter(demo, {}, '2025-12-01').unavailable).toBeDefined();
    expect(beforeAfter(demo, {}, '2025-07-01').unavailable).toBeDefined();
  });
});

describe('monthly planning', () => {
  it('daily targets add up to the monthly target and follow the shop day-type pattern', () => {
    const p = planProgress(demo, { month: '2025-10', targetGmv: 1_800_000_000, events: [] });
    const sum = p.days.reduce((s, d) => s + d.target, 0);
    expect(sum).toBeCloseTo(1_800_000_000, 0);
    const d1010 = p.days.find((d) => d.date === '2025-10-10')!;
    const d1009 = p.days.find((d) => d.date === '2025-10-09')!;
    expect(d1010.dayType).toBe('double_day');
    expect(d1010.target).toBeGreaterThan(d1009.target * 2);
    expect(p.toDate).toBeNull(); // no data in October
  });

  it('tracks progress to date against the plan', () => {
    const p = planProgress(demo, { month: '2025-09', targetGmv: 1_700_000_000, platformTargets: { lazada: 400_000_000 }, events: [] });
    const actual = computeKpis(demo, { range: { start: '2025-09-01', end: '2025-09-30' } }).metrics.gmv.value!;
    expect(p.toDate!.actual).toBe(actual);
    expect(p.toDate!.ratio).toBeCloseTo(actual / 1_700_000_000, 6);
    expect(p.platforms[0].ratio!).toBeLessThan(0.7);
  });

  it('weights need enough samples', () => {
    const w = dayTypeWeights(demo, '2025-10-01');
    expect(w.find((x) => x.dayType === 'weekday')!.weight).toBe(1);
    expect(w.find((x) => x.dayType === 'double_day')!.weight).toBeGreaterThan(2);
    expect(w.find((x) => x.dayType === 'mega_sale')!.fallback).toBe(true);
  });
});

describe('actions', () => {
  const base: ActionItem = { id: 'a', title: 'x', metric: 'gmv', scope: { skus: ['SERUM-B5'] }, status: 'todo', createdAt: '2025-09-01', deadline: '2025-09-10' };
  it('is measured only once done', () => {
    expect(measureAction(demo, base).window).toBeNull();
    const r = measureAction(demo, { ...base, status: 'done', doneDate: '2025-09-05' });
    expect(r.window?.days).toBe(14);
    expect(r.window?.after.start).toBe('2025-09-05');
  });
  it('flags overdue open actions', () => {
    expect(isOverdue(base, '2025-09-30')).toBe(true);
    expect(isOverdue({ ...base, status: 'done' }, '2025-09-30')).toBe(false);
  });
});

describe('reports & exports', () => {
  it('builds every report type from the engine numbers', () => {
    const plan = { month: '2025-09', targetGmv: 1.7e9, events: [{ id: 'e', date: '2025-09-09', title: 'Sale 9.9', kind: 'campaign' as const }] };
    for (const type of ['daily', 'weekly', 'monthly', 'campaign', 'live', 'planning'] as const) {
      const r = buildReport(demo, type, { asOf: '2025-09-30', plan, range: { start: '2025-09-01', end: '2025-09-30' } });
      expect(r, type).not.toBeNull();
      expect(r!.tables.length).toBeGreaterThan(0);
    }
    const m = buildReport(demo, 'monthly', { asOf: '2025-09-30', month: '2025-09' })!;
    const gmvRow = m.tables[0].rows[0];
    expect('v' in gmvRow[1] && gmvRow[1].v).toBe(computeKpis(demo, { range: { start: '2025-09-01', end: '2025-09-30' } }).metrics.gmv.value);
  });

  it('CSV keeps numbers raw and missing values empty', () => {
    const r = buildReport(demo, 'monthly', { asOf: '2025-09-30', month: '2025-09' })!;
    const csv = reportToCsv(r);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('GMV (đơn đặt),1751991000');
  });

  it('Excel has one sheet per table plus a summary', () => {
    const r = buildReport(demo, 'weekly', { asOf: '2025-09-30' })!;
    expect(reportToWorkbook(r).SheetNames.length).toBe(r.tables.length + 1);
  });

  it('ICS contains plan events and open action deadlines only', () => {
    const ics = planToIcs({ month: '2025-10', targetGmv: 1, events: [{ id: 'e1', date: '2025-10-10', title: 'Sale 10.10', kind: 'campaign' }] }, [
      { id: 'a1', title: 'Kiểm tra tồn kho', metric: 'gmv', scope: {}, status: 'todo', createdAt: '2025-09-30', deadline: '2025-10-05' },
      { id: 'a2', title: 'Xong rồi', metric: 'gmv', scope: {}, status: 'done', createdAt: '2025-09-30', deadline: '2025-10-06' },
    ]);
    expect(ics).toContain('DTSTART;VALUE=DATE:20251010');
    expect(ics).toContain('SUMMARY:Hạn: Kiểm tra tồn kho');
    expect(ics).not.toContain('Xong rồi');
  });
});

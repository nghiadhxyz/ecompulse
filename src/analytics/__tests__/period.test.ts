import { describe, expect, it } from 'vitest';
import {
  addDays,
  comparableRange,
  defaultComparisonMode,
  formatRangeVi,
  isIsoDate,
  rangeLength,
  resolvePreset,
  shiftMonths,
} from '../period';

describe('period presets', () => {
  const asOf = '2025-09-15';
  it('resolves today / yesterday / 7 / 30 days', () => {
    expect(resolvePreset('today', asOf)).toEqual({ start: asOf, end: asOf });
    expect(resolvePreset('yesterday', asOf)).toEqual({ start: '2025-09-14', end: '2025-09-14' });
    expect(resolvePreset('last7', asOf)).toEqual({ start: '2025-09-09', end: asOf });
    expect(rangeLength(resolvePreset('last30', asOf))).toBe(30);
  });

  it('this month is month-to-date, last month is the full month', () => {
    expect(resolvePreset('thisMonth', asOf)).toEqual({ start: '2025-09-01', end: asOf });
    expect(resolvePreset('lastMonth', asOf)).toEqual({ start: '2025-08-01', end: '2025-08-31' });
  });

  it('normalizes reversed custom ranges', () => {
    expect(resolvePreset('custom', asOf, { start: '2025-09-10', end: '2025-09-01' })).toEqual({ start: '2025-09-01', end: '2025-09-10' });
  });
});

describe('comparable periods', () => {
  it('partial month compares to the same days of the previous month (01–15/09 → 01–15/08)', () => {
    expect(comparableRange({ start: '2025-09-01', end: '2025-09-15' }, 'mom')).toEqual({ start: '2025-08-01', end: '2025-08-15' });
  });

  it('never compares a partial month to a whole month', () => {
    const prev = comparableRange({ start: '2025-09-01', end: '2025-09-15' }, 'mom');
    expect(rangeLength(prev)).toBe(15);
  });

  it('full month compares to the full previous month, clamping to its length', () => {
    expect(comparableRange({ start: '2025-03-01', end: '2025-03-31' }, 'mom')).toEqual({ start: '2025-02-01', end: '2025-02-28' });
    expect(comparableRange({ start: '2024-03-01', end: '2024-03-31' }, 'mom')).toEqual({ start: '2024-02-01', end: '2024-02-29' });
  });

  it('clamps month-end days for partial ranges', () => {
    expect(comparableRange({ start: '2025-03-01', end: '2025-03-30' }, 'mom')).toEqual({ start: '2025-02-01', end: '2025-02-28' });
  });

  it('handles year boundary and YoY leap day', () => {
    expect(comparableRange({ start: '2025-01-01', end: '2025-01-10' }, 'mom')).toEqual({ start: '2024-12-01', end: '2024-12-10' });
    expect(comparableRange({ start: '2024-02-29', end: '2024-02-29' }, 'yoy')).toEqual({ start: '2023-02-28', end: '2023-02-28' });
  });

  it('previous / DoD / WoW windows', () => {
    const r = { start: '2025-09-09', end: '2025-09-15' };
    expect(comparableRange(r, 'previous')).toEqual({ start: '2025-09-02', end: '2025-09-08' });
    expect(comparableRange(r, 'wow')).toEqual({ start: '2025-09-02', end: '2025-09-08' });
    expect(comparableRange({ start: '2025-09-15', end: '2025-09-15' }, 'dod')).toEqual({ start: '2025-09-14', end: '2025-09-14' });
  });

  it('picks a sensible default comparison per preset', () => {
    expect(defaultComparisonMode('yesterday')).toBe('dod');
    expect(defaultComparisonMode('thisMonth')).toBe('mom');
    expect(defaultComparisonMode('last7')).toBe('previous');
  });
});

describe('date helpers', () => {
  it('validates ISO dates', () => {
    expect(isIsoDate('2025-02-29')).toBe(false);
    expect(isIsoDate('2024-02-29')).toBe(true);
    expect(isIsoDate('01/09/2025')).toBe(false);
  });
  it('adds days across months and shifts months with clamping', () => {
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01');
    expect(shiftMonths('2025-03-31', -1)).toBe('2025-02-28');
  });
  it('formats Vietnamese range labels', () => {
    expect(formatRangeVi({ start: '2025-09-01', end: '2025-09-15' })).toBe('01–15/09/2025');
    expect(formatRangeVi({ start: '2025-09-15', end: '2025-09-15' })).toBe('15/09/2025');
  });
});

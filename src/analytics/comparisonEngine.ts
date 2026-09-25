/**
 * Comparison Engine — current vs previous for any metric.
 *
 *   absoluteDelta         = current − previous                   (in the metric's unit)
 *   percentageDelta       = (current − previous) / |previous|    (relative change, ratio)
 *   percentagePointDelta  = (current − previous) × 100           (rates only, in pp)
 *
 * Example CVR 4.2% → 4.6%: percentagePointDelta = +0.4pp, percentageDelta = +9.52%.
 * `|previous|` keeps the sign meaningful when the base is negative (loss → smaller loss = up).
 */
import type { CanonicalDataset } from './model';
import type { DatasetFilter } from './filters';
import { computeKpis, KPI_KEYS, type KpiKey, type KpiSet } from './kpiEngine';
import { comparableRange, type ComparisonMode, type DateRange } from './period';
import type { Bilingual, MetricResult, MetricUnit } from './metric';

export type Direction = 'up' | 'down' | 'flat' | 'unknown';

export interface Comparison {
  current: number | null;
  previous: number | null;
  absoluteDelta: number | null;
  /** Relative change as a ratio (0.0952 = +9.52%). Null when previous is 0 or missing. */
  percentageDelta: number | null;
  /** Only for ratio metrics: change in percentage points (0.4 = +0.4pp). */
  percentagePointDelta?: number | null;
  direction: Direction;
}

export interface MetricComparison extends Comparison {
  unit: MetricUnit;
  currentStatus: MetricResult['status'];
  previousStatus: MetricResult['status'];
  notes: Bilingual[];
}

const EPSILON = 1e-9;

export function compareValues(current: number | null, previous: number | null, unit: MetricUnit): Comparison {
  const isRate = unit === 'ratio';
  if (current === null || previous === null) {
    return {
      current,
      previous,
      absoluteDelta: null,
      percentageDelta: null,
      ...(isRate ? { percentagePointDelta: null } : {}),
      direction: 'unknown',
    };
  }
  const absoluteDelta = current - previous;
  let percentageDelta: number | null;
  if (Math.abs(previous) < EPSILON) percentageDelta = Math.abs(current) < EPSILON ? 0 : null;
  else percentageDelta = absoluteDelta / Math.abs(previous);
  const direction: Direction = Math.abs(absoluteDelta) < EPSILON ? 'flat' : absoluteDelta > 0 ? 'up' : 'down';
  return {
    current,
    previous,
    absoluteDelta,
    percentageDelta,
    ...(isRate ? { percentagePointDelta: absoluteDelta * 100 } : {}),
    direction,
  };
}

export function compareMetric(current: MetricResult, previous: MetricResult): MetricComparison {
  const base = compareValues(current.value, previous.value, current.unit);
  const notes: Bilingual[] = [];
  if (previous.value === null) {
    notes.push({ vi: 'Chưa có dữ liệu kỳ trước để so sánh.', en: 'No previous-period data to compare.' });
  } else if (base.percentageDelta === null && base.absoluteDelta !== null) {
    notes.push({ vi: 'Kỳ trước bằng 0 nên không tính được % thay đổi.', en: 'Previous value is 0; % change is undefined.' });
  }
  if (current.status === 'partial' || previous.status === 'partial') {
    notes.push({ vi: 'Một trong hai kỳ có dữ liệu chưa đầy đủ.', en: 'One of the periods has incomplete data.' });
  }
  return { ...base, unit: current.unit, currentStatus: current.status, previousStatus: previous.status, notes };
}

export interface PeriodComparison {
  mode: ComparisonMode;
  currentRange: DateRange;
  previousRange: DateRange;
  current: KpiSet;
  previous: KpiSet;
  metrics: Record<KpiKey, MetricComparison>;
}

export function comparePeriods(dataset: CanonicalDataset, filter: DatasetFilter, mode: ComparisonMode): PeriodComparison {
  return { ...compareRanges(dataset, filter, comparableRange(filter.range, mode)), mode };
}

/** Compare against any explicit previous range (e.g. a user-chosen comparison period). */
export function compareRanges(dataset: CanonicalDataset, filter: DatasetFilter, previousRange: DateRange): PeriodComparison {
  const mode: ComparisonMode = 'previous';
  const current = computeKpis(dataset, filter);
  const previous = computeKpis(dataset, { ...filter, range: previousRange });
  const metrics = {} as Record<KpiKey, MetricComparison>;
  for (const k of KPI_KEYS) metrics[k] = compareMetric(current.metrics[k], previous.metrics[k]);
  return { mode, currentRange: filter.range, previousRange, current, previous, metrics };
}

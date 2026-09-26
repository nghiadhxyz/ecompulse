/**
 * Monthly planning & action tracking.
 *
 * Plan: the user sets a GMV target for a month (optionally per platform). It is spread
 * over the days with weights learned from the shop's own history — average GMV per day
 * type (weekday, weekend, payday, double day, mega sale) relative to weekdays. Day types
 * with too few samples fall back to weight 1 and are listed in the notes.
 *
 * Progress compares actual GMV to the plan up to the last data day. The end-of-month
 * projection is labelled an estimate: it assumes the rest of the month keeps the same
 * ratio to plan as the days so far.
 *
 * Actions: insight → evidence → action → owner → deadline → status → result. The result
 * of a finished action is a before/after comparison of its metric in its scope.
 */
import type { CanonicalDataset, Platform } from './model';
import { datasetDateBounds, type DatasetFilter } from './filters';
import type { EvidenceFilter } from './evidence';
import { breakdown } from './breakdownEngine';
import { campaignCalendar, dayTypeOf, DAY_TYPE_LABELS, type DayType } from './campaignEngine';
import { beforeAfter, type ImpactWindow } from './changeImpact';
import { addDays, endOfMonth, enumerateDays, shiftMonths, type DateRange } from './period';
import type { Bilingual } from './metric';
import type { KpiKey } from './kpiEngine';

export interface PlanEvent {
  id: string;
  date: string;
  title: string;
  kind: 'campaign' | 'live' | 'launch' | 'other';
}

export interface MonthlyPlan {
  /** YYYY-MM */
  month: string;
  targetGmv: number;
  platformTargets?: Partial<Record<Platform, number>>;
  note?: string;
  events: PlanEvent[];
}

export interface PlanDay {
  date: string;
  dayType: DayType;
  weight: number;
  target: number;
  actual: number | null;
  cumTarget: number;
  cumActual: number | null;
}

export interface PlanProgress {
  range: DateRange;
  days: PlanDay[];
  lastDataDay: string | null;
  toDate: { target: number; actual: number; gap: number; ratio: number | null } | null;
  /** Estimate — labelled as such in the UI. */
  projection: number | null;
  remainingTarget: number;
  /** GMV needed per remaining weekday-equivalent day to reach the target. */
  requiredPerWeekday: number | null;
  platforms: { platform: Platform; target: number; actual: number; ratio: number | null }[];
  weights: { dayType: DayType; label: Bilingual; weight: number; samples: number; fallback: boolean }[];
  notes: Bilingual[];
}

export function monthRange(month: string): DateRange {
  const start = `${month}-01`;
  return { start, end: endOfMonth(start) };
}

/** Relative GMV per day type from the 90 days before `before` (weekday = 1). */
export function dayTypeWeights(dataset: CanonicalDataset, before: string, platforms?: Platform[]) {
  const range = { start: addDays(before, -90), end: addDays(before, -1) };
  const rows = breakdown(dataset, { range, platforms }, 'day').rows;
  const cal = campaignCalendar(dataset);
  const acc = new Map<DayType, { sum: number; n: number }>();
  for (const r of rows) {
    const t = dayTypeOf(r.key, cal);
    const a = acc.get(t) ?? { sum: 0, n: 0 };
    a.sum += r.current.gmv;
    a.n += 1;
    acc.set(t, a);
  }
  const weekday = acc.get('weekday');
  const base = weekday && weekday.n >= 5 ? weekday.sum / weekday.n : null;
  const types: DayType[] = ['weekday', 'weekend', 'payday', 'double_day', 'mega_sale'];
  return types.map((t) => {
    const a = acc.get(t);
    const minSamples = t === 'weekday' || t === 'weekend' ? 4 : 2;
    const ok = base !== null && a !== undefined && a.n >= minSamples;
    return { dayType: t, label: DAY_TYPE_LABELS[t], weight: t === 'weekday' ? 1 : ok ? a!.sum / a!.n / base! : 1, samples: a?.n ?? 0, fallback: t !== 'weekday' && !ok };
  });
}

/** Suggestion only: GMV of the previous full month and of the same month last year. */
export function planBaselines(dataset: CanonicalDataset, month: string, platforms?: Platform[]) {
  const gmvOf = (range: DateRange) => {
    const rows = breakdown(dataset, { range, platforms }, 'day').rows;
    return rows.length >= Math.min(25, enumerateDays(range).length - 3) ? rows.reduce((s, r) => s + r.current.gmv, 0) : null;
  };
  const start = `${month}-01`;
  return { previousMonth: gmvOf(monthRange(shiftMonths(start, -1).slice(0, 7))), lastYear: gmvOf(monthRange(shiftMonths(start, -12).slice(0, 7))) };
}

export function planProgress(dataset: CanonicalDataset, plan: MonthlyPlan, platforms?: Platform[]): PlanProgress {
  const range = monthRange(plan.month);
  const notes: Bilingual[] = [];
  const weights = dayTypeWeights(dataset, range.start, platforms);
  const wOf = new Map(weights.map((w) => [w.dayType, w.weight]));
  const cal = campaignCalendar(dataset);
  const planDates = new Set(plan.events.filter((e) => e.kind === 'campaign').map((e) => e.date));
  const dates = enumerateDays(range);
  // Beyond the imported campaign calendar, double days (10.10, 11.11…) are calendar facts.
  const calEnd = cal.reduce((m, c) => (c.range.end > m ? c.range.end : m), '');
  const typeOf = (d: string): DayType => {
    if (planDates.has(d)) return 'mega_sale';
    const t = dayTypeOf(d, cal);
    if (d > calEnd && (t === 'weekday' || t === 'weekend') && Number(d.slice(5, 7)) === Number(d.slice(8, 10))) return 'double_day';
    return t;
  };
  const types = dates.map(typeOf);
  const totalW = types.reduce((s, t) => s + (wOf.get(t) ?? 1), 0);

  const actualRows = breakdown(dataset, { range, platforms }, 'day').rows;
  const actualBy = new Map(actualRows.map((r) => [r.key, r.current.gmv]));
  const dataEnd = datasetDateBounds(dataset)?.end ?? null;
  const lastDataDay = dataEnd && dataEnd >= range.start ? (dataEnd > range.end ? range.end : dataEnd) : null;

  let cumT = 0;
  let cumA = 0;
  const days: PlanDay[] = dates.map((d, i) => {
    const weight = wOf.get(types[i]) ?? 1;
    const target = totalW ? (plan.targetGmv * weight) / totalW : 0;
    cumT += target;
    const has = lastDataDay !== null && d <= lastDataDay;
    const actual = has ? actualBy.get(d) ?? 0 : null;
    if (actual !== null) cumA += actual;
    return { date: d, dayType: types[i], weight, target, actual, cumTarget: cumT, cumActual: has ? cumA : null };
  });

  const done = days.filter((d) => d.actual !== null);
  const toDate = done.length ? { target: done[done.length - 1].cumTarget, actual: cumA, gap: cumA - done[done.length - 1].cumTarget, ratio: done[done.length - 1].cumTarget ? cumA / done[done.length - 1].cumTarget : null } : null;
  const remainingDays = days.filter((d) => d.actual === null);
  const remainingW = remainingDays.reduce((s, d) => s + d.weight, 0);
  const remainingTarget = Math.max(0, plan.targetGmv - cumA);
  const projection = remainingDays.length > 0 && toDate && toDate.ratio !== null && done.length >= 5 ? cumA + remainingDays.reduce((s, d) => s + d.target, 0) * toDate.ratio : null;
  if (toDate && done.length < 5) notes.push({ vi: 'Chưa đủ 5 ngày dữ liệu trong tháng để ước tính cuối tháng.', en: 'Fewer than 5 days of data; no projection.' });

  const platformTargets = Object.entries(plan.platformTargets ?? {}).filter(([, v]) => v && v > 0) as [Platform, number][];
  const doneRange = lastDataDay ? { start: range.start, end: lastDataDay } : null;
  const byPlat = doneRange ? new Map(breakdown(dataset, { range: doneRange }, 'platform').rows.map((r) => [r.key, r.current.gmv])) : new Map<string, number>();
  const elapsedShare = toDate && plan.targetGmv ? toDate.target / plan.targetGmv : 0;
  const plats = platformTargets.map(([platform, target]) => {
    const actual = byPlat.get(platform) ?? 0;
    const expected = target * elapsedShare;
    return { platform, target, actual, ratio: expected ? actual / expected : null };
  });

  const fb = weights.filter((w) => w.fallback);
  if (fb.length) notes.push({ vi: `Chưa đủ lịch sử cho: ${fb.map((w) => w.label.vi).join(', ')} — tạm tính như ngày thường.`, en: `Not enough history for ${fb.map((w) => w.label.en).join(', ')}; treated as weekdays.` });
  notes.push({ vi: 'Mục tiêu theo ngày được chia theo tỷ lệ doanh thu từng loại ngày trong 90 ngày trước tháng kế hoạch. Dự phóng cuối tháng là ước tính, không phải cam kết.', en: 'Daily targets follow the 90-day day-type pattern. Projection is an estimate.' });

  return {
    range,
    days,
    lastDataDay,
    toDate,
    projection,
    remainingTarget,
    requiredPerWeekday: remainingW > 0 ? remainingTarget / remainingW : null,
    platforms: plats,
    weights,
    notes,
  };
}

// ─── Actions ────────────────────────────────────────────────────────────────

export type ActionStatus = 'todo' | 'doing' | 'done' | 'dropped';

export interface ActionItem {
  id: string;
  title: string;
  /** The insight that triggered the action (copied text). */
  insight?: string;
  evidence?: EvidenceFilter;
  metric: KpiKey;
  scope: Omit<DatasetFilter, 'range'>;
  owner?: string;
  deadline?: string;
  status: ActionStatus;
  createdAt: string;
  /** Date the action took effect (result is measured from here). */
  doneDate?: string;
  resultNote?: string;
}

export const ACTION_STATUS_LABELS: Record<ActionStatus, Bilingual> = {
  todo: { vi: 'Cần làm', en: 'To do' },
  doing: { vi: 'Đang làm', en: 'In progress' },
  done: { vi: 'Đã xong', en: 'Done' },
  dropped: { vi: 'Bỏ qua', en: 'Dropped' },
};

export interface ActionResult {
  window: ImpactWindow | null;
  unavailable?: Bilingual;
}

export function measureAction(dataset: CanonicalDataset, action: ActionItem, days = 14): ActionResult {
  if (action.status !== 'done' || !action.doneDate) return { window: null, unavailable: { vi: 'Đo kết quả khi hành động đã xong và có ngày áp dụng.', en: 'Measured once done with an effective date.' } };
  const r = beforeAfter(dataset, action.scope, action.doneDate, [days]);
  return { window: r.windows[0] ?? null, unavailable: r.unavailable };
}

export function isOverdue(action: ActionItem, asOf: string): boolean {
  return !!action.deadline && action.deadline < asOf && (action.status === 'todo' || action.status === 'doing');
}

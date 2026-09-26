/**
 * Planning state shared by the Phase 6 modules: change log, monthly plans and actions.
 * Persisted in IndexedDB per data source (demo / imported), never sent anywhere.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ActionItem, CanonicalDataset, ChangeEvent, MonthlyPlan } from '../../analytics';
import { EMPTY_PLANNING, loadPlanning, savePlanning, type PlanningState } from '../../utils/workspaceStore';

export interface PlanningApi {
  loaded: boolean;
  persisted: boolean;
  /** Change events from the data plus the user's own log, newest first. */
  changeEvents: (ChangeEvent & { userAdded: boolean })[];
  plans: MonthlyPlan[];
  actions: ActionItem[];
  addChange: (e: Omit<ChangeEvent, 'id'>) => void;
  removeChange: (id: string) => void;
  savePlan: (p: MonthlyPlan) => void;
  removePlan: (month: string) => void;
  addAction: (a: Omit<ActionItem, 'id' | 'status' | 'createdAt'> & Partial<Pick<ActionItem, 'status'>>) => string;
  updateAction: (id: string, patch: Partial<ActionItem>) => void;
  removeAction: (id: string) => void;
}

const PlanningContext = createContext<PlanningApi | null>(null);

const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function usePlanningState(dataset: CanonicalDataset | null, scope: 'demo' | 'imported', asOf: string | null): PlanningApi {
  const [state, setState] = useState<PlanningState>(EMPTY_PLANNING);
  const [loaded, setLoaded] = useState(false);
  const [persisted, setPersisted] = useState(true);
  const scopeRef = useRef(scope);

  useEffect(() => {
    let alive = true;
    scopeRef.current = scope;
    setLoaded(false);
    loadPlanning(scope).then((s) => {
      if (!alive) return;
      setState(s);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [scope]);

  const update = useCallback((fn: (s: PlanningState) => PlanningState) => {
    setState((prev) => {
      const next = fn(prev);
      savePlanning(scopeRef.current, next).then(setPersisted);
      return next;
    });
  }, []);

  const changeEvents = useMemo(() => {
    const own = new Set(state.changeEvents.map((e) => e.id));
    return [
      ...(dataset?.changeEvents ?? []).filter((e) => !own.has(e.id)).map((e) => ({ ...e, userAdded: false })),
      ...state.changeEvents.map((e) => ({ ...e, userAdded: true })),
    ].sort((a, b) => b.date.localeCompare(a.date));
  }, [dataset, state.changeEvents]);

  return {
    loaded,
    persisted,
    changeEvents,
    plans: state.plans,
    actions: state.actions,
    addChange: (e) => update((s) => ({ ...s, changeEvents: [...s.changeEvents, { ...e, id: uid('chg') }] })),
    removeChange: (id) => update((s) => ({ ...s, changeEvents: s.changeEvents.filter((e) => e.id !== id) })),
    savePlan: (p) => update((s) => ({ ...s, plans: [...s.plans.filter((x) => x.month !== p.month), p].sort((a, b) => a.month.localeCompare(b.month)) })),
    removePlan: (month) => update((s) => ({ ...s, plans: s.plans.filter((x) => x.month !== month) })),
    addAction: (a) => {
      const id = uid('act');
      update((s) => ({ ...s, actions: [{ status: 'todo', ...a, id, createdAt: asOf ?? new Date().toISOString().slice(0, 10) }, ...s.actions] }));
      return id;
    },
    updateAction: (id, patch) => update((s) => ({ ...s, actions: s.actions.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
    removeAction: (id) => update((s) => ({ ...s, actions: s.actions.filter((x) => x.id !== id) })),
  };
}

export const PlanningProvider: React.FC<{ value: PlanningApi; children: React.ReactNode }> = ({ value, children }) => <PlanningContext.Provider value={value}>{children}</PlanningContext.Provider>;

/** Null outside a planning-enabled workspace (views must degrade gracefully). */
export function usePlanning(): PlanningApi | null {
  return useContext(PlanningContext);
}

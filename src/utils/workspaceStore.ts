/**
 * Local persistence for the analytics workspace (IndexedDB only).
 *
 * Order-level data never goes to LocalStorage (size and privacy) and never leaves the
 * browser. If IndexedDB is unavailable the workspace lives in memory for the session.
 * Cost settings are small and fall back to LocalStorage.
 */
import type { CanonicalDataset, ChangeEvent, CostSettings } from '../analytics/model';
import type { ActionItem, MonthlyPlan } from '../analytics/planningEngine';

export const WORKSPACE_DB_NAME = 'EcomPulse_Workspace_DB';
const DB_VERSION = 1;
const STORE = 'kv';
const COST_SETTINGS_LS_KEY = 'ecompulse_cost_settings';

export type StoredWorkspace = { kind: 'demo' } | { kind: 'imported'; dataset: CanonicalDataset };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(WORKSPACE_DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function put(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  db.close();
}

async function get<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  const value = await new Promise<T | undefined>((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return value;
}

async function del(key: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadWorkspace(): Promise<StoredWorkspace | null> {
  try {
    return (await get<StoredWorkspace>('workspace')) ?? null;
  } catch {
    return null;
  }
}

/** Returns false when the browser cannot persist (the data stays in memory only). */
export async function saveWorkspace(value: StoredWorkspace): Promise<boolean> {
  try {
    await put('workspace', value);
    return true;
  } catch {
    return false;
  }
}

export async function clearWorkspace(): Promise<void> {
  try {
    await del('workspace');
    // The user's plan, change log and actions belong to the imported data.
    await del('planning:imported');
  } catch {
    // nothing stored
  }
}

export async function loadCostSettings(): Promise<CostSettings> {
  try {
    const v = await get<CostSettings>('costSettings');
    if (v) return v;
  } catch {
    // fall through to LocalStorage
  }
  try {
    return JSON.parse(localStorage.getItem(COST_SETTINGS_LS_KEY) || '{}') as CostSettings;
  } catch {
    return {};
  }
}

export async function saveCostSettings(settings: CostSettings): Promise<void> {
  try {
    await put('costSettings', settings);
    return;
  } catch {
    // fall back below
  }
  try {
    localStorage.setItem(COST_SETTINGS_LS_KEY, JSON.stringify(settings));
  } catch {
    // storage unavailable: settings last for this session only
  }
}

export function deleteWorkspaceDatabase(): void {
  try {
    indexedDB.deleteDatabase(WORKSPACE_DB_NAME);
  } catch {
    // unavailable
  }
}

// ─── Planning state (change log, monthly plans, actions) ────────────────────
// Kept per data source so demo notes never mix with the user's own plan.

export interface PlanningState {
  changeEvents: ChangeEvent[];
  plans: MonthlyPlan[];
  actions: ActionItem[];
}

export const EMPTY_PLANNING: PlanningState = { changeEvents: [], plans: [], actions: [] };

export async function loadPlanning(scope: 'demo' | 'imported'): Promise<PlanningState> {
  try {
    const v = await get<PlanningState>(`planning:${scope}`);
    if (v) return { ...EMPTY_PLANNING, ...v };
  } catch {
    // unavailable
  }
  return EMPTY_PLANNING;
}

export async function savePlanning(scope: 'demo' | 'imported', state: PlanningState): Promise<boolean> {
  try {
    await put(`planning:${scope}`, state);
    return true;
  } catch {
    return false;
  }
}

/**
 * Workspace data shared by Seller Mode and Analyst Mode: the persisted imported
 * dataset, the switchable demo, cost settings and import handling. Both modes read
 * the same dataset object, so switching mode never changes a number.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  canonicalFromParsedStoreData,
  datasetDateBounds,
  mergeIntoWorkspace,
  withCostSettings,
  type CanonicalDataset,
  type CostSettings,
  type DateRange,
} from '../../analytics';
import type { ParsedStoreData } from '../../types';
import { parseShopeeExcelFile } from '../../utils/excelParser';
import { buildDemoCanonicalDataset } from '../../data/demoCanonicalDataset';
import { clearWorkspace, loadCostSettings, loadWorkspace, saveCostSettings, saveWorkspace } from '../../utils/workspaceStore';
import type { ImportOutcome } from '../seller/importClient';
import type { ImportLogEntry } from '../seller/views/DataView';

export type SourceKind = 'demo' | 'imported' | 'legacy';

export interface WorkspaceData {
  loading: boolean;
  dataset: CanonicalDataset | null;
  bounds: DateRange | null;
  sourceKind: SourceKind | null;
  hasImported: boolean;
  persisted: boolean;
  costSettings: CostSettings;
  updateSettings: (next: CostSettings) => void;
  loadDemo: () => void;
  exitDemo: () => void;
  clear: () => Promise<void>;
  applyImport: (file: File, outcome: ImportOutcome) => Promise<ImportLogEntry['outcome']>;
}

interface Options {
  legacyData: ParsedStoreData | null;
  legacyPlatform: string | null;
  startWithDemo?: boolean;
  onDemoStarted?: () => void;
}

export function useWorkspaceData({ legacyData, legacyPlatform, startWithDemo, onDemoStarted }: Options): WorkspaceData {
  const [loading, setLoading] = useState(true);
  /** Imported data (persisted). Never overwritten by the demo. */
  const [imported, setImported] = useState<CanonicalDataset | null>(null);
  // Latest imported data for sequential multi-file imports: each file must merge into the
  // result of the previous one, not into the state captured when the import started.
  const importedRef = useRef<CanonicalDataset | null>(null);
  /** Demo view is a separate, switchable state on top of the user's data. */
  const [demo, setDemo] = useState(false);
  const [persisted, setPersisted] = useState(true);
  const [costSettings, setCostSettings] = useState<CostSettings>({});

  useEffect(() => {
    let alive = true;
    Promise.all([loadWorkspace(), loadCostSettings()]).then(([ws, settings]) => {
      if (!alive) return;
      if (ws?.kind === 'imported') {
        importedRef.current = ws.dataset;
        setImported(ws.dataset);
      }
      if (ws?.kind === 'demo') setDemo(true);
      setCostSettings(settings);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const loadDemo = useCallback(() => setDemo(true), []);
  const exitDemo = useCallback(() => setDemo(false), []);

  // Remember "demo on" only when there is no imported data to protect.
  useEffect(() => {
    if (loading) return;
    if (demo && !imported) saveWorkspace({ kind: 'demo' });
    if (!demo && !imported) clearWorkspace();
  }, [demo, imported, loading]);

  useEffect(() => {
    if (!loading && startWithDemo) {
      loadDemo();
      onDemoStarted?.();
    }
  }, [loading, startWithDemo, loadDemo, onDemoStarted]);

  const source = useMemo((): { dataset: CanonicalDataset; kind: SourceKind } | null => {
    if (demo) return { dataset: buildDemoCanonicalDataset(), kind: 'demo' };
    if (imported) return { dataset: imported, kind: 'imported' };
    if (legacyData) return { dataset: canonicalFromParsedStoreData(legacyData, legacyPlatform), kind: 'legacy' };
    return null;
  }, [demo, imported, legacyData, legacyPlatform]);

  const dataset = useMemo(() => (source ? withCostSettings(source.dataset, costSettings) : null), [source, costSettings]);
  const bounds = useMemo(() => (dataset ? datasetDateBounds(dataset) : null), [dataset]);

  const updateSettings = useCallback((next: CostSettings) => {
    setCostSettings(next);
    saveCostSettings(next);
  }, []);

  const storeImported = async (next: CanonicalDataset) => {
    importedRef.current = next;
    setImported(next);
    setDemo(false);
    setPersisted(await saveWorkspace({ kind: 'imported', dataset: next }));
  };

  const applyImport = async (file: File, outcome: ImportOutcome): Promise<ImportLogEntry['outcome']> => {
    if (outcome.type === 'orders') {
      await storeImported(mergeIntoWorkspace(importedRef.current, outcome.result.dataset));
      return outcome;
    }
    if (outcome.type === 'report') {
      await storeImported(mergeIntoWorkspace(importedRef.current, outcome.result.dataset));
      return outcome;
    }
    if (outcome.type === 'shopee_summary') {
      try {
        // The classic parser handles Shopee's 21-sheet summary layout.
        const parsed = await parseShopeeExcelFile(file);
        // The classic adapter's notes ("live sessions have no date and are unused"…) describe
        // what IT could not read; the sales-analysis importer below reads those sheets and
        // brings its own notes, so the adapter's would contradict them.
        const daily = mergeIntoWorkspace(importedRef.current, { ...canonicalFromParsedStoreData(parsed, 'shopee'), importNotes: [] });
        await storeImported(mergeIntoWorkspace(daily, outcome.extra.dataset));
        return { type: 'legacy_summary', ok: true, sheets: outcome.extra.sheets, period: outcome.extra.period };
      } catch (e) {
        return { type: 'legacy_summary', ok: false, message: e instanceof Error ? e.message : String(e) };
      }
    }
    return outcome;
  };

  const clear = async () => {
    await clearWorkspace();
    importedRef.current = null;
    setImported(null);
    setDemo(false);
  };

  return {
    loading,
    dataset,
    bounds,
    sourceKind: source?.kind ?? null,
    hasImported: !!imported,
    persisted,
    costSettings,
    updateSettings,
    loadDemo,
    exitDemo,
    clear,
    applyImport,
  };
}

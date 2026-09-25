/**
 * Workspace context shared by Seller Mode and Analyst Mode views. Both modes read the
 * same dataset and period; they differ only in which views they show.
 */
import React, { createContext, useContext } from 'react';
import type { CanonicalDataset, ComparisonMode, DatasetFilter, DateRange, Evidence, EvidenceFilter, Lang, PeriodPreset, Platform } from '../../analytics';

export type SellerView = 'home' | 'products' | 'orders' | 'adsLive' | 'dolphin' | 'data' | 'settings';

export type AnalystView =
  | 'overview'
  | 'alerts'
  | 'category'
  | 'productsCombo'
  | 'revenueProfit'
  | 'orderHealth'
  | 'funnel'
  | 'adsLiveBasic'
  | 'dataHub'
  | 'dataQuality'
  | 'mapping'
  | 'settings';

export type WorkspaceView = SellerView | AnalystView;

export interface EvidenceRequest {
  title: string;
  filter: EvidenceFilter;
  evidence?: Evidence[];
}

export interface SellerContextValue {
  lang: Lang;
  dataset: CanonicalDataset;
  /** Latest date in the data; "today" for presets. */
  asOf: string;
  preset: PeriodPreset;
  range: DateRange;
  compareMode: ComparisonMode;
  previousRange: DateRange;
  platforms?: Platform[];
  /** Range + platforms + (Analyst) category filters — pass to engines as-is. */
  baseFilter: DatasetFilter;
  openEvidence: (req: EvidenceRequest) => void;
  goTo: (view: WorkspaceView, focus?: Partial<DatasetFilter>) => void;
  /** Filter handed over by the last goTo (e.g. the category clicked on the overview). */
  focus: Partial<DatasetFilter> | null;
}

const Ctx = createContext<SellerContextValue | null>(null);

export const SellerProvider = Ctx.Provider;
export const WorkspaceProvider = Ctx.Provider;

export function useSeller(): SellerContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSeller must be used inside SellerProvider');
  return v;
}

export const useWorkspace = useSeller;

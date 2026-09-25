import React, { createContext, useContext } from 'react';
import type { CanonicalDataset, ComparisonMode, DateRange, Evidence, EvidenceFilter, Lang, PeriodPreset, Platform } from '../../analytics';

export type SellerView = 'home' | 'products' | 'orders' | 'adsLive' | 'dolphin' | 'data' | 'settings';

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
  openEvidence: (req: EvidenceRequest) => void;
  goTo: (view: SellerView) => void;
}

const Ctx = createContext<SellerContextValue | null>(null);

export const SellerProvider = Ctx.Provider;

export function useSeller(): SellerContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSeller must be used inside SellerProvider');
  return v;
}

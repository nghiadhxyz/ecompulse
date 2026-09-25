/**
 * Shared analytics engine — the single source of truth for business metrics.
 * UI (Seller & Analyst modes) and Dolphin AI read results from here; nothing here
 * depends on React.
 */
export * from './model';
export * from './metric';
export * from './period';
export * from './status';
export * from './parse';
export * from './filters';
export * from './profitEngine';
export * from './kpiEngine';
export * from './comparisonEngine';
export * from './contributionEngine';
export * from './dataQuality';
export * from './adsFormulas';
export { canonicalFromParsedStoreData, platformFromString } from './adapters/fromParsedStoreData';

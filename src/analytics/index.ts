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
export * from './format';
export * from './evidence';
export * from './workspace';
export * from './productEngine';
export * from './orderHealthEngine';
export * from './adsLiveEngine';
export * from './anomalyEngine';
export * from './dailyBrief';
export * from './importers/orderExport';
export * from './timeseries';
export * from './breakdownEngine';
export * from './productIntelligence';
export * from './funnelEngine';
export * from './normalDays';
export * from './importers/reportImporters';
export * from './campaignEngine';
export * from './growthEngines';

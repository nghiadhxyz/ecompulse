/**
 * EcomPulse On-Premise Data Anonymizer & Privacy Filter
 * 
 * Ensures zero Personally Identifiable Information (PII) or sensitive shop credentials
 * are ever exposed to external AI queries.
 */

import { ParsedStoreData } from '../types';

export interface AnonymizedAnalyticsSummary {
  periodLabel: string;
  currency: string;
  kpis: {
    placedRevenue: number;
    placedOrders: number;
    paidRevenue: number;
    paidOrders: number;
    aov: number;
    conversionRate: number;
    cancellationRate: number;
    cancelledOrders: number;
    adSpend: number;
    blendedRoas: number;
  };
  /** Buyer counts only — no identifiers. */
  retention: {
    totalBuyers: number;
    newBuyers: number;
    returningBuyers: number;
    newBuyerRevenue: number;
    returningBuyerRevenue: number;
    returningBuyerAov: number;
    repeatPurchaseRate: number;
  };
  /** Scalar finance aggregates for internal-finance datasets (row-level data is dropped). */
  internalFinance?: {
    cogs: number;
    grossProfit: number;
    grossMargin: number;
    totalLiveRevenue: number;
    totalKocRevenue: number;
    totalKocCount: number;
    avgCommissionRate: number;
  };
  funnel: {
    totalLeakageVND: number;
    placedToPaidRate: number;
    stages: Array<{
      stage: string;
      name: string;
      orders: number;
      revenue: number;
      dropOffRateFromPrev: number;
      leakageRevenue: number;
    }>;
  };
  channels: Array<{
    channelName: string;
    placedRevenue: number;
    paidRevenue: number;
    leakageAmount: number;
    retentionRate: number;
    aov: number;
  }>;
  abc: {
    classAShare: number;
    classBShare: number;
    classCShare: number;
    classACount: number;
    classBCount: number;
    classCCount: number;
    zombieCount: number;
  };
  abcTopProducts: Array<{
    name: string;
    classification: string;
    revenue: number;
    orders: number;
    views: number;
    isZombie: boolean;
  }>;
  ads: Array<{
    type: string;
    name: string;
    spend: number;
    paidRevenue: number;
    roas: number;
    isBudgetWaste: boolean;
  }>;
}

/**
 * Strips raw customer orders, personal names, phone numbers, and addresses.
 * Returns only anonymized, high-level mathematical aggregations suitable for AI analysis.
 */
export function anonymizeStoreDataForAI(data: ParsedStoreData): AnonymizedAnalyticsSummary {
  const topProductsAnonymized = (data.abcProducts || []).slice(0, 10).map((p) => {
    // Sanitize product names if they contain contact numbers or private markers
    let cleanName = p.name || 'Sản phẩm TMĐT';
    cleanName = cleanName.replace(/\b0\d{9,10}\b/g, '[SĐT Ẩn]');
    cleanName = cleanName.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[Email Ẩn]');

    return {
      name: cleanName,
      classification: p.classification,
      revenue: p.revenue,
      orders: p.orders,
      views: p.views,
      isZombie: !!p.isZombie,
    };
  });

  return {
    periodLabel: data.periodLabel || 'Kỳ phân tích',
    currency: 'VND',
    kpis: {
      placedRevenue: data.kpis?.placedRevenue || 0,
      placedOrders: data.kpis?.placedOrders || 0,
      paidRevenue: data.kpis?.paidRevenue || 0,
      paidOrders: data.kpis?.paidOrders || 0,
      aov: data.kpis?.aov || 0,
      conversionRate: data.kpis?.conversionRate || 0,
      cancellationRate: data.kpis?.cancellationRate || 0,
      cancelledOrders: data.kpis?.cancelledOrders || 0,
      adSpend: data.kpis?.adSpend || data.adSummary?.totalSpend || 0,
      blendedRoas: data.kpis?.blendedRoas || data.adSummary?.overallRoas || 0,
    },
    retention: {
      totalBuyers: data.retention?.totalBuyers || 0,
      newBuyers: data.retention?.newBuyers || 0,
      returningBuyers: data.retention?.returningBuyers || 0,
      newBuyerRevenue: data.retention?.newBuyerRevenue || 0,
      returningBuyerRevenue: data.retention?.returningBuyerRevenue || 0,
      returningBuyerAov: data.retention?.returningBuyerAov || 0,
      repeatPurchaseRate: data.retention?.repeatPurchaseRate || 0,
    },
    internalFinance: pickInternalFinanceScalars((data as { internalFinance?: Record<string, unknown> }).internalFinance),
    funnel: {
      totalLeakageVND: data.funnel?.totalLeakageVND || 0,
      placedToPaidRate: data.funnel?.placedToPaidRate || 0,
      stages: (data.funnel?.stages || []).map((s) => ({
        stage: s.stage,
        name: s.name,
        orders: s.orders,
        revenue: s.revenue,
        dropOffRateFromPrev: s.dropOffRateFromPrev,
        leakageRevenue: s.leakageRevenue,
      })),
    },
    channels: (data.channels || []).map((c) => ({
      channelName: c.channelName,
      placedRevenue: c.placedRevenue,
      paidRevenue: c.paidRevenue,
      leakageAmount: c.leakageAmount,
      retentionRate: c.retentionRate,
      aov: c.aov,
    })),
    abc: {
      classAShare: data.abcSummary?.classAShare || 0,
      classBShare: data.abcSummary?.classBShare || 0,
      classCShare: data.abcSummary?.classCShare || 0,
      classACount: data.abcSummary?.classACount || 0,
      classBCount: data.abcSummary?.classBCount || 0,
      classCCount: data.abcSummary?.classCCount || 0,
      zombieCount: data.abcSummary?.zombieCount || 0,
    },
    abcTopProducts: topProductsAnonymized,
    ads: (data.ads || []).map((a) => ({
      type: a.type,
      name: a.name,
      spend: a.spend,
      paidRevenue: a.paidRevenue,
      roas: a.roas,
      isBudgetWaste: !!a.isBudgetWaste,
    })),
  };
}

function pickInternalFinanceScalars(raw: Record<string, unknown> | undefined): AnonymizedAnalyticsSummary['internalFinance'] {
  if (!raw) return undefined;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    cogs: n(raw.cogs),
    grossProfit: n(raw.grossProfit),
    grossMargin: n(raw.grossMargin),
    totalLiveRevenue: n(raw.totalLiveRevenue),
    totalKocRevenue: n(raw.totalKocRevenue),
    totalKocCount: n(raw.totalKocCount),
    avgCommissionRate: n(raw.avgCommissionRate),
  };
}

// Storage key for AI Mode preference
export const AI_PRIVACY_MODE_KEY = 'ecompulse_ai_privacy_mode';
export const LOCAL_LLM_URL_KEY = 'ecompulse_local_llm_url';
export const CUSTOM_GEMINI_KEY = 'gemini_custom_api_key';

export type AiPrivacyMode = 'offline_rule_based' | 'byok_gemini' | 'local_ollama' | 'server_gemini';

export function getSavedAiPrivacyMode(): AiPrivacyMode {
  if (typeof window === 'undefined') return 'byok_gemini';
  return (localStorage.getItem(AI_PRIVACY_MODE_KEY) as AiPrivacyMode) || 'byok_gemini';
}

export function setSavedAiPrivacyMode(mode: AiPrivacyMode): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(AI_PRIVACY_MODE_KEY, mode);
  }
}

export function getSavedLocalLlmUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:11434';
  return localStorage.getItem(LOCAL_LLM_URL_KEY) || 'http://localhost:11434';
}

export function setSavedLocalLlmUrl(url: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_LLM_URL_KEY, url);
  }
}

/** Older builds stored the BYOK key under this name; read it as a fallback. */
const LEGACY_GEMINI_KEY = 'ecompulse_gemini_api_key';

export function getSavedCustomApiKey(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(CUSTOM_GEMINI_KEY) || localStorage.getItem(LEGACY_GEMINI_KEY) || '';
  } catch {
    return '';
  }
}

export function setSavedCustomApiKey(key: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(CUSTOM_GEMINI_KEY, key);
  }
}

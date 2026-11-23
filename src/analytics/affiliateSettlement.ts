import type { AffiliateOrder } from './importers/tiktokAffiliate';
import { toDayNumber } from './period';

export function sumPresent(values: readonly (number | null)[]): number | null {
  const present = values.filter((value) => value !== null);
  return present.length ? present.reduce((sum, value) => sum + value, 0) : null;
}
export const estimatedCommission = (row: AffiliateOrder) => sumPresent([row.estimatedStandard, row.estimatedShopAds]);
export const actualCommission = (row: AffiliateOrder) => sumPresent([row.actualStandard, row.actualShopAds]);

const estimatedTaxes = ['estimatedPit', 'estimatedIva', 'estimatedIsr', 'estimatedCedularTax'] as const;
const actualAdjustments = ['actualBonus', 'actualPartnerBonus', 'actualPit', 'actualIsr', 'actualIva', 'actualCedularTax', 'actualShare'] as const;

export type AffiliateReconciliation = { status: 'matched' | 'difference' | 'incomplete'; calculated: number | null; difference: number | null };
const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

export function affiliateSettlement(rows: readonly AffiliateOrder[], asOf: string, waitDays: number) {
  const supplied = <T extends keyof AffiliateOrder>(fields: readonly T[]) => fields.filter((field) => rows.some((row) => row[field] != null));
  const taxFields = supplied(estimatedTaxes);
  const adjustmentFields = supplied(actualAdjustments);
  const reconciliation = new Map<AffiliateOrder, AffiliateReconciliation>();
  const elapsed: number[] = [];
  const stores = new Map<string, { name: string; durations: number[] }>();
  const estimatedEligible = rows.filter((r) => r.status !== 'ineligible' && r.status !== 'unknown' && estimatedCommission(r) !== null);
  let coveredEstimate = 0;
  let coveredTax = 0;
  let coveredRows = 0;
  let matched = 0;
  let differences = 0;
  let incomplete = 0;
  let comparisonRows = 0;
  let comparableEstimate = 0;
  let comparableActual = 0;
  const aging: AffiliateOrder[] = [];
  for (const row of rows) {
    const estimate = estimatedCommission(row);
    if (row.status !== 'unknown' && row.status !== 'ineligible' && estimate !== null &&
      taxFields.length > 0 && taxFields.every((key) => row[key] !== null)) {
      coveredEstimate += estimate;
      coveredTax += taxFields.reduce((total, key) => total + row[key]!, 0);
      coveredRows++;
    }
    if ((row.status === 'pending' || row.status === 'awaiting_payment') && asOf &&
      toDayNumber(asOf) - toDayNumber(row.orderDay) > waitDays) aging.push(row);
    if (row.status !== 'settled') continue;
    if (row.settlementDay && row.settlementDay >= row.orderDay) {
      const days = toDayNumber(row.settlementDay) - toDayNumber(row.orderDay);
      elapsed.push(days);
      if (row.shopId || row.shopName) {
        const key = row.shopId ?? row.shopName!;
        const shop = stores.get(key) ?? { name: row.shopName ?? key, durations: [] };
        shop.durations.push(days);
        stores.set(key, shop);
      }
    }
    const commission = actualCommission(row);
    if (estimate !== null && commission !== null) {
      comparisonRows++;
      comparableEstimate += estimate;
      comparableActual += commission;
    }
    if (commission === null || row.finalReceived === null || adjustmentFields.some((key) => row[key] === null)) {
      reconciliation.set(row, { status: 'incomplete', calculated: null, difference: null });
      incomplete++;
      continue;
    }
    const calculated = adjustmentFields.reduce((total, key) => total + row[key]!, commission);
    const difference = row.finalReceived - calculated;
    const status = Math.abs(difference) < 0.5 ? 'matched' : 'difference';
    reconciliation.set(row, { status, calculated, difference });
    if (status === 'matched') matched++;
    else differences++;
  }
  const durationBins = [[0, 3], [4, 7], [8, 14], [15, Infinity]].map(([min, max]) => ({
    label: max === Infinity ? `${min}+` : `${min}–${max}`,
    count: elapsed.filter((days) => days >= min && days <= max).length,
  }));
  return {
    averageDays: mean(elapsed), durationCount: elapsed.length, durationBins,
    shops: [...stores.entries()].map(([key, shop]) => ({ key, label: shop.name, averageDays: mean(shop.durations), count: shop.durations.length })),
    aging, reconciliation, matched, differences, incomplete,
    comparisonRows, comparableEstimate: comparisonRows ? comparableEstimate : null, comparableActual: comparisonRows ? comparableActual : null,
    coveredEstimate: coveredRows ? coveredEstimate : null, coveredTax: coveredRows ? coveredTax : null,
    afterTax: coveredRows ? coveredEstimate + coveredTax : null, coveredRows, estimatedRows: estimatedEligible.length,
  };
}

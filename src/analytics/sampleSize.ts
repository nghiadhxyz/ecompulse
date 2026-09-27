/**
 * Sample-size rules shared by every page.
 *  - A rate resting on fewer than MIN_RATE_ORDERS orders is dimmed and never called good or bad.
 *  - A group with fewer than MIN_GROUP_SAMPLES samples (days, sessions…) is "chưa đủ mẫu".
 *  - A weekday seen on only 4–5 days is "tham khảo" (one unusual day moves its average).
 *  - A day with fewer than MIN_DAY_ORDERS orders is dimmed in tables by day.
 */
import type { Bilingual } from './metric';

export const MIN_RATE_ORDERS = 30;
export const MIN_GROUP_SAMPLES = 3;
export const REFERENCE_MAX_SAMPLES = 5;
export const MIN_DAY_ORDERS = 10;

export type SampleLevel = 'insufficient' | 'reference' | 'ok';

export function sampleLevel(n: number): SampleLevel {
  if (n < MIN_GROUP_SAMPLES) return 'insufficient';
  if (n <= REFERENCE_MAX_SAMPLES) return 'reference';
  return 'ok';
}

export const SAMPLE_LABELS: Record<Exclude<SampleLevel, 'ok'>, Bilingual> = {
  insufficient: { vi: 'chưa đủ mẫu', en: 'too few samples' },
  reference: { vi: 'tham khảo', en: 'indicative' },
};

export const SMALL_RATE_NOTE: Bilingual = {
  vi: `Tính trên dưới ${MIN_RATE_ORDERS} đơn — chỉ để xem, chưa đủ để kết luận tốt hay xấu.`,
  en: `Based on fewer than ${MIN_RATE_ORDERS} orders — too few to judge.`,
};

import { describe, expect, it } from 'vitest';
import { askDolphin, detectIntent, answerToAiPayload } from '../dolphinEvidence';
import { buildDemoCanonicalDataset } from '../../data/demoCanonicalDataset';
import { emptyDataset } from '../model';

const demo = buildDemoCanonicalDataset();
const ctx = { range: { start: '2025-09-01', end: '2025-09-30' }, previousRange: { start: '2025-08-01', end: '2025-08-30' } };

describe('Dolphin intent routing', () => {
  it.each([
    ['Tháng này doanh thu thế nào?', 'overview'],
    ['Tại sao GMV giảm?', 'why_change'],
    ['Vì sao tỷ lệ hủy tăng', 'why_change'],
    ['SKU nào đang tăng trưởng?', 'growing_skus'],
    ['Sản phẩm nào tốt nhất?', 'best_product'],
    ['Sale 9.9 tại sao hủy nhiều?', 'campaign_cancel'],
    ['Live nào có conversion thấp?', 'live_conversion'],
    ['Chi phí nào tăng mạnh?', 'cost_increase'],
    ['Sản phẩm nào đang lỗ?', 'losing_products'],
    ['thời tiết?', 'unknown'],
  ])('%s → %s', (q, intent) => expect(detectIntent(q).intent).toBe(intent));

  it('picks the metric for why-questions', () => {
    expect(detectIntent('Tại sao tỷ lệ hủy tăng?').metric).toBe('cancelRate');
    expect(detectIntent('Vì sao lợi nhuận giảm?').metric).toBe('profit');
  });
});

describe('Dolphin evidence answers', () => {
  it('explains GMV with the root-cause path and no causal claim', () => {
    const a = askDolphin(demo, 'Tại sao GMV tăng?', ctx);
    expect(a.insight.vi).toContain('GMV');
    expect(a.interpretation.vi).toContain('Nồi chiên');
    expect(a.interpretation.vi).toContain('không chứng minh nguyên nhân');
    expect(a.evidence.length).toBeGreaterThan(1);
    expect(a.evidence[0].filter).toBeDefined();
  });

  it('splits "best product" by criterion', () => {
    const a = askDolphin(demo, 'Sản phẩm nào tốt nhất?', ctx);
    expect(a.evidence.length).toBe(5);
    expect(a.interpretation.vi).toContain('không phải là sản phẩm lời nhất');
  });

  it('finds the weak live session of 27/09', () => {
    const a = askDolphin(demo, 'Live nào có conversion thấp?', ctx);
    expect(a.insight.vi).toContain('27/09');
  });

  it('answers the 9.9 cancel question with recorded reasons and normal-day baseline', () => {
    const a = askDolphin(demo, 'Sale 9.9 tại sao hủy nhiều?', ctx);
    expect(a.insight.vi).toContain('9.9');
    expect(a.evidence[0].baseline).not.toBeNull();
  });

  it('says not enough data instead of guessing', () => {
    const a = askDolphin(emptyDataset('e', 'e'), 'Tại sao GMV giảm?', ctx);
    expect(a.unavailable).toBeDefined();
    expect(a.insight.vi).toContain('Không đủ dữ liệu');
  });

  it('never uses causal wording', () => {
    for (const q of ['Tháng này doanh thu thế nào?', 'Tại sao GMV tăng?', 'Chi phí nào tăng mạnh?', 'Sale 9.9 tại sao hủy nhiều?']) {
      const a = askDolphin(demo, q, ctx);
      const text = [a.insight.vi, a.interpretation.vi].join(' ');
      expect(text).not.toMatch(/gây ra|nguyên nhân là/);
    }
  });

  it('AI payload contains aggregates only (no order ids)', () => {
    const a = askDolphin(demo, 'Tại sao GMV tăng?', ctx);
    const json = JSON.stringify(answerToAiPayload(a, 'vi'));
    expect(json).not.toMatch(/orderId|buyerId|filter/);
  });
});

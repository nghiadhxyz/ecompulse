/**
 * Odd records in a summary report, on two levels:
 *
 *  - "Lưu ý" (grey): Shopee records the columns inconsistently. Real, unedited exports do
 *    this (a video with sales but 0 orders, add-to-cart in a live with 0 viewers, more unique
 *    clickers than viewers), so it is not an error — the figure is shown, but not used to
 *    conclude anything.
 *  - "Không hợp lệ" (red): cannot happen in a real export — sales excluding subsidy above
 *    sales (negative subsidy), live sessions adding up to more than their channel.
 */
import type { CanonicalDataset, Platform } from './model';
import type { Bilingual } from './metric';
import type { DateRange } from './period';
import { subsidyDependence } from './summaryInsights';
import { sourceChecks } from './canonicalSources';

export type NoticeLevel = 'notice' | 'invalid';

export interface DataNotice {
  id: string;
  level: NoticeLevel;
  kind: 'gmv_without_orders' | 'atc_without_viewers' | 'unique_clicks_over_viewers' | 'negative_subsidy' | 'sessions_over_channel';
  title: Bilingual;
  detail: Bilingual;
  /** What the notice is attached to, so a table can mark the row. */
  ref: { contentId?: string; sessionIds?: string[]; channel?: string; dates?: string[] };
}

export const NOTICE_LABELS: Record<NoticeLevel, Bilingual> = {
  notice: { vi: 'Lưu ý', en: 'Note' },
  invalid: { vi: 'Không hợp lệ', en: 'Invalid' },
};

export const NOTICE_TOOLTIP: Bilingual = {
  vi: 'Shopee ghi nhận không nhất quán giữa các cột, không dùng để kết luận.',
  en: 'Shopee records these columns inconsistently — not used to draw conclusions.',
};

const fmt = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(v);

export function dataNotices(dataset: CanonicalDataset, range: DateRange, platforms?: Platform[]): DataNotice[] {
  const out: DataNotice[] = [];
  const inScope = (p: Platform) => !platforms?.length || platforms.includes(p);
  const covers = (start?: string, end?: string) => start !== undefined && end !== undefined && start >= range.start && end <= range.end;

  // ---- notices: inconsistent columns in real exports
  for (const a of dataset.affiliates) {
    if (!inScope(a.platform) || !covers(a.periodStart, a.date)) continue;
    if ((a.gmv ?? 0) > 0 && a.orders === 0) {
      const what = a.contentType === 'affiliate' ? `Affiliate ${a.creatorId}` : `Video ${a.contentId}`;
      out.push({
        id: `gmv0-${a.contentType}-${a.contentId ?? a.creatorId}`,
        level: 'notice',
        kind: 'gmv_without_orders',
        title: { vi: `${what}: có doanh số nhưng 0 đơn`, en: `${what}: sales but 0 orders` },
        detail: { vi: `Doanh số ${fmt(a.gmv!)}đ, 0 đơn.`, en: `Sales ${fmt(a.gmv!)}, 0 orders.` },
        ref: { contentId: a.contentId ?? a.creatorId },
      });
    }
  }
  const emptyAtc = dataset.liveSessions.filter((s) => inScope(s.platform) && covers(s.periodStart ?? s.date, s.date) && (s.viewers ?? 0) === 0 && (s.addToCart ?? 0) > 0);
  if (emptyAtc.length) {
    out.push({
      id: 'atc-empty-live',
      level: 'notice',
      kind: 'atc_without_viewers',
      title: { vi: `Thêm giỏ hàng ở ${emptyAtc.length} phiên live không có người xem`, en: `Add-to-cart in ${emptyAtc.length} live sessions with no viewers` },
      detail: {
        vi: `${emptyAtc.reduce((s, x) => s + (x.addToCart ?? 0), 0)} lượt thêm giỏ ở các phiên 0 người xem — không tính vào phễu live.`,
        en: 'Not counted in the live funnel.',
      },
      ref: { sessionIds: emptyAtc.map((s) => s.sessionId) },
    });
  }
  for (const r of dataset.salesSummaries ?? []) {
    if (!inScope(r.platform) || r.dimension !== 'channel' || r.stage !== 'placed' || !covers(r.periodStart, r.date)) continue;
    if (r.channel === 'product_card' || r.uniqueClicks === undefined || r.uniqueImpressions === undefined) continue;
    // Live / Video / Affiliate: the "unique impressions" column holds viewers.
    if (r.uniqueClicks > r.uniqueImpressions) {
      out.push({
        id: `uclick-${r.channel}`,
        level: 'notice',
        kind: 'unique_clicks_over_viewers',
        title: { vi: `Kênh ${r.label ?? r.channel}: lượt nhấp duy nhất nhiều hơn người xem`, en: `${r.label ?? r.channel}: more unique clicks than viewers` },
        detail: { vi: `${fmt(r.uniqueClicks)} lượt nhấp duy nhất > ${fmt(r.uniqueImpressions)} người xem.`, en: `${fmt(r.uniqueClicks)} unique clicks > ${fmt(r.uniqueImpressions)} viewers.` },
        ref: { channel: r.channel },
      });
    }
  }

  // ---- invalid: impossible in a real export
  const subsidy = subsidyDependence(dataset, { range, platforms });
  if (subsidy.invalidDays.length) {
    out.push({
      id: 'negative-subsidy',
      level: 'invalid',
      kind: 'negative_subsidy',
      title: { vi: `Trợ giá âm ở ${subsidy.invalidDays.length} ngày`, en: `Negative subsidy on ${subsidy.invalidDays.length} days` },
      detail: { vi: 'Doanh số không gồm trợ giá lớn hơn doanh số — các ngày này bị loại khỏi phân tích trợ giá.', en: 'Sales excluding subsidy exceed sales — left out of subsidy analysis.' },
      ref: { dates: subsidy.invalidDays },
    });
  }
  for (const c of sourceChecks(dataset, platforms)) {
    if (!c.invalid || c.period.start < range.start || c.period.end > range.end) continue;
    out.push({ id: `invalid-${c.id}`, level: 'invalid', kind: 'sessions_over_channel', title: c.label, detail: c.invalid, ref: { channel: 'live' } });
  }
  return out;
}

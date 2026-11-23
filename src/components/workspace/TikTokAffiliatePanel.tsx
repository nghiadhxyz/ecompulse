import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtByUnit, fmtCount, fmtDay, fmtMoneyCompact, fmtRate, formatRangeVi, type Lang } from '../../analytics';
import { affiliateDailyReview, affiliateDeepChecks, affiliateGroup, affiliateLatestDay, affiliateProductMatrix, affiliateRatio, affiliateTimeSeries, AFFILIATE_STATUS, askAffiliateDolphin, groupAffiliate, reviewAffiliate, summarizeAffiliate } from '../../analytics/tiktokAffiliate';
import { affiliateSettlement } from '../../analytics/affiliateSettlement';
import { toDayNumber } from '../../analytics/period';
import type { AffiliateOrder } from '../../analytics/importers/tiktokAffiliate';
import type { AlertSeverity } from '../../analytics/anomalyEngine';
import type { Evidence } from '../../analytics/evidence';
import { CHART, axisProps, gridProps, tooltipProps } from '../../theme/chart';
import { Button, SectionCard, Tabs } from '../ui/primitives';
import { AffiliateOrderDetail } from './AffiliateOrderDetail';
import { DataTable, StatStrip, type Column } from '../ui/data';
import { SeverityBadge, SEVERITY_STYLE } from '../seller/ui';
import dolphinAvatar from '../../assets/images/dolphin_ai_avatar_1787721342181.jpg';

const DIMENSIONS = {
  skuId: ['SKU / sản phẩm', 'SKU / product'], productId: ['ID sản phẩm', 'Product ID'], shopId: ['Cửa hàng', 'Shop'],
  orderType: ['Loại đơn hàng', 'Order type'], contentType: ['Loại nội dung', 'Content type'],
  contentId: ['ID nội dung', 'Content ID'], status: ['Quyết toán', 'Settlement'],
  standardRate: ['Tỷ lệ hoa hồng chuẩn', 'Standard commission rate'],
  shopAdsRate: ['Tỷ lệ hoa hồng quảng cáo', 'Shop Ads commission rate'],
} as const;
type Dimension = keyof typeof DIMENSIONS;
const SETTLEMENT_FIELDS = [
  ['estimatedStandard', 'actualStandard', 'Hoa hồng tiêu chuẩn', 'Standard commission'],
  ['estimatedShopAds', 'actualShopAds', 'Hoa hồng quảng cáo cửa hàng', 'Shop Ads commission'],
  ['estimatedBonus', 'actualBonus', 'Thưởng TikTok', 'TikTok bonus'],
  ['estimatedPartnerBonus', 'actualPartnerBonus', 'Thưởng đối tác', 'Partner bonus'],
  ['estimatedIva', 'actualIva', 'Thuế IVA', 'IVA tax'],
  ['estimatedIsr', 'actualIsr', 'Thuế ISR', 'ISR tax'],
  ['estimatedCedularTax', 'actualCedularTax', 'Thuế cedular', 'Cedular tax'],
  ['estimatedPit', 'actualPit', 'Thuế PIT', 'PIT tax'],
  ['estimatedShare', 'actualShare', 'Phần chia doanh thu', 'Revenue share'],
] as const;

function groupLabel(row: AffiliateOrder, field: Dimension, lang: Lang) {
  const value = row[field];
  if (value === null && (field === 'standardRate' || field === 'shopAdsRate') && row.missing[field] === 'multiple_rates') {
    const original = String(row.raw?.[field] ?? '');
    if (original) return { key: original, label: original };
  }
  if (value === null) return { key: '', label: lang === 'vi' ? 'Chưa có dữ liệu' : 'No data' };
  const label = field === 'status' ? AFFILIATE_STATUS[row.status][lang]
    : typeof value === 'number' ? fmtRate(value, lang)
    : (field === 'skuId' || field === 'productId') && row.productName ? `${row.productName} · ${value}`
    : field === 'contentId' && row.contentType ? `${value} · ${row.contentType}`
    : field === 'shopId' ? row.shopName ?? value : value;
  return { key: String(value), label };
}

const AFFILIATE_SEVERITIES = ['all', 'critical', 'warning', 'opportunity', 'info'] as const;

function AffiliateEvidenceList({ items, lang }: { items: readonly Evidence[]; lang: Lang }) {
  const vi = lang === 'vi';
  return (
    <ul className="divide-y divide-line text-sm text-muted">
      {items.map((item, index) => (
        <li key={`${item.label.en}-${index}`} className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 py-1.5">
          <span>{item.label[lang]}{item.sampleSize !== undefined && ` · ${item.currentLabel[lang]} · ${fmtCount(item.sampleSize, lang)} ${vi ? 'đơn' : 'orders'}`}</span>
          <span className="text-right tabular text-fg">
            <b>{fmtByUnit(item.current, item.unit, lang, false)}</b>
            {item.baseline !== undefined && item.baseline !== null && (
              <span className="ml-2 text-muted">{item.baselineLabel?.[lang]}: {fmtByUnit(item.baseline, item.unit, lang, false)}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function AffiliateDolphin({ rows, lang, context }: {
  rows: readonly AffiliateOrder[]; lang: Lang; context: Parameters<typeof askAffiliateDolphin>[2];
}) {
  const vi = lang === 'vi';
  const [question, setQuestion] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [selectedDay, setSelectedDay] = useState<string>();
  const [severity, setSeverity] = useState<AlertSeverity | 'all'>('all');
  const [traceId, setTraceId] = useState<string | null>(null);
  const brief = useMemo(() => affiliateDailyReview(rows, selectedDay), [rows, selectedDay]);
  const issues = useMemo(() => [...reviewAffiliate(rows, brief.alert), ...affiliateDeepChecks(rows)], [rows, brief.alert]);
  const visible = severity === 'all' ? issues : issues.filter((item) => item.severity === severity);
  const concerns = issues.filter((item) => item.severity === 'critical' || item.severity === 'warning');
  const opportunities = issues.filter((item) => item.severity === 'opportunity');
  const traceItem = issues.find((item) => item.id === traceId);
  const traceFinance = useMemo(() => traceId ? affiliateSettlement(rows, affiliateLatestDay(rows), 14) : null, [rows, traceId]);
  const traceRows = traceItem ? rows.filter((row) => {
    if (traceItem.trace) return row[traceItem.trace.field] === traceItem.trace.key;
    if (traceItem.id === 'awaiting-settlement') return row.status === 'pending' || row.status === 'awaiting_payment';
    if (traceItem.id === 'ineligible') return row.status === 'ineligible';
    if (traceItem.id === 'refunded') return (row.refundedQuantity ?? 0) > 0;
    const audit = traceFinance?.reconciliation.get(row);
    return row.status === 'unknown' || audit?.status === 'difference' || audit?.status === 'incomplete' || traceFinance?.aging.includes(row);
  }) : [];
  const response = useMemo(() => submitted ? askAffiliateDolphin(rows, submitted, context, true, brief.day) : null, [rows, submitted, context, brief.day]);
  const suggestions = vi
    ? ['File Affiliate có vấn đề gì?', 'Còn bao nhiêu hoa hồng chờ quyết toán?', 'Thực nhận thay đổi theo ngày thế nào?', 'Chẩn đoán sản phẩm Affiliate']
    : ['What issues are in the Affiliate report?', 'How much commission is pending?', 'How did received commission change over time?', 'Diagnose Affiliate products'];
  function ask(event: FormEvent) {
    event.preventDefault();
    if (question.trim()) setSubmitted(question.trim());
  }
  return (
    <div className="space-y-4">
    <SectionCard title={(
      <span className="inline-flex items-center gap-2.5">
        <img src={dolphinAvatar} alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-line" />
        <span>Dolphin AI · TikTok Affiliate</span>
      </span>
    )} description={context[lang]}>
      <form className="flex gap-2" onSubmit={ask}>
        <input className="min-w-0 flex-1 rounded-control border border-line bg-surface-2 px-3 text-sm" value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.nativeEvent.isComposing || e.keyCode === 229)) e.preventDefault(); }}
          aria-label={vi ? 'Câu hỏi TikTok Affiliate' : 'TikTok Affiliate question'}
          placeholder={vi ? 'Ví dụ: Tôi đã nhận bao nhiêu hoa hồng?' : 'e.g. How much commission did I receive?'} />
        <button className="min-h-10 rounded-control bg-primary px-3 text-sm font-semibold text-primary-contrast">{vi ? 'Hỏi' : 'Ask'}</button>
      </form>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {suggestions.map((suggestion) => (
          <button type="button" key={suggestion} onClick={() => setSubmitted(suggestion)}
            className="rounded-control border border-line px-2 py-1 text-small hover:bg-hover">{suggestion}</button>
        ))}
      </div>
      {submitted && !response && <p className="mt-3 text-sm text-muted">{!rows.length
        ? (vi ? 'Không có dữ liệu trong phạm vi này.' : 'No report data in this selection.')
        : (vi ? 'Bạn muốn kiểm tra hoa hồng, GMV, sản phẩm hay tình trạng quyết toán?' : 'Ask about commission, GMV, products or settlement status.')}</p>}
      {response && (
        <article className="mt-4 space-y-3 rounded-control border border-line bg-surface-2 p-3 text-sm" aria-live="polite">
          <p className="font-semibold">{submitted}</p>
          <section><h3 className="text-small text-muted">{vi ? 'Nhận định' : 'Insight'}</h3><p>{response.insight[lang]}</p></section>
          {response.evidence.length > 0 && <section>
            <h3 className="text-small text-muted">{vi ? 'Bằng chứng' : 'Evidence'}</h3>
            <AffiliateEvidenceList items={response.evidence} lang={lang} />
          </section>}
          <section><h3 className="text-small text-muted">{vi ? 'Diễn giải' : 'Interpretation'}</h3><p>{response.interpretation[lang]}</p></section>
          <section><h3 className="text-small text-muted">{vi ? 'Nên kiểm tra tiếp' : 'Next check'}</h3><ul>{response.nextChecks.map((text) => <li key={text[lang]}>{text[lang]}</li>)}</ul></section>
        </article>
      )}
    </SectionCard>
    <SectionCard
      title={vi ? 'Bản tin Affiliate hằng ngày' : 'Daily Affiliate brief'}
      description={vi ? 'GMV và số đơn theo ngày đặt. Hoa hồng quyết toán được theo dõi theo phạm vi báo cáo.' : 'GMV and orders by order date. Settlements use the report scope.'}
      tools={brief.day && (
        <select aria-label={vi ? 'Ngày đặt hàng trong bản tin' : 'Brief order date'} value={brief.day} onChange={(e) => setSelectedDay(e.target.value)}
          className="min-h-10 rounded-control border border-line bg-surface px-2.5 text-sm">
          {[...brief.days].reverse().map((day) => <option value={day} key={day}>{fmtDay(day)}</option>)}
        </select>
      )}
    >
      <p className="rounded-control bg-primary-soft p-3 text-sm text-fg">{brief.note[lang]}</p>
      {brief.day && <StatStrip className="mt-3" items={[
        { label: vi ? 'GMV Affiliate theo ngày đặt' : 'Affiliate GMV by order date', value: fmtMoneyCompact(brief.daily.gmv, lang) },
        { label: vi ? 'Đơn trong ngày' : 'Orders on this date', value: fmtCount(brief.daily.orders, lang) },
        { label: vi ? 'Mức thường ngày (7 ngày)' : 'Typical day (7 days)', value: fmtMoneyCompact(brief.baseline, lang) },
      ]} />}
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-control border border-line p-3 text-sm">
          <h3 className="mb-1 font-semibold text-up">{vi ? 'Điểm tốt' : 'Going well'}</h3>
          {opportunities.length ? opportunities.map((item) => <p key={item.id}>{item.title[lang]}</p>) : <p className="text-muted">{vi ? 'Chưa có điểm nổi bật.' : 'Nothing notable.'}</p>}
        </div>
        <div className="rounded-control border border-line p-3 text-sm">
          <h3 className="mb-1 font-semibold text-warn">{vi ? 'Cần chú ý' : 'Needs attention'}</h3>
          {concerns.length ? concerns.map((item) => <p key={item.id}>{item.title[lang]}</p>) : <p className="text-muted">{vi ? 'Chưa có cảnh báo cần chú ý từ dữ liệu hiện có.' : 'No warning from the available data.'}</p>}
        </div>
        <div className="rounded-control border border-line p-3 text-sm">
          <h3 className="mb-1 font-semibold text-primary">{vi ? 'Nên kiểm tra tiếp' : 'Next checks'}</h3>
          {issues.length ? <ul className="space-y-1">{issues.slice(0, 3).map((item) => <li key={item.id}>{item.check[lang]}</li>)}</ul>
            : <p className="text-muted">{vi ? 'Chưa có việc cần kiểm tra.' : 'Nothing to check.'}</p>}
        </div>
      </div>
    </SectionCard>
    <SectionCard title={vi ? 'Cảnh báo thông minh' : 'Smart alerts'} description={vi ? 'Biến động theo ngày đặt và ghi chú quyết toán trong phạm vi báo cáo.' : 'Order-date changes and settlement notes within the report scope.'}>
      <Tabs<AlertSeverity | 'all'> value={severity} onChange={setSeverity} label={vi ? 'Lọc mức độ Affiliate' : 'Affiliate severity filter'}
        options={AFFILIATE_SEVERITIES.map((key) => ({
          key,
          label: `${key === 'all' ? (vi ? 'Tất cả' : 'All') : SEVERITY_STYLE[key].label[lang]} (${key === 'all' ? issues.length : issues.filter((item) => item.severity === key).length})`,
        }))} />
      {visible.length ? (
        <ul className="mt-3 space-y-2.5">
          {visible.map((item) => (
            <li key={item.id} className="rounded-control border border-line p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="font-semibold">{item.title[lang]}</h3><SeverityBadge severity={item.severity} lang={lang} />
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer font-semibold text-primary">{vi ? 'Xem bằng chứng' : 'View evidence'}</summary>
                <AffiliateEvidenceList items={item.evidence} lang={lang} />
              </details>
              <p className="mt-2 text-muted">{item.check[lang]}</p>
              <button type="button" className="mt-2 text-sm font-semibold text-primary hover:underline" onClick={() => setTraceId(traceId === item.id ? null : item.id)}>
                {traceId === item.id ? (vi ? 'Đóng các dòng liên quan' : 'Close related rows') : (vi ? 'Xem các dòng liên quan' : 'View related rows')}
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="mt-3 text-sm text-muted">{vi ? 'Không có cảnh báo ở mức này.' : 'No alerts at this severity.'}</p>}
    </SectionCard>
    {traceItem && traceFinance && <AffiliateOrderDetail key={traceItem.id} rows={traceRows} lang={lang} title={traceItem.title[lang]}
      period={context[lang]} reconciliation={traceFinance.reconciliation} />}
    </div>
  );
}

export type AffiliatePanelView = 'report' | 'overview' | 'products' | 'adsLive';

export function TikTokAffiliatePanel({ rows, lang, view = 'report' }: {
  rows: readonly AffiliateOrder[]; lang: Lang; view?: AffiliatePanelView;
}) {
  const vi = lang === 'vi';
  const isReport = view === 'report';
  const isProducts = view === 'products';
  const isAds = view === 'adsLive';
  const [dateBasis, setDateBasis] = useState<'orderDay' | 'settlementDay'>('orderDay');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [dimension, setDimension] = useState<Dimension>(isProducts ? 'skuId' : isAds ? 'orderType' : 'contentType');
  const [selected, setSelected] = useState<string | null>(null);
  const [shop, setShop] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'finalReceived' | 'gmv' | 'orders' | 'quantity' | 'refundedQuantity' | 'ineligible'>('finalReceived');
  const [compareFrom, setCompareFrom] = useState('');
  const [compareTo, setCompareTo] = useState('');
  const [waitDays, setWaitDays] = useState(14);
  const [detailKind, setDetailKind] = useState<'all' | 'pending' | 'settled' | 'ineligible' | 'aging' | 'differences' | null>(null);
  const [dayDetail, setDayDetail] = useState<{ day: string; field: 'orderDay' | 'settlementDay'; adsOnly: boolean } | null>(null);
  const [matrixGmv, setMatrixGmv] = useState('');
  const [matrixReceived, setMatrixReceived] = useState('');
  const detailAnchor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (detailKind || dayDetail) detailAnchor.current?.scrollIntoView({ block: 'start' });
  }, [detailKind, dayDetail, selected]);
  const shops = useMemo(() => groupAffiliate(rows, (row) => affiliateGroup(row, 'shopId')), [rows]);
  const base = useMemo(() => shop ? rows.filter((row) => row.shopId === shop) : rows, [rows, shop]);
  const scope = useMemo(() => base.filter((row) => {
    const day = row[dateBasis];
    return day && (dateBasis === 'orderDay' || row.status === 'settled') && (!from || day >= from) && (!to || day <= to);
  }), [base, dateBasis, from, to]);
  const groups = useMemo(() => groupAffiliate(scope, (row) => groupLabel(row, dimension, lang))
    .filter((row) => `${row.label} ${row.key}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => sort === 'ineligible' ? b.status.ineligible.orders - a.status.ineligible.orders
      : (b[sort] ?? -Infinity) - (a[sort] ?? -Infinity) || (b.gmv ?? 0) - (a.gmv ?? 0)), [scope, dimension, lang, search, sort]);
  const detail = useMemo(() => selected === null ? scope : scope.filter((row) => groupLabel(row, dimension, lang).key === selected),
    [scope, selected, dimension, lang]);
  const totals = useMemo(() => summarizeAffiliate(detail), [detail]);
  const scopeTotal = useMemo(() => summarizeAffiliate(scope), [scope]);
  const asOf = useMemo(() => affiliateLatestDay(rows), [rows]);
  const finance = useMemo(() => affiliateSettlement(detail, asOf, waitDays), [detail, asOf, waitDays]);
  const matrix = useMemo(() => isProducts ? affiliateProductMatrix(scope, {
    gmv: matrixGmv === '' ? null : Number(matrixGmv), received: matrixReceived === '' ? null : Number(matrixReceived),
  }) : null, [scope, isProducts, matrixGmv, matrixReceived]);
  const comparison = useMemo(() => {
    if (!from || !to || !compareFrom || !compareTo || from > to || compareFrom > compareTo) return null;
    const comparisonDays = toDayNumber(compareTo) - toDayNumber(compareFrom) + 1;
    const currentDays = toDayNumber(to) - toDayNumber(from) + 1;
    const previous = base.filter((row) => row[dateBasis] && (dateBasis === 'orderDay' || row.status === 'settled') &&
      row[dateBasis]! >= compareFrom && row[dateBasis]! <= compareTo &&
      (selected === null || groupLabel(row, dimension, lang).key === selected));
    const hasDays = (data: readonly AffiliateOrder[], days: number) =>
      new Set(data.map((row) => row[dateBasis])).size === days && data.every((row) => row.gmv !== null);
    return currentDays === comparisonDays && hasDays(detail, currentDays) && hasDays(previous, comparisonDays)
      ? summarizeAffiliate(previous) : null;
  }, [base, dateBasis, from, to, compareFrom, compareTo, detail, dimension, lang, selected]);
  const adsRows = useMemo(() => isAds ? detail.filter((row) => {
    const type = row.orderType?.trim().toLowerCase();
    return type === 'đơn hàng quảng cáo cửa hàng' || type === 'shop ads order' || type === 'shop ads orders';
  }) : [], [detail, isAds]);
  const ads = useMemo(() => isAds ? summarizeAffiliate(adsRows) : null, [adsRows, isAds]);
  const series = useMemo(() => affiliateTimeSeries(isAds ? adsRows : detail), [adsRows, detail, isAds]);
  const contentMix = useMemo(() => groupAffiliate(detail, (row) => affiliateGroup(row, 'contentType')), [detail]);
  const dates = [...new Set(detail.map((row) => row[dateBasis]).filter((day): day is string => !!day))].sort();
  const period = dates.length ? formatRangeVi({ start: dates[0], end: dates[dates.length - 1] }) : '—';
  const context = {
    vi: `TikTok Affiliate · ${dateBasis === 'orderDay' ? 'ngày đặt hàng' : 'ngày quyết toán'} ${period}`,
    en: `TikTok Affiliate · ${dateBasis === 'orderDay' ? 'order dates' : 'settlement dates'} ${period}`,
  };
  const money = (value: number | null) => fmtByUnit(value, 'vnd', lang, false);
  const field = 'min-h-10 min-w-0 max-w-full rounded-control border border-line bg-surface px-2.5 text-sm text-fg';
  const dateInput = (label: string, value: string, change: (value: string) => void) => (
    <label className="flex flex-col gap-1 text-small text-muted">{label}
      <input type="date" className={field} value={value} onChange={(e) => change(e.target.value)} />
    </label>
  );
  const openDetail = (kind: typeof detailKind) => { setDayDetail(null); setDetailKind(kind); };
  const matchingRows = dayDetail
    ? (dayDetail.adsOnly ? adsRows : detail).filter((row) => row[dayDetail.field] === dayDetail.day && (dayDetail.field !== 'settlementDay' || row.status === 'settled'))
    : detailKind === 'aging' ? finance.aging
    : detailKind === 'differences' ? detail.filter((row) => finance.reconciliation.get(row)?.status === 'difference' || finance.reconciliation.get(row)?.status === 'incomplete')
    : detailKind === 'pending' ? detail.filter((row) => row.status === 'pending' || row.status === 'awaiting_payment')
    : detailKind === 'settled' || detailKind === 'ineligible' ? detail.filter((row) => row.status === detailKind) : detail;
  const columns: Column<(typeof groups)[number]>[] = [
    { key: 'label', header: DIMENSIONS[dimension][vi ? 0 : 1], render: (row) =>
      <button type="button" className="text-left font-semibold text-primary hover:underline" onClick={() => { setSelected(row.key); openDetail('all'); }}>{row.label}</button> },
    { key: 'orders', header: vi ? 'Đơn' : 'Orders', render: (row) => fmtCount(row.orders, lang) },
    ...(isProducts ? [
      { key: 'quantity', header: vi ? 'Đã bán' : 'Units sold', render: (row: (typeof groups)[number]) => fmtCount(row.quantity, lang) },
      { key: 'refunded', header: vi ? 'Hoàn tiền' : 'Units refunded', render: (row: (typeof groups)[number]) => fmtCount(row.refundedQuantity, lang) },
    ] : []),
    { key: 'gmv', header: 'GMV Affiliate', render: (row) => money(row.gmv) },
    ...(isAds ? [{ key: 'adsCommission', header: vi ? 'Hoa hồng quảng cáo thực tế' : 'Actual Shop Ads commission',
      render: (row: (typeof groups)[number]) => money(row.actualShopAds) }] : []),
    { key: 'pending', header: vi ? 'Dự kiến đang chờ' : 'Pending estimate', render: (row) => money(row.pendingEstimated) },
    { key: 'final', header: vi ? 'Thực nhận' : 'Received', render: (row) => money(row.finalReceived) },
    { key: 'yield', header: vi ? 'Thực nhận / GMV' : 'Received / GMV', render: (row) => fmtRate(row.effectiveRate, lang) },
    { key: 'estimate', header: vi ? 'Ước tính đủ điều kiện' : 'Eligible estimate', render: (row) => money(row.estimated) },
    { key: 'ineligible', header: vi ? 'Đơn không đủ điều kiện' : 'Ineligible orders', render: (row) => fmtCount(row.status.ineligible.orders, lang) },
    ...(isProducts ? [
      { key: 'perUnit', header: vi ? 'Thực nhận / món' : 'Received / unit', render: (row: (typeof groups)[number]) => money(row.receivedPerUnit) },
      ...(dimension === 'shopId' ? [
        { key: 'share', header: vi ? 'Tỷ trọng thực nhận' : 'Share of receipts', render: (row: (typeof groups)[number]) => fmtRate(affiliateRatio(row.finalReceived, scopeTotal.finalReceived), lang) },
        { key: 'ineligibleRate', header: vi ? 'Tỷ lệ không đủ điều kiện' : 'Ineligible order rate', render: (row: (typeof groups)[number]) => fmtRate(row.ineligibleOrderRate, lang) },
      ] : []),
    ] : []),
    ...(isAds ? [
      { key: 'perOrder', header: vi ? 'Thực nhận / đơn' : 'Received / order', render: (row: (typeof groups)[number]) => money(row.receivedPerOrder) },
      { key: 'quantity', header: vi ? 'Đã bán' : 'Units sold', render: (row: (typeof groups)[number]) => fmtCount(row.quantity, lang) },
      { key: 'skus', header: 'SKU', render: (row: (typeof groups)[number]) => fmtCount(row.skus, lang) },
      { key: 'products', header: vi ? 'Sản phẩm' : 'Products', render: (row: (typeof groups)[number]) => fmtCount(row.products, lang) },
      { key: 'status', header: vi ? 'Dòng đã quyết toán / tổng' : 'Settled / total rows', render: (row: (typeof groups)[number]) => `${row.status.settled.rows} / ${row.rows}` },
    ] : []),
  ];
  const dimensions: Dimension[] = isProducts ? ['skuId', 'productId', 'shopId', 'standardRate']
    : isAds ? ['orderType', 'contentType', 'contentId', 'shopAdsRate']
    : Object.keys(DIMENSIONS) as Dimension[];
  const title = isProducts ? (vi ? 'Sản phẩm · TikTok Affiliate' : 'Products · TikTok Affiliate')
    : isAds ? (vi ? 'Quảng cáo & nội dung · TikTok Affiliate' : 'Ads & content · TikTok Affiliate') : 'TikTok Affiliate';
  const chart = (data: typeof series.orders, key: 'gmv' | 'finalReceived' | 'estimated' | 'orders', title: string, basis: 'orderDay' | 'settlementDay') => (
    <SectionCard title={title}>
      {data.some((row) => row[key] !== null) ? (
        <div className="h-56 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" tickFormatter={fmtDay} {...axisProps} minTickGap={14} />
              <YAxis tickFormatter={(n: number) => key === 'orders' ? fmtCount(n, lang) : fmtMoneyCompact(n, lang)} {...axisProps} width={64} />
              <Tooltip {...tooltipProps} labelFormatter={fmtDay} formatter={(n: number) => [key === 'orders' ? fmtCount(n, lang) : money(n), title]} />
              <Bar dataKey={key} fill={CHART.bar} maxBarSize={34} radius={[4, 4, 0, 0]} isAnimationActive={false}
                className="cursor-pointer" onClick={(entry) => {
                  const day = (entry.payload as (typeof series.orders)[number] | undefined)?.key;
                  if (day) { setDetailKind(null); setDayDetail({ day, field: basis, adsOnly: isAds && key !== 'orders' }); }
                }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : <p className="text-sm text-muted">{vi ? 'Chưa có dữ liệu trong phạm vi này.' : 'No data in this selection.'}</p>}
    </SectionCard>
  );
  return (
    <div className="space-y-4 [&_.text-kpi]:[overflow-wrap:anywhere] [&_.text-kpi]:text-[clamp(1.125rem,3vw,2rem)] [&_.text-kpi]:leading-tight" id={isReport ? 'tiktok-affiliate-report' : `tiktok-affiliate-${view}`}>
      <SectionCard title={title} description={isAds
        ? (vi ? 'Đơn, GMV và thực nhận của đơn quảng cáo dựa vào loại đơn trong file. Hoa hồng quảng cáo lấy từ cột riêng trên tất cả các dòng đã quyết toán trong phạm vi lọc.' : 'Ad-order counts, GMV and received amounts use the order type. Shop Ads commission is read from its own column across all settled rows in the selection.')
        : (vi ? 'Hoa hồng của nhà sáng tạo được theo dõi riêng với doanh số của shop.' : 'Creator commission is tracked separately from seller sales.')}>
        <div className="flex flex-wrap gap-2">
          <select aria-label={vi ? 'Lọc theo loại ngày' : 'Date basis'} className={field} value={dateBasis} onChange={(e) => setDateBasis(e.target.value as typeof dateBasis)}>
            <option value="orderDay">{vi ? 'Ngày đặt hàng' : 'Order date'}</option>
            <option value="settlementDay">{vi ? 'Ngày quyết toán' : 'Settlement date'}</option>
          </select>
          <input type="date" aria-label={vi ? 'Từ ngày' : 'From'} className={field} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" aria-label={vi ? 'Đến ngày' : 'To'} className={field} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          {isProducts && <select className={field} value={shop} aria-label={vi ? 'Lọc cửa hàng' : 'Filter shop'} onChange={(e) => { setShop(e.target.value); setSelected(null); }}>
            <option value="">{vi ? 'Tất cả cửa hàng' : 'All shops'}</option>
            {shops.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>}
          {selected !== null && <button type="button" className={field} onClick={() => { setSelected(null); openDetail(null); }}>{vi ? 'Bỏ lọc nhóm' : 'Clear group filter'}</button>}
        </div>
        {selected !== null && <p className="mt-2 text-small text-muted">{groups.find((group) => group.key === selected)?.label ?? selected}</p>}
        <StatStrip className="mt-3" items={ads ? [
          { label: vi ? 'Đơn quảng cáo cửa hàng' : 'Shop Ads orders', value: fmtCount(ads.orders, lang) },
          { label: vi ? 'GMV đơn quảng cáo' : 'Ads-order GMV', value: money(ads.gmv) },
          { label: vi ? 'Hoa hồng quảng cáo thực tế' : 'Actual Shop Ads commission', value: money(totals.actualShopAds) },
          { label: vi ? 'Thực nhận từ đơn quảng cáo' : 'Received from ad orders', value: money(ads.finalReceived) },
        ] : isProducts ? [
          { label: vi ? 'SKU' : 'SKUs', value: fmtCount(new Set(detail.map((row) => row.skuId)).size, lang) },
          { label: vi ? 'Số món bán ra' : 'Units sold', value: fmtCount(totals.quantity, lang) },
          { label: vi ? 'Số món hoàn tiền' : 'Units refunded', value: fmtCount(totals.refundedQuantity, lang) },
          { label: vi ? 'Thực nhận đã quyết toán' : 'Final received', value: money(totals.finalReceived) },
        ] : [
          { label: 'GMV Affiliate', value: money(totals.gmv) },
          { label: vi ? 'Hoa hồng dự kiến' : 'Estimated commission', value: money(totals.estimated) },
          ...(isReport ? [{ label: vi ? 'Hoa hồng thực tế' : 'Actual commission', value: money(totals.actual) }] : []),
          { label: vi ? 'Thực nhận đã quyết toán' : 'Final received', value: money(totals.finalReceived) },
          { label: vi ? 'Đơn duy nhất' : 'Unique orders', value: fmtCount(totals.orders, lang) },
          ...(isReport ? [
            { label: vi ? 'Dòng SKU' : 'SKU rows', value: fmtCount(totals.rows, lang) },
            { label: vi ? 'Số món bán ra' : 'Units sold', value: fmtCount(totals.quantity, lang) },
            { label: vi ? 'Số món hoàn tiền' : 'Units refunded', value: fmtCount(totals.refundedQuantity, lang) },
          ] : []),
        ]} />
        {!isAds && !isProducts && <details className="mt-3 rounded-control border border-line p-3">
          <summary className="cursor-pointer text-sm font-semibold text-primary">{vi ? 'Chỉ số bổ sung và so sánh hai kỳ' : 'Additional KPIs and period comparison'}</summary>
          <StatStrip items={[
            { label: vi ? 'Hoa hồng ước tính theo file (trước thuế)' : 'Export estimate (before tax)', value: money(totals.estimatedAll), title: vi ? 'Gồm cả các dòng không đủ điều kiện. Chỉ tiêu đủ điều kiện hiển thị riêng.' : 'Includes ineligible rows. Eligible estimate is shown separately.' },
            { label: vi ? 'PIT ước tính theo file' : 'Estimated PIT in export', value: money(totals.estimatedPitAll), title: vi ? 'Tổng PIT do TikTok báo cáo, gồm cả các dòng không đủ điều kiện.' : 'Reported PIT across all rows, including ineligible rows.' },
            { label: vi ? 'Ước tính đủ điều kiện sau thuế, phần có dữ liệu' : 'Eligible after-tax estimate, covered rows', value: money(finance.afterTax), sub: `${finance.coveredRows}/${finance.estimatedRows} ${vi ? 'dòng' : 'rows'}` },
            { label: vi ? 'Ước tính không đủ điều kiện' : 'Ineligible estimate', value: money(totals.ineligibleEstimate) },
            { label: vi ? 'Tỷ lệ đơn có dòng đã quyết toán' : 'Orders with a settled row', value: fmtRate(totals.settledOrderRate, lang) },
            { label: 'AOV', value: money(totals.aov), title: vi ? 'GMV Affiliate / số đơn duy nhất' : 'Affiliate GMV / unique orders' },
            { label: vi ? 'Tỷ suất thực nhận / GMV' : 'Received / GMV rate', value: fmtRate(totals.effectiveRate, lang), title: vi ? 'Thực nhận của dòng đã quyết toán / GMV của toàn bộ dòng trong phạm vi lọc.' : 'Settled receipts divided by GMV of all rows in the selection.' },
            { label: vi ? 'Món bán / hoàn' : 'Units sold / refunded', value: `${fmtCount(totals.quantity, lang)} / ${fmtCount(totals.refundedQuantity, lang)}` },
          ]} />
          <div className="mt-3 flex flex-wrap gap-2">
            {dateInput(vi ? 'Kỳ so sánh từ' : 'Comparison from', compareFrom, setCompareFrom)}
            {dateInput(vi ? 'Đến' : 'To', compareTo, setCompareTo)}
          </div>
          {comparison ? <p className="mt-2 text-sm tabular">
            GMV: {money(comparison.gmv)} → {money(totals.gmv)} · {vi ? 'Đơn' : 'Orders'}: {fmtCount(comparison.orders, lang)} → {fmtCount(totals.orders, lang)}
            {' · '}{vi ? 'Thực nhận' : 'Received'}: {money(comparison.finalReceived)} → {money(totals.finalReceived)}
          </p> : <p className="mt-2 text-small text-muted">{vi ? 'Chọn hai kỳ cùng số ngày, mỗi ngày phải có dữ liệu theo loại ngày đang chọn.' : 'Select two periods with equal day counts and records for every day on the selected date basis.'}</p>}
        </details>}
        {(isReport || view === 'overview') && <><div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line text-muted"><th scope="col" className="py-2 text-left">{vi ? 'Trạng thái quyết toán' : 'Settlement status'}</th><th scope="col" className="text-right">{vi ? 'Đơn' : 'Orders'}</th><th scope="col" className="pl-2 text-right">{vi ? 'Dòng' : 'Rows'}</th></tr></thead>
            <tbody>{(Object.keys(AFFILIATE_STATUS) as (keyof typeof AFFILIATE_STATUS)[]).map((status) => (
              <tr key={status} className="border-b border-line"><th scope="row" className="py-2 text-left font-medium">{AFFILIATE_STATUS[status][lang]}</th><td className="text-right tabular">{fmtCount(totals.status[status].orders, lang)}</td><td className="text-right tabular">{fmtCount(totals.status[status].rows, lang)}</td></tr>
            ))}</tbody>
          </table>
        </div>
        <p className="mt-2 text-sm text-fg">{vi ? 'Đơn chưa quyết toán' : 'Orders awaiting settlement'}: <b>{fmtCount(totals.pendingOrders, lang)}</b> · {vi ? 'Hoa hồng dự kiến đang chờ' : 'Pending estimated commission'}: <b>{money(totals.pendingEstimated)}</b></p>
        <p className="mt-2 text-small text-muted">{vi ? 'Một đơn có nhiều SKU có thể xuất hiện ở nhiều trạng thái.' : 'An order with multiple SKUs can appear in more than one status.'}</p>
        {totals.rows > 0 && <details className="mt-2">
          <summary className="cursor-pointer text-sm font-semibold text-primary">{vi ? 'Biểu đồ trạng thái theo dòng SKU' : 'Settlement mix by SKU row'}</summary>
          <div className="mt-2 space-y-2 text-sm">
            {(Object.keys(AFFILIATE_STATUS) as (keyof typeof AFFILIATE_STATUS)[]).map((status) => {
              const count = totals.status[status].rows;
              const share = count / totals.rows;
              return <div key={status}>
                <div className="flex flex-wrap justify-between gap-1"><span>{AFFILIATE_STATUS[status][lang]}</span><span>{fmtCount(count, lang)} · {fmtRate(share, lang)}</span></div>
                <div className="mt-1 h-2 overflow-hidden rounded-control bg-surface-2" aria-hidden><div className="h-full rounded-control" style={{ width: `${share * 100}%`, backgroundColor: CHART.bar }} /></div>
              </div>;
            })}
          </div>
        </details>}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button onClick={() => openDetail('all')}>{vi ? 'Xem dòng theo GMV' : 'View GMV rows'}</Button>
          <Button onClick={() => openDetail('pending')}>{vi ? 'Xem hoa hồng đang chờ' : 'View pending commission'}</Button>
          <Button onClick={() => openDetail('settled')}>{vi ? 'Xem đã quyết toán' : 'View settled rows'}</Button>
          <Button onClick={() => openDetail('ineligible')}>{vi ? 'Xem không đủ điều kiện' : 'View ineligible rows'}</Button>
        </div>
        {totals.settledWithoutFinal > 0 && <p className="mt-2 text-small text-warn">{vi
          ? `${fmtCount(totals.settledWithoutFinal, lang)} dòng đã quyết toán chưa có số tiền thực nhận.`
          : `${fmtCount(totals.settledWithoutFinal, lang)} settled rows have no final received amount.`}</p>}
        </>}
        {isReport && <details className="mt-4 border-t border-line pt-3">
          <summary className="cursor-pointer text-sm text-primary">{vi ? 'Chi tiết hoa hồng, thưởng, thuế và khoản chia' : 'Commissions, bonuses, taxes and shares'}</summary>
          <p className="my-2 text-small text-muted">{vi ? 'Thực nhận lấy trực tiếp từ báo cáo. Thuế giữ nguyên dấu theo file.' : 'Final received is read from the report. Taxes retain their original signs.'}</p>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line text-muted"><th scope="col" className="text-left">{vi ? 'Khoản mục' : 'Item'}</th><th scope="col" className="text-right">{vi ? 'Dự kiến' : 'Estimated'}</th><th scope="col" className="text-right">{vi ? 'Thực tế' : 'Actual'}</th></tr></thead>
            <tbody>{SETTLEMENT_FIELDS.map(([estimate, actual, labelVi, labelEn]) => (
              <tr key={actual} className="border-b border-line"><th scope="row" className="py-1 text-left font-medium">{vi ? labelVi : labelEn}</th><td className="text-right tabular">{money(totals[estimate])}</td><td className="text-right tabular">{money(totals[actual])}</td></tr>
            ))}</tbody>
          </table>
        </details>}
      </SectionCard>
      {!isProducts || selected !== null ? <div className="grid gap-4 lg:grid-cols-2">
        {chart(series.orders, 'gmv', isAds ? (vi ? 'GMV đơn quảng cáo theo ngày đặt' : 'Ads-order GMV by order date') : (vi ? 'GMV Affiliate theo ngày đặt' : 'Affiliate GMV by order date'), 'orderDay')}
        {chart(series.settled, 'finalReceived', isAds ? (vi ? 'Thực nhận đơn quảng cáo theo ngày quyết toán' : 'Received from ad orders by settlement date') : (vi ? 'Thực nhận theo ngày quyết toán' : 'Final received by settlement date'), 'settlementDay')}
        {!isAds && chart(series.orders, 'estimated', vi ? 'Hoa hồng dự kiến đủ điều kiện theo ngày đặt' : 'Eligible estimated commission by order date', 'orderDay')}
        {isAds && chart(affiliateTimeSeries(detail).orders, 'orders', vi ? 'Xu hướng tạo đơn của nội dung' : 'Content orders by order date', 'orderDay')}
      </div> : null}
      {(isAds || view === 'overview') && <SectionCard title={vi ? 'Cơ cấu Video, Live và Trang trưng bày' : 'Video, Live and Showcase mix'}
        description={vi ? 'Tỷ trọng trong phạm vi đã lọc. Một đơn có thể xuất hiện ở nhiều nhóm.' : 'Shares within the selection. An order may appear in multiple groups.'}>
        <DataTable rows={contentMix} rowKey={(row) => row.key} lang={lang} columns={[
          { key: 'label', header: vi ? 'Loại nội dung' : 'Content type', render: (row) => row.label },
          { key: 'orders', header: vi ? 'Đơn' : 'Orders', render: (row) => fmtCount(row.orders, lang) },
          { key: 'units', header: vi ? 'Món bán' : 'Units sold', render: (row) => fmtCount(row.quantity, lang) },
          { key: 'gmv', header: 'GMV', render: (row) => <>{money(row.gmv)} · {fmtRate(affiliateRatio(row.gmv, totals.gmv), lang)}</> },
          { key: 'received', header: vi ? 'Thực nhận' : 'Received', render: (row) => <>{money(row.finalReceived)} · {fmtRate(affiliateRatio(row.finalReceived, totals.finalReceived), lang)}</> },
          { key: 'perOrder', header: vi ? 'Thực nhận / đơn' : 'Received / order', render: (row) => money(row.receivedPerOrder) },
          { key: 'ineligible', header: vi ? 'Tỷ lệ không đủ điều kiện' : 'Ineligible order rate', render: (row) => fmtRate(row.ineligibleOrderRate, lang) },
        ]} />
      </SectionCard>}
      {view !== 'overview' && <SectionCard title={vi ? 'Phân tích Affiliate theo nhóm' : 'Affiliate breakdown'} description={vi ? 'Bấm một dòng để lọc các chỉ số phía trên.' : 'Select a row to filter the report above.'} tools={(
        <>
        <select aria-label={vi ? 'Nhóm phân tích' : 'Group by'} value={dimension} className={field} onChange={(e) => { setDimension(e.target.value as Dimension); setSelected(null); }}>
          {dimensions.map((key) => <option key={key} value={key}>{DIMENSIONS[key][vi ? 0 : 1]}</option>)}
        </select>
        <input className={field} type="search" value={search} onChange={(e) => setSearch(e.target.value)}
          aria-label={vi ? 'Tìm nhóm' : 'Search groups'} placeholder={vi ? 'Tìm tên hoặc ID' : 'Search name or ID'} />
        <select className={field} value={sort} aria-label={vi ? 'Xếp hạng theo' : 'Rank by'} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="finalReceived">{vi ? 'Thực nhận' : 'Received'}</option><option value="gmv">GMV</option>
          <option value="orders">{vi ? 'Số đơn' : 'Orders'}</option><option value="quantity">{vi ? 'Món bán' : 'Units sold'}</option>
          <option value="refundedQuantity">{vi ? 'Món hoàn' : 'Refunded units'}</option><option value="ineligible">{vi ? 'Không đủ điều kiện' : 'Ineligible'}</option>
        </select>
        </>
      )}>
        <DataTable rows={groups} rowKey={(row) => row.key} columns={columns} lang={lang} maxHeight={360} onRowClick={(row) => { setSelected(row.key); openDetail('all'); }} />
      </SectionCard>}
      {matrix && <SectionCard title={vi ? 'Ma trận hiệu quả sản phẩm' : 'Product performance matrix'}
        description={vi ? 'Mặc định dùng trung vị của các sản phẩm có đủ GMV và thực nhận. Các sản phẩm bằng ngưỡng được xếp vào nhóm cao.' : 'Defaults to the median of products with both GMV and received commission. Values at the cutoff count as high.'}>
        <div className="flex flex-wrap gap-2">
          <input type="number" min="0" value={matrixGmv} onChange={(e) => setMatrixGmv(e.target.value)}
            className={field} aria-label={vi ? 'Ngưỡng GMV' : 'GMV cutoff'} placeholder={vi ? 'Ngưỡng GMV' : 'GMV cutoff'} />
          <input type="number" min="0" value={matrixReceived} onChange={(e) => setMatrixReceived(e.target.value)}
            className={field} aria-label={vi ? 'Ngưỡng thực nhận' : 'Received cutoff'} placeholder={vi ? 'Ngưỡng thực nhận' : 'Received cutoff'} />
        </div>
        <p className="my-2 text-small text-muted">GMV ≥ {money(matrix.gmv)} · {vi ? 'Thực nhận' : 'Received'} ≥ {money(matrix.received)}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {[[true, true], [true, false], [false, true], [false, false]].map(([highGmv, highReceived]) => {
            const items = matrix.rows.filter((item) => item.highGmv === highGmv && item.highReceived === highReceived);
            const rank = (high: boolean) => high ? (vi ? 'cao' : 'high') : (vi ? 'thấp' : 'low');
            return <details key={`${highGmv}-${highReceived}`} className="rounded-control border border-line p-2 text-sm">
              <summary className="cursor-pointer">GMV {rank(highGmv)} · {vi ? 'Thực nhận' : 'Received'} {rank(highReceived)} ({fmtCount(items.length, lang)})</summary>
              <ul className="mt-2 max-h-56 space-y-1 overflow-auto">{items.map((item) => <li key={item.key}>
                <button type="button" className="text-left text-primary hover:underline" onClick={() => { setDimension('productId'); setSelected(item.key); openDetail('all'); }}>{item.label}</button>
              </li>)}</ul>
            </details>;
          })}
        </div>
      </SectionCard>}
      {isReport && <SectionCard title={vi ? 'Đối soát và thời gian quyết toán' : 'Settlement reconciliation and timing'}>
        <StatStrip items={[
          { label: vi ? 'Ước tính trước thuế, phần có dữ liệu' : 'Before tax, reported subset', value: money(finance.coveredEstimate) },
          { label: vi ? 'Thuế ước tính có báo cáo' : 'Reported estimated tax', value: money(finance.coveredTax) },
          { label: vi ? 'Ước tính sau thuế' : 'After-tax estimate', value: money(finance.afterTax), sub: `${finance.coveredRows}/${finance.estimatedRows} ${vi ? 'dòng' : 'rows'}` },
          { label: vi ? 'Thực nhận theo file' : 'Received in export', value: money(totals.finalReceived) },
        ]} />
        <p className="mt-2 text-small text-muted">{vi ? 'Ước tính và thực nhận là hai phạm vi. Khoản đang chờ và khoản không đủ điều kiện được trình bày riêng.' : 'Estimates and receipts are separate scopes. Pending and ineligible amounts are shown separately.'}</p>
        <p className="mt-3 text-sm">{vi ? 'Đã khớp / chênh lệch / thiếu thành phần' : 'Matched / different / missing components'}: <b>{finance.matched} / {finance.differences} / {finance.incomplete}</b></p>
        {finance.comparisonRows > 0 && <p className="mt-2 text-sm">{vi ? 'Ước tính → thực tế trước điều chỉnh trên cùng dòng' : 'Estimated → actual before adjustments on the same rows'} ({fmtCount(finance.comparisonRows, lang)}): <b>{money(finance.comparableEstimate)} → {money(finance.comparableActual)}</b></p>}
        <p className="mt-2 text-sm">{vi ? 'Thời gian quyết toán trung bình (ngày lịch)' : 'Average settlement time (calendar days)'}: <b>{finance.averageDays === null ? '—' : finance.averageDays.toLocaleString(lang, { maximumFractionDigits: 1 })}</b>
          {' · '}{finance.durationBins.map((bin) => `${bin.label}: ${fmtCount(bin.count, lang)}`).join(' · ')}</p>
        <div className="my-3 flex flex-wrap items-center gap-2">
          <label className="text-sm">{vi ? 'Ngưỡng chờ (ngày)' : 'Pending age (days)'} <input type="number" min="0" max="365" value={waitDays} onChange={(e) => setWaitDays(Math.max(0, Number(e.target.value)))} className={`${field} w-20`} /></label>
          <Button onClick={() => openDetail('aging')}>{vi ? 'Xem dòng chờ lâu' : 'Review older pending rows'} ({finance.aging.length})</Button>
          <Button onClick={() => openDetail('differences')}>{vi ? 'Xem dòng cần đối soát' : 'View rows to reconcile'} ({finance.differences + finance.incomplete})</Button>
        </div>
        <p className="mb-2 text-small text-muted">{vi ? `Tuổi khoản chờ tính đến ngày cuối trong file: ${asOf || '—'}.` : `Pending age measured at the last date in the export: ${asOf || '—'}.`}</p>
        <DataTable rows={[...finance.shops].sort((a, b) => (b.averageDays ?? 0) - (a.averageDays ?? 0))} rowKey={(row) => row.key} lang={lang} maxHeight={280} columns={[
          { key: 'label', header: vi ? 'Cửa hàng' : 'Shop', render: (row) => row.label },
          { key: 'rows', header: vi ? 'Dòng có ngày hợp lệ' : 'Rows with valid dates', render: (row) => fmtCount(row.count, lang) },
          { key: 'days', header: vi ? 'Ngày quyết toán trung bình' : 'Average settlement days', render: (row) => row.averageDays?.toLocaleString(lang, { maximumFractionDigits: 1 }) ?? '—' },
        ]} />
      </SectionCard>}
      {(detailKind || dayDetail) && <div ref={detailAnchor} className="scroll-mt-24"><AffiliateOrderDetail rows={matchingRows} lang={lang}
        title={dayDetail ? `${vi ? 'Chi tiết ngày' : 'Daily detail'} ${dayDetail.day}` : (vi ? 'Chi tiết đơn và quyết toán' : 'Order and settlement detail')}
        period={period} reconciliation={finance.reconciliation} key={`${detailKind}-${dayDetail?.day}-${selected}-${from}-${to}`} /></div>}
      {isReport && <AffiliateDolphin rows={detail} lang={lang} context={context} />}
    </div>
  );
}

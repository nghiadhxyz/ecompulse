import React, { useMemo, useState } from 'react';
import { breakdown, compareRanges, compareValues, DIMENSION_LABELS, fmtMoney, fmtMoneyCompact, fmtRate, formatRangeVi, type BreakdownDimension, type ProfitLine } from '../../../analytics';
import { useWorkspace } from '../../seller/SellerContext';
import { GhostButton, NotEnoughData, Section, SourceBadge, tr } from '../../seller/ui';
import { BreakdownTable, ChangeCell } from '../ui';

const DIMS: BreakdownDimension[] = ['platform', 'category', 'subcategory', 'sku', 'combo', 'campaign', 'liveSession', 'channel', 'week', 'month'];
const COST_KEYS = new Set(['sellerDiscount', 'refund', 'cogs', 'platformFee', 'paymentFee', 'affiliate', 'ads', 'shipping', 'otherCosts']);

export const RevenueProfit: React.FC = () => {
  const { lang, dataset, baseFilter, previousRange, range, goTo } = useWorkspace();
  const vi = lang === 'vi';
  const [dim, setDim] = useState<BreakdownDimension>('platform');
  const cmp = useMemo(() => compareRanges(dataset, baseFilter, previousRange), [dataset, baseFilter, previousRange]);
  const b = useMemo(() => breakdown(dataset, baseFilter, dim, previousRange, lang), [dataset, baseFilter, dim, previousRange, lang]);
  const profit = cmp.current.profit;
  const prevLines = new Map((cmp.previous.profit?.lines ?? []).map((l) => [l.key, l.amount]));

  if (!profit || profit.completeness === 'insufficient') {
    return (
      <Section title={vi ? 'Doanh thu & Lợi nhuận' : 'Revenue & Profit'}>
        <NotEnoughData
          lang={lang}
          reason={profit?.warnings[0]?.[lang] ?? (vi ? 'Cần file xuất đơn hàng có giá vốn.' : 'Needs an order export with COGS.')}
          action={<GhostButton onClick={() => goTo('settings')}>{vi ? 'Nhập giá vốn' : 'Enter COGS'}</GhostButton>}
        />
      </Section>
    );
  }

  const gmv = profit.gmv.value || 1;
  let running = 0;
  const bars = profit.lines.map((l: ProfitLine) => {
    const amount = l.amount ?? 0;
    const isTotal = l.key === 'gmv' || l.key === 'netRevenue' || l.key === 'profit';
    let start: number;
    let end: number;
    if (isTotal) {
      start = Math.min(0, amount);
      end = Math.max(0, amount);
      running = amount;
    } else {
      start = running - amount;
      end = running;
      running -= amount;
    }
    return { line: l, isTotal, start, end };
  });
  const min = Math.min(0, ...bars.map((x) => x.start));
  const span = gmv - min || 1;

  return (
    <div className="space-y-4">
      <Section
        title={vi ? 'Thác nước lợi nhuận' : 'Profit waterfall'}
        subtitle={`${formatRangeVi(range)} · ${vi ? 'so với' : 'vs'} ${formatRangeVi(previousRange)}`}
      >
        {profit.warnings.length > 0 && (
          <ul className="mb-3 rounded-xl border border-[#fab219]/40 bg-[#fab219]/10 p-3 space-y-0.5">
            {profit.warnings.map((w, i) => (
              <li key={i} className="text-xs text-amber-100">• {w[lang]}</li>
            ))}
          </ul>
        )}
        <div className="space-y-1" role="table" aria-label={vi ? 'Thác nước lợi nhuận' : 'Profit waterfall'}>
          {bars.map(({ line: l, isTotal, start, end }) => {
            const prev = prevLines.get(l.key) ?? null;
            const change = compareValues(l.amount, prev, 'vnd');
            const cost = COST_KEYS.has(l.key);
            return (
              <div key={l.key} role="row" className={`grid grid-cols-[minmax(120px,190px)_1fr_auto] sm:grid-cols-[210px_1fr_120px_80px] items-center gap-2 text-xs ${isTotal ? 'font-bold text-white' : 'text-slate-200'}`}>
                <div role="cell" className="flex items-center gap-1.5 min-w-0">
                  <span className="truncate">{cost ? '− ' : isTotal && l.key !== 'gmv' ? '= ' : ''}{tr(lang, l.label)}</span>
                  {!isTotal && <SourceBadge source={l.source} lang={lang} />}
                </div>
                <div role="cell" className="relative h-4 rounded bg-white/[0.03]" aria-hidden>
                  <div
                    className={`absolute top-0 h-4 rounded ${isTotal ? (l.key === 'profit' && (l.amount ?? 0) < 0 ? 'bg-[#d03b3b]' : 'bg-[#3987e5]') : 'bg-[#e66767]/70'}`}
                    style={{ left: `${((start - min) / span) * 100}%`, width: `${Math.max(0.4, ((end - start) / span) * 100)}%` }}
                  />
                </div>
                <div role="cell" className="text-right whitespace-nowrap">{l.amount === null ? '—' : fmtMoney(l.amount, lang)}</div>
                <div role="cell" className="hidden sm:block text-right text-[11px]"><ChangeCell c={change} goodWhenUp={!cost} lang={lang} /></div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-300">
          <span>Margin: <b className="text-white">{fmtRate(profit.margin.value, lang)}</b></span>
          <span>{vi ? 'Lợi nhuận trước Ads' : 'Profit before ads'}: <b className="text-white">{fmtMoneyCompact(profit.profitBeforeAds.value, lang)}</b></span>
          <span className="text-slate-500">{vi ? 'Cột cuối: thay đổi so với kỳ so sánh (chi phí tăng hiển thị màu đỏ).' : 'Last column: change vs comparison (cost increases in red).'}</span>
        </div>
      </Section>

      <Section
        title={vi ? 'Lợi nhuận theo chiều phân tích' : 'Profit by dimension'}
        right={
          <label className="text-xs text-slate-300 flex items-center gap-1.5">
            {vi ? 'Phân theo' : 'By'}
            <select value={dim} onChange={(e) => setDim(e.target.value as BreakdownDimension)} className="bg-white/[0.06] border border-white/15 rounded-lg px-2 py-1 text-slate-100 [color-scheme:dark]">
              {DIMS.map((d) => (
                <option key={d} value={d}>{tr(lang, DIMENSION_LABELS[d])}</option>
              ))}
            </select>
          </label>
        }
      >
        {b.unavailable ? (
          <NotEnoughData lang={lang} reason={tr(lang, b.unavailable)} />
        ) : (
          <>
            <BreakdownTable
              rows={b.rows}
              lang={lang}
              firstHeader={tr(lang, DIMENSION_LABELS[dim])}
              columns={dim === 'week' || dim === 'month' ? ['gmv', 'net', 'profit', 'margin', 'orders', 'cancel'] : ['gmv', 'share', 'gmvChange', 'net', 'profit', 'profitChange', 'margin']}
            />
            <p className="text-[11px] text-slate-500 mt-2">
              {['combo', 'liveSession', 'channel'].includes(dim)
                ? vi ? 'Chi phí Ads và chi phí chung không phân bổ được theo chiều này nên chưa bị trừ (dấu *). Tổng lợi nhuận shop ở thác nước phía trên.' : 'Ads and overheads cannot be attributed to this dimension (*).'
                : vi ? 'Chi phí chung (lương, thuê kho…) không phân bổ theo chiều — chỉ trừ ở tổng shop.' : 'Overheads are only deducted at shop level.'}
            </p>
          </>
        )}
      </Section>
    </div>
  );
};

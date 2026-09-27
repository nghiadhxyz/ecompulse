import React from 'react';
import { ChevronRight } from 'lucide-react';
import { fmtChange, fmtCount, fmtMoneyCompact, fmtPp, fmtRate, type BreakdownRow, type Comparison, type Lang, fmtPortion, fmtShare, MIN_RATE_ORDERS, SMALL_RATE_NOTE } from '../../analytics';

/** Relative change for amounts, percentage points for rates. `goodWhenUp=false` flips colors. */
export const ChangeCell: React.FC<{ c: Comparison; rate?: boolean; goodWhenUp?: boolean; lang: Lang }> = ({ c, rate, goodWhenUp = true, lang }) => {
  if (c.direction === 'unknown' || c.absoluteDelta === null) return <span className="text-slate-600">—</span>;
  if (!rate && c.percentageDelta === null) return <span className="text-slate-400">{lang === 'vi' ? 'mới' : 'new'}</span>;
  const good = c.direction === 'flat' ? null : (c.direction === 'up') === goodWhenUp;
  const color = good === null ? 'text-slate-400' : good ? 'text-[#4ade80]' : 'text-[#f08080]';
  return <span className={color}>{rate ? fmtPp(c.percentagePointDelta ?? null, lang) : fmtChange(c.percentageDelta, lang)}</span>;
};

export const ShareBar: React.FC<{ share: number | null }> = ({ share }) => (
  <span className="inline-block w-14 h-1.5 rounded-full bg-white/[0.07] align-middle ml-1.5" aria-hidden>
    <span className="block h-1.5 rounded-full bg-[#3987e5]" style={{ width: `${Math.max(0, Math.min(1, share ?? 0)) * 100}%` }} />
  </span>
);

export const Th: React.FC<{ children: React.ReactNode; left?: boolean; title?: string }> = ({ children, left, title }) => (
  <th title={title} className={`font-semibold px-2.5 py-2 whitespace-nowrap ${left ? 'text-left' : 'text-right'}`}>{children}</th>
);

export type BreakdownColumn = 'gmv' | 'share' | 'gmvChange' | 'contribution' | 'orders' | 'units' | 'clicks' | 'cvr' | 'aov' | 'cancel' | 'refund' | 'net' | 'profit' | 'margin' | 'profitChange';

const HEAD: Record<BreakdownColumn, { vi: string; en: string; title?: string }> = {
  gmv: { vi: 'GMV', en: 'GMV' },
  share: { vi: 'Tỷ trọng', en: 'Share' },
  gmvChange: { vi: 'Δ GMV', en: 'Δ GMV' },
  contribution: { vi: 'Đóng góp Δ', en: 'Contribution', title: 'Phần của thay đổi GMV toàn bộ do nhóm này tạo ra' },
  orders: { vi: 'Đơn', en: 'Orders' },
  units: { vi: 'SL', en: 'Units' },
  clicks: { vi: 'Traffic', en: 'Traffic', title: 'Lượt nhấp sản phẩm' },
  cvr: { vi: 'CVR', en: 'CVR' },
  aov: { vi: 'AOV', en: 'AOV' },
  cancel: { vi: 'Hủy', en: 'Cancel' },
  refund: { vi: 'Trả/hoàn', en: 'Refund' },
  net: { vi: 'DT thuần', en: 'Net rev.' },
  profit: { vi: 'Lợi nhuận', en: 'Profit' },
  margin: { vi: 'Margin', en: 'Margin' },
  profitChange: { vi: 'Δ LN', en: 'Δ Profit' },
};

function cell(row: BreakdownRow, col: BreakdownColumn, lang: Lang): React.ReactNode {
  const c = row.current;
  switch (col) {
    case 'gmv':
      return fmtMoneyCompact(c.gmv, lang);
    case 'share':
      return (
        <>
          {fmtPortion(row.gmvShare, lang)}
          <ShareBar share={row.gmvShare} />
        </>
      );
    case 'gmvChange':
      return <ChangeCell c={row.change.gmv} lang={lang} />;
    case 'contribution':
      return row.gmvContribution === null ? <span className="text-slate-600">—</span> : <span className={row.gmvContribution < 0 ? 'text-[#f08080]' : 'text-slate-200'}>{fmtRate(row.gmvContribution, lang, 0)}</span>;
    case 'orders':
      return fmtCount(c.placed, lang);
    case 'units':
      return fmtCount(c.units, lang);
    case 'clicks':
      return fmtCount(c.clicks, lang);
    case 'cvr':
      return (
        <>
          {fmtShare(c.cvr, lang, 2)} {row.previous && <span className="text-[10px]"><ChangeCell c={row.change.cvr} rate lang={lang} /></span>}
        </>
      );
    case 'aov':
      return fmtMoneyCompact(c.aov, lang);
    case 'cancel':
    case 'refund': {
      // A rate on fewer than 30 orders is only shown, never coloured as better or worse.
      const small = c.placed < MIN_RATE_ORDERS;
      const rate = col === 'cancel' ? c.cancelRate : c.refundRate;
      return (
        <span className={small ? 'text-slate-500' : ''} title={small ? SMALL_RATE_NOTE[lang] : undefined}>
          {fmtRate(rate, lang)}{' '}
          {!small && row.previous && (
            <span className="text-[10px]">
              <ChangeCell c={col === 'cancel' ? row.change.cancelRate : row.change.refundRate} rate goodWhenUp={false} lang={lang} />
            </span>
          )}
        </span>
      );
    }
    case 'net':
      return fmtMoneyCompact(c.netRevenue, lang);
    case 'profit':
      return c.profit === null ? (
        <span className="text-slate-500" title={c.profitDetail?.warnings[0]?.[lang]}>{lang === 'vi' ? 'Thiếu giá vốn' : 'No COGS'}</span>
      ) : (
        <span className={c.profit < 0 ? 'text-[#f08080] font-semibold' : 'font-semibold'}>
          {fmtMoneyCompact(c.profit, lang)}
          {!c.profitComplete && <span className="text-[#fab219]" title={c.profitDetail?.warnings.map((w) => w[lang]).join('\n')}>*</span>}
        </span>
      );
    case 'margin':
      return fmtRate(c.margin, lang);
    case 'profitChange':
      return <ChangeCell c={row.change.profit} lang={lang} />;
  }
}

export const BreakdownTable: React.FC<{
  rows: BreakdownRow[];
  columns: BreakdownColumn[];
  lang: Lang;
  firstHeader: string;
  onRowClick?: (row: BreakdownRow) => void;
  rowAction?: (row: BreakdownRow) => React.ReactNode;
  sublabel?: (row: BreakdownRow) => string | undefined;
}> = ({ rows, columns: requested, lang, firstHeader, onRowClick, rowAction, sublabel }) => {
  const vi = lang === 'vi';
  if (rows.length === 0) return <p className="text-sm text-slate-400">{vi ? 'Không có dòng nào trong khoảng này.' : 'No rows in this range.'}</p>;
  // No comparison period → no Δ columns. No COGS → no profit columns, one note instead.
  const hasPrevious = rows.some((r) => r.previous !== null);
  const hasProfit = rows.some((r) => r.current.profit !== null);
  const columns = requested.filter((c) => (hasPrevious || !DELTA_COLUMNS.includes(c)) && (hasProfit || !PROFIT_COLUMNS.includes(c)));
  return (
  <>
  <div className="overflow-x-auto rounded-xl border border-white/10">
    <table className="w-full text-xs">
      <thead className="bg-white/[0.04] text-slate-400">
        <tr>
          <Th left>{firstHeader}</Th>
          {columns.map((c) => (
            <Th key={c} title={HEAD[c].title}>{HEAD[c][lang]}</Th>
          ))}
          {rowAction && <th className="px-2.5 py-2" />}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className={`border-t border-white/5 text-slate-200 ${onRowClick ? 'hover:bg-white/[0.04] cursor-pointer' : ''}`} onClick={onRowClick ? () => onRowClick(r) : undefined}>
            <td className="px-2.5 py-2 max-w-[280px]">
              <div className="flex items-center gap-1">
                <span className="font-semibold text-white truncate">{r.label}</span>
                {onRowClick && <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" aria-hidden />}
              </div>
              {sublabel?.(r) && <div className="text-[11px] text-slate-500 truncate">{sublabel(r)}</div>}
            </td>
            {columns.map((c) => (
              <td key={c} className="px-2.5 py-2 text-right whitespace-nowrap">{cell(r, c, lang)}</td>
            ))}
            {rowAction && <td className="px-2.5 py-2 text-right" onClick={(e) => e.stopPropagation()}>{rowAction(r)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
  {!hasProfit && requested.some((c) => PROFIT_COLUMNS.includes(c)) && (
    <p className="text-[11px] text-slate-500 mt-1.5">{vi ? 'Chưa có giá vốn nên chưa tính lợi nhuận và margin.' : 'No COGS yet, so no profit or margin.'}</p>
  )}
  </>
  );
};

const DELTA_COLUMNS: BreakdownColumn[] = ['gmvChange', 'contribution', 'profitChange'];
const PROFIT_COLUMNS: BreakdownColumn[] = ['profit', 'margin', 'profitChange'];

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { fmtCount, fmtMoneyCompact, fmtPp, fmtRate, type BreakdownRow, type Comparison, type Lang, fmtPortion, fmtShare, MIN_RATE_ORDERS, SMALL_RATE_NOTE } from '../../analytics';
import { TABLE, Th, ShareBar } from '../ui/data';

export { Th, ShareBar };

/** Table change cell: ↑/↓ always shown with the colour; % for amounts, pp for rates. */
export const ChangeCell: React.FC<{ c: Comparison; rate?: boolean; goodWhenUp?: boolean; lang: Lang }> = ({ c, rate, goodWhenUp = true, lang }) => {
  if (c.direction === 'unknown' || c.absoluteDelta === null) return <span className="text-muted">—</span>;
  if (!rate && c.percentageDelta === null) return <span className="text-muted">{lang === 'vi' ? 'mới' : 'new'}</span>;
  const flat = c.direction === 'flat';
  const good = flat ? null : (c.direction === 'up') === goodWhenUp;
  const color = good === null ? 'text-muted' : good ? 'text-up' : 'text-down';
  const arrow = flat ? '→' : c.direction === 'up' ? '↑' : '↓';
  const value = rate ? fmtPp(c.percentagePointDelta ?? null, lang).replace(/^[+−-]/, '') : fmtRate(Math.abs(c.percentageDelta ?? 0), lang);
  return (
    <span className={`font-medium tabular ${color}`}>
      <span aria-hidden>{arrow}</span> {value}
    </span>
  );
};

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
      return row.gmvContribution === null ? <span className="text-muted">—</span> : <span className={row.gmvContribution < 0 ? 'text-down' : 'text-fg'}>{fmtRate(row.gmvContribution, lang, 0)}</span>;
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
        <span className={small ? 'text-muted' : ''} title={small ? SMALL_RATE_NOTE[lang] : undefined}>
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
        <span className="text-muted" title={c.profitDetail?.warnings[0]?.[lang]}>{lang === 'vi' ? 'Thiếu giá vốn' : 'No COGS'}</span>
      ) : (
        <span className={c.profit < 0 ? 'text-down font-semibold' : 'font-semibold'}>
          {fmtMoneyCompact(c.profit, lang)}
          {!c.profitComplete && <span className="text-warn" title={c.profitDetail?.warnings.map((w) => w[lang]).join('\n')}>*</span>}
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
  if (rows.length === 0) return <p className="text-sm text-muted">{vi ? 'Không có dòng nào trong khoảng này.' : 'No rows in this range.'}</p>;
  // No comparison period → no Δ columns. No COGS → no profit columns, one note instead.
  const hasPrevious = rows.some((r) => r.previous !== null);
  const hasProfit = rows.some((r) => r.current.profit !== null);
  const columns = requested.filter((c) => (hasPrevious || !DELTA_COLUMNS.includes(c)) && (hasProfit || !PROFIT_COLUMNS.includes(c)));
  return (
  <>
  <div className={TABLE.frame}>
    <table className={TABLE.table}>
      <thead className={TABLE.thead}>
        <tr>
          <Th left className="sticky left-0 z-20 bg-surface-2">{firstHeader}</Th>
          {columns.map((c) => (
            <Th key={c} title={HEAD[c].title}>{HEAD[c][lang]}</Th>
          ))}
          {rowAction && <th className={TABLE.th} />}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className={`${TABLE.tr} text-fg ${onRowClick ? 'cursor-pointer' : ''}`} onClick={onRowClick ? () => onRowClick(r) : undefined}>
            <td className="sticky left-0 z-10 max-w-[280px] bg-surface px-3 py-1.5" title={r.label}>
              <div className="flex items-center gap-1">
                <span className="truncate font-medium text-fg">{r.label}</span>
                {onRowClick && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />}
              </div>
              {sublabel?.(r) && <div className="truncate text-small text-muted">{sublabel(r)}</div>}
            </td>
            {columns.map((c) => (
              <td key={c} className={`${TABLE.td} text-right`}>{cell(r, c, lang)}</td>
            ))}
            {rowAction && <td className={`${TABLE.td} text-right`} onClick={(e) => e.stopPropagation()}>{rowAction(r)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
  {!hasProfit && requested.some((c) => PROFIT_COLUMNS.includes(c)) && (
    <p className="mt-2 text-small text-muted">{vi ? 'Chưa có giá vốn nên chưa tính lợi nhuận và margin.' : 'No COGS yet, so no profit or margin.'}</p>
  )}
  </>
  );
};

const DELTA_COLUMNS: BreakdownColumn[] = ['gmvChange', 'contribution', 'profitChange'];
const PROFIT_COLUMNS: BreakdownColumn[] = ['profit', 'margin', 'profitChange'];

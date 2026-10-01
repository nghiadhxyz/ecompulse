import React, { useMemo, useState } from 'react';
import { Search, Trophy } from 'lucide-react';
import {
  applyShortcut,
  fmtChange,
  fmtCount,
  fmtMoneyCompact,
  fmtRate,
  formatRangeVi,
  productLeaders,
  productPerformance,
  SHORTCUT_LABELS,
  type ProductRow,
  type ProductShortcut,
} from '../../../analytics';
import { useSeller } from '../SellerContext';
import { NotEnoughData, Section, GhostButton, tr } from '../ui';
import { SummaryProductsPanel } from '../../workspace/SummaryPanels';
import { Chip } from '../../ui/primitives';
import { TABLE, Th } from '../../ui/data';

const SHORTCUTS: (ProductShortcut | 'all')[] = ['all', 'bestSelling', 'topRevenue', 'topProfit', 'highMargin', 'growing', 'declining', 'losing', 'highCancel'];

/** Growth: green when up, orange when down (the arrow comes with fmtChange). */
const growthClass = (d: number | null) => ((d ?? 0) > 0 ? 'text-up' : (d ?? 0) < 0 ? 'text-down' : '');

export const ProductsView: React.FC = () => {
  const { lang, dataset, range, previousRange, platforms, openEvidence, goTo } = useSeller();
  const vi = lang === 'vi';
  const [shortcut, setShortcut] = useState<ProductShortcut | 'all'>('all');
  const [query, setQuery] = useState('');
  const perf = useMemo(() => productPerformance(dataset, { range, platforms }, previousRange), [dataset, range, platforms, previousRange]);
  const leaders = useMemo(() => productLeaders(perf), [perf]);

  if (dataset.orders.length === 0 && dataset.salesSummaries?.some((r) => r.dimension === 'sku')) {
    return (
      <div className="space-y-4">
        <SummaryProductsPanel />
        <p className="flex flex-wrap items-center gap-2 text-small text-muted">
          {vi ? 'Muốn xem lời/lỗ và bộ lọc theo từng sản phẩm, hãy nhập thêm file xuất đơn hàng (Đơn hàng → Xuất).' : 'Import an order export for per-product profit.'}
          <button type="button" onClick={() => goTo('data')} className="inline-flex min-h-10 items-center font-semibold text-primary hover:underline">
            {vi ? 'Nhập file đơn hàng' : 'Import orders'}
          </button>
        </p>
      </div>
    );
  }
  if (dataset.orders.length === 0) {
    return (
      <Section title={vi ? 'Sản phẩm' : 'Products'}>
        <NotEnoughData
          lang={lang}
          reason={vi ? 'Phân tích theo SKU cần file xuất đơn hàng. Báo cáo tổng hợp của sàn không có số liệu từng sản phẩm theo ngày.' : 'SKU analysis needs an order export.'}
          action={<GhostButton onClick={() => goTo('data')}>{vi ? 'Nhập file đơn hàng' : 'Import orders'}</GhostButton>}
        />
      </Section>
    );
  }

  const base = shortcut === 'all' ? perf.rows : applyShortcut(perf, shortcut);
  const q = query.trim().toLowerCase();
  const rows = q ? base.filter((r) => r.sku.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)) : base;
  const open = (r: ProductRow) => openEvidence({ title: `${r.name} (${r.sku})`, filter: { range, platforms, skus: [r.sku] } });

  const leaderItems: { label: string; row?: ProductRow; value: string }[] = [
    { label: vi ? 'Bán nhiều nhất' : 'Most units', row: leaders.bestSelling, value: leaders.bestSelling ? `${fmtCount(leaders.bestSelling.units, lang)} ${vi ? 'sp' : 'units'}` : '' },
    { label: vi ? 'Doanh thu cao nhất' : 'Top revenue', row: leaders.topRevenue, value: leaders.topRevenue ? fmtMoneyCompact(leaders.topRevenue.gmv, lang) : '' },
    { label: vi ? 'Lợi nhuận cao nhất' : 'Top profit', row: leaders.topProfit, value: leaders.topProfit ? fmtMoneyCompact(leaders.topProfit.profit.value, lang) : '' },
    { label: vi ? 'Biên lợi nhuận cao nhất' : 'Best margin', row: leaders.highestMargin, value: leaders.highestMargin ? fmtRate(leaders.highestMargin.margin.value, lang) : '' },
    { label: vi ? 'Tăng trưởng mạnh nhất' : 'Fastest growth', row: leaders.fastestGrowth, value: leaders.fastestGrowth ? fmtChange(leaders.fastestGrowth.growth.percentageDelta, lang) : '' },
  ];

  return (
    <div className="space-y-4">
      <Section title={vi ? '“Sản phẩm tốt nhất” theo từng tiêu chí' : '“Best product” by criterion'} subtitle={vi ? 'Mỗi tiêu chí có thể là một sản phẩm khác nhau' : 'Each criterion may be a different product'}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {leaderItems.map((l) => (
            <button
              key={l.label}
              type="button"
              disabled={!l.row}
              onClick={() => l.row && open(l.row)}
              className="rounded-control border border-line bg-surface-2 p-3 text-left hover:bg-hover disabled:cursor-default disabled:opacity-60"
            >
              <div className="flex items-center gap-1 text-small font-medium text-muted">
                <Trophy className="h-3.5 w-3.5" aria-hidden /> {l.label}
              </div>
              <div className="mt-1 line-clamp-2 text-sm font-semibold text-fg">{l.row ? l.row.name : vi ? 'Không đủ dữ liệu' : 'Not enough data'}</div>
              {l.row && <div className="mt-0.5 text-small font-semibold tabular text-primary">{l.value}</div>}
            </button>
          ))}
        </div>
      </Section>

      <Section title={vi ? 'Hiệu quả sản phẩm' : 'Product performance'} subtitle={`${formatRangeVi(range)} · ${vi ? 'tăng trưởng so với' : 'growth vs'} ${formatRangeVi(previousRange)}`}>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-1 flex-wrap gap-1" role="group" aria-label={vi ? 'Lọc nhanh' : 'Shortcuts'}>
            {SHORTCUTS.map((s) => (
              <Chip key={s} selected={shortcut === s} onClick={() => setShortcut(s)}>
                {s === 'all' ? (vi ? 'Tất cả' : 'All') : tr(lang, SHORTCUT_LABELS[s])}
              </Chip>
            ))}
          </div>
          <label className="relative block sm:w-60">
            <span className="sr-only">{vi ? 'Tìm sản phẩm' : 'Search products'}</span>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={vi ? 'Tìm SKU / tên sản phẩm' : 'Search SKU / name'}
              className="min-h-10 w-full rounded-control border border-line bg-surface pl-9 pr-3 text-sm text-fg placeholder:text-muted"
            />
          </label>
        </div>
        {perf.unallocatedAdSpend > 0 && (
          <p className="mb-3 inline-flex rounded-control bg-warn-soft px-2.5 py-1 text-small text-warn">
            {vi
              ? `${fmtMoneyCompact(perf.unallocatedAdSpend)} chi phí Ads không gắn SKU chưa được trừ vào lợi nhuận từng sản phẩm.`
              : `${fmtMoneyCompact(perf.unallocatedAdSpend, 'en')} of ad spend has no SKU and is not deducted per product.`}
          </p>
        )}

        {rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">{vi ? 'Không có sản phẩm nào khớp.' : 'No matching products.'}</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className={`hidden md:block ${TABLE.frame}`}>
              <table className={TABLE.table}>
                <thead className={TABLE.thead}>
                  <tr>
                    <Th left className="sticky left-0 z-20 bg-surface-2">{vi ? 'Sản phẩm' : 'Product'}</Th>
                    <Th>{vi ? 'SL bán' : 'Units'}</Th>
                    <Th>{vi ? 'Đơn' : 'Orders'}</Th>
                    <Th>GMV</Th>
                    <Th>{vi ? 'DT thuần' : 'Net rev.'}</Th>
                    <Th>{vi ? 'Lợi nhuận' : 'Profit'}</Th>
                    <Th>Margin</Th>
                    <Th>{vi ? 'Tỷ lệ hủy' : 'Cancel'}</Th>
                    <Th>{vi ? 'Tăng trưởng' : 'Growth'}</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.sku} onClick={() => open(r)} className={`${TABLE.tr} cursor-pointer text-fg`}>
                      <td className="sticky left-0 z-10 max-w-[260px] bg-surface px-3 py-1.5" title={r.name}>
                        <div className="truncate font-medium text-fg">{r.name}</div>
                        <div className="text-small text-muted">
                          {r.sku}
                          {r.comboId ? ' · Combo' : ''}
                        </div>
                      </td>
                      <td className={`${TABLE.td} text-right`}>{fmtCount(r.units, lang)}</td>
                      <td className={`${TABLE.td} text-right`}>{fmtCount(r.orders, lang)}</td>
                      <td className={`${TABLE.td} text-right`}>{fmtMoneyCompact(r.gmv, lang)}</td>
                      <td className={`${TABLE.td} text-right`}>{fmtMoneyCompact(r.netRevenue, lang)}</td>
                      <td className={`${TABLE.td} text-right font-semibold ${(r.profit.value ?? 0) < 0 ? 'text-down' : ''}`}>
                        {r.profit.value === null ? (
                          <span className="font-normal text-muted" title={r.profit.notes?.[0]?.[lang]}>
                            {vi ? 'Chưa có giá vốn' : 'No COGS'}
                          </span>
                        ) : (
                          fmtMoneyCompact(r.profit.value, lang)
                        )}
                      </td>
                      <td className={`${TABLE.td} text-right`}>{fmtRate(r.margin.value, lang)}</td>
                      <td className={`${TABLE.td} text-right`}>{fmtRate(r.cancelRate, lang)}</td>
                      <td className={`${TABLE.td} text-right font-medium ${growthClass(r.growth.percentageDelta)}`}>
                        {r.growth.percentageDelta === null ? (r.growth.previous === 0 && r.gmv > 0 ? (vi ? 'Mới' : 'New') : '—') : fmtChange(r.growth.percentageDelta, lang)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <ul className="space-y-2 md:hidden">
              {rows.map((r) => (
                <li key={r.sku}>
                  <button type="button" onClick={() => open(r)} className="w-full rounded-control border border-line bg-surface p-3 text-left hover:bg-hover">
                    <div className="text-sm font-semibold text-fg">{r.name}</div>
                    <div className="text-small text-muted">{r.sku}</div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-small tabular">
                      <div>
                        <div className="text-muted">GMV</div>
                        <div className="font-semibold text-fg">{fmtMoneyCompact(r.gmv, lang)}</div>
                      </div>
                      <div>
                        <div className="text-muted">{vi ? 'Lợi nhuận' : 'Profit'}</div>
                        <div className={`font-semibold ${(r.profit.value ?? 0) < 0 ? 'text-down' : 'text-fg'}`}>{r.profit.value === null ? '—' : fmtMoneyCompact(r.profit.value, lang)}</div>
                      </div>
                      <div>
                        <div className="text-muted">{vi ? 'Tăng trưởng' : 'Growth'}</div>
                        <div className={`font-semibold ${growthClass(r.growth.percentageDelta) || 'text-fg'}`}>{fmtChange(r.growth.percentageDelta, lang)}</div>
                      </div>
                      <div>
                        <div className="text-muted">{vi ? 'SL bán' : 'Units'}</div>
                        <div className="text-fg">{fmtCount(r.units, lang)}</div>
                      </div>
                      <div>
                        <div className="text-muted">Margin</div>
                        <div className="text-fg">{fmtRate(r.margin.value, lang)}</div>
                      </div>
                      <div>
                        <div className="text-muted">{vi ? 'Hủy' : 'Cancel'}</div>
                        <div className="text-fg">{fmtRate(r.cancelRate, lang)}</div>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>
    </div>
  );
};

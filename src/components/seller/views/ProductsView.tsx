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

const SHORTCUTS: (ProductShortcut | 'all')[] = ['all', 'bestSelling', 'topRevenue', 'topProfit', 'highMargin', 'growing', 'declining', 'losing', 'highCancel'];

export const ProductsView: React.FC = () => {
  const { lang, dataset, range, previousRange, platforms, openEvidence, goTo } = useSeller();
  const vi = lang === 'vi';
  const [shortcut, setShortcut] = useState<ProductShortcut | 'all'>('all');
  const [query, setQuery] = useState('');
  const perf = useMemo(() => productPerformance(dataset, { range, platforms }, previousRange), [dataset, range, platforms, previousRange]);
  const leaders = useMemo(() => productLeaders(perf), [perf]);

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
      <Section
        title={vi ? '“Sản phẩm tốt nhất” theo từng tiêu chí' : '“Best product” by criterion'}
        subtitle={vi ? 'Mỗi tiêu chí có thể là một sản phẩm khác nhau' : 'Each criterion may be a different product'}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {leaderItems.map((l) => (
            <button
              key={l.label}
              disabled={!l.row}
              onClick={() => l.row && open(l.row)}
              className="text-left rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] p-3 disabled:opacity-60"
            >
              <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                <Trophy className="w-3 h-3" aria-hidden /> {l.label}
              </div>
              <div className="text-sm font-bold text-white mt-1 line-clamp-2">{l.row ? l.row.name : vi ? 'Không đủ dữ liệu' : 'Not enough data'}</div>
              {l.row && <div className="text-xs text-sky-300 mt-0.5">{l.value}</div>}
            </button>
          ))}
        </div>
      </Section>

      <Section
        title={vi ? 'Hiệu quả sản phẩm' : 'Product performance'}
        subtitle={`${formatRangeVi(range)} · ${vi ? 'tăng trưởng so với' : 'growth vs'} ${formatRangeVi(previousRange)}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
          <div className="flex flex-wrap gap-1.5 flex-1" role="group" aria-label={vi ? 'Lọc nhanh' : 'Shortcuts'}>
            {SHORTCUTS.map((s) => (
              <button
                key={s}
                onClick={() => setShortcut(s)}
                aria-pressed={shortcut === s}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${shortcut === s ? 'bg-sky-600 border-sky-500 text-white' : 'border-white/10 text-slate-300 hover:bg-white/[0.06]'}`}
              >
                {s === 'all' ? (vi ? 'Tất cả' : 'All') : tr(lang, SHORTCUT_LABELS[s])}
              </button>
            ))}
          </div>
          <label className="relative block sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={vi ? 'Tìm SKU / tên sản phẩm' : 'Search SKU / name'}
              className="w-full bg-white/[0.05] border border-white/10 rounded-lg pl-8 pr-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500"
            />
          </label>
        </div>
        {perf.unallocatedAdSpend > 0 && (
          <p className="text-[11px] text-[#fab219] mb-2">
            {vi
              ? `${fmtMoneyCompact(perf.unallocatedAdSpend)} chi phí Ads không gắn SKU chưa được trừ vào lợi nhuận từng sản phẩm.`
              : `${fmtMoneyCompact(perf.unallocatedAdSpend, 'en')} of ad spend has no SKU and is not deducted per product.`}
          </p>
        )}

        {rows.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">{vi ? 'Không có sản phẩm nào khớp.' : 'No matching products.'}</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-xs">
                <thead className="bg-white/[0.04] text-slate-400">
                  <tr>
                    {[vi ? 'Sản phẩm' : 'Product', vi ? 'SL bán' : 'Units', vi ? 'Đơn' : 'Orders', 'GMV', vi ? 'DT thuần' : 'Net rev.', vi ? 'Lợi nhuận' : 'Profit', 'Margin', vi ? 'Tỷ lệ hủy' : 'Cancel', vi ? 'Tăng trưởng' : 'Growth'].map((h, i) => (
                      <th key={h} className={`font-semibold px-2.5 py-2 whitespace-nowrap ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.sku} onClick={() => open(r)} className="border-t border-white/5 text-slate-200 hover:bg-white/[0.04] cursor-pointer">
                      <td className="px-2.5 py-2 max-w-[260px]">
                        <div className="font-semibold text-white truncate">{r.name}</div>
                        <div className="text-[11px] text-slate-500">{r.sku}{r.comboId ? ' · Combo' : ''}</div>
                      </td>
                      <td className="px-2.5 py-2 text-right">{fmtCount(r.units, lang)}</td>
                      <td className="px-2.5 py-2 text-right">{fmtCount(r.orders, lang)}</td>
                      <td className="px-2.5 py-2 text-right">{fmtMoneyCompact(r.gmv, lang)}</td>
                      <td className="px-2.5 py-2 text-right">{fmtMoneyCompact(r.netRevenue, lang)}</td>
                      <td className={`px-2.5 py-2 text-right font-semibold ${(r.profit.value ?? 0) < 0 ? 'text-[#f08080]' : ''}`}>
                        {r.profit.value === null ? <span className="text-slate-500 font-normal" title={r.profit.notes?.[0]?.[lang]}>{vi ? 'Chưa có giá vốn' : 'No COGS'}</span> : fmtMoneyCompact(r.profit.value, lang)}
                      </td>
                      <td className="px-2.5 py-2 text-right">{fmtRate(r.margin.value, lang)}</td>
                      <td className="px-2.5 py-2 text-right">{fmtRate(r.cancelRate, lang)}</td>
                      <td className={`px-2.5 py-2 text-right ${(r.growth.percentageDelta ?? 0) > 0 ? 'text-[#4ade80]' : (r.growth.percentageDelta ?? 0) < 0 ? 'text-[#f08080]' : ''}`}>
                        {r.growth.percentageDelta === null ? (r.growth.previous === 0 && r.gmv > 0 ? (vi ? 'Mới' : 'New') : '—') : fmtChange(r.growth.percentageDelta, lang)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <ul className="md:hidden space-y-2">
              {rows.map((r) => (
                <li key={r.sku}>
                  <button onClick={() => open(r)} className="w-full text-left rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="font-semibold text-white text-sm">{r.name}</div>
                    <div className="text-[11px] text-slate-500">{r.sku}</div>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                      <div><div className="text-slate-500">GMV</div><div className="text-white font-bold">{fmtMoneyCompact(r.gmv, lang)}</div></div>
                      <div><div className="text-slate-500">{vi ? 'Lợi nhuận' : 'Profit'}</div><div className={`font-bold ${(r.profit.value ?? 0) < 0 ? 'text-[#f08080]' : 'text-white'}`}>{r.profit.value === null ? '—' : fmtMoneyCompact(r.profit.value, lang)}</div></div>
                      <div><div className="text-slate-500">{vi ? 'Tăng trưởng' : 'Growth'}</div><div className="text-white font-bold">{fmtChange(r.growth.percentageDelta, lang)}</div></div>
                      <div><div className="text-slate-500">{vi ? 'SL bán' : 'Units'}</div><div className="text-white">{fmtCount(r.units, lang)}</div></div>
                      <div><div className="text-slate-500">Margin</div><div className="text-white">{fmtRate(r.margin.value, lang)}</div></div>
                      <div><div className="text-slate-500">{vi ? 'Hủy' : 'Cancel'}</div><div className="text-white">{fmtRate(r.cancelRate, lang)}</div></div>
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

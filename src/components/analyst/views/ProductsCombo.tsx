import React, { useMemo, useState } from 'react';
import {
  comboAnalytics,
  fmtChange,
  fmtCount,
  fmtMoneyCompact,
  fmtPp,
  fmtRate,
  formatRangeVi,
  PRODUCT_CLASS_LABELS,
  productIntelligence,
  type ProductClass,
} from '../../../analytics';
import { useWorkspace } from '../../seller/SellerContext';
import { NotEnoughData, Section, tr } from '../../seller/ui';
import { SummaryProductsPanel } from '../../workspace/SummaryPanels';
import { ChangeCell, Th } from '../ui';
import { Product360Panel } from '../Product360Panel';

type Tab = 'classes' | 'p360' | 'combo';

const CLASS_STYLE: Record<ProductClass, string> = {
  scale: 'border-[#0ca30c]/40 bg-[#0ca30c]/10 text-[#4ade80]',
  maintain: 'border-white/15 bg-white/[0.05] text-slate-200',
  investigate: 'border-[#fab219]/40 bg-[#fab219]/10 text-[#fab219]',
  reconsider: 'border-[#d03b3b]/40 bg-[#d03b3b]/10 text-[#f08080]',
};

export const ProductsCombo: React.FC = () => {
  const { lang, dataset, baseFilter, previousRange, range } = useWorkspace();
  const vi = lang === 'vi';
  const [tab, setTab] = useState<Tab>('classes');
  const [cls, setCls] = useState<ProductClass | 'all'>('all');
  const [sku, setSku] = useState<string | null>(null);
  const pi = useMemo(() => productIntelligence(dataset, baseFilter, previousRange), [dataset, baseFilter, previousRange]);
  const combos = useMemo(() => comboAnalytics(dataset, baseFilter, previousRange), [dataset, baseFilter, previousRange]);

  if (dataset.orders.length === 0 && dataset.salesSummaries?.some((r) => r.dimension === 'sku')) {
    return <SummaryProductsPanel />;
  }
  if (dataset.orders.length === 0) {
    return (
      <Section title={vi ? 'Sản phẩm & Combo' : 'Products & Combo'}>
        <NotEnoughData lang={lang} reason={vi ? 'Cần file xuất đơn hàng để phân tích sản phẩm.' : 'Needs an order export.'} />
      </Section>
    );
  }
  const selected = sku ?? pi.rows[0]?.row.key ?? null;
  const rows = cls === 'all' ? pi.rows : pi.rows.filter((r) => r.classification === cls);
  const totalGmv = pi.rows.reduce((s, r) => s + r.row.current.gmv, 0) || 1;

  const tabs: { key: Tab; vi: string; en: string }[] = [
    { key: 'classes', vi: 'Phân loại sản phẩm', en: 'Classification' },
    { key: 'p360', vi: 'Product 360', en: 'Product 360' },
    { key: 'combo', vi: 'Combo', en: 'Combo' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-xl text-sm font-semibold border ${tab === t.key ? 'bg-sky-600 border-sky-500 text-white' : 'border-white/10 text-slate-300 hover:bg-white/[0.06]'}`}
          >
            {vi ? t.vi : t.en}
          </button>
        ))}
      </div>

      {tab === 'classes' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {(['scale', 'maintain', 'investigate', 'reconsider'] as ProductClass[]).map((k) => {
              const members = pi.rows.filter((r) => r.classification === k);
              const share = members.reduce((s, r) => s + r.row.current.gmv, 0) / totalGmv;
              return (
                <button
                  key={k}
                  onClick={() => setCls(cls === k ? 'all' : k)}
                  aria-pressed={cls === k}
                  className={`text-left rounded-xl border p-3 ${CLASS_STYLE[k]} ${cls === k ? 'ring-2 ring-white/40' : ''}`}
                >
                  <div className="text-xs font-bold">{tr(lang, PRODUCT_CLASS_LABELS[k])}</div>
                  <div className="text-xl font-black text-white">{members.length} <span className="text-xs font-semibold text-slate-300">SKU</span></div>
                  <div className="text-[11px] text-slate-300">{fmtRate(share, lang)} GMV</div>
                </button>
              );
            })}
          </div>
          <Section
            title={vi ? 'Phân loại & ABC' : 'Classification & ABC'}
            subtitle={
              vi
                ? `${formatRangeVi(range)} · ABC: A ${pi.abcCounts.A}, B ${pi.abcCounts.B}, C ${pi.abcCounts.C} SKU · margin shop ${fmtRate(pi.shopMargin, lang)}${pi.trafficAvailable ? '' : ' · Zombie: cần dữ liệu traffic'}`
                : `${formatRangeVi(range)} · ABC: A ${pi.abcCounts.A}, B ${pi.abcCounts.B}, C ${pi.abcCounts.C}`
            }
          >
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-xs">
                <thead className="bg-white/[0.04] text-slate-400">
                  <tr>
                    <Th left>{vi ? 'Sản phẩm' : 'Product'}</Th>
                    <Th left>{vi ? 'Nhóm đề xuất' : 'Class'}</Th>
                    <Th>ABC</Th>
                    <Th>GMV</Th>
                    <Th>Δ GMV</Th>
                    <Th title={vi ? 'Tăng trưởng trung bình ngày thường, 14 ngày gần nhất so với 14 ngày trước' : 'Normal-day momentum'}>Momentum</Th>
                    <Th>{vi ? 'Lợi nhuận' : 'Profit'}</Th>
                    <Th>Margin</Th>
                    <Th>{vi ? 'Hủy' : 'Cancel'}</Th>
                    <Th left>{vi ? 'Lý do' : 'Why'}</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.row.key}
                      className="border-t border-white/5 text-slate-200 hover:bg-white/[0.04] cursor-pointer"
                      onClick={() => {
                        setSku(r.row.key);
                        setTab('p360');
                      }}
                    >
                      <td className="px-2.5 py-2 max-w-[220px]">
                        <div className="font-semibold text-white truncate">{r.row.label}</div>
                        <div className="text-[11px] text-slate-500">
                          {r.row.key}
                          {r.isHero && <span className="ml-1 text-[#4ade80]">· Hero</span>}
                          {r.isZombie && <span className="ml-1 text-[#f08080]">· Zombie</span>}
                        </div>
                      </td>
                      <td className="px-2.5 py-2"><span className={`px-2 py-0.5 rounded-full border text-[11px] font-bold whitespace-nowrap ${CLASS_STYLE[r.classification]}`}>{tr(lang, PRODUCT_CLASS_LABELS[r.classification])}</span></td>
                      <td className="px-2.5 py-2 whitespace-nowrap text-right font-bold">{r.abc}</td>
                      <td className="px-2.5 py-2 whitespace-nowrap text-right">{fmtMoneyCompact(r.row.current.gmv, lang)}</td>
                      <td className="px-2.5 py-2 whitespace-nowrap text-right"><ChangeCell c={r.row.change.gmv} lang={lang} /></td>
                      <td className="px-2.5 py-2 whitespace-nowrap text-right">{fmtChange(r.momentum, lang)}</td>
                      <td className={`px-2.5 py-2 whitespace-nowrap text-right ${(r.row.current.profit ?? 0) < 0 ? 'text-[#f08080]' : ''}`}>{fmtMoneyCompact(r.row.current.profit, lang)}</td>
                      <td className="px-2.5 py-2 whitespace-nowrap text-right">{fmtRate(r.row.current.margin, lang)}</td>
                      <td className="px-2.5 py-2 whitespace-nowrap text-right">{fmtRate(r.row.current.cancelRate, lang)}</td>
                      <td className="px-2.5 py-2 text-slate-400 min-w-[280px] leading-snug">{r.reasons.map((x) => tr(lang, x)).join(' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              {vi
                ? 'Nhóm đề xuất dựa trên quy tắc cố định (lợi nhuận, tăng trưởng, margin so với shop, tỷ lệ hủy) — là gợi ý để xem xét, không phải kết luận.'
                : 'Classes follow fixed rules — suggestions to review, not conclusions.'}
            </p>
          </Section>
        </>
      )}

      {tab === 'p360' && selected && (
        <>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            {vi ? 'Sản phẩm' : 'Product'}
            <select value={selected} onChange={(e) => setSku(e.target.value)} className="bg-white/[0.06] border border-white/15 rounded-lg px-2 py-1 text-slate-100 [color-scheme:dark] max-w-full">
              {pi.rows.map((r) => (
                <option key={r.row.key} value={r.row.key}>{r.row.label} ({r.row.key})</option>
              ))}
            </select>
          </label>
          <Product360Panel sku={selected} insight={pi.rows.find((r) => r.row.key === selected)} />
        </>
      )}

      {tab === 'combo' && (
        <Section title={vi ? 'Combo so với bán lẻ' : 'Combo vs single SKUs'} subtitle={vi ? 'Giá trị giỏ = tổng giá trị đơn có chứa combo / sản phẩm lẻ' : 'Basket = value of orders containing the combo / singles'}>
          {!combos.available || combos.rows.length === 0 ? (
            <NotEnoughData lang={lang} reason={vi ? 'Chưa có combo trong dữ liệu (cần mã combo trên dòng sản phẩm).' : 'No combos in the data.'} />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-xs">
                <thead className="bg-white/[0.04] text-slate-400">
                  <tr>
                    <Th left>Combo</Th>
                    <Th>{vi ? 'Giá' : 'Price'}</Th>
                    <Th>{vi ? 'Đơn' : 'Orders'}</Th>
                    <Th>GMV</Th>
                    <Th>Δ GMV</Th>
                    <Th>{vi ? 'Giỏ combo' : 'Combo basket'}</Th>
                    <Th>{vi ? 'Giỏ bán lẻ' : 'Single basket'}</Th>
                    <Th>CVR</Th>
                    <Th>{vi ? 'Hủy combo / lẻ' : 'Cancel combo / single'}</Th>
                    <Th>{vi ? 'Margin combo / lẻ' : 'Margin combo / single'}</Th>
                    <Th>{vi ? 'Lợi nhuận' : 'Profit'}</Th>
                  </tr>
                </thead>
                <tbody>
                  {combos.rows.map((c) => (
                    <tr key={c.comboId} className="border-t border-white/5 text-slate-200">
                      <td className="px-2.5 py-2 max-w-[240px]">
                        <div className="font-semibold text-white truncate">{c.name}</div>
                        <div className="text-[11px] text-slate-500">{c.components.join(' + ')}</div>
                      </td>
                      <td className="px-2.5 py-2 whitespace-nowrap text-right">{fmtMoneyCompact(c.price, lang)}</td>
                      <td className="px-2.5 py-2 whitespace-nowrap text-right">{fmtCount(c.combo.current.placed, lang)}</td>
                      <td className="px-2.5 py-2 whitespace-nowrap text-right">{fmtMoneyCompact(c.combo.current.gmv, lang)}</td>
                      <td className="px-2.5 py-2 whitespace-nowrap text-right"><ChangeCell c={c.combo.change.gmv} lang={lang} /></td>
                      <td className="px-2.5 py-2 whitespace-nowrap text-right">{fmtMoneyCompact(c.comboBasket, lang)}</td>
                      <td className="px-2.5 py-2 whitespace-nowrap text-right">
                        {fmtMoneyCompact(c.singles.basket, lang)}
                        {c.basketRatio !== null && <div className="text-[10px] text-slate-400">{vi ? 'combo' : 'combo'} ×{c.basketRatio.toFixed(2)}</div>}
                      </td>
                      <td className="px-2.5 py-2 whitespace-nowrap text-right">{fmtRate(c.combo.current.cvr, lang, 2)}</td>
                      <td className="px-2.5 py-2 whitespace-nowrap text-right">{fmtRate(c.combo.current.cancelRate, lang)} / {fmtRate(c.singles.cancelRate, lang)}</td>
                      <td className="px-2.5 py-2 whitespace-nowrap text-right">
                        {fmtRate(c.combo.current.margin, lang)} / {fmtRate(c.singles.margin, lang)}
                        {c.marginDiffPp !== null && <div className={`text-[10px] ${c.marginDiffPp < 0 ? 'text-[#f08080]' : 'text-[#4ade80]'}`}>{fmtPp(c.marginDiffPp, lang)}</div>}
                      </td>
                      <td className="px-2.5 py-2 whitespace-nowrap text-right">{fmtMoneyCompact(c.combo.current.profit, lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}
    </div>
  );
};

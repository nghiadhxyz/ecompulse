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
import { NotEnoughData, tr } from '../../seller/ui';
import { SummaryProductsPanel } from '../../workspace/SummaryPanels';
import { Badge, SectionCard, Tabs, TONE_DOT, type Tone } from '../../ui/primitives';
import { TABLE } from '../../ui/data';
import { ChangeCell, Th } from '../ui';
import { Product360Panel } from '../Product360Panel';

type Tab = 'classes' | 'p360' | 'combo';

/** Scale = good, maintain = neutral, investigate = warning, reconsider = bad (orange, never red). */
const CLASS_TONE: Record<ProductClass, Tone> = {
  scale: 'up',
  maintain: 'neutral',
  investigate: 'warn',
  reconsider: 'down',
};

const field = 'min-h-10 max-w-full rounded-control border border-line bg-surface px-2.5 text-sm text-fg';

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
      <SectionCard title={vi ? 'Sản phẩm & Combo' : 'Products & Combo'}>
        <NotEnoughData lang={lang} reason={vi ? 'Cần file xuất đơn hàng để phân tích sản phẩm.' : 'Needs an order export.'} />
      </SectionCard>
    );
  }
  const selected = sku ?? pi.rows[0]?.row.key ?? null;
  const rows = cls === 'all' ? pi.rows : pi.rows.filter((r) => r.classification === cls);
  const totalGmv = pi.rows.reduce((s, r) => s + r.row.current.gmv, 0) || 1;

  return (
    <div className="space-y-4">
      <Tabs<Tab>
        label={vi ? 'Mục phân tích sản phẩm' : 'Product analysis'}
        value={tab}
        onChange={setTab}
        options={[
          { key: 'classes', label: vi ? 'Phân loại sản phẩm' : 'Classification' },
          { key: 'p360', label: 'Product 360' },
          { key: 'combo', label: 'Combo' },
        ]}
      />

      {tab === 'classes' && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {(['scale', 'maintain', 'investigate', 'reconsider'] as ProductClass[]).map((k) => {
              const members = pi.rows.filter((r) => r.classification === k);
              const share = members.reduce((s, r) => s + r.row.current.gmv, 0) / totalGmv;
              const on = cls === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setCls(on ? 'all' : k)}
                  aria-pressed={on}
                  className={`rounded-card border bg-surface p-4 text-left shadow-card hover:bg-hover ${on ? 'border-primary ring-2 ring-primary/30' : 'border-line'}`}
                >
                  <div className="flex items-center gap-2 text-small font-semibold text-muted">
                    <span className={`h-2 w-2 rounded-full ${TONE_DOT[CLASS_TONE[k]]}`} aria-hidden />
                    {tr(lang, PRODUCT_CLASS_LABELS[k])}
                  </div>
                  <div className="mt-1 text-2xl font-bold tabular text-fg">
                    {members.length} <span className="text-small font-medium text-muted">SKU</span>
                  </div>
                  <div className="text-small tabular text-muted">{fmtRate(share, lang)} GMV</div>
                </button>
              );
            })}
          </div>
          <SectionCard
            title={vi ? 'Phân loại & ABC' : 'Classification & ABC'}
            description={
              vi
                ? `${formatRangeVi(range)} · ABC: A ${pi.abcCounts.A}, B ${pi.abcCounts.B}, C ${pi.abcCounts.C} SKU · margin shop ${fmtRate(pi.shopMargin, lang)}${pi.trafficAvailable ? '' : ' · Zombie: cần dữ liệu traffic'}`
                : `${formatRangeVi(range)} · ABC: A ${pi.abcCounts.A}, B ${pi.abcCounts.B}, C ${pi.abcCounts.C}`
            }
            notesLabel={vi ? 'Ghi chú' : 'Notes'}
            notes={[
              vi
                ? 'Nhóm đề xuất dựa trên quy tắc cố định (lợi nhuận, tăng trưởng, margin so với shop, tỷ lệ hủy) — là gợi ý để xem xét, không phải kết luận.'
                : 'Classes follow fixed rules — suggestions to review, not conclusions.',
            ]}
          >
            <div className={TABLE.frame}>
              <table className={TABLE.table}>
                <thead className={TABLE.thead}>
                  <tr>
                    <Th left className="sticky left-0 z-20 bg-surface-2">{vi ? 'Sản phẩm' : 'Product'}</Th>
                    <Th>ABC</Th>
                    <Th>GMV</Th>
                    <Th>Δ GMV</Th>
                    <Th title={vi ? 'Tăng trưởng trung bình ngày thường, 14 ngày gần nhất so với 14 ngày trước' : 'Normal-day momentum'}>Momentum</Th>
                    <Th>{vi ? 'Lợi nhuận' : 'Profit'}</Th>
                    <Th>Margin</Th>
                    <Th>{vi ? 'Hủy' : 'Cancel'}</Th>
                    <Th left>{vi ? 'Nhóm đề xuất · lý do' : 'Class · why'}</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.row.key}
                      className={`${TABLE.tr} cursor-pointer text-fg`}
                      onClick={() => {
                        setSku(r.row.key);
                        setTab('p360');
                      }}
                    >
                      <td className="sticky left-0 z-10 max-w-[220px] bg-surface px-3 py-1.5" title={r.row.label}>
                        <div className="truncate font-medium text-fg">{r.row.label}</div>
                        <div className="text-small text-muted">
                          {r.row.key}
                          {r.isHero && <span className="ml-1 text-up">· Hero</span>}
                          {r.isZombie && <span className="ml-1 text-down">· Zombie</span>}
                        </div>
                      </td>
                      <td className={`${TABLE.td} text-right font-semibold`}>{r.abc}</td>
                      <td className={`${TABLE.td} text-right`}>{fmtMoneyCompact(r.row.current.gmv, lang)}</td>
                      <td className={`${TABLE.td} text-right`}>
                        <ChangeCell c={r.row.change.gmv} lang={lang} />
                      </td>
                      <td className={`${TABLE.td} text-right`}>{fmtChange(r.momentum, lang)}</td>
                      <td className={`${TABLE.td} text-right ${(r.row.current.profit ?? 0) < 0 ? 'text-down' : ''}`}>{fmtMoneyCompact(r.row.current.profit, lang)}</td>
                      <td className={`${TABLE.td} text-right`}>{fmtRate(r.row.current.margin, lang)}</td>
                      <td className={`${TABLE.td} text-right`}>{fmtRate(r.row.current.cancelRate, lang)}</td>
                      <td className="min-w-[260px] px-3 py-1.5" title={r.reasons.map((x) => tr(lang, x)).join(' ')}>
                        <Badge tone={CLASS_TONE[r.classification]}>{tr(lang, PRODUCT_CLASS_LABELS[r.classification])}</Badge>
                        <div className="mt-0.5 line-clamp-2 text-small leading-snug text-muted">{r.reasons.map((x) => tr(lang, x)).join(' ')}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      )}

      {tab === 'p360' && selected && (
        <>
          <label className="flex items-center gap-2 text-sm text-muted">
            {vi ? 'Sản phẩm' : 'Product'}
            <select value={selected} onChange={(e) => setSku(e.target.value)} className={field}>
              {pi.rows.map((r) => (
                <option key={r.row.key} value={r.row.key}>
                  {r.row.label} ({r.row.key})
                </option>
              ))}
            </select>
          </label>
          <Product360Panel sku={selected} insight={pi.rows.find((r) => r.row.key === selected)} />
        </>
      )}

      {tab === 'combo' && (
        <SectionCard title={vi ? 'Combo so với bán lẻ' : 'Combo vs single SKUs'} description={vi ? 'Giá trị giỏ = tổng giá trị đơn có chứa combo / sản phẩm lẻ' : 'Basket = value of orders containing the combo / singles'}>
          {!combos.available || combos.rows.length === 0 ? (
            <NotEnoughData lang={lang} reason={vi ? 'Chưa có combo trong dữ liệu (cần mã combo trên dòng sản phẩm).' : 'No combos in the data.'} />
          ) : (
            <div className={TABLE.frame}>
              <table className={TABLE.table}>
                <thead className={TABLE.thead}>
                  <tr>
                    <Th left className="sticky left-0 z-20 bg-surface-2">Combo</Th>
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
                    <tr key={c.comboId} className={`${TABLE.tr} text-fg`}>
                      <td className="sticky left-0 z-10 max-w-[240px] bg-surface px-3 py-1.5" title={c.name}>
                        <div className="truncate font-medium text-fg">{c.name}</div>
                        <div className="truncate text-small text-muted">{c.components.join(' + ')}</div>
                      </td>
                      <td className={`${TABLE.td} text-right`}>{fmtMoneyCompact(c.price, lang)}</td>
                      <td className={`${TABLE.td} text-right`}>{fmtCount(c.combo.current.placed, lang)}</td>
                      <td className={`${TABLE.td} text-right`}>{fmtMoneyCompact(c.combo.current.gmv, lang)}</td>
                      <td className={`${TABLE.td} text-right`}>
                        <ChangeCell c={c.combo.change.gmv} lang={lang} />
                      </td>
                      <td className={`${TABLE.td} text-right`}>{fmtMoneyCompact(c.comboBasket, lang)}</td>
                      <td className={`${TABLE.td} text-right`}>
                        {fmtMoneyCompact(c.singles.basket, lang)}
                        {c.basketRatio !== null && <div className="text-small text-muted">combo ×{c.basketRatio.toFixed(2)}</div>}
                      </td>
                      <td className={`${TABLE.td} text-right`}>{fmtRate(c.combo.current.cvr, lang, 2)}</td>
                      <td className={`${TABLE.td} text-right`}>
                        {fmtRate(c.combo.current.cancelRate, lang)} / {fmtRate(c.singles.cancelRate, lang)}
                      </td>
                      <td className={`${TABLE.td} text-right`}>
                        {fmtRate(c.combo.current.margin, lang)} / {fmtRate(c.singles.margin, lang)}
                        {c.marginDiffPp !== null && (
                          <div className={`text-small font-medium ${c.marginDiffPp < 0 ? 'text-down' : 'text-up'}`}>
                            <span aria-hidden>{c.marginDiffPp < 0 ? '↓' : '↑'}</span> {fmtPp(c.marginDiffPp, lang)}
                          </div>
                        )}
                      </td>
                      <td className={`${TABLE.td} text-right`}>{fmtMoneyCompact(c.combo.current.profit, lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
};

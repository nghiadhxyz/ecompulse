import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Layers } from 'lucide-react';
import { breakdown, dimensionMemberLabel, formatRangeVi, NONE_KEY, productIntelligence, type BreakdownDimension, type DatasetFilter } from '../../../analytics';
import { useWorkspace } from '../../seller/SellerContext';
import { EvidenceButton, NotEnoughData, Section, tr } from '../../seller/ui';
import { BreakdownTable } from '../ui';
import { Product360Panel } from '../Product360Panel';

interface Path {
  category?: string;
  subcategory?: string;
  sku?: string;
}

export const CategoryIntelligence: React.FC = () => {
  const { lang, dataset, baseFilter, previousRange, range, focus, openEvidence } = useWorkspace();
  const vi = lang === 'vi';
  const [path, setPath] = useState<Path>(() => ({ category: focus?.categories?.[0] }));
  useEffect(() => {
    if (focus?.categories?.[0]) setPath({ category: focus.categories[0] });
  }, [focus]);

  const level: BreakdownDimension = path.subcategory ? 'sku' : path.category ? 'subcategory' : 'category';
  const filter: DatasetFilter = useMemo(
    () => ({
      ...baseFilter,
      categories: path.category ? [path.category] : baseFilter.categories,
      subcategories: path.subcategory ? [path.subcategory] : undefined,
    }),
    [baseFilter, path.category, path.subcategory],
  );
  const b = useMemo(() => (path.sku ? null : breakdown(dataset, filter, level, previousRange, lang)), [dataset, filter, level, previousRange, lang, path.sku]);
  const insights = useMemo(() => (path.sku ? productIntelligence(dataset, filter, previousRange) : null), [dataset, filter, previousRange, path.sku]);
  const insight = insights?.rows.find((r) => r.row.key === path.sku);

  const crumbs: { label: string; to: Path }[] = [{ label: vi ? 'Tất cả ngành' : 'All categories', to: {} }];
  if (path.category) crumbs.push({ label: dimensionMemberLabel(dataset, 'category', path.category, lang), to: { category: path.category } });
  if (path.subcategory) crumbs.push({ label: dimensionMemberLabel(dataset, 'subcategory', path.subcategory, lang), to: { category: path.category, subcategory: path.subcategory } });
  if (path.sku) crumbs.push({ label: dimensionMemberLabel(dataset, 'sku', path.sku, lang), to: path });

  const levelName = level === 'category' ? (vi ? 'Ngành hàng' : 'Category') : level === 'subcategory' ? (vi ? 'Nhóm hàng' : 'Niche') : 'SKU';
  /** SKUs belonging to a row — the evidence drawer filters orders by SKU. */
  const skusOf = (key: string): string[] =>
    level === 'sku'
      ? [key]
      : dataset.products.filter((p) => (level === 'category' ? (p.category ?? NONE_KEY) : (p.subcategory ?? NONE_KEY)) === key).map((p) => p.sku);

  return (
    <div className="space-y-4">
      <nav aria-label={vi ? 'Vị trí drill-down' : 'Drill-down path'} className="flex flex-wrap items-center gap-1 text-sm">
        <Layers className="w-4 h-4 text-slate-400 mr-1" aria-hidden />
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-600" aria-hidden />}
            {i === crumbs.length - 1 ? (
              <span className="font-bold text-white" aria-current="page">{c.label}</span>
            ) : (
              <button onClick={() => setPath(c.to)} className="text-sky-300 hover:text-sky-200">{c.label}</button>
            )}
          </React.Fragment>
        ))}
      </nav>

      {path.sku ? (
        <Product360Panel sku={path.sku} insight={insight} />
      ) : !b ? null : b.unavailable ? (
        <Section title={levelName}>
          <NotEnoughData lang={lang} reason={tr(lang, b.unavailable)} />
        </Section>
      ) : (
        <Section
          title={`${levelName} · ${formatRangeVi(range)}`}
          subtitle={
            vi
              ? `So với ${formatRangeVi(previousRange)}. Bấm một dòng để đi sâu${level === 'sku' ? ' vào Product 360' : ''}. Đơn của nhóm là số đơn có chứa sản phẩm thuộc nhóm.`
              : `Vs ${formatRangeVi(previousRange)}. Click a row to drill down.`
          }
        >
          <BreakdownTable
            rows={b.rows}
            lang={lang}
            firstHeader={levelName}
            columns={['gmv', 'share', 'gmvChange', 'contribution', 'orders', 'units', 'clicks', 'cvr', 'aov', 'cancel', 'refund', 'profit', 'margin']}
            sublabel={level === 'sku' ? (r) => r.key : undefined}
            onRowClick={(r) => {
              if (r.key === NONE_KEY) return;
              if (level === 'category') setPath({ category: r.key });
              else if (level === 'subcategory') setPath({ category: path.category, subcategory: r.key });
              else setPath({ ...path, sku: r.key });
            }}
            rowAction={(r) => <EvidenceButton compact lang={lang} onClick={() => openEvidence({ title: `${levelName}: ${r.label}`, filter: { range: filter.range, platforms: filter.platforms, skus: skusOf(r.key) } })} />}
          />
          {level !== 'sku' && (
            <p className="text-[11px] text-slate-500 mt-2">
              {vi ? `Traffic/CVR theo lượt nhấp sản phẩm của các SKU trong nhóm. ${b.previousCovered ? '' : 'Kỳ so sánh chưa có dữ liệu.'}` : 'Traffic/CVR use product clicks of SKUs in the group.'}
            </p>
          )}
        </Section>
      )}
    </div>
  );
};

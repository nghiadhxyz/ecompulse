import React, { useMemo } from 'react';
import { fmtMoney, PLATFORM_LABELS, resolveUnitCogs, type Platform } from '../../../analytics';
import { useWorkspace } from '../../seller/SellerContext';
import { Section } from '../../seller/ui';
import { Th } from '../ui';

/** Product catalog mapping: which SKUs have category, niche and COGS, and where they sell. */
export const DataMapping: React.FC = () => {
  const { lang, dataset, goTo } = useWorkspace();
  const vi = lang === 'vi';
  const rows = useMemo(() => {
    const platforms = new Map<string, Set<Platform>>();
    const units = new Map<string, number>();
    const orderPlatform = new Map(dataset.orders.map((o) => [o.orderId, o.platform]));
    const sample = new Map<string, (typeof dataset.orderLines)[number]>();
    for (const l of dataset.orderLines) {
      units.set(l.sku, (units.get(l.sku) || 0) + (l.quantity || 0));
      const p = orderPlatform.get(l.orderId);
      if (p) (platforms.get(l.sku) ?? platforms.set(l.sku, new Set()).get(l.sku)!).add(p);
      if (!sample.has(l.sku)) sample.set(l.sku, l);
    }
    const skus = new Set([...dataset.products.map((p) => p.sku), ...units.keys()]);
    return [...skus].map((sku) => {
      const p = dataset.products.find((x) => x.sku === sku);
      const line = sample.get(sku);
      return {
        sku,
        name: p?.name ?? line?.productName ?? sku,
        category: p?.category,
        subcategory: p?.subcategory,
        cogs: line ? resolveUnitCogs(dataset, line) : p?.unitCogs,
        units: units.get(sku) || 0,
        platforms: [...(platforms.get(sku) ?? [])],
      };
    }).sort((a, b) => b.units - a.units);
  }, [dataset]);
  const pct = (n: number) => (rows.length ? Math.round((n / rows.length) * 100) : 0);

  return (
    <div className="space-y-4">
      <Section title={vi ? 'Nguồn dữ liệu' : 'Sources'}>
        <ul className="text-xs text-slate-300 space-y-1">
          {dataset.sources.map((s, i) => (
            <li key={i}>
              <b className="text-white">{s.fileName}</b> · {s.reportType} · {s.platform !== 'other' ? PLATFORM_LABELS[s.platform] : vi ? 'nhiều sàn' : 'multi'}
              {s.rowCount !== undefined && ` · ${s.rowCount.toLocaleString('vi-VN')} ${vi ? 'dòng' : 'rows'}`}
            </li>
          ))}
        </ul>
      </Section>
      <Section
        title={vi ? 'Danh mục sản phẩm' : 'Product catalog'}
        subtitle={
          vi
            ? `${rows.length} SKU · có ngành hàng ${pct(rows.filter((r) => r.category).length)}% · có nhóm hàng ${pct(rows.filter((r) => r.subcategory).length)}% · có giá vốn ${pct(rows.filter((r) => r.cogs !== undefined).length)}%`
            : `${rows.length} SKUs`
        }
        right={<button onClick={() => goTo('settings')} className="text-xs text-sky-300">{vi ? 'Nhập giá vốn' : 'Enter COGS'}</button>}
      >
        <div className="overflow-x-auto rounded-xl border border-white/10 max-h-[520px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#0f1530] text-slate-400 sticky top-0">
              <tr>
                <Th left>SKU</Th>
                <Th left>{vi ? 'Tên' : 'Name'}</Th>
                <Th left>{vi ? 'Ngành' : 'Category'}</Th>
                <Th left>{vi ? 'Nhóm hàng' : 'Niche'}</Th>
                <Th>{vi ? 'Giá vốn' : 'COGS'}</Th>
                <Th>{vi ? 'Đã bán' : 'Units'}</Th>
                <Th left>{vi ? 'Sàn' : 'Platforms'}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.sku} className="border-t border-white/5 text-slate-200">
                  <td className="px-2.5 py-1.5 font-mono text-[11px]">{r.sku}</td>
                  <td className="px-2.5 py-1.5 max-w-[240px] truncate">{r.name}</td>
                  <td className="px-2.5 py-1.5">{r.category ?? <span className="text-[#fab219]">{vi ? 'chưa có' : 'missing'}</span>}</td>
                  <td className="px-2.5 py-1.5">{r.subcategory ?? <span className="text-slate-500">—</span>}</td>
                  <td className="px-2.5 py-1.5 text-right">{r.cogs === undefined ? <span className="text-[#fab219]">{vi ? 'chưa có' : 'missing'}</span> : fmtMoney(r.cogs, lang)}</td>
                  <td className="px-2.5 py-1.5 text-right">{r.units.toLocaleString('vi-VN')}</td>
                  <td className="px-2.5 py-1.5">{r.platforms.map((p) => PLATFORM_LABELS[p]).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-slate-500 mt-2">
          {vi ? 'Ngành hàng lấy từ cột "Ngành hàng" trong file (mẫu EcomPulse) hoặc danh mục sản phẩm. File xuất đơn của sàn thường không có cột này.' : 'Categories come from the file or the product catalog.'}
        </p>
      </Section>
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import { Store, LineChart, Save } from 'lucide-react';
import { assessDataQuality, fmtMoney, PLATFORM_LABELS, toNumber, type CanonicalDataset, type CostSettings, type Lang, type Platform } from '../../../analytics';
import type { WorkspaceMode } from '../../../utils/workspacePreferences';
import { HelpTip, PrimaryButton, Section } from '../ui';
import { AiPrivacySettings } from '../../workspace/AiPrivacySettings';

interface SettingsViewProps {
  lang: Lang;
  dataset: CanonicalDataset | null;
  settings: CostSettings;
  onChange: (next: CostSettings) => void;
  workspaceMode: WorkspaceMode;
  onChangeMode: (mode: WorkspaceMode) => void;
  onChangeLanguage: (lang: Lang) => void;
}

const FEE_PLATFORMS: Platform[] = ['shopee', 'tiktok', 'lazada'];

export const SettingsView: React.FC<SettingsViewProps> = ({ lang, dataset, settings, onChange, workspaceMode, onChangeMode, onChangeLanguage }) => {
  const vi = lang === 'vi';
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  // Catalog drafts: category / niche per SKU (saved as user overrides).
  const [catDrafts, setCatDrafts] = useState<Record<string, string>>({});
  const [subDrafts, setSubDrafts] = useState<Record<string, string>>({});
  const [onlyMissing, setOnlyMissing] = useState(false);

  const rows = useMemo(() => {
    if (!dataset) return [];
    const missing = new Set(assessDataQuality(dataset).skusMissingCogs);
    const units = new Map<string, number>();
    for (const l of dataset.orderLines) units.set(l.sku, (units.get(l.sku) || 0) + (l.quantity || 0));
    const skus = new Set([...dataset.products.map((p) => p.sku), ...units.keys()]);
    return Array.from(skus)
      .map((sku) => {
        const p = dataset.products.find((x) => x.sku === sku);
        const user = settings.skuCogs?.[sku];
        return {
          sku,
          name: p?.name ?? sku,
          fileCogs: p?.unitCogs,
          userCogs: user,
          category: p?.category,
          subcategory: p?.subcategory,
          units: units.get(sku) || 0,
          missing: missing.has(sku) && user === undefined,
        };
      })
      .sort((a, b) => Number(b.missing) - Number(a.missing) || b.units - a.units);
  }, [dataset, settings.skuCogs]);

  const shown = onlyMissing ? rows.filter((r) => r.missing) : rows;
  const missingCount = rows.filter((r) => r.missing).length;

  const saveCogs = () => {
    const next = { ...(settings.skuCogs || {}) };
    for (const [sku, raw] of Object.entries(drafts)) {
      if (raw.trim() === '') {
        delete next[sku];
        continue;
      }
      const v = toNumber(raw);
      if (v !== undefined && v >= 0) next[sku] = v;
    }
    const applyText = (base: Record<string, string> | undefined, d: Record<string, string>) => {
      const out = { ...(base || {}) };
      for (const [sku, raw] of Object.entries(d)) {
        if (raw.trim() === '') delete out[sku];
        else out[sku] = raw.trim();
      }
      return out;
    };
    onChange({ ...settings, skuCogs: next, skuCategory: applyText(settings.skuCategory, catDrafts), skuSubcategory: applyText(settings.skuSubcategory, subDrafts) });
    setDrafts({});
    setCatDrafts({});
    setSubDrafts({});
  };
  const categoryOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.category).filter(Boolean) as string[])).sort(), [rows]);
  const nicheOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.subcategory).filter(Boolean) as string[])).sort(), [rows]);
  const dirty = Object.keys(drafts).length + Object.keys(catDrafts).length + Object.keys(subDrafts).length > 0;

  const setRate = (field: 'platformFeeRate' | 'paymentFeeRate', platform: Platform, raw: string) => {
    const rates = { ...(settings[field] || {}) };
    const v = toNumber(raw);
    if (raw.trim() === '' || v === undefined) delete rates[platform];
    else if (v >= 0 && v <= 100) rates[platform] = v / 100;
    onChange({ ...settings, [field]: rates });
  };

  const invalidDraft = Object.values(drafts).some((raw) => raw.trim() !== '' && (toNumber(raw) === undefined || toNumber(raw)! < 0));

  return (
    <div className="space-y-4">
      <Section
        title={vi ? 'Giá vốn & ngành hàng theo SKU' : 'COGS & category per SKU'}
        subtitle={
          vi
            ? `Giá vốn mỗi sản phẩm (đ/sản phẩm). Không có giá vốn thì không tính được lợi nhuận — EcomPulse không tự giả định. ${missingCount > 0 ? `${missingCount} SKU đang thiếu.` : ''}`
            : `Unit cost per product. Without COGS, profit cannot be computed — nothing is assumed. ${missingCount > 0 ? `${missingCount} SKUs missing.` : ''}`
        }
        right={
          <label className="text-xs text-slate-300 flex items-center gap-1.5">
            <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
            {vi ? 'Chỉ SKU thiếu giá vốn' : 'Only missing'}
          </label>
        }
      >
        {!dataset ? (
          <p className="text-sm text-slate-400">{vi ? 'Nhập dữ liệu trước để thấy danh sách SKU.' : 'Import data to see SKUs.'}</p>
        ) : (
          <>
            <p className="text-[11px] text-slate-500 mb-2">
              {vi
                ? 'Mẹo: nhập nhanh bằng file Excel có cột "SKU" cùng "Giá vốn", "Ngành hàng", "Nhóm hàng" ở trang Dữ liệu. Ngành hàng cần cho phân tích Category Intelligence.'
                : 'Tip: import an Excel file with "SKU" plus "COGS", "Category", "Niche" columns on the Data page.'}
            </p>
            <datalist id="category-options">{categoryOptions.map((c) => <option key={c} value={c} />)}</datalist>
            <datalist id="niche-options">{nicheOptions.map((c) => <option key={c} value={c} />)}</datalist>
            <div className="overflow-x-auto rounded-xl border border-white/10 max-h-[420px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#0f1530] text-slate-400 sticky top-0">
                  <tr>
                    <th className="text-left font-semibold px-2.5 py-2">{vi ? 'Sản phẩm' : 'Product'}</th>
                    <th className="text-right font-semibold px-2.5 py-2">{vi ? 'Đã bán' : 'Sold'}</th>
                    <th className="text-right font-semibold px-2.5 py-2">{vi ? 'Giá vốn từ file' : 'From file'}</th>
                    <th className="text-right font-semibold px-2.5 py-2">{vi ? 'Giá vốn bạn nhập' : 'Your COGS'}</th>
                    <th className="text-left font-semibold px-2.5 py-2">{vi ? 'Ngành hàng' : 'Category'}</th>
                    <th className="text-left font-semibold px-2.5 py-2">{vi ? 'Nhóm hàng' : 'Niche'}</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.sku} className={`border-t border-white/5 ${r.missing ? 'bg-[#fab219]/[0.05]' : ''}`}>
                      <td className="px-2.5 py-1.5 max-w-[260px]">
                        <div className="text-slate-100 truncate">{r.name}</div>
                        <div className="text-[11px] text-slate-500">{r.sku}{r.missing && <span className="text-[#fab219]"> · {vi ? 'thiếu giá vốn' : 'missing'}</span>}</div>
                      </td>
                      <td className="px-2.5 py-1.5 text-right text-slate-300">{r.units.toLocaleString('vi-VN')}</td>
                      <td className="px-2.5 py-1.5 text-right text-slate-400">{r.fileCogs === undefined ? '—' : fmtMoney(r.fileCogs, lang)}</td>
                      <td className="px-2.5 py-1.5 text-right">
                        <input
                          inputMode="decimal"
                          value={drafts[r.sku] ?? (r.userCogs !== undefined ? String(r.userCogs) : '')}
                          onChange={(e) => setDrafts((d) => ({ ...d, [r.sku]: e.target.value }))}
                          placeholder={r.fileCogs !== undefined ? (vi ? 'dùng giá từ file' : 'use file value') : vi ? 'nhập giá vốn' : 'enter COGS'}
                          aria-label={`${vi ? 'Giá vốn' : 'COGS'} ${r.sku}`}
                          className="w-32 text-right bg-white/[0.05] border border-white/15 rounded-md px-2 py-1 text-slate-100 placeholder:text-slate-600"
                        />
                      </td>
                      <td className="px-2.5 py-1.5">
                        <input
                          list="category-options"
                          value={catDrafts[r.sku] ?? r.category ?? ''}
                          onChange={(e) => setCatDrafts((d) => ({ ...d, [r.sku]: e.target.value }))}
                          placeholder={vi ? 'vd: Mẹ & Bé' : 'e.g. Beauty'}
                          aria-label={`${vi ? 'Ngành hàng' : 'Category'} ${r.sku}`}
                          className="w-36 bg-white/[0.05] border border-white/15 rounded-md px-2 py-1 text-slate-100 placeholder:text-slate-600"
                        />
                      </td>
                      <td className="px-2.5 py-1.5">
                        <input
                          list="niche-options"
                          value={subDrafts[r.sku] ?? r.subcategory ?? ''}
                          onChange={(e) => setSubDrafts((d) => ({ ...d, [r.sku]: e.target.value }))}
                          placeholder={vi ? 'vd: Tã bỉm' : 'e.g. Diapers'}
                          aria-label={`${vi ? 'Nhóm hàng' : 'Niche'} ${r.sku}`}
                          className="w-36 bg-white/[0.05] border border-white/15 rounded-md px-2 py-1 text-slate-100 placeholder:text-slate-600"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <PrimaryButton disabled={!dirty || invalidDraft} onClick={saveCogs}>
                <Save className="w-4 h-4" /> {vi ? 'Lưu thay đổi' : 'Save changes'}
              </PrimaryButton>
              {invalidDraft && <span className="text-xs text-[#f08080]">{vi ? 'Có giá trị không hợp lệ.' : 'Invalid value.'}</span>}
            </div>
          </>
        )}
      </Section>

      <Section
        title={vi ? 'Phí sàn & chi phí' : 'Fees & costs'}
        subtitle={vi ? 'Chỉ dùng khi file không có số phí thật. Lợi nhuận sẽ ghi rõ là "ước tính theo tỷ lệ bạn nhập".' : 'Used only when files have no actual fees; results are labelled as estimates.'}
      >
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead className="text-slate-400">
              <tr>
                <th className="text-left font-semibold pr-4 py-1.5">{vi ? 'Sàn' : 'Platform'}</th>
                <th className="text-left font-semibold pr-4 py-1.5">
                  {vi ? 'Phí sàn (% doanh thu thuần)' : 'Platform fee (% of net revenue)'} <HelpTip text={vi ? 'Phí cố định + phí dịch vụ' : 'Fixed + service fee'} />
                </th>
                <th className="text-left font-semibold py-1.5">{vi ? 'Phí thanh toán (%)' : 'Payment fee (%)'}</th>
              </tr>
            </thead>
            <tbody>
              {FEE_PLATFORMS.map((p) => (
                <tr key={p}>
                  <td className="pr-4 py-1.5 text-slate-200">{PLATFORM_LABELS[p]}</td>
                  {(['platformFeeRate', 'paymentFeeRate'] as const).map((field) => (
                    <td key={field} className="pr-4 py-1.5">
                      <input
                        inputMode="decimal"
                        defaultValue={settings[field]?.[p] !== undefined ? String(+(settings[field]![p]! * 100).toFixed(3)) : ''}
                        onBlur={(e) => setRate(field, p, e.target.value)}
                        placeholder={vi ? 'chưa nhập' : 'not set'}
                        aria-label={`${field} ${p}`}
                        className="w-24 bg-white/[0.05] border border-white/15 rounded-md px-2 py-1 text-slate-100 placeholder:text-slate-600"
                      />
                      <span className="text-slate-500 ml-1">%</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 space-y-2">
          <label className="flex items-start gap-2 text-sm text-slate-200">
            <input type="checkbox" className="mt-1" checked={!!settings.noAdsDeclared} onChange={(e) => onChange({ ...settings, noAdsDeclared: e.target.checked })} />
            <span>
              {vi ? 'Shop không chạy quảng cáo trả phí' : 'The shop runs no paid ads'}
              <span className="block text-[11px] text-slate-500">{vi ? 'Khi chưa nhập báo cáo Ads, chi phí Ads được tính = 0 thay vì "chưa có dữ liệu".' : 'Ads cost counts as 0 instead of "missing" when no ads report is imported.'}</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-200">
            <input type="checkbox" className="mt-1" checked={!!settings.noSellerShippingDeclared} onChange={(e) => onChange({ ...settings, noSellerShippingDeclared: e.target.checked })} />
            <span>
              {vi ? 'Shop không chịu phí vận chuyển' : 'The shop pays no shipping'}
              <span className="block text-[11px] text-slate-500">{vi ? 'Người mua hoặc sàn trả toàn bộ phí ship.' : 'Buyer or platform pays all shipping.'}</span>
            </span>
          </label>
        </div>
      </Section>

      <AiPrivacySettings lang={lang} />

      <Section title={vi ? 'Chế độ làm việc & ngôn ngữ' : 'Workspace mode & language'} subtitle={vi ? 'Đổi chế độ không làm mất dữ liệu.' : 'Switching mode keeps your data.'}>
        <div className="flex flex-wrap gap-2">
          {([
            { m: 'seller' as const, icon: Store, vi: 'Chủ shop / Người bán', en: 'Shop owner' },
            { m: 'analyst' as const, icon: LineChart, vi: 'Planner / Data Analyst', en: 'Planner / Analyst' },
          ]).map((o) => (
            <button
              key={o.m}
              onClick={() => onChangeMode(o.m)}
              aria-pressed={workspaceMode === o.m}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold ${workspaceMode === o.m ? 'bg-sky-600 border-sky-500 text-white' : 'border-white/15 text-slate-300 hover:bg-white/[0.06]'}`}
            >
              <o.icon className="w-4 h-4" /> {vi ? o.vi : o.en}
            </button>
          ))}
          <span className="w-px bg-white/10 mx-1" aria-hidden />
          {(['vi', 'en'] as const).map((l) => (
            <button
              key={l}
              onClick={() => onChangeLanguage(l)}
              aria-pressed={lang === l}
              className={`px-3 py-2 rounded-xl border text-sm font-semibold ${lang === l ? 'bg-white/15 border-white/30 text-white' : 'border-white/15 text-slate-300'}`}
            >
              {l === 'vi' ? 'Tiếng Việt' : 'English'}
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import { Store, LineChart, Save } from 'lucide-react';
import { assessDataQuality, fmtMoney, PLATFORM_LABELS, toNumber, type CanonicalDataset, type CostSettings, type Lang, type Platform } from '../../../analytics';
import type { WorkspaceMode } from '../../../utils/workspacePreferences';
import { HelpTip, NotEnoughData, PrimaryButton, Section } from '../ui';
import { Chip } from '../../ui/primitives';
import { TABLE } from '../../ui/data';

/** Form field inside tables and settings rows. */
const FIELD = 'min-h-10 rounded-control border border-line bg-surface px-2.5 text-sm text-fg placeholder:text-muted';
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

  // Shop-wide estimates (0.9): stored as a fraction, entered as a percentage.
  const setEstimate = (field: 'estimatedGrossMargin' | 'estimatedFeeRate', raw: string) => {
    const v = toNumber(raw);
    const next = { ...settings };
    if (raw.trim() === '' || v === undefined || v < 0 || v > 100) delete next[field];
    else next[field] = v / 100;
    onChange(next);
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
          <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} className="h-4 w-4 accent-primary" />
            {vi ? 'Chỉ SKU thiếu giá vốn' : 'Only missing'}
          </label>
        }
      >
        {!dataset ? (
          <NotEnoughData lang={lang} title={vi ? 'Chưa có dữ liệu' : 'No data yet'} reason={vi ? 'Nhập dữ liệu trước để thấy danh sách SKU.' : 'Import data to see SKUs.'} />
        ) : (
          <>
            <p className="mb-3 text-small text-muted">
              {vi
                ? 'Mẹo: nhập nhanh bằng file Excel có cột "SKU" cùng "Giá vốn", "Ngành hàng", "Nhóm hàng" ở trang Dữ liệu. Ngành hàng cần cho phân tích Category Intelligence.'
                : 'Tip: import an Excel file with "SKU" plus "COGS", "Category", "Niche" columns on the Data page.'}
            </p>
            <datalist id="category-options">{categoryOptions.map((c) => <option key={c} value={c} />)}</datalist>
            <datalist id="niche-options">{nicheOptions.map((c) => <option key={c} value={c} />)}</datalist>
            <div className={`${TABLE.frame} max-h-[480px] overflow-y-auto`}>
              <table className={TABLE.table}>
                <thead className={TABLE.thead}>
                  <tr>
                    <th scope="col" className={`${TABLE.th} text-left`}>{vi ? 'Sản phẩm' : 'Product'}</th>
                    <th scope="col" className={`${TABLE.th} text-right`}>{vi ? 'Đã bán' : 'Sold'}</th>
                    <th scope="col" className={`${TABLE.th} text-right`}>{vi ? 'Giá vốn từ file' : 'From file'}</th>
                    <th scope="col" className={`${TABLE.th} text-right`}>{vi ? 'Giá vốn bạn nhập' : 'Your COGS'}</th>
                    <th scope="col" className={`${TABLE.th} text-left`}>{vi ? 'Ngành hàng' : 'Category'}</th>
                    <th scope="col" className={`${TABLE.th} text-left`}>{vi ? 'Nhóm hàng' : 'Niche'}</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.sku} className={`border-t border-line ${r.missing ? 'bg-warn-soft' : ''}`}>
                      <td className="max-w-[260px] px-3 py-1.5" title={r.name}>
                        <div className="truncate font-medium text-fg">{r.name}</div>
                        <div className="text-small text-muted">
                          {r.sku}
                          {r.missing && <span className="font-medium text-warn"> · {vi ? 'thiếu giá vốn' : 'missing'}</span>}
                        </div>
                      </td>
                      <td className={`${TABLE.td} text-right text-fg`}>{r.units.toLocaleString('vi-VN')}</td>
                      <td className={`${TABLE.td} text-right text-muted`}>{r.fileCogs === undefined ? '—' : fmtMoney(r.fileCogs, lang)}</td>
                      <td className="px-3 py-1.5 text-right">
                        <input
                          inputMode="decimal"
                          value={drafts[r.sku] ?? (r.userCogs !== undefined ? String(r.userCogs) : '')}
                          onChange={(e) => setDrafts((d) => ({ ...d, [r.sku]: e.target.value }))}
                          placeholder={r.fileCogs !== undefined ? (vi ? 'dùng giá từ file' : 'use file value') : vi ? 'nhập giá vốn' : 'enter COGS'}
                          aria-label={`${vi ? 'Giá vốn' : 'COGS'} ${r.sku}`}
                          className={`w-32 text-right tabular ${FIELD}`}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          list="category-options"
                          value={catDrafts[r.sku] ?? r.category ?? ''}
                          onChange={(e) => setCatDrafts((d) => ({ ...d, [r.sku]: e.target.value }))}
                          placeholder={vi ? 'vd: Mẹ & Bé' : 'e.g. Beauty'}
                          aria-label={`${vi ? 'Ngành hàng' : 'Category'} ${r.sku}`}
                          className={`w-48 ${FIELD}`}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          list="niche-options"
                          value={subDrafts[r.sku] ?? r.subcategory ?? ''}
                          onChange={(e) => setSubDrafts((d) => ({ ...d, [r.sku]: e.target.value }))}
                          placeholder={vi ? 'vd: Tã bỉm' : 'e.g. Diapers'}
                          aria-label={`${vi ? 'Nhóm hàng' : 'Niche'} ${r.sku}`}
                          className={`w-48 ${FIELD}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <PrimaryButton disabled={!dirty || invalidDraft} onClick={saveCogs}>
                <Save className="h-4 w-4" aria-hidden /> {vi ? 'Lưu thay đổi' : 'Save changes'}
              </PrimaryButton>
              {invalidDraft && <span className="rounded-control bg-mismatch-soft px-2.5 py-1 text-small font-medium text-mismatch">{vi ? 'Có giá trị không hợp lệ.' : 'Invalid value.'}</span>}
            </div>
          </>
        )}
      </Section>

      <Section
        title={vi ? 'Phí sàn & chi phí' : 'Fees & costs'}
        subtitle={vi ? 'Chỉ dùng khi file không có số phí thật. Lợi nhuận sẽ ghi rõ là "ước tính theo tỷ lệ bạn nhập".' : 'Used only when files have no actual fees; results are labelled as estimates.'}
      >
        <div className="overflow-x-auto">
          <table className="text-sm">
            <thead className="text-small text-muted">
              <tr>
                <th scope="col" className="py-1.5 pr-6 text-left font-semibold">{vi ? 'Sàn' : 'Platform'}</th>
                <th scope="col" className="py-1.5 pr-6 text-left font-semibold">
                  {vi ? 'Phí sàn (% doanh thu thuần)' : 'Platform fee (% of net revenue)'} <HelpTip text={vi ? 'Phí cố định + phí dịch vụ' : 'Fixed + service fee'} />
                </th>
                <th scope="col" className="py-1.5 text-left font-semibold">{vi ? 'Phí thanh toán (%)' : 'Payment fee (%)'}</th>
              </tr>
            </thead>
            <tbody>
              {FEE_PLATFORMS.map((p) => (
                <tr key={p}>
                  <td className="py-1.5 pr-6 font-medium text-fg">{PLATFORM_LABELS[p]}</td>
                  {(['platformFeeRate', 'paymentFeeRate'] as const).map((field) => (
                    <td key={field} className="py-1.5 pr-6">
                      <input
                        inputMode="decimal"
                        defaultValue={settings[field]?.[p] !== undefined ? String(+(settings[field]![p]! * 100).toFixed(3)) : ''}
                        onBlur={(e) => setRate(field, p, e.target.value)}
                        placeholder={vi ? 'chưa nhập' : 'not set'}
                        aria-label={`${field} ${p}`}
                        className={`w-28 text-right tabular ${FIELD}`}
                      />
                      <span className="ml-1.5 text-muted">%</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-5 rounded-control border border-line bg-surface-2 p-4">
          <div className="text-sm font-semibold text-fg">{vi ? 'Ước tính cho cả shop (khi chưa có giá vốn)' : 'Shop-wide estimates (without COGS)'}</div>
          <p className="mb-3 text-small text-muted">
            {vi
              ? 'Dùng cho ROAS hòa vốn, lợi nhuận sau Ads và What-If khi chỉ có báo cáo tổng hợp. Kết quả luôn ghi "ước tính theo số bạn nhập".'
              : 'Used for break-even ROAS, profit after Ads and What-If with summary reports. Results are labelled as estimates.'}
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
            {([
              { field: 'estimatedGrossMargin' as const, vi: 'Biên lợi nhuận gộp ước tính (%)', en: 'Estimated gross margin (%)', tip: vi ? '(Giá bán − giá vốn) / giá bán, trung bình cả shop' : '(Price − COGS) / price, shop average' },
              { field: 'estimatedFeeRate' as const, vi: 'Phí sàn (%)', en: 'Platform fees (%)', tip: vi ? 'Tổng phí sàn, phí thanh toán, phí dịch vụ trên doanh số' : 'All platform, payment and service fees on sales' },
            ]).map((f) => (
              <label key={f.field} className="flex items-center gap-1.5 text-fg">
                {vi ? f.vi : f.en} <HelpTip text={f.tip} />
                <input
                  inputMode="decimal"
                  defaultValue={settings[f.field] !== undefined ? String(+(settings[f.field]! * 100).toFixed(3)) : ''}
                  onBlur={(e) => setEstimate(f.field, e.target.value)}
                  placeholder={vi ? 'chưa nhập' : 'not set'}
                  aria-label={vi ? f.vi : f.en}
                  className={`w-28 text-right tabular ${FIELD}`}
                />
                <span className="text-muted">%</span>
              </label>
            ))}
          </div>
        </div>
        <div className="mt-5 space-y-3">
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-fg">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" checked={!!settings.noAdsDeclared} onChange={(e) => onChange({ ...settings, noAdsDeclared: e.target.checked })} />
            <span>
              {vi ? 'Shop không chạy quảng cáo trả phí' : 'The shop runs no paid ads'}
              <span className="block text-small text-muted">{vi ? 'Khi chưa nhập báo cáo Ads, chi phí Ads được tính = 0 thay vì "chưa có dữ liệu".' : 'Ads cost counts as 0 instead of "missing" when no ads report is imported.'}</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-fg">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" checked={!!settings.noSellerShippingDeclared} onChange={(e) => onChange({ ...settings, noSellerShippingDeclared: e.target.checked })} />
            <span>
              {vi ? 'Shop không chịu phí vận chuyển' : 'The shop pays no shipping'}
              <span className="block text-small text-muted">{vi ? 'Người mua hoặc sàn trả toàn bộ phí ship.' : 'Buyer or platform pays all shipping.'}</span>
            </span>
          </label>
        </div>
      </Section>

      <AiPrivacySettings lang={lang} />

      <Section title={vi ? 'Chế độ làm việc & ngôn ngữ' : 'Workspace mode & language'} subtitle={vi ? 'Đổi chế độ không làm mất dữ liệu.' : 'Switching mode keeps your data.'}>
        <div className="flex flex-wrap items-center gap-1">
          {([
            { m: 'seller' as const, icon: Store, vi: 'Chủ shop / Người bán', en: 'Shop owner' },
            { m: 'analyst' as const, icon: LineChart, vi: 'Planner / Data Analyst', en: 'Planner / Analyst' },
          ]).map((o) => (
            <Chip key={o.m} selected={workspaceMode === o.m} onClick={() => onChangeMode(o.m)}>
              <o.icon className="h-4 w-4" aria-hidden /> {vi ? o.vi : o.en}
            </Chip>
          ))}
          <span className="mx-2 h-6 w-px bg-line" aria-hidden />
          {(['vi', 'en'] as const).map((l) => (
            <Chip key={l} selected={lang === l} onClick={() => onChangeLanguage(l)}>
              {l === 'vi' ? 'Tiếng Việt' : 'English'}
            </Chip>
          ))}
        </div>
      </Section>
    </div>
  );
};

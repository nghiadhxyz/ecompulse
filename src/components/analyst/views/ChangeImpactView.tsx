import React, { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  changeImpact,
  CHANGE_TYPE_LABELS,
  eventScope,
  fmtByUnit,
  fmtDay,
  formatRangeVi,
  PLATFORM_LABELS,
  type ChangeType,
  type Platform,
} from '../../../analytics';
import { useWorkspace } from '../../seller/SellerContext';
import { EvidenceButton, NotEnoughData, PrimaryButton, Section, tr } from '../../seller/ui';
import { ChangeCell, Th } from '../ui';
import { usePlanning } from '../../workspace/usePlanning';

export const inputCls = 'bg-white/[0.06] border border-white/15 rounded-lg px-2 py-1.5 text-sm text-slate-100 [color-scheme:dark]';

export const ChangeImpactView: React.FC = () => {
  const { lang, dataset, asOf, openEvidence } = useWorkspace();
  const planning = usePlanning();
  const vi = lang === 'vi';
  const events = planning?.changeEvents ?? dataset.changeEvents.map((e) => ({ ...e, userAdded: false }));
  const [selected, setSelected] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState(14);
  const [form, setForm] = useState<{ date: string; type: ChangeType; sku: string; platform: Platform | ''; description: string }>({ date: asOf, type: 'price', sku: '', platform: '', description: '' });
  const event = events.find((e) => e.id === selected) ?? events[0];
  const impact = useMemo(() => (event ? changeImpact(dataset, event) : null), [dataset, event]);
  const w = impact?.windows.find((x) => x.days === windowDays) ?? impact?.windows[impact.windows.length - 1];
  const platforms = useMemo(() => [...new Set(dataset.orders.map((o) => o.platform))], [dataset]);

  const add = () => {
    if (!planning || !form.description.trim()) return;
    planning.addChange({ date: form.date, type: form.type, description: form.description.trim(), sku: form.sku || undefined, platform: form.platform || undefined });
    setForm({ ...form, description: '' });
  };

  return (
    <div className="space-y-4">
      <Section title={vi ? 'Nhật ký thay đổi' : 'Change log'} subtitle={vi ? 'Ghi lại các thay đổi (giá, voucher, Ads, giờ live…) để so sánh trước/sau.' : 'Log changes to compare before and after.'}>
        {planning && (
          <div className="grid grid-cols-1 md:grid-cols-[140px_150px_1fr_130px] xl:grid-cols-[140px_150px_200px_130px_1fr_auto] gap-2 items-end mb-3">
            <label className="text-xs text-slate-400">
              {vi ? 'Ngày áp dụng' : 'Date'}
              <input type="date" value={form.date} max={asOf} onChange={(e) => setForm({ ...form, date: e.target.value })} className={`mt-1 w-full ${inputCls}`} />
            </label>
            <label className="text-xs text-slate-400">
              {vi ? 'Loại' : 'Type'}
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ChangeType })} className={`mt-1 w-full ${inputCls}`}>
                {(Object.keys(CHANGE_TYPE_LABELS) as ChangeType[]).map((k) => (
                  <option key={k} value={k}>{tr(lang, CHANGE_TYPE_LABELS[k])}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-400">
              SKU
              <select value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className={`mt-1 w-full ${inputCls}`}>
                <option value="">{vi ? 'Toàn shop' : 'Whole shop'}</option>
                {dataset.products.map((p) => (
                  <option key={p.sku} value={p.sku}>{p.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-400">
              {vi ? 'Sàn' : 'Platform'}
              <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value as Platform | '' })} className={`mt-1 w-full ${inputCls}`}>
                <option value="">{vi ? 'Tất cả sàn' : 'All'}</option>
                {platforms.map((p) => (
                  <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-400 md:col-span-3 xl:col-span-1">
              {vi ? 'Mô tả' : 'Description'}
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={vi ? 'VD: Giảm giá từ 259k xuống 249k' : 'e.g. Price 259k → 249k'} className={`mt-1 w-full ${inputCls}`} />
            </label>
            <PrimaryButton onClick={add} disabled={!form.description.trim()}>
              <Plus className="w-4 h-4" aria-hidden /> {vi ? 'Thêm' : 'Add'}
            </PrimaryButton>
          </div>
        )}
        {events.length === 0 ? (
          <p className="text-sm text-slate-400">{vi ? 'Chưa có thay đổi nào được ghi.' : 'No changes logged.'}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-xs">
              <thead className="bg-white/[0.04] text-slate-400">
                <tr>
                  <Th left>{vi ? 'Ngày' : 'Date'}</Th>
                  <Th left>{vi ? 'Loại' : 'Type'}</Th>
                  <Th left>{vi ? 'Phạm vi' : 'Scope'}</Th>
                  <Th left>{vi ? 'Mô tả' : 'Description'}</Th>
                  <Th left>{vi ? 'Nguồn' : 'Source'}</Th>
                  <Th>{''}</Th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr
                    key={e.id}
                    onClick={() => setSelected(e.id)}
                    className={`border-t border-white/5 cursor-pointer ${event?.id === e.id ? 'bg-sky-500/10 text-white' : 'text-slate-200 hover:bg-white/[0.03]'}`}
                    aria-selected={event?.id === e.id}
                  >
                    <td className="px-2.5 py-1.5 whitespace-nowrap">{fmtDay(e.date)}/{e.date.slice(0, 4)}</td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">{tr(lang, CHANGE_TYPE_LABELS[e.type])}</td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">{e.sku ? dataset.products.find((p) => p.sku === e.sku)?.name ?? e.sku : vi ? 'Toàn shop' : 'Whole shop'}{e.platform ? ` · ${PLATFORM_LABELS[e.platform]}` : ''}</td>
                    <td className="px-2.5 py-1.5 min-w-[220px]">{e.description}</td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap text-slate-400">{e.userAdded ? (vi ? 'Bạn thêm' : 'You') : vi ? 'Từ dữ liệu' : 'From data'}</td>
                    <td className="px-2.5 py-1.5 text-right">
                      {e.userAdded && planning && (
                        <button onClick={(ev) => { ev.stopPropagation(); planning.removeChange(e.id); }} className="text-slate-400 hover:text-[#f87171]" aria-label={vi ? 'Xóa' : 'Delete'}>
                          <Trash2 className="w-3.5 h-3.5" aria-hidden />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {event && impact && (
        <Section
          title={vi ? `Trước / sau: ${event.description}` : `Before / after: ${event.description}`}
          subtitle={`${tr(lang, impact.scopeLabel)} · ${vi ? 'áp dụng' : 'from'} ${fmtDay(event.date)}/${event.date.slice(0, 4)}`}
          right={
            <div className="flex gap-1" role="group" aria-label={vi ? 'Cửa sổ so sánh' : 'Window'}>
              {impact.windows.map((x) => (
                <button key={x.days} onClick={() => setWindowDays(x.days)} aria-pressed={w?.days === x.days} className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${w?.days === x.days ? 'bg-sky-600 border-sky-500 text-white' : 'border-white/10 text-slate-300'}`}>
                  {x.days} {vi ? 'ngày' : 'days'}
                </button>
              ))}
            </div>
          }
        >
          {impact.unavailable || !w ? (
            <NotEnoughData lang={lang} reason={tr(lang, impact.unavailable ?? { vi: 'Không đủ dữ liệu.', en: 'Not enough data.' })} />
          ) : (
            <>
              <p className="text-sm text-slate-100 leading-relaxed rounded-xl border border-sky-400/20 bg-sky-500/[0.05] p-3">{tr(lang, w.summary)}</p>
              <div className="overflow-x-auto rounded-xl border border-white/10 mt-3">
                <table className="w-full text-xs">
                  <thead className="bg-white/[0.04] text-slate-400">
                    <tr>
                      <Th left>{vi ? 'Chỉ số' : 'Metric'}</Th>
                      <Th>{vi ? `Trước (${formatRangeVi(w.before)})` : `Before (${formatRangeVi(w.before)})`}</Th>
                      <Th>{vi ? `Sau (${formatRangeVi(w.after)})` : `After (${formatRangeVi(w.after)})`}</Th>
                      <Th>{vi ? 'Thay đổi' : 'Change'}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {w.metrics.map((m) => (
                      <tr key={m.key} className="border-t border-white/5 text-slate-200">
                        <td className="px-2.5 py-1.5">{tr(lang, m.label)}</td>
                        <td className="px-2.5 py-1.5 text-right whitespace-nowrap text-slate-400">{fmtByUnit(m.change.previous, m.unit, lang)}</td>
                        <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{fmtByUnit(m.change.current, m.unit, lang)}</td>
                        <td className="px-2.5 py-1.5 text-right whitespace-nowrap"><ChangeCell c={m.change} rate={m.unit === 'ratio'} goodWhenUp={m.goodWhenUp} lang={lang} /></td>
                      </tr>
                    ))}
                    {w.reference && (
                      <tr className="border-t border-white/10 text-slate-400">
                        <td className="px-2.5 py-1.5">{vi ? 'GMV phần còn lại của shop (đối chứng)' : 'GMV rest of shop (reference)'}</td>
                        <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{fmtByUnit(w.reference.gmv.previous, 'vnd', lang)}</td>
                        <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{fmtByUnit(w.reference.gmv.current, 'vnd', lang)}</td>
                        <td className="px-2.5 py-1.5 text-right whitespace-nowrap"><ChangeCell c={w.reference.gmv} lang={lang} /></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <EvidenceButton compact lang={lang} onClick={() => openEvidence({ title: vi ? `Trước thay đổi · ${formatRangeVi(w.before)}` : 'Before', filter: { range: w.before, ...eventScope(event) } })} />
                <span className="text-[11px] text-slate-500 self-center">{vi ? 'trước' : 'before'}</span>
                <EvidenceButton compact lang={lang} onClick={() => openEvidence({ title: vi ? `Sau thay đổi · ${formatRangeVi(w.after)}` : 'After', filter: { range: w.after, ...eventScope(event) } })} />
                <span className="text-[11px] text-slate-500 self-center">{vi ? 'sau' : 'after'}</span>
              </div>
              <ul className="mt-3 space-y-1">
                {impact.notes.map((n, i) => (
                  <li key={i} className="text-xs text-slate-400">• {tr(lang, n)}</li>
                ))}
              </ul>
            </>
          )}
        </Section>
      )}
    </div>
  );
};

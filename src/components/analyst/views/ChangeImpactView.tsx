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
import { SectionCard, Tabs } from '../../ui/primitives';
import { TABLE } from '../../ui/data';
import { ChangeCell, Th } from '../ui';
import { usePlanning } from '../../workspace/usePlanning';
import { SourceDriversPanel } from '../../workspace/SummaryInsightPanels';

/** Form field (inputs, selects) — shared by the planning / report pages. */
export const inputCls = 'min-h-10 rounded-control border border-line bg-surface px-2.5 text-sm text-fg placeholder:text-muted';

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
  const label = 'text-small font-medium text-muted';

  return (
    <div className="space-y-4">
      <Section title={vi ? 'Nhật ký thay đổi' : 'Change log'} subtitle={vi ? 'Ghi lại các thay đổi (giá, voucher, Ads, giờ live…) để so sánh trước/sau.' : 'Log changes to compare before and after.'}>
        {planning && (
          <div className="mb-4 grid grid-cols-1 items-end gap-3 md:grid-cols-[140px_150px_1fr_130px] xl:grid-cols-[140px_150px_200px_130px_1fr_auto]">
            <label className={label}>
              {vi ? 'Ngày áp dụng' : 'Date'}
              <input type="date" value={form.date} max={asOf} onChange={(e) => setForm({ ...form, date: e.target.value })} className={`mt-1 w-full ${inputCls}`} />
            </label>
            <label className={label}>
              {vi ? 'Loại' : 'Type'}
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ChangeType })} className={`mt-1 w-full ${inputCls}`}>
                {(Object.keys(CHANGE_TYPE_LABELS) as ChangeType[]).map((k) => (
                  <option key={k} value={k}>
                    {tr(lang, CHANGE_TYPE_LABELS[k])}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              SKU
              <select value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className={`mt-1 w-full ${inputCls}`}>
                <option value="">{vi ? 'Toàn shop' : 'Whole shop'}</option>
                {dataset.products.map((p) => (
                  <option key={p.sku} value={p.sku}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              {vi ? 'Sàn' : 'Platform'}
              <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value as Platform | '' })} className={`mt-1 w-full ${inputCls}`}>
                <option value="">{vi ? 'Tất cả sàn' : 'All'}</option>
                {platforms.map((p) => (
                  <option key={p} value={p}>
                    {PLATFORM_LABELS[p]}
                  </option>
                ))}
              </select>
            </label>
            <label className={`${label} md:col-span-3 xl:col-span-1`}>
              {vi ? 'Mô tả' : 'Description'}
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={vi ? 'VD: Giảm giá từ 259k xuống 249k' : 'e.g. Price 259k → 249k'} className={`mt-1 w-full ${inputCls}`} />
            </label>
            <PrimaryButton onClick={add} disabled={!form.description.trim()}>
              <Plus className="h-4 w-4" aria-hidden /> {vi ? 'Thêm' : 'Add'}
            </PrimaryButton>
          </div>
        )}
        {events.length === 0 ? (
          <NotEnoughData lang={lang} title={vi ? 'Chưa có thay đổi' : 'No changes'} reason={vi ? 'Chưa có thay đổi nào được ghi.' : 'No changes logged.'} />
        ) : (
          <div className={TABLE.frame}>
            <table className={TABLE.table}>
              <thead className={TABLE.thead}>
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
                {events.map((e) => {
                  const on = event?.id === e.id;
                  return (
                    <tr key={e.id} onClick={() => setSelected(e.id)} className={`h-11 cursor-pointer border-t border-line ${on ? 'bg-primary-soft text-fg' : 'text-fg hover:bg-hover'}`} aria-selected={on}>
                      <td className={`${TABLE.td} ${on ? 'font-semibold text-primary' : ''}`}>
                        {fmtDay(e.date)}/{e.date.slice(0, 4)}
                      </td>
                      <td className={TABLE.td}>{tr(lang, CHANGE_TYPE_LABELS[e.type])}</td>
                      <td className={TABLE.td}>
                        {e.sku ? dataset.products.find((p) => p.sku === e.sku)?.name ?? e.sku : vi ? 'Toàn shop' : 'Whole shop'}
                        {e.platform ? ` · ${PLATFORM_LABELS[e.platform]}` : ''}
                      </td>
                      <td className="min-w-[220px] px-3 py-1.5">{e.description}</td>
                      <td className={`${TABLE.td} text-muted`}>{e.userAdded ? (vi ? 'Bạn thêm' : 'You') : vi ? 'Từ dữ liệu' : 'From data'}</td>
                      <td className={`${TABLE.td} text-right`}>
                        {e.userAdded && planning && (
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              planning.removeChange(e.id);
                            }}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-control text-muted hover:bg-hover hover:text-fg"
                            aria-label={vi ? 'Xóa' : 'Delete'}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {event && impact && (
        <SectionCard
          title={vi ? `Trước / sau: ${event.description}` : `Before / after: ${event.description}`}
          description={`${tr(lang, impact.scopeLabel)} · ${vi ? 'áp dụng' : 'from'} ${fmtDay(event.date)}/${event.date.slice(0, 4)}`}
          tools={
            w && (
              <Tabs<string>
                size="sm"
                label={vi ? 'Cửa sổ so sánh' : 'Window'}
                value={String(w.days)}
                onChange={(v) => setWindowDays(Number(v))}
                options={impact.windows.map((x) => ({ key: String(x.days), label: `${x.days} ${vi ? 'ngày' : 'days'}` }))}
              />
            )
          }
          notesLabel={vi ? 'Ghi chú' : 'Notes'}
          notes={impact.unavailable || !w ? [] : impact.notes.map((n) => tr(lang, n))}
        >
          {impact.unavailable || !w ? (
            <NotEnoughData lang={lang} reason={tr(lang, impact.unavailable ?? { vi: 'Không đủ dữ liệu.', en: 'Not enough data.' })} />
          ) : (
            <>
              <p className="rounded-control bg-info-soft p-3 text-sm leading-relaxed text-fg">{tr(lang, w.summary)}</p>
              <div className={`mt-4 ${TABLE.frame}`}>
                <table className={TABLE.table}>
                  <thead className={TABLE.thead}>
                    <tr>
                      <Th left>{vi ? 'Chỉ số' : 'Metric'}</Th>
                      <Th>{vi ? `Trước (${formatRangeVi(w.before)})` : `Before (${formatRangeVi(w.before)})`}</Th>
                      <Th>{vi ? `Sau (${formatRangeVi(w.after)})` : `After (${formatRangeVi(w.after)})`}</Th>
                      <Th>{vi ? 'Thay đổi' : 'Change'}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {w.metrics.map((m) => (
                      <tr key={m.key} className={`${TABLE.tr} text-fg`}>
                        <td className={TABLE.td}>{tr(lang, m.label)}</td>
                        <td className={`${TABLE.td} text-right text-muted`}>{fmtByUnit(m.change.previous, m.unit, lang)}</td>
                        <td className={`${TABLE.td} text-right`}>{fmtByUnit(m.change.current, m.unit, lang)}</td>
                        <td className={`${TABLE.td} text-right`}>
                          <ChangeCell c={m.change} rate={m.unit === 'ratio'} goodWhenUp={m.goodWhenUp} lang={lang} />
                        </td>
                      </tr>
                    ))}
                    {w.reference && (
                      <tr className="h-11 border-t border-line bg-surface-2 text-muted">
                        <td className={TABLE.td}>{vi ? 'GMV phần còn lại của shop (đối chứng)' : 'GMV rest of shop (reference)'}</td>
                        <td className={`${TABLE.td} text-right`}>{fmtByUnit(w.reference.gmv.previous, 'vnd', lang)}</td>
                        <td className={`${TABLE.td} text-right`}>{fmtByUnit(w.reference.gmv.current, 'vnd', lang)}</td>
                        <td className={`${TABLE.td} text-right`}>
                          <ChangeCell c={w.reference.gmv} lang={lang} />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-small text-muted">
                <EvidenceButton compact lang={lang} onClick={() => openEvidence({ title: vi ? `Trước thay đổi · ${formatRangeVi(w.before)}` : 'Before', filter: { range: w.before, ...eventScope(event) } })} />
                <span>{vi ? 'trước' : 'before'}</span>
                <EvidenceButton compact lang={lang} onClick={() => openEvidence({ title: vi ? `Sau thay đổi · ${formatRangeVi(w.after)}` : 'After', filter: { range: w.after, ...eventScope(event) } })} />
                <span>{vi ? 'sau' : 'after'}</span>
              </div>
            </>
          )}
        </SectionCard>
      )}
      {event && w && !event.sku && (
        <SourceDriversPanel
          before={w.before}
          after={w.after}
          title={vi ? `Sau thay đổi: doanh số toàn shop tăng/giảm do kênh / nguồn nào (${w.usedDays} ngày trước/sau)` : `After the change: which channel / source moved shop sales`}
        />
      )}
    </div>
  );
};

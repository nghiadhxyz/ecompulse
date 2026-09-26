import React, { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Plus, Save, Trash2 } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  DAY_TYPE_LABELS,
  fmtDay,
  fmtMoney,
  fmtMoneyCompact,
  fmtRate,
  formatRangeVi,
  planBaselines,
  planProgress,
  PLATFORM_LABELS,
  shiftMonths,
  type MonthlyPlan,
  type PlanEvent,
  type Platform,
} from '../../../analytics';
import { useWorkspace } from '../../seller/SellerContext';
import { GhostButton, NotEnoughData, PrimaryButton, Section, tr } from '../../seller/ui';
import { Th } from '../ui';
import { usePlanning } from '../../workspace/usePlanning';
import { downloadIcs } from '../../../utils/reportExport';
import { inputCls } from './ChangeImpactView';

const CURRENT_COLOR = '#3987e5';
const TARGET_COLOR = '#8b93a3';

const parseMoney = (s: string): number | null => {
  const v = Number(s.replace(/[^\d]/g, ''));
  return Number.isFinite(v) && v > 0 ? v : null;
};

export const MonthlyPlanningView: React.FC = () => {
  const { lang, dataset, asOf, platforms: filterPlatforms } = useWorkspace();
  const planning = usePlanning();
  const vi = lang === 'vi';
  const months = useMemo(() => {
    const cur = asOf.slice(0, 7);
    return [shiftMonths(`${cur}-01`, -2), shiftMonths(`${cur}-01`, -1), `${cur}-01`, shiftMonths(`${cur}-01`, 1)].map((d) => d.slice(0, 7));
  }, [asOf]);
  const [month, setMonth] = useState(asOf.slice(0, 7));
  const saved = planning?.plans.find((p) => p.month === month) ?? null;
  const [draft, setDraft] = useState<{ target: string; platformTargets: Partial<Record<Platform, string>>; events: PlanEvent[] }>({ target: '', platformTargets: {}, events: [] });
  const [ev, setEv] = useState<{ date: string; title: string; kind: PlanEvent['kind'] }>({ date: `${month}-01`, title: '', kind: 'campaign' });

  useEffect(() => {
    setDraft({
      target: saved ? String(saved.targetGmv) : '',
      platformTargets: Object.fromEntries(Object.entries(saved?.platformTargets ?? {}).map(([k, v]) => [k, String(v)])),
      events: saved?.events ?? [],
    });
    setEv((e) => ({ ...e, date: `${month}-01` }));
  }, [month, saved]);

  const platforms = useMemo(() => [...new Set(dataset.orders.map((o) => o.platform))], [dataset]);
  const baselines = useMemo(() => planBaselines(dataset, month, filterPlatforms), [dataset, month, filterPlatforms]);
  const progress = useMemo(() => (saved ? planProgress(dataset, saved, filterPlatforms) : null), [dataset, saved, filterPlatforms]);

  if (!planning) return <NotEnoughData lang={lang} reason={vi ? 'Kế hoạch chỉ có trong Analyst workspace.' : 'Planning is available in the Analyst workspace.'} />;

  const target = parseMoney(draft.target);
  const save = () => {
    if (!target) return;
    const platformTargets = Object.fromEntries(Object.entries(draft.platformTargets).map(([k, v]) => [k, parseMoney(v ?? '')]).filter(([, v]) => v)) as Partial<Record<Platform, number>>;
    const plan: MonthlyPlan = { month, targetGmv: target, platformTargets, events: draft.events };
    planning.savePlan(plan);
  };
  const platSum = Object.values(draft.platformTargets).reduce((s, v) => s + (parseMoney(v ?? '') ?? 0), 0);

  const chart = progress?.days.map((d) => ({ label: fmtDay(d.date), target: d.cumTarget, actual: d.cumActual }));

  return (
    <div className="space-y-4">
      <Section
        title="Monthly Planning"
        subtitle={vi ? 'Đặt mục tiêu GMV tháng, chia theo ngày dựa trên lịch sử của shop và theo dõi tiến độ.' : 'Set a monthly GMV target, spread by the shop history, and track progress.'}
        right={
          <label className="text-xs text-slate-300 flex items-center gap-1.5">
            {vi ? 'Tháng' : 'Month'}
            <select aria-label={vi ? "Tháng" : "Month"} value={month} onChange={(e) => setMonth(e.target.value)} className={inputCls}>
              {months.map((m) => (
                <option key={m} value={m}>{m.slice(5)}/{m.slice(0, 4)}{planning.plans.some((p) => p.month === m) ? ' ✓' : ''}</option>
              ))}
            </select>
          </label>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400 block">
              {vi ? 'Mục tiêu GMV tháng (VNĐ)' : 'Monthly GMV target (VND)'}
              <input inputMode="numeric" value={draft.target ? Number(draft.target.replace(/[^\d]/g, '') || 0).toLocaleString('vi-VN') : ''} onChange={(e) => setDraft({ ...draft, target: e.target.value.replace(/[^\d]/g, '') })} placeholder="1.700.000.000" className={`mt-1 w-full ${inputCls}`} />
            </label>
            <div className="flex flex-wrap gap-1.5 mt-1.5 text-[11px] text-slate-400">
              {vi ? 'Tham khảo:' : 'Reference:'}
              {baselines.previousMonth !== null && (
                <button onClick={() => setDraft({ ...draft, target: String(Math.round(baselines.previousMonth!)) })} className="underline underline-offset-2 hover:text-white">
                  {vi ? 'tháng trước' : 'last month'} {fmtMoneyCompact(baselines.previousMonth, lang)}
                </button>
              )}
              {baselines.lastYear !== null && (
                <button onClick={() => setDraft({ ...draft, target: String(Math.round(baselines.lastYear!)) })} className="underline underline-offset-2 hover:text-white">
                  {vi ? 'cùng kỳ năm trước' : 'same month last year'} {fmtMoneyCompact(baselines.lastYear, lang)}
                </button>
              )}
              {baselines.previousMonth === null && baselines.lastYear === null && <span>{vi ? 'chưa đủ dữ liệu tháng trước' : 'no full previous month'}</span>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
              {platforms.map((p) => (
                <label key={p} className="text-xs text-slate-400">
                  {PLATFORM_LABELS[p]} {vi ? '(tùy chọn)' : '(optional)'}
                  <input
                    inputMode="numeric"
                    value={draft.platformTargets[p] ? Number(draft.platformTargets[p]).toLocaleString('vi-VN') : ''}
                    onChange={(e) => setDraft({ ...draft, platformTargets: { ...draft.platformTargets, [p]: e.target.value.replace(/[^\d]/g, '') } })}
                    className={`mt-1 w-full ${inputCls}`}
                  />
                </label>
              ))}
            </div>
            {target && platSum > 0 && Math.abs(platSum - target) > target * 0.005 && (
              <p className="text-[11px] text-[#fab219] mt-1">{vi ? `Tổng mục tiêu theo sàn (${fmtMoneyCompact(platSum, lang)}) khác mục tiêu tháng.` : 'Platform targets do not add up to the monthly target.'}</p>
            )}
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-300 mb-1.5">{vi ? 'Sự kiện trong tháng' : 'Events this month'}</h3>
            <div className="grid grid-cols-[130px_1fr_110px_auto] gap-1.5 items-end">
              <input type="date" aria-label={vi ? 'Ngày' : 'Date'} value={ev.date} min={`${month}-01`} max={`${month}-31`} onChange={(e) => setEv({ ...ev, date: e.target.value })} className={inputCls} />
              <input aria-label={vi ? 'Tên sự kiện' : 'Event'} value={ev.title} onChange={(e) => setEv({ ...ev, title: e.target.value })} placeholder={vi ? 'VD: Sale 10.10, live ra mắt…' : 'e.g. 10.10 sale'} className={`min-w-0 ${inputCls}`} />
              <select aria-label={vi ? 'Loại' : 'Kind'} value={ev.kind} onChange={(e) => setEv({ ...ev, kind: e.target.value as PlanEvent['kind'] })} className={inputCls}>
                <option value="campaign">{vi ? 'Chiến dịch' : 'Campaign'}</option>
                <option value="live">Live</option>
                <option value="launch">{vi ? 'Ra mắt' : 'Launch'}</option>
                <option value="other">{vi ? 'Khác' : 'Other'}</option>
              </select>
              <GhostButton
                onClick={() => {
                  if (!ev.title.trim() || !ev.date.startsWith(month)) return;
                  setDraft({ ...draft, events: [...draft.events, { id: `ev-${Date.now().toString(36)}`, date: ev.date, title: ev.title.trim(), kind: ev.kind }].sort((a, b) => a.date.localeCompare(b.date)) });
                  setEv({ ...ev, title: '' });
                }}
                aria-label={vi ? 'Thêm sự kiện' : 'Add event'}
              >
                <Plus className="w-4 h-4" aria-hidden />
              </GhostButton>
            </div>
            <ul className="mt-2 space-y-1">
              {draft.events.map((e) => (
                <li key={e.id} className="flex items-center justify-between text-xs text-slate-200 border-b border-white/5 pb-1">
                  <span>{fmtDay(e.date)} · {e.title} <span className="text-slate-500">({e.kind})</span></span>
                  <button onClick={() => setDraft({ ...draft, events: draft.events.filter((x) => x.id !== e.id) })} className="text-slate-400 hover:text-[#f87171]" aria-label={vi ? 'Xóa' : 'Delete'}>
                    <Trash2 className="w-3.5 h-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-slate-500 mt-1">{vi ? 'Ngày chiến dịch được tính mục tiêu như ngày siêu sale.' : 'Campaign days get a sale-day share of the target.'}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <PrimaryButton onClick={save} disabled={!target}>
            <Save className="w-4 h-4" aria-hidden /> {vi ? 'Lưu kế hoạch' : 'Save plan'}
          </PrimaryButton>
          {saved && (
            <>
              <GhostButton onClick={() => downloadIcs(saved, planning.actions, `EcomPulse_ke_hoach_${month}`)}>
                <CalendarPlus className="w-4 h-4" aria-hidden /> {vi ? 'Xuất lịch (.ics)' : 'Export calendar (.ics)'}
              </GhostButton>
              <GhostButton onClick={() => planning.removePlan(month)}>{vi ? 'Xóa kế hoạch' : 'Delete plan'}</GhostButton>
            </>
          )}
        </div>
        <p className="text-[11px] text-slate-500 mt-2">{vi ? 'File .ics nhập được vào Google Calendar / Outlook (Cài đặt → Nhập). Kế hoạch lưu trên máy này.' : 'The .ics file imports into Google Calendar / Outlook. Plans stay on this device.'}</p>
      </Section>

      {saved && progress && (
        <Section title={vi ? `Tiến độ ${month.slice(5)}/${month.slice(0, 4)}` : `Progress ${month}`} subtitle={formatRangeVi(progress.range)}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {[
              { l: vi ? 'Mục tiêu tháng' : 'Target', v: fmtMoneyCompact(saved.targetGmv, lang) },
              { l: progress.lastDataDay ? (vi ? `Thực tế đến ${fmtDay(progress.lastDataDay)}` : `Actual to ${fmtDay(progress.lastDataDay)}`) : vi ? 'Thực tế' : 'Actual', v: progress.toDate ? fmtMoneyCompact(progress.toDate.actual, lang) : '—' },
              { l: vi ? 'So với kế hoạch đến nay' : 'vs plan to date', v: progress.toDate ? fmtRate(progress.toDate.ratio, lang, 0) : '—', tone: progress.toDate?.ratio == null ? '' : progress.toDate.ratio >= 1 ? 'text-[#4ade80]' : progress.toDate.ratio >= 0.9 ? 'text-[#fab219]' : 'text-[#f87171]' },
              progress.days.every((d) => d.actual !== null)
                ? { l: vi ? 'Kết quả cả tháng' : 'Full-month result', v: fmtMoneyCompact(progress.toDate?.actual ?? null, lang), sub: vi ? 'Tháng đã đủ dữ liệu' : 'Month complete' }
                : { l: vi ? 'Ước tính cuối tháng' : 'Estimated month end', v: progress.projection !== null ? fmtMoneyCompact(progress.projection, lang) : '—', sub: vi ? 'Ước tính, không phải cam kết' : 'Estimate only' },
            ].map((x) => (
              <div key={x.l} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-[11px] text-slate-400">{x.l}</div>
                <div className={`text-lg font-black text-white ${x.tone ?? ''}`}>{x.v}</div>
                {x.sub && <div className="text-[10px] text-slate-500">{x.sub}</div>}
              </div>
            ))}
          </div>
          {progress.requiredPerWeekday !== null && progress.remainingTarget > 0 && (
            <p className="text-sm text-slate-200 mt-3">
              {vi
                ? `Còn thiếu ${fmtMoneyCompact(progress.remainingTarget, lang)}: cần khoảng ${fmtMoneyCompact(progress.requiredPerWeekday, lang)} mỗi ngày thường (ngày sale cần cao hơn theo tỷ lệ bên dưới).`
                : `${fmtMoneyCompact(progress.remainingTarget, lang)} to go: about ${fmtMoneyCompact(progress.requiredPerWeekday, lang)} per weekday.`}
            </p>
          )}
          <div className="h-64 mt-3" role="img" aria-label={vi ? 'Lũy kế GMV thực tế so với mục tiêu' : 'Cumulative GMV vs target'}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.12)' }} minTickGap={16} />
                <YAxis tickFormatter={(v: number) => fmtMoneyCompact(v, lang)} tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} width={64} />
                <Tooltip contentStyle={{ background: '#0b1024', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, fontSize: 12 }} labelStyle={{ color: '#e2e8f0', fontWeight: 700 }} itemStyle={{ color: '#cbd5e1' }} formatter={(v: number, name: string) => [fmtMoney(v, lang), name]} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#cbd5e1' }} />
                <Line isAnimationActive={false} type="monotone" dataKey="actual" name={vi ? 'Thực tế (lũy kế)' : 'Actual (cumulative)'} stroke={CURRENT_COLOR} strokeWidth={2} dot={false} />
                <Line isAnimationActive={false} type="monotone" dataKey="target" name={vi ? 'Mục tiêu (lũy kế)' : 'Target (cumulative)'} stroke={TARGET_COLOR} strokeWidth={2} strokeDasharray="5 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
            {progress.platforms.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-slate-300 mb-1.5">{vi ? 'Theo sàn' : 'By platform'}</h3>
                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full text-xs">
                    <thead className="bg-white/[0.04] text-slate-400">
                      <tr><Th left>{vi ? 'Sàn' : 'Platform'}</Th><Th>{vi ? 'Mục tiêu' : 'Target'}</Th><Th>{vi ? 'Thực tế' : 'Actual'}</Th><Th title={vi ? 'Thực tế ÷ phần mục tiêu tương ứng số ngày đã qua' : 'Actual ÷ pro-rated target'}>{vi ? 'Tiến độ' : 'Pace'}</Th></tr>
                    </thead>
                    <tbody>
                      {progress.platforms.map((p) => (
                        <tr key={p.platform} className="border-t border-white/5 text-slate-200">
                          <td className="px-2.5 py-1.5">{PLATFORM_LABELS[p.platform]}</td>
                          <td className="px-2.5 py-1.5 text-right">{fmtMoneyCompact(p.target, lang)}</td>
                          <td className="px-2.5 py-1.5 text-right">{fmtMoneyCompact(p.actual, lang)}</td>
                          <td className={`px-2.5 py-1.5 text-right font-bold ${p.ratio === null ? '' : p.ratio >= 1 ? 'text-[#4ade80]' : p.ratio >= 0.9 ? 'text-[#fab219]' : 'text-[#f87171]'}`}>{fmtRate(p.ratio, lang, 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div>
              <h3 className="text-xs font-bold text-slate-300 mb-1.5">{vi ? 'Tỷ lệ doanh thu theo loại ngày (90 ngày trước)' : 'Day-type weights (previous 90 days)'}</h3>
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-xs">
                  <thead className="bg-white/[0.04] text-slate-400">
                    <tr><Th left>{vi ? 'Loại ngày' : 'Day type'}</Th><Th>{vi ? 'So với ngày thường' : 'vs weekday'}</Th><Th>{vi ? 'Số ngày mẫu' : 'Samples'}</Th></tr>
                  </thead>
                  <tbody>
                    {progress.weights.map((w) => (
                      <tr key={w.dayType} className="border-t border-white/5 text-slate-200">
                        <td className="px-2.5 py-1.5">{tr(lang, DAY_TYPE_LABELS[w.dayType])}</td>
                        <td className="px-2.5 py-1.5 text-right">{w.fallback ? '—' : `×${w.weight.toFixed(2).replace('.', vi ? ',' : '.')}`}</td>
                        <td className="px-2.5 py-1.5 text-right">{w.samples}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <ul className="mt-3 space-y-1">
            {progress.notes.map((n, i) => (
              <li key={i} className="text-xs text-slate-400">• {tr(lang, n)}</li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import { AlertTriangle, CalendarPlus, Plus, Trash2 } from 'lucide-react';
import {
  ACTION_STATUS_LABELS,
  fmtByUnit,
  fmtDay,
  formatRangeVi,
  isOverdue,
  measureAction,
  PLATFORM_LABELS,
  type ActionItem,
  type ActionStatus,
  type KpiKey,
  type Platform,
} from '../../../analytics';
import { useWorkspace } from '../../seller/SellerContext';
import { EvidenceButton, GhostButton, NotEnoughData, PrimaryButton, Section, tr } from '../../seller/ui';
import { ChangeCell } from '../ui';
import { usePlanning } from '../../workspace/usePlanning';
import { downloadIcs } from '../../../utils/reportExport';
import { inputCls } from './ChangeImpactView';

const METRICS: { key: KpiKey; vi: string; en: string; goodWhenUp: boolean }[] = [
  { key: 'gmv', vi: 'GMV', en: 'GMV', goodWhenUp: true },
  { key: 'profit', vi: 'Lợi nhuận', en: 'Profit', goodWhenUp: true },
  { key: 'orders', vi: 'Số đơn', en: 'Orders', goodWhenUp: true },
  { key: 'cancelRate', vi: 'Tỷ lệ hủy', en: 'Cancel rate', goodWhenUp: false },
  { key: 'cvr', vi: 'CVR', en: 'CVR', goodWhenUp: true },
  { key: 'aov', vi: 'AOV', en: 'AOV', goodWhenUp: true },
  { key: 'margin', vi: 'Margin', en: 'Margin', goodWhenUp: true },
];

const STATUSES: ActionStatus[] = ['todo', 'doing', 'done', 'dropped'];
const STATUS_TONE: Record<ActionStatus, string> = {
  todo: 'border-white/15 text-slate-200',
  doing: 'border-sky-400/40 text-sky-200',
  done: 'border-[#0ca30c]/40 text-[#4ade80]',
  dropped: 'border-white/10 text-slate-500',
};

const ActionCard: React.FC<{ a: ActionItem }> = ({ a }) => {
  const { lang, dataset, asOf, openEvidence } = useWorkspace();
  const planning = usePlanning()!;
  const vi = lang === 'vi';
  const metric = METRICS.find((m) => m.key === a.metric) ?? METRICS[0];
  const result = useMemo(() => measureAction(dataset, a), [dataset, a]);
  const m = result.window?.metrics.find((x) => x.key === a.metric);
  const overdue = isOverdue(a, asOf);
  const scopeText = [a.scope.skus?.map((s) => dataset.products.find((p) => p.sku === s)?.name ?? s).join(', '), a.scope.platforms?.map((p) => PLATFORM_LABELS[p]).join(', ')].filter(Boolean).join(' · ') || (vi ? 'Toàn shop' : 'Whole shop');

  return (
    <li className={`rounded-xl border p-3 bg-white/[0.02] ${overdue ? 'border-[#fab219]/50' : 'border-white/10'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-bold text-white">{a.title}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {metric[vi ? 'vi' : 'en']} · {scopeText}
            {a.owner && ` · ${vi ? 'Phụ trách' : 'Owner'}: ${a.owner}`}
            {a.deadline && ` · ${vi ? 'Hạn' : 'Due'} ${fmtDay(a.deadline)}`}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {overdue && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#fab219] border border-[#fab219]/40 rounded px-1.5 py-0.5">
              <AlertTriangle className="w-3 h-3" aria-hidden /> {vi ? 'Quá hạn' : 'Overdue'}
            </span>
          )}
          <select
            aria-label={vi ? 'Trạng thái' : 'Status'}
            value={a.status}
            onChange={(e) => {
              const status = e.target.value as ActionStatus;
              planning.updateAction(a.id, { status, doneDate: status === 'done' ? a.doneDate ?? asOf : a.doneDate });
            }}
            className={`bg-transparent border rounded-lg px-1.5 py-1 text-xs font-semibold [color-scheme:dark] ${STATUS_TONE[a.status]}`}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{tr(lang, ACTION_STATUS_LABELS[s])}</option>
            ))}
          </select>
          <button onClick={() => planning.removeAction(a.id)} className="text-slate-400 hover:text-[#f87171] p-1" aria-label={vi ? 'Xóa' : 'Delete'}>
            <Trash2 className="w-3.5 h-3.5" aria-hidden />
          </button>
        </div>
      </div>
      {a.insight && <p className="text-xs text-slate-300 mt-1.5"><b className="text-slate-400">{vi ? 'Nhận định: ' : 'Insight: '}</b>{a.insight}</p>}
      <div className="flex flex-wrap items-center gap-2 mt-2">
        {a.evidence && <EvidenceButton compact lang={lang} onClick={() => openEvidence({ title: a.title, filter: a.evidence! })} />}
        {a.status === 'done' && (
          <label className="text-[11px] text-slate-400 flex items-center gap-1">
            {vi ? 'Ngày áp dụng' : 'Effective'}
            <input type="date" value={a.doneDate ?? ''} max={asOf} onChange={(e) => planning.updateAction(a.id, { doneDate: e.target.value || undefined })} className={`${inputCls} py-0.5 text-xs`} />
          </label>
        )}
      </div>
      {a.status === 'done' && (
        <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] p-2">
          <div className="text-[10px] font-black uppercase tracking-wider text-sky-300">{vi ? 'Đo kết quả (14 ngày trước / sau)' : 'Result (14 days before / after)'}</div>
          {result.window && m ? (
            <>
              <p className="text-xs text-slate-200 mt-1">
                {metric[vi ? 'vi' : 'en']}: {fmtByUnit(m.change.previous, m.unit, lang)} → <b>{fmtByUnit(m.change.current, m.unit, lang)}</b> <ChangeCell c={m.change} rate={m.unit === 'ratio'} goodWhenUp={metric.goodWhenUp} lang={lang} />
                <span className="text-slate-500"> · {formatRangeVi(result.window.before)} → {formatRangeVi(result.window.after)}{!result.window.complete ? (vi ? ` (mới có ${result.window.usedDays} ngày)` : ` (${result.window.usedDays} days so far)`) : ''}</span>
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">{vi ? 'Kết quả đi cùng hành động, chưa chứng minh là do hành động — đối chiếu với các thay đổi khác cùng thời gian.' : 'Moved together with the action; not proof it caused it.'}</p>
            </>
          ) : (
            <p className="text-xs text-slate-400 mt-1">{tr(lang, result.unavailable ?? { vi: 'Không đủ dữ liệu.', en: 'Not enough data.' })}</p>
          )}
          <input
            aria-label={vi ? 'Ghi chú kết quả' : 'Result note'}
            value={a.resultNote ?? ''}
            onChange={(e) => planning.updateAction(a.id, { resultNote: e.target.value })}
            placeholder={vi ? 'Ghi chú kết quả / bài học…' : 'Result note…'}
            className={`mt-1.5 w-full ${inputCls} text-xs`}
          />
        </div>
      )}
    </li>
  );
};

export const ActionCenterView: React.FC = () => {
  const { lang, dataset, asOf } = useWorkspace();
  const planning = usePlanning();
  const vi = lang === 'vi';
  const [form, setForm] = useState<{ title: string; insight: string; metric: KpiKey; sku: string; platform: Platform | ''; owner: string; deadline: string }>({ title: '', insight: '', metric: 'gmv', sku: '', platform: '', owner: '', deadline: '' });
  const [filter, setFilter] = useState<ActionStatus | 'open' | 'all'>('open');
  const platforms = useMemo(() => [...new Set(dataset.orders.map((o) => o.platform))], [dataset]);

  if (!planning) return <NotEnoughData lang={lang} reason={vi ? 'Action Center chỉ có trong Analyst workspace.' : 'Action Center is in the Analyst workspace.'} />;
  const list = planning.actions.filter((a) => (filter === 'all' ? true : filter === 'open' ? a.status === 'todo' || a.status === 'doing' : a.status === filter));
  const overdue = planning.actions.filter((a) => isOverdue(a, asOf)).length;

  const add = () => {
    if (!form.title.trim()) return;
    const scope = { skus: form.sku ? [form.sku] : undefined, platforms: form.platform ? [form.platform] : undefined };
    planning.addAction({
      title: form.title.trim(),
      insight: form.insight.trim() || undefined,
      metric: form.metric,
      scope,
      owner: form.owner.trim() || undefined,
      deadline: form.deadline || undefined,
      evidence: { range: { start: asOf, end: asOf }, ...scope },
    });
    setForm({ ...form, title: '', insight: '' });
  };

  return (
    <div className="space-y-4">
      <Section
        title="Action Center"
        subtitle={vi ? 'Nhận định → bằng chứng → hành động → người phụ trách → hạn → trạng thái → đo kết quả.' : 'Insight → evidence → action → owner → deadline → status → result.'}
        right={
          <GhostButton onClick={() => downloadIcs(null, planning.actions, 'EcomPulse_han_hanh_dong')} disabled={!planning.actions.some((a) => a.deadline)}>
            <CalendarPlus className="w-4 h-4" aria-hidden /> {vi ? 'Xuất hạn (.ics)' : 'Deadlines (.ics)'}
          </GhostButton>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 items-end">
          <label className="text-xs text-slate-400 md:col-span-2">
            {vi ? 'Việc cần làm' : 'Action'}
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={vi ? 'VD: Giảm giá thầu GMV Max Nồi chiên 20%' : 'e.g. Cut bids by 20%'} className={`mt-1 w-full ${inputCls}`} />
          </label>
          <label className="text-xs text-slate-400 md:col-span-2">
            {vi ? 'Nhận định / lý do (tùy chọn)' : 'Insight (optional)'}
            <input value={form.insight} onChange={(e) => setForm({ ...form, insight: e.target.value })} className={`mt-1 w-full ${inputCls}`} />
          </label>
          <label className="text-xs text-slate-400">
            {vi ? 'Chỉ số theo dõi' : 'Metric'}
            <select value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value as KpiKey })} className={`mt-1 w-full ${inputCls}`}>
              {METRICS.map((m) => (
                <option key={m.key} value={m.key}>{vi ? m.vi : m.en}</option>
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
              <option value="">{vi ? 'Tất cả' : 'All'}</option>
              {platforms.map((p) => (
                <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-[1fr_150px] gap-2">
            <label className="text-xs text-slate-400">
              {vi ? 'Phụ trách' : 'Owner'}
              <input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} className={`mt-1 w-full ${inputCls}`} />
            </label>
            <label className="text-xs text-slate-400">
              {vi ? 'Hạn' : 'Due'}
              <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className={`mt-1 w-full ${inputCls}`} />
            </label>
          </div>
        </div>
        <div className="mt-2">
          <PrimaryButton onClick={add} disabled={!form.title.trim()}>
            <Plus className="w-4 h-4" aria-hidden /> {vi ? 'Thêm hành động' : 'Add action'}
          </PrimaryButton>
        </div>
        <p className="text-[11px] text-slate-500 mt-2">{vi ? 'Mẹo: bấm "Thêm vào Action Center" ở các cảnh báo để tạo hành động kèm bằng chứng.' : 'Tip: use "Add to Action Center" on alerts to carry the evidence.'}</p>
      </Section>

      <Section
        title={vi ? `Hành động (${planning.actions.length})` : `Actions (${planning.actions.length})`}
        subtitle={overdue ? (vi ? `${overdue} việc quá hạn (so với ngày dữ liệu mới nhất ${fmtDay(asOf)})` : `${overdue} overdue`) : undefined}
        right={
          <div className="flex flex-wrap gap-1" role="group" aria-label={vi ? 'Lọc trạng thái' : 'Filter'}>
            {(['open', ...STATUSES, 'all'] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} className={`px-2 py-1 rounded-lg text-xs font-semibold border ${filter === f ? 'bg-white/15 border-white/30 text-white' : 'border-white/10 text-slate-400'}`}>
                {f === 'open' ? (vi ? 'Đang mở' : 'Open') : f === 'all' ? (vi ? 'Tất cả' : 'All') : tr(lang, ACTION_STATUS_LABELS[f])}
              </button>
            ))}
          </div>
        }
      >
        {list.length === 0 ? (
          <p className="text-sm text-slate-400">{vi ? 'Không có hành động nào ở mục này.' : 'No actions here.'}</p>
        ) : (
          <ul className="space-y-2.5">
            {list.map((a) => (
              <ActionCard key={a.id} a={a} />
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
};

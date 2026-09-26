import React, { useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { DolphinAsk } from '../DolphinAsk';
import { addDays, buildDailyBrief, fmtDay, type AlertSeverity, type BriefItem } from '../../../analytics';
import { useSeller } from '../SellerContext';
import { EvidenceButton, KpiCard, NotEnoughData, Section, SeverityBadge, SEVERITY_STYLE, tr } from '../ui';
import dolphinAvatar from '../../../assets/images/dolphin_ai_avatar_1787721342181.jpg';

const FILTERS: (AlertSeverity | 'all')[] = ['all', 'critical', 'warning', 'opportunity', 'info'];

export const DolphinView: React.FC = () => {
  const { lang, dataset, asOf, platforms, openEvidence } = useSeller();
  const vi = lang === 'vi';
  const [day, setDay] = useState(addDays(asOf, -1));
  const [severity, setSeverity] = useState<AlertSeverity | 'all'>('all');
  const brief = useMemo(() => buildDailyBrief(dataset, day, platforms), [dataset, day, platforms]);
  const alerts = severity === 'all' ? brief.alerts : brief.alerts.filter((a) => a.severity === severity);

  const itemList = (items: BriefItem[], icon: React.ReactNode, empty: string) =>
    items.length === 0 ? (
      <p className="text-sm text-slate-400">{empty}</p>
    ) : (
      <ol className="space-y-2">
        {items.map((it, i) => {
          const filter = it.evidence.find((e) => e.filter)?.filter;
          return (
            <li key={i} className="flex gap-2.5">
              <span className="mt-0.5 shrink-0">{icon}</span>
              <div className="min-w-0">
                <p className="text-sm text-slate-100 leading-relaxed">{tr(lang, it.text)}</p>
                {filter && (
                  <div className="mt-1">
                    <EvidenceButton compact lang={lang} onClick={() => openEvidence({ title: tr(lang, it.text).slice(0, 90), filter, evidence: it.evidence })} />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    );

  const h = brief.headline;
  return (
    <div className="space-y-4">
      <DolphinAsk />

      <Section
        title={vi ? 'Bản tin kinh doanh hằng ngày' : 'Daily business brief'}
        subtitle={vi ? `Chuyện gì đã xảy ra ngày ${fmtDay(day)} và hôm nay cần kiểm tra gì` : `What happened on ${fmtDay(day)} and what to check today`}
        right={
          <label className="text-xs text-slate-300 flex items-center gap-1.5">
            {vi ? 'Ngày' : 'Day'}
            <input
              type="date"
              value={day}
              max={asOf}
              onChange={(e) => e.target.value && setDay(e.target.value)}
              className="bg-white/[0.06] border border-white/15 rounded-lg px-2 py-1 text-slate-100 [color-scheme:dark]"
            />
          </label>
        }
      >
        <div className="flex items-start gap-3 rounded-xl border border-sky-400/20 bg-sky-500/[0.06] p-3">
          <img src={dolphinAvatar} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
          <div className="min-w-0">
            <p className="text-sm text-slate-100 leading-relaxed">{tr(lang, brief.summary) || (vi ? 'Chưa có dữ liệu cho ngày này.' : 'No data for this day.')}</p>
            {brief.limitations.map((l, i) => (
              <p key={i} className="text-xs text-[#fab219] mt-1">{tr(lang, l)}</p>
            ))}
            <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" aria-hidden />
              {vi ? 'Bản tin tạo từ số liệu đã tính trên máy của bạn — không gửi dữ liệu ra ngoài, không đoán số.' : 'Built locally from computed numbers — no data sent out, nothing guessed.'}
            </p>
          </div>
        </div>

        <h3 className="text-xs font-black text-slate-300 uppercase tracking-wider mt-4 mb-2">{vi ? `Hôm qua (${fmtDay(day)})` : `Yesterday (${fmtDay(day)})`}</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <KpiCard lang={lang} label={vi ? 'Doanh thu' : 'Revenue'} metric={brief.headline.revenue.current === null ? { value: null, unit: 'vnd', status: 'missing' } : { value: h.revenue.current, unit: 'vnd', status: h.revenue.currentStatus }} cmp={h.revenue} compareLabel={vi ? `so với ${fmtDay(brief.compareDay)}` : `vs ${fmtDay(brief.compareDay)}`} />
          <KpiCard lang={lang} label={vi ? 'Lợi nhuận ước tính' : 'Est. profit'} metric={{ value: h.profit.current, unit: 'vnd', status: h.profit.currentStatus }} cmp={h.profit} compareLabel={vi ? `so với ${fmtDay(brief.compareDay)}` : `vs ${fmtDay(brief.compareDay)}`} />
          <KpiCard lang={lang} label={vi ? 'Đơn hàng' : 'Orders'} metric={{ value: h.orders.current, unit: 'count', status: h.orders.currentStatus }} cmp={h.orders} compareLabel={vi ? `so với ${fmtDay(brief.compareDay)}` : `vs ${fmtDay(brief.compareDay)}`} />
          <KpiCard lang={lang} label={vi ? 'Tỷ lệ hủy' : 'Cancel rate'} metric={{ value: h.cancelRate.current, unit: 'ratio', status: h.cancelRate.currentStatus }} cmp={h.cancelRate} goodWhenUp={false} compareLabel={vi ? `so với ${fmtDay(brief.compareDay)}` : `vs ${fmtDay(brief.compareDay)}`} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-4">
          <div className="rounded-xl border border-[#0ca30c]/30 bg-[#0ca30c]/[0.05] p-3">
            <h3 className="text-xs font-black text-[#4ade80] uppercase tracking-wider mb-2">{vi ? 'Điểm tốt' : 'Going well'}</h3>
            {itemList(brief.positives, <CheckCircle2 className="w-4 h-4 text-[#4ade80]" aria-hidden />, vi ? 'Chưa có điểm nổi bật.' : 'Nothing notable.')}
          </div>
          <div className="rounded-xl border border-[#fab219]/30 bg-[#fab219]/[0.05] p-3">
            <h3 className="text-xs font-black text-[#fab219] uppercase tracking-wider mb-2">{vi ? 'Cần chú ý' : 'Needs attention'}</h3>
            {itemList(brief.concerns, <AlertTriangle className="w-4 h-4 text-[#fab219]" aria-hidden />, vi ? 'Không có vấn đề cần chú ý.' : 'No issues.')}
          </div>
          <div className="rounded-xl border border-sky-400/30 bg-sky-500/[0.05] p-3">
            <h3 className="text-xs font-black text-sky-300 uppercase tracking-wider mb-2">{vi ? 'Hôm nay nên kiểm tra' : 'Check today'}</h3>
            {itemList(brief.checks, <ClipboardCheck className="w-4 h-4 text-sky-300" aria-hidden />, vi ? 'Không có việc cần kiểm tra.' : 'Nothing to check.')}
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mt-3">
          {vi
            ? 'Các nhận định chỉ cho biết số liệu nào đi cùng nhau, không khẳng định nguyên nhân. Hãy kiểm tra danh sách đơn trước khi quyết định.'
            : 'Insights show what moved together, not proven causes. Review the orders before acting.'}
        </p>
      </Section>

      <Section title={vi ? 'Cảnh báo thông minh' : 'Smart alerts'} subtitle={vi ? `Tính đến ngày ${fmtDay(day)}` : `As of ${fmtDay(day)}`}>
        <div className="flex flex-wrap gap-1.5 mb-3" role="group" aria-label={vi ? 'Lọc mức độ' : 'Severity filter'}>
          {FILTERS.map((f) => {
            const count = f === 'all' ? brief.alerts.length : brief.alerts.filter((a) => a.severity === f).length;
            return (
              <button
                key={f}
                onClick={() => setSeverity(f)}
                aria-pressed={severity === f}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${severity === f ? 'bg-white/15 border-white/30 text-white' : 'border-white/10 text-slate-400 hover:text-white'}`}
              >
                {f === 'all' ? (vi ? 'Tất cả' : 'All') : tr(lang, SEVERITY_STYLE[f].label)} ({count})
              </button>
            );
          })}
        </div>
        {dataset.orders.length === 0 ? (
          <NotEnoughData lang={lang} reason={vi ? 'Cảnh báo theo sản phẩm, Ads và Live cần file xuất đơn hàng.' : 'Alerts need an order export.'} />
        ) : alerts.length === 0 ? (
          <p className="text-sm text-slate-400">{vi ? 'Không có cảnh báo.' : 'No alerts.'}</p>
        ) : (
          <ul className="space-y-2.5">
            {alerts.map((a) => (
              <li key={a.id} className={`rounded-xl border p-3 ${SEVERITY_STYLE[a.severity].ring} bg-white/[0.02]`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="text-sm font-bold text-white">{tr(lang, a.title)}</div>
                  <SeverityBadge severity={a.severity} lang={lang} />
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">{tr(lang, a.message)}</p>
                <p className="text-xs text-sky-200 mt-1.5">
                  <b>{vi ? 'Nên kiểm tra: ' : 'Check: '}</b>
                  {tr(lang, a.check)}
                </p>
                {a.evidence.some((e) => e.filter) && (
                  <div className="mt-2">
                    <EvidenceButton compact lang={lang} onClick={() => openEvidence({ title: tr(lang, a.title), filter: a.evidence.find((e) => e.filter)!.filter!, evidence: a.evidence })} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

    </div>
  );
};

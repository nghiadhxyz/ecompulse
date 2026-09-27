import React, { useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, ClipboardCheck, ShieldCheck, ListPlus } from 'lucide-react';
import { DolphinAsk } from '../DolphinAsk';
import { usePlanning } from '../../workspace/usePlanning';
import { addDays, buildDailyBrief, fmtDay, fmtMoneyCompact, type AlertSeverity, type BriefItem } from '../../../analytics';
import { useSeller } from '../SellerContext';
import { EvidenceButton, KpiCard, NotEnoughData, Section, SeverityBadge, SEVERITY_STYLE, tr } from '../ui';
import { PlacedOnlyNote } from '../../workspace/OrderStagePicker';
import { SummaryNotes } from '../../workspace/SummaryPanels';
import { Tabs } from '../../ui/primitives';
import dolphinAvatar from '../../../assets/images/dolphin_ai_avatar_1787721342181.jpg';

const FILTERS: (AlertSeverity | 'all')[] = ['all', 'critical', 'warning', 'opportunity', 'info'];

export const DolphinView: React.FC = () => {
  const { lang, dataset, asOf, platforms, openEvidence } = useSeller();
  const vi = lang === 'vi';
  const [day, setDay] = useState(addDays(asOf, -1));
  const [severity, setSeverity] = useState<AlertSeverity | 'all'>('all');
  const brief = useMemo(() => buildDailyBrief(dataset, day, platforms), [dataset, day, platforms]);
  const alerts = severity === 'all' ? brief.alerts : brief.alerts.filter((a) => a.severity === severity);
  // Only inside the Analyst workspace (Action Center); Seller mode has no planning context.
  const planning = usePlanning();
  const [added, setAdded] = useState<Set<string>>(new Set());

  const itemList = (items: BriefItem[], icon: React.ReactNode, empty: string) =>
    items.length === 0 ? (
      <p className="text-sm text-muted">{empty}</p>
    ) : (
      <ol className="space-y-2">
        {items.map((it, i) => {
          const filter = it.evidence.find((e) => e.filter)?.filter;
          return (
            <li key={i} className="flex gap-2.5">
              <span className="mt-0.5 shrink-0">{icon}</span>
              <div className="min-w-0">
                <p className="text-sm text-fg leading-relaxed">{tr(lang, it.text)}</p>
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
  const basis = brief.stage ?? undefined;
  const b = brief.revenueBaseline;
  return (
    <div className="space-y-4">
      <PlacedOnlyNote lang={lang} show={dataset.orders.length === 0 && dataset.dailyMetrics.length > 0} />
      <DolphinAsk />

      <Section
        title={vi ? 'Bản tin kinh doanh hằng ngày' : 'Daily business brief'}
        subtitle={vi ? `Chuyện gì đã xảy ra ngày ${fmtDay(day)} và hôm nay cần kiểm tra gì` : `What happened on ${fmtDay(day)} and what to check today`}
        right={
          <label className="flex items-center gap-1.5 text-sm text-muted">
            {vi ? 'Ngày' : 'Day'}
            <input
              type="date"
              value={day}
              max={asOf}
              onChange={(e) => e.target.value && setDay(e.target.value)}
              className="min-h-10 rounded-control border border-line bg-surface px-2.5 text-sm text-fg"
            />
          </label>
        }
      >
        <div className="flex items-start gap-3 rounded-control bg-primary-soft p-3">
          <img src={dolphinAvatar} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
          <div className="min-w-0">
            <p className="text-sm text-fg leading-relaxed">{tr(lang, brief.summary) || (vi ? 'Chưa có dữ liệu cho ngày này.' : 'No data for this day.')}</p>
            {brief.limitations.map((l, i) => (
              <p key={i} className="mt-1 text-sm text-warn">{tr(lang, l)}</p>
            ))}
            <p className="mt-1.5 flex items-center gap-1 text-small text-muted">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              {vi ? 'Bản tin tạo từ số liệu đã tính trên máy của bạn — không gửi dữ liệu ra ngoài, không đoán số.' : 'Built locally from computed numbers — no data sent out, nothing guessed.'}
            </p>
          </div>
        </div>

        <h3 className="mb-2 mt-5 text-sm font-semibold text-fg">{vi ? `Hôm qua (${fmtDay(day)})` : `Yesterday (${fmtDay(day)})`}</h3>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            lang={lang}
            label={vi ? 'Doanh thu' : 'Revenue'}
            metric={h.revenue.current === null ? { value: null, unit: 'vnd', status: 'missing' } : { value: h.revenue.current, unit: 'vnd', status: h.revenue.currentStatus, basis }}
            cmp={h.revenue}
            compareLabel={vi ? `so với ${fmtDay(brief.compareDay)}` : `vs ${fmtDay(brief.compareDay)}`}
            sub={
              h.revenue.current !== null && (b.avg7 !== null || b.avgPeriod !== null) ? (
                <span
                  title={[b.avg7 !== null ? `${vi ? 'TB 7 ngày' : '7-day avg'} ${fmtMoneyCompact(b.avg7, lang)}` : '', b.avgPeriod !== null ? `${vi ? 'TB cả kỳ' : 'period avg'} ${fmtMoneyCompact(b.avgPeriod, lang)}` : ''].filter(Boolean).join(' · ')}
                >
                  {vi ? 'Nền' : 'Base'} {fmtMoneyCompact(b.avg7 ?? b.avgPeriod, lang)}
                </span>
              ) : undefined
            }
          />
          <KpiCard lang={lang} label={vi ? 'Lợi nhuận ước tính' : 'Est. profit'} metric={{ value: h.profit.current, unit: 'vnd', status: h.profit.currentStatus }} cmp={h.profit} compareLabel={vi ? `so với ${fmtDay(brief.compareDay)}` : `vs ${fmtDay(brief.compareDay)}`} />
          <KpiCard lang={lang} label={vi ? 'Đơn hàng' : 'Orders'} metric={{ value: h.orders.current, unit: 'count', status: h.orders.currentStatus, basis }} cmp={h.orders} compareLabel={vi ? `so với ${fmtDay(brief.compareDay)}` : `vs ${fmtDay(brief.compareDay)}`} />
          <KpiCard lang={lang} label={vi ? 'Tỷ lệ hủy' : 'Cancel rate'} metric={{ value: h.cancelRate.current, unit: 'ratio', status: h.cancelRate.currentStatus, basis }} cmp={h.cancelRate} goodWhenUp={false} compareLabel={vi ? `so với ${fmtDay(brief.compareDay)}` : `vs ${fmtDay(brief.compareDay)}`} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-control border border-line p-4">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-up">{vi ? 'Điểm tốt' : 'Going well'}</h3>
            {itemList(brief.positives, <CheckCircle2 className="w-4 h-4 text-up" aria-hidden />, vi ? 'Chưa có điểm nổi bật.' : 'Nothing notable.')}
          </div>
          <div className="rounded-control border border-line p-4">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-warn">{vi ? 'Cần chú ý' : 'Needs attention'}</h3>
            {itemList(brief.concerns, <AlertTriangle className="w-4 h-4 text-warn" aria-hidden />, vi ? 'Không có vấn đề cần chú ý.' : 'No issues.')}
          </div>
          <div className="rounded-control border border-line p-4">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-primary">{vi ? 'Hôm nay nên kiểm tra' : 'Check today'}</h3>
            {itemList(brief.checks, <ClipboardCheck className="w-4 h-4 text-primary" aria-hidden />, vi ? 'Không có việc cần kiểm tra.' : 'Nothing to check.')}
          </div>
        </div>
        <SummaryNotes
          lang={lang}
          notes={[
            { vi: 'Các nhận định chỉ cho biết số liệu nào đi cùng nhau, không khẳng định nguyên nhân. Hãy kiểm tra danh sách đơn trước khi quyết định.', en: 'Insights show what moved together, not proven causes. Review the orders before acting.' },
            ...(h.revenue.current !== null && b.avg7 !== null && b.avgPeriod !== null
              ? [{ vi: `Mức nền doanh thu: TB 7 ngày ${fmtMoneyCompact(b.avg7, lang)} · TB cả kỳ ${fmtMoneyCompact(b.avgPeriod, lang)}.`, en: `Revenue baseline: 7-day avg ${fmtMoneyCompact(b.avg7, lang)} · period avg ${fmtMoneyCompact(b.avgPeriod, lang)}.` }]
              : []),
          ]}
        />
      </Section>

      <Section title={vi ? 'Cảnh báo thông minh' : 'Smart alerts'} subtitle={vi ? `Tính đến ngày ${fmtDay(day)}` : `As of ${fmtDay(day)}`}>
        <div className="mb-3">
          <Tabs<AlertSeverity | 'all'>
            label={vi ? 'Lọc mức độ' : 'Severity filter'}
            value={severity}
            onChange={setSeverity}
            options={FILTERS.map((f) => ({
              key: f,
              label: `${f === 'all' ? (vi ? 'Tất cả' : 'All') : tr(lang, SEVERITY_STYLE[f].label)} (${f === 'all' ? brief.alerts.length : brief.alerts.filter((a) => a.severity === f).length})`,
            }))}
          />
        </div>
        {dataset.orders.length === 0 && (
          <p className="mb-3 inline-flex rounded-control bg-info-soft px-2.5 py-1 text-small text-info">
            {vi ? 'Đang dùng báo cáo tổng hợp: cảnh báo theo doanh thu, Ads, kênh và chất lượng dữ liệu. Cảnh báo theo sản phẩm cần file xuất đơn hàng.' : 'Summary report: shop, Ads, channel and data-quality alerts. Product alerts need an order export.'}
          </p>
        )}
        {dataset.dailyMetrics.length === 0 && dataset.orders.length === 0 ? (
          <NotEnoughData lang={lang} reason={vi ? 'Chưa có dữ liệu để tạo cảnh báo.' : 'No data for alerts yet.'} />
        ) : alerts.length === 0 ? (
          <p className="text-sm text-muted">{vi ? 'Không có cảnh báo.' : 'No alerts.'}</p>
        ) : (
          <ul className="space-y-2.5">
            {alerts.map((a) => (
              <li key={a.id} className="rounded-control border border-line p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="text-sm font-semibold text-fg">{tr(lang, a.title)}</div>
                  <SeverityBadge severity={a.severity} lang={lang} />
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted">{tr(lang, a.message)}</p>
                <p className="mt-1.5 text-sm text-fg">
                  <b className="font-semibold">{vi ? 'Nên kiểm tra: ' : 'Check: '}</b>
                  {tr(lang, a.check)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {a.evidence.some((e) => e.filter) && (
                    <EvidenceButton compact lang={lang} onClick={() => openEvidence({ title: tr(lang, a.title), filter: a.evidence.find((e) => e.filter)!.filter!, evidence: a.evidence })} />
                  )}
                  {planning && (
                    <button
                      disabled={added.has(a.id)}
                      onClick={() => {
                        planning.addAction({
                          title: tr(lang, a.check),
                          insight: `${tr(lang, a.title)} — ${tr(lang, a.message)}`,
                          metric: a.type.includes('cancel') ? 'cancelRate' : a.type.includes('loss') || a.type.includes('profit') ? 'profit' : 'gmv',
                          scope: { skus: a.sku ? [a.sku] : undefined, platforms: a.platform ? [a.platform] : platforms },
                          evidence: a.evidence.find((e) => e.filter)?.filter,
                        });
                        setAdded(new Set(added).add(a.id));
                      }}
                      className="inline-flex min-h-10 items-center gap-1 rounded-control border border-line px-3 text-small font-semibold text-fg hover:bg-hover disabled:opacity-60"
                    >
                      <ListPlus className="h-4 w-4" aria-hidden />
                      {added.has(a.id) ? (vi ? 'Đã thêm vào Action Center' : 'Added') : vi ? 'Thêm vào Action Center' : 'Add to Action Center'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

    </div>
  );
};

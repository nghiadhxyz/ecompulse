import React, { useMemo } from 'react';
import { customerIntelligence, fmtCount, fmtMoneyCompact, fmtRate, formatRangeVi, PLATFORM_LABELS, RFM_SEGMENTS, segmentEvidenceRange } from '../../../analytics';
import { useWorkspace } from '../../seller/SellerContext';
import { EvidenceButton, NotEnoughData, Section, tr } from '../../seller/ui';
import { ShareBar, Th } from '../ui';

export const CustomersView: React.FC = () => {
  const { lang, dataset, baseFilter, range, platforms, openEvidence, goTo } = useWorkspace();
  const vi = lang === 'vi';
  const ci = useMemo(() => customerIntelligence(dataset, { range: baseFilter.range, platforms: baseFilter.platforms }), [dataset, baseFilter]);

  if (!ci.available) {
    return (
      <Section title={vi ? 'Khách hàng' : 'Customers'}>
        <NotEnoughData lang={lang} reason={tr(lang, ci.unavailable!)} action={<button onClick={() => goTo('dataHub')} className="text-xs underline">Data Hub</button>} />
      </Section>
    );
  }
  const k = ci.inRange;
  const maxRet = Math.max(...ci.cohorts.flatMap((c) => c.retention.filter((x): x is number => x !== null)), 0.0001);

  return (
    <div className="space-y-4">
      <Section title={vi ? 'Khách hàng' : 'Customers'} subtitle={vi ? `${formatRangeVi(range)} · mã khách ẩn danh theo sàn` : `${formatRangeVi(range)} · pseudonymous per platform`}>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
          {[
            { l: vi ? 'Khách mua' : 'Customers', v: fmtCount(k.customers, lang) },
            { l: vi ? 'Khách mới' : 'New', v: fmtCount(k.newCustomers, lang) },
            { l: vi ? 'Khách quay lại' : 'Returning', v: fmtCount(k.returningCustomers, lang) },
            { l: vi ? 'GMV từ khách quay lại' : 'GMV from returning', v: fmtRate(k.returningGmvShare, lang) },
            { l: vi ? 'Mua ≥ 2 lần trong kỳ' : '2+ orders in period', v: fmtRate(k.repeatWithinRange, lang) },
            { l: vi ? 'GMV / khách' : 'GMV / customer', v: fmtMoneyCompact(k.gmvPerCustomer, lang) },
          ].map((x) => (
            <div key={x.l} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="text-[11px] text-slate-400">{x.l}</div>
              <div className="text-lg font-black text-white">{x.v}</div>
            </div>
          ))}
        </div>
        {ci.byPlatform.length > 1 && (
          <p className="text-xs text-slate-400 mt-2">
            {vi ? 'Tỷ lệ khách quay lại theo sàn: ' : 'Returning share by platform: '}
            {ci.byPlatform.map((p) => `${PLATFORM_LABELS[p.platform]} ${fmtRate(p.returningShare, lang)} (${fmtCount(p.customers, lang)} khách)`).join(' · ')}
          </p>
        )}
      </Section>

      <Section title={vi ? 'Phân nhóm RFM' : 'RFM segments'} subtitle={vi ? 'Mức gần đây (R), số lần mua (F), giá trị mua (M) tính đến cuối kỳ, trên toàn bộ lịch sử có trong dữ liệu.' : 'Recency, frequency, monetary as of the period end.'}>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-xs">
            <thead className="bg-white/[0.04] text-slate-400">
              <tr>
                <Th left>{vi ? 'Nhóm' : 'Segment'}</Th>
                <Th>{vi ? 'Số khách' : 'Customers'}</Th>
                <Th>{vi ? 'Tỷ trọng khách' : 'Share'}</Th>
                <Th>{vi ? 'Tỷ trọng GMV' : 'GMV share'}</Th>
                <Th>{vi ? 'Số đơn TB' : 'Avg orders'}</Th>
                <Th>{vi ? 'Ngày từ lần mua cuối' : 'Days since last'}</Th>
                <Th>{''}</Th>
              </tr>
            </thead>
            <tbody>
              {ci.segments.map((s) => (
                <tr key={s.segment} className="border-t border-white/5 text-slate-200">
                  <td className="px-2.5 py-1.5">
                    <div className="font-semibold">{tr(lang, RFM_SEGMENTS[s.segment].label)}</div>
                    <div className="text-[10px] text-slate-500">{tr(lang, RFM_SEGMENTS[s.segment].hint)}</div>
                  </td>
                  <td className="px-2.5 py-1.5 text-right">{fmtCount(s.customers, lang)}</td>
                  <td className="px-2.5 py-1.5 text-right whitespace-nowrap"><div className="flex items-center justify-end gap-2">{fmtRate(s.share, lang)}<ShareBar share={s.share} /></div></td>
                  <td className="px-2.5 py-1.5 text-right whitespace-nowrap"><div className="flex items-center justify-end gap-2">{fmtRate(s.gmvShare, lang)}<ShareBar share={s.gmvShare} /></div></td>
                  <td className="px-2.5 py-1.5 text-right">{s.avgOrders.toFixed(2).replace('.', vi ? ',' : '.')}</td>
                  <td className="px-2.5 py-1.5 text-right">{Math.round(s.avgRecency)}</td>
                  <td className="px-2.5 py-1.5 text-right">
                    <EvidenceButton compact lang={lang} onClick={() => openEvidence({ title: tr(lang, RFM_SEGMENTS[s.segment].label), filter: { range: segmentEvidenceRange(dataset, range.end), platforms, customerIds: s.customerIds } })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title={vi ? 'Cohort theo tháng mua đầu tiên' : 'Monthly cohorts'} subtitle={vi ? 'Tỷ lệ khách của mỗi tháng quay lại mua ở các tháng sau.' : 'Share of each month\'s new customers ordering again later.'}>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-xs">
            <thead className="bg-white/[0.04] text-slate-400">
              <tr>
                <Th left>{vi ? 'Tháng đầu' : 'Cohort'}</Th>
                <Th>{vi ? 'Số khách' : 'Customers'}</Th>
                {Array.from({ length: Math.max(0, ...ci.cohorts.map((c) => c.retention.length)) }, (_, i) => (
                  <Th key={i}>{vi ? `Tháng +${i + 1}` : `M+${i + 1}`}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ci.cohorts.map((c) => (
                <tr key={c.cohort} className="border-t border-white/5 text-slate-200">
                  <td className="px-2.5 py-1.5">{c.cohort.slice(5)}/{c.cohort.slice(0, 4)}</td>
                  <td className="px-2.5 py-1.5 text-right">{fmtCount(c.customers, lang)}</td>
                  {c.retention.map((r, i) => (
                    <td key={i} className="px-2.5 py-1.5 text-right" style={{ background: r === null ? undefined : `rgba(57,135,229,${0.1 + 0.5 * (r / maxRet)})` }}>
                      {fmtRate(r, lang)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-3 space-y-1">
          {ci.notes.map((n, i) => (
            <li key={i} className="text-xs text-slate-400">• {tr(lang, n)}</li>
          ))}
        </ul>
      </Section>
    </div>
  );
};

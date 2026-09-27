import React, { useMemo } from 'react';
import { customerIntelligence, fmtCount, fmtMoneyCompact, fmtRate, formatRangeVi, PLATFORM_LABELS, RFM_SEGMENTS, segmentEvidenceRange } from '../../../analytics';
import { useWorkspace } from '../../seller/SellerContext';
import { EvidenceButton, NotEnoughData, Section, tr } from '../../seller/ui';
import { Button, SectionCard } from '../../ui/primitives';
import { TABLE } from '../../ui/data';
import { ShareBar, Th } from '../ui';
import { CustomerTrendPanel } from '../../workspace/SummaryInsightPanels';

export const CustomersView: React.FC = () => {
  const { lang, dataset, baseFilter, range, platforms, openEvidence, goTo } = useWorkspace();
  const vi = lang === 'vi';
  const ci = useMemo(() => customerIntelligence(dataset, { range: baseFilter.range, platforms: baseFilter.platforms }), [dataset, baseFilter]);

  if (!ci.available) {
    return (
      <div className="space-y-4">
        <CustomerTrendPanel />
        <Section title={vi ? 'Phân nhóm RFM, cohort (cần mã người mua)' : 'RFM & cohorts (need buyer IDs)'}>
          <NotEnoughData lang={lang} reason={tr(lang, ci.unavailable!)} action={<Button onClick={() => goTo('dataHub')}>Data Hub</Button>} />
        </Section>
      </div>
    );
  }
  const k = ci.inRange;
  const maxRet = Math.max(...ci.cohorts.flatMap((c) => c.retention.filter((x): x is number => x !== null)), 0.0001);

  return (
    <div className="space-y-4">
      <Section title={vi ? 'Khách hàng' : 'Customers'} subtitle={vi ? `${formatRangeVi(range)} · mã khách ẩn danh theo sàn` : `${formatRangeVi(range)} · pseudonymous per platform`}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {[
            { l: vi ? 'Khách mua' : 'Customers', v: fmtCount(k.customers, lang) },
            { l: vi ? 'Khách mới' : 'New', v: fmtCount(k.newCustomers, lang) },
            { l: vi ? 'Khách quay lại' : 'Returning', v: fmtCount(k.returningCustomers, lang) },
            { l: vi ? 'GMV từ khách quay lại' : 'GMV from returning', v: fmtRate(k.returningGmvShare, lang) },
            { l: vi ? 'Mua ≥ 2 lần trong kỳ' : '2+ orders in period', v: fmtRate(k.repeatWithinRange, lang) },
            { l: vi ? 'GMV / khách' : 'GMV / customer', v: fmtMoneyCompact(k.gmvPerCustomer, lang) },
          ].map((x) => (
            <div key={x.l} className="min-w-0 rounded-control border border-line bg-surface-2 p-3">
              <div className="truncate text-small text-muted">{x.l}</div>
              <div className="mt-0.5 text-xl font-bold tabular text-fg">{x.v}</div>
            </div>
          ))}
        </div>
        {ci.byPlatform.length > 1 && (
          <p className="mt-3 text-small text-muted">
            {vi ? 'Tỷ lệ khách quay lại theo sàn: ' : 'Returning share by platform: '}
            {ci.byPlatform.map((p) => `${PLATFORM_LABELS[p.platform]} ${fmtRate(p.returningShare, lang)} (${fmtCount(p.customers, lang)} khách)`).join(' · ')}
          </p>
        )}
      </Section>

      <Section title={vi ? 'Phân nhóm RFM' : 'RFM segments'} subtitle={vi ? 'Mức gần đây (R), số lần mua (F), giá trị mua (M) tính đến cuối kỳ, trên toàn bộ lịch sử có trong dữ liệu.' : 'Recency, frequency, monetary as of the period end.'}>
        <div className={TABLE.frame}>
          <table className={TABLE.table}>
            <thead className={TABLE.thead}>
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
                <tr key={s.segment} className={`${TABLE.tr} text-fg`}>
                  <td className="px-3 py-1.5">
                    <div className="font-medium">{tr(lang, RFM_SEGMENTS[s.segment].label)}</div>
                    <div className="text-small text-muted">{tr(lang, RFM_SEGMENTS[s.segment].hint)}</div>
                  </td>
                  <td className={`${TABLE.td} text-right`}>{fmtCount(s.customers, lang)}</td>
                  <td className={`${TABLE.td} text-right`}>
                    <div className="flex items-center justify-end gap-2">
                      {fmtRate(s.share, lang)}
                      <ShareBar share={s.share} />
                    </div>
                  </td>
                  <td className={`${TABLE.td} text-right`}>
                    <div className="flex items-center justify-end gap-2">
                      {fmtRate(s.gmvShare, lang)}
                      <ShareBar share={s.gmvShare} />
                    </div>
                  </td>
                  <td className={`${TABLE.td} text-right`}>{s.avgOrders.toFixed(2).replace('.', vi ? ',' : '.')}</td>
                  <td className={`${TABLE.td} text-right`}>{Math.round(s.avgRecency)}</td>
                  <td className={`${TABLE.td} text-right`}>
                    <EvidenceButton compact lang={lang} onClick={() => openEvidence({ title: tr(lang, RFM_SEGMENTS[s.segment].label), filter: { range: segmentEvidenceRange(dataset, range.end), platforms, customerIds: s.customerIds } })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <SectionCard
        title={vi ? 'Cohort theo tháng mua đầu tiên' : 'Monthly cohorts'}
        description={vi ? 'Tỷ lệ khách của mỗi tháng quay lại mua ở các tháng sau.' : "Share of each month's new customers ordering again later."}
        notesLabel={vi ? 'Ghi chú' : 'Notes'}
        notes={ci.notes.map((n) => tr(lang, n))}
      >
        <div className={TABLE.frame}>
          <table className={TABLE.table}>
            <thead className={TABLE.thead}>
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
                <tr key={c.cohort} className="h-11 border-t border-line text-fg">
                  <td className={TABLE.td}>
                    {c.cohort.slice(5)}/{c.cohort.slice(0, 4)}
                  </td>
                  <td className={`${TABLE.td} text-right`}>{fmtCount(c.customers, lang)}</td>
                  {c.retention.map((r, i) => (
                    // Heat cell: primary at 8–40% under dark text (contrast stays ≥ 4.5:1).
                    <td key={i} className={`${TABLE.td} text-right`} style={{ background: r === null ? undefined : `color-mix(in srgb, var(--primary) ${Math.round(8 + 32 * (r / maxRet))}%, transparent)` }}>
                      {fmtRate(r, lang)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
};

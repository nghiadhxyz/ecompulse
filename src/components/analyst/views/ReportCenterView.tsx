import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, FileText, Printer, CalendarPlus } from 'lucide-react';
import { buildReport, campaignCalendar, cellText, fmtDay, REPORT_TYPES, type ReportType } from '../../../analytics';
import { useWorkspace } from '../../seller/SellerContext';
import { GhostButton, NotEnoughData, Section } from '../../seller/ui';
import { Th } from '../ui';
import { usePlanning } from '../../workspace/usePlanning';
import { downloadCsv, downloadIcs, downloadXlsx, printReport } from '../../../utils/reportExport';
import { inputCls } from './ChangeImpactView';

export const ReportCenterView: React.FC = () => {
  const { lang, dataset, asOf, platforms, range } = useWorkspace();
  const planning = usePlanning();
  const vi = lang === 'vi';
  const [type, setType] = useState<ReportType>('weekly');
  const [day, setDay] = useState(asOf);
  const [month, setMonth] = useState(asOf.slice(0, 7));
  const campaigns = useMemo(() => campaignCalendar(dataset).filter((c) => c.range.start <= asOf).sort((a, b) => b.range.start.localeCompare(a.range.start)), [dataset, asOf]);
  const [campaignId, setCampaignId] = useState<string>('');
  const [popupBlocked, setPopupBlocked] = useState(false);
  const plan = planning?.plans.find((p) => p.month === month) ?? null;

  const report = useMemo(
    () =>
      buildReport(dataset, type, {
        asOf,
        platforms,
        day,
        month,
        campaign: campaigns.find((c) => c.campaignId === campaignId) ?? campaigns[0],
        range,
        plan: plan ?? undefined,
        actions: planning?.actions,
      }),
    [dataset, type, asOf, platforms, day, month, campaignId, campaigns, range, plan, planning?.actions],
  );

  return (
    <div className="space-y-4">
      <Section title="Report Center" subtitle={vi ? 'Báo cáo tạo trên máy từ cùng engine với các màn hình — xuất CSV, Excel, PDF.' : 'Reports built locally from the same engine as the screens.'}>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-400">
            {vi ? 'Loại báo cáo' : 'Report'}
            <select aria-label={vi ? "Loại báo cáo" : "Report"} value={type} onChange={(e) => setType(e.target.value as ReportType)} className={`mt-1 block ${inputCls}`}>
              {REPORT_TYPES.map((r) => (
                <option key={r.key} value={r.key}>{vi ? r.vi : r.en}</option>
              ))}
            </select>
          </label>
          {(type === 'daily' || type === 'weekly') && (
            <label className="text-xs text-slate-400">
              {type === 'daily' ? (vi ? 'Ngày' : 'Day') : vi ? 'Tuần kết thúc ngày' : 'Week ending'}
              <input type="date" value={day} max={asOf} onChange={(e) => e.target.value && setDay(e.target.value)} className={`mt-1 block ${inputCls}`} />
            </label>
          )}
          {(type === 'monthly' || type === 'planning') && (
            <label className="text-xs text-slate-400">
              {vi ? 'Tháng' : 'Month'}
              <input type="month" aria-label={vi ? "Tháng" : "Month"} value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className={`mt-1 block ${inputCls}`} />
            </label>
          )}
          {type === 'campaign' && (
            <label className="text-xs text-slate-400">
              {vi ? 'Chiến dịch' : 'Campaign'}
              <select value={campaignId || campaigns[0]?.campaignId || ''} onChange={(e) => setCampaignId(e.target.value)} className={`mt-1 block ${inputCls}`}>
                {campaigns.map((c) => (
                  <option key={c.campaignId} value={c.campaignId}>{c.name} ({fmtDay(c.range.start)})</option>
                ))}
              </select>
            </label>
          )}
          {type === 'live' && <p className="text-xs text-slate-400 pb-2">{vi ? 'Dùng khoảng thời gian đang chọn ở thanh lọc.' : 'Uses the selected period.'}</p>}
        </div>

        {report && (
          <div className="flex flex-wrap gap-2 mt-3">
            <GhostButton onClick={() => downloadXlsx(report)}><FileSpreadsheet className="w-4 h-4" aria-hidden /> Excel</GhostButton>
            <GhostButton onClick={() => downloadCsv(report)}><FileText className="w-4 h-4" aria-hidden /> CSV</GhostButton>
            <GhostButton onClick={() => setPopupBlocked(!printReport(report))}><Printer className="w-4 h-4" aria-hidden /> PDF ({vi ? 'in' : 'print'})</GhostButton>
            {type === 'planning' && plan && planning && (
              <GhostButton onClick={() => downloadIcs(plan, planning.actions, `EcomPulse_ke_hoach_${month}`)}><CalendarPlus className="w-4 h-4" aria-hidden /> {vi ? 'Lịch (.ics)' : 'Calendar (.ics)'}</GhostButton>
            )}
          </div>
        )}
        {popupBlocked && <p className="text-xs text-[#fab219] mt-2">{vi ? 'Trình duyệt chặn cửa sổ in — hãy cho phép popup cho trang này.' : 'Pop-up blocked — allow pop-ups for this page.'}</p>}
        <p className="text-[11px] text-slate-500 mt-2">
          {vi
            ? 'Google Sheets: mở sheets.google.com → Tệp → Nhập → tải file Excel/CSV. PDF: chọn "Lưu dưới dạng PDF" trong hộp thoại in. Không file nào được tải lên máy chủ.'
            : 'Google Sheets: File → Import the Excel/CSV. PDF: choose "Save as PDF" in the print dialog. Nothing is uploaded.'}
        </p>
      </Section>

      {!report ? (
        <NotEnoughData
          lang={lang}
          reason={
            type === 'planning'
              ? vi ? 'Chưa có kế hoạch cho tháng này — tạo ở Monthly Planning.' : 'No plan for this month.'
              : type === 'live'
                ? vi ? 'Không có phiên live trong khoảng đang chọn.' : 'No live sessions in range.'
                : vi ? 'Không đủ dữ liệu cho báo cáo này.' : 'Not enough data.'
          }
        />
      ) : (
        <Section title={report.title} subtitle={`${report.period} · ${report.generatedFrom}`}>
          <ul className="list-disc pl-4 space-y-0.5 text-sm text-slate-200">
            {report.summary.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          <div className="space-y-4 mt-4">
            {report.tables.map((tb) => (
              <div key={tb.title}>
                <h3 className="text-xs font-bold text-slate-300 mb-1.5">{tb.title}</h3>
                {tb.rows.length === 0 ? (
                  <p className="text-xs text-slate-500">{vi ? 'Không có dòng nào.' : 'No rows.'}</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-white/10 max-h-96">
                    <table className="w-full text-xs">
                      <thead className="bg-white/[0.04] text-slate-400 sticky top-0">
                        <tr>{tb.columns.map((c, i) => <Th key={i} left={i === 0}>{c}</Th>)}</tr>
                      </thead>
                      <tbody>
                        {tb.rows.map((row, ri) => (
                          <tr key={ri} className="border-t border-white/5 text-slate-200">
                            {row.map((c, ci) => (
                              <td key={ci} className={`px-2.5 py-1.5 whitespace-nowrap ${'t' in c ? '' : 'text-right'}`}>{cellText(c, lang)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {tb.notes?.map((x, i) => <p key={i} className="text-[11px] text-slate-500 mt-1">{x}</p>)}
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
};

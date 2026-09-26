import type { SheetReadInfo } from '../../../analytics/importers/shopeeSalesAnalysis';
import React, { useRef, useState } from 'react';
import { UploadCloud, FileSpreadsheet, X, Loader2, ShieldCheck, Trash2, PlayCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { formatRangeVi, PLATFORM_LABELS, REPORT_KIND_LABELS, type CanonicalDataset, type Lang } from '../../../analytics';
import { DataQualityPanel } from '../../data/DataQualityPanel';
import { startImport, type ImportHandle, type ImportOutcome } from '../importClient';
import { GhostButton, PrimaryButton, Section } from '../ui';

export interface ImportLogEntry {
  fileName: string;
  outcome: ImportOutcome | { type: 'cancelled' } | { type: 'legacy_summary'; ok: boolean; message?: string; sheets?: SheetReadInfo[]; period?: { start: string; end: string } | null };
}

interface DataViewProps {
  lang: Lang;
  dataset: CanonicalDataset | null;
  sourceKind: 'demo' | 'imported' | 'legacy' | null;
  /** Applies a finished import to the workspace. */
  onOutcome: (file: File, outcome: ImportOutcome) => Promise<ImportLogEntry['outcome']>;
  onLoadDemo: () => void;
  onClear: () => void;
  persisted: boolean;
}

const STAGE: Record<string, { vi: string; en: string }> = {
  reading: { vi: 'Đang đọc file', en: 'Reading file' },
  parsing: { vi: 'Đang giải mã Excel', en: 'Decoding Excel' },
  mapping: { vi: 'Đang chuẩn hóa đơn hàng', en: 'Mapping orders' },
};

export const DataView: React.FC<DataViewProps> = ({ lang, dataset, sourceKind, onOutcome, onLoadDemo, onClear, persisted }) => {
  const vi = lang === 'vi';
  const inputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<{ name: string; stage: string; fraction: number } | null>(null);
  const [log, setLog] = useState<ImportLogEntry[]>([]);
  const [dragging, setDragging] = useState(false);
  const handleRef = useRef<ImportHandle | null>(null);
  const cancelledRef = useRef(false);

  const runFiles = async (files: FileList | File[]) => {
    cancelledRef.current = false;
    for (const file of Array.from(files)) {
      if (cancelledRef.current) break;
      setQueue({ name: file.name, stage: 'reading', fraction: 0 });
      const handle = startImport(file, (stage, fraction) => setQueue({ name: file.name, stage, fraction }));
      handleRef.current = handle;
      const outcome = await handle.result;
      const applied = outcome.type === 'cancelled' || outcome.type === 'error' ? outcome : await onOutcome(file, outcome);
      setLog((l) => [{ fileName: file.name, outcome: applied }, ...l]);
    }
    handleRef.current = null;
    setQueue(null);
  };

  const cancel = () => {
    cancelledRef.current = true;
    handleRef.current?.cancel();
  };

  return (
    <div className="space-y-4">
      <Section
        title={vi ? 'Nhập dữ liệu' : 'Import data'}
        subtitle={vi ? 'File được xử lý ngay trên trình duyệt của bạn — không tải lên máy chủ EcomPulse.' : 'Files are processed in your browser — never uploaded to EcomPulse servers.'}
      >
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!queue && e.dataTransfer.files.length) runFiles(e.dataTransfer.files);
          }}
          className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${dragging ? 'border-sky-400 bg-sky-500/10' : 'border-white/15 bg-white/[0.02]'}`}
        >
          {queue ? (
            <div className="max-w-md mx-auto" aria-live="polite">
              <div className="flex items-center justify-center gap-2 text-sm text-slate-200">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                <span className="truncate">{STAGE[queue.stage]?.[lang] ?? queue.stage}: {queue.name}</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 mt-3 overflow-hidden" role="progressbar" aria-valuenow={Math.round(queue.fraction * 100)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-2 bg-sky-500 transition-all" style={{ width: `${Math.round(queue.fraction * 100)}%` }} />
              </div>
              <GhostButton className="mt-3 !text-xs" onClick={cancel}>
                <X className="w-3.5 h-3.5" /> {vi ? 'Hủy nhập' : 'Cancel import'}
              </GhostButton>
            </div>
          ) : (
            <>
              <UploadCloud className="w-8 h-8 mx-auto text-sky-300" aria-hidden />
              <p className="text-sm font-bold text-white mt-2">{vi ? 'Kéo thả file vào đây hoặc chọn file' : 'Drop files here or choose files'}</p>
              <p className="text-xs text-slate-400 mt-1 max-w-lg mx-auto">
                {vi
                  ? 'Hỗ trợ (Shopee, TikTok Shop, Lazada · .xlsx/.csv): file xuất đơn hàng · báo cáo Quảng cáo · Livestream · Hiệu quả sản phẩm (traffic) · Affiliate/Video · Phân tích bán hàng Shopee · danh mục sản phẩm (SKU + Ngành hàng / Nhóm hàng / Giá vốn). Có thể chọn nhiều file cùng lúc.'
                  : 'Supported (Shopee, TikTok Shop, Lazada · .xlsx/.csv): orders, ads, live, product traffic, affiliate/video, Shopee sales analysis, product catalog (SKU + category / niche / COGS). Multiple files allowed.'}
              </p>
              <PrimaryButton className="mt-3" onClick={() => inputRef.current?.click()}>
                <FileSpreadsheet className="w-4 h-4" /> {vi ? 'Chọn file' : 'Choose files'}
              </PrimaryButton>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) runFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </>
          )}
        </div>

        {log.length > 0 && (
          <ul className="mt-4 space-y-2">
            {log.map((entry, i) => (
              <ImportResultCard key={`${entry.fileName}-${i}`} entry={entry} lang={lang} />
            ))}
          </ul>
        )}
      </Section>

      <Section
        title={vi ? 'Dữ liệu đang dùng' : 'Current data'}
        right={
          <div className="flex flex-wrap gap-2">
            <GhostButton className="!text-xs" onClick={onLoadDemo}>
              <PlayCircle className="w-3.5 h-3.5" /> {vi ? 'Dùng dữ liệu demo 3 tháng' : 'Use 3-month demo'}
            </GhostButton>
            {sourceKind && sourceKind !== 'legacy' && (
              <GhostButton
                className="!text-xs !text-rose-300"
                onClick={() => {
                  if (window.confirm(vi ? 'Xóa toàn bộ dữ liệu đã nhập khỏi trình duyệt này? Không thể hoàn tác.' : 'Remove all imported data from this browser? This cannot be undone.')) onClear();
                }}
              >
                <Trash2 className="w-3.5 h-3.5" /> {vi ? 'Xóa dữ liệu' : 'Clear data'}
              </GhostButton>
            )}
          </div>
        }
      >
        {!dataset ? (
          <p className="text-sm text-slate-400">{vi ? 'Chưa có dữ liệu. Nhập file hoặc dùng dữ liệu demo.' : 'No data yet. Import files or use the demo.'}</p>
        ) : (
          <>
            <p className="text-xs text-slate-300 mb-2">
              {sourceKind === 'demo'
                ? vi ? 'Đang xem dữ liệu demo (shop mẫu, không phải dữ liệu thật).' : 'Viewing demo data (sample shop).'
                : sourceKind === 'legacy'
                  ? vi ? 'Đang dùng báo cáo đã tải ở màn hình cũ (chỉ đọc).' : 'Using the report loaded in the classic view (read-only).'
                  : persisted
                    ? vi ? 'Dữ liệu được lưu trên trình duyệt này (IndexedDB).' : 'Data is stored in this browser (IndexedDB).'
                    : vi ? 'Trình duyệt không cho lưu — dữ liệu sẽ mất khi tải lại trang.' : 'Browser storage unavailable — data is lost on reload.'}
            </p>
            <ul className="space-y-1.5">
              {dataset.sources.map((s, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 text-xs text-slate-300 rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" aria-hidden />
                  <span className="font-semibold text-white truncate max-w-[260px]">{s.fileName}</span>
                  <span className="text-slate-500">{s.platform !== 'other' ? PLATFORM_LABELS[s.platform] : ''}</span>
                  {s.rowCount !== undefined && <span className="text-slate-500">{s.rowCount.toLocaleString('vi-VN')} {vi ? 'dòng' : 'rows'}</span>}
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <DataQualityPanel dataset={dataset} language={lang} />
            </div>
          </>
        )}
      </Section>
    </div>
  );
};

const SHEET_KIND_LABELS: Record<SheetReadInfo['kind'], { vi: string; en: string }> = {
  daily_shop: { vi: 'số liệu shop theo ngày', en: 'daily shop totals' },
  sources_period: { vi: 'doanh thu theo kênh & nguồn (cả kỳ) + chi phí Ads', en: 'channels & sources (period) + ad spend' },
  sources_daily: { vi: 'kênh & nguồn theo ngày + Ads theo ngày', en: 'channels & sources by day + daily ads' },
  products: { vi: 'sản phẩm đứng đầu mỗi kênh', en: 'top products per channel' },
  live: { vi: 'phiên livestream', en: 'live sessions' },
  video: { vi: 'video của shop', en: 'shop videos' },
  affiliate: { vi: 'đối tác affiliate', en: 'affiliates' },
  skipped: { vi: 'chưa nhận dạng', en: 'not recognised' },
};

const STAGE_LABELS = { placed: { vi: 'đơn đã đặt', en: 'placed' }, confirmed: { vi: 'đơn đã xác nhận', en: 'confirmed' }, paid: { vi: 'đơn đã thanh toán', en: 'paid' } };

const ImportResultCard: React.FC<{ entry: ImportLogEntry; lang: Lang }> = ({ entry, lang }) => {
  const vi = lang === 'vi';
  const o = entry.outcome;
  if (o.type === 'cancelled') {
    return <li className="text-xs text-slate-400 rounded-lg border border-white/10 px-3 py-2">{entry.fileName}: {vi ? 'đã hủy' : 'cancelled'}</li>;
  }
  if (o.type === 'error') {
    return (
      <li className="rounded-lg border border-[#d03b3b]/40 bg-[#d03b3b]/10 px-3 py-2 text-xs text-rose-100 flex gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 text-[#f08080]" aria-hidden />
        <span><b>{entry.fileName}</b>: {o.message[lang]}</span>
      </li>
    );
  }
  if (o.type === 'legacy_summary') {
    if (!o.ok) {
      return (
        <li className="rounded-lg border border-[#d03b3b]/40 px-3 py-2 text-xs text-rose-100">
          <b>{entry.fileName}</b>: {o.message}
        </li>
      );
    }
    const read = (o.sheets ?? []).filter((x) => x.kind !== 'skipped');
    const skipped = (o.sheets ?? []).filter((x) => x.kind === 'skipped');
    return (
      <li className="rounded-lg border border-[#0ca30c]/30 bg-[#0ca30c]/[0.06] px-3 py-2.5 text-xs text-slate-200">
        <div className="flex flex-wrap items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#4ade80]" aria-hidden />
          <b className="text-white">{entry.fileName}</b>
          <span>· {vi ? 'Shopee · Phân tích bán hàng' : 'Shopee · Sales analysis'}</span>
          {o.period && <span>· {formatRangeVi(o.period)}</span>}
          {o.sheets && <span>· {vi ? `đọc ${read.length}/${o.sheets.length} sheet` : `${read.length}/${o.sheets.length} sheets read`}</span>}
        </div>
        <p className="text-slate-400 mt-1">
          {vi
            ? 'Báo cáo tổng hợp: có số theo ngày, theo kênh/nguồn, Ads, sản phẩm đứng đầu, live, video, affiliate — không có chi tiết từng đơn nên chưa tính được lợi nhuận theo đơn.'
            : 'Summary report: daily, channel/source, ads, top products, live, video, affiliate — no order lines, so no per-order profit.'}
        </p>
        {o.sheets && (
          <details className="mt-1.5">
            <summary className="cursor-pointer text-sky-300">{vi ? 'Xem từng sheet' : 'Sheets'}</summary>
            <ul className="mt-1 space-y-0.5 text-slate-400">
              {o.sheets.map((x, i) => (
                <li key={i}>
                  {x.kind === 'skipped' ? '○' : '✓'} <span className="text-slate-300">{x.name}</span> — {SHEET_KIND_LABELS[x.kind][lang]}
                  {x.stage ? ` · ${STAGE_LABELS[x.stage][lang]}` : ''}
                  {x.kind !== 'skipped' ? ` · ${x.rows.toLocaleString('vi-VN')} ${vi ? 'dòng' : 'rows'}` : ''}
                </li>
              ))}
            </ul>
          </details>
        )}
        {skipped.length > 0 && <p className="text-[#fab219] mt-1">{vi ? `${skipped.length} sheet chưa nhận dạng được.` : `${skipped.length} sheets not recognised.`}</p>}
      </li>
    );
  }
  if (o.type === 'shopee_summary') return null;
  if (o.type === 'report') {
    const r = o.result;
    const ok = r.stats.imported > 0;
    return (
      <li className={`rounded-lg border px-3 py-2.5 text-xs text-slate-200 ${ok ? 'border-[#0ca30c]/30 bg-[#0ca30c]/[0.06]' : 'border-[#fab219]/40 bg-[#fab219]/10'}`}>
        <div className="flex flex-wrap items-center gap-1.5">
          {ok ? <CheckCircle2 className="w-3.5 h-3.5 text-[#4ade80]" aria-hidden /> : <AlertTriangle className="w-3.5 h-3.5 text-[#fab219]" aria-hidden />}
          <b className="text-white">{entry.fileName}</b>
          <span>· {REPORT_KIND_LABELS[r.kind][lang]} · {r.label}</span>
          <span>· {r.stats.imported.toLocaleString('vi-VN')} {vi ? 'dòng đã nhập' : 'rows imported'}</span>
          {r.period && <span>· {formatRangeVi(r.period)}</span>}
          {r.catalog && (
            <span>· {vi ? `${r.catalog.withCategory} SKU có ngành hàng, ${r.catalog.withCogs} SKU có giá vốn` : `${r.catalog.withCategory} with category, ${r.catalog.withCogs} with COGS`}</span>
          )}
        </div>
        {r.warnings.map((w, i) => (
          <p key={i} className="text-[#fab219] mt-1">• {w[lang]}</p>
        ))}
        <details className="mt-1.5">
          <summary className="cursor-pointer text-sky-300">{vi ? 'Xem cách ánh xạ cột' : 'Column mapping'}</summary>
          <ul className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 text-slate-400">
            {Object.entries(r.columnsUsed).map(([field, header]) => (
              <li key={field}><span className="text-slate-500">{field}</span> ← {header}</li>
            ))}
          </ul>
        </details>
      </li>
    );
  }
  const r = o.result;
  return (
    <li className="rounded-lg border border-[#0ca30c]/30 bg-[#0ca30c]/[0.06] px-3 py-2.5 text-xs text-slate-200">
      <div className="flex flex-wrap items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5 text-[#4ade80]" aria-hidden />
        <b className="text-white">{entry.fileName}</b>
        <span>· {r.platformLabel}</span>
        <span>· {r.stats.orders.toLocaleString('vi-VN')} {vi ? 'đơn' : 'orders'}, {r.stats.importedLines.toLocaleString('vi-VN')} {vi ? 'dòng sản phẩm' : 'lines'}</span>
        {r.coverage && <span>· {formatRangeVi(r.coverage)}</span>}
      </div>
      {r.warnings.map((w, i) => (
        <p key={i} className="text-[#fab219] mt-1">• {w[lang]}</p>
      ))}
      <details className="mt-1.5">
        <summary className="cursor-pointer text-sky-300">{vi ? 'Xem cách ánh xạ cột' : 'Column mapping'}</summary>
        <ul className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 text-slate-400">
          {Object.entries(r.columnsUsed).map(([field, header]) => (
            <li key={field}><span className="text-slate-500">{field}</span> ← {header}</li>
          ))}
        </ul>
        {r.ignoredPersonalColumns.length > 0 && (
          <p className="mt-1.5 text-slate-400 flex items-start gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-[#4ade80] shrink-0" aria-hidden />
            {vi ? 'Không đọc các cột thông tin cá nhân: ' : 'Personal columns not read: '}
            {r.ignoredPersonalColumns.join(', ')}. {vi ? 'Mã người mua được mã hóa một chiều trên máy.' : 'Buyer IDs are hashed locally.'}
          </p>
        )}
      </details>
    </li>
  );
};

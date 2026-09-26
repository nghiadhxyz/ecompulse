import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Link,
  ExternalLink,
  Check,
  Copy,
  Download,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  X,
  PlusCircle,
  Trash2,
  Zap,
  ChevronDown,
  ChevronUp,
  FolderOpen,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { GoogleSheetsSyncConfig, RoadmapActionItem, ActionCard } from '../../types';
import {
  autoGenerateAndOpenGoogleSheet,
  linkGoogleSheetByUrl,
  clearSheetsConfig,
  fetchTasksFromGoogleSheet,
  pushTasksToAppsScriptWebhook,
  generateRoadmapTsvData,
  generateActionCardsTsvData,
  downloadRoadmapExcelFile,
} from '../../utils/googleSheetsService';

interface GoogleSheetsActionSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GoogleSheetsSyncConfig | null;
  onConfigChange?: (config: GoogleSheetsSyncConfig | null) => void;
  onImportTasks?: (importedTasks: RoadmapActionItem[]) => void;
  roadmapTasks?: RoadmapActionItem[];
  actionCards?: ActionCard[];
  storeName?: string;
  language?: 'vi' | 'en';
}

export const GoogleSheetsActionSyncModal: React.FC<GoogleSheetsActionSyncModalProps> = ({
  isOpen,
  onClose,
  config,
  onConfigChange,
  onImportTasks,
  roadmapTasks = [],
  actionCards = [],
  storeName = 'Shop TMĐT',
  language = 'vi',
}) => {
  const [sheetUrlInput, setSheetUrlInput] = useState<string>('');
  const [customTitleInput, setCustomTitleInput] = useState<string>('');
  const [copiedType, setCopiedType] = useState<'roadmap' | 'cards' | 'link' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isFetchingFromSheet, setIsFetchingFromSheet] = useState<boolean>(false);
  const [isAutoGenerating, setIsAutoGenerating] = useState<boolean>(false);
  const [showAdvancedLink, setShowAdvancedLink] = useState<boolean>(false);

  useEffect(() => {
    if (config?.spreadsheetUrl) {
      setSheetUrlInput(config.spreadsheetUrl);
      setCustomTitleInput(config.spreadsheetTitle || '');
    } else {
      setSheetUrlInput('');
      setCustomTitleInput('');
    }
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [config, isOpen]);

  if (!isOpen) return null;

  // 1-Click Instant Action: Download Excel + Open Google Sheets + Copy Table
  const handleInstantExport = () => {
    setIsAutoGenerating(true);
    setErrorMsg(null);
    try {
      const newConfig = autoGenerateAndOpenGoogleSheet(roadmapTasks, actionCards, storeName);
      if (onConfigChange) {
        onConfigChange(newConfig);
      }
      setSuccessMsg(
        `🎉 Đã xuất thành công toàn bộ ${roadmapTasks.length} việc cần làm! File Excel (.xlsx) đã tải về máy và sẵn sàng trên Google Sheet.`
      );
      try {
        confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
      } catch (_) {}
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể xuất dữ liệu sang Google Sheet.');
    } finally {
      setTimeout(() => setIsAutoGenerating(false), 500);
    }
  };

  const handleDownloadExcelOnly = () => {
    try {
      downloadRoadmapExcelFile(roadmapTasks, actionCards, storeName);
      setSuccessMsg(`✅ Đã tải file Excel (.xlsx) bảng phân công ${roadmapTasks.length} việc thành công!`);
      try {
        confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });
      } catch (_) {}
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi tải file Excel.');
    }
  };

  const handleCopyRoadmapTsv = () => {
    const tsv = generateRoadmapTsvData(roadmapTasks);
    navigator.clipboard.writeText(tsv);
    setCopiedType('roadmap');
    setSuccessMsg('✅ Đã sao chép bảng phân công vào Clipboard!');
    setTimeout(() => setCopiedType(null), 2500);
  };

  const handleSaveSheetLink = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const rawUrl = sheetUrlInput.trim();
    if (!rawUrl) {
      setErrorMsg('Vui lòng dán link Google Sheet của bạn!');
      return;
    }

    try {
      const newConfig = linkGoogleSheetByUrl(
        rawUrl,
        customTitleInput.trim() || 'Bảng Phân Công Công Việc EcomPulse'
      );
      if (onConfigChange) {
        onConfigChange(newConfig);
      }

      setIsFetchingFromSheet(true);
      const fetchRes = await fetchTasksFromGoogleSheet(rawUrl);
      setIsFetchingFromSheet(false);

      if (fetchRes.success && fetchRes.tasks.length > 0) {
        if (onImportTasks) {
          onImportTasks(fetchRes.tasks);
        }
        setSuccessMsg(`✅ Đã đồng bộ ${fetchRes.tasks.length} đầu việc từ Google Sheet!`);
      } else {
        setSuccessMsg('✅ Đã lưu liên kết Google Sheet thành công!');
      }
    } catch (err: any) {
      setIsFetchingFromSheet(false);
      setErrorMsg(err.message || 'Không thể xử lý liên kết Google Sheet.');
    }
  };

  const handleUnlink = () => {
    clearSheetsConfig();
    if (onConfigChange) {
      onConfigChange(null);
    }
    setSheetUrlInput('');
    setCustomTitleInput('');
    setSuccessMsg('Đã hủy liên kết Google Sheet.');
    setTimeout(() => setSuccessMsg(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-gradient-to-b from-slate-900/98 via-slate-900 to-slate-950 border border-emerald-500/40 rounded-3xl shadow-2xl shadow-emerald-500/15 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-950/50 via-slate-900 to-slate-900 border-b border-emerald-500/20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-black text-white tracking-tight">
                  {language === 'vi' ? 'Xuất Việc Cần Làm Sang Google Sheets' : 'Export To-Do to Google Sheets'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-slate-950 shadow-sm">
                  1-CLICK
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {language === 'vi'
                  ? 'Xuất nhanh lộ trình hành động & phân công công việc'
                  : 'Fast export of action items & team assignments'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl text-xs flex items-start space-x-2.5 border bg-rose-950/40 border-rose-500/40 text-rose-300 backdrop-blur-md">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span className="font-semibold">{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-2xl text-xs flex items-center space-x-2.5 border bg-emerald-950/40 border-emerald-500/40 text-emerald-300 backdrop-blur-md">
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* MAIN 1-CLICK HERO ACTION */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-950/70 via-slate-900 to-teal-950/50 border-2 border-emerald-400/50 shadow-2xl shadow-emerald-950/40 space-y-4 text-center">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                ⚡ {language === 'vi' ? 'THAO TÁC 1-CLICK TỨC THÌ' : 'INSTANT 1-CLICK EXPORT'}
              </span>
              <h4 className="text-lg font-black text-white">
                {language === 'vi'
                  ? `Xuất Ngay Toàn Bộ ${roadmapTasks.length} Việc Cần Làm`
                  : `Export All ${roadmapTasks.length} Tasks to Google Sheets`}
              </h4>
              <p className="text-xs text-slate-300 max-w-md mx-auto">
                {language === 'vi'
                  ? 'Hệ thống tự động tải file Excel phân công (.xlsx) và mở trang tính Google Sheets mới để bạn bắt đầu làm việc ngay.'
                  : 'Automatically downloads the formatted Excel (.xlsx) file and opens Google Sheets in a new tab.'}
              </p>
            </div>

            {/* BIG 1-CLICK BUTTON */}
            <button
              type="button"
              onClick={handleInstantExport}
              disabled={isAutoGenerating}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-sm font-black transition-all shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
            >
              <Zap className={`w-5 h-5 text-slate-950 ${isAutoGenerating ? 'animate-spin' : 'fill-slate-950'}`} />
              <span>
                {isAutoGenerating
                  ? language === 'vi'
                    ? 'Đang xuất Google Sheet...'
                    : 'Exporting Google Sheet...'
                  : language === 'vi'
                  ? `BẤM ĐỂ XUẤT SANG GOOGLE SHEETS NGAY (${roadmapTasks.length} việc)`
                  : `EXPORT TO GOOGLE SHEETS NOW (${roadmapTasks.length} tasks)`}
              </span>
              <ExternalLink className="w-4 h-4 text-slate-950" />
            </button>
          </div>

          {/* SECONDARY QUICK ACTIONS (Direct Excel Download & Clipboard Copy) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={handleDownloadExcelOnly}
              className="p-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/12 text-left transition-all flex items-center gap-3 group"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <Download className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-white leading-tight">
                  {language === 'vi' ? 'Tải File Excel (.XLSX)' : 'Download Excel (.XLSX)'}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {language === 'vi' ? 'Chuẩn bảng phân công' : 'Formatted task table'}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={handleCopyRoadmapTsv}
              className="p-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/12 text-left transition-all flex items-center gap-3 group"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                {copiedType === 'roadmap' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-white leading-tight">
                  {copiedType === 'roadmap'
                    ? language === 'vi'
                      ? 'Đã sao chép!'
                      : 'Copied!'
                    : language === 'vi'
                    ? 'Sao Chép Bảng Dữ Liệu'
                    : 'Copy Table Data'}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {language === 'vi' ? 'Dán nhanh (Ctrl + V)' : 'Paste into Sheet (Ctrl+V)'}
                </p>
              </div>
            </button>
          </div>

          {/* COLLAPSIBLE ADVANCED OPTION: Link existing Google Sheet */}
          <div className="pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={() => setShowAdvancedLink(!showAdvancedLink)}
              className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-white py-1 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Link className="w-3.5 h-3.5 text-cyan-400" />
                <span>
                  {language === 'vi'
                    ? 'Tùy chọn nâng cao: Dán link Google Sheet có sẵn (Tùy chọn)'
                    : 'Advanced: Link existing Google Sheet URL'}
                </span>
              </span>
              {showAdvancedLink ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showAdvancedLink && (
              <form
                onSubmit={handleSaveSheetLink}
                className="mt-3 p-4 rounded-2xl bg-slate-950/70 border border-white/10 space-y-3 animate-fadeIn"
              >
                <div className="space-y-2">
                  <input
                    type="text"
                    value={sheetUrlInput}
                    onChange={(e) => setSheetUrlInput(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/1a2b3c4d5e.../edit"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-white/20 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <input
                    type="text"
                    value={customTitleInput}
                    onChange={(e) => setCustomTitleInput(e.target.value)}
                    placeholder={language === 'vi' ? 'Tên gợi nhớ cho bảng tính...' : 'Custom title for spreadsheet...'}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  {config && (
                    <button
                      type="button"
                      onClick={handleUnlink}
                      className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{language === 'vi' ? 'Hủy liên kết' : 'Unlink'}</span>
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isFetchingFromSheet}
                    className="ml-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-all shadow-md flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{language === 'vi' ? 'Lưu Liên Kết' : 'Save Link'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950/80 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-1.5 text-[11px] text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span>{language === 'vi' ? 'Bảo mật On-Premise 100%' : '100% On-Premise Privacy'}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-all"
          >
            {language === 'vi' ? 'Đóng' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

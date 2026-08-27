import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Link,
  ExternalLink,
  Check,
  Copy,
  RefreshCw,
  Sparkles,
  Users,
  ShieldCheck,
  AlertCircle,
  X,
  PlusCircle,
} from 'lucide-react';
import { GoogleSheetsSyncConfig } from '../../types';

interface GoogleSheetsActionSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GoogleSheetsSyncConfig | null;
  onConnectNew: () => Promise<void>;
  onLinkExisting: (spreadsheetIdOrUrl: string) => Promise<void>;
  isLoading: boolean;
  error?: string | null;
}

export const GoogleSheetsActionSyncModal: React.FC<GoogleSheetsActionSyncModalProps> = ({
  isOpen,
  onClose,
  config,
  onConnectNew,
  onLinkExisting,
  isLoading,
  error,
}) => {
  const [existingInput, setExistingInput] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [mode, setMode] = useState<'create' | 'existing'>('create');

  if (!isOpen) return null;

  const handleCopyLink = () => {
    if (config?.spreadsheetUrl) {
      navigator.clipboard.writeText(config.spreadsheetUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!existingInput.trim()) return;
    await onLinkExisting(existingInput.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-2xl glass-panel p-6 border border-white/20 shadow-2xl bg-gradient-to-b from-slate-900/95 to-slate-950/95 text-white">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3 mb-5">
          <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-500/10">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Đồng Bộ Kế Hoạch Với Google Sheets
            </h3>
            <p className="text-xs text-slate-300">
              Liên kết trực tiếp để toàn bộ nhóm bán hàng cùng cập nhật tiến độ
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Existing Connection Info */}
        {config ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> Đã kết nối Google Sheets thành công
                </span>
                <span className="text-[11px] text-slate-400">
                  Lần cuối: {config.lastSyncedAt || 'Vừa xong'}
                </span>
              </div>
              <div className="text-sm font-bold text-white truncate">
                {config.spreadsheetTitle}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <a
                  href={config.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-colors shadow-md shadow-emerald-500/20"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Mở trang tính
                </a>
                <button
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold transition-colors border border-white/10"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" /> Đã copy link
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-300" /> Copy link chia sẻ
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="text-xs text-slate-300 space-y-1.5 bg-white/[0.03] p-3 rounded-xl border border-white/[0.06]">
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-sky-400" /> Cách nhóm bán hàng phối hợp:
              </div>
              <p>1. Copy link Google Sheet và chia sẻ quyền chỉnh sửa cho thành viên trong team.</p>
              <p>2. Mọi thay đổi checklist hoặc phân công trên EcomPulse sẽ lập tức cập nhật sang Sheet.</p>
              <p>3. Các thành viên có thể thêm ghi chú trực tiếp trên ứng dụng hoặc trên file Excel Google.</p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={onConnectNew}
                disabled={isLoading}
                className="text-xs text-slate-400 hover:text-amber-300 flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                Tạo lại trang tính mới
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-white/[0.05] rounded-xl border border-white/[0.08]">
              <button
                type="button"
                onClick={() => setMode('create')}
                className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  mode === 'create'
                    ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5" /> Tạo Trang Tính Mới
              </button>
              <button
                type="button"
                onClick={() => setMode('existing')}
                className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  mode === 'existing'
                    ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Link className="w-3.5 h-3.5" /> Nhập Link Có Sẵn
              </button>
            </div>

            {mode === 'create' ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 space-y-2">
                  <div className="text-xs font-semibold text-slate-200">
                    Tự động tạo Google Spreadsheet trực tuyến chuẩn hóa gồm 3 trang tính (Sheets):
                  </div>
                  <ul className="text-xs text-slate-300 space-y-1.5 pl-4 list-disc marker:text-emerald-400">
                    <li>Sheet 1: <strong className="text-white">🚀 Lộ Trình Hành Động Doanh Nghiệp</strong> (Toàn bộ 10 hành động chiến lược 0–2 tuần, 2–6 tuần, 1–3 tháng, mục tiêu KPI, bộ phận và trạng thái).</li>
                    <li>Sheet 2: <strong className="text-white">🎯 Trung Tâm Hành Động Ưu Tiên</strong> (Checklist chi tiết từng đầu việc, mức độ khẩn cấp, doanh thu cứu trợ ước tính & người phụ trách).</li>
                    <li>Sheet 3: <strong className="text-white">📊 Tóm Tắt & Chỉ Số Shop</strong> (Báo cáo doanh thu thực, thất thoát dòng tiền, AOV, tỷ lệ chuyển đổi, ROAS).</li>
                    <li>Tự động định dạng màu sắc theo mức ưu tiên, cố định dòng tiêu đề và đồng bộ real-time.</li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={onConnectNew}
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Đang kết nối & tạo Google Sheet...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-4 h-4" />
                      Tạo & Kết Nối Google Sheets Ngay
                    </>
                  )}
                </button>
              </div>
            ) : (
              <form onSubmit={handleLinkSubmit} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">
                    Nhập Spreadsheet ID hoặc Link Google Sheet:
                  </label>
                  <input
                    type="text"
                    value={existingInput}
                    onChange={(e) => setExistingInput(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/1a2b3c.../edit"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/20 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                  />
                  <p className="text-[11px] text-slate-400">
                    * Đảm bảo tài khoản Google đã được cấp quyền chỉnh sửa file này.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !existingInput.trim()}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Đang liên kết...
                    </>
                  ) : (
                    <>
                      <Link className="w-4 h-4" />
                      Xác Nhận Liên Kết Google Sheet
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

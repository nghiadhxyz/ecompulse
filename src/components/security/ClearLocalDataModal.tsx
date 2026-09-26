import React, { useState } from 'react';
import { Trash2, AlertTriangle, ShieldCheck, Check, X, RefreshCw, Database } from 'lucide-react';
import { wipeAllLocalData } from '../../utils/localDatabaseService';

interface ClearLocalDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCleared: () => void;
  language?: 'vi' | 'en';
}

export const ClearLocalDataModal: React.FC<ClearLocalDataModalProps> = ({
  isOpen,
  onClose,
  onCleared,
  language = 'vi',
}) => {
  const [isWiping, setIsWiping] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleConfirmWipe = async () => {
    setIsWiping(true);
    try {
      await wipeAllLocalData();
      setIsWiping(false);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onCleared();
        onClose();
      }, 1200);
    } catch (e) {
      setIsWiping(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xl animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900/98 border border-rose-500/40 rounded-3xl shadow-2xl shadow-rose-950/40 overflow-hidden flex flex-col p-6 space-y-5 text-left">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-rose-500/20 border border-rose-400/40 text-rose-400 flex items-center justify-center shadow-lg shadow-rose-500/20">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">
                {language === 'vi'
                  ? 'Xóa Sạch Dữ Liệu Local (1-Click)'
                  : 'Clear All Local Data (1-Click)'}
              </h3>
              <p className="text-xs text-rose-300/90 font-medium">
                {language === 'vi'
                  ? 'Bảo vệ quyền riêng tư tuyệt đối (Zero-Trace On-Premise)'
                  : 'Absolute Zero-Trace Privacy Protection'}
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

        {isSuccess ? (
          <div className="p-8 text-center space-y-3 bg-emerald-950/30 border border-emerald-500/30 rounded-2xl animate-fadeIn">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
              <Check className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-white">
              {language === 'vi'
                ? 'Đã Xóa Trắng 100% Dữ Liệu Trên Máy!'
                : '100% Local Data Successfully Cleared!'}
            </h4>
            <p className="text-xs text-slate-300">
              {language === 'vi'
                ? 'Toàn bộ IndexedDB, Cache, LocalStorage và lịch sử phân tích đã được xóa sạch hoàn toàn khỏi trình duyệt của bạn.'
                : 'All IndexedDB, Cache, LocalStorage and analytics history have been completely wiped from your browser.'}
            </p>
          </div>
        ) : (
          <>
            {/* Warning description */}
            <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/30 space-y-2 text-xs text-slate-200">
              <div className="flex items-center gap-2 text-rose-400 font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {language === 'vi'
                    ? 'Bạn có chắc chắn muốn xóa toàn bộ dữ liệu?'
                    : 'Are you sure you want to clear all data?'}
                </span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                {language === 'vi'
                  ? 'Thao tác này sẽ xóa vĩnh viễn toàn bộ báo cáo đã lưu trong IndexedDB, các thẻ hành động tùy chỉnh, lịch sử trò chuyện AI và cấu hình trên trình duyệt máy này. Tuyệt đối không để lại bất kỳ dấu vết nào.'
                  : 'This will permanently delete all cached reports in IndexedDB, custom roadmap tasks, AI chat logs and local settings from this browser.'}
              </p>
            </div>

            {/* What gets deleted checklist */}
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/10 space-y-1.5 text-xs text-slate-300">
              <span className="text-[10px] font-black uppercase text-slate-400 block">
                DANH MỤC DỮ LIỆU SẼ ĐƯỢC XÓA TRẮNG:
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 text-slate-300">
                  <Database className="w-3.5 h-3.5 text-rose-400" />
                  <span>IndexedDB Datasets</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
                  <span>Lịch sử AI Chat & RAG</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <RefreshCw className="w-3.5 h-3.5 text-rose-400" />
                  <span>Roadmap Tasks & Cache</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Phiên làm việc hiện tại</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white text-xs font-bold transition-all"
              >
                {language === 'vi' ? 'Hủy Bỏ' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={isWiping}
                onClick={handleConfirmWipe}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-black transition-all shadow-lg shadow-rose-600/30 flex items-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {isWiping ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{language === 'vi' ? 'Đang xóa sạch...' : 'Wiping...'}</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>
                      {language === 'vi'
                        ? 'Xóa Sạch 100% Dữ Liệu Ngay'
                        : 'Wipe 100% Data Now'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

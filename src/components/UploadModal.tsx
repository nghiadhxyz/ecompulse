import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Layers,
  Sparkles,
} from 'lucide-react';
import { parseShopeeExcelFile, downloadSampleShopeeExcel } from '../utils/excelParser';
import { SAMPLE_DATASETS } from '../data/sampleDatasets';
import { ParsedStoreData } from '../types';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataLoaded: (data: ParsedStoreData) => void;
  onSelectSample: (key: string) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onDataLoaded,
  onSelectSample,
}) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileProcess = async (file: File) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const parsed = await parseShopeeExcelFile(file);
      onDataLoaded(parsed);
      onClose();
    } catch (err: any) {
      console.error('File parse error:', err);
      setErrorMsg(
        err.message || 'Không thể đọc file Excel. Vui lòng kiểm tra định dạng file .xlsx hoặc .csv!'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xl">
      <div className="glass-panel border border-white/20 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-400/30 shadow-inner backdrop-blur-md">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Tải Lên Báo Cáo Excel Sàn TMĐT (Zero-Setup)
              </h3>
              <p className="text-xs text-slate-300/80">
                Tự động nhận diện nhiều sheet (Placed, Confirmed, Paid, Traffic, Ads) không cần chỉnh sửa cột
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-300 hover:text-white rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.1] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Error notification */}
          {errorMsg && (
            <div className="p-3.5 bg-rose-950/30 border border-rose-500/40 rounded-2xl text-xs text-rose-300 flex items-center space-x-2.5 backdrop-blur-md">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Drag & Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all backdrop-blur-md ${
              isDragging
                ? 'border-blue-400 bg-blue-500/15 shadow-lg shadow-blue-500/20'
                : 'border-white/20 glass-panel-subtle hover:border-white/40 hover:bg-white/[0.08]'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileProcess(e.target.files[0]);
                }
              }}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />

            <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-500/20 border border-blue-400/30 text-blue-300 flex items-center justify-center mb-3 shadow-inner backdrop-blur-md">
              <FileSpreadsheet className="w-7 h-7" />
            </div>

            <div className="text-sm font-bold text-white">
              {isLoading
                ? 'Đang xử lý & phân tích toán học các sheet...'
                : 'Kéo thả file .XLSX hoặc Click để chọn từ máy tính'}
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-md mx-auto">
              Hỗ trợ file xuất gốc từ Shopee, TikTok Shop, Lazada, Pancake, Sapo (chứa 1 hoặc nhiều sheet)
            </p>

            <div className="mt-4 inline-flex items-center space-x-2 text-[11px] font-semibold text-blue-300 bg-blue-500/20 px-3.5 py-1 rounded-full border border-blue-400/30 backdrop-blur-md">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Thời gian phân tích: &lt; 1.5 giây (P0 Deterministic Engine)</span>
            </div>
          </div>

          {/* Format Information */}
          <div className="glass-panel-subtle p-4 rounded-2xl border border-white/10 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
              Định dạng báo cáo được hỗ trợ:
            </span>
            <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
              <li>Báo cáo tổng hợp Shopee 21 Sheet (Đơn đặt, Đơn xác nhận, Đơn thanh toán, Nguồn lưu lượng, Sản phẩm, Live, Video, Affiliate)</li>
              <li>Báo cáo danh sách chi tiết đơn hàng (.xlsx, .csv) từ Shopee, TikTok Shop, Lazada, Sapo, Pancake</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 glass-panel-subtle border-t border-white/[0.08] flex items-center justify-between text-xs">
          <button
            onClick={downloadSampleShopeeExcel}
            className="text-slate-300 hover:text-white font-medium flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Tải file Excel mẫu 21 sheet</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/[0.1] hover:bg-white/[0.18] text-white rounded-xl font-semibold border border-white/[0.15] transition-all backdrop-blur-md"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

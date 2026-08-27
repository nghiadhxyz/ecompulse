import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  TrendingUp,
  ShieldAlert,
  BarChart3,
  HelpCircle,
  Zap,
} from 'lucide-react';
import { parseShopeeExcelFile, downloadSampleShopeeExcel } from '../utils/excelParser';
import { ParsedStoreData } from '../types';
import ecompulseAvatar from '../assets/images/ecompulse_avatar_1787721096722.jpg';
import { ShopeeLogo, TikTokShopLogo, LazadaLogo } from './PlatformLogos';
import { EcommercePlatform } from './EcommercePlatformSelector';
import { SAMPLE_DATASETS } from '../data/sampleDatasets';

interface EmptyStateUploadProps {
  onDataLoaded: (data: ParsedStoreData) => void;
  language: 'vi' | 'en';
  selectedPlatform?: EcommercePlatform | null;
  onBackToPlatformSelector?: () => void;
}

export const EmptyStateUpload: React.FC<EmptyStateUploadProps> = ({
  onDataLoaded,
  language,
  selectedPlatform = 'shopee',
  onBackToPlatformSelector,
}) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const getPlatformMeta = () => {
    switch (selectedPlatform) {
      case 'tiktok':
        return {
          title: 'Tải Lên Báo Cáo TikTok Shop',
          subtitle: 'Phân tích tự động phễu chuyển đổi Live & Video KOC, rò rỉ kênh giỏ hàng TikTok Shop',
          badge: 'TIKTOK SHOP ANALYTICS',
          badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40',
          accentColor: 'border-cyan-500/40 text-cyan-400',
          sampleName: 'TikTok Shop Mega Live & Video',
          Logo: TikTokShopLogo,
        };
      case 'lazada':
        return {
          title: 'Tải Lên Báo Cáo Lazada',
          subtitle: 'Phân tích tự động phễu đặt hàng Siêu Sale, Voucher Tích Lũy và tối ưu hóa doanh số',
          badge: 'LAZADA ANALYTICS',
          badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-400/40',
          accentColor: 'border-blue-500/40 text-blue-400',
          sampleName: 'Lazada Siêu Sale & Voucher',
          Logo: LazadaLogo,
        };
      case 'shopee':
      default:
        return {
          title: 'Tải Lên Báo Cáo Shopee',
          subtitle: 'Phân tích tự động phễu đặt hàng Shopee, điểm nóng rò rỉ đơn và hiệu suất Shopee Ads GMV Max',
          badge: 'SHOPEE ANALYTICS',
          badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-400/40',
          accentColor: 'border-orange-500/40 text-orange-400',
          sampleName: 'Shopee Mega 8.8 (21 Sheet)',
          Logo: ShopeeLogo,
        };
    }
  };

  const meta = getPlatformMeta();

  const handleFileProcess = async (file: File) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const parsed = await parseShopeeExcelFile(file);
      onDataLoaded(parsed);
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

  const handleLoadSample = () => {
    const baseSample = SAMPLE_DATASETS['mega-8-8'] || Object.values(SAMPLE_DATASETS)[0];
    let custom: ParsedStoreData = { ...baseSample };
    if (selectedPlatform === 'tiktok') {
      custom = {
        ...baseSample,
        fileName: 'TikTokShop_BaoCao_DoanhThu_Live_Video_Thang8.xlsx',
        periodLabel: 'TikTok Shop - Tháng 8/2025 (Mega Live & Video KOC)',
      };
    } else if (selectedPlatform === 'lazada') {
      custom = {
        ...baseSample,
        fileName: 'Lazada_BaoCao_DoanhThu_SieuSale_VoucherTichLuy.xlsx',
        periodLabel: 'Lazada - Tháng 8/2025 (Siêu Sale & Voucher Tích Lũy)',
      };
    }
    onDataLoaded(custom);
  };

  return (
    <div className="max-w-5xl mx-auto py-6 sm:py-10 space-y-6 animate-in fade-in duration-300">
      {/* Top back navigation bar */}
      {onBackToPlatformSelector && (
        <div className="flex items-center justify-between">
          <button
            onClick={onBackToPlatformSelector}
            className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-slate-300 hover:text-white border border-white/10 transition-all shadow-sm group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>← Quay lại chọn sàn khác</span>
          </button>

          <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${meta.badgeColor} backdrop-blur-md`}>
            {meta.badge}
          </div>
        </div>
      )}

      {/* Hero Welcome Card */}
      <div className="text-center space-y-4">
        <div className="flex justify-center items-center gap-3">
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-3xl overflow-hidden shadow-2xl shadow-sky-500/30 ring-2 ring-white/30 backdrop-blur-md bg-slate-900 group">
            <img
              src={ecompulseAvatar}
              alt="EcomPulse Avatar Logo"
              className="w-full h-full object-cover rounded-3xl transition-transform duration-500 group-hover:scale-110"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/20 pointer-events-none" />
          </div>

          <div className="p-1">
            <meta.Logo className="w-14 h-14 sm:w-16 sm:h-16" />
          </div>
        </div>

        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-300 text-xs font-semibold backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5" />
          <span>EcomPulse • {meta.badge}</span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
          {meta.title}
        </h1>
        <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto font-normal">
          {meta.subtitle}
        </p>
      </div>

      {/* Main Drag & Drop Zone */}
      <div className="glass-panel rounded-3xl p-6 sm:p-10 border border-white/20 shadow-2xl backdrop-blur-2xl">
        {errorMsg && (
          <div className="mb-6 p-4 bg-rose-950/40 border border-rose-500/40 rounded-2xl text-xs sm:text-sm text-rose-300 flex items-center space-x-3 backdrop-blur-md">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-3xl p-8 sm:p-14 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-blue-400 bg-blue-500/20 shadow-xl shadow-blue-500/20 scale-[1.01]'
              : 'border-white/25 glass-panel-subtle hover:border-blue-400/50 hover:bg-white/[0.08]'
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

          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-3xl bg-gradient-to-tr from-blue-600/30 to-indigo-500/30 border border-blue-400/40 text-blue-300 flex items-center justify-center mb-5 shadow-lg shadow-blue-500/20 backdrop-blur-md">
            <FileSpreadsheet className="w-8 h-8 sm:w-10 sm:h-10" />
          </div>

          <div className="text-base sm:text-lg font-bold text-white">
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Đang đọc & tính toán toán học các sheet dữ liệu...
              </span>
            ) : (
              'Kéo thả file Excel vào đây hoặc Click để chọn từ thiết bị'
            )}
          </div>

          <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-lg mx-auto">
            Hỗ trợ báo cáo <strong>Excel nhiều sheet</strong> (.xlsx, .xls) hoặc file danh sách đơn hàng (.csv).
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="inline-flex items-center px-5 py-2.5 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all shadow-lg shadow-blue-500/25 border border-blue-400/40 active:scale-95"
            >
              <Upload className="w-4 h-4 mr-2" />
              Chọn file từ máy tính
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleLoadSample();
              }}
              className="inline-flex items-center px-4 py-2.5 text-xs sm:text-sm font-semibold text-amber-300 hover:text-amber-200 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30 rounded-xl transition-all shadow-sm"
            >
              <Zap className="w-4 h-4 mr-2 text-amber-400" />
              Dữ liệu Demo
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                downloadSampleShopeeExcel();
              }}
              className="inline-flex items-center px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-200 hover:text-white bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 rounded-xl transition-all shadow-sm"
            >
              <Download className="w-4 h-4 mr-2 text-blue-300" />
              Tải file Excel mẫu (.xlsx)
            </button>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 pt-8 border-t border-white/[0.1]">
          <div className="glass-panel-subtle p-4 rounded-2xl">
            <div className="flex items-center space-x-2 text-blue-300 font-bold text-xs">
              <TrendingUp className="w-4 h-4" />
              <span>Phễu Chuyển Đổi & Thất Thoát</span>
            </div>
            <p className="text-[11px] text-slate-300 mt-1.5 leading-relaxed">
              Tự động ghép nối dữ liệu Placed, Confirmed và Paid để chỉ ra chính xác số tiền thất thoát và tỷ lệ boom hàng COD.
            </p>
          </div>

          <div className="glass-panel-subtle p-4 rounded-2xl">
            <div className="flex items-center space-x-2 text-amber-300 font-bold text-xs">
              <BarChart3 className="w-4 h-4" />
              <span>Phân Tích ABC & Zombie SKU</span>
            </div>
            <p className="text-[11px] text-slate-300 mt-1.5 leading-relaxed">
              Phân loại 80/20 danh mục sản phẩm và phát hiện ngay những SKU có lượt xem cao nhưng không phát sinh đơn hàng.
            </p>
          </div>

          <div className="glass-panel-subtle p-4 rounded-2xl">
            <div className="flex items-center space-x-2 text-purple-300 font-bold text-xs">
              <Sparkles className="w-4 h-4" />
              <span>Đề Xuất & Thẻ Hành Động</span>
            </div>
            <p className="text-[11px] text-slate-300 mt-1.5 leading-relaxed">
              Tạo danh sách công việc việc cần làm (Action Cards) dựa trên cảnh báo thực tế để tối ưu doanh thu và chi phí quảng cáo.
            </p>
          </div>
        </div>
      </div>

      {/* Format Guidelines Box */}
      <div className="glass-panel-subtle rounded-2xl p-5 border border-white/10 text-xs text-slate-300">
        <div className="flex items-center space-x-2 text-slate-200 font-bold text-xs mb-2">
          <HelpCircle className="w-4 h-4 text-blue-400" />
          <span>Cấu trúc dữ liệu được hệ thống tự động nhận diện:</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-400">
          <div>• <strong>Nhóm 1 - Tổng quan:</strong> Đơn hàng đã đặt, Đơn đã xác nhận, Đơn đã thanh toán.</div>
          <div>• <strong>Nhóm 2 - Nguồn truy cập:</strong> Nguồn lưu lượng chi tiết & tổng hợp.</div>
          <div>• <strong>Nhóm 3 - Sản phẩm:</strong> Doanh số & lượt xem theo sản phẩm (Ma trận ABC).</div>
          <div>• <strong>Nhóm 4, 5, 6 - Livestream, Video, Affiliate:</strong> Session contribution, Video KOC.</div>
        </div>
      </div>
    </div>
  );
};

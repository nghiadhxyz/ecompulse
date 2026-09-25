import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
  ShieldCheck,
  Zap,
  ShoppingBag,
  Building2,
  FileSpreadsheet,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  Play,
  Upload,
  Bot,
  ExternalLink,
  ChevronRight,
  Check,
  Flame,
  Layers,
  BarChart3,
  Calendar,
  Lock,
} from 'lucide-react';
import dolphinAvatar from '../../assets/images/dolphin_ai_avatar_1787721342181.jpg';
import ecompulseLogo from '../../assets/images/ecompulse_dolphin_logo.png';
import { ShopeeLogo, TikTokShopLogo } from '../PlatformLogos';

export interface DolphinOnboardingTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartMarketplace?: () => void;
  onStartInternalFinance?: () => void;
  onLoadDemoSample?: () => void;
  onOpenUpload?: () => void;
  onOpenChatWithPrompt?: (prompt: string) => void;
  language?: 'vi' | 'en';
}

interface TourStep {
  id: number;
  badge: string;
  badgeColor: string;
  title: string;
  subtitle: string;
  illustrationType: 'intro' | 'dual_tracks' | 'export_guide' | 'ai_pillars' | 'ready_action';
}

export const DolphinOnboardingTourModal: React.FC<DolphinOnboardingTourModalProps> = ({
  isOpen,
  onClose,
  onStartMarketplace,
  onStartInternalFinance,
  onLoadDemoSample,
  onOpenUpload,
  onOpenChatWithPrompt,
  language = 'vi',
}) => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [selectedPlatformGuide, setSelectedPlatformGuide] = useState<'shopee' | 'tiktok' | 'internal'>('shopee');

  // Reset to step 0 when opened
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  // ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const steps: TourStep[] = [
    {
      id: 1,
      badge: 'BƯỚC 1/5 • GIỚI THIỆU TRỢ LÝ',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30',
      title: 'Chào mừng bạn đến với EcomPulse AI',
      subtitle: 'Trợ lý Dolphin AI đồng hành cùng bạn bóc tách dữ liệu bán hàng, kiểm soát dòng tiền và tối ưu tăng trưởng.',
      illustrationType: 'intro',
    },
    {
      id: 2,
      badge: 'BƯỚC 2/5 • 2 LUỒNG QUẢN TRỊ',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-400/30',
      title: 'Khám phá 2 Luồng Phân Tích Chuyên Biệt',
      subtitle: 'Lựa chọn luồng phù hợp với mục tiêu: Bóc tách đơn sàn TMĐT hoặc Quản trị tài chính P&L nội bộ.',
      illustrationType: 'dual_tracks',
    },
    {
      id: 3,
      badge: 'BƯỚC 3/5 • HƯỚNG DẪN XUẤT FILE SÀN',
      badgeColor: 'bg-blue-500/20 text-sky-300 border-blue-400/30',
      title: 'Cách Xuất Báo Cáo Chuẩn Từ Các Sàn',
      subtitle: 'Hướng dẫn 3 bước nhanh để tải file Excel từ Shopee, TikTok Shop hoặc nạp file P&L.',
      illustrationType: 'export_guide',
    },
    {
      id: 4,
      badge: 'BƯỚC 4/5 • 7 TRỤ CỘT PHÂN TÍCH',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
      title: 'Chẩn Đoán Rò Rỉ & Thẻ Hành Động AI',
      subtitle: 'Hệ thống tự động phát hiện rò rỉ COD, phân loại SKU Zombie, tối ưu Shopee Ads và xuất lịch Google Calendar.',
      illustrationType: 'ai_pillars',
    },
    {
      id: 5,
      badge: 'BƯỚC 5/5 • SẴN SÀNG BẮT ĐẦU',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
      title: 'Bạn đã sẵn sàng trải nghiệm!',
      subtitle: 'Bắt đầu ngay bằng việc nạp dữ liệu mẫu Demo Shopee Mega 8.8 (3.260 đơn) hoặc tải file báo cáo của bạn.',
      illustrationType: 'ready_action',
    },
  ];

  const current = steps[currentStep];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-2xl flex items-center justify-center p-3 sm:p-5 md:p-8 animate-in fade-in duration-200"
    >
      {/* Background Ambient Aura */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-cyan-500/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[160px] pointer-events-none" />

      {/* Main Container Card */}
      <div className="relative w-full max-w-4xl bg-[#080d24]/95 border border-cyan-500/30 rounded-3xl shadow-2xl shadow-cyan-950/80 flex flex-col overflow-hidden backdrop-blur-2xl max-h-[92vh]">
        
        {/* =========================================================================
            1. TOP PROGRESS BAR & HEADER
        ========================================================================= */}
        <div className="px-6 py-4 bg-slate-900/80 border-b border-white/10 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl overflow-hidden border border-cyan-400/50 shadow-md bg-slate-950 p-0.5">
              <img src={dolphinAvatar} alt="Dolphin AI" className="w-full h-full object-cover rounded-xl" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-black text-white">Dolphin AI Tour</span>
                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-400/30">
                  Hướng Dẫn Người Dùng
                </span>
              </div>
              <span className="text-[11px] text-slate-400">Khám phá toàn bộ nền tảng chỉ trong 1 phút</span>
            </div>
          </div>

          {/* Stepper Dots */}
          <div className="hidden sm:flex items-center space-x-2">
            {steps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  idx === currentStep
                    ? 'w-7 bg-gradient-to-r from-cyan-400 to-purple-400'
                    : idx < currentStep
                    ? 'w-2.5 bg-cyan-500/60'
                    : 'w-2 bg-white/20 hover:bg-white/40'
                }`}
                title={`Nhảy tới bước ${idx + 1}`}
              />
            ))}
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all active:scale-95"
            title="Đóng tour hướng dẫn (ESC)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* =========================================================================
            2. BODY CONTENT (SCROLLABLE)
        ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-left">
          
          {/* Header of Current Step */}
          <div className="space-y-2">
            <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase border ${current.badgeColor}`}>
              {current.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug">
              {current.title}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              {current.subtitle}
            </p>
          </div>

          {/* =======================================================================
              STEP 1: INTRO TO DOLPHIN AI
          ======================================================================= */}
          {current.illustrationType === 'intro' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 pt-2 animate-in fade-in duration-300">
              {/* Left 3 Value Cards */}
              <div className="md:col-span-7 space-y-3">
                <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/40 via-slate-900/80 to-slate-900/60 border border-cyan-500/30 flex items-start space-x-3.5 hover:border-cyan-400 transition-all">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 flex-shrink-0 mt-0.5">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white">Local-First RAM Security (Bảo mật 100%)</h4>
                    <p className="text-[11px] text-slate-300 leading-relaxed mt-0.5">
                      Toàn bộ dữ liệu file Excel được xử lý trực tiếp trong bộ nhớ RAM trình duyệt của bạn. Tự động loại bỏ tên khách, SĐT, địa chỉ (PII Scrubbing).
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 via-slate-900/80 to-slate-900/60 border border-purple-500/30 flex items-start space-x-3.5 hover:border-purple-400 transition-all">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 flex-shrink-0 mt-0.5">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white">AI Business Analyst: Tuyệt đối không bịa số</h4>
                    <p className="text-[11px] text-slate-300 leading-relaxed mt-0.5">
                      Dolphin AI chỉ trích xuất số liệu thực tế có bằng chứng dẫn chứng từ file báo cáo của shop. Nếu thiếu chỉ số, Dolphin sẽ chỉ rõ nguyên nhân.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900/80 to-slate-900/60 border border-emerald-500/30 flex items-start space-x-3.5 hover:border-emerald-400 transition-all">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 flex-shrink-0 mt-0.5">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white">Tính toán tức thì &lt; 1 giây</h4>
                    <p className="text-[11px] text-slate-300 leading-relaxed mt-0.5">
                      Không cần chờ đợi. Đối soát hàng nghìn đơn hàng, doanh thu thực nhận, rò rỉ COD và phân loại Pareto SKU trong chớp mắt.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Visual Box */}
              <div className="md:col-span-5 rounded-2xl bg-gradient-to-b from-[#0e1738] to-[#080d24] border border-cyan-400/40 p-5 flex flex-col items-center justify-center text-center space-y-3 relative overflow-hidden shadow-xl">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-400/10 rounded-full blur-2xl pointer-events-none" />
                <div className="w-20 h-20 rounded-3xl overflow-hidden border-2 border-cyan-400/60 shadow-xl shadow-cyan-500/30 bg-slate-950 p-1">
                  <img src={dolphinAvatar} alt="Dolphin AI" className="w-full h-full object-cover rounded-2xl" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">Dolphin AI Assistant</h4>
                  <span className="text-[11px] text-cyan-300 font-medium">Trợ lý Phân tích Dữ liệu TMĐT</span>
                </div>
                <div className="w-full p-2.5 rounded-xl bg-slate-950/70 border border-white/10 text-[11px] text-slate-300 italic">
                  &ldquo;Chào bạn! Tôi sẵn sàng giúp bạn tìm ra điểm rò rỉ dòng tiền và nhân bản doanh số!&rdquo;
                </div>
              </div>
            </div>
          )}

          {/* =======================================================================
              STEP 2: DUAL TRACKS
          ======================================================================= */}
          {current.illustrationType === 'dual_tracks' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 animate-in fade-in duration-300">
              {/* Luồng 1 */}
              <div className="p-5 rounded-3xl bg-gradient-to-b from-sky-950/40 via-slate-900/90 to-slate-900/60 border-2 border-sky-500/40 hover:border-sky-400 transition-all flex flex-col justify-between space-y-4 shadow-xl">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-sky-500/20 text-sky-300 border border-sky-400/30">
                      Luồng 1
                    </span>
                    <div className="flex items-center space-x-1.5">
                      <ShopeeLogo className="w-4 h-4" />
                      <TikTokShopLogo className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-black text-white">Phân Tích Sàn TMĐT</h4>
                      <p className="text-xs text-sky-400 font-medium">Shopee • TikTok Shop</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    Dành cho các chủ shop, nhà bán hàng trên sàn TMĐT muốn bóc tách doanh thu thực nhận, đối soát phễu 3 bước, rò rỉ hoàn hủy COD và hiệu quả Shopee Ads ROAS.
                  </p>

                  <div className="space-y-1.5 text-[11px] text-slate-300 pt-1">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                      <span>Bóc tách phễu: Đặt hàng ➔ Xác nhận ➔ Thanh toán</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                      <span>Chẩn đoán 7 kênh traffic & Đo lường KOC/Live</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                      <span>Phân loại Pareto SKU Class A / B / Zombie</span>
                    </div>
                  </div>
                </div>

                {onStartMarketplace && (
                  <button
                    onClick={() => {
                      onClose();
                      onStartMarketplace();
                    }}
                    className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-lg shadow-sky-950/50 flex items-center justify-center space-x-1.5 transition-all"
                  >
                    <span>Chọn Luồng 1: Sàn TMĐT</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Luồng 2 */}
              <div className="p-5 rounded-3xl bg-gradient-to-b from-emerald-950/40 via-slate-900/90 to-slate-900/60 border-2 border-emerald-500/40 hover:border-emerald-400 transition-all flex flex-col justify-between space-y-4 shadow-xl">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      Luồng 2
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      53 Cột Chuẩn v1.0
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-black text-white">Tài Chính & P&L Nội Bộ</h4>
                      <p className="text-xs text-emerald-400 font-medium">Business Corporate Finance (SMEs)</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    Dành cho ban giám đốc, kế toán quản trị muốn kiểm soát toàn diện báo cáo P&L, đối soát Giá vốn COGS, chi phí vận hành OPEX, biên lợi nhuận và Unit Economics.
                  </p>

                  <div className="space-y-1.5 text-[11px] text-slate-300 pt-1">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span>Nhận diện ngữ nghĩa Từ điển tiếng Việt 53 cột</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span>10 quy tắc cấm nhầm lẫn số liệu tài chính</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span>Kế hoạch hành động ưu tiên P0 / P1 / P2</span>
                    </div>
                  </div>
                </div>

                {onStartInternalFinance && (
                  <button
                    onClick={() => {
                      onClose();
                      onStartInternalFinance();
                    }}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/50 flex items-center justify-center space-x-1.5 transition-all"
                  >
                    <span>Chọn Luồng 2: Tài Chính Nội Bộ</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* =======================================================================
              STEP 3: EXPORT GUIDE
          ======================================================================= */}
          {current.illustrationType === 'export_guide' && (
            <div className="space-y-4 pt-1 animate-in fade-in duration-300">
              {/* Platform Tabs Selector */}
              <div className="flex items-center space-x-2 border-b border-white/10 pb-2 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setSelectedPlatformGuide('shopee')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
                    selectedPlatformGuide === 'shopee'
                      ? 'bg-orange-500/20 text-orange-300 border border-orange-400/40 shadow-sm'
                      : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  <ShopeeLogo className="w-4 h-4 rounded" />
                  <span>Shopee</span>
                </button>

                <button
                  onClick={() => setSelectedPlatformGuide('tiktok')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
                    selectedPlatformGuide === 'tiktok'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm'
                      : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  <TikTokShopLogo className="w-4 h-4 rounded" />
                  <span>TikTok Shop</span>
                </button>

                <button
                  onClick={() => setSelectedPlatformGuide('internal')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
                    selectedPlatformGuide === 'internal'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 shadow-sm'
                      : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>Excel Nội Bộ (P&L)</span>
                </button>
              </div>

              {/* Guide Instructions Details */}
              <div className="p-5 rounded-2xl bg-slate-950/70 border border-white/10 space-y-3.5">
                {selectedPlatformGuide === 'shopee' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-orange-300 flex items-center gap-1.5">
                        <ShopeeLogo className="w-4 h-4" />
                        Quy trình xuất báo cáo Shopee Seller Centre:
                      </span>
                      <span className="text-[11px] text-slate-400">File mẫu chuẩn: 21 Sheets hoặc 1 Sheet tổng</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                        <span className="w-5 h-5 rounded-full bg-orange-500 text-white font-bold text-[10px] flex items-center justify-center">1</span>
                        <h5 className="text-xs font-bold text-white">Vào Phân Tích Bán Hàng</h5>
                        <p className="text-[11px] text-slate-400 leading-snug">Đăng nhập Kênh Người Bán &gt; Dữ Liệu &gt; Phân Tích Bán Hàng.</p>
                      </div>

                      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                        <span className="w-5 h-5 rounded-full bg-orange-500 text-white font-bold text-[10px] flex items-center justify-center">2</span>
                        <h5 className="text-xs font-bold text-white">Chọn Khung Thời Gian</h5>
                        <p className="text-[11px] text-slate-400 leading-snug">Chọn mốc thời gian (Theo ngày Mega Sale, Tuần hoặc Tháng).</p>
                      </div>

                      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                        <span className="w-5 h-5 rounded-full bg-orange-500 text-white font-bold text-[10px] flex items-center justify-center">3</span>
                        <h5 className="text-xs font-bold text-white">Tải Báo Cáo Excel (.xlsx)</h5>
                        <p className="text-[11px] text-slate-400 leading-snug">Bấm nút &ldquo;Tải Dữ Liệu&rdquo; và kéo thả file vào EcomPulse.</p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedPlatformGuide === 'tiktok' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-cyan-300 flex items-center gap-1.5">
                        <TikTokShopLogo className="w-4 h-4" />
                        Quy trình xuất báo cáo TikTok Shop Seller Center:
                      </span>
                      <span className="text-[11px] text-slate-400">Hỗ trợ phân tích Live & Video KOC</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                        <span className="w-5 h-5 rounded-full bg-cyan-500 text-slate-950 font-bold text-[10px] flex items-center justify-center">1</span>
                        <h5 className="text-xs font-bold text-white">Vào Phân Tích La Bàn</h5>
                        <p className="text-[11px] text-slate-400 leading-snug">Seller Center &gt; Phân tích &gt; La bàn dữ liệu (Compass).</p>
                      </div>

                      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                        <span className="w-5 h-5 rounded-full bg-cyan-500 text-slate-950 font-bold text-[10px] flex items-center justify-center">2</span>
                        <h5 className="text-xs font-bold text-white">Chọn Doanh Thu & Live</h5>
                        <p className="text-[11px] text-slate-400 leading-snug">Chọn báo cáo hiệu suất Video & Phiên Livestream.</p>
                      </div>

                      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                        <span className="w-5 h-5 rounded-full bg-cyan-500 text-slate-950 font-bold text-[10px] flex items-center justify-center">3</span>
                        <h5 className="text-xs font-bold text-white">Xuất File Excel</h5>
                        <p className="text-[11px] text-slate-400 leading-snug">Bấm Xuất báo cáo (Export Excel) và nạp vào hệ thống.</p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedPlatformGuide === 'internal' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                        <Building2 className="w-4 h-4" />
                        Cấu trúc file báo cáo Tài chính nội bộ P&L:
                      </span>
                      <span className="text-[11px] text-slate-400">Tự động nhận diện 53 cột tiếng Việt</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                        <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-bold text-[10px] flex items-center justify-center">1</span>
                        <h5 className="text-xs font-bold text-white">Doanh Thu & Giá Vốn (COGS)</h5>
                        <p className="text-[11px] text-slate-400 leading-snug">Doanh thu gộp (Placed), Doanh thu thuần (Paid), Giá vốn hàng bán.</p>
                      </div>

                      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                        <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-bold text-[10px] flex items-center justify-center">2</span>
                        <h5 className="text-xs font-bold text-white">Chi Phí Vận Hành & Ads</h5>
                        <p className="text-[11px] text-slate-400 leading-snug">Phí sàn, phí vận chuyển, chi phí Ads, hoa hồng KOC / Affiliate.</p>
                      </div>

                      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                        <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-bold text-[10px] flex items-center justify-center">3</span>
                        <h5 className="text-xs font-bold text-white">Lợi Nhuận Gộp & Ròng</h5>
                        <p className="text-[11px] text-slate-400 leading-snug">EcomPulse tự động tính toán biên lợi nhuận và điểm hòa vốn.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =======================================================================
              STEP 4: AI PILLARS & ACTION CARDS
          ======================================================================= */}
          {current.illustrationType === 'ai_pillars' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 animate-in fade-in duration-300">
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-rose-500/30 space-y-2">
                <div className="flex items-center space-x-2 text-rose-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-xs font-bold">1. Chẩn đoán Rò rỉ COD</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Bóc tách chênh lệch giữa Doanh thu đặt hàng (Placed) và Doanh thu thực nhận (Paid), chỉ đích danh kênh rò rỉ nặng nhất và tỷ lệ rơi rụng.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.03] border border-purple-500/30 space-y-2">
                <div className="flex items-center space-x-2 text-purple-400">
                  <ShoppingBag className="w-4 h-4" />
                  <span className="text-xs font-bold">2. Phân loại SKU Pareto & Zombie</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Tự động phân loại sản phẩm chủ lực (Hero Class A) và cảnh báo SKU Zombie có lượt xem nhưng 0 đơn hàng để giải phóng tồn kho.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.03] border border-amber-500/30 space-y-2">
                <div className="flex items-center space-x-2 text-amber-400">
                  <Zap className="w-4 h-4" />
                  <span className="text-xs font-bold">3. Tối ưu Shopee Ads ROAS</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Đánh giá hiệu suất chi phí quảng cáo, phát hiện từ khóa lãng phí ngân sách và đề xuất tăng ngân sách cho từ khóa chính xác ROAS &gt; 5.0x.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.03] border border-emerald-500/30 space-y-2">
                <div className="flex items-center space-x-2 text-emerald-400">
                  <Calendar className="w-4 h-4" />
                  <span className="text-xs font-bold">4. Thẻ Hành Động & Google Sync</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Tự động sinh các thẻ hành động ưu tiên (P0 Khẩn cấp, P1 Cơ hội, P2 Tối ưu) kèm tính năng 1-click đồng bộ lịch sang Google Calendar.
                </p>
              </div>
            </div>
          )}

          {/* =======================================================================
              STEP 5: READY & ACTIONS
          ======================================================================= */}
          {current.illustrationType === 'ready_action' && (
            <div className="space-y-5 pt-2 animate-in fade-in duration-300">
              <div className="p-5 rounded-3xl bg-gradient-to-r from-blue-950/60 via-purple-950/60 to-slate-900 border border-cyan-400/40 space-y-3">
                <div className="flex items-center space-x-2 text-cyan-300">
                  <Sparkles className="w-5 h-5" />
                  <h4 className="text-sm font-black text-white">Bạn muốn bắt đầu như thế nào?</h4>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Chọn một trong 3 cách thức bên dưới để bắt đầu trải nghiệm sức mạnh phân tích của EcomPulse AI:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  {/* Option 1: Load Demo */}
                  <button
                    onClick={() => {
                      onClose();
                      if (onLoadDemoSample) onLoadDemoSample();
                    }}
                    className="p-4 rounded-2xl bg-gradient-to-b from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white text-left space-y-2 shadow-xl shadow-blue-950/50 transition-all active:scale-95 group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                      <Play className="w-4 h-4 fill-white text-white" />
                    </div>
                    <div>
                      <span className="text-xs font-black block">1. Nạp Demo 1-Click</span>
                      <span className="text-[10px] text-blue-200 block leading-tight">Shopee Mega 8.8 (3.260 đơn)</span>
                    </div>
                  </button>

                  {/* Option 2: Upload Own File */}
                  <button
                    onClick={() => {
                      onClose();
                      if (onOpenUpload) onOpenUpload();
                    }}
                    className="p-4 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-left space-y-2 transition-all active:scale-95 group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                      <Upload className="w-4 h-4 text-cyan-300" />
                    </div>
                    <div>
                      <span className="text-xs font-black block">2. Tải Lên File Của Bạn</span>
                      <span className="text-[10px] text-slate-400 block leading-tight">Excel Shopee, TikTok Shop</span>
                    </div>
                  </button>

                  {/* Option 3: Ask Dolphin AI */}
                  <button
                    onClick={() => {
                      onClose();
                      if (onOpenChatWithPrompt) onOpenChatWithPrompt('Shop tui mới bắt đầu thì nên xem chỉ số nào trước?');
                    }}
                    className="p-4 rounded-2xl bg-purple-900/40 hover:bg-purple-900/60 border border-purple-500/40 text-white text-left space-y-2 transition-all active:scale-95 group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-purple-300" />
                    </div>
                    <div>
                      <span className="text-xs font-black block">3. Chat Với Dolphin AI</span>
                      <span className="text-[10px] text-purple-300 block leading-tight">Hỏi đáp &amp; Nhận tư vấn trực tiếp</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* =========================================================================
            3. BOTTOM FOOTER NAVIGATION BUTTONS
        ========================================================================= */}
        <div className="px-6 py-4 bg-slate-900/90 border-t border-white/10 flex items-center justify-between flex-shrink-0">
          {/* Left: Previous Button or Help text */}
          {currentStep > 0 ? (
            <button
              onClick={handlePrev}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-bold transition-all flex items-center space-x-1.5 active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Quay lại</span>
            </button>
          ) : (
            <span className="text-[11px] text-slate-500 flex items-center space-x-1">
              <Lock className="w-3 h-3 text-emerald-400" />
              <span>Bảo mật On-Premise 100% trong RAM</span>
            </span>
          )}

          {/* Right: Next / Finish Button */}
          <div className="flex items-center space-x-3">
            {currentStep < steps.length - 1 ? (
              <button
                onClick={handleNext}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-bold shadow-lg shadow-blue-950/50 flex items-center space-x-2 transition-all active:scale-95"
              >
                <span>Bước tiếp theo</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/50 flex items-center space-x-2 transition-all active:scale-95"
              >
                <span>Hoàn tất & Bắt đầu</span>
                <Check className="w-4 h-4 stroke-[3]" />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

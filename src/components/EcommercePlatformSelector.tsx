import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ArrowRight,
  Zap,
  CheckCircle2,
  TrendingUp,
  ShieldCheck,
  BarChart3,
  Crown,
  Layers,
  ShoppingBag,
  Bot,
} from 'lucide-react';
import { ShopeeLogo, TikTokShopLogo } from './PlatformLogos';
import ecompulseLogo from '../assets/images/ecompulse_dolphin_logo.png';
import { SAMPLE_DATASETS } from '../data/sampleDatasets';
import { ParsedStoreData, GoogleUserProfile } from '../types';
import { PricingBanner } from './pricing/PricingBanner';
import { PricingPlansModal } from './pricing/PricingPlansModal';
import { DolphinOnboardingTourModal } from './onboarding/DolphinOnboardingTourModal';
import { DolphinChatModal } from './chat/DolphinChatModal';
import { DolphinFloatingWidget } from './chat/DolphinFloatingWidget';
import dolphinAvatar from '../assets/images/dolphin_ai_avatar_1787721342181.jpg';
import {
  getCurrentSubscription,
  subscribeToPlanChanges,
} from '../utils/subscriptionStorage';
import { UserSubscription } from '../types/pricing';

export type EcommercePlatform = 'shopee' | 'tiktok';

interface EcommercePlatformSelectorProps {
  onSelectPlatform: (platform: EcommercePlatform) => void;
  onLoadSampleData: (platform: EcommercePlatform, data: ParsedStoreData) => void;
  currentUser?: GoogleUserProfile | null;
  language: 'vi' | 'en';
  onOpenPricing?: () => void;
}

export const EcommercePlatformSelector: React.FC<EcommercePlatformSelectorProps> = ({
  onSelectPlatform,
  onLoadSampleData,
  currentUser,
  language,
  onOpenPricing,
}) => {
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showTourModal, setShowTourModal] = useState(false);
  const [showDolphinChat, setShowDolphinChat] = useState(false);
  const [chatPrompt, setChatPrompt] = useState<string | undefined>(undefined);
  const [currentSub, setCurrentSub] = useState<UserSubscription>(() =>
    getCurrentSubscription()
  );

  const handleOpenChatWithPrompt = (prompt: string) => {
    setChatPrompt(prompt);
    setShowDolphinChat(true);
  };

  useEffect(() => {
    setCurrentSub(getCurrentSubscription());
    const unsub = subscribeToPlanChanges((sub) => {
      setCurrentSub(sub);
    });
    return () => unsub();
  }, []);

  const handleOpenPricingModal = () => {
    if (onOpenPricing) {
      onOpenPricing();
    } else {
      setShowPricingModal(true);
    }
  };

  const handleSampleClick = (platform: EcommercePlatform) => {
    const baseSample = SAMPLE_DATASETS['mega-8-8'] || Object.values(SAMPLE_DATASETS)[0];

    let customizedData: ParsedStoreData = { ...baseSample };

    if (platform === 'tiktok') {
      customizedData = {
        ...baseSample,
        fileName: 'TikTokShop_BaoCao_DoanhThu_Live_Video_Thang8.xlsx',
        periodLabel: 'TikTok Shop - Tháng 8/2025 (Mega Live & Video KOC)',
      };
    } else {
      customizedData = {
        ...baseSample,
        fileName: 'Shopee_BaoCaoDoanhThu_Thang8_2025_Mega8.8.xlsx',
        periodLabel: 'Shopee - Tháng 8/2025 (Chiến dịch 8.8)',
      };
    }

    onLoadSampleData(platform, customizedData);
  };

  return (
    <div className="max-w-6xl mx-auto py-6 sm:py-8 space-y-10 animate-in fade-in duration-300">
      {/* 1. Header & Brand Banner */}
      <div className="text-center space-y-4">
        {/* Avatar Icon */}
        <div className="flex justify-center">
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden shadow-2xl shadow-cyan-500/25 ring-2 ring-cyan-400/50 backdrop-blur-md bg-[#080d24] group flex items-center justify-center">
            <img
              src={ecompulseLogo}
              alt="EcomPulse AI Logo"
              className="w-full h-full object-contain p-1 transition-transform duration-500 group-hover:scale-110"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        {/* Brand Name & Tagline */}
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-wider uppercase font-sans">
            ECOM PULSE • PHÂN TÍCH SÀN TMĐT
          </h1>
          <p className="text-[11px] sm:text-xs font-bold tracking-[0.25em] text-slate-400 uppercase">
            MARKETPLACE FINANCIAL & TRAFFIC ANALYTICS
          </p>
        </div>

        {/* Pill Badge & User Welcome */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {currentUser && (
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-semibold backdrop-blur-md shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                {language === 'vi' ? 'Xin chào,' : 'Welcome,'} <strong>{currentUser.name}</strong> ({currentUser.email})
              </span>
            </div>
          )}
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-300 text-xs font-semibold backdrop-blur-md shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
            <span>Phân tích ma trận phễu, rò rỉ kênh & tối ưu chiến dịch Mega Sale</span>
          </div>
          <button
            onClick={handleOpenPricingModal}
            className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 text-xs font-bold transition-all shadow-sm group"
          >
            <Crown className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
            <span>{currentSub.planName}</span>
          </button>
        </div>
      </div>

      {/* Dolphin AI Guidance & Onboarding Tip Card */}
      <div className="rounded-2xl bg-gradient-to-r from-[#0c1638] via-slate-900 to-[#171038] border border-cyan-400/30 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl backdrop-blur-xl">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl overflow-hidden border border-cyan-400/50 shadow-md bg-slate-950 p-0.5 flex-shrink-0">
            <img src={dolphinAvatar} alt="Dolphin AI" className="w-full h-full object-cover rounded-xl" />
          </div>
          <div className="text-left space-y-0.5">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-black text-white">Mẹo Từ Dolphin AI</span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                Chưa Có File Báo Cáo?
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Bạn có thể bấm <strong>&ldquo;Thử ngay với dữ liệu mẫu&rdquo;</strong> ở mỗi sàn để xem trước phân tích hoặc mở <strong>Tour hướng dẫn</strong> để xem cách xuất file chuẩn.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5 flex-shrink-0">
          <button
            onClick={() => setShowTourModal(true)}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-400/40 text-cyan-300 text-xs font-bold transition-all flex items-center space-x-1.5 active:scale-95 shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>Tour 1 Phút</span>
          </button>

          <button
            onClick={() => setShowDolphinChat(true)}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-bold transition-all flex items-center space-x-1.5 active:scale-95"
          >
            <Bot className="w-3.5 h-3.5 text-purple-300" />
            <span>Hỏi Dolphin AI</span>
          </button>
        </div>
      </div>

      {/* 2. SELECT PLATFORM & LOAD DATA FOR DEEP ANALYTICS */}
      <div className="space-y-6">
        {/* Section Heading */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Chọn Sàn Thương Mại Điện Tử Để Bắt Đầu Phân Tích
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Nạp file báo cáo từ sàn của bạn hoặc trải nghiệm ngay dữ liệu mẫu để khám phá bức tranh phân tích chuyên sâu:
          </p>
        </div>

        {/* 2 Platforms Grid Cards (Shopee, TikTok Shop) */}
        <div className="grid grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto gap-5 lg:gap-6">
          {/* Card 1: Shopee Analytics */}
          <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-white/15 bg-gradient-to-b from-slate-900/80 via-slate-900/60 to-orange-950/20 shadow-2xl flex flex-col justify-between hover:border-orange-500/40 transition-all duration-300 group hover:-translate-y-1">
            <div className="space-y-4">
              {/* Top row: Logo & Badge */}
              <div className="flex items-center justify-between">
                <ShopeeLogo className="w-12 h-12" />
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-orange-500/20 text-orange-300 border border-orange-400/40">
                  SHOPEE
                </span>
              </div>

              {/* Title & Subtitle */}
              <div>
                <h3 className="text-lg sm:text-xl font-black text-white tracking-tight group-hover:text-orange-300 transition-colors">
                  Shopee Analytics
                </h3>
                <p className="text-xs font-semibold text-orange-400/90 mt-0.5">
                  Phổ Biến Nhất • Đa Kênh & Shopee Ads
                </p>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-300 leading-relaxed">
                Phân tích phễu đặt hàng, điểm nóng rò rỉ đơn kênh Tìm kiếm/Live/Chat, Mega Sale 8.8 và chiến dịch Shopee Ads GMV Max.
              </p>

              {/* Features list */}
              <div className="pt-2 border-t border-white/[0.08] space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  KHẢ NĂNG PHÂN TÍCH:
                </span>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  <li className="flex items-start space-x-2">
                    <span className="text-orange-400 font-bold shrink-0">•</span>
                    <span>Chuẩn hóa dữ liệu đơn hàng & doanh thu Shopee</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-orange-400 font-bold shrink-0">•</span>
                    <span>Đối soát phễu Đặt hàng → Xác nhận → Thanh toán</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-orange-400 font-bold shrink-0">•</span>
                    <span>Bóc tách rò rỉ kênh Tìm kiếm, Live Stream & Chat</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-orange-400 font-bold shrink-0">•</span>
                    <span>Tối ưu tỷ suất ROAS Shopee Ads & GMV Max</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-6 space-y-2.5">
              <button
                onClick={() => onSelectPlatform('shopee')}
                className="w-full py-3 px-4 rounded-xl bg-white/[0.08] hover:bg-orange-600 text-white font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 border border-white/10 hover:border-orange-500 shadow-md group-hover:bg-orange-600/90"
              >
                <span>Nạp Dữ Liệu Sàn Shopee</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleSampleClick('shopee')}
                className="w-full text-center text-xs text-slate-400 hover:text-orange-300 font-medium py-1 transition-colors flex items-center justify-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Thử ngay với dữ liệu mẫu (Shopee)</span>
              </button>
            </div>
          </div>

          {/* Card 2: TikTok Shop Analytics */}
          <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-white/15 bg-gradient-to-b from-slate-900/80 via-slate-900/60 to-cyan-950/20 shadow-2xl flex flex-col justify-between hover:border-cyan-500/40 transition-all duration-300 group hover:-translate-y-1">
            <div className="space-y-4">
              {/* Top row: Logo & Badge */}
              <div className="flex items-center justify-between">
                <TikTokShopLogo className="w-12 h-12" />
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">
                  TIKTOK
                </span>
              </div>

              {/* Title & Subtitle */}
              <div>
                <h3 className="text-lg sm:text-xl font-black text-white tracking-tight group-hover:text-cyan-300 transition-colors">
                  TikTok Shop Analytics
                </h3>
                <p className="text-xs font-semibold text-cyan-400/90 mt-0.5">
                  Tăng Trưởng Nhanh • Video & Live
                </p>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-300 leading-relaxed">
                Phân tích doanh số Livestream, hiệu suất Video Affiliate KOC, tỷ lệ giữ chân khách hàng và tối ưu hóa giỏ hàng TikTok Shop.
              </p>

              {/* Features list */}
              <div className="pt-2 border-t border-white/[0.08] space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  KHẢ NĂNG PHÂN TÍCH:
                </span>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  <li className="flex items-start space-x-2">
                    <span className="text-cyan-400 font-bold shrink-0">•</span>
                    <span>Chuẩn hóa dữ liệu đơn hàng & doanh thu TikTok Shop</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-cyan-400 font-bold shrink-0">•</span>
                    <span>Đo lường hiệu suất Video KOC & Tiếp thị liên kết</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-cyan-400 font-bold shrink-0">•</span>
                    <span>Phân loại danh mục sản phẩm chủ lực Class A/B/C</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-cyan-400 font-bold shrink-0">•</span>
                    <span>Lộ trình hành động khắc phục rò rỉ dòng tiền</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-6 space-y-2.5">
              <button
                onClick={() => onSelectPlatform('tiktok')}
                className="w-full py-3 px-4 rounded-xl bg-white/[0.08] hover:bg-cyan-600 text-white font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 border border-white/10 hover:border-cyan-500 shadow-md group-hover:bg-cyan-600/90"
              >
                <span>Nạp Dữ Liệu Sàn TikTok Shop</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleSampleClick('tiktok')}
                className="w-full text-center text-xs text-slate-400 hover:text-cyan-300 font-medium py-1 transition-colors flex items-center justify-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Thử ngay với dữ liệu mẫu (TikTok Shop)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Promotional Pricing & Subscription Banner */}
      <PricingBanner
        onOpenPricing={handleOpenPricingModal}
        currentSubscription={currentSub}
        language={language}
      />

      {/* Pricing Modal */}
      <PricingPlansModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
        language={language}
      />

      {/* Dolphin Onboarding Tour Modal */}
      <DolphinOnboardingTourModal
        isOpen={showTourModal}
        onClose={() => setShowTourModal(false)}
        onStartMarketplace={() => {}}
        onLoadDemoSample={() => handleSampleClick('shopee')}
        onOpenChatWithPrompt={handleOpenChatWithPrompt}
        language={language}
      />

      {/* Dolphin Chat Modal */}
      <DolphinChatModal
        isOpen={showDolphinChat}
        onClose={() => setShowDolphinChat(false)}
        onLoadDemoSample={() => handleSampleClick('shopee')}
        onOpenTour={() => setShowTourModal(true)}
        currentUser={currentUser}
        language={language}
        initialPrompt={chatPrompt}
      />

      {/* Floating Widget */}
      <DolphinFloatingWidget
        onOpenChat={() => setShowDolphinChat(true)}
        onOpenTour={() => setShowTourModal(true)}
        onLoadDemoSample={() => handleSampleClick('shopee')}
        currentContext="marketplace"
        hasData={false}
      />
    </div>
  );
};

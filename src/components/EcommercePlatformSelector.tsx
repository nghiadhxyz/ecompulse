import React from 'react';
import {
  Sparkles,
  ArrowRight,
  Zap,
  CheckCircle2,
  TrendingUp,
  ShieldCheck,
  BarChart3,
} from 'lucide-react';
import { ShopeeLogo, TikTokShopLogo, LazadaLogo } from './PlatformLogos';
import ecompulseAvatar from '../assets/images/ecompulse_avatar_1787721096722.jpg';
import { SAMPLE_DATASETS } from '../data/sampleDatasets';
import { ParsedStoreData, GoogleUserProfile } from '../types';

export type EcommercePlatform = 'shopee' | 'tiktok' | 'lazada';

interface EcommercePlatformSelectorProps {
  onSelectPlatform: (platform: EcommercePlatform) => void;
  onLoadSampleData: (platform: EcommercePlatform, data: ParsedStoreData) => void;
  currentUser?: GoogleUserProfile | null;
  language: 'vi' | 'en';
}

export const EcommercePlatformSelector: React.FC<EcommercePlatformSelectorProps> = ({
  onSelectPlatform,
  onLoadSampleData,
  currentUser,
  language,
}) => {
  const handleSampleClick = (platform: EcommercePlatform) => {
    // Generate/select appropriate sample dataset
    const baseSample = SAMPLE_DATASETS['mega-8-8'] || Object.values(SAMPLE_DATASETS)[0];
    
    let customizedData: ParsedStoreData = { ...baseSample };
    
    if (platform === 'tiktok') {
      customizedData = {
        ...baseSample,
        fileName: 'TikTokShop_BaoCao_DoanhThu_Live_Video_Thang8.xlsx',
        periodLabel: 'TikTok Shop - Tháng 8/2025 (Mega Live & Video KOC)',
      };
    } else if (platform === 'lazada') {
      customizedData = {
        ...baseSample,
        fileName: 'Lazada_BaoCao_DoanhThu_SieuSale_VoucherTichLuy.xlsx',
        periodLabel: 'Lazada - Tháng 8/2025 (Siêu Sale & Voucher Tích Lũy)',
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
    <div className="max-w-6xl mx-auto py-6 sm:py-10 space-y-8 animate-in fade-in duration-300">
      {/* 1. Header & Brand Banner (Matching Image 4) */}
      <div className="text-center space-y-4">
        {/* Avatar Icon */}
        <div className="flex justify-center">
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden shadow-2xl shadow-cyan-500/20 ring-2 ring-cyan-400/40 backdrop-blur-md bg-slate-900 group">
            <img
              src={ecompulseAvatar}
              alt="EcomPulse Avatar"
              className="w-full h-full object-cover rounded-2xl transition-transform duration-500 group-hover:scale-110"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/20 pointer-events-none" />
          </div>
        </div>

        {/* Brand Name & Tagline */}
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-wider uppercase font-sans">
            ECOM PULSE
          </h1>
          <p className="text-[11px] sm:text-xs font-bold tracking-[0.25em] text-slate-400 uppercase">
            DATA ANALYTICS & INSIGHTS FOR E-COMMERCE
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
            <span>Hệ Thống Trợ Lý Phân Tích Dữ Liệu E-Commerce</span>
          </div>
        </div>

        {/* Main Section Heading */}
        <div className="pt-2 max-w-3xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
            Chọn Sàn Thương Mại Điện Tử Để Bắt Đầu
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
            Vui lòng chọn sàn kinh doanh bạn muốn thẩm định dữ liệu. Hệ thống tự động phân tích ma trận phễu, rò rỉ kênh, chiến dịch ngày đôi và tạo lộ trình hành động chuyên sâu.
          </p>
        </div>
      </div>

      {/* 2. 3 Platforms Grid Cards (Shopee, TikTok Shop, Lazada - Matching Image 4) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
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
              <span>Phân Tích Sàn Shopee</span>
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
              <span>Phân Tích Sàn TikTok Shop</span>
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

        {/* Card 3: Lazada Analytics */}
        <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-white/15 bg-gradient-to-b from-slate-900/80 via-slate-900/60 to-blue-950/20 shadow-2xl flex flex-col justify-between hover:border-blue-500/40 transition-all duration-300 group hover:-translate-y-1">
          <div className="space-y-4">
            {/* Top row: Logo & Badge */}
            <div className="flex items-center justify-between">
              <LazadaLogo className="w-12 h-12" />
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-blue-500/20 text-blue-300 border border-blue-400/40">
                LAZADA
              </span>
            </div>

            {/* Title & Subtitle */}
            <div>
              <h3 className="text-lg sm:text-xl font-black text-white tracking-tight group-hover:text-blue-300 transition-colors">
                Lazada Analytics
              </h3>
              <p className="text-xs font-semibold text-blue-400/90 mt-0.5">
                Chiến Dịch Mega • Voucher Tích Lũy
              </p>
            </div>

            {/* Description */}
            <p className="text-xs text-slate-300 leading-relaxed">
              Thẩm định hiệu quả kênh lưu lượng, phân loại danh mục sản phẩm ABC, tối ưu hóa Voucher Tích Lũy và nâng baseline ngày thường.
            </p>

            {/* Features list */}
            <div className="pt-2 border-t border-white/[0.08] space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                KHẢ NĂNG PHÂN TÍCH:
              </span>
              <ul className="space-y-1.5 text-xs text-slate-300">
                <li className="flex items-start space-x-2">
                  <span className="text-blue-400 font-bold shrink-0">•</span>
                  <span>Phân tích đối soát doanh số thực nhận vs đặt hàng</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-blue-400 font-bold shrink-0">•</span>
                  <span>Kiểm soát rủi ro hủy đơn & boom hàng COD</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-blue-400 font-bold shrink-0">•</span>
                  <span>Tối ưu hóa chiến dịch Mega Sale & ngày thường</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-blue-400 font-bold shrink-0">•</span>
                  <span>Trợ lý AI phân tích dữ liệu & trích xuất dẫn chứng</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-6 space-y-2.5">
            <button
              onClick={() => onSelectPlatform('lazada')}
              className="w-full py-3 px-4 rounded-xl bg-white/[0.08] hover:bg-blue-600 text-white font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 border border-white/10 hover:border-blue-500 shadow-md group-hover:bg-blue-600/90"
            >
              <span>Phân Tích Sàn Lazada</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => handleSampleClick('lazada')}
              className="w-full text-center text-xs text-slate-400 hover:text-blue-300 font-medium py-1 transition-colors flex items-center justify-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Thử ngay với dữ liệu mẫu (Lazada)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

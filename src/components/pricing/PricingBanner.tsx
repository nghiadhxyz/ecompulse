import React from 'react';
import { Crown, Sparkles, Zap, ArrowRight, ShieldCheck, Flame } from 'lucide-react';
import { UserSubscription } from '../../types/pricing';

interface PricingBannerProps {
  onOpenPricing: () => void;
  currentSubscription?: UserSubscription;
  language: 'vi' | 'en';
}

export const PricingBanner: React.FC<PricingBannerProps> = ({
  onOpenPricing,
  currentSubscription,
  language,
}) => {
  const isPro =
    currentSubscription?.planId === 'pro_monthly' ||
    currentSubscription?.planId === 'pro_semi_annual';

  return (
    <div className="relative rounded-3xl p-5 sm:p-7 overflow-hidden border border-amber-400/30 bg-gradient-to-r from-purple-950/70 via-slate-900/90 to-amber-950/60 shadow-2xl backdrop-blur-xl group">
      {/* Decorative Glow */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 rounded-full bg-gradient-to-br from-amber-500/20 to-purple-500/20 blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-48 h-48 rounded-full bg-gradient-to-tr from-blue-500/20 to-emerald-500/20 blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        {/* Left Info */}
        <div className="space-y-2 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-gradient-to-r from-amber-500/25 via-cyan-500/25 to-purple-500/25 text-amber-300 border border-amber-400/40 shadow-sm">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              {language === 'vi' ? 'Bảng Giá & 4 Gói Dịch Vụ' : '4 Subscription Tiers'}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-400/30">
              <Flame className="w-3 h-3 text-rose-400" />
              {language === 'vi' ? 'Ưu đãi tháng đầu chỉ 119k' : 'First month 119k VND'}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 hidden sm:inline-flex">
              <ShieldCheck className="w-3 h-3 text-cyan-400" />
              {language === 'vi' ? 'Enterprise SLA' : 'Enterprise SLA'}
            </span>
          </div>

          <h3 className="text-lg sm:text-xl font-black text-white tracking-tight leading-snug">
            {language === 'vi'
              ? 'Tăng Tốc Doanh Thu TMĐT Cùng Hệ Thống Phân Tích & AI Quyết Định'
              : 'Scale Your E-commerce Revenue with AI Decision Tools'}
          </h3>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {language === 'vi'
              ? 'Từ cá nhân khởi đầu miễn phí, gói Pro tự động hóa dữ liệu, đến gói Enterprise tích hợp API riêng, Multimodal AI hóa đơn COGS & bảo mật quyền riêng tư tuyệt đối.'
              : 'From free starter, automated Pro suites, to Enterprise with custom ERP API, Multimodal AI COGS invoice OCR & full data privacy shield.'}
          </p>
        </div>

        {/* Right CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0 w-full md:w-auto">
          <button
            onClick={onOpenPricing}
            className="px-5 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-purple-600 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white text-xs sm:text-sm font-black shadow-xl shadow-amber-500/20 border border-amber-300/40 transition-all flex items-center justify-center gap-2 active:scale-95 group-hover:shadow-amber-500/30"
          >
            <Sparkles className="w-4 h-4 text-amber-200" />
            <span>
              {isPro
                ? language === 'vi'
                  ? 'Quản Lý / Đổi Gói Pro'
                  : 'Manage Subscription'
                : language === 'vi'
                ? 'Khám Phá Các Gói Dịch Vụ'
                : 'Explore All Plans'}
            </span>
            <ArrowRight className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Sparkles,
  Zap,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Crown,
  HelpCircle,
  TrendingUp,
  Lock,
  Flame,
  Star,
  FileSpreadsheet,
  Bot,
  Mail,
  Calendar,
  Layers,
  ArrowRight,
  PhoneCall,
  Briefcase,
} from 'lucide-react';
import {
  PRICING_PLANS_VI,
  PRICING_PLANS_EN,
  PRICING_FAQS_VI,
  PRICING_FAQS_EN,
} from '../../data/pricingPlans';
import { PricingPlan, BillingCycle, UserSubscription } from '../../types/pricing';
import {
  getCurrentSubscription,
  subscribeToPlanChanges,
  formatVND,
} from '../../utils/subscriptionStorage';
import { CheckoutPreviewModal } from './CheckoutPreviewModal';

interface PricingPlansModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: 'vi' | 'en';
}

export const PricingPlansModal: React.FC<PricingPlansModalProps> = ({
  isOpen,
  onClose,
  language,
}) => {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('semi_annual');
  const [activeTab, setActiveTab] = useState<'cards' | 'faq'>('cards');
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<PricingPlan | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [currentSub, setCurrentSub] = useState<UserSubscription>(() => getCurrentSubscription());

  useEffect(() => {
    setCurrentSub(getCurrentSubscription());
    const unsub = subscribeToPlanChanges((sub) => {
      setCurrentSub(sub);
    });
    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  const plans = language === 'vi' ? PRICING_PLANS_VI : PRICING_PLANS_EN;
  const faqs = language === 'vi' ? PRICING_FAQS_VI : PRICING_FAQS_EN;

  const handleSelectPlan = (plan: PricingPlan) => {
    if (plan.id === 'experience') {
      // Free plan
      return;
    }
    setSelectedPlanForCheckout(plan);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto bg-slate-950/90 backdrop-blur-2xl animate-fadeIn">
        <div className="relative w-full max-w-7xl rounded-3xl bg-slate-900/98 border border-white/20 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[94vh]">
          {/* Top Header */}
          <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-cyan-500/20 to-purple-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-white">
                    {language === 'vi'
                      ? 'Bảng Giá & Các Gói Dịch Vụ EcomPulse'
                      : 'EcomPulse Pricing & Subscription Plans'}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                    {language === 'vi' ? 'Bảo Mật On-Premise' : 'On-Premise Privacy'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {language === 'vi'
                    ? 'Giải pháp phân tích doanh thu TMĐT, bóc tách rò rỉ và ra quyết định thông minh bằng AI'
                    : 'E-commerce revenue analytics, cash leakage funnel and AI decision center'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2.5 rounded-2xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Sub Navigation Bar: View Mode Switcher */}
          <div className="px-6 py-3 border-b border-white/[0.08] bg-slate-950/40 flex flex-wrap items-center justify-between gap-3">
            {/* Nav Tabs */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('cards')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'cards'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 border border-blue-400/30'
                    : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{language === 'vi' ? 'Các Gói Dịch Vụ (4 Gói)' : 'Pricing Plans (4 Tiers)'}</span>
              </button>

              <button
                onClick={() => setActiveTab('faq')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'faq'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 border border-blue-400/30'
                    : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>{language === 'vi' ? 'Câu Hỏi Thường Gặp (FAQ)' : 'FAQ'}</span>
              </button>
            </div>

            {/* Current Sub Status Badge */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">
                {language === 'vi' ? 'Gói hiện tại:' : 'Current plan:'}
              </span>
              <span className="px-2.5 py-1 rounded-xl bg-slate-800 border border-white/15 text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Crown className="w-3 h-3 text-amber-400" />
                {currentSub.planId === 'enterprise'
                  ? 'Gói Enterprise (Custom)'
                  : currentSub.planId === 'pro_semi_annual'
                  ? 'Gói Pro Semi-Annual (6 Tháng)'
                  : currentSub.planId === 'pro_monthly'
                  ? 'Gói Pro Monthly'
                  : 'Gói Experience (Free)'}
              </span>
            </div>
          </div>

          {/* Modal Main Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 lg:p-8 space-y-6">
            {activeTab === 'cards' && (
              <>
                {/* Billing Switch Promo Banner */}
                <div className="flex flex-col sm:flex-row items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-purple-900/30 via-slate-900 to-amber-900/20 border border-purple-500/30 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-purple-500/20 border border-purple-400/30 text-purple-300">
                      <Flame className="w-5 h-5 text-amber-400 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white flex items-center gap-2">
                        {language === 'vi'
                          ? 'Gói 6 Tháng Tiết Kiệm Tới 67% Chi Phí'
                          : 'Semi-Annual Plan Saves Up To 67% Cost'}
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 font-black">
                          {language === 'vi' ? 'SIÊU TIẾT KIỆM' : 'BEST VALUE'}
                        </span>
                      </p>
                      <p className="text-xs text-slate-300">
                        {language === 'vi'
                          ? 'Chỉ ~99.800đ / tháng + Mở khóa Open API & Time-series RAG • Hoặc chọn Enterprise cho Brand lớn'
                          : 'Only ~99,800 VND / month + Unlock Open API & Time-series RAG • Or choose Enterprise for Brands'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-950/80 p-1 rounded-xl border border-white/10 shrink-0">
                    <button
                      onClick={() => setBillingCycle('monthly')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        billingCycle === 'monthly'
                          ? 'bg-blue-600 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {language === 'vi' ? 'Theo Tháng' : 'Monthly'}
                    </button>
                    <button
                      onClick={() => setBillingCycle('semi_annual')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        billingCycle === 'semi_annual'
                          ? 'bg-gradient-to-r from-amber-500 to-purple-600 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>{language === 'vi' ? '6 Tháng' : '6 Months'}</span>
                      <span className="text-[9px] px-1 py-0.2 bg-white/20 rounded font-black">
                        -67%
                      </span>
                    </button>
                  </div>
                </div>

                {/* 4 Pricing Tier Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 items-stretch">
                  {plans.map((plan) => {
                    const isCurrent = currentSub.planId === plan.id;
                    const isSemi = plan.id === 'pro_semi_annual';
                    const isEnt = plan.id === 'enterprise';

                    return (
                      <div
                        key={plan.id}
                        className={`relative rounded-3xl p-5 sm:p-6 border flex flex-col justify-between transition-all duration-300 bg-gradient-to-b ${
                          plan.accentColor
                        } ${
                          isSemi
                            ? 'shadow-2xl shadow-purple-500/20 ring-2 ring-amber-400/40'
                            : isEnt
                            ? 'shadow-2xl shadow-cyan-500/20 ring-2 ring-cyan-400/40'
                            : ''
                        }`}
                      >
                        {/* Top Badge */}
                        {plan.badge && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                            <span
                              className={`px-3 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase border shadow-md whitespace-nowrap ${plan.badgeColor}`}
                            >
                              {plan.badge}
                            </span>
                          </div>
                        )}

                        <div className="space-y-3.5">
                          {/* Plan Title & Subtitle */}
                          <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              {plan.subtitle}
                            </span>
                            <h3 className="text-lg font-black text-white">{plan.name}</h3>
                            <p className="text-xs text-slate-300 min-h-[32px] leading-relaxed">
                              {plan.targetAudience}
                            </p>
                          </div>

                          {/* Price Tag */}
                          <div className="py-2 border-y border-white/[0.08] space-y-1">
                            {isEnt ? (
                              <div className="space-y-0.5">
                                <div className="text-xl font-black text-cyan-300">
                                  {language === 'vi' ? 'Báo Giá Riêng' : 'Custom Quote'}
                                </div>
                                <div className="text-xs text-slate-400">
                                  {plan.billingText}
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-baseline gap-2">
                                  {plan.originalPrice && plan.originalPrice > plan.price ? (
                                    <span className="text-xs text-slate-400 line-through">
                                      {formatVND(plan.originalPrice)}
                                    </span>
                                  ) : null}
                                  <span className="text-2xl font-black text-white tracking-tight">
                                    {plan.price === 0 ? '0 VNĐ' : formatVND(plan.price)}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-400 font-medium">
                                  {plan.billingText}
                                </div>
                              </>
                            )}
                            {plan.discountNote && (
                              <div className="inline-block text-[10px] font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-md border border-amber-400/30">
                                🎁 {plan.discountNote}
                              </div>
                            )}
                          </div>

                          {/* Features List */}
                          <div className="space-y-2 pt-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                              {language === 'vi' ? 'TÍNH NĂNG GÓI:' : 'KEY FEATURES:'}
                            </span>
                            <ul className="space-y-2 text-xs">
                              {plan.features.map((feat, idx) => (
                                <li
                                  key={idx}
                                  className={`flex items-start gap-2 ${
                                    feat.isIncluded
                                      ? 'text-slate-200'
                                      : 'text-slate-500 line-through opacity-60'
                                  }`}
                                >
                                  {feat.isIncluded ? (
                                    <Check
                                      className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                                        isEnt
                                          ? 'text-cyan-400 font-bold'
                                          : feat.isHighlighted
                                          ? 'text-amber-400 font-bold'
                                          : 'text-emerald-400'
                                      }`}
                                    />
                                  ) : (
                                    <X className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-600" />
                                  )}
                                  <span
                                    className={`${
                                      feat.isHighlighted
                                        ? 'font-bold text-white'
                                        : 'font-normal'
                                    }`}
                                  >
                                    {feat.text}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* CTA Button */}
                        <div className="pt-5 mt-4 border-t border-white/[0.08]">
                          {isCurrent ? (
                            <button
                              disabled
                              className="w-full py-3 px-4 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-xs font-bold flex items-center justify-center gap-2 cursor-default"
                            >
                              <Check className="w-4 h-4" />
                              <span>
                                {language === 'vi' ? 'Gói Bạn Đang Dùng' : 'Current Active Plan'}
                              </span>
                            </button>
                          ) : plan.id === 'experience' ? (
                            <button
                              disabled
                              className="w-full py-3 px-4 rounded-2xl bg-white/[0.06] text-slate-300 border border-white/10 text-xs font-semibold flex items-center justify-center gap-2 cursor-default"
                            >
                              <span>{plan.ctaText}</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSelectPlan(plan)}
                              className={`w-full py-3.5 px-4 rounded-2xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 shadow-xl active:scale-95 ${
                                isEnt
                                  ? 'bg-gradient-to-r from-cyan-500 via-teal-600 to-emerald-600 hover:from-cyan-400 hover:to-emerald-500 text-white shadow-cyan-500/25 border border-cyan-300/40'
                                  : isSemi
                                  ? 'bg-gradient-to-r from-amber-500 via-purple-600 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white shadow-amber-500/25 border border-amber-300/40 ring-1 ring-white/30'
                                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/25 border border-blue-400/30'
                              }`}
                            >
                              {isEnt ? (
                                <PhoneCall className="w-4 h-4" />
                              ) : (
                                <Zap className="w-4 h-4 fill-current" />
                              )}
                              <span>{plan.ctaText}</span>
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* FAQ Tab */}
            {activeTab === 'faq' && (
              <div className="space-y-4 max-w-3xl mx-auto animate-fadeIn">
                <div className="text-center space-y-1 mb-6">
                  <h3 className="text-lg font-black text-white">
                    {language === 'vi'
                      ? 'Câu Hỏi Thường Gặp Về Gói Dịch Vụ'
                      : 'Frequently Asked Questions'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {language === 'vi'
                      ? 'Tất cả thông tin về bảo mật dữ liệu, SLA doanh nghiệp và thanh toán'
                      : 'Data privacy compliance, Enterprise SLAs and billing details'}
                  </p>
                </div>

                <div className="space-y-3">
                  {faqs.map((faq, index) => {
                    const isOpenFaq = openFaqIndex === index;
                    return (
                      <div
                        key={index}
                        className="rounded-2xl border border-white/15 bg-white/[0.04] overflow-hidden transition-colors"
                      >
                        <button
                          onClick={() => setOpenFaqIndex(isOpenFaq ? null : index)}
                          className="w-full px-5 py-4 text-left flex items-center justify-between text-xs sm:text-sm font-bold text-white hover:text-blue-300 transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <HelpCircle className="w-4 h-4 text-blue-400 shrink-0" />
                            {faq.q}
                          </span>
                          {isOpenFaq ? (
                            <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                        </button>
                        {isOpenFaq && (
                          <div className="px-5 pb-4 pt-1 text-xs text-slate-300 border-t border-white/[0.08] leading-relaxed">
                            {faq.a}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer Security Note */}
          <div className="px-6 py-3.5 border-t border-white/10 bg-slate-950/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>
                {language === 'vi'
                  ? 'Bảo mật On-Premise Local-First: 100% dữ liệu xử lý tại máy trạm của bạn'
                  : 'On-Premise Privacy Shield: 100% data processed locally in your browser/station'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-cyan-300 font-medium flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5" />
                {language === 'vi'
                  ? 'Hotline Doanh Nghiệp / Zalo: 0988.xxx.xxx'
                  : 'Enterprise Contact: enterprise@ecompulse.vn'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Checkout Preview Modal */}
      <CheckoutPreviewModal
        isOpen={!!selectedPlanForCheckout}
        onClose={() => setSelectedPlanForCheckout(null)}
        plan={selectedPlanForCheckout}
        language={language}
        onSubscriptionSuccess={(newSub) => {
          setCurrentSub(newSub);
        }}
      />
    </>
  );
};

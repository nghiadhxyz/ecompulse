import React, { useState, useEffect, useRef } from 'react';
import {
  Layers,
  CircleHelp,
  ShieldCheck,
  ReceiptText,
  Headset,
  Check,
  Star,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Menu,
  X,
  Sparkles,
  Zap,
  PhoneCall,
  Crown,
  Lock,
  ExternalLink,
  BookOpen,
  Bot,
  FileSpreadsheet,
  TrendingUp,
  BarChart3,
  Flame,
} from 'lucide-react';
import { PRICING_PLANS_VI, PRICING_FAQS_VI } from '../../data/pricingPlans';
import { PricingPlan, BillingCycle, UserSubscription } from '../../types/pricing';
import {
  getCurrentSubscription,
  subscribeToPlanChanges,
  formatVND,
} from '../../utils/subscriptionStorage';
import { CheckoutPreviewModal } from './CheckoutPreviewModal';
import dolphinAvatar from '../../assets/images/dolphin_ai_avatar_1787721342181.jpg';
import ecompulseLogo from '../../assets/images/ecompulse_dolphin_logo.png';

export interface PricingViewProps {
  onBackToHome?: () => void;
  onOpenLogin?: () => void;
  onStartTrial?: () => void;
  isModal?: boolean;
  onClose?: () => void;
  language?: 'vi' | 'en';
}

export const PricingView: React.FC<PricingViewProps> = ({
  onBackToHome,
  onOpenLogin,
  onStartTrial,
  isModal = false,
  onClose,
  language = 'vi',
}) => {
  const [activeTab, setActiveTab] = useState<'cards' | 'faq'>('cards');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('semi_annual');
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<PricingPlan | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [currentSub, setCurrentSub] = useState<UserSubscription>(() => getCurrentSubscription());

  // Navbar states
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<'products' | 'solutions' | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentSub(getCurrentSubscription());
    const unsub = subscribeToPlanChanges((sub) => {
      setCurrentSub(sub);
    });
    return () => unsub();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectPlan = (plan: PricingPlan) => {
    if (plan.id === 'experience') {
      return;
    }
    setSelectedPlanForCheckout(plan);
  };

  const handleCtaClick = (planId: string) => {
    const plan = PRICING_PLANS_VI.find((p) => p.id === planId);
    if (plan) {
      handleSelectPlan(plan);
    }
  };

  const toggleFaq = (index: number) => {
    setOpenFaqIndex((prev) => (prev === index ? null : index));
  };

  return (
    <div className={`relative w-full ${isModal ? 'bg-[#0D0922]' : 'min-h-screen bg-[#0D0922]'} text-[#F8F7FF] font-sans selection:bg-[#7C3AED] selection:text-white overflow-hidden`}>
      {/* Background Ambience Glows - Subtly placed for depth without visual noise */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#5035F5]/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-[600px] h-[600px] bg-[#7C3AED]/12 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-[450px] h-[450px] bg-[#140B30]/30 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#A855F7]/8 rounded-full blur-[180px] pointer-events-none" />

      {/* =========================================================================
          4. HEADER / NAVBAR (Rendered when full-page or standalone)
      ========================================================================= */}
      {!isModal && (
        <header className="sticky top-0 z-50 h-16 w-full bg-[#0D0922]/90 backdrop-blur-md border-b border-[rgba(168,85,247,0.2)]">
          <div className="max-w-[1440px] mx-auto h-full px-4 sm:px-8 lg:px-12 flex items-center justify-between">
            {/* Left: Brand Logo */}
            <div
              onClick={onBackToHome}
              className="flex items-center space-x-3 cursor-pointer group select-none"
            >
              <div className="w-10 h-10 rounded-xl bg-[#1B1238] border border-[#22D3EE]/50 flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.35)] group-hover:scale-105 transition-transform duration-200">
                <img
                  src={ecompulseLogo}
                  alt="EcomPulse AI Logo"
                  className="w-full h-full object-contain p-1"
                />
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="text-xl font-black text-white tracking-tight">EcomPulse</span>
                <span className="text-xl font-black bg-gradient-to-r from-[#22D3EE] to-[#A855F7] bg-clip-text text-transparent">
                  AI
                </span>
              </div>
            </div>

            {/* Center: Navigation Links (Desktop) */}
            <nav ref={dropdownRef} className="hidden lg:flex items-center space-x-8 text-sm font-medium text-[#C5BDD9]">
              {/* Dropdown Sản Phẩm */}
              <div className="relative">
                <button
                  onClick={() =>
                    setActiveDropdown((prev) => (prev === 'products' ? null : 'products'))
                  }
                  className={`flex items-center gap-1.5 transition-colors duration-200 py-1 ${
                    activeDropdown === 'products' ? 'text-[#F8F7FF]' : 'hover:text-[#F8F7FF]'
                  }`}
                >
                  <span>Sản phẩm</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      activeDropdown === 'products' ? 'rotate-180 text-[#22D3EE]' : ''
                    }`}
                  />
                </button>

                {activeDropdown === 'products' && (
                  <div className="absolute top-full left-0 mt-2 w-72 rounded-2xl bg-[#1B1238] border border-[rgba(168,85,247,0.3)] shadow-2xl p-2.5 space-y-1 z-50 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                    <button
                      onClick={() => {
                        setActiveDropdown(null);
                        if (onBackToHome) onBackToHome();
                      }}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-[#7C3AED]/20 transition-colors flex items-start gap-3 group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#5035F5]/30 border border-[#8735F5]/40 flex items-center justify-center text-[#22D3EE] shrink-0 mt-0.5">
                        <BarChart3 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white group-hover:text-[#22D3EE] transition-colors">
                          Phân hệ Sàn TMĐT
                        </div>
                        <div className="text-xs text-[#C5BDD9]">
                          Bóc tách rò rỉ Shopee, TikTok Shop, Lazada
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setActiveDropdown(null);
                        if (onBackToHome) onBackToHome();
                      }}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-[#7C3AED]/20 transition-colors flex items-start gap-3 group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#7C3AED]/30 border border-[#A855F7]/40 flex items-center justify-center text-[#A855F7] shrink-0 mt-0.5">
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white group-hover:text-[#A855F7] transition-colors">
                          Tài chính P&L 53 Cột
                        </div>
                        <div className="text-xs text-[#C5BDD9]">
                          Đối soát dòng tiền nội bộ & COGS
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setActiveDropdown(null);
                        if (onBackToHome) onBackToHome();
                      }}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-[#7C3AED]/20 transition-colors flex items-start gap-3 group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#D946EF]/30 border border-[#D946EF]/40 flex items-center justify-center text-[#D946EF] shrink-0 mt-0.5">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white group-hover:text-[#D946EF] transition-colors">
                          Dolphin AI RAG
                        </div>
                        <div className="text-xs text-[#C5BDD9]">
                          Trợ lý hỏi đáp số liệu thời gian thực
                        </div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Dropdown Giải Pháp */}
              <div className="relative">
                <button
                  onClick={() =>
                    setActiveDropdown((prev) => (prev === 'solutions' ? null : 'solutions'))
                  }
                  className={`flex items-center gap-1.5 transition-colors duration-200 py-1 ${
                    activeDropdown === 'solutions' ? 'text-[#F8F7FF]' : 'hover:text-[#F8F7FF]'
                  }`}
                >
                  <span>Giải pháp</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      activeDropdown === 'solutions' ? 'rotate-180 text-[#22D3EE]' : ''
                    }`}
                  />
                </button>

                {activeDropdown === 'solutions' && (
                  <div className="absolute top-full left-0 mt-2 w-72 rounded-2xl bg-[#1B1238] border border-[rgba(168,85,247,0.3)] shadow-2xl p-2.5 space-y-1 z-50 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                    <button
                      onClick={() => setActiveDropdown(null)}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-[#7C3AED]/20 transition-colors flex items-start gap-3 group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#22D3EE]/20 border border-[#22D3EE]/40 flex items-center justify-center text-[#22D3EE] shrink-0 mt-0.5">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white group-hover:text-[#22D3EE]">
                          Shop cá nhân & SMEs
                        </div>
                        <div className="text-xs text-[#C5BDD9]">
                          Tối ưu chi phí linh hoạt 1-3 sàn
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveDropdown(null)}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-[#7C3AED]/20 transition-colors flex items-start gap-3 group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#A855F7]/20 border border-[#A855F7]/40 flex items-center justify-center text-[#A855F7] shrink-0 mt-0.5">
                        <Crown className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white group-hover:text-[#A855F7]">
                          Brands & Agencies
                        </div>
                        <div className="text-xs text-[#C5BDD9]">
                          Quản lý đa gian hàng & API riêng
                        </div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Bảng giá (ACTIVE MENU ITEM) */}
              <button
                onClick={() => {
                  setActiveTab('cards');
                  setActiveDropdown(null);
                }}
                className="relative py-1 text-[#F8F7FF] font-semibold transition-colors flex items-center"
              >
                <span>Bảng giá</span>
                {/* Active Underline Tím phát sáng nhẹ */}
                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-[#22D3EE] via-[#A855F7] to-[#D946EF] rounded-full shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
              </button>

              {/* Tài liệu */}
              <button
                onClick={() => {
                  setActiveDropdown(null);
                  setActiveTab('faq');
                }}
                className="hover:text-[#F8F7FF] transition-colors py-1"
              >
                Tài liệu
              </button>

              {/* Hỗ trợ */}
              <button
                onClick={() => {
                  setActiveDropdown(null);
                  setActiveTab('faq');
                }}
                className="hover:text-[#F8F7FF] transition-colors py-1"
              >
                Hỗ trợ
              </button>
            </nav>

            {/* Right: Auth & Action CTAs */}
            <div className="hidden sm:flex items-center space-x-3">
              <button
                onClick={onOpenLogin || onStartTrial}
                className="px-4 py-2 rounded-xl border border-[rgba(168,85,247,0.5)] text-[#F8F7FF] hover:bg-[#7C3AED]/20 text-sm font-semibold transition-all duration-200 active:scale-95"
              >
                Đăng nhập
              </button>

              <button
                onClick={onStartTrial || onBackToHome}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#5035F5] via-[#8735F5] to-[#C026F2] hover:brightness-110 text-white text-sm font-bold shadow-lg shadow-purple-600/30 flex items-center gap-1.5 transition-all duration-200 active:scale-95"
              >
                <span>Dùng thử miễn phí</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-[#F8F7FF] transition-colors"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Navigation Drawer */}
          {isMobileMenuOpen && (
            <div className="lg:hidden absolute top-16 left-0 w-full bg-[#140B30]/98 border-b border-[rgba(168,85,247,0.3)] shadow-2xl p-5 space-y-4 backdrop-blur-2xl z-50 animate-in slide-in-from-top-4 duration-200">
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    if (onBackToHome) onBackToHome();
                  }}
                  className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-[#7C3AED]/20 text-sm font-semibold text-white"
                >
                  Trang chủ
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setActiveTab('cards');
                  }}
                  className="w-full text-left py-2.5 px-3 rounded-xl bg-[#7C3AED]/25 text-sm font-bold text-[#22D3EE] border border-[#22D3EE]/40"
                >
                  Bảng giá & Các gói
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setActiveTab('faq');
                  }}
                  className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-[#7C3AED]/20 text-sm font-semibold text-[#C5BDD9]"
                >
                  Câu hỏi thường gặp (FAQ)
                </button>
              </div>

              <div className="pt-3 border-t border-[rgba(168,85,247,0.2)] flex flex-col gap-2.5">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    if (onOpenLogin) onOpenLogin();
                  }}
                  className="w-full py-2.5 rounded-xl border border-[rgba(168,85,247,0.5)] text-center text-sm font-semibold text-white hover:bg-[#7C3AED]/20"
                >
                  Đăng nhập
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    if (onStartTrial) onStartTrial();
                  }}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#5035F5] via-[#8735F5] to-[#C026F2] text-center text-sm font-bold text-white shadow-lg flex items-center justify-center gap-2"
                >
                  <span>Dùng thử miễn phí</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </header>
      )}

      {/* Modal Close Header (When displayed inside modal dialog) */}
      {isModal && (
        <div className="px-6 py-4 border-b border-[rgba(168,85,247,0.2)] flex items-center justify-between bg-[#140B30]/80">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#1B1238] border border-[#22D3EE]/50 flex items-center justify-center shadow-[0_0_12px_rgba(34,211,238,0.3)]">
              <img src={ecompulseLogo} alt="EcomPulse" className="w-full h-full object-contain p-1" />
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="text-lg font-black text-white">EcomPulse</span>
              <span className="text-lg font-black bg-gradient-to-r from-[#22D3EE] to-[#A855F7] bg-clip-text text-transparent">
                AI
              </span>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[#C5BDD9] hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {/* =========================================================================
          MAIN CONTAINER
      ========================================================================= */}
      <main className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-12 py-10 sm:py-14">
        {/* =========================================================================
            5. KHU VỰC TIÊU ĐỀ
        ========================================================================= */}
        <section className="text-center space-y-3 sm:space-y-4 max-w-4xl mx-auto mb-10 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-[40px] font-extrabold sm:font-black tracking-tight text-[#F8F7FF] leading-tight">
            Bảng Giá & Các Gói Dịch Vụ EcomPulse{' '}
            <span className="bg-gradient-to-r from-[#22D3EE] to-[#A855F7] bg-clip-text text-transparent">
              AI
            </span>
          </h1>

          <p className="text-[14px] sm:text-[15px] text-[#C5BDD9] max-w-2xl mx-auto leading-relaxed">
            Giải pháp phân tích doanh thu TMĐT, bóc tách rủi ro và ra quyết định thông minh bằng AI.
          </p>

          {/* Hàng điều khiển (Tabs & Chu kỳ thanh toán) */}
          <div className="pt-4 flex flex-col md:flex-row items-center justify-between gap-4 border-t border-[rgba(168,85,247,0.2)] mt-6">
            {/* Bên trái: Tabs điều khiển */}
            <div className="flex items-center gap-2 bg-[#1B1238] p-1.5 rounded-2xl border border-[rgba(168,85,247,0.3)] shadow-inner">
              <button
                onClick={() => setActiveTab('cards')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center gap-2 ${
                  activeTab === 'cards'
                    ? 'bg-gradient-to-r from-[#5035F5] via-[#8735F5] to-[#C026F2] text-white shadow-md shadow-purple-900/50'
                    : 'text-[#C5BDD9] hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Các Gói Dịch Vụ (4 Gói)</span>
              </button>

              <button
                onClick={() => setActiveTab('faq')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center gap-2 ${
                  activeTab === 'faq'
                    ? 'bg-gradient-to-r from-[#5035F5] via-[#8735F5] to-[#C026F2] text-white shadow-md shadow-purple-900/50'
                    : 'text-[#C5BDD9] hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <CircleHelp className="w-4 h-4" />
                <span>Câu Hỏi Thường Gặp (FAQ)</span>
              </button>
            </div>

            {/* Bên phải: Chu kỳ thanh toán Segmented Control */}
            <div className="flex items-center gap-3">
              <span className="text-xs sm:text-sm text-[#C5BDD9] font-medium">Chu kỳ thanh toán:</span>
              <div className="flex items-center bg-[#1B1238] p-1 rounded-2xl border border-[rgba(168,85,247,0.3)] shadow-inner">
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 ${
                    billingCycle === 'monthly'
                      ? 'bg-[#7C3AED]/40 text-white border border-[#A855F7]/40 shadow-sm'
                      : 'text-[#C5BDD9] hover:text-white'
                  }`}
                >
                  Theo tháng
                </button>
                <button
                  onClick={() => setBillingCycle('semi_annual')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center gap-1.5 ${
                    billingCycle === 'semi_annual'
                      ? 'bg-[#7C3AED]/40 text-white border border-[#A855F7]/40 shadow-sm'
                      : 'text-[#C5BDD9] hover:text-white'
                  }`}
                >
                  <span>6 Tháng</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#34F5AC]/20 text-[#34F5AC] font-black border border-[#34F5AC]/40">
                    -67%
                  </span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            6. PRICING CARDS (TAB 1: CÁC GÓI DỊCH VỤ)
        ========================================================================= */}
        {activeTab === 'cards' && (
          <section className="space-y-12 animate-in fade-in duration-300">
            {/* 4 Cards Grid - desktop: repeat(4, minmax(0, 1fr)), gap: 16-18px */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-[18px] items-stretch">
              {/* =================================================================
                  CARD 1 — GÓI EXPERIENCE
              ================================================================= */}
              <div className="relative rounded-[24px] p-6 bg-gradient-to-b from-[#21133F] to-[#15102D] border border-[rgba(168,85,247,0.3)] flex flex-col justify-between transition-all duration-200 hover:border-[#A855F7]/60">
                <div>
                  {/* Badge xanh lá: KHỞI ĐẦU MIỄN PHÍ */}
                  <div className="mb-4">
                    <span className="inline-block px-3 py-1 rounded-full text-[11px] font-black tracking-wider uppercase bg-[#34F5AC]/15 text-[#34F5AC] border border-[#34F5AC]/40">
                      KHỞI ĐẦU MIỄN PHÍ
                    </span>
                  </div>

                  {/* Tên & Mô tả */}
                  <h3 className="text-[24px] font-bold text-[#F8F7FF] leading-snug">Gói Experience</h3>
                  <p className="text-[13.5px] text-[#C5BDD9] mt-2 min-h-[42px] leading-relaxed">
                    Shop mới, cá nhân muốn trải nghiệm thử công cụ.
                  </p>

                  {/* Giá & Đơn vị */}
                  <div className="mt-4 pt-3 border-t border-[rgba(168,85,247,0.25)]">
                    <div className="text-[30px] font-extrabold text-[#F8F7FF] tracking-tight">0 VNĐ</div>
                    <div className="text-[13.5px] text-[#C5BDD9] mt-0.5">Miễn phí trọn đời</div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-[rgba(168,85,247,0.25)] my-4" />

                  {/* Tiêu đề & Danh sách tính năng */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#C5BDD9] block">
                      Tính năng nổi bật:
                    </span>
                    <ul className="space-y-2.5 text-[14px]">
                      <li className="flex items-start gap-2.5 text-[#F8F7FF]">
                        <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#34F5AC]" />
                        <span>Upload file Excel thủ công (tối đa 3 lần/tháng).</span>
                      </li>
                      <li className="flex items-start gap-2.5 text-[#F8F7FF]">
                        <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#34F5AC]" />
                        <span>Xem Dashboard Net Cash Flow & phân rủi ro cơ bản.</span>
                      </li>
                      <li className="flex items-start gap-2.5 text-[#F8F7FF]">
                        <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#34F5AC]" />
                        <span>Xuất báo cáo 3 Tab ra Google Sheets.</span>
                      </li>
                      <li className="flex items-start gap-2.5 text-[#F8F7FF]">
                        <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#34F5AC]" />
                        <span>Hỗ trợ qua tài liệu hướng dẫn và cộng đồng.</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* CTA Card 1 */}
                <div className="pt-6 mt-auto">
                  <button
                    disabled
                    className="w-full py-3.5 px-4 rounded-xl border-2 border-[#34F5AC]/70 text-[#34F5AC] bg-[#34F5AC]/10 font-bold text-sm flex items-center justify-center gap-2 cursor-default transition-all"
                  >
                    <Check className="w-4 h-4 text-[#34F5AC]" />
                    <span>Gói Bạn Đang Dùng</span>
                  </button>
                </div>
              </div>

              {/* =================================================================
                  CARD 2 — GÓI PRO MONTHLY
              ================================================================= */}
              <div className="relative rounded-[24px] p-6 bg-gradient-to-b from-[#21133F] to-[#15102D] border border-[rgba(168,85,247,0.3)] flex flex-col justify-between transition-all duration-200 hover:border-[#A855F7]/70">
                <div>
                  {/* Badge tím: PHỔ BIẾN NHẤT */}
                  <div className="mb-4">
                    <span className="inline-block px-3 py-1 rounded-full text-[11px] font-black tracking-wider uppercase bg-[#7C3AED]/30 text-[#D946EF] border border-[#A855F7]/50">
                      PHỔ BIẾN NHẤT
                    </span>
                  </div>

                  {/* Tên & Mô tả */}
                  <h3 className="text-[24px] font-bold text-[#F8F7FF] leading-snug">Gói Pro Monthly</h3>
                  <p className="text-[13.5px] text-[#C5BDD9] mt-2 min-h-[42px] leading-relaxed">
                    Shop cá nhân, SMEs đang bán trên 1–3 sàn muốn linh hoạt chi phí.
                  </p>

                  {/* Giá & Đơn vị */}
                  <div className="mt-4 pt-3 border-t border-[rgba(168,85,247,0.25)]">
                    <div className="text-[30px] font-extrabold text-[#F8F7FF] tracking-tight">299.000 đ</div>
                    <div className="text-[13.5px] text-[#C5BDD9] mt-0.5">VNĐ / tháng</div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-[rgba(168,85,247,0.25)] my-4" />

                  {/* Tiêu đề & Danh sách tính năng */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#C5BDD9] block">
                      Tính năng nổi bật:
                    </span>
                    <ul className="space-y-2.5 text-[14px]">
                      <li className="flex items-start gap-2.5 text-[#F8F7FF]">
                        <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#34F5AC]" />
                        <span>Upload file Excel không giới hạn + Auto-fetch dữ liệu qua Email.</span>
                      </li>
                      <li className="flex items-start gap-2.5 text-[#F8F7FF]">
                        <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#34F5AC]" />
                        <span>Mở khóa trọn bộ Dolphin AI RAG Chatbot (Hỏi đáp dữ liệu shop).</span>
                      </li>
                      <li className="flex items-start gap-2.5 text-[#F8F7FF]">
                        <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#34F5AC]" />
                        <span>Trích xuất bộ AI Priority Action Cards & Simulator "What-if" dự báo lợi nhuận.</span>
                      </li>
                      <li className="flex items-start gap-2.5 text-[#F8F7FF]">
                        <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#34F5AC]" />
                        <span>Gmail Critical Alert (Cảnh báo khi đơn hụt/COD &gt; 15% hoặc Ads ăn lỗ).</span>
                      </li>
                      <li className="flex items-start gap-2.5 text-[#F8F7FF]">
                        <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#34F5AC]" />
                        <span>Đồng bộ Google Calendar 1-Click.</span>
                      </li>
                      <li className="flex items-start gap-2.5 text-[#F8F7FF]">
                        <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#34F5AC]" />
                        <span>Xuất báo cáo 3 Tab ra Google Sheets.</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* CTA Card 2 */}
                <div className="pt-6 mt-auto">
                  <button
                    onClick={() => handleCtaClick('pro_monthly')}
                    className="w-full py-3.5 px-4 rounded-xl text-white font-bold text-sm shadow-lg shadow-purple-900/40 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                    style={{
                      background: 'linear-gradient(110deg, #5035F5 0%, #8735F5 50%, #C026F2 100%)',
                    }}
                  >
                    <span>Đăng Ký Gói Tháng (299.000đ)</span>
                  </button>
                </div>
              </div>

              {/* =================================================================
                  CARD 3 — GÓI PRO SEMI-ANNUAL (NỔI BẬT NHẤT TRANG)
              ================================================================= */}
              <div className="relative rounded-[24px] p-[1.5px] bg-gradient-to-b from-[#22D3EE] via-[#A855F7] to-[#D946EF] shadow-[0_0_35px_rgba(168,85,247,0.32)] flex flex-col">
                <div className="rounded-[22.5px] p-6 bg-gradient-to-b from-[#21133F] to-[#15102D] flex-1 flex flex-col justify-between">
                  <div>
                    {/* Badge cyan có icon Star: KHUYÊN DÙNG NHẤT */}
                    <div className="mb-4">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black tracking-wider uppercase bg-[#22D3EE]/20 text-[#22D3EE] border border-[#22D3EE]/60">
                        <Star className="w-3.5 h-3.5 fill-[#22D3EE] text-[#22D3EE]" />
                        <span>KHUYÊN DÙNG NHẤT</span>
                      </span>
                    </div>

                    {/* Tên & Mô tả */}
                    <h3 className="text-[24px] font-bold text-[#F8F7FF] leading-snug">Gói Pro Semi-Annual</h3>
                    <p className="text-[13.5px] text-[#C5BDD9] mt-2 min-h-[42px] leading-relaxed">
                      Nhà bán hàng chiến lược, gian hàng lớn muốn cam kết đồng hành dài hạn và tự động hóa.
                    </p>

                    {/* Giá cũ gạch ngang & Giá mới & Đơn vị */}
                    <div className="mt-4 pt-3 border-t border-[rgba(168,85,247,0.25)] space-y-1">
                      <div className="text-xs sm:text-sm text-slate-400 line-through">1.794.000 đ</div>
                      <div className="text-[30px] font-extrabold text-[#22D3EE] tracking-tight">599.000 đ</div>
                      <div className="text-[13.5px] text-[#C5BDD9]">VNĐ / 6 tháng (= 99.800đ/tháng)</div>
                      <div className="pt-1">
                        <span className="inline-block text-xs font-bold text-[#34F5AC] bg-[#34F5AC]/15 border border-[#34F5AC]/30 px-2 py-0.5 rounded-full">
                          Tiết kiệm ~67% so với gói tháng
                        </span>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-[rgba(168,85,247,0.25)] my-4" />

                    {/* Tiêu đề & Danh sách tính năng */}
                    <div className="space-y-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#C5BDD9] block">
                        Tính năng nổi bật:
                      </span>
                      <ul className="space-y-2.5 text-[14px]">
                        <li className="flex items-start gap-2.5 text-[#F8F7FF] font-semibold">
                          <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#34F5AC]" />
                          <span>Bao gồm toàn bộ tính năng của Gói Pro Monthly.</span>
                        </li>
                        <li className="flex items-start gap-2.5 text-[#F8F7FF]">
                          <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#34F5AC]" />
                          <span>Tự động đồng bộ dữ liệu qua Partner Open API (Shopee, TikTok Shop).</span>
                        </li>
                        <li className="flex items-start gap-2.5 text-[#F8F7FF]">
                          <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#34F5AC]" />
                          <span>Dự báo tồn kho thông minh (Predictive Inventory / Phát hiện SKU Zombie).</span>
                        </li>
                        <li className="flex items-start gap-2.5 text-[#F8F7FF]">
                          <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#34F5AC]" />
                          <span>Phân tích xu hướng tài chính đa thời gian (Time-series RAG).</span>
                        </li>
                        <li className="flex items-start gap-2.5 text-[#F8F7FF]">
                          <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#34F5AC]" />
                          <span>Ưu tiên hỗ trợ kỹ thuật 1–1 trực tiếp qua Zalo.</span>
                        </li>
                        <li className="flex items-start gap-2.5 text-[#F8F7FF]">
                          <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#34F5AC]" />
                          <span>Upload file Excel không giới hạn + Auto-fetch Email.</span>
                        </li>
                        <li className="flex items-start gap-2.5 text-[#F8F7FF]">
                          <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#34F5AC]" />
                          <span>Trọn bộ Dolphin AI RAG Chatbot & Action Cards.</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* CTA Card 3 */}
                  <div className="pt-6 mt-auto">
                    <button
                      onClick={() => handleCtaClick('pro_semi_annual')}
                      className="w-full py-3.5 px-4 rounded-xl text-white font-bold text-sm shadow-xl shadow-purple-600/40 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                      style={{
                        background: 'linear-gradient(110deg, #5035F5 0%, #8735F5 50%, #C026F2 100%)',
                      }}
                    >
                      <span>Nâng Cấp Gói 6 Tháng (599.000đ)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* =================================================================
                  CARD 4 — GÓI ENTERPRISE
              ================================================================= */}
              <div className="relative rounded-[24px] p-6 bg-gradient-to-b from-[#21133F] to-[#15102D] border border-[rgba(168,85,247,0.3)] flex flex-col justify-between transition-all duration-200 hover:border-[#22D3EE]/60">
                <div>
                  {/* Badge: DOANH NGHIỆP & AGENCY */}
                  <div className="mb-4">
                    <span className="inline-block px-3 py-1 rounded-full text-[11px] font-black tracking-wider uppercase bg-[#22D3EE]/15 text-[#22D3EE] border border-[#22D3EE]/40">
                      DOANH NGHIỆP & AGENCY
                    </span>
                  </div>

                  {/* Tên & Mô tả */}
                  <h3 className="text-[24px] font-bold text-[#F8F7FF] leading-snug">Gói Enterprise</h3>
                  <p className="text-[13.5px] text-[#C5BDD9] mt-2 min-h-[42px] leading-relaxed">
                    Thương hiệu lớn (Brands), Agencies quản lý nhiều gian hàng.
                  </p>

                  {/* Giá & Đơn vị */}
                  <div className="mt-4 pt-3 border-t border-[rgba(168,85,247,0.25)]">
                    <div className="text-[30px] font-extrabold text-[#22D3EE] tracking-tight">Báo Giá Riêng</div>
                    <div className="text-[13.5px] text-[#C5BDD9] mt-0.5">Báo giá riêng (Quý / Năm)</div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-[rgba(168,85,247,0.25)] my-4" />

                  {/* Tiêu đề & Danh sách tính năng */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#C5BDD9] block">
                      Tính năng nổi bật:
                    </span>
                    <ul className="space-y-2.5 text-[14px]">
                      <li className="flex items-start gap-2.5 text-[#F8F7FF] font-semibold">
                        <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#34F5AC]" />
                        <span>Bao gồm toàn bộ tính năng của Gói Pro Semi-Annual.</span>
                      </li>
                      <li className="flex items-start gap-2.5 text-[#F8F7FF]">
                        <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#34F5AC]" />
                        <span>Tích hợp API riêng (Custom API Integration & Data Pipeline).</span>
                      </li>
                      <li className="flex items-start gap-2.5 text-[#F8F7FF]">
                        <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#34F5AC]" />
                        <span>Multimodal AI: Chụp ảnh/PDF tự động bóc tách hóa đơn nhập kho COGS.</span>
                      </li>
                      <li className="flex items-start gap-2.5 text-[#F8F7FF]">
                        <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#34F5AC]" />
                        <span>Báo cáo Benchmark so sánh trung bình toàn ngành hàng.</span>
                      </li>
                      <li className="flex items-start gap-2.5 text-[#F8F7FF]">
                        <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#34F5AC]" />
                        <span>Cảnh báo rủi ro tùy biến theo SLA riêng (Zalo Webhook / Telegram / Email).</span>
                      </li>
                      <li className="flex items-start gap-2.5 text-[#F8F7FF]">
                        <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#34F5AC]" />
                        <span>Cam kết hạ tầng bảo mật On-Premise Local-First bảo vệ quyền trách tuyệt đối.</span>
                      </li>
                      <li className="flex items-start gap-2.5 text-[#F8F7FF]">
                        <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#34F5AC]" />
                        <span>Kỹ sư giải pháp chuyên trách hỗ trợ kỹ thuật và bảo hành riêng 24/7.</span>
                      </li>
                      <li className="flex items-start gap-2.5 text-[#F8F7FF]">
                        <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#34F5AC]" />
                        <span>Quản lý đa gian hàng & phân quyền tài khoản thành viên nhóm.</span>
                      </li>
                      <li className="flex items-start gap-2.5 text-[#F8F7FF]">
                        <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#34F5AC]" />
                        <span>Ký hợp đồng dịch vụ doanh nghiệp & Xuất hóa đơn VAT đầy đủ.</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* CTA Card 4 */}
                <div className="pt-6 mt-auto">
                  <button
                    onClick={() => handleCtaClick('enterprise')}
                    className="w-full py-3.5 px-4 rounded-xl border-2 border-[#A855F7] text-[#F8F7FF] hover:bg-[#7C3AED]/25 font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    <span>Liên Hệ Báo Giá Doanh Nghiệp</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* =========================================================================
            FAQ ACCORDION (TAB 2: CÂU HỎI THƯỜNG GẶP)
        ========================================================================= */}
        {activeTab === 'faq' && (
          <section className="space-y-6 max-w-3xl mx-auto animate-in fade-in duration-300">
            <div className="text-center space-y-2 mb-8">
              <h2 className="text-2xl font-bold text-[#F8F7FF]">Câu Hỏi Thường Gặp (FAQ)</h2>
              <p className="text-sm text-[#C5BDD9]">
                Mọi thông tin chi tiết về chính sách nâng cấp gói, bảo mật On-Premise và phương thức thanh toán.
              </p>
            </div>

            <div className="space-y-3.5">
              {PRICING_FAQS_VI.map((faq, index) => {
                const isOpen = openFaqIndex === index;
                return (
                  <div
                    key={index}
                    className="rounded-2xl bg-[#1B1238] border border-[rgba(168,85,247,0.3)] overflow-hidden transition-all duration-200"
                  >
                    <button
                      onClick={() => toggleFaq(index)}
                      className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 hover:bg-white/[0.03] transition-colors"
                    >
                      <span className="font-bold text-sm sm:text-base text-[#F8F7FF] flex items-center gap-3">
                        <span className="w-6 h-6 rounded-lg bg-[#7C3AED]/30 text-[#22D3EE] border border-[#A855F7]/30 flex items-center justify-center text-xs font-black shrink-0">
                          {index + 1}
                        </span>
                        {faq.q}
                      </span>
                      {isOpen ? (
                        <ChevronUp className="w-5 h-5 text-[#22D3EE] shrink-0" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-[#C5BDD9] shrink-0" />
                      )}
                    </button>

                    {isOpen && (
                      <div className="px-5 pb-5 pt-1 text-sm text-[#C5BDD9] leading-relaxed border-t border-[rgba(168,85,247,0.15)] animate-in fade-in duration-200">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* =========================================================================
            8. TRUST SECTION
        ========================================================================= */}
        <section className="mt-14 pt-12 border-t border-[rgba(168,85,247,0.3)]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* 1. Thanh toán an toàn & bảo mật */}
            <div className="flex items-start gap-4 text-left">
              <div className="w-12 h-12 rounded-2xl bg-[#1B1238] border border-[rgba(168,85,247,0.4)] flex items-center justify-center text-[#A855F7] shrink-0 shadow-lg shadow-purple-950/40">
                <ShieldCheck className="w-6 h-6 text-[#A855F7]" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-[#F8F7FF]">Thanh toán an toàn & bảo mật</h4>
                <p className="text-sm text-[#C5BDD9] leading-relaxed">
                  Áp dụng các tiêu chuẩn bảo mật quốc tế (SSL, mã hóa dữ liệu).
                </p>
              </div>
            </div>

            {/* 2. Minh bạch & linh hoạt */}
            <div className="flex items-start gap-4 text-left">
              <div className="w-12 h-12 rounded-2xl bg-[#1B1238] border border-[rgba(168,85,247,0.4)] flex items-center justify-center text-[#A855F7] shrink-0 shadow-lg shadow-purple-950/40">
                <ReceiptText className="w-6 h-6 text-[#A855F7]" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-[#F8F7FF]">Minh bạch & linh hoạt</h4>
                <p className="text-sm text-[#C5BDD9] leading-relaxed">
                  Giá rõ ràng, không phí ẩn. Dễ dàng nâng cấp hoặc hạ gói.
                </p>
              </div>
            </div>

            {/* 3. Hỗ trợ tận tâm */}
            <div className="flex items-start gap-4 text-left">
              <div className="w-12 h-12 rounded-2xl bg-[#1B1238] border border-[rgba(168,85,247,0.4)] flex items-center justify-center text-[#A855F7] shrink-0 shadow-lg shadow-purple-950/40">
                <Headset className="w-6 h-6 text-[#A855F7]" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-[#F8F7FF]">Hỗ trợ tận tâm</h4>
                <p className="text-sm text-[#C5BDD9] leading-relaxed">
                  Đội ngũ EcomPulse luôn sẵn sàng hỗ trợ bạn trong suốt quá trình sử dụng.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* =========================================================================
          CHECKOUT PREVIEW MODAL (WIRED TO CTAS)
      ========================================================================= */}
      <CheckoutPreviewModal
        isOpen={!!selectedPlanForCheckout}
        onClose={() => setSelectedPlanForCheckout(null)}
        plan={selectedPlanForCheckout}
        language={language}
        onSubscriptionSuccess={(newSub) => {
          setCurrentSub(newSub);
          setSelectedPlanForCheckout(null);
        }}
      />
    </div>
  );
};

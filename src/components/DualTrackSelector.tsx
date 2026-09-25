import React, { useState } from 'react';
import {
  ShoppingBag,
  TrendingUp,
  DollarSign,
  PieChart as PieIcon,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Zap,
  Play,
  Check,
  CheckCircle2,
  Building2,
  Calendar,
  Mail,
  Bot,
  BarChart3,
  X,
  FileSpreadsheet,
  Layers,
  ChevronRight,
  Flame,
  Award,
  Lock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { ShopeeLogo, TikTokShopLogo } from './PlatformLogos';
import { GoogleUserProfile, ParsedStoreData } from '../types';
import dolphinAvatar from '../assets/images/dolphin_ai_avatar_1787721342181.jpg';
import ecompulseAvatar from '../assets/images/ecompulse_avatar_1787721096722.jpg';
import ecompulseDolphinLogo from '../assets/images/ecompulse_dolphin_logo.png';
import { SAMPLE_DATASETS } from '../data/sampleDatasets';
import { PricingPlansModal } from './pricing/PricingPlansModal';
import { FeaturesView } from './FeaturesView';
import { DolphinChatModal } from './chat/DolphinChatModal';
import { DolphinOnboardingTourModal } from './onboarding/DolphinOnboardingTourModal';
import { DolphinFloatingWidget } from './chat/DolphinFloatingWidget';

export type AnalysisTrack = 'portal' | 'marketplace' | 'internal_finance';

interface DualTrackSelectorProps {
  onSelectTrack: (track: 'marketplace' | 'internal_finance') => void;
  onLoadDemoSample?: (sampleData: ParsedStoreData) => void;
  onOpenUpload?: () => void;
  onOpenLogin?: () => void;
  data?: ParsedStoreData | null;
  currentUser?: GoogleUserProfile | null;
  language?: 'vi' | 'en';
}

const DONUT_COLORS = ['#fb923c', '#38bdf8', '#a78bfa'];

const MOCK_AREA_DATA = [
  { month: 'T7', revenue: 780, profit: 110 },
  { month: 'T8', revenue: 920, profit: 135 },
  { month: 'T9', revenue: 860, profit: 125 },
  { month: 'T10', revenue: 1140, profit: 165 },
  { month: 'T11', revenue: 1080, profit: 155 },
  { month: 'T12', revenue: 1248, profit: 182 },
];

const MOCK_PIE_DATA = [
  { name: 'Shopee', value: 58.5 },
  { name: 'TikTok Shop', value: 33.5 },
  { name: 'Khác', value: 8.0 },
];

export const DualTrackSelector: React.FC<DualTrackSelectorProps> = ({
  onSelectTrack,
  onLoadDemoSample,
  onOpenUpload,
  onOpenLogin,
  data,
  currentUser,
  language = 'vi',
}) => {
  const [showTrackModal, setShowTrackModal] = useState<boolean>(false);
  const [showPricingModal, setShowPricingModal] = useState<boolean>(false);
  const [showDolphinChat, setShowDolphinChat] = useState<boolean>(false);
  const [showTourModal, setShowTourModal] = useState<boolean>(false);
  const [chatPrompt, setChatPrompt] = useState<string | undefined>(undefined);
  const [activeNav, setActiveNav] = useState<'home' | 'features' | 'pricing' | 'support'>('home');

  const handleOpenChatWithPrompt = (prompt: string) => {
    setChatPrompt(prompt);
    setShowDolphinChat(true);
  };

  const handleStartClick = () => {
    setShowTrackModal(true);
  };

  const handleDemoClick = () => {
    const demoData = SAMPLE_DATASETS['mega-8-8'] || Object.values(SAMPLE_DATASETS)[0];
    if (onLoadDemoSample) {
      onLoadDemoSample(demoData);
    } else {
      onSelectTrack('marketplace');
    }
  };

  return (
    <div className="relative min-h-screen text-slate-100 flex flex-col justify-between selection:bg-purple-500 selection:text-white overflow-hidden pb-12">
      {/* Background Ambience Glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-[600px] h-[600px] bg-purple-600/15 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-[450px] h-[450px] bg-indigo-600/10 rounded-full blur-[130px] pointer-events-none" />

      {/* =========================================================================
          1. TOP NAVIGATION BAR
      ========================================================================= */}
      <header className="relative z-30 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => setActiveNav('home')}>
          <div className="relative w-11 h-11 rounded-2xl overflow-hidden shadow-lg shadow-cyan-500/25 ring-2 ring-cyan-400/50 bg-[#080d24] flex items-center justify-center group-hover:scale-105 transition-transform">
            <img
              src={ecompulseDolphinLogo}
              alt="EcomPulse AI Logo"
              className="w-full h-full object-contain p-0.5"
            />
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="text-xl font-black text-white tracking-tight font-sans">EcomPulse</span>
            <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 font-sans">AI</span>
          </div>
        </div>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center space-x-8">
          <button
            onClick={() => setActiveNav('home')}
            className={`text-xs font-bold transition-all relative py-1 ${
              activeNav === 'home'
                ? 'text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Trang chủ
            {activeNav === 'home' && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full shadow-sm shadow-cyan-400" />
            )}
          </button>

          <button
            onClick={() => setActiveNav('features')}
            className={`text-xs font-bold transition-all relative py-1 ${
              activeNav === 'features'
                ? 'text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Tính năng
            {activeNav === 'features' && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full shadow-sm shadow-cyan-400" />
            )}
          </button>

          <button
            onClick={() => setShowTourModal(true)}
            className="text-xs font-semibold text-cyan-300 hover:text-white transition-colors flex items-center space-x-1"
          >
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>Tour 1 phút</span>
          </button>

          <button
            onClick={() => setShowPricingModal(true)}
            className="text-xs font-semibold text-slate-300 hover:text-white transition-colors"
          >
            Gói dịch vụ
          </button>

          <button
            onClick={() => setShowDolphinChat(true)}
            className="text-xs font-semibold text-slate-300 hover:text-white transition-colors flex items-center space-x-1"
          >
            <span>Hỗ trợ AI</span>
            <Bot className="w-3.5 h-3.5 text-purple-400" />
          </button>
        </nav>

        {/* Right Action Buttons */}
        <div className="flex items-center space-x-3">
          {currentUser ? (
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-xs text-slate-200">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold max-w-[120px] truncate">{currentUser.name}</span>
            </div>
          ) : (
            <button
              onClick={onOpenLogin || handleStartClick}
              className="px-5 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white text-xs font-semibold backdrop-blur-md transition-all active:scale-95"
            >
              Đăng nhập
            </button>
          )}

          <button
            onClick={handleStartClick}
            className="px-5 py-2 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition-all flex items-center space-x-1.5 active:scale-95"
          >
            <span>Bắt đầu ngay</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* =========================================================================
          2. MAIN BODY: EITHER FEATURES VIEW OR HERO SECTION
      ========================================================================= */}
      {activeNav === 'features' ? (
        <main className="relative z-20 w-full flex-1 flex flex-col justify-center animate-in fade-in duration-300">
          <FeaturesView
            onSelectTrack={onSelectTrack}
            data={data}
            onLoadDemoSample={handleDemoClick}
            onOpenUpload={onOpenUpload}
            currentUser={currentUser}
            language={language}
            onBackToHome={() => setActiveNav('home')}
          />
        </main>
      ) : (
        <main className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex-1 flex flex-col justify-center animate-in fade-in duration-300">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* ========================================================
              LEFT COLUMN: HERO COPY & DUAL CTA
          ======================================================== */}
          <div className="lg:col-span-6 space-y-6 sm:space-y-8 text-left">
            {/* Pill Tag */}
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-purple-950/70 border border-purple-500/40 text-purple-300 text-xs font-semibold backdrop-blur-xl shadow-lg shadow-purple-950/40">
              <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
              <span className="tracking-wider uppercase text-[10px] sm:text-[11px] font-black">
                NỀN TẢNG PHÂN TÍCH & TỐI ƯU THƯƠNG MẠI ĐIỆN TỬ
              </span>
            </div>

            {/* Main Title & Slogan */}
            <div className="space-y-3">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1]">
                EcomPulse <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-400 to-purple-400">AI</span>
              </h1>
              <p className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-snug">
                Từ dữ liệu rời rạc đến hành động rõ ràng
              </p>
            </div>

            {/* Subtitle Description */}
            <p className="text-xs sm:text-sm lg:text-base text-slate-300 max-w-xl leading-relaxed font-normal">
              Nền tảng phân tích toàn diện giúp doanh nghiệp thương mại điện tử hiểu rõ hiệu quả kinh doanh, kiểm soát dòng tiền và đưa ra quyết định nhanh chóng dựa trên dữ liệu thực.
            </p>

            {/* Triple CTA Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                onClick={handleStartClick}
                id="btn-hero-start-analytics"
                className="px-6 py-3.5 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-xs sm:text-sm shadow-xl shadow-purple-600/30 transition-all flex items-center space-x-2 active:scale-95 group"
              >
                <span>Bắt đầu phân tích ngay</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={handleDemoClick}
                id="btn-hero-view-demo"
                className="px-5 py-3.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 hover:border-white/20 text-white font-semibold text-xs sm:text-sm backdrop-blur-md transition-all flex items-center space-x-2 active:scale-95"
              >
                <Play className="w-3.5 h-3.5 fill-white text-white" />
                <span>Xem demo</span>
              </button>

              <button
                onClick={() => setShowTourModal(true)}
                id="btn-hero-tour"
                className="px-5 py-3.5 rounded-full bg-gradient-to-r from-cyan-500/15 to-blue-500/15 hover:from-cyan-500/25 hover:to-blue-500/25 border border-cyan-400/40 text-cyan-300 font-bold text-xs sm:text-sm backdrop-blur-md transition-all flex items-center space-x-2 active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Tour 1 phút</span>
              </button>
            </div>

            {/* 2 Marketplace Logos */}
            <div className="flex items-center gap-6 pt-4 flex-wrap">
              {/* Shopee */}
              <div className="flex items-center space-x-2">
                <ShopeeLogo className="w-6 h-6 rounded-lg shadow-md shadow-orange-500/20" />
                <span className="text-xs font-bold text-slate-200">Shopee</span>
              </div>

              {/* TikTok Shop */}
              <div className="flex items-center space-x-2">
                <TikTokShopLogo className="w-6 h-6 rounded-lg shadow-md shadow-cyan-500/20" />
                <span className="text-xs font-bold text-slate-200">TikTok Shop</span>
              </div>
            </div>
          </div>

          {/* ========================================================
              RIGHT COLUMN: 3D LAPTOP & FLOATING HOLOGRAPHIC CARDS
          ======================================================== */}
          <div className="lg:col-span-6 relative flex justify-center items-center py-6">
            {/* Glow behind laptop */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/25 to-pink-600/15 rounded-3xl blur-3xl pointer-events-none transform -rotate-1 scale-95" />

            {/* Laptop Base Container */}
            <div className="relative w-full max-w-[560px] rounded-3xl bg-slate-900/90 border border-white/20 p-2.5 sm:p-3 shadow-2xl shadow-purple-950/60 backdrop-blur-2xl transition-transform hover:scale-[1.01] duration-500">
              
              {/* Laptop Screen Bezel */}
              <div className="rounded-2xl bg-[#090d1f] border border-white/10 p-3 sm:p-4 overflow-hidden space-y-3">
                {/* Screen Top Bar */}
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-lg overflow-hidden bg-[#080d24] border border-cyan-400/40 flex items-center justify-center">
                      <img src={ecompulseDolphinLogo} alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    <span className="text-xs font-bold text-white">EcomPulse AI</span>
                  </div>
                  <div className="hidden sm:flex items-center space-x-2 bg-white/5 px-2.5 py-0.5 rounded-full border border-white/10 text-[10px] text-slate-400">
                    <span>Q3/2026 • Real-time Sync</span>
                  </div>
                </div>

                {/* Mini Dashboard Content */}
                <div className="grid grid-cols-12 gap-2.5">
                  {/* Mini Sidebar */}
                  <div className="col-span-3 space-y-1 text-[10px] font-semibold text-slate-400 border-r border-white/5 pr-2 hidden sm:block">
                    <div className="px-2 py-1 rounded-lg bg-blue-500/20 text-sky-300 font-bold flex items-center space-x-1.5">
                      <BarChart3 className="w-3 h-3" />
                      <span>Tổng quan</span>
                    </div>
                    <div className="px-2 py-1 rounded-lg hover:bg-white/5 hover:text-white flex items-center space-x-1.5 transition-colors">
                      <ShoppingBag className="w-3 h-3" />
                      <span>Sàn TMĐT</span>
                    </div>
                    <div className="px-2 py-1 rounded-lg hover:bg-white/5 hover:text-white flex items-center space-x-1.5 transition-colors">
                      <Building2 className="w-3 h-3" />
                      <span>Tài chính</span>
                    </div>
                    <div className="px-2 py-1 rounded-lg hover:bg-white/5 hover:text-white flex items-center space-x-1.5 transition-colors">
                      <Layers className="w-3 h-3" />
                      <span>Báo cáo</span>
                    </div>
                    <div className="px-2 py-1 rounded-lg hover:bg-white/5 hover:text-white flex items-center space-x-1.5 transition-colors">
                      <Bot className="w-3 h-3 text-purple-400" />
                      <span>Trợ lý AI</span>
                    </div>
                  </div>

                  {/* Main Screen Content */}
                  <div className="col-span-12 sm:col-span-9 space-y-2.5">
                    {/* Top 3 KPI Badges */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-2 rounded-xl bg-white/[0.04] border border-white/5 space-y-0.5">
                        <span className="text-[9px] text-slate-400 font-medium block">Doanh thu thuần</span>
                        <span className="text-xs font-black text-white block">1,248,000,000</span>
                        <span className="text-[8px] font-bold text-emerald-400">↑ 12.3% kỳ trước</span>
                      </div>

                      <div className="p-2 rounded-xl bg-white/[0.04] border border-white/5 space-y-0.5">
                        <span className="text-[9px] text-slate-400 font-medium block">Lợi nhuận ròng</span>
                        <span className="text-xs font-black text-emerald-300 block">182,400,000</span>
                        <span className="text-[8px] font-bold text-emerald-400">↑ 18.3% kỳ trước</span>
                      </div>

                      <div className="p-2 rounded-xl bg-white/[0.04] border border-white/5 space-y-0.5">
                        <span className="text-[9px] text-slate-400 font-medium block">Tỷ lệ lợi nhuận</span>
                        <span className="text-xs font-black text-purple-300 block">14.6%</span>
                        <span className="text-[8px] font-bold text-purple-400">↑ 2.1% kỳ trước</span>
                      </div>
                    </div>

                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {/* Area Chart: Doanh thu & Lợi nhuận */}
                      <div className="p-2 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                        <div className="flex justify-between text-[9px] font-bold text-slate-300">
                          <span>Doanh thu & Lợi nhuận</span>
                          <span className="text-[8px] text-sky-400">• Doanh thu</span>
                        </div>
                        <div className="h-20 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={MOCK_AREA_DATA}>
                              <defs>
                                <linearGradient id="laptopRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <Area type="monotone" dataKey="revenue" stroke="#38bdf8" strokeWidth={1.5} fillOpacity={1} fill="url(#laptopRevenueGrad)" />
                              <Area type="monotone" dataKey="profit" stroke="#fb923c" strokeWidth={1.5} fillOpacity={0} fill="#fb923c" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Donut Chart: Cơ cấu doanh thu theo sàn */}
                      <div className="p-2 rounded-xl bg-white/[0.03] border border-white/5 space-y-1 flex flex-col justify-between">
                        <span className="text-[9px] font-bold text-slate-300 block">Cơ cấu theo sàn</span>
                        <div className="flex items-center justify-between">
                          <div className="w-14 h-14">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie data={MOCK_PIE_DATA} dataKey="value" cx="50%" cy="50%" innerRadius={14} outerRadius={24} paddingAngle={2}>
                                  {MOCK_PIE_DATA.map((_, index) => (
                                    <Cell key={`donut-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                                  ))}
                                </Pie>
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="text-[8px] space-y-0.5 text-slate-300 text-right">
                            <div className="flex items-center justify-end space-x-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                              <span>Shopee: 45.2%</span>
                            </div>
                            <div className="flex items-center justify-end space-x-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                              <span>TikTok: 32.7%</span>
                            </div>
                            <div className="flex items-center justify-end space-x-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />
                              <span>Lazada: 14.1%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Laptop Bottom Notch */}
              <div className="w-24 h-1 bg-white/20 rounded-full mx-auto mt-2" />
            </div>

            {/* ========================================================
                FLOATING HOLOGRAPHIC CARDS
            ======================================================== */}
            
            {/* Card 1 (Top Right): Dolphin AI */}
            <div className="absolute -top-4 right-0 sm:-right-4 p-3 rounded-2xl bg-gradient-to-r from-cyan-950/80 via-slate-900/90 to-blue-950/80 border border-cyan-400/50 shadow-xl shadow-cyan-500/20 backdrop-blur-xl flex items-center space-x-3 animate-bounce [animation-duration:4s]">
              <div className="w-9 h-9 rounded-xl overflow-hidden border border-cyan-400/40 shadow-md">
                <img src={dolphinAvatar} alt="Dolphin AI" className="w-full h-full object-cover" />
              </div>
              <div className="text-left">
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-black text-white">Dolphin AI</span>
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                </div>
                <span className="text-[10px] text-cyan-300 font-medium block">Trợ lý phân tích thông minh</span>
              </div>
            </div>

            {/* Card 2 (Middle Right): Cảnh báo rủi ro COD */}
            <div className="absolute top-28 sm:top-24 -right-2 sm:-right-8 p-3 rounded-2xl bg-slate-900/90 border border-rose-500/40 shadow-xl shadow-rose-500/15 backdrop-blur-xl flex items-center space-x-2.5 transition-transform hover:scale-105 cursor-pointer">
              <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-400 flex-shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span className="text-xs font-bold text-white block">Cảnh báo rủi ro COD</span>
                <span className="text-[10px] text-rose-300 font-semibold block">Tỷ lệ hoàn tiền COD tăng 12.4% →</span>
              </div>
            </div>

            {/* Card 3 (Bottom Right): Đồng bộ lịch công việc */}
            <div className="absolute bottom-16 sm:bottom-12 -right-2 sm:-right-6 p-3 rounded-2xl bg-slate-900/90 border border-purple-500/40 shadow-xl shadow-purple-500/15 backdrop-blur-xl flex items-center space-x-2.5 transition-transform hover:scale-105 cursor-pointer">
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-400 flex-shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span className="text-xs font-bold text-white block">Đồng bộ lịch công việc</span>
                <span className="text-[10px] text-purple-300 font-semibold block">1 click sang Google Calendar →</span>
              </div>
            </div>

            {/* Floating Excel Sheet Badge (Bottom Front) */}
            <div className="absolute -bottom-4 left-4 sm:left-10 p-2.5 sm:p-3 rounded-2xl bg-slate-900/95 border border-emerald-400/50 shadow-2xl shadow-emerald-500/20 backdrop-blur-2xl flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 font-black text-xs">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span className="text-xs font-bold text-white block">Tự động làm sạch dữ liệu</span>
                <span className="text-[10px] text-emerald-300 font-medium block">Semantic Parsing & Deduplication</span>
              </div>
              <div className="w-5 h-5 rounded-full bg-emerald-400 text-slate-950 flex items-center justify-center">
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
            </div>

            {/* Script Slogan at Bottom Right */}
            <div className="absolute -bottom-6 -right-2 hidden sm:block text-right pointer-events-none">
              <span className="font-serif italic text-sm text-cyan-300/80 drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]">
                Smarter Data, Bigger Growth ✨
              </span>
            </div>
          </div>
        </div>

        {/* =========================================================================
            3. BOTTOM VALUE PROPS (3 PILLARS)
        ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12 sm:pt-16 border-t border-white/10 mt-8">
          {/* Pillar 1 */}
          <div className="flex items-center space-x-3.5 p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
            <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-400/30 flex items-center justify-center text-sky-400 flex-shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h4 className="text-xs font-bold text-white">Bảo mật tuyệt đối</h4>
              <p className="text-[11px] text-slate-400">Xử lý dữ liệu ngay tại thiết bị (Local-First Security)</p>
            </div>
          </div>

          {/* Pillar 2 */}
          <div className="flex items-center space-x-3.5 p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
            <div className="w-11 h-11 rounded-2xl bg-purple-500/10 border border-purple-400/30 flex items-center justify-center text-purple-400 flex-shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h4 className="text-xs font-bold text-white">AI đa tác nhân</h4>
              <p className="text-[11px] text-slate-400">Dolphin AI chuyên môn hóa (Flow, Risk, Task)</p>
            </div>
          </div>

          {/* Pillar 3 */}
          <div className="flex items-center space-x-3.5 p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-center text-amber-400 flex-shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h4 className="text-xs font-bold text-white">Tự động hóa thông minh</h4>
              <p className="text-[11px] text-slate-400">Gmail Alert & Google Calendar</p>
            </div>
          </div>
        </div>
      </main>
      )}

      {/* =========================================================================
          4. MODAL: CHỌN PHÂN HỆ PHÂN TÍCH (LUỒNG 1 VS LUỒNG 2)
      ========================================================================= */}
      {showTrackModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl bg-slate-900 border border-white/20 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-purple-950/80 space-y-6">
            {/* Close Button */}
            <button
              onClick={() => setShowTrackModal(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-400/30 text-purple-300 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>CHỌN PHÂN HỆ BẮT ĐẦU</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Bạn Muốn Phân Tích Luồng Dữ Liệu Nào?
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto">
                EcomPulse AI hỗ trợ chuyên sâu 2 luồng quản trị độc lập cho doanh nghiệp thương mại điện tử:
              </p>
            </div>

            {/* 2 Track Choices */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              {/* Track 1: Marketplace Analytics */}
              <div
                onClick={() => {
                  setShowTrackModal(false);
                  onSelectTrack('marketplace');
                }}
                className="p-6 rounded-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-sky-950/40 border-2 border-sky-500/30 hover:border-sky-400 transition-all duration-300 shadow-xl hover:shadow-sky-500/20 cursor-pointer flex flex-col justify-between group hover:-translate-y-1"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-sky-500/20 text-sky-300 border border-sky-400/30">
                      Luồng 1 • Dữ Liệu Sàn
                    </span>
                    <div className="flex items-center space-x-1.5">
                      <ShopeeLogo className="w-4 h-4" />
                      <TikTokShopLogo className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-11 h-11 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 flex-shrink-0">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-white group-hover:text-sky-300 transition-colors">
                        Phân Tích Sàn TMĐT
                      </h4>
                      <p className="text-xs text-sky-400/90 font-semibold">Shopee • TikTok Shop</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    Phân tích phễu chuyển đổi 3 bước, bóc tách rò rỉ dòng tiền theo 7 kênh lưu lượng, hiệu quả Shopee Ads ROAS & 7 Trụ Cột AI.
                  </p>

                  <div className="space-y-1.5 text-[11px] text-slate-300 pt-1">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                      <span>Đối soát dòng tiền thực nhận & đơn hủy</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                      <span>Đo lường Live stream, Video KOC & Ads</span>
                    </div>
                  </div>
                </div>

                <div className="pt-5 mt-4 border-t border-white/10 flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-400 group-hover:text-sky-300 flex items-center space-x-1">
                    <span>Chọn Phân Hệ Sàn TMĐT</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
              </div>

              {/* Track 2: Internal Finance Analytics */}
              <div
                onClick={() => {
                  setShowTrackModal(false);
                  onSelectTrack('internal_finance');
                }}
                className="p-6 rounded-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-emerald-950/40 border-2 border-emerald-500/30 hover:border-emerald-400 transition-all duration-300 shadow-xl hover:shadow-emerald-500/20 cursor-pointer flex flex-col justify-between group hover:-translate-y-1"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      Luồng 2 • Tài Chính Nội Bộ
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-bold border border-emerald-400/20">
                      53 Cột Chuẩn v1.0
                    </span>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 flex-shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-white group-hover:text-emerald-300 transition-colors">
                        Phân Tích Tài Chính Nội Bộ
                      </h4>
                      <p className="text-xs text-emerald-400/90 font-semibold">P&L Quản Trị • Giá Vốn COGS • Pareto SKU</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    Kiểm soát P&L, tự động cộng dồn SKU & Kênh Traffic, phân tích điểm hòa vốn, biên lợi nhuận và kế hoạch hành động P0/P1/P2.
                  </p>

                  <div className="space-y-1.5 text-[11px] text-slate-300 pt-1">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Tự động nhận diện từ điển tiếng Việt 53 cột</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Cộng dồn tự động danh mục SKU & Traffic</span>
                    </div>
                  </div>
                </div>

                <div className="pt-5 mt-4 border-t border-white/10 flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 group-hover:text-emerald-300 flex items-center space-x-1">
                    <span>Chọn Tài Chính Nội Bộ</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pricing Modal */}
      <PricingPlansModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
        language={language}
      />

      {/* Interactive Dolphin Onboarding Tour Modal */}
      <DolphinOnboardingTourModal
        isOpen={showTourModal}
        onClose={() => setShowTourModal(false)}
        onStartMarketplace={() => onSelectTrack('marketplace')}
        onStartInternalFinance={() => onSelectTrack('internal_finance')}
        onLoadDemoSample={handleDemoClick}
        onOpenUpload={onOpenUpload}
        onOpenChatWithPrompt={handleOpenChatWithPrompt}
        language={language}
      />

      {/* Interactive Dolphin AI Chat Modal */}
      <DolphinChatModal
        isOpen={showDolphinChat}
        onClose={() => setShowDolphinChat(false)}
        data={data}
        onLoadDemoSample={handleDemoClick}
        onOpenUpload={onOpenUpload}
        onOpenTour={() => setShowTourModal(true)}
        currentUser={currentUser}
        language={language}
        initialPrompt={chatPrompt}
      />

      {/* Smart Context-Aware Floating Assistant Widget */}
      <DolphinFloatingWidget
        onOpenChat={() => setShowDolphinChat(true)}
        onOpenTour={() => setShowTourModal(true)}
        onLoadDemoSample={handleDemoClick}
        currentContext="home"
        hasData={!!data}
      />
    </div>
  );
};

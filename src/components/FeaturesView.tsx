import React, { useState } from 'react';
import {
  Search,
  Bell,
  ChevronDown,
  ShieldCheck,
  Zap,
  Link as LinkIcon,
  Bot,
  ArrowRight,
  Sparkles,
  Check,
  Clock,
  Settings2,
  TrendingUp,
  FileSpreadsheet,
  BarChart3,
  PieChart as PieIcon,
  ShoppingBag,
  Building2,
  X,
  MessageSquare,
  DollarSign,
  Layers,
  Send,
  Loader2,
  Play,
  HelpCircle,
  Award,
  Flame,
  CheckCircle2,
  ArrowUpRight,
  Database,
  Cpu,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { ShopeeLogo, TikTokShopLogo } from './PlatformLogos';
import dolphinAvatar from '../assets/images/dolphin_ai_avatar_1787721342181.jpg';
import ecompulseLogo from '../assets/images/ecompulse_dolphin_logo.png';
import { GoogleUserProfile, ParsedStoreData } from '../types';
import { DolphinChatModal } from './chat/DolphinChatModal';
import { DolphinOnboardingTourModal } from './onboarding/DolphinOnboardingTourModal';
import { DolphinFloatingWidget } from './chat/DolphinFloatingWidget';

interface FeaturesViewProps {
  onSelectTrack: (track: 'marketplace' | 'internal_finance') => void;
  data?: ParsedStoreData | null;
  onLoadDemoSample?: () => void;
  onOpenUpload?: () => void;
  currentUser?: GoogleUserProfile | null;
  language?: 'vi' | 'en';
  onBackToHome?: () => void;
}

const MOCK_AREA_DATA = [
  { month: 'T7', revenue: 780, profit: 110 },
  { month: 'T8', revenue: 920, profit: 135 },
  { month: 'T9', revenue: 860, profit: 125 },
  { month: 'T10', revenue: 1140, profit: 165 },
  { month: 'T11', revenue: 1080, profit: 155 },
  { month: 'T12', revenue: 1248, profit: 182 },
];

export const FeaturesView: React.FC<FeaturesViewProps> = ({
  onSelectTrack,
  data,
  onLoadDemoSample,
  onOpenUpload,
  currentUser,
  language = 'vi',
  onBackToHome,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showDolphinChat, setShowDolphinChat] = useState(false);
  const [showTourModal, setShowTourModal] = useState(false);
  const [chatPrompt, setChatPrompt] = useState<string | undefined>(undefined);

  const notifications = [
    {
      id: 1,
      title: 'Cảnh báo rủi ro hoàn COD',
      desc: 'Tỷ lệ đơn COD rò rỉ tăng 12.4% trên kênh TikTok Live.',
      time: '10 phút trước',
      type: 'warning',
    },
    {
      id: 2,
      title: 'Dolphin AI chuẩn hóa xong',
      desc: 'Đã tự động nhận diện 21 sheets báo cáo Shopee Mega 8.8.',
      time: '35 phút trước',
      type: 'success',
    },
    {
      id: 3,
      title: 'Báo cáo P&L Tháng 8',
      desc: 'Báo cáo phân tích biên lợi nhuận ròng nội bộ đã sẵn sàng.',
      time: '2 giờ trước',
      type: 'info',
    },
    {
      id: 4,
      title: 'Đồng bộ Google Calendar',
      desc: 'Đã tạo 3 lịch nhắc việc tối ưu chiến dịch Shopee Ads.',
      time: 'Hôm qua',
      type: 'info',
    },
  ];

  const handleOpenChatWithPrompt = (prompt: string) => {
    setChatPrompt(prompt);
    setShowDolphinChat(true);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8 animate-in fade-in duration-300">
      
      {/* =========================================================================
          TOP HEADER BAR (SEARCH + NOTIFICATIONS + TOUR CTA)
      ========================================================================= */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/60 border border-white/10 rounded-2xl p-3 sm:px-5 backdrop-blur-xl">
        {/* Left: Quick Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm tính năng, chỉ số, báo cáo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950/80 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/40 transition-all"
          />
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
          {/* Onboarding Tour Button */}
          <button
            onClick={() => setShowTourModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-400/40 text-cyan-300 text-xs font-bold transition-all flex items-center space-x-1.5 shadow-sm active:scale-95"
            title="Mở Tour hướng dẫn 1 phút"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>Tour Hướng Dẫn</span>
          </button>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all"
              title="Thông báo hệ thống"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-slate-900 border border-white/15 p-3 shadow-2xl z-50 space-y-2 animate-in fade-in duration-200 text-left">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-xs font-bold text-white">Thông báo mới</span>
                  <span className="text-[10px] text-cyan-400 font-semibold cursor-pointer hover:underline">
                    Đã đọc tất cả
                  </span>
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className="p-2 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/5 transition-colors space-y-0.5 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200">{n.title}</span>
                        <span className="text-[9px] text-slate-500">{n.time}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">{n.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          MAIN 2-COLUMN GRID (LEFT 8 COLS / RIGHT 4 COLS)
      ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* =======================================================================
            LEFT COLUMN: BANNER HERO + 2 TRACK CARDS + 2-STEP PIPELINE + VALUE PROPS
        ======================================================================= */}
        <div className="lg:col-span-8 space-y-6">

          {/* 1. Top Feature Banner */}
          <div className="relative rounded-3xl bg-gradient-to-r from-[#0c1236] via-[#101746] to-[#18113c] border border-indigo-500/30 p-6 sm:p-7 shadow-2xl overflow-hidden group">
            {/* Background Glows */}
            <div className="absolute top-0 right-1/4 w-72 h-72 bg-purple-600/15 rounded-full blur-[90px] pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-80 h-80 bg-cyan-600/15 rounded-full blur-[100px] pointer-events-none" />

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center relative z-10">
              {/* Left Content */}
              <div className="md:col-span-7 space-y-3.5 text-left">
                <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase bg-blue-500/20 text-sky-300 border border-sky-400/30">
                  TÍNH NĂNG NỔI BẬT
                </span>

                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug">
                  Tất cả công cụ phân tích trong{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-rose-400">
                    một nền tảng
                  </span>
                </h2>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                  EcomPulse AI cung cấp hệ thống tính năng toàn diện, giúp bạn phân tích sâu, hiểu rõ dữ liệu và đưa ra quyết định nhanh chóng, chính xác.
                </p>
              </div>

              {/* Right Mini 3D Dashboard Mockup Graphic */}
              <div className="md:col-span-5 relative flex items-center justify-center">
                <div className="relative w-full max-w-[240px] rounded-2xl bg-slate-900/90 border border-white/20 p-2 shadow-2xl shadow-purple-950/80 backdrop-blur-xl">
                  {/* Mini Screen */}
                  <div className="rounded-xl bg-[#080d24] border border-white/10 p-2 space-y-1.5 overflow-hidden">
                    <div className="flex items-center justify-between border-b border-white/10 pb-1">
                      <span className="text-[9px] font-black text-white">EcomPulse Dashboard</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                    {/* Tiny Area Chart */}
                    <div className="h-14 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={MOCK_AREA_DATA}>
                          <defs>
                            <linearGradient id="featAreaGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#818cf8" stopOpacity={0.6} />
                              <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <Area type="monotone" dataKey="revenue" stroke="#a78bfa" strokeWidth={1.5} fillOpacity={1} fill="url(#featAreaGrad)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Floating Badges */}
                  <div className="absolute -top-2.5 -left-2.5">
                    <ShopeeLogo className="w-6 h-6 rounded-lg shadow-md shadow-orange-500/30" />
                  </div>
                  <div className="absolute -bottom-2 -right-2">
                    <TikTokShopLogo className="w-6 h-6 rounded-lg shadow-md shadow-cyan-500/30" />
                  </div>
                </div>

                {/* Slogan */}
                <div className="absolute -bottom-4 right-0 pointer-events-none">
                  <span className="font-serif italic text-xs text-pink-300 drop-shadow-[0_0_8px_rgba(244,114,182,0.6)]">
                    Smarter Data, Bigger Growth ✨
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Dual Feature Cards (Luồng 1 & Luồng 2) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Card 1: Luồng 1 - Phân tích sàn TMĐT */}
            <div className="rounded-3xl bg-gradient-to-b from-slate-900/90 via-[#0d1233] to-[#1a0f3b]/70 border border-purple-500/30 p-6 flex flex-col justify-between hover:border-purple-400 transition-all duration-300 shadow-xl hover:shadow-purple-500/20 group relative overflow-hidden">
              <div className="space-y-3.5 text-left">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-600/30 text-purple-300 border border-purple-400/40">
                  Luồng 1
                </span>

                <div>
                  <h3 className="text-lg sm:text-xl font-black text-white group-hover:text-purple-300 transition-colors">
                    Phân tích sàn TMĐT
                  </h3>
                  <p className="text-xs font-bold text-sky-400 mt-0.5">
                    Shopee • TikTok Shop
                  </p>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Bóc tách 21 Sheets báo cáo chuẩn của sàn, chẩn đoán rò rỉ dòng tiền, phí COD, chi phí Ads, phân loại SKU và hiệu quả KOC/Livestream/Video.
                </p>
              </div>

              <div className="pt-5 mt-4 border-t border-white/10 flex items-center justify-between">
                <button
                  onClick={() => onSelectTrack('marketplace')}
                  className="px-4 py-2 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition-all flex items-center space-x-1.5 active:scale-95 group/btn"
                >
                  <span>Bắt đầu phân tích</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
                </button>

                <div className="flex items-center space-x-1.5">
                  <ShopeeLogo className="w-5 h-5 rounded-md" />
                  <TikTokShopLogo className="w-5 h-5 rounded-md" />
                </div>
              </div>
            </div>

            {/* Card 2: Luồng 2 - Phân tích tài chính nội bộ */}
            <div className="rounded-3xl bg-gradient-to-b from-slate-900/90 via-[#0a1838] to-[#0b294d]/60 border border-sky-500/30 p-6 flex flex-col justify-between hover:border-sky-400 transition-all duration-300 shadow-xl hover:shadow-sky-500/20 group relative overflow-hidden">
              <div className="space-y-3.5 text-left">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-sky-600/30 text-sky-300 border border-sky-400/40">
                  Luồng 2
                </span>

                <div>
                  <h3 className="text-lg sm:text-xl font-black text-white group-hover:text-sky-300 transition-colors">
                    Phân tích tài chính nội bộ
                  </h3>
                  <p className="text-xs font-bold text-sky-400 mt-0.5">
                    Business Internal Finance (SMEs)
                  </p>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Quản trị tài chính & P&L doanh nghiệp, kiểm soát doanh thu thuần, COGS, OPEX, lợi nhuận ròng, EBITDA, điểm hòa vốn, Unit Economics.
                </p>
              </div>

              <div className="pt-5 mt-4 border-t border-white/10 flex items-center justify-between">
                <button
                  onClick={() => onSelectTrack('internal_finance')}
                  className="px-4 py-2 rounded-full bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/30 transition-all flex items-center space-x-1.5 active:scale-95 group/btn"
                >
                  <span>Bắt đầu phân tích</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
                </button>

                <div className="flex items-center space-x-1.5 text-sky-400">
                  <div className="w-6 h-6 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-xs font-black">
                    $
                  </div>
                  <div className="w-6 h-6 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
                    <BarChart3 className="w-3.5 h-3.5 text-blue-300" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* =====================================================================
              3. SECTION: QUY TRÌNH XỬ LÝ DỮ LIỆU 2 BƯỚC (AUTO-PIPELINE) - REDESIGNED
          ===================================================================== */}
          <div className="relative rounded-3xl bg-gradient-to-b from-slate-900/95 via-[#0b1330]/90 to-[#070c22]/95 border border-cyan-500/30 p-5 sm:p-6 backdrop-blur-2xl space-y-5 text-left shadow-2xl shadow-cyan-950/40 overflow-hidden">
            {/* Ambient Background Aura */}
            <div className="absolute top-0 right-1/3 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-10 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Section Header with Badge */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4 relative z-10">
              <div className="flex items-center space-x-3.5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600/30 to-cyan-500/30 border border-cyan-400/50 flex items-center justify-center text-cyan-300 shadow-lg shadow-cyan-500/20">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                      Quy trình xử lý dữ liệu 2 bước (Auto-Pipeline)
                    </h3>
                    <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
                      Tự Động 100%
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Từ file Excel thô đa định dạng đến báo cáo chuẩn xác chỉ trong 3 giây
                  </p>
                </div>
              </div>

              {/* Quick Tour Trigger */}
              <button
                onClick={() => setShowTourModal(true)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold transition-all self-start sm:self-auto active:scale-95"
              >
                <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
                <span>Xem chi tiết</span>
              </button>
            </div>

            {/* Interactive Visual Stepper Pipeline Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-stretch relative z-10 pt-1">
              
              {/* STAGE 0: File Excel Thô (Raw File Ingest) */}
              <div className="md:col-span-4 p-4 rounded-2xl bg-gradient-to-b from-emerald-950/30 via-slate-900/80 to-slate-950/90 border border-emerald-500/40 hover:border-emerald-400 transition-all flex flex-col justify-between space-y-3 group shadow-lg">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      ĐẦU VÀO (INPUT)
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold">.xlsx • .csv</span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-300 font-black shadow-md">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white group-hover:text-emerald-300 transition-colors">
                        File Báo Cáo Thô
                      </h4>
                      <span className="text-[10px] text-slate-400 block leading-tight">
                        Shopee, TikTok Shop, P&L
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Chấp nhận mọi cấu trúc cột và định dạng sheet thô xuất từ sàn. Không yêu cầu chuẩn bị file trước.
                  </p>
                </div>

                {/* Mini Platform Badges */}
                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400">
                  <span className="text-emerald-400 font-semibold">Tự nhận diện sàn</span>
                  <div className="flex items-center space-x-1">
                    <ShopeeLogo className="w-3.5 h-3.5 rounded" />
                    <TikTokShopLogo className="w-3.5 h-3.5 rounded" />
                  </div>
                </div>
              </div>

              {/* STAGE 1: AI Universal Schema Mapper */}
              <div className="md:col-span-4 p-4 rounded-2xl bg-gradient-to-b from-blue-950/30 via-slate-900/80 to-slate-950/90 border border-blue-500/40 hover:border-blue-400 transition-all flex flex-col justify-between space-y-3 group shadow-lg">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white font-black text-[10px] flex items-center justify-center shadow-md">
                        1
                      </div>
                      <span className="text-xs font-black text-white">AI Schema Mapper</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-500/20 text-sky-300 border border-blue-400/30">
                      Semantic v1.0
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[11px] text-slate-300 pt-0.5">
                    <div className="flex items-start space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 flex-shrink-0 mt-0.5" />
                      <span><strong>Semantic Mapping:</strong> Đọc hiểu từ đồng nghĩa tiếng Việt</span>
                    </div>
                    <div className="flex items-start space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 flex-shrink-0 mt-0.5" />
                      <span><strong>PII Shield:</strong> Lọc sạch tên, SĐT, địa chỉ (NĐ 13/2023)</span>
                    </div>
                    <div className="flex items-start space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 flex-shrink-0 mt-0.5" />
                      <span><strong>Auto-Normalize:</strong> Quy đổi về 7 Sheets chuẩn hóa</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400">
                  <span className="text-sky-300 font-semibold">Bảo mật On-Premise RAM</span>
                  <Lock className="w-3 h-3 text-sky-400" />
                </div>
              </div>

              {/* STAGE 2: Deterministic Rule Engine & AI */}
              <div className="md:col-span-4 p-4 rounded-2xl bg-gradient-to-b from-cyan-950/30 via-slate-900/80 to-slate-950/90 border border-cyan-500/40 hover:border-cyan-400 transition-all flex flex-col justify-between space-y-3 group shadow-lg">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      <div className="w-5 h-5 rounded-full bg-cyan-600 text-slate-950 font-black text-[10px] flex items-center justify-center shadow-md">
                        2
                      </div>
                      <span className="text-xs font-black text-white">Rule Engine & AI</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                      Tốc độ &lt; 1s
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[11px] text-slate-300 pt-0.5">
                    <div className="flex items-start space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0 mt-0.5" />
                      <span><strong>Deterministic Math:</strong> Tính toán code thuần, không ảo giác</span>
                    </div>
                    <div className="flex items-start space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0 mt-0.5" />
                      <span><strong>7 Trụ Cột:</strong> Phễu 3 bước, Rò rỉ COD, Pareto SKU Zombie</span>
                    </div>
                    <div className="flex items-start space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0 mt-0.5" />
                      <span><strong>AI Action Cards:</strong> Thẻ hành động P0/P1/P2 kèm ước tính VND</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400">
                  <span className="text-cyan-300 font-semibold">Dashboard + Actions</span>
                  <div className="w-4 h-4 rounded-full overflow-hidden border border-cyan-400/60">
                    <img src={dolphinAvatar} alt="Dolphin" className="w-full h-full object-cover" />
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* =====================================================================
              4. SECTION: LỢI ÍCH KHI SỬ DỤNG ECOMPULSE AI - REDESIGNED BENTO
          ===================================================================== */}
          <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-5 sm:p-6 backdrop-blur-2xl space-y-4 text-left shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h4 className="text-xs sm:text-sm font-black text-white tracking-wide uppercase">
                  Lợi ích khi sử dụng EcomPulse AI
                </h4>
              </div>
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                Tối ưu hóa toàn diện dòng tiền & tăng trưởng
              </span>
            </div>

            {/* 4 Bento Value Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
              
              {/* Benefit 1 */}
              <div className="p-4 rounded-2xl bg-gradient-to-b from-blue-950/20 via-slate-950/60 to-slate-950/80 border border-blue-500/30 hover:border-blue-400 transition-all space-y-2 group shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-sky-400 group-hover:scale-105 transition-transform">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-black text-white block group-hover:text-sky-300 transition-colors">
                    Tiết kiệm 90% thời gian
                  </span>
                  <span className="text-[11px] text-slate-400 block leading-snug mt-1">
                    Tự động hóa 21 sheets báo cáo từ các sàn chỉ trong 3 giây thay vì 4 giờ làm thủ công.
                  </span>
                </div>
              </div>

              {/* Benefit 2 */}
              <div className="p-4 rounded-2xl bg-gradient-to-b from-purple-950/20 via-slate-950/60 to-slate-950/80 border border-purple-500/30 hover:border-purple-400 transition-all space-y-2 group shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform">
                  <Settings2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-black text-white block group-hover:text-purple-300 transition-colors">
                    Độ chính xác 100%
                  </span>
                  <span className="text-[11px] text-slate-400 block leading-snug mt-1">
                    Kết hợp Rule Engine & Semantic Parser, loại bỏ hoàn toàn sai sót khi nhập liệu.
                  </span>
                </div>
              </div>

              {/* Benefit 3 */}
              <div className="p-4 rounded-2xl bg-gradient-to-b from-rose-950/20 via-slate-950/60 to-slate-950/80 border border-rose-500/30 hover:border-rose-400 transition-all space-y-2 group shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-400 group-hover:scale-105 transition-transform">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-black text-white block group-hover:text-rose-300 transition-colors">
                    Bịt rò rỉ dòng tiền
                  </span>
                  <span className="text-[11px] text-slate-400 block leading-snug mt-1">
                    Chẩn đoán sớm rò rỉ đơn COD, phí sàn ẩn và chi phí quảng cáo Ads kém hiệu quả.
                  </span>
                </div>
              </div>

              {/* Benefit 4 */}
              <div className="p-4 rounded-2xl bg-gradient-to-b from-emerald-950/20 via-slate-950/60 to-slate-950/80 border border-emerald-500/30 hover:border-emerald-400 transition-all space-y-2 group shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-black text-white block group-hover:text-emerald-300 transition-colors">
                    Tối ưu quyết định
                  </span>
                  <span className="text-[11px] text-slate-400 block leading-snug mt-1">
                    Đưa ra Thẻ hành động P0/P1/P2 kèm 1-click xuất lịch công việc sang Google Calendar.
                  </span>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* =======================================================================
            RIGHT COLUMN: CÁC TÍNH NĂNG CHÍNH + SUPPORT CTA CARD (REDESIGNED)
        ======================================================================= */}
        <div className="lg:col-span-4 space-y-6">

          {/* 1. Card: Các tính năng chính */}
          <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-5 space-y-4 backdrop-blur-xl text-left shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-black text-white tracking-tight">
                Các tính năng chính
              </h3>
              <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-400/20">
                4 Trụ Cột
              </span>
            </div>

            <div className="space-y-3">
              {/* Feature 1 */}
              <div className="p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition-all flex items-start space-x-3 group">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-sky-400 flex-shrink-0 group-hover:scale-105 transition-transform">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block group-hover:text-sky-300 transition-colors">
                    Local-First Security
                  </span>
                  <span className="text-[11px] text-slate-400 block leading-snug">
                    Dữ liệu xử lý 100% trong RAM, không rời khỏi thiết bị
                  </span>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition-all flex items-start space-x-3 group">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-400 flex-shrink-0 group-hover:scale-105 transition-transform">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block group-hover:text-purple-300 transition-colors">
                    Dolphin AI Multi-Agent
                  </span>
                  <span className="text-[11px] text-slate-400 block leading-snug">
                    Trợ lý AI chuyên môn hóa (Flow, Leakage, SKU Pareto)
                  </span>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition-all flex items-start space-x-3 group">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-400 flex-shrink-0 group-hover:scale-105 transition-transform">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block group-hover:text-cyan-300 transition-colors">
                    Tự động hóa thông minh
                  </span>
                  <span className="text-[11px] text-slate-400 block leading-snug">
                    Gmail Alert rủi ro & Đồng bộ Google Calendar
                  </span>
                </div>
              </div>

              {/* Feature 4 */}
              <div className="p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition-all flex items-start space-x-3 group">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 flex-shrink-0 group-hover:scale-105 transition-transform">
                  <LinkIcon className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block group-hover:text-emerald-300 transition-colors">
                    Từ Điển 53 Cột v1.0
                  </span>
                  <span className="text-[11px] text-slate-400 block leading-snug">
                    Chuẩn hóa ngữ nghĩa tiếng Việt và 10 quy tắc cấm nhầm lẫn
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* =====================================================================
              2. SUPPORT & AI GUIDANCE HUB CARD (REDESIGNED PREMIUM)
          ===================================================================== */}
          <div className="rounded-3xl bg-gradient-to-br from-[#0c1336] via-[#121946] to-[#1e1448] border-2 border-cyan-400/40 p-5 sm:p-6 shadow-2xl shadow-cyan-950/60 relative overflow-hidden flex flex-col justify-between group text-left">
            {/* Ambient Cybernetic Lighting */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-400/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="space-y-4 relative z-10">
              {/* Header with Avatar & Live status */}
              <div className="flex items-center justify-between">
                <div className="relative">
                  <div className="w-13 h-13 rounded-2xl overflow-hidden border-2 border-cyan-400/60 shadow-xl shadow-cyan-500/30 bg-slate-950 p-0.5">
                    <img src={dolphinAvatar} alt="Dolphin AI" className="w-12 h-12 object-cover rounded-xl" />
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-400 border-2 border-slate-900 rounded-full animate-pulse shadow-sm" />
                </div>

                <div className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-[10px] font-bold">
                  <Sparkles className="w-3 h-3 text-cyan-400 animate-pulse" />
                  <span>AI Co-Pilot 24/7</span>
                </div>
              </div>

              {/* Title & Description */}
              <div>
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-1.5">
                  Bạn Cần Trợ Giúp?
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed font-normal mt-1">
                  Dolphin AI luôn sẵn sàng đồng hành! Khám phá tour hướng dẫn hoặc hỏi đáp trực tiếp về số liệu shop của bạn.
                </p>
              </div>

              {/* Interactive Quick Action Pills */}
              <div className="grid grid-cols-1 gap-2 pt-1">
                <button
                  onClick={() => setShowTourModal(true)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-400/40 text-xs font-bold text-slate-200 hover:text-cyan-200 transition-all flex items-center justify-between active:scale-95 group/tour"
                >
                  <span className="flex items-center space-x-2">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Mở Tour Hướng Dẫn (1 Phút)</span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-cyan-400 group-hover/tour:translate-x-1 transition-transform" />
                </button>

                {onLoadDemoSample && !data && (
                  <button
                    onClick={() => onLoadDemoSample()}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-blue-500/20 border border-white/10 hover:border-blue-400/40 text-xs font-bold text-slate-200 hover:text-blue-200 transition-all flex items-center justify-between active:scale-95 group/demo"
                  >
                    <span className="flex items-center space-x-2">
                      <Play className="w-3.5 h-3.5 fill-sky-400 text-sky-400" />
                      <span>Nạp Demo Shopee Mega 8.8</span>
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-sky-400 group-hover/demo:translate-x-1 transition-transform" />
                  </button>
                )}
              </div>
            </div>

            {/* Bottom Action Button */}
            <div className="pt-4 mt-2 border-t border-white/10 relative z-10">
              <button
                onClick={() => {
                  setChatPrompt(undefined);
                  setShowDolphinChat(true);
                }}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs shadow-xl shadow-blue-950/60 transition-all flex items-center justify-center space-x-2 active:scale-95 group/btn"
              >
                <Bot className="w-4 h-4" />
                <span>Chat Trực Tiếp Với Dolphin AI</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* =========================================================================
          INTERACTIVE DOLPHIN ONBOARDING TOUR MODAL
      ========================================================================= */}
      <DolphinOnboardingTourModal
        isOpen={showTourModal}
        onClose={() => setShowTourModal(false)}
        onStartMarketplace={() => onSelectTrack('marketplace')}
        onStartInternalFinance={() => onSelectTrack('internal_finance')}
        onLoadDemoSample={onLoadDemoSample}
        onOpenUpload={onOpenUpload}
        onOpenChatWithPrompt={handleOpenChatWithPrompt}
        language={language}
      />

      {/* =========================================================================
          INTERACTIVE DOLPHIN AI CHAT MODAL
      ========================================================================= */}
      <DolphinChatModal
        isOpen={showDolphinChat}
        onClose={() => setShowDolphinChat(false)}
        data={data}
        onLoadDemoSample={onLoadDemoSample}
        onOpenUpload={onOpenUpload}
        currentUser={currentUser}
        language={language}
        initialPrompt={chatPrompt}
      />

      {/* =========================================================================
          SMART FLOATING ASSISTANT WIDGET WITH CONTEXT-AWARE SPEECH BUBBLE
      ========================================================================= */}
      <DolphinFloatingWidget
        onOpenChat={() => setShowDolphinChat(true)}
        onOpenTour={() => setShowTourModal(true)}
        onLoadDemoSample={onLoadDemoSample}
        currentContext="features"
        hasData={!!data}
      />
    </div>
  );
};

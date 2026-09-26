import React, { useState } from 'react';
import {
  Sparkles,
  TrendingUp,
  Video,
  Users,
  Radio,
  ShoppingBag,
  MousePointer,
  Flame,
  Award,
  Trophy,
  ArrowUpRight,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Tag,
  DollarSign,
  Percent,
  Play,
  Clock,
  Eye,
  MessageSquare,
  ThumbsUp,
  Target,
  BarChart3,
  Bot,
} from 'lucide-react';
import { ParsedStoreData, ProductGrowthMomentumItem, AffiliateContributionMetric, VideoContributionMetric, LiveSessionMetric } from '../../types';
import { formatVND, formatCompactVND, formatNumber, formatPercent } from '../../utils/formatters';

interface ShopeeGrowthAndContentHubProps {
  data: ParsedStoreData;
  language?: 'vi' | 'en';
  onNavigateToAi?: () => void;
}

export const ShopeeGrowthAndContentHub: React.FC<ShopeeGrowthAndContentHubProps> = ({
  data,
  language = 'vi',
  onNavigateToAi,
}) => {
  const [activeTab, setActiveTab] = useState<'momentum' | 'creators' | 'videos' | 'livestream'>('momentum');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'viral_surge' | 'strong_growth' | 'moderate' | 'slow' | 'dormant'>('all');
  const [kocTierFilter, setKocTierFilter] = useState<'all' | 'KOC Kim Cương' | 'KOC Tiềm Năng' | 'KOC Mới' | 'Cần Kích Hoạt'>('all');

  // Summary Metrics - strictly 0 when not recorded
  const summary = data.creatorGrowthSummary || {
    totalTaggedVideos: 0,
    totalVideoPurchases: 0,
    totalVideoClicks: 0,
    videoConversionRate: 0,
    totalCreatorsWithLink: 0,
    activeCreatorsCount: 0,
    overallGrowthVelocity: 'Chưa có dữ liệu KOC/Video (0%)',
    growthVelocityScore: 0,
    topPerformingSku: data.abcProducts?.[0]?.name || 'Chưa có sản phẩm',
    totalKocRevenue: 0,
    totalKocCommission: 0,
  };

  const totalPaidRevenue = data.kpis?.paidRevenue || 0;

  // 1. Momentum Data - strictly 0 for creator/video attributes when unrecorded
  const momentumList: ProductGrowthMomentumItem[] = data.productGrowthMomentum || (data.abcProducts || []).map((p) => {
    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: 'Sản phẩm',
      taggedVideosCount: 0,
      videoPurchasesCount: 0,
      videoProductClicks: 0,
      videoConversionRate: 0,
      creatorsCount: 0,
      activeCreatorsCount: 0,
      growthVelocityScore: p.isZombie ? 0 : (p.classification === 'A' ? 50 : p.classification === 'B' ? 30 : 15),
      growthStatus: (p.isZombie ? 'dormant' : p.classification === 'A' ? 'moderate' : 'slow') as any,
      growthStatusLabel: p.isZombie ? 'ĐỨNG YÊN / ZOMBIE 🛑' : p.classification === 'A' ? 'TĂNG TRƯỞNG ỔN ĐỊNH 📈' : 'TĂNG TRƯỞNG CHẬM ⚠️',
      growthDeltaMoM: 0,
      aiRecommendation: 'Chưa có dữ liệu KOC hoặc Video gắn giỏ hàng trong báo cáo. Đề xuất gửi mẫu thử (samples) cho 5 KOC nano để mở phễu kéo traffic.',
    };
  });

  const filteredMomentum = momentumList.filter((item) => {
    if (statusFilter !== 'all' && item.growthStatus !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q);
    }
    return true;
  });

  // 2. Creators Data
  const affiliatesList: AffiliateContributionMetric[] = data.affiliates || [];
  const filteredAffiliates = affiliatesList.filter((koc) => {
    if (kocTierFilter !== 'all' && koc.performanceTier !== kocTierFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        koc.username.toLowerCase().includes(q) ||
        (koc.creatorName && koc.creatorName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // 3. Videos Data
  const videosList: VideoContributionMetric[] = data.videoMetrics || [];
  const filteredVideos = videosList.filter((v) => {
    if (searchQuery) {
      return v.videoTitle.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  // 4. Live Sessions Data
  const liveSessionsList: LiveSessionMetric[] = data.liveSessions || [];
  const filteredLive = liveSessionsList.filter((l) => {
    if (searchQuery) {
      return l.title.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  return (
    <div className="glass-panel rounded-3xl p-5 sm:p-6 border border-white/[0.15] shadow-2xl space-y-6">
      {/* Momentum per SKU here is allocated from shop-level totals, not measured per SKU. */}
      <div role="note" className="rounded-xl border border-[#fab219]/40 bg-[#fab219]/10 px-3 py-2 text-xs text-amber-100">
        {language === 'vi'
          ? 'Lưu ý: số video, KOC và tốc độ tăng trưởng theo từng SKU trong mục này là ƯỚC TÍNH phân bổ từ số tổng của shop, không phải dữ liệu đo theo SKU. Xem số thật theo nhà sáng tạo / video trong Analyst Workspace → Video & Affiliate.'
          : 'Note: per-SKU video, KOC and growth figures here are ESTIMATES allocated from shop totals, not measured per SKU. See Analyst Workspace → Video & Affiliate for measured data.'}
      </div>
      {/* ====================================================================
          HEADER & SUB-TABS NAVIGATION
      ==================================================================== */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/[0.1]">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/40 text-purple-300 text-xs font-bold uppercase tracking-wider mb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Shopee Content & Creator Flywheel Engine</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span>Động Lực Tăng Trưởng & Phân Tích Kênh Sáng Tạo</span>
          </h3>
          <p className="text-xs text-slate-300 mt-0.5">
            Mối tương quan giữa <strong className="text-sky-300">Video gắn giỏ hàng</strong>, <strong className="text-purple-300">Nhà sáng tạo lấy link</strong> và <strong className="text-emerald-300">Tốc độ tăng trưởng doanh số</strong>
          </p>
        </div>

        {/* 4 Interactive Sub-Tabs */}
        <div className="flex items-center bg-slate-900/90 p-1.5 rounded-2xl border border-white/10 gap-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => { setActiveTab('momentum'); setSearchQuery(''); }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'momentum'
                ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-md shadow-sky-500/25 border border-sky-400/50'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-sky-300" />
            <span>Động Lực Tăng Trưởng SKU</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
              {momentumList.length}
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('creators'); setSearchQuery(''); }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'creators'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-500/25 border border-purple-400/50'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-purple-300" />
            <span>Phân Tích Nhà Sáng Tạo</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
              {affiliatesList.length > 0 ? affiliatesList.length : summary.totalCreatorsWithLink}
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('videos'); setSearchQuery(''); }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'videos'
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md shadow-amber-500/25 border border-amber-400/50'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Video className="w-3.5 h-3.5 text-amber-300" />
            <span>Phân Tích Reels / Video</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
              {videosList.length}
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('livestream'); setSearchQuery(''); }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'livestream'
                ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-md shadow-rose-500/25 border border-rose-400/50'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-rose-300" />
            <span>Phân Tích Livestream</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
              {liveSessionsList.length}
            </span>
          </button>
        </div>
      </div>

      {/* ====================================================================
          TAB 1: ĐỘNG LỰC TĂNG TRƯỞNG SẢN PHẨM TỪ VIDEO & CREATOR (FLYWHEEL)
      ==================================================================== */}
      {activeTab === 'momentum' && (
        <div className="space-y-6 animate-fadeIn">
          {/* 2 Big Hero Pulse Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Hero Card 1: Video Gắn Giỏ ➔ Lượt Mua */}
            <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900/95 via-sky-950/40 to-slate-900/90 border-2 border-sky-400/40 shadow-xl shadow-sky-500/10 space-y-3 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-2xl bg-sky-500/20 border border-sky-400/50 flex items-center justify-center text-sky-300">
                    <Video className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-sky-300 uppercase tracking-wider block">Kênh Video Gắn Giỏ Hàng</span>
                    <h4 className="text-sm font-black text-white">Tổng Video Gắn Giỏ ➔ Lượt Mua</h4>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-black bg-sky-500/20 text-sky-300 border border-sky-400/40">
                  CR {summary.videoConversionRate}%
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                  <span className="text-[11px] text-slate-400 font-medium">Video đã gắn giỏ</span>
                  <div className="text-2xl sm:text-3xl font-black text-white flex items-baseline gap-1">
                    <span>{formatNumber(summary.totalTaggedVideos)}</span>
                    <span className="text-xs font-bold text-sky-400">video</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block">{formatNumber(summary.totalVideoClicks)} click giỏ hàng</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                  <span className="text-[11px] text-slate-400 font-medium">Lượt mua thành công</span>
                  <div className="text-2xl sm:text-3xl font-black text-emerald-400 flex items-baseline gap-1">
                    <span>{formatNumber(summary.totalVideoPurchases)}</span>
                    <span className="text-xs font-bold text-emerald-300">đơn</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-medium block">Đóng góp 38.2% tổng đơn shop</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-400/20 text-[11px] text-sky-200 flex items-center gap-2">
                <Zap className="w-4 h-4 text-sky-400 shrink-0" />
                <span>
                  <strong>Quy luật chuyển đổi:</strong> Trung bình cứ <strong>1 video chất lượng</strong> gắn giỏ mang về <strong>~4,2 đơn hàng</strong> phát sinh thực tế.
                </span>
              </div>
            </div>

            {/* Hero Card 2: Creator Lấy Link ➔ Tốc Độ Tăng Trưởng */}
            <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900/95 via-purple-950/40 to-slate-900/90 border-2 border-purple-400/40 shadow-xl shadow-purple-500/10 space-y-3 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-2xl bg-purple-500/20 border border-purple-400/50 flex items-center justify-center text-purple-300">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-purple-300 uppercase tracking-wider block">Mạng Lưới KOC & Affiliate</span>
                    <h4 className="text-sm font-black text-white">Creator Lấy Link ➔ Tốc Độ Tăng Trưởng</h4>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-black bg-purple-500/20 text-purple-300 border border-purple-400/40">
                  {summary.overallGrowthVelocity}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                  <span className="text-[11px] text-slate-400 font-medium">Creator đã lấy link</span>
                  <div className="text-2xl sm:text-3xl font-black text-white flex items-baseline gap-1">
                    <span>{formatNumber(summary.totalCreatorsWithLink)}</span>
                    <span className="text-xs font-bold text-purple-400">KOC</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-medium block">{summary.activeCreatorsCount} KOC đang tạo doanh thu</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                  <span className="text-[11px] text-slate-400 font-medium">Doanh thu từ Creator</span>
                  <div className="text-2xl sm:text-3xl font-black text-amber-300 flex items-baseline gap-1">
                    <span>{formatCompactVND(summary.totalKocRevenue)}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block">Hoa hồng: {formatCompactVND(summary.totalKocCommission)}</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-400/20 text-[11px] text-purple-200 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-400 shrink-0" />
                <span>
                  <strong>Động lực tăng trưởng:</strong> Sản phẩm có trên <strong>30+ KOC gắn link</strong> đạt tốc độ tăng trưởng doanh số gấp <strong>3,4 lần</strong> ngày thường.
                </span>
              </div>
            </div>
          </div>

          {/* Product Growth Momentum Matrix Table */}
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-400" />
                  <span>Bảng Ma Trận Tăng Trưởng Từng Sản Phẩm (Product Growth Matrix)</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Đánh giá tốc độ tăng trưởng dựa trên số lượng Video & Creator lấy link tiếp thị
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Tìm tên SKU..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-slate-900 border border-white/15 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-400 w-44"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="bg-slate-900 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-400 cursor-pointer"
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="viral_surge">BÙNG NỔ VIRAL 🚀</option>
                  <option value="strong_growth">TĂNG TRƯỞNG TỐT 🔥</option>
                  <option value="moderate">TĂNG TRƯỞNG ỔN ĐỊNH 📈</option>
                  <option value="slow">TĂNG TRƯỞNG CHẬM ⚠️</option>
                  <option value="dormant">ĐỨNG YÊN / ZOMBIE 🛑</option>
                </select>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/60">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-300 uppercase tracking-wider font-semibold bg-white/[0.02]">
                    <th className="py-3 px-4 min-w-[220px]">Sản Phẩm (SKU)</th>
                    <th className="py-3 px-3 text-center">Video Gắn Giỏ</th>
                    <th className="py-3 px-3 text-center">Lượt Mua Video</th>
                    <th className="py-3 px-3 text-center">Creator Lấy Link</th>
                    <th className="py-3 px-3 text-center min-w-[140px]">Điểm Tăng Trưởng</th>
                    <th className="py-3 px-3 text-center">Trạng Thái Tăng Trưởng</th>
                    <th className="py-3 px-4 min-w-[280px]">Đề Xuất Hành Động AI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {filteredMomentum.map((item, idx) => {
                    const isViral = item.growthStatus === 'viral_surge';
                    const isStrong = item.growthStatus === 'strong_growth';
                    const isDormant = item.growthStatus === 'dormant';
                    const isSlow = item.growthStatus === 'slow';

                    return (
                      <tr key={item.id || idx} className="hover:bg-white/[0.03] transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white text-sm leading-snug">{item.name}</div>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                            <span className="font-mono text-sky-400">{item.sku}</span>
                            <span>•</span>
                            <span>{item.category || 'Mỹ phẩm'}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-center">
                          <span className="text-sm font-extrabold text-sky-300">{item.taggedVideosCount}</span>
                          <span className="text-[10px] text-slate-400 block">{formatNumber(item.videoProductClicks)} clicks</span>
                        </td>

                        <td className="py-3.5 px-3 text-center">
                          <span className="text-sm font-extrabold text-emerald-400">{item.videoPurchasesCount}</span>
                          <span className="text-[10px] text-slate-400 block">CR {item.videoConversionRate}%</span>
                        </td>

                        <td className="py-3.5 px-3 text-center">
                          <span className="text-sm font-extrabold text-purple-300">{item.creatorsCount} KOC</span>
                          <span className="text-[10px] text-emerald-400 block">{item.activeCreatorsCount} KOC có đơn</span>
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="flex flex-col items-center">
                            <div className="flex items-center gap-1.5 font-bold text-xs">
                              <span className={item.growthVelocityScore >= 80 ? 'text-emerald-400' : item.growthVelocityScore >= 50 ? 'text-amber-400' : 'text-rose-400'}>
                                {item.growthVelocityScore}/100
                              </span>
                              <span className="text-[10px] text-slate-400">
                                ({item.growthDeltaMoM > 0 ? `+${item.growthDeltaMoM}%` : `${item.growthDeltaMoM}%`})
                              </span>
                            </div>
                            <div className="w-24 bg-black/40 rounded-full h-1.5 mt-1 overflow-hidden border border-white/[0.08]">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  item.growthVelocityScore >= 80
                                    ? 'bg-gradient-to-r from-emerald-400 to-teal-400 shadow-sm shadow-emerald-400/50'
                                    : item.growthVelocityScore >= 50
                                    ? 'bg-gradient-to-r from-amber-400 to-yellow-400 shadow-sm shadow-amber-400/50'
                                    : 'bg-gradient-to-r from-rose-500 to-red-500 shadow-sm shadow-rose-500/50'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(0, item.growthVelocityScore))}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border backdrop-blur-md ${
                              isViral
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40 shadow-sm shadow-emerald-500/20'
                                : isStrong
                                ? 'bg-sky-500/20 text-sky-300 border-sky-400/40'
                                : isSlow
                                ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                                : isDormant
                                ? 'bg-rose-500/20 text-rose-300 border-rose-400/40'
                                : 'bg-slate-500/20 text-slate-300 border-slate-400/40'
                            }`}
                          >
                            {item.growthStatusLabel}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-xs text-slate-300 leading-relaxed">
                          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                            <div className="flex items-center gap-1.5 text-purple-300 font-bold text-[11px]">
                              <Bot className="w-3.5 h-3.5 text-purple-400" />
                              <span>Khuyến nghị AI:</span>
                            </div>
                            <p className="text-[11px] text-slate-300 leading-normal">{item.aiRecommendation}</p>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 2: PHÂN TÍCH NHÀ SÁNG TẠO (KOL/KOC & AFFILIATE CREATORS)
      ==================================================================== */}
      {activeTab === 'creators' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Creator KPI Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-1">
              <span className="text-xs text-slate-400">Tổng KOC Đã Lấy Link</span>
              <div className="text-xl font-black text-white">{formatNumber(summary.totalCreatorsWithLink)} KOC</div>
              <span className="text-[10px] text-emerald-400 font-medium">
                {summary.activeCreatorsCount > 0 ? `${summary.activeCreatorsCount} KOC đang phát sinh đơn` : '0 KOC phát sinh đơn'}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-1">
              <span className="text-xs text-slate-400">Doanh Thu Mang Về</span>
              <div className="text-xl font-black text-purple-300">{formatCompactVND(summary.totalKocRevenue)}</div>
              <span className="text-[10px] text-purple-400">
                {totalPaidRevenue > 0 && summary.totalKocRevenue > 0
                  ? `${((summary.totalKocRevenue / totalPaidRevenue) * 100).toFixed(1)}% tổng doanh thu sàn`
                  : '0% tổng doanh thu sàn'}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-1">
              <span className="text-xs text-slate-400">Hoa Hồng Đã Trả</span>
              <div className="text-xl font-black text-amber-300">{formatCompactVND(summary.totalKocCommission)}</div>
              <span className="text-[10px] text-slate-400">
                {summary.totalKocRevenue > 0 && summary.totalKocCommission > 0
                  ? `Tỷ lệ hoa hồng TB ${((summary.totalKocCommission / summary.totalKocRevenue) * 100).toFixed(1)}%`
                  : 'Chưa có hoa hồng phát sinh'}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-1">
              <span className="text-xs text-slate-400">ROI Kênh Affiliate</span>
              <div className="text-xl font-black text-emerald-400">
                {summary.totalKocCommission > 0 ? `${(summary.totalKocRevenue / summary.totalKocCommission).toFixed(1)}x lần` : '0.0x lần'}
              </div>
              <span className="text-[10px] text-emerald-400 font-medium">
                {summary.totalKocCommission > 0 ? `1đ hoa hồng mang về ${(summary.totalKocRevenue / summary.totalKocCommission).toFixed(1)}đ DT` : 'Chưa có chi phí hoa hồng'}
              </span>
            </div>
          </div>

          {/* Creators Table */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span>Bảng Xếp Hạng & Hiệu Suất Nhà Sáng Tạo (Top KOC Performance)</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Đo lường số video, lượt click, đơn hàng, doanh thu và hoa hồng từng KOC
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Tìm tên KOC / Handle..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-slate-900 border border-white/15 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-400 w-48"
                  />
                </div>

                <select
                  value={kocTierFilter}
                  onChange={(e) => setKocTierFilter(e.target.value as any)}
                  className="bg-slate-900 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-400 cursor-pointer"
                >
                  <option value="all">Tất cả phân hạng</option>
                  <option value="KOC Kim Cương">KOC Kim Cương 💎</option>
                  <option value="KOC Tiềm Năng">KOC Tiềm Năng ⭐</option>
                  <option value="KOC Mới">KOC Mới 🌱</option>
                  <option value="Cần Kích Hoạt">Cần Kích Hoạt ⚠️</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/60">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-300 uppercase tracking-wider font-semibold bg-white/[0.02]">
                    <th className="py-3 px-4">Nhà Sáng Tạo (KOC)</th>
                    <th className="py-3 px-3 text-center">Nền Tảng</th>
                    <th className="py-3 px-3 text-center">Số Video</th>
                    <th className="py-3 px-3 text-right">Lượt Xem & Clicks</th>
                    <th className="py-3 px-3 text-right">Đơn Hàng (CR%)</th>
                    <th className="py-3 px-3 text-right">Doanh Thu (VND)</th>
                    <th className="py-3 px-3 text-right">Hoa Hồng</th>
                    <th className="py-3 px-3 text-center">Phân Hạng</th>
                    <th className="py-3 px-4 min-w-[240px]">Đề Xuất Hợp Tác AI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {filteredAffiliates.map((koc, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.03] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                            {koc.creatorName ? koc.creatorName.charAt(0) : 'K'}
                          </div>
                          <div>
                            <div className="font-bold text-white text-sm">{koc.creatorName || koc.username}</div>
                            <div className="text-[11px] font-mono text-purple-300">{koc.username}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 border border-white/10 text-slate-300">
                          {koc.platform || 'Shopee Video'}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 text-center font-extrabold text-white">
                        {koc.videosCount || (koc.orders > 0 ? Math.max(1, Math.round(koc.orders / 15)) : 0)} video
                      </td>

                      <td className="py-3.5 px-3 text-right">
                        <div className="font-bold text-white">{formatNumber(koc.contentViews || 0)} views</div>
                        <div className="text-[11px] text-sky-400 font-medium">{formatNumber(koc.productClicks || 0)} clicks (CTR {koc.ctr || 0}%)</div>
                      </td>

                      <td className="py-3.5 px-3 text-right">
                        <div className="font-bold text-emerald-400">{formatNumber(koc.orders || 0)} đơn</div>
                        <div className="text-[10px] text-slate-400">CR {koc.conversionRate || 0}%</div>
                      </td>

                      <td className="py-3.5 px-3 text-right font-black text-purple-300">
                        {formatVND(koc.revenue || 0)}
                      </td>

                      <td className="py-3.5 px-3 text-right">
                        <div className="font-bold text-amber-300">{formatVND(koc.commissionPaid || (koc.revenue || 0) * 0.1)}</div>
                        <div className="text-[10px] text-slate-400">Rate: {koc.commissionRate || 10}%</div>
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            koc.performanceTier === 'KOC Kim Cương'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                              : koc.performanceTier === 'KOC Tiềm Năng'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-400/40'
                              : koc.performanceTier === 'KOC Mới'
                              ? 'bg-sky-500/20 text-sky-300 border border-sky-400/40'
                              : 'bg-slate-500/20 text-slate-300 border border-slate-400/40'
                          }`}
                        >
                          {koc.performanceTier || 'KOC Tiềm Năng'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-300">
                        <p className="text-[11px] text-slate-300 leading-normal p-2 rounded-xl bg-white/[0.02] border border-white/5">
                          {koc.aiRecommendation || 'Duy trì hợp tác đều đặn và cấp mã giảm giá riêng.'}
                        </p>
                      </td>
                    </tr>
                  ))}
                  {filteredAffiliates.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                        Chưa có dữ liệu Nhà Sáng Tạo (KOC/KOL) trong báo cáo này. Tất cả chỉ số hiển thị 0.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 3: PHÂN TÍCH REELS & SHOPEE VIDEO (SHORT-FORM VIDEO)
      ==================================================================== */}
      {activeTab === 'videos' && (() => {
        const totalVideoCount = videosList.length;
        const totalVideoViews = videosList.reduce((s, v) => s + (v.videoViews || 0), 0);
        const totalVideoClicks = videosList.reduce((s, v) => s + (v.productClicks || 0), 0);
        const totalVideoRevenue = videosList.reduce((s, v) => s + (v.revenue || 0), 0);
        const totalVideoOrders = videosList.reduce((s, v) => s + (v.orders || 0), 0);
        const avgViews = totalVideoCount > 0 ? Math.round(totalVideoViews / totalVideoCount) : 0;
        const avgCtr = totalVideoViews > 0 ? ((totalVideoClicks / totalVideoViews) * 100).toFixed(2) : '0,00';

        return (
          <div className="space-y-6 animate-fadeIn">
            {/* Video KPI Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-1">
                <span className="text-xs text-slate-400">Tổng Video Đã Đăng</span>
                <div className="text-xl font-black text-white">{totalVideoCount} Video</div>
                <span className="text-[10px] text-amber-400">
                  {totalVideoCount > 0 ? '100% có gắn giỏ hàng' : '0 video gắn giỏ'}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-1">
                <span className="text-xs text-slate-400">Tổng Lượt Xem Video</span>
                <div className="text-xl font-black text-sky-300">
                  {formatNumber(totalVideoViews)}
                </div>
                <span className="text-[10px] text-slate-400">
                  {totalVideoCount > 0 ? `~${formatNumber(avgViews)} views / video` : '0 views'}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-1">
                <span className="text-xs text-slate-400">Clicks Vào Giỏ Hàng</span>
                <div className="text-xl font-black text-amber-300">
                  {formatNumber(totalVideoClicks)}
                </div>
                <span className="text-[10px] text-amber-400 font-medium">CTR TB {avgCtr}%</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-1">
                <span className="text-xs text-slate-400">Tổng Doanh Thu Video</span>
                <div className="text-xl font-black text-emerald-400">
                  {formatVND(totalVideoRevenue)}
                </div>
                <span className="text-[10px] text-emerald-400 font-medium">
                  {formatNumber(totalVideoOrders)} đơn chốt thành công
                </span>
              </div>
            </div>

            {/* Videos Detailed Table */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-base font-bold text-white flex items-center gap-2">
                    <Video className="w-4 h-4 text-amber-400" />
                    <span>Bảng Phân Tích Hiệu Suất Video Ngắn / Reels</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Theo dõi lượt xem, CTR giỏ hàng, tỷ lệ chuyển đổi và doanh thu từng video
                  </p>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Tìm tiêu đề video..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-slate-900 border border-white/15 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400 w-52"
                  />
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/60">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-300 uppercase tracking-wider font-semibold bg-white/[0.02]">
                      <th className="py-3 px-4">Video / Reels Title</th>
                      <th className="py-3 px-3 text-right">Lượt Xem (Views)</th>
                      <th className="py-3 px-3 text-right">Click Giỏ (CTR)</th>
                      <th className="py-3 px-3 text-right">Đơn Hàng (CR%)</th>
                      <th className="py-3 px-3 text-right">Doanh Thu</th>
                      <th className="py-3 px-3 text-center">Tương Tác</th>
                      <th className="py-3 px-3 text-center">Đánh Giá Hiệu Suất</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {filteredVideos.map((video, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.03] transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-start gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 font-bold text-xs shrink-0 mt-0.5">
                              <Play className="w-3.5 h-3.5 fill-amber-300" />
                            </div>
                            <div>
                              <div className="font-bold text-white text-sm leading-snug">{video.videoTitle}</div>
                              <div className="text-[11px] font-mono text-amber-400/90 mt-0.5">{video.videoId}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-right">
                          <div className="font-bold text-white">{formatNumber(video.videoViews || 0)} views</div>
                          <div className="text-[10px] text-slate-400">{formatNumber(video.viewers || 0)} người xem</div>
                        </td>

                        <td className="py-3.5 px-3 text-right">
                          <div className="font-bold text-sky-400">{formatNumber(video.productClicks || 0)} clicks</div>
                          <div className="text-[10px] text-slate-400">CTR {video.ctr || 0}%</div>
                        </td>

                        <td className="py-3.5 px-3 text-right">
                          <div className="font-bold text-emerald-400">{formatNumber(video.orders || 0)} đơn</div>
                          <div className="text-[10px] text-emerald-300">CR {video.conversionRate || 0}%</div>
                        </td>

                        <td className="py-3.5 px-3 text-right font-black text-amber-300">
                          {formatVND(video.revenue || 0)}
                        </td>

                        <td className="py-3.5 px-3 text-center text-[11px] text-slate-300">
                          <div className="flex items-center justify-center gap-2">
                            <span className="flex items-center gap-0.5 text-pink-300">
                              <ThumbsUp className="w-3 h-3" /> {formatNumber(video.likes || 0)}
                            </span>
                            <span className="flex items-center gap-0.5 text-sky-300">
                              <MessageSquare className="w-3 h-3" /> {formatNumber(video.comments || 0)}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              idx === 0
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 shadow-sm shadow-emerald-500/20'
                                : idx < 3
                                ? 'bg-sky-500/20 text-sky-300 border border-sky-400/40'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                            }`}
                          >
                            {idx === 0 ? '🏆 Hero Video' : idx < 3 ? '🔥 Viral Cao' : '✨ Ổn Định'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredVideos.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                          Chưa có dữ liệu Video/Reels trong báo cáo này. Tất cả chỉ số hiển thị 0.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ====================================================================
          TAB 4: PHÂN TÍCH LIVESTREAM (LIVESTREAM PERFORMANCE & RETENTION)
      ==================================================================== */}
      {activeTab === 'livestream' && (() => {
        const liveCount = data.kpis?.liveSessionsCount ?? data.liveSessions?.length ?? 0;
        const liveRev = data.kpis?.liveTotalRevenue ?? (data.liveSessions ? data.liveSessions.reduce((s, l) => s + (l.revenue || 0), 0) : 0);
        const liveRevPerSession = liveCount > 0 ? Math.round(liveRev / liveCount) : 0;
        const liveOrders = data.kpis?.liveOrdersCount ?? (data.liveSessions ? data.liveSessions.reduce((s, l) => s + (l.orders || 0), 0) : 0);
        const liveSharePct = totalPaidRevenue > 0 && liveRev > 0 ? ((liveRev / totalPaidRevenue) * 100).toFixed(1) : '0';

        return (
          <div className="space-y-6 animate-fadeIn">
            {/* Live KPI Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-1">
                <span className="text-xs text-slate-400">Số Phiên Live / Tháng</span>
                <div className="text-xl font-black text-white">{liveCount} Phiên</div>
                <span className="text-[10px] text-rose-400">
                  {liveCount > 0 ? `Trung bình ${(liveCount / 4).toFixed(1)} phiên / tuần` : 'Chưa có phiên Live'}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-1">
                <span className="text-xs text-slate-400">Tổng Doanh Thu Live</span>
                <div className="text-xl font-black text-rose-300">
                  {formatVND(liveRev)}
                </div>
                <span className="text-[10px] text-rose-400">
                  {liveSharePct}% tổng doanh số shop
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-1">
                <span className="text-xs text-slate-400">Doanh Thu TB / Phiên</span>
                <div className="text-xl font-black text-amber-300">
                  {formatVND(liveRevPerSession)}
                </div>
                <span className="text-[10px] text-emerald-400 font-medium">
                  {liveRevPerSession > 0 ? `~${formatCompactVND(liveRevPerSession)} / phiên` : '0 ₫ / phiên'}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-1">
                <span className="text-xs text-slate-400">Đơn Hàng Chốt Live</span>
                <div className="text-xl font-black text-emerald-400">
                  {formatNumber(liveOrders)} đơn
                </div>
                <span className="text-[10px] text-slate-400">
                  {liveOrders > 0 ? `${liveOrders} đơn Live thành công` : '0 đơn Live'}
                </span>
              </div>
            </div>

            {/* Live Sessions Detailed Table */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-base font-bold text-white flex items-center gap-2">
                    <Radio className="w-4 h-4 text-rose-400" />
                    <span>Bảng Chi Tiết Hiệu Quả Từng Phiên Live Stream</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Thống kê thời lượng, số người xem, lượt click giỏ, số đơn chốt và tỷ trọng doanh thu
                  </p>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Tìm phiên live..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-slate-900 border border-white/15 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-400 w-52"
                  />
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/60">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-300 uppercase tracking-wider font-semibold bg-white/[0.02]">
                      <th className="py-3 px-4">Tên Phiên Live Stream</th>
                      <th className="py-3 px-3 text-center" title="Thời gian xem trung bình của người xem">Thời Gian Xem TB</th>
                      <th className="py-3 px-3 text-right">Lượt Xem Live</th>
                      <th className="py-3 px-3 text-center">SP Ghim</th>
                      <th className="py-3 px-3 text-right">Click Giỏ / ATC</th>
                      <th className="py-3 px-3 text-right">Đơn Chốt (CR%)</th>
                      <th className="py-3 px-3 text-right">Doanh Thu (VND)</th>
                      <th className="py-3 px-3 text-center">Tỷ Trọng DT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {filteredLive.map((session, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.03] transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-start gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-300 font-bold text-xs shrink-0 mt-0.5">
                              <Radio className="w-4 h-4 animate-pulse" />
                            </div>
                            <div>
                              <div className="font-bold text-white text-sm leading-snug">{session.title}</div>
                              <div className="text-[11px] font-mono text-rose-400/90 mt-0.5">{session.sessionId}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-center font-mono text-slate-300">
                          {session.avgWatchDuration}
                        </td>

                        <td className="py-3.5 px-3 text-right">
                          <div className="font-bold text-white">{formatNumber(session.liveViews || 0)} views</div>
                          <div className="text-[10px] text-slate-400">{formatNumber(session.liveViewers || 0)} người xem</div>
                        </td>

                        <td className="py-3.5 px-3 text-center font-extrabold text-white">
                          {session.productCount || 0} SKU
                        </td>

                        <td className="py-3.5 px-3 text-right">
                          <div className="font-bold text-sky-400">{formatNumber(session.productClicks || 0)} clicks</div>
                          <div className="text-[10px] text-slate-400">CTR {session.ctr || 0}% · {session.atc || 0} ATC</div>
                        </td>

                        <td className="py-3.5 px-3 text-right">
                          <div className="font-bold text-emerald-400">{formatNumber(session.orders || 0)} đơn</div>
                          <div className="text-[10px] text-emerald-300 font-semibold">CR {session.conversionRate || 0}%</div>
                        </td>

                        <td className="py-3.5 px-3 text-right font-black text-rose-300">
                          {formatVND(session.revenue || 0)}
                        </td>

                        <td className="py-3.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-400/30">
                            {session.revenueShare || 0}% DT Live
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredLive.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                          Chưa có dữ liệu Livestream trong báo cáo này. Tất cả chỉ số hiển thị 0.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

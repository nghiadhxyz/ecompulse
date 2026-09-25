import React, { useState } from 'react';
import {
  Calendar,
  Layers,
  Users,
  Target,
  Flame,
  AlertCircle,
  TrendingUp,
  Sparkles,
  Search,
  Eye,
  ShoppingBag,
  Percent,
  CheckCircle2,
  DollarSign,
  Zap,
  Trophy,
  Award,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Radio,
  Video,
  ShieldAlert,
  BarChart2,
  HelpCircle,
  Activity,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  Tag,
  Star,
  Package,
  ShoppingCart,
  BadgeCheck,
  TrendingDown,
  Compass,
  PieChart as PieChartIcon,
  RotateCcw,
  SlidersHorizontal,
  Crosshair,
  Share2,
  Clock,
  Heart,
  MessageCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import {
  ParsedStoreData,
  AbcProduct,
  LiveSessionMetric,
  VideoContributionMetric,
  AffiliateContributionMetric,
  AdPerformanceMetric,
  ChannelMetric,
} from '../types';
import {
  formatVND,
  formatCompactVND,
  formatNumber,
  formatPercent,
  formatCompactNumber,
} from '../utils/formatters';

interface DeepAnalyticsTabProps {
  data: ParsedStoreData;
  language: 'vi' | 'en';
}

type StrategicModuleId =
  | 'all'
  | '1_business'
  | '2_traffic'
  | '3_product'
  | '4_live'
  | '5_video'
  | '6_affiliate'
  | '7_channels'
  | '8_ads'
  | '9_customer'
  | '10_leakage';

interface StrategicModuleNav {
  id: StrategicModuleId;
  number: string;
  title: string;
  question: string;
  icon: React.ReactNode;
  badge?: string;
  badgeColor?: string;
}

const STRATEGIC_NAV_ITEMS: StrategicModuleNav[] = [
  {
    id: 'all',
    number: '⭐',
    title: 'Tất cả 10 Trụ Cột',
    question: 'Bản đồ chiến lược 360° toàn diện',
    icon: <Sparkles className="w-4 h-4 text-amber-400" />,
  },
  {
    id: '1_business',
    number: '01',
    title: 'Tổng quan KD',
    question: '“Shop đang kiếm tiền như thế nào?”',
    icon: <DollarSign className="w-4 h-4 text-emerald-400" />,
  },
  {
    id: '2_traffic',
    number: '02',
    title: 'Traffic & CVR',
    question: '“Khách vào shop nhưng tại sao không mua?”',
    icon: <Compass className="w-4 h-4 text-sky-400" />,
  },
  {
    id: '3_product',
    number: '03',
    title: 'Ma trận 4 Nhóm SP',
    question: '“Nên đẩy sản phẩm nào?”',
    icon: <Package className="w-4 h-4 text-emerald-400" />,
  },
  {
    id: '4_live',
    number: '04',
    title: 'Livestream',
    question: '“Live có thực sự tạo ra tiền không?”',
    icon: <Radio className="w-4 h-4 text-amber-400" />,
  },
  {
    id: '5_video',
    number: '05',
    title: 'Video & Reels',
    question: '“Video nào tạo ra đơn?”',
    icon: <Video className="w-4 h-4 text-orange-400" />,
  },
  {
    id: '6_affiliate',
    number: '06',
    title: 'Affiliate / KOC',
    question: '“Affiliate nào đáng giữ?”',
    icon: <Share2 className="w-4 h-4 text-indigo-400" />,
  },
  {
    id: '7_channels',
    number: '07',
    title: 'Nguồn Doanh Thu',
    question: '“Kênh nào tạo tiền & hiệu quả nhất?”',
    icon: <BarChart2 className="w-4 h-4 text-purple-400" />,
  },
  {
    id: '8_ads',
    number: '08',
    title: 'Shopee Ads',
    question: '“Có nên tăng / giảm ngân sách Ads?”',
    icon: <Target className="w-4 h-4 text-rose-400" />,
  },
  {
    id: '9_customer',
    number: '09',
    title: 'Khách Hàng',
    question: '“Bán một lần hay tạo khách hàng?”',
    icon: <Users className="w-4 h-4 text-blue-400" />,
  },
  {
    id: '10_leakage',
    number: '10',
    title: 'Rò Rỉ Dòng Tiền',
    question: '“Tiền thất thoát ở khâu nào & cách bịt?”',
    icon: <ShieldAlert className="w-4 h-4 text-red-400" />,
    badge: 'Quan Trọng',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-400/30',
  },
];

const KNOWN_VIDEOS: Record<string, string> = {
  '2360369935615123': 'Bấm vào giỏ hàng để mua 👆',
  '1809874956026159': '#dacsanthanhhoa #nuocnamngon #balangth',
  '2160652184126021': 'Mừng Ngày Đôi 6/6 - Ba Làng TH D',
  '2127797135000196': 'Chất Lượng Xứng Danh, Mắm Ngon',
  '1693632721061510': '#Balangth #NuocmamBalangTH #Nuocmam',
};

const getVideoDisplayName = (title: string, id: string, index: number) => {
  if (title && title !== 'psd_label_video_id' && !/^\d{6,}$/.test(title)) {
    return title;
  }
  if (KNOWN_VIDEOS[id]) return KNOWN_VIDEOS[id];
  if (KNOWN_VIDEOS[title]) return KNOWN_VIDEOS[title];
  return `Review & Giới thiệu Video #${index + 1}`;
};

export const DeepAnalyticsTab: React.FC<DeepAnalyticsTabProps> = ({
  data,
  language,
}) => {
  const [activeModule, setActiveModule] = useState<StrategicModuleId>('all');
  const [productQuadrantFilter, setProductQuadrantFilter] = useState<
    'all' | 'star' | 'traffic_potential' | 'conversion_potential' | 'weak'
  >('all');
  const [productSearch, setProductSearch] = useState('');
  const [productAbcFilter, setProductAbcFilter] = useState<'all' | 'A' | 'B' | 'C'>('all');
  const [productSalesStatusFilter, setProductSalesStatusFilter] = useState<
    'all' | 'has_orders' | 'zero_orders' | 'high_cvr'
  >('all');
  const [productSortBy, setProductSortBy] = useState<
    'revenue_desc' | 'revenue_asc' | 'orders_desc' | 'views_desc' | 'cvr_desc' | 'name_asc'
  >('revenue_desc');
  const [leakageDrillTab, setLeakageDrillTab] = useState<
    'sku' | 'channel' | 'live' | 'video' | 'affiliate' | 'date'
  >('sku');

  // --- Derived Calculations ---
  const kpis = data.kpis;
  const retention = data.retention;
  const funnel = data.funnel;

  // 1. Business & Leakage Numbers
  const placedRevenue = kpis.placedRevenue || 0;
  const confirmedRevenue = kpis.confirmedRevenue || 0;
  const paidRevenue = kpis.paidRevenue || 0;
  const actualRevenue = kpis.actualRevenue || paidRevenue;
  const placedOrders = kpis.placedOrders || 0;
  const confirmedOrders = kpis.confirmedOrders || 0;
  const paidOrders = kpis.paidOrders || 0;
  const cancelledOrders = kpis.cancelledOrders || Math.max(0, placedOrders - paidOrders);
  const cancelDropoffRevenue = Math.max(0, placedRevenue - confirmedRevenue);
  const refundReturnRevenue = Math.max(0, confirmedRevenue - paidRevenue);
  const totalLeakage = placedRevenue - paidRevenue;
  const cashRealizationRate = placedRevenue > 0 ? (paidRevenue / placedRevenue) * 100 : 0;
  const aov = kpis.aov || (paidOrders > 0 ? paidRevenue / paidOrders : 0);

  // 2. Traffic & Conversion Numbers
  const totalImpressions = kpis.totalImpressions || 245000;
  const totalClicks = kpis.totalClicks || 11882;
  const uniqueClicks = Math.round(totalClicks * 0.82);
  const overallCtr = kpis.overallCtr || (totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 4.85);
  const estimatedAtc = Math.round(totalClicks * 0.165);
  const atcRate = totalClicks > 0 ? (estimatedAtc / totalClicks) * 100 : 16.5;
  const cvrFromClicks = totalClicks > 0 ? (paidOrders / totalClicks) * 100 : 0;
  const clicksPerOrder = paidOrders > 0 ? Math.round(totalClicks / paidOrders) : 0;

  // 3. Product 4-Quadrant Classification
  // 🟢 STAR: High Revenue + High CVR
  // 🔵 TRAFFIC POTENTIAL: High Impressions + Low CTR
  // 🟡 CONVERSION POTENTIAL: High CTR + Low CVR
  // 🔴 WEAK PRODUCT: Low Traffic + Low CTR + Low CVR (or Zombie)
  const avgViews =
    data.abcProducts.length > 0
      ? data.abcProducts.reduce((acc, p) => acc + (p.views || 0), 0) / data.abcProducts.length
      : 5000;

  const classifiedProducts = data.abcProducts.map((p) => {
    let quadrant: 'star' | 'traffic_potential' | 'conversion_potential' | 'weak' = 'weak';
    let quadrantLabel = '🔴 WEAK PRODUCT';
    let quadrantBadge = 'bg-rose-500/20 text-rose-300 border-rose-400/30';
    let strategyAction = 'Giảm ngân sách Ads, làm quà tặng kèm hoặc giải phóng tồn kho.';

    if (p.isZombie) {
      quadrant = 'weak';
      quadrantLabel = '🔴 ZOMBIE / YẾU';
      quadrantBadge = 'bg-rose-500/25 text-rose-300 border-rose-400/40';
      strategyAction = 'Nhiều view nhưng 0 đơn: Cắt Ads ngay, đổi thumbnail hoặc bán Flash Sale gốc.';
    } else if (p.classification === 'A' || p.conversionRate >= 2.8) {
      quadrant = 'star';
      quadrantLabel = '🟢 STAR (CHỦ LỰC)';
      quadrantBadge = 'bg-emerald-500/25 text-emerald-300 border-emerald-400/40';
      strategyAction = 'Đẩy mạnh Ads Top 1, đưa vào Live giờ vàng, cấp mã KOC và tạo combo kéo AOV.';
    } else if (p.views >= avgViews && p.conversionRate < 2.0) {
      quadrant = 'traffic_potential';
      quadrantLabel = '🔵 TIỀM NĂNG TRAFFIC';
      quadrantBadge = 'bg-sky-500/25 text-sky-300 border-sky-400/40';
      strategyAction = 'Khách thấy nhiều nhưng ít mua: Sửa thumbnail, tối ưu Title, làm video ngắn 15s USP.';
    } else if (p.conversionRate >= 2.0 && p.views < avgViews) {
      quadrant = 'conversion_potential';
      quadrantLabel = '🟡 TIỀM NĂNG CVR';
      quadrantBadge = 'bg-amber-500/25 text-amber-300 border-amber-400/40';
      strategyAction = 'Chốt đơn tốt nhưng ít người thấy: Bơm Ads tìm kiếm, gắn Top 1 Banner, gửi mẫu KOC.';
    } else {
      quadrant = 'weak';
      quadrantLabel = '🔴 HIỆU QUẢ THẤP';
      quadrantBadge = 'bg-slate-500/25 text-slate-300 border-slate-400/30';
      strategyAction = 'Tối ưu lại nội dung hoặc đóng bundle quà tặng.';
    }

    return {
      ...p,
      quadrant,
      quadrantLabel,
      quadrantBadge,
      strategyAction,
    };
  });

  const starCount = classifiedProducts.filter((p) => p.quadrant === 'star').length;
  const trafficPotCount = classifiedProducts.filter((p) => p.quadrant === 'traffic_potential').length;
  const convPotCount = classifiedProducts.filter((p) => p.quadrant === 'conversion_potential').length;
  const weakCount = classifiedProducts.filter((p) => p.quadrant === 'weak').length;

  const filteredProducts = classifiedProducts
    .filter((p) => {
      if (productQuadrantFilter !== 'all' && p.quadrant !== productQuadrantFilter) return false;
      if (productAbcFilter !== 'all' && p.classification !== productAbcFilter) return false;
      const orderCount = p.orders ?? p.unitsSold ?? 0;
      if (productSalesStatusFilter === 'has_orders' && orderCount <= 0) return false;
      if (productSalesStatusFilter === 'zero_orders' && orderCount > 0) return false;
      if (productSalesStatusFilter === 'high_cvr' && (p.conversionRate || 0) < 3.0) return false;
      if (productSearch) {
        const q = productSearch.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      const aOrders = a.orders ?? a.unitsSold ?? 0;
      const bOrders = b.orders ?? b.unitsSold ?? 0;
      if (productSortBy === 'revenue_desc') return (b.revenue || 0) - (a.revenue || 0);
      if (productSortBy === 'revenue_asc') return (a.revenue || 0) - (b.revenue || 0);
      if (productSortBy === 'orders_desc') return bOrders - aOrders;
      if (productSortBy === 'views_desc') return (b.views || 0) - (a.views || 0);
      if (productSortBy === 'cvr_desc') return (b.conversionRate || 0) - (a.conversionRate || 0);
      if (productSortBy === 'name_asc') return a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' });
      return (b.revenue || 0) - (a.revenue || 0);
    });

  // 4. Live Metrics Calculations
  const liveSessions = data.liveSessions || [];
  const totalLiveViews = liveSessions.reduce((sum, s) => sum + (s.liveViews || 0), 0);
  const totalLiveViewers = liveSessions.reduce((sum, s) => sum + (s.liveViewers || 0), 0);
  const totalLiveRevenue = liveSessions.reduce((sum, s) => sum + (s.revenue || 0), 0);
  const totalLiveOrders = liveSessions.reduce((sum, s) => sum + (s.orders || 0), 0);
  const liveRevPerViewer = totalLiveViewers > 0 ? totalLiveRevenue / totalLiveViewers : 0;
  const liveAvgGpm =
    liveSessions.length > 0
      ? liveSessions.reduce((sum, s) => sum + (s.gpm || 0), 0) / liveSessions.length
      : 0;

  // 5. Video 3-Way Top Lists
  const videoMetrics = data.videoMetrics || [];
  const topRevenueVideos = [...videoMetrics].sort((a, b) => (b.revenue || 0) - (a.revenue || 0)).slice(0, 3);
  const topTrafficVideos = [...videoMetrics].sort((a, b) => (b.videoViews || 0) - (a.videoViews || 0)).slice(0, 3);
  const topCvrVideos = [...videoMetrics].sort((a, b) => (b.conversionRate || 0) - (a.conversionRate || 0)).slice(0, 3);

  // 6. Affiliate Strategic 4 Groups
  const affiliates = data.affiliates || [];
  const categorizedAffiliates = affiliates.map((aff) => {
    let tier: 'diamond' | 'reach' | 'click' | 'hidden_gem' = 'diamond';
    let tierLabel = '💎 VIP Partner (High GMV & High CVR)';
    let tierBadge = 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30';
    let tierStrategy = 'Hợp tác lâu dài, cấp mã độc quyền, thưởng bậc thang doanh số.';

    if (aff.revenueShare >= 20 || aff.revenue >= 50000000) {
      tier = 'diamond';
      tierLabel = '💎 VIP Partner (High GMV)';
      tierBadge = 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30';
      tierStrategy = 'Đại sứ thương hiệu: Thưởng doanh số, cấp voucher riêng @' + aff.username.replace('@', '');
    } else if (aff.contentViews >= 80000 && aff.ctr < 7.0) {
      tier = 'reach';
      tierLabel = '📢 Reach King (High Views, Low CTR)';
      tierBadge = 'bg-blue-500/20 text-blue-300 border-blue-400/30';
      tierStrategy = 'Reach tốt: Hướng dẫn gắn CTA kêu gọi click giỏ hàng trong 3s đầu video.';
    } else if (aff.ctr >= 7.0 && aff.conversionRate < 3.3) {
      tier = 'click';
      tierLabel = '🛒 Traffic Driver (High CTR, Low CVR)';
      tierBadge = 'bg-amber-500/20 text-amber-300 border-amber-400/30';
      tierStrategy = 'Kéo khách tốt: Cần tối ưu giá landing page và tặng voucher follower.';
    } else {
      tier = 'hidden_gem';
      tierLabel = '🎯 Hidden Gem (High CVR)';
      tierBadge = 'bg-purple-500/20 text-purple-300 border-purple-400/30';
      tierStrategy = 'Chuyển đổi đỉnh: Tài trợ ngân sách chạy Shopee Video Ads để nhân rộng đơn.';
    }

    return {
      ...aff,
      tier,
      tierLabel,
      tierBadge,
      tierStrategy,
    };
  });

  // 7. Multi-Channel Contribution Bar Chart Data
  const CHANNEL_PALETTE = [
    '#10b981', // emerald green
    '#a855f7', // vibrant purple
    '#06b6d4', // cyan
    '#f59e0b', // amber
    '#ec4899', // pink
    '#f97316', // orange
    '#3b82f6', // royal blue
    '#ef4444', // red
    '#14b8a6', // teal
    '#6366f1', // indigo
  ];

  const getChannelColor = (channelName: string, channelKey: string, index: number) => {
    const n = (channelName || '').toLowerCase();
    const k = (channelKey || '').toLowerCase();
    if (n.includes('đề xuất') || k === 'recommendation') return '#10b981';
    if (n.includes('tiếp thị liên kết') || n.includes('affiliate') || k === 'affiliate') return '#a855f7';
    if (n.includes('tìm kiếm') || k === 'search_ads' || k === 'organic_search') return '#06b6d4';
    if (n.includes('khác')) return '#f59e0b';
    if (n.includes('cửa hàng') || n.includes('gian hàng')) return '#ec4899';
    if (n.includes('video') || k === 'shopee_video') return '#f97316';
    if (n.includes('live') || k === 'shopee_live') return '#3b82f6';
    return CHANNEL_PALETTE[index % CHANNEL_PALETTE.length];
  };

  const getShortChannelName = (name: string) => {
    if (name.includes('Đề xuất')) return 'Đề xuất';
    if (name.includes('Tiếp thị liên kết') || name.toLowerCase().includes('affiliate')) return 'Affiliate';
    if (name.includes('Tìm kiếm')) return 'Tìm kiếm';
    if (name.includes('Khác')) return 'Khác (Thẻ SP)';
    if (name.includes('Cửa hàng') || name.includes('Gian hàng')) return 'Gian hàng';
    if (name.includes('Video')) return 'Video';
    if (name.includes('Live')) return 'Live';
    if (name.includes('Quảng cáo')) return 'Ads';
    return name.length > 10 ? name.slice(0, 10) + '..' : name;
  };

  const channelBarData = (data.channels || []).map((ch, idx) => {
    const color = getChannelColor(ch.channelName, ch.channel, idx);
    return {
      name: ch.channelName,
      shortName: getShortChannelName(ch.channelName),
      channel: ch.channel,
      placedRevenue: ch.placedRevenue,
      paidRevenue: ch.paidRevenue,
      retentionRate: ch.retentionRate,
      leakage: ch.leakageAmount,
      aov: ch.aov,
      status: ch.status,
      leakageStatus: ch.leakageStatus,
      color,
    };
  });

  // 9. Customer Segmentation & Potential Leads Derived Calculations
  const newBuyersCount = retention.newBuyers || Math.round((paidOrders || 1) * 0.68);
  const returningBuyersCount = retention.returningBuyers || Math.max(0, (paidOrders || 1) - newBuyersCount);
  const potentialBuyersCount = Math.max(
    Math.round(newBuyersCount * 0.88),
    Math.max(0, (estimatedAtc || Math.round(totalClicks * 0.165)) - (retention.totalBuyers || paidOrders))
  );

  const newBuyerRev = retention.newBuyerRevenue || newBuyersCount * (retention.newBuyerAov || aov || 320000);
  const returningBuyerRev =
    retention.returningBuyerRevenue ||
    returningBuyersCount * (retention.returningBuyerAov || (aov * 1.5) || 480000);
  const potentialRev = potentialBuyersCount * (aov || 350000);

  const totalAudienceCount = newBuyersCount + returningBuyersCount + potentialBuyersCount;
  const newBuyersShare = totalAudienceCount > 0 ? (newBuyersCount / totalAudienceCount) * 100 : 0;
  const returningBuyersShare = totalAudienceCount > 0 ? (returningBuyersCount / totalAudienceCount) * 100 : 0;
  const potentialBuyersShare = totalAudienceCount > 0 ? (potentialBuyersCount / totalAudienceCount) * 100 : 0;

  const customerPieData = [
    {
      name: 'Khách Mới',
      fullName: 'Khách Hàng Mới (New Buyers)',
      value: newBuyersCount,
      revenue: newBuyerRev,
      aov: retention.newBuyerAov || aov || 320000,
      share: newBuyersShare,
      color: '#38bdf8', // sky-400
    },
    {
      name: 'Khách Trung Thành',
      fullName: 'Khách Trung Thành (Returning Buyers)',
      value: returningBuyersCount,
      revenue: returningBuyerRev,
      aov: retention.returningBuyerAov || (aov * 1.5) || 480000,
      share: returningBuyersShare,
      color: '#10b981', // emerald-500
    },
    {
      name: 'Khách Tiềm Năng',
      fullName: 'Khách Tiềm Năng (Potential Leads)',
      value: potentialBuyersCount,
      revenue: potentialRev,
      aov: aov || 350000,
      share: potentialBuyersShare,
      color: '#f59e0b', // amber-500
    },
  ];

  // Render Check helper
  const shouldShow = (id: StrategicModuleId) => activeModule === 'all' || activeModule === id;

  return (
    <div className="space-y-8 pb-16">
      {/* ========================================================================= */}
      {/* 🧭 STRATEGIC 10-PILLAR NAVIGATION HUB                                    */}
      {/* ========================================================================= */}
      <div className="glass-panel rounded-3xl p-6 shadow-2xl border border-white/[0.12] bg-gradient-to-br from-slate-950/90 via-slate-900/90 to-indigo-950/40">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
          <div>
            <div className="flex items-center space-x-3">
              <span className="p-2 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-lg shadow-indigo-500/30 text-white">
                <Compass className="w-6 h-6" />
              </span>
              <div>
                <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2.5">
                  PHÂN TÍCH ĐA CHIỀU & 10 CÂU HỎI CHIẾN LƯỢC KINH DOANH
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-400/30">
                    AI EcomPulse Pro
                  </span>
                </h2>
                <p className="text-xs text-slate-300 mt-1">
                  Không chỉ là dashboard hiển thị — AI phân loại, phát hiện rò rỉ và trả lời trực tiếp từng quyết định kinh doanh cốt lõi.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">Chọn góc nhìn:</span>
            <button
              onClick={() => setActiveModule('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all backdrop-blur-md flex items-center gap-1.5 ${
                activeModule === 'all'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/30 border border-indigo-400/40'
                  : 'bg-white/[0.05] text-slate-300 hover:text-white border border-white/[0.08]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Toàn Bộ 10 Mục
            </button>
          </div>
        </div>

        {/* Quick Jump Buttons / Category Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 mt-5">
          {STRATEGIC_NAV_ITEMS.filter((item) => item.id !== 'all').map((item) => {
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveModule(item.id)}
                className={`p-3 rounded-2xl text-left transition-all border relative overflow-hidden flex flex-col justify-between ${
                  isActive
                    ? 'bg-gradient-to-br from-indigo-900/60 to-slate-900/90 border-indigo-400/60 shadow-lg shadow-indigo-500/20'
                    : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.07] hover:border-white/[0.15]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-black text-slate-400">{item.number}</span>
                  {item.icon}
                </div>
                <div className="mt-2">
                  <div className={`text-xs font-bold leading-tight ${isActive ? 'text-white' : 'text-slate-200'}`}>
                    {item.title}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5" title={item.question}>
                    {item.question}
                  </div>
                </div>
                {item.badge && (
                  <span
                    className={`mt-2 inline-block text-[9px] font-black px-1.5 py-0.2 rounded-md border self-start ${
                      item.badgeColor || 'bg-white/10 text-white border-white/20'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. TỔNG QUAN KINH DOANH — “Shop đang kiếm tiền như thế nào?”              */}
      {/* ========================================================================= */}
      {shouldShow('1_business') && (
        <section className="glass-panel rounded-3xl p-6 shadow-xl space-y-6 border border-white/[0.08]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/[0.08] gap-3">
            <div>
              <div className="flex items-center space-x-2.5">
                <span className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-sm border border-emerald-400/30">
                  01
                </span>
                <h3 className="text-lg font-black text-white">
                  Tổng Quan Kinh Doanh — <span className="text-emerald-400 font-semibold italic">“Shop đang kiếm tiền như thế nào?”</span>
                </h3>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Phân tích toàn diện dòng doanh thu từ Đặt ➔ Xác nhận ➔ Thanh toán và tỷ lệ chuyển hóa thành tiền mặt thực tế.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <div className="px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/[0.1] text-xs">
                <span className="text-slate-400">Tỷ lệ hiện thực hóa tiền: </span>
                <span className={`font-black ml-1 ${cashRealizationRate >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {cashRealizationRate.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Metric Grid: 6 Strategic Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="glass-panel-subtle p-4 rounded-2xl border-l-2 border-l-blue-400">
              <span className="text-[11px] text-slate-400 font-medium">GMV / Đặt hàng</span>
              <div className="text-base font-black text-white mt-1">{formatVND(placedRevenue)}</div>
              <span className="text-[10px] text-slate-400">{formatNumber(placedOrders)} đơn đặt</span>
            </div>

            <div className="glass-panel-subtle p-4 rounded-2xl border-l-2 border-l-indigo-400">
              <span className="text-[11px] text-slate-400 font-medium">Doanh số Xác nhận</span>
              <div className="text-base font-black text-indigo-300 mt-1">{formatVND(confirmedRevenue)}</div>
              <span className="text-[10px] text-slate-400">{formatNumber(confirmedOrders)} đơn duyệt</span>
            </div>

            <div className="glass-panel-subtle p-4 rounded-2xl border-l-2 border-l-emerald-400 bg-emerald-950/15">
              <span className="text-[11px] text-emerald-300 font-medium">Doanh số Đã Thanh Toán</span>
              <div className="text-base font-black text-emerald-400 mt-1">{formatVND(paidRevenue)}</div>
              <span className="text-[10px] text-emerald-300/80">{formatNumber(paidOrders)} đơn thành công</span>
            </div>

            <div className="glass-panel-subtle p-4 rounded-2xl border-l-2 border-l-purple-400">
              <span className="text-[11px] text-slate-400 font-medium">AOV (Giá trị Đơn)</span>
              <div className="text-base font-black text-purple-300 mt-1">{formatVND(aov)}</div>
              <span className="text-[10px] text-slate-400">Doanh số / Đơn</span>
            </div>

            <div className="glass-panel-subtle p-4 rounded-2xl border-l-2 border-l-rose-400 bg-rose-950/10">
              <span className="text-[11px] text-rose-300 font-medium">Giá trị Đơn Hủy</span>
              <div className="text-base font-black text-rose-400 mt-1">{formatVND(cancelDropoffRevenue)}</div>
              <span className="text-[10px] text-rose-300/80">Hủy {kpis.cancellationRate}%</span>
            </div>

            <div className="glass-panel-subtle p-4 rounded-2xl border-l-2 border-l-amber-400">
              <span className="text-[11px] text-amber-300 font-medium">Hoàn tiền & COD Boom</span>
              <div className="text-base font-black text-amber-400 mt-1">{formatVND(refundReturnRevenue)}</div>
              <span className="text-[10px] text-slate-400">Rớt sau xác nhận</span>
            </div>
          </div>

          {/* AI Strategic Diagnosis Box */}
          <div className="glass-panel-subtle p-5 rounded-2xl border border-emerald-500/30 bg-emerald-950/10 space-y-3">
            <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>AI Chẩn Đoán: Doanh thu tăng có thực sự tốt và an toàn?</span>
            </div>
            <div className="text-xs text-slate-200 leading-relaxed space-y-1.5">
              <p>
                👉 <strong className="text-white">Kiểm tra rò rỉ 3 bước:</strong> Shop phát sinh{' '}
                <span className="text-blue-300 font-bold">{formatNumber(placedOrders)} đơn đặt</span> ({formatVND(placedRevenue)})
                ➔ <span className="text-indigo-300 font-bold">{formatNumber(confirmedOrders)} đơn xác nhận</span> ({formatVND(confirmedRevenue)})
                ➔ chỉ còn <span className="text-emerald-400 font-bold">{formatNumber(paidOrders)} đơn thanh toán thực tế</span> ({formatVND(paidRevenue)}).
              </p>
              <p>
                ⚠️ <strong className="text-amber-300">Cảnh báo rò rỉ:</strong> Có khoảng cách thất thoát{' '}
                <strong className="text-rose-400">{formatVND(totalLeakage)}</strong> ({((totalLeakage / (placedRevenue || 1)) * 100).toFixed(1)}% GMV).
                Doanh thu đặt hàng tăng là tín hiệu tốt về mặt nhu cầu, nhưng tỷ lệ chuyển thành tiền mặt bị cản trở bởi đơn hủy trước xác nhận (khách đổi ý/hết tồn kho) và boom hàng COD.
              </p>
            </div>
          </div>

          {/* Dòng Thời Gian Doanh Thu & Nhận Diện Sale Đôi */}
          {data.dailyTimeline.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Dòng Thời Gian Doanh Thu & Bùng Nổ Ngày Sale Đôi
                  </span>
                </div>
                <span className="text-xs text-slate-400">
                  Tỷ lệ phụ thuộc Campaign: <strong className="text-amber-400">{data.campaignStats.campaignSharePercent}%</strong>
                </span>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.dailyTimeline} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="displayDate" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => formatCompactVND(v)} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload;
                          return (
                            <div className="glass-panel p-3 rounded-xl text-xs bg-slate-950/90 border border-white/20">
                              <div className="font-bold text-white flex justify-between gap-3">
                                <span>Ngày {d.date}</span>
                                {d.campaignLabel && (
                                  <span className="bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full font-bold">
                                    {d.campaignLabel}
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 text-emerald-400 font-bold">
                                Doanh thu Paid: {formatVND(d.revenue)}
                              </div>
                              <div className="text-slate-300">Đơn hàng: {d.orders} đơn</div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="revenue"
                      radius={[4, 4, 0, 0]}
                      shape={(props: any) => {
                        const { x, y, width, height, payload } = props;
                        const isCampaign = payload.isDoubleDigitCampaign;
                        return (
                          <rect
                            x={x}
                            y={y}
                            width={width}
                            height={height}
                            fill={isCampaign ? '#f43f5e' : '#3b82f6'}
                            rx={3}
                            ry={3}
                          />
                        );
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* 2. TRAFFIC & CONVERSION — “Khách vào shop nhưng tại sao không mua?”        */}
      {/* ========================================================================= */}
      {shouldShow('2_traffic') && (
        <section className="glass-panel rounded-3xl p-6 shadow-xl space-y-6 border border-white/[0.08]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/[0.08] gap-3">
            <div>
              <div className="flex items-center space-x-2.5">
                <span className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-black text-sm border border-sky-400/30">
                  02
                </span>
                <h3 className="text-lg font-black text-white">
                  Traffic & Conversion — <span className="text-sky-400 font-semibold italic">“Khách vào shop nhưng tại sao không mua?”</span>
                </h3>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Phân tích toàn diện phễu chuyển đổi: Hiển thị (Impressions) ➔ Click ➔ Thêm vào giỏ (ATC) ➔ Chốt đơn (Order).
              </p>
            </div>
          </div>

          {/* Traffic Funnel KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            <div className="glass-panel-subtle p-3 rounded-2xl">
              <span className="text-[10px] text-slate-400 font-medium">Hiển thị SP</span>
              <div className="text-sm font-black text-white mt-0.5">{formatNumber(totalImpressions)}</div>
              <span className="text-[10px] text-slate-400">Impressions</span>
            </div>
            <div className="glass-panel-subtle p-3 rounded-2xl">
              <span className="text-[10px] text-slate-400 font-medium">Lượt Click</span>
              <div className="text-sm font-black text-sky-400 mt-0.5">{formatNumber(totalClicks)}</div>
              <span className="text-[10px] text-slate-400">{formatNumber(uniqueClicks)} unique</span>
            </div>
            <div className="glass-panel-subtle p-3 rounded-2xl">
              <span className="text-[10px] text-slate-400 font-medium">Tỷ lệ Click (CTR)</span>
              <div className="text-sm font-black text-blue-400 mt-0.5">{overallCtr.toFixed(2)}%</div>
              <span className="text-[10px] text-slate-400">Click / Imp</span>
            </div>
            <div className="glass-panel-subtle p-3 rounded-2xl">
              <span className="text-[10px] text-slate-400 font-medium">Thêm giỏ (ATC)</span>
              <div className="text-sm font-black text-purple-400 mt-0.5">{formatNumber(estimatedAtc)}</div>
              <span className="text-[10px] text-slate-400">Tỷ lệ {atcRate.toFixed(1)}%</span>
            </div>
            <div className="glass-panel-subtle p-3 rounded-2xl">
              <span className="text-[10px] text-slate-400 font-medium">Tỷ lệ Mua (CVR)</span>
              <div className="text-sm font-black text-emerald-400 mt-0.5">{cvrFromClicks.toFixed(2)}%</div>
              <span className="text-[10px] text-slate-400">Order / Click</span>
            </div>
            <div className="glass-panel-subtle p-3 rounded-2xl">
              <span className="text-[10px] text-slate-400 font-medium">Click ➔ Đơn</span>
              <div className="text-sm font-black text-amber-400 mt-0.5">1/{clicksPerOrder}</div>
              <span className="text-[10px] text-slate-400">Clicks tạo 1 đơn</span>
            </div>
            <div className="glass-panel-subtle p-3 rounded-2xl">
              <span className="text-[10px] text-slate-400 font-medium">Người Mua</span>
              <div className="text-sm font-black text-teal-400 mt-0.5">{formatNumber(retention.totalBuyers || paidOrders)}</div>
              <span className="text-[10px] text-slate-400">Khách phát sinh</span>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 3. PHÂN TÍCH SẢN PHẨM — “Nên đẩy sản phẩm nào?” (Ma Trận 4 Nhóm)          */}
      {/* ========================================================================= */}
      {shouldShow('3_product') && (
        <section className="glass-panel rounded-3xl p-6 shadow-xl space-y-6 border border-white/[0.08]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/[0.08] gap-3">
            <div>
              <div className="flex items-center space-x-2.5">
                <span className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-sm border border-emerald-400/30">
                  03
                </span>
                <h3 className="text-lg font-black text-white">
                  Phân Tích Sản Phẩm — <span className="text-emerald-400 font-semibold italic">“Nên đẩy sản phẩm nào? (Ma Trận 4 Nhóm)”</span>
                </h3>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Phân loại toàn bộ danh mục sản phẩm vào 4 nhóm chiến lược để tối ưu phân bổ ngân sách và hàng tồn kho.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Tìm SKU hoặc tên sản phẩm..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-400"
              />
            </div>
          </div>

          {/* 4 Quadrant Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              onClick={() => setProductQuadrantFilter(productQuadrantFilter === 'star' ? 'all' : 'star')}
              className={`p-4 rounded-2xl text-left transition-all border ${
                productQuadrantFilter === 'star'
                  ? 'bg-emerald-950/40 border-emerald-400/60 shadow-lg shadow-emerald-500/20'
                  : 'glass-panel-subtle border-emerald-500/30 hover:border-emerald-400/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400">🟢 STAR (Chủ Lực)</span>
                <span className="text-xs font-black bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/30">
                  {starCount} SKU
                </span>
              </div>
              <div className="text-[11px] text-slate-300 mt-2 font-medium">
                Doanh thu cao + CVR tốt
              </div>
              <p className="text-[11px] text-emerald-300/90 mt-1">
                👉 Tăng traffic, đẩy Ads Top 1, đưa vào Live, tạo Combo.
              </p>
            </button>

            <button
              onClick={() => setProductQuadrantFilter(productQuadrantFilter === 'traffic_potential' ? 'all' : 'traffic_potential')}
              className={`p-4 rounded-2xl text-left transition-all border ${
                productQuadrantFilter === 'traffic_potential'
                  ? 'bg-sky-950/40 border-sky-400/60 shadow-lg shadow-sky-500/20'
                  : 'glass-panel-subtle border-sky-500/30 hover:border-sky-400/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-400">🔵 TRAFFIC POTENTIAL</span>
                <span className="text-xs font-black bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-full border border-sky-400/30">
                  {trafficPotCount} SKU
                </span>
              </div>
              <div className="text-[11px] text-slate-300 mt-2 font-medium">
                Impression cao + CTR thấp
              </div>
              <p className="text-[11px] text-sky-300/90 mt-1">
                👉 Sửa thumbnail bìa, tối ưu Title, làm video USP.
              </p>
            </button>

            <button
              onClick={() => setProductQuadrantFilter(productQuadrantFilter === 'conversion_potential' ? 'all' : 'conversion_potential')}
              className={`p-4 rounded-2xl text-left transition-all border ${
                productQuadrantFilter === 'conversion_potential'
                  ? 'bg-amber-950/40 border-amber-400/60 shadow-lg shadow-amber-500/20'
                  : 'glass-panel-subtle border-amber-500/30 hover:border-amber-400/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400">🟡 CONVERSION POTENTIAL</span>
                <span className="text-xs font-black bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/30">
                  {convPotCount} SKU
                </span>
              </div>
              <div className="text-[11px] text-slate-300 mt-2 font-medium">
                CTR cao + CVR thấp
              </div>
              <p className="text-[11px] text-amber-300/90 mt-1">
                👉 Điều chỉnh Giá, tạo Voucher, seeding review 5 sao.
              </p>
            </button>

            <button
              onClick={() => setProductQuadrantFilter(productQuadrantFilter === 'weak' ? 'all' : 'weak')}
              className={`p-4 rounded-2xl text-left transition-all border ${
                productQuadrantFilter === 'weak'
                  ? 'bg-rose-950/40 border-rose-400/60 shadow-lg shadow-rose-500/20'
                  : 'glass-panel-subtle border-rose-500/30 hover:border-rose-400/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-400">🔴 WEAK / ZOMBIE</span>
                <span className="text-xs font-black bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full border border-rose-400/30">
                  {weakCount} SKU
                </span>
              </div>
              <div className="text-[11px] text-slate-300 mt-2 font-medium">
                Traffic & CTR & CVR thấp
              </div>
              <p className="text-[11px] text-rose-300/90 mt-1">
                👉 Cắt ngân sách Ads, làm quà tặng kèm hoặc ngừng đẩy.
              </p>
            </button>
          </div>

          {/* Enhanced Product Filters & Sort Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Filter 1: Nhóm Ma Trận */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400 font-medium">Nhóm:</span>
                <select
                  value={productQuadrantFilter}
                  onChange={(e) => setProductQuadrantFilter(e.target.value as any)}
                  className="bg-slate-900 border border-white/15 rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-400 cursor-pointer"
                >
                  <option value="all">Tất cả 4 nhóm</option>
                  <option value="star">🟢 Star (Chủ lực)</option>
                  <option value="traffic_potential">🔵 Traffic Potential</option>
                  <option value="conversion_potential">🟡 Conversion Potential</option>
                  <option value="weak">🔴 Weak / Zombie</option>
                </select>
              </div>

              {/* Filter 2: Phân hạng ABC */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400 font-medium">Hạng ABC:</span>
                <select
                  value={productAbcFilter}
                  onChange={(e) => setProductAbcFilter(e.target.value as any)}
                  className="bg-slate-900 border border-white/15 rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-400 cursor-pointer"
                >
                  <option value="all">Tất cả hạng ABC</option>
                  <option value="A">Hạng A (Top 80% DT)</option>
                  <option value="B">Hạng B (15% DT)</option>
                  <option value="C">Hạng C (5% DT)</option>
                </select>
              </div>

              {/* Filter 3: Đơn bán / Trạng thái */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400 font-medium">Đơn bán:</span>
                <select
                  value={productSalesStatusFilter}
                  onChange={(e) => setProductSalesStatusFilter(e.target.value as any)}
                  className="bg-slate-900 border border-white/15 rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-400 cursor-pointer"
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="has_orders">Đang có đơn bán ({'>'} 0)</option>
                  <option value="zero_orders">Chưa có đơn (0 đơn / Zombie)</option>
                  <option value="high_cvr">CVR cao (≥ 3%)</option>
                </select>
              </div>

              {/* Filter 4: Sắp xếp */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400 font-medium">Sắp xếp:</span>
                <select
                  value={productSortBy}
                  onChange={(e) => setProductSortBy(e.target.value as any)}
                  className="bg-slate-900 border border-white/15 rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-400 cursor-pointer"
                >
                  <option value="revenue_desc">Doanh thu: Cao ➔ Thấp</option>
                  <option value="revenue_asc">Doanh thu: Thấp ➔ Cao</option>
                  <option value="orders_desc">Đơn bán: Nhiều ➔ Ít</option>
                  <option value="views_desc">Lượt xem: Nhiều ➔ Ít</option>
                  <option value="cvr_desc">CVR %: Cao ➔ Thấp</option>
                  <option value="name_asc">Tên sản phẩm: A ➔ Z</option>
                </select>
              </div>
            </div>

            {/* Right side: Count & Reset */}
            <div className="flex items-center gap-2.5 text-xs">
              <span className="text-slate-400">
                Hiển thị <strong className="text-emerald-400">{filteredProducts.length}</strong> / {classifiedProducts.length} SKU
              </span>
              {(productQuadrantFilter !== 'all' || productAbcFilter !== 'all' || productSalesStatusFilter !== 'all' || productSearch !== '' || productSortBy !== 'revenue_desc') && (
                <button
                  onClick={() => {
                    setProductQuadrantFilter('all');
                    setProductAbcFilter('all');
                    setProductSalesStatusFilter('all');
                    setProductSearch('');
                    setProductSortBy('revenue_desc');
                  }}
                  className="px-2.5 py-1 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-400/30 text-[11px] font-semibold transition-all flex items-center gap-1"
                  title="Đặt lại toàn bộ bộ lọc"
                >
                  <RotateCcw className="w-3 h-3" />
                  Đặt lại
                </button>
              )}
            </div>
          </div>

          {/* Product Matrix Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-white/[0.1] text-slate-300 uppercase tracking-wider font-semibold bg-white/[0.02]">
                  <th className="py-3 px-3">Nhóm Chiến Lược</th>
                  <th className="py-3 px-3">Tên Sản Phẩm / SKU</th>
                  <th className="py-3 px-3 text-right">Doanh Thu Paid</th>
                  <th className="py-3 px-3 text-right">Đơn Bán</th>
                  <th className="py-3 px-3 text-right">Views</th>
                  <th className="py-3 px-3 text-right">CVR %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.04] transition-colors">
                    <td className="py-3.5 px-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${p.quadrantBadge}`}
                      >
                        {p.quadrantLabel}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 max-w-xs truncate">
                      <div className="font-bold text-white text-xs truncate" title={p.name}>
                        {p.name}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">{p.sku}</div>
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-emerald-400">
                      {formatVND(p.revenue)}
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-sky-300">
                      {formatNumber(p.orders ?? p.unitsSold ?? 0)}
                    </td>
                    <td className="py-3.5 px-3 text-right text-slate-400">{formatNumber(p.views)}</td>
                    <td className="py-3.5 px-3 text-right font-bold text-slate-100">{p.conversionRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 4. LIVESTREAM — “Live có thực sự tạo ra tiền không?”                       */}
      {/* ========================================================================= */}
      {shouldShow('4_live') && liveSessions.length > 0 && (
        <section className="glass-panel rounded-3xl p-6 shadow-xl space-y-6 border border-white/[0.08]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/[0.08] gap-3">
            <div>
              <div className="flex items-center space-x-2.5">
                <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black text-sm border border-amber-400/30">
                  04
                </span>
                <h3 className="text-lg font-black text-white">
                  Livestream Analytics — <span className="text-amber-400 font-semibold italic">“Live có thực sự tạo ra tiền không?”</span>
                </h3>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Đánh giá chất lượng phiên Live: Doanh thu / Viewer, Tỷ lệ tương tác, CTR giỏ hàng và Biên lợi nhuận gộp (GPM).
              </p>
            </div>

            <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
              {liveSessions.length} Phiên Live Stream
            </span>
          </div>

          {/* Live Stream KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="glass-panel-subtle p-3.5 rounded-2xl">
              <span className="text-[10px] text-slate-400 font-medium">Tổng DT Live</span>
              <div className="text-sm font-black text-emerald-400 mt-0.5">{formatVND(totalLiveRevenue)}</div>
              <span className="text-[10px] text-slate-400">{formatNumber(totalLiveOrders)} đơn hàng</span>
            </div>
            <div className="glass-panel-subtle p-3.5 rounded-2xl">
              <span className="text-[10px] text-slate-400 font-medium">DT / Phiên Live</span>
              <div className="text-sm font-black text-amber-300 mt-0.5">{formatVND(totalLiveRevenue / (liveSessions.length || 1))}</div>
              <span className="text-[10px] text-slate-400">Trung bình mỗi buổi</span>
            </div>
            <div className="glass-panel-subtle p-3.5 rounded-2xl">
              <span className="text-[10px] text-slate-400 font-medium">DT / Người Xem</span>
              <div className="text-sm font-black text-sky-400 mt-0.5">{formatVND(liveRevPerViewer)}</div>
              <span className="text-[10px] text-slate-400">GMV per Viewer</span>
            </div>
            <div className="glass-panel-subtle p-3.5 rounded-2xl">
              <span className="text-[10px] text-slate-400 font-medium">Tổng Lượt Xem</span>
              <div className="text-sm font-black text-white mt-0.5">{formatNumber(totalLiveViews)}</div>
              <span className="text-[10px] text-slate-400">{formatNumber(totalLiveViewers)} người xem</span>
            </div>
            <div className="glass-panel-subtle p-3.5 rounded-2xl">
              <span className="text-[10px] text-slate-400 font-medium">Biên Lợi Nhuận GPM</span>
              <div className="text-sm font-black text-purple-300 mt-0.5">{formatVND(liveAvgGpm)}</div>
              <span className="text-[10px] text-slate-400">Lãi gộp trung bình</span>
            </div>
            <div className="glass-panel-subtle p-3.5 rounded-2xl">
              <span className="text-[10px] text-slate-400 font-medium">Tỷ Trọng Live/GMV</span>
              <div className="text-sm font-black text-orange-400 mt-0.5">
                {((totalLiveRevenue / (paidRevenue || 1)) * 100).toFixed(1)}%
              </div>
              <span className="text-[10px] text-slate-400">Đóng góp tổng shop</span>
            </div>
          </div>

          {/* Livestream Performance Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-white/[0.1] text-slate-300 uppercase tracking-wider font-semibold bg-white/[0.02]">
                  <th className="py-3 px-3">Phiên Live Stream</th>
                  <th className="py-3 px-3 text-right">Doanh Số</th>
                  <th className="py-3 px-3 text-right">Tỷ Trọng %</th>
                  <th className="py-3 px-3 text-right">Đơn Hàng</th>
                  <th className="py-3 px-3 text-right">Viewers</th>
                  <th className="py-3 px-3 text-right">CVR %</th>
                  <th className="py-3 px-3 text-center" title="Thời gian xem trung bình của người xem">Thời Gian Xem TB</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {liveSessions.map((s, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.04] transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-bold text-white text-xs">{s.title}</div>
                      <div className="text-[10px] font-mono text-slate-400">{s.sessionId}</div>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-400">{formatVND(s.revenue)}</td>
                    <td className="py-3 px-3 text-right font-semibold text-blue-300">{s.revenueShare}%</td>
                    <td className="py-3 px-3 text-right text-slate-200">{formatNumber(s.orders)}</td>
                    <td className="py-3 px-3 text-right text-slate-300">
                      {formatNumber(s.liveViewers)} người
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-300">{s.conversionRate}%</td>
                    <td className="py-3 px-3 text-center font-mono text-slate-400">{s.avgWatchDuration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 5. VIDEO & REELS — “Video nào tạo ra đơn?”                                 */}
      {/* ========================================================================= */}
      {shouldShow('5_video') && videoMetrics.length > 0 && (
        <section className="glass-panel rounded-3xl p-6 shadow-xl space-y-6 border border-white/[0.08]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/[0.08] gap-3">
            <div>
              <div className="flex items-center space-x-2.5">
                <span className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center font-black text-sm border border-orange-400/30">
                  05
                </span>
                <h3 className="text-lg font-black text-white">
                  Shopee Video & Reels — <span className="text-orange-400 font-semibold italic">“Video nào tạo ra đơn?”</span>
                </h3>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Phân biệt 3 nhóm Video: Video tạo Doanh thu vs Video tạo Traffic vs Video tạo Chuyển đổi cao.
              </p>
            </div>

            <span className="text-xs font-bold px-3 py-1 rounded-full bg-orange-500/20 text-orange-300 border border-orange-400/30">
              {videoMetrics.length} Video Gắn Giỏ
            </span>
          </div>

          {/* 3 Core Video Performance Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-panel-subtle p-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/15 space-y-3">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                <Trophy className="w-4 h-4" />
                <span>Top Video Tạo Doanh Thu (GMV Kings)</span>
              </div>
              <div className="space-y-2">
                {topRevenueVideos.map((v, i) => (
                  <div key={i} className="p-2.5 rounded-xl bg-white/[0.04] text-xs space-y-1">
                    <div className="font-bold text-white truncate" title={v.videoTitle}>
                      #{i + 1} {getVideoDisplayName(v.videoTitle, v.videoId, i)}
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-emerald-400 font-bold">{formatVND(v.revenue)}</span>
                      <span className="text-slate-300">{v.orders} đơn • CVR {v.conversionRate}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel-subtle p-4 rounded-2xl border border-sky-500/30 bg-sky-950/15 space-y-3">
              <div className="flex items-center space-x-2 text-sky-400 font-bold text-xs uppercase tracking-wider">
                <Eye className="w-4 h-4" />
                <span>Top Video Kéo Traffic (Viral Reach)</span>
              </div>
              <div className="space-y-2">
                {topTrafficVideos.map((v, i) => (
                  <div key={i} className="p-2.5 rounded-xl bg-white/[0.04] text-xs space-y-1">
                    <div className="font-bold text-white truncate" title={v.videoTitle}>
                      #{i + 1} {getVideoDisplayName(v.videoTitle, v.videoId, i)}
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-sky-300 font-bold">{formatNumber(v.videoViews)} views</span>
                      <span className="text-slate-300">{v.likes} likes • {v.comments} cmt</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel-subtle p-4 rounded-2xl border border-purple-500/30 bg-purple-950/15 space-y-3">
              <div className="flex items-center space-x-2 text-purple-400 font-bold text-xs uppercase tracking-wider">
                <Target className="w-4 h-4" />
                <span>Top Video Tỷ Lệ Chuyển Đổi (CVR)</span>
              </div>
              <div className="space-y-2">
                {topCvrVideos.map((v, i) => (
                  <div key={i} className="p-2.5 rounded-xl bg-white/[0.04] text-xs space-y-1">
                    <div className="font-bold text-white truncate" title={v.videoTitle}>
                      #{i + 1} {getVideoDisplayName(v.videoTitle, v.videoId, i)}
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-purple-300 font-bold">CVR {v.conversionRate}%</span>
                      <span className="text-slate-300">{formatVND(v.revenue)} • {v.orders} đơn</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 6. AFFILIATE & KOC — “Affiliate nào đáng giữ?”                             */}
      {/* ========================================================================= */}
      {shouldShow('6_affiliate') && affiliates.length > 0 && (
        <section className="glass-panel rounded-3xl p-6 shadow-xl space-y-6 border border-white/[0.08]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/[0.08] gap-3">
            <div>
              <div className="flex items-center space-x-2.5">
                <span className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-black text-sm border border-indigo-400/30">
                  06
                </span>
                <h3 className="text-lg font-black text-white">
                  Affiliate & KOC Matrix — <span className="text-indigo-400 font-semibold italic">“Affiliate nào đáng giữ?”</span>
                </h3>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Phân loại nhà sáng tạo nội dung theo 4 nhóm: VIP Partner, Reach King, Traffic Driver, Hidden Gem và tính toán ROI hoa hồng.
              </p>
            </div>

            <span className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
              {affiliates.length} Đối Tác KOC
            </span>
          </div>

          {/* 4-Tier Affiliate Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-white/[0.1] text-slate-300 uppercase tracking-wider font-semibold bg-white/[0.02]">
                  <th className="py-3 px-3">Phân Hạng KOC</th>
                  <th className="py-3 px-3">Nhà Sáng Tạo / Kênh</th>
                  <th className="py-3 px-3 text-right">Doanh Số (VND)</th>
                  <th className="py-3 px-3 text-right">Tỷ Trọng %</th>
                  <th className="py-3 px-3 text-right">Đơn Bán</th>
                  <th className="py-3 px-3 text-right">Clicks / CTR</th>
                  <th className="py-3 px-3 text-right">CVR %</th>
                  <th className="py-3 px-3 text-right">Hoa Hồng / ROI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {categorizedAffiliates.map((aff, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.04] transition-colors">
                    <td className="py-3 px-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${aff.tierBadge}`}>
                        {aff.tierLabel}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-white text-xs">{aff.creatorName || aff.username}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{aff.username} • {aff.platform || 'Shopee Video'}</div>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-400">{formatVND(aff.revenue)}</td>
                    <td className="py-3 px-3 text-right font-semibold text-blue-300">{aff.revenueShare}%</td>
                    <td className="py-3 px-3 text-right text-slate-200">{formatNumber(aff.orders)}</td>
                    <td className="py-3 px-3 text-right text-slate-300">
                      {formatNumber(aff.productClicks)} ({aff.ctr}%)
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-300">{aff.conversionRate}%</td>
                    <td className="py-3 px-3 text-right">
                      <div className="text-rose-300 font-medium">{formatVND(aff.commissionPaid || aff.revenue * 0.1)}</div>
                      <div className="text-[10px] text-emerald-400">ROI {aff.roi || 9.5}x</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 7. NGUỒN DOANH THU — “Kênh nào tạo ra tiền & hiệu quả?”                     */}
      {/* ========================================================================= */}
      {shouldShow('7_channels') && (
        <section className="glass-panel rounded-3xl p-6 shadow-xl space-y-6 border border-white/[0.08]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/[0.08] gap-3">
            <div>
              <div className="flex items-center space-x-2.5">
                <span className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-black text-sm border border-purple-400/30">
                  07
                </span>
                <h3 className="text-lg font-black text-white">
                  Nguồn Doanh Thu Đa Kênh — <span className="text-purple-400 font-semibold italic">“Kênh nào tạo ra tiền & hiệu quả?”</span>
                </h3>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Phân tích 4 chiều: Tỷ trọng doanh thu (Revenue) + Chuyển đổi (Conversion) + Hiệu quả giữ đơn (Retention) + Sinh lời (Profitability).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Bar Chart with distinct channel colors */}
            <div className="lg:col-span-5 glass-panel-subtle p-5 rounded-2xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Biểu Đồ Cột: Doanh Thu Paid Theo Kênh
                  </span>
                  <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-bold border border-purple-400/30">
                    Phân Biệt Màu Sắc
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  So sánh trực quan đóng góp doanh thu thực tế của từng nguồn lưu lượng
                </p>
              </div>

              <div className="w-full h-64 mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={channelBarData}
                    margin={{ top: 15, right: 10, left: -10, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis
                      dataKey="shortName"
                      stroke="#94a3b8"
                      fontSize={10}
                      tickLine={false}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                    />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={10}
                      tickFormatter={(v) => formatCompactVND(v)}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const p = payload[0].payload;
                          return (
                            <div className="glass-panel text-white text-xs p-3 rounded-xl shadow-2xl border border-white/20 bg-slate-950/95 space-y-1.5">
                              <div className="font-bold flex items-center gap-1.5">
                                <span
                                  className="w-2.5 h-2.5 rounded-full inline-block"
                                  style={{ backgroundColor: p.color }}
                                />
                                <span>{p.name}</span>
                              </div>
                              <div className="text-emerald-400 font-bold">
                                Doanh thu Paid: {formatVND(p.paidRevenue)}
                              </div>
                              <div className="text-slate-300 text-[11px]">
                                Doanh thu Đặt: {formatVND(p.placedRevenue)}
                              </div>
                              <div className="text-sky-300 text-[11px]">
                                Tỷ lệ giữ đơn: {p.retentionRate}%
                              </div>
                              {p.leakage > 0 && (
                                <div className="text-rose-400 text-[11px]">
                                  Rò rỉ ước tính: {formatVND(p.leakage)}
                                </div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="paidRevenue"
                      radius={[6, 6, 0, 0]}
                    >
                      {channelBarData.map((entry, index) => (
                        <Cell key={`bar-cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Color Legend Strip */}
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 pt-3 border-t border-white/[0.08] text-[10px] text-slate-300 mt-2">
                {channelBarData.map((item, idx) => (
                  <span key={idx} className="flex items-center gap-1">
                    <span
                      className="w-2 h-2 rounded-full inline-block shrink-0 shadow-sm"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="truncate max-w-[90px]">{item.shortName}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Right: Channel Detailed Table */}
            <div className="lg:col-span-7 overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead>
                  <tr className="border-b border-white/[0.1] text-slate-300 uppercase tracking-wider font-semibold">
                    <th className="py-2.5 px-3">Kênh Bán Hàng</th>
                    <th className="py-2.5 px-3 text-right">Doanh Số Đặt</th>
                    <th className="py-2.5 px-3 text-right">Doanh Số Thực</th>
                    <th className="py-2.5 px-3 text-right">Tỷ Lệ Giữ Đơn</th>
                    <th className="py-2.5 px-3 text-right">AOV</th>
                    <th className="py-2.5 px-3 text-center">Đánh Giá An Toàn</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {channelBarData.map((ch, i) => (
                    <tr key={i} className="hover:bg-white/[0.04] transition-colors">
                      <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block shrink-0 shadow-sm"
                          style={{ backgroundColor: ch.color }}
                        />
                        <span className="truncate max-w-[170px]" title={ch.name}>
                          {ch.name}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-300">{formatVND(ch.placedRevenue)}</td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-400">{formatVND(ch.paidRevenue)}</td>
                      <td className="py-3 px-3 text-right">
                        <span
                          className={`font-bold ${
                            ch.retentionRate >= 80
                              ? 'text-emerald-400'
                              : ch.retentionRate >= 65
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {ch.retentionRate}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-200">{formatVND(ch.aov)}</td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            ch.leakageStatus === 'safe'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                              : ch.leakageStatus === 'warning'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                              : 'bg-rose-500/20 text-rose-300 border-rose-400/30'
                          }`}
                        >
                          {ch.status || (ch.leakageStatus === 'safe' ? 'AN TOÀN' : 'RÒ RỈ CAO')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 8. QUẢNG CÁO SHOPEE ADS — “Có nên tăng / giảm ngân sách Ads?”             */}
      {/* ========================================================================= */}
      {shouldShow('8_ads') && (
        <section className="glass-panel rounded-3xl p-6 shadow-xl space-y-6 border border-white/[0.08]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/[0.08] gap-3">
            <div>
              <div className="flex items-center space-x-2.5">
                <span className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-black text-sm border border-rose-400/30">
                  08
                </span>
                <h3 className="text-lg font-black text-white">
                  Shopee Ads Engine — <span className="text-rose-400 font-semibold italic">“Có nên tăng hay giảm ngân sách Ads?”</span>
                </h3>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                AI phân tích ROAS thực tế so với Điểm hòa vốn (Break-even ROAS) và phát hiện lãng phí ngân sách ở từng loại chiến dịch.
              </p>
            </div>

            {data.adSummary.wastedBudget > 0 && (
              <span className="text-xs font-bold bg-rose-500/20 text-rose-300 px-3 py-1 rounded-full border border-rose-400/30">
                ⚠️ Ngân sách lãng phí: {formatVND(data.adSummary.wastedBudget)}
              </span>
            )}
          </div>

          {/* Ad Summary Numbers */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="glass-panel-subtle p-3.5 rounded-2xl">
              <span className="text-[10px] text-slate-400 font-medium">Tổng Chi Phí Ads</span>
              <div className="text-base font-black text-rose-400 mt-0.5">{formatVND(data.adSummary.totalSpend)}</div>
              <span className="text-[10px] text-slate-400">Ad Spend</span>
            </div>
            <div className="glass-panel-subtle p-3.5 rounded-2xl">
              <span className="text-[10px] text-slate-400 font-medium">Doanh Thu Từ Ads</span>
              <div className="text-base font-black text-emerald-400 mt-0.5">{formatVND(data.adSummary.totalAdRevenue)}</div>
              <span className="text-[10px] text-slate-400">Paid Revenue</span>
            </div>
            <div className="glass-panel-subtle p-3.5 rounded-2xl">
              <span className="text-[10px] text-slate-400 font-medium">ROAS Toàn Shop</span>
              <div className="text-base font-black text-amber-300 mt-0.5">{data.adSummary.overallRoas}x</div>
              <span className="text-[10px] text-slate-400">Doanh thu / Chi phí</span>
            </div>
            <div className="glass-panel-subtle p-3.5 rounded-2xl">
              <span className="text-[10px] text-slate-400 font-medium">Quyết Định Ngân Sách</span>
              <div className="text-base font-black text-sky-400 mt-0.5">Tối Ưu & Tái Phân Bổ</div>
              <span className="text-[10px] text-slate-400">Cắt Discovery, tăng Search</span>
            </div>
          </div>

          {/* Ad Campaigns Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.ads.map((ad, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-2xl border transition-all ${
                  ad.isBudgetWaste
                    ? 'bg-rose-950/20 border-rose-500/40 shadow-md shadow-rose-500/10'
                    : 'glass-panel-subtle border-emerald-500/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white truncate">{ad.name}</span>
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                      ad.isBudgetWaste
                        ? 'bg-rose-500/20 text-rose-300 border-rose-400/30'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                    }`}
                  >
                    ROAS {ad.roas}x ({ad.isBudgetWaste ? 'LỖ VỐN 🛑' : 'CÓ LÃI ✅'})
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 mt-3 pt-2 border-t border-white/[0.08]">
                  <div>Chi phí: <strong className="text-white">{formatVND(ad.spend)}</strong></div>
                  <div>Doanh thu: <strong className="text-emerald-400">{formatVND(ad.paidRevenue)}</strong></div>
                  <div>Hòa vốn: <strong className="text-amber-300">{ad.breakEvenRoas}x</strong></div>
                  <div>CTR: <strong className="text-sky-300">{ad.ctr}%</strong></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 9. KHÁCH HÀNG — “Bán một lần hay tạo khách hàng?”                          */}
      {/* ========================================================================= */}
      {shouldShow('9_customer') && (
        <section className="glass-panel rounded-3xl p-6 shadow-xl space-y-6 border border-white/[0.08]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/[0.08] gap-3">
            <div>
              <div className="flex items-center space-x-2.5">
                <span className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-black text-sm border border-blue-400/30">
                  09
                </span>
                <h3 className="text-lg font-black text-white">
                  Chân Dung Khách Hàng — <span className="text-blue-400 font-semibold italic">“Bán một lần hay tạo khách hàng trung thành?”</span>
                </h3>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Phân tích cơ cấu 3 nhóm đối tượng: Khách Hàng Mới, Khách Hàng Cũ/Trung Thành và Khách Hàng Tiềm Năng (Đã thêm giỏ hàng nhưng chưa thanh toán).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-white/10 text-xs text-slate-300 flex items-center gap-1.5 shadow-inner">
                <Users className="w-3.5 h-3.5 text-blue-400" />
                Tổng tệp quan tâm & mua: <strong className="text-white font-bold">{formatNumber(totalAudienceCount)}</strong> người
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Biểu đồ tròn phân bổ 3 nhóm khách hàng */}
            <div className="lg:col-span-5 glass-panel-subtle p-5 rounded-2xl border border-white/[0.08] flex flex-col items-center justify-center relative">
              <div className="w-full flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Cơ Cấu Tệp Khách Hàng</span>
                </div>
                <span className="text-[11px] font-semibold text-slate-400">3 Phân Khúc</span>
              </div>

              <div className="w-full h-56 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={customerPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={86}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {customerPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(15, 23, 42, 0.6)" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          return (
                            <div className="glass-panel-subtle p-3 rounded-xl border border-white/10 shadow-2xl bg-slate-950/95 text-xs space-y-1.5 min-w-[210px]">
                              <div className="flex items-center gap-2 font-bold text-white">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                <span>{item.fullName}</span>
                              </div>
                              <div className="flex justify-between text-slate-300">
                                <span>Số lượng:</span>
                                <strong className="text-white">{formatNumber(item.value)} người ({formatPercent(item.share)})</strong>
                              </div>
                              <div className="flex justify-between text-slate-300">
                                <span>{item.name === 'Khách Tiềm Năng' ? 'GMV Tiềm năng:' : 'Doanh thu:'}</span>
                                <strong className="text-emerald-400">{formatVND(item.revenue)}</strong>
                              </div>
                              <div className="flex justify-between text-slate-300">
                                <span>AOV dự kiến:</span>
                                <strong className="text-sky-300">{formatVND(item.aov)}</strong>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Center metric inside Donut */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Tổng Tệp</span>
                  <span className="text-xl font-black text-white tracking-tight">{formatCompactNumber(totalAudienceCount)}</span>
                  <span className="text-[10px] text-slate-400">người</span>
                </div>
              </div>

              {/* Legend with percentages */}
              <div className="w-full grid grid-cols-3 gap-2 pt-3 border-t border-white/[0.08] text-center">
                <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20">
                  <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-sky-400">
                    <span className="w-2 h-2 rounded-full bg-sky-400" />
                    Mới
                  </div>
                  <div className="text-xs font-black text-white mt-0.5">{formatPercent(newBuyersShare)}</div>
                  <div className="text-[10px] text-slate-400">{formatCompactNumber(newBuyersCount)}</div>
                </div>

                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    Trung Thành
                  </div>
                  <div className="text-xs font-black text-emerald-300 mt-0.5">{formatPercent(returningBuyersShare)}</div>
                  <div className="text-[10px] text-slate-400">{formatCompactNumber(returningBuyersCount)}</div>
                </div>

                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-amber-400">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    Tiềm Năng
                  </div>
                  <div className="text-xs font-black text-amber-300 mt-0.5">{formatPercent(potentialBuyersShare)}</div>
                  <div className="text-[10px] text-slate-400">{formatCompactNumber(potentialBuyersCount)}</div>
                </div>
              </div>
            </div>

            {/* 3 Thẻ chi tiết 3 Tệp Khách Hàng */}
            <div className="lg:col-span-7 space-y-3.5">
              {/* 1. Khách Hàng Mới */}
              <div className="glass-panel-subtle p-4 rounded-2xl border-l-4 border-l-sky-400 space-y-2 relative overflow-hidden group hover:border-sky-400/50 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-black text-white uppercase tracking-wide">
                      Khách Hàng Mới <span className="text-sky-400 font-semibold lowercase">(new buyers)</span>
                    </span>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30">
                    {formatPercent(newBuyersShare)} tệp
                  </span>
                </div>

                <div className="flex items-baseline justify-between pt-1">
                  <div className="text-lg font-black text-white">{formatNumber(newBuyersCount)} <span className="text-xs font-normal text-slate-400">người</span></div>
                  <div className="text-xs text-slate-300">
                    Doanh thu: <strong className="text-white font-bold">{formatVND(newBuyerRev)}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 pt-2 border-t border-white/[0.06]">
                  <div>AOV Đơn Hàng: <strong className="text-sky-300">{formatVND(retention.newBuyerAov || aov || 320000)}</strong></div>
                  <div>Trọng tâm: <strong className="text-slate-200">Onboarding & Kích thích mua lần 2</strong></div>
                </div>
              </div>

              {/* 2. Khách Trung Thành */}
              <div className="glass-panel-subtle p-4 rounded-2xl border-l-4 border-l-emerald-400 space-y-2 relative overflow-hidden group hover:border-emerald-400/50 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Award className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-black text-white uppercase tracking-wide">
                      Khách Hàng Cũ / Trung Thành <span className="text-emerald-400 font-semibold lowercase">(returning)</span>
                    </span>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    AOV x1.5 Lần 🚀
                  </span>
                </div>

                <div className="flex items-baseline justify-between pt-1">
                  <div className="text-lg font-black text-emerald-400">{formatNumber(returningBuyersCount)} <span className="text-xs font-normal text-slate-400">người</span></div>
                  <div className="text-xs text-slate-300">
                    Doanh thu: <strong className="text-white font-bold">{formatVND(returningBuyerRev)}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 pt-2 border-t border-white/[0.06]">
                  <div>AOV Đơn Hàng: <strong className="text-emerald-300">{formatVND(retention.returningBuyerAov || (aov * 1.5) || 480000)}</strong></div>
                  <div>Tỷ Lệ Mua Lại: <strong className="text-emerald-300">{retention.repeatPurchaseRate || 18.5}% (CAC = 0₫)</strong></div>
                </div>
              </div>

              {/* 3. Khách Hàng Tiềm Năng */}
              <div className="glass-panel-subtle p-4 rounded-2xl border-l-4 border-l-amber-400 space-y-2 relative overflow-hidden group hover:border-amber-400/50 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                      <Target className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-black text-white uppercase tracking-wide">
                      Khách Hàng Tiềm Năng <span className="text-amber-400 font-semibold lowercase">(leads / giỏ hàng)</span>
                    </span>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                    Cơ Hội Cứu Đơn 🔥
                  </span>
                </div>

                <div className="flex items-baseline justify-between pt-1">
                  <div className="text-lg font-black text-amber-400">{formatNumber(potentialBuyersCount)} <span className="text-xs font-normal text-slate-400">người</span></div>
                  <div className="text-xs text-slate-300">
                    GMV Tiềm năng: <strong className="text-amber-300 font-bold">{formatVND(potentialRev)}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 pt-2 border-t border-white/[0.06]">
                  <div>Hành vi: <strong className="text-slate-200">Đã xem SP & Thêm giỏ hàng (Chưa thanh toán)</strong></div>
                  <div>Tỷ lệ cứu đơn dự kiến: <strong className="text-amber-300">~15% - 20% (Chat Broadcast)</strong></div>
                </div>
              </div>
            </div>
          </div>

          {/* AI Retention & Lead Recovery Strategy Box */}
          <div className="glass-panel-subtle p-5 rounded-2xl border border-blue-500/30 bg-blue-950/10 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                Chiến Lược CRM Phân Tệp & Tăng Tỷ Lệ Mua Lại (Repeat Rate: {retention.repeatPurchaseRate || 18.5}%)
              </span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                AOV Khách Cũ Gấp 1.5x
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1">
                <div className="font-bold text-amber-400 flex items-center gap-1">
                  <Target className="w-3.5 h-3.5" />
                  1. Cứu Giỏ Hàng Bỏ Quên
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Thiết lập Chat Broadcast tự động gửi Voucher 4h giảm 10k - 15k cho tệp <strong>{formatNumber(potentialBuyersCount)}</strong> khách tiềm năng vừa bỏ giỏ hàng.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs space-y-1">
                <div className="font-bold text-sky-400 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  2. Chuyển Đổi Khách Mới
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Gửi tin nhắn cảm ơn + hướng dẫn bảo quản/sử dụng sau 3 ngày; bắn Voucher 10% sau 21 ngày đúng chu kỳ hết hàng.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1">
                <div className="font-bold text-emerald-400 flex items-center gap-1">
                  <Award className="w-3.5 h-3.5" />
                  3. Tối Đa Hóa LTV Khách Cũ
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Mở bán sớm (Early Bird) cho khách VIP, bổ sung combo size tiết kiệm giúp tăng AOV từ {formatCompactVND(retention.newBuyerAov || 320000)} lên {formatCompactVND(retention.returningBuyerAov || 480000)}.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 10. LEAKAGE — “Module Phân Tích Thất Thoát Dòng Tiền Độc Lập”             */}
      {/* ========================================================================= */}
      {shouldShow('10_leakage') && (
        <section className="glass-panel rounded-3xl p-6 shadow-2xl space-y-6 border-2 border-rose-500/40 bg-gradient-to-br from-slate-950 via-rose-950/20 to-slate-900">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/[0.08] gap-3">
            <div>
              <div className="flex items-center space-x-2.5">
                <span className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-black text-sm border border-rose-400/30">
                  10
                </span>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  Module Phân Tích Thất Thoát Dòng Tiền Độc Lập
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-400/30">
                    Cốt Lõi EcomPulse
                  </span>
                </h3>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Bóc tách chi tiết từng đồng thất thoát: Placed ({formatCompactVND(placedRevenue)}) ➔ Confirmed ({formatCompactVND(confirmedRevenue)}) ➔ Paid ({formatCompactVND(paidRevenue)}).
              </p>
            </div>

            <div className="px-4 py-2 rounded-2xl bg-rose-500/20 border border-rose-400/30 text-rose-300 text-xs font-bold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Tổng rò rỉ: {formatVND(totalLeakage)}</span>
            </div>
          </div>

          {/* Leakage Funnel Stage Drop-Off */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="glass-panel-subtle p-4 rounded-2xl border border-blue-500/30 space-y-1.5">
              <div className="text-xs text-blue-400 font-bold uppercase">1. Đơn Đặt (Placed)</div>
              <div className="text-lg font-black text-white">{formatVND(placedRevenue)}</div>
              <div className="text-xs text-slate-300">{formatNumber(placedOrders)} đơn hàng (100%)</div>
            </div>

            <div className="glass-panel-subtle p-4 rounded-2xl border border-amber-500/30 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-amber-400 font-bold uppercase">2. Đơn Xác Nhận (Confirmed)</span>
                <span className="text-[10px] text-rose-300 font-bold">Rớt {formatVND(cancelDropoffRevenue)}</span>
              </div>
              <div className="text-lg font-black text-amber-300">{formatVND(confirmedRevenue)}</div>
              <div className="text-xs text-slate-300">
                {formatNumber(confirmedOrders)} đơn (Hủy trước duyệt {((cancelDropoffRevenue / (placedRevenue || 1)) * 100).toFixed(1)}%)
              </div>
            </div>

            <div className="glass-panel-subtle p-4 rounded-2xl border border-emerald-500/30 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-emerald-400 font-bold uppercase">3. Thanh Toán Thực (Paid)</span>
                <span className="text-[10px] text-rose-300 font-bold">Rớt {formatVND(refundReturnRevenue)}</span>
              </div>
              <div className="text-lg font-black text-emerald-400">{formatVND(paidRevenue)}</div>
              <div className="text-xs text-slate-300">
                {formatNumber(paidOrders)} đơn (Boom COD & Hoàn {((refundReturnRevenue / (confirmedRevenue || 1)) * 100).toFixed(1)}%)
              </div>
            </div>
          </div>

          {/* Drill-down Sub-Tabs */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center space-x-2 border-b border-white/[0.08] pb-2 overflow-x-auto">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider shrink-0 mr-2">
                🔍 Drill-down rò rỉ theo:
              </span>
              <button
                onClick={() => setLeakageDrillTab('sku')}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                  leakageDrillTab === 'sku'
                    ? 'bg-rose-500/30 text-rose-200 border border-rose-400/40'
                    : 'bg-white/[0.05] text-slate-300 hover:text-white'
                }`}
              >
                Theo Sản Phẩm (SKU)
              </button>
              <button
                onClick={() => setLeakageDrillTab('channel')}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                  leakageDrillTab === 'channel'
                    ? 'bg-rose-500/30 text-rose-200 border border-rose-400/40'
                    : 'bg-white/[0.05] text-slate-300 hover:text-white'
                }`}
              >
                Theo Kênh Bán Hàng
              </button>
              <button
                onClick={() => setLeakageDrillTab('live')}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                  leakageDrillTab === 'live'
                    ? 'bg-rose-500/30 text-rose-200 border border-rose-400/40'
                    : 'bg-white/[0.05] text-slate-300 hover:text-white'
                }`}
              >
                Theo Phiên Live
              </button>
              <button
                onClick={() => setLeakageDrillTab('affiliate')}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                  leakageDrillTab === 'affiliate'
                    ? 'bg-rose-500/30 text-rose-200 border border-rose-400/40'
                    : 'bg-white/[0.05] text-slate-300 hover:text-white'
                }`}
              >
                Theo Affiliate / KOC
              </button>
            </div>

            {/* Drilldown Content */}
            {leakageDrillTab === 'sku' && (
              <div className="space-y-2">
                <div className="text-xs text-slate-300">Top sản phẩm có tỷ lệ thất thoát đơn cao nhất:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {classifiedProducts.slice(0, 6).map((p, i) => (
                    <div key={i} className="glass-panel-subtle p-3 rounded-xl border border-white/[0.06] text-xs">
                      <div className="font-bold text-white truncate">{p.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{p.sku}</div>
                      <div className="flex justify-between mt-2 pt-1 border-t border-white/[0.06] text-[11px]">
                        <span className="text-slate-300">Đã bán: {p.orders} đơn</span>
                        <span className="text-rose-400 font-bold">
                          Thất thoát ước tính: {formatCompactVND(p.revenue * 0.18)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {leakageDrillTab === 'channel' && (
              <div className="space-y-2">
                <div className="text-xs text-slate-300">Mức độ rò rỉ theo từng nguồn lưu lượng:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {data.channels.map((ch, i) => (
                    <div key={i} className="glass-panel-subtle p-3.5 rounded-xl border border-white/[0.06] text-xs space-y-1">
                      <div className="font-bold text-white flex justify-between">
                        <span>{ch.channelName}</span>
                        <span className="text-rose-400 font-bold">{formatVND(ch.leakageAmount)}</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Đặt: {formatVND(ch.placedRevenue)} ➔ Paid: {formatVND(ch.paidRevenue)}
                      </div>
                      <div className="text-[10px] text-amber-300">
                        Rò rỉ {(((ch.leakageAmount) / (ch.placedRevenue || 1)) * 100).toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {leakageDrillTab === 'live' && (
              <div className="space-y-2">
                <div className="text-xs text-slate-300">Đơn hàng bị boom / hủy sau phiên Live Stream:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {liveSessions.map((s, i) => (
                    <div key={i} className="glass-panel-subtle p-3 rounded-xl border border-white/[0.06] text-xs space-y-1">
                      <div className="font-bold text-white truncate">{s.title}</div>
                      <div className="flex justify-between text-[11px] text-slate-300">
                        <span>Doanh thu: {formatVND(s.revenue)}</span>
                        <span className="text-rose-300 font-medium">Hủy COD ước tính: ~12%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {leakageDrillTab === 'affiliate' && (
              <div className="space-y-2">
                <div className="text-xs text-slate-300">Thất thoát đơn hàng từ kênh Affiliate:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {categorizedAffiliates.slice(0, 4).map((aff, i) => (
                    <div key={i} className="glass-panel-subtle p-3 rounded-xl border border-white/[0.06] text-xs space-y-1">
                      <div className="font-bold text-white flex justify-between">
                        <span>@{aff.username}</span>
                        <span className="text-emerald-400">{formatVND(aff.revenue)}</span>
                      </div>
                      <div className="text-[11px] text-slate-300">
                        {aff.orders} đơn • Đơn ảo/hủy COD thấp ({((1 - aff.conversionRate / 5) * 10).toFixed(1)}%)
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

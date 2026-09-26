import React, { useState } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
import {
  AlertOctagon,
  PieChart as PieIcon,
  TrendingDown,
  Info,
  Layers,
  ArrowRight,
  Flame,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';
import { ParsedStoreData, ChannelMetric } from '../../types';
import { formatVND, formatCompactVND, formatNumber } from '../../utils/formatters';

interface RevenueLeakagePieCardProps {
  data: ParsedStoreData;
  onNavigateToAiTab?: () => void;
  language?: 'vi' | 'en';
}

const CHANNEL_COLORS = [
  '#f43f5e', // Rose 500 - Tìm kiếm (Leakage chính)
  '#38bdf8', // Sky 400 - Đề xuất
  '#a855f7', // Purple 500 - Affiliate
  '#94a3b8', // Slate 400 - Khác
  '#34d399', // Emerald 400 - Cửa hàng
  '#fbbf24', // Amber 400 - Video
  '#ec4899', // Pink 500 - Live
];

const STAGE_COLORS = [
  '#f43f5e', // Rose 500 - Huỷ trước xác nhận (Chờ xác nhận lâu / Khách đổi ý)
  '#f97316', // Orange 500 - Huỷ sau xác nhận / Trả hàng hoàn tiền (COD fail / Vận chuyển)
];

export const RevenueLeakagePieCard: React.FC<RevenueLeakagePieCardProps> = ({
  data,
  onNavigateToAiTab,
  language = 'vi',
}) => {
  const [viewMode, setViewMode] = useState<'channel' | 'stage'>('channel');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Key KPI values
  const placedRev = data.kpis?.placedRevenue || 0;
  const confirmedRev = data.kpis?.confirmedRevenue || 0;
  const paidRev = data.kpis?.paidRevenue || 0;
  const totalOverviewLeakage = Math.max(0, placedRev - paidRev);

  // 1. Channel Leakage Data calculation: Canonical 7 Shopee Channels
  const canonical7Buckets: Record<
    'search' | 'recommendation' | 'affiliate' | 'other' | 'shop' | 'video' | 'live',
    {
      id: string;
      name: string;
      shortName: string;
      color: string;
      placedRevenue: number;
      paidRevenue: number;
      leakageAmount: number;
      retentionRate: number;
    }
  > = {
    search: {
      id: 'search',
      name: 'Tìm kiếm (trong Thẻ SP)',
      shortName: 'Tìm kiếm',
      color: '#f43f5e', // Rose 500
      placedRevenue: 0,
      paidRevenue: 0,
      leakageAmount: 0,
      retentionRate: 0,
    },
    recommendation: {
      id: 'recommendation',
      name: 'Đề xuất (trong Thẻ SP)',
      shortName: 'Đề xuất',
      color: '#38bdf8', // Sky 400
      placedRevenue: 0,
      paidRevenue: 0,
      leakageAmount: 0,
      retentionRate: 0,
    },
    affiliate: {
      id: 'affiliate',
      name: 'Tiếp thị liên kết',
      shortName: 'Tiếp thị liên kết',
      color: '#a855f7', // Purple 500
      placedRevenue: 0,
      paidRevenue: 0,
      leakageAmount: 0,
      retentionRate: 0,
    },
    other: {
      id: 'other',
      name: 'Khác (Thẻ SP)',
      shortName: 'Khác',
      color: '#94a3b8', // Slate 400
      placedRevenue: 0,
      paidRevenue: 0,
      leakageAmount: 0,
      retentionRate: 0,
    },
    shop: {
      id: 'shop',
      name: 'Cửa hàng (trong Thẻ SP)',
      shortName: 'Cửa hàng',
      color: '#34d399', // Emerald 400
      placedRevenue: 0,
      paidRevenue: 0,
      leakageAmount: 0,
      retentionRate: 0,
    },
    video: {
      id: 'video',
      name: 'Video',
      shortName: 'Video',
      color: '#fbbf24', // Amber 400
      placedRevenue: 0,
      paidRevenue: 0,
      leakageAmount: 0,
      retentionRate: 0,
    },
    live: {
      id: 'live',
      name: 'Live',
      shortName: 'Live',
      color: '#ec4899', // Pink 500
      placedRevenue: 0,
      paidRevenue: 0,
      leakageAmount: 0,
      retentionRate: 0,
    },
  };

  // If dynamic data.channels has valid non-empty rows, aggregate into the 7 canonical channels
  const hasDynamicChannels =
    data.channels &&
    data.channels.length > 0 &&
    data.channels.some((c) => c.placedRevenue > 0 && !c.channelName.startsWith('Kênh '));

  if (hasDynamicChannels && data.channels) {
    // Reset buckets to 0
    Object.keys(canonical7Buckets).forEach((k) => {
      const key = k as keyof typeof canonical7Buckets;
      canonical7Buckets[key].placedRevenue = 0;
      canonical7Buckets[key].paidRevenue = 0;
      canonical7Buckets[key].leakageAmount = 0;
    });

    data.channels.forEach((ch) => {
      const name = String(ch.channelName || '').trim();
      const lower = name.toLowerCase();

      // Skip invalid or date strings
      if (
        !name ||
        /^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}/.test(name) ||
        /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(name) ||
        /^\d{4}-\d{2}-\d{2}/.test(name) ||
        lower === 'nguồn lưu lượng' ||
        lower === 'tổng' ||
        lower === 'tổng cộng' ||
        lower === 'ngày' ||
        lower === 'date'
      ) {
        return;
      }

      const pRev = ch.placedRevenue || 0;
      const pdRev = ch.paidRevenue || 0;
      const leak = ch.leakageAmount ?? Math.max(0, pRev - pdRev);

      if (
        lower.includes('tìm kiếm') ||
        lower.includes('search') ||
        lower.includes('quảng cáo gmv') ||
        lower.includes('quảng cáo tìm kiếm') ||
        lower.includes('quảng cáo shopee') ||
        lower.includes('quảng cáo')
      ) {
        canonical7Buckets.search.placedRevenue += pRev;
        canonical7Buckets.search.paidRevenue += pdRev;
        canonical7Buckets.search.leakageAmount += leak;
      } else if (
        lower.includes('đề xuất') ||
        lower.includes('gợi ý') ||
        lower.includes('recommendation')
      ) {
        canonical7Buckets.recommendation.placedRevenue += pRev;
        canonical7Buckets.recommendation.paidRevenue += pdRev;
        canonical7Buckets.recommendation.leakageAmount += leak;
      } else if (
        lower.includes('tiếp thị') ||
        lower.includes('affiliate') ||
        lower.includes('koc')
      ) {
        canonical7Buckets.affiliate.placedRevenue += pRev;
        canonical7Buckets.affiliate.paidRevenue += pdRev;
        canonical7Buckets.affiliate.leakageAmount += leak;
      } else if (
        lower.includes('cửa hàng') ||
        lower.includes('shop') ||
        lower.includes('trang chủ')
      ) {
        canonical7Buckets.shop.placedRevenue += pRev;
        canonical7Buckets.shop.paidRevenue += pdRev;
        canonical7Buckets.shop.leakageAmount += leak;
      } else if (lower.includes('video') || lower.includes('clip')) {
        canonical7Buckets.video.placedRevenue += pRev;
        canonical7Buckets.video.paidRevenue += pdRev;
        canonical7Buckets.video.leakageAmount += leak;
      } else if (
        lower.includes('live') ||
        lower.includes('session') ||
        lower.includes('phiên')
      ) {
        canonical7Buckets.live.placedRevenue += pRev;
        canonical7Buckets.live.paidRevenue += pdRev;
        canonical7Buckets.live.leakageAmount += leak;
      } else {
        canonical7Buckets.other.placedRevenue += pRev;
        canonical7Buckets.other.paidRevenue += pdRev;
        canonical7Buckets.other.leakageAmount += leak;
      }
    });

    // Check if live or video has 0 in channels but exists in dedicated metrics
    if (canonical7Buckets.live.placedRevenue === 0 && data.liveSessions && data.liveSessions.length > 0) {
      const liveRev = data.liveSessions.reduce((sum, s) => sum + (s.revenue || 0), 0);
      canonical7Buckets.live.placedRevenue = liveRev;
      canonical7Buckets.live.paidRevenue = liveRev;
      canonical7Buckets.live.leakageAmount = 0;
    }
    if (canonical7Buckets.video.placedRevenue === 0 && (data as any).videoContributions && (data as any).videoContributions.length > 0) {
      const vidRev = (data as any).videoContributions.reduce((sum: number, v: any) => sum + (v.revenue || 0), 0);
      canonical7Buckets.video.placedRevenue = vidRev;
      canonical7Buckets.video.paidRevenue = vidRev;
      canonical7Buckets.video.leakageAmount = 0;
    }

    // Recompute leakage and retention rates
    Object.keys(canonical7Buckets).forEach((k) => {
      const key = k as keyof typeof canonical7Buckets;
      const b = canonical7Buckets[key];
      b.leakageAmount = Math.max(0, b.placedRevenue - b.paidRevenue);
      b.retentionRate = b.placedRevenue > 0 ? Math.round((b.paidRevenue / b.placedRevenue) * 100) : 0;
    });
  }

  const raw7ChannelsList = Object.values(canonical7Buckets);
  // Show channels with activity or all if none
  const activeChannels = raw7ChannelsList.filter((c) => c.placedRevenue > 0 || c.leakageAmount > 0);
  const channelsToDisplay = activeChannels.length > 0 ? activeChannels : raw7ChannelsList;

  // Calculate TOTAL leakage of all channels in the pie chart
  const totalCalculatedChannelLeak = channelsToDisplay.reduce((sum, item) => sum + item.leakageAmount, 0);

  const channelPieData = channelsToDisplay
    .map((item) => {
      const pct = totalCalculatedChannelLeak > 0
        ? parseFloat(((item.leakageAmount / totalCalculatedChannelLeak) * 100).toFixed(1))
        : 0;
      return {
        ...item,
        value: item.leakageAmount,
        percentage: pct,
      };
    })
    .sort((a, b) => b.value - a.value);

  // 2. Stage Leakage Data calculation
  const stage1Leak = Math.max(0, placedRev - confirmedRev);
  const stage2Leak = Math.max(0, confirmedRev - paidRev);
  const totalStageLeak = stage1Leak + stage2Leak || totalOverviewLeakage;

  const stagePieData = [
    {
      name: 'Hủy Trước Xác Nhận (Giai đoạn 1)',
      shortName: 'Trước xác nhận',
      description: 'Khách hủy khi đang chờ xác nhận đơn, hủy áp mã, đổi ý',
      value: stage1Leak,
      percentage: totalStageLeak > 0 ? parseFloat(((stage1Leak / totalStageLeak) * 100).toFixed(1)) : 0,
      color: STAGE_COLORS[0],
      icon: '⏱️',
      retentionRate: placedRev > 0 ? Math.round((confirmedRev / placedRev) * 100) : 0,
    },
    {
      name: 'Hủy Sau Xác Nhận & Hoàn Hàng (Giai đoạn 2)',
      shortName: 'Sau xác nhận & Hoàn',
      description: 'Hủy khi đóng gói, giao không thành công (COD), trả hàng/hoàn tiền',
      value: stage2Leak,
      percentage: totalStageLeak > 0 ? parseFloat(((stage2Leak / totalStageLeak) * 100).toFixed(1)) : 0,
      color: STAGE_COLORS[1],
      icon: '🚚',
      retentionRate: confirmedRev > 0 ? Math.round((paidRev / confirmedRev) * 100) : 0,
    },
  ];

  const currentPieData = viewMode === 'channel' ? channelPieData : stagePieData;
  const currentTotalLeak = viewMode === 'channel'
    ? (totalCalculatedChannelLeak > 0 ? totalCalculatedChannelLeak : totalOverviewLeakage)
    : (totalStageLeak > 0 ? totalStageLeak : totalOverviewLeakage);

  // Calculate percentage of total placed revenue that was lost
  const activePlacedRev = viewMode === 'channel'
    ? (channelsToDisplay.reduce((sum, item) => sum + item.placedRevenue, 0) || placedRev)
    : placedRev;

  const currentLeakagePercent = activePlacedRev > 0
    ? ((currentTotalLeak / activePlacedRev) * 100).toFixed(1)
    : (placedRev > 0 ? ((totalOverviewLeakage / placedRev) * 100).toFixed(1) : '0.0');

  const topLeakingItem = currentPieData[0] || {
    name: 'Không có rò rỉ',
    percentage: 0,
    value: 0,
    retentionRate: 100,
  };

  return (
    <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-white/[0.12] shadow-2xl backdrop-blur-xl w-full">
      {/* Top Header & Toggle Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/[0.1] gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <PieIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Biểu Đồ Cơ Cấu Thất Thoát Doanh Thu (Revenue Leakage Breakdown)
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-400/30">
                  Thất thoát: {formatCompactVND(currentTotalLeak)} ({currentLeakagePercent}%)
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Bóc tách chi tiết {formatVND(currentTotalLeak)} doanh số thất thoát theo từng kênh lưu lượng và phễu vận hành
              </p>
            </div>
          </div>
        </div>

        {/* View Mode Toggle Switch */}
        <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/[0.12] self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('channel')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              viewMode === 'channel'
                ? 'bg-rose-500/80 text-white shadow-md shadow-rose-500/30 border border-rose-400/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Theo Kênh Lưu Lượng ({channelPieData.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('stage')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              viewMode === 'stage'
                ? 'bg-rose-500/80 text-white shadow-md shadow-rose-500/30 border border-rose-400/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5" />
            <span>Theo Giai Đoạn Hủy Đơn</span>
          </button>
        </div>
      </div>

      {/* Main Content Grid: Left Donut Chart & Right Breakdown List & Quick AI Insight */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center mt-4">
        
        {/* Left Column: Donut Pie Chart with Center Summary (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center relative min-h-[280px]">
          <div className="w-full h-[270px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={currentPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={68}
                  outerRadius={105}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="rgba(15, 23, 42, 0.8)"
                  strokeWidth={2}
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  {currentPieData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      className="transition-all duration-300 cursor-pointer"
                      style={{
                        filter: activeIndex === index ? 'brightness(1.2) drop-shadow(0 0 8px rgba(244,63,94,0.6))' : 'none',
                        transform: activeIndex === index ? 'scale(1.03)' : 'scale(1)',
                        transformOrigin: 'center center',
                      }}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-900/95 border border-white/20 rounded-xl p-3 shadow-2xl backdrop-blur-xl text-xs z-50 max-w-[240px]">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                            <p className="font-bold text-white leading-tight">{d.name}</p>
                          </div>
                          <p className="text-rose-300 font-bold text-sm">
                            Thất thoát: {formatVND(d.value)}
                          </p>
                          <p className="text-slate-300 font-semibold mt-0.5">
                            Chiếm: <strong className="text-amber-300">{d.percentage}%</strong> tổng thất thoát
                          </p>
                          {d.description && (
                            <p className="text-[11px] text-slate-400 mt-1 italic leading-snug">
                              {d.description}
                            </p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Centered Donut Metric */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Tổng Thất Thoát
              </span>
              <span className="text-lg sm:text-xl font-black text-rose-400 tracking-tight">
                {formatCompactVND(currentTotalLeak)}
              </span>
              <span className="text-[11px] font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-400/20 mt-0.5">
                {currentLeakagePercent}% doanh số
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Rê chuột vào biểu đồ để xem chi tiết từng thành phần rò rỉ</span>
          </div>
        </div>

        {/* Right Column: Detailed Breakdown Cards & Strategic Diagnostic (7 Cols) */}
        <div className="lg:col-span-7 space-y-3">
          
          {/* Key Diagnostic Banner */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-rose-950/40 via-slate-900/40 to-slate-900/40 border border-rose-500/30 flex items-start gap-3 backdrop-blur-md">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center flex-shrink-0 text-rose-400 mt-0.5">
              <Flame className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  Điểm Nghẽn Rò Rỉ Trọng Yếu: <span className="text-rose-300">{topLeakingItem.name}</span>
                </h4>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-500 text-white shadow-sm">
                  {topLeakingItem.percentage}% Cơ Cấu
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {viewMode === 'channel' ? (
                  <>
                    Kênh <strong>{topLeakingItem.name}</strong> gây thất thoát lớn nhất với <strong>{formatVND(topLeakingItem.value)}</strong> ({topLeakingItem.percentage}% cơ cấu rò rỉ) do tỷ lệ giữ chân chỉ đạt <strong>{topLeakingItem.retentionRate ?? 0}%</strong>. Cần tối ưu thời gian xác nhận đơn và kịch bản CSKH gọi xác nhận đơn COD trong 15 phút đầu.
                  </>
                ) : (
                  <>
                    Giai đoạn <strong>{topLeakingItem.name}</strong> chiếm tới <strong>{topLeakingItem.percentage}%</strong> tổng thất thoát ({formatVND(topLeakingItem.value)}). Đa số đơn hàng rơi vào tình trạng khách đổi ý do shop chậm đóng gói hoặc thiếu thông báo hành trình đơn.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* List of Breakdown Items with Visual Progress Bars */}
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {currentPieData.map((item, idx) => (
              <div
                key={idx}
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseLeave={() => setActiveIndex(null)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                  activeIndex === idx
                    ? 'bg-white/[0.08] border-rose-400/50 shadow-lg'
                    : 'bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.05]'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-bold text-slate-100">{item.name}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="font-bold text-rose-300">{formatVND(item.value)}</span>
                    <span className="font-extrabold text-white bg-white/10 px-2 py-0.5 rounded-md text-[11px] min-w-[45px] text-right">
                      {item.percentage}%
                    </span>
                  </div>
                </div>

                {/* Progress bar representing share */}
                <div className="w-full bg-slate-950/60 rounded-full h-1.5 overflow-hidden border border-white/[0.05]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${item.percentage}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Quick Action Footer */}
          {onNavigateToAiTab && (
            <div className="pt-2 flex items-center justify-between border-t border-white/[0.08]">
              <span className="text-[11px] text-slate-400">
                Khắc phục ngay điểm rò rỉ này qua 10 hành động ưu tiên:
              </span>
              <button
                type="button"
                onClick={onNavigateToAiTab}
                className="text-xs font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1 group"
              >
                <span>Xem kế hoạch khắc phục</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

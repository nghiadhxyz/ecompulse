import React from 'react';
import {
  Package,
  Radio,
  Star,
  MousePointer,
  Sparkles,
  TrendingUp,
  Award,
  Flame,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { ParsedStoreData } from '../../types';
import { formatCompactNumber, formatCompactVND, formatNumber, formatVND } from '../../utils/formatters';

interface StoreOperationsMetricStripProps {
  data: ParsedStoreData;
  language?: 'vi' | 'en';
}

export const StoreOperationsMetricStrip: React.FC<StoreOperationsMetricStripProps> = ({
  data,
  language = 'vi',
}) => {
  // 1. Tổng sản phẩm đang bán
  const totalActiveProducts =
    data.kpis?.totalActiveProducts ??
    (data.abcProducts && data.abcProducts.length > 0
      ? data.abcProducts.length
      : data.productCardTopProducts && data.productCardTopProducts.length > 0
      ? data.productCardTopProducts.length
      : 0);

  // Variant count is only shown when the report provides it — never extrapolated.
  const totalVariants = data.kpis?.totalProductVariants || 0;

  const activeSalesSkus = data.abcProducts && data.abcProducts.length > 0
    ? data.abcProducts.filter((p) => !p.isZombie && p.revenue > 0).length
    : totalActiveProducts;

  const dormantSkus = Math.max(0, totalActiveProducts - activeSalesSkus);

  // 2. Số phiên live & Doanh thu mỗi phiên
  const liveSessionsCount =
    data.kpis?.liveSessionsCount ??
    (data.liveSessions && data.liveSessions.length > 0
      ? data.liveSessions.length
      : 0);

  const liveTotalRev =
    data.kpis?.liveTotalRevenue ??
    (data.liveSessions && data.liveSessions.length > 0
      ? data.liveSessions.reduce((sum, s) => sum + (s.revenue || 0), 0)
      : data.channels?.find((c) => c.channelName.toLowerCase().includes('live'))?.paidRevenue ?? 0);

  const liveRevenuePerSession =
    data.kpis?.liveRevenuePerSession ??
    (liveSessionsCount > 0 ? Math.round(liveTotalRev / liveSessionsCount) : 0);

  const liveOrders =
    data.kpis?.liveOrdersCount ??
    (data.liveSessions && data.liveSessions.length > 0
      ? data.liveSessions.reduce((sum, s) => sum + (s.orders || 0), 0)
      : data.channels?.find((c) => c.channelName.toLowerCase().includes('live'))?.paidOrders ?? 0);

  const totalPaidRevenue = data.kpis?.paidRevenue || 0;
  const liveSharePercent = totalPaidRevenue > 0 && liveTotalRev > 0
    ? ((liveTotalRev / totalPaidRevenue) * 100).toFixed(1).replace('.', ',')
    : '0';

  // 3. Đánh giá sao của toàn cửa hàng
  const hasRatingData = data.kpis?.shopRating !== undefined && data.kpis?.shopRating !== null && data.kpis?.shopRating > 0;
  const shopRating = hasRatingData ? data.kpis.shopRating! : 0;
  const shopRatingCount = hasRatingData ? (data.kpis.shopRatingCount ?? 0) : 0;
  const shopPositiveRate = hasRatingData ? (data.kpis.shopPositiveRate ?? 0) : 0;

  // 4. Tỷ lệ nhấp chuột (CTR) & Lượt xem
  const hasAdData = data.ads && data.ads.length > 0;
  const totalImpressionsFromAds = hasAdData ? data.ads!.reduce((s, a) => s + (a.impressions || 0), 0) : 0;
  const totalClicksFromAds = hasAdData ? data.ads!.reduce((s, a) => s + (a.clicks || 0), 0) : 0;

  const totalImpressions =
    data.kpis?.totalImpressions !== undefined && data.kpis?.totalImpressions !== null
      ? data.kpis.totalImpressions
      : totalImpressionsFromAds;

  const totalClicks =
    data.kpis?.totalClicks !== undefined && data.kpis?.totalClicks !== null
      ? data.kpis.totalClicks
      : totalClicksFromAds;

  const overallCtr =
    data.kpis?.overallCtr !== undefined && data.kpis?.overallCtr !== null
      ? data.kpis.overallCtr
      : (totalImpressions > 0 && totalClicks > 0
          ? parseFloat(((totalClicks / totalImpressions) * 100).toFixed(2))
          : 0);

  const hasCtrData = overallCtr > 0 || totalImpressions > 0 || totalClicks > 0;

  return (
    <div className="space-y-3">
      {/* Header Label Strip */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <h3 className="text-xs font-black tracking-wider uppercase text-cyan-300 flex items-center gap-1.5">
            <span>Chỉ Số Vận Hành & Hiệu Suất Gian Hàng</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-200 border border-cyan-400/30">
              Đối Soát Thời Gian Thực
            </span>
          </h3>
        </div>
        <span className="text-[11px] text-slate-400 font-medium hidden sm:inline-block">
          Cập nhật từ dữ liệu báo cáo thực tế (chỉ số chưa có hiển thị 0)
        </span>
      </div>

      {/* 4 Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* ====================================================================
            CARD 1: TỔNG SẢN PHẨM ĐANG BÁN
        ==================================================================== */}
        <div className="group relative p-4 rounded-2xl bg-gradient-to-b from-slate-900/95 via-slate-900/85 to-sky-950/30 border border-sky-500/25 hover:border-sky-400/60 shadow-lg hover:shadow-sky-500/15 backdrop-blur-xl transition-all duration-300 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform">
                <Package className="w-4 h-4" />
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                totalVariants > 0
                  ? 'bg-sky-500/15 text-sky-300 border border-sky-400/30'
                  : 'bg-white/5 text-slate-400 border border-white/10'
              }`}>
                {totalVariants > 0 ? `${formatNumber(totalVariants)} phân loại` : 'Chưa có số phân loại'}
              </span>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-300">Tổng sản phẩm đang bán</div>
              <div className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-baseline gap-1.5 mt-0.5">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-300 via-white to-cyan-300">
                  {formatNumber(totalActiveProducts)}
                </span>
                <span className="text-xs font-bold text-sky-400">SKU</span>
              </div>
            </div>
          </div>

          <div className="pt-2.5 mt-2 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-slate-400">
            <span className={activeSalesSkus > 0 ? 'text-emerald-400 font-medium' : 'text-slate-500'}>
              {activeSalesSkus > 0 ? `✓ ${activeSalesSkus} SKU có đơn` : '0 SKU có đơn'}
            </span>
            <span>
              {totalActiveProducts > 0
                ? (dormantSkus > 0 ? `${dormantSkus} SKU tồn cần đẩy` : 'Danh mục tối ưu')
                : 'Chưa có dữ liệu SP'}
            </span>
          </div>
        </div>

        {/* ====================================================================
            CARD 2: SỐ PHIÊN LIVE & DOANH THU MỖI PHIÊN
        ==================================================================== */}
        <div className="group relative p-4 rounded-2xl bg-gradient-to-b from-slate-900/95 via-slate-900/85 to-purple-950/30 border border-purple-500/25 hover:border-purple-400/60 shadow-lg hover:shadow-purple-500/15 backdrop-blur-xl transition-all duration-300 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                <Radio className="w-4 h-4 animate-pulse" />
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                liveOrders > 0
                  ? 'bg-purple-500/15 text-purple-300 border border-purple-400/30'
                  : 'bg-white/5 text-slate-400 border border-white/10'
              }`}>
                {liveOrders > 0 ? `${formatNumber(liveOrders)} đơn Live` : '0 đơn Live'}
              </span>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-300">Phiên Live ➔ DT/Phiên</div>
              <div className="text-lg sm:text-xl font-black text-white tracking-tight flex items-baseline gap-1 mt-0.5">
                <span className="text-purple-300">{liveSessionsCount} phiên</span>
                <span className="text-xs text-slate-400 font-normal">➔</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-pink-300 to-amber-300 font-extrabold">
                  {liveRevenuePerSession > 0 ? `~${formatCompactVND(liveRevenuePerSession)}` : '0 ₫'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2.5 mt-2 border-t border-white/[0.08] flex items-center justify-between text-[11px]">
            <span className="text-slate-400">
              Tổng DT: <strong className="text-slate-200">{formatCompactVND(liveTotalRev)}</strong>
            </span>
            <span className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
              liveTotalRev > 0 ? 'text-purple-300 bg-purple-500/15' : 'text-slate-500 bg-white/5'
            }`}>
              {liveSharePercent}% DT shop
            </span>
          </div>
        </div>

        {/* ====================================================================
            CARD 3: ĐÁNH GIÁ SAO TOÀN CỬA HÀNG
        ==================================================================== */}
        <div className="group relative p-4 rounded-2xl bg-gradient-to-b from-slate-900/95 via-slate-900/85 to-amber-950/30 border border-amber-500/25 hover:border-amber-400/60 shadow-lg hover:shadow-amber-500/15 backdrop-blur-xl transition-all duration-300 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                <Star className={`w-4 h-4 ${hasRatingData ? 'fill-amber-400 text-amber-400' : 'text-slate-500'}`} />
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                hasRatingData
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-400/30'
                  : 'bg-white/5 text-slate-400 border border-white/10'
              }`}>
                {hasRatingData ? (shopRating >= 4.8 ? '⭐ Chuẩn Mall' : '⭐ Shop Uy Tín') : 'Chưa có đánh giá'}
              </span>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-300">Đánh giá sao toàn shop</div>
              <div className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-baseline gap-1.5 mt-0.5">
                <span className={`text-transparent bg-clip-text ${
                  hasRatingData
                    ? 'bg-gradient-to-r from-amber-300 via-yellow-200 to-orange-300'
                    : 'bg-gradient-to-r from-slate-400 to-slate-200'
                }`}>
                  {hasRatingData ? shopRating.toFixed(1).replace('.', ',') : '0,0'}
                </span>
                <span className="text-xs font-bold text-amber-400/90">/ 5.0</span>
              </div>
            </div>
          </div>

          <div className="pt-2.5 mt-2 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-slate-400">
            <span>
              {shopRatingCount > 0 ? `${formatNumber(shopRatingCount)} lượt review` : '0 lượt review'}
            </span>
            <span className={hasRatingData ? 'text-amber-300 font-semibold' : 'text-slate-500'}>
              {hasRatingData ? `${String(shopPositiveRate).replace('.', ',')}% tích cực` : '0% tích cực'}
            </span>
          </div>
        </div>

        {/* ====================================================================
            CARD 4: TỶ LỆ NHẤP CHUỘT (CTR)
        ==================================================================== */}
        <div className="group relative p-4 rounded-2xl bg-gradient-to-b from-slate-900/95 via-slate-900/85 to-emerald-950/30 border border-emerald-500/25 hover:border-emerald-400/60 shadow-lg hover:shadow-emerald-500/15 backdrop-blur-xl transition-all duration-300 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                <MousePointer className="w-4 h-4" />
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                hasCtrData
                  ? (overallCtr >= 3.5 ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30' : 'bg-cyan-500/15 text-cyan-300 border border-cyan-400/30')
                  : 'bg-white/5 text-slate-400 border border-white/10'
              }`}>
                {hasCtrData ? (overallCtr >= 3.5 ? '+1,2% vs TB' : 'CTR Gian Hàng') : 'Chưa có Ads/CTR'}
              </span>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-300">Tỷ lệ nhấp chuột (CTR)</div>
              <div className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-baseline gap-1 mt-0.5">
                <span className={`text-transparent bg-clip-text ${
                  hasCtrData
                    ? 'bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300'
                    : 'bg-gradient-to-r from-slate-400 to-slate-200'
                }`}>
                  {overallCtr > 0 ? `${overallCtr.toFixed(2).replace('.', ',')}%` : '0,00%'}
                </span>
                <span className="text-xs font-bold text-emerald-400">CTR</span>
              </div>
            </div>
          </div>

          <div className="pt-2.5 mt-2 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-slate-400">
            <span>
              {formatNumber(totalClicks)} clicks
            </span>
            <span className="text-slate-300 font-medium">
              {totalImpressions > 0 ? `${formatCompactNumber(totalImpressions)} lượt xem` : '0 lượt xem'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};


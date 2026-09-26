import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  FileSpreadsheet,
  Printer,
  Download,
  Copy,
  Check,
  RefreshCw,
  Activity,
  TrendingUp,
  Compass,
  Target,
  Package,
  Users,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { ParsedStoreData } from '../../types';
import { formatVND, formatNumber, formatPercent } from '../../utils/formatters';

interface AiAssessment7PillarsProps {
  data: ParsedStoreData;
  language: 'vi' | 'en';
  onReEvaluate?: () => void;
  isEvaluating?: boolean;
}

export interface PillarData {
  id: number;
  title: string;
  shortTitle: string;
  icon: React.ElementType;
  badge: {
    text: string;
    type: 'warning' | 'critical' | 'success' | 'info';
  };
  score: number; // 0 - 100
  overview: string;
  metrics: {
    label: string;
    value: string;
    subtext?: string;
    highlight?: boolean;
    color?: string;
  }[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export const AiAssessment7Pillars: React.FC<AiAssessment7PillarsProps> = ({
  data,
  language,
  onReEvaluate,
  isEvaluating = false,
}) => {
  const [selectedPillarId, setSelectedPillarId] = useState<number | 'all'>('all');
  const [expandedPillars, setExpandedPillars] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
    6: true,
    7: true,
  });
  const [copiedAll, setCopiedAll] = useState<boolean>(false);

  // Toggle individual card expansion
  const toggleExpand = (id: number) => {
    setExpandedPillars((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Compute 7 Pillars Data Dynamically from parsed Excel store data
  const pillars: PillarData[] = useMemo(() => {
    const kpis = data.kpis;
    const funnel = data.funnel;
    const channels = data.channels || [];
    const daily = data.dailyTimeline || [];
    const ads = data.ads || [];
    const abc = data.abcSummary || {
      classACount: 0,
      classAShare: 0,
      classBCount: 0,
      classBShare: 0,
      classCCount: 0,
      classCShare: 0,
      zombieCount: 0,
    };
    const abcProducts = data.abcProducts || [];
    const retention = data.retention || {
      totalBuyers: 0,
      newBuyers: 0,
      returningBuyers: 0,
      newBuyerRevenue: 0,
      returningBuyerRevenue: 0,
      newBuyerAov: 0,
      returningBuyerAov: 0,
      repeatPurchaseRate: 0,
    };
    const campaign = data.campaignStats || {
      campaignRevenue: 0,
      normalRevenue: 0,
      campaignSharePercent: 0,
      campaignDaysCount: 0,
    };

    // Calculations for Pillar 1: Funnel
    const placedRev = kpis.placedRevenue || 0;
    const confirmedRev = kpis.confirmedRevenue || 0;
    const paidRev = kpis.paidRevenue || 0;
    const leakageVND = funnel.totalLeakageVND || Math.max(0, placedRev - paidRev);
    const leakagePercent = placedRev > 0 ? ((leakageVND / placedRev) * 100).toFixed(1) : '0';
    const completionRate = kpis.placedOrders > 0
      ? ((kpis.paidOrders / kpis.placedOrders) * 100).toFixed(1)
      : (placedRev > 0 ? ((paidRev / placedRev) * 100).toFixed(1) : '0.0');
    const funnelScore = Math.max(40, Math.min(95, Math.round(Number(completionRate) * 0.9)));
    const dropStage1VND = Math.max(0, placedRev - confirmedRev);
    const dropStage2VND = Math.max(0, confirmedRev - paidRev);
    const dropStage1Pct = placedRev > 0 ? ((dropStage1VND / placedRev) * 100).toFixed(1) : '0.0';
    const dropStage2Pct = confirmedRev > 0 ? ((dropStage2VND / confirmedRev) * 100).toFixed(1) : '0.0';

    // Calculations for Pillar 2: Daily Sales Trends
    const peakDay = daily.length > 0
      ? [...daily].sort((a, b) => b.revenue - a.revenue)[0]
      : { revenue: 0, orders: 0, displayDate: 'Chưa ghi nhận' };
    const normalDays = daily.filter((d) => !d.isDoubleDigitCampaign);
    const avgNormalRevenue = normalDays.length > 0
      ? Math.round(normalDays.reduce((acc, d) => acc + d.revenue, 0) / normalDays.length)
      : (daily.length > 0 ? Math.round(paidRev / daily.length) : 0);
    const campaignShare = campaign.campaignSharePercent || (paidRev > 0 ? Math.round((campaign.campaignRevenue / paidRev) * 100) : 0);
    const aboveTargetDays = daily.filter((d) => avgNormalRevenue > 0 && d.revenue > avgNormalRevenue * 1.2).length;
    const trendScore = campaignShare > 50 ? 68 : campaignShare > 30 ? 75 : 84;

    // Calculations for Pillar 3: Traffic & Channels
    const sortedChannelsByPaid = [...channels].sort((a, b) => b.paidRevenue - a.paidRevenue);
    const topChannel = sortedChannelsByPaid[0] || { channelName: 'Chưa có kênh', paidRevenue: 0, retentionRate: 0 };
    const topChannelShare = paidRev > 0 ? Math.round((topChannel.paidRevenue / paidRev) * 100) : 0;
    const sortedChannelsByRetention = [...channels].filter(c => c.placedRevenue > 0).sort((a, b) => b.retentionRate - a.retentionRate);
    const bestRetentionCh = sortedChannelsByRetention[0] || topChannel;
    const sortedChannelsByLeakage = [...channels].sort((a, b) => (b.leakageAmount || 0) - (a.leakageAmount || 0));
    const worstLeakageCh = sortedChannelsByLeakage[0] || { channelName: 'Chưa có rò rỉ', leakageAmount: 0, retentionRate: 100 };
    const channelScore = (bestRetentionCh.retentionRate || 0) >= 85 ? 78 : (bestRetentionCh.retentionRate || 0) >= 70 ? 72 : 65;

    // Calculations for Pillar 4: Shopee Ads
    const totalAdsSpend = ads.reduce((acc, a) => acc + (a.spend || 0), 0) || (kpis.adSpend || 0);
    const totalAdsPaidRev = ads.reduce((acc, a) => acc + (a.paidRevenue || 0), 0);
    const totalAdsClicks = ads.reduce((acc, a) => acc + (a.clicks || 0), 0);
    const totalAdsImpressions = ads.reduce((acc, a) => acc + (a.impressions || 0), 0);
    const overallRoas = totalAdsSpend > 0 ? (totalAdsPaidRev / totalAdsSpend).toFixed(1) : (kpis.blendedRoas && kpis.blendedRoas > 0 ? kpis.blendedRoas.toFixed(1) : '0.0');
    const overallCir = totalAdsPaidRev > 0 ? ((totalAdsSpend / totalAdsPaidRev) * 100).toFixed(1) : '0.0';
    const overallCtr = totalAdsImpressions > 0 ? ((totalAdsClicks / totalAdsImpressions) * 100).toFixed(2) : '0.00';
    const hasAds = totalAdsSpend > 0 || Number(overallRoas) > 0;
    const adsScore = hasAds ? (Number(overallRoas) >= 10 ? 88 : Number(overallRoas) >= 5 ? 75 : 60) : 70;

    // Calculations for Pillar 5: Product Catalog / ABC
    const topHeroProduct = abcProducts[0] || { name: 'Chưa có SKU', revenue: 0, conversionRate: 0 };
    const zombieCount = abc.zombieCount || abcProducts.filter((p) => p.isZombie).length;
    const classAShare = abc.classAShare || (paidRev > 0 ? +((topHeroProduct.revenue / paidRev) * 100).toFixed(1) : 0);
    const productScore = classAShare > 85 ? 74 : classAShare > 0 ? 80 : 65;

    // Calculations for Pillar 6: Customer Retention
    const totalBuyers = retention.totalBuyers || (kpis.paidOrders > 0 ? kpis.paidOrders : 0);
    const newBuyers = retention.newBuyers || totalBuyers;
    const returningBuyers = retention.returningBuyers || Math.max(0, totalBuyers - newBuyers);
    const newBuyerPct = totalBuyers > 0 ? ((newBuyers / totalBuyers) * 100).toFixed(1) : '0.0';
    const returningPct = totalBuyers > 0 ? ((returningBuyers / totalBuyers) * 100).toFixed(1) : '0.0';
    const newAov = retention.newBuyerAov || (newBuyers > 0 && retention.newBuyerRevenue ? Math.round(retention.newBuyerRevenue / newBuyers) : kpis.aov);
    const retAov = retention.returningBuyerAov || (returningBuyers > 0 && retention.returningBuyerRevenue ? Math.round(retention.returningBuyerRevenue / returningBuyers) : 0);
    const aovDiffPct = newAov > 0 && retAov > 0 ? Math.round(((retAov - newAov) / newAov) * 100) : 0;
    const retentionScore = Number(returningPct) >= 30 ? 80 : Number(returningPct) >= 20 ? 68 : 55;

    // Calculations for Pillar 7: Risk Synthesis
    const criticalAlerts = (data.alerts || []).filter((a) => a.severity === 'critical');
    const riskScore = Math.round((funnelScore + trendScore + channelScore + adsScore + productScore + retentionScore) / 6) - (criticalAlerts.length > 0 ? 5 : 0);

    return [
      // 1. Phễu chuyển đổi đơn hàng
      {
        id: 1,
        title: '1. Phễu chuyển đổi đơn hàng',
        shortTitle: '1. Phễu chuyển đổi',
        icon: Activity,
        badge: {
          text: Number(leakagePercent) > 0 ? `Rò rỉ ở bước Xác nhận & Thanh toán (${leakagePercent}%)` : 'Phễu chuyển đổi tối ưu',
          type: Number(leakagePercent) > 20 ? 'warning' : 'info',
        },
        score: funnelScore,
        overview: `Phễu chuyển đổi ghi nhận mức rơi rớt -${dropStage1Pct}% doanh số ở khâu xác nhận và tiếp tục rơi rớt -${dropStage2Pct}% ở khâu giao vận/thanh toán. Tổng thất thoát ước tính ${formatVND(leakageVND)}.`,
        metrics: [
          { label: 'Doanh số đặt (Placed)', value: formatVND(placedRev) },
          { label: 'Doanh số thực nhận (Paid)', value: formatVND(paidRev), highlight: true, color: 'text-emerald-400' },
          { label: 'Thất thoát phễu (Leakage)', value: `-${formatVND(leakageVND)} (-${leakagePercent}%)`, highlight: true, color: 'text-rose-400' },
          { label: 'Tỷ lệ hoàn tất đơn', value: `${completionRate}%` },
        ],
        strengths: [
          `Tỷ lệ đặt hàng bước đầu với ${formatNumber(kpis.placedOrders)} đơn phát sinh trong chu kỳ.`,
          `AOV bước thanh toán đạt ${formatVND(kpis.aov)}.`,
          `Khả năng kích thích khách thêm vào giỏ và hoàn tất đặt bước 1 đạt hiệu quả tốt.`,
        ],
        weaknesses: [
          dropStage1VND > 0 ? `Thất thoát ở bước Chờ xác nhận đơn (-${dropStage1Pct}% doanh số, tương đương -${formatVND(dropStage1VND)}).` : 'Cần duy trì tốc độ xác nhận đơn nhanh chóng.',
          dropStage2VND > 0 ? `Rơi rớt ở bước giao vận/hoàn hàng (-${dropStage2Pct}% doanh số, tương đương -${formatVND(dropStage2VND)}).` : 'Khâu giao vận thanh toán hoạt động ổn định.',
          'Khách hàng cần thông tin cập nhật lộ trình đơn hàng để tránh tâm lý sốt ruột và hủy đơn.',
        ],
        recommendations: [
          'Thiết lập kịch bản tin nhắn tự động xác nhận đơn COD trong 15 phút đầu sau khi đặt.',
          'Gắn cờ cảnh báo người mua có lịch sử hoàn hàng/không nhận hàng để đội CSKH gọi điện xác nhận trước khi gửi.',
          'Rút ngắn thời gian chuẩn bị hàng (SLA) xuống dưới 12 giờ để đơn được giao cho đơn vị vận chuyển sớm nhất.',
        ],
      },

      // 2. Xu hướng doanh số theo ngày
      {
        id: 2,
        title: '2. Xu hướng doanh số theo ngày',
        shortTitle: '2. Xu hướng doanh số',
        icon: TrendingUp,
        badge: {
          text: campaignShare > 0 ? `Phụ thuộc ${campaignShare}% vào ngày Mega Sale` : 'Doanh thu phân bổ đều',
          type: campaignShare > 40 ? 'warning' : 'success',
        },
        score: trendScore,
        overview: `Doanh thu có sự biến thiên theo lịch chiến dịch sàn. Các ngày Mega Sale (${campaign.campaignDaysCount || 0} ngày) mang về ${formatVND(campaign.campaignRevenue || 0)} (${campaignShare}% tổng DT). Ngày thường doanh thu duy trì ở mức trung bình ${formatVND(avgNormalRevenue)}/ngày.`,
        metrics: [
          { label: 'Doanh số ngày đỉnh (Peak)', value: formatVND(peakDay.revenue), subtext: peakDay.displayDate },
          { label: 'Doanh số TB ngày thường', value: formatVND(avgNormalRevenue) },
          { label: 'Tỷ trọng ngày Mega Sale', value: `${campaignShare}%`, highlight: true, color: 'text-amber-400' },
          { label: 'Số ngày vượt mục tiêu', value: `${aboveTargetDays} ngày` },
        ],
        strengths: [
          peakDay.revenue > 0 ? `Khả năng bùng nổ doanh số trong các ngày chiến dịch (đỉnh cao gấp ${avgNormalRevenue > 0 ? (peakDay.revenue / avgNormalRevenue).toFixed(1) : 1}x ngày thường).` : 'Gian hàng đang tích lũy dữ liệu các ngày chiến dịch.',
          `Lượng đơn ngày đỉnh đạt ${formatNumber(peakDay.orders)} đơn.`,
        ],
        weaknesses: [
          campaignShare > 40 ? 'Doanh thu ngày thường trũng sâu, phụ thuộc đáng kể vào các ngày chiến dịch sàn.' : 'Cần tối ưu thêm các chương trình khuyến mãi ngày thường.',
          'Đội ngũ đóng gói và vận hành cần chuẩn bị trước tránh dồn tải sau ngày Sale.',
        ],
        recommendations: [
          'Triển khai chương trình "Flash Sale giữa tuần" (Thứ 4 / Thứ 6 vui vẻ) để kéo đáy doanh số ngày thường.',
          'Tạo combo sản phẩm "Mua Kèm Deal Sốc" để duy trì AOV cao trong những ngày không có mã sàn.',
          'Lên kế hoạch dự trù tồn kho và nhân sự đóng gói trước ngày Mega Sale ít nhất 3 ngày.',
        ],
      },

      // 3. Nguồn lưu lượng & kênh doanh thu
      {
        id: 3,
        title: '3. Nguồn lưu lượng & kênh doanh thu',
        shortTitle: '3. Kênh & Lưu lượng',
        icon: Compass,
        badge: {
          text: worstLeakageCh.leakageAmount > 0 ? `Rò rỉ ở kênh ${worstLeakageCh.channelName} (giữ chân ${worstLeakageCh.retentionRate}%)` : 'Hiệu quả kênh đồng đều',
          type: worstLeakageCh.leakageAmount > 0 ? 'critical' : 'success',
        },
        score: channelScore,
        overview: `Kênh ${topChannel.channelName} đóng góp lớn nhất (${topChannelShare}% doanh thu). Kênh ${bestRetentionCh.channelName} duy trì tỷ lệ giữ chân thực nhận (${bestRetentionCh.retentionRate}%). ${worstLeakageCh.leakageAmount > 0 ? `Kênh ${worstLeakageCh.channelName} ghi nhận mức thất thoát -${formatVND(worstLeakageCh.leakageAmount)}.` : 'Các kênh đều có tỷ lệ hoàn tất tốt.'}`,
        metrics: [
          { label: `Kênh Top 1 (${topChannel.channelName})`, value: formatVND(topChannel.paidRevenue), highlight: true, color: 'text-emerald-400' },
          { label: `Giữ chân tốt nhất (${bestRetentionCh.channelName})`, value: `${bestRetentionCh.retentionRate}%` },
          { label: `Rò rỉ lớn nhất (${worstLeakageCh.channelName})`, value: `-${formatVND(worstLeakageCh.leakageAmount)}`, highlight: true, color: 'text-rose-400' },
          { label: 'Số kênh phát sinh đơn', value: `${channels.length} kênh` },
        ],
        strengths: [
          `Kênh ${bestRetentionCh.channelName} có tỷ lệ đơn hoàn tất đạt ${bestRetentionCh.retentionRate}%.`,
          `Mạng lưới lưu lượng đa kênh từ ${channels.length} nguồn khác nhau.`,
        ],
        weaknesses: [
          worstLeakageCh.leakageAmount > 0 ? `Kênh ${worstLeakageCh.channelName} có tỷ lệ rớt đơn cao nhất, thất thoát ${formatVND(worstLeakageCh.leakageAmount)}.` : 'Cần liên tục theo dõi chất lượng traffic các kênh.',
          'Cần tối ưu hóa thêm trải nghiệm chốt đơn trên các kênh trực tiếp.',
        ],
        recommendations: [
          `Tăng cường hợp tác với các KOC/Affiliate ở kênh ${bestRetentionCh.channelName} để đẩy mạnh sản lượng.`,
          `Thêm voucher độc quyền có thời hạn ngắn để thúc đẩy khách thanh toán ngay.`,
          `Chuẩn hóa bộ từ khóa tìm kiếm trên tiêu đề sản phẩm để thu hút lượt truy cập tự nhiên có chuyển đổi cao.`,
        ],
      },

      // 4. Hiệu quả quảng cáo Shopee Ads
      {
        id: 4,
        title: '4. Hiệu quả quảng cáo Shopee Ads',
        shortTitle: '4. Shopee Ads',
        icon: Target,
        badge: {
          text: hasAds ? `ROAS đạt ${overallRoas}x (CIR ${overallCir}%)` : 'Chưa ghi nhận chi phí Ads',
          type: Number(overallRoas) >= 8 ? 'success' : hasAds ? 'warning' : 'info',
        },
        score: adsScore,
        overview: hasAds
          ? `Hệ thống Ads ghi nhận tổng chi phí ${formatVND(totalAdsSpend)}, mang về ${formatVND(totalAdsPaidRev)} doanh thu thanh toán, ROAS đạt ${overallRoas}x.`
          : 'Gian hàng hiện tại chưa phát sinh chi phí quảng cáo trực tiếp trong kỳ đối soát này.',
        metrics: [
          { label: 'Tổng chi phí Ads (Spend)', value: formatVND(totalAdsSpend) },
          { label: 'Doanh thu từ Ads', value: formatVND(totalAdsPaidRev), highlight: true, color: 'text-emerald-400' },
          { label: 'ROAS trung bình', value: `${overallRoas}x`, highlight: true, color: 'text-cyan-400' },
          { label: 'CIR (Tỷ lệ CP/DT)', value: `${overallCir}%` },
        ],
        strengths: [
          hasAds ? `Chỉ số ROAS ${overallRoas}x mang lại hiệu quả trực tiếp cho doanh số.` : 'Tiết kiệm 100% ngân sách quảng cáo, tập trung vào lưu lượng tự nhiên.',
          totalAdsClicks > 0 ? `Ghi nhận ${formatNumber(totalAdsClicks)} lượt click chất lượng với CTR ${overallCtr}%.` : 'Có tiềm năng tăng trưởng mạnh khi triển khai quảng cáo có mục tiêu.',
        ],
        weaknesses: [
          hasAds ? 'Cần rà soát các từ khóa chi phí cao nhưng đơn hàng chuyển đổi thấp.' : 'Chưa khai thác kênh quảng cáo tìm kiếm để gia tăng lượt hiển thị sản phẩm mới.',
        ],
        recommendations: [
          'Phủ định các từ khóa tìm kiếm không đúng tệp và giảm giá thầu cho từ khóa có CIR > 18%.',
          'Tăng ngân sách cho các từ khóa chính xác có ROAS cao trong các khung giờ vàng (12h - 14h, 20h - 23h).',
          'Thực hiện A/B testing ảnh bìa sản phẩm để tăng tỷ lệ click (CTR).',
        ],
      },

      // 5. Phân tích danh mục sản phẩm (ABC)
      {
        id: 5,
        title: '5. Phân tích danh mục sản phẩm',
        shortTitle: '5. Danh mục SKU',
        icon: Package,
        badge: {
          text: `Nhóm A gánh ${classAShare}% doanh số • ${zombieCount} SKU Zombie`,
          type: zombieCount > 3 ? 'warning' : 'success',
        },
        score: productScore,
        overview: `Danh mục phân phối: ${abc.classACount || 1} sản phẩm nhóm A tạo ra ${classAShare}% tổng doanh thu. Ghi nhận ${zombieCount} sản phẩm nhóm C ở tình trạng Zombie (nhiều lượt xem nhưng chưa có đơn).`,
        metrics: [
          { label: 'Sản phẩm Nhóm A (Hero)', value: `${abc.classACount || 1} SKU (${classAShare}% DT)`, highlight: true, color: 'text-emerald-400' },
          { label: 'Sản phẩm Nhóm B (Tiềm năng)', value: `${abc.classBCount || 0} SKU (${abc.classBShare || 0}% DT)` },
          { label: 'Sản phẩm Nhóm C (Long-tail)', value: `${abc.classCCount || 0} SKU (${abc.classCShare || 0}% DT)` },
          { label: 'Sản phẩm Zombie / Tồn kho', value: `${zombieCount} SKU`, highlight: true, color: 'text-amber-400' },
        ],
        strengths: [
          `Sản phẩm chủ lực (${topHeroProduct.name}) đóng góp ${formatVND(topHeroProduct.revenue)} doanh thu.`,
          `Cơ cấu sản phẩm nhóm A tạo nền tảng doanh số vững chắc.`,
        ],
        weaknesses: [
          classAShare > 80 ? `Độ phụ thuộc lớn vào nhóm A (${classAShare}% doanh số) - rủi ro khi đứt hàng.` : 'Cần tối ưu thêm các sản phẩm nhóm B lên nhóm A.',
          zombieCount > 0 ? `${zombieCount} sản phẩm Zombie tiêu tốn tài nguyên hiển thị mà chưa sinh đơn.` : 'Danh mục sản phẩm hoạt động hiệu quả.',
        ],
        recommendations: [
          `Đảm bảo mức tồn kho tối thiểu 30 ngày cho các SKU nhóm A, tuyệt đối không để xảy ra tình trạng "Hết hàng".`,
          'Đóng combo các sản phẩm Zombie nhóm C làm quà tặng miễn phí kèm theo sản phẩm nhóm A để xả tồn kho và tăng đánh giá 5 sao.',
          'Thiết kế lại tiêu đề, video và hình ảnh mô tả cho các sản phẩm nhóm B để thúc đẩy lên nhóm A.',
        ],
      },

      // 6. Phân tích hành vi khách hàng
      {
        id: 6,
        title: '6. Phân tích hành vi khách hàng',
        shortTitle: '6. Khách hàng',
        icon: Users,
        badge: {
          text: `Khách mới ${newBuyerPct}% • Tỷ lệ quay lại ${returningPct}%`,
          type: Number(returningPct) < 25 ? 'warning' : 'success',
        },
        score: retentionScore,
        overview: `Gian hàng ghi nhận ${formatNumber(totalBuyers)} người mua, trong đó tệp khách mới chiếm ${newBuyerPct}% (${formatNumber(newBuyers)} khách). Tỷ lệ khách hàng quay lại là ${returningPct}% (${formatNumber(returningBuyers)} khách)${retAov > 0 ? `, AOV khách cũ ${formatVND(retAov)}` : ''}.`,
        metrics: [
          { label: 'Tổng số người mua', value: `${formatNumber(totalBuyers)} khách` },
          { label: 'Khách hàng mới (New)', value: `${newBuyerPct}% (${formatNumber(newBuyers)} khách)` },
          { label: 'Khách quay lại (Returning)', value: `${returningPct}% (${formatNumber(returningBuyers)} khách)`, highlight: true, color: 'text-cyan-400' },
          { label: 'AOV Khách cũ vs Mới', value: retAov > 0 ? `+${aovDiffPct}% (${formatVND(retAov)})` : `${formatVND(newAov)}`, highlight: true, color: 'text-emerald-400' },
        ],
        strengths: [
          `Thu hút thành công ${formatNumber(newBuyers)} khách hàng mới phát sinh đơn.`,
          retAov > 0 ? `Khách hàng cũ chi tiêu với AOV ${formatVND(retAov)}.` : 'Tiềm năng phát triển tệp khách hàng trung thành.',
        ],
        weaknesses: [
          Number(returningPct) < 20 ? `Tỷ lệ khách mua lặp lại (${returningPct}%) còn thấp, cần chiến lược CSKH sau bán.` : 'Cần tiếp tục chăm sóc tệp khách hàng hiện hữu.',
          'Chưa có chương trình tích điểm thưởng hoặc quà tặng tri ân tự động cho khách hàng trung thành.',
        ],
        recommendations: [
          'Thiết lập kịch bản chăm sóc sau bán tự động qua Shopee Chat vào ngày thứ 7 sau khi giao hàng thành công.',
          'Gửi tặng voucher độc quyền "Tri Ân Khách Cũ" vào hộp thư của khách hàng trước các đợt Mega Sale.',
          'Tạo thiệp cảm ơn in ấn tượng kẹp vào từng gói hàng hướng dẫn khách tham gia kênh chăm sóc.',
        ],
      },

      // 7. Tổng hợp rủi ro & điểm nghẽn
      {
        id: 7,
        title: '7. Tổng hợp rủi ro & điểm nghẽn',
        shortTitle: '7. Rủi ro & Điểm nghẽn',
        icon: ShieldAlert,
        badge: {
          text: `${criticalAlerts.length > 0 ? `${criticalAlerts.length} Cảnh báo quan trọng` : 'Rủi ro trong tầm kiểm soát'}`,
          type: criticalAlerts.length > 0 ? 'critical' : 'info',
        },
        score: Math.max(55, Math.min(85, riskScore)),
        overview: `Tổng hợp đối soát số liệu cho thấy các điểm nghẽn trọng điểm: (1) Thất thoát phễu ${leakagePercent}% (-${formatVND(leakageVND)}), (2) Phụ thuộc ${campaignShare}% vào ngày Mega Sale, và (3) Tỷ lệ giữ chân khách quay lại (${returningPct}%).`,
        metrics: [
          { label: 'Tổng thất thoát phễu', value: `-${formatVND(leakageVND)}`, highlight: true, color: 'text-rose-400' },
          { label: 'Cảnh báo rủi ro cao', value: `${criticalAlerts.length} cảnh báo`, highlight: true, color: 'text-amber-400' },
          { label: 'Mức phụ thuộc chiến dịch', value: `${campaignShare}%` },
          { label: 'Tỷ lệ rớt đơn thanh toán', value: `${(100 - Number(completionRate)).toFixed(1)}%` },
        ],
        strengths: [
          `Doanh thu thực nhận đạt ${formatVND(paidRev)} với cấu trúc sản phẩm Hero rõ ràng.`,
          `Dữ liệu phân tầng minh bạch giúp định vị chính xác vị trí cần can thiệp xử lý.`,
        ],
        weaknesses: [
          leakageVND > 0 ? `Thất thoát ở khâu xác nhận và thanh toán (-${formatVND(leakageVND)}).` : 'Cần duy trì chất lượng vận hành đơn hàng.',
          'Cần ổn định dòng tiền doanh thu vào các ngày thường trong tháng.',
        ],
        recommendations: [
          'Ưu tiên hành động 1: Cài đặt chatbot xác nhận tự động địa chỉ đơn COD trong 15 phút đầu.',
          'Ưu tiên hành động 2: Kích hoạt gói combo ưu đãi giữa tuần để kéo đều đặn doanh số ngày thường.',
          'Ưu tiên hành động 3: Đóng gói sản phẩm Zombie thành quà tặng để giải phóng kho bãi và tăng đánh giá tích cực.',
        ],
      },
    ];
  }, [data]);

  // Overall store health summary paragraph
  const overallHealthText = useMemo(() => {
    const kpis = data.kpis;
    const paidRev = kpis.paidRevenue || 0;
    const paidOrders = kpis.paidOrders || 0;
    const funnel = data.funnel;
    const leakageVND = funnel.totalLeakageVND || Math.max(0, (kpis.placedRevenue || 0) - paidRev);
    const leakagePct = (kpis.placedRevenue || 0) > 0 ? ((leakageVND / (kpis.placedRevenue || 1)) * 100).toFixed(1) : '0.0';
    const ads = data.ads || [];
    const totalAdsSpend = ads.reduce((acc, a) => acc + (a.spend || 0), 0) || (kpis.adSpend || 0);
    const totalAdsPaidRev = ads.reduce((acc, a) => acc + (a.paidRevenue || 0), 0);
    const adsRoas = totalAdsSpend > 0 ? (totalAdsPaidRev / totalAdsSpend).toFixed(1) : (kpis.blendedRoas && kpis.blendedRoas > 0 ? kpis.blendedRoas.toFixed(1) : '0.0');
    const newBuyerShare = data.retention && data.retention.totalBuyers > 0 ? ((data.retention.newBuyers / data.retention.totalBuyers) * 100).toFixed(1) : '0.0';

    return `Đánh giá tổng thể gian hàng: Gian hàng đạt doanh thu thực nhận ${formatVND(paidRev)} (${formatNumber(paidOrders)} đơn)${totalAdsSpend > 0 ? `, ROAS quảng cáo đạt ${adsRoas}x` : ''}. Các trọng tâm cần tối ưu: (1) Thất thoát phễu ${leakagePct}% (${formatVND(leakageVND)}), (2) Phụ thuộc vào ngày chiến dịch, (3) Tỷ lệ khách mua mới chiếm ${newBuyerShare}% cần xây dựng phễu chăm sóc khách hàng quay lại.`;
  }, [data]);

  // Action: Copy All Text
  const handleCopyAll = () => {
    let fullText = `=== HỆ THỐNG ĐÁNH GIÁ & THẨM ĐỊNH TOÀN DIỆN BẰNG AI ===\nFile: ${data.fileName}\n${overallHealthText}\n\n`;

    pillars.forEach((p) => {
      fullText += `--- ${p.title} (Điểm: ${p.score}/100) ---\n`;
      fullText += `Trạng thái: ${p.badge.text}\n`;
      fullText += `Tổng quan: ${p.overview}\n\n`;
      fullText += `CHỈ SỐ TRỌNG YẾU:\n`;
      p.metrics.forEach((m) => {
        fullText += `- ${m.label}: ${m.value}\n`;
      });
      fullText += `\nĐIỂM MẠNH & CƠ HỘI:\n`;
      p.strengths.forEach((s) => (fullText += `+ ${s}\n`));
      fullText += `\nRỦI RO & ĐIỂM YẾU:\n`;
      p.weaknesses.forEach((w) => (fullText += `- ${w}\n`));
      fullText += `\nKHUYẾN NGHỊ HÀNH ĐỘNG:\n`;
      p.recommendations.forEach((r) => (fullText += `→ ${r}\n`));
      fullText += `\n\n`;
    });

    navigator.clipboard.writeText(fullText);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  // Action: Print / PDF
  const handlePrint = () => {
    window.print();
  };

  // Action: Export Google Sheets / CSV
  const handleExportSheets = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Trụ cột,Điểm đánh giá,Trạng thái,Tổng quan,Chỉ số 1,Chỉ số 2,Chỉ số 3,Chỉ số 4,Khuyến nghị chính\n';

    pillars.forEach((p) => {
      const metricsStr = p.metrics.map((m) => `${m.label}: ${m.value}`).join(' | ');
      const recStr = p.recommendations.join('; ');
      const row = [
        `"${p.title}"`,
        `"${p.score}/100"`,
        `"${p.badge.text}"`,
        `"${p.overview.replace(/"/g, '""')}"`,
        `"${p.metrics[0]?.label || ''}: ${p.metrics[0]?.value || ''}"`,
        `"${p.metrics[1]?.label || ''}: ${p.metrics[1]?.value || ''}"`,
        `"${p.metrics[2]?.label || ''}: ${p.metrics[2]?.value || ''}"`,
        `"${p.metrics[3]?.label || ''}: ${p.metrics[3]?.value || ''}"`,
        `"${recStr.replace(/"/g, '""')}"`,
      ].join(',');
      csvContent += row + '\r\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `EcomPulse_AI_7_Pillars_${data.fileName.replace('.xlsx', '')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Action: Download JSON report
  const handleDownloadReport = () => {
    const reportData = {
      title: 'EcomPulse 7-Pillar AI Evaluation Report',
      fileName: data.fileName,
      generatedAt: new Date().toISOString(),
      overallHealth: overallHealthText,
      pillars: pillars.map((p) => ({
        id: p.id,
        title: p.title,
        score: p.score,
        badge: p.badge.text,
        overview: p.overview,
        metrics: p.metrics,
        strengths: p.strengths,
        weaknesses: p.weaknesses,
        recommendations: p.recommendations,
      })),
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EcomPulse_AI_Assessment_${data.fileName.replace('.xlsx', '')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const displayedPillars = selectedPillarId === 'all'
    ? pillars
    : pillars.filter((p) => p.id === selectedPillarId);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Header Banner */}
      <div className="glass-panel rounded-2xl p-5 sm:p-6 shadow-2xl relative overflow-hidden border border-purple-400/30 bg-gradient-to-r from-[#241744] via-[#1a1c3b] to-[#121b36]">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          {/* Title & Badge */}
          <div className="flex items-start sm:items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-purple-500/30 border border-purple-400/40 shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Hệ Thống Đánh Giá & Thẩm Định Toàn Diện Bằng AI
                </h2>
                <span className="px-3 py-0.5 rounded-full text-xs font-black bg-purple-500/30 text-purple-200 border border-purple-400/50 uppercase tracking-wider backdrop-blur-md">
                  7 Trụ Cột Dữ Liệu
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                AI tự động đối soát toàn bộ số liệu Excel (File {data.fileName}) để phát hiện rủi ro, đánh giá hiệu quả và đề xuất hành động
              </p>
            </div>
          </div>

          {/* Quick Action Buttons Toolbar */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <button
              onClick={handleExportSheets}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
              title="Xuất sang định dạng Google Sheets / CSV"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Xuất Google Sheets</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-blue-600/20"
              title="In hoặc lưu file PDF"
            >
              <Printer className="w-4 h-4" />
              <span>In Báo Cáo / PDF</span>
            </button>

            <button
              onClick={handleDownloadReport}
              className="px-3 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-slate-200 border border-white/[0.15] text-xs font-semibold transition-all flex items-center gap-1.5 backdrop-blur-md"
              title="Tải tệp báo cáo JSON"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Tải File Báo Cáo</span>
            </button>

            <button
              onClick={handleCopyAll}
              className="px-3 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-slate-200 border border-white/[0.15] text-xs font-semibold transition-all flex items-center gap-1.5 backdrop-blur-md"
              title="Sao chép toàn bộ nội dung đánh giá"
            >
              {copiedAll ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Đã sao chép!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-300" />
                  <span>Sao chép</span>
                </>
              )}
            </button>

            <button
              onClick={onReEvaluate}
              disabled={isEvaluating}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-purple-600/25"
            >
              <RefreshCw className={`w-4 h-4 ${isEvaluating ? 'animate-spin' : ''}`} />
              <span>Đánh giá lại bằng AI</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Overall Store Health Callout */}
      <div className="glass-panel rounded-2xl p-5 border border-purple-500/30 bg-gradient-to-r from-purple-950/40 via-slate-900/60 to-indigo-950/40 shadow-xl flex items-start space-x-4">
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/40 text-purple-300 flex items-center justify-center shrink-0 mt-0.5 shadow-inner">
          <Activity className="w-5 h-5" />
        </div>
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center space-x-2.5">
            <span className="text-xs sm:text-sm font-bold text-slate-300">Sức khỏe tổng thể:</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/25 text-amber-300 border border-amber-400/40">
              TRUNG BÌNH
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-100 leading-relaxed">
            {overallHealthText}
          </p>
        </div>
      </div>

      {/* 3. 7 Pillar Filter Navigation Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setSelectedPillarId('all')}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 border shadow-sm ${
            selectedPillarId === 'all'
              ? 'bg-purple-600 text-white border-purple-400 shadow-purple-600/30'
              : 'glass-panel-subtle text-slate-300 border-white/10 hover:bg-white/[0.1]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Tất Cả 7 Trụ Cột</span>
        </button>

        {pillars.map((pillar) => {
          const IconComp = pillar.icon;
          const isActive = selectedPillarId === pillar.id;

          return (
            <button
              key={pillar.id}
              onClick={() => setSelectedPillarId(pillar.id)}
              className={`px-3.5 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 border shadow-sm ${
                isActive
                  ? 'bg-purple-600 text-white border-purple-400 shadow-purple-600/30'
                  : 'glass-panel-subtle text-slate-300 border-white/10 hover:bg-white/[0.1]'
              }`}
            >
              <IconComp className="w-3.5 h-3.5 text-cyan-300" />
              <span>{pillar.shortTitle}</span>
            </button>
          );
        })}
      </div>

      {/* 4. Pillars Cards Rendered */}
      <div className="space-y-6">
        {displayedPillars.map((pillar) => {
          const IconComp = pillar.icon;
          const isExpanded = expandedPillars[pillar.id] ?? true;

          return (
            <div
              key={pillar.id}
              id={`pillar-card-${pillar.id}`}
              className="glass-panel rounded-2xl border border-white/[0.12] shadow-2xl overflow-hidden transition-all duration-300 bg-slate-900/60 backdrop-blur-xl"
            >
              {/* Card Header */}
              <div
                onClick={() => toggleExpand(pillar.id)}
                className="p-4 sm:p-5 flex items-center justify-between cursor-pointer select-none bg-gradient-to-r from-white/[0.04] to-transparent hover:bg-white/[0.06] transition-colors border-b border-white/[0.08]"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600/30 to-purple-600/30 text-cyan-300 border border-cyan-400/30 flex items-center justify-center shrink-0 shadow-sm">
                    <IconComp className="w-5 h-5" />
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                    {pillar.title}
                  </h3>
                  <span
                    className={`px-3 py-0.5 rounded-full text-xs font-bold tracking-wide border backdrop-blur-md flex items-center gap-1.5 ${
                      pillar.badge.type === 'critical'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-400/40'
                        : pillar.badge.type === 'warning'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                    {pillar.badge.text}
                  </span>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block font-medium">Điểm đánh giá:</span>
                    <span className="text-sm sm:text-base font-black text-purple-300">
                      {pillar.score}/100
                    </span>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center text-slate-300">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </div>

              {/* Card Body */}
              {isExpanded && (
                <div className="p-5 sm:p-6 space-y-6">
                  {/* Overview Callout Container */}
                  <div className="p-4 rounded-xl bg-black/40 border border-white/[0.08] text-xs sm:text-sm text-slate-200 leading-relaxed shadow-inner">
                    {pillar.overview}
                  </div>

                  {/* Quantitative Metrics Section */}
                  <div>
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-3">
                      CHỈ SỐ ĐỊNH LƯỢNG TRỌNG YẾU:
                    </h4>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                      {pillar.metrics.map((m, idx) => (
                        <div
                          key={idx}
                          className="glass-panel-subtle rounded-xl p-3.5 border border-white/[0.08] flex flex-col justify-between"
                        >
                          <span className="text-xs text-slate-400">{m.label}</span>
                          <div className="mt-1">
                            <span
                              className={`text-sm sm:text-base font-black tracking-tight ${
                                m.color || (m.highlight ? 'text-white' : 'text-slate-200')
                              }`}
                            >
                              {m.value}
                            </span>
                            {m.subtext && (
                              <span className="text-[10px] text-slate-400 block mt-0.5 font-normal">
                                {m.subtext}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 2-Column Analysis Grid: Strengths vs Risks */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left: Strengths & Opportunities */}
                    <div className="rounded-xl p-4.5 bg-emerald-950/20 border border-emerald-500/25 space-y-2.5">
                      <div className="flex items-center space-x-2 text-emerald-300 font-bold text-xs sm:text-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Điểm Mạnh & Cơ Hội:</span>
                      </div>
                      <ul className="space-y-2 text-xs text-emerald-200/90 leading-relaxed">
                        {pillar.strengths.map((str, sIdx) => (
                          <li key={sIdx} className="flex items-start space-x-2">
                            <span className="text-emerald-400 mt-0.5">•</span>
                            <span>{str}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Right: Risks & Weaknesses */}
                    <div className="rounded-xl p-4.5 bg-rose-950/20 border border-rose-500/25 space-y-2.5">
                      <div className="flex items-center space-x-2 text-rose-300 font-bold text-xs sm:text-sm">
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                        <span>Rủi Ro & Điểm Yếu:</span>
                      </div>
                      <ul className="space-y-2 text-xs text-rose-200/90 leading-relaxed">
                        {pillar.weaknesses.map((weak, wIdx) => (
                          <li key={wIdx} className="flex items-start space-x-2">
                            <span className="text-rose-400 mt-0.5">•</span>
                            <span>{weak}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Action Recommendations Box */}
                  <div className="rounded-xl p-4.5 bg-amber-950/20 border border-amber-500/30 space-y-2.5">
                    <div className="flex items-center space-x-2 text-amber-300 font-bold text-xs sm:text-sm">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>Khuyến Nghị Hành Động Khắc Phục:</span>
                    </div>
                    <div className="space-y-2 text-xs text-amber-100 leading-relaxed">
                      {pillar.recommendations.map((rec, rIdx) => (
                        <div key={rIdx} className="flex items-start space-x-2">
                          <span className="text-amber-400 font-black shrink-0">→</span>
                          <span>{rec}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

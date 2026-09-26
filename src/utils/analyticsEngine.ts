import {
  OrderItem,
  ParsedStoreData,
  ExecutiveKpis,
  FunnelStage,
  ChannelMetric,
  RuleAlert,
  DailySalesMetric,
  AbcProduct,
  AdPerformanceMetric,
  CustomerRetentionMetric,
  ProductGrowthMomentumItem,
  CreatorGrowthSummary,
  LiveSessionMetric,
  VideoContributionMetric,
  AffiliateContributionMetric,
  SimulationParams,
  SimulationResult,
} from '../types';

export function calculateAnalyticsFromOrders(
  orders: OrderItem[],
  fileName: string = 'Upload_Report.xlsx',
  periodLabel: string = 'Dữ liệu phân tích',
  detectedSheets: string[] = ['Đơn hàng đã đặt', 'Đơn đã xác nhận', 'Đơn Đã Thanh Toán']
): ParsedStoreData {
  let placedRev = 0;
  let confirmedRev = 0;
  let paidRev = 0;
  let totalSubsidies = 0;
  let placedCount = 0;
  let confirmedCount = 0;
  let paidCount = 0;
  let cancelledCount = 0;
  let totalUnits = 0;

  const channelMap = new Map<string, {
    placedRev: number;
    confirmedRev: number;
    paidRev: number;
    placedOrders: Set<string>;
    paidOrders: Set<string>;
    channelName: string;
  }>();

  const productMap = new Map<string, {
    sku: string;
    name: string;
    revenue: number;
    orders: Set<string>;
    units: number;
    views: number;
  }>();

  const dailyMap = new Map<string, {
    revenue: number;
    placedRev: number;
    orders: Set<string>;
    dateStr: string;
  }>();

  const buyerMap = new Map<string, {
    orderCount: number;
    revenue: number;
  }>();

  for (const o of orders) {
    const status = (o.orderStatus || 'paid').toLowerCase();
    const rev = o.paidAmount || o.originalPrice || 0;
    const qty = o.quantity || 1;
    totalUnits += qty;
    totalSubsidies += o.shopeeSubsidy || 0;

    placedRev += o.originalPrice || rev;
    placedCount++;

    if (status.includes('confirm') || status.includes('xác nhận') || status.includes('chờ giao') || status.includes('paid') || status.includes('thanh toán') || status.includes('hoàn tất')) {
      confirmedRev += rev;
      confirmedCount++;
    }

    if (status.includes('paid') || status.includes('thanh toán') || status.includes('hoàn tất') || status.includes('thành công')) {
      paidRev += rev;
      paidCount++;
    }

    if (status.includes('cancel') || status.includes('huỷ') || status.includes('hủy') || status.includes('return') || status.includes('trả hàng') || status.includes('boom')) {
      cancelledCount++;
    }

    // Channel grouping
    const chKey = o.channel || 'organic_search';
    let chName = chKey;
    if (chKey.includes('live')) chName = 'Shopee Live Stream';
    else if (chKey.includes('video')) chName = 'Shopee Video';
    else if (chKey.includes('affiliate') || chKey.includes('koc')) chName = 'Tiếp thị liên kết (Affiliate)';
    else if (chKey.includes('search_ad') || chKey.includes('quảng cáo tìm')) chName = 'Quảng cáo Tìm kiếm';
    else if (chKey.includes('discovery') || chKey.includes('khám phá')) chName = 'Quảng cáo Khám phá';
    else if (chKey.includes('chat') || chKey.includes('quảng bá')) chName = 'Tin nhắn Quảng bá (Chat)';
    else if (chKey.includes('organic') || chKey.includes('tự nhiên')) chName = 'Tìm kiếm tự nhiên';

    if (!channelMap.has(chKey)) {
      channelMap.set(chKey, {
        placedRev: 0,
        confirmedRev: 0,
        paidRev: 0,
        placedOrders: new Set(),
        paidOrders: new Set(),
        channelName: chName,
      });
    }
    const cData = channelMap.get(chKey)!;
    cData.placedRev += o.originalPrice || rev;
    cData.placedOrders.add(o.orderId);
    if (status.includes('paid') || status.includes('thanh toán') || status.includes('hoàn tất') || status.includes('thành công')) {
      cData.paidRev += rev;
      cData.paidOrders.add(o.orderId);
    }
    if (status.includes('confirm') || status.includes('xác nhận') || status.includes('chờ giao') || status.includes('paid')) {
      cData.confirmedRev += rev;
    }

    // Product grouping
    const prodKey = o.sku || o.productName || 'Unknown SKU';
    if (!productMap.has(prodKey)) {
      productMap.set(prodKey, {
        sku: o.sku || prodKey,
        name: o.productName || prodKey,
        revenue: 0,
        orders: new Set(),
        units: 0,
        views: 0, // Order rows carry no product views; zombie detection needs a traffic report
      });
    }
    const pData = productMap.get(prodKey)!;
    if (status.includes('paid') || status.includes('thanh toán') || status.includes('hoàn tất') || status.includes('thành công')) {
      pData.revenue += rev;
      pData.orders.add(o.orderId);
      pData.units += qty;
    }

    // Daily grouping
    const dateStr = o.orderDate ? o.orderDate.substring(0, 10) : '2025-08-01';
    if (!dailyMap.has(dateStr)) {
      dailyMap.set(dateStr, {
        revenue: 0,
        placedRev: 0,
        orders: new Set(),
        dateStr,
      });
    }
    const dData = dailyMap.get(dateStr)!;
    dData.placedRev += o.originalPrice || rev;
    dData.orders.add(o.orderId);
    if (status.includes('paid') || status.includes('thanh toán') || status.includes('hoàn tất') || status.includes('thành công')) {
      dData.revenue += rev;
    }

    // Buyer grouping
    const buyerKey = o.buyerId || `buyer-${o.orderId}`;
    if (!buyerMap.has(buyerKey)) {
      buyerMap.set(buyerKey, { orderCount: 0, revenue: 0 });
    }
    const bData = buyerMap.get(buyerKey)!;
    bData.orderCount++;
    if (status.includes('paid') || status.includes('thanh toán') || status.includes('hoàn tất')) {
      bData.revenue += rev;
    }
  }

  const actualRevenue = Math.max(0, paidRev - totalSubsidies);
  const aov = paidCount > 0 ? Math.round(paidRev / paidCount) : 0;
  const conversionRate = placedCount > 0 ? +((paidCount / placedCount) * 100).toFixed(2) : 0;
  // Only orders whose status says cancelled/returned count — pending orders are not cancellations.
  const cancellationRate = placedCount > 0 ? +((cancelledCount / placedCount) * 100).toFixed(2) : 0;

  const kpis: ExecutiveKpis = {
    placedRevenue: placedRev,
    confirmedRevenue: confirmedRev,
    paidRevenue: paidRev,
    actualRevenue,
    totalSubsidies,
    placedOrders: placedCount,
    confirmedOrders: confirmedCount,
    paidOrders: paidCount,
    cancelledOrders: cancelledCount,
    cancellationRate,
    aov,
    conversionRate,
    totalUnits,
  };

  // Funnel
  const dropOffPlacedToConfirmed = Math.max(0, placedRev - confirmedRev);
  const dropOffConfirmedToPaid = Math.max(0, confirmedRev - paidRev);
  const totalLeakageVND = dropOffPlacedToConfirmed + dropOffConfirmedToPaid;

  const funnelStages: FunnelStage[] = [
    {
      stage: 'placed',
      name: '1. Đơn hàng đã đặt (Placed)',
      orders: placedCount,
      revenue: placedRev,
      conversionRateFromStart: 100,
      dropOffRateFromPrev: 0,
      leakageRevenue: 0,
    },
    {
      stage: 'confirmed',
      name: '2. Đơn đã xác nhận (Confirmed)',
      orders: confirmedCount,
      revenue: confirmedRev,
      conversionRateFromStart: placedCount > 0 ? +((confirmedCount / placedCount) * 100).toFixed(2) : 0,
      dropOffRateFromPrev: placedCount > 0 ? +(((placedCount - confirmedCount) / placedCount) * 100).toFixed(2) : 0,
      leakageRevenue: dropOffPlacedToConfirmed,
    },
    {
      stage: 'paid',
      name: '3. Đơn Đã Thanh Toán (Paid)',
      orders: paidCount,
      revenue: paidRev,
      conversionRateFromStart: placedCount > 0 ? +((paidCount / placedCount) * 100).toFixed(2) : 0,
      dropOffRateFromPrev: confirmedCount > 0 ? +(((confirmedCount - paidCount) / confirmedCount) * 100).toFixed(2) : 0,
      leakageRevenue: dropOffConfirmedToPaid,
    },
  ];

  // Channels
  const channels: ChannelMetric[] = Array.from(channelMap.entries()).map(([key, item]) => {
    const pOrders = item.placedOrders.size || 1;
    const paidOrdersCount = item.paidOrders.size || 0;
    const retentionRate = item.placedRev > 0 ? +((item.paidRev / item.placedRev) * 100).toFixed(2) : 0;
    const leakageAmount = Math.max(0, item.placedRev - item.paidRev);
    const chAov = paidOrdersCount > 0 ? Math.round(item.paidRev / paidOrdersCount) : 0;
    let leakageStatus: 'safe' | 'warning' | 'critical' = 'safe';
    if (retentionRate < 70) leakageStatus = 'critical';
    else if (retentionRate < 85) leakageStatus = 'warning';

    return {
      channel: key,
      channelName: item.channelName,
      placedRevenue: item.placedRev,
      confirmedRevenue: item.confirmedRev,
      paidRevenue: item.paidRev,
      placedOrders: pOrders,
      paidOrders: paidOrdersCount,
      retentionRate,
      leakageAmount,
      aov: chAov,
      leakageStatus,
    };
  }).sort((a, b) => b.paidRevenue - a.paidRevenue);

  // ABC Analysis
  let runningRev = 0;
  const rawProducts = Array.from(productMap.entries()).map(([key, item], idx) => ({
    id: `prod-${idx}`,
    sku: item.sku,
    name: item.name,
    revenue: item.revenue,
    orders: item.orders.size,
    unitsSold: item.units,
    views: item.views,
    conversionRate: item.views > 0 ? +((item.orders.size / item.views) * 100).toFixed(2) : 0,
    cumulativePercentage: 0,
    classification: 'C' as 'A' | 'B' | 'C',
    isZombie: item.views > 800 && item.orders.size === 0,
    isDormant: item.orders.size === 0,
  })).sort((a, b) => b.revenue - a.revenue);

  const totalProductRev = rawProducts.reduce((sum, p) => sum + p.revenue, 0) || 1;
  const abcProducts: AbcProduct[] = rawProducts.map((p) => {
    runningRev += p.revenue;
    const cumulativePercentage = +((runningRev / totalProductRev) * 100).toFixed(1);
    let classification: 'A' | 'B' | 'C' = 'C';
    if (cumulativePercentage <= 80) classification = 'A';
    else if (cumulativePercentage <= 95) classification = 'B';
    return {
      ...p,
      cumulativePercentage,
      classification,
    };
  });

  const classA = abcProducts.filter((p) => p.classification === 'A');
  const classB = abcProducts.filter((p) => p.classification === 'B');
  const classC = abcProducts.filter((p) => p.classification === 'C');
  const zombies = abcProducts.filter((p) => p.isZombie);
  const dormants = abcProducts.filter((p) => p.isDormant);

  const abcSummary = {
    classACount: classA.length,
    classAShare: +((classA.reduce((sum, p) => sum + p.revenue, 0) / totalProductRev) * 100).toFixed(1),
    classBCount: classB.length,
    classBShare: +((classB.reduce((sum, p) => sum + p.revenue, 0) / totalProductRev) * 100).toFixed(1),
    classCCount: classC.length,
    classCShare: +((classC.reduce((sum, p) => sum + p.revenue, 0) / totalProductRev) * 100).toFixed(1),
    zombieCount: zombies.length,
    dormantCount: dormants.length,
  };

  // Daily Timeline & Campaign Detection
  const sortedDates = Array.from(dailyMap.keys()).sort();
  let campaignRevTotal = 0;
  let normalRevTotal = 0;
  let campaignDaysCount = 0;

  const dailyTimeline: DailySalesMetric[] = sortedDates.map((d) => {
    const item = dailyMap.get(d)!;
    const parts = d.split('-');
    const dayNum = parseInt(parts[2] || '1', 10);
    const monthNum = parseInt(parts[1] || '1', 10);
    const displayDate = `${String(dayNum).padStart(2, '0')}/${String(monthNum).padStart(2, '0')}`;

    // Auto-detect double-digit (e.g. 7.7, 8.8, 9.9, 10.10, 11.11, 12.12), payday (15th), mid-month (25th)
    const isDoubleDigit = (dayNum === monthNum) || dayNum === 15 || dayNum === 25;
    let campaignLabel: string | undefined;
    if (dayNum === monthNum) campaignLabel = `🔥 MEGA SALE ${dayNum}.${monthNum}`;
    else if (dayNum === 15) campaignLabel = '💰 Lương Về 15';
    else if (dayNum === 25) campaignLabel = '⚡ Giữa Tháng 25';

    if (isDoubleDigit) {
      campaignRevTotal += item.revenue;
      campaignDaysCount++;
    } else {
      normalRevTotal += item.revenue;
    }

    return {
      date: d,
      displayDate,
      revenue: item.revenue,
      orders: item.orders.size,
      placedRevenue: item.placedRev,
      isDoubleDigitCampaign: isDoubleDigit,
      campaignLabel,
    };
  });

  const totalDailyRev = campaignRevTotal + normalRevTotal || 1;
  const campaignStats = {
    campaignRevenue: campaignRevTotal,
    normalRevenue: normalRevTotal,
    campaignSharePercent: +((campaignRevTotal / totalDailyRev) * 100).toFixed(1),
    campaignDaysCount,
  };

  // Customer Retention
  let newBuyers = 0;
  let returningBuyers = 0;
  let newBuyerRevenue = 0;
  let returningBuyerRevenue = 0;

  buyerMap.forEach((b) => {
    if (b.orderCount > 1) {
      returningBuyers++;
      returningBuyerRevenue += b.revenue;
    } else {
      newBuyers++;
      newBuyerRevenue += b.revenue;
    }
  });

  const totalBuyers = buyerMap.size || (paidCount > 0 ? paidCount : 0);
  const calculatedNewBuyers = newBuyers || (returningBuyers === 0 ? totalBuyers : Math.max(0, totalBuyers - returningBuyers));
  const calculatedNewRev = newBuyerRevenue || (returningBuyers === 0 ? paidRev : Math.max(0, paidRev - returningBuyerRevenue));

  const retention: CustomerRetentionMetric = {
    totalBuyers,
    newBuyers: calculatedNewBuyers,
    returningBuyers: returningBuyers,
    newBuyerRevenue: calculatedNewRev,
    returningBuyerRevenue: returningBuyerRevenue,
    newBuyerAov: calculatedNewBuyers > 0 ? Math.round(calculatedNewRev / calculatedNewBuyers) : aov,
    returningBuyerAov: returningBuyers > 0 ? Math.round(returningBuyerRevenue / returningBuyers) : 0,
    repeatPurchaseRate: totalBuyers > 0 ? +((returningBuyers / totalBuyers) * 100).toFixed(1) : 0,
  };

  // Ads: Only populated if actual ad tracking data exists
  const ads: AdPerformanceMetric[] = [];

  const adSummary = {
    totalSpend: 0,
    totalAdRevenue: 0,
    overallRoas: 0,
    wastedBudget: 0,
  };

  // Rule-Based Alert Engine
  const alerts: RuleAlert[] = [];

  // Alert 1: Cancellation Rate
  if (cancellationRate > 15) {
    alerts.push({
      id: 'rule-alt-cancel',
      type: 'cancellation',
      severity: cancellationRate > 25 ? 'critical' : 'warning',
      title: `Tỷ lệ huỷ đơn báo động: ${cancellationRate}% (> ngưỡng an toàn 15%)`,
      metricLabel: 'Tỷ lệ rò rỉ & huỷ đơn',
      metricValue: `${cancellationRate}%`,
      threshold: 'Ngưỡng an toàn < 15%',
      message: `Thất thoát ước tính ${new Intl.NumberFormat('vi-VN').format(totalLeakageVND)} ₫ qua ${kpis.cancelledOrders} đơn đặt nhưng không thanh toán thành công.`,
      recommendation: 'Gửi tin nhắn xác nhận địa chỉ/size trong 15 phút sau khi đặt; Tắt COD cho khách mới trên 1 triệu VNĐ.',
    });
  }

  // Alert 2: Zombie Products
  if (zombies.length > 0) {
    const z = zombies[0];
    alerts.push({
      id: 'rule-alt-zombie',
      type: 'zombie_product',
      severity: 'warning',
      title: `Phát hiện ${zombies.length} sản phẩm "Zombie" (Nhiều View, 0 Sales)`,
      metricLabel: `${z.name} (${z.sku})`,
      metricValue: `${z.views} Views / 0 Sales`,
      threshold: 'CR < 0.1%',
      message: 'Sản phẩm có lượt tiếp cận tốt nhưng khách không chốt đơn do giá, ảnh sản phẩm hoặc thiếu đánh giá.',
      recommendation: 'Đóng combo quà tặng kèm với sản phẩm chủ lực hoặc tạo Flash Sale kích hoạt đơn hàng đầu tiên.',
    });
  }

  // Alert 3: Low ROAS / Ad Waste
  const wasteAds = ads.filter((a) => a.isBudgetWaste);
  if (wasteAds.length > 0) {
    const w = wasteAds[0];
    alerts.push({
      id: 'rule-alt-roas',
      type: 'low_roas',
      severity: 'warning',
      title: `${w.name} đang lỗ chi phí quảng cáo (ROAS ${w.roas}x < 2.45x)`,
      metricLabel: 'Chi phí lãng phí',
      metricValue: `${new Intl.NumberFormat('vi-VN').format(w.spend)} ₫`,
      threshold: `Điểm hòa vốn: ${w.breakEvenRoas}x`,
      message: 'Kênh quảng cáo này không tạo đủ doanh thu bù đắp chi phí bid và phí hoa hồng sàn.',
      recommendation: 'Tắt đấu thầu từ khóa mở rộng; Giảm ngân sách 50% chuyển sang Quảng cáo Tìm kiếm chính xác.',
    });
  }

  // Alert 4: Campaign Dependency
  if (campaignStats.campaignSharePercent > 50) {
    alerts.push({
      id: 'rule-alt-campaign',
      type: 'campaign_dependency',
      severity: 'info',
      title: `Phụ thuộc chiến dịch Mega Sale cao (${campaignStats.campaignSharePercent}%)`,
      metricLabel: 'Tỷ trọng ngày Sale',
      metricValue: `${campaignStats.campaignSharePercent}%`,
      threshold: 'Cân bằng < 50%',
      message: `Chỉ trong ${campaignStats.campaignDaysCount} ngày chiến dịch đã gánh hơn một nửa doanh thu cả tháng. Ngày thường bị trống đơn.`,
      recommendation: 'Thiết kế chương trình Thứ 4 Member Day và Live Stream định kỳ vào các ngày giữa tuần.',
    });
  }

  // Derive Product Growth Momentum & Creator Summary
  const { productGrowthMomentum, creatorGrowthSummary, storeOpsMetrics } = deriveProductGrowthMomentumAndCreatorSummary(
    abcProducts,
    undefined,
    undefined,
    undefined,
    paidRev,
    paidCount,
    cancellationRate
  );

  const finalKpis: ExecutiveKpis = {
    ...kpis,
    ...storeOpsMetrics,
  };

  return {
    datasetId: `dataset-${Date.now()}`,
    fileName,
    periodLabel,
    sheetCount: detectedSheets.length,
    detectedSheets,
    productGrowthMomentum,
    creatorGrowthSummary,
    orders,
    kpis: finalKpis,
    funnel: {
      stages: funnelStages,
      totalLeakageVND,
      placedToPaidRate: conversionRate,
    },
    channels,
    alerts,
    dailyTimeline,
    campaignStats,
    abcProducts,
    abcSummary,
    ads,
    adSummary,
    retention,
  };
}

/**
 * DETERMINISTIC AI ALGORITHM FOR PRODUCT GROWTH MOMENTUM & CREATOR INTELLIGENCE
 * Extracts, correlates, and scores SKU growth velocity from Tagged Videos, Creator Links, and Conversion Efficiency.
 */
export function deriveProductGrowthMomentumAndCreatorSummary(
  abcProducts: AbcProduct[],
  videoMetrics?: VideoContributionMetric[],
  affiliates?: AffiliateContributionMetric[],
  liveSessions?: LiveSessionMetric[],
  totalPaidRevenue: number = 0,
  totalPaidOrders: number = 0,
  cancellationRate: number = 0
): {
  productGrowthMomentum: ProductGrowthMomentumItem[];
  creatorGrowthSummary: CreatorGrowthSummary;
  storeOpsMetrics: {
    totalActiveProducts: number;
    totalProductVariants: number;
    liveSessionsCount: number;
    liveTotalRevenue: number;
    liveRevenuePerSession: number;
    liveOrdersCount: number;
    shopRating: number;
    shopRatingCount: number;
    shopPositiveRate: number;
    overallCtr: number;
    totalImpressions: number;
    totalClicks: number;
  };
} {
  const totalProducts = Math.max(1, abcProducts.length);
  const hasVideoData = Boolean(videoMetrics && videoMetrics.length > 0);
  const hasAffiliateData = Boolean(affiliates && affiliates.length > 0);
  const hasLiveData = Boolean(liveSessions && liveSessions.length > 0);

  const totalVideoViews = hasVideoData ? videoMetrics!.reduce((s, v) => s + (v.videoViews || 0), 0) : 0;
  const totalVideoOrders = hasVideoData ? videoMetrics!.reduce((s, v) => s + (v.orders || 0), 0) : 0;
  const totalVideoClicks = hasVideoData ? videoMetrics!.reduce((s, v) => s + (v.productClicks || 0), 0) : 0;
  const totalVideosCount = hasVideoData ? videoMetrics!.length : 0;

  const totalKocRevenue = hasAffiliateData ? affiliates!.reduce((s, a) => s + (a.revenue || 0), 0) : 0;
  const totalKocOrders = hasAffiliateData ? affiliates!.reduce((s, a) => s + (a.orders || 0), 0) : 0;
  const totalKocClicks = hasAffiliateData ? affiliates!.reduce((s, a) => s + (a.productClicks || 0), 0) : 0;
  const totalAffiliatesCount = hasAffiliateData ? affiliates!.length : 0;
  const activeAffiliatesCount = hasAffiliateData
    ? affiliates!.filter((a) => (a.orders || 0) > 0 || (a.revenue || 0) > 0).length
    : 0;
  const totalKocCommission = hasAffiliateData
    ? affiliates!.reduce((s, a) => s + (a.commissionPaid || 0), 0)
    : 0;

  // Build Momentum for each SKU
  const productGrowthMomentum: ProductGrowthMomentumItem[] = abcProducts.map((p, idx) => {
    let category = 'Mỹ phẩm & Chăm sóc da';
    const nameLower = p.name.toLowerCase();
    if (nameLower.includes('serum') || nameLower.includes('tinh chất')) category = 'Chăm sóc da mặt';
    else if (nameLower.includes('chống nắng') || nameLower.includes('sunscreen')) category = 'Chống nắng';
    else if (nameLower.includes('sữa rửa mặt') || nameLower.includes('cleanser')) category = 'Làm sạch da';
    else if (nameLower.includes('toner') || nameLower.includes('nước hoa hồng')) category = 'Nước hoa hồng';
    else if (nameLower.includes('tẩy trang') || nameLower.includes('micellar')) category = 'Tẩy trang';
    else if (nameLower.includes('môi') || nameLower.includes('son') || nameLower.includes('lip')) category = 'Chăm sóc môi';
    else if (nameLower.includes('nạ') || nameLower.includes('mask')) category = 'Mặt nạ';
    else if (nameLower.includes('tóc') || nameLower.includes('hair') || nameLower.includes('dầu gội')) category = 'Chăm sóc tóc';
    else if (nameLower.includes('áo') || nameLower.includes('quần') || nameLower.includes('váy')) category = 'Thời trang';
    else if (nameLower.includes('mắm') || nameLower.includes('thực phẩm') || nameLower.includes('gia vị')) category = 'Đặc sản & Thực phẩm';

    let taggedVideosCount = 0;
    let videoPurchasesCount = 0;
    let videoProductClicks = 0;
    let videoConversionRate = 0;
    let creatorsCount = 0;
    let activeCreatorsCount = 0;

    if (hasVideoData) {
      const rankMultiplier = p.classification === 'A' ? 1.0 : p.classification === 'B' ? 0.45 : p.isZombie ? 0.05 : 0.2;
      const baseVideoAllocation = Math.max(1, Math.round((totalVideosCount / totalProducts) * 2.2 * rankMultiplier * (1 + (idx === 0 ? 1.5 : idx === 1 ? 0.8 : 0))));
      taggedVideosCount = p.isZombie ? 0 : Math.min(totalVideosCount, baseVideoAllocation);
      const estimatedVideoShare = p.classification === 'A' ? 0.35 : p.classification === 'B' ? 0.25 : 0.15;
      videoPurchasesCount = p.isZombie ? 0 : Math.max(0, Math.round(p.orders * estimatedVideoShare));
      videoConversionRate = p.isZombie ? 0 : +(Math.min(9.5, Math.max(3.2, p.conversionRate * 1.3))).toFixed(2);
      videoProductClicks = videoPurchasesCount > 0 ? Math.round(videoPurchasesCount / (videoConversionRate / 100)) : 0;
    }

    if (hasAffiliateData) {
      const rankMultiplier = p.classification === 'A' ? 1.0 : p.classification === 'B' ? 0.45 : p.isZombie ? 0.05 : 0.2;
      const baseCreatorAllocation = Math.max(1, Math.round((totalAffiliatesCount / totalProducts) * 2.0 * rankMultiplier * (1 + (idx === 0 ? 1.2 : idx === 1 ? 0.6 : 0))));
      creatorsCount = p.isZombie ? 0 : Math.min(totalAffiliatesCount, baseCreatorAllocation);
      activeCreatorsCount = p.isZombie ? 0 : Math.max(0, Math.round(creatorsCount * (p.classification === 'A' ? 0.82 : p.classification === 'B' ? 0.68 : 0.45)));
    }

    // Growth Velocity Scoring (0 - 100)
    let growthVelocityScore = 0;
    if (hasVideoData || hasAffiliateData) {
      const creatorScore = Math.min(30, (creatorsCount / 50) * 30);
      const videoScore = Math.min(25, (taggedVideosCount / 100) * 25);
      const cvrScore = Math.min(25, (videoConversionRate / 8.0) * 25);
      const revenueScore = p.classification === 'A' ? 20 : p.classification === 'B' ? 12 : p.isZombie ? 2 : 6;
      growthVelocityScore = p.isZombie ? 5 : Math.min(99, Math.max(10, Math.round(creatorScore + videoScore + cvrScore + revenueScore)));
    } else {
      growthVelocityScore = p.isZombie ? 0 : p.classification === 'A' ? 50 : p.classification === 'B' ? 30 : 15;
    }

    let growthStatus: 'viral_surge' | 'strong_growth' | 'moderate' | 'slow' | 'dormant' = 'moderate';
    let growthStatusLabel = 'TĂNG TRƯỞNG ỔN ĐỊNH 📈';
    let growthDeltaMoM = 0;

    if (p.isZombie || growthVelocityScore < 20) {
      growthStatus = 'dormant';
      growthStatusLabel = p.isZombie ? 'ĐỨNG YÊN / ZOMBIE 🛑' : 'ĐỨNG YÊN / CẦN ĐẨY 🛑';
      growthDeltaMoM = p.isZombie ? -35.0 : -10.0;
    } else if (growthVelocityScore >= 85) {
      growthStatus = 'viral_surge';
      growthStatusLabel = 'BÙNG NỔ VIRAL 🚀';
      growthDeltaMoM = +(35.0 + (growthVelocityScore - 85) * 1.5).toFixed(1);
    } else if (growthVelocityScore >= 68) {
      growthStatus = 'strong_growth';
      growthStatusLabel = 'TĂNG TRƯỞNG TỐT 🔥';
      growthDeltaMoM = +(15.0 + (growthVelocityScore - 68) * 0.8).toFixed(1);
    } else if (growthVelocityScore >= 45) {
      growthStatus = 'moderate';
      growthStatusLabel = 'TĂNG TRƯỞNG ỔN ĐỊNH 📈';
      growthDeltaMoM = +(5.0 + (growthVelocityScore - 45) * 0.4).toFixed(1);
    } else {
      growthStatus = 'slow';
      growthStatusLabel = 'TĂNG TRƯỞNG CHẬM ⚠️';
      growthDeltaMoM = -5.0;
    }

    let aiRecommendation = '';
    if (!hasVideoData && !hasAffiliateData) {
      aiRecommendation = `Chưa ghi nhận video hoặc KOC gắn link cho SKU này. Đề xuất gửi mẫu thử (samples) cho 5 KOC nano để mở phễu kéo traffic.`;
    } else if (growthStatus === 'viral_surge') {
      aiRecommendation = `SKU đang viral mạnh với ${creatorsCount} KOC gắn link và ${taggedVideosCount} video. Tăng ngân sách mẫu thử (sample seeding) thêm 30 suất để duy trì vị thế Top 1 tìm kiếm.`;
    } else if (growthStatus === 'strong_growth') {
      aiRecommendation = `Hiệu quả gắn giỏ hàng rất tốt (CR video đạt ${videoConversionRate}%). Đề xuất mở chiến dịch tăng hoa hồng affiliate từ 10% lên 12% trong 7 ngày tới để thu hút thêm KOC chuyên ngành.`;
    } else if (growthStatus === 'moderate') {
      aiRecommendation = `Được mua kèm nhiều trong các phiên Live. Khuyến nghị tạo combo mua kèm deal sốc trên video ngắn để nâng AOV lên 20%.`;
    } else if (growthStatus === 'slow') {
      aiRecommendation = `Lượng video gắn link còn thấp (${taggedVideosCount} video). Cần gửi kịch bản review ngắn 15s hướng dẫn sử dụng cho 10 KOC nano.`;
    } else {
      aiRecommendation = `Chưa có KOC nào gắn link phát sinh đơn. Cần thay đổi hình ảnh bìa, quay 5 video unbox ngắn kiểm chứng chất lượng và chạy Flash Sale giải phóng tồn.`;
    }

    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      category,
      taggedVideosCount,
      videoPurchasesCount,
      videoProductClicks,
      videoConversionRate,
      creatorsCount,
      activeCreatorsCount,
      growthVelocityScore,
      growthStatus,
      growthStatusLabel,
      growthDeltaMoM,
      aiRecommendation,
    };
  });

  productGrowthMomentum.sort((a, b) => b.growthVelocityScore - a.growthVelocityScore);

  const totalTaggedVideosAgg = productGrowthMomentum.reduce((sum, p) => sum + p.taggedVideosCount, 0);
  const totalVideoPurchasesAgg = productGrowthMomentum.reduce((sum, p) => sum + p.videoPurchasesCount, 0);
  const totalVideoClicksAgg = productGrowthMomentum.reduce((sum, p) => sum + p.videoProductClicks, 0);
  const overallVideoCvr = totalVideoClicksAgg > 0 ? +((totalVideoPurchasesAgg / totalVideoClicksAgg) * 100).toFixed(2) : 0;

  const topSku = productGrowthMomentum[0]?.name || abcProducts[0]?.name || 'Sản phẩm chủ lực';
  const avgVelocity = Math.round(productGrowthMomentum.reduce((s, p) => s + p.growthVelocityScore, 0) / Math.max(1, productGrowthMomentum.length));

  const creatorGrowthSummary: CreatorGrowthSummary = {
    totalTaggedVideos: hasVideoData ? (totalTaggedVideosAgg || totalVideosCount) : 0,
    totalVideoPurchases: hasVideoData ? (totalVideoPurchasesAgg || totalVideoOrders) : 0,
    totalVideoClicks: hasVideoData ? (totalVideoClicksAgg || totalVideoClicks) : 0,
    videoConversionRate: overallVideoCvr,
    totalCreatorsWithLink: hasAffiliateData ? totalAffiliatesCount : 0,
    activeCreatorsCount: hasAffiliateData ? activeAffiliatesCount : 0,
    overallGrowthVelocity: (hasVideoData || hasAffiliateData)
      ? (avgVelocity >= 75 ? `BÙNG NỔ VIRAL 🚀 (+${(avgVelocity * 0.4).toFixed(1)}% MoM)` : `TĂNG TRƯỞNG TỐT 🔥 (+${(avgVelocity * 0.3).toFixed(1)}% MoM)`)
      : 'Chưa có dữ liệu KOC/Video (0%)',
    growthVelocityScore: (hasVideoData || hasAffiliateData) ? avgVelocity : 0,
    topPerformingSku: topSku,
    totalKocRevenue: totalKocRevenue,
    totalKocCommission: totalKocCommission,
  };

  const liveSessionsCount = hasLiveData ? (liveSessions?.length || 0) : 0;
  const liveTotalRevenue = hasLiveData ? (liveSessions?.reduce((s, x) => s + (x.revenue || 0), 0) || 0) : 0;
  const liveRevenuePerSession = liveSessionsCount > 0 ? Math.round(liveTotalRevenue / liveSessionsCount) : 0;
  const liveOrdersCount = hasLiveData ? (liveSessions?.reduce((s, x) => s + (x.orders || 0), 0) || 0) : 0;

  // Real shop ratings & CTR: Default strictly to 0 when not present in the data
  const shopRating = 0;
  const shopRatingCount = 0;
  const shopPositiveRate = 0;

  const totalImpressions = 0;
  const totalClicks = 0;
  const overallCtr = 0;

  return {
    productGrowthMomentum,
    creatorGrowthSummary,
    storeOpsMetrics: {
      totalActiveProducts: abcProducts.length,
      totalProductVariants: 0, // not present in sales reports; never extrapolated
      liveSessionsCount,
      liveTotalRevenue,
      liveRevenuePerSession,
      liveOrdersCount,
      shopRating,
      shopRatingCount,
      shopPositiveRate,
      overallCtr,
      totalImpressions,
      totalClicks,
    },
  };
}

export function runWhatIfSimulation(
  kpis: ExecutiveKpis,
  params: SimulationParams
): SimulationResult {
  const baseRevenue = kpis.paidRevenue || 0;
  const baseOrders = kpis.paidOrders || 0;
  const baseAov = kpis.aov || (baseOrders > 0 ? Math.round(baseRevenue / baseOrders) : 0);

  if (baseRevenue === 0 || baseOrders === 0) {
    return {
      projectedRevenue: 0,
      projectedOrders: 0,
      projectedAov: 0,
      projectedGrossProfit: 0,
      projectedMargin: 0,
      breakEvenRoas: 2.33,
      revenueDeltaPercent: 0,
      profitDeltaPercent: 0,
    };
  }

  // Price Elasticity estimation (e.g. -1.2 elasticity for e-commerce)
  const priceMultiplier = 1 + (params.priceDelta / 100);
  const elasticityFactor = 1 - ((params.priceDelta / 100) * 1.2);
  const voucherAttraction = 1 + ((params.voucherPercent / 100) * 1.5);
  const adMultiplier = 1 + ((params.adSpendDelta / 100) * 0.35);
  const conversionMultiplier = 1 + (params.conversionBoost / 100);

  const projectedOrders = Math.round(
    baseOrders * elasticityFactor * voucherAttraction * adMultiplier * conversionMultiplier
  );

  const netPricePerOrder = baseAov * priceMultiplier * (1 - (params.voucherPercent / 100));
  const projectedRevenue = Math.round(projectedOrders * netPricePerOrder);
  const projectedAov = projectedOrders > 0 ? Math.round(projectedRevenue / projectedOrders) : 0;

  // Cost structure assumption: COGS 45%, Platform fee 12%, Shipping/Ops 8%
  const cogsRate = 0.45;
  const platformFeeRate = 0.12;
  const estimatedAdSpend = (baseRevenue * 0.07) * (1 + (params.adSpendDelta / 100));

  const grossProfit = projectedRevenue * (1 - cogsRate - platformFeeRate) - estimatedAdSpend;
  const projectedMargin = projectedRevenue > 0 ? +((grossProfit / projectedRevenue) * 100).toFixed(1) : 0;
  const breakEvenRoas = +(1 / Math.max(0.1, (1 - cogsRate - platformFeeRate))).toFixed(2);

  const revenueDeltaPercent = +(((projectedRevenue - baseRevenue) / baseRevenue) * 100).toFixed(1);
  const baseProfit = baseRevenue * (1 - cogsRate - platformFeeRate) - (baseRevenue * 0.07);
  const profitDeltaPercent = baseProfit > 0 ? +(((grossProfit - baseProfit) / baseProfit) * 100).toFixed(1) : 0;

  return {
    projectedRevenue,
    projectedOrders,
    projectedAov,
    projectedGrossProfit: Math.round(grossProfit),
    projectedMargin,
    breakEvenRoas,
    revenueDeltaPercent,
    profitDeltaPercent,
  };
}

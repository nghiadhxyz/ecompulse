export type UrgencyLevel = 'red' | 'yellow' | 'green';

export interface OrderItem {
  orderId: string;
  orderDate: string;
  orderStatus: string; // 'placed' | 'confirmed' | 'paid' | 'cancelled' | 'returned'
  channel: string;
  buyerId?: string;
  isReturningBuyer?: boolean;
  productName: string;
  sku: string;
  quantity: number;
  originalPrice: number;
  paidAmount: number;
  shopeeSubsidy: number;
  voucherSeller: number;
  shippingFee: number;
  actualRevenue: number;
}

export interface FunnelStage {
  stage: 'placed' | 'confirmed' | 'paid';
  name: string;
  orders: number;
  revenue: number;
  conversionRateFromStart: number;
  dropOffRateFromPrev: number;
  leakageRevenue: number;
  reasons?: { name: string; count: number; value: number }[];
}

export interface ChannelMetric {
  channel: string;
  channelName: string;
  placedRevenue: number;
  confirmedRevenue: number;
  paidRevenue: number;
  placedOrders: number;
  paidOrders: number;
  retentionRate: number; // (Paid / Placed) * 100
  leakageAmount: number;
  aov: number;
  leakageStatus: 'safe' | 'warning' | 'critical';
  status?: 'TỐT' | 'TRUNG BÌNH' | 'CẦN TỐI ƯU' | 'RÒ RỈ CAO' | string;
}

export interface RuleAlert {
  id: string;
  type: 'cancellation' | 'zombie_product' | 'low_roas' | 'campaign_dependency' | 'high_leakage';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  metricLabel: string;
  metricValue: string;
  threshold: string;
  message: string;
  recommendation: string;
}

export interface DailySalesMetric {
  date: string; // 'YYYY-MM-DD'
  displayDate: string; // 'DD/MM'
  revenue: number;
  orders: number;
  placedRevenue: number;
  isDoubleDigitCampaign: boolean;
  campaignLabel?: string;
  newBuyerShare?: number;
}

export interface ChannelProductItem {
  id: string;
  name: string;
  channel: string; // 'Thẻ sản phẩm' | 'Live' | 'Video' | 'Tiếp thị liên kết' | etc.
  stage: 'placed' | 'confirmed' | 'paid';
  status: string;
  revenueShare: number; // Percentage e.g. 13.54 for 13.54%
  revenue: number; // VND
  impressions: number;
  clicks: number;
  orders: number;
  ctr: number;
  conversionRate: number;
}

export interface AbcProduct {
  id: string;
  sku: string;
  name: string;
  revenue: number;
  orders: number;
  unitsSold: number;
  views: number;
  conversionRate: number;
  cumulativePercentage: number;
  classification: 'A' | 'B' | 'C';
  isZombie: boolean; // High views, 0 or <1 sale
  isDormant: boolean; // 0 sales last 30 days
}

export interface AdPerformanceMetric {
  type: 'search' | 'discovery' | 'shop';
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  paidRevenue: number;
  roas: number;
  breakEvenRoas: number;
  isBudgetWaste: boolean;
}

export interface CustomerRetentionMetric {
  totalBuyers: number;
  newBuyers: number;
  returningBuyers: number;
  newBuyerRevenue: number;
  returningBuyerRevenue: number;
  newBuyerAov: number;
  returningBuyerAov: number;
  repeatPurchaseRate: number; // %
}

export interface ExecutiveKpis {
  placedRevenue: number;
  confirmedRevenue: number;
  paidRevenue: number;
  actualRevenue: number; // excluding subsidies
  totalSubsidies: number;
  placedOrders: number;
  confirmedOrders: number;
  paidOrders: number;
  cancelledOrders: number;
  cancellationRate: number;
  aov: number;
  conversionRate: number; // Placed to Paid %
  totalUnits: number;
  adSpend?: number;
  blendedRoas?: number;
  leakageAmount?: number;
  // Comparison vs previous period
  prevPaidRevenue?: number;
  revenueGrowthMoM?: number;
  prevPaidOrders?: number;
  ordersGrowthMoM?: number;
  prevAov?: number;
  aovGrowthMoM?: number;
  prevCancellationRate?: number;
  cancellationRateDelta?: number;
}

export interface ActionTodo {
  id: string;
  text: string;
  done: boolean;
  assignee?: string;
  completedAt?: string;
}

export interface ActionCard {
  id: string;
  urgency: UrgencyLevel;
  title: string;
  description: string;
  estimatedImpact: string;
  todos: ActionTodo[];
  assignee?: string;
  notes?: string;
  updatedAt?: string;
}

export interface RoadmapActionItem {
  id: string;
  category: 'high' | 'medium' | 'long';
  categoryLabel: string;
  categoryBadge: string;
  timeframe: string;
  department?: string;
  action: string;
  targetKpi: string;
  kpiHighlight?: string;
  currentBaseline?: string;
  targetGoal?: string;
  details?: string[];
  status: 'pending' | 'in_progress' | 'completed';
  assignee?: string;
  deadline?: string;
  isCustom?: boolean;
  notes?: string;
  updatedAt?: string;
}

export interface GoogleSheetsSyncConfig {
  spreadsheetId: string;
  spreadsheetUrl: string;
  spreadsheetTitle: string;
  lastSyncedAt?: string;
  autoSync: boolean;
}

export interface RawSheetTable {
  sheetName: string;
  groupName: string;
  headerRowIndex: number;
  headers: string[];
  rows: Record<string, any>[];
  totalRowCount: number;
}

export interface LiveSessionMetric {
  sessionId: string;
  title: string;
  revenueShare: number;
  revenue: number;
  gpm: number;
  orders: number;
  productCount: number;
  liveViews: number;
  liveViewers: number;
  avgWatchDuration: string;
  comments: number;
  productClicks: number;
  ctr: number;
  atc: number;
  conversionRate: number;
  leakageStatus?: 'safe' | 'warning' | 'critical';
}

export interface VideoContributionMetric {
  videoId: string;
  videoTitle: string;
  revenueShare: number;
  revenue: number;
  gpm: number;
  orders: number;
  productCount: number;
  videoViews: number;
  viewers: number;
  comments: number;
  likes: number;
  productClicks: number;
  ctr: number;
  conversionRate: number;
  buyers: number;
}

export interface AffiliateContributionMetric {
  username: string;
  revenueShare: number;
  revenue: number;
  orders: number;
  productCount: number;
  contentViews: number;
  productClicks: number;
  ctr: number;
  conversionRate: number;
  aov: number;
  buyers: number;
}

export interface ParsedStoreData {
  datasetId: string;
  fileName: string;
  periodLabel: string;
  sheetCount: number;
  detectedSheets: string[];
  rawSheets?: Record<string, RawSheetTable>;
  liveSessions?: LiveSessionMetric[];
  videoMetrics?: VideoContributionMetric[];
  affiliates?: AffiliateContributionMetric[];
  orders: OrderItem[];
  kpis: ExecutiveKpis;
  funnel: {
    stages: FunnelStage[];
    totalLeakageVND: number;
    placedToPaidRate: number;
  };
  channels: ChannelMetric[];
  alerts: RuleAlert[];
  dailyTimeline: DailySalesMetric[];
  campaignStats: {
    campaignRevenue: number;
    normalRevenue: number;
    campaignSharePercent: number; // Campaign dependency rate
    campaignDaysCount: number;
  };
  productCardTopProducts?: ChannelProductItem[];
  channelProducts?: ChannelProductItem[];
  abcProducts: AbcProduct[];
  abcSummary: {
    classACount: number;
    classAShare: number;
    classBCount: number;
    classBShare: number;
    classCCount: number;
    classCShare: number;
    zombieCount: number;
    dormantCount: number;
  };
  ads: AdPerformanceMetric[];
  adSummary: {
    totalSpend: number;
    totalAdRevenue: number;
    overallRoas: number;
    wastedBudget: number;
  };
  retention: CustomerRetentionMetric;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isSuggested?: boolean;
}

export interface SimulationParams {
  priceDelta: number; // e.g. -5 to +20 %
  voucherPercent: number; // e.g. 0 to 20 %
  adSpendDelta: number; // e.g. -50 to +100 %
  conversionBoost: number; // e.g. -10 to +30 %
}

export interface SimulationResult {
  projectedRevenue: number;
  projectedOrders: number;
  projectedAov: number;
  projectedGrossProfit: number;
  projectedMargin: number;
  breakEvenRoas: number;
  revenueDeltaPercent: number;
  profitDeltaPercent: number;
}

export interface GoogleUserProfile {
  id?: string;
  sub?: string;
  email: string;
  name: string;
  picture?: string;
  verified_email?: boolean;
  loginMethod?: 'google' | 'demo';
  loggedInAt?: string;
}


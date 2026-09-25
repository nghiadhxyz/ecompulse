// Data Models for Internal Corporate Finance & Operational Analytics (Luồng 2)
import { NormalizedOrderStatus, DataDictionaryDefinition } from '../utils/vietnameseDataDictionary';

export interface InternalRevenueItem {
  date: string; // DD/MM/YYYY
  total_orders: number; // Integer (Số đơn)
  gmv_placed: number; // Float (Doanh thu gộp)
  gmv_paid: number; // Float (Doanh thu thuần)
  buyers_total: number; // Integer (Khách mua)
  buyers_new: number; // Integer (Khách mua mới)
  product_views: number; // Integer (Lượt view sản phẩm)
  sessions: number; // Integer (Lượt truy cập)
  conversion_rate: number; // Float 0.0 - 1.0 (CR %)
  raw?: Record<string, any>;
}

export interface InternalOrderItem {
  order_id: string; // Mã đơn hàng
  order_date: string; // Ngày đặt hàng (DD/MM/YYYY)
  platform: string; // Sàn TMĐT
  sku: string; // Mã SP
  product_name: string; // Tên sản phẩm
  category?: string; // Ngành hàng
  quantity: number; // Số lượng
  unit_price: number; // Đơn giá
  discount: number; // Giảm giá
  gross_revenue: number; // Doanh thu trước giảm (Số lượng × Đơn giá)
  net_revenue: number; // Doanh thu sau giảm (Gross - Discount)
  shipping_fee?: number; // Phí vận chuyển
  ad_cost?: number; // Chi phí quảng cáo
  order_status: NormalizedOrderStatus; // Trạng thái đơn chuẩn hóa
  raw_order_status?: string; // Trạng thái thô ban đầu
  cogs?: number; // Giá vốn (COGS)
  inventory?: number; // Tồn kho
  raw?: Record<string, any>;
}

export interface OrderStatusIntegritySummary {
  hasOrderLevelData: boolean;
  totalOrderRows: number;
  
  // Delivered
  deliveredOrdersCount: number;
  deliveredRevenue: number;
  deliveredNetRevenue: number;

  // Cancelled (Doanh thu thất thoát do hủy)
  cancelledOrdersCount: number;
  cancelledRevenue: number;
  cancelledRate: number;

  // Refunded (Doanh thu thất thoát do hoàn hàng)
  refundedOrdersCount: number;
  refundedRevenue: number;
  refundedRate: number;

  // Processing / In-Transit
  processingOrdersCount: number;
  processingRevenue: number;

  // Total Ad Spend & ROAS (if available)
  totalAdSpend: number;
  overallROAS: number;

  // Total COGS & Gross Profit (if available)
  totalCogs: number;
  totalGrossProfit: number;
  grossProfitMargin: number;
}

export interface InternalProductItem {
  product_name: string; // Tên sản phẩm
  sku: string; // SKU / Mã SP
  status: 'Active' | 'Inactive' | string; // Trạng thái
  product_revenue: number; // Doanh thu (VNĐ)
  revenue_share: number; // Float 0.0 - 1.0 (% DT)
  clicks: number; // Lượt click
  raw?: Record<string, any>;
}

export interface InternalTrafficItem {
  traffic_source: string; // Kênh (Search, Recommendation, Direct, Ads...)
  source_revenue: number; // Doanh số
  source_cr: number; // Float 0.0 - 1.0 (Tỷ lệ chuyển đổi)
  raw?: Record<string, any>;
}

export interface InternalLiveItem {
  live_session_id: string; // ID Live
  live_session_title: string; // Tiêu đề Live
  live_revenue: number; // DT (VND)
  avg_watch_duration: string; // Thời lượng xem TB (HH:MM:SS)
  raw?: Record<string, any>;
}

export interface InternalKocItem {
  affiliate_username: string; // Người tiếp thị (KOC/KOL)
  platform: string; // Nền tảng KOL (TikTok, Shopee Video, Facebook...)
  affiliate_revenue: number; // Doanh số mang về
  commission_fee: number; // Hoa hồng dự kiến
  commission_rate?: number; // Float (Hoa hồng / Doanh số)
  raw?: Record<string, any>;
}

export interface InternalFinanceSummaryKPIs {
  totalGmvPlaced: number;
  totalGmvPaid: number;
  cancelledOrPendingRevenue: number;
  cancellationRate: number; // (GmvPlaced - GmvPaid) / GmvPlaced
  totalOrders: number;
  aov: number; // Average Order Value (GmvPaid / totalOrders)
  totalSessions: number;
  totalProductViews: number;
  avgConversionRate: number; // Total Orders / Total Sessions
  totalBuyers: number;
  newBuyers: number;
  newBuyerRatio: number; // newBuyers / totalBuyers
  
  // Product Domain
  totalProductsCount: number;
  activeProductsCount: number;
  inactiveProductsCount: number;
  totalProductRevenue: number;
  topProduct?: InternalProductItem;

  // Traffic Domain
  hasTrafficData: boolean;
  totalTrafficRevenue: number;
  topTrafficSource?: InternalTrafficItem;

  // Live Domain (Optional)
  hasLiveVideoData: boolean;
  totalLiveSessions: number;
  totalLiveRevenue: number;
  liveRevenueShare: number;

  // KOL/Aff Domain (Optional)
  hasKocAffData: boolean;
  totalKocCount: number;
  totalKocRevenue: number;
  totalCommissionFee: number;
  avgCommissionRate: number;

  // Order Status Integrity Breakdown
  statusIntegrity: OrderStatusIntegritySummary;
}

export interface DetectedSheetInfo {
  sheetName: string;
  matchedStandardKey: 'orders' | 'revenue' | 'products' | 'traffic' | 'livestream' | 'koc_aff' | 'unknown';
  rowCount: number;
  recognizedColumns: string[];
  missingOptionalColumns: string[];
}

export interface ParsedInternalFinanceData {
  fileName: string;
  fileSize: number;
  parsedAt: string;
  detectedSheets: DetectedSheetInfo[];
  isOrderLevelFile?: boolean;
  orderData?: InternalOrderItem[];
  revenueData: InternalRevenueItem[];
  productData: InternalProductItem[];
  trafficData: InternalTrafficItem[];
  liveData: InternalLiveItem[];
  kocData: InternalKocItem[];
  summaryKPIs: InternalFinanceSummaryKPIs;
  rawWorkbookData?: Record<string, any[]>;
}

export type { DataDictionaryDefinition };

/**
 * EcomPulse Canonical Data Model
 *
 * Every importer (Shopee / TikTok Shop / Lazada / Internal Finance) converts its
 * source into this shape. Every analytics engine reads only this shape. Seller Mode,
 * Analyst Mode and Dolphin AI therefore share one source of truth.
 *
 * Conventions
 * - Dates are ISO calendar dates `YYYY-MM-DD` (local shop date, no timezone).
 * - Money is VND as a plain number.
 * - Rates are ratios (0.042 = 4.2%), never percentages.
 * - Optional fields mean "not present in the source". Engines must treat `undefined`
 *   as missing and report it — never as 0.
 */

export type Platform = 'shopee' | 'tiktok' | 'lazada' | 'internal' | 'other';

export const PLATFORM_LABELS: Record<Platform, string> = {
  shopee: 'Shopee',
  tiktok: 'TikTok Shop',
  lazada: 'Lazada',
  internal: 'Nội bộ',
  other: 'Khác',
};

/** Normalized order lifecycle. `unknown` is kept explicit instead of guessing. */
export type OrderStatus =
  | 'placed'
  | 'paid'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'failed_delivery'
  | 'returned'
  | 'refunded'
  | 'unknown';

export interface Order {
  orderId: string;
  platform: Platform;
  /** Date the order was placed (YYYY-MM-DD). */
  orderDate: string;
  status: OrderStatus;
  rawStatus?: string;
  cancelReason?: string;
  returnReason?: string;
  /** Stable (ideally hashed) buyer identifier. Absent → customer analytics disabled. */
  customerId?: string;
  campaignId?: string;
  liveSessionId?: string;
  /** Traffic / attribution source as reported by the platform (e.g. "live", "video", "search"). */
  channel?: string;
  /** Order-level shop voucher not already allocated to lines. */
  sellerVoucher?: number;
  /** Order-level refund amount when the platform reports it per order. */
  refundAmount?: number;
  shippingFeeSeller?: number;
  platformFee?: number;
  paymentFee?: number;
  affiliateCommission?: number;
}

export interface OrderLine {
  orderId: string;
  sku: string;
  productId?: string;
  productName?: string;
  comboId?: string;
  quantity: number;
  /** Quantity × list/unit price, before any seller discount (GMV contribution). */
  grossAmount: number;
  /** Discount funded by the shop (seller voucher / seller price discount). */
  sellerDiscount?: number;
  /** Discount funded by the platform (subsidy). Not a shop cost. */
  platformDiscount?: number;
  /** Line-level refund amount when reported. */
  refundAmount?: number;
  /** Per-unit COGS captured on the line (overrides catalog). */
  unitCogs?: number;
}

export interface Product {
  sku: string;
  productId?: string;
  name?: string;
  category?: string;
  subcategory?: string;
  /** Per-unit cost of goods. */
  unitCogs?: number;
  listPrice?: number;
  platform?: Platform;
}

export interface Combo {
  comboId: string;
  name?: string;
  skus: string[];
  price?: number;
}

export type CampaignType = 'double_day' | 'payday' | 'mega_sale' | 'flash_sale' | 'brand_day' | 'other';

export interface Campaign {
  campaignId: string;
  name: string;
  platform?: Platform;
  type?: CampaignType;
  startDate: string;
  endDate: string;
}

export interface AdPerformance {
  /** Day of the row, or the LAST day when the row is a period total (see periodStart). */
  date: string;
  /**
   * Set when the report gives one total for a period (e.g. 01–30/09) instead of daily rows.
   * Such a row only counts when the whole period lies inside the analysed range —
   * it is never spread across days.
   */
  periodStart?: string;
  platform: Platform;
  campaignId?: string;
  adName?: string;
  adType?: string;
  sku?: string;
  /** Undefined when the report shows "-" (no data), which is not the same as 0. */
  spend?: number;
  impressions?: number;
  clicks?: number;
  orders?: number;
  /** Revenue the ad platform attributes to the ad. */
  attributedRevenue?: number;
  /** ROAS as the report prints it — only compared with revenue ÷ spend, never used. */
  reportedRoas?: number;
}

export interface LiveSession {
  sessionId: string;
  platform: Platform;
  /** Day of the session, or the last day of the report period (see periodStart). */
  date: string;
  /** Set when the report only gives the session's totals for a period, without its date. */
  periodStart?: string;
  /** Local start time "HH:MM" when the report has it. */
  startTime?: string;
  title?: string;
  durationMinutes?: number;
  viewers?: number;
  views?: number;
  avgWatchSeconds?: number;
  productClicks?: number;
  addToCart?: number;
  orders?: number;
  paidOrders?: number;
  cancelledOrders?: number;
  gmv?: number;
}

export interface AffiliatePerformance {
  /** Day of the row, or the last day of a period total (see periodStart). */
  date?: string;
  periodStart?: string;
  contentTitle?: string;
  platform: Platform;
  creatorId: string;
  contentType?: 'affiliate' | 'shop_video' | 'organic_video' | 'creator';
  contentId?: string;
  views?: number;
  clicks?: number;
  orders?: number;
  gmv?: number;
  commission?: number;
}

/** Daily traffic facts, optionally per SKU. Enables CVR and funnel. */
export interface TrafficDaily {
  /** Day of the row, or the last day of a period total (see periodStart). */
  date: string;
  periodStart?: string;
  platform: Platform;
  sku?: string;
  impressions?: number;
  visits?: number;
  productViews?: number;
  productClicks?: number;
  addToCart?: number;
}

/**
 * Daily business aggregates for sources that do not ship order-level data
 * (e.g. Shopee "Phân tích bán hàng" exports). Used only when `orders` is empty.
 */
export interface DailyMetric {
  date: string;
  platform: Platform;
  placedGmv?: number;
  placedOrders?: number;
  paidGmv?: number;
  paidOrders?: number;
  confirmedGmv?: number;
  confirmedOrders?: number;
  /** Placed-order sales excluding Shopee's subsidy ("Doanh số không bao gồm trợ giá bởi Shopee"). */
  placedNoSubsidyGmv?: number;
  cancelledOrders?: number;
  cancelledGmv?: number;
  /** Refunds of placed orders (placed-order sheet). */
  refundedOrders?: number;
  refundedGmv?: number;
  /** Refunds of paid orders (paid-order sheet) — the ones deducted from paid GMV. */
  paidRefundedOrders?: number;
  paidRefundedGmv?: number;
  /** Cancellations as the paid-order sheet reports them. */
  paidCancelledOrders?: number;
  paidCancelledGmv?: number;
  units?: number;
  /** Distinct buyers of the day — not additive across days. */
  buyers?: number;
  newBuyers?: number;
  /** Buyers who had bought before ("số người mua hiện tại"). */
  existingBuyers?: number;
  /** Visitors who have not bought yet ("số người mua tiềm năng") — distinct per day. */
  potentialBuyers?: number;
  /** Ratio (0.106 = 10,6%) as reported by the platform. */
  repeatRate?: number;
  /** Distinct visitors of the day — not additive across days. */
  visits?: number;
  productClicks?: number;
}

/**
 * Shop-level totals for a whole report period, as the platform reports them (the
 * "24-07-2026-22-08-2026" row of Shopee's overview sheets). Distinct counts (buyers,
 * visitors) only exist here: daily rows cannot be summed into them.
 */
export interface ShopPeriodTotal {
  platform: Platform;
  start: string;
  end: string;
  stage: SummaryStage;
  gmv?: number;
  noSubsidyGmv?: number;
  orders?: number;
  productClicks?: number;
  visits?: number;
  cancelledOrders?: number;
  cancelledGmv?: number;
  refundedOrders?: number;
  refundedGmv?: number;
  buyers?: number;
  newBuyers?: number;
  existingBuyers?: number;
  potentialBuyers?: number;
  repeatRate?: number;
  /** Conversion rate as the platform prints it (ratio). Only compared with the recomputed CVR. */
  reportedCvr?: number;
}

/**
 * A figure the report prints somewhere other than its canonical place (see
 * canonicalSources.ts): the header row of a sheet, the undated total row of a daily sheet.
 * Kept only to warn when the file disagrees with itself — never used as a value.
 */
export interface ReportedFigure {
  platform: Platform;
  stage: SummaryStage;
  /** Report period the figure covers. */
  start: string;
  end: string;
  source: 'traffic_header' | 'product_header' | 'daily_sheet_total';
  /** shop = all sales, channel = one of the four channels, ads_total = all Shopee Ads, ad = one ad type. */
  scope: 'shop' | 'channel' | 'ads_total' | 'ad';
  /** Channel id, ad name, or "shop" / "ads". */
  key: string;
  field: 'gmv' | 'spend' | 'orders';
  value: number;
}

/** Order stage a summary report counts: placed, confirmed, or paid orders. */
export type SummaryStage = 'placed' | 'confirmed' | 'paid';

export type SummaryChannel = 'product_card' | 'live' | 'video' | 'affiliate' | 'ads';

/**
 * Pre-aggregated sales from platform summary reports (e.g. Shopee "Phân tích bán hàng"):
 * revenue by channel, by traffic source inside a channel, or by product. Used when there
 * are no order-level rows. Ads rows overlap the other channels (an ad click still lands on
 * a product card), so they are never added to the channel total.
 */
export interface SalesSummaryRow {
  platform: Platform;
  /** Day of the row, or the last day of a period total (see periodStart). */
  date: string;
  periodStart?: string;
  stage: SummaryStage;
  dimension: 'channel' | 'source' | 'sku';
  channel: SummaryChannel;
  /** Channel key, source name, or SKU / product ID. */
  key: string;
  label?: string;
  gmv?: number;
  /** Platform-attributed orders — can be fractional when an order is shared by sources. */
  orders?: number;
  units?: number;
  buyers?: number;
  impressions?: number;
  clicks?: number;
  /** Live / video / content views. */
  views?: number;
  /** Distinct impressions / clicks ("… duy nhất") — not additive across days or channels. */
  uniqueImpressions?: number;
  uniqueClicks?: number;
  /** Rates as the report prints them (ratios) — only compared with the recomputed ones. */
  reported?: { ctr?: number; cvr?: number; share?: number };
}

export type CostType = 'packaging' | 'staff' | 'rent' | 'tools' | 'shipping' | 'marketing' | 'other';

/** Costs not attached to a specific order. */
export interface Cost {
  date: string;
  platform?: Platform;
  type: CostType;
  amount: number;
  note?: string;
}

/** Payout statement line from a platform (actual fees charged). */
export interface Settlement {
  orderId?: string;
  platform: Platform;
  settledDate: string;
  payout?: number;
  platformFee?: number;
  paymentFee?: number;
  shippingFee?: number;
  affiliateCommission?: number;
  adjustment?: number;
}

export type ChangeType = 'price' | 'voucher' | 'combo' | 'ads_budget' | 'live_time' | 'campaign' | 'product' | 'other';

export interface ChangeEvent {
  id: string;
  date: string;
  type: ChangeType;
  description: string;
  platform?: Platform;
  sku?: string;
}

/** User-provided cost settings (stored locally). Explicit source, never a hidden default. */
export interface CostSettings {
  /** Fee rate on net revenue per platform, used only when orders carry no fee amounts. */
  platformFeeRate?: Partial<Record<Platform, number>>;
  paymentFeeRate?: Partial<Record<Platform, number>>;
  /** User confirmed they ran no paid ads in the period (so Ads = 0 is real, not missing). */
  noAdsDeclared?: boolean;
  /** Catalog overrides entered by the user: SKU → category / niche. */
  skuCategory?: Record<string, string>;
  skuSubcategory?: Record<string, string>;
  /** User confirmed the shop pays no shipping (buyer / platform pays), so shipping = 0 is real. */
  noSellerShippingDeclared?: boolean;
  /** Per-SKU unit COGS entered by the user; overrides catalog values. */
  skuCogs?: Record<string, number>;
  /**
   * Shop-wide estimates for summary reports (no COGS per order): gross margin and platform
   * fees as a share of sales. Used for break-even ROAS, profit after Ads and What-If, and
   * every result is labelled "ước tính theo số bạn nhập".
   */
  estimatedGrossMargin?: number;
  estimatedFeeRate?: number;
}

export interface DatasetSource {
  fileName: string;
  platform: Platform;
  reportType: string;
  importedAt: string;
  rowCount?: number;
}

export interface CanonicalDataset {
  id: string;
  label: string;
  sources: DatasetSource[];
  orders: Order[];
  orderLines: OrderLine[];
  products: Product[];
  combos: Combo[];
  campaigns: Campaign[];
  ads: AdPerformance[];
  liveSessions: LiveSession[];
  affiliates: AffiliatePerformance[];
  traffic: TrafficDaily[];
  dailyMetrics: DailyMetric[];
  costs: Cost[];
  settlements: Settlement[];
  changeEvents: ChangeEvent[];
  /** Summary-report sales by channel / source / product (optional). */
  salesSummaries?: SalesSummaryRow[];
  /** Whole-period shop totals from summary reports (optional). */
  periodTotals?: ShopPeriodTotal[];
  /** Non-canonical copies of figures, only for "the file disagrees with itself" checks. */
  reportedFigures?: ReportedFigure[];
  costSettings?: CostSettings;
  /** Field names the source reported only as estimates; engines treat them as missing. */
  estimatedFields?: string[];
  /** Records the importer could not use (e.g. live sessions without a date). */
  importNotes?: { vi: string; en: string }[];
}

export function emptyDataset(id: string, label: string): CanonicalDataset {
  return {
    id,
    label,
    sources: [],
    orders: [],
    orderLines: [],
    products: [],
    combos: [],
    campaigns: [],
    ads: [],
    liveSessions: [],
    affiliates: [],
    traffic: [],
    dailyMetrics: [],
    costs: [],
    settlements: [],
    changeEvents: [],
  };
}

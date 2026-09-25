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
  date: string;
  platform: Platform;
  campaignId?: string;
  adName?: string;
  adType?: string;
  sku?: string;
  spend: number;
  impressions?: number;
  clicks?: number;
  orders?: number;
  /** Revenue the ad platform attributes to the ad. */
  attributedRevenue?: number;
}

export interface LiveSession {
  sessionId: string;
  platform: Platform;
  date: string;
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
  date?: string;
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
  date: string;
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
  cancelledOrders?: number;
  cancelledGmv?: number;
  refundedOrders?: number;
  refundedGmv?: number;
  units?: number;
  buyers?: number;
  newBuyers?: number;
  visits?: number;
  productClicks?: number;
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
  /** User confirmed the shop pays no shipping (buyer / platform pays), so shipping = 0 is real. */
  noSellerShippingDeclared?: boolean;
  /** Per-SKU unit COGS entered by the user; overrides catalog values. */
  skuCogs?: Record<string, number>;
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

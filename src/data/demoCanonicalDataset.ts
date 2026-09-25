/**
 * Deterministic 3-month, 3-platform, order-level demo dataset (01/07–30/09/2025).
 *
 * Everything derived is computed FROM the generated orders so all screens agree:
 * live-session orders/GMV, ad-attributed orders/revenue, affiliate commission,
 * product clicks and packaging costs all come from the same order list.
 *
 * Built-in stories (for alerts, brief and drill-down demos):
 *  - SERUM-B5 grows in September faster than its traffic (opportunity)
 *  - SON-LI-03 cancel rate spikes from 20/09 (reason: "Người mua đổi ý")
 *  - NOI-CHIEN-5L loses money: most orders come from expensive TikTok ads
 *  - SERUM-VC launched 10/09 without COGS (profit completeness warning)
 *  - TikTok live on 27/09 had more viewers but fewer orders than the previous one
 *  - Shopee ads for TA-BIM-M lose efficiency in the last week (CPC up)
 */
import type {
  AdPerformance,
  AffiliatePerformance,
  Campaign,
  CanonicalDataset,
  ChangeEvent,
  Combo,
  Cost,
  LiveSession,
  Order,
  OrderLine,
  OrderStatus,
  Platform,
  Product,
  TrafficDaily,
} from '../analytics/model';
import { addDays, enumerateDays } from '../analytics/period';

export const DEMO_RANGE = { start: '2025-07-01', end: '2025-09-30' };
export const DEMO_DATASET_ID = 'demo-seller-3m';

// ---------------------------------------------------------------- random
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Rng {
  next: () => number;
  poisson: (lambda: number) => number;
  pick: <T>(items: readonly T[]) => T;
  chance: (p: number) => boolean;
  between: (min: number, max: number) => number;
}

function makeRng(seed: number): Rng {
  const next = mulberry32(seed);
  const gauss = () => {
    const u = Math.max(next(), 1e-12);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
  };
  return {
    next,
    poisson: (lambda) => {
      if (lambda <= 0) return 0;
      if (lambda > 30) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * gauss()));
      const l = Math.exp(-lambda);
      let k = 0;
      let p = 1;
      do {
        k++;
        p *= next();
      } while (p > l);
      return k - 1;
    },
    pick: (items) => items[Math.floor(next() * items.length)],
    chance: (p) => next() < p,
    between: (min, max) => min + (max - min) * next(),
  };
}

// ---------------------------------------------------------------- catalog
interface SkuSpec {
  sku: string;
  name: string;
  category: string;
  subcategory: string;
  price: number;
  cogs?: number;
  /** Expected units per day across all platforms. */
  demand: number;
  launch?: string;
  comboId?: string;
  platformMix?: Partial<Record<Platform, number>>;
}

const CATALOG: SkuSpec[] = [
  { sku: 'TA-BIM-M', name: 'Tã quần Bobby size M 60 miếng', category: 'Mẹ & Bé', subcategory: 'Tã bỉm', price: 329_000, cogs: 215_000, demand: 16 },
  { sku: 'TA-BIM-L', name: 'Tã quần Bobby size L 54 miếng', category: 'Mẹ & Bé', subcategory: 'Tã bỉm', price: 349_000, cogs: 228_000, demand: 12 },
  { sku: 'SUA-BOT-900', name: 'Sữa bột dinh dưỡng 900g', category: 'Mẹ & Bé', subcategory: 'Sữa bột', price: 520_000, cogs: 432_000, demand: 7 },
  { sku: 'KHAN-UOT-100', name: 'Khăn ướt không mùi 100 tờ', category: 'Mẹ & Bé', subcategory: 'Khăn ướt', price: 45_000, cogs: 19_000, demand: 26 },
  { sku: 'SERUM-B5', name: 'Serum phục hồi B5 30ml', category: 'Làm đẹp', subcategory: 'Chăm sóc da', price: 259_000, cogs: 68_000, demand: 10 },
  { sku: 'KCN-SPF50', name: 'Kem chống nắng SPF50 50ml', category: 'Làm đẹp', subcategory: 'Chống nắng', price: 189_000, cogs: 62_000, demand: 14 },
  { sku: 'SRM-TRA', name: 'Sữa rửa mặt trà xanh 150ml', category: 'Làm đẹp', subcategory: 'Làm sạch', price: 129_000, cogs: 38_000, demand: 17 },
  { sku: 'SON-LI-03', name: 'Son lì mịn môi #03', category: 'Làm đẹp', subcategory: 'Trang điểm', price: 159_000, cogs: 45_000, demand: 8, platformMix: { shopee: 0.35, tiktok: 0.55, lazada: 0.1 } },
  { sku: 'SERUM-VC', name: 'Serum Vitamin C 15% 30ml', category: 'Làm đẹp', subcategory: 'Chăm sóc da', price: 289_000, demand: 5, launch: '2025-09-10' },
  { sku: 'NOI-CHIEN-5L', name: 'Nồi chiên không dầu 5L', category: 'Nhà cửa & Đời sống', subcategory: 'Đồ bếp', price: 1_290_000, cogs: 820_000, demand: 3, platformMix: { shopee: 0.2, tiktok: 0.7, lazada: 0.1 } },
  { sku: 'HOP-TP-SET', name: 'Bộ 5 hộp đựng thực phẩm thủy tinh', category: 'Nhà cửa & Đời sống', subcategory: 'Đồ bếp', price: 159_000, cogs: 72_000, demand: 9 },
  { sku: 'BINH-GIU-NHIET', name: 'Bình giữ nhiệt inox 500ml', category: 'Nhà cửa & Đời sống', subcategory: 'Bình nước', price: 199_000, cogs: 85_000, demand: 7 },
  { sku: 'COMBO-TA-KHAN', name: 'Combo Tã M + 2 gói khăn ướt', category: 'Mẹ & Bé', subcategory: 'Tã bỉm', price: 389_000, cogs: 253_000, demand: 5, comboId: 'COMBO-TA-KHAN' },
  { sku: 'COMBO-SKINCARE', name: 'Combo Sữa rửa mặt + Kem chống nắng', category: 'Làm đẹp', subcategory: 'Combo chăm sóc da', price: 289_000, cogs: 100_000, demand: 5, comboId: 'COMBO-SKINCARE' },
];

const COMBOS: Combo[] = [
  { comboId: 'COMBO-TA-KHAN', name: 'Combo Tã M + 2 gói khăn ướt', skus: ['TA-BIM-M', 'KHAN-UOT-100', 'KHAN-UOT-100'], price: 389_000 },
  { comboId: 'COMBO-SKINCARE', name: 'Combo Sữa rửa mặt + Kem chống nắng', skus: ['SRM-TRA', 'KCN-SPF50'], price: 289_000 },
];

const PLATFORM_SHARE: Record<Platform, number> = { shopee: 0.5, tiktok: 0.35, lazada: 0.15, internal: 0, other: 0 };
const PLATFORMS: Platform[] = ['shopee', 'tiktok', 'lazada'];

const FEE_RATE: Record<Platform, { platform: number; payment: number }> = {
  shopee: { platform: 0.08, payment: 0.02 },
  tiktok: { platform: 0.07, payment: 0.02 },
  lazada: { platform: 0.075, payment: 0.02 },
  internal: { platform: 0, payment: 0 },
  other: { platform: 0, payment: 0 },
};

const CANCEL_BASE: Record<Platform, number> = { shopee: 0.055, tiktok: 0.085, lazada: 0.065, internal: 0, other: 0 };

const CANCEL_REASONS = ['Người mua đổi ý', 'Thay đổi địa chỉ giao hàng', 'Tìm thấy giá rẻ hơn', 'Người bán chưa chuẩn bị hàng kịp'];
const RETURN_REASONS = ['Hàng lỗi/hư hỏng', 'Không đúng mô tả', 'Sai màu/sai mẫu'];

/** Ads campaigns: which SKU they push, on which platform, at what cost. */
interface AdSpec {
  campaignId: string;
  name: string;
  platform: Platform;
  sku: string;
  /** Share of this SKU's platform orders that come through ads. */
  adShare: number;
  cpc: number;
  cvr: number;
  ctr: number;
}
const AD_SPECS: AdSpec[] = [
  { campaignId: 'ADS-SP-SERUM', name: 'Shopee Ads · Tìm kiếm Serum B5', platform: 'shopee', sku: 'SERUM-B5', adShare: 0.3, cpc: 2_600, cvr: 0.045, ctr: 0.028 },
  { campaignId: 'ADS-SP-TA', name: 'Shopee Ads · Tã quần Bobby M', platform: 'shopee', sku: 'TA-BIM-M', adShare: 0.25, cpc: 1_900, cvr: 0.05, ctr: 0.025 },
  { campaignId: 'ADS-TT-NOI', name: 'TikTok GMV Max · Nồi chiên 5L', platform: 'tiktok', sku: 'NOI-CHIEN-5L', adShare: 0.75, cpc: 9_500, cvr: 0.011, ctr: 0.014 },
  { campaignId: 'ADS-TT-SON', name: 'TikTok Ads · Son lì #03', platform: 'tiktok', sku: 'SON-LI-03', adShare: 0.3, cpc: 3_200, cvr: 0.04, ctr: 0.021 },
  { campaignId: 'ADS-LZ-HOP', name: 'Lazada Sponsored · Hộp thực phẩm', platform: 'lazada', sku: 'HOP-TP-SET', adShare: 0.25, cpc: 1_700, cvr: 0.04, ctr: 0.02 },
];

const CREATORS: Record<Platform, string[]> = {
  shopee: ['koc_meobeo', 'review_cung_linh', 'me_va_be_24h'],
  tiktok: ['tiktok_ha_review', 'bep_nha_minh', 'lamdep_moingay', 'mebim_official'],
  lazada: ['lz_deal_hunter'],
  internal: [],
  other: [],
};

// ---------------------------------------------------------------- calendar
function dayOfMonth(date: string) {
  return Number(date.slice(8, 10));
}
function monthOf(date: string) {
  return Number(date.slice(5, 7));
}
function weekday(date: string) {
  return new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
}
function isDoubleDay(date: string) {
  return dayOfMonth(date) === monthOf(date);
}
function isPayday(date: string) {
  return dayOfMonth(date) === 15 || dayOfMonth(date) === 25;
}

function demandMultiplier(date: string, platform: Platform): number {
  let m = 1;
  const wd = weekday(date);
  if (wd === 0 || wd === 6) m *= 1.12;
  if (isDoubleDay(date)) m *= platform === 'tiktok' ? 3.4 : 3.0;
  else if (isDoubleDay(addDays(date, 1))) m *= 1.25;
  if (isPayday(date)) m *= 1.3;
  const month = monthOf(date);
  if (month === 8) m *= 1.06;
  if (month === 9) m *= 1.1;
  return m;
}

function skuMultiplier(spec: SkuSpec, date: string): number {
  if (spec.launch && date < spec.launch) return 0;
  let m = 1;
  if (spec.sku === 'SERUM-B5') {
    if (date >= '2025-08-20') m *= 1.1; // price drop 259k → 249k
    if (date >= '2025-09-01') m *= 1 + 0.045 * dayOfMonth(date); // strong September momentum
  }
  if (spec.sku === 'NOI-CHIEN-5L' && date >= '2025-09-01') m *= 1.35; // ads budget +50%
  return m;
}

function priceOf(spec: SkuSpec, date: string): number {
  if (spec.sku === 'SERUM-B5' && date >= '2025-08-20') return 249_000;
  return spec.price;
}

// ---------------------------------------------------------------- live sessions
interface LiveSpec {
  session: LiveSession;
  orderMultiplier: number;
  conversion: number;
}

function planLiveSessions(rng: Rng, days: string[]): LiveSpec[] {
  const out: LiveSpec[] = [];
  for (const date of days) {
    const wd = weekday(date);
    const double = isDoubleDay(date);
    if ([2, 4, 6].includes(wd) || double) {
      const special = date === '2025-09-27';
      out.push({
        session: {
          sessionId: `LIVE-TT-${date.replace(/-/g, '')}`,
          platform: 'tiktok',
          date,
          title: double ? `Siêu live ${dayOfMonth(date)}.${monthOf(date)} — Deal sốc` : date >= '2025-09-02' ? 'Live tối 21h — Mẹ & Bé + Làm đẹp' : 'Live tối 20h — Mẹ & Bé + Làm đẹp',
          durationMinutes: double ? 240 : special ? 150 : 120,
        },
        orderMultiplier: special ? 0.55 : double ? 2.2 : 1,
        conversion: special ? 0.004 : rng.between(0.014, 0.022),
      });
    }
    if ([0, 3].includes(wd) || double) {
      out.push({
        session: {
          sessionId: `LIVE-SP-${date.replace(/-/g, '')}`,
          platform: 'shopee',
          date,
          title: double ? `Shopee Live ${dayOfMonth(date)}.${monthOf(date)}` : 'Shopee Live trưa — Xả kho',
          durationMinutes: double ? 180 : 90,
        },
        orderMultiplier: double ? 1.8 : 1,
        conversion: rng.between(0.012, 0.02),
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------- generator
function channelFor(rng: Rng, platform: Platform, spec: SkuSpec, date: string, hasLive: boolean): string {
  const ad = AD_SPECS.find((a) => a.platform === platform && a.sku === spec.sku);
  if (ad && rng.chance(ad.adShare * (spec.sku === 'NOI-CHIEN-5L' && date >= '2025-09-01' ? 1.1 : 1))) return 'ads';
  const r = rng.next();
  if (platform === 'tiktok') {
    if (hasLive && r < 0.3) return 'live';
    if (r < 0.55) return 'video';
    if (r < 0.72) return 'affiliate';
    return 'search';
  }
  if (platform === 'shopee') {
    if (hasLive && r < 0.1) return 'live';
    if (r < 0.2) return 'affiliate';
    if (r < 0.45) return 'recommend';
    return 'search';
  }
  if (r < 0.08) return 'affiliate';
  return r < 0.4 ? 'recommend' : 'search';
}

function statusFor(rng: Rng, platform: Platform, spec: SkuSpec, date: string): { status: OrderStatus; cancelReason?: string; returnReason?: string } {
  const age = (Date.parse(`${DEMO_RANGE.end}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000;
  let cancelP = CANCEL_BASE[platform] * (isDoubleDay(date) ? 1.4 : 1);
  if (spec.sku === 'SON-LI-03' && date >= '2025-09-20') cancelP = 0.19;
  if (spec.sku === 'NOI-CHIEN-5L') cancelP *= 1.3;
  if (rng.chance(cancelP)) {
    const reason = spec.sku === 'SON-LI-03' && date >= '2025-09-20' && rng.chance(0.7) ? 'Người mua đổi ý' : rng.pick(CANCEL_REASONS);
    return { status: 'cancelled', cancelReason: reason };
  }
  if (age <= 1) return { status: rng.chance(0.5) ? 'placed' : 'paid' };
  if (age <= 3) return { status: rng.chance(0.6) ? 'shipped' : 'paid' };
  if (rng.chance(0.012)) return { status: 'failed_delivery', cancelReason: 'Giao hàng thất bại' };
  const returnP = spec.sku === 'SON-LI-03' ? 0.035 : spec.category === 'Nhà cửa & Đời sống' ? 0.03 : 0.018;
  if (rng.chance(returnP)) return { status: 'returned', returnReason: spec.sku === 'SON-LI-03' ? 'Sai màu/sai mẫu' : rng.pick(RETURN_REASONS) };
  if (rng.chance(0.008)) return { status: 'refunded', returnReason: 'Hàng lỗi/hư hỏng' };
  if (age <= 7) return { status: 'delivered' };
  return { status: 'completed' };
}

let cached: CanonicalDataset | null = null;

export function buildDemoCanonicalDataset(): CanonicalDataset {
  if (cached) return cached;
  const rng = makeRng(20250930);
  const days = enumerateDays(DEMO_RANGE);
  const lives = planLiveSessions(rng, days);
  const liveByDayPlatform = new Map(lives.map((l) => [`${l.session.date}|${l.session.platform}`, l]));

  const orders: Order[] = [];
  const lines: OrderLine[] = [];
  const customerPools: Record<string, string[]> = { shopee: [], tiktok: [], lazada: [] };
  let orderSeq = 0;
  let customerSeq = 0;
  const traffic: TrafficDaily[] = [];

  for (const date of days) {
    for (const platform of PLATFORMS) {
      const live = liveByDayPlatform.get(`${date}|${platform}`);
      for (const spec of CATALOG) {
        const mix = spec.platformMix?.[platform] ?? PLATFORM_SHARE[platform];
        const baseLambda = spec.demand * mix * demandMultiplier(date, platform);
        const lambda = baseLambda * skuMultiplier(spec, date) * (live ? 1 + 0.15 * live.orderMultiplier : 1);
        const n = rng.poisson(lambda);

        // Traffic follows the base demand (without SKU momentum) → SERUM-B5 CVR rises in September.
        if (baseLambda > 0 && !(spec.launch && date < spec.launch)) {
          const baseCvr = spec.price > 1_000_000 ? 0.012 : 0.045;
          const clicks = Math.round((baseLambda / baseCvr) * rng.between(0.9, 1.1));
          traffic.push({ date, platform, sku: spec.sku, productClicks: clicks, impressions: Math.round(clicks / rng.between(0.025, 0.04)) });
        }

        for (let i = 0; i < n; i++) {
          orderSeq++;
          const prefix = platform === 'shopee' ? '25' : platform === 'tiktok' ? '57' : '8';
          const orderId = `${prefix}${date.replace(/-/g, '').slice(2)}${String(orderSeq).padStart(6, '0')}`;
          let channel = channelFor(rng, platform, spec, date, !!live);
          if (channel === 'live' && live && live.orderMultiplier < 1 && rng.chance(1 - live.orderMultiplier)) channel = 'video';

          const pool = customerPools[platform];
          let customerId: string;
          if (pool.length > 20 && rng.chance(0.24)) customerId = rng.pick(pool);
          else {
            customerSeq++;
            customerId = `KH-${platform.slice(0, 2).toUpperCase()}${String(customerSeq).padStart(6, '0')}`;
            pool.push(customerId);
          }

          const { status, cancelReason, returnReason } = statusFor(rng, platform, spec, date);
          const qty = rng.chance(spec.price < 100_000 ? 0.35 : 0.1) ? 2 : 1;
          const unitPrice = priceOf(spec, date);
          const gross = unitPrice * qty;
          const discountRate = isDoubleDay(date) ? 0.1 : rng.chance(0.3) ? 0.05 : 0;
          const orderLines: OrderLine[] = [
            {
              orderId,
              sku: spec.sku,
              productName: spec.name,
              comboId: spec.comboId,
              quantity: qty,
              grossAmount: gross,
              sellerDiscount: Math.round(gross * discountRate),
              platformDiscount: isDoubleDay(date) ? Math.round(gross * 0.05) : 0,
            },
          ];
          // ~15% multi-item orders: add a cheap add-on
          if (rng.chance(0.15)) {
            const addOn = rng.pick(CATALOG.filter((c) => c.price < 200_000 && !c.comboId && !(c.launch && date < c.launch) && c.sku !== spec.sku));
            const addGross = priceOf(addOn, date);
            orderLines.push({ orderId, sku: addOn.sku, productName: addOn.name, quantity: 1, grossAmount: addGross, sellerDiscount: Math.round(addGross * discountRate), platformDiscount: 0 });
          }

          const lineNet = orderLines.reduce((s, l) => s + l.grossAmount - (l.sellerDiscount || 0), 0);
          const orderGross = orderLines.reduce((s, l) => s + l.grossAmount, 0);
          const cancelled = status === 'cancelled' || status === 'failed_delivery';
          const creatorId = channel === 'affiliate' ? rng.pick(CREATORS[platform]) : undefined;
          const order: Order = {
            orderId,
            platform,
            orderDate: date,
            status,
            rawStatus: status,
            cancelReason,
            returnReason,
            customerId,
            channel: creatorId ? `affiliate:${creatorId}` : channel,
            liveSessionId: channel === 'live' && live ? live.session.sessionId : undefined,
            campaignId: channel === 'ads' ? AD_SPECS.find((a) => a.platform === platform && a.sku === spec.sku)?.campaignId : undefined,
            platformFee: cancelled ? 0 : Math.round(lineNet * FEE_RATE[platform].platform),
            paymentFee: cancelled ? 0 : Math.round(lineNet * FEE_RATE[platform].payment),
            affiliateCommission: creatorId && !cancelled ? Math.round(lineNet * (platform === 'tiktok' ? 0.12 : 0.1)) : 0,
            shippingFeeSeller: cancelled ? 0 : (orderGross >= 300_000 ? 12_000 : 0) + (status === 'returned' ? 18_000 : 0),
          };
          if (status === 'returned' || status === 'refunded') order.refundAmount = lineNet;
          orders.push(order);
          lines.push(...orderLines);
        }
      }
    }
  }

  // ---- derived facts, computed from the orders above
  const linesByOrder = new Map<string, OrderLine[]>();
  for (const l of lines) {
    const list = linesByOrder.get(l.orderId);
    if (list) list.push(l);
    else linesByOrder.set(l.orderId, [l]);
  }
  const orderGross = (o: Order) => (linesByOrder.get(o.orderId) || []).reduce((s, l) => s + l.grossAmount, 0);
  const isValid = (o: Order) => o.status !== 'cancelled' && o.status !== 'failed_delivery';

  // Live sessions (sessions are in date order; the 27/09 story needs the previous session's viewers)
  const lastViewers = new Map<Platform, number>();
  const liveSessions: LiveSession[] = lives.map((l) => {
    const sessionOrders = orders.filter((o) => o.liveSessionId === l.session.sessionId);
    const placed = sessionOrders.length;
    const cancelledN = sessionOrders.filter((o) => !isValid(o)).length;
    const previousViewers = lastViewers.get(l.session.platform);
    const viewers =
      l.session.date === '2025-09-27' && previousViewers
        ? Math.round(previousViewers * 1.45) // more viewers, fewer orders
        : Math.max(200, Math.round(placed / l.conversion));
    lastViewers.set(l.session.platform, viewers);
    const productClicks = Math.round(viewers * rng.between(0.08, 0.12));
    return {
      ...l.session,
      viewers,
      views: Math.round(viewers * rng.between(1.3, 1.7)),
      avgWatchSeconds: Math.round(rng.between(70, 150)),
      productClicks,
      addToCart: Math.max(placed, Math.round(productClicks * rng.between(0.25, 0.35))),
      orders: placed,
      paidOrders: placed - cancelledN,
      cancelledOrders: cancelledN,
      gmv: sessionOrders.filter(isValid).reduce((s, o) => s + orderGross(o), 0),
    };
  });

  // Ads — attributed orders are the real ads-channel orders.
  const ads: AdPerformance[] = [];
  for (const spec of AD_SPECS) {
    for (const date of days) {
      const adOrders = orders.filter((o) => o.orderDate === date && o.campaignId === spec.campaignId);
      const valid = adOrders.filter(isValid);
      let cpc = spec.cpc;
      let cvr = spec.cvr;
      if (spec.campaignId === 'ADS-SP-TA' && date >= '2025-09-24') {
        cpc *= 1.6;
        cvr *= 0.7;
      }
      if (spec.campaignId === 'ADS-TT-NOI' && date >= '2025-09-01') cpc *= 1.15;
      const clicks = Math.max(adOrders.length > 0 ? 1 : 0, Math.round((adOrders.length || rng.between(0.3, 1)) / cvr));
      const impressions = Math.round(clicks / spec.ctr);
      ads.push({
        date,
        platform: spec.platform,
        campaignId: spec.campaignId,
        adName: spec.name,
        adType: spec.platform === 'tiktok' ? 'GMV Max' : 'Search',
        sku: spec.sku,
        spend: Math.round(clicks * cpc),
        impressions,
        clicks,
        orders: valid.length,
        attributedRevenue: valid.reduce((s, o) => s + orderGross(o), 0),
      });
    }
  }

  // Affiliate performance per creator per day
  const affMap = new Map<string, AffiliatePerformance>();
  for (const o of orders) {
    if (!o.channel?.startsWith('affiliate:') || !isValid(o)) continue;
    const creatorId = o.channel.slice('affiliate:'.length);
    const key = `${o.orderDate}|${o.platform}|${creatorId}`;
    let row = affMap.get(key);
    if (!row) {
      row = { date: o.orderDate, platform: o.platform, creatorId, contentType: 'affiliate', orders: 0, gmv: 0, commission: 0, clicks: 0, views: 0 };
      affMap.set(key, row);
    }
    row.orders! += 1;
    row.gmv! += orderGross(o);
    row.commission! += o.affiliateCommission || 0;
  }
  const affiliates = Array.from(affMap.values()).map((a) => {
    const clicks = Math.round((a.orders || 0) / rng.between(0.03, 0.06));
    return { ...a, clicks, views: Math.round(clicks / rng.between(0.04, 0.08)) };
  });

  // Traffic: platform-level visits (unique per day), plus per-SKU clicks from above
  for (const date of days) {
    for (const platform of PLATFORMS) {
      const clicks = traffic.filter((t) => t.date === date && t.platform === platform && t.sku).reduce((s, t) => s + (t.productClicks || 0), 0);
      traffic.push({ date, platform, visits: Math.round(clicks * 0.62) });
    }
  }

  // Costs: packaging per valid order (daily) + monthly overheads
  const costs: Cost[] = [];
  for (const date of days) {
    const validToday = orders.filter((o) => o.orderDate === date && isValid(o)).length;
    costs.push({ date, type: 'packaging', amount: validToday * 3_500, note: 'Đóng gói 3.500đ/đơn' });
    if (dayOfMonth(date) === 1) {
      costs.push({ date, type: 'staff', amount: 18_000_000, note: 'Lương nhân viên kho & CSKH' });
      costs.push({ date, type: 'rent', amount: 6_000_000, note: 'Thuê kho' });
      costs.push({ date, type: 'tools', amount: 900_000, note: 'Phần mềm quản lý đơn' });
    }
  }

  const campaigns: Campaign[] = [];
  for (const month of [7, 8, 9]) {
    const mm = String(month).padStart(2, '0');
    campaigns.push({ campaignId: `DD-${month}.${month}`, name: `Siêu sale ${month}.${month}`, type: 'double_day', startDate: `2025-${mm}-${mm}`, endDate: `2025-${mm}-${mm}` });
    campaigns.push({ campaignId: `PAY-15-${mm}`, name: `Lương về 15/${mm}`, type: 'payday', startDate: `2025-${mm}-15`, endDate: `2025-${mm}-15` });
    campaigns.push({ campaignId: `PAY-25-${mm}`, name: `Lương về 25/${mm}`, type: 'payday', startDate: `2025-${mm}-25`, endDate: `2025-${mm}-25` });
  }

  const changeEvents: ChangeEvent[] = [
    { id: 'chg-1', date: '2025-08-20', type: 'price', sku: 'SERUM-B5', platform: 'shopee', description: 'Giảm giá Serum B5 từ 259.000đ xuống 249.000đ trên tất cả các sàn' },
    { id: 'chg-2', date: '2025-09-01', type: 'ads_budget', sku: 'NOI-CHIEN-5L', platform: 'tiktok', description: 'Tăng ngân sách GMV Max Nồi chiên 5L thêm 50%' },
    { id: 'chg-3', date: '2025-09-02', type: 'live_time', platform: 'tiktok', description: 'Dời giờ live TikTok từ 20h sang 21h' },
    { id: 'chg-4', date: '2025-09-10', type: 'product', sku: 'SERUM-VC', description: 'Mở bán Serum Vitamin C 15% (chưa nhập giá vốn)' },
  ];

  const products: Product[] = CATALOG.map((c) => ({
    sku: c.sku,
    name: c.name,
    category: c.category,
    subcategory: c.subcategory,
    unitCogs: c.cogs,
    listPrice: c.price,
  }));

  cached = {
    id: DEMO_DATASET_ID,
    label: 'Demo · Shop Mẹ & Bé + Làm đẹp (07–09/2025)',
    sources: [{ fileName: 'Dữ liệu demo EcomPulse', platform: 'other', reportType: 'demo', importedAt: '2025-10-01T00:00:00.000Z', rowCount: orders.length }],
    orders,
    orderLines: lines,
    products,
    combos: COMBOS,
    campaigns,
    ads,
    liveSessions,
    affiliates,
    traffic,
    dailyMetrics: [],
    costs,
    settlements: [],
    changeEvents,
  };
  return cached;
}

export type PlanId = 'experience' | 'pro_monthly' | 'pro_semi_annual' | 'enterprise';

export type BillingCycle = 'monthly' | 'semi_annual' | 'enterprise';

export interface PlanFeature {
  text: string;
  isIncluded: boolean;
  isHighlighted?: boolean;
  tag?: string;
}

export interface PricingPlan {
  id: PlanId;
  name: string;
  subtitle: string;
  targetAudience: string;
  price: number; // in VND (0 for free or custom quote)
  isCustomQuote?: boolean;
  originalPrice?: number; // in VND
  billingText: string;
  discountNote?: string;
  badge?: string;
  badgeColor?: string;
  accentColor: string; // for border/glow
  isPopular?: boolean;
  isBestValue?: boolean;
  isEnterprise?: boolean;
  ctaText: string;
  features: PlanFeature[];
}

export interface UserSubscription {
  planId: PlanId;
  planName: string;
  status: 'active' | 'trial' | 'expired';
  activatedAt: string;
  expiresAt: string;
  isAutoRenew?: boolean;
}

export interface PromoCodeResult {
  valid: boolean;
  code: string;
  discountAmount: number;
  discountPercent?: number;
  message: string;
}

import { PlanId, UserSubscription, PromoCodeResult } from '../types/pricing';

const SUBSCRIPTION_STORAGE_KEY = 'ecompulse_user_subscription';
const SUBSCRIPTION_EVENT = 'ecompulse_subscription_changed';

export function getCurrentSubscription(): UserSubscription {
  try {
    const raw = localStorage.getItem(SUBSCRIPTION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as UserSubscription;
      // Check expiration if applicable
      if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() < Date.now()) {
        return {
          planId: 'experience',
          planName: 'Gói Experience (Free)',
          status: 'expired',
          activatedAt: new Date().toISOString(),
          expiresAt: '',
        };
      }
      return parsed;
    }
  } catch (e) {
    console.error('Failed to parse subscription from localStorage', e);
  }

  // Default initial free subscription
  return {
    planId: 'experience',
    planName: 'Gói Experience (Free)',
    status: 'active',
    activatedAt: new Date().toISOString(),
    expiresAt: '',
  };
}

export function saveSubscription(planId: PlanId, durationMonths: number = 1): UserSubscription {
  let planName = 'Gói Experience (Free)';
  let expiresAt = '';

  if (planId === 'pro_monthly') {
    planName = 'Gói Pro Monthly';
    const exp = new Date();
    exp.setMonth(exp.getMonth() + durationMonths);
    expiresAt = exp.toISOString();
  } else if (planId === 'pro_semi_annual') {
    planName = 'Gói Pro Semi-Annual (6 Tháng)';
    const exp = new Date();
    exp.setMonth(exp.getMonth() + 6);
    expiresAt = exp.toISOString();
  } else if (planId === 'enterprise') {
    planName = 'Gói Enterprise (Custom SLA)';
    const exp = new Date();
    exp.setFullYear(exp.getFullYear() + 1);
    expiresAt = exp.toISOString();
  }

  const newSub: UserSubscription = {
    planId,
    planName,
    status: 'active',
    activatedAt: new Date().toISOString(),
    expiresAt,
    isAutoRenew: true,
  };

  try {
    localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(newSub));
    window.dispatchEvent(new CustomEvent(SUBSCRIPTION_EVENT, { detail: newSub }));
  } catch (e) {
    console.error('Failed to save subscription', e);
  }

  return newSub;
}

export function subscribeToPlanChanges(callback: (sub: UserSubscription) => void): () => void {
  const handler = (event: Event) => {
    const custom = event as CustomEvent<UserSubscription>;
    if (custom.detail) {
      callback(custom.detail);
    } else {
      callback(getCurrentSubscription());
    }
  };

  window.addEventListener(SUBSCRIPTION_EVENT, handler);
  return () => window.removeEventListener(SUBSCRIPTION_EVENT, handler);
}

export function validatePromoCode(code: string, planId: PlanId, language: 'vi' | 'en' = 'vi'): PromoCodeResult {
  const normalized = (code || '').trim().toUpperCase();

  if (!normalized) {
    return {
      valid: false,
      code: '',
      discountAmount: 0,
      message: language === 'vi' ? 'Vui lòng nhập mã giảm giá' : 'Please enter a promo code',
    };
  }

  if (normalized === 'ECOMPULSE119') {
    if (planId === 'pro_monthly') {
      return {
        valid: true,
        code: normalized,
        discountAmount: 180000, // 299k -> 119k
        message: language === 'vi' ? 'Áp dụng thành công: Ưu đãi tháng đầu tiên chỉ 119.000 VNĐ!' : 'Applied: First month only 119,000 VND!',
      };
    } else {
      return {
        valid: true,
        code: normalized,
        discountAmount: 180000,
        message: language === 'vi' ? 'Áp dụng mã ưu đãi: Giảm ngay 180.000 VNĐ!' : 'Promo code applied: Discount 180,000 VND!',
      };
    }
  }

  if (normalized === 'AIRISER2026' || normalized === 'ECOMPULSE20') {
    return {
      valid: true,
      code: normalized,
      discountPercent: 20,
      discountAmount: planId === 'pro_semi_annual' ? 119800 : 59800,
      message: language === 'vi' ? 'Mã đối tác AI Riser 2026: Giảm thêm 20%!' : 'AI Riser 2026 Partner Code: Extra 20% Off!',
    };
  }

  if (normalized === 'PROMO67' || normalized === 'VIPSHOP') {
    return {
      valid: true,
      code: normalized,
      discountAmount: 100000,
      message: language === 'vi' ? 'Mã tri ân Nhà Bán Hàng Chiến Lược: Giảm 100.000 VNĐ!' : 'VIP Merchant discount: 100,000 VND Off!',
    };
  }

  return {
    valid: false,
    code: normalized,
    discountAmount: 0,
    message: language === 'vi' ? 'Mã ưu đãi không hợp lệ hoặc đã hết hạn.' : 'Invalid or expired promo code.',
  };
}

export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
}

import type { OrderStatus } from './model';

/**
 * Maps raw marketplace order statuses (Shopee / TikTok Shop / Lazada, Vietnamese or
 * English) to the canonical lifecycle. Unrecognized values map to `unknown` — they
 * are reported by data quality instead of being silently counted as delivered.
 */
export function normalizeOrderStatus(raw: unknown): OrderStatus {
  if (raw === null || raw === undefined) return 'unknown';
  const plain = String(raw)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');
  const s = plain.replace(/[^a-z0-9]/g, '');
  if (!s) return 'unknown';
  // Whole words — "vận chuyển" contains the letters "huy" but is not a cancellation.
  const words = new Set(plain.split(/[^a-z0-9]+/).filter(Boolean));

  // Order matters: more specific phrases first ("giao không thành công" contains "thành công").
  if (s.includes('giaokhongthanhcong') || s.includes('giaothatbai') || s.includes('faileddelivery') || s.includes('deliveryfailed') || s.includes('thatbai')) {
    return 'failed_delivery';
  }
  if (s.includes('trahang') || s.includes('return') || s.includes('shippedback')) return 'returned';
  if (s.includes('hoantien') || s.includes('refund')) return 'refunded';
  if (words.has('huy') || s.includes('cancel')) return 'cancelled';
  if (s.includes('hoanthanh') || s.includes('completed') || s.includes('complete')) return 'completed';
  if (s.includes('dagiao') || s.includes('thanhcong') || s.includes('delivered')|| s.includes('danhanhang') || s.includes('danhanduochang')) {
    return 'delivered';
  }
  if (s.includes('danggiao') || s.includes('dangvanchuyen') || s.includes('intransit') || s.includes('shipped') || s.includes('shipping') || s.includes('dagui')) {
    return 'shipped';
  }
  if (
    s.includes('cholayhang') ||
    s.includes('chogiao') ||
    s.includes('chovanchuyen') ||
    s.includes('packed') ||
    s.includes('topack') ||
    s.includes('choguihang') ||
    s.includes('readytoship') ||
    s.includes('awaitingshipment') ||
    s.includes('awaitingcollection') ||
    s.includes('toship') ||
    s.includes('dathanhtoan') ||
    s.includes('confirmed') ||
    s.includes('daxacnhan') ||
    s === 'paid'
  ) {
    return 'paid';
  }
  if (s.includes('chothanhtoan') || s.includes('chuathanhtoan') || s.includes('unpaid') || s.includes('choxacnhan') || s.includes('pending') || s.includes('placed') || s.includes('dadat')) {
    return 'placed';
  }
  return 'unknown';
}

/** Cancelled before fulfilment, or never delivered. Not counted in valid GMV. */
export function isCancelled(status: OrderStatus): boolean {
  return status === 'cancelled' || status === 'failed_delivery';
}

export function isReturnOrRefund(status: OrderStatus): boolean {
  return status === 'returned' || status === 'refunded';
}

export function isCompleted(status: OrderStatus): boolean {
  return status === 'delivered' || status === 'completed';
}

/** Orders that count toward GMV: placed and not cancelled / failed. */
export function isValidOrder(status: OrderStatus): boolean {
  return !isCancelled(status);
}

/** Goods physically came back → COGS is not consumed. */
export function consumesCogs(status: OrderStatus): boolean {
  return !isCancelled(status) && status !== 'returned';
}

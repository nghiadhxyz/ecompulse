export function formatVND(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN').format(Math.round(amount)) + ' ₫';
}

export function formatNumber(num: number | undefined | null): string {
  if (num === undefined || num === null || isNaN(num)) return '0';
  return new Intl.NumberFormat('vi-VN').format(num);
}

export function formatCompactVND(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0 đ';
  if (Math.abs(amount) >= 1000000000) {
    return (amount / 1000000000).toFixed(2).replace('.', ',') + ' tỷ đ';
  }
  if (Math.abs(amount) >= 1000000) {
    return (amount / 1000000).toFixed(2).replace('.', ',') + ' triệu đ';
  }
  if (Math.abs(amount) >= 1000) {
    return (amount / 1000).toFixed(0) + 'k đ';
  }
  return new Intl.NumberFormat('vi-VN').format(Math.round(amount)) + ' đ';
}

export function formatPercent(num: number | undefined | null): string {
  if (num === undefined || num === null || isNaN(num)) return '0%';
  return num.toFixed(1) + '%';
}

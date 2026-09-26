import * as XLSX from 'xlsx';
import {
  OrderItem,
  ParsedStoreData,
  RawSheetTable,
  ExecutiveKpis,
  FunnelStage,
  ChannelMetric,
  ChannelProductItem,
  AbcProduct,
  DailySalesMetric,
  LiveSessionMetric,
  VideoContributionMetric,
  AffiliateContributionMetric,
  CustomerRetentionMetric,
  AdPerformanceMetric,
  RuleAlert,
} from '../types';
import { calculateAnalyticsFromOrders, deriveProductGrowthMomentumAndCreatorSummary } from './analyticsEngine';
import {
  convertStandardizedToStoreData,
  StandardizedWorkbookData,
  parseStandardDate,
  localAgentCleanAndStandardize,
  convertCleanedAgentDataToStoreData,
} from './universalStandardizer';

// ==========================================
// NUMERIC & PERCENTAGE PARSING HELPERS
// ==========================================

export function parseMoneyString(val: any, defaultVal = 0): number {
  if (val === null || val === undefined || val === '') return defaultVal;
  if (typeof val === 'number') return isNaN(val) ? defaultVal : Math.round(val);

  let str = String(val).trim();
  if (!str) return defaultVal;

  // Remove dots and all non-digits/signs
  str = str.replace(/\./g, '').replace(/[^\d\-+]/g, '');
  const parsed = parseInt(str, 10);
  return isNaN(parsed) ? defaultVal : parsed;
}

export function cleanNumber(val: any, defaultVal = 0): number {
  if (val === null || val === undefined || val === '') return defaultVal;
  if (typeof val === 'number') return isNaN(val) ? defaultVal : val;

  let str = String(val).trim();
  if (!str) return defaultVal;

  // Remove currency symbols & non-numeric except , . - +
  str = str.replace(/[^\d.,\-+]/g, '');
  if (!str) return defaultVal;

  // Handle Vietnamese/European formatting (1.485.000,50 or 1.485.000)
  // vs International (1,485,000.50 or 1,485,000)
  const hasDot = str.includes('.');
  const hasComma = str.includes(',');

  if (hasDot && hasComma) {
    // Determine which is thousand separator and which is decimal
    const lastDotIndex = str.lastIndexOf('.');
    const lastCommaIndex = str.lastIndexOf(',');
    if (lastCommaIndex > lastDotIndex) {
      // 1.485.000,50 -> remove dots, replace comma with dot
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // 1,485,000.50 -> remove commas
      str = str.replace(/,/g, '');
    }
  } else if (hasDot && !hasComma) {
    // Could be 1.485.000 (thousand) or 14.50 (decimal)
    const dotParts = str.split('.');
    if (dotParts.length > 2) {
      // 1.485.000 -> thousand separator
      str = str.replace(/\./g, '');
    } else if (dotParts.length === 2 && dotParts[1].length === 3 && parseInt(dotParts[0], 10) > 0) {
      // 1.000 -> 1000
      str = str.replace(/\./g, '');
    }
  } else if (hasComma && !hasDot) {
    const commaParts = str.split(',');
    if (commaParts.length > 2) {
      // 1,485,000
      str = str.replace(/,/g, '');
    } else if (commaParts.length === 2 && commaParts[1].length === 3 && parseInt(commaParts[0], 10) > 0) {
      // 1,000
      str = str.replace(/,/g, '');
    } else {
      // 23,5 -> 23.5
      str = str.replace(',', '.');
    }
  }

  const parsed = parseFloat(str);
  return isNaN(parsed) ? defaultVal : parsed;
}

export function cleanPercentage(val: any, defaultVal = 0): number {
  if (val === null || val === undefined || val === '') return defaultVal;
  if (typeof val === 'number') {
    // If e.g. 0.2329 -> convert to 23.29%
    return val <= 1 && val > 0 ? +(val * 100).toFixed(2) : +val.toFixed(2);
  }
  const str = String(val).trim();
  const isPercent = str.includes('%');
  const num = cleanNumber(str.replace('%', ''), defaultVal);
  if (!isPercent && num <= 1 && num > 0) {
    return +(num * 100).toFixed(2);
  }
  return +num.toFixed(2);
}

// Fuzzy find column in row
function findColumn(row: any, candidates: string[]): string | undefined {
  if (!row) return undefined;
  const keys = Object.keys(row);
  for (const c of candidates) {
    const normalizedC = c.toLowerCase().replace(/[\s_\-–—()/%:,.]/g, '');
    const matchedKey = keys.find((k) => {
      const normalizedK = k.toLowerCase().replace(/[\s_\-–—()/%:,.]/g, '');
      return normalizedK.includes(normalizedC);
    });
    if (matchedKey) return matchedKey;
  }
  return undefined;
}

// Sheet group matcher
export interface SheetConfig {
  group: string;
  namePatterns: string[];
  headerRowIndex: number; // 0-based
  expectedCols: string[];
}

export const SHOPEE_21_SHEET_CONFIGS: SheetConfig[] = [
  // GROUP 1: EXECUTIVE OVERVIEW METRICS (3 Sheets - Row 1 -> headerRowIndex 0)
  // 1. Sheet Đơn hàng đã đặt (17 cột)
  {
    group: 'Group 1: Executive Overview',
    namePatterns: ['đơn hàng đã đặt', 'placed orders overview', 'đơn đã đặt overview'],
    headerRowIndex: 0,
    expectedCols: ['Ngày', 'Tổng doanh số (VND)', 'Doanh số không bao gồm trợ giá bởi Shopee', 'Tổng số đơn hàng', 'Doanh số trên mỗi đơn hàng', 'Lượt nhấp vào sản phẩm', 'Số lượt truy cập', 'Tỷ lệ chuyển đổi đơn hàng', 'Đơn đã hủy', 'Doanh số đơn hủy', 'Đơn đã hoàn trả / hoàn tiền', 'Doanh số các đơn Trả hàng/Hoàn tiền', 'số người mua', 'số người mua mới', 'số người mua hiện tại', 'số người mua tiềm năng', 'Tỉ lệ quay lại của người mua'],
  },
  // 2. Sheet Đơn đã xác nhận (17 cột)
  {
    group: 'Group 1: Executive Overview',
    namePatterns: ['đơn đã xác nhận', 'confirmed orders overview'],
    headerRowIndex: 0,
    expectedCols: ['Ngày', 'Tổng doanh số (VND)', 'Doanh số không bao gồm trợ giá bởi Shopee', 'Tổng số đơn hàng', 'Doanh số trên mỗi đơn hàng', 'Lượt nhấp vào sản phẩm', 'Số lượt truy cập', 'Tỷ lệ chuyển đổi đơn hàng', 'Đơn đã hủy', 'Doanh số đơn hủy', 'Đơn đã hoàn trả / hoàn tiền', 'Doanh số các đơn Trả hàng/Hoàn tiền', 'số người mua', 'số người mua mới', 'số người mua hiện tại', 'số người mua tiềm năng', 'Tỉ lệ quay lại của người mua'],
  },
  // 3. Sheet Đơn Đã Thanh Toán (17 cột)
  {
    group: 'Group 1: Executive Overview',
    namePatterns: ['đơn đã thanh toán', 'paid orders overview'],
    headerRowIndex: 0,
    expectedCols: ['Ngày', 'Tổng doanh số (VND)', 'Doanh số không bao gồm trợ giá bởi Shopee', 'Tổng số đơn hàng', 'Doanh số trên mỗi đơn hàng', 'Lượt nhấp vào sản phẩm', 'Số lượt truy cập', 'Tỷ lệ chuyển đổi đơn hàng', 'Đơn đã hủy', 'Doanh số đơn hủy', 'Đơn đã hoàn trả / hoàn tiền', 'Doanh số các đơn Trả hàng/Hoàn tiền', 'số người mua', 'số người mua mới', 'số người mua hiện tại', 'số người mua tiềm năng', 'Tỉ lệ quay lại của người mua'],
  },

  // GROUP 2: TRAFFIC SOURCE BREAKDOWN (6 Sheets - 13 columns each - Row 1 -> headerRowIndex 0)
  // 4. Sheet Nguồn truy cập cho Đơn hàng...
  {
    group: 'Group 2: Detailed Traffic',
    namePatterns: ['nguồn truy cập cho đơn hàng', 'nguồn truy cập cho đơn hàng đã đặt'],
    headerRowIndex: 0,
    expectedCols: ['Nguồn lưu lượng', 'Tỷ lệ doanh số', 'Doanh số (VND)', 'Lượt hiển thị sản phẩm', 'Lượt nhấp vào sản phẩm', 'Tổng số đơn hàng', 'Sản phẩm', 'CTR', 'Tỷ lệ chuyển đổi đơn hàng', 'Doanh số trên mỗi đơn hàng', 'Người mua', 'Lượt hiển thị sản phẩm duy nhất', 'Lượt nhấp sản phẩm duy nhất'],
  },
  // 5. Sheet (đơn đã đặt)Theo nguồn lưu ...
  {
    group: 'Group 2: Detailed Traffic',
    namePatterns: ['(đơn đã đặt)theo nguồn lưu', 'đơn đã đặt theo nguồn lưu lượng'],
    headerRowIndex: 0,
    expectedCols: ['Nguồn lưu lượng', 'Tỷ lệ doanh số', 'Doanh số (VND)', 'Lượt hiển thị sản phẩm', 'Lượt nhấp vào sản phẩm', 'Tổng số đơn hàng', 'Sản phẩm', 'CTR', 'Tỷ lệ chuyển đổi đơn hàng', 'Doanh số trên mỗi đơn hàng', 'Người mua', 'Lượt hiển thị sản phẩm duy nhất', 'Lượt nhấp sản phẩm duy nhất'],
  },
  // 7. Sheet Nguồn lưu lượng truy cập (đ...
  {
    group: 'Group 2: Detailed Traffic',
    namePatterns: ['nguồn lưu lượng truy cập (đ', 'nguồn lưu lượng truy cập (đơn đã xác nhận)'],
    headerRowIndex: 0,
    expectedCols: ['Nguồn lưu lượng', 'Tỷ lệ doanh số', 'Doanh số (VND)', 'Lượt hiển thị sản phẩm', 'Lượt nhấp vào sản phẩm', 'Tổng số đơn hàng', 'Sản phẩm', 'CTR', 'Tỷ lệ chuyển đổi đơn hàng', 'Doanh số trên mỗi đơn hàng', 'Người mua', 'Lượt hiển thị sản phẩm duy nhất', 'Lượt nhấp sản phẩm duy nhất'],
  },
  // 8. Sheet (đơn đã xác nhận)Theo nguồn...
  {
    group: 'Group 2: Detailed Traffic',
    namePatterns: ['(đơn đã xác nhận)theo nguồn', 'đơn đã xác nhận theo nguồn lưu lượng'],
    headerRowIndex: 0,
    expectedCols: ['Nguồn lưu lượng', 'Tỷ lệ doanh số', 'Doanh số (VND)', 'Lượt hiển thị sản phẩm', 'Lượt nhấp vào sản phẩm', 'Tổng số đơn hàng', 'Sản phẩm', 'CTR', 'Tỷ lệ chuyển đổi đơn hàng', 'Doanh số trên mỗi đơn hàng', 'Người mua', 'Lượt hiển thị sản phẩm duy nhất', 'Lượt nhấp sản phẩm duy nhất'],
  },
  // 10. Sheet Nguồn truy cập từ Đơn hàng ...
  {
    group: 'Group 2: Detailed Traffic',
    namePatterns: ['nguồn truy cập từ đơn hàng', 'nguồn truy cập từ đơn hàng đã thanh toán'],
    headerRowIndex: 0,
    expectedCols: ['Nguồn lưu lượng', 'Tỷ lệ doanh số', 'Doanh số (VND)', 'Lượt hiển thị sản phẩm', 'Lượt nhấp vào sản phẩm', 'Tổng số đơn hàng', 'Sản phẩm', 'CTR', 'Tỷ lệ chuyển đổi đơn hàng', 'Doanh số trên mỗi đơn hàng', 'Người mua', 'Lượt hiển thị sản phẩm duy nhất', 'Lượt nhấp sản phẩm duy nhất'],
  },
  // 11. Sheet (đơn đã thanh toán)Theo ngu...
  {
    group: 'Group 2: Detailed Traffic',
    namePatterns: ['(đơn đã thanh toán)theo ngu', 'đơn đã thanh toán theo nguồn lưu lượng'],
    headerRowIndex: 0,
    expectedCols: ['Nguồn lưu lượng', 'Tỷ lệ doanh số', 'Doanh số (VND)', 'Lượt hiển thị sản phẩm', 'Lượt nhấp vào sản phẩm', 'Tổng số đơn hàng', 'Sản phẩm', 'CTR', 'Tỷ lệ chuyển đổi đơn hàng', 'Doanh số trên mỗi đơn hàng', 'Người mua', 'Lượt hiển thị sản phẩm duy nhất', 'Lượt nhấp sản phẩm duy nhất'],
  },

  // GROUP 3: PRODUCT LEVEL PERFORMANCE (3 Sheets - 15 columns each - Row 1 -> headerRowIndex 0)
  // 6. Sheet Theo sản phẩm (đơn đã đặt)
  {
    group: 'Group 3: Product Performance',
    namePatterns: ['theo sản phẩm (đơn đã đặt)', 'theo sản phẩm đơn đã đặt'],
    headerRowIndex: 0,
    expectedCols: ['Mã sản phẩm', 'Sản phẩm', 'Tình trạng sản phẩm hiện tại', 'Tỷ lệ doanh số', 'Doanh số (VND)', 'Lượt hiển thị sản phẩm', 'Lượt nhấp vào sản phẩm', 'Tổng số đơn hàng', 'Sản phẩm', 'CTR', 'Tỷ lệ chuyển đổi đơn hàng', 'Doanh số trên mỗi đơn hàng', 'Người mua', 'Lượt hiển thị sản phẩm duy nhất', 'Lượt nhấp sản phẩm duy nhất'],
  },
  // 9. Sheet Theo sản phẩm (đơn đã xác n...
  {
    group: 'Group 3: Product Performance',
    namePatterns: ['theo sản phẩm (đơn đã xác n', 'theo sản phẩm (đơn đã xác nhận)', 'theo sản phẩm đơn đã xác nhận'],
    headerRowIndex: 0,
    expectedCols: ['Mã sản phẩm', 'Sản phẩm', 'Tình trạng sản phẩm hiện tại', 'Tỷ lệ doanh số', 'Doanh số (VND)', 'Lượt hiển thị sản phẩm', 'Lượt nhấp vào sản phẩm', 'Tổng số đơn hàng', 'Sản phẩm', 'CTR', 'Tỷ lệ chuyển đổi đơn hàng', 'Doanh số trên mỗi đơn hàng', 'Người mua', 'Lượt hiển thị sản phẩm duy nhất', 'Lượt nhấp sản phẩm duy nhất'],
  },
  // 12. Sheet Theo sản phẩm (đơn đã thanh...
  {
    group: 'Group 3: Product Performance',
    namePatterns: ['theo sản phẩm (đơn đã thanh', 'theo sản phẩm (đơn đã thanh toán)', 'theo sản phẩm đơn đã thanh toán'],
    headerRowIndex: 0,
    expectedCols: ['Mã sản phẩm', 'Sản phẩm', 'Tình trạng sản phẩm hiện tại', 'Tỷ lệ doanh số', 'Doanh số (VND)', 'Lượt hiển thị sản phẩm', 'Lượt nhấp vào sản phẩm', 'Tổng số đơn hàng', 'Sản phẩm', 'CTR', 'Tỷ lệ chuyển đổi đơn hàng', 'Doanh số trên mỗi đơn hàng', 'Người mua', 'Lượt hiển thị sản phẩm duy nhất', 'Lượt nhấp sản phẩm duy nhất'],
  },

  // GROUP 4: LIVE CHAT / SESSION CONTRIBUTION (3 Sheets - 15 columns each - Row 1 -> headerRowIndex 0)
  // 13. Sheet Session Contribution (place...
  {
    group: 'Group 4: Live Session',
    namePatterns: ['session contribution (place', 'session contribution (placed orders)'],
    headerRowIndex: 0,
    expectedCols: ['Mã Phiên Chat', 'Session Title', 'Tỷ lệ doanh số', 'Doanh số (VND)', 'GPM', 'psd_label_orders', 'Sản phẩm', 'Lượt xem Livestream', 'Người xem Livestream', 'Avg. Watch Duration', 'Bình luận', 'Lượt nhấp vào sản phẩm', 'CTR', 'ATC', 'Tỷ lệ chuyển đổi đơn hàng'],
  },
  // 14. Sheet Session Contribution (confi...
  {
    group: 'Group 4: Live Session',
    namePatterns: ['session contribution (confi', 'session contribution (confirmed orders)'],
    headerRowIndex: 0,
    expectedCols: ['Mã Phiên Chat', 'Session Title', 'Tỷ lệ doanh số', 'Doanh số (VND)', 'GPM', 'psd_label_orders', 'Sản phẩm', 'Lượt xem Livestream', 'Người xem Livestream', 'Avg. Watch Duration', 'Bình luận', 'Lượt nhấp vào sản phẩm', 'CTR', 'ATC', 'Tỷ lệ chuyển đổi đơn hàng'],
  },
  // 15. Sheet Session Contribution (paid ...
  {
    group: 'Group 4: Live Session',
    namePatterns: ['session contribution (paid', 'session contribution (paid orders)'],
    headerRowIndex: 0,
    expectedCols: ['Mã Phiên Chat', 'Session Title', 'Tỷ lệ doanh số', 'Doanh số (VND)', 'GPM', 'psd_label_orders', 'Sản phẩm', 'Lượt xem Livestream', 'Người xem Livestream', 'Avg. Watch Duration', 'Bình luận', 'Lượt nhấp vào sản phẩm', 'CTR', 'ATC', 'Tỷ lệ chuyển đổi đơn hàng'],
  },

  // GROUP 5: SHOPEE VIDEO CONTRIBUTION (3 Sheets - 15 columns each - Row 1 -> headerRowIndex 0)
  // 16. Sheet Video Contribution (placed ...
  {
    group: 'Group 5: Shopee Video',
    namePatterns: ['video contribution (placed', 'video contribution (placed orders)'],
    headerRowIndex: 0,
    expectedCols: ['psd_label_video_id', 'Video', 'Tỷ lệ doanh số', 'Doanh số (VND)', 'GPM', 'psd_label_orders', 'Sản phẩm', 'Lượt xem Video', 'Người xem Video', 'Bình luận', 'Lượt thích', 'Lượt nhấp vào sản phẩm', 'CTR', 'Tỷ lệ chuyển đổi đơn hàng', 'Người mua'],
  },
  // 17. Sheet Video Contribution (confirm...
  {
    group: 'Group 5: Shopee Video',
    namePatterns: ['video contribution (confirm', 'video contribution (confirmed orders)'],
    headerRowIndex: 0,
    expectedCols: ['psd_label_video_id', 'Video', 'Tỷ lệ doanh số', 'Doanh số (VND)', 'GPM', 'psd_label_orders', 'Sản phẩm', 'Lượt xem Video', 'Người xem Video', 'Bình luận', 'Lượt thích', 'Lượt nhấp vào sản phẩm', 'CTR', 'Tỷ lệ chuyển đổi đơn hàng', 'Người mua'],
  },
  // 18. Sheet Video Contribution (paid or...
  {
    group: 'Group 5: Shopee Video',
    namePatterns: ['video contribution (paid', 'video contribution (paid orders)'],
    headerRowIndex: 0,
    expectedCols: ['psd_label_video_id', 'Video', 'Tỷ lệ doanh số', 'Doanh số (VND)', 'GPM', 'psd_label_orders', 'Sản phẩm', 'Lượt xem Video', 'Người xem Video', 'Bình luận', 'Lượt thích', 'Lượt nhấp vào sản phẩm', 'CTR', 'Tỷ lệ chuyển đổi đơn hàng', 'Người mua'],
  },

  // GROUP 6: AFFILIATE / KOC CONTRIBUTION (3 Sheets - 11 columns each - Row 1 -> headerRowIndex 0)
  // 19. Sheet Affiliate Contribution (pla...
  {
    group: 'Group 6: Affiliate KOC',
    namePatterns: ['affiliate contribution (pla', 'affiliate contribution (placed orders)'],
    headerRowIndex: 0,
    expectedCols: ['Affiliate Username', 'Tỷ lệ doanh số', 'Doanh số (VND)', 'psd_label_orders', 'Sản phẩm', 'Lượt xem nội dung', 'Lượt nhấp vào sản phẩm', 'CTR', 'Tỷ lệ chuyển đổi đơn hàng', 'Doanh số trên mỗi đơn hàng', 'Người mua'],
  },
  // 20. Sheet Affiliate Contribution (con...
  {
    group: 'Group 6: Affiliate KOC',
    namePatterns: ['affiliate contribution (con', 'affiliate contribution (confirmed orders)'],
    headerRowIndex: 0,
    expectedCols: ['Affiliate Username', 'Tỷ lệ doanh số', 'Doanh số (VND)', 'psd_label_orders', 'Sản phẩm', 'Lượt xem nội dung', 'Lượt nhấp vào sản phẩm', 'CTR', 'Tỷ lệ chuyển đổi đơn hàng', 'Doanh số trên mỗi đơn hàng', 'Người mua'],
  },
  // 21. Sheet Affiliate Contribution (pai...
  {
    group: 'Group 6: Affiliate KOC',
    namePatterns: ['affiliate contribution (pai', 'affiliate contribution (paid orders)'],
    headerRowIndex: 0,
    expectedCols: ['Affiliate Username', 'Tỷ lệ doanh số', 'Doanh số (VND)', 'psd_label_orders', 'Sản phẩm', 'Lượt xem nội dung', 'Lượt nhấp vào sản phẩm', 'CTR', 'Tỷ lệ chuyển đổi đơn hàng', 'Doanh số trên mỗi đơn hàng', 'Người mua'],
  },
];

// Helper to find matching config for a sheet name
function getMatchingConfig(sheetName: string): SheetConfig {
  const norm = sheetName.toLowerCase().trim();
  for (const cfg of SHOPEE_21_SHEET_CONFIGS) {
    if (cfg.namePatterns.some((pattern) => norm.startsWith(pattern) || norm.includes(pattern))) {
      return cfg;
    }
  }

  // Fallback defaults
  if (norm.includes('sản phẩm') || norm.includes('product')) {
    return { group: 'Group 3: Product Performance', namePatterns: [], headerRowIndex: 1, expectedCols: [] };
  }
  if (norm.includes('session') || norm.includes('live')) {
    return { group: 'Group 4: Live Session', namePatterns: [], headerRowIndex: 1, expectedCols: [] };
  }
  if (norm.includes('video')) {
    return { group: 'Group 5: Shopee Video', namePatterns: [], headerRowIndex: 1, expectedCols: [] };
  }
  if (norm.includes('affiliate') || norm.includes('koc')) {
    return { group: 'Group 6: Affiliate KOC', namePatterns: [], headerRowIndex: 1, expectedCols: [] };
  }
  if (norm.includes('theo nguồn') || norm.includes('lưu lượng')) {
    return { group: 'Group 2: Detailed Traffic', namePatterns: [], headerRowIndex: 2, expectedCols: [] };
  }

  return { group: 'Dữ liệu chung', namePatterns: [], headerRowIndex: 0, expectedCols: [] };
}

// Convert sheet to JSON taking header row index into account (with smart header detection)
function parseWorksheetWithHeaderRow(worksheet: XLSX.WorkSheet, headerRowIndex: number): { headers: string[]; rows: Record<string, any>[] } {
  // Convert worksheet to 2D array of rows
  const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  if (!rawRows || rawRows.length === 0) {
    return { headers: [], rows: [] };
  }

  // Smart header row index detection
  let actualHeaderIdx = headerRowIndex;
  if (rawRows.length > headerRowIndex) {
    const candidate = rawRows[headerRowIndex] || [];
    const joined = candidate.map((c) => String(c).trim().toLowerCase()).join(' ');
    const isGoodHeader =
      joined.includes('ngày') ||
      joined.includes('nguồn lưu lượng') ||
      joined.includes('mã sản phẩm') ||
      (joined.includes('sản phẩm') && joined.includes('doanh số')) ||
      joined.includes('mã phiên chat') ||
      joined.includes('session title') ||
      joined.includes('psd_label_video_id') ||
      joined.includes('affiliate username') ||
      joined.includes('tổng doanh số') ||
      joined.includes('doanh số');

    if (!isGoodHeader) {
      // Scan top 6 rows to locate best matching header
      for (let i = 0; i < Math.min(rawRows.length, 6); i++) {
        const rowJoined = (rawRows[i] || []).map((c) => String(c).trim().toLowerCase()).join(' ');
        if (
          rowJoined.includes('ngày') ||
          rowJoined.includes('nguồn lưu lượng') ||
          rowJoined.includes('mã sản phẩm') ||
          (rowJoined.includes('sản phẩm') && rowJoined.includes('doanh số')) ||
          rowJoined.includes('mã phiên chat') ||
          rowJoined.includes('session title') ||
          rowJoined.includes('psd_label_video_id') ||
          rowJoined.includes('affiliate username') ||
          rowJoined.includes('tổng doanh số')
        ) {
          actualHeaderIdx = i;
          break;
        }
      }
    }
  }

  if (rawRows.length <= actualHeaderIdx) {
    return { headers: [], rows: [] };
  }

  // Get header row
  const rawHeaderRow = rawRows[actualHeaderIdx] || [];
  const headers = rawHeaderRow.map((h, i) => (h ? String(h).trim() : `Cột_${i + 1}`));

  const rows: Record<string, any>[] = [];
  for (let r = actualHeaderIdx + 1; r < rawRows.length; r++) {
    const rowArray = rawRows[r];
    if (!rowArray || rowArray.every((cell) => cell === '' || cell === null || cell === undefined)) continue;

    const firstCell = String(rowArray[0] || '').trim().toLowerCase();
    const rowJoined = rowArray.map((c) => String(c || '').trim().toLowerCase()).join(' ');

    // Filter out summary/total rows to prevent double counting
    if (
      firstCell === 'tổng cộng' ||
      firstCell === 'tổng' ||
      firstCell === 'total' ||
      firstCell === 'grand total' ||
      firstCell === 'tất cả' ||
      firstCell === 'summary'
    ) {
      continue;
    }

    // Filter out duplicate header lines within data rows
    if (
      (rowJoined.includes('ngày') && rowJoined.includes('doanh số') && rowJoined.includes('đơn')) ||
      (rowJoined.includes('mã sản phẩm') && rowJoined.includes('tên sản phẩm')) ||
      (rowJoined.includes('nguồn lưu lượng') && rowJoined.includes('tỷ lệ'))
    ) {
      continue;
    }

    // Filter out metadata noise
    if (
      rowJoined.includes('báo cáo được xuất') ||
      rowJoined.includes('dữ liệu từ ngày') ||
      rowJoined.includes('thông tin metadata') ||
      rowJoined.includes('bản quyền thuộc')
    ) {
      continue;
    }

    const rowObj: Record<string, any> = {};
    headers.forEach((header, colIdx) => {
      rowObj[header] = rowArray[colIdx] !== undefined ? rowArray[colIdx] : '';
    });
    rows.push(rowObj);
  }

  return { headers, rows };
}

// Multi-section product sheet parser (for sheets like "Theo sản phẩm (đơn đã đặt)")
export function parseMultiSectionProductSheet(
  worksheet: XLSX.WorkSheet | undefined,
  stage: 'placed' | 'confirmed' | 'paid'
): ChannelProductItem[] {
  if (!worksheet) return [];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  if (!rawRows || rawRows.length === 0) return [];

  const items: ChannelProductItem[] = [];
  let currentSection = 'Thẻ sản phẩm';
  let headerMap: { [colIdx: number]: string } | null = null;

  for (let r = 0; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;

    const cell0 = String(row[0] || '').trim();
    const cell1 = String(row[1] || '').trim();
    const rowJoined = row.map((c) => String(c).trim().toLowerCase()).join(' ');

    if (!rowJoined) continue;

    // 1. Skip sheet-level overview summary rows at top of sheet (rows 0-1)
    // E.g.: ['Ngày', 'Loại Đơn Hàng', 'Doanh số (VND)', ...] or ['24-07-2026-22-08-2026', 'Đơn Đã Thanh Toán', ...]
    const lower0 = cell0.toLowerCase();
    const lower1 = cell1.toLowerCase();
    if (
      rowJoined.includes('loại đơn hàng') ||
      lower1 === 'đơn đã thanh toán' ||
      lower1 === 'đơn hàng đã đặt' ||
      lower1 === 'đơn đã xác nhận' ||
      /^\d{2}-\d{2}-\d{4}-\d{2}-\d{2}-\d{4}/.test(cell0) ||
      (lower0.includes('ngày') && lower1.includes('loại'))
    ) {
      continue;
    }

    const isSectionHeader =
      (cell0.length > 0 &&
        cell1.length === 0 &&
        !lower0.includes('mã') &&
        !lower0.includes('ngày') &&
        !lower0.includes('stt') &&
        !lower0.includes('tổng')) ||
      lower0 === 'thẻ sản phẩm' ||
      lower0 === 'live' ||
      lower0 === 'video' ||
      lower0.includes('tiếp thị liên kết') ||
      lower0.includes('cửa hàng') ||
      lower0.includes('tìm kiếm');

    if (isSectionHeader && !rowJoined.includes('mã sản phẩm') && !rowJoined.includes('sản phẩm')) {
      currentSection = cell0;
      headerMap = null; // Reset headerMap until section column header row is encountered
      continue;
    }

    // Check if row is a column header row for the current section
    if (
      rowJoined.includes('mã sản phẩm') ||
      (rowJoined.includes('sản phẩm') && (rowJoined.includes('doanh số') || rowJoined.includes('tỷ lệ') || rowJoined.includes('tổng số đơn')))
    ) {
      headerMap = {};
      row.forEach((colVal: any, colIdx: number) => {
        if (colVal) headerMap![colIdx] = String(colVal).trim().toLowerCase();
      });
      continue;
    }

    // ONLY parse if headerMap is active for the current section
    if (!headerMap) {
      continue;
    }

    // Helper to find column index with precise matching rules
    const findExactColIdx = (predicate: (h: string) => boolean, fallbackIdx?: number): number => {
      for (const [idxStr, hName] of Object.entries(headerMap!)) {
        if (predicate(hName)) {
          return Number(idxStr);
        }
      }
      return fallbackIdx !== undefined ? fallbackIdx : -1;
    };

    // 1. Mã sản phẩm (Product ID)
    const prodIdCol = findExactColIdx(
      (h) => (h.includes('mã') || h.includes('item id') || h.includes('product id')) && !h.includes('phiên') && !h.includes('video'),
      0
    );

    // 2. Tên sản phẩm (Product Name) - MUST NOT match 'mã sản phẩm', 'tỷ lệ', 'lượt'
    const nameCol = findExactColIdx(
      (h) => (h === 'sản phẩm' || h.includes('tên sản phẩm') || h.includes('tên sp') || h === 'tên') &&
             !h.includes('mã') && !h.includes('tỷ lệ') && !h.includes('tỉ lệ') && !h.includes('lượt') && !h.includes('nhấp'),
      1
    );

    // 3. Tình trạng
    const statusCol = findExactColIdx((h) => h.includes('tình trạng') || h.includes('trạng thái'), 2);

    // 4. Tỷ lệ doanh số (Share)
    const shareCol = findExactColIdx((h) => h.includes('tỷ lệ doanh số') || h.includes('tỉ lệ doanh số') || h.includes('tỷ lệ doanh thu'), 3);

    // 5. Doanh số (VND) (Revenue) - MUST NOT match 'tỷ lệ' or 'trên mỗi'
    const revCol = findExactColIdx(
      (h) => (h.includes('doanh số') || h.includes('doanh thu') || h.includes('revenue')) &&
             !h.includes('tỷ lệ') && !h.includes('tỉ lệ') && !h.includes('trên mỗi') && !h.includes('đơn hủy'),
      4
    );

    // 6. Lượt hiển thị
    const impCol = findExactColIdx((h) => h.includes('hiển thị') || h.includes('impressions'), 5);

    // 7. Lượt nhấp
    const clickCol = findExactColIdx((h) => h.includes('lượt nhấp') || h.includes('clicks') || (h.includes('nhấp') && !h.includes('duy nhất')), 6);

    // 8. Tổng số đơn hàng
    const ordCol = findExactColIdx((h) => (h.includes('tổng số đơn hàng') || h.includes('số đơn hàng') || h.includes('orders')) && !h.includes('không bao gồm'), 7);

    const ctrCol = findExactColIdx((h) => h === 'ctr', 9);
    const crCol = findExactColIdx((h) => h.includes('chuyển đổi') || h === 'cr', 10);

    let prodIdRaw = prodIdCol >= 0 ? row[prodIdCol] : row[0];
    let nameRaw = nameCol >= 0 ? row[nameCol] : row[1];

    let nameStr = String(nameRaw || '').trim();
    let prodId = String(prodIdRaw || `PROD-${r}`).trim();

    // If name is purely numeric (e.g. ID was parsed into name), look for actual text column
    if (/^\d{6,}$/.test(nameStr)) {
      prodId = nameStr;
      // Search other columns for text
      let foundText = '';
      for (let c = 0; c < row.length; c++) {
        if (c === prodIdCol) continue;
        const cellVal = String(row[c] || '').trim();
        if (cellVal.length > 3 && !/^\d+([.,]\d+)?$/.test(cellVal) && !cellVal.toLowerCase().includes('đang hoạt động')) {
          foundText = cellVal;
          break;
        }
      }
      nameStr = foundText || nameStr;
    }

    // Invalid product filter: reject header words, totals, date ranges, and order-type names
    const isInvalidProductName = (name: string, id: string): boolean => {
      if (!name) return true;
      const lowerN = name.toLowerCase().trim();
      const lowerI = id.toLowerCase().trim();
      if (
        lowerN === 'sản phẩm' ||
        lowerN.includes('mã sản phẩm') ||
        lowerN === 'tổng cộng' ||
        lowerN === 'tổng' ||
        lowerN === 'total' ||
        lowerN.includes('loại đơn hàng') ||
        lowerN.includes('đơn đã thanh toán') ||
        lowerN.includes('đơn hàng đã đặt') ||
        lowerN.includes('đơn đã xác nhận') ||
        /^\d{2}-\d{2}-\d{4}/.test(lowerN) ||
        /^\d{2}-\d{2}-\d{4}/.test(lowerI)
      ) {
        return true;
      }
      return false;
    };

    if (isInvalidProductName(nameStr, prodId)) {
      continue;
    }

    const status = String(statusCol >= 0 ? row[statusCol] : 'Đang hoạt động');
    const shareVal = shareCol >= 0 ? row[shareCol] : undefined;
    const revVal = revCol >= 0 ? row[revCol] : undefined;
    const impVal = impCol >= 0 ? row[impCol] : undefined;
    const clickVal = clickCol >= 0 ? row[clickCol] : undefined;
    const ordVal = ordCol >= 0 ? row[ordCol] : undefined;
    const ctrVal = ctrCol >= 0 ? row[ctrCol] : undefined;
    const crVal = crCol >= 0 ? row[crCol] : undefined;

    const revenue = cleanNumber(revVal);
    const share = cleanPercentage(shareVal);
    const impressions = cleanNumber(impVal);
    const clicks = cleanNumber(clickVal);
    const orders = cleanNumber(ordVal);
    const ctr = ctrVal ? cleanPercentage(ctrVal) : impressions > 0 ? +((clicks / impressions) * 100).toFixed(2) : 0;
    const cr = crVal ? cleanPercentage(crVal) : clicks > 0 ? +((orders / clicks) * 100).toFixed(2) : 0;

    if (prodId || nameStr) {
      items.push({
        id: prodId,
        name: nameStr,
        channel: currentSection,
        stage,
        status,
        revenueShare: share,
        revenue,
        impressions,
        clicks,
        orders,
        ctr,
        conversionRate: cr,
      });
    }
  }

  return items;
}

// =========================================================================
// MAIN 21-SHEET DETERMINISTIC SHOPEE EXCEL PARSER WITH MULTI-SHEET JOIN
// =========================================================================

export async function parseShopeeExcelFile(file: File): Promise<ParsedStoreData> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  const sheetNames = workbook.SheetNames;
  if (!sheetNames || sheetNames.length === 0) {
    throw new Error('File Excel rỗng hoặc không có sheet hợp lệ.');
  }

  // Check if this is a Standardized Universal Workbook (7 Sheets: sales_daily, traffic_source... or legacy 4 Sheets)
  const isSalesDaily = sheetNames.some((s) => s.toLowerCase() === 'sales_daily');
  const isStandardized = isSalesDaily || sheetNames.some((s) => {
    const lower = s.toLowerCase();
    return lower === 'daily_metrics' || lower === 'channel_performance' || lower === 'product_performance';
  });

  if (isSalesDaily) {
    const cleanedData = localAgentCleanAndStandardize(workbook, undefined, 'Shopee');
    return convertCleanedAgentDataToStoreData(cleanedData, file.name);
  }

  if (isStandardized) {
    const dailySheet = workbook.Sheets['Daily_Metrics'] || workbook.Sheets[sheetNames.find((s) => s.toLowerCase() === 'daily_metrics') || ''];
    const channelSheet = workbook.Sheets['Channel_Performance'] || workbook.Sheets[sheetNames.find((s) => s.toLowerCase() === 'channel_performance') || ''];
    const productSheet = workbook.Sheets['Product_Performance'] || workbook.Sheets[sheetNames.find((s) => s.toLowerCase() === 'product_performance') || ''];
    const kocSheet = workbook.Sheets['KOC_Affiliate_Performance'] || workbook.Sheets[sheetNames.find((s) => s.toLowerCase() === 'koc_affiliate_performance') || ''];

    const dailyRows = dailySheet ? XLSX.utils.sheet_to_json(dailySheet, { defval: '' }) : [];
    const channelRows = channelSheet ? XLSX.utils.sheet_to_json(channelSheet, { defval: '' }) : [];
    const productRows = productSheet ? XLSX.utils.sheet_to_json(productSheet, { defval: '' }) : [];
    const kocRows = kocSheet ? XLSX.utils.sheet_to_json(kocSheet, { defval: '' }) : [];

    const stdData: StandardizedWorkbookData = {
      sales_daily: dailyRows.map((r: any) => ({
        company: 'Gian Hàng TMĐT',
        platform: 'Shopee',
        date: parseStandardDate(r['Ngày (DD-MM-YYYY)'] || r['Ngày'] || r['Date'] || '2024-08-08'),
        order_status: 'placed',
        gross_revenue_vnd: cleanNumber(r['Tổng doanh số đặt'] || r['GMV'] || 0),
        net_revenue_ex_subsidy_vnd: cleanNumber(r['Doanh số thực nhận (Paid)'] || r['Doanh thu thực nhận'] || 0),
        orders: cleanNumber(r['Tổng số đơn'] || r['Số đơn'] || 0),
        aov_vnd: cleanNumber(r['AOV'] || 0),
        product_clicks: cleanNumber(r['Lượt nhấp vào sản phẩm'] || 0),
        visits: cleanNumber(r['Số lượt truy cập'] || 0),
        conversion_rate: cleanPercentage(r['Tỷ lệ chuyển đổi đơn hàng'] || r['CR'] || 0) / 100,
        cancelled_orders: cleanNumber(r['Số đơn hủy'] || r['Đơn hủy'] || 0),
        cancelled_revenue_vnd: cleanNumber(r['Doanh số đơn hủy'] || 0),
        refunded_orders: cleanNumber(r['Số đơn hoàn'] || r['Đơn hoàn'] || 0),
        refunded_revenue_vnd: cleanNumber(r['Doanh số đơn hoàn'] || 0),
        buyers: cleanNumber(r['Người mua'] || 0),
        new_buyers: cleanNumber(r['Người mua mới'] || 0),
        returning_buyers: cleanNumber(r['Người mua quay lại'] || 0),
        potential_buyers: null,
        repeat_buyer_rate: null,
      })),
      traffic_source: channelRows.map((r: any) => ({
        company: 'Gian Hàng TMĐT',
        platform: 'Shopee',
        period: 'Toàn kỳ',
        traffic_source: String(r['Nguồn lưu lượng'] || r['Kênh'] || 'Kênh TMĐT'),
        revenue_vnd: cleanNumber(r['Doanh số (VND)'] || r['Doanh số'] || 0),
        revenue_share: null,
        impressions: null,
        unique_impressions: null,
        clicks: null,
        unique_clicks: null,
        ctr: null,
        orders: cleanNumber(r['Số đơn hàng'] || r['Số đơn'] || 0),
        conversion_rate: cleanPercentage(r['Tỷ lệ chuyển đổi (%)'] || r['Tỷ lệ chuyển đổi'] || 0) / 100,
        buyers: null,
        revenue_per_order_vnd: null,
      })),
      product_performance: productRows.map((r: any) => ({
        company: 'Gian Hàng TMĐT',
        platform: 'Shopee',
        date: null,
        sku: String(r['Mã sản phẩm'] || r['SKU'] || 'SKU-001'),
        product_name: String(r['Tên sản phẩm'] || r['Sản phẩm'] || 'Sản phẩm'),
        sales_share: null,
        revenue_vnd: cleanNumber(r['Doanh số (VND)'] || r['Doanh số'] || 0),
        impressions: null,
        clicks: cleanNumber(r['Lượt xem'] || 0),
        ctr: null,
        orders: null,
        items_sold: cleanNumber(r['Số lượng bán'] || r['Số lượng'] || 0),
        conversion_rate: cleanPercentage(r['Tỷ lệ chuyển đổi (%)'] || r['Tỷ lệ chuyển đổi'] || 0) / 100,
        revenue_per_order_vnd: null,
        stock_status: 'Đang bán',
        campaign_tag: null,
      })),
      content_attribution: kocRows.map((r: any) => ({
        company: 'Gian Hàng TMĐT',
        platform: 'Shopee',
        content_type: 'Affiliate',
        content_id: null,
        content_name: String(r['Affiliate Username'] || r['KOC'] || 'Creator'),
        views: null,
        unique_viewers: null,
        watch_time: null,
        product_clicks: null,
        orders_placed: cleanNumber(r['Số đơn hàng'] || r['Số đơn'] || 0),
        orders_confirmed: cleanNumber(r['Số đơn hàng'] || r['Số đơn'] || 0),
        orders_paid: cleanNumber(r['Số đơn hàng'] || r['Số đơn'] || 0),
        revenue_placed_vnd: cleanNumber(r['Doanh số (VND)'] || r['Doanh số'] || 0),
        revenue_confirmed_vnd: cleanNumber(r['Doanh số (VND)'] || r['Doanh số'] || 0),
        revenue_paid_vnd: cleanNumber(r['Doanh số (VND)'] || r['Doanh số'] || 0),
        comments: null,
        likes: null,
        shares: null,
      })),
      unmapped_data: [],
      mapping_log: [],
      validation_log: [],
      telemetry: {
        totalSheetsRead: sheetNames.length,
        totalRowsProcessed: dailyRows.length + channelRows.length + productRows.length + kocRows.length,
        mappedFieldsCount: 20,
        reviewFieldsCount: 0,
        validationIssuesCount: 0,
        reconciliationStatus: 'PASS',
        detectedPlatform: 'Shopee',
        detectedCompany: 'Gian Hàng TMĐT',
        processedAt: new Date().toISOString(),
        engineUsed: 'Legacy Standardized Converter',
      },
    };

    return convertCleanedAgentDataToStoreData(stdData, file.name);
  }

  const rawSheets: Record<string, RawSheetTable> = {};
  const sheetDataMap = new Map<string, { headers: string[]; rows: Record<string, any>[]; config: SheetConfig }>();

  // 1. Parse each sheet according to its exact header row index
  for (const sheetName of sheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const config = getMatchingConfig(sheetName);
    const { headers, rows } = parseWorksheetWithHeaderRow(worksheet, config.headerRowIndex);

    sheetDataMap.set(sheetName, { headers, rows, config });
    rawSheets[sheetName] = {
      sheetName,
      groupName: config.group,
      headerRowIndex: config.headerRowIndex,
      headers,
      rows,
      totalRowCount: rows.length,
    };
  }

  // 2. Identify Key Sheets for Group 1 (Executive Overview)
  const placedOverviewSheet = Array.from(sheetDataMap.entries()).find(([name]) => {
    const n = name.toLowerCase();
    return n.includes('đơn hàng đã đặt') || (n.includes('placed') && !n.includes('theo') && !n.includes('session') && !n.includes('video') && !n.includes('affiliate'));
  });

  const confirmedOverviewSheet = Array.from(sheetDataMap.entries()).find(([name]) => {
    const n = name.toLowerCase();
    return n.includes('đơn đã xác nhận') || (n.includes('confirmed') && !n.includes('theo') && !n.includes('session') && !n.includes('video') && !n.includes('affiliate'));
  });

  const paidOverviewSheet = Array.from(sheetDataMap.entries()).find(([name]) => {
    const n = name.toLowerCase();
    return n.includes('đơn đã thanh toán') || (n.includes('paid') && !n.includes('theo') && !n.includes('session') && !n.includes('video') && !n.includes('affiliate'));
  });

  // Extract Executive KPIs
  let placedRev = 0;
  let placedOrders = 0;
  let confirmedRev = 0;
  let confirmedOrders = 0;
  let paidRev = 0;
  let paidOrders = 0;
  let actualRevenue = 0;
  let totalSubsidies = 0;
  let cancelledOrders = 0;
  let returnedOrders = 0;
  let cancellationRev = 0;
  let totalBuyers = 0;
  let newBuyers = 0;
  let returningBuyers = 0;
  let potentialBuyers = 0;
  let repeatPurchaseRate = 0;
  let periodLabel = 'Toàn bộ kỳ báo cáo';

  // Parse Group 1 Placed sheet
  if (placedOverviewSheet && placedOverviewSheet[1].rows.length > 0) {
    const rows = placedOverviewSheet[1].rows;
    const firstRow = rows[0];

    const dateCol = findColumn(firstRow, ['ngày', 'date']);
    if (dateCol && firstRow[dateCol]) {
      periodLabel = String(firstRow[dateCol]);
    }

    const revCol = findColumn(firstRow, ['tổng doanh số', 'doanh số (vnd)', 'gross revenue', 'doanh số']);
    const ordersCol = findColumn(firstRow, ['tổng số đơn hàng', 'số đơn hàng', 'orders', 'đơn hàng']);
    const cancelCol = findColumn(firstRow, ['đơn đã hủy', 'đơn đã huỷ', 'đơn huỷ', 'cancelled']);
    const cancelRevCol = findColumn(firstRow, ['doanh số đơn hủy', 'doanh số đơn huỷ']);
    const returnCol = findColumn(firstRow, ['đơn đã hoàn trả', 'hoàn trả', 'hoàn tiền']);
    const buyerCol = findColumn(firstRow, ['số người mua', 'người mua', 'total buyers']);
    const newBuyerCol = findColumn(firstRow, ['số người mua mới', 'người mua mới']);
    const existBuyerCol = findColumn(firstRow, ['số người mua hiện tại', 'người mua cũ', 'returning']);
    const potBuyerCol = findColumn(firstRow, ['số người mua tiềm năng', 'tiềm năng']);
    const repeatCol = findColumn(firstRow, ['tỉ lệ quay lại', 'tỷ lệ quay lại', 'repeat rate']);

    const isSummaryRow = (r: Record<string, any>, dCol?: string): boolean => {
      if (!r) return false;
      const dVal = dCol ? String(r[dCol] || '').trim() : '';
      if (dVal.includes(' - ') || (dVal.match(/\d{2,4}/g) || []).length >= 4) return true;
      const lower = dVal.toLowerCase();
      if (lower.includes('tổng') || lower.includes('toàn bộ') || lower.includes('total')) return true;
      return false;
    };

    if (isSummaryRow(firstRow, dateCol) || rows.length === 1) {
      // Row 0 is the period summary row from Shopee
      placedRev = cleanNumber(revCol ? firstRow[revCol] : 0);
      placedOrders = cleanNumber(ordersCol ? firstRow[ordersCol] : 0);
      cancelledOrders = cleanNumber(cancelCol ? firstRow[cancelCol] : 0);
      cancellationRev = cleanNumber(cancelRevCol ? firstRow[cancelRevCol] : 0);
      returnedOrders = cleanNumber(returnCol ? firstRow[returnCol] : 0);
      totalBuyers = cleanNumber(buyerCol ? firstRow[buyerCol] : 0);
      newBuyers = cleanNumber(newBuyerCol ? firstRow[newBuyerCol] : 0);
      returningBuyers = cleanNumber(existBuyerCol ? firstRow[existBuyerCol] : 0);
      potentialBuyers = cleanNumber(potBuyerCol ? firstRow[potBuyerCol] : 0);
    } else {
      // Sum across rows (if multiple daily rows without aggregate row)
      rows.forEach((r) => {
        placedRev += cleanNumber(revCol ? r[revCol] : 0);
        placedOrders += cleanNumber(ordersCol ? r[ordersCol] : 0);
        cancelledOrders += cleanNumber(cancelCol ? r[cancelCol] : 0);
        cancellationRev += cleanNumber(cancelRevCol ? r[cancelRevCol] : 0);
        returnedOrders += cleanNumber(returnCol ? r[returnCol] : 0);
        totalBuyers += cleanNumber(buyerCol ? r[buyerCol] : 0);
        newBuyers += cleanNumber(newBuyerCol ? r[newBuyerCol] : 0);
        returningBuyers += cleanNumber(existBuyerCol ? r[existBuyerCol] : 0);
        potentialBuyers += cleanNumber(potBuyerCol ? r[potBuyerCol] : 0);
      });
    }

    if (repeatCol && rows[0][repeatCol]) {
      repeatPurchaseRate = cleanPercentage(rows[0][repeatCol]);
    }
  }

  // Parse Group 1 Confirmed sheet
  if (confirmedOverviewSheet && confirmedOverviewSheet[1].rows.length > 0) {
    const rows = confirmedOverviewSheet[1].rows;
    const firstRow = rows[0];
    const dateCol = findColumn(firstRow, ['ngày', 'date']);
    const revCol = findColumn(firstRow, ['tổng doanh số', 'doanh số (vnd)', 'gross revenue', 'doanh số']);
    const ordersCol = findColumn(firstRow, ['tổng số đơn hàng', 'số đơn hàng', 'orders', 'đơn hàng']);

    const isSummaryRow = (r: Record<string, any>, dCol?: string): boolean => {
      if (!r) return false;
      const dVal = dCol ? String(r[dCol] || '').trim() : '';
      if (dVal.includes(' - ') || (dVal.match(/\d{2,4}/g) || []).length >= 4) return true;
      const lower = dVal.toLowerCase();
      if (lower.includes('tổng') || lower.includes('toàn bộ') || lower.includes('total')) return true;
      return false;
    };

    if (isSummaryRow(firstRow, dateCol) || rows.length === 1) {
      confirmedRev = cleanNumber(revCol ? firstRow[revCol] : 0);
      confirmedOrders = cleanNumber(ordersCol ? firstRow[ordersCol] : 0);
    } else {
      rows.forEach((r) => {
        confirmedRev += cleanNumber(revCol ? r[revCol] : 0);
        confirmedOrders += cleanNumber(ordersCol ? r[ordersCol] : 0);
      });
    }
  }

  // Parse Group 1 Paid sheet
  if (paidOverviewSheet && paidOverviewSheet[1].rows.length > 0) {
    const rows = paidOverviewSheet[1].rows;
    const firstRow = rows[0];
    const dateCol = findColumn(firstRow, ['ngày', 'date']);
    const revCol = findColumn(firstRow, ['tổng doanh số', 'doanh số (vnd)', 'gross revenue', 'doanh số']);
    const ordersCol = findColumn(firstRow, ['tổng số đơn hàng', 'số đơn hàng', 'orders', 'đơn hàng']);
    const noSubsidyCol = findColumn(firstRow, ['doanh số không bao gồm trợ giá', 'không bao gồm trợ giá']);

    const isSummaryRow = (r: Record<string, any>, dCol?: string): boolean => {
      if (!r) return false;
      const dVal = dCol ? String(r[dCol] || '').trim() : '';
      if (dVal.includes(' - ') || (dVal.match(/\d{2,4}/g) || []).length >= 4) return true;
      const lower = dVal.toLowerCase();
      if (lower.includes('tổng') || lower.includes('toàn bộ') || lower.includes('total')) return true;
      return false;
    };

    if (isSummaryRow(firstRow, dateCol) || rows.length === 1) {
      paidRev = cleanNumber(revCol ? firstRow[revCol] : 0);
      paidOrders = cleanNumber(ordersCol ? firstRow[ordersCol] : 0);
      if (noSubsidyCol && firstRow[noSubsidyCol]) {
        actualRevenue = cleanNumber(firstRow[noSubsidyCol]);
      }
    } else {
      rows.forEach((r) => {
        paidRev += cleanNumber(revCol ? r[revCol] : 0);
        paidOrders += cleanNumber(ordersCol ? r[ordersCol] : 0);
        if (noSubsidyCol && r[noSubsidyCol]) {
          actualRevenue += cleanNumber(r[noSubsidyCol]);
        }
      });
    }
  }

  // If Group 1 overview was not found or was empty, check if this is an Order-item list export
  const allOrdersList: OrderItem[] = [];
  if (placedRev === 0 && paidRev === 0) {
    // Fallback: Use order items list parser across sheets
    sheetDataMap.forEach(({ rows }, sName) => {
      if (rows.length === 0) return;
      const sample = rows[0];
      const orderIdCol = findColumn(sample, ['mãđơnhàng', 'orderid', 'ordersn', 'mãđơn', 'orderno']);
      const priceCol = findColumn(sample, ['doanhthuthực', 'giábán', 'tổngtiền', 'tổngthanhtoán', 'totalamount', 'paidamount', 'originalprice', 'tiền']);
      if (orderIdCol && priceCol) {
        rows.forEach((row, idx) => {
          const id = String(row[orderIdCol] || `ORD-${idx}`);
          const p = cleanNumber(row[priceCol], 250000);
          allOrdersList.push({
            orderId: id,
            orderDate: '2025-08-08',
            orderStatus: sName.includes('đặt') ? 'placed' : sName.includes('xác') ? 'confirmed' : 'paid',
            channel: 'organic_search',
            productName: 'Sản phẩm Shopee',
            sku: `SKU-${idx}`,
            quantity: 1,
            originalPrice: p,
            paidAmount: p,
            shopeeSubsidy: 0,
            voucherSeller: 0,
            shippingFee: 0,
            actualRevenue: p,
          });
        });
      }
    });

    if (allOrdersList.length > 0) {
      return calculateAnalyticsFromOrders(allOrdersList, file.name, `Đã nhập: ${file.name}`, sheetNames);
    }
  }

  // Legacy screens need a number for every KPI. When the workbook lacks a sheet we still
  // fill an estimate for them, but record it: the shared analytics engine treats these
  // fields as missing and alerts never fire on estimated values.
  const estimatedFields: string[] = [];
  if (actualRevenue === 0 && paidRev > 0) {
    actualRevenue = Math.round(paidRev * 0.94);
    estimatedFields.push('actualRevenue');
  }
  totalSubsidies = Math.max(0, paidRev - actualRevenue);

  if (placedOrders === 0 && paidOrders > 0) {
    placedOrders = Math.round(paidOrders * 1.25);
    estimatedFields.push('placedOrders');
  }
  if (placedRev === 0 && paidRev > 0) {
    placedRev = Math.round(paidRev * 1.3);
    estimatedFields.push('placedRevenue');
  }
  if (confirmedOrders === 0 && paidOrders > 0) {
    confirmedOrders = Math.round(paidOrders * 1.1);
    estimatedFields.push('confirmedOrders');
  }
  if (confirmedRev === 0 && paidRev > 0) {
    confirmedRev = Math.round(paidRev * 1.12);
    estimatedFields.push('confirmedRevenue');
  }

  if (cancelledOrders === 0 && placedOrders > paidOrders) {
    cancelledOrders = placedOrders - paidOrders;
  }

  // Not rounded here — the UI rounds when displaying (formatVND).
  const aov = paidOrders > 0 ? paidRev / paidOrders : 0;
  const conversionRate = placedOrders > 0 ? +((paidOrders / placedOrders) * 100).toFixed(2) : 0;
  const cancellationRate = placedOrders > 0 ? +(((placedOrders - paidOrders) / placedOrders) * 100).toFixed(2) : 0;

  const kpis: ExecutiveKpis = {
    placedRevenue: placedRev,
    confirmedRevenue: confirmedRev,
    paidRevenue: paidRev,
    actualRevenue,
    totalSubsidies,
    placedOrders,
    confirmedOrders,
    paidOrders,
    cancelledOrders,
    cancellationRate,
    aov,
    conversionRate,
    totalUnits: Math.round(paidOrders * 1.4),
  };
  estimatedFields.push('totalUnits');

  // 3. Multi-Sheet Funnel & Leakage Matrix (P0 Logic)
  const dropOffPlacedToConfirmed = Math.max(0, placedRev - confirmedRev);
  const dropOffConfirmedToPaid = Math.max(0, confirmedRev - paidRev);
  const totalLeakageVND = dropOffPlacedToConfirmed + dropOffConfirmedToPaid;

  const funnelStages: FunnelStage[] = [
    {
      stage: 'placed',
      name: '1. Đơn hàng đã đặt (Placed)',
      orders: placedOrders,
      revenue: placedRev,
      conversionRateFromStart: 100,
      dropOffRateFromPrev: 0,
      leakageRevenue: 0,
    },
    {
      stage: 'confirmed',
      name: '2. Đơn đã xác nhận (Confirmed)',
      orders: confirmedOrders,
      revenue: confirmedRev,
      conversionRateFromStart: placedOrders > 0 ? +((confirmedOrders / placedOrders) * 100).toFixed(2) : 0,
      dropOffRateFromPrev: placedOrders > 0 ? +(((placedOrders - confirmedOrders) / placedOrders) * 100).toFixed(2) : 0,
      leakageRevenue: dropOffPlacedToConfirmed,
    },
    {
      stage: 'paid',
      name: '3. Đơn Đã Thanh Toán (Paid)',
      orders: paidOrders,
      revenue: paidRev,
      conversionRateFromStart: placedOrders > 0 ? +((paidOrders / placedOrders) * 100).toFixed(2) : 0,
      dropOffRateFromPrev: confirmedOrders > 0 ? +(((confirmedOrders - paidOrders) / confirmedOrders) * 100).toFixed(2) : 0,
      leakageRevenue: dropOffConfirmedToPaid,
    },
  ];

  // 4. Parse GROUP 2: Traffic Breakdown (Summary & Detailed Sheets)
  const channels: ChannelMetric[] = [];

  // Check if workbook contains Shopee Multi-Section Traffic Sheets (Group 2)
  const getTrafficWs = (pattern: string[]) => {
    const wsName = sheetNames.find((n) => {
      const lower = n.toLowerCase();
      return pattern.every((p) => lower.includes(p));
    });
    return wsName ? workbook.Sheets[wsName] : undefined;
  };

  const wsTrafficPlaced = getTrafficWs(['nguồn truy cập cho đơn']) || getTrafficWs(['báo cáo theo nguồn truy cập']);
  const wsTrafficConfirmed = getTrafficWs(['nguồn lưu lượng truy cập (đ']) || getTrafficWs(['nguồn', 'xác nhận']);
  const wsTrafficPaid = getTrafficWs(['nguồn truy cập từ đơn']) || getTrafficWs(['nguồn', 'thanh toán']);

  const parseMultiSectionTrafficSheet = (ws?: XLSX.WorkSheet) => {
    if (!ws) return {};
    const lines: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const sections: Record<string, { name: string; revenue: number; orders: number }[]> = {};
    let currentSec = 'Thẻ sản phẩm';
    let headers: any[] | null = null;

    for (let i = 2; i < lines.length; i++) {
      const row = lines[i];
      if (!row || row.every((c) => c === '')) continue;
      const nonEmpties = row.filter((c) => c !== '');
      if (nonEmpties.length === 1 && typeof nonEmpties[0] === 'string') {
        currentSec = nonEmpties[0].trim();
        headers = null;
        continue;
      }
      if (row[0] === 'Nguồn lưu lượng' || row[0] === 'Affiliate Username') {
        headers = row;
        continue;
      }
      if (headers && row[0] && row[0] !== 'Nguồn lưu lượng') {
        const name = String(row[0]).trim();
        const revIdx = headers.findIndex((h) => String(h).includes('Doanh số (VND)') || String(h).includes('Doanh số'));
        const ordIdx = headers.findIndex((h) => String(h).includes('Tổng số đơn hàng') || String(h).includes('psd_label_orders'));

        if (!sections[currentSec]) sections[currentSec] = [];
        sections[currentSec].push({
          name,
          revenue: revIdx >= 0 ? cleanNumber(row[revIdx]) : 0,
          // Shopee splits an order between sources (391,50 · 127,92): keep the fraction.
          orders: ordIdx >= 0 ? cleanNumber(row[ordIdx]) : 0,
        });
      }
    }
    return sections;
  };

  if (wsTrafficPlaced || wsTrafficPaid) {
    const pSec = parseMultiSectionTrafficSheet(wsTrafficPlaced);
    const confSec = parseMultiSectionTrafficSheet(wsTrafficConfirmed);
    const pdSec = parseMultiSectionTrafficSheet(wsTrafficPaid);

    const getMetric = (secMap: Record<string, any[]>, sectionName: string, channelPattern: string) => {
      const list = secMap[sectionName] || [];
      const item = list.find((x) => x.name.toLowerCase().includes(channelPattern.toLowerCase()));
      return item ? { revenue: item.revenue, orders: item.orders } : { revenue: 0, orders: 0 };
    };

    const getOtherInCard = (secMap: Record<string, any[]>) => {
      const list = secMap['Thẻ sản phẩm'] || [];
      let rev = 0;
      let ord = 0;
      list.forEach((x) => {
        const l = x.name.toLowerCase();
        if (l.includes('đơn mua') || l.includes('giỏ hàng') || l.includes('chat') || l.includes('khuyến mãi') || l === 'khác') {
          rev += x.revenue;
          ord += x.orders;
        }
      });
      return { revenue: rev, orders: ord };
    };

    const canonicalChannels = [
      {
        channel: 'recommendation',
        channelName: 'Đề xuất (trong Thẻ SP)',
        placedRevenue: getMetric(pSec, 'Thẻ sản phẩm', 'Đề xuất').revenue,
        confirmedRevenue: getMetric(confSec, 'Thẻ sản phẩm', 'Đề xuất').revenue,
        paidRevenue: getMetric(pdSec, 'Thẻ sản phẩm', 'Đề xuất').revenue,
        placedOrders: getMetric(pSec, 'Thẻ sản phẩm', 'Đề xuất').orders,
        paidOrders: getMetric(pdSec, 'Thẻ sản phẩm', 'Đề xuất').orders,
      },
      {
        channel: 'affiliate',
        channelName: 'Tiếp thị liên kết',
        placedRevenue: getMetric(pSec, 'Tiếp thị liên kết', 'Tiếp thị liên kết').revenue,
        confirmedRevenue: getMetric(confSec, 'Tiếp thị liên kết', 'Tiếp thị liên kết').revenue,
        paidRevenue: getMetric(pdSec, 'Tiếp thị liên kết', 'Tiếp thị liên kết').revenue,
        placedOrders: getMetric(pSec, 'Tiếp thị liên kết', 'Tiếp thị liên kết').orders,
        paidOrders: getMetric(pdSec, 'Tiếp thị liên kết', 'Tiếp thị liên kết').orders,
      },
      {
        channel: 'search',
        channelName: 'Tìm kiếm (trong Thẻ SP)',
        placedRevenue: getMetric(pSec, 'Thẻ sản phẩm', 'Tìm kiếm').revenue,
        confirmedRevenue: getMetric(confSec, 'Thẻ sản phẩm', 'Tìm kiếm').revenue,
        paidRevenue: getMetric(pdSec, 'Thẻ sản phẩm', 'Tìm kiếm').revenue,
        placedOrders: getMetric(pSec, 'Thẻ sản phẩm', 'Tìm kiếm').orders,
        paidOrders: getMetric(pdSec, 'Thẻ sản phẩm', 'Tìm kiếm').orders,
      },
      {
        channel: 'other',
        channelName: 'Khác (Thẻ SP)',
        placedRevenue: getOtherInCard(pSec).revenue,
        confirmedRevenue: getOtherInCard(confSec).revenue,
        paidRevenue: getOtherInCard(pdSec).revenue,
        placedOrders: getOtherInCard(pSec).orders,
        paidOrders: getOtherInCard(pdSec).orders,
      },
      {
        channel: 'shop',
        channelName: 'Cửa hàng (trong Thẻ SP)',
        placedRevenue: getMetric(pSec, 'Thẻ sản phẩm', 'Cửa hàng').revenue,
        confirmedRevenue: getMetric(confSec, 'Thẻ sản phẩm', 'Cửa hàng').revenue,
        paidRevenue: getMetric(pdSec, 'Thẻ sản phẩm', 'Cửa hàng').revenue,
        placedOrders: getMetric(pSec, 'Thẻ sản phẩm', 'Cửa hàng').orders,
        paidOrders: getMetric(pdSec, 'Thẻ sản phẩm', 'Cửa hàng').orders,
      },
      {
        channel: 'video',
        channelName: 'Video',
        placedRevenue: getMetric(pSec, 'Video', 'Video').revenue,
        confirmedRevenue: getMetric(confSec, 'Video', 'Video').revenue,
        paidRevenue: getMetric(pdSec, 'Video', 'Video').revenue,
        placedOrders: getMetric(pSec, 'Video', 'Video').orders,
        paidOrders: getMetric(pdSec, 'Video', 'Video').orders,
      },
      {
        channel: 'live',
        channelName: 'Live',
        placedRevenue: getMetric(pSec, 'Live', 'Live').revenue,
        confirmedRevenue: getMetric(confSec, 'Live', 'Live').revenue,
        paidRevenue: getMetric(pdSec, 'Live', 'Live').revenue,
        placedOrders: getMetric(pSec, 'Live', 'Live').orders,
        paidOrders: getMetric(pdSec, 'Live', 'Live').orders,
      },
    ];

    if (canonicalChannels.some((c) => c.placedRevenue > 0 || c.paidRevenue > 0)) {
      canonicalChannels.forEach((ch) => {
        const retentionRate = ch.placedRevenue > 0 ? +((ch.paidRevenue / ch.placedRevenue) * 100).toFixed(1) : 0;
        const leakageAmount = Math.max(0, ch.placedRevenue - ch.paidRevenue);
        const aov = ch.paidOrders > 0 ? ch.paidRevenue / ch.paidOrders : ch.placedOrders > 0 ? ch.placedRevenue / ch.placedOrders : 0;
        let leakageStatus: 'safe' | 'warning' | 'critical' = 'safe';
        let status = 'TỐT';
        if (retentionRate < 60) {
          leakageStatus = 'critical';
          status = 'RÒ RỈ CAO';
        } else if (retentionRate < 70) {
          leakageStatus = 'warning';
          status = 'CẦN TỐI ƯU';
        } else if (retentionRate < 80) {
          leakageStatus = 'warning';
          status = 'TRUNG BÌNH';
        }
        channels.push({
          ...ch,
          retentionRate,
          leakageAmount,
          aov,
          leakageStatus,
          status,
        });
      });
    }
  }

  // Fallback: If not parsed from multi-section summary sheets, parse flat row sheets
  if (channels.length === 0) {
    // Summary sheets (1 aggregate row per channel across the whole period)
    const placedSummaryTraffic = Array.from(sheetDataMap.entries()).find(([name]) => {
      const n = name.toLowerCase();
      return (n.includes('nguồn truy cập cho đơn') || n.includes('báo cáo theo nguồn truy cập')) && !n.includes('chi tiết') && !n.includes('(đơn đã');
    });
    const paidSummaryTraffic = Array.from(sheetDataMap.entries()).find(([name]) => {
      const n = name.toLowerCase();
      return (n.includes('nguồn truy cập từ đơn') || (n.includes('nguồn') && n.includes('thanh toán'))) && !n.includes('chi tiết') && !n.includes('(đơn đã');
    });
    const confirmedSummaryTraffic = Array.from(sheetDataMap.entries()).find(([name]) => {
      const n = name.toLowerCase();
      return (n.includes('nguồn lưu lượng truy cập (đ') || (n.includes('nguồn') && n.includes('xác nhận'))) && !n.includes('chi tiết') && !n.includes('(đơn đã');
    });

    // Detailed sheets (daily breakdown rows per channel)
    const placedDetailTraffic = Array.from(sheetDataMap.entries()).find(([name]) => {
      const n = name.toLowerCase();
      return n.includes('(đơn đã đặt)theo nguồn') || n.includes('theo nguồn lưu lượng');
    });
    const paidDetailTraffic = Array.from(sheetDataMap.entries()).find(([name]) => {
      const n = name.toLowerCase();
      return n.includes('(đơn đã thanh toán)theo ngu');
    });
    const confirmedDetailTraffic = Array.from(sheetDataMap.entries()).find(([name]) => {
      const n = name.toLowerCase();
      return n.includes('(đơn đã xác nhận)theo nguồn');
    });

    const isInvalidChannelName = (name: string): boolean => {
      if (!name) return true;
      const lower = name.trim().toLowerCase();
      if (
        lower === 'nguồn lưu lượng' ||
        lower === 'nguồn' ||
        lower === 'kênh' ||
        lower === 'channel' ||
        lower === 'traffic source' ||
        lower === 'tổng' ||
        lower === 'tổng cộng' ||
        lower === 'total' ||
        lower === 'grand total' ||
        lower === 'ngày' ||
        lower === 'date' ||
        lower === 'day' ||
        lower === 'stt' ||
        lower === 'thời gian'
      ) {
        return true;
      }

      if (/^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}/.test(lower)) return true;
      if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(lower)) return true;
      if (/^\d{4}-\d{2}-\d{2}/.test(lower)) return true;
      if (/^\d+$/.test(lower)) return true;

      return false;
    };

    const channelMap = new Map<string, {
      channelName: string;
      placedRevenue: number;
      confirmedRevenue: number;
      paidRevenue: number;
      placedOrders: number;
      paidOrders: number;
    }>();

    const processRowsIntoMap = (
      rows: Record<string, any>[],
      field: 'placed' | 'confirmed' | 'paid'
    ) => {
      rows.forEach((row) => {
        const channelCol = findColumn(row, ['nguồn lưu lượng', 'nguồn', 'channel', 'traffic source', 'kênh']);
        const rawName = channelCol ? String(row[channelCol] || '').trim() : '';

        if (isInvalidChannelName(rawName)) return;

        const revCol = findColumn(row, ['doanh số (vnd)', 'doanh số', 'revenue', 'tổng doanh số']);
        const ordCol = findColumn(row, ['tổng số đơn hàng', 'số đơn hàng', 'orders', 'tổng số đơn']);

        const rev = cleanNumber(revCol ? row[revCol] : 0);
        const ord = cleanNumber(ordCol ? row[ordCol] : 0);

        const existing = channelMap.get(rawName) || {
          channelName: rawName,
          placedRevenue: 0,
          confirmedRevenue: 0,
          paidRevenue: 0,
          placedOrders: 0,
          paidOrders: 0,
        };

        if (field === 'placed') {
          existing.placedRevenue += rev;
          existing.placedOrders += ord;
        } else if (field === 'confirmed') {
          existing.confirmedRevenue += rev;
        } else if (field === 'paid') {
          existing.paidRevenue += rev;
          existing.paidOrders += ord;
        }

        channelMap.set(rawName, existing);
      });
    };

    const placedRows = placedSummaryTraffic && placedSummaryTraffic[1].rows.length > 0
      ? placedSummaryTraffic[1].rows
      : (placedDetailTraffic ? placedDetailTraffic[1].rows : []);

    const confirmedRows = confirmedSummaryTraffic && confirmedSummaryTraffic[1].rows.length > 0
      ? confirmedSummaryTraffic[1].rows
      : (confirmedDetailTraffic ? confirmedDetailTraffic[1].rows : []);

    const paidRows = paidSummaryTraffic && paidSummaryTraffic[1].rows.length > 0
      ? paidSummaryTraffic[1].rows
      : (paidDetailTraffic ? paidDetailTraffic[1].rows : []);

    if (placedRows.length > 0 || paidRows.length > 0) {
      processRowsIntoMap(placedRows, 'placed');
      processRowsIntoMap(confirmedRows, 'confirmed');
      processRowsIntoMap(paidRows, 'paid');

      channelMap.forEach((entry, chName) => {
        let plRev = entry.placedRevenue;
        let plOrders = entry.placedOrders;
        let pRev = entry.paidRevenue;
        let pOrders = entry.paidOrders;
        let confRev = entry.confirmedRevenue;

        if (pRev === 0 && plRev > 0) {
          pRev = Math.round(plRev * 0.8);
          pOrders = Math.round(plOrders * 0.8);
          if (!estimatedFields.includes('channels')) estimatedFields.push('channels');
        } else if (plRev === 0 && pRev > 0) {
          plRev = Math.round(pRev * 1.2);
          plOrders = Math.round(pOrders * 1.2);
          if (!estimatedFields.includes('channels')) estimatedFields.push('channels');
        }

        if (confRev === 0) {
          confRev = Math.round((plRev + pRev) / 2);
        }

        const retentionRate = plRev > 0 ? +((pRev / plRev) * 100).toFixed(1) : 0;
        const leakageAmount = Math.max(0, plRev - pRev);
        const aov = pOrders > 0 ? pRev / pOrders : plOrders > 0 ? plRev / plOrders : 0;

        let leakageStatus: 'safe' | 'warning' | 'critical' = 'safe';
        let status = 'TỐT';
        if (retentionRate < 60) {
          leakageStatus = 'critical';
          status = 'RÒ RỈ CAO';
        } else if (retentionRate < 70) {
          leakageStatus = 'warning';
          status = 'CẦN TỐI ƯU';
        } else if (retentionRate < 80) {
          leakageStatus = 'warning';
          status = 'TRUNG BÌNH';
        } else {
          leakageStatus = 'safe';
          status = 'TỐT';
        }

        channels.push({
          channel: `ch_${channels.length + 1}`,
          channelName: chName,
          placedRevenue: plRev,
          confirmedRevenue: confRev,
          paidRevenue: pRev,
          placedOrders: plOrders,
          paidOrders: pOrders,
          retentionRate,
          leakageAmount,
          aov,
          leakageStatus,
          status,
        });
      });
    }
  }

  // 5. Parse GROUP 3: Product Level Performance (Multi-Section: Thẻ sản phẩm, Live, Video...)
  // Explicitly locate the worksheets from workbook
  const placedProductWsName = sheetNames.find((name) => {
    const norm = name.toLowerCase();
    return norm.includes('theo sản phẩm (đơn đã đặt)') || (norm.includes('theo sản phẩm') && norm.includes('đặt'));
  });
  const confirmedProductWsName = sheetNames.find((name) => {
    const norm = name.toLowerCase();
    return norm.includes('theo sản phẩm (đơn đã xác') || (norm.includes('theo sản phẩm') && norm.includes('xác'));
  });
  const paidProductWsName = sheetNames.find((name) => {
    const norm = name.toLowerCase();
    return norm.includes('theo sản phẩm (đơn đã thanh') || (norm.includes('theo sản phẩm') && norm.includes('thanh'));
  });

  const placedProductWs = placedProductWsName ? workbook.Sheets[placedProductWsName] : undefined;
  const confirmedProductWs = confirmedProductWsName ? workbook.Sheets[confirmedProductWsName] : undefined;
  const paidProductWs = paidProductWsName ? workbook.Sheets[paidProductWsName] : undefined;

  const placedChannelProducts = parseMultiSectionProductSheet(placedProductWs, 'placed');
  const confirmedChannelProducts = parseMultiSectionProductSheet(confirmedProductWs, 'confirmed');
  const paidChannelProducts = parseMultiSectionProductSheet(paidProductWs, 'paid');

  const allChannelProducts = [...placedChannelProducts, ...confirmedChannelProducts, ...paidChannelProducts];

  // Specific extraction from sheet "Theo sản phẩm (đơn đã đặt)" for "Thẻ sản phẩm" channel
  let productCardPlacedList = placedChannelProducts.filter((p) => {
    const ch = p.channel.toLowerCase();
    return ch.includes('thẻ') || ch.includes('card') || ch.includes('sản phẩm');
  });

  // If specific channel filter is empty, fallback to all placedChannelProducts
  if (productCardPlacedList.length === 0 && placedChannelProducts.length > 0) {
    productCardPlacedList = [...placedChannelProducts];
  }

  // Sort by revenue descending
  productCardPlacedList.sort((a, b) => b.revenue - a.revenue);

  // If revenueShare was not in file or is 0, compute relative share
  const totalCardPlacedRev = productCardPlacedList.reduce((sum, p) => sum + p.revenue, 0);
  productCardPlacedList.forEach((p) => {
    if ((p.revenueShare === 0 || isNaN(p.revenueShare)) && totalCardPlacedRev > 0) {
      p.revenueShare = +((p.revenue / totalCardPlacedRev) * 100).toFixed(2);
    }
  });

  const productCardTopProducts: ChannelProductItem[] = productCardPlacedList.slice(0, 5);

  // Build rawProductsList for ABC Classification from paid products (or placed products as fallback)
  const baseProductList = paidChannelProducts.length > 0 ? paidChannelProducts : placedChannelProducts;
  const rawProductsList: AbcProduct[] = [];

  if (baseProductList.length > 0) {
    // Product sheets report orders, not units; unitsSold below is an estimate.
    estimatedFields.push('productUnits');
    let runningRev = 0;
    // Group products by ID or Name if duplicated across sections
    const prodMap = new Map<string, AbcProduct>();

    baseProductList.forEach((p) => {
      const existing = prodMap.get(p.name);
      if (existing) {
        existing.revenue += p.revenue;
        existing.orders += p.orders;
        existing.views += p.impressions;
        existing.unitsSold += Math.round(p.orders * 1.2);
        if (existing.views > 0) {
          existing.conversionRate = +((existing.orders / existing.views) * 100).toFixed(2);
        }
      } else {
        prodMap.set(p.name, {
          id: p.id,
          sku: p.id,
          name: p.name,
          revenue: p.revenue,
          orders: p.orders,
          unitsSold: Math.round(p.orders * 1.2),
          views: p.impressions,
          conversionRate: p.conversionRate,
          cumulativePercentage: 0,
          classification: 'C',
          isZombie: p.impressions > 1000 && p.orders === 0,
          isDormant: p.orders === 0,
        });
      }
    });

    const mergedList = Array.from(prodMap.values());
    mergedList.sort((a, b) => b.revenue - a.revenue);

    const totalProdRev = mergedList.reduce((sum, p) => sum + p.revenue, 0) || paidRev || 1;
    mergedList.forEach((p) => {
      runningRev += p.revenue;
      p.cumulativePercentage = +((runningRev / totalProdRev) * 100).toFixed(1);
      if (p.cumulativePercentage <= 80) p.classification = 'A';
      else if (p.cumulativePercentage <= 95) p.classification = 'B';
      else p.classification = 'C';
      rawProductsList.push(p);
    });
  }

  const classA = rawProductsList.filter((p) => p.classification === 'A');
  const classB = rawProductsList.filter((p) => p.classification === 'B');
  const classC = rawProductsList.filter((p) => p.classification === 'C');
  const zombies = rawProductsList.filter((p) => p.isZombie);
  const dormants = rawProductsList.filter((p) => p.isDormant);
  const totalPRev = rawProductsList.reduce((sum, p) => sum + p.revenue, 0) || 1;

  const abcSummary = {
    classACount: classA.length,
    classAShare: +((classA.reduce((sum, p) => sum + p.revenue, 0) / totalPRev) * 100).toFixed(1),
    classBCount: classB.length,
    classBShare: +((classB.reduce((sum, p) => sum + p.revenue, 0) / totalPRev) * 100).toFixed(1),
    classCCount: classC.length,
    classCShare: +((classC.reduce((sum, p) => sum + p.revenue, 0) / totalPRev) * 100).toFixed(1),
    zombieCount: zombies.length,
    dormantCount: dormants.length,
  };

  // 6. Parse GROUP 4: Live Session Contribution (Row 2 header)
  const liveSessions: LiveSessionMetric[] = [];
  const paidLiveSheet = Array.from(sheetDataMap.entries()).find(([name]) => name.toLowerCase().includes('session contribution (paid'));
  if (paidLiveSheet && paidLiveSheet[1].rows.length > 0) {
    paidLiveSheet[1].rows.forEach((r, idx) => {
      const idCol = findColumn(r, ['mã phiên chat', 'session id', 'mã']);
      const titleCol = findColumn(r, ['session title', 'tiêu đề', 'tên phiên', 'title']);
      const revCol = findColumn(r, ['doanh số (vnd)', 'doanh số', 'revenue']);
      const shareCol = findColumn(r, ['tỷ lệ doanh số', 'share']);
      const gpmCol = findColumn(r, ['gpm']);
      const ordersCol = findColumn(r, ['psd_label_orders', 'orders', 'đơn hàng']);
      const viewsCol = findColumn(r, ['lượt xem livestream', 'lượt xem', 'views']);
      const viewersCol = findColumn(r, ['người xem livestream', 'người xem', 'viewers']);
      const durationCol = findColumn(r, ['avg. watch duration', 'thời lượng xem']);
      const commentsCol = findColumn(r, ['bình luận', 'comments']);
      const clicksCol = findColumn(r, ['lượt nhấp vào sản phẩm', 'clicks']);
      const ctrCol = findColumn(r, ['ctr']);
      const atcCol = findColumn(r, ['atc', 'thêm vào giỏ']);
      const crCol = findColumn(r, ['tỷ lệ chuyển đổi đơn hàng', 'cr']);

      liveSessions.push({
        sessionId: idCol ? String(r[idCol] || `LIVE-${idx + 1}`) : `LIVE-${idx + 1}`,
        title: titleCol ? String(r[titleCol] || `Live Session #${idx + 1}`) : `Live Session #${idx + 1}`,
        revenueShare: shareCol ? cleanPercentage(r[shareCol]) : 0,
        revenue: cleanNumber(revCol ? r[revCol] : 0),
        gpm: cleanNumber(gpmCol ? r[gpmCol] : 0),
        orders: cleanNumber(ordersCol ? r[ordersCol] : 0),
        productCount: 0,
        liveViews: cleanNumber(viewsCol ? r[viewsCol] : 0),
        liveViewers: cleanNumber(viewersCol ? r[viewersCol] : 0),
        avgWatchDuration: durationCol ? String(r[durationCol] || '00:00') : '00:00',
        comments: cleanNumber(commentsCol ? r[commentsCol] : 0),
        productClicks: cleanNumber(clicksCol ? r[clicksCol] : 0),
        ctr: ctrCol ? cleanPercentage(r[ctrCol]) : 0,
        atc: cleanNumber(atcCol ? r[atcCol] : 0),
        conversionRate: crCol ? cleanPercentage(r[crCol]) : 0,
        leakageStatus: 'warning',
      });
    });
  }

  // 7. Parse GROUP 5: Shopee Video Contribution (Row 2 header)
  const videoMetrics: VideoContributionMetric[] = [];
  const videoSheetEntry = Array.from(sheetDataMap.entries()).find(([name]) => {
    const norm = name.toLowerCase();
    return (
      norm.includes('video contribution') ||
      norm.includes('theo video') ||
      (norm.includes('video') && !norm.includes('lưu lượng') && !norm.includes('sản phẩm'))
    );
  });

  if (videoSheetEntry && videoSheetEntry[1].rows.length > 0) {
    videoSheetEntry[1].rows.forEach((r, idx) => {
      const keys = Object.keys(r);
      
      // ID column: matches psd_label_video_id, video id, mã video
      const idCol = keys.find((k) => {
        const norm = k.toLowerCase().replace(/[\s_\-–—()/%:,.]/g, '');
        return norm.includes('psdlabelvideoid') || norm.includes('videoid') || (norm.includes('mã') && norm.includes('video'));
      }) || findColumn(r, ['psd_label_video_id', 'video id', 'mã video']);

      // Title column: MUST NOT match psd_label_video_id, ID, or metric columns
      const titleCol = keys.find((k) => {
        const norm = k.toLowerCase().trim();
        const normClean = norm.replace(/[\s_\-–—()/%:,.]/g, '');
        if (normClean.includes('psdlabel') || normClean.includes('id') || normClean.includes('mã')) return false;
        if (normClean.includes('lượt') || normClean.includes('người') || normClean.includes('bìnhluận') || normClean.includes('thích') || normClean.includes('nhấp')) return false;
        if (normClean.includes('tỷlệ') || normClean.includes('doanh') || normClean.includes('gpm') || normClean.includes('order') || normClean.includes('đơn') || normClean.includes('sảnphẩm')) return false;
        return norm === 'video' || normClean === 'video' || normClean.includes('tênvideo') || normClean.includes('tiêuđề');
      }) || (keys.length > 1 && keys[1] !== idCol ? keys[1] : undefined);

      const revCol = findColumn(r, ['doanh số (vnd)', 'doanh số', 'revenue']);
      const shareCol = findColumn(r, ['tỷ lệ doanh số', 'tỉ lệ doanh số', 'share']);
      const gpmCol = findColumn(r, ['gpm']);
      const ordersCol = findColumn(r, ['psd_label_orders', 'orders', 'đơn hàng']);
      const viewsCol = findColumn(r, ['lượt xem video', 'lượt xem', 'views']);
      const viewersCol = findColumn(r, ['người xem video', 'người xem', 'viewers']);
      const commentsCol = findColumn(r, ['bình luận', 'comments']);
      const likesCol = findColumn(r, ['lượt thích', 'likes']);
      const clicksCol = findColumn(r, ['lượt nhấp vào sản phẩm', 'lượt nhấp vào s', 'nhấp', 'clicks']);
      const ctrCol = findColumn(r, ['ctr']);
      const crCol = findColumn(r, ['tỷ lệ chuyển đổi', 'tỷ lệ chuyển đổi đơn hàng', 'cr']);
      const buyersCol = findColumn(r, ['người mua', 'buyers']);

      let videoId = idCol ? String(r[idCol] || `VID-${idx + 1}`).trim() : `VID-${idx + 1}`;
      let videoTitle = titleCol ? String(r[titleCol] || '').trim() : '';

      // If videoTitle was mistakenly parsed as 'psd_label_video_id' or numeric ID
      if (videoTitle === 'psd_label_video_id' || videoTitle === 'psd_label_video' || /^\d{6,}$/.test(videoTitle) || !videoTitle) {
        // Search for a non-numeric text column
        for (const k of keys) {
          if (k === idCol) continue;
          const val = String(r[k] || '').trim();
          if (val && val !== 'psd_label_video_id' && isNaN(Number(val)) && val.length > 3 && !val.includes('%')) {
            videoTitle = val;
            break;
          }
        }
      }

      if (!videoTitle || videoTitle === 'psd_label_video_id') {
        videoTitle = `Video #${idx + 1} (${videoId})`;
      }

      // Ignore header row if accidentally passed as data row
      if (videoTitle.toLowerCase() === 'video' && (!revCol || !r[revCol] || String(r[revCol]).toLowerCase().includes('doanh'))) {
        return;
      }

      videoMetrics.push({
        videoId,
        videoTitle,
        revenueShare: shareCol ? cleanPercentage(r[shareCol]) : 0,
        revenue: cleanNumber(revCol ? r[revCol] : 0),
        gpm: cleanNumber(gpmCol ? r[gpmCol] : 0),
        orders: cleanNumber(ordersCol ? r[ordersCol] : 0),
        productCount: 0,
        videoViews: cleanNumber(viewsCol ? r[viewsCol] : 0),
        viewers: cleanNumber(viewersCol ? r[viewersCol] : 0),
        comments: cleanNumber(commentsCol ? r[commentsCol] : 0),
        likes: cleanNumber(likesCol ? r[likesCol] : 0),
        productClicks: cleanNumber(clicksCol ? r[clicksCol] : 0),
        ctr: ctrCol ? cleanPercentage(r[ctrCol]) : 0,
        conversionRate: crCol ? cleanPercentage(r[crCol]) : 0,
        buyers: cleanNumber(buyersCol ? r[buyersCol] : 0),
      });
    });
  }

  // 8. Parse GROUP 6: Affiliate / KOC Contribution (Row 2 header)
  const affiliates: AffiliateContributionMetric[] = [];
  const paidAffiliateSheet = Array.from(sheetDataMap.entries()).find(([name]) => name.toLowerCase().includes('affiliate contribution (pai'));
  if (paidAffiliateSheet && paidAffiliateSheet[1].rows.length > 0) {
    paidAffiliateSheet[1].rows.forEach((r, idx) => {
      const userCol = findColumn(r, ['affiliate username', 'username', 'tên koc', 'koc']);
      const revCol = findColumn(r, ['doanh số (vnd)', 'doanh số']);
      const shareCol = findColumn(r, ['tỷ lệ doanh số', 'share']);
      const ordersCol = findColumn(r, ['psd_label_orders', 'orders']);
      const viewsCol = findColumn(r, ['lượt xem nội dung', 'lượt xem']);
      const clicksCol = findColumn(r, ['lượt nhấp vào sản phẩm', 'clicks']);
      const ctrCol = findColumn(r, ['ctr']);
      const crCol = findColumn(r, ['tỷ lệ chuyển đổi đơn hàng', 'cr']);
      const aovCol = findColumn(r, ['doanh số trên mỗi đơn hàng', 'aov']);
      const buyersCol = findColumn(r, ['người mua', 'buyers']);

      affiliates.push({
        username: userCol ? String(r[userCol] || `koc_partner_${idx + 1}`) : `koc_partner_${idx + 1}`,
        revenueShare: shareCol ? cleanPercentage(r[shareCol]) : 0,
        revenue: cleanNumber(revCol ? r[revCol] : 0),
        orders: cleanNumber(ordersCol ? r[ordersCol] : 0),
        productCount: 0,
        contentViews: cleanNumber(viewsCol ? r[viewsCol] : 0),
        productClicks: cleanNumber(clicksCol ? r[clicksCol] : 0),
        ctr: ctrCol ? cleanPercentage(r[ctrCol]) : 0,
        conversionRate: crCol ? cleanPercentage(r[crCol]) : 0,
        aov: cleanNumber(aovCol ? r[aovCol] : 0),
        buyers: cleanNumber(buyersCol ? r[buyersCol] : 0),
      });
    });
  }

  // 9. Daily timeline parsed directly from Group 1 overview sheets (or calculated proportionally if no daily breakdown)
  const dailyTimeline: DailySalesMetric[] = [];
  let campaignRevTotal = 0;
  let normalRevTotal = 0;
  let campaignDaysCount = 0;

  const rawPaidDailyRows = paidOverviewSheet ? paidOverviewSheet[1].rows : [];
  const rawPlacedDailyRows = placedOverviewSheet ? placedOverviewSheet[1].rows : [];

  const isDailySummaryRow = (r: Record<string, any>, dCol?: string): boolean => {
    if (!r) return false;
    const dVal = dCol ? String(r[dCol] || '').trim() : '';
    if (dVal.includes(' - ') || (dVal.match(/\d{2,4}/g) || []).length >= 4) return true;
    const lower = dVal.toLowerCase();
    if (lower.includes('tổng') || lower.includes('toàn bộ') || lower.includes('total')) return true;
    return false;
  };

  const pDateCol = rawPaidDailyRows.length > 0 ? findColumn(rawPaidDailyRows[0], ['ngày', 'date']) : undefined;
  const plDateCol = rawPlacedDailyRows.length > 0 ? findColumn(rawPlacedDailyRows[0], ['ngày', 'date']) : undefined;
  const pRevCol = rawPaidDailyRows.length > 0 ? findColumn(rawPaidDailyRows[0], ['tổng doanh số', 'doanh số (vnd)', 'gross revenue', 'doanh số']) : undefined;
  const plRevCol = rawPlacedDailyRows.length > 0 ? findColumn(rawPlacedDailyRows[0], ['tổng doanh số', 'doanh số (vnd)', 'gross revenue', 'doanh số']) : undefined;
  const pOrdCol = rawPaidDailyRows.length > 0 ? findColumn(rawPaidDailyRows[0], ['tổng số đơn hàng', 'số đơn hàng', 'orders', 'đơn hàng']) : undefined;

  const validDailyRows = rawPaidDailyRows.filter((r) => !isDailySummaryRow(r, pDateCol));

  if (validDailyRows.length > 0) {
    const avgDailyRev = paidRev / Math.max(1, validDailyRows.length);
    validDailyRows.forEach((r) => {
      const dateStr = pDateCol ? String(r[pDateCol] || '').trim() : '';
      if (!dateStr) return;

      const dayPaidRev = cleanNumber(pRevCol ? r[pRevCol] : 0);
      const dayPaidOrd = cleanNumber(pOrdCol ? r[pOrdCol] : 0);

      const placedMatch = rawPlacedDailyRows.find((pr) => plDateCol && String(pr[plDateCol] || '').trim() === dateStr);
      const dayPlacedRev = cleanNumber(placedMatch && plRevCol ? placedMatch[plRevCol] : dayPaidRev);

      let displayDate = dateStr;
      const dateParts = dateStr.split(/[-/]/);
      if (dateParts.length >= 2) {
        displayDate = `${dateParts[0]}/${dateParts[1]}`;
      }

      const isCampaign = dayPaidRev > avgDailyRev * 1.8;
      if (isCampaign) {
        campaignRevTotal += dayPaidRev;
        campaignDaysCount++;
      } else {
        normalRevTotal += dayPaidRev;
      }

      dailyTimeline.push({
        date: dateStr,
        displayDate,
        revenue: dayPaidRev,
        orders: dayPaidOrd,
        placedRevenue: dayPlacedRev,
        isDoubleDigitCampaign: isCampaign,
        campaignLabel: isCampaign ? `Spike (${displayDate})` : undefined,
      });
    });
  }

  const campaignStats = {
    campaignRevenue: campaignRevTotal,
    normalRevenue: normalRevTotal,
    campaignSharePercent: +((campaignRevTotal / (paidRev || 1)) * 100).toFixed(1),
    campaignDaysCount,
  };

  // 10. Customer Retention & Ads
  const retention: CustomerRetentionMetric = {
    // Only buyer counts present in the report. Revenue per buyer type is not in
    // Shopee summary exports, so it stays 0 (unknown) instead of a fixed split.
    totalBuyers,
    newBuyers,
    returningBuyers,
    newBuyerRevenue: 0,
    returningBuyerRevenue: 0,
    newBuyerAov: 0,
    returningBuyerAov: 0,
    repeatPurchaseRate,
  };

  // Shopee sales-analysis exports contain no ads data; ads come from a dedicated ads report.
  const ads: AdPerformanceMetric[] = [];

  const adSummary = {
    totalSpend: ads.reduce((s, a) => s + a.spend, 0),
    totalAdRevenue: ads.reduce((s, a) => s + a.paidRevenue, 0),
    overallRoas: +(ads.reduce((s, a) => s + a.paidRevenue, 0) / (ads.reduce((s, a) => s + a.spend, 0) || 1)).toFixed(2),
    wastedBudget: ads.filter((a) => a.isBudgetWaste).reduce((s, a) => s + a.spend, 0),
  };

  // 11. Alerts Generation
  const alerts: RuleAlert[] = [];
  if (cancellationRate > 15 && !estimatedFields.includes('placedOrders')) {
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

  if (zombies.length > 0) {
    const z = zombies[0];
    alerts.push({
      id: 'rule-alt-zombie',
      type: 'zombie_product',
      severity: 'warning',
      title: `Phát hiện ${zombies.length} sản phẩm "Zombie" (Nhiều View, 0 Sales)`,
      metricLabel: `${z.name} (${z.sku})`,
      metricValue: `${z.views.toLocaleString('vi-VN')} Views / 0 Sales`,
      threshold: 'CR < 0.1%',
      message: 'Sản phẩm có lượt tiếp cận tốt nhưng khách không chốt đơn do giá, ảnh sản phẩm hoặc thiếu đánh giá.',
      recommendation: 'Đóng combo quà tặng kèm với sản phẩm chủ lực hoặc tạo Flash Sale kích hoạt đơn hàng đầu tiên.',
    });
  }

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

  // Derive Product Growth Momentum & Creator Summary using deterministic AI algorithms
  const { productGrowthMomentum, creatorGrowthSummary, storeOpsMetrics } = deriveProductGrowthMomentumAndCreatorSummary(
    rawProductsList,
    videoMetrics.length > 0 ? videoMetrics : undefined,
    affiliates.length > 0 ? affiliates : undefined,
    liveSessions.length > 0 ? liveSessions : undefined,
    paidRev,
    paidOrders,
    cancellationRate
  );

  const finalKpis: ExecutiveKpis = {
    ...kpis,
    ...storeOpsMetrics,
  };

  return {
    datasetId: `dataset-${Date.now()}`,
    fileName: file.name,
    periodLabel: periodLabel || `Báo cáo: ${file.name}`,
    sheetCount: sheetNames.length,
    detectedSheets: sheetNames,
    rawSheets,
    liveSessions: liveSessions.length > 0 ? liveSessions : undefined,
    videoMetrics: videoMetrics.length > 0 ? videoMetrics : undefined,
    affiliates: affiliates.length > 0 ? affiliates : undefined,
    productGrowthMomentum,
    creatorGrowthSummary,
    orders: allOrdersList,
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
    productCardTopProducts: productCardTopProducts.length > 0 ? productCardTopProducts : undefined,
    channelProducts: allChannelProducts.length > 0 ? allChannelProducts : undefined,
    abcProducts: rawProductsList,
    abcSummary,
    ads,
    adSummary,
    retention,
    estimatedFields,
  };
}

// =========================================================================
// REALISTIC FULL 21-SHEET STANDARD SHOPEE EXCEL GENERATOR
// =========================================================================

export function downloadSampleShopeeExcel() {
  const wb = XLSX.utils.book_new();

  // Helper to create clean sheet with headers starting directly at Row 1 (matching standard Shopee File 1)
  function createCleanSheet(headers: string[], dataRows: any[][]): XLSX.WorkSheet {
    const fullGrid: any[][] = [headers, ...dataRows];
    return XLSX.utils.aoa_to_sheet(fullGrid);
  }

  // GROUP 1: EXECUTIVE OVERVIEW (3 Sheets - 17 columns each - Row 1)
  const g1Headers = [
    'Ngày',
    'Tổng doanh số (VND)',
    'Doanh số không bao gồm trợ giá bởi Shopee',
    'Tổng số đơn hàng',
    'Doanh số trên mỗi đơn hàng',
    'Lượt nhấp vào sản phẩm',
    'Số lượt truy cập',
    'Tỷ lệ chuyển đổi đơn hàng',
    'Đơn đã hủy',
    'Doanh số đơn hủy',
    'Đơn đã hoàn trả / hoàn tiền',
    'Doanh số các đơn Trả hàng/Hoàn tiền',
    'số người mua',
    'số người mua mới',
    'số người mua hiện tại',
    'số người mua tiềm năng',
    'Tỉ lệ quay lại của người mua',
  ];

  // 1. Sheet Đơn hàng đã đặt
  const wsPlaced = createCleanSheet(g1Headers, [
    ['24-07-2026-22-08-2026', '1.485.000.000', '1.410.000.000', '4.250', '349.411', '142.500', '98.600', '4,31%', '990', '365.000.000', '110', '44.000.000', '3.820', '2.680', '1.140', '5.200', '29,84%'],
  ]);

  // 2. Sheet Đơn đã xác nhận
  const wsConfirmed = createCleanSheet(g1Headers, [
    ['24-07-2026-22-08-2026', '1.242.000.000', '1.180.000.000', '3.580', '346.927', '128.000', '88.200', '4,06%', '320', '122.000.000', '110', '44.000.000', '3.250', '2.280', '970', '4.500', '29,85%'],
  ]);

  // 3. Sheet Đơn Đã Thanh Toán
  const wsPaid = createCleanSheet(g1Headers, [
    ['24-07-2026-22-08-2026', '1.120.000.000', '1.045.000.000', '3.260', '343.558', '115.000', '79.500', '4,10%', '0', '0', '110', '44.000.000', '2.890', '2.050', '840', '3.900', '29,07%'],
  ]);

  // GROUP 2: TRAFFIC SOURCE BREAKDOWN (6 Sheets - 13 columns each - Row 1)
  const g2TrafficHeaders = [
    'Nguồn lưu lượng',
    'Tỷ lệ doanh số',
    'Doanh số (VND)',
    'Lượt hiển thị sản phẩm',
    'Lượt nhấp vào sản phẩm',
    'Tổng số đơn hàng',
    'Sản phẩm',
    'CTR',
    'Tỷ lệ chuyển đổi đơn hàng',
    'Doanh số trên mỗi đơn hàng',
    'Người mua',
    'Lượt hiển thị sản phẩm duy nhất',
    'Lượt nhấp sản phẩm duy nhất',
  ];

  // 4. Sheet Nguồn truy cập cho Đơn hàng...
  const wsTrafficSummaryPlaced = createCleanSheet(g2TrafficHeaders, [
    ['Shopee Live Stream', '35,02%', '520.000.000', '380.000', '42.500', '1.650', '25', '11,18%', '3,88%', '315.151', '1.480', '290.000', '35.000'],
    ['Tiếp thị liên kết (Affiliate / KOC)', '20,88%', '310.000.000', '210.000', '28.400', '780', '18', '13,52%', '2,75%', '397.435', '710', '165.000', '22.000'],
    ['Quảng cáo Tìm kiếm (Search Ads)', '18,52%', '275.000.000', '480.000', '18.500', '750', '30', '3,85%', '4,05%', '366.666', '690', '360.000', '14.500'],
    ['Tìm kiếm tự nhiên (Organic)', '12,46%', '185.000.000', '290.000', '14.200', '540', '45', '4,90%', '3,80%', '342.592', '510', '220.000', '11.000'],
    ['Shopee Video', '8,42%', '125.000.000', '160.000', '12.800', '390', '12', '8,00%', '3,05%', '320.512', '360', '125.000', '10.200'],
    ['Tin nhắn Quảng bá (Chat Broadcast)', '4,71%', '70.000.000', '45.000', '8.500', '140', '8', '18,89%', '1,65%', '500.000', '130', '35.000', '7.000'],
  ]);

  // 5. Sheet (đơn đã đặt)Theo nguồn lưu ...
  const wsTrafficDetailPlaced = createCleanSheet(g2TrafficHeaders, [
    ['Shopee Live Stream', '35,02%', '520.000.000', '380.000', '42.500', '1.650', '25', '11,18%', '3,88%', '315.151', '1.480', '290.000', '35.000'],
    ['Tiếp thị liên kết (Affiliate / KOC)', '20,88%', '310.000.000', '210.000', '28.400', '780', '18', '13,52%', '2,75%', '397.435', '710', '165.000', '22.000'],
    ['Quảng cáo Tìm kiếm (Search Ads)', '18,52%', '275.000.000', '480.000', '18.500', '750', '30', '3,85%', '4,05%', '366.666', '690', '360.000', '14.500'],
    ['Tìm kiếm tự nhiên (Organic)', '12,46%', '185.000.000', '290.000', '14.200', '540', '45', '4,90%', '3,80%', '342.592', '510', '220.000', '11.000'],
    ['Shopee Video', '8,42%', '125.000.000', '160.000', '12.800', '390', '12', '8,00%', '3,05%', '320.512', '360', '125.000', '10.200'],
    ['Tin nhắn Quảng bá (Chat Broadcast)', '4,71%', '70.000.000', '45.000', '8.500', '140', '8', '18,89%', '1,65%', '500.000', '130', '35.000', '7.000'],
  ]);

  // 7. Sheet Nguồn lưu lượng truy cập (đ...
  const wsTrafficSummaryConfirmed = createCleanSheet(g2TrafficHeaders, [
    ['Shopee Live Stream', '32,61%', '405.000.000', '380.000', '42.500', '1.310', '25', '11,18%', '3,08%', '309.160', '1.200', '290.000', '35.000'],
    ['Tiếp thị liên kết (Affiliate / KOC)', '23,99%', '298.000.000', '210.000', '28.400', '750', '18', '13,52%', '2,64%', '397.333', '690', '165.000', '22.000'],
    ['Quảng cáo Tìm kiếm (Search Ads)', '19,97%', '248.000.000', '480.000', '18.500', '680', '30', '3,85%', '3,68%', '364.705', '630', '360.000', '14.500'],
    ['Tìm kiếm tự nhiên (Organic)', '13,85%', '172.000.000', '290.000', '14.200', '505', '45', '4,90%', '3,56%', '340.594', '480', '220.000', '11.000'],
    ['Shopee Video', '8,37%', '104.000.000', '160.000', '12.800', '305', '12', '8,00%', '2,38%', '340.983', '285', '125.000', '10.200'],
    ['Tin nhắn Quảng bá (Chat Broadcast)', '1,21%', '15.000.000', '45.000', '8.500', '30', '8', '18,89%', '0,35%', '500.000', '28', '35.000', '7.000'],
  ]);

  // 8. Sheet (đơn đã xác nhận)Theo nguồn...
  const wsTrafficDetailConfirmed = createCleanSheet(g2TrafficHeaders, [
    ['Shopee Live Stream', '32,61%', '405.000.000', '380.000', '42.500', '1.310', '25', '11,18%', '3,08%', '309.160', '1.200', '290.000', '35.000'],
    ['Tiếp thị liên kết (Affiliate / KOC)', '23,99%', '298.000.000', '210.000', '28.400', '750', '18', '13,52%', '2,64%', '397.333', '690', '165.000', '22.000'],
    ['Quảng cáo Tìm kiếm (Search Ads)', '19,97%', '248.000.000', '480.000', '18.500', '680', '30', '3,85%', '3,68%', '364.705', '630', '360.000', '14.500'],
    ['Tìm kiếm tự nhiên (Organic)', '13,85%', '172.000.000', '290.000', '14.200', '505', '45', '4,90%', '3,56%', '340.594', '480', '220.000', '11.000'],
    ['Shopee Video', '8,37%', '104.000.000', '160.000', '12.800', '305', '12', '8,00%', '2,38%', '340.983', '285', '125.000', '10.200'],
    ['Tin nhắn Quảng bá (Chat Broadcast)', '1,21%', '15.000.000', '45.000', '8.500', '30', '8', '18,89%', '0,35%', '500.000', '28', '35.000', '7.000'],
  ]);

  // 10. Sheet Nguồn truy cập từ Đơn hàng ...
  const wsTrafficSummaryPaid = createCleanSheet(g2TrafficHeaders, [
    ['Shopee Live Stream', '30,80%', '345.000.000', '380.000', '42.500', '1.120', '25', '11,18%', '2,64%', '308.035', '1.050', '290.000', '35.000'],
    ['Tiếp thị liên kết (Affiliate / KOC)', '26,07%', '292.000.000', '210.000', '28.400', '735', '18', '13,52%', '2,59%', '397.278', '680', '165.000', '22.000'],
    ['Quảng cáo Tìm kiếm (Search Ads)', '20,71%', '232.000.000', '480.000', '18.500', '640', '30', '3,85%', '3,46%', '362.500', '600', '360.000', '14.500'],
    ['Tìm kiếm tự nhiên (Organic)', '14,29%', '160.000.000', '290.000', '14.200', '475', '45', '4,90%', '3,35%', '336.842', '450', '220.000', '11.000'],
    ['Shopee Video', '7,32%', '82.000.000', '160.000', '12.800', '260', '12', '8,00%', '2,03%', '315.384', '245', '125.000', '10.200'],
    ['Tin nhắn Quảng bá (Chat Broadcast)', '0,80%', '9.000.000', '45.000', '8.500', '30', '8', '18,89%', '0,35%', '300.000', '25', '35.000', '7.000'],
  ]);

  // 11. Sheet (đơn đã thanh toán)Theo ngu...
  const wsTrafficDetailPaid = createCleanSheet(g2TrafficHeaders, [
    ['Shopee Live Stream', '30,80%', '345.000.000', '380.000', '42.500', '1.120', '25', '11,18%', '2,64%', '308.035', '1.050', '290.000', '35.000'],
    ['Tiếp thị liên kết (Affiliate / KOC)', '26,07%', '292.000.000', '210.000', '28.400', '735', '18', '13,52%', '2,59%', '397.278', '680', '165.000', '22.000'],
    ['Quảng cáo Tìm kiếm (Search Ads)', '20,71%', '232.000.000', '480.000', '18.500', '640', '30', '3,85%', '3,46%', '362.500', '600', '360.000', '14.500'],
    ['Tìm kiếm tự nhiên (Organic)', '14,29%', '160.000.000', '290.000', '14.200', '475', '45', '4,90%', '3,35%', '336.842', '450', '220.000', '11.000'],
    ['Shopee Video', '7,32%', '82.000.000', '160.000', '12.800', '260', '12', '8,00%', '2,03%', '315.384', '245', '125.000', '10.200'],
    ['Tin nhắn Quảng bá (Chat Broadcast)', '0,80%', '9.000.000', '45.000', '8.500', '30', '8', '18,89%', '0,35%', '300.000', '25', '35.000', '7.000'],
  ]);

  // GROUP 3: PRODUCT LEVEL PERFORMANCE (3 Sheets - 15 columns each - Row 1)
  const g3ProductHeaders = [
    'Mã sản phẩm',
    'Sản phẩm',
    'Tình trạng sản phẩm hiện tại',
    'Tỷ lệ doanh số',
    'Doanh số (VND)',
    'Lượt hiển thị sản phẩm',
    'Lượt nhấp vào sản phẩm',
    'Tổng số đơn hàng',
    'Sản phẩm',
    'CTR',
    'Tỷ lệ chuyển đổi đơn hàng',
    'Doanh số trên mỗi đơn hàng',
    'Người mua',
    'Lượt hiển thị sản phẩm duy nhất',
    'Lượt nhấp sản phẩm duy nhất',
  ];

  // 6. Sheet Theo sản phẩm (đơn đã đặt)
  const wsProductPlaced = createCleanSheet(g3ProductHeaders, [
    ['24981029381', 'Serum Phục Hồi Da B5 Rau Má 50ml (Hero)', 'Đang hoạt động', '47,50%', '705.375.000', '62.000', '45.200', '2.080', '2.350', '72,90%', '4,60%', '339.122', '1.920', '48.000', '36.500'],
    ['24981029382', 'Kem Chống Nắng Kiềm Dầu Aqua 60ml', 'Đang hoạt động', '23,10%', '343.035.000', '39.000', '28.400', '1.120', '1.240', '72,82%', '3,94%', '306.281', '1.040', '31.000', '22.800'],
    ['24981029383', 'Sữa Rửa Mặt Dịu Nhẹ Tràm Trà 150ml', 'Đang hoạt động', '11,20%', '166.320.000', '22.000', '16.500', '600', '680', '75,00%', '3,64%', '277.200', '560', '18.000', '13.200'],
    ['24981029384', 'Nước Hoa Hồng Cúc La Mã 200ml', 'Đang hoạt động', '8,10%', '120.285.000', '15.000', '11.200', '370', '410', '74,67%', '3,30%', '325.094', '350', '12.000', '9.100'],
    ['24981029385', 'Nước Tẩy Trang Micellar Water 300ml', 'Đang hoạt động', '5,20%', '77.220.000', '12.000', '9.400', '250', '280', '78,33%', '2,66%', '308.880', '240', '9.800', '7.500'],
    ['24981029386', 'Son Dưỡng Ẩm Môi Hương Dâu Berry 10g', 'Đang hoạt động', '2,60%', '38.610.000', '7.500', '5.200', '180', '210', '69,33%', '3,46%', '214.500', '175', '6.100', '4.300'],
    ['24981029387', 'Mặt Nạ Bùn Khoáng Trà Xanh (Zombie)', 'Đang hoạt động', '0,00%', '0', '12.000', '8.920', '0', '0', '74,33%', '0,00%', '0', '0', '10.500', '7.800'],
    ['24981029388', 'Xịt Dầu Gội Khô Hương Cam Mini 50ml', 'Đang hoạt động', '2,30%', '34.155.000', '3.200', '2.100', '80', '95', '65,63%', '3,81%', '426.937', '78', '2.700', '1.800'],
  ]);

  // 9. Sheet Theo sản phẩm (đơn đã xác n...
  const wsProductConfirmed = createCleanSheet(g3ProductHeaders, [
    ['24981029381', 'Serum Phục Hồi Da B5 Rau Má 50ml (Hero)', 'Đang hoạt động', '48,10%', '597.402.000', '62.000', '45.200', '1.760', '1.980', '72,90%', '3,89%', '339.432', '1.640', '48.000', '36.500'],
    ['24981029382', 'Kem Chống Nắng Kiềm Dầu Aqua 60ml', 'Đang hoạt động', '23,20%', '288.144.000', '39.000', '28.400', '940', '1.050', '72,82%', '3,31%', '306.536', '880', '31.000', '22.800'],
    ['24981029383', 'Sữa Rửa Mặt Dịu Nhẹ Tràm Trà 150ml', 'Đang hoạt động', '11,10%', '137.862.000', '22.000', '16.500', '500', '570', '75,00%', '3,03%', '275.724', '470', '18.000', '13.200'],
    ['24981029384', 'Nước Hoa Hồng Cúc La Mã 200ml', 'Đang hoạt động', '8,00%', '99.360.000', '15.000', '11.200', '310', '350', '74,67%', '2,77%', '320.516', '295', '12.000', '9.100'],
    ['24981029385', 'Nước Tẩy Trang Micellar Water 300ml', 'Đang hoạt động', '5,00%', '62.100.000', '12.000', '9.400', '210', '235', '78,33%', '2,23%', '295.714', '200', '9.800', '7.500'],
    ['24981029386', 'Son Dưỡng Ẩm Môi Hương Dâu Berry 10g', 'Đang hoạt động', '2,50%', '31.050.000', '7.500', '5.200', '150', '170', '69,33%', '2,88%', '207.000', '145', '6.100', '4.300'],
    ['24981029387', 'Mặt Nạ Bùn Khoáng Trà Xanh (Zombie)', 'Đang hoạt động', '0,00%', '0', '12.000', '8.920', '0', '0', '74,33%', '0,00%', '0', '0', '10.500', '7.800'],
    ['24981029388', 'Xịt Dầu Gội Khô Hương Cam Mini 50ml', 'Đang hoạt động', '2,10%', '26.082.000', '3.200', '2.100', '60', '70', '65,63%', '2,86%', '434.700', '58', '2.700', '1.800'],
  ]);

  // 12. Sheet Theo sản phẩm (đơn đã thanh...
  const wsProductPaid = createCleanSheet(g3ProductHeaders, [
    ['24981029381', 'Serum Phục Hồi Da B5 Rau Má 50ml (Hero)', 'Đang hoạt động', '49,00%', '548.800.000', '62.000', '45.200', '1.620', '1.830', '72,90%', '3,58%', '338.765', '1.510', '48.000', '36.500'],
    ['24981029382', 'Kem Chống Nắng Kiềm Dầu Aqua 60ml', 'Đang hoạt động', '23,00%', '257.600.000', '39.000', '28.400', '840', '940', '72,82%', '2,96%', '306.666', '790', '31.000', '22.800'],
    ['24981029383', 'Sữa Rửa Mặt Dịu Nhẹ Tràm Trà 150ml', 'Đang hoạt động', '11,00%', '123.200.000', '22.000', '16.500', '460', '520', '75,00%', '2,79%', '267.826', '430', '18.000', '13.200'],
    ['24981029384', 'Nước Hoa Hồng Cúc La Mã 200ml', 'Đang hoạt động', '8,00%', '89.600.000', '15.000', '11.200', '280', '315', '74,67%', '2,50%', '320.000', '265', '12.000', '9.100'],
    ['24981029385', 'Nước Tẩy Trang Micellar Water 300ml', 'Đang hoạt động', '5,00%', '56.000.000', '12.000', '9.400', '190', '215', '78,33%', '2,02%', '294.736', '180', '9.800', '7.500'],
    ['24981029386', 'Son Dưỡng Ẩm Môi Hương Dâu Berry 10g', 'Đang hoạt động', '2,50%', '28.000.000', '7.500', '5.200', '140', '160', '69,33%', '2,69%', '200.000', '135', '6.100', '4.300'],
    ['24981029387', 'Mặt Nạ Bùn Khoáng Trà Xanh (Zombie)', 'Đang hoạt động', '0,00%', '0', '12.000', '8.920', '0', '0', '74,33%', '0,00%', '0', '0', '10.500', '7.800'],
    ['24981029388', 'Xịt Dầu Gội Khô Hương Cam Mini 50ml', 'Đang hoạt động', '1,50%', '16.800.000', '3.200', '2.100', '50', '60', '65,63%', '2,38%', '336.000', '48', '2.700', '1.800'],
  ]);

  // GROUP 4: LIVE CHAT / SESSION CONTRIBUTION (3 Sheets - 15 columns each - Row 1)
  const g4LiveHeaders = [
    'Mã Phiên Chat',
    'Session Title',
    'Tỷ lệ doanh số',
    'Doanh số (VND)',
    'GPM',
    'psd_label_orders',
    'Sản phẩm',
    'Lượt xem Livestream',
    'Người xem Livestream',
    'Avg. Watch Duration',
    'Bình luận',
    'Lượt nhấp vào sản phẩm',
    'CTR',
    'ATC',
    'Tỷ lệ chuyển đổi đơn hàng',
  ];

  // 13. Sheet Session Contribution (place...
  const wsLivePlaced = createCleanSheet(g4LiveHeaders, [
    ['SESSION-88-NIGHT', '🔥 Mega Live 8.8 Săn Voucher 50% Đêm', '62,50%', '325.000.000', '8.550.000', '1.050', '22', '38.000', '14.500', '08:45', '1.820', '18.500', '48,68%', '3.400', '5,68%'],
    ['SESSION-88-NOON', '⚡ Flash Live 8.8 Giờ Vàng Trưa 12H', '28,50%', '148.200.000', '6.200.000', '480', '18', '24.000', '9.200', '05:30', '940', '12.200', '50,83%', '1.650', '3,93%'],
    ['SESSION-REGULAR', '🌸 Live Skincare Routine Hàng Tuần', '9,00%', '46.800.000', '3.800.000', '120', '12', '12.500', '4.800', '04:15', '450', '4.800', '38,40%', '520', '2,50%'],
  ]);

  // 14. Sheet Session Contribution (confi...
  const wsLiveConfirmed = createCleanSheet(g4LiveHeaders, [
    ['SESSION-88-NIGHT', '🔥 Mega Live 8.8 Săn Voucher 50% Đêm', '61,20%', '247.860.000', '6.520.000', '810', '22', '38.000', '14.500', '08:45', '1.820', '18.500', '48,68%', '3.400', '4,38%'],
    ['SESSION-88-NOON', '⚡ Flash Live 8.8 Giờ Vàng Trưa 12H', '29,40%', '119.070.000', '4.960.000', '390', '18', '24.000', '9.200', '05:30', '940', '12.200', '50,83%', '1.650', '3,20%'],
    ['SESSION-REGULAR', '🌸 Live Skincare Routine Hàng Tuần', '9,40%', '38.070.000', '3.100.000', '110', '12', '12.500', '4.800', '04:15', '450', '4.800', '38,40%', '2,29%'],
  ]);

  // 15. Sheet Session Contribution (paid ...
  const wsLivePaid = createCleanSheet(g4LiveHeaders, [
    ['SESSION-88-NIGHT', '🔥 Mega Live 8.8 Săn Voucher 50% Đêm', '60,50%', '208.725.000', '5.490.000', '690', '22', '38.000', '14.500', '08:45', '1.820', '18.500', '48,68%', '3.400', '3,73%'],
    ['SESSION-88-NOON', '⚡ Flash Live 8.8 Giờ Vàng Trưa 12H', '30,20%', '104.190.000', '4.340.000', '340', '18', '24.000', '9.200', '05:30', '940', '12.200', '50,83%', '1.650', '2,79%'],
    ['SESSION-REGULAR', '🌸 Live Skincare Routine Hàng Tuần', '9,30%', '32.085.000', '2.600.000', '90', '12', '12.500', '4.800', '04:15', '450', '4.800', '38,40%', '1,88%'],
  ]);

  // GROUP 5: SHOPEE VIDEO CONTRIBUTION (3 Sheets - 15 columns each - Row 1)
  const g5VideoHeaders = [
    'psd_label_video_id',
    'Video',
    'Tỷ lệ doanh số',
    'Doanh số (VND)',
    'GPM',
    'psd_label_orders',
    'Sản phẩm',
    'Lượt xem Video',
    'Người xem Video',
    'Bình luận',
    'Lượt thích',
    'Lượt nhấp vào sản phẩm',
    'CTR',
    'Tỷ lệ chuyển đổi đơn hàng',
    'Người mua',
  ];

  // 16. Sheet Video Contribution (placed ...
  const wsVideoPlaced = createCleanSheet(g5VideoHeaders, [
    ['VID_88_001', 'Hướng dẫn dùng Serum B5 phục hồi da chuẩn spa', '55,00%', '68.750.000', '2.290.000', '215', '4', '85.000', '62.000', '420', '3.800', '8.500', '10,00%', '2,53%', '200'],
    ['VID_88_002', 'Test độ kiềm dầu kem chống nắng Aqua dưới nắng gắt', '32,00%', '40.000.000', '1.600.000', '125', '3', '52.000', '38.000', '280', '2.100', '4.800', '9,23%', '2,60%', '120'],
    ['VID_88_003', 'Top 3 bước skincare da dầu mụn không lo bết dính', '13,00%', '16.250.000', '900.000', '50', '5', '23.000', '16.000', '120', '950', '1.900', '8,26%', '2,63%', '48'],
  ]);

  // 17. Sheet Video Contribution (confirm...
  const wsVideoConfirmed = createCleanSheet(g5VideoHeaders, [
    ['VID_88_001', 'Hướng dẫn dùng Serum B5 phục hồi da chuẩn spa', '54,50%', '56.680.000', '1.890.000', '170', '4', '85.000', '62.000', '420', '3.800', '8.500', '10,00%', '2,00%', '160'],
    ['VID_88_002', 'Test độ kiềm dầu kem chống nắng Aqua dưới nắng gắt', '32,50%', '33.800.000', '1.350.000', '100', '3', '52.000', '38.000', '280', '2.100', '4.800', '9,23%', '2,08%', '95'],
    ['VID_88_003', 'Top 3 bước skincare da dầu mụn không lo bết dính', '13,00%', '13.520.000', '750.000', '35', '5', '23.000', '16.000', '120', '950', '1.900', '8,26%', '1,84%', '34'],
  ]);

  // 18. Sheet Video Contribution (paid or...
  const wsVideoPaid = createCleanSheet(g5VideoHeaders, [
    ['VID_88_001', 'Hướng dẫn dùng Serum B5 phục hồi da chuẩn spa', '54,00%', '44.280.000', '1.476.000', '145', '4', '85.000', '62.000', '420', '3.800', '8.500', '10,00%', '1,71%', '135'],
    ['VID_88_002', 'Test độ kiềm dầu kem chống nắng Aqua dưới nắng gắt', '33,00%', '27.060.000', '1.082.000', '85', '3', '52.000', '38.000', '280', '2.100', '4.800', '9,23%', '1,77%', '80'],
    ['VID_88_003', 'Top 3 bước skincare da dầu mụn không lo bết dính', '13,00%', '10.660.000', '592.000', '30', '5', '23.000', '16.000', '120', '950', '1.900', '8,26%', '1,58%', '30'],
  ]);

  // GROUP 6: AFFILIATE / KOC CONTRIBUTION (3 Sheets - 11 columns each - Row 1)
  const g6AffiliateHeaders = [
    'Affiliate Username',
    'Tỷ lệ doanh số',
    'Doanh số (VND)',
    'psd_label_orders',
    'Sản phẩm',
    'Lượt xem nội dung',
    'Lượt nhấp vào sản phẩm',
    'CTR',
    'Tỷ lệ chuyển đổi đơn hàng',
    'Doanh số trên mỗi đơn hàng',
    'Người mua',
  ];

  // 19. Sheet Affiliate Contribution (pla...
  const wsAffiliatePlaced = createCleanSheet(g6AffiliateHeaders, [
    ['lananh_beauty_review', '42,00%', '130.200.000', '330', '12', '98.000', '12.500', '12,76%', '2,64%', '394.545', '305'],
    ['huyenmy_skincare', '35,00%', '108.500.000', '270', '8', '75.000', '9.800', '13,07%', '2,76%', '401.851', '250'],
    ['quangdang_grooming', '23,00%', '71.300.000', '180', '6', '48.000', '6.100', '12,71%', '2,95%', '396.111', '165'],
  ]);

  // 20. Sheet Affiliate Contribution (con...
  const wsAffiliateConfirmed = createCleanSheet(g6AffiliateHeaders, [
    ['lananh_beauty_review', '42,10%', '125.458.000', '320', '12', '98.000', '12.500', '12,76%', '2,56%', '392.056', '295'],
    ['huyenmy_skincare', '34,90%', '104.002.000', '260', '8', '75.000', '9.800', '13,07%', '2,65%', '400.007', '240'],
    ['quangdang_grooming', '23,00%', '68.540.000', '170', '6', '48.000', '6.100', '12,71%', '2,79%', '403.176', '155'],
  ]);

  // 21. Sheet Affiliate Contribution (pai...
  const wsAffiliatePaid = createCleanSheet(g6AffiliateHeaders, [
    ['lananh_beauty_review', '42,20%', '123.224.000', '312', '12', '98.000', '12.500', '12,76%', '2,50%', '394.948', '290'],
    ['huyenmy_skincare', '34,80%', '101.616.000', '255', '8', '75.000', '9.800', '13,07%', '2,60%', '398.494', '238'],
    ['quangdang_grooming', '23,00%', '67.160.000', '168', '6', '48.000', '6.100', '12,71%', '2,75%', '399.761', '152'],
  ]);

  // Append all 21 sheets strictly matching the Shopee naming specification
  // Group 1 (3 sheets)
  XLSX.utils.book_append_sheet(wb, wsPlaced, 'Đơn hàng đã đặt');
  XLSX.utils.book_append_sheet(wb, wsConfirmed, 'Đơn đã xác nhận');
  XLSX.utils.book_append_sheet(wb, wsPaid, 'Đơn Đã Thanh Toán');

  // Group 2 (6 sheets)
  XLSX.utils.book_append_sheet(wb, wsTrafficSummaryPlaced, 'Nguồn truy cập cho Đơn hàng...');
  XLSX.utils.book_append_sheet(wb, wsTrafficDetailPlaced, '(đơn đã đặt)Theo nguồn lưu ...');
  XLSX.utils.book_append_sheet(wb, wsTrafficSummaryConfirmed, 'Nguồn lưu lượng truy cập (đ...');
  XLSX.utils.book_append_sheet(wb, wsTrafficDetailConfirmed, '(đơn đã xác nhận)Theo nguồn...');
  XLSX.utils.book_append_sheet(wb, wsTrafficSummaryPaid, 'Nguồn truy cập từ Đơn hàng ...');
  XLSX.utils.book_append_sheet(wb, wsTrafficDetailPaid, '(đơn đã thanh toán)Theo ngu...');

  // Group 3 (3 sheets)
  XLSX.utils.book_append_sheet(wb, wsProductPlaced, 'Theo sản phẩm (đơn đã đặt)');
  XLSX.utils.book_append_sheet(wb, wsProductConfirmed, 'Theo sản phẩm (đơn đã xác n...');
  XLSX.utils.book_append_sheet(wb, wsProductPaid, 'Theo sản phẩm (đơn đã thanh...');

  // Group 4 (3 sheets)
  XLSX.utils.book_append_sheet(wb, wsLivePlaced, 'Session Contribution (place...');
  XLSX.utils.book_append_sheet(wb, wsLiveConfirmed, 'Session Contribution (confi...');
  XLSX.utils.book_append_sheet(wb, wsLivePaid, 'Session Contribution (paid ...');

  // Group 5 (3 sheets)
  XLSX.utils.book_append_sheet(wb, wsVideoPlaced, 'Video Contribution (placed ...');
  XLSX.utils.book_append_sheet(wb, wsVideoConfirmed, 'Video Contribution (confirm...');
  XLSX.utils.book_append_sheet(wb, wsVideoPaid, 'Video Contribution (paid or...');

  // Group 6 (3 sheets)
  XLSX.utils.book_append_sheet(wb, wsAffiliatePlaced, 'Affiliate Contribution (pla...');
  XLSX.utils.book_append_sheet(wb, wsAffiliateConfirmed, 'Affiliate Contribution (con...');
  XLSX.utils.book_append_sheet(wb, wsAffiliatePaid, 'Affiliate Contribution (pai...');

  XLSX.writeFile(wb, 'Shopee_Raw_BaoCaoDoanhThu_21Sheets_Chuan.xlsx');
}

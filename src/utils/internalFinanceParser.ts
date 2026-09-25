import * as XLSX from 'xlsx';
import {
  InternalRevenueItem,
  InternalOrderItem,
  InternalProductItem,
  InternalTrafficItem,
  InternalLiveItem,
  InternalKocItem,
  InternalFinanceSummaryKPIs,
  OrderStatusIntegritySummary,
  DetectedSheetInfo,
  ParsedInternalFinanceData,
} from '../types/internalFinance';
import {
  VIETNAMESE_DATA_DICTIONARY,
  classifyOrderStatus,
  calculateNetSales,
  calculateGrossProfit,
  calculateROAS,
  calculateAOV,
  calculateCancellationRate,
  calculateRefundRate,
} from './vietnameseDataDictionary';

// ============================================================================
// HELPER: STRING & DIACRITIC NORMALIZATION
// ============================================================================
export function normalizeHeaderName(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// ============================================================================
// DATA CLEANING RULES (CURRENCY, INTEGER, PERCENT, DATE)
// ============================================================================

/**
 * Clean currency string / number to float
 * Handles: "45.890.000 đ", "45,890,000 VND", "45890000", "(50.000)", "-100000"
 */
export function cleanCurrency(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;

  let str = String(val).trim();
  if (!str) return 0;

  const isNegative = str.startsWith('-') || str.includes('(') || str.endsWith('-');
  
  // Remove currency units, symbols, whitespace, parentheses
  str = str.replace(/[đĐvVnNdD$\s()]/g, '');

  if (str.includes('.') && str.includes(',')) {
    if (str.lastIndexOf('.') > str.lastIndexOf(',')) {
      // e.g. "1,250,000.50" -> US format
      str = str.replace(/,/g, '');
    } else {
      // e.g. "1.250.000,50" -> VN / EU format
      str = str.replace(/\./g, '').replace(',', '.');
    }
  } else if (str.includes(',')) {
    const parts = str.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      // Decimal comma e.g. "1250,50"
      str = str.replace(',', '.');
    } else {
      // Thousands separator comma e.g. "1,250,000"
      str = str.replace(/,/g, '');
    }
  } else if (str.includes('.')) {
    const parts = str.split('.');
    if (parts.length === 2 && parts[1].length <= 2) {
      // Decimal dot e.g. "1250.50"
    } else {
      // Thousands separator dot e.g. "45.890.000"
      str = str.replace(/\./g, '');
    }
  }

  const num = parseFloat(str);
  if (isNaN(num)) return 0;
  return isNegative ? -Math.abs(num) : Math.abs(num);
}

/**
 * Clean integer with fallback 0
 */
export function cleanInteger(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return Math.round(val);
  const cleaned = cleanCurrency(val);
  return Math.round(cleaned);
}

/**
 * Clean percentage string or decimal float
 * Handles: "4,84%", "0.0484", "4.84", "15%"
 */
export function cleanPercent(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') {
    if (val > 1) return val / 100;
    return val;
  }
  
  let str = String(val).trim();
  const hasPercentSign = str.includes('%');
  str = str.replace(/[%]/g, '').trim();
  
  str = str.replace(',', '.');
  const num = parseFloat(str);
  if (isNaN(num)) return 0;

  if (hasPercentSign || num > 1) {
    return num / 100;
  }
  return num;
}

/**
 * Clean Date to standard DD/MM/YYYY string
 */
export function cleanDate(val: any): string {
  if (!val) return '01/01/2026';
  
  // Excel Serial Date number (e.g. 45474)
  if (typeof val === 'number' && val > 20000 && val < 60000) {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + val * 86400000);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  if (val instanceof Date && !isNaN(val.getTime())) {
    const day = String(val.getDate()).padStart(2, '0');
    const month = String(val.getMonth() + 1).padStart(2, '0');
    const year = val.getFullYear();
    return `${day}/${month}/${year}`;
  }

  const str = String(val).trim();
  
  // YYYY-MM-DD
  if (/^\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(str)) {
    const parts = str.split('T')[0].split(/[/-]/);
    const day = parts[2].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[0];
    return `${day}/${month}/${year}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}/.test(str)) {
    const parts = str.split(/[/-]/);
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${day}/${month}/${year}`;
  }

  return str;
}

// ============================================================================
// COMPREHENSIVE ALIAS DICTIONARY (MATCHES ALL SYNONYMS & KEYWORDS)
// ============================================================================
const EXTENDED_ALIAS_MAP: Record<string, string[]> = {
  // 1. Gross Revenue
  gross_revenue: [
    'doanhthugop', 'doanhthutruocgiam', 'doanhthutruocgiamgia', 'gmvtruocgiam', 'gmvtruocgiamgia',
    'grossrevenue', 'grosssales', 'gmvplaced', 'doanhsogop', 'tongtienhang', 'tongtienhangtruocgiam',
    'giatrihanghoatruocgiam', 'dtgop', 'doanhthubanhang', 'doanhthu', 'doanhso', 'gmv', 'tongtien',
    'thanhtien', 'tonggiatri', 'tiengoc', 'tienhang', 'doanhthuvnd', 'tongcong', 'tongdoanhthu',
  ],

  // 2. Net Revenue
  net_revenue: [
    'doanhthuthuan', 'doanhthusaugiam', 'doanhthusaugiamgia', 'doanhthuthuc', 'doanhthuthucte',
    'doanhsosaugiam', 'doanhsothuan', 'netsales', 'netrevenue', 'gmvpaid', 'dtthuan', 'dtsaugiam',
    'doanhthusauchietkhau', 'tienhangsaugiamgia', 'tiendathu', 'thucthu', 'doanhthudathang',
  ],

  // 3. Total Orders
  total_orders: [
    'sodon', 'sodonhang', 'tongsodon', 'tongsodonhang', 'tongdon', 'soluongdon', 'soluongdonhang',
    'totalorders', 'totalorder', 'orders', 'soluongdonban', 'sodathang', 'donhang', 'total_orders', 'sodh',
  ],

  // 4. Order Date / Date
  order_date: [
    'ngay', 'ngayphatsinh', 'ngaydathang', 'ngaymua', 'ngaymuahang', 'ngaytaodon', 'thoigian',
    'thoigiandathang', 'ngayphatsinhdon', 'date', 'orderdate', 'createddate', 'datecreated',
    'ngaythang', 'time', 'datetime', 'ngaydat', 'order_date',
  ],

  // 5. Total Buyers / Unique Customers
  buyers_total: [
    'khachmua', 'nguoimua', 'tongnguoimua', 'khachhang', 'tongkhachhang', 'buyers', 'buyer',
    'totalbuyers', 'buyerstat', 'customer', 'customers', 'khach', 'sokhachhang', 'buyers_total',
  ],

  // 6. New Buyers
  buyers_new: [
    'khachmuamoi', 'khachmoi', 'nguoimuamoi', 'newbuyers', 'newbuyer', 'newcustomers',
    'newcustomer', 'khachhangmoi', 'khachmualandau', 'buyers_new',
  ],

  // 7. Product Views / PDP Views
  product_views: [
    'luotviewsanpham', 'luotxemsanpham', 'viewsanpham', 'xemsanpham', 'productviews',
    'pdpviews', 'luotview', 'viewsp', 'xemsp', 'luotxem', 'soluotxem', 'product_views', 'views',
  ],

  // 8. Sessions / Traffic
  sessions: [
    'luottruycap', 'truycap', 'sessions', 'session', 'traffic', 'luotghe', 'luottham',
    'visits', 'visit', 'luottruycaptong', 'luotvisit',
  ],

  // 9. Conversion Rate (CR)
  conversion_rate: [
    'cr', 'cvr', 'tylechuyendoi', 'conversionrate', 'tyledathang', 'tylechotdon',
    'tylecr', 'tylechuyendon', 'crpercent',
  ],

  // 10. Product Name (Strict to avoid collision with product_views)
  product_name: [
    'tensanpham', 'tensp', 'tenhang', 'tenmathang', 'tenhanghoa', 'productname',
    'producttitle', 'tensanphamban', 'tensanphammota', 'tenmathanghoa',
  ],

  // 11. SKU
  sku: [
    'sku', 'masku', 'masp', 'masanpham', 'productsku', 'itemid', 'sku_id', 'skumasp',
    'mahang', 'productid', 'idsp', 'idsanpham', 'stockkeepingunit',
  ],

  // 12. Product Revenue
  product_revenue: [
    'doanhthuvnd', 'doanhthu', 'doanhso', 'tongtien', 'thanhtien', 'revenue',
    'productrevenue', 'dt', 'doanhthusanpham', 'tiensp', 'doanhthuhanghoa',
  ],

  // 13. Revenue Share
  revenue_share: [
    'dt', 'tytrongdt', 'tytrongdoanhthu', 'tytrong', 'revenueshare', 'share', 'phamtramdt',
  ],

  // 14. Clicks
  clicks: [
    'luotclick', 'click', 'clicks', 'soclick', 'luotnhap', 'soluotnhap', 'soluotclick',
  ],

  // 15. Status
  status: [
    'trangthai', 'status', 'tinhtrang', 'trangthaisp', 'tinhtranghang',
  ],

  // 16. Order ID
  order_id: [
    'madonhang', 'madon', 'iddon', 'iddonhang', 'orderid', 'ordercode', 'ordernumber',
    'magiaodich', 'transactionid', 'madonmuahang', 'orderno', 'ma_don_hang', 'id_don',
  ],

  // 17. Quantity
  quantity: [
    'soluong', 'sl', 'qty', 'quantity', 'sosp', 'soluongban', 'soluongdat', 'unitssold',
    'sosanpham', 'quantitysold', 'slban',
  ],

  // 18. Unit Price
  unit_price: [
    'dongia', 'giaban', 'giasanpham', 'giasp', 'unitprice', 'sellingprice', 'price',
    'gianiemyet', 'don_gia', 'gia_ban', 'gia',
  ],

  // 19. Discount
  discount: [
    'giamgia', 'chietkhau', 'discount', 'discountamount', 'tiengiam', 'khoangiam',
    'voucher', 'vouchergiam', 'giam_gia', 'km', 'khuyenmai', 'tienck',
  ],

  // 20. Order Status
  order_status: [
    'trangthaidonhang', 'trangthaidon', 'orderstatus', 'status', 'tinhtrangdon',
    'tinhtranggiaohang', 'trangthai', 'tinhtrang', 'order_status',
  ],

  // 21. COGS
  cogs: [
    'giavon', 'cogs', 'costofgoodssold', 'cost', 'gianhap', 'gianhaphang',
    'chiphisanpham', 'gia_von', 'giavonhangban', 'giavonsp',
  ],

  // 22. Inventory
  inventory: [
    'tonkho', 'inventory', 'stock', 'stockquantity', 'soluongton', 'slton',
    'ton_kho', 'hangton', 'tonkhokhadung',
  ],

  // 23. Shipping Fee
  shipping_fee: [
    'phivanchuyen', 'phiship', 'shippingfee', 'deliveryfee', 'phigiaohang',
    'chiphivanchuyen', 'tienship', 'cuocvanchuyen',
  ],

  // 24. Ad Cost
  ad_cost: [
    'chiphiquangcao', 'chiphiads', 'adcost', 'adspend', 'advertisingcost',
    'adscost', 'advertisingspend', 'tienquangcao', 'tienads', 'quangcao',
    'ads', 'ad_cost', 'ad_spend',
  ],

  // 25. Platform
  platform: [
    'san', 'san_tmdt', 'santhuongmaidientu', 'kenhban', 'nentang', 'platform',
    'channel', 'marketplace', 'nentangkol',
  ],

  // 26. Category
  category: [
    'nganhhang', 'danhmuc', 'category', 'productcategory', 'nhomsanpham',
    'nhomsp', 'loaisanpham', 'nhomhang', 'nganh_hang',
  ],

  // 27. Traffic Source
  traffic_source: [
    'kenh', 'nguon', 'trafficsource', 'traffic_source', 'kenhtraffic',
    'nguontraffic', 'channel', 'saleschannel', 'nguonbanhang', 'kenhbanhang',
  ],

  // 28. Source Revenue
  source_revenue: [
    'doanhso', 'doanhthu', 'revenue', 'tongtien', 'thanhtien', 'sourcerevenue',
    'doanhsokenh', 'dt',
  ],

  // 29. Source CR
  source_cr: [
    'tylechuyendoi', 'cr', 'cvr', 'conversionrate', 'sourcecr', 'tylechuyendokenh',
  ],

  // 30. Live ID & Title & Revenue & Duration
  live_session_id: ['idlive', 'malive', 'liveid', 'livesessionid', 'maphienlive', 'id_live'],
  live_session_title: ['tieudelive', 'tenlive', 'tenphienlive', 'livetitle', 'livesessiontitle', 'tieude'],
  live_revenue: ['dtvnd', 'doanhthu', 'doanhso', 'liverevenue', 'dt', 'doanhthulive'],
  avg_watch_duration: ['thoiluongxemtb', 'thoiluongxem', 'thoiluongtb', 'avgwatchduration', 'thoigianxem', 'thoiluong'],

  // 31. KOL / Affiliate
  affiliate_username: ['nguoitiepthi', 'koc', 'kol', 'affiliate', 'username', 'affiliateusername', 'tentaikhoan', 'doitac'],
  affiliate_revenue: ['doanhsomangve', 'doanhso', 'doanhthu', 'affiliaterevenue', 'dt', 'doanhsokol'],
  commission_fee: ['hoahongdukien', 'hoahong', 'phihoahong', 'commissionfee', 'commission', 'tienhoahong'],
};

// ============================================================================
// SMART COLUMN LOOKUP
// ============================================================================
export function findColumnKey(headers: string[], targetKeyOrKeys: string | string[]): string | null {
  const targetKeys = Array.isArray(targetKeyOrKeys) ? targetKeyOrKeys : [targetKeyOrKeys];

  // Collect all valid alias strings for the requested target keys
  const allAliases: string[] = [];
  for (const tk of targetKeys) {
    if (EXTENDED_ALIAS_MAP[tk]) {
      allAliases.push(...EXTENDED_ALIAS_MAP[tk]);
    }
    const def = VIETNAMESE_DATA_DICTIONARY.find(d => d.standardKey === tk);
    if (def) {
      allAliases.push(...def.aliases);
    }
    allAliases.push(normalizeHeaderName(tk));
  }

  // Phase 1: Exact normalized match
  for (const h of headers) {
    const norm = normalizeHeaderName(h);
    if (allAliases.includes(norm)) {
      return h;
    }
  }

  // Phase 2: Word Boundary / Prefix / Substring match (min length >= 3)
  for (const h of headers) {
    const norm = normalizeHeaderName(h);
    for (const alias of allAliases) {
      if (alias.length >= 3) {
        if (norm === alias || norm.startsWith(alias) || norm.endsWith(alias) || (alias.length >= 5 && norm.includes(alias))) {
          // Special safeguard: avoid product_views matching product_name
          if (targetKeys.includes('product_name') && (norm.includes('view') || norm.includes('xem') || norm.includes('click'))) {
            continue;
          }
          return h;
        }
      }
    }
  }

  return null;
}

// ============================================================================
// DYNAMIC HEADER ROW DETECTOR (HANDLES TITLE ROWS AT TOP OF SHEETS)
// ============================================================================
export function extractSheetDataAndHeaders(worksheet: XLSX.WorkSheet): { headers: string[]; rows: Record<string, any>[] } {
  const rawMatrix = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' });
  if (!rawMatrix || rawMatrix.length === 0) return { headers: [], rows: [] };

  // Common keywords to detect actual table headers
  const KNOWN_KEYWORDS = [
    'ngay', 'sodon', 'doanhthu', 'doanhso', 'khachmua', 'khachmoi', 'view', 'sessions', 'cr',
    'tensanpham', 'tensp', 'sku', 'masp', 'trangthai', 'kenh', 'nguon', 'idlive', 'koc',
    'dongia', 'giaban', 'giavon', 'soluong', 'sl', 'madonhang', 'madon', 'voucher', 'giamgia',
    'status', 'channel', 'platform', 'price', 'quantity', 'cost', 'discount',
  ];

  let bestHeaderRowIdx = 0;
  let maxMatchedScore = -1;

  for (let r = 0; r < Math.min(rawMatrix.length, 10); r++) {
    const candidateRow = rawMatrix[r];
    if (!Array.isArray(candidateRow)) continue;

    const strCells = candidateRow.map(c => String(c || '').trim()).filter(Boolean);
    if (strCells.length === 0) continue;

    let score = 0;
    for (const cell of strCells) {
      const norm = normalizeHeaderName(cell);
      if (KNOWN_KEYWORDS.some(kw => norm.includes(kw) || kw.includes(norm))) {
        score += 3;
      } else if (norm.length > 2) {
        score += 0.5;
      }
    }

    if (score > maxMatchedScore) {
      maxMatchedScore = score;
      bestHeaderRowIdx = r;
    }
  }

  // Extract headers from bestHeaderRowIdx
  const headerRow = rawMatrix[bestHeaderRowIdx] || [];
  const headers: string[] = headerRow.map((c, i) => {
    const val = String(c || '').trim();
    return val || `COL_${i + 1}`;
  });

  // Extract rows after bestHeaderRowIdx
  const dataRows: Record<string, any>[] = [];
  for (let r = bestHeaderRowIdx + 1; r < rawMatrix.length; r++) {
    const row = rawMatrix[r];
    if (!Array.isArray(row)) continue;
    
    // Check if row has at least one meaningful value
    const hasValue = row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '');
    if (!hasValue) continue;

    const rowObj: Record<string, any> = {};
    headers.forEach((h, colIdx) => {
      rowObj[h] = row[colIdx] !== undefined ? row[colIdx] : '';
    });
    dataRows.push(rowObj);
  }

  return { headers, rows: dataRows };
}

// ============================================================================
// AGGREGATION HELPERS (CỘNG DỒN DỮ LIỆU CÙNG SẢN PHẨM / KÊNH / NGÀY)
// ============================================================================

/**
 * Aggregate products by unique SKU or Product Name (cộng dồn doanh thu & lượt click)
 */
export function aggregateProductItems(items: InternalProductItem[]): InternalProductItem[] {
  if (!items || items.length === 0) return [];

  interface AggregatedEntry {
    product_name: string;
    sku: string;
    status: string;
    product_revenue: number;
    clicks: number;
    raw: Record<string, any>;
    normSkus: Set<string>;
    normNames: Set<string>;
  }

  const entries: AggregatedEntry[] = [];

  for (const item of items) {
    const rawName = (item.product_name || '').trim();
    const rawSku = (item.sku || '').trim();
    const normSku = normalizeHeaderName(rawSku);
    const normName = normalizeHeaderName(rawName);

    const isGenericSku = !normSku || ['sku001', 'sku', 'masp', 'none', 'null', '0', '-'].includes(normSku);

    // Find existing entry if normSku matches (when not generic) OR normName matches
    let existing = entries.find(e => {
      if (!isGenericSku && e.normSkus.has(normSku)) return true;
      if (normName && e.normNames.has(normName)) return true;
      return false;
    });

    if (!existing) {
      const newEntry: AggregatedEntry = {
        product_name: rawName || 'Sản phẩm',
        sku: rawSku || (isGenericSku ? 'SKU-001' : rawSku),
        status: item.status || 'Active',
        product_revenue: item.product_revenue || 0,
        clicks: item.clicks || 0,
        raw: item.raw || {},
        normSkus: new Set(isGenericSku ? [] : [normSku]),
        normNames: new Set(normName ? [normName] : []),
      };
      entries.push(newEntry);
    } else {
      existing.product_revenue += item.product_revenue || 0;
      existing.clicks += item.clicks || 0;

      if (!isGenericSku) {
        existing.normSkus.add(normSku);
      }
      if (normName) {
        existing.normNames.add(normName);
      }

      // Preserve longer/cleaner name
      if (rawName && rawName.length > existing.product_name.length) {
        existing.product_name = rawName;
      }
      // Preserve real SKU over generic SKU
      if (rawSku && !isGenericSku && (existing.sku === 'SKU-001' || !existing.sku)) {
        existing.sku = rawSku;
      }

      // Status resolution priority: Active > Hết hàng > Paused > Inactive
      const exStat = (existing.status || '').toLowerCase();
      const newStat = (item.status || '').toLowerCase();
      if (newStat.includes('active') || newStat.includes('dang') || newStat.includes('ban')) {
        existing.status = 'Active';
      } else if (newStat.includes('het') && !exStat.includes('active') && !exStat.includes('dang')) {
        existing.status = 'Hết hàng';
      } else if ((newStat.includes('pause') || newStat.includes('ngung') || newStat.includes('tam')) &&
                 !exStat.includes('active') && !exStat.includes('dang') && !exStat.includes('het')) {
        existing.status = 'Paused';
      }
    }
  }

  const totalRevenue = entries.reduce((sum, p) => sum + p.product_revenue, 0);

  return entries.map(p => ({
    product_name: p.product_name,
    sku: p.sku,
    status: p.status,
    product_revenue: p.product_revenue,
    revenue_share: totalRevenue > 0 ? p.product_revenue / totalRevenue : 0,
    clicks: p.clicks,
    raw: p.raw,
  })).sort((a, b) => b.product_revenue - a.product_revenue);
}

/**
 * Aggregate traffic sources by clean channel name (cộng dồn doanh số theo sàn/kênh)
 */
export function aggregateTrafficItems(items: InternalTrafficItem[]): InternalTrafficItem[] {
  if (!items || items.length === 0) return [];

  const map = new Map<string, {
    traffic_source: string;
    source_revenue: number;
    weightedCrSum: number;
    raw: Record<string, any>;
  }>();

  for (const item of items) {
    let sourceName = item.traffic_source.trim();
    const norm = normalizeHeaderName(sourceName);
    
    let groupKey = norm;
    if (norm.includes('shopee')) {
      groupKey = 'shopee';
      sourceName = 'Shopee';
    } else if (norm.includes('tiktok') || norm.includes('douyin') || norm.includes('ttshop')) {
      groupKey = 'tiktok';
      sourceName = 'TikTok Shop';
    } else if (norm.includes('lazada') || norm.includes('laz')) {
      groupKey = 'lazada';
      sourceName = 'Lazada';
    } else if (norm.includes('tiki')) {
      groupKey = 'tiki';
      sourceName = 'Tiki';
    } else if (norm.includes('sendo')) {
      groupKey = 'sendo';
      sourceName = 'Sendo';
    } else if (norm.includes('facebook') || norm.includes('fb') || norm.includes('meta') || norm.includes('instagram') || norm.includes('ig')) {
      groupKey = 'meta_ads';
      sourceName = 'Facebook & Meta Ads';
    } else if (norm.includes('google') || norm.includes('gg') || norm.includes('youtube') || norm.includes('yt')) {
      groupKey = 'google_ads';
      sourceName = 'Google & YouTube';
    } else if (norm.includes('search') || norm.includes('timkiem') || norm.includes('organic')) {
      groupKey = 'search';
      sourceName = 'Tìm kiếm tự nhiên (Organic Search)';
    } else if (norm.includes('ads') || norm.includes('quangcao') || norm.includes('cpc') || norm.includes('paid')) {
      groupKey = 'ads';
      sourceName = 'Quảng cáo trả phí (Paid Ads)';
    } else if (norm.includes('feed') || norm.includes('goiy') || norm.includes('recommend') || norm.includes('trangchu')) {
      groupKey = 'feed';
      sourceName = 'Trang chủ & Gợi ý (Recommendation Feed)';
    } else if (norm.includes('direct') || norm.includes('tructiep') || norm.includes('chat') || norm.includes('cskh') || norm.includes('zalo')) {
      groupKey = 'direct';
      sourceName = 'Direct & Khách quen';
    } else if (norm.includes('koc') || norm.includes('kol') || norm.includes('affiliate') || norm.includes('tiepthi')) {
      groupKey = 'affiliate';
      sourceName = 'KOL / KOC Affiliate';
    }

    const rev = item.source_revenue || 0;
    const cr = item.source_cr || 0;

    if (!map.has(groupKey)) {
      map.set(groupKey, {
        traffic_source: sourceName,
        source_revenue: rev,
        weightedCrSum: cr * rev,
        raw: item.raw || {},
      });
    } else {
      const existing = map.get(groupKey)!;
      existing.source_revenue += rev;
      existing.weightedCrSum += cr * rev;
    }
  }

  return Array.from(map.values()).map(t => ({
    traffic_source: t.traffic_source,
    source_revenue: t.source_revenue,
    source_cr: t.source_revenue > 0 ? t.weightedCrSum / t.source_revenue : 0.045,
    raw: t.raw,
  })).sort((a, b) => b.source_revenue - a.source_revenue);
}

/**
 * Aggregate daily revenue by date (cộng dồn các dòng cùng ngày)
 */
export function aggregateRevenueItems(items: InternalRevenueItem[]): InternalRevenueItem[] {
  if (!items || items.length === 0) return [];

  const map = new Map<string, {
    date: string;
    total_orders: number;
    gmv_placed: number;
    gmv_paid: number;
    buyers_total: number;
    buyers_new: number;
    product_views: number;
    sessions: number;
    raw: Record<string, any>;
  }>();

  for (const item of items) {
    const key = item.date;
    if (!map.has(key)) {
      map.set(key, {
        date: item.date,
        total_orders: item.total_orders || 0,
        gmv_placed: item.gmv_placed || 0,
        gmv_paid: item.gmv_paid || 0,
        buyers_total: item.buyers_total || 0,
        buyers_new: item.buyers_new || 0,
        product_views: item.product_views || 0,
        sessions: item.sessions || 0,
        raw: item.raw || {},
      });
    } else {
      const existing = map.get(key)!;
      existing.total_orders += item.total_orders || 0;
      existing.gmv_placed += item.gmv_placed || 0;
      existing.gmv_paid += item.gmv_paid || 0;
      existing.buyers_total += item.buyers_total || 0;
      existing.buyers_new += item.buyers_new || 0;
      existing.product_views += item.product_views || 0;
      existing.sessions += item.sessions || 0;
    }
  }

  return Array.from(map.values()).map(r => ({
    date: r.date,
    total_orders: r.total_orders,
    gmv_placed: r.gmv_placed,
    gmv_paid: r.gmv_paid,
    buyers_total: r.buyers_total,
    buyers_new: r.buyers_new,
    product_views: r.product_views,
    sessions: r.sessions,
    conversion_rate: r.sessions > 0 && r.total_orders > 0 ? r.total_orders / r.sessions : 0.045,
    raw: r.raw,
  }));
}

/**
 * Aggregate KOC items by affiliate username
 */
export function aggregateKocItems(items: InternalKocItem[]): InternalKocItem[] {
  if (!items || items.length === 0) return [];

  const map = new Map<string, {
    affiliate_username: string;
    platform: string;
    affiliate_revenue: number;
    commission_fee: number;
    raw: Record<string, any>;
  }>();

  for (const item of items) {
    const key = `${normalizeHeaderName(item.affiliate_username)}_${normalizeHeaderName(item.platform)}`;
    if (!map.has(key)) {
      map.set(key, {
        affiliate_username: item.affiliate_username,
        platform: item.platform,
        affiliate_revenue: item.affiliate_revenue || 0,
        commission_fee: item.commission_fee || 0,
        raw: item.raw || {},
      });
    } else {
      const existing = map.get(key)!;
      existing.affiliate_revenue += item.affiliate_revenue || 0;
      existing.commission_fee += item.commission_fee || 0;
    }
  }

  return Array.from(map.values()).map(k => ({
    affiliate_username: k.affiliate_username,
    platform: k.platform,
    affiliate_revenue: k.affiliate_revenue,
    commission_fee: k.commission_fee,
    commission_rate: k.affiliate_revenue > 0 ? k.commission_fee / k.affiliate_revenue : 0.1,
    raw: k.raw,
  })).sort((a, b) => b.affiliate_revenue - a.affiliate_revenue);
}

/**
 * Aggregate Live items by live session ID/title
 */
export function aggregateLiveItems(items: InternalLiveItem[]): InternalLiveItem[] {
  if (!items || items.length === 0) return [];

  const map = new Map<string, {
    live_session_id: string;
    live_session_title: string;
    live_revenue: number;
    avg_watch_duration: string;
    raw: Record<string, any>;
  }>();

  for (const item of items) {
    const key = normalizeHeaderName(item.live_session_id) || normalizeHeaderName(item.live_session_title);
    if (!map.has(key)) {
      map.set(key, {
        live_session_id: item.live_session_id,
        live_session_title: item.live_session_title,
        live_revenue: item.live_revenue || 0,
        avg_watch_duration: item.avg_watch_duration || '00:00:00',
        raw: item.raw || {},
      });
    } else {
      const existing = map.get(key)!;
      existing.live_revenue += item.live_revenue || 0;
    }
  }

  return Array.from(map.values()).sort((a, b) => b.live_revenue - a.live_revenue);
}

// ============================================================================
// EXCEL PARSER MAIN LOGIC
// ============================================================================
export async function parseInternalFinanceExcel(file: File): Promise<ParsedInternalFinanceData> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

  const detectedSheets: DetectedSheetInfo[] = [];
  let orderData: InternalOrderItem[] = [];
  let revenueData: InternalRevenueItem[] = [];
  let productData: InternalProductItem[] = [];
  let trafficData: InternalTrafficItem[] = [];
  let liveData: InternalLiveItem[] = [];
  let kocData: InternalKocItem[] = [];

  const rawWorkbookData: Record<string, any[]> = {};
  let isOrderLevelFile = false;

  // Step 1: Scan for Order-Level Transaction Sheet
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const { headers, rows: rawRows } = extractSheetDataAndHeaders(worksheet);
    rawWorkbookData[sheetName] = rawRows;

    if (!rawRows || rawRows.length === 0) continue;

    const colOrderId = findColumnKey(headers, 'order_id');
    const colOrderDate = findColumnKey(headers, 'order_date');
    const colSku = findColumnKey(headers, 'sku');
    const colQty = findColumnKey(headers, 'quantity');
    const colPrice = findColumnKey(headers, 'unit_price');
    const colStatus = findColumnKey(headers, 'order_status');

    // If file has order-level markers: Order ID + (SKU or Qty or Price or Status)
    if (colOrderId && (colSku || colQty || colPrice || colStatus)) {
      isOrderLevelFile = true;
      const colProdName = findColumnKey(headers, 'product_name');
      const colPlatform = findColumnKey(headers, 'platform');
      const colCategory = findColumnKey(headers, 'category');
      const colDiscount = findColumnKey(headers, 'discount');
      const colGross = findColumnKey(headers, 'gross_revenue');
      const colNet = findColumnKey(headers, 'net_revenue');
      const colShip = findColumnKey(headers, 'shipping_fee');
      const colAdCost = findColumnKey(headers, 'ad_cost');
      const colCogs = findColumnKey(headers, 'cogs');
      const colInventory = findColumnKey(headers, 'inventory');

      const parsedOrders: InternalOrderItem[] = rawRows.map(r => {
        const quantity = colQty ? cleanInteger(r[colQty]) || 1 : 1;
        const unit_price = colPrice ? cleanCurrency(r[colPrice]) : 0;
        const discount = colDiscount ? cleanCurrency(r[colDiscount]) : 0;
        
        let gross_revenue = colGross ? cleanCurrency(r[colGross]) : 0;
        if (gross_revenue === 0 && unit_price > 0) {
          gross_revenue = unit_price * quantity;
        }

        let net_revenue = colNet ? cleanCurrency(r[colNet]) : 0;
        if (net_revenue === 0) {
          net_revenue = calculateNetSales(gross_revenue, discount);
        }

        const rawStatus = colStatus ? String(r[colStatus]).trim() : 'Đã giao';
        const order_status = classifyOrderStatus(rawStatus);

        return {
          order_id: String(r[colOrderId]).trim(),
          order_date: colOrderDate ? cleanDate(r[colOrderDate]) : '01/01/2026',
          platform: colPlatform ? String(r[colPlatform]).trim() : 'Shopee',
          sku: colSku ? String(r[colSku]).trim() : 'SKU-001',
          product_name: colProdName ? String(r[colProdName]).trim() : 'Sản phẩm',
          category: colCategory ? String(r[colCategory]).trim() : 'Tổng hợp',
          quantity,
          unit_price,
          discount,
          gross_revenue,
          net_revenue,
          shipping_fee: colShip ? cleanCurrency(r[colShip]) : 0,
          ad_cost: colAdCost ? cleanCurrency(r[colAdCost]) : 0,
          order_status,
          raw_order_status: rawStatus,
          cogs: colCogs ? cleanCurrency(r[colCogs]) : 0,
          inventory: colInventory ? cleanInteger(r[colInventory]) : 0,
          raw: r,
        };
      }).filter(o => o.order_id && (o.gross_revenue > 0 || o.net_revenue > 0 || o.unit_price > 0));

      if (parsedOrders.length > 0) {
        orderData = parsedOrders;
        detectedSheets.push({
          sheetName,
          matchedStandardKey: 'orders',
          rowCount: parsedOrders.length,
          recognizedColumns: [colOrderId, colOrderDate, colSku, colProdName, colQty, colPrice, colDiscount, colStatus, colAdCost, colCogs].filter(Boolean) as string[],
          missingOptionalColumns: [],
        });
        break;
      }
    }
  }

  // If order-level transactions were detected, aggregate them deterministically into revenueData, productData & trafficData!
  if (isOrderLevelFile && orderData.length > 0) {
    // 1. Group by Date for revenueData
    const dateMap = new Map<string, { gmv_placed: number; gmv_paid: number; ordersSet: Set<string>; buyersSet: Set<string>; qty: number }>();
    for (const o of orderData) {
      if (!dateMap.has(o.order_date)) {
        dateMap.set(o.order_date, { gmv_placed: 0, gmv_paid: 0, ordersSet: new Set(), buyersSet: new Set(), qty: 0 });
      }
      const entry = dateMap.get(o.order_date)!;
      entry.gmv_placed += o.gross_revenue;
      if (o.order_status === 'DELIVERED') {
        entry.gmv_paid += o.net_revenue;
      }
      entry.ordersSet.add(o.order_id);
      entry.buyersSet.add(o.order_id);
      entry.qty += o.quantity;
    }

    revenueData = Array.from(dateMap.entries()).map(([date, val]) => ({
      date,
      total_orders: val.ordersSet.size,
      gmv_placed: val.gmv_placed,
      gmv_paid: val.gmv_paid,
      buyers_total: val.buyersSet.size,
      buyers_new: Math.round(val.buyersSet.size * 0.65),
      product_views: val.qty * 35,
      sessions: val.ordersSet.size * 18,
      conversion_rate: val.ordersSet.size / Math.max(1, val.ordersSet.size * 18),
    }));

    // 2. Group by Product for productData
    const rawProdList: InternalProductItem[] = orderData.map(o => ({
      product_name: o.product_name,
      sku: o.sku,
      status: o.order_status === 'DELIVERED' ? 'Active' : 'Paused',
      product_revenue: o.order_status === 'DELIVERED' ? o.net_revenue : 0,
      revenue_share: 0,
      clicks: o.quantity * 25,
    }));
    productData = aggregateProductItems(rawProdList);

    // 3. Group by Platform for trafficData
    const rawTrafficList: InternalTrafficItem[] = orderData.filter(o => o.order_status === 'DELIVERED').map(o => ({
      traffic_source: o.platform || 'Shopee',
      source_revenue: o.net_revenue,
      source_cr: 0.048,
    }));
    trafficData = aggregateTrafficItems(rawTrafficList);
  } else {
    // Step 2: Parse 5 Aggregate Sheets if not Order-Level
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const { headers, rows: rawRows } = extractSheetDataAndHeaders(worksheet);
      rawWorkbookData[sheetName] = rawRows;

      if (!rawRows || rawRows.length === 0) continue;

      const normSheetName = normalizeHeaderName(sheetName);

      // 1. REVENUE SHEET
      if (
        revenueData.length === 0 &&
        (
          normSheetName.includes('doanhthu') ||
          normSheetName.includes('doanhso') ||
          normSheetName.includes('revenue') ||
          normSheetName.includes('tonghop') ||
          (findColumnKey(headers, 'gross_revenue') && findColumnKey(headers, 'order_date')) ||
          (findColumnKey(headers, 'total_orders') && (findColumnKey(headers, 'gross_revenue') || findColumnKey(headers, 'net_revenue')))
        )
      ) {
        const colDate = findColumnKey(headers, 'order_date');
        const colOrders = findColumnKey(headers, 'total_orders');
        const colGmvPlaced = findColumnKey(headers, 'gross_revenue');
        const colGmvPaid = findColumnKey(headers, 'net_revenue') || colGmvPlaced;
        const colBuyers = findColumnKey(headers, 'buyers_total');
        const colNewBuyers = findColumnKey(headers, 'buyers_new');
        const colViews = findColumnKey(headers, 'product_views');
        const colSessions = findColumnKey(headers, 'sessions');
        const colCR = findColumnKey(headers, 'conversion_rate');

        const rows: InternalRevenueItem[] = rawRows.map(r => {
          const total_orders = colOrders ? cleanInteger(r[colOrders]) : 0;
          let gmv_placed = colGmvPlaced ? cleanCurrency(r[colGmvPlaced]) : 0;
          let gmv_paid = colGmvPaid ? cleanCurrency(r[colGmvPaid]) : gmv_placed;
          
          if (gmv_placed === 0 && gmv_paid > 0) gmv_placed = gmv_paid;
          if (gmv_paid === 0 && gmv_placed > 0) gmv_paid = gmv_placed;

          const sessions = colSessions ? cleanInteger(r[colSessions]) : 0;
          let conversion_rate = colCR ? cleanPercent(r[colCR]) : 0;
          if (conversion_rate === 0 && sessions > 0 && total_orders > 0) {
            conversion_rate = total_orders / sessions;
          }

          return {
            date: colDate ? cleanDate(r[colDate]) : '01/01/2026',
            total_orders,
            gmv_placed,
            gmv_paid,
            buyers_total: colBuyers ? cleanInteger(r[colBuyers]) : (total_orders > 0 ? total_orders : 0),
            buyers_new: colNewBuyers ? cleanInteger(r[colNewBuyers]) : Math.round((colBuyers ? cleanInteger(r[colBuyers]) : total_orders) * 0.65),
            product_views: colViews ? cleanInteger(r[colViews]) : total_orders * 35,
            sessions: sessions > 0 ? sessions : total_orders * 18,
            conversion_rate: conversion_rate > 0 ? conversion_rate : 0.045,
            raw: r,
          };
        }).filter(r => r.gmv_placed > 0 || r.total_orders > 0 || r.sessions > 0);

        if (rows.length > 0) {
          revenueData = aggregateRevenueItems(rows);
          detectedSheets.push({
            sheetName,
            matchedStandardKey: 'revenue',
            rowCount: rows.length,
            recognizedColumns: [colDate, colOrders, colGmvPlaced, colGmvPaid, colBuyers, colNewBuyers, colViews, colSessions, colCR].filter(Boolean) as string[],
            missingOptionalColumns: [],
          });
          continue;
        }
      }

      // 2. PRODUCT SHEET
      if (
        productData.length === 0 &&
        (
          normSheetName.includes('sanpham') ||
          normSheetName.includes('product') ||
          normSheetName.includes('sku') ||
          normSheetName.includes('mathang') ||
          (findColumnKey(headers, 'product_name') && (findColumnKey(headers, 'sku') || findColumnKey(headers, 'product_revenue')))
        )
      ) {
        const colName = findColumnKey(headers, 'product_name') || headers[0];
        const colSku = findColumnKey(headers, 'sku');
        const colStatus = findColumnKey(headers, 'status');
        const colRev = findColumnKey(headers, 'product_revenue') || findColumnKey(headers, 'gross_revenue');
        const colShare = findColumnKey(headers, 'revenue_share');
        const colClicks = findColumnKey(headers, 'clicks');

        const totalProdRevenue = rawRows.reduce((sum, r) => sum + (colRev ? cleanCurrency(r[colRev]) : 0), 0);

        const rawProdRows: InternalProductItem[] = rawRows.map(r => {
          const product_name = colName ? String(r[colName]).trim() : '';
          const product_revenue = colRev ? cleanCurrency(r[colRev]) : 0;
          let revenue_share = colShare ? cleanPercent(r[colShare]) : 0;
          if (revenue_share === 0 && totalProdRevenue > 0 && product_revenue > 0) {
            revenue_share = product_revenue / totalProdRevenue;
          }

          let statusStr = colStatus ? String(r[colStatus]).trim() : 'Active';
          const statLower = statusStr.toLowerCase();
          if (statLower.includes('dang') || statLower.includes('active') || statLower.includes('bat') || statLower.includes('ban')) {
            statusStr = 'Active';
          } else if (statLower.includes('het')) {
            statusStr = 'Hết hàng';
          } else if (statLower.includes('pause') || statLower.includes('ngung') || statLower.includes('tam')) {
            statusStr = 'Paused';
          } else {
            statusStr = 'Inactive';
          }

          return {
            product_name,
            sku: colSku ? String(r[colSku]).trim() : 'SKU-001',
            status: statusStr,
            product_revenue,
            revenue_share,
            clicks: colClicks ? cleanInteger(r[colClicks]) : 0,
            raw: r,
          };
        }).filter(r => r.product_name && (r.product_revenue > 0 || r.clicks > 0 || r.sku));

        if (rawProdRows.length > 0) {
          // Intelligent aggregation by unique SKU & Product Name!
          productData = aggregateProductItems(rawProdRows);
          detectedSheets.push({
            sheetName,
            matchedStandardKey: 'products',
            rowCount: rawProdRows.length,
            recognizedColumns: [colName, colSku, colStatus, colRev, colShare, colClicks].filter(Boolean) as string[],
            missingOptionalColumns: [],
          });
          continue;
        }
      }

      // 3. TRAFFIC SOURCE SHEET
      if (
        trafficData.length === 0 &&
        (
          normSheetName.includes('traffic') ||
          normSheetName.includes('kenh') ||
          normSheetName.includes('nguon') ||
          (findColumnKey(headers, 'traffic_source') && (findColumnKey(headers, 'source_revenue') || findColumnKey(headers, 'gross_revenue')))
        )
      ) {
        const colSource = findColumnKey(headers, 'traffic_source') || headers[0];
        const colRev = findColumnKey(headers, 'source_revenue') || findColumnKey(headers, 'gross_revenue');
        const colCR = findColumnKey(headers, 'source_cr') || findColumnKey(headers, 'conversion_rate');

        const rawTrafficRows: InternalTrafficItem[] = rawRows.map(r => ({
          traffic_source: colSource ? String(r[colSource]).trim() : 'Direct Traffic',
          source_revenue: colRev ? cleanCurrency(r[colRev]) : 0,
          source_cr: colCR ? cleanPercent(r[colCR]) : 0,
          raw: r,
        })).filter(r => r.traffic_source && r.source_revenue > 0);

        if (rawTrafficRows.length > 0) {
          // Intelligent aggregation by clean channel name!
          trafficData = aggregateTrafficItems(rawTrafficRows);
          detectedSheets.push({
            sheetName,
            matchedStandardKey: 'traffic',
            rowCount: rawTrafficRows.length,
            recognizedColumns: [colSource, colRev, colCR].filter(Boolean) as string[],
            missingOptionalColumns: [],
          });
          continue;
        }
      }

      // 4. LIVESTREAM_VIDEO SHEET (OPTIONAL)
      if (
        liveData.length === 0 &&
        (
          normSheetName.includes('live') ||
          normSheetName.includes('video') ||
          (findColumnKey(headers, 'live_session_id') && (findColumnKey(headers, 'live_revenue') || findColumnKey(headers, 'gross_revenue')))
        )
      ) {
        const colId = findColumnKey(headers, 'live_session_id');
        const colTitle = findColumnKey(headers, 'live_session_title') || headers[0];
        const colRev = findColumnKey(headers, 'live_revenue') || findColumnKey(headers, 'gross_revenue');
        const colDuration = findColumnKey(headers, 'avg_watch_duration');

        const rawLiveRows: InternalLiveItem[] = rawRows.map(r => ({
          live_session_id: colId ? String(r[colId]).trim() : `LIVE-${Math.random().toString(36).substring(7)}`,
          live_session_title: colTitle ? String(r[colTitle]).trim() : 'Phiên Live',
          live_revenue: colRev ? cleanCurrency(r[colRev]) : 0,
          avg_watch_duration: colDuration ? String(r[colDuration]).trim() : '00:00:00',
          raw: r,
        })).filter(r => r.live_revenue > 0 || r.live_session_title);

        if (rawLiveRows.length > 0) {
          liveData = aggregateLiveItems(rawLiveRows);
          detectedSheets.push({
            sheetName,
            matchedStandardKey: 'livestream',
            rowCount: rawLiveRows.length,
            recognizedColumns: [colId, colTitle, colRev, colDuration].filter(Boolean) as string[],
            missingOptionalColumns: [],
          });
          continue;
        }
      }

      // 5. KOL_AFF SHEET (OPTIONAL)
      if (
        kocData.length === 0 &&
        (
          normSheetName.includes('kol') ||
          normSheetName.includes('aff') ||
          normSheetName.includes('koc') ||
          (findColumnKey(headers, 'affiliate_username') && (findColumnKey(headers, 'affiliate_revenue') || findColumnKey(headers, 'gross_revenue')))
        )
      ) {
        const colUser = findColumnKey(headers, 'affiliate_username') || headers[0];
        const colPlatform = findColumnKey(headers, 'platform');
        const colRev = findColumnKey(headers, 'affiliate_revenue') || findColumnKey(headers, 'gross_revenue');
        const colFee = findColumnKey(headers, 'commission_fee');

        const rawKocRows: InternalKocItem[] = rawRows.map(r => {
          const affiliate_revenue = colRev ? cleanCurrency(r[colRev]) : 0;
          const commission_fee = colFee ? cleanCurrency(r[colFee]) : 0;
          const commission_rate = affiliate_revenue > 0 ? commission_fee / affiliate_revenue : 0;

          return {
            affiliate_username: colUser ? String(r[colUser]).trim() : 'KOC Partner',
            platform: colPlatform ? String(r[colPlatform]).trim() : 'TikTok',
            affiliate_revenue,
            commission_fee,
            commission_rate,
            raw: r,
          };
        }).filter(r => r.affiliate_revenue > 0 || r.commission_fee > 0);

        if (rawKocRows.length > 0) {
          kocData = aggregateKocItems(rawKocRows);
          detectedSheets.push({
            sheetName,
            matchedStandardKey: 'koc_aff',
            rowCount: rawKocRows.length,
            recognizedColumns: [colUser, colPlatform, colRev, colFee].filter(Boolean) as string[],
            missingOptionalColumns: [],
          });
          continue;
        }
      }
    }
  }

  // ============================================================================
  // REVENUE CROSS-DOMAIN FALLBACK
  // ============================================================================
  let totalGmvPlaced = revenueData.reduce((acc, r) => acc + r.gmv_placed, 0);
  let totalGmvPaid = revenueData.reduce((acc, r) => acc + r.gmv_paid, 0);

  // If revenue sheet had 0 GMV but products sheet has revenue, populate from products!
  if (totalGmvPlaced === 0 && totalGmvPaid === 0 && productData.length > 0) {
    const totalProdRev = productData.reduce((acc, p) => acc + p.product_revenue, 0);
    if (totalProdRev > 0) {
      totalGmvPlaced = totalProdRev;
      totalGmvPaid = totalProdRev;

      if (revenueData.length > 0) {
        const totalOrdersCount = revenueData.reduce((acc, r) => acc + r.total_orders, 0) || revenueData.length;
        revenueData = revenueData.map(r => {
          const share = r.total_orders > 0 ? r.total_orders / totalOrdersCount : 1 / revenueData.length;
          return {
            ...r,
            gmv_placed: Math.round(totalProdRev * share),
            gmv_paid: Math.round(totalProdRev * share),
          };
        });
      }
    }
  }

  // If revenue sheet is missing but productData has revenue, synthesize a default daily row
  if (revenueData.length === 0 && productData.length > 0) {
    const totalProdRev = productData.reduce((acc, p) => acc + p.product_revenue, 0);
    totalGmvPlaced = totalProdRev;
    totalGmvPaid = totalProdRev;
    revenueData = [
      {
        date: 'Tháng này',
        total_orders: Math.max(1, Math.round(totalProdRev / 350000)),
        gmv_placed: totalProdRev,
        gmv_paid: totalProdRev,
        buyers_total: Math.max(1, Math.round(totalProdRev / 400000)),
        buyers_new: Math.max(1, Math.round((totalProdRev / 400000) * 0.7)),
        product_views: productData.reduce((acc, p) => acc + p.clicks, 0) * 5 || 2500,
        sessions: Math.max(1, Math.round((totalProdRev / 350000) * 15)),
        conversion_rate: 0.048,
      },
    ];
  }

  const cancelledOrPendingRevenue = Math.max(0, totalGmvPlaced - totalGmvPaid);
  const cancellationRate = totalGmvPlaced > 0 ? cancelledOrPendingRevenue / totalGmvPlaced : 0;
  const totalOrders = revenueData.reduce((acc, r) => acc + r.total_orders, 0) || (orderData.length > 0 ? orderData.length : 1);
  const aov = calculateAOV(totalGmvPaid, totalOrders);
  const totalSessions = revenueData.reduce((acc, r) => acc + r.sessions, 0);
  const totalProductViews = revenueData.reduce((acc, r) => acc + r.product_views, 0);
  const avgConversionRate = totalSessions > 0 ? totalOrders / totalSessions : 0.045;
  const totalBuyers = revenueData.reduce((acc, r) => acc + r.buyers_total, 0);
  const newBuyers = revenueData.reduce((acc, r) => acc + r.buyers_new, 0);
  const newBuyerRatio = totalBuyers > 0 ? newBuyers / totalBuyers : 0.65;

  // Product KPIs
  const totalProductsCount = productData.length;
  const activeProductsCount = productData.filter(p => p.status === 'Active' || p.status === 'Đang bán').length;
  const inactiveProductsCount = totalProductsCount - activeProductsCount;
  const totalProductRevenue = productData.reduce((acc, p) => acc + p.product_revenue, 0);
  const topProduct = productData.slice().sort((a, b) => b.product_revenue - a.product_revenue)[0];

  // Traffic KPIs
  const totalTrafficRevenue = trafficData.reduce((acc, t) => acc + t.source_revenue, 0);
  const topTrafficSource = trafficData.slice().sort((a, b) => b.source_revenue - a.source_revenue)[0];

  // Live KPIs
  const totalLiveRevenue = liveData.reduce((acc, l) => acc + l.live_revenue, 0);
  const liveRevenueShare = totalGmvPaid > 0 ? totalLiveRevenue / totalGmvPaid : 0;

  // KOC KPIs
  const totalKocRevenue = kocData.reduce((acc, k) => acc + k.affiliate_revenue, 0);
  const totalCommissionFee = kocData.reduce((acc, k) => acc + k.commission_fee, 0);
  const avgCommissionRate = totalKocRevenue > 0 ? totalCommissionFee / totalKocRevenue : 0;

  // ============================================================================
  // ORDER STATUS INTEGRITY BREAKDOWN
  // ============================================================================
  let deliveredOrdersCount = 0;
  let deliveredRevenue = totalGmvPaid;
  let cancelledOrdersCount = 0;
  let cancelledRevenue = cancelledOrPendingRevenue;
  let refundedOrdersCount = 0;
  let refundedRevenue = 0;
  let processingOrdersCount = 0;
  let processingRevenue = 0;
  let totalAdSpend = 0;
  let totalCogs = 0;

  if (isOrderLevelFile && orderData.length > 0) {
    deliveredOrdersCount = orderData.filter(o => o.order_status === 'DELIVERED').length;
    deliveredRevenue = orderData.filter(o => o.order_status === 'DELIVERED').reduce((sum, o) => sum + o.net_revenue, 0);
    
    cancelledOrdersCount = orderData.filter(o => o.order_status === 'CANCELLED').length;
    cancelledRevenue = orderData.filter(o => o.order_status === 'CANCELLED').reduce((sum, o) => sum + o.gross_revenue, 0);

    refundedOrdersCount = orderData.filter(o => o.order_status === 'REFUNDED').length;
    refundedRevenue = orderData.filter(o => o.order_status === 'REFUNDED').reduce((sum, o) => sum + o.net_revenue, 0);

    processingOrdersCount = orderData.filter(o => o.order_status === 'PROCESSING').length;
    processingRevenue = orderData.filter(o => o.order_status === 'PROCESSING').reduce((sum, o) => sum + o.net_revenue, 0);

    totalAdSpend = orderData.reduce((sum, o) => sum + (o.ad_cost || 0), 0);
    totalCogs = orderData.filter(o => o.order_status === 'DELIVERED').reduce((sum, o) => sum + ((o.cogs || 0) * o.quantity), 0);
  } else {
    // If aggregate sheets: estimate delivered vs cancelled based on GMV Placed vs Paid
    const deliveredRatio = totalGmvPlaced > 0 ? Math.min(1, totalGmvPaid / totalGmvPlaced) : 1;
    deliveredOrdersCount = Math.round(totalOrders * deliveredRatio);
    deliveredRevenue = totalGmvPaid;
    cancelledOrdersCount = Math.max(0, totalOrders - deliveredOrdersCount);
    cancelledRevenue = Math.max(0, totalGmvPlaced - totalGmvPaid);
    totalCogs = totalGmvPaid * 0.42; // Estimate standard 42% COGS
    totalAdSpend = trafficData.filter(t => t.traffic_source.toLowerCase().includes('ad')).reduce((acc, t) => acc + t.source_revenue * 0.2, 0);
  }

  const totalGrossProfit = calculateGrossProfit(deliveredRevenue, totalCogs);
  const grossProfitMargin = deliveredRevenue > 0 ? totalGrossProfit / deliveredRevenue : 0.58;
  const overallROAS = totalAdSpend > 0 ? calculateROAS(deliveredRevenue, totalAdSpend) : 0;

  const statusIntegrity: OrderStatusIntegritySummary = {
    hasOrderLevelData: isOrderLevelFile,
    totalOrderRows: orderData.length > 0 ? orderData.length : totalOrders,
    deliveredOrdersCount,
    deliveredRevenue,
    deliveredNetRevenue: deliveredRevenue,
    cancelledOrdersCount,
    cancelledRevenue,
    cancelledRate: totalOrders > 0 ? cancelledOrdersCount / totalOrders : 0,
    refundedOrdersCount,
    refundedRevenue,
    refundedRate: totalOrders > 0 ? refundedOrdersCount / totalOrders : 0,
    processingOrdersCount,
    processingRevenue,
    totalAdSpend,
    overallROAS,
    totalCogs,
    totalGrossProfit,
    grossProfitMargin,
  };

  const summaryKPIs: InternalFinanceSummaryKPIs = {
    totalGmvPlaced,
    totalGmvPaid,
    cancelledOrPendingRevenue,
    cancellationRate,
    totalOrders,
    aov,
    totalSessions,
    totalProductViews,
    avgConversionRate,
    totalBuyers,
    newBuyers,
    newBuyerRatio,
    totalProductsCount,
    activeProductsCount,
    inactiveProductsCount,
    totalProductRevenue,
    topProduct,
    hasTrafficData: trafficData.length > 0,
    totalTrafficRevenue,
    topTrafficSource,
    hasLiveVideoData: liveData.length > 0,
    totalLiveSessions: liveData.length,
    totalLiveRevenue,
    liveRevenueShare,
    hasKocAffData: kocData.length > 0,
    totalKocCount: kocData.length,
    totalKocRevenue,
    totalCommissionFee,
    avgCommissionRate,
    statusIntegrity,
  };

  return {
    fileName: file.name,
    fileSize: file.size,
    parsedAt: new Date().toISOString(),
    isOrderLevelFile,
    detectedSheets,
    orderData: orderData.length > 0 ? orderData : undefined,
    revenueData,
    productData,
    trafficData,
    liveData,
    kocData,
    summaryKPIs,
    rawWorkbookData,
  };
}

// ============================================================================
// SAMPLE EXCEL DOWNLOAD GENERATOR
// ============================================================================
export function downloadSampleInternalFinanceExcel(): void {
  const wb = XLSX.utils.book_new();

  // 1. Sheet "DonHangChiTiet" (Order-level transactions)
  const orderRows = [
    {
      'Mã đơn hàng': 'ORD-20260901-001',
      'Ngày đặt hàng': '01/09/2026',
      'Sàn TMĐT': 'Shopee',
      'Mã sản phẩm': 'SF-2S-001',
      'Tên sản phẩm': 'Ghế sofa vải bố 2 chỗ ngồi khung gỗ',
      'Ngành hàng': 'Nội Thất Phòng Khách',
      'Số lượng': 1,
      'Đơn giá': 4589000,
      'Giảm giá': 200000,
      'Doanh thu trước giảm': 4589000,
      'Doanh thu sau giảm': 4389000,
      'Phí vận chuyển': 150000,
      'Chi phí quảng cáo': 350000,
      'Trạng thái đơn hàng': 'Đã giao',
      'Giá vốn': 2200000,
      'Tồn kho': 45,
    },
    {
      'Mã đơn hàng': 'ORD-20260901-002',
      'Ngày đặt hàng': '01/09/2026',
      'Sàn TMĐT': 'TikTok Shop',
      'Mã sản phẩm': 'BT-OAK-014',
      'Tên sản phẩm': 'Bàn trà gỗ sồi chân sắt',
      'Ngành hàng': 'Nội Thất Phòng Khách',
      'Số lượng': 2,
      'Đơn giá': 1432500,
      'Giảm giá': 100000,
      'Doanh thu trước giảm': 2865000,
      'Doanh thu sau giảm': 2765000,
      'Phí vận chuyển': 80000,
      'Chi phí quảng cáo': 180000,
      'Trạng thái đơn hàng': 'Đã giao',
      'Giá vốn': 750000,
      'Tồn kho': 28,
    },
    {
      'Mã đơn hàng': 'ORD-20260902-003',
      'Ngày đặt hàng': '02/09/2026',
      'Sàn TMĐT': 'Shopee',
      'Mã sản phẩm': 'DEN-CY-009',
      'Tên sản phẩm': 'Đèn cây trang trí phòng khách',
      'Ngành hàng': 'Đèn & Trang Trí',
      'Số lượng': 1,
      'Đơn giá': 1520000,
      'Giảm giá': 0,
      'Doanh thu trước giảm': 1520000,
      'Doanh thu sau giảm': 1520000,
      'Phí vận chuyển': 45000,
      'Chi phí quảng cáo': 120000,
      'Trạng thái đơn hàng': 'Đã hủy',
      'Giá vốn': 620000,
      'Tồn kho': 60,
    },
    {
      'Mã đơn hàng': 'ORD-20260903-004',
      'Ngày đặt hàng': '03/09/2026',
      'Sàn TMĐT': 'Lazada',
      'Mã sản phẩm': 'KTV-18-022',
      'Tên sản phẩm': 'Kệ tivi gỗ công nghiệp 1m8',
      'Ngành hàng': 'Nội Thất Phòng Khách',
      'Số lượng': 1,
      'Đơn giá': 1622500,
      'Giảm giá': 50000,
      'Doanh thu trước giảm': 1622500,
      'Doanh thu sau giảm': 1572500,
      'Phí vận chuyển': 120000,
      'Chi phí quảng cáo': 200000,
      'Trạng thái đơn hàng': 'Đã hoàn tiền',
      'Giá vốn': 850000,
      'Tồn kho': 15,
    },
    {
      'Mã đơn hàng': 'ORD-20260904-005',
      'Ngày đặt hàng': '04/09/2026',
      'Sàn TMĐT': 'TikTok Shop',
      'Mã sản phẩm': 'REM-LN-005',
      'Tên sản phẩm': 'Rèm cửa sổ vải lanh cao cấp (bộ 2 tấm)',
      'Ngành hàng': 'Vải & Rèm',
      'Số lượng': 3,
      'Đơn giá': 329000,
      'Giảm giá': 30000,
      'Doanh thu trước giảm': 987000,
      'Doanh thu sau giảm': 957000,
      'Phí vận chuyển': 35000,
      'Chi phí quảng cáo': 80000,
      'Trạng thái đơn hàng': 'Đang xử lý',
      'Giá vốn': 140000,
      'Tồn kho': 120,
    },
  ];
  const wsOrders = XLSX.utils.json_to_sheet(orderRows);
  XLSX.utils.book_append_sheet(wb, wsOrders, 'DonHangChiTiet');

  // 2. Sheet "Doanh thu"
  const revenueRows = [
    {
      'Ngày phát sinh': '01/09/2026',
      'Số đơn': 142,
      'Doanh thu gộp': '42.600.000 đ',
      'Doanh thu thuần': '38.340.000 đ',
      'Khách mua': 135,
      'Khách mua mới': 98,
      'Lượt view sản phẩm': 4850,
      'Lượt truy cập': 3120,
      'CR (%)': '4,55%',
    },
    {
      'Ngày phát sinh': '02/09/2026',
      'Số đơn': 210,
      'Doanh thu gộp': '68.200.000 đ',
      'Doanh thu thuần': '62.744.000 đ',
      'Khách mua': 198,
      'Khách mua mới': 145,
      'Lượt view sản phẩm': 6940,
      'Lượt truy cập': 4380,
      'CR (%)': '4,79%',
    },
    {
      'Ngày phát sinh': '03/09/2026',
      'Số đơn': 175,
      'Doanh thu gộp': '54.250.000 đ',
      'Doanh thu thuần': '49.910.000 đ',
      'Khách mua': 168,
      'Khách mua mới': 112,
      'Lượt view sản phẩm': 5420,
      'Lượt truy cập': 3650,
      'CR (%)': '4,79%',
    },
    {
      'Ngày phát sinh': '04/09/2026',
      'Số đơn': 188,
      'Doanh thu gộp': '59.800.000 đ',
      'Doanh thu thuần': '55.016.000 đ',
      'Khách mua': 180,
      'Khách mua mới': 120,
      'Lượt view sản phẩm': 5890,
      'Lượt truy cập': 3910,
      'CR (%)': '4,81%',
    },
    {
      'Ngày phát sinh': '05/09/2026',
      'Số đơn': 165,
      'Doanh thu gộp': '51.150.000 đ',
      'Doanh thu thuần': '47.058.000 đ',
      'Khách mua': 158,
      'Khách mua mới': 105,
      'Lượt view sản phẩm': 5120,
      'Lượt truy cập': 3450,
      'CR (%)': '4,78%',
    },
    {
      'Ngày phát sinh': '06/09/2026',
      'Số đơn': 230,
      'Doanh thu gộp': '75.900.000 đ',
      'Doanh thu thuần': '69.828.000 đ',
      'Khách mua': 218,
      'Khách mua mới': 160,
      'Lượt view sản phẩm': 7890,
      'Lượt truy cập': 4950,
      'CR (%)': '4,65%',
    },
    {
      'Ngày phát sinh': '07/09/2026',
      'Số đơn': 195,
      'Doanh thu gộp': '62.400.000 đ',
      'Doanh thu thuần': '57.408.000 đ',
      'Khách mua': 186,
      'Khách mua mới': 125,
      'Lượt view sản phẩm': 6350,
      'Lượt truy cập': 4120,
      'CR (%)': '4,73%',
    },
  ];
  const wsRevenue = XLSX.utils.json_to_sheet(revenueRows);
  XLSX.utils.book_append_sheet(wb, wsRevenue, 'Doanh thu');

  // 3. Sheet "Sản Phẩm"
  const productRows = [
    {
      'Tên sản phẩm': 'Ghế sofa vải bố 2 chỗ ngồi khung gỗ',
      'SKU / Mã SP': 'SF-2S-001',
      'Trạng thái': 'Đang bán',
      'Doanh thu (VNĐ)': 45890000,
      '% DT': '18,20%',
      'Số đơn': 12,
      'Lượt xem': 5210,
      'Lượt click': 812,
      'Người mua': 12,
      'CTR (%)': '15,58%',
    },
    {
      'Tên sản phẩm': 'Bàn trà gỗ sồi chân sắt',
      'SKU / Mã SP': 'BT-OAK-014',
      'Trạng thái': 'Đang bán',
      'Doanh thu (VNĐ)': 28650000,
      '% DT': '11,36%',
      'Số đơn': 22,
      'Lượt xem': 3990,
      'Lượt click': 540,
      'Người mua': 20,
      'CTR (%)': '13,53%',
    },
    {
      'Tên sản phẩm': 'Đèn cây trang trí phòng khách',
      'SKU / Mã SP': 'DEN-CY-009',
      'Trạng thái': 'Đang bán',
      'Doanh thu (VNĐ)': 15200000,
      '% DT': '6,03%',
      'Số đơn': 30,
      'Lượt xem': 2200,
      'Lượt click': 305,
      'Người mua': 28,
      'CTR (%)': '13,86%',
    },
    {
      'Tên sản phẩm': 'Kệ tivi gỗ công nghiệp 1m8',
      'SKU / Mã SP': 'KTV-18-022',
      'Trạng thái': 'Ngừng bán',
      'Doanh thu (VNĐ)': 12980000,
      '% DT': '5,15%',
      'Số đơn': 8,
      'Lượt xem': 1450,
      'Lượt click': 190,
      'Người mua': 8,
      'CTR (%)': '13,10%',
    },
    {
      'Tên sản phẩm': 'Rèm cửa sổ vải lanh cao cấp (bộ 2 tấm)',
      'SKU / Mã SP': 'REM-LN-005',
      'Trạng thái': 'Đang bán',
      'Doanh thu (VNĐ)': 9870000,
      '% DT': '3,92%',
      'Số đơn': 45,
      'Lượt xem': 6100,
      'Lượt click': 720,
      'Người mua': 41,
      'CTR (%)': '11,80%',
    },
  ];
  const wsProduct = XLSX.utils.json_to_sheet(productRows);
  XLSX.utils.book_append_sheet(wb, wsProduct, 'Sản Phẩm');

  // 4. Sheet "TrafficSource"
  const trafficRows = [
    {
      'Kênh': 'Shopee / TikTok Search (Tìm kiếm tự nhiên)',
      'Doanh số': '158.400.000 đ',
      'Tỷ lệ chuyển đổi': '5,2%',
    },
    {
      'Kênh': 'Paid Ads (Quảng cáo nội sàn & Facebook/TikTok Ads)',
      'Doanh số': '112.500.000 đ',
      'Tỷ lệ chuyển đổi': '4,1%',
    },
    {
      'Kênh': 'Trang chủ & Gợi ý (Recommendation Feed)',
      'Doanh số': '64.800.000 đ',
      'Tỷ lệ chuyển đổi': '3,8%',
    },
    {
      'Kênh': 'Direct & Chat CSKH (Khách quen mua lại)',
      'Doanh số': '44.600.000 đ',
      'Tỷ lệ chuyển đổi': '8,4%',
    },
  ];
  const wsTraffic = XLSX.utils.json_to_sheet(trafficRows);
  XLSX.utils.book_append_sheet(wb, wsTraffic, 'TrafficSource');

  // 5. Sheet "Livestream_Video"
  const liveRows = [
    {
      'ID Live': 'LIVE-20260902-MEGA',
      'Tiêu đề Live': 'Mega Live 02.09 - Tung Deal Áo Polo & Short Kaki Siêu Rẻ',
      'DT (VND)': '36.500.000 đ',
      'Thời lượng xem TB': '00:04:45',
    },
    {
      'ID Live': 'LIVE-20260906-WEEKEND',
      'Tiêu đề Live': 'Weekend Flash Sale - Giảm 50% Combo Thể Thao',
      'DT (VND)': '28.200.000 đ',
      'Thời lượng xem TB': '00:03:52',
    },
    {
      'ID Live': 'VID-20260904-OOTD',
      'Tiêu đề Live': 'Video OOTD Phối Đồ Thu Đông Nam Trẻ Trung',
      'DT (VND)': '14.800.000 đ',
      'Thời lượng xem TB': '00:00:48',
    },
  ];
  const wsLive = XLSX.utils.json_to_sheet(liveRows);
  XLSX.utils.book_append_sheet(wb, wsLive, 'Livestream_Video');

  // 6. Sheet "KOL_Aff"
  const kolRows = [
    {
      'Người tiếp thị': '@hoangnam.style (KOC Thời Trang)',
      'Nền tảng KOL': 'TikTok',
      'Doanh số mang về': '42.800.000 đ',
      'Hoa hồng dự kiến': '4.280.000 đ',
    },
    {
      'Người tiếp thị': '@review_men_style',
      'Nền tảng KOL': 'Shopee Video',
      'Doanh số mang về': '26.400.000 đ',
      'Hoa hồng dự kiến': '2.640.000 đ',
    },
    {
      'Người tiếp thị': '@tuananh.fit (KOL Gym/Lifestyle)',
      'Nền tảng KOL': 'Facebook Reels',
      'Doanh số mang về': '18.900.000 đ',
      'Hoa hồng dự kiến': '1.890.000 đ',
    },
  ];
  const wsKol = XLSX.utils.json_to_sheet(kolRows);
  XLSX.utils.book_append_sheet(wb, wsKol, 'KOL_Aff');

  XLSX.writeFile(wb, 'EcomPulse_Mau_Bao_Cao_Noi_Bo_Full.xlsx');
}

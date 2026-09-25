import React, { useState } from 'react';
import {
  Building2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  PieChart as PieIcon,
  Layers,
  FileSpreadsheet,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Download,
  Info,
  Calendar,
  Wallet,
  Scale,
  Percent,
  Receipt,
  ShieldCheck,
  Send,
  Sliders,
  HelpCircle,
  Video,
  Users,
  Search,
  Check,
  X,
  RefreshCw,
  Trash2,
  ChevronRight,
  Target,
  ArrowUpRight,
  Eye,
  MousePointer,
  ShoppingBag,
  BookOpen,
  Boxes,
  CheckCheck,
  ShieldAlert,
  ListOrdered,
  FileCode,
  Tag,
  AlertOctagon,
  KeyRound,
  Filter,
  MessageSquare,
  Bot,
  Zap,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';
import { formatVND, formatCompactVND, formatNumber, formatPercent } from '../../utils/formatters';
import {
  ParsedInternalFinanceData,
  InternalRevenueItem,
  InternalProductItem,
  InternalTrafficItem,
  InternalLiveItem,
  InternalKocItem,
} from '../../types/internalFinance';
import {
  parseInternalFinanceExcel,
  downloadSampleInternalFinanceExcel,
} from '../../utils/internalFinanceParser';
import { convertInternalFinanceToStoreData } from '../../utils/internalFinanceConverter';
import { StoreOperationsMetricStrip } from '../dashboard/StoreOperationsMetricStrip';
import { P0AnalyticsDashboard } from '../dashboard/P0AnalyticsDashboard';
import { ShopeeGrowthAndContentHub } from '../dashboard/ShopeeGrowthAndContentHub';
import { DolphinChatModal } from '../chat/DolphinChatModal';
import dolphinAvatar from '../../assets/images/dolphin_ai_avatar_1787721342181.jpg';
import {
  VIETNAMESE_DATA_DICTIONARY,
  VIETNAMESE_ABBREVIATIONS,
  CRITICAL_COLLISION_RULES,
  AI_EXCEL_INGESTION_PIPELINE_STEPS,
  MAPPING_PRIORITY_LEVELS,
  SAFE_ANALYSIS_PRINCIPLES,
  DATA_TYPE_SPECIFICATION_LIST,
  AI_ETL_RULES,
  DataDictionaryDefinition,
  DataTypeSpecItem,
  AiEtlRule,
} from '../../utils/vietnameseDataDictionary';

interface InternalFinanceModuleProps {
  onBackToPortal: () => void;
  language?: 'vi' | 'en';
}

const COLORS = ['#38bdf8', '#34d399', '#a78bfa', '#f472b6', '#fbbf24', '#f87171', '#60a5fa'];

export const InternalFinanceModule: React.FC<InternalFinanceModuleProps> = ({
  onBackToPortal,
  language = 'vi',
}) => {
  const [data, setData] = useState<ParsedInternalFinanceData | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'revenue_orders' | 'products' | 'traffic' | 'livestream' | 'koc_aff' | 'dictionary' | 'ai_action'>('overview');
  const [showHealthModal, setShowHealthModal] = useState<boolean>(false);
  const [showStandaloneDictModal, setShowStandaloneDictModal] = useState<boolean>(false);
  const [showDolphinChat, setShowDolphinChat] = useState<boolean>(false);
  const [initialChatPrompt, setInitialChatPrompt] = useState<string | undefined>(undefined);

  const handleOpenDolphin = (prompt?: string) => {
    setInitialChatPrompt(prompt);
    setShowDolphinChat(true);
  };

  // Data Dictionary State
  const [dictSearch, setDictSearch] = useState<string>('');
  const [dictSubTab, setDictSubTab] = useState<'data_types' | 'columns' | 'collisions' | 'abbreviations' | 'ai_pipeline'>('data_types');
  const [dictSectionFilter, setDictSectionFilter] = useState<'ALL' | number>('ALL');
  const [dictDataTypeCategoryFilter, setDictDataTypeCategoryFilter] = useState<'ALL' | 1 | 2 | 3 | 4 | 5>('ALL');

  // Product Filter State
  const [productSearch, setProductSearch] = useState<string>('');
  const [productStatusFilter, setProductStatusFilter] = useState<'ALL' | 'Active' | 'Hết hàng' | 'Paused' | 'Inactive'>('ALL');

  // File Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setErrorMessage(null);

    try {
      const parsed = await parseInternalFinanceExcel(file);
      if (parsed.revenueData.length === 0 && parsed.productData.length === 0 && (!parsed.orderData || parsed.orderData.length === 0)) {
        setErrorMessage(
          'Không tìm thấy dữ liệu chuẩn phù hợp (Báo cáo đơn hàng hoặc các sheet Doanh thu, Sản Phẩm, TrafficSource, Livestream_Video, KOL_Aff). Vui lòng kiểm tra lại tên cột hoặc tải file mẫu chuẩn.'
        );
        setIsParsing(false);
        return;
      }
      setData(parsed);
      setActiveTab('overview');
    } catch (err: any) {
      console.error('Lỗi khi đọc file nội bộ:', err);
      setErrorMessage(err?.message || 'Có lỗi xảy ra khi đọc file Excel. Vui lòng thử lại.');
    } finally {
      setIsParsing(false);
      e.target.value = '';
    }
  };

  // Load In-Memory Sample Data
  const handleLoadSampleDemo = () => {
    const sampleRevenue: InternalRevenueItem[] = [
      { date: '01/09/2026', total_orders: 142, gmv_placed: 42600000, gmv_paid: 38340000, buyers_total: 135, buyers_new: 98, product_views: 4850, sessions: 3120, conversion_rate: 0.0455 },
      { date: '02/09/2026', total_orders: 210, gmv_placed: 68200000, gmv_paid: 62744000, buyers_total: 198, buyers_new: 145, product_views: 6940, sessions: 4380, conversion_rate: 0.0479 },
      { date: '03/09/2026', total_orders: 175, gmv_placed: 54250000, gmv_paid: 49910000, buyers_total: 168, buyers_new: 112, product_views: 5420, sessions: 3650, conversion_rate: 0.0479 },
      { date: '04/09/2026', total_orders: 188, gmv_placed: 59800000, gmv_paid: 55016000, buyers_total: 180, buyers_new: 120, product_views: 5890, sessions: 3910, conversion_rate: 0.0481 },
      { date: '05/09/2026', total_orders: 165, gmv_placed: 51150000, gmv_paid: 47058000, buyers_total: 158, buyers_new: 105, product_views: 5120, sessions: 3450, conversion_rate: 0.0478 },
      { date: '06/09/2026', total_orders: 230, gmv_placed: 75900000, gmv_paid: 69828000, buyers_total: 218, buyers_new: 160, product_views: 7890, sessions: 4950, conversion_rate: 0.0465 },
      { date: '07/09/2026', total_orders: 195, gmv_placed: 62400000, gmv_paid: 57408000, buyers_total: 186, buyers_new: 125, product_views: 6350, sessions: 4120, conversion_rate: 0.0473 },
    ];

    const sampleProducts: InternalProductItem[] = [
      { product_name: 'Ghế sofa vải bố 2 chỗ ngồi khung gỗ', sku: 'SF-2S-001', status: 'Active', product_revenue: 148500000, revenue_share: 0.391, clicks: 14250 },
      { product_name: 'Bàn trà gỗ sồi chân sắt', sku: 'BT-OAK-014', status: 'Active', product_revenue: 98600000, revenue_share: 0.259, clicks: 9820 },
      { product_name: 'Áo Polo Thể Thao Quick-Dry Co Giãn', sku: 'POLO-QD-03', status: 'Active', product_revenue: 72400000, revenue_share: 0.190, clicks: 7450 },
      { product_name: 'Kệ tivi gỗ công nghiệp 1m8', sku: 'KTV-18-022', status: 'Inactive', product_revenue: 41200000, revenue_share: 0.108, clicks: 4120 },
      { product_name: 'Rèm cửa sổ vải lanh cao cấp (bộ 2 tấm)', sku: 'REM-LN-005', status: 'Active', product_revenue: 19600000, revenue_share: 0.052, clicks: 2180 },
    ];

    const sampleTraffic: InternalTrafficItem[] = [
      { traffic_source: 'Shopee / TikTok Search (Tìm kiếm tự nhiên)', source_revenue: 158400000, source_cr: 0.052 },
      { traffic_source: 'Paid Ads (Quảng cáo nội sàn & Facebook/TikTok Ads)', source_revenue: 112500000, source_cr: 0.041 },
      { traffic_source: 'Trang chủ & Gợi ý (Recommendation Feed)', source_revenue: 64800000, source_cr: 0.038 },
      { traffic_source: 'Direct & Chat CSKH (Khách quen mua lại)', source_revenue: 44600000, source_cr: 0.084 },
    ];

    const sampleLive: InternalLiveItem[] = [
      { live_session_id: 'LIVE-20260902-MEGA', live_session_title: 'Mega Live 02.09 - Tung Deal Áo Polo & Short Kaki Siêu Rẻ', live_revenue: 36500000, avg_watch_duration: '00:04:45' },
      { live_session_id: 'LIVE-20260906-WEEKEND', live_session_title: 'Weekend Flash Sale - Giảm 50% Combo Thể Thao', live_revenue: 28200000, avg_watch_duration: '00:03:52' },
      { live_session_id: 'VID-20260904-OOTD', live_session_title: 'Video OOTD Phối Đồ Thu Đông Nam Trẻ Trung', live_revenue: 14800000, avg_watch_duration: '00:00:48' },
    ];

    const sampleKoc: InternalKocItem[] = [
      { affiliate_username: '@hoangnam.style (KOC Thời Trang)', platform: 'TikTok', affiliate_revenue: 42800000, commission_fee: 4280000, commission_rate: 0.1 },
      { affiliate_username: '@review_men_style', platform: 'Shopee Video', affiliate_revenue: 26400000, commission_fee: 2640000, commission_rate: 0.1 },
      { affiliate_username: '@tuananh.fit (KOL Gym/Lifestyle)', platform: 'Facebook Reels', affiliate_revenue: 18900000, commission_fee: 1890000, commission_rate: 0.1 },
    ];

    const totalGmvPlaced = sampleRevenue.reduce((a, b) => a + b.gmv_placed, 0);
    const totalGmvPaid = sampleRevenue.reduce((a, b) => a + b.gmv_paid, 0);
    const totalOrders = sampleRevenue.reduce((a, b) => a + b.total_orders, 0);
    const totalSessions = sampleRevenue.reduce((a, b) => a + b.sessions, 0);
    const totalBuyers = sampleRevenue.reduce((a, b) => a + b.buyers_total, 0);
    const newBuyers = sampleRevenue.reduce((a, b) => a + b.buyers_new, 0);

    const demoData: ParsedInternalFinanceData = {
      fileName: 'Bao_Cao_Noi_Bo_Doanh_Nghiep_Mau.xlsx',
      fileSize: 48500,
      parsedAt: new Date().toISOString(),
      isOrderLevelFile: false,
      detectedSheets: [
        { sheetName: 'Doanh thu', matchedStandardKey: 'revenue', rowCount: 7, recognizedColumns: ['Ngày phát sinh', 'Số đơn', 'Doanh thu gộp', 'Doanh thu thuần', 'Khách mua', 'Khách mua mới', 'Lượt view sản phẩm', 'Lượt truy cập', 'CR (%)'], missingOptionalColumns: [] },
        { sheetName: 'Sản Phẩm', matchedStandardKey: 'products', rowCount: 5, recognizedColumns: ['Tên sản phẩm', 'SKU / Mã SP', 'Trạng thái', 'Doanh thu (VNĐ)', '% DT', 'Lượt click'], missingOptionalColumns: [] },
        { sheetName: 'TrafficSource', matchedStandardKey: 'traffic', rowCount: 4, recognizedColumns: ['Kênh', 'Doanh số', 'Tỷ lệ chuyển đổi'], missingOptionalColumns: [] },
        { sheetName: 'Livestream_Video', matchedStandardKey: 'livestream', rowCount: 3, recognizedColumns: ['ID Live', 'Tiêu đề Live', 'DT (VND)', 'Thời lượng xem TB'], missingOptionalColumns: [] },
        { sheetName: 'KOL_Aff', matchedStandardKey: 'koc_aff', rowCount: 3, recognizedColumns: ['Người tiếp thị', 'Nền tảng KOL', 'Doanh số mang về', 'Hoa hồng dự kiến'], missingOptionalColumns: [] },
      ],
      revenueData: sampleRevenue,
      productData: sampleProducts,
      trafficData: sampleTraffic,
      liveData: sampleLive,
      kocData: sampleKoc,
      summaryKPIs: {
        totalGmvPlaced,
        totalGmvPaid,
        cancelledOrPendingRevenue: totalGmvPlaced - totalGmvPaid,
        cancellationRate: (totalGmvPlaced - totalGmvPaid) / totalGmvPlaced,
        totalOrders,
        aov: totalGmvPaid / totalOrders,
        totalSessions,
        totalProductViews: sampleRevenue.reduce((a, b) => a + b.product_views, 0),
        avgConversionRate: totalOrders / totalSessions,
        totalBuyers,
        newBuyers,
        newBuyerRatio: newBuyers / totalBuyers,
        totalProductsCount: sampleProducts.length,
        activeProductsCount: sampleProducts.filter(p => p.status === 'Active').length,
        inactiveProductsCount: 1,
        totalProductRevenue: sampleProducts.reduce((a, b) => a + b.product_revenue, 0),
        topProduct: sampleProducts[0],
        hasTrafficData: true,
        totalTrafficRevenue: sampleTraffic.reduce((a, b) => a + b.source_revenue, 0),
        topTrafficSource: sampleTraffic[0],
        hasLiveVideoData: true,
        totalLiveSessions: sampleLive.length,
        totalLiveRevenue: sampleLive.reduce((a, b) => a + b.live_revenue, 0),
        liveRevenueShare: sampleLive.reduce((a, b) => a + b.live_revenue, 0) / totalGmvPaid,
        hasKocAffData: true,
        totalKocCount: sampleKoc.length,
        totalKocRevenue: sampleKoc.reduce((a, b) => a + b.affiliate_revenue, 0),
        totalCommissionFee: sampleKoc.reduce((a, b) => a + b.commission_fee, 0),
        avgCommissionRate: 0.1,
        statusIntegrity: {
          hasOrderLevelData: false,
          totalOrderRows: totalOrders,
          deliveredOrdersCount: Math.round(totalOrders * 0.91),
          deliveredRevenue: totalGmvPaid,
          deliveredNetRevenue: totalGmvPaid,
          cancelledOrdersCount: Math.round(totalOrders * 0.06),
          cancelledRevenue: totalGmvPlaced - totalGmvPaid,
          cancelledRate: 0.06,
          refundedOrdersCount: Math.round(totalOrders * 0.03),
          refundedRevenue: 8500000,
          refundedRate: 0.03,
          processingOrdersCount: 0,
          processingRevenue: 0,
          totalAdSpend: 42500000,
          overallROAS: totalGmvPaid / 42500000,
          totalCogs: totalGmvPaid * 0.42,
          totalGrossProfit: totalGmvPaid * 0.58,
          grossProfitMargin: 0.58,
        },
      },
    };

    setData(demoData);
    setActiveTab('overview');
  };

  const kpis = data?.summaryKPIs;
  const integrity = kpis?.statusIntegrity;

  // Filtered dictionary items
  const filteredDict = VIETNAMESE_DATA_DICTIONARY.filter(item => {
    // Section filter
    if (dictSectionFilter !== 'ALL' && item.sectionId !== dictSectionFilter) {
      return false;
    }
    // Search query filter
    if (!dictSearch) return true;
    const query = dictSearch.toLowerCase().trim();
    return (
      item.vietnameseName.toLowerCase().includes(query) ||
      (item.englishName && item.englishName.toLowerCase().includes(query)) ||
      item.businessMeaning.toLowerCase().includes(query) ||
      item.aliases.some(a => a.toLowerCase().includes(query)) ||
      (item.abbreviations && item.abbreviations.some(ab => ab.toLowerCase().includes(query))) ||
      item.standardKey.toLowerCase().includes(query) ||
      (item.notToBeConfusedWith && item.notToBeConfusedWith.some(w => w.toLowerCase().includes(query))) ||
      (item.formula && item.formula.toLowerCase().includes(query)) ||
      item.section.toLowerCase().includes(query)
    );
  });

  // Filtered data type specification items
  const filteredDataTypes = DATA_TYPE_SPECIFICATION_LIST.filter(item => {
    if (dictDataTypeCategoryFilter !== 'ALL' && item.categoryId !== dictDataTypeCategoryFilter) {
      return false;
    }
    if (!dictSearch) return true;
    const query = dictSearch.toLowerCase().trim();
    return (
      item.category.toLowerCase().includes(query) ||
      item.columnNames.some(c => c.toLowerCase().includes(query)) ||
      item.targetDataType.toLowerCase().includes(query) ||
      item.rawDataType.toLowerCase().includes(query) ||
      item.descriptionOrExample.toLowerCase().includes(query)
    );
  });

  const dataTypeCategoriesList = [
    { id: 'ALL', name: 'Tất cả (41 Khái Niệm)' },
    { id: 1, name: '1. Phân Loại & Định Danh' },
    { id: 2, name: '2. Ngày Tháng & Thời Gian' },
    { id: 3, name: '3. Doanh Số & Tài Chính' },
    { id: 4, name: '4. Đơn Hàng & Lượng Truy Cập' },
    { id: 5, name: '5. Tỷ Lệ & Phần Trăm' },
  ];

  const sectionsList = [
    { id: 'ALL', name: 'Tất cả (53 Cột)' },
    { id: 1, name: '1. Đơn Hàng (3)' },
    { id: 2, name: '2. Sản Phẩm (5)' },
    { id: 3, name: '3. Giá & Doanh Thu (7)' },
    { id: 4, name: '4. Chi Phí (5)' },
    { id: 5, name: '5. Marketing & Ads (7)' },
    { id: 6, name: '6. Hoàn, Hủy & Thất Thoát (6)' },
    { id: 7, name: '7. Khách Hàng (5)' },
    { id: 8, name: '8. KPI TMĐT (5)' },
    { id: 9, name: '9. Thời Gian (4)' },
    { id: 10, name: '10. Sàn & Kênh (2)' },
    { id: 11, name: '11. Tồn Kho (4)' },
  ];

  // ==========================================================================
  // RENDER: DATA DICTIONARY FULL VIEW COMPONENT
  // ==========================================================================
  const renderDataDictionaryContent = () => (
    <div className="space-y-6 animate-fadeIn">
      {/* Dictionary Top Header & Mode Switcher */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-white/10 shadow-xl backdrop-blur-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-lg font-black text-white flex items-center gap-2.5">
              <BookOpen className="w-5 h-5 text-sky-400" />
              <span>Từ Điển Ngữ Nghĩa & Kiểu Dữ Liệu TMĐT Chuẩn (Target vs Raw Data Type)</span>
            </h3>
            <p className="text-xs text-slate-300">
              5 nhóm kiểu dữ liệu chuẩn, 3 quy tắc tiền xử lý ETL, 53 khái niệm ngữ nghĩa, 22 từ viết tắt & 10 cặp cấm nhầm lẫn.
            </p>
          </div>

          {/* Sub-tab Pills */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-white/5 border border-white/10 shrink-0">
            <button
              onClick={() => setDictSubTab('data_types')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                dictSubTab === 'data_types'
                  ? 'bg-amber-500/30 text-amber-200 border border-amber-400/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Kiểu Dữ Liệu & ETL Rules</span>
            </button>

            <button
              onClick={() => setDictSubTab('columns')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                dictSubTab === 'columns'
                  ? 'bg-sky-500/30 text-sky-200 border border-sky-400/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>53 Cột Chuẩn</span>
            </button>

            <button
              onClick={() => setDictSubTab('collisions')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                dictSubTab === 'collisions'
                  ? 'bg-rose-500/30 text-rose-200 border border-rose-400/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>10 Cặp Cấm Nhầm Lẫn</span>
            </button>

            <button
              onClick={() => setDictSubTab('abbreviations')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                dictSubTab === 'abbreviations'
                  ? 'bg-purple-500/30 text-purple-200 border border-purple-400/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>22 Từ Viết Tắt</span>
            </button>

            <button
              onClick={() => setDictSubTab('ai_pipeline')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                dictSubTab === 'ai_pipeline'
                  ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Quy Trình AI 10 Bước</span>
            </button>
          </div>
        </div>

        {/* Search & Category Filter Bar (For Data Types View) */}
        {dictSubTab === 'data_types' && (
          <div className="space-y-3 pt-2 border-t border-white/5">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm theo tên cột, kiểu dữ liệu, ví dụ..."
                  value={dictSearch}
                  onChange={(e) => setDictSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-400/50"
                />
              </div>

              <span className="text-xs text-slate-400 self-end sm:self-center">
                Hiển thị <strong className="text-amber-300">{filteredDataTypes.length}</strong> / 41 định nghĩa
              </span>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              {dataTypeCategoriesList.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setDictDataTypeCategoryFilter(cat.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 transition-all ${
                    dictDataTypeCategoryFilter === cat.id
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40 font-bold shadow-sm'
                      : 'bg-white/[0.02] text-slate-400 hover:text-slate-200 border border-white/5'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search & Section Filter Bar (For Columns View) */}
        {dictSubTab === 'columns' && (
          <div className="space-y-3 pt-2 border-t border-white/5">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm theo tên cột, từ đồng nghĩa, viết tắt..."
                  value={dictSearch}
                  onChange={(e) => setDictSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-400/50"
                />
              </div>

              <span className="text-xs text-slate-400 self-end sm:self-center">
                Hiển thị <strong className="text-sky-300">{filteredDict.length}</strong> / 53 khái niệm
              </span>
            </div>

            {/* Section Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              {sectionsList.map((sec) => (
                <button
                  key={sec.id}
                  onClick={() => setDictSectionFilter(sec.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 transition-all ${
                    dictSectionFilter === sec.id
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-400/40 font-bold'
                      : 'bg-white/[0.02] text-slate-400 hover:text-slate-200 border border-white/5'
                  }`}
                >
                  {sec.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ====================================================================
          SUB-TAB 0: KIỂU DỮ LIỆU CHUẨN & 3 QUY TẮC ETL CHO AI AGENT
      ==================================================================== */}
      {dictSubTab === 'data_types' && (
        <div className="space-y-6">
          {/* AI ETL RULES CARD */}
          <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-950/40 via-slate-900/90 to-sky-950/40 border border-amber-500/30 shadow-xl space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-300">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-sm text-white flex items-center gap-2">
                    <span>Quy Tắc Xử Lý Dữ Liệu (ETL Rules) Cho AI Agent</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-mono">
                      Chuẩn Hóa Tự Động 100%
                    </span>
                  </h4>
                  <p className="text-xs text-slate-300">3 quy tắc ép kiểu dữ liệu nghiêm ngặt trước khi phân tích</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {AI_ETL_RULES.map((rule) => (
                <div
                  key={rule.id}
                  className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-amber-400/40 transition-all space-y-2 flex flex-col justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold flex items-center justify-center border border-amber-400/30 shrink-0">
                        {rule.id}
                      </span>
                      <h5 className="font-bold text-xs text-amber-200">{rule.title}</h5>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed pl-7">
                      {rule.rule}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-white/5 pl-7 space-y-1">
                    <div className="text-[10px] font-mono text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-400/20 truncate">
                      {rule.example}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* DATA TYPE SPECIFICATION LIST */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <span>Danh Sách Tên Cột, Kiểu Chuẩn & Kiểu Thô</span>
                <span className="text-xs font-normal text-slate-400">({filteredDataTypes.length} mục)</span>
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredDataTypes.map((item) => (
                <div
                  key={item.id}
                  className="p-5 rounded-3xl bg-slate-900/90 border border-white/10 hover:border-amber-400/40 transition-all space-y-3.5 shadow-lg flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    {/* Header: Column Names */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] px-2 py-0.5 rounded-md font-mono bg-amber-500/20 text-amber-300 font-bold border border-amber-400/30">
                            #{String(item.id).padStart(2, '0')}
                          </span>
                          <h5 className="font-black text-sm text-white">
                            {item.columnNames.join(', ')}
                          </h5>
                        </div>
                        <span className="inline-block text-[10px] text-slate-400 px-2 py-0.5 rounded bg-white/5 border border-white/5">
                          {item.category}
                        </span>
                      </div>
                    </div>

                    {/* Data Type Badges: Target vs Raw */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-400/20 space-y-0.5">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                          Kiểu dữ liệu chuẩn (Target)
                        </span>
                        <p className="text-xs font-black text-emerald-200 font-mono">
                          {item.targetDataType}
                        </p>
                      </div>

                      <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-400/20 space-y-0.5">
                        <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">
                          Kiểu dữ liệu thô (Raw)
                        </span>
                        <p className="text-xs font-black text-purple-200 font-mono">
                          {item.rawDataType}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Description / Example */}
                  <div className="pt-2.5 border-t border-white/5 text-xs text-slate-300 flex items-start gap-2">
                    <span className="text-slate-400 shrink-0 font-medium">Mô tả / Ví dụ:</span>
                    <span className="text-sky-300 font-mono bg-sky-500/10 px-2 py-0.5 rounded border border-sky-400/20 text-[11px] leading-relaxed break-all">
                      {item.descriptionOrExample}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          SUB-TAB 1: 53 CỘT CHUẨN GRID
      ==================================================================== */}
      {dictSubTab === 'columns' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDict.map((item) => (
            <div
              key={item.id}
              className="p-5 rounded-3xl bg-slate-900/90 border border-white/10 hover:border-sky-400/40 transition-all space-y-3 shadow-lg flex flex-col justify-between"
            >
              <div className="space-y-2.5">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 rounded-md font-mono bg-sky-500/20 text-sky-300 font-bold border border-sky-400/30">
                        #{String(item.id).padStart(2, '0')}
                      </span>
                      <h4 className="font-bold text-sm text-white">{item.vietnameseName}</h4>
                    </div>
                    {item.englishName && (
                      <p className="text-[11px] text-slate-400 italic mt-0.5">{item.englishName}</p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-300 font-mono border border-white/10">
                      {item.standardKey}
                    </span>
                  </div>
                </div>

                {/* Section Badge & Data Type */}
                <div className="flex items-center gap-2 text-[10px] text-slate-400 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-white/5 text-slate-300 font-medium border border-white/10">
                    📁 {item.section}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-medium border border-emerald-400/20">
                    Kiểu: {item.dataType}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 font-medium border border-blue-400/20">
                    Đơn vị: {item.unit}
                  </span>
                </div>

                {/* Business Meaning */}
                <p className="text-xs text-slate-200 leading-relaxed pt-1">
                  {item.businessMeaning}
                </p>

                {/* Formula if present */}
                {item.formula && (
                  <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-400/20 text-xs text-sky-300 font-semibold flex items-center gap-2">
                    <span>📐</span>
                    <span>Công thức: {item.formula}</span>
                  </div>
                )}

                {/* Critical Caveat: DO NOT CONFUSE */}
                {item.notToBeConfusedWith && item.notToBeConfusedWith.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-400/20 text-[11px] text-rose-200 leading-relaxed space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-rose-300">
                      <AlertOctagon className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>Không được nhầm với:</span>
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 pl-1 text-slate-300">
                      {item.notToBeConfusedWith.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Validation Rule */}
                <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-400/20 text-[11px] text-purple-200">
                  <strong className="text-purple-300">Quy tắc AI: </strong>
                  <span>{item.validationRule}</span>
                </div>
              </div>

              {/* Footer: Aliases & Sample Values */}
              <div className="pt-2 border-t border-white/5 space-y-1.5 text-[10px] text-slate-400">
                <div>
                  <span className="text-slate-500">Từ đồng nghĩa: </span>
                  <span className="text-slate-300">{item.aliases.slice(0, 6).join(', ')}</span>
                </div>
                {item.sampleValues && (
                  <div>
                    <span className="text-slate-500">Giá trị mẫu: </span>
                    <span className="text-emerald-300 font-mono">{item.sampleValues.join(' | ')}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ====================================================================
          SUB-TAB 2: 10 CẶP KHÁI NIỆM TUYỆT ĐỐI CẤM NHẦM LẪN (PHẦN 14)
      ==================================================================== */}
      {dictSubTab === 'collisions' && (
        <div className="space-y-4">
          <div className="p-5 rounded-3xl bg-gradient-to-r from-rose-950/60 via-slate-900/90 to-amber-950/60 border border-rose-500/30 text-xs space-y-2">
            <div className="flex items-center gap-2 text-rose-300 font-bold text-sm">
              <AlertOctagon className="w-5 h-5 text-rose-400" />
              <span>10 Nguyên Tắc Phân Định Ranh Giới Ngữ Nghĩa TMĐT</span>
            </div>
            <p className="text-slate-200 leading-relaxed">
              AI và kế toán viên tuyệt đối không được gộp hoặc xem các cặp chỉ số sau là giống nhau. Việc gộp sai bản chất sẽ gây sai lệch nghiêm trọng báo cáo tài chính.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CRITICAL_COLLISION_RULES.map((rule) => (
              <div
                key={rule.id}
                className="p-5 rounded-3xl bg-slate-900/90 border border-white/10 hover:border-rose-400/40 transition-all space-y-3 shadow-lg"
              >
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-md font-mono bg-rose-500/20 text-rose-300 font-black border border-rose-400/30">
                      #{rule.id}
                    </span>
                    <span className="text-xs font-black text-rose-300 tracking-wide uppercase">
                      {rule.pair}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                    <span className="text-slate-400 font-bold">Khái niệm A:</span>
                    <p className="text-sky-300 font-semibold">{rule.conceptA}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                    <span className="text-slate-400 font-bold">Khái niệm B:</span>
                    <p className="text-amber-300 font-semibold">{rule.conceptB}</p>
                  </div>
                </div>

                <p className="text-xs text-slate-200 leading-relaxed pt-1">
                  {rule.ruleExplanation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ====================================================================
          SUB-TAB 3: 22 TỪ VIẾT TẮT TIẾNG VIỆT CHUẨN (PHẦN 12)
      ==================================================================== */}
      {dictSubTab === 'abbreviations' && (
        <div className="space-y-4">
          <div className="p-5 rounded-3xl bg-gradient-to-r from-purple-950/60 via-slate-900/90 to-sky-950/60 border border-purple-500/30 text-xs space-y-2">
            <div className="flex items-center gap-2 text-purple-300 font-bold text-sm">
              <Tag className="w-5 h-5 text-purple-400" />
              <span>Bảng Tra Cứu Từ Viết Tắt TMĐT Tiếng Việt Phổ Biến</span>
            </div>
            <p className="text-slate-200 leading-relaxed">
              Các từ viết tắt này được tự động đối chiếu trong bộ parser để nhận diện chính xác ý nghĩa cột dữ liệu của doanh nghiệp.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.entries(VIETNAMESE_ABBREVIATIONS).map(([abbr, mean], idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-2xl bg-slate-900/80 border border-white/10 hover:border-purple-400/40 transition-all space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-purple-300 font-mono px-2 py-0.5 rounded bg-purple-500/20 border border-purple-400/30">
                    {abbr}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">VI-ABBR</span>
                </div>
                <p className="text-xs font-medium text-white pt-1">{mean}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ====================================================================
          SUB-TAB 4: QUY TRÌNH AI 10 BƯỚC & NGUYÊN TẮC AN TOÀN (PHẦN 15, 16, 17)
      ==================================================================== */}
      {dictSubTab === 'ai_pipeline' && (
        <div className="space-y-6">
          {/* 10 Steps Pipeline */}
          <div className="p-6 rounded-3xl bg-slate-900/90 border border-white/10 space-y-4">
            <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
              <ListOrdered className="w-5 h-5 text-emerald-400" />
              <span>Quy Trình 10 Bước AI Đọc & Xử Lý File Excel</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {AI_EXCEL_INGESTION_PIPELINE_STEPS.map((s) => (
                <div
                  key={s.step}
                  className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold flex items-center justify-center border border-emerald-400/30">
                      {s.step}
                    </span>
                    <span className="text-xs font-bold text-white">{s.name}</span>
                  </div>
                  <p className="text-xs text-slate-300 pl-8">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 7-Level Priority Rules */}
          <div className="p-6 rounded-3xl bg-slate-900/90 border border-white/10 space-y-4">
            <div className="flex items-center gap-2 text-sky-300 font-bold text-sm">
              <KeyRound className="w-5 h-5 text-sky-400" />
              <span>7 Mức Ưu Tiên Khi Map Cột (Mapping Hierarchy)</span>
            </div>

            <div className="space-y-2 text-xs">
              {MAPPING_PRIORITY_LEVELS.map((lvl, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-2 text-slate-200">
                  <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                  <span className="font-semibold">{lvl.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Safe Analysis Principles */}
          <div className="p-6 rounded-3xl bg-slate-900/90 border border-white/10 space-y-4">
            <div className="flex items-center gap-2 text-rose-300 font-bold text-sm">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
              <span>9 Nguyên Tắc An Toàn Tuyệt Đối (Safe Analysis Guardrails)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
              {SAFE_ANALYSIS_PRINCIPLES.map((principle, idx) => (
                <div key={idx} className="p-3 rounded-2xl bg-rose-500/10 border border-rose-400/20 flex items-start gap-2 text-rose-200">
                  <span className="text-rose-400 font-black">✕</span>
                  <span className="leading-relaxed">{principle}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ==========================================================================
  // VIEW 1: EMPTY STATE / UPLOAD DROPZONE
  // ==========================================================================
  if (!data) {
    return (
      <div className="space-y-8 animate-fadeIn max-w-5xl mx-auto py-4">
        {/* Top Breadcrumb */}
        <div className="flex items-center justify-between">
          <button
            onClick={onBackToPortal}
            className="inline-flex items-center text-xs font-semibold text-slate-400 hover:text-white px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all group"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5 transition-transform group-hover:-translate-x-1" />
            <span>Quay về Cổng Phân Hệ</span>
          </button>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowStandaloneDictModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/30 text-sky-300 hover:text-white transition-all"
            >
              <BookOpen className="w-3.5 h-3.5 text-sky-400" />
              <span>Tra Cứu Từ Điển 53 Cột v1.0</span>
            </button>

            <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/15 border border-emerald-400/30 text-emerald-300">
              💼 Luồng 2: Phân Tích Nội Bộ
            </span>
          </div>
        </div>

        {/* Hero Banner */}
        <div className="text-center space-y-3 pt-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-400/30 text-emerald-300 text-xs font-bold uppercase tracking-wider backdrop-blur-md">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Vietnamese E-Commerce Semantic Data Dictionary & Rule Engine v1.0</span>
          </div>

          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight">
            Phân Tích Báo Cáo Tài Chính & Vận Hành Doanh Nghiệp
          </h2>

          <p className="text-sm text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Hệ thống tự động nhận diện cả <strong className="text-white">Báo cáo đơn hàng chi tiết (Order-level)</strong> lẫn <strong className="text-white">Báo cáo tổng hợp (5 Sheets)</strong>, áp dụng bộ từ điển ngữ nghĩa 53 khái niệm chuẩn và quy tắc toàn vẹn doanh thu.
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-400/40 text-rose-200 text-xs flex items-start gap-3 animate-fadeIn">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Không thể bóc tách dữ liệu:</p>
              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Upload Dropzone Container */}
        <div className="relative rounded-3xl p-8 sm:p-10 bg-gradient-to-b from-slate-900/90 via-slate-900/70 to-emerald-950/30 border-2 border-dashed border-emerald-500/40 hover:border-emerald-400/80 transition-all duration-300 shadow-2xl backdrop-blur-xl flex flex-col items-center justify-center text-center group">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            disabled={isParsing}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            id="input-internal-excel-upload"
          />

          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-xl shadow-emerald-500/30 mb-5 group-hover:scale-110 transition-transform">
            {isParsing ? (
              <RefreshCw className="w-8 h-8 animate-spin" />
            ) : (
              <Upload className="w-8 h-8" />
            )}
          </div>

          <h3 className="text-lg sm:text-xl font-bold text-white mb-2">
            {isParsing ? 'Đang phân tích theo từ điển ngữ nghĩa v1.0...' : 'Kéo & thả file Excel báo cáo nội bộ vào đây'}
          </h3>

          <p className="text-xs sm:text-sm text-slate-300 max-w-md mb-6">
            Hỗ trợ file định dạng <span className="text-emerald-400 font-bold">.XLSX, .XLS, .CSV</span> với các cột Tiếng Việt chuẩn.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 relative z-20">
            <label
              htmlFor="input-internal-excel-upload"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/25 border border-emerald-400/40 cursor-pointer transition-all active:scale-95"
            >
              Chọn File Từ Máy Tính
            </label>

            <button
              type="button"
              onClick={downloadSampleInternalFinanceExcel}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 hover:text-white text-xs font-semibold border border-white/15 transition-all flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tải File Mẫu Tiếng Việt (.XLSX)</span>
            </button>

            <button
              type="button"
              onClick={handleLoadSampleDemo}
              className="px-4 py-2.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 hover:text-white text-xs font-semibold border border-sky-400/30 transition-all flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span>Thử Nghiệm Với Dữ Liệu Mẫu</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenDolphin('Giới thiệu cách EcomPulse Dolphin AI phân tích báo cáo tài chính nội bộ và từ điển 53 cột')}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600/30 via-sky-600/30 to-blue-600/30 hover:from-cyan-500/40 hover:to-blue-500/40 text-cyan-200 hover:text-white text-xs font-semibold border border-cyan-400/40 transition-all flex items-center gap-2 shadow-lg shadow-cyan-950/40 group"
            >
              <div className="relative">
                <img
                  src={dolphinAvatar}
                  alt="Dolphin"
                  className="w-4 h-4 rounded-full object-cover border border-cyan-400 group-hover:scale-110 transition-transform"
                />
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              </div>
              <span>Hỏi Cố Vấn Dolphin AI</span>
            </button>
          </div>
        </div>

        {/* Data Dictionary Quick Overview Card */}
        <div className="rounded-3xl p-6 bg-slate-900/60 border border-white/10 backdrop-blur-xl space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-400" />
              <span>Từ Điển Ngữ Nghĩa TMĐT & Quy Tắc Nghiệp Vụ Chuẩn Tiếng Việt</span>
            </h4>
            <button
              onClick={() => setShowStandaloneDictModal(true)}
              className="text-[11px] font-bold text-sky-300 hover:text-white bg-sky-500/15 hover:bg-sky-500/25 px-2.5 py-1 rounded-lg border border-sky-400/30 transition-all"
            >
              Xem Chi Tiết 53 Cột →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
              <span className="font-bold text-sky-300">Đơn Hàng & Doanh Thu</span>
              <p className="text-slate-400 text-[11px]">Mã đơn hàng, Ngày đặt, Sàn TMĐT, Doanh thu trước/sau giảm, Giảm giá, GMV.</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
              <span className="font-bold text-emerald-300">Sản Phẩm & Giá Vốn</span>
              <p className="text-slate-400 text-[11px]">Mã SKU, Tên SP, Ngành hàng, Số lượng, Đơn giá, Giá vốn (COGS), Tồn kho.</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
              <span className="font-bold text-purple-300">Marketing & Quảng Cáo</span>
              <p className="text-slate-400 text-[11px]">Chi phí ads (Ad Spend), Ngân sách, ROAS = Doanh thu / Ads, CTR, CPC, CPM.</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
              <span className="font-bold text-amber-300">Hoàn Hủy & Thất Thoát</span>
              <p className="text-slate-400 text-[11px]">Đơn hủy, Đơn hoàn, Tiền hoàn (Refund), Tỷ lệ hủy đơn, Doanh thu thất thoát.</p>
            </div>
          </div>
        </div>

        {/* Modal: Standalone Dictionary Viewer */}
        {showStandaloneDictModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
            <div className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl bg-slate-900 border border-white/20 p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-white/10 sticky top-0 bg-slate-900/95 z-10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Từ Điển Ngữ Nghĩa Dữ Liệu TMĐT (v1.0)</h4>
                    <p className="text-[11px] text-slate-400">53 Cột Chuẩn • 22 Từ Viết Tắt • 10 Cặp Cấm Nhầm Lẫn • 10 Bước AI</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowStandaloneDictModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {renderDataDictionaryContent()}

              <div className="pt-3 border-t border-white/10 flex justify-end">
                <button
                  onClick={() => setShowStandaloneDictModal(false)}
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all shadow-md"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Floating Dolphin AI Trigger Button */}
        <div className="fixed bottom-6 right-6 z-40">
          <button
            onClick={() => handleOpenDolphin()}
            className="relative group p-3 sm:p-3.5 rounded-full bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-600 text-white shadow-2xl shadow-cyan-500/40 border-2 border-cyan-300 hover:scale-110 active:scale-95 transition-all duration-300 flex items-center gap-2"
            title="Mở Trợ Lý Cố Vấn Dolphin AI"
          >
            <div className="relative">
              <img
                src={dolphinAvatar}
                alt="Dolphin AI"
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-white/80 shadow-inner"
              />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-900 animate-pulse" />
            </div>
            <span className="hidden sm:inline-block pr-1.5 text-xs font-black tracking-wide text-white drop-shadow">
              Dolphin AI
            </span>
          </button>
        </div>

        {/* Dolphin AI Modal in Empty State */}
        <DolphinChatModal
          isOpen={showDolphinChat}
          onClose={() => setShowDolphinChat(false)}
          data={null}
          initialPrompt={initialChatPrompt}
          onLoadDemoSample={handleLoadSampleDemo}
          language={language}
        />
      </div>
    );
  }

  // ==========================================================================
  // VIEW 2: ACTIVE DASHBOARD (AFTER DATA IS PARSED)
  // ==========================================================================
  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Status & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-xl shadow-lg">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToPortal}
            className="inline-flex items-center text-xs font-semibold text-slate-400 hover:text-white px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all group"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1 transition-transform group-hover:-translate-x-1" />
            <span>Phân Hệ</span>
          </button>

          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-semibold">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span className="truncate max-w-[200px]" title={data.fileName}>
              {data.fileName}
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/30">
              {data.isOrderLevelFile ? 'Báo Cáo Đơn Hàng Chi Tiết' : `${data.detectedSheets.length} Phân Hệ`}
            </span>
          </div>

          <button
            onClick={() => setShowHealthModal(true)}
            className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-emerald-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
            title="Xem chi tiết các cột và sheet đã nhận diện"
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-400" />
            <span>Kiểm Tra Cột</span>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleOpenDolphin()}
            className="inline-flex items-center px-3.5 py-1.5 text-xs font-bold text-cyan-200 hover:text-white bg-gradient-to-r from-cyan-600/30 via-sky-600/30 to-blue-600/30 hover:from-cyan-500/40 hover:to-blue-500/40 border border-cyan-400/50 hover:border-cyan-300 rounded-xl shadow-lg shadow-cyan-950/40 transition-all hover:scale-105 active:scale-95 group"
            title="Mở trợ lý cố vấn AI phân tích sâu dữ liệu tài chính nội bộ"
          >
            <div className="relative mr-1.5">
              <img
                src={dolphinAvatar}
                alt="Dolphin"
                className="w-4 h-4 rounded-full object-cover border border-cyan-400 group-hover:scale-110 transition-transform"
              />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            </div>
            <span>Cố Vấn Dolphin AI</span>
            <Sparkles className="w-3 h-3 ml-1 text-cyan-300 group-hover:rotate-12 transition-transform" />
          </button>

          <button
            onClick={downloadSampleInternalFinanceExcel}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-blue-300" />
            <span>Tải Mẫu .XLSX</span>
          </button>

          <label
            htmlFor="input-internal-excel-upload-active"
            className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border border-emerald-400/40 rounded-xl shadow-md cursor-pointer transition-all active:scale-95"
          >
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            <span>Tải File Khác</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              disabled={isParsing}
              className="hidden"
              id="input-internal-excel-upload-active"
            />
          </label>

          <button
            onClick={() => setData(null)}
            className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-rose-300 bg-white/5 hover:bg-rose-500/15 border border-white/10 hover:border-rose-400/30 rounded-xl transition-all"
            title="Xóa dữ liệu hiện tại để tải file mới"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            <span className="hidden sm:inline">Xóa</span>
          </button>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex border-b border-white/10 overflow-x-auto no-scrollbar py-1 gap-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'overview'
              ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-400/40 shadow-md shadow-emerald-500/10 backdrop-blur-md'
              : 'text-slate-300 hover:text-white hover:bg-white/[0.06] border border-transparent'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Tổng Quan KPI & Toàn Vẹn</span>
        </button>

        <button
          onClick={() => setActiveTab('revenue_orders')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'revenue_orders'
              ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-400/40 shadow-md shadow-emerald-500/10 backdrop-blur-md'
              : 'text-slate-300 hover:text-white hover:bg-white/[0.06] border border-transparent'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Doanh Thu & Đơn Hàng</span>
        </button>

        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'products'
              ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-400/40 shadow-md shadow-emerald-500/10 backdrop-blur-md'
              : 'text-slate-300 hover:text-white hover:bg-white/[0.06] border border-transparent'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Sản Phẩm & SKU</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/30 text-emerald-200">
            {data.productData.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('traffic')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'traffic'
              ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-400/40 shadow-md shadow-emerald-500/10 backdrop-blur-md'
              : 'text-slate-300 hover:text-white hover:bg-white/[0.06] border border-transparent'
          }`}
        >
          <MousePointer className="w-4 h-4" />
          <span>Nguồn Kênh & Traffic</span>
        </button>

        {kpis?.hasLiveVideoData && (
          <button
            onClick={() => setActiveTab('livestream')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'livestream'
                ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-400/40 shadow-md shadow-emerald-500/10 backdrop-blur-md'
                : 'text-slate-300 hover:text-white hover:bg-white/[0.06] border border-transparent'
            }`}
          >
            <Video className="w-4 h-4 text-amber-400" />
            <span>Livestream & Video</span>
          </button>
        )}

        {kpis?.hasKocAffData && (
          <button
            onClick={() => setActiveTab('koc_aff')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'koc_aff'
                ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-400/40 shadow-md shadow-emerald-500/10 backdrop-blur-md'
                : 'text-slate-300 hover:text-white hover:bg-white/[0.06] border border-transparent'
            }`}
          >
            <Users className="w-4 h-4 text-pink-400" />
            <span>KOL / KOC & Affiliate</span>
          </button>
        )}

        {/* DATA DICTIONARY INSPECTOR TAB */}
        <button
          onClick={() => setActiveTab('dictionary')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'dictionary'
              ? 'bg-sky-600/30 text-sky-300 border border-sky-400/40 shadow-md shadow-sky-500/10 backdrop-blur-md'
              : 'text-slate-300 hover:text-white hover:bg-white/[0.06] border border-transparent'
          }`}
        >
          <BookOpen className="w-4 h-4 text-sky-400" />
          <span>Từ Điển Dữ Liệu</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-sky-500/20 text-sky-300 font-bold">
            53 Cột v1.0
          </span>
        </button>

        <button
          onClick={() => setActiveTab('ai_action')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'ai_action'
              ? 'bg-gradient-to-r from-purple-600/30 to-emerald-600/30 text-purple-300 border border-purple-400/40 shadow-md shadow-purple-500/10 backdrop-blur-md'
              : 'text-slate-300 hover:text-white hover:bg-white/[0.06] border border-transparent'
          }`}
        >
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span>Trung Tâm Quyết Định AI</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 font-bold border border-purple-400/30">
            P0/P1/P2
          </span>
        </button>
      </div>

      {/* ======================================================================
          TAB 1: TỔNG QUAN KPI & TOÀN VẸN DOANH THU
      ====================================================================== */}
      {activeTab === 'overview' && kpis && (
        <div className="space-y-6">
          {/* Top 6 KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {/* Card 1: Doanh Thu Gộp */}
            <div className="p-4 rounded-3xl bg-slate-900/80 border border-white/10 shadow-xl backdrop-blur-xl space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Doanh Thu Gộp (GMV)</span>
                <DollarSign className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-lg font-black text-white">{formatVND(kpis.totalGmvPlaced)}</div>
              <div className="text-[11px] text-slate-400">Tổng đặt hàng ban đầu</div>
            </div>

            {/* Card 2: Doanh Thu Thuần */}
            <div className="p-4 rounded-3xl bg-slate-900/80 border border-emerald-400/30 shadow-xl backdrop-blur-xl space-y-2 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl pointer-events-none"></div>
              <div className="flex items-center justify-between text-emerald-300">
                <span className="text-xs font-medium">Doanh Thu Thực Thu</span>
                <Receipt className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-lg font-black text-emerald-300">{formatVND(kpis.totalGmvPaid)}</div>
              <div className="text-[11px] text-emerald-400/80 font-medium">
                {formatPercent(kpis.totalGmvPaid / (kpis.totalGmvPlaced || 1))} DT Gộp
              </div>
            </div>

            {/* Card 3: Thất Thoát / Chưa Thu */}
            <div className="p-4 rounded-3xl bg-slate-900/80 border border-rose-500/30 shadow-xl backdrop-blur-xl space-y-2">
              <div className="flex items-center justify-between text-rose-300">
                <span className="text-xs font-medium">Chênh Lệch Hủy / Treo</span>
                <TrendingDown className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-lg font-black text-rose-400">{formatVND(kpis.cancelledOrPendingRevenue)}</div>
              <div className="text-[11px] text-rose-300/80 font-medium">
                Tỷ lệ hủy/treo: {formatPercent(kpis.cancellationRate)}
              </div>
            </div>

            {/* Card 4: Tổng Đơn Hàng & AOV */}
            <div className="p-4 rounded-3xl bg-slate-900/80 border border-white/10 shadow-xl backdrop-blur-xl space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Tổng Số Đơn Hàng</span>
                <ShoppingBag className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-lg font-black text-white">{formatNumber(kpis.totalOrders)}</div>
              <div className="text-[11px] text-purple-300 font-medium">AOV: {formatVND(kpis.aov)}</div>
            </div>

            {/* Card 5: Tỷ Lệ Chuyển Đổi (CR) */}
            <div className="p-4 rounded-3xl bg-slate-900/80 border border-white/10 shadow-xl backdrop-blur-xl space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Tỷ Lệ Chuyển Đổi (CR)</span>
                <Target className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-lg font-black text-amber-300">{formatPercent(kpis.avgConversionRate)}</div>
              <div className="text-[11px] text-slate-400">{formatNumber(kpis.totalSessions)} lượt truy cập</div>
            </div>

            {/* Card 6: Khách Mua Mới */}
            <div className="p-4 rounded-3xl bg-slate-900/80 border border-white/10 shadow-xl backdrop-blur-xl space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Khách Hàng Mới</span>
                <Users className="w-4 h-4 text-teal-400" />
              </div>
              <div className="text-lg font-black text-teal-300">{formatNumber(kpis.newBuyers)}</div>
              <div className="text-[11px] text-slate-400">
                {formatPercent(kpis.newBuyerRatio)} tổng người mua ({formatNumber(kpis.totalBuyers)})
              </div>
            </div>
          </div>

          {/* STORE OPERATIONS & HEALTH METRIC STRIP (4 VITAL STORE KPIS) */}
          <StoreOperationsMetricStrip
            data={convertInternalFinanceToStoreData(data)}
            language={language}
          />

          {/* VISUAL ANALYTICS DASHBOARD (POWER BI 3-WIDGET ROW, REVENUE LEAKAGE PIE, CHANNEL RETENTION MATRIX) */}
          <P0AnalyticsDashboard
            data={convertInternalFinanceToStoreData(data)}
            onNavigateToAiTab={() => setActiveTab('ai_action')}
            language={language}
          />

          {/* SHOPEE GROWTH & CONTENT HUB (FLYWHEEL MOMENTUM, CREATOR ANALYTICS, REELS, LIVESTREAM) */}
          <ShopeeGrowthAndContentHub
            data={convertInternalFinanceToStoreData(data)}
            language={language}
            onNavigateToAi={() => setActiveTab('ai_action')}
          />

          {/* ORDER STATUS INTEGRITY BREAKDOWN WIDGET */}
          {integrity && (
            <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-emerald-950/40 border border-emerald-500/30 shadow-2xl backdrop-blur-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">
                    Bóc Tách Toàn Vẹn Doanh Thu Theo Trạng Thái Đơn Hàng (Revenue Integrity Engine)
                  </h3>
                </div>
                <span className="text-xs text-emerald-300 font-semibold">
                  Chỉ tính đơn Giao thành công vào Doanh thu thuần
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Giao thành công */}
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-400/30 space-y-1.5">
                  <div className="flex items-center justify-between text-emerald-300 text-xs font-bold">
                    <span>Đã Giao / Hoàn Tất</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20">
                      {integrity.deliveredOrdersCount} đơn
                    </span>
                  </div>
                  <div className="text-base font-black text-emerald-300">
                    {formatVND(integrity.deliveredRevenue)}
                  </div>
                  <p className="text-[10px] text-emerald-400/80">
                    Doanh thu thuần thực thu sau khi trừ giảm giá
                  </p>
                </div>

                {/* 2. Đã Hủy */}
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-400/30 space-y-1.5">
                  <div className="flex items-center justify-between text-rose-300 text-xs font-bold">
                    <span>Đã Hủy Đơn</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20">
                      {integrity.cancelledOrdersCount} đơn
                    </span>
                  </div>
                  <div className="text-base font-black text-rose-400">
                    {formatVND(integrity.cancelledRevenue)}
                  </div>
                  <p className="text-[10px] text-rose-300/80">
                    Thất thoát do hủy: {formatPercent(integrity.cancelledRate)} tổng đơn
                  </p>
                </div>

                {/* 3. Hoàn Tiền / Trả Hàng */}
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-400/30 space-y-1.5">
                  <div className="flex items-center justify-between text-amber-300 text-xs font-bold">
                    <span>Hoàn Tiền / Trả Hàng</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20">
                      {integrity.refundedOrdersCount} đơn
                    </span>
                  </div>
                  <div className="text-base font-black text-amber-300">
                    {formatVND(integrity.refundedRevenue)}
                  </div>
                  <p className="text-[10px] text-amber-400/80">
                    Tỷ lệ hoàn trả: {formatPercent(integrity.refundedRate)}
                  </p>
                </div>

                {/* 4. Đang Xử Lý / Trên Đường Giao */}
                <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-400/30 space-y-1.5">
                  <div className="flex items-center justify-between text-blue-300 text-xs font-bold">
                    <span>Đang Xử Lý / Đang Giao</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20">
                      {integrity.processingOrdersCount} đơn
                    </span>
                  </div>
                  <div className="text-base font-black text-blue-300">
                    {formatVND(integrity.processingRevenue)}
                  </div>
                  <p className="text-[10px] text-blue-400/80">
                    Doanh thu dự kiến ghi nhận trong kỳ tới
                  </p>
                </div>
              </div>

              {/* Extended COGS & ROAS if present */}
              {(integrity.totalGrossProfit > 0 || integrity.overallROAS > 0) && (
                <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
                  {integrity.totalGrossProfit > 0 && (
                    <div className="flex items-center gap-2 text-slate-300">
                      <span className="text-slate-400">Lãi Gộp Kế Toán:</span>
                      <strong className="text-emerald-300">{formatVND(integrity.totalGrossProfit)}</strong>
                      <span className="text-[11px] text-slate-400">({formatPercent(integrity.grossProfitMargin)} Margin)</span>
                    </div>
                  )}

                  {integrity.overallROAS > 0 && (
                    <div className="flex items-center gap-2 text-slate-300">
                      <span className="text-slate-400">ROAS Quảng Cáo:</span>
                      <strong className="text-sky-300">{integrity.overallROAS.toFixed(2)}x</strong>
                      <span className="text-[11px] text-slate-400">(Ads: {formatVND(integrity.totalAdSpend)})</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Doanh Thu Gộp vs Thuần theo ngày */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-white/10 shadow-xl backdrop-blur-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span>Diễn Biến Doanh Thu Gộp vs Thuần Theo Ngày</span>
                </h3>
                <span className="text-xs text-slate-400">Đơn vị: VNĐ</span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorGmvPlaced" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorGmvPaid" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#34d399" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => formatCompactVND(v)} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                      formatter={(val: any) => [formatVND(Number(val)), '']}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Area type="monotone" dataKey="gmv_placed" name="DT Gộp (Placed)" stroke="#38bdf8" fillOpacity={1} fill="url(#colorGmvPlaced)" strokeWidth={2} />
                    <Area type="monotone" dataKey="gmv_paid" name="DT Thuần (Paid)" stroke="#34d399" fillOpacity={1} fill="url(#colorGmvPaid)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Phễu Chuyển Đổi (Conversion Funnel) */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-white/10 shadow-xl backdrop-blur-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Target className="w-4 h-4 text-amber-400" />
                  <span>Phễu Chuyển Đổi 3 Bước (Funnel Analytics)</span>
                </h3>
                <span className="text-xs text-amber-300 font-semibold">
                  CR Tổng: {formatPercent(kpis.avgConversionRate)}
                </span>
              </div>

              <div className="space-y-4 pt-2">
                {/* Step 1: Sessions */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-300">1. Lượt truy cập (Sessions / Traffic)</span>
                    <span className="text-white">{formatNumber(kpis.totalSessions)}</span>
                  </div>
                  <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: '100%' }}></div>
                  </div>
                </div>

                {/* Step 2: PDP Views */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-300">2. Lượt xem trang sản phẩm (PDP Views)</span>
                    <span className="text-sky-300">{formatNumber(kpis.totalProductViews)}</span>
                  </div>
                  <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-400 rounded-full"
                      style={{ width: `${Math.min(100, (kpis.totalProductViews / (kpis.totalSessions || 1)) * 100)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Step 3: Orders Placed */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-300">3. Đơn hàng thành công (Orders)</span>
                    <span className="text-emerald-300 font-bold">{formatNumber(kpis.totalOrders)}</span>
                  </div>
                  <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 rounded-full"
                      style={{ width: `${Math.min(100, (kpis.totalOrders / (kpis.totalSessions || 1)) * 100 * 5)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================
          TAB 2: DOANH THU & ĐƠN HÀNG CHI TIẾT
      ====================================================================== */}
      {activeTab === 'revenue_orders' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-white/10 shadow-xl backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Bảng Chuỗi Thời Gian Doanh Thu & Đơn Hàng Theo Ngày</h3>
              <span className="text-xs text-slate-400">Tổng {data.revenueData.length} ngày ghi nhận</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-white/5 uppercase font-bold text-slate-400 text-[11px] border-b border-white/10">
                  <tr>
                    <th className="py-3 px-4">Ngày</th>
                    <th className="py-3 px-4 text-right">Số Đơn</th>
                    <th className="py-3 px-4 text-right">DT Gộp</th>
                    <th className="py-3 px-4 text-right">DT Thuần</th>
                    <th className="py-3 px-4 text-right">Khách Mua</th>
                    <th className="py-3 px-4 text-right">Khách Mới</th>
                    <th className="py-3 px-4 text-right">Lượt View SP</th>
                    <th className="py-3 px-4 text-right">Sessions</th>
                    <th className="py-3 px-4 text-right">CR (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.revenueData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.03] transition-colors">
                      <td className="py-3 px-4 font-mono text-white font-semibold">{row.date}</td>
                      <td className="py-3 px-4 text-right font-bold text-purple-300">{formatNumber(row.total_orders)}</td>
                      <td className="py-3 px-4 text-right text-blue-300">{formatVND(row.gmv_placed)}</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-300">{formatVND(row.gmv_paid)}</td>
                      <td className="py-3 px-4 text-right">{formatNumber(row.buyers_total)}</td>
                      <td className="py-3 px-4 text-right text-teal-300">{formatNumber(row.buyers_new)}</td>
                      <td className="py-3 px-4 text-right text-slate-400">{formatNumber(row.product_views)}</td>
                      <td className="py-3 px-4 text-right text-slate-400">{formatNumber(row.sessions)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-amber-300">{formatPercent(row.conversion_rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================
          TAB 3: SẢN PHẨM & SKU (PARETO 80/20 & CỘNG DỒN TỰ ĐỘNG)
      ====================================================================== */}
      {activeTab === 'products' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-white/10 shadow-xl backdrop-blur-xl space-y-5">
            {/* Header with Title and Badges */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">Danh Mục Sản Phẩm & Đóng Góp Doanh Thu (Pareto Analysis)</h3>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-400/30">
                    Đã cộng dồn tự động
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Hệ thống tự động gom các dòng cùng SKU/Tên sản phẩm thành {data.productData.length} mặt hàng độc nhất để tính toán chính xác 100%.
                </p>
              </div>

              {/* Status pills count */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs px-3 py-1 rounded-xl bg-white/5 text-slate-300 border border-white/10 font-medium">
                  Tổng: <strong className="text-white">{data.productData.length}</strong>
                </span>
                <span className="text-xs px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-400/20 font-medium">
                  Đang bán: <strong>{data.productData.filter(p => p.status === 'Active' || p.status === 'Đang bán').length}</strong>
                </span>
                <span className="text-xs px-3 py-1 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-400/20 font-medium">
                  Hết hàng: <strong>{data.productData.filter(p => p.status === 'Hết hàng').length}</strong>
                </span>
                <span className="text-xs px-3 py-1 rounded-xl bg-purple-500/10 text-purple-300 border border-purple-400/20 font-medium">
                  Tạm ngưng: <strong>{data.productData.filter(p => p.status === 'Paused').length}</strong>
                </span>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm kiếm theo Tên sản phẩm hoặc Mã SKU..."
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"
                />
                {productSearch && (
                  <button
                    onClick={() => setProductSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {(['ALL', 'Active', 'Hết hàng', 'Paused'] as const).map(stat => (
                  <button
                    key={stat}
                    onClick={() => setProductStatusFilter(stat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      productStatusFilter === stat
                        ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                        : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
                    }`}
                  >
                    {stat === 'ALL' ? 'Tất cả' : stat}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Table */}
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-white/5 uppercase font-bold text-slate-400 text-[11px] border-b border-white/10">
                  <tr>
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">Tên Sản Phẩm</th>
                    <th className="py-3 px-4">SKU / Mã SP</th>
                    <th className="py-3 px-4 text-center">Trạng Thái</th>
                    <th className="py-3 px-4 text-right">Doanh Thu (VNĐ)</th>
                    <th className="py-3 px-4 text-right min-w-[140px]">% Đóng Góp DT</th>
                    <th className="py-3 px-4 text-right">Lượt Click</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.productData
                    .filter(p => {
                      if (productStatusFilter !== 'ALL' && p.status !== productStatusFilter) return false;
                      if (!productSearch) return true;
                      const q = productSearch.toLowerCase();
                      return p.product_name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q));
                    })
                    .map((prod, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.03] transition-colors">
                        <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-3 px-4 font-semibold text-white max-w-xs truncate" title={prod.product_name}>
                          {prod.product_name}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-400">{prod.sku}</td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              prod.status === 'Active' || prod.status === 'Đang bán'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                                : prod.status === 'Hết hàng'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                                : prod.status === 'Paused'
                                ? 'bg-purple-500/20 text-purple-300 border-purple-400/30'
                                : 'bg-rose-500/20 text-rose-300 border-rose-400/30'
                            }`}
                          >
                            {prod.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-300">{formatVND(prod.product_revenue)}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 rounded-full"
                                style={{ width: `${Math.min(100, Math.max(2, (prod.revenue_share || 0) * 100))}%` }}
                              ></div>
                            </div>
                            <span className="font-semibold text-sky-300 w-12 text-right">
                              {formatPercent(prod.revenue_share || 0)}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right text-slate-400">{formatNumber(prod.clicks || 0)}</td>
                      </tr>
                    ))}
                  {data.productData.filter(p => {
                    if (productStatusFilter !== 'ALL' && p.status !== productStatusFilter) return false;
                    if (!productSearch) return true;
                    const q = productSearch.toLowerCase();
                    return p.product_name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q));
                  }).length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Không tìm thấy sản phẩm phù hợp với bộ lọc tìm kiếm.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================
          TAB 4: NGUỒN TRAFFIC & KÊNH BÁN (CỘNG DỒN THEO KÊNH)
      ====================================================================== */}
      {activeTab === 'traffic' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-white/10 shadow-xl backdrop-blur-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">Hiệu Suất & Đóng Góp Doanh Số Theo Kênh Traffic</h3>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-bold border border-sky-400/30">
                    Đã cộng dồn theo kênh
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Dữ liệu được tự động nhóm theo các nền tảng chính (Shopee, TikTok Shop, Direct, Paid Ads...).
                </p>
              </div>
              <span className="text-xs px-3 py-1 rounded-xl bg-white/5 text-slate-300 border border-white/10 font-medium">
                Tổng doanh số kênh: <strong className="text-emerald-300">{formatVND(kpis.totalTrafficRevenue || data.trafficData.reduce((s, t) => s + t.source_revenue, 0))}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
              {/* Donut Chart with Centered KPI */}
              <div className="lg:col-span-5 flex flex-col items-center justify-center p-4 rounded-2xl bg-white/[0.02] border border-white/5 relative min-h-[280px]">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={data.trafficData}
                      dataKey="source_revenue"
                      nameKey="traffic_source"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                      cornerRadius={4}
                    >
                      {data.trafficData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: any) => [formatVND(Number(v)), 'Doanh số']}
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center text overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-4">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Kênh Traffic</span>
                  <span className="text-sm font-bold text-white">{data.trafficData.length} Kênh</span>
                </div>
              </div>

              {/* Side Breakdown List with Progress Bars & CR */}
              <div className="lg:col-span-7 space-y-3 flex flex-col justify-center">
                {data.trafficData.map((tr, idx) => {
                  const totalTrafficRev = data.trafficData.reduce((s, t) => s + t.source_revenue, 0) || 1;
                  const sharePct = (tr.source_revenue / totalTrafficRev) * 100;
                  return (
                    <div key={idx} className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                          <span className="text-xs font-bold text-white">{tr.traffic_source}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-emerald-300">{formatVND(tr.source_revenue)}</span>
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 font-semibold border border-amber-400/20">
                            CR: {formatPercent(tr.source_cr)}
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar & Share % */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.max(2, sharePct)}%`,
                              backgroundColor: COLORS[idx % COLORS.length],
                            }}
                          ></div>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-300 w-10 text-right">
                          {sharePct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================
          TAB 5: LIVESTREAM & VIDEO
      ====================================================================== */}
      {activeTab === 'livestream' && kpis?.hasLiveVideoData && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-white/10 shadow-xl backdrop-blur-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center justify-between">
              <span>Hiệu Quả Doanh Thu Từ Livestream & Short Video</span>
              <span className="text-xs text-amber-300 font-semibold">Tổng {data.liveData.length} phiên Live</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-white/5 uppercase font-bold text-slate-400 text-[11px] border-b border-white/10">
                  <tr>
                    <th className="py-3 px-4">ID Live</th>
                    <th className="py-3 px-4">Tiêu đề phiên Live</th>
                    <th className="py-3 px-4 text-right">DT Phát Sinh</th>
                    <th className="py-3 px-4 text-right">Thời lượng xem TB</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.liveData.map((live, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.03] transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400">{live.live_session_id}</td>
                      <td className="py-3 px-4 font-semibold text-white">{live.live_session_title}</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-300">{formatVND(live.live_revenue)}</td>
                      <td className="py-3 px-4 text-right font-medium text-amber-300">{live.avg_watch_duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================
          TAB 6: KOC / KOL & AFFILIATE
      ====================================================================== */}
      {activeTab === 'koc_aff' && kpis?.hasKocAffData && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-white/10 shadow-xl backdrop-blur-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center justify-between">
              <span>Hiệu Suất Đối Tác KOC / KOL & Tiếp Thị Liên Kết</span>
              <span className="text-xs text-pink-300 font-semibold">Tổng {data.kocData.length} Đối tác KOC</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-white/5 uppercase font-bold text-slate-400 text-[11px] border-b border-white/10">
                  <tr>
                    <th className="py-3 px-4">Người Tiếp Thị (KOC)</th>
                    <th className="py-3 px-4">Nền tảng</th>
                    <th className="py-3 px-4 text-right">Doanh Số Mang Về</th>
                    <th className="py-3 px-4 text-right">Hoa Hồng Dự Kiến</th>
                    <th className="py-3 px-4 text-right">% Hoa Hồng / DT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.kocData.map((koc, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.03] transition-colors">
                      <td className="py-3 px-4 font-semibold text-white">{koc.affiliate_username}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-500/20 text-pink-300 border border-pink-400/30">
                          {koc.platform}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-300">{formatVND(koc.affiliate_revenue)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-amber-300">{formatVND(koc.commission_fee)}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-300">
                        {koc.commission_rate ? formatPercent(koc.commission_rate) : '10%'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================
          TAB 7: TỪ ĐIỂN DỮ LIỆU TMĐT (DATA DICTIONARY INSPECTOR - 53 CỘT v1.0)
      ====================================================================== */}
      {activeTab === 'dictionary' && renderDataDictionaryContent()}

      {/* ======================================================================
          TAB 8: TRUNG TÂM QUYẾT ĐỊNH AI NỘI BỘ (AI PRESCRIPTIVE ACTION PLAN)
      ====================================================================== */}
      {activeTab === 'ai_action' && kpis && (
        <div className="space-y-6">
          <div className="p-5 rounded-3xl bg-gradient-to-r from-purple-950/70 via-slate-900/90 to-emerald-950/60 border border-purple-400/40 shadow-xl backdrop-blur-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-purple-300 font-bold text-sm">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <span>AI Đánh Giá Sức Khỏe Vận Hành & Khuyến Nghị Tối Ưu Doanh Nghiệp</span>
              </div>
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-400/30">
                Tuân thủ Từ Điển TMĐT v1.0
              </span>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed">
              Dựa trên phân tích 100% dữ liệu thực từ file nội bộ của bạn, AI đã áp dụng <span className="text-purple-300 font-bold">53 quy tắc ngữ nghĩa</span> và xác định 3 nhóm hành động đột phá nhằm cải thiện biên lợi nhuận, giảm tỷ lệ hủy đơn và tối ưu ngân sách kênh traffic.
            </p>
          </div>

          {/* Ma trận hành động P0 / P1 / P2 */}
          <div className="space-y-4">
            {/* P0 (Cấp Bách) */}
            <div className="p-5 rounded-3xl bg-rose-950/20 border border-rose-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-xs font-black border border-rose-400/40">
                    P0 • CẤP BÁCH
                  </span>
                  <span className="text-sm font-bold text-white">Kiểm soát đơn hủy & chênh lệch doanh thu gộp/thuần</span>
                </div>
                <span className="text-xs text-rose-300 font-semibold">Tác động: Giữ lại {formatVND(kpis.cancelledOrPendingRevenue)}</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Tỷ lệ hủy/chưa thu tiền hiện tại đang ở mức <strong className="text-rose-400">{formatPercent(kpis.cancellationRate)}</strong> ({formatVND(kpis.cancelledOrPendingRevenue)}). Cần rà soát ngay quy trình gọi điện xác nhận đơn, kích hoạt tin nhắn Zalo ZNS tự động để tăng tỷ lệ nhận hàng thành công lên trên 95%.
              </p>
            </div>

            {/* P1 (Tối Ưu Ngắn Hạn) */}
            <div className="p-5 rounded-3xl bg-amber-950/20 border border-amber-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black border border-amber-400/40">
                    P1 • TỐI ƯU
                  </span>
                  <span className="text-sm font-bold text-white">Tối ưu hóa phễu chuyển đổi & Danh mục SKU dẫn dắt</span>
                </div>
                <span className="text-xs text-amber-300 font-semibold">Mục tiêu: Tăng CR lên &gt; 5.5%</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Sản phẩm dẫn đầu <strong className="text-white">"{kpis.topProduct?.product_name || 'Top SKU'}"</strong> đang đóng góp {formatPercent(kpis.topProduct?.revenue_share || 0.3)} doanh thu. Cần tạo combo bundle bán kèm các sản phẩm có biên lãi cao để kéo AOV từ <strong className="text-amber-300">{formatVND(kpis.aov)}</strong> lên mức cao hơn.
              </p>
            </div>

            {/* P2 (Chiến Lược Dài Hạn) */}
            <div className="p-5 rounded-3xl bg-emerald-950/20 border border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-black border border-emerald-400/40">
                    P2 • CHIẾN LƯỢC
                  </span>
                  <span className="text-sm font-bold text-white">Mở rộng kênh Livestream & Đối tác Affiliate (KOC)</span>
                </div>
                <span className="text-xs text-emerald-300 font-semibold">Mục tiêu: Tăng 25% doanh số organic</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {kpis.hasKocAffData
                  ? `Mạng lưới ${kpis.totalKocCount} KOC đối tác đang mang về ${formatVND(kpis.totalKocRevenue)} với chi phí hoa hồng ${formatPercent(kpis.avgCommissionRate)}. Nên mở rộng thêm 15 KOC phân khúc micro để phân tán rủi ro kênh.`
                  : 'Doanh nghiệp chưa khai thác kênh Tiếp thị liên kết (KOC/Affiliate). Đây là cơ hội tăng trưởng lớn với chi phí chỉ trả theo đơn hàng thành công (Performance-based).'}
              </p>
            </div>
          </div>

          {/* Dolphin AI Interactive Prescriptive Triggers */}
          <div className="p-6 rounded-3xl bg-slate-900/90 border border-cyan-500/30 shadow-2xl backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={dolphinAvatar}
                    alt="Dolphin AI"
                    className="w-10 h-10 rounded-2xl object-cover border border-cyan-400 shadow-md"
                  />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-900 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>Hỏi Trực Tiếp Cố Vấn Dolphin AI</span>
                    <Sparkles className="w-4 h-4 text-cyan-300" />
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Trích xuất số liệu tức thì từ file nội bộ của doanh nghiệp (Không bịa số, bảo mật 100% trên RAM)
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleOpenDolphin()}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-950/50 border border-cyan-400/40 transition-all hover:scale-105 active:scale-95"
              >
                Mở Cửa Sổ Chat AI
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              <button
                onClick={() =>
                  handleOpenDolphin(
                    'Phân tích chi tiết Giá vốn hàng bán COGS và Biên lợi nhuận gộp của doanh nghiệp'
                  )
                }
                className="p-3.5 rounded-2xl bg-white/[0.03] hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-400/40 text-left transition-all group space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    <span>Giá Vốn & Lợi Nhuận Gộp</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-300 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-[11px] text-slate-400 group-hover:text-slate-200">
                  Đối soát COGS, biên lãi gộp thực nhận và ước tính đóng góp lợi nhuận từng mã SKU.
                </p>
              </button>

              <button
                onClick={() =>
                  handleOpenDolphin(
                    'Bóc tách chênh lệch Doanh thu Gộp (Placed) vs Doanh thu Thuần (Paid) và tỷ lệ đơn hủy'
                  )
                }
                className="p-3.5 rounded-2xl bg-white/[0.03] hover:bg-rose-500/10 border border-white/10 hover:border-rose-400/40 text-left transition-all group space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-rose-300 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>Rò Rỉ GMV Placed vs Paid</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-rose-300 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-[11px] text-slate-400 group-hover:text-slate-200">
                  Phân tích thất thoát dòng tiền ở khâu giao vận và kịch bản giảm tỷ lệ đơn hủy.
                </p>
              </button>

              <button
                onClick={() =>
                  handleOpenDolphin(
                    'Sản phẩm nào đang có biên lợi nhuận cao nhất và đề xuất đóng gói combo tăng AOV'
                  )
                }
                className="p-3.5 rounded-2xl bg-white/[0.03] hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-400/40 text-left transition-all group space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs">
                    <ShoppingBag className="w-4 h-4 text-cyan-400" />
                    <span>Top SKU & Zombie Class C</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-300 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-[11px] text-slate-400 group-hover:text-slate-200">
                  Xác định mã chủ lực Hero SKU và giải pháp bundle quà tặng để giải phóng hàng tồn.
                </p>
              </button>

              <button
                onClick={() =>
                  handleOpenDolphin(
                    'Đánh giá doanh số mang về từ các phiên Livestream và hiệu quả mạng lưới KOC / Affiliate'
                  )
                }
                className="p-3.5 rounded-2xl bg-white/[0.03] hover:bg-purple-500/10 border border-white/10 hover:border-purple-400/40 text-left transition-all group space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-purple-300 font-bold text-xs">
                    <Video className="w-4 h-4 text-purple-400" />
                    <span>Livestream & KOC / Affiliate</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-purple-300 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-[11px] text-slate-400 group-hover:text-slate-200">
                  Đánh giá ROI kênh video/live và chính sách hoa hồng tối ưu cho đối tác tiếp thị.
                </p>
              </button>

              <button
                onClick={() =>
                  handleOpenDolphin(
                    'Tra cứu các quy tắc cấm nhầm lẫn và từ điển 53 cột TMĐT áp dụng cho file này'
                  )
                }
                className="p-3.5 rounded-2xl bg-white/[0.03] hover:bg-sky-500/10 border border-white/10 hover:border-sky-400/40 text-left transition-all group space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sky-300 font-bold text-xs">
                    <BookOpen className="w-4 h-4 text-sky-400" />
                    <span>Từ Điển 53 Cột & Cấm Nhầm Lẫn</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-sky-300 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-[11px] text-slate-400 group-hover:text-slate-200">
                  10 cặp cấm nhầm lẫn cốt lõi và phương pháp chuẩn hóa dữ liệu TMĐT đa sàn.
                </p>
              </button>

              <button
                onClick={() =>
                  handleOpenDolphin(
                    'Nguyên lý bảo mật On-Premise và cách EcomPulse cô lập dữ liệu 100% trong RAM?'
                  )
                }
                className="p-3.5 rounded-2xl bg-white/[0.03] hover:bg-amber-500/10 border border-white/10 hover:border-amber-400/40 text-left transition-all group space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    <span>Bảo Mật On-Premise (RAM)</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-300 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-[11px] text-slate-400 group-hover:text-slate-200">
                  Xác nhận cam kết bảo mật cấp ngân hàng: không lưu trữ ổ cứng, không rò rỉ dữ liệu.
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================
          MODAL: DATA HEALTH CHECK & COLUMN INSPECTOR
      ====================================================================== */}
      {showHealthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-2xl rounded-3xl bg-slate-900 border border-white/20 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Kiểm Tra Sức Khỏe Dữ Liệu & Nhận Diện Cột</h4>
                  <p className="text-[11px] text-slate-400">Chi tiết các sheet và trường dữ liệu AI đã quét</p>
                </div>
              </div>
              <button
                onClick={() => setShowHealthModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 text-xs">
              {data.detectedSheets.map((s, idx) => (
                <div key={idx} className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-300">Sheet: `{s.sheetName}`</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-400/30">
                      {s.rowCount} dòng dữ liệu
                    </span>
                  </div>
                  <div className="text-slate-300 text-[11px]">
                    <span className="text-slate-400">Cột đã nhận diện: </span>
                    {s.recognizedColumns.join(', ')}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setShowHealthModal(false)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Dolphin AI Trigger Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => handleOpenDolphin()}
          className="relative group p-3 sm:p-3.5 rounded-full bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-600 text-white shadow-2xl shadow-cyan-500/40 border-2 border-cyan-300 hover:scale-110 active:scale-95 transition-all duration-300 flex items-center gap-2"
          title="Mở Trợ Lý Cố Vấn Dolphin AI"
        >
          <div className="relative">
            <img
              src={dolphinAvatar}
              alt="Dolphin AI"
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-white/80 shadow-inner"
            />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-900 animate-pulse" />
          </div>
          <span className="hidden sm:inline-block pr-1.5 text-xs font-black tracking-wide text-white drop-shadow">
            Dolphin AI
          </span>
        </button>
      </div>

      {/* Dolphin AI Chat Modal in Active View */}
      <DolphinChatModal
        isOpen={showDolphinChat}
        onClose={() => setShowDolphinChat(false)}
        data={data ? convertInternalFinanceToStoreData(data) : null}
        initialPrompt={initialChatPrompt}
        onLoadDemoSample={handleLoadSampleDemo}
        language={language}
      />
    </div>
  );
};

// ============================================================================
// VIETNAMESE E-COMMERCE SEMANTIC DATA DICTIONARY & BUSINESS RULE ENGINE v1.0
// TỪ ĐIỂN NGỮ NGHĨA DỮ LIỆU THƯƠNG MẠI ĐIỆN TỬ - PHIÊN BẢN 1.0
// ============================================================================

export type StandardColumnKey =
  // Phần 1. Đơn hàng
  | 'order_id'
  | 'order_date'
  | 'order_status'
  // Phần 2. Sản phẩm
  | 'product_id'
  | 'sku'
  | 'product_name'
  | 'category'
  | 'quantity'
  // Phần 3. Giá và Doanh thu
  | 'unit_price'
  | 'cogs'
  | 'discount'
  | 'gross_revenue'
  | 'net_revenue'
  | 'revenue'
  | 'gmv'
  // Phần 4. Chi phí
  | 'ad_spend'
  | 'ad_budget'
  | 'platform_fee'
  | 'shipping_fee'
  | 'total_expenses'
  // Phần 5. Quảng cáo và Marketing
  | 'impressions'
  | 'clicks'
  | 'ctr'
  | 'cpc'
  | 'cpm'
  | 'roas'
  | 'roi'
  // Phần 6. Hoàn, Hủy và Thất thoát
  | 'cancelled_orders'
  | 'returned_orders'
  | 'refund_amount'
  | 'cancellation_rate'
  | 'return_refund_rate'
  | 'revenue_leakage'
  // Phần 7. Khách hàng
  | 'customer_id'
  | 'new_customers'
  | 'returning_customers'
  | 'purchase_frequency'
  | 'total_spend'
  // Phần 8. KPI Thương mại điện tử
  | 'total_orders'
  | 'units_sold'
  | 'aov'
  | 'conversion_rate'
  | 'profit_margin'
  // Phần 9. Thời gian
  | 'date_day'
  | 'date_week'
  | 'date_month'
  | 'date_quarter'
  // Phần 10. Sàn và Kênh bán
  | 'platform'
  | 'sales_channel'
  // Phần 11. Tồn kho
  | 'inventory'
  | 'beginning_inventory'
  | 'ending_inventory'
  | 'stock_in';

export type NormalizedOrderStatus =
  | 'DELIVERED' // Đã giao / Hoàn tất -> Tính vào Doanh thu thuần
  | 'CANCELLED' // Đã hủy -> Thất thoát do hủy đơn
  | 'REFUNDED' // Đã hoàn tiền / Trả hàng -> Thất thoát do hoàn trả
  | 'PROCESSING' // Đang xử lý / Đang giao -> Doanh thu dự kiến
  | 'FAILED_DELIVERY'; // Giao thất bại

export interface DataDictionaryDefinition {
  id: number;
  section: string;
  sectionId: number;
  standardKey: StandardColumnKey;
  vietnameseName: string;
  englishName?: string;
  businessMeaning: string;
  aliases: string[];
  abbreviations?: string[];
  dataType: 'Text' | 'Date' | 'Category' | 'Number' | 'Boolean';
  unit: string;
  formula?: string;
  relationships: string;
  notToBeConfusedWith: string[];
  validationRule: string;
  sampleValues?: string[];
}

// ============================================================================
// 1. TỪ ĐIỂN 53 KHÁI NIỆM CHUẨN TMĐT THEO 11 PHÂN HỆ
// ============================================================================
export const VIETNAMESE_DATA_DICTIONARY: DataDictionaryDefinition[] = [
  // --------------------------------------------------------------------------
  // PHẦN 1. ĐƠN HÀNG
  // --------------------------------------------------------------------------
  {
    id: 1,
    section: 'Phần 1. Đơn Hàng',
    sectionId: 1,
    standardKey: 'order_id',
    vietnameseName: 'Mã đơn hàng',
    englishName: 'Order ID / Order Code / Transaction ID',
    businessMeaning: 'Mã định danh dùng để xác định duy nhất một đơn hàng trong hệ thống.',
    aliases: ['madonhang', 'madon', 'iddonhang', 'iddon', 'orderid', 'ordercode', 'ordernumber', 'magiaodich', 'transactionid', 'madonmuahang', 'orderno', 'ma_don_hang'],
    abbreviations: ['ĐH', 'Order ID', 'Mã ĐH'],
    dataType: 'Text',
    unit: '—',
    relationships: 'Khóa chính của giao dịch đơn hàng. Có thể xuất hiện nhiều dòng nếu 1 đơn có nhiều sản phẩm.',
    notToBeConfusedWith: ['Mã sản phẩm', 'SKU', 'Mã khách hàng', 'Mã vận chuyển'],
    validationRule: 'Bắt buộc là chuỗi ký tự, không được để trống. Không mặc định số dòng = số đơn hàng.',
    sampleValues: ['DH-2026-0901', 'SHOPEE_8829104', 'TK_839201948'],
  },
  {
    id: 2,
    section: 'Phần 1. Đơn Hàng',
    sectionId: 1,
    standardKey: 'order_date',
    vietnameseName: 'Ngày đặt hàng',
    englishName: 'Order Date / Created Date / Date Created',
    businessMeaning: 'Thời điểm khách hàng tạo hoặc đặt đơn hàng trên nền tảng.',
    aliases: ['ngaydathang', 'ngaytaodon', 'ngaymuahang', 'ngayphatsinhdon', 'orderdate', 'createddate', 'datecreated', 'thoigiandathang', 'ngaydat', 'ngayphatsinh', 'ngaymua'],
    abbreviations: ['Ngày đặt', 'Order Date'],
    dataType: 'Date',
    unit: 'Ngày (DD/MM/YYYY)',
    relationships: 'Dùng để tổng hợp chuỗi thời gian ngày/tuần/tháng/quý.',
    notToBeConfusedWith: ['Ngày giao hàng', 'Ngày hoàn hàng', 'Ngày thanh toán', 'Ngày cập nhật trạng thái'],
    validationRule: 'Chuẩn hóa định dạng DD/MM/YYYY cố định.',
    sampleValues: ['18/09/2026', '2026-09-18 14:20:00'],
  },
  {
    id: 3,
    section: 'Phần 1. Đơn Hàng',
    sectionId: 1,
    standardKey: 'order_status',
    vietnameseName: 'Trạng thái đơn hàng',
    englishName: 'Order Status / Delivery Status',
    businessMeaning: 'Trạng thái xử lý hiện tại hoặc trạng thái cuối cùng của đơn hàng.',
    aliases: ['trangthaidonhang', 'trangthaidon', 'orderstatus', 'status', 'tinhtrangdon', 'tinhtranggiaohang', 'trangthai', 'tinhtrang'],
    abbreviations: ['Status', 'Trạng thái'],
    dataType: 'Category',
    unit: '—',
    relationships: 'Quyết định xem đơn hàng có được tính vào Doanh thu thuần thực thu hay Thất thoát.',
    notToBeConfusedWith: ['Trạng thái thanh toán', 'Trạng thái sản phẩm (Active/Inactive)'],
    validationRule: 'Phân loại bắt buộc: Chờ xử lý, Đang xử lý, Đang giao, Đã giao, Đã hoàn thành, Đã hủy, Đã hoàn tiền, Giao thất bại, Đang hoàn hàng.',
    sampleValues: ['Đã giao', 'Đã hủy', 'Đã hoàn tiền', 'Đang xử lý', 'Giao không thành công'],
  },

  // --------------------------------------------------------------------------
  // PHẦN 2. SẢN PHẨM
  // --------------------------------------------------------------------------
  {
    id: 4,
    section: 'Phần 2. Sản Phẩm',
    sectionId: 2,
    standardKey: 'product_id',
    vietnameseName: 'Mã sản phẩm',
    englishName: 'Product ID / Product Code / Item ID',
    businessMeaning: 'Mã dùng để nhận diện một sản phẩm hoặc biến thể sản phẩm.',
    aliases: ['masanpham', 'masp', 'productid', 'productcode', 'idsanpham', 'mahang', 'itemid', 'ma_san_pham'],
    abbreviations: ['Mã SP', 'Product ID'],
    dataType: 'Text',
    unit: '—',
    relationships: 'Dùng để liên kết dữ liệu giữa các bảng Sản phẩm, Tồn kho, Bán hàng.',
    notToBeConfusedWith: ['Mã đơn hàng', 'Mã khách hàng'],
    validationRule: 'Chuỗi văn bản mã hóa sản phẩm.',
    sampleValues: ['SP-001', 'ITEM-8823', 'PROD_V2'],
  },
  {
    id: 5,
    section: 'Phần 2. Sản Phẩm',
    sectionId: 2,
    standardKey: 'sku',
    vietnameseName: 'SKU (Đơn vị lưu kho)',
    englishName: 'Stock Keeping Unit / Product SKU',
    businessMeaning: 'Mã quản lý một đơn vị hàng tồn kho hoặc một biến thể sản phẩm (màu sắc, size).',
    aliases: ['sku', 'masku', 'stockkeepingunit', 'productsku', 'skusanpham', 'sku_id', 'skumasp'],
    abbreviations: ['SKU'],
    dataType: 'Text',
    unit: '—',
    relationships: 'Quản lý chính xác ở cấp biến thể hàng hóa.',
    notToBeConfusedWith: ['Mã sản phẩm cha cấp cao nhất nếu có nhiều biến thể'],
    validationRule: 'Chuỗi định danh duy nhất cho từng phân loại mặt hàng.',
    sampleValues: ['TSHIRT-BLK-XL', 'SF-2S-OAK-01', 'LIP-RED-02'],
  },
  {
    id: 6,
    section: 'Phần 2. Sản Phẩm',
    sectionId: 2,
    standardKey: 'product_name',
    vietnameseName: 'Tên sản phẩm',
    englishName: 'Product Name / Product Title',
    businessMeaning: 'Tên được sử dụng để nhận diện hoặc hiển thị sản phẩm bán.',
    aliases: ['tensanpham', 'tensp', 'productname', 'tenhang', 'tenmathang', 'tenhanghoa', 'tensanphamban', 'producttitle'],
    abbreviations: ['Tên SP', 'Product Name'],
    dataType: 'Text',
    unit: '—',
    relationships: 'Dùng để xếp hạng Pareto 80/20, Top sản phẩm bán chạy.',
    notToBeConfusedWith: ['Lượt view sản phẩm', 'Tiêu đề phiên Live', 'Tên danh mục'],
    validationRule: 'Giữ nguyên chuỗi văn bản mô tả mặt hàng.',
    sampleValues: ['Ghế sofa vải bố 2 chỗ ngồi', 'Áo Polo thể thao Quick-Dry', 'Son kem lì dưỡng ẩm'],
  },
  {
    id: 7,
    section: 'Phần 2. Sản Phẩm',
    sectionId: 2,
    standardKey: 'category',
    vietnameseName: 'Ngành hàng / Danh mục',
    englishName: 'Category / Product Category',
    businessMeaning: 'Nhóm phân loại mà sản phẩm thuộc về (Mỹ phẩm, Thời trang, Điện tử, Gia dụng...).',
    aliases: ['nganhhang', 'danhmuc', 'category', 'productcategory', 'nhomsanpham', 'nhomsp', 'loaisanpham', 'nhomhang', 'nganh_hang'],
    abbreviations: ['Ngành hàng', 'Category'],
    dataType: 'Category',
    unit: '—',
    relationships: 'Thuộc tính phân loại danh mục sản phẩm.',
    notToBeConfusedWith: ['Doanh thu', 'Tên sản phẩm'],
    validationRule: 'Phân loại về các nhãn danh mục chuẩn.',
    sampleValues: ['Nội thất & Gia dụng', 'Thời trang nam', 'Mỹ phẩm & Chăm sóc da'],
  },
  {
    id: 8,
    section: 'Phần 2. Sản Phẩm',
    sectionId: 2,
    standardKey: 'quantity',
    vietnameseName: 'Số lượng sản phẩm',
    englishName: 'Quantity / Qty / Units Sold',
    businessMeaning: 'Số đơn vị sản phẩm được ghi nhận trong một dòng dữ liệu hoặc một giao dịch.',
    aliases: ['soluong', 'sl', 'qty', 'quantity', 'unitssold', 'sosp', 'sosanpham', 'quantitysold', 'soluongban', 'soluongdat'],
    abbreviations: ['SL', 'Qty', 'Số SP'],
    dataType: 'Number',
    unit: 'Sản phẩm/đơn vị',
    relationships: 'Số đơn vị hàng bán ra. 1 đơn có thể mua 3 sản phẩm (Số đơn = 1, Số lượng = 3).',
    notToBeConfusedWith: ['Số đơn hàng (Total Orders)'],
    validationRule: 'Số nguyên không âm (Integer >= 0).',
    sampleValues: ['1', '5', '12'],
  },

  // --------------------------------------------------------------------------
  // PHẦN 3. GIÁ VÀ DOANH THU
  // --------------------------------------------------------------------------
  {
    id: 9,
    section: 'Phần 3. Giá & Doanh Thu',
    sectionId: 3,
    standardKey: 'unit_price',
    vietnameseName: 'Đơn giá',
    englishName: 'Unit Price / Selling Price / Price',
    businessMeaning: 'Giá của một đơn vị sản phẩm được ghi nhận trong giao dịch.',
    aliases: ['dongia', 'giaban', 'giasanpham', 'unitprice', 'sellingprice', 'price', 'gianiemyet', 'don_gia', 'gia_ban'],
    abbreviations: ['Đơn giá', 'Price'],
    dataType: 'Number',
    unit: 'VNĐ',
    relationships: 'Đơn giá × Số lượng = Doanh thu trước giảm giá.',
    notToBeConfusedWith: ['Giá vốn (COGS)', 'Tổng giá trị đơn hàng', 'Doanh thu thuần'],
    validationRule: 'Số thực dương (Float > 0).',
    sampleValues: ['250.000 đ', '1,500,000', '399000'],
  },
  {
    id: 10,
    section: 'Phần 3. Giá & Doanh Thu',
    sectionId: 3,
    standardKey: 'cogs',
    vietnameseName: 'Giá vốn (COGS)',
    englishName: 'Cost of Goods Sold / Cost / Cost Price',
    businessMeaning: 'Chi phí trực tiếp liên quan đến việc sản xuất hoặc nhập sản phẩm được bán.',
    aliases: ['giavon', 'cogs', 'costofgoodssold', 'cost', 'gianhap', 'gianhaphang', 'chiphisanpham', 'gia_von'],
    abbreviations: ['Giá vốn', 'COGS', 'Cost'],
    dataType: 'Number',
    unit: 'VNĐ/sản phẩm',
    relationships: 'Lợi nhuận gộp = Doanh thu sau giảm giá − (Giá vốn × Số lượng).',
    notToBeConfusedWith: ['Giá bán', 'Doanh thu', 'Chi phí quảng cáo'],
    validationRule: 'Tuyệt đối không nhầm lẫn giữa giá vốn và đơn giá.',
    sampleValues: ['120.000 đ', '800,000', '150000'],
  },
  {
    id: 11,
    section: 'Phần 3. Giá & Doanh Thu',
    sectionId: 3,
    standardKey: 'discount',
    vietnameseName: 'Giảm giá',
    englishName: 'Discount / Discount Amount / Voucher',
    businessMeaning: 'Khoản tiền được giảm khỏi giá trị bán hàng theo chương trình giảm giá, voucher.',
    aliases: ['giamgia', 'discount', 'discountamount', 'tiengiam', 'khoangiam', 'chietkhau', 'giatrigiamgia', 'voucher', 'vouchergiam', 'giam_gia'],
    abbreviations: ['KM', 'Giảm giá', 'Discount'],
    dataType: 'Number',
    unit: 'VNĐ',
    relationships: 'Doanh thu sau giảm = Doanh thu trước giảm − Giảm giá.',
    notToBeConfusedWith: ['Hoàn tiền (Refund) - Hoàn tiền xảy ra sau giao dịch, giảm giá xảy ra khi đặt hàng'],
    validationRule: 'Số thực không âm (Float >= 0).',
    sampleValues: ['50.000 đ', '0', '120000'],
  },
  {
    id: 12,
    section: 'Phần 3. Giá & Doanh Thu',
    sectionId: 3,
    standardKey: 'gross_revenue',
    vietnameseName: 'Doanh thu trước giảm giá',
    englishName: 'Gross Sales / Gross Revenue / GMV Placed',
    businessMeaning: 'Tổng giá trị sản phẩm trước khi trừ các khoản giảm giá.',
    aliases: ['doanhthutruocgiamgia', 'doanhthutruocgiam', 'grosssales', 'grossrevenue', 'doanhsogop', 'gmvtruocgiamgia', 'gmvtruocgiam', 'tongtienhangtruocgiam', 'giatrihanghoatruocgiam', 'gmvplaced', 'doanhthugop'],
    abbreviations: ['DT Gộp', 'Gross Sales'],
    dataType: 'Number',
    unit: 'VNĐ',
    formula: 'Số lượng × Đơn giá',
    relationships: 'Tổng quy mô giao dịch đặt hàng ban đầu.',
    notToBeConfusedWith: ['Doanh thu thuần sau giảm giá', 'Lợi nhuận'],
    validationRule: 'Số thực không âm (Float >= 0).',
    sampleValues: ['50.000.000 đ', '125,000,000'],
  },
  {
    id: 13,
    section: 'Phần 3. Giá & Doanh Thu',
    sectionId: 3,
    standardKey: 'net_revenue',
    vietnameseName: 'Doanh thu sau giảm giá',
    englishName: 'Net Sales / Net Revenue / GMV Paid',
    businessMeaning: 'Giá trị hàng hóa sau khi trừ khoản giảm giá được xác định trong dữ liệu.',
    aliases: ['doanhthusaugiamgia', 'doanhthusaugiam', 'netsales', 'netrevenue', 'doanhthusauchietkhau', 'doanhsosaugiam', 'tienhangsaugiamgia', 'gmvpaid', 'doanhthuthuan', 'doanhthuthucte'],
    abbreviations: ['DT Sau Giảm', 'Net Sales', 'DT Thuần'],
    dataType: 'Number',
    unit: 'VNĐ',
    formula: 'Doanh thu trước giảm giá − Giảm giá',
    relationships: 'Không tự động trừ phí sàn, phí ship, chi phí ads, giá vốn, tiền hoàn hàng nếu lưu riêng.',
    notToBeConfusedWith: ['Lợi nhuận gộp', 'Dòng tiền thực thu'],
    validationRule: 'Số thực không âm (Float >= 0).',
    sampleValues: ['45.000.000 đ', '118,500,000'],
  },
  {
    id: 14,
    section: 'Phần 3. Giá & Doanh Thu',
    sectionId: 3,
    standardKey: 'revenue',
    vietnameseName: 'Doanh thu',
    englishName: 'Revenue / Sales Revenue / Sales',
    businessMeaning: 'Giá trị tiền phát sinh từ hoạt động bán hàng trong phạm vi dữ liệu.',
    aliases: ['doanhthu', 'revenue', 'salesrevenue', 'sales', 'doanhso', 'tongdoanhthu', 'tienbanhang', 'dt'],
    abbreviations: ['DT', 'Revenue', 'Sales'],
    dataType: 'Number',
    unit: 'VNĐ',
    relationships: 'Cần kiểm tra: Trước hay sau giảm? Có gồm đơn hủy/hoàn không? Có gồm thuế/phí ship không?',
    notToBeConfusedWith: ['Lợi nhuận', 'Dòng tiền thực nhận (Cashflow)', 'GMV'],
    validationRule: 'Nếu không xác định được rõ phạm vi, không được tự ý gán nghĩa bừa bãi.',
    sampleValues: ['350.000.000 đ', '89,000,000'],
  },
  {
    id: 15,
    section: 'Phần 3. Giá & Doanh Thu',
    sectionId: 3,
    standardKey: 'gmv',
    vietnameseName: 'GMV (Tổng giá trị giao dịch)',
    englishName: 'Gross Merchandise Value (GMV)',
    businessMeaning: 'Tổng giá trị hàng hóa được giao dịch trên nền tảng theo định nghĩa của nền tảng báo cáo.',
    aliases: ['gmv', 'grossmerchandisevalue', 'tonggiatrihanghoa', 'tonggiatrigiaodich', 'tonggiatrihangban', 'giatrigiaodichgop'],
    abbreviations: ['GMV'],
    dataType: 'Number',
    unit: 'VNĐ',
    relationships: 'GMV phụ thuộc định nghĩa nền tảng (Shopee/TikTok). GMV không mặc định bằng doanh thu kế toán.',
    notToBeConfusedWith: ['Lợi nhuận', 'Doanh thu thuần kế toán'],
    validationRule: 'Kiểm tra định nghĩa nguồn dữ liệu sàn.',
    sampleValues: ['500.000.000 đ', '1,200,000,000'],
  },

  // --------------------------------------------------------------------------
  // PHẦN 4. CHI PHÍ
  // --------------------------------------------------------------------------
  {
    id: 16,
    section: 'Phần 4. Chi Phí',
    sectionId: 4,
    standardKey: 'ad_spend',
    vietnameseName: 'Chi phí quảng cáo (Ad Spend)',
    englishName: 'Ad Spend / Advertising Cost / Ads Cost',
    businessMeaning: 'Số tiền thực tế đã chi cho hoạt động quảng cáo trong phạm vi dữ liệu.',
    aliases: ['chiphiquangcao', 'adspend', 'advertisingcost', 'adscost', 'advertisingspend', 'tienquangcao', 'ngansachdachi', 'chiphiads', 'ad_cost'],
    abbreviations: ['CP QC', 'Ad Spend', 'Ads Cost'],
    dataType: 'Number',
    unit: 'VNĐ',
    relationships: 'Dùng để tính ROAS = Doanh thu quảng cáo / Chi phí quảng cáo.',
    notToBeConfusedWith: ['Ngân sách quảng cáo (Ad Budget) - Ngân sách là dự kiến, Ad Spend là thực chi'],
    validationRule: 'Chi phí thực chi, không được nhầm với ngân sách trần.',
    sampleValues: ['15.000.000 đ', '2,500,000'],
  },
  {
    id: 17,
    section: 'Phần 4. Chi Phí',
    sectionId: 4,
    standardKey: 'ad_budget',
    vietnameseName: 'Ngân sách quảng cáo (Ad Budget)',
    englishName: 'Ad Budget / Advertising Budget / Budget',
    businessMeaning: 'Số tiền dự kiến hoặc giới hạn được phân bổ cho quảng cáo.',
    aliases: ['ngansachquangcao', 'adbudget', 'advertisingbudget', 'budget', 'ngansachqc', 'hanmucquangcao'],
    abbreviations: ['Ngân sách QC', 'Budget'],
    dataType: 'Number',
    unit: 'VNĐ',
    relationships: 'Ngân sách quảng cáo không nhất thiết bằng chi phí quảng cáo thực tế.',
    notToBeConfusedWith: ['Chi phí quảng cáo thực chi (Ad Spend)'],
    validationRule: 'Giới hạn trần phân bổ, không dùng làm mẫu số ROAS thực tế.',
    sampleValues: ['20.000.000 đ', '50,000,000'],
  },
  {
    id: 18,
    section: 'Phần 4. Chi Phí',
    sectionId: 4,
    standardKey: 'platform_fee',
    vietnameseName: 'Phí sàn',
    englishName: 'Platform Fee / Marketplace Fee / Commission',
    businessMeaning: 'Khoản phí nền tảng thương mại điện tử thu từ người bán theo chính sách.',
    aliases: ['phisan', 'platformfee', 'marketplacefee', 'commission', 'phihoahong', 'phinentang', 'phigiaodich', 'phisan_tmdt'],
    abbreviations: ['Phí sàn', 'Commission'],
    dataType: 'Number',
    unit: 'VNĐ',
    relationships: 'Phí cố định + phí dịch vụ + phí thanh toán của sàn TMĐT.',
    notToBeConfusedWith: ['Chi phí quảng cáo', 'Phí vận chuyển', 'Giá vốn'],
    validationRule: 'Số thực không âm (Float >= 0).',
    sampleValues: ['4.500.000 đ', '12,300,000'],
  },
  {
    id: 19,
    section: 'Phần 4. Chi Phí',
    sectionId: 4,
    standardKey: 'shipping_fee',
    vietnameseName: 'Phí vận chuyển',
    englishName: 'Shipping Fee / Delivery Fee',
    businessMeaning: 'Chi phí liên quan đến việc vận chuyển đơn hàng.',
    aliases: ['phivanchuyen', 'shippingfee', 'deliveryfee', 'phiship', 'phigiaohang', 'chiphivanchuyen', 'tienship'],
    abbreviations: ['Phí ship', 'Shipping Fee'],
    dataType: 'Number',
    unit: 'VNĐ',
    relationships: 'Xác định rõ là phí người bán chịu, khách hàng trả hay tổng phí vận chuyển.',
    notToBeConfusedWith: ['Không được tự động xem toàn bộ phí ship là chi phí của người bán'],
    validationRule: 'Số thực không âm (Float >= 0).',
    sampleValues: ['35.000 đ', '1,250,000'],
  },
  {
    id: 20,
    section: 'Phần 4. Chi Phí',
    sectionId: 4,
    standardKey: 'total_expenses',
    vietnameseName: 'Chi phí / Tổng chi phí',
    englishName: 'Cost / Expenses / Total Expenses',
    businessMeaning: 'Khoản tiền phát sinh để vận hành hoạt động kinh doanh (Giá vốn, Ads, Phí sàn, Ship, Vận hành...).',
    aliases: ['chiphi', 'cost', 'expenses', 'tongchiphi', 'expense', 'tongcp', 'cp'],
    abbreviations: ['CP', 'Chi phí', 'Expenses'],
    dataType: 'Number',
    unit: 'VNĐ',
    relationships: 'Bao gồm Giá vốn + Chi phí ads + Phí sàn + Vận chuyển + Vận hành.',
    notToBeConfusedWith: ['Giá vốn (Giá vốn chỉ là 1 phần trong tổng chi phí)'],
    validationRule: 'Không được đồng nhất "chi phí" với "giá vốn".',
    sampleValues: ['85.000.000 đ', '240,000,000'],
  },

  // --------------------------------------------------------------------------
  // PHẦN 5. QUẢNG CÁO VÀ MARKETING
  // --------------------------------------------------------------------------
  {
    id: 21,
    section: 'Phần 5. Marketing & Quảng Cáo',
    sectionId: 5,
    standardKey: 'impressions',
    vietnameseName: 'Lượt hiển thị',
    englishName: 'Impressions / Views',
    businessMeaning: 'Số lần nội dung hoặc quảng cáo được hiển thị đến mắt người dùng.',
    aliases: ['luothienthi', 'impressions', 'impression', 'views', 'sohienthi', 'luothienthiads'],
    abbreviations: ['Hiển thị', 'Impressions'],
    dataType: 'Number',
    unit: 'Lượt',
    relationships: 'Dùng để tính CTR = Clicks / Impressions và CPM = (Cost / Impressions) × 1000.',
    notToBeConfusedWith: ['Số người tiếp cận duy nhất (Reach)', 'Lượt nhấp (Clicks)'],
    validationRule: 'Số nguyên không âm (Integer >= 0).',
    sampleValues: ['120,500', '45000'],
  },
  {
    id: 22,
    section: 'Phần 5. Marketing & Quảng Cáo',
    sectionId: 5,
    standardKey: 'clicks',
    vietnameseName: 'Lượt nhấp',
    englishName: 'Clicks / Total Clicks',
    businessMeaning: 'Số lần người dùng nhấp vào quảng cáo hoặc sản phẩm/nội dung.',
    aliases: ['luotnhap', 'clicks', 'click', 'soclick', 'luotclick', 'soluotnhap'],
    abbreviations: ['Clicks', 'Lượt nhấp'],
    dataType: 'Number',
    unit: 'Lượt',
    relationships: 'Dùng để tính CTR = Clicks / Impressions và CPC = Chi phí / Clicks.',
    notToBeConfusedWith: ['Lượt hiển thị (1 quảng cáo có thể có nhiều hiển thị nhưng ít nhấp)'],
    validationRule: 'Số nguyên không âm (Integer >= 0).',
    sampleValues: ['3,450', '820'],
  },
  {
    id: 23,
    section: 'Phần 5. Marketing & Quảng Cáo',
    sectionId: 5,
    standardKey: 'ctr',
    vietnameseName: 'CTR (Tỷ lệ nhấp)',
    englishName: 'Click Through Rate (CTR)',
    businessMeaning: 'Tỷ lệ lượt nhấp trên tổng lượt hiển thị nội dung/quảng cáo.',
    aliases: ['ctr', 'clickthroughrate', 'tylenhap', 'tylechuyendoi_click'],
    abbreviations: ['CTR'],
    dataType: 'Number',
    unit: '%',
    formula: '(Lượt nhấp / Lượt hiển thị) × 100%',
    relationships: 'Đo lường độ hấp dẫn của hình ảnh, tiêu đề, giá bán trên quảng cáo.',
    notToBeConfusedWith: ['CR (Conversion Rate - Tỷ lệ chuyển đổi ra đơn hàng)'],
    validationRule: 'Tỷ lệ phần trăm từ 0% đến 100%.',
    sampleValues: ['2.85%', '0.034'],
  },
  {
    id: 24,
    section: 'Phần 5. Marketing & Quảng Cáo',
    sectionId: 5,
    standardKey: 'cpc',
    vietnameseName: 'CPC (Chi phí mỗi lượt nhấp)',
    englishName: 'Cost Per Click (CPC)',
    businessMeaning: 'Chi phí trung bình phải trả cho mỗi lượt nhấp vào quảng cáo.',
    aliases: ['cpc', 'costperclick', 'chiphimoiluotnhap', 'giaclick'],
    abbreviations: ['CPC'],
    dataType: 'Number',
    unit: 'VNĐ/click',
    formula: 'Chi phí quảng cáo / Lượt nhấp',
    relationships: 'Đo lường mức độ cạnh tranh của từ khóa và vị trí hiển thị.',
    notToBeConfusedWith: ['CPM', 'CPA'],
    validationRule: 'Số thực dương (Float > 0).',
    sampleValues: ['1.250 đ', '850'],
  },
  {
    id: 25,
    section: 'Phần 5. Marketing & Quảng Cáo',
    sectionId: 5,
    standardKey: 'cpm',
    vietnameseName: 'CPM (Chi phí mỗi 1.000 lượt hiển thị)',
    englishName: 'Cost Per Mille (CPM)',
    businessMeaning: 'Chi phí quảng cáo trung bình cho 1.000 lượt hiển thị.',
    aliases: ['cpm', 'costpermille', 'costperthousand', 'chiphimoinganhienthi'],
    abbreviations: ['CPM'],
    dataType: 'Number',
    unit: 'VNĐ/1.000 hiển thị',
    formula: '(Chi phí quảng cáo / Lượt hiển thị) × 1.000',
    relationships: 'Đo lường chi phí nhận diện thương hiệu.',
    notToBeConfusedWith: ['CPC'],
    validationRule: 'Số thực dương (Float > 0).',
    sampleValues: ['35.000 đ', '42,000'],
  },
  {
    id: 26,
    section: 'Phần 5. Marketing & Quảng Cáo',
    sectionId: 5,
    standardKey: 'roas',
    vietnameseName: 'ROAS (Hiệu quả chi phí quảng cáo)',
    englishName: 'Return On Ad Spend (ROAS)',
    businessMeaning: 'Chỉ số đo lường doanh thu tạo ra trên mỗi đồng chi phí quảng cáo.',
    aliases: ['roas', 'returnonadspend', 'hieuquangquangcao', 'doanhthutrendauquangcao'],
    abbreviations: ['ROAS'],
    dataType: 'Number',
    unit: 'Lần (Hệ số)',
    formula: 'Doanh thu quy cho quảng cáo / Chi phí quảng cáo',
    relationships: 'Ví dụ: Ads = 1 triệu, DT Ads = 5 triệu -> ROAS = 5.0.',
    notToBeConfusedWith: ['ROI (ROI đo lường tỷ suất lợi nhuận trên vốn đầu tư)'],
    validationRule: 'Tuyệt đối không đảo ngược mẫu số (Không được lấy Chi phí / Doanh thu).',
    sampleValues: ['4.52', '6.18', '3.2'],
  },
  {
    id: 27,
    section: 'Phần 5. Marketing & Quảng Cáo',
    sectionId: 5,
    standardKey: 'roi',
    vietnameseName: 'ROI (Tỷ suất hoàn vốn đầu tư)',
    englishName: 'Return On Investment (ROI)',
    businessMeaning: 'Chỉ số đo lường mức sinh lời của một khoản đầu tư.',
    aliases: ['roi', 'returnoninvestment', 'tysuathoanvon', 'hieuquadaotu'],
    abbreviations: ['ROI'],
    dataType: 'Number',
    unit: '% hoặc Lần',
    formula: '(Lợi nhuận từ đầu tư − Chi phí đầu tư) / Chi phí đầu tư',
    relationships: 'Đo lường hiệu quả tài chính tổng thể của dự án/kênh.',
    notToBeConfusedWith: ['ROAS (ROAS tập trung doanh thu ads, ROI tập trung lợi nhuận đầu tư)'],
    validationRule: 'ROI và ROAS không phải là cùng một chỉ số.',
    sampleValues: ['120%', '0.45'],
  },

  // --------------------------------------------------------------------------
  // PHẦN 6. HOÀN, HỦY VÀ THẤT THOÁT
  // --------------------------------------------------------------------------
  {
    id: 28,
    section: 'Phần 6. Hoàn, Hủy & Thất Thoát',
    sectionId: 6,
    standardKey: 'cancelled_orders',
    vietnameseName: 'Đơn hủy',
    englishName: 'Cancelled Orders / Canceled Orders',
    businessMeaning: 'Đơn hàng không hoàn tất giao dịch do bị người mua hoặc hệ thống hủy.',
    aliases: ['donhuy', 'cancelledorder', 'canceledorder', 'cancelled', 'donbihuy', 'huydon', 'sodonhuy'],
    abbreviations: ['Đơn hủy', 'Cancelled'],
    dataType: 'Number',
    unit: 'Đơn hàng',
    relationships: 'Dùng để tính Tỷ lệ hủy đơn = Số đơn hủy / Tổng số đơn đặt.',
    notToBeConfusedWith: ['Đơn hoàn hàng (Đơn hủy xảy ra trước khi giao, đơn hoàn xảy ra khi đã giao)'],
    validationRule: 'Đơn hủy không được cộng vào Doanh thu thuần thực nhận.',
    sampleValues: ['18', '42'],
  },
  {
    id: 29,
    section: 'Phần 6. Hoàn, Hủy & Thất Thoát',
    sectionId: 6,
    standardKey: 'returned_orders',
    vietnameseName: 'Đơn hoàn hàng',
    englishName: 'Returned Orders / Return Orders',
    businessMeaning: 'Đơn hàng hoặc sản phẩm được khách hàng trả lại theo quy trình của nền tảng.',
    aliases: ['donhoan', 'returnedorder', 'returnorder', 'dontrahang', 'donhoanhang', 'hangtralai', 'sodonhoan'],
    abbreviations: ['Đơn hoàn', 'Returned'],
    dataType: 'Number',
    unit: 'Đơn hàng',
    relationships: 'Phát sinh chi phí xử lý hoàn hàng, đóng gói lại và rủi ro hỏng hóc.',
    notToBeConfusedWith: ['Đơn hủy'],
    validationRule: 'Cần bóc tách độc lập với đơn hủy trước khi giao.',
    sampleValues: ['8', '15'],
  },
  {
    id: 30,
    section: 'Phần 6. Hoàn, Hủy & Thất Thoát',
    sectionId: 6,
    standardKey: 'refund_amount',
    vietnameseName: 'Hoàn tiền',
    englishName: 'Refund / Refund Amount',
    businessMeaning: 'Khoản tiền được trả lại cho khách hàng do trả hàng, hủy đơn hoặc khiếu nại.',
    aliases: ['hoantien', 'refund', 'refundamount', 'tienrefund', 'tientrakhach', 'tienhoanchokhach', 'sotienhoan'],
    abbreviations: ['Hoàn tiền', 'Refund'],
    dataType: 'Number',
    unit: 'VNĐ',
    relationships: 'Khoản tiền hoàn lại sau giao dịch.',
    notToBeConfusedWith: ['Giảm giá (Discount - xảy ra khi tạo đơn, hoàn tiền xảy ra sau giao dịch)'],
    validationRule: 'Số thực không âm (Float >= 0).',
    sampleValues: ['2.450.000 đ', '650,000'],
  },
  {
    id: 31,
    section: 'Phần 6. Hoàn, Hủy & Thất Thoát',
    sectionId: 6,
    standardKey: 'cancellation_rate',
    vietnameseName: 'Tỷ lệ hủy đơn',
    englishName: 'Cancellation Rate',
    businessMeaning: 'Tỷ lệ số đơn hàng bị hủy trên tổng số đơn hàng đặt phát sinh.',
    aliases: ['tylehuydon', 'cancellationrate', 'tylehuy', 'cancelrate'],
    abbreviations: ['Tỷ lệ hủy', 'Cancel Rate'],
    dataType: 'Number',
    unit: '%',
    formula: '(Số đơn hủy / Tổng số đơn) × 100%',
    relationships: 'Đo lường mức độ ổn định của đơn hàng và chất lượng xác nhận đơn.',
    notToBeConfusedWith: ['Tỷ lệ hoàn tiền (Refund Rate)'],
    validationRule: 'Tỷ lệ phần trăm từ 0% đến 100%.',
    sampleValues: ['5.2%', '0.048'],
  },
  {
    id: 32,
    section: 'Phần 6. Hoàn, Hủy & Thất Thoát',
    sectionId: 6,
    standardKey: 'return_refund_rate',
    vietnameseName: 'Tỷ lệ hoàn hàng',
    englishName: 'Return Rate / Refund Rate',
    businessMeaning: 'Tỷ lệ đơn hàng hoặc sản phẩm bị hoàn trả trên tổng số đơn giao.',
    aliases: ['tylehoanhang', 'tyletrahang', 'returnrate', 'refundrate', 'tylereturn', 'tylerefund'],
    abbreviations: ['Tỷ lệ hoàn', 'Return Rate'],
    dataType: 'Number',
    unit: '%',
    formula: '(Số đơn hoàn / Tổng số đơn giao) × 100%',
    relationships: 'Đo lường chất lượng sản phẩm thực tế so với mô tả.',
    notToBeConfusedWith: ['Tỷ lệ hủy đơn'],
    validationRule: 'Return Rate và Refund Rate có thể khác nhau, cần kiểm tra nguồn dữ liệu.',
    sampleValues: ['2.1%', '0.019'],
  },
  {
    id: 33,
    section: 'Phần 6. Hoàn, Hủy & Thất Thoát',
    sectionId: 6,
    standardKey: 'revenue_leakage',
    vietnameseName: 'Doanh thu thất thoát',
    englishName: 'Revenue Leakage / Sales Leakage',
    businessMeaning: 'Giá trị doanh thu hoặc kinh tế bị mất do đơn hủy, hoàn hàng, giao thất bại, sai lệch.',
    aliases: ['doanhthuthatthoat', 'revenueleakage', 'salesleakage', 'leakage', 'doanhthumat', 'tienthatthoat', 'thatthoatdoanhthu'],
    abbreviations: ['Thất thoát DT', 'Leakage'],
    dataType: 'Number',
    unit: 'VNĐ',
    relationships: 'Tổng giá trị kinh tế bị rò rỉ cần khắc phục ngay.',
    notToBeConfusedWith: ['Chi phí hoạt động thông thường'],
    validationRule: 'Không được tự động xem mọi đơn hủy là thất thoát nếu hệ thống không ghi nhận.',
    sampleValues: ['8.500.000 đ', '19,200,000'],
  },

  // --------------------------------------------------------------------------
  // PHẦN 7. KHÁCH HÀNG
  // --------------------------------------------------------------------------
  {
    id: 34,
    section: 'Phần 7. Khách Hàng',
    sectionId: 7,
    standardKey: 'customer_id',
    vietnameseName: 'Mã khách hàng',
    englishName: 'Customer ID / Customer Code / User ID',
    businessMeaning: 'Mã dùng để nhận diện duy nhất khách hàng trong dữ liệu.',
    aliases: ['makhachhang', 'customerid', 'customercode', 'idkhach', 'manguoimua', 'userid', 'makh', 'khachhang_id'],
    abbreviations: ['Mã KH', 'Customer ID'],
    dataType: 'Text',
    unit: '—',
    relationships: 'Dùng để tính Tần suất mua lại (Repeat Rate), LTV, Cohort retention.',
    notToBeConfusedWith: ['Mã đơn hàng (1 khách hàng có thể có nhiều đơn hàng)'],
    validationRule: 'Chuỗi văn bản mã hóa định danh người mua.',
    sampleValues: ['CUST-99201', 'USER_88214'],
  },
  {
    id: 35,
    section: 'Phần 7. Khách Hàng',
    sectionId: 7,
    standardKey: 'new_customers',
    vietnameseName: 'Khách hàng mới',
    englishName: 'New Customer / New Buyer',
    businessMeaning: 'Khách hàng thực hiện giao dịch lần đầu tiên trong phạm vi định nghĩa của hệ thống.',
    aliases: ['khachhangmoi', 'newcustomer', 'newbuyer', 'khachmualandau', 'buyers_new', 'khachmoi'],
    abbreviations: ['Khách mới', 'New Buyer'],
    dataType: 'Number',
    unit: 'Người',
    relationships: 'Đo lường năng lực thu hút khách hàng mới từ chiến dịch marketing.',
    notToBeConfusedWith: ['Khách hàng mới trong tháng không nhất thiết đồng nghĩa mới hoàn toàn lịch sử'],
    validationRule: 'Số nguyên không âm (Integer >= 0).',
    sampleValues: ['120', '340'],
  },
  {
    id: 36,
    section: 'Phần 7. Khách Hàng',
    sectionId: 7,
    standardKey: 'returning_customers',
    vietnameseName: 'Khách hàng quay lại',
    englishName: 'Returning Customer / Repeat Customer',
    businessMeaning: 'Khách hàng đã từng mua trong quá khứ và tiếp tục phát sinh giao dịch mới.',
    aliases: ['khachhangquaylai', 'returningcustomer', 'repeatcustomer', 'khachmualai', 'khachhangcu', 'khachcu'],
    abbreviations: ['Khách cũ', 'Khách mua lại'],
    dataType: 'Number',
    unit: 'Người',
    relationships: 'Đo lường mức độ trung thành của khách hàng và chất lượng dịch vụ.',
    notToBeConfusedWith: ['Khách hàng mới'],
    validationRule: 'Số nguyên không âm (Integer >= 0).',
    sampleValues: ['45', '110'],
  },
  {
    id: 37,
    section: 'Phần 7. Khách Hàng',
    sectionId: 7,
    standardKey: 'purchase_frequency',
    vietnameseName: 'Số lần mua (Tần suất mua)',
    englishName: 'Purchase Frequency / Number of Purchases',
    businessMeaning: 'Số lần khách hàng thực hiện giao dịch trong phạm vi thời gian được phân tích.',
    aliases: ['solanmua', 'purchasefrequency', 'numberofpurchases', 'sogiaodich', 'tansuatmua', 'solanmuahang'],
    abbreviations: ['Tần suất mua', 'Freq'],
    dataType: 'Number',
    unit: 'Lần/khách',
    relationships: 'Dùng để dự báo LTV = AOV × Purchase Frequency × Customer Lifespan.',
    notToBeConfusedWith: ['Số sản phẩm mua (1 lần mua có thể mua nhiều sản phẩm)'],
    validationRule: 'Số nguyên hoặc số thực dương (Float > 0).',
    sampleValues: ['1.8 lần/năm', '3'],
  },
  {
    id: 38,
    section: 'Phần 7. Khách Hàng',
    sectionId: 7,
    standardKey: 'total_spend',
    vietnameseName: 'Tổng chi tiêu khách hàng',
    englishName: 'Customer Spending / Total Spend / Customer Revenue',
    businessMeaning: 'Tổng giá trị tiền khách hàng đã chi tiêu trong phạm vi thời gian và giao dịch xác định.',
    aliases: ['tongchitieu', 'customerspending', 'totalspend', 'customerrevenue', 'tongtienmua', 'giatrimuahang', 'tongsotienmua'],
    abbreviations: ['Tổng chi tiêu', 'Total Spend'],
    dataType: 'Number',
    unit: 'VNĐ',
    relationships: 'Phân loại nhóm khách hàng VIP, khách hàng trung bình và khách vãng lai.',
    notToBeConfusedWith: ['Giá trị một đơn hàng đơn lẻ'],
    validationRule: 'Số thực không âm (Float >= 0).',
    sampleValues: ['4.500.000 đ', '18,200,000'],
  },

  // --------------------------------------------------------------------------
  // PHẦN 8. KPI THƯƠNG MẠI ĐIỆN TỬ
  // --------------------------------------------------------------------------
  {
    id: 39,
    section: 'Phần 8. KPI Thương Mại Điện Tử',
    sectionId: 8,
    standardKey: 'total_orders',
    vietnameseName: 'Tổng số đơn hàng',
    englishName: 'Total Orders / Total Orders Placed',
    businessMeaning: 'Số lượng đơn hàng duy nhất trong phạm vi dữ liệu.',
    aliases: ['tongsodonhang', 'tongsodon', 'totalorders', 'sodon', 'tongdon', 'soluongdonhang', 'total_orders'],
    abbreviations: ['Số đơn', 'Tổng ĐH', 'Orders'],
    dataType: 'Number',
    unit: 'Đơn hàng',
    formula: 'COUNT DISTINCT(Mã đơn hàng)',
    relationships: 'QUAN TRỌNG: Nếu 1 mã đơn xuất hiện 3 dòng vì có 3 sản phẩm, chỉ tính là 1 đơn.',
    notToBeConfusedWith: ['Số dòng dữ liệu trong bảng', 'Tổng số sản phẩm bán ra'],
    validationRule: 'Đếm số lượng mã đơn độc nhất, không đếm số dòng dữ liệu.',
    sampleValues: ['1,250 đơn', '480'],
  },
  {
    id: 40,
    section: 'Phần 8. KPI Thương Mại Điện Tử',
    sectionId: 8,
    standardKey: 'units_sold',
    vietnameseName: 'Tổng số sản phẩm bán ra',
    englishName: 'Total Units Sold / Units Sold',
    businessMeaning: 'Tổng số đơn vị sản phẩm được bán ra.',
    aliases: ['tongsosanphamban', 'unitssold', 'totalunitssold', 'tongslban', 'tongsosanphambanra', 'tongsoluongban'],
    abbreviations: ['Tổng SL Bán', 'Units Sold'],
    dataType: 'Number',
    unit: 'Sản phẩm',
    formula: 'SUM(Số lượng)',
    relationships: 'Tổng sản lượng tiêu thụ trong kỳ.',
    notToBeConfusedWith: ['Tổng số đơn hàng'],
    validationRule: 'Tổng các số lượng sản phẩm trong kỳ.',
    sampleValues: ['3,450 sản phẩm', '980'],
  },
  {
    id: 41,
    section: 'Phần 8. KPI Thương Mại Điện Tử',
    sectionId: 8,
    standardKey: 'aov',
    vietnameseName: 'Giá trị đơn hàng trung bình (AOV)',
    englishName: 'Average Order Value (AOV)',
    businessMeaning: 'Giá trị doanh thu trung bình trên mỗi đơn hàng thành công.',
    aliases: ['giatridonhangtrungbinh', 'aov', 'averageordervalue', 'giatridontrungbinh', 'doanhthutrendon'],
    abbreviations: ['AOV'],
    dataType: 'Number',
    unit: 'VNĐ/đơn',
    formula: 'Tổng doanh thu / Tổng số đơn hàng duy nhất',
    relationships: 'Mẫu số phải là số đơn hàng duy nhất (COUNT DISTINCT), không phải số dòng dữ liệu.',
    notToBeConfusedWith: ['Đơn giá sản phẩm đơn lẻ'],
    validationRule: 'Số thực dương (Float > 0).',
    sampleValues: ['320.000 đ', '450,000'],
  },
  {
    id: 42,
    section: 'Phần 8. KPI Thương Mại Điện Tử',
    sectionId: 8,
    standardKey: 'conversion_rate',
    vietnameseName: 'Tỷ lệ chuyển đổi (CR / CVR)',
    englishName: 'Conversion Rate (CR / CVR)',
    businessMeaning: 'Tỷ lệ người dùng hoặc lượt truy cập thực hiện hành động mua hàng.',
    aliases: ['tylechuyendoi', 'conversionrate', 'cvr', 'cr', 'tylechuyendon', 'tyledathang'],
    abbreviations: ['CR', 'CVR'],
    dataType: 'Number',
    unit: '%',
    formula: 'Số đơn / Lượt truy cập × 100% hoặc Số đơn / Lượt nhấp × 100%',
    relationships: 'Tùy thuộc vào nguồn dữ liệu (Sessions hay Clicks). AI không được tự chọn mẫu số nếu chưa rõ.',
    notToBeConfusedWith: ['CTR (Click Through Rate)'],
    validationRule: 'Tỷ lệ phần trăm từ 0% đến 100%.',
    sampleValues: ['4.25%', '0.038'],
  },
  {
    id: 43,
    section: 'Phần 8. KPI Thương Mại Điện Tử',
    sectionId: 8,
    standardKey: 'profit_margin',
    vietnameseName: 'Biên lợi nhuận (Margin)',
    englishName: 'Profit Margin / Gross Margin / Net Margin',
    businessMeaning: 'Tỷ lệ phần trăm lợi nhuận thu được trên doanh thu.',
    aliases: ['bienloinhuan', 'tyleloinhuan', 'profitmargin', 'margin', 'grossmargin', 'netmargin', 'bienlaigop'],
    abbreviations: ['Margin', 'Biên lãi'],
    dataType: 'Number',
    unit: '%',
    formula: '(Lợi nhuận / Doanh thu) × 100%',
    relationships: 'Gross Margin = (Lãi gộp / DT) × 100%, Net Margin = (Lãi ròng / DT) × 100%.',
    notToBeConfusedWith: ['Gross Margin và Net Margin là hai khái niệm khác nhau'],
    validationRule: 'Xác định rõ đang tính biên lãi gộp hay biên lãi ròng.',
    sampleValues: ['35.5%', '18.2%'],
  },

  // --------------------------------------------------------------------------
  // PHẦN 9. THỜI GIAN
  // --------------------------------------------------------------------------
  {
    id: 44,
    section: 'Phần 9. Thời Gian',
    sectionId: 9,
    standardKey: 'date_day',
    vietnameseName: 'Ngày',
    englishName: 'Date / Day',
    businessMeaning: 'Một ngày cụ thể theo lịch dương.',
    aliases: ['ngay', 'date', 'day', 'ngaythang'],
    abbreviations: ['Ngày', 'Date'],
    dataType: 'Date',
    unit: 'Ngày (DD/MM/YYYY)',
    relationships: 'Đơn vị thời gian cơ sở để nhóm dữ liệu.',
    notToBeConfusedWith: ['Tháng', 'Tuần'],
    validationRule: 'Định dạng chuẩn DD/MM/YYYY.',
    sampleValues: ['18/09/2026'],
  },
  {
    id: 45,
    section: 'Phần 9. Thời Gian',
    sectionId: 9,
    standardKey: 'date_week',
    vietnameseName: 'Tuần',
    englishName: 'Week / Weekly',
    businessMeaning: 'Khoảng thời gian gồm các ngày được nhóm theo tuần (W1, W2...).',
    aliases: ['tuan', 'week', 'weekly', 'tuantrongnam'],
    abbreviations: ['Tuần', 'Week'],
    dataType: 'Category',
    unit: 'Tuần',
    relationships: 'Tổng hợp phân tích xu hướng theo tuần.',
    notToBeConfusedWith: ['Tháng'],
    validationRule: 'Chuỗi biểu thị tuần (ví dụ: W38-2026).',
    sampleValues: ['Tuần 38', 'W38'],
  },
  {
    id: 46,
    section: 'Phần 9. Thời Gian',
    sectionId: 9,
    standardKey: 'date_month',
    vietnameseName: 'Tháng',
    englishName: 'Month / Monthly',
    businessMeaning: 'Khoảng thời gian theo tháng dương lịch hoặc kỳ báo cáo kế toán.',
    aliases: ['thang', 'month', 'monthly', 'thangbaocao', 'kybaocao'],
    abbreviations: ['Tháng', 'Month'],
    dataType: 'Category',
    unit: 'Tháng (MM/YYYY)',
    relationships: 'Dùng trong báo cáo tài chính hàng tháng.',
    notToBeConfusedWith: ['Quý'],
    validationRule: 'Chuỗi biểu thị tháng (ví dụ: 09/2026).',
    sampleValues: ['Tháng 9/2026', '09/2026'],
  },
  {
    id: 47,
    section: 'Phần 9. Thời Gian',
    sectionId: 9,
    standardKey: 'date_quarter',
    vietnameseName: 'Quý',
    englishName: 'Quarter (Q1, Q2, Q3, Q4)',
    businessMeaning: 'Khoảng thời gian gồm ba tháng (Q1: T1-3, Q2: T4-6, Q3: T7-9, Q4: T10-12).',
    aliases: ['quy', 'quarter', 'q1', 'q2', 'q3', 'q4', 'quybaocao'],
    abbreviations: ['Quý', 'Quarter'],
    dataType: 'Category',
    unit: 'Quý',
    relationships: 'Tổng hợp báo cáo kinh doanh cấp HĐQT/C-Level.',
    notToBeConfusedWith: ['Năm', 'Tháng'],
    validationRule: 'Q1, Q2, Q3, Q4 kèm năm.',
    sampleValues: ['Q3/2026', 'Quý 3'],
  },

  // --------------------------------------------------------------------------
  // PHẦN 10. SÀN VÀ KÊNH BÁN
  // --------------------------------------------------------------------------
  {
    id: 48,
    section: 'Phần 10. Sàn & Kênh Bán',
    sectionId: 10,
    standardKey: 'platform',
    vietnameseName: 'Sàn thương mại điện tử',
    englishName: 'Platform / Marketplace / E-commerce Platform',
    businessMeaning: 'Nền tảng sàn TMĐT phát sinh giao dịch bán hàng.',
    aliases: ['santhuongmaidientu', 'san', 'marketplace', 'platform', 'ecommerceplatform', 'san_tmdt', 'nentang'],
    abbreviations: ['Sàn', 'Platform'],
    dataType: 'Category',
    unit: '—',
    relationships: 'Shopee, TikTok Shop, Tiki...',
    notToBeConfusedWith: ['Kênh bán hàng nội bộ (POS, Website)'],
    validationRule: 'Chuẩn hóa về các tên sàn chuẩn.',
    sampleValues: ['Shopee', 'TikTok Shop'],
  },
  {
    id: 49,
    section: 'Phần 10. Sàn & Kênh Bán',
    sectionId: 10,
    standardKey: 'sales_channel',
    vietnameseName: 'Kênh bán hàng',
    englishName: 'Sales Channel / Channel / Traffic Source',
    businessMeaning: 'Kênh mà thông qua đó khách hàng thực hiện giao dịch (Shopee, TikTok, Web, POS, Facebook...).',
    aliases: ['kenhbanhang', 'saleschannel', 'channel', 'kenh', 'nguonbanhang', 'kenhban', 'traffic_source'],
    abbreviations: ['Kênh', 'Channel'],
    dataType: 'Category',
    unit: '—',
    relationships: 'Bao quát cả sàn TMĐT, kênh mạng xã hội, website và cửa hàng trực tiếp.',
    notToBeConfusedWith: ['Ngành hàng'],
    validationRule: 'Nhóm phân loại kênh bán hàng.',
    sampleValues: ['Shopee Mall', 'TikTok Shop Live', 'Website DTC', 'Cửa hàng Offline'],
  },

  // --------------------------------------------------------------------------
  // PHẦN 11. TỒN KHO
  // --------------------------------------------------------------------------
  {
    id: 50,
    section: 'Phần 11. Tồn Kho',
    sectionId: 11,
    standardKey: 'inventory',
    vietnameseName: 'Tồn kho khả dụng',
    englishName: 'Inventory / Stock / Stock Quantity',
    businessMeaning: 'Số lượng sản phẩm còn tồn tại kho tại thời điểm xác định.',
    aliases: ['tonkho', 'inventory', 'stock', 'stockquantity', 'soluongton', 'slton', 'ton_kho', 'hangton'],
    abbreviations: ['SL Tồn', 'Stock', 'Inventory'],
    dataType: 'Number',
    unit: 'Sản phẩm/đơn vị',
    relationships: 'Dùng để tính Days of Inventory (DOI) và cảnh báo nguy cơ Out-of-Stock.',
    notToBeConfusedWith: ['Số lượng nhập kho', 'Số lượng đã bán'],
    validationRule: 'Số nguyên không âm (Integer >= 0).',
    sampleValues: ['150', '2,400'],
  },
  {
    id: 51,
    section: 'Phần 11. Tồn Kho',
    sectionId: 11,
    standardKey: 'beginning_inventory',
    vietnameseName: 'Tồn kho đầu kỳ',
    englishName: 'Beginning Inventory / Opening Stock',
    businessMeaning: 'Số lượng tồn kho tại thời điểm bắt đầu kỳ phân tích.',
    aliases: ['tonkhodauky', 'beginninginventory', 'openingstock', 'tondauky', 'tontaidauky', 'sltondauky'],
    abbreviations: ['Tồn đầu kỳ', 'Opening Stock'],
    dataType: 'Number',
    unit: 'Sản phẩm',
    relationships: 'Tồn cuối kỳ = Tồn đầu kỳ + Nhập trong kỳ − Bán trong kỳ.',
    notToBeConfusedWith: ['Tồn kho cuối kỳ'],
    validationRule: 'Số nguyên không âm (Integer >= 0).',
    sampleValues: ['500', '1,200'],
  },
  {
    id: 52,
    section: 'Phần 11. Tồn Kho',
    sectionId: 11,
    standardKey: 'ending_inventory',
    vietnameseName: 'Tồn kho cuối kỳ',
    englishName: 'Ending Inventory / Closing Stock',
    businessMeaning: 'Số lượng tồn kho tại thời điểm kết thúc kỳ phân tích.',
    aliases: ['tonkhocuoiky', 'endinginventory', 'closingstock', 'toncuoiky', 'tontaicuoiky', 'sltoncuoiky'],
    abbreviations: ['Tồn cuối kỳ', 'Closing Stock'],
    dataType: 'Number',
    unit: 'Sản phẩm',
    relationships: 'Tồn cuối kỳ dùng làm tồn đầu kỳ của kỳ tiếp theo.',
    notToBeConfusedWith: ['Tồn kho đầu kỳ'],
    validationRule: 'Số nguyên không âm (Integer >= 0).',
    sampleValues: ['320', '890'],
  },
  {
    id: 53,
    section: 'Phần 11. Tồn Kho',
    sectionId: 11,
    standardKey: 'stock_in',
    vietnameseName: 'Số lượng nhập kho',
    englishName: 'Stock In / Inventory In / Inbound Stock',
    businessMeaning: 'Số lượng sản phẩm được bổ sung nhập mới vào kho trong kỳ.',
    aliases: ['soluongnhapkho', 'stockin', 'inventoryin', 'nhaphang', 'slnhap', 'soluongnhap', 'nhapkho'],
    abbreviations: ['SL Nhập', 'Stock In'],
    dataType: 'Number',
    unit: 'Sản phẩm',
    relationships: 'Tăng lượng tồn kho khả dụng.',
    notToBeConfusedWith: ['Tồn kho khả dụng', 'Số lượng bán ra'],
    validationRule: 'Số nguyên không âm (Integer >= 0).',
    sampleValues: ['200', '1,000'],
  },
];

// ============================================================================
// 2. TỪ ĐIỂN TỪ VIẾT TẮT PHỔ BIẾN (PHẦN 12)
// ============================================================================
export const VIETNAMESE_ABBREVIATIONS: Record<string, string> = {
  'sl': 'Số lượng',
  'sp': 'Sản phẩm',
  'dh': 'Đơn hàng',
  'kh': 'Khách hàng',
  'dt': 'Doanh thu',
  'cp': 'Chi phí',
  'qc': 'Quảng cáo',
  'km': 'Khuyến mãi / Giảm giá',
  'sku': 'Stock Keeping Unit (Mã đơn vị lưu kho)',
  'gmv': 'Gross Merchandise Value (Tổng giá trị giao dịch hàng hóa)',
  'aov': 'Average Order Value (Giá trị đơn hàng trung bình)',
  'roas': 'Return On Ad Spend (Doanh thu tạo ra trên mỗi đồng chi phí quảng cáo)',
  'roi': 'Return On Investment (Tỷ suất lợi nhuận trên vốn đầu tư)',
  'ctr': 'Click Through Rate (Tỷ lệ nhấp trên lượt hiển thị)',
  'cpc': 'Cost Per Click (Chi phí trên mỗi lượt nhấp)',
  'cpm': 'Cost Per Mille (Chi phí trên 1.000 lượt hiển thị)',
  'cr': 'Conversion Rate (Tỷ lệ chuyển đổi ra đơn hàng)',
  'cvr': 'Conversion Rate (Tỷ lệ chuyển đổi)',
  'cogs': 'Cost Of Goods Sold (Giá vốn hàng bán)',
  'acos': 'Advertising Cost Of Sales (Tỷ lệ chi phí quảng cáo trên doanh thu ads)',
  'ltv': 'Lifetime Value (Giá trị vòng đời khách hàng)',
  'clv': 'Customer Lifetime Value (Giá trị vòng đời khách hàng)',
  'cac': 'Customer Acquisition Cost (Chi phí để có được 1 khách hàng mới)',
};

// ============================================================================
// 3. 10 CẶP KHÁI NIỆM TUYỆT ĐỐI KHÔNG ĐƯỢC NHẦM LẪN (PHẦN 14)
// ============================================================================
export interface SemanticCollisionRule {
  id: number;
  pair: string;
  conceptA: string;
  conceptB: string;
  ruleExplanation: string;
}

export const CRITICAL_COLLISION_RULES: SemanticCollisionRule[] = [
  {
    id: 1,
    pair: 'DOANH THU ≠ LỢI NHUẬN',
    conceptA: 'Doanh thu (Revenue/Sales)',
    conceptB: 'Lợi nhuận (Profit)',
    ruleExplanation: 'Doanh thu là tổng số tiền thu từ hoạt động bán hàng. Lợi nhuận là phần còn lại sau khi đã trừ đi các chi phí liên quan (Giá vốn, Phí sàn, Phí ship, Ads, Vận hành).',
  },
  {
    id: 2,
    pair: 'GIÁ BÁN ≠ GIÁ VỐN',
    conceptA: 'Giá bán (Selling Price / Unit Price)',
    conceptB: 'Giá vốn (COGS / Cost Price)',
    ruleExplanation: 'Giá bán là số tiền khách hàng phải trả hoặc giá niêm yết. Giá vốn là chi phí doanh nghiệp bỏ ra để mua hoặc sản xuất sản phẩm.',
  },
  {
    id: 3,
    pair: 'ĐƠN HÀNG ≠ SẢN PHẨM BÁN',
    conceptA: 'Số đơn hàng (Orders Count)',
    conceptB: 'Số lượng sản phẩm bán (Units Sold)',
    ruleExplanation: 'Một đơn hàng có thể chứa nhiều sản phẩm (ví dụ: 1 đơn mua 3 áo -> Số đơn = 1, Số lượng sản phẩm = 3). Tuyệt đối không đếm số dòng dữ liệu làm số đơn hàng.',
  },
  {
    id: 4,
    pair: 'ROAS ≠ ROI',
    conceptA: 'ROAS (Return On Ad Spend)',
    conceptB: 'ROI (Return On Investment)',
    ruleExplanation: 'ROAS tập trung vào doanh thu tạo ra so với chi phí quảng cáo (DT Ads / CP Ads). ROI tập trung vào mức sinh lời ròng trên tổng vốn đầu tư ((Lợi nhuận - Vốn) / Vốn).',
  },
  {
    id: 5,
    pair: 'GIẢM GIÁ ≠ HOÀN TIỀN',
    conceptA: 'Giảm giá (Discount)',
    conceptB: 'Hoàn tiền (Refund)',
    ruleExplanation: 'Giảm giá xảy ra trước hoặc trong khi xác định giá bán (trước khi khách trả tiền). Hoàn tiền là khoản tiền trả lại cho khách sau khi đã phát sinh giao dịch do trả hàng hoặc khiếu nại.',
  },
  {
    id: 6,
    pair: 'NGÂN SÁCH QUẢNG CÁO ≠ CHI PHÍ QUẢNG CÁO',
    conceptA: 'Ngân sách QC (Ad Budget)',
    conceptB: 'Chi phí QC (Ad Spend)',
    ruleExplanation: 'Ngân sách là số tiền dự kiến hoặc hạn mức trần phân bổ. Chi phí quảng cáo là số tiền thực tế hệ thống quảng cáo đã cắn tiền/tiêu thụ.',
  },
  {
    id: 7,
    pair: 'GMV ≠ DOANH THU KẾ TOÁN',
    conceptA: 'GMV (Gross Merchandise Value)',
    conceptB: 'Doanh thu kế toán (Accounting Net Revenue)',
    ruleExplanation: 'GMV phụ thuộc vào định nghĩa nền tảng sàn TMĐT (có thể gồm đơn chưa thanh toán, đơn hủy sau đó). Không được tự động xem GMV là doanh thu ghi nhận sổ sách kế toán.',
  },
  {
    id: 8,
    pair: 'DOANH THU ≠ DÒNG TIỀN',
    conceptA: 'Doanh thu (Sales Revenue)',
    conceptB: 'Dòng tiền (Cashflow)',
    ruleExplanation: 'Doanh thu là chỉ số ghi nhận hoạt động kinh doanh. Dòng tiền là số tiền thực tế doanh nghiệp đã rút về tài khoản ngân hàng sau chu kỳ đối soát và trừ công nợ.',
  },
  {
    id: 9,
    pair: 'LƯỢT NHẤP ≠ LƯỢT HIỂN THỊ',
    conceptA: 'Lượt nhấp (Clicks)',
    conceptB: 'Lượt hiển thị (Impressions)',
    ruleExplanation: 'Một quảng cáo có thể có hàng chục nghìn lượt hiển thị (Impressions) nhưng chỉ phát sinh một số lượng lượt nhấp (Clicks) nhất định.',
  },
  {
    id: 10,
    pair: 'KHÁCH HÀNG ≠ ĐƠN HÀNG',
    conceptA: 'Khách hàng (Customers)',
    conceptB: 'Đơn hàng (Orders)',
    ruleExplanation: 'Một khách hàng trung thành có thể tạo ra nhiều đơn hàng trong kỳ. Không được đồng nhất số lượng khách hàng độc nhất với tổng số đơn hàng.',
  },
];

// ============================================================================
// 4. QUY TẮC AI 10 BƯỚC KHI ĐỌC VÀ XỬ LÝ FILE EXCEL (PHẦN 15 & 16)
// ============================================================================
export const AI_EXCEL_INGESTION_PIPELINE_STEPS = [
  { step: 1, name: 'Đọc toàn bộ tên cột', desc: 'Quét toàn bộ tiêu đề cột ở dòng header của tất cả các sheet trong file.' },
  { step: 2, name: 'Chuẩn hóa ký tự', desc: 'Chuyển về chữ thường, bỏ dấu tiếng Việt, loại bỏ ký tự đặc biệt để so khớp.' },
  { step: 3, name: 'Tra cứu từ đồng nghĩa & viết tắt', desc: 'Áp dụng bộ từ điển 53 khái niệm chuẩn và bảng từ viết tắt để tìm cột tương ứng.' },
  { step: 4, name: 'Kiểm tra kiểu dữ liệu thực tế', desc: 'Xác thực kiểu dữ liệu trong cột (Số, Ngày, Chuỗi, Danh mục) khớp với định nghĩa chuẩn.' },
  { step: 5, name: 'Kiểm tra giá trị mẫu (Sample Values)', desc: 'Phân tích một vài dòng dữ liệu thực tế để đảm bảo cột tiền tệ có định dạng tiền, cột ngày có định dạng ngày.' },
  { step: 6, name: 'Kiểm tra mối quan hệ giữa các cột', desc: 'Xác minh công thức logic (vd: Doanh thu trước giảm ≈ Số lượng × Đơn giá, Doanh thu sau giảm = Gross - Discount).' },
  { step: 7, name: 'Phát hiện dữ liệu bất thường (Anomalies)', desc: 'Cảnh báo ngay nếu phát hiện: Số lượng âm, Đơn giá âm, Doanh thu âm, Mã đơn bị thiếu, Trạng thái đơn bất thường.' },
  { step: 8, name: 'Map cột về khái niệm chuẩn', desc: 'Gắn thẻ trường dữ liệu chuẩn (Standard Key) vào cấu trúc phân tích nội bộ.' },
  { step: 9, name: 'Gắn cờ "CẦN XÁC NHẬN" nếu mơ hồ', desc: 'Nếu tên cột hoặc kiểu dữ liệu không đủ căn cứ xác định, đánh dấu CẦN XÁC NHẬN thay vì tự đoán mò.' },
  { step: 10, name: 'Tuyệt đối không tự bịa dữ liệu', desc: 'Chỉ phân tích trên dữ liệu thực tế, không tự động điền các chỉ số bị thiếu nếu không có cơ sở.' },
];

export const MAPPING_PRIORITY_LEVELS = [
  { level: 1, name: 'Mức 1: Khớp chính xác tên tiếng Việt chuẩn' },
  { level: 2, name: 'Mức 2: Khớp từ đồng nghĩa tiếng Việt đã biết' },
  { level: 3, name: 'Mức 3: Khớp tên tiếng Anh tương ứng' },
  { level: 4, name: 'Mức 4: Phân tích kiểu dữ liệu (Data Type)' },
  { level: 5, name: 'Mức 5: Phân tích giá trị mẫu (Sample Values)' },
  { level: 6, name: 'Mức 6: Phân tích mối quan hệ logic giữa các cột' },
  { level: 7, name: 'Mức 7: Không chắc chắn -> Gắn cờ CẦN XÁC NHẬN' },
];

export const SAFE_ANALYSIS_PRINCIPLES = [
  'AI KHÔNG ĐƯỢC tự bịa dữ liệu.',
  'AI KHÔNG ĐƯỢC tự tạo giá trị cho ô bị thiếu.',
  'AI KHÔNG ĐƯỢC tự đổi đơn vị mà không xác định được đơn vị ban đầu.',
  'AI KHÔNG ĐƯỢC tự xem một cột "doanh số" là "lợi nhuận".',
  'AI KHÔNG ĐƯỢC tự xem một cột "GMV" là "doanh thu thuần kế toán".',
  'AI KHÔNG ĐƯỢC tự cộng doanh thu từ các sheet nếu có khả năng trùng dữ liệu.',
  'AI KHÔNG ĐƯỢC tự tính KPI khi thiếu thành phần dữ liệu cần thiết (phải thông báo "Dữ liệu hiện tại chưa đủ để tính chỉ số này").',
  'AI KHÔNG ĐƯỢC tự kết luận dữ liệu chính xác nếu chưa kiểm tra chất lượng dữ liệu.',
  'AI KHÔNG ĐƯỢC tự ý sửa đổi dữ liệu gốc của doanh nghiệp.',
];

// ============================================================================
// 5. DANH MỤC KIỂU DỮ LIỆU CHUẨN (TARGET DATA TYPE) & KIỂU DỮ LIỆU THÔ (RAW)
// ============================================================================

export interface DataTypeSpecItem {
  id: number;
  category: string;
  categoryId: 1 | 2 | 3 | 4 | 5;
  columnNames: string[];
  targetDataType: string;
  rawDataType: string;
  descriptionOrExample: string;
}

export interface AiEtlRule {
  id: number;
  title: string;
  rule: string;
  codeLogic: string;
  example: string;
}

export const DATA_TYPE_SPECIFICATION_LIST: DataTypeSpecItem[] = [
  // --------------------------------------------------------------------------
  // 1. Phân loại & Định danh (Metadata & Categorical Text)
  // --------------------------------------------------------------------------
  {
    id: 1,
    category: '1. Phân loại & Định danh (Metadata & Categorical Text)',
    categoryId: 1,
    columnNames: ['Nền tảng', 'Platform', 'Marketplace', 'Kênh', 'Nền tảng KOL'],
    targetDataType: 'String (Chuỗi)',
    rawDataType: 'String / Object',
    descriptionOrExample: 'Shopee, TikTok Shop, Facebook',
  },
  {
    id: 2,
    category: '1. Phân loại & Định danh (Metadata & Categorical Text)',
    categoryId: 1,
    columnNames: ['Source'],
    targetDataType: 'String (Chuỗi)',
    rawDataType: 'String / Object',
    descriptionOrExample: 'Tìm kiếm, Quảng cáo, Trực tiếp',
  },
  {
    id: 3,
    category: '1. Phân loại & Định danh (Metadata & Categorical Text)',
    categoryId: 1,
    columnNames: ['Tên doanh nghiệp', 'Company', 'Merchant'],
    targetDataType: 'String (Chuỗi)',
    rawDataType: 'String / Object',
    descriptionOrExample: 'Cỏ Mềm, MemoryNest',
  },
  {
    id: 4,
    category: '1. Phân loại & Định danh (Metadata & Categorical Text)',
    categoryId: 1,
    columnNames: ['SKU / Item ID', 'SKU / Mã SP', 'Content ID', 'ID Live'],
    targetDataType: 'String (Chuỗi)',
    rawDataType: 'String / Object',
    descriptionOrExample: 'Mã ID (CM-GAO-45, SF-2S-001, 38500538)',
  },
  {
    id: 5,
    category: '1. Phân loại & Định danh (Metadata & Categorical Text)',
    categoryId: 1,
    columnNames: ['Product Name', 'Tên sản phẩm'],
    targetDataType: 'String (Chuỗi)',
    rawDataType: 'String / Object',
    descriptionOrExample: 'Son Dưỡng Gạo 4.5g',
  },
  {
    id: 6,
    category: '1. Phân loại & Định danh (Metadata & Categorical Text)',
    categoryId: 1,
    columnNames: ['Brand'],
    targetDataType: 'String (Chuỗi)',
    rawDataType: 'String / Object',
    descriptionOrExample: 'Cỏ Mềm',
  },
  {
    id: 7,
    category: '1. Phân loại & Định danh (Metadata & Categorical Text)',
    categoryId: 1,
    columnNames: ['Stock status', 'Trạng thái'],
    targetDataType: 'String (Chuỗi)',
    rawDataType: 'String / Object',
    descriptionOrExample: 'Active, Đang bán',
  },
  {
    id: 8,
    category: '1. Phân loại & Định danh (Metadata & Categorical Text)',
    categoryId: 1,
    columnNames: ['Campaign Tag'],
    targetDataType: 'String (Chuỗi)',
    rawDataType: 'String / Object',
    descriptionOrExample: 'Always-on, Mega Sale',
  },
  {
    id: 9,
    category: '1. Phân loại & Định danh (Metadata & Categorical Text)',
    categoryId: 1,
    columnNames: ['Content Type', 'Tên nội dung', 'Tiêu đề Live'],
    targetDataType: 'String (Chuỗi)',
    rawDataType: 'String / Object',
    descriptionOrExample: 'Video, Sale giữa tháng',
  },
  {
    id: 10,
    category: '1. Phân loại & Định danh (Metadata & Categorical Text)',
    categoryId: 1,
    columnNames: ['Người tiếp thị'],
    targetDataType: 'String (Chuỗi)',
    rawDataType: 'String / Object',
    descriptionOrExample: 'Tên KOL/KOC/Affiliate',
  },
  {
    id: 11,
    category: '1. Phân loại & Định danh (Metadata & Categorical Text)',
    categoryId: 1,
    columnNames: ['Currency', 'Timezone'],
    targetDataType: 'String (Chuỗi)',
    rawDataType: 'String / Object',
    descriptionOrExample: 'VNĐ, UTC+7',
  },
  {
    id: 12,
    category: '1. Phân loại & Định danh (Metadata & Categorical Text)',
    categoryId: 1,
    columnNames: ['Ghi chú nội bộ'],
    targetDataType: 'String (Chuỗi)',
    rawDataType: 'String / Object',
    descriptionOrExample: 'Ghi chú văn bản',
  },

  // --------------------------------------------------------------------------
  // 2. Ngày tháng & Thời gian (Date & Time)
  // --------------------------------------------------------------------------
  {
    id: 13,
    category: '2. Ngày tháng & Thời gian (Date & Time)',
    categoryId: 2,
    columnNames: ['Ngày bán', 'Ngày', 'Report Date', 'Date'],
    targetDataType: 'Date / Datetime',
    rawDataType: 'String / Object',
    descriptionOrExample: '26-07-2026, 2026-07-27, 24/07/2026',
  },
  {
    id: 14,
    category: '2. Ngày tháng & Thời gian (Date & Time)',
    categoryId: 2,
    columnNames: ['Period'],
    targetDataType: 'String (YYYY-MM)',
    rawDataType: 'String / Object',
    descriptionOrExample: '2026-07',
  },
  {
    id: 15,
    category: '2. Ngày tháng & Thời gian (Date & Time)',
    categoryId: 2,
    columnNames: ['Watch Time', 'Thời lượng xem TB'],
    targetDataType: 'Time / Duration',
    rawDataType: 'String / Object',
    descriptionOrExample: '00:02:14, 00:03:32 (HH:MM:SS)',
  },

  // --------------------------------------------------------------------------
  // 3. Doanh số & Tài chính (Currency & Financial Numbers)
  // --------------------------------------------------------------------------
  {
    id: 16,
    category: '3. Doanh số & Tài chính (Currency & Financial Numbers)',
    categoryId: 3,
    columnNames: ['Doanh thu gộp', 'GMV', 'Doanh số', 'GMV Placed', 'Revenue_VND', 'DT (VND)', 'Doanh thu (VNĐ)'],
    targetDataType: 'Currency / Float',
    rawDataType: 'String / Integer / Float',
    descriptionOrExample: '10,599,279, 921.640 đ, 45890000',
  },
  {
    id: 17,
    category: '3. Doanh số & Tài chính (Currency & Financial Numbers)',
    categoryId: 3,
    columnNames: ['Doanh thu thuần', 'GMV Confirmed', 'GMV Paid'],
    targetDataType: 'Currency / Float',
    rawDataType: 'String / Float',
    descriptionOrExample: '830.137, 23.010.636',
  },
  {
    id: 18,
    category: '3. Doanh số & Tài chính (Currency & Financial Numbers)',
    categoryId: 3,
    columnNames: ['AOV', 'Revenue per order', 'Revenue / Order', 'Doanh thu trên đơn'],
    targetDataType: 'Currency / Float',
    rawDataType: 'Float / String',
    descriptionOrExample: '258519.0, 146.02, 136.092,74',
  },
  {
    id: 19,
    category: '3. Doanh số & Tài chính (Currency & Financial Numbers)',
    categoryId: 3,
    columnNames: ['Giá trị đơn huỷ', 'Refund Value'],
    targetDataType: 'Currency / Float',
    rawDataType: 'String / Float',
    descriptionOrExample: '258.519, 1.034.076',
  },
  {
    id: 20,
    category: '3. Doanh số & Tài chính (Currency & Financial Numbers)',
    categoryId: 3,
    columnNames: ['Trợ giá sàn', 'Platform Subsidy'],
    targetDataType: 'Currency / Float',
    rawDataType: 'String / Float',
    descriptionOrExample: '950.233, 215.155',
  },
  {
    id: 21,
    category: '3. Doanh số & Tài chính (Currency & Financial Numbers)',
    categoryId: 3,
    columnNames: ['Coupon Cost'],
    targetDataType: 'Currency / Float',
    rawDataType: 'Float',
    descriptionOrExample: '0.0',
  },
  {
    id: 22,
    category: '3. Doanh số & Tài chính (Currency & Financial Numbers)',
    categoryId: 3,
    columnNames: ['Ad Spend (VND)'],
    targetDataType: 'Currency / Float',
    rawDataType: 'Integer / Float',
    descriptionOrExample: '2955175',
  },
  {
    id: 23,
    category: '3. Doanh số & Tài chính (Currency & Financial Numbers)',
    categoryId: 3,
    columnNames: ['Hoa hồng dự kiến'],
    targetDataType: 'Currency / Float',
    rawDataType: 'Float / String',
    descriptionOrExample: '130.352',
  },
  {
    id: 24,
    category: '3. Doanh số & Tài chính (Currency & Financial Numbers)',
    categoryId: 3,
    columnNames: ['ROAS'],
    targetDataType: 'Float',
    rawDataType: 'Float',
    descriptionOrExample: '0.64',
  },

  // --------------------------------------------------------------------------
  // 4. Đơn hàng, Tương tác & Lượng truy cập (Integer Counters)
  // --------------------------------------------------------------------------
  {
    id: 25,
    category: '4. Đơn hàng, Tương tác & Lượng truy cập (Integer Counters)',
    categoryId: 4,
    columnNames: ['STT'],
    targetDataType: 'Integer',
    rawDataType: 'Integer',
    descriptionOrExample: '1, 2',
  },
  {
    id: 26,
    category: '4. Đơn hàng, Tương tác & Lượng truy cập (Integer Counters)',
    categoryId: 4,
    columnNames: ['Số đơn', 'Orders', 'Orders Placed', 'Confirmed Orders', 'Paid Orders'],
    targetDataType: 'Integer',
    rawDataType: 'Integer / Float / String',
    descriptionOrExample: '11, 41.0, 127,92',
  },
  {
    id: 27,
    category: '4. Đơn hàng, Tương tác & Lượng truy cập (Integer Counters)',
    categoryId: 4,
    columnNames: ['Cancelled Qty', 'Refunded Orders'],
    targetDataType: 'Integer',
    rawDataType: 'Integer / Float',
    descriptionOrExample: '1.0, 4.0',
  },
  {
    id: 28,
    category: '4. Đơn hàng, Tương tác & Lượng truy cập (Integer Counters)',
    categoryId: 4,
    columnNames: ['Items Sold', 'SP giới thiệu'],
    targetDataType: 'Integer',
    rawDataType: 'Integer / String',
    descriptionOrExample: '38, 14',
  },
  {
    id: 29,
    category: '4. Đơn hàng, Tương tác & Lượng truy cập (Integer Counters)',
    categoryId: 4,
    columnNames: ['Buyers', 'Khách mua', 'Số khách mua'],
    targetDataType: 'Integer',
    rawDataType: 'Integer / Float',
    descriptionOrExample: '39.0, 11, 4',
  },
  {
    id: 30,
    category: '4. Đơn hàng, Tương tác & Lượng truy cập (Integer Counters)',
    categoryId: 4,
    columnNames: ['New Buyers', 'Khách mua mới', 'New Customer'],
    targetDataType: 'Integer',
    rawDataType: 'Integer / Float',
    descriptionOrExample: '32.0, 9, 5',
  },
  {
    id: 31,
    category: '4. Đơn hàng, Tương tác & Lượng truy cập (Integer Counters)',
    categoryId: 4,
    columnNames: ['Returning Buyers', 'Returning Customer'],
    targetDataType: 'Integer',
    rawDataType: 'Integer / Float',
    descriptionOrExample: '7.0, 6',
  },
  {
    id: 32,
    category: '4. Đơn hàng, Tương tác & Lượng truy cập (Integer Counters)',
    categoryId: 4,
    columnNames: ['Potential buyers'],
    targetDataType: 'Integer',
    rawDataType: 'Integer / Float',
    descriptionOrExample: '229.0',
  },
  {
    id: 33,
    category: '4. Đơn hàng, Tương tác & Lượng truy cập (Integer Counters)',
    categoryId: 4,
    columnNames: ['Visits / Sessions', 'Lượt truy cập'],
    targetDataType: 'Integer',
    rawDataType: 'Integer / Float',
    descriptionOrExample: '646.0, 634',
  },
  {
    id: 34,
    category: '4. Đơn hàng, Tương tác & Lượng truy cập (Integer Counters)',
    categoryId: 4,
    columnNames: ['Product Clicks', 'Lượt click', 'Clicks', 'Unique Clicks', 'Click sản phẩm', 'Click SP'],
    targetDataType: 'Integer',
    rawDataType: 'Integer / Float / String',
    descriptionOrExample: '722.0, 812, 640',
  },
  {
    id: 35,
    category: '4. Đơn hàng, Tương tác & Lượng truy cập (Integer Counters)',
    categoryId: 4,
    columnNames: ['Lượt view sản phẩm', 'Product Impressions', 'Impr.', 'Impressions', 'Unique Impressions', 'Lượt xem', 'Lượt hiển thị', 'Views', 'Unique Viewers', 'Lượt xem ND', 'Người xem'],
    targetDataType: 'Integer',
    rawDataType: 'Integer / String',
    descriptionOrExample: '339, 20487, 1100',
  },
  {
    id: 36,
    category: '4. Đơn hàng, Tương tác & Lượng truy cập (Integer Counters)',
    categoryId: 4,
    columnNames: ['ATC (Add To Cart)'],
    targetDataType: 'Integer',
    rawDataType: 'Integer / String',
    descriptionOrExample: '180',
  },
  {
    id: 37,
    category: '4. Đơn hàng, Tương tác & Lượng truy cập (Integer Counters)',
    categoryId: 4,
    columnNames: ['Comments', 'Likes', 'Shares', 'Bình luận'],
    targetDataType: 'Integer',
    rawDataType: 'Integer / String',
    descriptionOrExample: '873, 260',
  },

  // --------------------------------------------------------------------------
  // 5. Tỷ lệ & Phần trăm (Percentages & Rates)
  // --------------------------------------------------------------------------
  {
    id: 38,
    category: '5. Tỷ lệ & Phần trăm (Percentages & Rates)',
    categoryId: 5,
    columnNames: ['CR', 'CR (%)', 'CVR', 'Conversion', 'Tỷ lệ chuyển đổi', 'CR đơn hàng', 'Tỷ lệ ra đơn'],
    targetDataType: 'Percentage / Float',
    rawDataType: 'String / Float',
    descriptionOrExample: '6.3467, 3,24%, 4.60%, 3,33%',
  },
  {
    id: 39,
    category: '5. Tỷ lệ & Phần trăm (Percentages & Rates)',
    categoryId: 5,
    columnNames: ['CTR', 'CTR (%)'],
    targetDataType: 'Percentage / Float',
    rawDataType: 'String / Float',
    descriptionOrExample: '3.04%, 11.86, 15,58%',
  },
  {
    id: 40,
    category: '5. Tỷ lệ & Phần trăm (Percentages & Rates)',
    categoryId: 5,
    columnNames: ['% DT', 'Revenue Share', 'Tỷ trọng DT', 'Tỷ trọng'],
    targetDataType: 'Percentage / Float',
    rawDataType: 'String',
    descriptionOrExample: '21.42%, 18,20%, 34,68%',
  },
  {
    id: 41,
    category: '5. Tỷ lệ & Phần trăm (Percentages & Rates)',
    categoryId: 5,
    columnNames: ['Repeat buyer rate'],
    targetDataType: 'Percentage / Float',
    rawDataType: 'String',
    descriptionOrExample: '17.95%',
  },
];

// ============================================================================
// 6. QUY TẮC XỬ LÝ DỮ LIỆU (ETL RULES) CHO AI AGENT
// ============================================================================

export const AI_ETL_RULES: AiEtlRule[] = [
  {
    id: 1,
    title: '1. Tiền xử lý chuỗi số (Currency & Numeric Sanitization)',
    rule: 'Xóa ký tự đ, %, khoảng trắng, đổi dấu phẩy , thành dấu chấm . trước khi ép kiểu sang Float/Integer.',
    codeLogic: "str.replace(/[đĐvVnNdD%\\s]/g, '').replace(',', '.') -> parseFloat / parseInt",
    example: '"921.640 đ" -> 921640 | "3,24%" -> 0.0324 | "136.092,74" -> 136092.74',
  },
  {
    id: 2,
    title: '2. Xử lý ID & Phân loại (String Preservation for Keys)',
    rule: 'Mọi trường có chữ ID, SKU, STT ép kiểu cố định về String để tránh mất số 0 ở đầu hoặc bị biến đổi số dạng mũ (1.4e+10).',
    codeLogic: 'String(rawVal).trim() -> Giữ nguyên chuỗi ký tự, không ép kiểu Number',
    example: '"0987654321" giữ nguyên chuỗi | "CM-GAO-45" | "38500538"',
  },
  {
    id: 3,
    title: '3. Xử lý ngày tháng linh hoạt (Multi-format Date Parsing)',
    rule: 'Parse linh hoạt hỗ trợ cả 3 định dạng: DD/MM/YYYY, YYYY-MM-DD, và DD-MM-YYYY (bao gồm cả Excel serial date).',
    codeLogic: 'Regex detection for DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY & Excel Serial Timestamp Conversion',
    example: '"26-07-2026" -> "26/07/2026" | "2026-07-27" -> "27/07/2026" | 45474 -> "18/06/2024"',
  },
];

// ============================================================================
// 7. ORDER STATUS CLASSIFICATION & REVENUE INTEGRITY RULES
// ============================================================================

export function classifyOrderStatus(rawStatus: any): NormalizedOrderStatus {
  if (!rawStatus) return 'DELIVERED';
  const norm = String(rawStatus)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9]/g, '')
    .trim();

  // Cancelled Statuses
  if (
    norm.includes('dahuy') ||
    norm.includes('huy') ||
    norm.includes('cancel') ||
    norm.includes('huydon')
  ) {
    return 'CANCELLED';
  }

  // Refunded / Returned Statuses
  if (
    norm.includes('dahoantien') ||
    norm.includes('hoantien') ||
    norm.includes('trahang') ||
    norm.includes('refund') ||
    norm.includes('return')
  ) {
    return 'REFUNDED';
  }

  // Failed Delivery
  if (
    norm.includes('giaokhongthanhcong') ||
    norm.includes('giaothatbai') ||
    norm.includes('failed') ||
    norm.includes('thatbai')
  ) {
    return 'FAILED_DELIVERY';
  }

  // In-Transit / Processing
  if (
    norm.includes('dangxuly') ||
    norm.includes('danggiao') ||
    norm.includes('choxuly') ||
    norm.includes('cholayhang') ||
    norm.includes('choxacnhan') ||
    norm.includes('processing') ||
    norm.includes('shipping') ||
    norm.includes('intransit')
  ) {
    return 'PROCESSING';
  }

  // Delivered / Completed (Default for valid orders)
  if (
    norm.includes('dagiao') ||
    norm.includes('giaothanhcong') ||
    norm.includes('hoantat') ||
    norm.includes('thanhcong') ||
    norm.includes('delivered') ||
    norm.includes('completed') ||
    norm.includes('danhanhang') ||
    norm.includes('active')
  ) {
    return 'DELIVERED';
  }

  return 'DELIVERED';
}

// ============================================================================
// 8. DETERMINISTIC BUSINESS MATH FORMULAS (Zero LLM Hallucination)
// ============================================================================

export function calculateNetSales(gross: number, discount: number): number {
  return Math.max(0, gross - discount);
}

export function calculateGrossProfit(netSales: number, totalCogs: number): number {
  return netSales - totalCogs;
}

export function calculateROAS(adRevenue: number, adSpend: number): number {
  if (adSpend <= 0) return 0;
  return adRevenue / adSpend;
}

export function calculateAOV(netRevenue: number, ordersCount: number): number {
  if (ordersCount <= 0) return 0;
  return netRevenue / ordersCount;
}

export function calculateCancellationRate(cancelledCount: number, totalCount: number): number {
  if (totalCount <= 0) return 0;
  return cancelledCount / totalCount;
}

export function calculateRefundRate(refundedCount: number, totalCount: number): number {
  if (totalCount <= 0) return 0;
  return refundedCount / totalCount;
}

/**
 * Helper to build LLM System Prompt instructions based on the v1.0 Semantic Dictionary,
 * Data Type Specifications, and AI ETL Rules.
 */
export function generateDataDictionarySystemPrompt(): string {
  return `
BẠN LÀ CHUYÊN GIA KẾ TOÁN & PHÂN TÍCH TÀI CHÍNH TMĐT NỘI BỘ (ECOMPULSE AI AGENT).
BẠN PHẢI TUÂN THỦ 100% "TỪ ĐIỂN NGỮ NGHĨA DỮ LIỆU THƯƠNG MẠI ĐIỆN TỬ & QUY TẮC ETL":

1. BỘ 3 QUY TẮC ETL CHO AI AGENT KHI ĐỌC FILE:
- Quy tắc 1 (Tiền xử lý chuỗi số): Xóa ký tự đ, %, khoảng trắng, đổi dấu phẩy , thành dấu chấm . trước khi ép kiểu sang Float/Integer.
- Quy tắc 2 (Xử lý ID): Mọi trường có chữ ID, SKU, STT ép kiểu cố định về String để tránh mất số 0 ở đầu hoặc bị biến đổi số dạng mũ (1.4e+10).
- Quy tắc 3 (Xử lý ngày tháng): Parse linh hoạt hỗ trợ cả 3 định dạng: DD/MM/YYYY, YYYY-MM-DD, và DD-MM-YYYY.

2. BỘ NGUYÊN TẮC AN TOÀN:
- Tuyệt đối không tự bịa số liệu. Nếu thiếu dữ liệu, phải nói rõ: "Dữ liệu hiện tại chưa đủ để tính chỉ số này."
- Phân biệt rõ ràng đơn giao thành công (tính Doanh thu thuần) với đơn hủy (Thất thoát do hủy) và đơn hoàn (Thất thoát do hoàn hàng).

3. 10 CẶP KHÁI NIỆM CẤM NHẦM LẪN:
1. Doanh thu ≠ Lợi nhuận
2. Giá bán ≠ Giá vốn
3. Đơn hàng (Count distinct) ≠ Số sản phẩm bán (Sum qty)
4. ROAS (Doanh thu Ads / Chi phí Ads) ≠ ROI ((Lợi nhuận - Vốn)/Vốn)
5. Giảm giá (Voucher) ≠ Hoàn tiền (Refund)
6. Ngân sách QC (Budget) ≠ Chi phí QC (Ad Spend thực tế)
7. GMV sàn ≠ Doanh thu thuần sổ sách kế toán
8. Doanh thu ≠ Dòng tiền
9. Lượt nhấp (Clicks) ≠ Lượt hiển thị (Impressions)
10. Khách hàng (Unique Buyers) ≠ Số đơn hàng

4. CÔNG THỨC TOÁN HỌC CHUẨN:
- Doanh thu sau giảm = Doanh thu trước giảm − Giảm giá
- Lợi nhuận gộp = Doanh thu sau giảm − (Giá vốn × Số lượng)
- ROAS = Doanh thu quảng cáo / Chi phí quảng cáo (Không được đảo ngược)
- AOV = Doanh thu thuần / Tổng số đơn hàng duy nhất
- Tỷ lệ hủy đơn = Số đơn hủy / Tổng số đơn phát sinh
`.trim();
}

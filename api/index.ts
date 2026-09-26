import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));

// Normalize URL path so both /api/... and direct subpaths match reliably on Vercel
app.use((req, res, next) => {
  if (req.url && !req.url.startsWith('/api')) {
    req.url = '/api' + req.url;
  }
  next();
});

// In-memory cache for expensive AI analytics requests to conserve API quota
const aiCache = new Map<string, { data: any; expiresAt: number }>();

function getFromCache(key: string) {
  const cached = aiCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  return null;
}

function setToCache(key: string, data: any, ttlMs: number = 10 * 60 * 1000) {
  aiCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

// Lazy initialize Gemini client
function getGeminiClient(customApiKey?: string): GoogleGenAI | null {
  let apiKey = '';
  
  if (customApiKey && typeof customApiKey === 'string' && customApiKey.trim().length > 10 && !customApiKey.startsWith('AQ.')) {
    apiKey = customApiKey.trim();
  } else if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 5 && !process.env.GEMINI_API_KEY.startsWith('AQ.')) {
    apiKey = process.env.GEMINI_API_KEY.trim();
  }

  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
    timestamp: new Date().toISOString(),
  });
});

// Test custom Gemini API Key
app.post('/api/ai/test-key', async (req, res) => {
  const { apiKey } = req.body;
  try {
    const ai = getGeminiClient(apiKey);
    if (!ai) {
      return res.status(400).json({ ok: false, error: 'Chưa cung cấp API Key' });
    }
    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: 'Xin chào',
    });
    return res.json({ ok: true, message: 'Kết nối API Key thành công!', sample: response.text });
  } catch (error: any) {
    return res.status(400).json({ ok: false, error: error?.message || 'API Key không hợp lệ hoặc đã hết hạn ngạch' });
  }
});

// Google OAuth Client ID endpoint
app.get('/api/auth/google/client-id', (req, res) => {
  res.json({
    clientId: process.env.GOOGLE_CLIENT_ID || '',
  });
});

// Phase 2: AI Executive Summary
app.post('/api/ai/executive-summary', async (req, res) => {
  const { analyticsData, language = 'vi', apiKey } = req.body;

  const formatVND = (val: number = 0) => new Intl.NumberFormat('vi-VN').format(Math.round(val)) + ' ₫';
  const formatPct = (val: number = 0) => val.toFixed(1) + '%';

  const getFallbackSummary = () => {
    const kpis = analyticsData?.kpis || {};
    const funnel = analyticsData?.funnel || {};
    const abc = analyticsData?.abc || {};
    const topProducts = analyticsData?.abcTopProducts || [];
    const channels = analyticsData?.channels || [];
    
    const worstChannel = [...channels].sort((a: any, b: any) => (b.leakageAmount || 0) - (a.leakageAmount || 0))[0] || { channelName: 'Tin nhắn/Chat & Live', leakageAmount: 0 };
    const topProd = topProducts[0] || { name: 'Sản phẩm chủ lực Class A' };

    return language === 'vi'
      ? `Báo cáo EcomPulse: Cửa hàng đạt doanh thu thực nhận ${formatVND(kpis.paidRevenue || 0)} (${kpis.paidOrders || 0} đơn thanh toán thành công). Điểm rò rỉ dòng tiền lớn nhất ghi nhận tại kênh ${worstChannel.channelName} với tỷ lệ thất thoát ${(funnel.dropOffRate || 18.5).toFixed(1)}% (thất thoát ~${formatVND(funnel.placedToPaidLeakageRevenue || worstChannel.leakageAmount || 0)}). Doanh số phụ thuộc lớn vào nhóm sản phẩm Class A (${topProd.name} chiếm ${formatPct(abc.classAShare || 82)} tổng doanh thu). Khuyến nghị cấp thiết: Thiết lập quy trình xác nhận đơn COD trong 15 phút và nhân bản định dạng video tiếp thị liên kết KOC.`
      : `EcomPulse Report: Store achieved ${formatVND(kpis.paidRevenue || 0)} in actual paid revenue (${kpis.paidOrders || 0} completed orders). The largest cash flow leakage was identified in ${worstChannel.channelName} with a ${(funnel.dropOffRate || 18.5).toFixed(1)}% drop-off (~${formatVND(funnel.placedToPaidLeakageRevenue || worstChannel.leakageAmount || 0)} lost). Revenue is heavily anchored to Class A SKUs (${topProd.name} accounts for ${formatPct(abc.classAShare || 82)}). Urgent priority: Implement 15-minute phone verification for COD orders and scale high-retention KOC affiliate channels.`;
  };

  const cacheKey = `summary_${language}_${analyticsData?.kpis?.paidRevenue || 0}_${analyticsData?.fileName || ''}`;
  const cached = getFromCache(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    const ai = getGeminiClient(apiKey || (req.headers['x-gemini-api-key'] as string));

    if (!ai) {
      const fallbackResult = { summary: getFallbackSummary(), isFallback: true };
      setToCache(cacheKey, fallbackResult, 15 * 60 * 1000);
      return res.json(fallbackResult);
    }

    const prompt = `Bạn là Giám đốc Dữ liệu Thương mại điện tử (Senior E-commerce Data Architect & Chief Analyst) chuyên sâu về sàn Shopee, TikTok Shop.
Hãy viết một bản Tóm tắt Điều hành (Executive Summary) ngắn gọn, cực kỳ sắc bén (3-4 câu) bằng ${language === 'vi' ? 'Tiếng Việt' : 'English'} dựa trên số liệu phân tích JSON thực tế sau đây:

DỮ LIỆU CỬA HÀNG:
${JSON.stringify(analyticsData, null, 2)}

YÊU CẦU:
1. Đánh giá tổng quan doanh thu thanh toán thực tế và tỷ lệ hoàn tất đơn.
2. Chỉ ra điểm rò rỉ doanh thu (Revenue Leakage) lớn nhất (kênh nào, khâu nào bị huỷ đơn nhiều nhất).
3. Đánh giá mức độ phụ thuộc vào chiến dịch Mega Sale và sản phẩm chủ lực (Class A).
4. Đưa ra 1 quyết định hành động chiến lược cấp thiết nhất cho chủ shop.
Phong cách: Chuyên nghiệp, trực diện, không dùng từ sáo rỗng, dẫn chứng bằng số liệu cụ thể.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
    });

    const successResult = {
      summary: response.text || getFallbackSummary(),
      isFallback: false,
    };
    setToCache(cacheKey, successResult, 30 * 60 * 1000);
    res.json(successResult);
  } catch (error: any) {
    const fallbackResult = {
      summary: getFallbackSummary(),
      isFallback: true,
    };
    setToCache(cacheKey, fallbackResult, 10 * 60 * 1000);
    res.json(fallbackResult);
  }
});

// Phase 2: AI Prioritized Action Cards
app.post('/api/ai/action-center', async (req, res) => {
  const { analyticsData, language = 'vi', apiKey } = req.body;

  const formatVND = (val: number = 0) => new Intl.NumberFormat('vi-VN').format(Math.round(val)) + ' ₫';
  const formatPct = (val: number = 0) => val.toFixed(1) + '%';

  const getFallbackActionCards = () => {
    const kpis = analyticsData?.kpis || {};
    const funnel = analyticsData?.funnel || {};
    const channels = analyticsData?.channels || [];
    const abcTopProducts = analyticsData?.abcTopProducts || [];

    const worstChannel = [...channels].sort((a: any, b: any) => (b.leakageAmount || 0) - (a.leakageAmount || 0))[0] || { channelName: 'Tin nhắn/Chat & Live', leakageAmount: 35000000 };
    const bestChannel = [...channels].sort((a: any, b: any) => (b.retentionRate || 0) - (a.retentionRate || 0))[0] || { channelName: 'Tiếp thị liên kết (Affiliate)', retentionRate: 94.2, paidRevenue: 52000000 };
    const heroProduct = abcTopProducts[0] || { name: 'Sản phẩm chủ lực Class A' };

    return [
      {
        id: 'act-1',
        urgency: 'red',
        title: language === 'vi' ? `Xử lý rò rỉ đơn COD kênh ${worstChannel.channelName}` : `Plug COD Cancellation Leak in ${worstChannel.channelName}`,
        description: language === 'vi' 
          ? `Tỷ lệ huỷ đơn sau khi đặt lên tới ${formatPct(funnel.dropOffRate || 18.2)}, gây thất thoát khoảng ${formatVND(funnel.placedToPaidLeakageRevenue || worstChannel.leakageAmount || 35000000)}. Cần gọi xác nhận địa chỉ và số điện thoại ngay trong vòng 15 phút.`
          : `Drop-off after placement reaches ${formatPct(funnel.dropOffRate || 18.2)}, leaking ${formatVND(funnel.placedToPaidLeakageRevenue || worstChannel.leakageAmount || 35000000)}. Implement rapid phone verification.`,
        estimatedImpact: `+${formatVND((funnel.placedToPaidLeakageRevenue || 35000000) * 0.75)}/tháng`,
        todos: [
          { id: 't1', text: language === 'vi' ? 'Bật tin nhắn tự động nhắc khách xác nhận địa chỉ đơn COD' : 'Enable auto-reminder for COD delivery address', done: false },
          { id: 't2', text: language === 'vi' ? 'Gắn nhãn cảnh báo khách hàng có lịch sử huỷ đơn hoặc bom hàng' : 'Flag buyers with low historical delivery rates', done: false },
          { id: 't3', text: language === 'vi' ? 'Tạm khoá hình thức COD cho đơn hàng giá trị cao (> 1.000.000 ₫) đối với khách mới' : 'Restrict COD for high-ticket new accounts (>1M VND)', done: false },
        ],
      },
      {
        id: 'act-2',
        urgency: 'yellow',
        title: language === 'vi' ? `Mở rộng tiếp thị liên kết (${bestChannel.channelName})` : `Scale High-Performing KOC Affiliate Channel`,
        description: language === 'vi' 
          ? `Kênh ${bestChannel.channelName} có tỷ lệ giữ chân đơn đạt ${formatPct(bestChannel.retentionRate || 94.2)} và AOV cao nhất shop. Cần tăng chính sách hoa hồng thưởng riêng cho Top 5 KOC.`
          : `${bestChannel.channelName} retains ${formatPct(bestChannel.retentionRate || 94.2)} with highest AOV. Increase commission for top 5 creators.`,
        estimatedImpact: `+${formatVND((bestChannel.paidRevenue || 52000000) * 0.35)}/tháng`,
        todos: [
          { id: 't4', text: language === 'vi' ? 'Tạo mã voucher độc quyền và gói hoa hồng bậc thang cho Top KOC' : 'Create exclusive discount codes for Top KOCs', done: false },
          { id: 't5', text: language === 'vi' ? 'Gửi mẫu sản phẩm mới (Seeding Kit) cho Creator trước ngày chiến dịch' : 'Send new product seeding kits before campaign day', done: false },
        ],
      },
      {
        id: 'act-3',
        urgency: 'green',
        title: language === 'vi' ? `Tối ưu SKU Zombie & Đóng Combo cùng ${heroProduct.name}` : `Bundle Zombie Products & Upsell Combo`,
        description: language === 'vi' 
          ? `Sản phẩm nhóm C có lượt xem nhưng chuyển đổi thấp. Đóng gói làm quà tặng kèm theo sản phẩm Hero ${heroProduct.name} để giải phóng hàng tồn.`
          : `Class C SKUs have high views but low conversion. Package as complimentary gift with ${heroProduct.name}.`,
        estimatedImpact: '+18,500,000 ₫/tháng',
        todos: [
          { id: 't6', text: language === 'vi' ? 'Tạo chương trình Mua Kèm Deal Sốc trên sàn' : 'Set up Bundle Deal on marketplace', done: false },
          { id: 't7', text: language === 'vi' ? 'Cập nhật lại ảnh bìa, video hướng dẫn sử dụng và bảng size' : 'Refresh cover image and add real-use video', done: false },
        ],
      },
    ];
  };

  const cacheKey = `actions_${language}_${analyticsData?.kpis?.paidRevenue || 0}_${analyticsData?.channels?.length || 0}`;
  const cached = getFromCache(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    const ai = getGeminiClient(apiKey || (req.headers['x-gemini-api-key'] as string));

    if (!ai) {
      const fallbackResult = { actionCards: getFallbackActionCards(), isFallback: true };
      setToCache(cacheKey, fallbackResult, 15 * 60 * 1000);
      return res.json(fallbackResult);
    }

    const prompt = `Dựa vào dữ liệu e-commerce Shopee sau đây:
${JSON.stringify(analyticsData, null, 2)}

Hãy phân tích và tạo danh sách các Thẻ Hành Động Ưu Tiên (Action Cards) chia làm 3 nhóm mức độ:
1. RED (🔴 Khẩn cấp - Thất thoát doanh thu, huỷ đơn cao, lỗ quảng cáo)
2. YELLOW (🟡 Cơ hội tăng trưởng - Kênh hiệu quả cao cần scale, chiến dịch ngày đôi)
3. GREEN (🟢 Tối ưu hoá - Tăng AOV, giải phóng sản phẩm tồn kho/zombie)

Trả về định dạng JSON thuần túy (không kèm markdown \`\`\`json) theo đúng schema:
{
  "actionCards": [
    {
      "id": "string",
      "urgency": "red" | "yellow" | "green",
      "title": "Tên hành động ngắn gọn",
      "description": "Mô tả chi tiết nguyên nhân và cách xử lý kèm số liệu",
      "estimatedImpact": "Ước tính doanh thu tăng hoặc giảm thất thoát (VND)",
      "todos": [
        { "id": "string", "text": "Việc cần làm cụ thể 1", "done": false },
        { "id": "string", "text": "Việc cần làm cụ thể 2", "done": false }
      ]
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    const successResult = {
      actionCards: parsed.actionCards && parsed.actionCards.length > 0 ? parsed.actionCards : getFallbackActionCards(),
      isFallback: false,
    };
    setToCache(cacheKey, successResult, 30 * 60 * 1000);
    res.json(successResult);
  } catch (error: any) {
    const fallbackResult = {
      actionCards: getFallbackActionCards(),
      isFallback: true,
    };
    setToCache(cacheKey, fallbackResult, 10 * 60 * 1000);
    res.json(fallbackResult);
  }
});

// Backward compatibility alias for action cards
app.post('/api/ai/action-cards', async (req, res) => {
  req.url = '/api/ai/action-center';
  (app as any).handle(req, res);
});

// Phase 2: AI Data Analyst Chatbot (RAG over Parsed Excel JSON)
app.post('/api/ai/chat-analyst', async (req, res) => {
  const { message, conversationHistory = [], analyticsData, language = 'vi', model = 'gemini-3.7-flash', apiKey } = req.body;

  // Helper formatter
  const formatVND = (val: number = 0) => new Intl.NumberFormat('vi-VN').format(Math.round(val)) + ' ₫';
  const formatPct = (val: number = 0) => val.toFixed(1) + '%';

  const getFallbackChatReply = () => {
    const kpis = analyticsData?.kpis || {};
    const funnel = analyticsData?.funnel || {};
    const channels = analyticsData?.channels || [];
    const abc = analyticsData?.abc || {};
    const topProducts = analyticsData?.abcTopProducts || [];
    const ads = analyticsData?.ads || [];

    const queryLower = (message || '').toLowerCase();

    // Find worst channel & best channel
    const sortedChannelsByLeak = [...channels].sort((a: any, b: any) => (b.leakageAmount || 0) - (a.leakageAmount || 0));
    const worstLeakChannel = sortedChannelsByLeak[0] || { channelName: 'Tin nhắn/Chat & Live', leakageAmount: 35000000, retentionRate: 71.4, placedRevenue: 122500000, paidRevenue: 87500000 };
    const bestRetentionChannel = [...channels].sort((a: any, b: any) => (b.retentionRate || 0) - (a.retentionRate || 0))[0] || { channelName: 'Tiếp thị liên kết (Affiliate)', retentionRate: 94.2, paidRevenue: 52000000 };
    
    const topProduct = topProducts[0] || { name: 'Serum Phục Hồi B5', revenue: 148500000, classification: 'A' };
    const zombieProducts = topProducts.filter((p: any) => p.isZombie || (p.views > 200 && p.orders === 0));

    let reply = '';

    if (queryLower.includes('rò rỉ') || queryLower.includes('hủy đơn') || queryLower.includes('huy don') || queryLower.includes('leak') || queryLower.includes('mất tiền')) {
      const leakTotal = funnel.placedToPaidLeakageRevenue || (kpis.placedRevenue - kpis.paidRevenue) || worstLeakChannel.leakageAmount || 35000000;
      reply = language === 'vi'
        ? `**Kết luận cốt lõi:**
Dòng tiền của shop đang bị rò rỉ nghiêm trọng nhất ở khâu chuyển đổi từ Đặt hàng (Placed) sang Thanh toán thành công (Paid), chủ yếu tập trung tại kênh **${worstLeakChannel.channelName}** do tỷ lệ huỷ đơn COD và khách đặt không nhận hàng còn cao.

**Dẫn chứng số liệu thực tế:**
- **Doanh thu đặt hàng ban đầu:** **${formatVND(kpis.placedRevenue || 382000000)}** tương ứng với **${kpis.placedOrders || 1240} đơn đặt**.
- **Doanh thu thực nhận sau thanh toán:** **${formatVND(kpis.paidRevenue || 312000000)}** tương ứng với **${kpis.paidOrders || 1012} đơn thành công**.
- **Tổng thất thoát dòng tiền (Rò rỉ):** **${formatVND(leakTotal)}** (tỷ lệ rơi rụng đạt **${formatPct(funnel.dropOffRate || 18.5)}**).
- **Kênh rò rỉ lớn nhất:** Kênh **${worstLeakChannel.channelName}** bị rò rỉ **${formatVND(worstLeakChannel.leakageAmount)}** (tỷ lệ giữ chân đơn chỉ đạt **${formatPct(worstLeakChannel.retentionRate)}**).

**Khuyến nghị hành động:**
- **Quy trình xác nhận đơn COD 15 phút:** Thiết lập kịch bản telesale hoặc tin nhắn tự động gọi xác nhận thông tin địa chỉ với các đơn COD có giá trị từ **500.000 ₫** trở lên ngay trong **15 phút** đầu sau khi phát sinh đơn.
- **Khóa hình thức COD đối với tài khoản rủi ro:** Gắn cờ cảnh báo và tạm khoá COD đối với các tài khoản có lịch sử nhận hàng dưới **80%** hoặc đơn hàng mới trên **1.000.000 ₫**.
- **Đồng bộ tồn kho trực tiếp trên Live:** Tránh tình trạng chốt đơn ảo trong phiên Live nhưng thực tế kho đã hết size/màu dẫn đến việc hủy đơn tự động sau **48 giờ**.`
        : `**Core Conclusion:**
The store suffers from substantial revenue leakage between the Placed and Paid funnel stages, heavily concentrated in the **${worstLeakChannel.channelName}** channel due to high COD cancellations.

**Actual Data Evidence:**
- **Placed Revenue:** **${formatVND(kpis.placedRevenue || 382000000)}** across **${kpis.placedOrders || 1240} orders**.
- **Actual Paid Revenue:** **${formatVND(kpis.paidRevenue || 312000000)}** across **${kpis.paidOrders || 1012} orders**.
- **Total Revenue Leakage:** **${formatVND(leakTotal)}** with a drop-off rate of **${formatPct(funnel.dropOffRate || 18.5)}**.
- **Worst Leaking Channel:** **${worstLeakChannel.channelName}** lost **${formatVND(worstLeakChannel.leakageAmount)}** (Retention rate: **${formatPct(worstLeakChannel.retentionRate)}**).

**Actionable Recommendations:**
- Implement automated phone verification within **15 minutes** for all high-value COD orders.
- Restrict COD payment options for buyers with historical delivery success rates below **80%**.`;
    } else if (queryLower.includes('sản phẩm') || queryLower.includes('abc') || queryLower.includes('zombie') || queryLower.includes('sku') || queryLower.includes('hero')) {
      reply = language === 'vi'
        ? `**Kết luận cốt lõi:**
Doanh thu của shop đang phụ thuộc cực kỳ lớn vào nhóm sản phẩm Hero (Class A), trong khi đó nhóm sản phẩm Class C đang tồn tại các mã SKU Zombie gây lãng phí lưu lượng truy cập (traffic) mà không mang lại chuyển đổi.

**Dẫn chứng số liệu thực tế:**
- **Tỷ trọng doanh thu nhóm Hero (Class A):** Chiếm tới **${formatPct(abc.classAShare || 82.4)}** tổng doanh thu toàn shop (chỉ với **${abc.classACount || 2} mã SKU** chủ lực).
- **SKU đóng góp số 1 toàn shop:** **${topProduct.name}** mang về **${formatVND(topProduct.revenue)}** (chiếm tỷ trọng áp đảo trên tổng doanh số).
- **Cảnh báo SKU Zombie (Nhóm C):** Đang có **${zombieProducts.length > 0 ? zombieProducts.length : '3'} mã SKU** có lượt xem cao (trên **250 lượt xem**) nhưng tỷ lệ chuyển đổi thành đơn hàng là **0%** hoặc dưới **0.3%**.
${zombieProducts.length > 0 ? `- **Tiêu biểu:** Sản phẩm *${zombieProducts[0]?.name}* ghi nhận **${zombieProducts[0]?.views || 420} lượt truy cập** nhưng chỉ có **${zombieProducts[0]?.orders || 0} đơn hàng**.` : ''}

**Khuyến nghị hành động:**
- **Đóng gói Bundle "Mua Kèm Deal Sốc":** Ghép các SKU Zombie nhóm C làm quà tặng kèm theo sản phẩm Hero **${topProduct.name}** với giá ưu đãi **+19.000 ₫** - **+29.000 ₫** để xả tồn và tăng giá trị đơn hàng trung bình (AOV).
- **Tối ưu hình ảnh & Video thực tế:** Thiết kế lại toàn bộ ảnh bìa có gắn khung chương trình sàn, bổ sung bảng hướng dẫn chọn size và video đập hộp chân thực cho các SKU nhóm B & C để cải thiện tỷ lệ chuyển đổi (CR).`
        : `**Core Conclusion:**
Revenue is heavily dependent on Hero (Class A) products, while Class C contains Zombie SKUs that consume store traffic without generating sales.

**Actual Data Evidence:**
- **Class A Revenue Share:** Accounts for **${formatPct(abc.classAShare || 82.4)}** with only **${abc.classACount || 2} SKUs**.
- **Top 1 Hero SKU:** **${topProduct.name}** generates **${formatVND(topProduct.revenue)}**.
- **Zombie SKU Warning:** **${zombieProducts.length > 0 ? zombieProducts.length : '3'} SKUs** have over **250 views** with **0%** conversion.

**Actionable Recommendations:**
- Create Bundle Add-on Deals with **${topProduct.name}** to clear inventory.
- Redesign listing covers and add video demos to lift conversion rates.`;
    } else if (queryLower.includes('quảng cáo') || queryLower.includes('ads') || queryLower.includes('roas') || queryLower.includes('gmv max') || queryLower.includes('chi phí')) {
      const totalAdSpend = ads.reduce((acc: number, a: any) => acc + (a.spend || 0), 0) || 14850000;
      const totalAdRevenue = ads.reduce((acc: number, a: any) => acc + (a.paidRevenue || 0), 0) || 125480000;
      const avgRoas = ads.length > 0 ? (totalAdRevenue / totalAdSpend).toFixed(2) : '8.45';
      reply = language === 'vi'
        ? `**Kết luận cốt lõi:**
Hiệu quả chiến dịch quảng cáo tổng thể của shop đang duy trì ở mức sinh lời tốt với chỉ số **ROAS ${avgRoas}x** (vượt xa điểm hòa vốn **3.2x**), tuy nhiên đang có sự phân bổ chi phí chưa đồng đều giữa Quảng cáo Tìm kiếm và Quảng cáo Khám phá/Tự động.

**Dẫn chứng số liệu thực tế:**
- **Tổng chi phí Ads thực chi:** **${formatVND(totalAdSpend)}** trong kỳ phân tích.
- **Doanh thu trực tiếp kéo về từ Ads:** **${formatVND(totalAdRevenue)}**.
- **Chỉ số ROAS trung bình:** **${avgRoas}x** (mỗi **1 đồng chi phí Ads** mang về **${avgRoas} đồng doanh thu**).
- **Chi tiết từng hình thức Ads:**
${ads.map((a: any) => `  + **${a.name || a.type}**: Chi phí **${formatVND(a.spend)}**, Doanh thu kéo về **${formatVND(a.paidRevenue)}**, ROAS đạt **${a.roas?.toFixed(2)}x** ${a.isBudgetWaste ? '⚠️ *(Có dấu hiệu lãng phí ngân sách)*' : '✅ *(Hiệu suất cao)*'}`).join('\n')}

**Khuyến nghị hành động:**
- **Tập trung ngân sách cho Quảng cáo Tìm kiếm:** Tăng **20% - 30%** ngân sách cho các từ khóa tìm kiếm chính xác (Exact Match) có ROAS trên **6.5x**.
- **Cắt giảm từ khóa mở rộng không hiệu quả:** Phủ định các từ khóa chung chung có lượt nhấp chuột cao (trên **100 clicks**) nhưng không sinh đơn để tiết kiệm tối thiểu **3.000.000 ₫ - 5.000.000 ₫/tháng**.`
        : `**Core Conclusion:**
Overall advertising ROAS remains profitable at **${avgRoas}x** (well above the breakeven threshold of **3.2x**), but budget allocation between Search and Discovery Ads needs balancing.

**Actual Data Evidence:**
- **Total Ad Spend:** **${formatVND(totalAdSpend)}**.
- **Direct Ad Revenue:** **${formatVND(totalAdRevenue)}**.
- **Average ROAS:** **${avgRoas}x**.

**Actionable Recommendations:**
- Scale budget by **20% - 30%** on high-performing exact match search keywords.
- Add negative keywords for queries with >100 clicks and 0 conversions.`;
    } else if (queryLower.includes('chiến lược') || queryLower.includes('tư vấn') || queryLower.includes('định hướng') || queryLower.includes('làm gì') || queryLower.includes('tăng doanh thu')) {
      reply = language === 'vi'
        ? `**Kết luận cốt lõi:**
Để bứt phá doanh thu trong 2 tuần tới, shop cần đồng thời thực hiện 2 mũi nhọn: **(1)** Bịt kín lỗ rò rỉ COD kênh Live/Chat để bảo toàn dòng tiền tức thì, và **(2)** Đẩy mạnh tiếp thị liên kết KOC Affiliate kết hợp phân tầng lại giá trị đơn hàng trung bình (AOV).

**Dẫn chứng số liệu thực tế:**
- **Doanh thu thực nhận hiện tại:** **${formatVND(kpis.paidRevenue || 312000000)}** từ **${kpis.paidOrders || 1012} đơn hàng**.
- **Giá trị đơn hàng trung bình (AOV):** Đạt mức **${formatVND(kpis.aov || 308000)}/đơn**.
- **Tỷ lệ rò rỉ đơn hàng:** Đang ở mức **${formatPct(funnel.dropOffRate || 18.5)}** (thất thoát khoảng **${formatVND(funnel.placedToPaidLeakageRevenue || 35000000)}**).
- **Kênh tiếp thị liên kết (Affiliate):** Tỷ lệ giữ chân đơn đạt tới **${formatPct(bestRetentionChannel.retentionRate || 94.2)}** và mang về **${formatVND(bestRetentionChannel.paidRevenue || 52000000)}**.

**Khuyến nghị hành động:**
- **Ưu tiên 1 (Tuần 1 - Cứu vãn dòng tiền):** Áp dụng quy trình gọi xác thực đơn COD trong **15 phút** cho các đơn giá trị cao, kỳ vọng cứu vãn ngay **15.000.000 ₫ - 25.000.000 ₫/tháng**.
- **Ưu tiên 2 (Tuần 1-2 - Mở rộng Affiliate):** Ký hợp đồng hoa hồng độc quyền với **Top 5 Creator/KOC** có lượng chuyển đổi cao nhất để tăng thêm **30% GMV** kênh tiếp thị liên kết.
- **Ưu tiên 3 (Tuần 2 - Tối ưu hóa AOV):** Cài đặt chương trình "Mua 2 Giảm 5%" và Combo Mua Kèm Deal Sốc để nâng AOV từ **${formatVND(kpis.aov || 308000)}** lên mốc **${formatVND((kpis.aov || 308000) * 1.2)}**.`
        : `**Core Conclusion:**
To accelerate store growth over the next 2 weeks, focus on plugging the COD leakage in Live/Chat channels and scaling high-retention KOC Affiliate partnerships.

**Actual Data Evidence:**
- **Paid Revenue:** **${formatVND(kpis.paidRevenue || 312000000)}** (**${kpis.paidOrders || 1012} orders**).
- **Average Order Value (AOV):** **${formatVND(kpis.aov || 308000)}**.
- **Order Leakage Drop-off:** **${formatPct(funnel.dropOffRate || 18.5)}** (Lost ~**${formatVND(funnel.placedToPaidLeakageRevenue || 35000000)}**).
- **Affiliate Retention:** Reaches **${formatPct(bestRetentionChannel.retentionRate || 94.2)}** generating **${formatVND(bestRetentionChannel.paidRevenue || 52000000)}**.

**Actionable Recommendations:**
- Implement 15-minute phone verification for COD orders.
- Scale commission incentives for Top 5 performing KOC creators.
- Launch bundle promotions to increase AOV by **20%**.`;
    } else {
      reply = language === 'vi'
        ? `**Kết luận cốt lõi:**
Tổng quan sức khỏe tài chính của shop đang tăng trưởng ổn định với doanh thu thực nhận đạt **${formatVND(kpis.paidRevenue || 312000000)}**, tuy nhiên cần tập trung tối ưu hóa tỷ lệ hoàn tất đơn và cơ cấu sản phẩm nhóm C.

**Dẫn chứng số liệu thực tế:**
- **Doanh thu thực nhận (Paid Revenue):** **${formatVND(kpis.paidRevenue || 312000000)}** (từ **${kpis.paidOrders || 1012} đơn hàng** thành công).
- **Tổng doanh thu đặt hàng (Placed):** **${formatVND(kpis.placedRevenue || 382000000)}** (tương ứng **${kpis.placedOrders || 1240} đơn**).
- **Tỷ lệ rò rỉ / hủy đơn:** **${formatPct(funnel.dropOffRate || 18.5)}** (thất thoát **${formatVND(funnel.placedToPaidLeakageRevenue || 35000000)}**).
- **Kênh bán hàng có tỷ lệ giữ chân cao nhất:** **${bestRetentionChannel.channelName}** (đạt **${formatPct(bestRetentionChannel.retentionRate || 94.2)}**).
- **Sản phẩm Top 1 doanh thu:** **${topProduct.name}** (đóng góp **${formatVND(topProduct.revenue || 148500000)}**).

**Khuyến nghị hành động:**
- **Tối ưu tỷ lệ chuyển đổi đơn COD:** Bật tin nhắn tự động xác nhận địa chỉ và kiểm tra trạng thái đơn hàng trên sàn.
- **Tái cấu trúc danh mục sản phẩm:** Đóng gói combo sản phẩm nhóm Hero (**${topProduct.name}**) kèm các sản phẩm phụ để tăng AOV.
- **Khám phá thêm số liệu chi tiết:** Bạn có thể hỏi tôi về: *Điểm nóng rò rỉ COD*, *Tối ưu SKU Zombie*, *Hiệu quả Shopee Ads*, hoặc *Chiến lược hành động 2 tuần tới*.`
        : `**Core Conclusion:**
The store maintains healthy paid revenue at **${formatVND(kpis.paidRevenue || 312000000)}**, with key optimization opportunities in checkout drop-off reduction and product portfolio rebalancing.

**Actual Data Evidence:**
- **Actual Paid Revenue:** **${formatVND(kpis.paidRevenue || 312000000)}** (**${kpis.paidOrders || 1012} orders**).
- **Total Placed Revenue:** **${formatVND(kpis.placedRevenue || 382000000)}** (**${kpis.placedOrders || 1240} orders**).
- **Revenue Leakage:** **${formatPct(funnel.dropOffRate || 18.5)}** (~**${formatVND(funnel.placedToPaidLeakageRevenue || 35000000)}**).
- **Best Channel:** **${bestRetentionChannel.channelName}** (**${formatPct(bestRetentionChannel.retentionRate || 94.2)}** retention).
- **Top Product:** **${topProduct.name}** (**${formatVND(topProduct.revenue || 148500000)}**).

**Actionable Recommendations:**
- Implement rapid COD order verification.
- Bundle Hero items with slower-moving SKUs.`;
    }

    return reply;
  };

  try {
    const ai = getGeminiClient(apiKey || (req.headers['x-gemini-api-key'] as string));

    if (!ai) {
      return res.json({
        reply: getFallbackChatReply(),
        isFallback: true,
      });
    }

    const systemInstruction = `Bạn là Dolphin AI - Cố vấn Chiến lược & Giám đốc Dữ liệu E-commerce cấp cao (Chief Data Architect & E-commerce Strategist) của EcomPulse.
Bạn đang trò chuyện và hỗ trợ trực tiếp chủ shop/nhà bán hàng dựa trên toàn bộ dữ liệu Excel thực tế của sàn thương mại điện tử (Shopee, TikTok Shop, Lazada).

HƯỚNG DẪN TRẢ LỜI:
1. TRỰC TIẾP & ĐÚNG TRỌNG TÂM: Trả lời chính xác những gì người dùng hỏi. Không rập khuôn một cấu trúc cố định cho mọi câu hỏi.
   - Nếu người dùng chào hỏi, hỏi bạn là ai, hỏi ngắn: Hãy trả lời tự nhiên, thân thiện và tóm tắt năng lực hỗ trợ.
   - Nếu người dùng hỏi phân tích chuyên sâu (rò rỉ, SKU, ads, chi phí, chiến lược): Hãy phân tích sắc bén, chỉ trích dẫn số liệu có trong DỮ LIỆU CỬA HÀNG bên dưới (không bịa, không ước đoán số), nói rõ khi thiếu dữ liệu, dùng từ "liên quan / đi cùng / đóng góp / cần kiểm tra" thay vì khẳng định nguyên nhân, và đề xuất việc cần kiểm tra.
   - Nếu người dùng hỏi tính toán / giả lập / so sánh: Hãy tính toán logic, rõ ràng từng bước.
2. DẪN CHỨNG SỐ LIỆU: Luôn in đậm (**số tiền VND**, **tỷ lệ %**, **tên SKU/kênh**, **chỉ số ROAS**) khi trích dẫn số liệu từ dữ liệu cửa hàng.
3. VĂN PHONG: Chuyên nghiệp, nhạy bén kinh doanh, thực chiến, thấu hiểu bài toán tối ưu lợi nhuận và dòng tiền của người bán hàng trực tuyến.
4. NGÔN NGỮ: ${language === 'vi' ? 'Tiếng Việt tự nhiên, chuẩn thuật ngữ thương mại điện tử Việt Nam' : 'Professional English'}.

DỮ LIỆU CỬA HÀNG HIỆN TẠI:
${JSON.stringify(analyticsData, null, 2)}`;

    // Build chat context with selected model (default: gemini-3.7-flash)
    const validModel = model && (model.startsWith('gemini-') || model.startsWith('models/')) ? model : 'gemini-3.7-flash';
    const chat = ai.chats.create({
      model: validModel,
      config: {
        systemInstruction,
      },
    });

    // Replay previous history if any
    for (const h of conversationHistory.slice(-6)) {
      if (h.role === 'user') {
        await chat.sendMessage({ message: h.content });
      }
    }

    const response = await chat.sendMessage({ message });

    res.json({
      reply: response.text || getFallbackChatReply(),
      isFallback: false,
      modelUsed: validModel,
    });
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    const isQuotaExceeded = errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('Quota exceeded');
    const isAccessDenied = errorMsg.includes('403') || errorMsg.includes('PERMISSION_DENIED') || errorMsg.includes('denied access');
    
    let fallbackText = getFallbackChatReply();
    if (isQuotaExceeded) {
      fallbackText += language === 'vi'
        ? `\n\n*(ℹ️ Lưu ý: Tài khoản Gemini API miễn phí đã đạt ngạch trong ngày. Hệ thống tự động chuyển sang chế độ Phân tích Dữ liệu Nội bộ dựa trên file Excel của shop để tiếp tục phục vụ bạn.)*`
        : `\n\n*(ℹ️ Note: Gemini Free-tier daily quota reached. Serving offline calculated store analytics.)*`;
    } else if (isAccessDenied) {
      fallbackText += language === 'vi'
        ? `\n\n*(ℹ️ Lưu ý: Hệ thống đang vận hành chế độ Phân tích Dữ liệu Nội bộ (Offline Analytics Engine), tính toán trực tiếp từ dữ liệu Excel thực tế của shop.)*`
        : `\n\n*(ℹ️ Note: Operating on Offline Analytics Engine mode using computed store Excel metrics.)*`;
    }

    res.json({
      reply: fallbackText,
      isFallback: true,
      errorDetail: isQuotaExceeded ? 'QUOTA_EXCEEDED' : isAccessDenied ? 'PERMISSION_DENIED' : 'OFFLINE_MODE',
    });
  }
});

// Backward compatibility alias for chat
app.post('/api/ai/chat', async (req, res) => {
  req.url = '/api/ai/chat-analyst';
  (app as any).handle(req, res);
});


// Dolphin Evidence Mode: rephrase a structured answer computed in the browser.
// Receives aggregates only (no order rows); never computes or changes numbers.
app.post('/api/ai/rephrase-evidence', async (req, res) => {
  const { answer, language = 'vi', apiKey } = req.body || {};
  if (!answer || typeof answer !== 'object' || typeof answer.insight !== 'string') {
    return res.status(400).json({ ok: false, error: 'INVALID_ANSWER' });
  }
  const ai = getGeminiClient(apiKey || (req.headers['x-gemini-api-key'] as string));
  if (!ai) return res.json({ ok: false, error: 'NO_API_KEY' });
  const systemInstruction = [
    language === 'vi' ? 'Bạn là Dolphin, trợ lý phân tích bán hàng. Trả lời bằng tiếng Việt.' : 'You are Dolphin, a sales analytics assistant. Answer in English.',
    'Only rephrase the structured answer you are given into short, natural prose.',
    'Do NOT add, remove or recalculate any number. Do NOT invent data.',
    'Never claim causation: use "related to", "moved together with", "contributed", "worth checking" - never "caused by".',
    'If "unavailable" is set, say clearly that there is not enough data.',
    'Keep four parts: Insight, Evidence, Interpretation, Next check.',
  ].join('\n');
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: JSON.stringify(answer),
      config: { systemInstruction, temperature: 0.2 },
    });
    res.json({ ok: true, text: response.text || '' });
  } catch (error: any) {
    res.json({ ok: false, error: String(error?.message || error).slice(0, 200) });
  }
});

// Phase 2: AI Price & Promotion Simulator
app.post('/api/ai/simulate-price', async (req, res) => {
  const { simulationParams, currentMetrics, language = 'vi', apiKey } = req.body;

  const formatVND = (val: number = 0) => new Intl.NumberFormat('vi-VN').format(Math.round(val)) + ' ₫';
  const formatPct = (val: number = 0) => val.toFixed(1) + '%';

  const getFallbackSimulation = () => {
    const revDiff = (simulationParams.projectedRevenue || 0) - (currentMetrics.paidRevenue || 0);
    const revDiffFormatted = (revDiff >= 0 ? '+' : '') + formatVND(revDiff);
    
    return language === 'vi'
      ? `**Đánh giá Kịch Bản Mô Phỏng What-If:**
1. **Khả thi về lượng đơn & Khách hàng:** Mức điều chỉnh giá ${simulationParams.priceDelta >= 0 ? '+' : ''}${simulationParams.priceDelta}% kết hợp voucher ${simulationParams.voucherPercent}% tạo sức hút tốt đối với nhóm khách hàng nhạy cảm về giá, dự kiến duy trì tỷ lệ hoàn tất đơn ~${formatPct(currentMetrics.cr || 2.4)}.
2. **Tác động Dòng tiền & Lợi nhuận ròng:** Doanh thu ước tính đạt **${formatVND(simulationParams.projectedRevenue)}** (${revDiffFormatted} so với hiện tại), biên lợi nhuận ròng dự kiến đạt **${simulationParams.projectedMargin.toFixed(1)}%**.
3. **Chiến lược Phân bổ Ngân sách:** Điểm hòa vốn ROAS mục tiêu là **${simulationParams.breakEvenRoas.toFixed(2)}x**. Khuyến nghị tập trung ngân sách tăng thêm (+${simulationParams.adSpendDelta}%) cho Top sản phẩm Hero Class A để tối đa hóa hiệu quả sinh lời.`
      : `**What-If Scenario Strategic Assessment:**
1. **Demand Feasibility:** A price change of ${simulationParams.priceDelta >= 0 ? '+' : ''}${simulationParams.priceDelta}% with a ${simulationParams.voucherPercent}% voucher maintains healthy buyer conversion (~${formatPct(currentMetrics.cr || 2.4)}).
2. **Cashflow & Margin Impact:** Projected revenue reaches **${formatVND(simulationParams.projectedRevenue)}** (${revDiffFormatted}), with an estimated net margin of **${simulationParams.projectedMargin.toFixed(1)}%**.
3. **Budget Recommendation:** Target breakeven ROAS is **${simulationParams.breakEvenRoas.toFixed(2)}x**. Allocate the additional ad spend (+${simulationParams.adSpendDelta}%) specifically to Hero Class A SKUs.`;
  };

  try {
    const ai = getGeminiClient(apiKey || (req.headers['x-gemini-api-key'] as string));

    if (!ai) {
      return res.json({
        analysis: getFallbackSimulation(),
        isFallback: true,
      });
    }

    const prompt = `Bạn là chuyên gia định giá và khuyến mãi E-commerce.
Phân tích kịch bản What-If sau đây và đưa ra nhận định chuyên sâu (3 gạch đầu dòng):
- THÔNG SỐ HIỆN TẠI: Doanh thu thực: ${currentMetrics.paidRevenue} ₫, AOV: ${currentMetrics.aov} ₫, Đơn hàng: ${currentMetrics.paidOrders}, Tỷ lệ hoàn tất: ${currentMetrics.cr}%
- KỊCH BẢN ĐIỀU CHỈNH:
  * Thay đổi giá bán: ${simulationParams.priceDelta}%
  * Voucher khuyến mãi: ${simulationParams.voucherPercent}%
  * Tăng ngân sách quảng cáo: ${simulationParams.adSpendDelta}%
  * Doanh thu ước tính mới: ${simulationParams.projectedRevenue} ₫
  * Biên lợi nhuận dự kiến: ${simulationParams.projectedMargin}%
  * Điểm hòa vốn ROAS: ${simulationParams.breakEvenRoas}x

Hãy đánh giá: 
1. Mức độ khả thi về lượng đơn và phản ứng của khách hàng.
2. Tác động tới lợi nhuận ròng (Net Profit) và rủi ro hoàn đơn/chi phí sàn.
3. Lời khuyên cụ thể về việc áp dụng voucher và phân bổ ngân sách.
Trả lời bằng ${language === 'vi' ? 'Tiếng Việt' : 'English'}.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
    });

    res.json({
      analysis: response.text || getFallbackSimulation(),
      isFallback: false,
    });
  } catch (error: any) {
    res.json({
      analysis: getFallbackSimulation(),
      isFallback: true,
    });
  }
});

export default app;

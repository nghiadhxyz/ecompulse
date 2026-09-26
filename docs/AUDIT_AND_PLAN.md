# EcomPulse — Audit codebase & Kế hoạch triển khai

> Ngày audit: 2026-09-25 · Phạm vi: toàn bộ `src/`, `server.ts`, `api/index.ts`
> Baseline trước khi sửa: `tsc --noEmit` ✅ · `vite build` ✅ (1 bundle 2,1 MB) · chưa có test runner

---

## 1. Bản đồ codebase hiện tại

| Lớp | File chính | Ghi chú |
|---|---|---|
| Entry / routing | `src/App.tsx` | Không dùng router. State machine: `analysisTrack` = `portal` → `marketplace` \| `internal_finance`; tab `overview/deep/ai/raw` |
| Types | `src/types.ts`, `src/types/internalFinance.ts`, `src/types/pricing.ts` | `ParsedStoreData` là "god object" chứa cả KPI đã tính sẵn |
| Excel parser (Luồng 1) | `src/utils/excelParser.ts` (2.300 dòng) | Parse báo cáo **tổng hợp** Shopee 21 sheet, chạy trong RAM trình duyệt |
| Standardizer | `src/utils/universalStandardizer.ts` (2.100 dòng) | Chuẩn hoá workbook bất kỳ → 7 sheet chuẩn; có đường AI qua `/api/ai/standardize-raw-data` |
| Finance (Luồng 2) | `src/utils/internalFinanceParser.ts`, `internalFinanceConverter.ts`, `components/internal-finance/InternalFinanceModule.tsx` | Parse file tài chính nội bộ, có order-level + COGS |
| Từ điển dữ liệu | `src/utils/vietnameseDataDictionary.ts` | 53 khái niệm chuẩn, `classifyOrderStatus`, công thức ROAS/AOV/Cancel |
| Analytics cũ | `src/utils/analyticsEngine.ts` | `calculateAnalyticsFromOrders`, momentum, What-If |
| Local DB | `src/utils/localDatabaseService.ts` | IndexedDB + fallback LocalStorage, backup/restore/wipe |
| Privacy | `src/utils/dataAnonymizer.ts` | Anonymize summary cho AI, lưu AI privacy mode |
| Google | `src/utils/googleSheetsService.ts`, `GoogleAuthScreen.tsx` | Sheets qua CSV export + Apps Script webhook; login thực tế là demo user |
| AI backend | `server.ts` (dev), `api/index.ts` (Vercel) | Gemini proxy; 2 bản đã **lệch nhau** |
| Dashboard | `KpiOverviewTab`, `DeepAnalyticsTab`, `AiActionCenterTab`, `RawDataTab`, `dashboard/*` | Dark theme duy nhất; i18n bằng ternary inline |
| Dolphin | `chat/DolphinChatModal.tsx`, `chat/DolphinFloatingWidget.tsx` | Chat → `/api/ai/chat-analyst` |
| Sample data | `src/data/sampleDatasets.ts` | 3 dataset tổng hợp viết tay, 1 tháng, `orders: []` |

---

## 2. Kết quả audit

### EXISTING — đã có, hoạt động
- Parse Excel trong trình duyệt (SheetJS), không upload file thô.
- Parser báo cáo tổng hợp Shopee 21 sheet (overview theo ngày, traffic, sản phẩm, live, video, affiliate).
- Chuẩn hoá workbook tuỳ ý (local rule-based) + xuất workbook sạch.
- Module Tài chính nội bộ (order-level, COGS, trạng thái đơn chuẩn hoá).
- IndexedDB/LocalStorage: lưu dataset summary, task, chat; backup JSON, restore, xoá sạch.
- Gemini proxy phía server (key không lộ client) + BYOK.
- Dashboard nhiều tab, Dolphin chat, Action Roadmap, đồng bộ Google Sheets qua Apps Script.
- Song ngữ vi/en (inline).

### PARTIAL — có một phần
| Hạng mục | Hiện trạng |
|---|---|
| Đa sàn | UI có Shopee/TikTok/Lazada nhưng **mọi file đều đi qua `parseShopeeExcelFile`**; không có parser order-level TikTok/Lazada |
| So sánh kỳ | Có trường `prevPaidRevenue`, `revenueGrowthMoM`… nhưng là **số bịa** (xem mục FABRICATION) |
| Order lifecycle | Chỉ placed/confirmed/paid; không có shipped/delivered/completed/returned/refunded tách biệt |
| Alerts | 4 rule ngưỡng cố định; không có baseline lịch sử, không theo SKU |
| What-If | Có, nhưng giả định cứng COGS 45%, phí sàn 12%, ads 7% và không gắn nhãn "Simulation" |
| Privacy modes | Có UI chọn 4 chế độ (`OnPremiseSecurityModal`) nhưng **không call AI nào đọc chế độ này**; Local LLM chỉ là UI, không có client |
| Onboarding | Có tour modal; chưa có bước chọn loại người dùng |
| Google OAuth | Script GSI được load nhưng đăng nhập thực tế là demo user; không có Google Calendar |
| Sample data | 3 dataset tổng hợp 1 tháng, không có order-level, COGS, change events |

### MISSING — chưa có
Canonical data model · Shared analytics engine (KPI/Comparison/Profit/Contribution/Anomaly) · Profit engine có cảnh báo thiếu chi phí · Data quality/capability report · Seller Mode & Analyst Mode · Category→Niche→SKU drill-down · Combo analytics · Order health theo SKU/lý do · Funnel đa tầng · Campaign calendar · Root cause · Change log/Change impact · Monthly planning · Action Center có đo kết quả · Report Center · Customer RFM · Web Worker/tiến độ/huỷ import · Test tự động · Light theme.

### NEEDS REFACTOR — vi phạm nguyên tắc "không bịa số"
**FABRICATION** (số không có trong dữ liệu nhưng hiển thị như thật):

| File:dòng (trước khi sửa) | Giá trị bịa |
|---|---|
| `excelParser.ts` ~1034–1041 | MoM: kỳ trước = hiện tại × 0,88 / 0,9 / 0,97; `prevCancellationRate` = 14,5 cố định |
| `excelParser.ts` ~1806–1850 | **3 chiến dịch Ads giả** (spend = 4,5%/2,5%/1,2% doanh thu, ROAS 4,88/1,6/5,4) cho *mọi* file import → sinh cả alert "đang lỗ quảng cáo" giả |
| `excelParser.ts` ~1794–1802 | Retention: người mua = đơn × 0,85, chia doanh thu 62/38, repeat rate 28,5% |
| `excelParser.ts` ~1068–1083, `analyticsEngine.ts` ~216–231 | Lý do huỷ chia cứng 65/25/10 và 70/30 |
| `excelParser.ts` ~994–1008 | Thiếu sheet → placed = paid × 1,25 (→ cancel rate giả 20% và alert đỏ giả) |
| `excelParser.ts` ~1032, ~1506 | Units = đơn × 1,4 / × 1,2 |
| `analyticsEngine.ts` ~132 | Lượt xem sản phẩm = `Math.random()` |
| `analyticsEngine.ts` ~174,185 | Đơn huỷ = placed − paid (tính cả đơn đang xử lý là huỷ) |
| `analyticsEngine.ts` ~554, ~713 | Hoa hồng KOC = 10% doanh thu; biến thể = SKU × 2,8 |
| `analyticsEngine.ts` `deriveProductGrowthMomentum…` | Toàn bộ số video/creator/growth theo SKU là phân bổ tổng hợp — **dời sang Phase 4** vì cả Growth Hub dựa vào nó |

**PRIVACY / BẢO MẬT**
- `DolphinChatModal` gửi **nguyên `ParsedStoreData`** (gồm `orders[]` có `buyerId`, `rawSheets`) lên `/api/ai/chat-analyst` → Gemini. `AiActionCenterTab` thì dùng anonymizer đúng. Server fallback vốn đọc schema đã anonymize (`abc`, `abcTopProducts`) nên payload thô còn làm fallback sai.
- API key BYOK lưu dưới 2 key khác nhau (`gemini_custom_api_key` vs `ecompulse_gemini_api_key`) → Dolphin chat không dùng được key người dùng.
- README tuyên bố "Zero-Knowledge" kể cả khi Cloud AI bật — trái yêu cầu.

**KIẾN TRÚC**
- Logic tính toán nằm lẫn trong component (DeepAnalyticsTab 2.000 dòng, AiAssessment7Pillars…).
- `server.ts` và `api/index.ts` là 2 bản copy đã lệch route (`standardize-raw-data` chỉ có ở dev; `action-cards`, `chat` chỉ có ở Vercel).
- Chat history gửi lại từng tin nhắn user bằng `sendMessage` riêng → mỗi câu hỏi tốn N lượt gọi model.

---

## 3. Kiến trúc đề xuất

```
File Excel/CSV (RAM trình duyệt)
   │  excelParser / universalStandardizer / internalFinanceParser   (giữ nguyên)
   ▼
ParsedStoreData (legacy)  ──adapter──►  CanonicalDataset   ◄── order-level importers (Phase 2+)
                                           │
                    src/analytics/  (pure TS, không phụ thuộc React, có test)
                    ├─ model.ts            canonical types
                    ├─ status.ts           order lifecycle
                    ├─ period.ts           preset + comparable period
                    ├─ kpiEngine.ts        KPI + MetricResult (có "missing reason")
                    ├─ comparisonEngine.ts current/previous/Δ/%Δ/pp
                    ├─ profitEngine.ts     waterfall + completeness
                    ├─ contributionEngine.ts
                    ├─ dataQuality.ts      capability + issues
                    └─ (Phase 2+) anomalyEngine, productEngine, orderHealthEngine, liveEngine, …
                                           │
            ┌──────────────────────────────┼─────────────────────────────┐
     Seller Experience              Analyst Experience            Dolphin Evidence Layer
     (7 nhóm, ít jargon)            (21 module, drill-down)       (chỉ đọc kết quả đã tính)
```

Nguyên tắc:
1. **Một engine** — Seller và Analyst gọi cùng hàm, khác nhau ở UI.
2. **MetricResult** luôn có `status: ok | partial | missing` + lý do tiếng Việt/Anh + field cần bổ sung. UI hiển thị "Không đủ dữ liệu" thay vì 0.
3. Rate lưu dạng tỉ lệ (0,042); so sánh rate trả cả `percentagePointDelta` và `percentageDelta`.
4. AI chỉ nhận **kết quả đã tính + evidence**, không nhận dòng dữ liệu thô.

---

## 4. Checklist triển khai

### Phase 1 — Foundation *(đang làm)*
- [x] Audit
- [x] Thêm Vitest + script `npm test`
- [x] Canonical model (`src/analytics/model.ts`)
- [x] Order lifecycle normalizer (`status.ts`)
- [x] Period engine: preset Hôm nay/Hôm qua/7/30 ngày/Tháng này/Custom; DoD/WoW/MoM (căn theo ngày khi tháng chưa hết)/YoY
- [x] KPI engine (order-grain + daily-grain fallback)
- [x] Comparison engine (Δ, %Δ, pp)
- [x] Profit engine (waterfall, cảnh báo SKU thiếu COGS, không mặc định chi phí = 0)
- [x] Contribution engine (xử lý contributor âm)
- [x] Data quality (capability + issues: trùng dòng, refund > doanh thu, trạng thái lạ…)
- [x] Adapter `ParsedStoreData → CanonicalDataset`
- [x] Gỡ số bịa ở parser/engine cũ (trừ momentum → Phase 4); đánh dấu `estimatedFields`
- [x] Vá rò rỉ dữ liệu Dolphin chat + thống nhất key BYOK
- [x] Chọn Workspace Mode (onboarding + đổi trong header), lưu local
- [x] Panel "Chất lượng dữ liệu" nối với dữ liệu thật
- [x] Test công thức + edge cases

**Kết quả Phase 1 (2026-09-25):** `tsc` ✅ · `npm test` 102/102 ✅ (gồm golden test với `Báo cáo mẫu.xlsx`: 519 đơn, 102 hủy, CVR 4,90% khớp Shopee) · `npm run build` ✅ · chạy thử trên Edge headless: chọn mode, chip header, đổi mode giữ dữ liệu, panel chất lượng dữ liệu, 0 lỗi console.

**Còn tồn (chuyển sang phase sau):**
- Màn hình cũ vẫn hiển thị một số giá trị ước tính (placed/confirmed khi thiếu sheet, units) — đã gắn cờ `estimatedFields`, engine mới bỏ qua; sẽ thay bằng màn Seller/Analyst.
- `internalFinanceConverter.ts` còn ước tính (`clvEstimate = AOV × 1,8`, hoa hồng mặc định 10%) — xử lý khi viết importer Finance → Canonical (Phase 2).
- `deriveProductGrowthMomentum…` tổng hợp → Phase 4.
- Bảng trong KpiOverviewTab tràn ngang 587px trên màn 390px (có từ trước) — Seller Home thay thế ở Phase 2.
- Privacy mode vẫn chưa được enforce ở mọi call AI → Phase 5 (đã vá rò rỉ payload thô của Dolphin chat).

### Phase 2 — Seller Mode *(xong)*
- [x] Importer file xuất đơn Shopee / TikTok Shop / Lazada / mẫu EcomPulse, tự nhận diện; file giá vốn; báo cáo tổng hợp Shopee đi qua parser cũ. **Cột theo định dạng công khai của sàn — cần đối chiếu lại khi có file thật** (`src/analytics/importers/orderExport.ts`, danh sách `SPECS`)
- [x] Không lưu tên/SĐT/địa chỉ; mã người mua băm một chiều trên máy
- [x] Web Worker + tiến độ + hủy nhập (`src/workers/importWorker.ts`)
- [x] Workspace lưu IndexedDB riêng (`EcomPulse_Workspace_DB`), gộp file không đếm trùng đơn; "Xóa sạch dữ liệu" xóa luôn DB này
- [x] Demo 3 tháng × 3 sàn cấp đơn, nhất quán nội bộ (test kiểm chứng), demo không ghi đè dữ liệu thật
- [x] Nhập giá vốn theo SKU, tỷ lệ phí sàn/thanh toán, xác nhận "không chạy Ads" / "shop không chịu ship"
- [x] 7 nhóm: Tổng quan (KPI + so sánh kỳ tương đương) · Lời/Lỗ thật (nguồn từng khoản) · Sản phẩm (lối tắt + "tốt nhất" theo từng tiêu chí) · Đơn hàng (vòng đời, hủy/hoàn theo SKU/sàn/lý do/ngày) · Ads & Live (ROAS + ROAS hòa vốn + lời sau Ads; live so với phiên trước) · Cảnh báo thông minh · Bản tin ngày
- [x] Anomaly engine: ngưỡng + baseline (trung vị 7 ngày, 4 tuần, 14 ngày), so sánh ngày thường loại ngày sale, lọc nhiễu cỡ mẫu
- [x] Evidence + [Xem dữ liệu] mở đúng danh sách đơn
- [x] Mobile: điều hướng dưới, không tràn ngang; Seller Mode lazy-load (chunk riêng 136 KB)

**Kết quả Phase 2 (2026-09-25):** `tsc` ✅ · `npm test` 149/149 ✅ · `npm run build` ✅ · chạy thử Edge headless: demo → 7 trang, [Xem dữ liệu], nhập giá vốn, nhập file xuất đơn Shopee + file giá vốn, IndexedDB không chứa PII, dữ liệu còn sau khi tải lại, mobile 390px không tràn, chế độ Analyst vẫn mở dashboard cũ, 0 lỗi console.

**Còn tồn sau Phase 2:**
- Chưa có importer báo cáo Ads / Live / Affiliate riêng của sàn → trang Ads & Live chỉ đầy đủ với demo hoặc khi có dữ liệu này (Phase 4).
- Dolphin hỏi đáp theo bằng chứng (Phase 5); hiện Bản tin ngày là tất định, không gọi AI.
- Header còn hiện badge "Shopee" cũ khi ở Seller Mode (thẩm mỹ).

### Phase 3 — Analyst Core *(xong)*
- [x] Breakdown engine dùng chung: cùng bộ KPI cho mọi thành viên của chiều (sàn, ngành, nhóm hàng, SKU, combo, chiến dịch, phiên live, kênh, ngày/tuần/tháng) + so sánh kỳ + đóng góp vào thay đổi GMV (`breakdownEngine.ts`)
- [x] Bộ lọc mở rộng: nhóm hàng, combo, chiến dịch, phiên live; traffic/Ads thu hẹp đúng theo sản phẩm được chọn (sửa CVR toàn shop khi lọc ngành)
- [x] Analyst Workspace: sidebar nhóm TODAY/PERFORMANCE/GROWTH/INTELLIGENCE/PLANNING/REPORTS/DATA; module của phase sau hiện nhãn "P4–P7", không bấm được; lối vào Dashboard cổ điển (What-If, roadmap cũ)
- [x] Bộ lọc nâng cao: preset, kiểu so sánh Tự động/Kỳ liền trước/DoD/WoW/MoM/YoY/Tự chọn kỳ so sánh, nhiều sàn, nhiều ngành
- [x] Executive Overview: 10 KPI; 1·Điều gì thay đổi → 2·Ở sàn nào → 3·Ngành nào đóng góp → 4·Nên điều tra gì; biểu đồ kỳ này vs kỳ so sánh
- [x] Category Intelligence: Ngành → Nhóm → SKU → Product 360 → Đơn hàng, có breadcrumb
- [x] Products & Combo: Scale/Maintain/Investigate/Reconsider kèm lý do, ABC, Hero, Zombie (chỉ khi có traffic), momentum ngày thường; Product 360; combo vs bán lẻ (giỏ hàng, margin, hủy)
- [x] Revenue & Profit: thác nước có nguồn từng khoản + thay đổi so với kỳ trước; lợi nhuận theo 10 chiều
- [x] Order Health: tỷ lệ hủy/hoàn/hoàn tất có so sánh; drill theo 8 chiều; lý do hủy/hoàn theo nhóm + so với kỳ trước
- [x] Traffic & Funnel: 7 tầng (tầng thiếu dữ liệu ghi rõ, không suy diễn), điểm rơi lớn nhất sau khi khách đã nhấp, so sánh kỳ (pp), theo sàn/ngành/SKU, phễu livestream
- [x] Data Mapping: danh mục SKU với độ phủ ngành/nhóm/giá vốn

**Kết quả Phase 3 (2026-09-25):** `tsc` ✅ · `npm test` 177/177 ✅ · `npm run build` ✅ (Analyst chunk riêng 86 KB) · chạy thử Edge headless: toàn bộ module Analyst, drill-down 4 cấp, đổi kiểu so sánh (YoY ngoài dữ liệu có cảnh báo), dashboard cổ điển và quay lại, Seller Mode không hồi quy, mobile 390px không tràn, 0 lỗi console.

**Còn tồn sau Phase 3:**
- File xuất đơn của sàn thường không có ngành hàng → Category Intelligence cần danh mục sản phẩm (có thể bổ sung trang nhập ngành hàng theo SKU ở phase sau, tương tự nhập giá vốn).
- "Lượt xem" (Views) trong phễu chưa có nguồn dữ liệu (cần báo cáo traffic sản phẩm của sàn — Phase 4).

### Phase 4 — Growth *(xong)*
- [x] Bộ đọc báo cáo Ads · Livestream · Hiệu quả sản phẩm (traffic) · Affiliate/Video · Danh mục sản phẩm (SKU + ngành/nhóm/giá vốn) cho Shopee / TikTok Shop / Lazada / mẫu EcomPulse (`importers/reportImporters.ts`, danh sách `SPECS` — **cần đối chiếu khi có file thật**)
- [x] Báo cáo không có cột ngày → lưu là **số tổng cả kỳ** (kỳ đọc từ dòng tiêu đề hoặc tên file), chỉ được tính khi chọn trọn kỳ; không chia đều theo ngày
- [x] Nhập ngành hàng / nhóm hàng theo SKU trong Cài đặt (ghi đè danh mục)
- [x] Campaign & Calendar: loại ngày (siêu sale / ngày đôi / ngày lương / cuối tuần / ngày thường) có cỡ mẫu, thứ trong tuần & ngày trong tháng (ngày thường), sale vs ngày thường, cảnh báo dữ liệu ngắn; so sánh chiến dịch A/B có mức tăng so với 14 ngày thường trước đó
- [x] Ads Intelligence: trên/dưới hòa vốn, tỷ trọng ngân sách, ngân sách dưới hòa vốn, chi phí & ROAS theo ngày (2 biểu đồ riêng, không trục kép), theo sàn
- [x] Live Auditor: xếp hạng GMV/giờ, lợi nhuận/giờ, theo khung giờ/thứ/thời lượng (có cỡ mẫu), so sánh 2 phiên, phễu live
- [x] Video & Affiliate: theo nhà sáng tạo & video, CTR/CVR/tỷ lệ hoa hồng, lợi nhuận từ đơn gắn nguồn, so với kỳ trước
- [x] Mục momentum ở dashboard cổ điển gắn nhãn "ước tính phân bổ"
- [x] **Sửa lỗi**: nhập nhiều file cùng lúc bị ghi đè nhau (closure React cũ)

**Kết quả Phase 4 (2026-09-26):** `tsc` ✅ · `npm test` 205/205 ✅ · build ✅ (Analyst chunk 132 KB) · chạy thử Edge headless: 4 module mới trên demo, nhập đồng thời file đơn + Ads (số tổng kỳ) + Live + danh mục, Ads chỉ tính khi chọn trọn kỳ, Category Intelligence từ danh mục nhập, nhập ngành hàng ở Cài đặt, Seller/Analyst không hồi quy, mobile không tràn, 0 lỗi console.

### Phase 5 — Intelligence
- [x] Root Cause (`rootCauseEngine.ts`): 8 chỉ số, phân rã Sàn → Ngành → Nhóm hàng → SKU, đóng góp cộng đúng bằng thay đổi (kể cả tỷ lệ — gồm hiệu ứng cơ cấu), vai trò chính/đóng góp/ngược chiều, tập trung theo chiến dịch/live/kênh/ngày, động lực GMV (traffic × chuyển đổi × giữ đơn × giá trị đơn, LMDI), cảnh báo thay đổi nhỏ, không kết luận nguyên nhân
- [x] Anomaly & Opportunity (`anomalyScan.ts`): median/MAD 14 ngày thường (bỏ ngày sale), ngưỡng 3,5, gắn nhãn ngày sale là "dự kiến"; cơ hội: hiệu quả tăng nhanh hơn traffic, CVR cao ít traffic, biên cao tỷ trọng nhỏ
- [x] Dolphin Evidence Mode (`dolphinEvidence.ts` + `DolphinAsk`): 9 loại câu hỏi tiếng Việt, trả lời NHẬN ĐỊNH / BẰNG CHỨNG (có Xem dữ liệu) / DIỄN GIẢI / NÊN KIỂM TRA, "tốt nhất" tách theo tiêu chí, "Không đủ dữ liệu" khi thiếu; AI chỉ diễn đạt lại gói số liệu tổng hợp (`/api/ai/rephrase-evidence`)
- [x] Chế độ AI Local Only (mặc định) / Privacy AI (Ollama, LM Studio… gọi thẳng từ trình duyệt) / Cloud AI (phải đồng ý, rút lại được) — áp dụng cho mọi lời gọi AI (`utils/aiClient.ts`): AI Action Center, Dolphin chat, diễn đạt lại
- [x] Câu trả lời "fallback" mẫu của server (có số bịa như 382.000.000 ₫) không còn hiển thị như câu trả lời AI
- [x] Làm sạch dữ liệu thô bằng AI (`runAiDataCleaningAgent`) luôn chạy cục bộ — không gửi dòng dữ liệu thô
- [x] Bỏ tuyên bố "Zero-Knowledge" trong README/badge/modal; badge đổi theo chế độ AI
- [ ] Gộp `server.ts`/`api/index.ts` dùng chung handler — để lại (hai file đã có cùng route mới; gộp là refactor rủi ro, không đổi hành vi)

**Kết quả Phase 5 (2026-09-26):** `tsc` ✅ · `npm test` 242/242 ✅ · build ✅ · Edge headless: Root Cause GMV đi TikTok → Nhà cửa & Đời sống → Đồ bếp → Nồi chiên 5L, Tỷ lệ hủy báo "thay đổi rất nhỏ", Anomaly chỉ đánh dấu 9.9 (ngày sale), Dolphin trả lời 9.9/tốt nhất/GMV, nút diễn đạt AI ẩn ở Local Only, hộp đồng ý Cloud AI chặn khi chưa tick, 0 request `/api/ai` trong toàn bộ phiên, mobile không tràn.

### Phase 6 — Planning
- [x] Change log & Change Impact (`changeImpact.ts`): nhật ký từ dữ liệu + người dùng thêm, so sánh 7/14/30 ngày trước/sau (tự rút ngắn khi thiếu dữ liệu), đối chứng với phần còn lại của shop, cảnh báo số ngày sale khác nhau, sản phẩm mới không bịa so sánh, câu chữ "Sau thay đổi…"
- [x] Monthly Planning (`planningEngine.ts`): mục tiêu GMV tháng + theo sàn, chia theo tỷ lệ loại ngày của 90 ngày trước (thiếu mẫu → như ngày thường, có ghi chú), ngày đôi tương lai tự nhận, sự kiện kế hoạch, tiến độ, ước tính cuối tháng (gắn nhãn ước tính), GMV cần/ngày; xuất lịch .ics (Google Calendar/Outlook)
- [x] Action Center: nhận định → bằng chứng → hành động → phụ trách → hạn → trạng thái → đo kết quả 14 ngày trước/sau ngày áp dụng; quá hạn theo ngày dữ liệu; "Thêm vào Action Center" từ cảnh báo
- [x] Report Center (`reportEngine.ts` + `utils/reportExport.ts`): báo cáo ngày/tuần/tháng/chiến dịch/live/kế hoạch; xuất Excel (số giữ dạng số, % định dạng), CSV UTF-8 BOM, PDF qua hộp thoại in, .ics. Google Sheets: nhập file Excel/CSV (không có API ghi trực tiếp — không cần gửi dữ liệu lên máy chủ)
- [x] Kế hoạch/nhật ký/hành động lưu IndexedDB theo nguồn (demo / dữ liệu thật), xóa cùng dữ liệu nhập

**Kết quả Phase 6 (2026-09-26):** `tsc` ✅ · `npm test` 256/256 ✅ · build ✅ · Edge headless: thêm thay đổi, lưu kế hoạch 09 & 10/2025 (10.10 được tính ngày đôi), xuất .ics/.xlsx/.csv, cửa sổ in PDF, hành động từ cảnh báo + đo kết quả, dữ liệu còn sau khi tải lại trang, mobile không tràn, 0 lỗi console.

### Phase 7 — Advanced
- [x] Khách hàng (`customerEngine.ts`): chỉ bật khi ≥ 80% đơn có mã người mua (đã băm); khách mới/quay lại, mua lặp trong kỳ, GMV/khách, RFM 7 nhóm (xem đơn của nhóm), cohort theo tháng; ghi chú giới hạn lịch sử và mã theo từng sàn
- [x] What-If (`whatIfEngine.ts`): trên waterfall lợi nhuận THẬT của kỳ/SKU; 6 đòn bẩy (giá, số đơn do người dùng giả định, voucher, giá vốn, Ads, phí sàn); không tự suy ra cầu theo giá; số đơn cần để giữ lợi nhuận; gắn nhãn "Mô phỏng / Ước tính"
- [x] Thống kê nâng cao (`statsEngine.ts`, chỉ ở Analyst): kiểm định 2 tỷ lệ (hủy, trả, CVR), Welch cho GMV/đơn mỗi ngày, khoảng tin cậy 95%, p-value, tương quan Pearson theo ngày (nhãn "không phải nhân quả"), chỉ số theo thứ (bỏ ngày sale)
- [x] Hiệu năng: lazy-load dashboard cổ điển + Tài chính nội bộ, tách chunk recharts/xlsx/markdown → bundle đầu từ 2,19 MB xuống 664 KB; engine chạy ~100 ms trên 16k đơn, có memo
- [x] Định dạng: số âm dùng dấu trừ "−" thống nhất cho tiền và tỷ lệ

**Kết quả Phase 7 (2026-09-26):** `tsc` ✅ · `npm test` 265/265 ✅ · build ✅ · Edge headless: Khách hàng/What-If/Thống kê trên demo, không còn mục "P5/P6/P7" bị khóa, Seller không có thuật ngữ thống kê, dashboard cổ điển vẫn tải (lazy), mobile không tràn, 0 lỗi console.

### Còn lại / ghi chú
- Importer đơn hàng dựng theo định dạng công khai của sàn — cần chỉnh khi có file thật của TikTok/Lazada.
- `server.ts` và `api/index.ts` vẫn là hai bản route song song (đã thêm cùng route mới); câu trả lời "fallback" mẫu của server không còn được hiển thị ở client nhưng vẫn nằm trong code server.
- Tải lại trang luôn về trang giới thiệu (hành vi có sẵn); dữ liệu, kế hoạch và hành động vẫn được giữ.


### Bổ sung — Báo cáo "Phân tích bán hàng" Shopee (file thật, 2026-09-26)
- [x] Đọc đủ 21/21 sheet: kênh & nguồn truy cập (cả kỳ + theo ngày), chi phí Shopee Ads theo ngày, sản phẩm đứng đầu, live, video, affiliate
- [x] Dữ liệu tổng hợp theo ngày dùng được cho: phân tách theo ngày/tuần/tháng/sàn, Sức khỏe đơn hàng (tỷ lệ hủy/hoàn theo ngày), Anomaly, Campaign & Calendar, Monthly Planning, Change Impact (toàn shop), Thống kê nâng cao, Dolphin (tổng quan, Ads, sản phẩm tốt nhất)
- [x] Sửa lỗi: Thống kê nâng cao tính GMV/ngày = 0 khi thiếu dữ liệu (nay báo "Chưa đủ mẫu")
- [x] "Xem dữ liệu" giải thích khi báo cáo tổng hợp không có danh sách đơn
- Vẫn cần file đơn hàng: lợi nhuận, Root Cause theo SKU, lý do hủy, khách hàng/RFM, What-If, câu hỏi SKU tăng trưởng/lỗ/chi phí

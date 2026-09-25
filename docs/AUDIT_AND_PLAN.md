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

### Phase 2 — Seller Mode
- Importer order-level Shopee/TikTok/Lazada (auto-detect) → CanonicalDataset; Web Worker + progress + cancel
- Lưu CanonicalDataset vào IndexedDB (store mới, bump DB_VERSION)
- Nhập COGS theo SKU (lưu local), cài đặt phí sàn
- Sample data 3 tháng × 3 sàn, order-level, nhất quán nội bộ
- 7 màn hình: Home · Lời/Lỗ · Sản phẩm · Đơn hàng · Ads & Live · Cảnh báo · Daily Brief
- anomalyEngine v1 (ngưỡng + baseline 7 ngày + moving average)
- Evidence object + nút [Xem dữ liệu]

### Phase 3 — Analyst Core
Executive Overview · Category Intelligence (drill-down) · Product & Combo · Revenue & Profit waterfall theo chiều · Order Health · Traffic & Funnel

### Phase 4 — Growth
Campaign & Calendar · Ads Intelligence (break-even ROAS) · Live Auditor · Video & Affiliate (thay momentum tổng hợp)

### Phase 5 — Intelligence
Root cause tree · Anomaly & Opportunity · Dolphin Evidence Mode (INSIGHT/EVIDENCE/INTERPRETATION/NEXT CHECK) · Privacy mode enforcement (Local Only / Privacy AI / Cloud AI) + Local LLM client · gộp `server.ts`/`api/index.ts` dùng chung handler

### Phase 6 — Planning
Change log & impact · Monthly planning · Action Center có đo kết quả · Report Center + export

### Phase 7 — Advanced
Customer/RFM (chỉ khi có customer id) · What-If dùng chi phí thật · thống kê nâng cao · code-split bundle

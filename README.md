# EcomPulse - Hệ Thống Phân Tích Dữ Liệu TMĐT & Ra Quyết Định Đa Kênh

> 🛡️ **Local-first**
> File Excel được đọc trong bộ nhớ trình duyệt; dữ liệu đơn hàng và báo cáo được lưu trong IndexedDB trên máy bạn và **không tự động tải lên** máy chủ EcomPulse. Khi bạn bật **Cloud AI**, số liệu tổng hợp đã ẩn danh sẽ được gửi tới máy chủ EcomPulse và Google Gemini — lúc đó ứng dụng **không còn là "zero knowledge"**.

---

## 🔒 Quyền riêng tư

1. **Đọc file trong trình duyệt**: File .xlsx / .xls / .csv của Shopee, TikTok Shop, Lazada được phân tích trong Web Worker, không tải file lên máy chủ.
2. **Lưu trữ cục bộ**: Dữ liệu chuẩn hóa, giá vốn, cài đặt lưu trong IndexedDB / localStorage của trình duyệt. Có nút xóa sạch dữ liệu.
3. **Không đọc thông tin cá nhân**: Cột tên, số điện thoại, địa chỉ người mua không được đọc; mã người mua được băm một chiều (pseudonymize) trước khi lưu.
4. **Ba chế độ AI** (Cài đặt → Quyền riêng tư AI; mặc định Local Only):
   - **Local Only**: không gọi mô hình AI nào. Dolphin trả lời bằng số liệu tính trên máy (Evidence Mode). Không dữ liệu nào rời trình duyệt.
   - **Privacy AI**: gọi mô hình chạy trên máy / mạng nội bộ của bạn (Ollama, LM Studio, llama.cpp — API OpenAI-compatible) trực tiếp từ trình duyệt. Không qua máy chủ EcomPulse.
   - **Cloud AI**: chỉ bật sau khi bạn đọc và đồng ý. Gửi số liệu tổng hợp đã ẩn danh (không có dòng đơn hàng, không có tên/SĐT/địa chỉ) qua máy chủ EcomPulse tới Google Gemini. Có thể dùng API key riêng (BYOK). Có thể rút lại đồng ý bất cứ lúc nào.
5. **AI không phải nguồn số liệu**: Mọi KPI, lợi nhuận, so sánh được tính bằng engine phân tích cục bộ; AI chỉ diễn đạt lại câu trả lời đã tính và không được thêm số mới.

---

## 🚀 Khởi Chạy Ứng Dụng (Chạy Cục Bộ / On-Premise)

### 1. Cài đặt & Khởi động
```bash
# Cài đặt thư viện phụ thuộc
npm install

# Khởi chạy server phát triển
npm run dev
```

Truy cập ứng dụng tại: `http://localhost:3000`

### 2. Đóng gói Production Bundle
```bash
npm run build
npm start
```

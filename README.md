# EcomPulse - Hệ Thống Phân Tích Dữ Liệu TMĐT & Ra Quyết Định Đa Kênh

> 🛡️ **Kiến Trúc Bảo Mật On-Premise & Zero-Knowledge Data Isolation**
> Dữ liệu doanh thu, đơn hàng, khách hàng và báo cáo Excel được xử lý và lưu trữ **100% tại máy trạm / Local Browser** của khách hàng. Tuyệt đối không gửi hoặc lưu trữ dữ liệu sang máy chủ của bên phát triển.

---

## 🔒 Nguyên Lý Bảo Mật On-Premise

1. **In-Browser RAM Execution**: File Excel nhiều sheet (.xlsx, .xls, .csv) của Shopee, TikTok Shop được thư viện JS phân tích 100% trong bộ nhớ RAM trình duyệt, không thực hiện tải file lên bất kỳ máy chủ nào.
2. **Local-First Database (IndexedDB & LocalStorage)**: Báo cáo đã lưu, thẻ hành động (Action Cards), bảng lộ trình (Roadmap) và lịch sử trò chuyện được lưu cục bộ trong IndexedDB của trình duyệt máy khách hàng.
3. **PII Data Anonymization Guard**: Bộ lọc tự động ẩn danh số điện thoại, tên khách hàng và thông tin cá nhân trước bất kỳ thao tác AI nào.
4. **Quyền Riêng Tư AI Đa Dạng**:
   - **Chế độ 100% Offline (Rule-Based Engine)**: Chạy hoàn toàn bằng thuật toán toán học nội bộ, không cần internet.
   - **Chế độ BYOK (Bring Your Own Key)**: Khách hàng sử dụng API Key Gemini của chính mình kết nối trực tiếp.
   - **Chế độ Local LLM**: Hỗ trợ kết nối máy chủ AI nội bộ (Ollama / vLLM / LM Studio) qua mạng LAN.
5. **Sao Lưu & Xóa Trắng Dữ Liệu**: Khách hàng có toàn quyền Xuất sao lưu JSON, Khôi phục hoặc Xóa sạch 100% dữ liệu khỏi máy tính bất cứ lúc nào.

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

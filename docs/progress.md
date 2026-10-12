# Tiến độ làm lại giao diện (redesign v2)

Nhánh: `feat/redesign-v2`. Quy ước thiết kế: `docs/redesign/README.md` (đã cập nhật theo thiết kế v2).

## Phạm vi

Chỉ hai workspace: **Chủ shop** và **Phân tích (Analyst)**. Chỉ sửa giao diện — không đổi logic, API,
tên biến, cấu trúc dữ liệu hay luồng chức năng.

## Trạng thái

| Phần | Trạng thái |
|---|---|
| Biến dùng chung (màu, font, khoảng cách, bo góc) trong `src/styles/tokens.css` | Đã làm |
| Font Archivo (số và tiêu đề), đóng gói offline | Đã làm |
| Khung Analyst: menu tiếng Việt, thanh bên, menu trên điện thoại, bộ lọc gọn trên điện thoại | Đã duyệt |
| Thanh trên cùng trong workspace (Gói, hướng dẫn, bảo mật chuyển vào menu tài khoản) | Đã duyệt |
| Tổng quan điều hành (Executive Overview) | Đã duyệt |
| Tổng quan của Chủ shop, thanh tab và bộ lọc Chủ shop | Đã làm |
| Chủ shop: Sản phẩm, Đơn hàng, Quảng cáo & Live, Dolphin AI, Dữ liệu, Cài đặt | Đã làm |
| Phân tích: mọi trang — bỏ "·", Việt hóa nhãn, ô KPI → `FigureStrip` / `StatStrip`, kiểm tra 1440px và 390px | Đã làm |

### Còn để ý

- Một số bảng nhiều cột (Ngành hàng, Quảng cáo, Từ khóa) vẫn cuộn ngang trong khung bảng ở 1440px — đúng quy ước (trên 10 cột).
- Giữ các viết tắt ngành quen thuộc: GMV, ROAS, AOV, CVR, SKU, KOC; "Ads" trong câu giải thích.
- Kết quả What-If (so sánh trước/sau) và danh sách khả năng ở Chất lượng dữ liệu vẫn dùng ô có khung — có chủ ý, vì mỗi ô là một cặp so sánh / một trạng thái.

## Cần đồng bộ sau (ngoài phạm vi lần này)

Các màn sau **vẫn đang dùng phong cách tối cũ** (biến `:root` trong `tokens.css` và các lớp `glass-*`
trong `src/index.css`), chưa theo thiết kế mới:

- Trang giới thiệu (landing) và màn chọn phân hệ
- Dashboard cổ điển
- Tài chính nội bộ

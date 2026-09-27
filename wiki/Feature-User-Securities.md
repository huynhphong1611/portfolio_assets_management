# 🪙 Feature: Chứng khoán & giá của riêng bạn

## Tổng quan

Mỗi user tự quản lý danh mục chứng khoán và lịch sử giá của mình, theo mô hình của [Portfolio Performance](https://github.com/portfolio-performance/portfolio): mỗi chứng khoán có một **nguồn giá** (quote feed) và một **lịch sử giá** riêng. Nhờ vậy những tài sản không có API như vàng nhẫn, vàng thương hiệu khác, trái phiếu doanh nghiệp hay quỹ không niêm yết vẫn được định giá đúng thay vì bị tính bằng giá vốn.

Giá lấy từ API (vnstock, CoinGecko, SJC) vẫn dùng chung cho mọi user vì giá VNM hay BTC giống nhau với tất cả. Hệ thống chỉ tải một lần mỗi ngày.

## Nguồn giá

| Nguồn | Mã trong hệ thống | Cách lấy giá | Dùng cho |
|-------|-------------------|--------------|----------|
| Tự động | `AUTO` (mặc định) | vnstock, CoinGecko, SJC; giá bạn nhập chỉ lấp ngày hệ thống thiếu | Cổ phiếu, ETF, chứng chỉ quỹ, crypto, USDT/USDC, vàng miếng SJC |
| Nhập tay | `MANUAL` | Bạn nhập hoặc import CSV; không bao giờ tải từ API | Vàng nhẫn, trái phiếu riêng lẻ, tài sản không có API |
| JSON | `GENERIC-JSON` | Hệ thống tải một URL trả về JSON và đọc giá bằng JSONPath | Nguồn có API JSON nhưng chưa được tích hợp sẵn |

### Quy tắc chọn giá khi định giá ngày D

- **Nhập tay / JSON:** dùng giá gần nhất của bạn vào hoặc trước ngày D. Giá hệ thống chỉ là phương án dự phòng khi bạn chưa có giá nào.
- **Tự động:** dùng giá hệ thống. Giá của bạn chỉ được dùng khi hệ thống không có giá cho mã đó.
- Không có giá nào: định giá bằng giá vốn và màn hình **Tất cả chứng khoán** gắn nhãn **thiếu giá**.

Quy tắc giống hệt nhau ở frontend (`src/utils/priceResolver.js`), scheduler 9h sáng, dựng snapshot lịch sử và API dashboard (`apply_user_prices` trong `portfolio_service.py`).

## Nguồn JSON (GENERIC-JSON)

| Trường | Ví dụ | Ghi chú |
|--------|-------|---------|
| URL | `https://www.vang.today/api/prices?type=SJL1L10` | Chỉ http/https công khai |
| JSONPath của giá | `$.sell` | Bắt buộc |
| JSONPath của ngày | `$.date` | Không bắt buộc; bỏ trống thì lấy ngày hôm nay |
| Hệ số nhân | `0.1` | Đổi đơn vị, ví dụ giá mỗi lượng thành giá mỗi chỉ |
| Định dạng số | `auto` / `vi` / `en` | Cho giá dạng chuỗi như `"176.500.000"` |

JSONPath được hỗ trợ: `$.a.b`, `$['a']`, `$.list[0]`, `$.list[-1]`, `$.list[*].price`, `$..price`, bộ lọc `$.data[?(@.type=='SJC')].sell` với các phép so sánh `== != > >= < <=`. Nếu đường dẫn giá và đường dẫn ngày trả về hai danh sách cùng độ dài, toàn bộ chuỗi được lưu làm lịch sử giá.

Nút **Thử nguồn** tải URL một lần, hiển thị giá đọc được và một đoạn JSON gốc để chỉnh JSONPath, không lưu gì.

### An toàn khi tải URL do user nhập

Backend là bên tải URL nên mọi request đều bị giới hạn:

- chỉ `http`/`https`, cổng mặc định, không chứa thông tin đăng nhập trong URL;
- tên miền phải phân giải ra địa chỉ IP công khai: chặn localhost, dải mạng nội bộ, link-local như `169.254.169.254`, dải CGNAT;
- không theo chuyển hướng, giới hạn 1 MB và 10 giây mỗi request.

## Nhập dữ liệu từ CSV

Mọi lần nhập đều có bước **xem trước**: server phân tích file, báo lỗi theo số dòng như trong Excel/Sheets, rồi chỉ ghi khi bạn bấm xác nhận.

### Giao dịch

- Tên cột có dấu hay không dấu, tiếng Việt hay tiếng Anh đều được: `Ngày giờ` / `Dấu thời gian` / `Date`, `Loại giao dịch` / `Type`, `Loại tài sản` / `Tài sản`, `Mã` / `Ticker`, `Số lượng`, `Đơn giá`, `Loại tiền`, `Tỷ giá`, `Thành tiền (VNĐ)`, `Nơi lưu trữ`, `Ghi chú`.
- Đọc được file Google Form cũ và file **Xuất CSV** của trang Giao dịch.
- Loại giao dịch: `Nạp tiền`, `Rút tiền`, `Mua`, `Bán`, `Cổ tức`, hoặc tiếng Anh `Deposit`, `Withdrawal`, `Buy`, `Sell`, `Dividend`, `Interest`.
- Số kiểu Việt Nam `25.794.645,76` hoặc quốc tế `25,794,645.76`: tự nhận dạng theo toàn file, có thể chọn tay.
- Ngày `dd/MM/yyyy[ HH:mm:ss]` hoặc `yyyy-MM-dd`; ngày tháng mơ hồ được hiểu theo kiểu Việt Nam, ngày đứng trước.
- Mỗi dòng được kiểm tra bằng cùng schema với API. Giao dịch trùng thời điểm, loại, mã, số lượng và thành tiền với dữ liệu sẵn có hoặc với dòng khác trong file sẽ bị bỏ qua.

### Lịch sử giá

| Dạng | Ví dụ tiêu đề | Ghi chú |
|------|---------------|---------|
| Một mã | `Ngày,Giá` | Chọn mã trong hộp thoại |
| Nhiều mã, dạng dài | `Ngày,Mã,Giá đóng cửa` | |
| Nhiều mã, dạng rộng | `Date,VNM,FPT` | Mỗi cột là một mã |
| Không có tiêu đề | `2026-09-01;176500000` | Cột 1 là ngày, cột 2 là giá |

File tải từ Yahoo Finance hay investing.com dùng được ngay nhờ nhận cột `Close`. Mặc định giá cùng ngày bị ghi đè; tùy chọn "Thay thế toàn bộ" xóa lịch sử cũ trước khi nhập.

## Sao lưu và khôi phục

**Cài đặt & Dữ liệu → Tải bản sao lưu** xuất mọi thứ của user vào một file JSON: giao dịch, chứng khoán, giá riêng, tài sản ngoài, nợ, snapshot và tỷ trọng mục tiêu.

**Khôi phục từ file** kiểm tra file, hiện số lượng từng loại dữ liệu để xác nhận, rồi ghi theo mã định danh. Khôi phục nhiều lần cho kết quả như một lần; dữ liệu không có trong file được giữ nguyên.

## API

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/api/securities` | Danh sách chứng khoán của user |
| `PUT` | `/api/securities/{ticker}` | Tạo hoặc sửa chứng khoán: tên, loại tài sản, nguồn giá, cấu hình JSON |
| `DELETE` | `/api/securities/{ticker}` | Xóa chứng khoán và lịch sử giá riêng; giao dịch không bị ảnh hưởng |
| `GET` | `/api/securities/prices` | Toàn bộ giá riêng `{TICKER: {"YYYY-MM-DD": giá}}` |
| `GET` / `PUT` | `/api/securities/{ticker}/prices` | Đọc hoặc thêm giá; `replace: true` để thay toàn bộ |
| `DELETE` | `/api/securities/{ticker}/prices/{date}` | Xóa một giá |
| `POST` | `/api/securities/feed/test` | Thử một nguồn JSON, không lưu |
| `POST` | `/api/securities/update-quotes` | Cập nhật giá cho các mã Tự động của user và mọi nguồn JSON |
| `POST` | `/api/data/import/transactions` | Import CSV giao dịch; `dryRun: true` để xem trước |
| `POST` | `/api/data/import/prices` | Import CSV lịch sử giá |
| `GET` | `/api/data/export` | Bản sao lưu toàn bộ dữ liệu user |
| `POST` | `/api/data/import/workspace` | Khôi phục từ bản sao lưu |

## Lưu trữ

```
{guest_users|system_users}/{uid}/
├── securities/{TICKER}        name, assetClass, currency, feed, feedURL,
│                              feedProperties {closePath, datePath, factor, numberFormat}, note, isRetired
└── securityPrices/{TICKER}    prices: { "YYYY-MM-DD": close }
```

## Thay đổi về quyền ghi dữ liệu chung

- Bỏ `POST /api/prices/market` và `POST /api/prices/system-tickers`: trước đây mọi user đăng nhập đều ghi đè được giá chung và danh sách mã chung.
- `POST /api/prices/fetch-live` chỉ còn lấy giá cho mã của chính user gọi; lưu giá theo kiểu gộp nên không xóa giá của mã khác trong cùng ngày.
- Scheduler 9h sáng tự gom các mã Tự động của mọi user, admin không cần khai báo từng mã. Admin vẫn quản lý khóa API, lịch chạy và user.

---

## Xem thêm

- [[Feature Performance Reports]] — Báo cáo hiệu suất
- [[Feature Price Service]] — Nguồn giá hệ thống
- [[Architecture Database]] — Cấu trúc Firestore

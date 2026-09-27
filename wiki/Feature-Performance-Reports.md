# 📈 Feature: Performance Reports — Báo cáo theo mô hình Portfolio Performance

## Tổng quan

Giao diện người dùng được tổ chức theo mô hình của [Portfolio Performance](https://www.portfolio-performance.info/en/) (phần mềm mã nguồn mở quản lý danh mục):

- **Cây điều hướng** bên trái: Dữ liệu chung · Tài khoản · Báo cáo · Phân loại.
- **Thanh công cụ** phía trên: vị trí hiện tại, **kỳ báo cáo** dùng chung cho mọi báo cáo, làm mới dữ liệu, ghi nhận giao dịch.
- **Báo cáo dạng bảng** dày thông tin, có sắp xếp, nhóm, dòng tổng và biểu đồ đi kèm.
- Mỗi màn hình có **URL riêng** (hash router) để đánh dấu hoặc chia sẻ, ví dụ `#/reports/performance/calculation`.

## Cây điều hướng

| Nhóm | Màn hình | Đường dẫn | Tương đương trong Portfolio Performance |
|------|----------|-----------|------------------------------------------|
| — | Tổng quan | `#/dashboard` | Dashboard |
| Dữ liệu chung | Tất cả chứng khoán | `#/securities` | All Securities |
| | Tỷ giá & Vàng | `#/exchange-rates` | Exchange Rates |
| Tài khoản | Tài khoản chứng khoán | `#/accounts/securities` | Securities Accounts |
| | Tài khoản tiền mặt | `#/accounts/deposit` | Deposit Accounts |
| | Tài sản khác & Nợ | `#/accounts/other` | _(tài sản ròng, riêng của ứng dụng)_ |
| | Tất cả giao dịch | `#/transactions` | All Transactions |
| Báo cáo | Bảng kê tài sản | `#/reports/assets/holdings` · `/chart` · `/allocation` | Statement of Assets |
| | Hiệu suất › Tính toán | `#/reports/performance/calculation` | Performance › Calculation |
| | Hiệu suất › Biểu đồ | `#/reports/performance/chart` | Performance › Chart, Returns/Volatility |
| | Hiệu suất › Theo chứng khoán | `#/reports/performance/securities` | Performance › Securities |
| | Hiệu suất › Cổ tức & Dòng tiền | `#/reports/performance/payments` | Performance › Payments |
| | Hiệu suất › Giao dịch lãi/lỗ | `#/reports/performance/trades` | Performance › Trades |
| Phân loại | Loại tài sản | `#/taxonomies/asset-classes/definition` · `/pie` · `/history` · `/rebalance` | Taxonomies › Asset Classes, Rebalancing |
| | Nơi lưu ký | `#/taxonomies/storage` | Taxonomy tự định nghĩa |
| — | Cài đặt & Dữ liệu | `#/settings` | Settings |

## Kỳ báo cáo

Các lựa chọn: 1 tháng, 3 tháng, 6 tháng, Từ đầu năm (YTD), 1 năm, 2 năm, 3 năm, Toàn bộ và Tùy chọn (từ ngày – đến ngày). Lựa chọn được nhớ trong trình duyệt.

Ngày bắt đầu là **ngày gốc**: giá trị cuối ngày đó là giá trị đầu kỳ và chỉ các dòng tiền **sau** ngày gốc mới được tính. YTD dùng ngày 31/12 năm trước, giống Portfolio Performance. Nếu không có snapshot đúng ngày gốc, hệ thống dùng snapshot gần nhất trước đó, hoặc snapshot đầu tiên trong kỳ.

## Dữ liệu đầu vào

| Nguồn | Dùng cho |
|-------|----------|
| `dailySnapshots.portfolioValue` | Chuỗi giá trị danh mục (chứng khoán + tiền mặt) theo ngày |
| Giao dịch `Nạp tiền` / `Rút tiền` | Dòng tiền ngoài (external cash flow) — trung tính với hiệu suất |
| Giao dịch `Mua` / `Bán` | Giá vốn bình quân, lãi/lỗ đã thực hiện, lệnh lãi/lỗ |
| Giao dịch `Cổ tức` | Thu nhập (cổ tức, coupon, lãi tiền gửi) |
| `marketPrices`, `system/prices/daily` | Giá hệ thống: định giá hiện tại và lịch sử giá từng mã |
| `securities`, `securityPrices` của user | Giá nhập tay, import CSV hoặc nguồn JSON; xem [[Feature User Securities]] |
| `/api/prices/benchmarks/history` | VN-Index và Bitcoin làm chỉ số tham chiếu |

## Công thức

### TTWROR — True Time-Weighted Rate of Return

Với mỗi khoảng giữa hai snapshot liên tiếp:

```
r_i = (V_i − CF_i) / V_{i−1} − 1        CF_i = nạp − rút trong (t_{i−1}, t_i]
TTWROR = Π (1 + r_i) − 1
TTWROR p.a. = (1 + TTWROR)^(365 / số ngày) − 1
```

Nạp/rút tiền không làm thay đổi TTWROR nên chỉ số này dùng để so sánh với VN-Index, Bitcoin.

### IRR — Internal Rate of Return

Giải phương trình `Σ CF_k / (1 + IRR)^(t_k / 365) = 0` với dòng tiền theo góc nhìn nhà đầu tư: `−V_đầu kỳ`, `−nạp` / `+rút` tại ngày phát sinh và `+V_cuối kỳ`. Thuật toán Newton–Raphson, dự phòng bằng chia đôi khoảng.

### Thay đổi tuyệt đối và Delta

```
Thay đổi tuyệt đối = V_cuối − V_đầu
Delta              = Thay đổi tuyệt đối − (nạp − rút)
```

### Bảng tính hiệu suất

```
  Giá trị đầu kỳ
+ Lãi/lỗ vốn chưa thực hiện   (phần còn lại, để bảng luôn cân)
+ Lãi/lỗ đã thực hiện         (giá bán − giá vốn bình quân của lệnh bán trong kỳ)
+ Thu nhập                    (giao dịch Cổ tức trong kỳ)
− Phí, Thuế                   (chưa theo dõi riêng, đã gộp trong giá)
+ Chuyển tiền trung tính      (nạp − rút)
= Giá trị cuối kỳ
```

### Rủi ro

- **Max Drawdown**: mức giảm lớn nhất từ đỉnh xuống đáy của chuỗi chỉ số TTWROR; kèm thời gian nằm dưới đỉnh lâu nhất.
- **Biến động**: độ lệch chuẩn mẫu của lợi suất giữa các snapshot × √252. **Semi-volatility** chỉ xét các độ lệch âm.
- **Lợi nhuận theo tháng/năm** (heatmap): TTWROR của từng tháng và từng năm dương lịch trên toàn bộ lịch sử.

### Giao dịch lãi/lỗ và hiệu suất theo mã

- Mô hình **giá vốn bình quân** (giống `calculateHoldings`): mỗi lệnh bán tạo một lệnh đã đóng với giá trị vào = giá vốn bình quân × số lượng, giá trị ra = tiền bán.
- Vị thế đang mở được định giá theo giá thị trường hiện tại.
- Hiệu suất theo mã = chưa thực hiện + đã thực hiện + cổ tức; IRR từng mã tính từ dòng tiền mua, bán, cổ tức và giá trị hiện tại.

## Giao dịch "Cổ tức"

Loại giao dịch mới cho cổ tức tiền mặt, coupon trái phiếu và lãi tiền gửi:

- Tăng số dư tiền mặt VNĐ; **không** thay đổi giá vốn hay vốn ròng đã nạp.
- Có mã (VD `VNM`) → cổ tức của mã đó. Để trống mã → lãi tiền gửi.
- Được tính vào "Thu nhập" trong Bảng tính và mục Cổ tức & Dòng tiền.
- Engine Python (`portfolio_service.py`) và schema API (`TransactionCreate`) xử lý giống hệt engine JavaScript.

## Mã nguồn

| File | Vai trò |
|------|---------|
| `src/utils/performanceEngine.js` | TTWROR, IRR, drawdown, biến động, heatmap, lệnh lãi/lỗ, hiệu suất theo mã |
| `src/utils/accounts.js` | Sổ quỹ tiền mặt (số dư lũy kế), vị thế theo nơi lưu ký |
| `src/utils/reportingPeriod.js`, `src/utils/dates.js` | Kỳ báo cáo, xử lý ngày |
| `src/contexts/PortfolioDataContext.jsx` | Tải dữ liệu một lần, dữ liệu dẫn xuất, modal giao dịch |
| `src/contexts/ReportingPeriodContext.jsx` | Kỳ báo cáo toàn cục |
| `src/router/routes.js` | Cây điều hướng và định tuyến |
| `src/views/**` | Các màn hình báo cáo |

Kiểm thử: `src/utils/__tests__/performanceEngine.test.js`, `accounts.test.js`, `src/components/charts/__tests__/scale.test.js`.

## Lưu ý về độ chính xác

- Các chỉ số phụ thuộc chuỗi snapshot. Hãy dùng **Cài đặt & Dữ liệu → Dựng snapshot lịch sử** để lấp các ngày còn thiếu.
- Snapshot được lưu theo **ngày dương lịch địa phương** của người dùng (trước đây dùng ngày UTC).
- Phí và thuế chưa được ghi nhận riêng nên hiển thị "chưa theo dõi".

---

## Xem thêm

- [[Feature Snapshot Engine]] — Chụp nhanh danh mục hằng ngày
- [[Architecture Frontend]] — Kiến trúc frontend
- [[Feature Asset Classification]] — Phân loại tài sản

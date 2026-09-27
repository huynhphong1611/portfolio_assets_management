# 📸 Feature: Snapshot Engine — Chụp nhanh danh mục

## Tổng quan

Snapshot Engine tự động chụp trạng thái danh mục đầu tư mỗi ngày, lưu vào Firestore để xây dựng biểu đồ tăng trưởng theo thời gian.

## Cách hoạt động

### 1. Tính toán Holdings (giá vốn bình quân gia quyền di động)

Từ danh sách giao dịch (`transactions`), hệ thống tính số lượng và giá vốn của từng mã theo **bình quân gia quyền di động** (moving average cost — cách các công ty chứng khoán Việt Nam tính giá vốn). JS `calculateHoldings()` và Python `calculate_holdings()` dùng đúng cùng quy tắc:

| Giao dịch | Số lượng | Giá vốn (tổng) | Giá vốn bình quân |
|---|---|---|---|
| **Mua** q, thành tiền A | + q | + A | (giá vốn) / (số lượng) |
| **Bán** q | − q | − BQ × q | **không đổi** |

```
Mua VCB 100 @ 80.000 ₫ → SL 100, giá vốn  8.000.000, BQ 80.000
Mua VCB  50 @ 85.000 ₫ → SL 150, giá vốn 12.250.000, BQ 81.667
Bán VCB  30 @ 90.000 ₫ → giá vốn phần bán = 30 × 81.667 = 2.450.000
                          lãi đã thực hiện = 2.700.000 − 2.450.000 = 250.000
                          SL 120, giá vốn 9.800.000, BQ vẫn 81.667
```

- Thành tiền (`totalVND`) đã gồm phí nên phí nằm trong giá vốn. Mua với giá 0 (cổ tức bằng cổ phiếu, cổ phiếu thưởng) làm giá vốn bình quân giảm đúng như trên sổ công ty chứng khoán.
- **Bán nhiều hơn số đang giữ**: vị thế về 0. Phần vượt không có giá vốn nên **không** được tính vào lãi đã thực hiện; nó được báo trong mục *Kiểm tra dữ liệu*.
- Lãi đã thực hiện của một lệnh bán luôn tính theo giá vốn bình quân **tại ngày bán** (form giao dịch cũng dùng giá vốn tại ngày của giao dịch khi nhập lùi ngày).
- Theo từng nơi lưu ký (Tài khoản chứng khoán), mỗi tài khoản có giá vốn bình quân riêng; tên nơi lưu ký không phân biệt hoa/thường, và lệnh bán vượt số lượng của tài khoản ghi trên lệnh sẽ lấy phần còn lại từ tài khoản khác đang giữ mã đó.

### Tiền mặt, vốn ròng và tổng lãi/lỗ

Tiền mặt VNĐ là một sổ quỹ (`replayCash()` / `replay_cash()`), dùng chung cho Bảng kê tài sản, Tài khoản tiền mặt và dòng tiền của TTWROR/IRR:

| Giao dịch | Tiền mặt | Vốn ròng |
|---|---|---|
| Nạp tiền | + số tiền | + số tiền |
| Rút tiền | − số tiền | − số tiền |
| Mua | − thành tiền | — |
| Bán | + thành tiền | — |
| Cổ tức / lãi | + số tiền | — |

- **Có lệnh Nạp/Rút** (chế độ *tracked*): số dư có thể **âm** — nghĩa là một lệnh mua được ghi trước (hoặc thiếu) khoản nạp trả cho nó. Số dư không bao giờ bị ép về 0, vì ép về 0 sẽ tạo ra tiền mặt và lợi nhuận không có thật. Các đoạn số dư âm được liệt kê trong *Kiểm tra dữ liệu*.
- **Không có lệnh Nạp/Rút nào** (chế độ *implicit*, ví dụ chỉ nhập lệnh mua/bán từ CSV): tiền bán và cổ tức được giữ lại để trả cho lệnh mua sau; phần lệnh mua cần vượt số dư được tính là **vốn góp ngầm định**. Nhờ vậy vốn ròng là số tiền thực sự bỏ vào và TTWROR không coi lệnh mua là lợi nhuận.
- Mọi lệnh Nạp/Rút đều là tiền VNĐ (mã tài sản trên lệnh nạp/rút bị bỏ qua).
- Các giao dịch cùng thời điểm giữ nguyên thứ tự, riêng Nạp tiền được ghi trước và Rút tiền ghi sau cùng.

```
Tổng lãi/lỗ = Giá trị danh mục (tài sản + tiền mặt) − Vốn ròng
            = lãi đã thực hiện + lãi chưa thực hiện + cổ tức/lãi
```

Vốn ròng có thể ≤ 0 khi đã rút nhiều hơn số đã nạp; tổng lãi/lỗ vẫn là giá trị − vốn ròng, chỉ phần trăm lãi/lỗ không xác định (hiển thị 0).

Stablecoin (USDT/USDC) chưa có giá được định giá theo tỷ giá của chính nó, rồi tỷ giá USDT, rồi giá vốn bình quân. Tài sản khác chưa có giá được định giá theo giá vốn bình quân.

### Kiểm tra dữ liệu

`src/utils/dataChecks.js` (giống *File → Check for inconsistencies* của Portfolio Performance) không sửa con số nào, chỉ chỉ ra giao dịch cần sửa. Kết quả hiện ở **Tất cả giao dịch**, **Tài khoản tiền mặt** và một dòng cảnh báo trên **Tổng quan**:

| Loại | Mức | Ý nghĩa |
|---|---|---|
| Bán vượt số lượng | cảnh báo | Bán nhiều hơn số đang giữ tại thời điểm đó (thiếu lệnh mua/nhận, hoặc nhập sai số lượng) |
| Tiền mặt âm tạm thời | lưu ý (cùng ngày) / cảnh báo | Lệnh mua ghi trước khoản tiền trả cho nó; hiển thị lệnh gây âm và lệnh bù lại |
| Tiền mặt đang âm | cảnh báo | Thiếu lệnh Nạp tiền |
| Nơi lưu ký viết khác nhau | lưu ý | "Binance" / "binance" được gộp làm một tài khoản |
| Mua/Bán không dùng được | cảnh báo | Không có mã tài sản, hoặc số lượng bằng 0 |

Form giao dịch chặn lưu một lệnh bán (hoặc sửa một lệnh mua) nếu nó làm một lệnh bán nào đó — kể cả các lệnh bán sau đó — vượt số lượng đang giữ tại ngày của lệnh.

### 2. Định giá bằng Market Prices

```
Mỗi ticker → lấy giá từ marketPrices hoặc system/prices/daily
  VCB: 120 × 90,000₫ = 10,800,000₫
  BTC: 0.1 × 97,000 USD × 25,800₫ = 250,260,000₫
```

### 3. Tạo Snapshot

```json
{
  "date": "2026-05-02",
  "totalValue": 261060000,
  "totalCost": 235000000,
  "netCapital": 230000000,
  "unrealizedPnL": 26060000,
  "realizedPnL": 300000,
  "netWorth": 311060000,
  "externalTotal": 50000000,
  "liabilitiesTotal": 0,
  "assetClassBreakdown": {
    "stock": 0.42,
    "crypto": 0.38,
    "fund": 0.10,
    "gold": 0.05,
    "cash": 0.05
  },
  "holdings": {
    "VCB": { "quantity": 120, "value": 10800000, "cost": 9850000 },
    "BTC": { "quantity": 0.1, "value": 250260000, "cost": 220000000 }
  }
}
```

## Backfill — Chụp lại snapshot lịch sử

Khi cần tạo snapshot cho các ngày trong quá khứ (ví dụ: mới bắt đầu dùng app nhưng đã giao dịch từ tháng 1):

```
POST /api/snapshots/backfill
{
  "start_date": "2026-01-01",
  "end_date": "2026-04-30"
}
```

**Luồng xử lý Backfill:**

```
For each date in [start_date → end_date]:
  │
  ├── 1. Filter transactions có date ≤ current_date
  ├── 2. Calculate holdings từ filtered transactions
  ├── 3. Load giá từ system/prices/daily/{date}
  │      └── Nếu không có giá → fallback 7 ngày gần nhất
  ├── 4. Calculate portfolio value
  └── 5. Save snapshot vào dailySnapshots/{date}
```

**7-Day Rolling Price Fallback:**

Nếu ngày X không có giá trong `system/prices/daily/{X}`, hệ thống tìm lùi 7 ngày để lấy giá gần nhất. Điều này xử lý:
- Ngày cuối tuần/nghỉ lễ (sàn đóng cửa)
- Ngày chưa import giá lịch sử

## Biểu đồ tăng trưởng

Frontend sử dụng snapshots để vẽ:

1. **Portfolio Growth Chart** — totalValue, totalCost, PnL theo thời gian
2. **Net Worth Growth** — netWorth theo thời gian
3. **Cumulative Performance** — So sánh với VNINDEX và BTC benchmarks
4. **100% Stacked Area** — `assetClassBreakdown` theo thời gian

**Performance filters:**
- 1W, 1M, 3M, 6M, 1Y, All (tính từ ngày giao dịch đầu tiên)

---

## Xem thêm

- [[Feature Scheduler]] — Tự động chụp snapshot hàng ngày
- [[Feature Price Service]] — Engine lấy giá
- [[Feature Asset Classification]] — Phân loại tài sản

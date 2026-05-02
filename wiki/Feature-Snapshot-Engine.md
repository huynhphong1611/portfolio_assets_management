# 📸 Feature: Snapshot Engine — Chụp nhanh danh mục

## Tổng quan

Snapshot Engine tự động chụp trạng thái danh mục đầu tư mỗi ngày, lưu vào Firestore để xây dựng biểu đồ tăng trưởng theo thời gian.

## Cách hoạt động

### 1. Tính toán Holdings (FIFO)

Từ danh sách giao dịch (`transactions`), hệ thống tính số lượng nắm giữ hiện tại:

```
Transactions:
  Buy  VCB  100 @ 80,000₫  → +100 VCB
  Buy  VCB   50 @ 85,000₫  → +50 VCB
  Sell VCB   30 @ 90,000₫  → -30 VCB (FIFO: lấy từ lô 80,000₫)

Holdings:
  VCB: 120 units
    Lô 1: 70 @ 80,000₫ (100-30 đã bán)
    Lô 2: 50 @ 85,000₫
  Giá vốn trung bình: (70×80,000 + 50×85,000) / 120 = 82,083₫
```

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

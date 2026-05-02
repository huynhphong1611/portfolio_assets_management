# 🏷️ Feature: Asset Classification — Phân loại tài sản

## Tổng quan

Mỗi giao dịch trong hệ thống được gắn một `assetType` để phân loại tài sản. Phân loại này ảnh hưởng đến:

1. **Nguồn lấy giá** — vnstock, CoinGecko, hay vang.today
2. **Đơn vị tiền** — VNĐ hay USD (chuyển đổi)
3. **Biểu đồ phân bổ** — Tỷ lệ % mỗi loại trong portfolio
4. **Snapshot breakdown** — `assetClassBreakdown` trong daily snapshots

## Các loại tài sản

| `assetType` | Mô tả | Ví dụ | Nguồn giá | Đơn vị |
|-------------|--------|-------|-----------|--------|
| `stock` | Cổ phiếu VN | VCB, VIC, FPT | vnstock (KBS) | VNĐ |
| `crypto` | Tiền mã hoá | BTC, ETH, SOL | CoinGecko (USD) | USD → VNĐ |
| `fund` | Quỹ mở | VFF, VESAF, DCBF | vnstock (FMarket) | VNĐ |
| `bond` | Trái phiếu | _(manual pricing)_ | _(user input)_ | VNĐ |
| `gold` | Vàng | GOLD (SJC) | vang.today | VNĐ/lượng |
| `cash` | Tiền mặt | VNĐ | _(no pricing needed)_ | VNĐ |
| `stablecoin` | Stablecoin | USDT, USDC | CoinGecko (VND) | VNĐ |

## Tự động nhận diện

`price_service.py` sử dụng nhiều cơ chế để phân loại:

### Priority Order

```
1. asset_type_hint từ transaction    ← Ưu tiên cao nhất
2. Stablecoin set: {USDT, USDC}
3. Gold ticker: "GOLD"
4. Fund symbols set: {VFF, VESAF, ...}
5. Crypto mapping: {BTC → bitcoin, ...}
6. Auto-detect fallback:
   a. Try vnstock (stock)
   b. Try CoinGecko search (crypto)
```

### Ticker → Type Mapping (Admin config)

Admin cấu hình danh sách ticker theo loại tại `system/config/tickers`:

```json
{
  "stocks": ["VCB", "VIC", "FPT", "VNM", "HPG"],
  "crypto": ["BTC", "ETH", "SOL", "PAXG"],
  "funds": ["VFF", "VESAF", "DCBF", "TCBF"]
}
```

Scheduler sử dụng config này để tạo `ticker_type_map`, giúp `get_price()` biết chính xác loại tài sản mà không cần auto-detect.

## Biểu đồ phân bổ tài sản

### Donut Chart (Asset Allocation)

Frontend hiển thị tỷ lệ % giá trị mỗi loại:

```
Stock:  42% ████████░░░░░░░░░░░░
Crypto: 38% ███████░░░░░░░░░░░░░
Fund:   10% ██░░░░░░░░░░░░░░░░░░
Gold:    5% █░░░░░░░░░░░░░░░░░░░
Cash:    5% █░░░░░░░░░░░░░░░░░░░
```

### 100% Stacked Area Chart

Hiển thị sự thay đổi phân bổ theo thời gian, sử dụng `assetClassBreakdown` từ daily snapshots:

```
100% ┤ ████████████████████████████
     │ ████ Stock ████████████████
 75% ┤ ████████████████████████████
     │ ████ Crypto ██████████████
 50% ┤ ████████████████████████████
     │ ████ Fund █████████████████
 25% ┤ ████████████████████████████
     │ ████ Gold + Cash ██████████
  0% ┤____________________________
     Jan   Feb   Mar   Apr   May
```

## Giao dịch đặc biệt

### VNĐ Cash (Deposit / Withdrawal)

- `ticker: "VNĐ"` với `type: "deposit"` — Nạp tiền vào danh mục
- `ticker: "VNĐ"` với `type: "withdrawal"` — Rút tiền ra
- **Không cần fetch giá** — giá trị = quantity × 1
- Dùng để tính `netCapital` = Σ deposits - Σ withdrawals

### Stablecoin (USDT/USDC)

- Giá = tỷ giá VNĐ (CoinGecko: `tether` hoặc `usd-coin` → VND)
- **Không dùng giá USD** — trực tiếp lấy giá VNĐ
- Default fallback: 25,500 VNĐ/USDT

---

## Xem thêm

- [[Feature Price Service]] — Chi tiết engine lấy giá
- [[Feature Snapshot Engine]] — Cách tính snapshot
- [[Architecture Database]] — Cấu trúc Firestore

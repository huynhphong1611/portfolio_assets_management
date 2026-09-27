# 📝 Changelog — Lịch sử thay đổi

> Xem file gốc đầy đủ tại [CHANGELOG.md](https://github.com/huynhphong1611/portfolio_assets_management/blob/main/CHANGELOG.md)

## Timeline

### 2026-09-27
- ✨ Tổ chức lại toàn bộ giao diện theo mô hình Portfolio Performance: cây điều hướng (Dữ liệu chung / Tài khoản / Báo cáo / Phân loại), kỳ báo cáo toàn cục, URL riêng cho từng màn hình
- ✨ Engine hiệu suất: TTWROR, IRR, delta, max drawdown, biến động, heatmap lợi nhuận theo tháng, bảng tính hiệu suất
- ✨ Báo cáo mới: Bảng kê tài sản, Hiệu suất theo chứng khoán, Cổ tức & Dòng tiền, Giao dịch lãi/lỗ, Tài khoản chứng khoán/tiền mặt, Tỷ giá & Vàng, Tái cân bằng dạng bảng
- ✨ Loại giao dịch mới `Cổ tức` (cổ tức, coupon, lãi tiền gửi) ở frontend, backend và schema API
- ✨ `GET /api/prices/daily?limit=N` để vẽ lịch sử giá từng mã
- 🐛 Sửa form sửa giao dịch Rút tiền bị trống số tiền
- 🐛 Snapshot lưu theo ngày địa phương thay vì ngày UTC
- 🧪 Sửa 2 test cũ dùng dữ liệu giá sai đơn vị; thêm test cho engine hiệu suất, sổ quỹ, trục biểu đồ

### 2026-05-02
- ✨ Thêm 100% stacked area chart và All time range
- 🐛 Sửa lỗi BTC benchmark data (fallback days=365)
- 🐛 Sửa overlapping x-axis labels
- 📝 Cập nhật pre_commit_scan workflow

### 2026-04-26
- 🔒 Tăng cường bảo mật
- 🐛 Sửa daily scheduler

### 2026-04-25
- 📚 Thêm deployment guide
- ✨ Thêm tính năng edit prices

### 2026-04-24
- 🐛 Sửa bug totalCost âm trong P&L
- ✨ Thêm script import historical market data

### 2026-04-22
- ✨ Implemented historical snapshot backfill
- ✨ Admin-controlled price sync
- 🔄 Removed dead PriceManager component
- 🔄 Refined portfolio P&L accounting

### 2026-04-21
- ✨ Admin Portal với centralized system prices

### 2026-04-15
- 🐛 Fixed scheduler fallback corruption
- 🐛 Fixed user-specific fallback prices

### 2026-04-13
- 🐛 Sanitized legacy stablecoin prices
- ✨ Added USDC and Gold (SJC) tracking
- 🐛 Fixed scheduler price retention logic

### 2026-04-12
- ✨ AddTransactionModal với validation
- ✨ Scheduler service (standalone + serverless)
- 📚 Initial deployment guide

### 2026-04-11
- ✨ Backend scheduler service
- 🔧 VS Code QA agent configs

### 2026-04-10
- ✨ TransactionLog, PriceManager, FundManager components
- ✨ Cumulative Performance Chart
- 🔄 **Fullstack refactor v6.0** — dynamic prices, auto-scheduler
- 🔒 Updated Firestore security rules

### 2026-04-06
- ✨ Dual Auth (Firebase + Guest)
- 🔒 Isolated auth data

### 2026-04-04
- ✨ CoinGecko API + vnstock Community Tier
- ✨ Dockerized Vitest coverage

### 2026-04-01
- ✨ Initial portfolio management engine
- 🔄 Migrated to React + Firebase

### 2026-03-28
- 🎨 Initial web UI with mock data

### 2024-05-08
- 🎉 Initial commit

---

## Legend

| Icon | Ý nghĩa |
|:----:|---------|
| ✨ | Tính năng mới |
| 🐛 | Sửa lỗi |
| 🔒 | Bảo mật |
| 🔄 | Refactor |
| 📚 | Tài liệu |
| 🔧 | Cấu hình |
| 🎨 | Giao diện |
| 🎉 | Release |

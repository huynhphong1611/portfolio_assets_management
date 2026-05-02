# 🔌 API Reference — Danh sách API Endpoints

Base URL: `http://localhost:8000` (local) hoặc `https://portfoliomanagement-d237b.web.app` (production)

> Tất cả endpoint `/api/*` yêu cầu header `Authorization: Bearer <JWT_TOKEN>` trừ khi ghi chú khác.

---

## 🔐 Authentication

### Guest Auth

| Method | Endpoint | Auth | Mô tả |
|--------|----------|:----:|--------|
| `POST` | `/api/auth/guest/register` | ❌ | Đăng ký guest user mới |
| `POST` | `/api/auth/guest/login` | ❌ | Đăng nhập guest user |

**Register Request:**
```json
{
  "username": "testuser",
  "password": "mypassword123"
}
```

**Login Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user_id": "testuser",
  "user_type": "guest"
}
```

### Firebase Auth

| Method | Endpoint | Auth | Mô tả |
|--------|----------|:----:|--------|
| `POST` | `/api/auth/firebase/verify` | ❌ | Verify Firebase ID token |

**Request:**
```json
{
  "id_token": "eyJhbGciOiJSUzI1NiIs..."
}
```

---

## 💼 Dashboard

| Method | Endpoint | Auth | Mô tả |
|--------|----------|:----:|--------|
| `GET` | `/api/dashboard` | ✅ | Dữ liệu dashboard tổng hợp |

**Response:** Trả về tất cả thông tin cần thiết cho dashboard trong một request.

---

## 📋 Transactions

| Method | Endpoint | Auth | Mô tả |
|--------|----------|:----:|--------|
| `GET` | `/api/transactions` | ✅ | Lấy danh sách giao dịch |
| `POST` | `/api/transactions` | ✅ | Tạo giao dịch mới |
| `DELETE` | `/api/transactions/{id}` | ✅ | Xoá giao dịch |

**Create Transaction:**
```json
{
  "ticker": "VCB",
  "type": "buy",
  "quantity": 100,
  "price": 85000,
  "total": 8500000,
  "fee": 15000,
  "date": "2026-04-01",
  "assetType": "stock",
  "fund": "Growth",
  "note": "Mua VCB"
}
```

---

## 💰 Funds

| Method | Endpoint | Auth | Mô tả |
|--------|----------|:----:|--------|
| `GET` | `/api/funds` | ✅ | Lấy danh sách quỹ ảo |
| `POST` | `/api/funds` | ✅ | Tạo / cập nhật quỹ |

---

## 📊 Prices

| Method | Endpoint | Auth | Mô tả |
|--------|----------|:----:|--------|
| `GET` | `/api/prices/stock` | ✅ | Lấy giá 1 mã |
| `GET` | `/api/prices/stocks` | ✅ | Lấy giá nhiều mã |
| `GET` | `/api/prices/daily` | ✅ | Lấy giá user theo ngày |
| `POST` | `/api/prices/daily` | ✅ | Lưu giá user theo ngày |
| `GET` | `/api/prices/market` | ✅ | Lấy giá thị trường |
| `POST` | `/api/prices/market` | ✅ | Cập nhật giá thị trường |
| `GET` | `/api/prices/system-daily` | ✅ | Lấy giá system theo ngày |
| `GET` | `/api/prices/benchmark-history` | ✅ | VNINDEX + BTC historical |

**Single Price:**
```
GET /api/prices/stock?symbol=VCB&source=kbs
```

**Multi Price:**
```
GET /api/prices/stocks?symbols=BTC,VCB,VFF&source=kbs
```

**Response:**
```json
{
  "VCB": {
    "symbol": "VCB",
    "price": 85000,
    "date": "2026-05-02",
    "source": "kbs",
    "type": "stock"
  }
}
```

---

## 📸 Snapshots

| Method | Endpoint | Auth | Mô tả |
|--------|----------|:----:|--------|
| `GET` | `/api/snapshots` | ✅ | Lấy tất cả daily snapshots |
| `POST` | `/api/snapshots/save` | ✅ | Lưu snapshot hôm nay |
| `POST` | `/api/snapshots/backfill` | ✅ | Backfill snapshot lịch sử |

**Backfill Request:**
```json
{
  "start_date": "2026-01-01",
  "end_date": "2026-04-30"
}
```

---

## 🏦 External Assets

| Method | Endpoint | Auth | Mô tả |
|--------|----------|:----:|--------|
| `GET` | `/api/external-assets` | ✅ | Lấy tài sản ngoài danh mục |
| `POST` | `/api/external-assets` | ✅ | Thêm/cập nhật tài sản |
| `DELETE` | `/api/external-assets/{id}` | ✅ | Xoá tài sản |

---

## 💳 Liabilities

| Method | Endpoint | Auth | Mô tả |
|--------|----------|:----:|--------|
| `GET` | `/api/liabilities` | ✅ | Lấy danh sách nợ |
| `POST` | `/api/liabilities` | ✅ | Thêm/cập nhật khoản nợ |
| `DELETE` | `/api/liabilities/{id}` | ✅ | Xoá khoản nợ |

---

## ⚙️ Settings

| Method | Endpoint | Auth | Mô tả |
|--------|----------|:----:|--------|
| `GET` | `/api/settings` | ✅ | Lấy user settings |
| `POST` | `/api/settings` | ✅ | Cập nhật settings |

---

## ⏰ Scheduler

| Method | Endpoint | Auth | Mô tả |
|--------|----------|:----:|--------|
| `GET` | `/api/scheduler/status` | ✅ | Trạng thái scheduler |
| `POST` | `/api/scheduler/run-now` | ✅ | Trigger thủ công (standalone) |
| `POST` | `/api/scheduler/trigger` | 🔑 | Trigger từ Cloud Scheduler (serverless) |

> 🔑 Endpoint `/trigger` yêu cầu header `X-Cron-Key` thay vì JWT.

---

## 🛡️ Admin

| Method | Endpoint | Auth | Mô tả |
|--------|----------|:----:|--------|
| `POST` | `/api/admin/login` | ❌ | Admin login |
| `GET` | `/api/admin/prices/market` | 🔒 | Lấy giá thị trường (admin) |
| `POST` | `/api/admin/prices/fetch` | 🔒 | Fetch giá mới |
| `POST` | `/api/admin/prices/market` | 🔒 | Cập nhật giá |
| `GET` | `/api/admin/tickers` | 🔒 | Lấy danh sách ticker |
| `POST` | `/api/admin/tickers` | 🔒 | Cập nhật danh sách ticker |

> 🔒 Endpoint admin yêu cầu `Admin-Authorization: Bearer <ADMIN_JWT>`.

---

## 🏥 Health Check

| Method | Endpoint | Auth | Mô tả |
|--------|----------|:----:|--------|
| `GET` | `/` | ❌ | Health check cơ bản |
| `GET` | `/api/status` | ❌ | Kiểm tra kết nối Firebase + vnstock |

**Health Response:**
```json
{
  "status": "ok",
  "api_enabled": true,
  "deployment_mode": "standalone",
  "timestamp": "2026-05-02T09:00:00",
  "version": "2.0.0"
}
```

---

## Xem thêm

- [[API Authentication]] — Chi tiết luồng xác thực
- [[Architecture Backend]] — Kiến trúc backend

# 🔐 Environment Variables — Biến môi trường

Dự án sử dụng file `.env` tại thư mục gốc để quản lý tất cả cấu hình. Docker Compose tự động đọc file này.

---

## Danh sách biến môi trường

### Firebase (Frontend — Vite)

Các biến có prefix `VITE_` sẽ được inject vào frontend build.

| Biến | Bắt buộc | Mô tả |
|------|:--------:|-------|
| `VITE_FIREBASE_API_KEY` | ✅ | Firebase API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | ✅ | Firebase Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | ✅ | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | ✅ | Firebase Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | ✅ | FCM sender ID |
| `VITE_FIREBASE_APP_ID` | ✅ | Firebase App ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | ❌ | Google Analytics measurement ID |

### Firebase (Backend)

| Biến | Bắt buộc | Default | Mô tả |
|------|:--------:|---------|-------|
| `FIREBASE_SERVICE_ACCOUNT_PATH` | ✅ | `./firebase-service-account.json` | Đường dẫn file service account JSON |

### Authentication

| Biến | Bắt buộc | Default | Mô tả |
|------|:--------:|---------|-------|
| `JWT_SECRET` | ✅ | `portfolio-mgmt-jwt-...` | Secret key cho Guest JWT tokens |
| `JWT_EXPIRE_HOURS` | ❌ | `72` | Thời gian hết hạn JWT (giờ) |
| `ADMIN_USERNAME` | ❌ | `admin` | Username cho Admin Portal |
| `ADMIN_PASSWORD` | ✅ | _(trống)_ | Password cho Admin Portal |
| `ADMIN_JWT_SECRET` | ✅ | `admin-jwt-secret-...` | Secret key riêng cho admin JWT |
| `ADMIN_JWT_EXPIRE_HOURS` | ❌ | `8` | Thời gian hết hạn admin JWT |

### External APIs

| Biến | Bắt buộc | Default | Mô tả |
|------|:--------:|---------|-------|
| `VNSTOCK_API_ENABLED` | ❌ | `true` | Bật/tắt vnstock API |
| `VNSTOCK_API_KEY` | ❌ | _(trống)_ | vnstock Community Tier API key |
| `COINGECKO_API_KEY` | ❌ | _(trống)_ | CoinGecko Demo API key |

### Deployment

| Biến | Bắt buộc | Default | Mô tả |
|------|:--------:|---------|-------|
| `DEPLOYMENT_MODE` | ❌ | `standalone` | `standalone` (local/VPS) hoặc `serverless` (Cloud Run) |
| `CRON_AUTH_KEY` | ✅* | _(trống)_ | Secret key cho Cloud Scheduler trigger (*bắt buộc khi serverless) |
| `LOG_LEVEL` | ❌ | `INFO` | Level logging: `DEBUG`, `INFO`, `WARNING`, `ERROR` |

---

## File `.env.example`

```env
# ── Firebase (Frontend) ──
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# ── Backend ──
JWT_SECRET=change-me-in-production
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
DEPLOYMENT_MODE=standalone
LOG_LEVEL=INFO

# ── External APIs ──
VNSTOCK_API_ENABLED=true
VNSTOCK_API_KEY=
COINGECKO_API_KEY=

# ── Admin ──
ADMIN_USERNAME=admin
ADMIN_PASSWORD=
ADMIN_JWT_SECRET=change-me-admin
```

---

## Lưu ý bảo mật

1. **KHÔNG BAO GIỜ** commit file `.env` lên Git (đã có trong `.gitignore`)
2. **KHÔNG BAO GIỜ** commit file `firebase-service-account.json`
3. Sử dụng giá trị `JWT_SECRET` và `ADMIN_JWT_SECRET` **khác nhau**
4. `CRON_AUTH_KEY` phải **khác** `JWT_SECRET` — dùng riêng cho Cloud Scheduler
5. Trên Cloud Run, biến môi trường được inject qua `--set-env-vars` hoặc `--update-env-vars`

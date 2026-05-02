# 🛠️ Troubleshooting — Xử lý sự cố

## 🔴 Lỗi thường gặp

---

### ❌ Giá không cập nhật lúc 9h sáng

**Triệu chứng:** Giá cổ phiếu/crypto trên dashboard không đổi sau 9:00 AM.

**Nguyên nhân có thể:**
1. Cloud Scheduler không trigger được
2. Backend gặp lỗi khi fetch giá
3. Rate limit từ vnstock hoặc CoinGecko

**Xử lý:**

```bash
# 1. Kiểm tra Cloud Scheduler
# → Google Cloud Console → Cloud Scheduler → portfolio-daily-update
# → Xem cột "Last run result" (Success/Failed)

# 2. Kiểm tra logs Backend
# → Google Cloud Console → Cloud Run → fastapi-backend → Logs
# Tìm kiếm: "SCHEDULER" hoặc "RATE_LIMIT"

# 3. Force trigger thủ công
curl -X POST https://fastapi-backend-xxx.a.run.app/api/scheduler/trigger \
  -H "X-Cron-Key: <CRON_AUTH_KEY>"

# 4. Kiểm tra local
docker compose logs -f backend | grep -i "scheduler\|error\|rate"
```

---

### ❌ Lỗi PERMISSION_DENIED khi deploy Cloud Run

**Triệu chứng:**
```
ERROR: PERMISSION_DENIED: Cloud Build API has not been used...
```

**Xử lý:**
```bash
# Cấp quyền cho service account
gcloud projects add-iam-policy-binding <PROJECT_ID> \
  --member="serviceAccount:<PROJECT_NUMBER>-compute@developer.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.builder"
```

---

### ❌ Trang trắng (White Screen) sau deploy Frontend

**Triệu chứng:** Truy cập web hiện trang trắng, F12 thấy lỗi JavaScript.

**Nguyên nhân:** Biến `VITE_*` không được set khi build.

**Xử lý:**
```bash
# 1. Kiểm tra .env có đủ biến VITE_*
cat .env | grep VITE_

# 2. Rebuild
npm run build

# 3. Kiểm tra dist có file đúng
ls -la dist/

# 4. Redeploy
firebase deploy --only hosting
```

---

### ❌ Lỗi Firebase/Firestore Connection

**Triệu chứng:**
```json
{"checks": {"firebase": "error: ..."}}
```

**Xử lý:**
```bash
# 1. Kiểm tra file service account
ls -la backend/firebase-service-account.json

# 2. Kiểm tra env var
echo $FIREBASE_SERVICE_ACCOUNT_PATH

# 3. Trong Docker, path phải là:
# FIREBASE_SERVICE_ACCOUNT_PATH=/app/firebase-service-account.json

# 4. Kiểm tra API status
curl http://localhost:8000/api/status
```

---

### ❌ Lỗi vnstock "GIỚI HẠN API" (Rate Limit)

**Triệu chứng:** Logs hiện `[RATE_LIMIT] Stock VCB` hoặc `GIỚI HẠN API`.

**Nguyên nhân:** vnstock Community Tier giới hạn 20 requests/phút.

**Xử lý:**
- Đợi 1 phút rồi thử lại
- Kiểm tra `VNSTOCK_API_KEY` đã set đúng chưa
- Hệ thống đã có delay 0.5s giữa các request
- Nâng cấp vnstock API tier nếu cần

---

### ❌ CoinGecko API lỗi 401/403

**Triệu chứng:** Crypto prices không load, logs hiện `CoinGecko API error 401`.

**Nguyên nhân:** 
- API key hết hạn hoặc sai
- Demo tier không hỗ trợ `days=max` (đã có fallback `days=365`)

**Xử lý:**
```bash
# 1. Kiểm tra API key
echo $COINGECKO_API_KEY

# 2. Test trực tiếp
curl "https://api.coingecko.com/api/v3/ping" \
  -H "x-cg-demo-api-key: <YOUR_KEY>"

# 3. Nếu không có key, CoinGecko vẫn hoạt động nhưng bị rate limit chặt hơn
```

---

### ❌ P&L hiển thị sai / totalCost âm

**Triệu chứng:** Dashboard hiện lãi/lỗ bất thường hoặc vốn đầu tư âm.

**Nguyên nhân:** Giao dịch không nhất quán (bán nhiều hơn mua, hoặc thiếu deposit).

**Xử lý:**
1. Kiểm tra tab **Transactions** — đảm bảo có đủ `deposit` trước khi `buy`
2. Kiểm tra thứ tự ngày giao dịch
3. Chạy lại **Backfill Snapshots** để tính toán lại:
   - Mở modal "Historical Snapshot"
   - Chọn date range từ ngày giao dịch đầu tiên
   - Nhấn "Backfill"

---

### ❌ Docker container không start

**Triệu chứng:** `docker compose up` báo lỗi hoặc container exit ngay.

**Xử lý:**
```bash
# 1. Xem logs chi tiết
docker compose logs backend

# 2. Kiểm tra file .env tồn tại
ls -la .env

# 3. Kiểm tra firebase-service-account.json
ls -la backend/firebase-service-account.json

# 4. Rebuild hoàn toàn
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

## 🟡 Lưu ý vận hành

### Logs quan trọng cần theo dõi

| Keyword | Ý nghĩa |
|---------|---------|
| `🕘 DAILY SCHEDULER START` | Scheduler bắt đầu chạy |
| `🕘 DAILY SCHEDULER DONE` | Scheduler hoàn thành |
| `[RATE_LIMIT]` | Bị giới hạn API |
| `✅ User xxx: snapshot saved` | Snapshot tạo thành công |
| `❌ Error processing user` | Lỗi khi xử lý user cụ thể |

### Health Check Endpoints

```bash
# Kiểm tra nhanh
curl http://localhost:8000/                    # Basic health
curl http://localhost:8000/api/status           # Firebase + vnstock check
curl http://localhost:8000/api/scheduler/status  # Scheduler status
```

---

## Xem thêm

- [[Feature Scheduler]] — Chi tiết scheduler
- [[Deployment Guide]] — Quy trình deploy
- [[Environment Variables]] — Kiểm tra cấu hình

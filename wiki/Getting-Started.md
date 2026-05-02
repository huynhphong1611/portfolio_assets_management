# 🚀 Getting Started — Bắt đầu nhanh

## Yêu cầu hệ thống

| Yêu cầu | Phiên bản |
|----------|-----------|
| **Docker Desktop** | ≥ 24.0 |
| **Node.js** (nếu chạy ngoài Docker) | ≥ 18.0 |
| **Python** (nếu chạy ngoài Docker) | ≥ 3.11 |
| **Firebase Project** | Đã bật Firestore |

## Cài đặt nhanh (Docker — Khuyến nghị)

### Bước 1: Clone Repository

```bash
git clone https://github.com/huynhphong1611/portfolio_assets_management.git
cd portfolio_assets_management
```

### Bước 2: Cấu hình Environment

Tạo file `.env` ở thư mục gốc:

```env
# Firebase Config (Frontend)
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Backend
JWT_SECRET=your_random_jwt_secret_key
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json

# API Settings
VNSTOCK_API_ENABLED=true
VNSTOCK_API_KEY=your_vnstock_community_key
COINGECKO_API_KEY=your_coingecko_api_key
LOG_LEVEL=INFO
```

> ⚠️ Xem chi tiết tất cả biến môi trường tại [[Environment Variables]]

### Bước 3: Firebase Service Account

1. Vào [Firebase Console](https://console.firebase.google.com/) → Project Settings → Service Accounts
2. Nhấn **"Generate New Private Key"**
3. Lưu file JSON vào `backend/firebase-service-account.json`

> 🔒 File này nằm trong `.gitignore` — **KHÔNG BAO GIỜ** commit lên Git.

### Bước 4: Khởi chạy

```bash
docker compose up -d --build
```

### Bước 5: Truy cập

| Service | URL |
|---------|-----|
| **Frontend** | [http://localhost:5173](http://localhost:5173) |
| **Backend API** | [http://localhost:8000](http://localhost:8000) |
| **API Docs** | [http://localhost:8000/docs](http://localhost:8000/docs) |

### Bước 6: Kiểm tra sức khoẻ

```bash
# Health check
curl http://localhost:8000/

# Service status
curl http://localhost:8000/api/status

# Scheduler status
curl http://localhost:8000/api/scheduler/status
```

**Kết quả mong đợi:**
```json
{
  "status": "ok",
  "api_enabled": true,
  "deployment_mode": "standalone",
  "version": "2.0.0"
}
```

---

## Cài đặt không dùng Docker (Manual)

### Frontend

```bash
# Cài dependencies
npm install

# Chạy dev server
npm run dev
```

### Backend

```bash
cd backend

# Tạo virtual environment
python -m venv .venv
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # macOS/Linux

# Cài dependencies
pip install -r requirements.txt

# Chạy server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## Bước tiếp theo

- [[Architecture Overview]] — Hiểu kiến trúc tổng thể
- [[API Reference]] — Danh sách API endpoints
- [[Deployment Guide]] — Deploy lên production (Cloud Run + Firebase Hosting)

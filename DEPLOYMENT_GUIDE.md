# 🚀 Cẩm nang Triển khai (Deployment Guide) - Portfolio Management v5.0

Tài liệu này hướng dẫn chi tiết cách vận hành, cập nhật code và theo dõi "sức khỏe" của toàn bộ hệ thống sau khi đã chuyển sang kiến trúc **Serverless** (Cloud Run + Firebase).

---

## 🏗️ 1. Kiến trúc Hệ thống Hiện tại
*   **Frontend (Vite + React):** Được host trên **Firebase Hosting**. Tự động điều hướng các API requests (`/api/**`) sang Backend để tránh lỗi CORS.
*   **Backend (FastAPI):** Nằm gọn trong Docker container chạy trên **Google Cloud Run**. Chỉ kích hoạt CPU khi có Requests đến (Scale-to-Zero tiết kiệm năng lượng/chi phí). Biến môi trường: `DEPLOYMENT_MODE=serverless`.
*   **Database:** Firestore (chia sẻ chung cùng project Firebase).
*   **Trình kích hoạt giá hàng ngày (Cron):** **Google Cloud Scheduler** tự động gọi API `POST /api/scheduler/trigger` lúc 9:00 AM hằng ngày để mồi Backend lấy giá.

---

## 🎬 2. Deploy Lần Đầu (First-time Deployment)

> Làm đúng một lần, dùng mãi mãi. Đọc kỹ từng bước, **đừng bỏ qua bước nào**.

### 🧰 Bước 2.0: Chuẩn bị — Kiểm tra các điều kiện cần

Trước khi bắt đầu, đảm bảo bạn đã có:

| Điều kiện | Kiểm tra |
|---|---|
| Tài khoản Gmail (Google Account) | ✅ Đã có |
| Dự án Firebase đã tạo | ✅ Đã có (`portfoliomanagement-d237b`) |
| File `firebase-service-account.json` ở máy | ✅ Ở thư mục `backend/` |
| File `.env` đầy đủ tất cả các Token | ✅ Ở thư mục gốc |
| Code đã được đẩy lên GitHub | ✅ Trên nhánh `main` |

---

### ☁️ Bước 2.1: Mở Cloud Shell (Máy tính ảo trên trình duyệt)

1.  Truy cập [Google Cloud Console](https://console.cloud.google.com/).
2.  Nhấn vào **biểu tượng `>_`** (Activate Cloud Shell) ở góc trên cùng bên phải màn hình.
3.  Một màn hình Terminal đen sẽ hiện ra ở đáy trình duyệt. Đây là máy Linux ảo của Google, đã cài sẵn `gcloud`, `npm`, `git`, `docker`...
4.  Đặt đúng Project ID để mọi lệnh sau chạy đúng chỗ:
    ```bash
    gcloud config set project portfoliomanagement-d237b
    ```
5.  Cài Firebase CLI (nếu chưa có):
    ```bash
    npm install -g firebase-tools
    firebase login --no-localhost
    ```
    > Lệnh này sẽ in ra một đường link, bạn copy link đó mở trên trình duyệt để đăng nhập Gmail, sau đó copy lại mã xác thực dán vào Terminal.

---

### 📦 Bước 2.2: Tải Code Dự án về Cloud Shell

```bash
# Clone code từ GitHub về máy ảo Cloud Shell
git clone https://github.com/<TÊN_GITHUB_CỦA_BẠN>/portfolio_assets_management.git

# Di chuyển vào thư mục dự án
cd portfolio_assets_management
```

---

### 📂 Bước 2.3: Upload các File Bí mật

Vì `.gitignore` đã ngăn 2 file nhạy cảm này được đẩy lên GitHub, bạn cần upload chúng thủ công.

1.  Trong cửa sổ Cloud Shell, nhấn vào **biểu tượng 3 dấu chấm (⋮)** ở góc trên bên phải của Terminal.
2.  Chọn **Upload**.
3.  Upload **2 file** sau đây từ máy tính cá nhân của bạn:
    *   `.env` → Upload vào thư mục gốc (`/home/<user>/portfolio_assets_management/`)
    *   `firebase-service-account.json` → Upload vào thư mục `backend/`
4.  Xác nhận file đã tới nơi:
    ```bash
    ls -la .env
    ls -la backend/firebase-service-account.json
    ```
    Nếu cả 2 dòng đều hiện thông tin file (không báo `No such file`) là thành công.

---

### 🔧 Bước 2.4: Cấp Quyền cho Service Account (Chỉ làm 1 lần)

Đây là bước bắt buộc giúp "thợ xây" (Cloud Build) của Google có đủ quyền đóng gói code của bạn. Nếu bỏ qua bước này, bước Deploy Backend sẽ báo lỗi `PERMISSION_DENIED`.

```bash
# Lấy PROJECT_NUMBER bằng lệnh:
# gcloud projects describe <YOUR_PROJECT_ID> --format='value(projectNumber)'

# Cấp quyền Build
gcloud projects add-iam-policy-binding <YOUR_PROJECT_ID> \
  --member="serviceAccount:<PROJECT_NUMBER>-compute@developer.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.builder"

# Cấp quyền đọc/ghi Storage (để lưu trữ file nén khi deploy)
gcloud projects add-iam-policy-binding <YOUR_PROJECT_ID> \
  --member="serviceAccount:<PROJECT_NUMBER>-compute@developer.gserviceaccount.com" \
  --role="roles/storage.admin"

# Cấp quyền đọc Firestore (để Backend kết nối được Database)
gcloud projects add-iam-policy-binding <YOUR_PROJECT_ID> \
  --member="serviceAccount:<PROJECT_NUMBER>-compute@developer.gserviceaccount.com" \
  --role="roles/datastore.user"
```

> ✅ Mỗi lệnh chạy xong sẽ hiển thị một đoạn JSON dài. Đó là bình thường, không cần lo.

---

### 🐍 Bước 2.5: Deploy Backend lên Google Cloud Run

```bash
# Di chuyển vào thư mục backend
cd backend

# Chạy lệnh Deploy (thay các giá trị <...> bằng thông tin thật của bạn)
gcloud run deploy fastapi-backend \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --set-env-vars="DEPLOYMENT_MODE=serverless" \
  --set-env-vars="JWT_SECRET=<copy từ file .env>" \
  --set-env-vars="VNSTOCK_API_ENABLED=true" \
  --set-env-vars="VNSTOCK_API_KEY=<copy từ file .env>" \
  --set-env-vars="COINGECKO_API_KEY=<copy từ file .env>" \
  --set-env-vars="FIREBASE_SERVICE_ACCOUNT_PATH=/app/firebase-service-account.json"
```

> ⏳ Lệnh này sẽ mất **2-4 phút**. Bạn sẽ thấy dòng chữ `Building Container...` quay vòng.

**✅ Dấu hiệu thành công:**
```
Service [fastapi-backend] revision [...] has been deployed and is serving 100% of traffic.
Service URL: https://fastapi-backend-<HASH>-<REGION_CODE>.a.run.app
```
> 📌 **Lưu lại URL này!** Copy URL từ output lệnh deploy — URL này là duy nhất của project bạn.

**Kiểm tra Backend đã sống chưa:**
```bash
curl https://fastapi-backend-<HASH>-<REGION_CODE>.a.run.app/
# Kết quả mong đợi: {"status":"ok","deployment_mode":"serverless",...}
```

---

### 🌐 Bước 2.6: Build & Deploy Frontend lên Firebase Hosting

```bash
# Quay về thư mục gốc dự án
cd ..

# Cài đặt các thư viện Node.js
npm install

# Đóng gói code React thành file HTML/CSS/JS tĩnh
npm run build
# Kết quả: Tạo ra thư mục dist/ — đây là "thành phẩm" sẽ được đưa lên mạng

# Đăng nhập Firebase (nếu chưa làm ở Bước 2.1)
firebase login --no-localhost

# Chọn đúng dự án Firebase
firebase use portfoliomanagement-d237b

# Kiểm tra nhanh firebase.json có phần rewrites chưa
cat firebase.json
# Phải có đoạn "source": "/api/**" và "run": {"serviceId": "fastapi-backend"}

# Deploy lên Firebase Hosting
firebase deploy --only hosting
```

> ⏳ Lệnh này chỉ mất khoảng **30 giây**.

**✅ Dấu hiệu thành công:**
```
✔  Deploy complete!
Hosting URL: https://portfoliomanagement-d237b.web.app
```

**Kiểm tra ngay:** Mở trình duyệt vào `https://portfoliomanagement-d237b.web.app`. Nếu thấy giao diện Web của bạn hiện ra là thành công!

---

### 🗑️ Bước 2.7: Dọn dẹp File Bí mật (Bảo mật)

Sau khi deploy xong cả Frontend lẫn Backend, hãy xóa các file nhạy cảm khỏi Cloud Shell:

```bash
# Xóa file .env khỏi Cloud Shell
rm ~/portfolio_assets_management/.env

# Xóa file service account khỏi Cloud Shell
rm ~/portfolio_assets_management/backend/firebase-service-account.json

echo "✅ Đã dọn dẹp xong. Server đã nhớ sẵn cấu hình rồi!"
```

---

### ⏰ Bước 2.8: Cài đặt Cron Job Tự động (Cloud Scheduler)

Đây là "báo thức" giúp hệ thống tự động lấy giá cổ phiếu/coin mỗi sáng 9h mà không cần bạn phải làm gì.

1.  Truy cập [Google Cloud Scheduler](https://console.cloud.google.com/cloudscheduler).
2.  Nhấn **CREATE JOB** và điền thông tin:

| Trường | Giá trị |
|---|---|
| **Name** | `portfolio-daily-update` |
| **Region** | `asia-southeast1` |
| **Frequency** | `0 9 * * *` |
| **Timezone** | `Asia/Ho_Chi_Minh` |
| **Target type** | `HTTP` |
| **URL** | `https://fastapi-backend-<HASH>-as.a.run.app/api/scheduler/trigger` |
| **HTTP method** | `POST` |
| **Header Name** | `X-Cron-Key` |
| **Header Value** | [Giá trị `CRON_AUTH_KEY` trong file `.env` của bạn — KHÔNG phải JWT_SECRET] |
| **Attempt deadline** | `300s` (5 phút — vì endpoint chạy đồng bộ, cần đủ thời gian để xử lý xong) |

> ⚠️ **Lưu ý bảo mật**: 
> - URL phải trỏ **thẳng** đến Cloud Run, **KHÔNG** qua Firebase Hosting (timeout 60s).
> - **KHÔNG** lưu URL Cloud Run thật vào file này nếu repo là public — ghi vào private notes riêng.
> - `X-Cron-Key` phải là giá trị `CRON_AUTH_KEY` riêng biệt, không dùng chung `JWT_SECRET`.

---

### ✅ Bước 2.9: Checklist Xác nhận Toàn bộ Hệ thống

Sau khi làm hết các bước trên, hãy check lại danh sách này:

- [ ] Truy cập `https://portfoliomanagement-d237b.web.app` thấy giao diện hiện ra
- [ ] Đăng nhập vào web thành công (Firebase Auth hoạt động)
- [ ] Dữ liệu tài sản, giao dịch hiển thị đúng (Firestore kết nối ổn)
- [ ] Truy cập `https://portfoliomanagement-d237b.web.app/api/status` thấy `{"deployment_mode":"serverless","checks":{"firebase":"ok","vnstock":"ok"}}`
- [ ] Cloud Scheduler **Force Run** trả về kết quả `Success`
- [ ] Giá cổ phiếu/crypto trên Web được cập nhật sau khi Force Run

Nếu tất cả đều ✅ — **Chúc mừng, hệ thống của bạn đã lên mạng hoàn toàn!** 🎉

---

## 💻 3. Quy trình Cập nhật Code (Workflow Thường Ngày)

Khi bạn code xong một tính năng mới ở máy cá nhân (Local), hãy làm quen với "Combo" 3 bước sau để mọi thứ thật mượt mà.

### 👣 Bước 2.1: Chạy thử ở máy Local trước khi đẩy đi
Ở máy tính của bạn, luôn dùng chế độ **Standalone** để hệ thống chạy độc lập (Có sẵn `APScheduler` ngầm):
```bash
docker compose up --build
```
Mở `http://localhost:5173` để xác nhận mọi tính năng mới vừa viết đều ổn.

### 👣 Bước 2.2: Lưu giữ Code (Git Commit & Push)
Lưu toàn bộ thay đổi lên Github (hoặc Gitlab) để lưu dấu vết:
```bash
git add .
git commit -m "Tính năng: Thống kê lãi/lỗ theo tuần"
git push origin main
```

### 👣 Bước 2.3: Deploy phần tương ứng

Tuỳ vị trí bạn chỉnh sửa code mà chọn phương án sau:

#### 👉 Kịch bản A: Chỉ sửa Giao diện Frontend (React)
Bạn không thay đổi gì ở `backend`.
```bash
# 1. Build cấu trúc giao diện mới
npm run build

# 2. Bắn cấu hình HTML/CSS/JS lên nền tảng Firebase
firebase deploy --only hosting
```
⏳ **Thời gian:** Khoảng 30 giây.

#### 👉 Kịch bản B: Chỉ sửa Backend (Python / API)

Khi bạn cập nhật code cho Backend (thêm API mới, sửa logic), tuỳ thuộc vào việc bạn có thay đổi **biến môi trường** hay không mà chọn lệnh phù hợp:

**Cách 1: Deploy giữ nguyên biến môi trường cũ (Khuyên dùng khi chỉ sửa code)**
Hệ thống sẽ tự động dùng lại toàn bộ cài đặt biến môi trường từ lần deploy trước đó.
```bash
cd backend
gcloud run deploy fastapi-backend \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated
```

**Cách 2: Deploy và Thêm/Cập nhật biến môi trường (Giữ lại các biến khác)**
Dùng cờ `--update-env-vars`. Hệ thống sẽ đè giá trị biến mới lên biến cũ trùng tên, hoặc thêm biến mới, và vẫn **giữ nguyên** các biến không được nhắc đến.
```bash
cd backend
gcloud run deploy fastapi-backend \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --update-env-vars="NEW_VAR=true,COINGECKO_API_KEY=<Mã_mới>"
```

**Cách 3: Deploy và Cài đặt lại toàn bộ biến môi trường từ đầu (Xoá hết biến cũ)**
Dùng cờ `--set-env-vars`. Lệnh này sẽ **XOÁ SẠCH** các biến cũ hiện có và CHỈ lưu những biến được khai báo trong lệnh này. Dùng khi cấu trúc biến môi trường thay đổi nhiều.
```bash
cd backend
gcloud run deploy fastapi-backend \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --set-env-vars="DEPLOYMENT_MODE=serverless,JWT_SECRET=<Mã_của_bạn>,VNSTOCK_API_ENABLED=true,VNSTOCK_API_KEY=<Mã_của_bạn>,COINGECKO_API_KEY=<Mã_của_bạn>"
```

⏳ **Thời gian:** Khoảng 2-4 phút để Build Container mới.

#### 👉 Kịch bản C: Sửa cả hai
Làm lần lượt Kịch bản B (Deploy Backend trước) rồi làm Kịch bản A (Deploy Frontend sau).

---

## 🏥 3. Quy trình Kiểm tra "Sức khỏe" & Tìm Lỗi

Khi hệ thống trục trặc (Ví dụ: 9h sáng mà giá tiền mã hoá/chứng khoán không đổi), thay vì hoảng hốt, hãy làm theo quy trình sau:

### 🔎 Vị trí 1: Kiểm tra "Báo thức" (Cloud Scheduler)
Vào [Google Cloud Scheduler](https://console.cloud.google.com/cloudscheduler)
1.  Tìm job `portfolio-daily-update`.
2.  Nhìn vào cột **Last run result**. 
    *   Màu xanh (`Success`): Báo thức hoạt động tốt, lỗi xảy ra ở bên trong Backend chạy chậm.
    *   Màu đỏ (`Failed`): Ấn vào mục **Logs** để xem. Đa phần là do bạn đánh mất Header `X-Cron-Key` hoặc JWT_SECRET không trùng khớp do mới gán.
3.  Nếu muốn test nóng, hãy bấm thẳng **Force Run**.

### 🔎 Vị trí 2: Đọc Camera An ninh của Backend (Cloud Logging)
Vào [Google Cloud Run](https://console.cloud.google.com/run)
1.  Chọn service `fastapi-backend`.
2.  Chuyển sang tab **Logs**.
3.  Tại đây chứa _Mọi câu lệnh in ra (print)_ của ứng dụng FastAPI. Phân biệt theo cấp độ Xanh (Info), Vàng (Warning), Đỏ (Error).
4.  Lọc bằng các từ khoá như `Exception`, `VNStock`, `Error`.

### 🔎 Vị trí 3: Xử lý Lỗi Cơ sở dữ liệu
Nếu bạn thấy lỗi **Permission Denied** ở Firebase/Firestore:
*   Đảm bảo Service Account cấp cho Cloud Run đang sở hữu quyền `Cloud Datastore User`.

---

## 🔐 4. Quản lý Bí mật (Secrets)
File `.env` trên máy trạm của bạn chứa các mã bí mật. **KHÔNG BAO GIỜ** được đẩy nó lên kho lưu trữ công khai như Github.
Nếu chạy trên Cloud Shell, hãy xoá file `.env` và `firebase-service-account.json` sau khi bạn dùng xong bộ lệnh deploy. Nền tảng Serverless đã nhớ sẵn thông số chạy rồi.

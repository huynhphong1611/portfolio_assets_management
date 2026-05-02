# 🏗️ Architecture Overview — Tổng quan kiến trúc

## Kiến trúc tổng thể

```mermaid
graph TB
    subgraph Client ["🌐 Client (Browser)"]
        FE[React + Vite<br/>Port 5173]
    end

    subgraph Backend ["🐍 Backend (FastAPI)"]
        API[FastAPI Server<br/>Port 8000]
        SCHED[APScheduler<br/>9:00 AM Daily]
    end

    subgraph External ["🌍 External APIs"]
        VNS[vnstock API<br/>KBS Source]
        CG[CoinGecko API<br/>Crypto Prices]
        GOLD[vang.today<br/>Gold SJC]
    end

    subgraph Firebase ["🔥 Firebase"]
        AUTH[Firebase Auth]
        FS[Firestore<br/>Database]
        HOST[Firebase Hosting<br/>Production]
    end

    subgraph Cloud ["☁️ Google Cloud"]
        CR[Cloud Run<br/>Backend Container]
        CS[Cloud Scheduler<br/>Daily Cron]
    end

    FE -->|REST API /api/*| API
    FE -->|Firebase SDK| AUTH
    API -->|Admin SDK| FS
    API -->|Fetch prices| VNS
    API -->|Fetch prices| CG
    API -->|Fetch prices| GOLD
    SCHED -->|Trigger| API
    HOST -->|Rewrite /api/**| CR
    CS -->|POST /trigger| CR
```

## Chế độ vận hành

Hệ thống hỗ trợ 2 chế độ triển khai:

### 🖥️ Standalone Mode (Local / VPS)

```
DEPLOYMENT_MODE=standalone
```

- Backend chạy trong Docker container với APScheduler tích hợp
- Scheduler tự động chạy lúc 9:00 AM (Asia/Ho_Chi_Minh)
- Frontend serve bởi Vite dev server
- Phù hợp cho phát triển local và VPS

### ☁️ Serverless Mode (Cloud Run)

```
DEPLOYMENT_MODE=serverless
```

- Backend chạy trên Google Cloud Run (scale-to-zero)
- APScheduler **bị tắt** — dùng Google Cloud Scheduler gọi `POST /api/scheduler/trigger`
- Frontend deploy trên Firebase Hosting
- Firebase Hosting rewrite `/api/**` → Cloud Run backend
- Phù hợp cho production, tiết kiệm chi phí

## Luồng dữ liệu chính

### 1. Đăng nhập & Xác thực

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend
    participant BE as Backend
    participant FA as Firebase Auth
    participant FS as Firestore

    alt Firebase Auth
        User->>FE: Đăng nhập Google/Email
        FE->>FA: signInWithPopup()
        FA-->>FE: ID Token
        FE->>BE: POST /api/auth/firebase/verify
        BE->>FA: verifyIdToken()
        BE-->>FE: JWT Session Token
    else Guest Auth
        User->>FE: Nhập username/password
        FE->>BE: POST /api/auth/guest/login
        BE->>FS: Verify SHA-256 hash
        BE-->>FE: JWT Session Token
    end
```

### 2. Scheduler — Lấy giá tự động hàng ngày

```mermaid
sequenceDiagram
    participant CRON as Cloud Scheduler / APScheduler
    participant BE as Backend
    participant VNS as vnstock
    participant CG as CoinGecko
    participant GOLD as vang.today
    participant FS as Firestore

    CRON->>BE: Trigger daily job
    BE->>FS: Load admin tickers config
    
    loop Mỗi ticker
        alt Stock/Fund
            BE->>VNS: Fetch price
        else Crypto
            BE->>CG: Fetch USD price
        else Gold
            BE->>GOLD: Fetch SJC price
        end
    end

    BE->>FS: Save system/prices/daily/{date}
    BE->>FS: Update marketPrices collection

    loop Mỗi user
        BE->>FS: Load transactions
        BE->>BE: Calculate holdings (FIFO)
        BE->>BE: Calculate portfolio value
        BE->>FS: Save dailySnapshots/{date}
    end
```

## Trang liên quan

- [[Architecture Frontend]] — Chi tiết React components
- [[Architecture Backend]] — Chi tiết FastAPI services
- [[Architecture Database]] — Firestore schema

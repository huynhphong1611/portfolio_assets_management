# 📊 Portfolio Manager V6.0 — Wiki

> **Hệ thống quản lý danh mục đầu tư cá nhân** — Fullstack Digital Asset Management  
> Built with React + FastAPI + Firebase Firestore

---

## 🎯 Giới thiệu

Portfolio Manager là ứng dụng quản lý tài sản đầu tư cá nhân toàn diện, hỗ trợ theo dõi:

- **Cổ phiếu Việt Nam** — Tích hợp vnstock API (nguồn KBS)
- **Tiền mã hoá (Crypto)** — Tích hợp CoinGecko API với auto-detect
- **Chứng chỉ quỹ mở** — NAV từ FMarket (VFF, VESAF, DCBF...)
- **Vàng SJC** — Giá vàng thời gian thực từ vang.today
- **Stablecoin (USDT/USDC)** — Tỷ giá VNĐ qua CoinGecko
- **Tài sản ngoài danh mục** — TOPI, tiền gửi ngân hàng, bất động sản
- **Nợ phải trả** — Khoản vay, thẻ tín dụng

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite 5, Lucide Icons |
| **Backend** | Python FastAPI + Uvicorn |
| **Database** | Firebase Firestore (Admin SDK) |
| **Scheduler** | APScheduler (BackgroundScheduler) |
| **Data APIs** | vnstock ≥3.0.0, CoinGecko API, vang.today |
| **Auth** | Firebase Auth + Custom JWT (Guest) |
| **Container** | Docker Engine & Docker Compose |
| **Hosting** | Firebase Hosting + Google Cloud Run |

## 📚 Mục lục Wiki

### 🚀 Bắt đầu
- [[Getting Started]] — Cài đặt và chạy dự án
- [[Environment Variables]] — Biến môi trường cần thiết

### 🏗️ Kiến trúc
- [[Architecture Overview]] — Tổng quan kiến trúc hệ thống
- [[Architecture Frontend]] — Chi tiết frontend React
- [[Architecture Backend]] — Chi tiết backend FastAPI
- [[Architecture Database]] — Cấu trúc Firestore

### 🔌 API
- [[API Reference]] — Danh sách API endpoints
- [[API Authentication]] — Luồng xác thực JWT & Firebase

### ⚙️ Tính năng
- [[Feature Price Service]] — Hệ thống lấy giá đa nguồn
- [[Feature Snapshot Engine]] — Chụp nhanh danh mục hàng ngày
- [[Feature Scheduler]] — Lịch trình tự động 9h sáng
- [[Feature Asset Classification]] — Phân loại tài sản

### 🚀 Triển khai
- [[Deployment Guide]] — Hướng dẫn deploy lên Cloud
- [[Docker Setup]] — Cấu hình Docker local

### 🛠️ Vận hành
- [[Troubleshooting]] — Xử lý sự cố thường gặp
- [[Changelog]] — Lịch sử thay đổi

---

> 📖 Wiki này được duy trì bởi nhóm phát triển dự án.  
> 🛡️ Built with AI-assisted development — Google DeepMind Antigravity Agent

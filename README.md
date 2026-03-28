# Portfolio Assets Management (V5.0)
Vibe coding!
Web App quản lý tài sản cá nhân và danh mục đầu tư chuyên nghiệp. Hệ thống cung cấp cái nhìn tổng quan về Net Worth, phân bổ tài sản, tái cơ cấu (Rebalance) và nhật ký giao dịch.

## Cấu trúc dự án

Dự án được xây dựng dựa trên ReactJS, Vite và TailwindCSS với cấu trúc module hóa:

- `src/data/mockData.js`: Chứa dữ liệu mô phỏng (Mock Data) thay cho database.
- `src/utils/formatters.js`: Các hàm tiện ích hỗ trợ định dạng số, tiền tệ.
- `src/App.jsx`: Component giao diện chính (chứa Layout và Logic Routing).
- `src/main.jsx` & `index.html`: Điểm khởi chạy (Entry point) của ứng dụng web.

## Hướng dẫn cài đặt và khởi chạy

1. Đảm bảo bạn đã cài đặt Node.js trên máy.
2. Mở terminal tại thư mục dự án và cài đặt các thư viện phụ thuộc:
   ```bash
   npm install
   ```
3. Khởi chạy môi trường phát triển (Dev server):
   ```bash
   npm run dev
   ```

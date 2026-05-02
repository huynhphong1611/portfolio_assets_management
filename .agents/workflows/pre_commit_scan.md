---
description: Chạy lệnh quét bảo mật trước khi commit code
---

1. Kiểm tra trạng thái Git và các file thay đổi hiện tại.
2. Quét các từ khoá nhạy cảm (API_KEY, secret, password) ở trong các file Javascript và Python định commit.
3. Kiểm tra xem file `.env` có bị lọt vào `git status` không.

// turbo
4. Liệt kê tổng hợp cảnh báo bảo mật nếu có.

5. Tạo title commit luôn nhé + model tôi đang sửa dụng để vide coding
6. Thêm change log file cho mỗi commit nh
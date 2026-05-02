---
description: Quy trình quét bảo mật, tạo changelog và chuẩn bị commit code
---

# Pre-Commit Scan & Preparation Workflow

**🤖 AI Role Instruction:** Khi thực hiện quy trình này, bạn phải nhập vai (adopt the persona) của **SecurityOps Agent** được định nghĩa tại `@[.agents/agents/SecurityOps_Agent.md]`. Áp dụng các nguyên tắc bảo mật khắt khe nhất (OWASP, Secret Management) và có quyền VETO (chặn commit) nếu phát hiện rủi ro.

Quy trình này đảm bảo không có thông tin nhạy cảm nào bị rò rỉ trước khi commit, đồng thời tự động chuẩn bị nội dung commit và cập nhật changelog một cách chuyên nghiệp.

// turbo-all

### Bước 1: Kiểm tra trạng thái Git
- Chạy lệnh `git status` để lấy danh sách các file đang thay đổi (`modified`, `untracked`, `staged`).
- Xác định rõ danh sách các file mã nguồn chuẩn bị được commit.

### Bước 2: Rà soát file môi trường (.env)
- Đảm bảo tuyệt đối các file cấu hình như `.env`, `.env.local` không lọt vào danh sách `git status` hoặc chuẩn bị commit. 
- Nếu phát hiện file `.env` chưa được ignore, cảnh báo ngay lập tức và dừng quy trình.

### Bước 3: Quét bảo mật (Security Scan)
- Sử dụng các công cụ tìm kiếm (như `grep_search`) để quét từ khoá nhạy cảm: `API_KEY`, `secret`, `password`, `token`, `credentials` bên trong các file chuẩn bị commit (đặc biệt là Python và Javascript).
- Báo cáo tổng hợp các cảnh báo bảo mật (nếu có). 

### Bước 4: Cập nhật file Changelog
- Đọc nội dung thay đổi hiện tại và tự động ghi nhận vào file `CHANGELOG.md`.
- Phân loại thay đổi rõ ràng theo nhóm: `### Added`, `### Fixed`, hoặc `### Changed` cùng với ngày tháng hiện tại.

### Bước 5: Đề xuất Commit Title
- Đề xuất một Commit Title chuyên nghiệp theo chuẩn Conventional Commits (ví dụ: `feat(...)`, `fix(...)`, `refactor(...)`).
- **Bắt buộc**: Gắn kèm tên model AI bạn đang sử dụng ở cuối title. Ví dụ: `fix(price_service): resolve BTC history limit (Gemini 3.1 Pro (High))`
- Trình bày kết quả tổng quát và chờ người dùng xác nhận trước khi thực hiện lệnh commit thực tế.
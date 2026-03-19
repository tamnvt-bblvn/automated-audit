# 📝 Công cụ đồng bộ GitHub Secrets & Variables

Công cụ này giúp tự động hóa việc khởi tạo hàng loạt Secrets và Variables trên
GitHub Repository từ file cấu hình môi trường (.env) cục bộ. Thay vì nhập thủ
công từng biến trên giao diện Web, bạn chỉ cần chạy script một lần duy nhất.

---

## 🚀 Tính năng

- Tự động phân loại: Nhận diện các từ khóa nhạy cảm (KEY, TOKEN, SECRET, PASS,
  AUTH) để đưa vào Secrets. Các biến còn lại sẽ được lưu vào Variables.
- Tiết kiệm thời gian: Khởi tạo hàng chục biến chỉ trong vài giây.
- Bảo mật: Không đẩy dữ liệu nhạy cảm lên mã nguồn (sử dụng GitHub CLI trực tiếp
  trên máy local).

---

## 📋 Yêu cầu

Đảm bảo máy của bạn đã cài đặt:

GitHub CLI (gh)

Windows: winget install --id GitHub.cli

MacOS: brew install gh

Đăng nhập GitHub CLI: gh auth login

Làm theo hướng dẫn trên trình duyệt để hoàn tất đăng nhập.

---

## 🛠 Cách sử dụng

### Bước 1: Chuẩn bị file .env

Tạo file .env tại thư mục gốc của dự án (file này nên được ignore trong
.gitignore).

Ví dụ: API_KEY=123456789 # → SECRET DB_PASSWORD=secret_pass # → SECRET
APP_NAME=MyAwesomeApp # → VARIABLE DEBUG=true # → VARIABLE

---

### Bước 2: Chạy script đồng bộ

Cách 1: Windows (PowerShell) – Khuyến nghị

.\sync_env.ps1

Nếu gặp lỗi quyền: Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope
CurrentUser

---

Cách 2: Linux / MacOS / Git Bash

chmod +x sync_env.sh ./sync_env.sh

---

### Bước 3: Kiểm tra kết quả

Sau khi thấy thông báo "Completed!", truy cập:

GitHub Repo → Settings → Secrets and variables → Actions

---

## ⚠️ Lưu ý quan trọng

- Ghi đè: Nếu Secret/Variable đã tồn tại, giá trị sẽ được cập nhật theo file
  .env.
- Bảo mật: Không commit file .env hoặc các script chứa thông tin nhạy cảm.
- Quy tắc phân loại: Các biến chứa SECRET, TOKEN, KEY, PASS, AUTH → được coi là
  Secrets
- Bạn có thể chỉnh sửa logic này trong script nếu cần.

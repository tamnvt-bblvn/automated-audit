# 📝 Công cụ đồng bộ GitHub Secrets & Variables

Công cụ này giúp tự động hóa việc khởi tạo hàng loạt **Secrets** và
**Variables** trên GitHub Repository từ file cấu hình môi trường (`.env`) cục
bộ. Thay vì nhập thủ công từng biến trên giao diện Web, bạn chỉ cần chạy script
một lần duy nhất.

---

## 🚀 Tính năng

- 🔐 **Tự động phân loại:** Nhận diện các từ khóa nhạy cảm (`KEY`, `TOKEN`,
  `SECRET`, `PASS`, `AUTH`) để đưa vào **Secrets**. Các biến còn lại sẽ được lưu
  vào **Variables**.
- ⚡ **Tiết kiệm thời gian:** Khởi tạo hàng chục biến chỉ trong vài giây.
- 🛡 **Bảo mật:** Không đẩy dữ liệu nhạy cảm lên mã nguồn (sử dụng GitHub CLI
  trực tiếp trên máy local).

---

## 📋 Yêu cầu

Đảm bảo máy của bạn đã cài đặt:

### GitHub CLI (gh)

**Windows**

```bash
winget install --id GitHub.cli
```

**MacOS**

```bash
brew install gh
```

### Đăng nhập GitHub CLI

```bash
gh auth login
```

Làm theo hướng dẫn trên trình duyệt để hoàn tất đăng nhập.

---

## 🛠 Cách sử dụng

### 1️⃣ Chuẩn bị file `.env`

Tạo file `.env` tại thư mục gốc của dự án (file này nên được ignore trong
`.gitignore`).

Ví dụ:

```env
API_KEY=123456789          # → SECRET
DB_PASSWORD=secret_pass    # → SECRET
APP_NAME=MyAwesomeApp      # → VARIABLE
DEBUG=true                 # → VARIABLE
```

---

### 2️⃣ Chạy script đồng bộ

#### Windows (PowerShell) – Khuyến nghị

```powershell
.\sync_env.ps1
```

Nếu gặp lỗi quyền:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

#### Linux / MacOS / Git Bash

```bash
chmod +x sync_env.sh
./sync_env.sh
```

---

### 3️⃣ Kiểm tra kết quả

Sau khi thấy thông báo **"Completed!"**, truy cập:

```
GitHub Repo → Settings → Secrets and variables → Actions
```

---

## ⚠️ Lưu ý quan trọng

- 🔄 **Ghi đè:** Nếu Secret/Variable đã tồn tại, giá trị sẽ được cập nhật theo
  file `.env`.
- 🔒 **Bảo mật:** Không commit file `.env` hoặc các script chứa thông tin nhạy
  cảm.
- 🧠 **Quy tắc phân loại:**
  ```
  SECRET, TOKEN, KEY, PASS, AUTH
  ```
  → được coi là **Secrets**
- ⚙️ Có thể chỉnh sửa logic này trong script nếu cần.

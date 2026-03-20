# 📝 Công cụ đồng bộ GitHub Secrets & Variables

Công cụ này giúp tự động hóa việc đồng bộ **Secrets** và **Variables** trên
GitHub Repository từ file `.env` cục bộ.

Công cụ này sử dụng **block rõ ràng (`# secret`, `# var`)**, giúp kiểm soát
chính xác biến nào là Secret và biến nào là Variable.

---

## 🚀 Tính năng

- 🧩 **Phân loại theo block rõ ràng:**
  - `# secret` → Secrets
  - `# var` → Variables
- ⚡ **Nhanh & gọn:** Chạy 1 lệnh là sync toàn bộ
- 🔐 **An toàn:** Không commit dữ liệu nhạy cảm

---

## 📋 Yêu cầu

Cài đặt GitHub CLI (`gh`)

### Windows

```bash
winget install --id GitHub.cli
```

### MacOS

```bash
brew install gh
```

### Đăng nhập

```bash
gh auth login
```

---

## 🛠 Cách sử dụng

### 1️⃣ Chuẩn bị file `.env`

Tạo file `.env` tại root project.

⚠️ File này phải nằm trong `.gitignore`

### 📌 Cấu trúc `.env` theo block

```env
# secret
API_KEY=123456
DB_PASSWORD=super_secret

# var
APP_NAME=MyApp
DEBUG=true
PORT=3000
```

👉 Quy tắc:

- Dùng `# secret` để bắt đầu block secret
- Dùng `# var` để chuyển sang variable
- Có thể dùng nhiều block tùy ý

---

### 2️⃣ Chạy script

#### Windows (PowerShell)

```powershell
.\sync_env_block.ps1
```

#### Linux, macOS, Ubuntu (Bash)

```powershell
chmod +x sync_env.sh
./sync_env_block.sh
```

---

### 3️⃣ Kết quả

Script sẽ thực hiện:

#### ✅ Với Secrets

- Tạo mới nếu chưa tồn tại
- Cập nhật nếu đã có

#### ✅ Với Variables

- Tạo mới nếu chưa tồn tại
- Cập nhật nếu đã có

---

## 🔄 Ví dụ log

```
🚀 Đang đồng bộ theo khối (Blocks)...

🔐 Đẩy SECRET: API_KEY
🔐 Đẩy SECRET: DB_PASSWORD

📊 Đẩy VARIABLE: APP_NAME
📊 Đẩy VARIABLE: DEBUG

✅ Đã dọn dẹp và đồng bộ xong!
```

---

## ⚠️ Lưu ý quan trọng

- 🔒 Không commit `.env`
- 🧠 Block nào active sẽ quyết định loại biến
- 🧩 Không có block → mặc định là `var`

---

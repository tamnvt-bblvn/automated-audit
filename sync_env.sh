#!/bin/bash

# Kiểm tra xem file .env có tồn tại không
if [ ! -f .env ]; then
  echo "Lỗi: Không tìm thấy file .env!"
  exit 1
fi

echo "🚀 Đang bắt đầu đồng bộ Secret và Variable lên GitHub..."

# Đọc từng dòng trong file .env
while IFS='=' read -r key value || [ -n "$key" ]; do
  # Bỏ qua các dòng trống hoặc dòng comment (#)
  [[ -z "$key" || "$key" =~ ^# ]] && continue

  # Xóa khoảng trắng thừa và dấu ngoặc kép nếu có
  key=$(echo $key | xargs)
  value=$(echo $value | xargs)

  # PHÂN LOẠI: 
  # Giả sử các biến có chữ 'SECRET' hoặc 'TOKEN', 'KEY', 'PASS' sẽ là Secret.
  # Các biến còn lại sẽ là Variable thông thường.
  if [[ "$key" =~ (SECRET|TOKEN|KEY|PASS|AUTH) ]]; then
    echo "🔐 Đang tạo Secret: $key"
    echo "$value" | gh secret set "$key"
  else
    echo "📊 Đang tạo Variable: $key"
    gh variable set "$key" --body "$value"
  fi

done < .env

echo "✅ Hoàn tất! Hãy kiểm tra lại trong phần Settings > Secrets and variables của Repo."
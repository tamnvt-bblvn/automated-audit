#!/bin/bash

if [ ! -f .env ]; then echo "❌ Không thấy .env"; exit 1; fi

echo "🚀 Đang đồng bộ theo khối (Blocks)..."

mode="var"
declare -a local_secrets=()
declare -a local_vars=()

while IFS= read -r line || [ -n "$line" ]; do
  current_line=$(echo "$line" | xargs)
  [ -z "$current_line" ] && continue

  lower_line=$(echo "$current_line" | tr '[:upper:]' '[:lower:]')

  # Dùng .* để bắt mọi ký tự giữa # và từ khóa
  if [[ "$lower_line" =~ ^#.*secret$ ]]; then 
    mode="secret"
    echo "--- Chuyển sang chế độ: SECRET ---"
    continue 
  fi
  if [[ "$lower_line" =~ ^#.*var$ ]]; then 
    mode="var"
    echo "--- Chuyển sang chế độ: VARIABLE ---"
    continue 
  fi

  if [[ "$current_line" =~ ^# ]]; then continue; fi

  if [[ "$current_line" == *"="* ]]; then
    key=$(echo "$current_line" | cut -d'=' -f1 | xargs)
    val=$(echo "$current_line" | cut -d'=' -f2- | xargs)

    if [[ "$mode" == "secret" ]]; then
      echo "🔐 [MODE: $mode] Đẩy SECRET: $key"
      echo "$val" | gh secret set "$key"
    else
      echo "📊 [MODE: $mode] Đẩy VARIABLE: $key"
      gh variable set "$key" --body "$val"
    fi
  fi
done < .env

# Dọn dẹp thừa (Prune)
# for rs in $(gh secret list | awk '{print $1}'); do
#   [[ ! " ${local_secrets[@]} " =~ " $rs " ]] && echo "🗑️  Xóa Secret: $rs" && gh secret delete "$rs"
# done

# for rv in $(gh variable list | awk '{print $1}'); do
#   [[ ! " ${local_vars[@]} " =~ " $rv " ]] && echo "🗑️  Xóa Variable: $rv" && gh variable delete "$rv"
# done

echo "✅ Hoàn tất!"
if (!(Test-Path .env)) { Write-Host "❌ Không thấy .env"; exit }

Write-Host "🚀 Đang đồng bộ theo khối (Blocks)..." -ForegroundColor Cyan

$envContent = Get-Content .env
$mode = "var" # Mặc định ban đầu là var
$localSecrets = @()
$localVars = @()

foreach ($line in $envContent) {
    $l = $line.Trim()
    if ($l -eq "") { continue }

    # 1. Kiểm tra đổi chế độ (Case-insensitive, chấp nhận ký tự lạ ở giữa)
    # ^#      : Bắt đầu bằng dấu #
    # .* : Chấp nhận bất kỳ ký tự nào ở giữa (khoảng trắng, dấu chấm ·, tab...)
    # secret$ : Kết thúc bằng chữ secret
    if ($l -match '^#.*secret$') { 
        $mode = "secret"
        Write-Host "--- CHUYỂN CHẾ ĐỘ: [SECRET] ---" -ForegroundColor Yellow
        continue 
    }
    if ($l -match '^#.*var$') { 
        $mode = "var"
        Write-Host "--- CHUYỂN CHẾ ĐỘ: [VARIABLE] ---" -ForegroundColor Green
        continue 
    }

    # 2. Bỏ qua các dòng comment bình thường (không phải lệnh đổi mode)
    if ($l.StartsWith("#")) { continue }

    # 3. Xử lý dòng chứa biến
    if ($l -match '=') {
        # Chia làm 2 phần tại dấu = đầu tiên
        $parts = $l -split '=', 2
        $key = $parts[0].Trim()
        $value = $parts[1].Trim()

        if ($mode -eq "secret") {
            $localSecrets += [PSCustomObject]@{Key=$key; Value=$value}
            Write-Host "🔎 Nhận diện Secret: $key" -ForegroundColor Gray
        } else {
            $localVars += [PSCustomObject]@{Key=$key; Value=$value}
            Write-Host "🔎 Nhận diện Variable: $key" -ForegroundColor Gray
        }
    }
}

# --- Xử lý SECRETS (Sync & Prune) ---
$remoteSecrets = gh secret list --json name | ConvertFrom-Json | Select-Object -ExpandProperty name
foreach ($s in $localSecrets) {
  Write-Host "🔐 Đẩy SECRET: $($s.Key)" -ForegroundColor Yellow
  echo $s.Value | gh secret set $s.Key
}
# foreach ($rs in $remoteSecrets) {
#     if ($rs -notin $localSecrets.Key) {
#         Write-Host "🗑️  Xóa Secret thừa: $rs" -ForegroundColor Red
#         gh secret delete $rs
#     }
# }

# --- Xử lý VARIABLES (Sync & Prune) ---
$remoteVars = gh variable list --json name | ConvertFrom-Json | Select-Object -ExpandProperty name
foreach ($v in $localVars) {
  Write-Host "📊 Đẩy VARIABLE: $($v.Key)" -ForegroundColor Green
  gh variable set $v.Key --body $v.Value
}
# foreach ($rv in $remoteVars) {
#    if ($rv -notin $localVars.Key) {
#        Write-Host "🗑️  Xóa Variable thừa: $rv" -ForegroundColor Red
#        gh variable delete $rv
#    }
# }
Write-Host "✅ Đã dọn dẹp và đồng bộ xong!" -ForegroundColor Blue
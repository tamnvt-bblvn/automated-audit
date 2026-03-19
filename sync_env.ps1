if (!(Test-Path .env)) {
    Write-Host "❌ Lỗi: Không tìm thấy file .env!" -ForegroundColor Red
    exit
}

Write-Host "🚀 Đang bắt đầu đồng bộ Secret và Variable lên GitHub..." -ForegroundColor Cyan

# Đọc file .env
Get-Content .env | ForEach-Object {
    $line = $_.Trim()
    # Bỏ qua dòng trống hoặc comment
    if ($line -ne "" -and !$line.StartsWith("#")) {
        $key, $value = $line -split '=', 2
        $key = $key.Trim()
        $value = $value.Trim()

        # Phân loại: Nếu tên biến có các chữ nhạy cảm thì cho vào Secret
        if ($key -match "SECRET|TOKEN|KEY|PASS|AUTH") {
            Write-Host "🔐 Đang tạo Secret: $key" -ForegroundColor Yellow
            echo $value | gh secret set $key
        } else {
            Write-Host "📊 Đang tạo Variable: $key" -ForegroundColor Green
            gh variable set $key --body "$value"
        }
    }
}

Write-Host "✅ Hoàn tất!" -ForegroundColor Blue
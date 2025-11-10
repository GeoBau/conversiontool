Write-Host "Creating deployment package..." -ForegroundColor Green

# Remove old files
if (Test-Path "portfolio-conversion-tool") { Remove-Item -Recurse -Force "portfolio-conversion-tool" }
if (Test-Path "portfolio-conversion-tool.zip") { Remove-Item -Force "portfolio-conversion-tool.zip" }

# Create directory structure
New-Item -ItemType Directory -Path "portfolio-conversion-tool" | Out-Null

# Copy api
Write-Host "Copying api folder..."
Copy-Item -Recurse -Force "api" "portfolio-conversion-tool\api"

# Copy frontend
Write-Host "Copying frontend folder..."
New-Item -ItemType Directory -Path "portfolio-conversion-tool\frontend" | Out-Null
Copy-Item -Recurse -Force "frontend\src" "portfolio-conversion-tool\frontend\src"
Copy-Item -Recurse -Force "frontend\public" "portfolio-conversion-tool\frontend\public"
Copy-Item -Force "frontend\package.json" "portfolio-conversion-tool\frontend\"
Copy-Item -Force "frontend\vite.config.ts" "portfolio-conversion-tool\frontend\"
Copy-Item -Force "frontend\tsconfig.json" "portfolio-conversion-tool\frontend\"
Copy-Item -Force "frontend\tsconfig.node.json" "portfolio-conversion-tool\frontend\"
Copy-Item -Force "frontend\index.html" "portfolio-conversion-tool\frontend\"

# Copy catalogs
Write-Host "Copying catalogs..."
Copy-Item -Recurse -Force "ALVARIS_CATALOG" "portfolio-conversion-tool\ALVARIS_CATALOG"
Copy-Item -Recurse -Force "ASK_CATALOG" "portfolio-conversion-tool\ASK_CATALOG"

# Copy data and docs
Write-Host "Copying data and documentation..."
Copy-Item -Force "Portfolio_Syskomp_pA.csv" "portfolio-conversion-tool\"
Copy-Item -Force "DEPLOY.md" "portfolio-conversion-tool\"
Copy-Item -Force "deploy.bat" "portfolio-conversion-tool\"
Copy-Item -Force "deploy.sh" "portfolio-conversion-tool\"

# Create ZIP
Write-Host "Creating ZIP archive..." -ForegroundColor Yellow
Compress-Archive -Path "portfolio-conversion-tool\*" -DestinationPath "portfolio-conversion-tool.zip" -CompressionLevel Optimal

# Show result
$sizeMB = [math]::Round((Get-Item "portfolio-conversion-tool.zip").Length / 1MB, 2)
Write-Host ""
Write-Host "====================================" -ForegroundColor Green
Write-Host "SUCCESS!" -ForegroundColor Green  
Write-Host "====================================" -ForegroundColor Green
Write-Host "Package: portfolio-conversion-tool.zip" -ForegroundColor Cyan
Write-Host "Size: $sizeMB MB" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Green

# Cleanup
Remove-Item -Recurse -Force "portfolio-conversion-tool"

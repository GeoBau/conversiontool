@echo off
echo Creating deployment package...
echo.

REM Create temporary directory for packaging
if exist "portfolio-conversion-tool" rmdir /s /q "portfolio-conversion-tool"
mkdir "portfolio-conversion-tool"

REM Copy essential directories
echo Copying api folder...
xcopy /E /I /Y "api" "portfolio-conversion-tool\api"

echo Copying frontend folder...
xcopy /E /I /Y "frontend\src" "portfolio-conversion-tool\frontend\src"
xcopy /E /I /Y "frontend\public" "portfolio-conversion-tool\frontend\public"
copy /Y "frontend\package.json" "portfolio-conversion-tool\frontend\"
copy /Y "frontend\package-lock.json" "portfolio-conversion-tool\frontend\" 2>nul
copy /Y "frontend\vite.config.ts" "portfolio-conversion-tool\frontend\"
copy /Y "frontend\tsconfig.json" "portfolio-conversion-tool\frontend\"
copy /Y "frontend\tsconfig.app.json" "portfolio-conversion-tool\frontend\"
copy /Y "frontend\tsconfig.node.json" "portfolio-conversion-tool\frontend\"
copy /Y "frontend\index.html" "portfolio-conversion-tool\frontend\"

echo Copying catalog folders...
xcopy /E /I /Y "ALVARIS_CATALOG" "portfolio-conversion-tool\ALVARIS_CATALOG"
xcopy /E /I /Y "ASK_CATALOG" "portfolio-conversion-tool\ASK_CATALOG"

REM Copy data file
echo Copying data file...
copy /Y "Portfolio_Syskomp_pA.csv" "portfolio-conversion-tool\"

REM Copy documentation and scripts
echo Copying documentation...
copy /Y "DEPLOY.md" "portfolio-conversion-tool\"
copy /Y "README.md" "portfolio-conversion-tool\" 2>nul
copy /Y "CLAUDE.md" "portfolio-conversion-tool\" 2>nul
copy /Y "deploy.bat" "portfolio-conversion-tool\"
copy /Y "deploy.sh" "portfolio-conversion-tool\"
copy /Y "vercel.json" "portfolio-conversion-tool\" 2>nul
copy /Y ".gitignore" "portfolio-conversion-tool\" 2>nul

REM Create ZIP file
echo.
echo Creating ZIP archive...
powershell Compress-Archive -Path "portfolio-conversion-tool" -DestinationPath "portfolio-conversion-tool.zip" -Force

REM Cleanup
rmdir /s /q "portfolio-conversion-tool"

echo.
echo ====================================
echo SUCCESS!
echo ====================================
echo Package created: portfolio-conversion-tool.zip
echo Size: 
dir portfolio-conversion-tool.zip | find "portfolio-conversion-tool.zip"
echo ====================================
pause

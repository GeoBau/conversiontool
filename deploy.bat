@echo off
echo ====================================
echo Portfolio Conversion Tool Deployment
echo ====================================
echo.

echo [1/5] Installing Backend Dependencies...
cd api
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: Failed to install Python dependencies
    pause
    exit /b 1
)
cd ..

echo.
echo [2/5] Installing Frontend Dependencies...
cd frontend
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install Node dependencies
    pause
    exit /b 1
)

echo.
echo [3/5] Building Frontend for Production...
call npm run build
if errorlevel 1 (
    echo ERROR: Failed to build frontend
    pause
    exit /b 1
)
cd ..

echo.
echo [4/5] Verifying Files...
if not exist "Portfolio_Syskomp_pA.csv" (
    echo WARNING: Portfolio_Syskomp_pA.csv not found!
)
if not exist "ALVARIS_CATALOG" (
    echo WARNING: ALVARIS_CATALOG folder not found!
)
if not exist "ASK_CATALOG" (
    echo WARNING: ASK_CATALOG folder not found!
)

echo.
echo [5/5] Deployment Complete!
echo.
echo ====================================
echo Next Steps:
echo ====================================
echo 1. Start Backend:  cd api ^&^& python app.py
echo 2. Access at:      http://localhost:5000
echo.
echo For production, see DEPLOY.md
echo ====================================
pause

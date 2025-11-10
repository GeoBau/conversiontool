@echo off
echo ====================================
echo Portfolio Conversion Tool - Starten
echo ====================================
echo.

REM Prüfe ob Python installiert ist
python --version >nul 2>&1
if errorlevel 1 (
    echo FEHLER: Python ist nicht installiert oder nicht im PATH!
    pause
    exit /b 1
)

REM Prüfe ob Node.js installiert ist
node --version >nul 2>&1
if errorlevel 1 (
    echo FEHLER: Node.js ist nicht installiert oder nicht im PATH!
    pause
    exit /b 1
)

echo [1/2] Starte Backend (Flask)...
start "Portfolio Backend" cmd /c "cd api && python app.py"

echo Warte 3 Sekunden...
timeout /t 3 /nobreak >nul

echo [2/2] Starte Frontend (Vite)...
start "Portfolio Frontend" cmd /c "cd frontend && npm run dev"

echo.
echo ====================================
echo Services gestartet!
echo ====================================
echo Backend:  http://127.0.0.1:5000
echo Frontend: http://localhost:5173 (oder 5174)
echo.
echo Druecke eine Taste zum Beenden...
pause >nul

REM Beende alle Services
echo Beende Services...
taskkill /F /FI "WINDOWTITLE eq Portfolio Backend*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq Portfolio Frontend*" >nul 2>&1

echo Services beendet.

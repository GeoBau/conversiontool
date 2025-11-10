@echo off
echo ================================================
echo IT Update Package erstellen
echo Portfolio Conversion Tool - Update 10.11.2025
echo ================================================
echo.

REM Setze Arbeitsverzeichnis
cd /d "%~dp0"

REM Lösche altes Paket falls vorhanden
if exist IT_UPDATE_PAKET.zip (
    echo Loesche altes Update-Paket...
    del /F /Q IT_UPDATE_PAKET.zip
)

REM Lösche altes Temp-Verzeichnis falls vorhanden
if exist IT_UPDATE_PAKET (
    echo Loesche altes Temp-Verzeichnis...
    rmdir /S /Q IT_UPDATE_PAKET
)

REM Erstelle Temp-Verzeichnis
echo Erstelle Verzeichnisstruktur...
mkdir IT_UPDATE_PAKET
mkdir IT_UPDATE_PAKET\api
mkdir IT_UPDATE_PAKET\frontend
mkdir IT_UPDATE_PAKET\frontend\src
mkdir IT_UPDATE_PAKET\frontend\src\components

REM Kopiere Dateien
echo Kopiere geaenderte Dateien...
copy /Y api\app.py IT_UPDATE_PAKET\api\app.py
copy /Y frontend\src\components\CatalogMapper.tsx IT_UPDATE_PAKET\frontend\src\components\CatalogMapper.tsx

REM Kopiere Dokumentation
echo Kopiere Dokumentation...
copy /Y IT_UPDATE_ANLEITUNG.md IT_UPDATE_PAKET\IT_UPDATE_ANLEITUNG.md

REM Erstelle Changelog
echo Erstelle Changelog...
(
echo # CHANGELOG - Update vom 10.11.2025
echo.
echo ## Version 1.1.0
echo.
echo ### Bugfixes:
echo - Manuelle Eingabe: "Passt"-Button aktiviert sich jetzt korrekt
echo - Speichern von manuellen Eintraegen korrigiert
echo - Anzeige von bereits zugeordneten Syskomp-Nummern implementiert
echo.
echo ### Verbesserungen:
echo - Button-Status verbessert (Passt ? / Passt bestaetigt / Neuaufnahme^)
echo - "Passt bestaetigt"-Button in blauer Farbe
echo - Syskomp alt ist jetzt optional
echo - Validierungslogik verbessert
echo - TypeScript-Warning entfernt
echo.
echo ### Geaenderte Dateien:
echo - api/app.py
echo - frontend/src/components/CatalogMapper.tsx
echo.
echo Detaillierte Installationsanleitung siehe IT_UPDATE_ANLEITUNG.md
) > IT_UPDATE_PAKET\CHANGELOG.txt

REM Erstelle Quick-Start für IT
echo Erstelle Quick-Start Anleitung...
(
echo IT UPDATE - QUICK START
echo ========================
echo.
echo 1. Backup erstellen
echo 2. Services stoppen (Python + Node Prozesse^)
echo 3. Dateien kopieren:
echo    - api\app.py
echo    - frontend\src\components\CatalogMapper.tsx
echo 4. Frontend neu bauen: npm run build (falls produktiv^)
echo 5. Services neu starten mit start.bat
echo 6. Funktionstest durchfuehren
echo.
echo Siehe IT_UPDATE_ANLEITUNG.md fuer Details!
) > IT_UPDATE_PAKET\QUICK_START.txt

REM Erstelle ZIP mit PowerShell
echo Erstelle ZIP-Archiv...
powershell -Command "Compress-Archive -Path 'IT_UPDATE_PAKET\*' -DestinationPath 'IT_UPDATE_PAKET.zip' -Force"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ================================================
    echo Update-Paket erfolgreich erstellt!
    echo ================================================
    echo Datei: IT_UPDATE_PAKET.zip
    echo.
    echo Inhalt:
    echo   - api\app.py
    echo   - frontend\src\components\CatalogMapper.tsx
    echo   - IT_UPDATE_ANLEITUNG.md
    echo   - CHANGELOG.txt
    echo   - QUICK_START.txt
    echo.

    REM Lösche Temp-Verzeichnis
    rmdir /S /Q IT_UPDATE_PAKET

    echo Temp-Verzeichnis bereinigt.
    echo Package ist bereit fuer IT!
) else (
    echo.
    echo FEHLER: ZIP-Archiv konnte nicht erstellt werden!
    echo Bitte pruefen Sie PowerShell-Installation.
)

echo.
pause

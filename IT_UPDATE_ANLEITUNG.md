# UPDATE-ANLEITUNG FÜR IT
**Portfolio Conversion Tool - Update vom 10.11.2025**

---

## Änderungen in diesem Update

### Bugfixes und Verbesserungen im Catalog Mapper:

1. **Manuelle Eingabe - Button-Aktivierung korrigiert**
   - "Passt"-Button aktiviert sich jetzt korrekt bei manueller Eingabe einer gültigen Syskomp-Nummer
   - Funktioniert sowohl für existierende als auch für neue Nummern

2. **Speichern von manuellen Einträgen korrigiert**
   - Manuelle Einträge werden jetzt korrekt gespeichert und überschreiben bestehende Zuordnungen

3. **Anzeige von zugeordneten Syskomp-Nummern**
   - Bereits zugeordnete Produkte zeigen jetzt die Syskomp neu und alt Nummern an
   - Anzeige in roter Schrift zur besseren Sichtbarkeit

4. **Button-Status verbessert**
   - "Passt ?" - Grün, wenn bereit zum Bestätigen
   - "Passt bestätigt" - Blau, nach Bestätigung
   - "✓ Neuaufnahme" - Grün, für neue Einträge

5. **Validierung verbessert**
   - Syskomp alt ist jetzt optional (muss aber korrekt sein, wenn ausgefüllt)
   - Prüfung erfolgt zuerst auf neue Nummer, dann auf alte Nummer

6. **TypeScript-Warning entfernt**
   - Ungenutzter State `setFilterType` wurde entfernt

---

## Deployment-Anleitung

### Voraussetzungen
- Python 3.x installiert
- Node.js installiert
- Bestehende Installation des Portfolio Conversion Tools

### Schritt-für-Schritt Installation

#### 1. **Backup erstellen**
   ```cmd
   cd D:\Portfolio-Tool
   xcopy /E /I /Y . ..\Portfolio-Tool-Backup
   ```

#### 2. **Services stoppen**
   - Alle laufenden Instanzen des Tools schließen
   - Prüfen, ob Prozesse noch laufen:
   ```cmd
   tasklist | findstr python
   tasklist | findstr node
   ```
   - Falls nötig, Prozesse beenden:
   ```cmd
   taskkill /F /IM python.exe
   taskkill /F /IM node.exe
   ```

#### 3. **Update-Dateien entpacken**
   - Update-ZIP in ein temporäres Verzeichnis entpacken
   ```cmd
   mkdir C:\Temp\Portfolio-Update
   # ZIP entpacken nach C:\Temp\Portfolio-Update
   ```

#### 4. **Dateien kopieren**
   ```cmd
   cd C:\Temp\Portfolio-Update

   # Backend-Datei aktualisieren
   copy /Y api\app.py D:\Portfolio-Tool\api\app.py

   # Frontend-Komponente aktualisieren
   copy /Y frontend\src\components\CatalogMapper.tsx D:\Portfolio-Tool\frontend\src\components\CatalogMapper.tsx
   ```

#### 5. **Frontend neu bauen** (falls produktiv deployed)
   ```cmd
   cd D:\Portfolio-Tool\frontend
   npm run build
   ```

#### 6. **Services neu starten**
   ```cmd
   cd D:\Portfolio-Tool
   start.bat
   ```

#### 7. **Funktionstest durchführen**
   - Browser öffnen: http://localhost:5173
   - Catalog Mapper öffnen
   - Test 1: Existierende Nummer manuell eingeben → "Passt ?"-Button muss grün werden
   - Test 2: "Passt ?" klicken → Button wird blau "Passt bestätigt"
   - Test 3: "Weiter" klicken → Zuordnung muss gespeichert werden
   - Test 4: "Zurück" navigieren → Zugeordnete Syskomp-Nummern müssen angezeigt werden

---

## Geänderte Dateien

| Datei | Änderungen |
|-------|------------|
| `frontend/src/components/CatalogMapper.tsx` | Bugfixes für manuelle Eingabe, Button-States, Anzeige zugeordneter Nummern |
| `api/app.py` | Backend-Anpassungen für zugeordnete Nummern-Rückgabe |

---

## Rollback-Anleitung (falls nötig)

Falls Probleme auftreten:

```cmd
# Services stoppen
taskkill /F /IM python.exe
taskkill /F /IM node.exe

# Backup wiederherstellen
cd D:\
xcopy /E /I /Y Portfolio-Tool-Backup Portfolio-Tool

# Services neu starten
cd D:\Portfolio-Tool
start.bat
```

---

## Support

Bei Problemen oder Fragen:
- Siehe Log-Dateien im Verzeichnis `logs/` (falls vorhanden)
- Browser-Konsole prüfen (F12)
- Backend-Konsole prüfen auf Fehlermeldungen

---

**Update erstellt am:** 10.11.2025
**Version:** 1.1.0
**Geschätzte Installationszeit:** 5-10 Minuten

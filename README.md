# Artikelnummer-Konverter

Ein Tool zur Konvertierung von Artikelnummern zwischen Bosch, Syskomp und Item Systemen.

## Funktionen

### 1. Einzelne Nummersuche

* Eingabe einer beliebigen Artikelnummer
* Automatische Erkennung des Nummernsystems (Bosch/Syskomp/Item)
* Anzeige der entsprechenden Nummer im anderen System
* Anzeige von Produktbeschreibungen und Warengruppen
* **Fuzzy Matching für Item-Nummern**: Unterstützt Item-Nummern auch ohne Punkte (z.B. "0062177" findet "0.0.621.77")

### 2. Batch-Konvertierung

* **CSV oder Excel-Datei** hochladen per Drag & Drop oder Dateiauswahl (.csv, .xlsx, .xls)
* Spaltenauswahl (0-basierter Index)
* Zielsystem auswählen (Bosch/Syskomp/Item)
* Batch-Validierung aller Nummern
* Export der konvertierten Nummern als CSV

### 3. Datenvalidierung

* Prüfung aller Artikelnummern gegen Format-Vorgaben:
  * **Bosch**: Genau 10 Ziffern (z.B. 3842537592)
  * **Syskomp**: Genau 9 Ziffern (z.B. 415901309)
  * **Item**: X.X.X.X Format mit 3 Punkten (z.B. 0.0.621.77)

## Technologie-Stack

### Backend

* **Python 3.14** mit Flask
* **Pandas** für Datenverarbeitung
* **Flask-CORS** für Cross-Origin Requests

### Frontend

* **React 18** mit TypeScript
* **Vite** als Build-Tool
* **xlsx** für Excel-Datei-Verarbeitung
* Moderne, responsive UI

## Installation

### Voraussetzungen

* Python 3.14 oder höher
* Node.js 10.9+ und npm
* pip (Python Package Manager)

### Backend-Setup


1. In das Backend-Verzeichnis wechseln:

```bash
cd backend
```


2. Python-Abhängigkeiten installieren:

```bash
pip install -r requirements.txt
```


3. Backend-Server starten:

```bash
python app.py
```

Der Server läuft dann auf `http://localhost:5000`

### Frontend-Setup


1. In das Frontend-Verzeichnis wechseln:

```bash
cd frontend
```


2. npm-Abhängigkeiten installieren:

```bash
npm install
```


3. Development-Server starten:

```bash
npm run dev
```

Die Anwendung ist dann verfügbar unter `http://localhost:5173`

## Verwendung

### Einzelne Nummer suchen


1. Öffnen Sie die Anwendung im Browser: `http://localhost:5173`
2. Wählen Sie den Tab "Einzelne Nummer"
3. Geben Sie eine Artikelnummer ein (z.B. 415901309, 3842537592, oder 0.0.621.77)
4. Klicken Sie auf "Suchen" oder drücken Sie Enter
5. Die entsprechende Nummer wird mit allen Details angezeigt

**Besonderheit**: Item-Nummern können auch ohne Punkte eingegeben werden:

* Eingabe: `0062177` → Findet: `0.0.621.77`

### Batch-Konvertierung


1. Wählen Sie den Tab "Batch-Konvertierung"
2. Laden Sie eine **CSV oder Excel-Datei** hoch (Drag & Drop oder Dateiauswahl)
   * Unterstützte Formate: `.csv`, `.xlsx`, `.xls`
3. Geben Sie den Spaltenindex an (0 = erste Spalte, 1 = zweite Spalte, usw.)
4. Wählen Sie das Zielsystem (Syskomp/Bosch/Item)
5. Klicken Sie auf "Konvertieren"
6. Überprüfen Sie die Ergebnisse
7. Exportieren Sie erfolgreiche Konvertierungen als CSV

**Hinweis**: Bei Excel-Dateien wird automatisch das erste Arbeitsblatt verwendet.

## API-Endpunkte

### GET /api/health

Überprüft den Status der API und die geladenen Daten.

**Response:**

```json
{
  "status": "ok",
  "data_loaded": true,
  "total_entries": 3648
}
```

### POST /api/search

Sucht nach einer Artikelnummer.

**Request:**

```json
{
  "number": "415901309"
}
```

**Response:**

```json
{
  "found": true,
  "ambiguous": false,
  "result": {
    "input_number": "415901309",
    "input_type": "syskomp",
    "corresponding_number": "842901309",
    "corresponding_type": "syskomp",
    "bez1": "Karabinerhaken",
    "bez2": "Material:Stahl verzinkt",
    "warengruppe": "010122",
    "row_index": 2
  }
}
```

### POST /api/validate

Validiert das Format einer Artikelnummer.

**Request:**

```json
{
  "number": "3842537592"
}
```

**Response:**

```json
{
  "number": "3842537592",
  "type": "bosch",
  "valid": true,
  "message": "Valid bosch number"
}
```

### POST /api/batch-convert

Konvertiert mehrere Artikelnummern auf einmal.

**Request:**

```json
{
  "numbers": ["415901309", "3842537592", "0.0.621.77"],
  "target_system": "syskomp"
}
```

**Response:**

```json
{
  "total": 3,
  "all_convertible": true,
  "results": [
    {
      "index": 0,
      "input": "415901309",
      "output": "842901309",
      "status": "success"
    },
    ...
  ]
}
```

### GET /api/stats

Gibt Statistiken über die geladenen Daten zurück.

## Datenstruktur

### CSV-Format (ArtNrn.csv)

* **Spalte 1**: Materialnummer (Artikelnummer System 1)
* **Spalte 2**: Entsprechende Nummer (Artikelnummer System 2)
* **Spalte 3**: Artikelbezeichnung (Bez1)
* **Spalte 4**: Artikelbezeichnung 2 (Bez2)
* **Spalte 5**: Warengruppe

Die CSV-Datei verwendet Semikolon (`;`) als Trennzeichen.

## Datenanalyse

Eine vollständige Analyse der Artikeldaten wurde durchgeführt:

### Statistiken

* **Gesamteinträge**: 3,661 Artikelnummern
* **Bosch**: 656 Einträge (17.9%)
* **Syskomp**: 2,152 Einträge (58.8%)
* **Item**: 724 Einträge (19.8%)
* **Ungültig**: 116 Einträge (3.2%)

Details siehe: `analysis_report.md`

## Tests

### Backend-Tests

Führen Sie die API-Tests aus:

```bash
python backend/test_api.py
```

Stellen Sie sicher, dass der Flask-Server läuft, bevor Sie die Tests ausführen.

## Projektstruktur

```
Nummern-Umrechnung/
├── backend/
│   ├── app.py              # Flask-API
│   ├── requirements.txt    # Python-Abhängigkeiten
│   └── test_api.py        # API-Tests
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── NumberSearch.tsx      # Einzelne Suche
│   │   │   ├── NumberSearch.css
│   │   │   ├── BatchConverter.tsx    # Batch-Konvertierung
│   │   │   └── BatchConverter.css
│   │   ├── App.tsx         # Haupt-App-Komponente
│   │   └── App.css         # Haupt-Styles
│   └── package.json        # npm-Abhängigkeiten
├── Vorlagen/
│   └── ArtNrn.csv         # Artikeldaten
├── analyze_data.py        # Datenanalyse-Script
├── analysis_report.md     # Analysebericht
└── README.md              # Diese Datei
```

## Bekannte Probleme

### Mehrdeutige Einträge

Einige Artikelnummern kommen mehrmals in den Daten vor mit unterschiedlichen Zuordnungen. In solchen Fällen zeigt die Anwendung alle möglichen Übereinstimmungen an.

### Ungültige Einträge

116-117 Einträge entsprechen nicht den erwarteten Formaten:

* 5-stellige Nummern (z.B. 50110, 50111)
* Alphanumerische Codes (z.B. 098DA070K)

Diese Einträge werden als "invalid" markiert und können nicht konvertiert werden.

## Support

Bei Problemen oder Fragen:


1. Überprüfen Sie, ob beide Server (Backend und Frontend) laufen
2. Überprüfen Sie die Browser-Konsole auf Fehler
3. Überprüfen Sie die Backend-Logs im Terminal

## Status

✅ **Vollständig implementiert und getestet**

* Backend-API mit allen Endpunkten
* React-Frontend mit moderner UI
* Einzelne Nummersuche
* Batch-Konvertierung mit CSV-Upload
* Fuzzy Matching für Item-Nummern
* Export-Funktionalität
* Umfassende Datenvalidierung



# Portfolio Conversion Tool

React-based conversion tool for article numbers using Portfolio_Syskomp_pA.xlsx database.

## Features

### Data Columns
- **A**: Syskomp neu (new number)
- **B**: Syskomp alt (old number)
- **C**: Beschreibung (description)
- **D**: Item number
- **E**: Bosch number
- **F**: Alvaris Artikelnummer
- **G**: Alvaris Materialnummer
- **H**: ASK number

### Conversion Modes

#### Extern Mode (Vercel)
- Only allows conversions **TO** columns A or B (Syskomp neu/alt)
- Can convert from any column (D, E, F, G, H) to Syskomp A or B
- Example: `E (Bosch) → A (Syskomp neu)` ✓
- Example: `D (Item) → E (Bosch)` ✗ (not allowed)

#### Intern Mode (Terminal Server)
- Only allows conversions **FROM** columns A or B (Syskomp)
- Can convert to any column (A-H)
- Example: `A (Syskomp neu) → D (Item)` ✓
- Example: `D (Item) → E (Bosch)` ✗ (not allowed)

### Validation Rules
- **A or B must be involved** in every conversion
- No conversions between non-Syskomp columns (e.g., D→G blocked)

### Special Features

#### Single Search
- Select "Von" (from) and "Nach" (to) columns
- Enter article number
- View results with:
  - Converted number
  - Description (semicolons converted to line breaks)
  - Product image (if available)
    - Alvaris images: cropped to top 70%
    - ASK images: full size

#### Alvaris Display
- Shows both Artnr and Matnr: `1010417 / PRO8.6030`

#### Batch Conversion
- Upload CSV or XLSX file
- Select column to convert
- Choose target: Syskomp neu (A) or Syskomp alt (B)
- Replaces numbers in selected column
- Not found: marked as `?number?`

## Installation

### Backend (Python Flask API)

```bash
cd api
pip install -r requirements.txt
python app.py
```

Server runs on: http://127.0.0.1:5000

Or use the batch file:
```bash
start_portfolio_api.bat
```

### Frontend (React)

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on: http://localhost:5173

## API Endpoints

### `POST /api/convert`
Single number conversion

Request:
```json
{
  "number": "402150012",
  "from_col": "B",
  "to_col": "A",
  "mode": "intern"
}
```

Response:
```json
{
  "found": true,
  "from_col": "B",
  "from_col_name": "Syskomp alt",
  "to_col": "A",
  "to_col_name": "Syskomp neu",
  "search_value": "402150012",
  "result_value": "110000060",
  "description": "Halbrundschraube ISO 7380-1,\nM6x12 Material: stahl verzinkt\n\n",
  "image": null
}
```

### `POST /api/batch-convert`
Batch number conversion

Request:
```json
{
  "numbers": ["402150012", "261603000"],
  "target_col": "A",
  "mode": "extern"
}
```

Response:
```json
{
  "total": 2,
  "success": 2,
  "failed": 0,
  "results": [
    {
      "index": 0,
      "input": "402150012",
      "output": "110000060",
      "status": "success"
    }
  ]
}
```

### `GET /api/health`
Health check

Response:
```json
{
  "status": "ok",
  "rows_loaded": 6195,
  "columns": ["A","B","C","D","E","F","G","H"]
}
```

### `GET /api/image/<type>/<artnr>`
Get product image (local mode only)

Example: `/api/image/alvaris/1010417`

## Data Source

**File**: `Portfolio_Syskomp_pA.xlsx`

- Must be in project root directory
- Format: Row 1 = headers, Row 2+ = data
- 8 columns (A-H)
- Loaded with `data_only=True` to read formula values

## Deployment

### Vercel (External Mode)
1. Set `mode="extern"` as default
2. Deploy with `vercel.json` configuration
3. Upload `Portfolio_Syskomp_pA.xlsx` to root
4. Images not supported in serverless (client-side only)

### Local/Terminal Server (Internal Mode)
1. Run Flask backend locally
2. Use `mode="intern"` for full access
3. Images served from local directories:
   - `ALVARIS_CATALOG/alvaris-all-images/`
   - `ASK_CATALOG/ASKbosch-all-images/`
   - `ASK_CATALOG/ASKitem-all-images/`

## Test Examples

### Test Conversion
```bash
# 402150012 (Syskomp alt) → 110000060 (Syskomp neu)
curl -X POST http://127.0.0.1:5000/api/convert \
  -H "Content-Type: application/json" \
  -d '{"number":"402150012","from_col":"B","to_col":"A","mode":"intern"}'

# Should return: 110000060
```

### Test Validation (Should Fail)
```bash
# D→E conversion not allowed (A or B must be involved)
curl -X POST http://127.0.0.1:5000/api/convert \
  -H "Content-Type: application/json" \
  -d '{"number":"0.0.419.07","from_col":"D","to_col":"E","mode":"intern"}'

# Should return error: "Konvertierung muss A oder B beinhalten"
```

## Security

- CSV injection prevention (escapes formulas)
- MIME type validation for file uploads
- File size limit: 10MB
- Rate limiting: 30 requests/minute (single), 10 requests/minute (batch)
- CORS enabled for frontend communication

## Files Structure

```
├── api/
│   ├── app.py              # Local development server
│   ├── index.py            # Vercel serverless deployment
│   └── requirements.txt    # Python dependencies
├── frontend/
│   └── src/
│       ├── App.tsx                           # Main app
│       └── components/
│           └── PortfolioConversion.tsx       # New conversion component
├── Portfolio_Syskomp_pA.xlsx                 # Data source
└── start_portfolio_api.bat                   # Quick start script
```

## Notes

- Excel files lose formulas and formatting when exported
- Batch conversion replaces entire column in output file
- Failed conversions marked with `?number?` in red (Excel)
- Description semicolons (`;`) converted to newlines in display

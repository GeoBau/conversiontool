# Article Number Analysis Report

## Summary

**Data File:** ArtNrn.csv
**Total Rows:** 3,661
**Analysis Date:** 2025-10-30

## Number Format Distribution

### First Column (Materialnr.)
- **Bosch (10 digits):** 656 entries (17.9%)
- **Syskomp (9 digits):** 2,152 entries (58.8%)
- **Item (X.X.X.X format):** 724 entries (19.8%)
- **Empty:** 13 entries (0.4%)
- **Invalid:** 116 entries (3.2%)

### Second Column (Corresponding Number)
- **Bosch (10 digits):** 662 entries (18.1%)
- **Syskomp (9 digits):** 2,132 entries (58.2%)
- **Item (X.X.X.X format):** 736 entries (20.1%)
- **Empty:** 14 entries (0.4%)
- **Invalid:** 117 entries (3.2%)

## Key Findings

### 1. Data Structure
- The CSV uses semicolon (;) as separator
- Column 1: Article number (Materialnr.)
- Column 2: Corresponding article number
- Column 3: Article description (Artikelbezeichnung)
- Column 4: Additional description (Artikelbezeichnung 2)
- Column 5: Product group (Warengruppe)

### 2. Number Mappings
The data contains bidirectional mappings between systems:
- Syskomp ↔ Bosch
- Syskomp ↔ Item
- Syskomp ↔ Syskomp (same number in both columns)
- Bosch ↔ Syskomp
- Item ↔ Syskomp

### 3. Invalid Entries
There are 116-117 invalid entries that don't match any expected format:
- Mostly short numbers (5 digits) like "50110", "50111", etc.
- Some alphanumeric codes like "098DA070K", "098D080K"
- These appear concentrated around rows 2786-3400

### 4. Format Validation
**Expected Formats:**
- Bosch: Exactly 10 digits (e.g., 3842537592, 1845410015)
- Syskomp: Exactly 9 digits (e.g., 415901309, 406537592)
- Item: X.X.X.X format with 3 dots (e.g., 0.0.621.77, 0.0.436.88)

**Issues Found:**
- 5-digit numbers that are too short
- Alphanumeric codes that don't match any system
- These likely need manual review or special handling

## Recommendations

1. **Data Cleanup:** Review the 116-117 invalid entries
2. **Fuzzy Matching:** Implement for Item numbers without dots (e.g., "00621 77" → "0.0.621.77")
3. **Bidirectional Lookup:** System must support looking up in either direction
4. **Validation Rules:** Implement strict format checking during data entry
5. **Special Cases:** Handle same-number mappings (where Col1 = Col2)

## Next Steps

1. Create Python backend API with:
   - Number lookup (single)
   - Format validation
   - Fuzzy matching for Item numbers

2. Build React frontend with:
   - Single number search
   - Excel file upload
   - Batch conversion

3. Implement export to Syskomp system

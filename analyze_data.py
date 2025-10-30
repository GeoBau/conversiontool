"""
Script to analyze and validate article numbers from the Excel file.
Validates formats: Bosch (10 digits), Syskomp (9 digits), Item (0.0.0.0)
"""

import pandas as pd
import re
from typing import Dict, List, Tuple

# Define validation patterns
PATTERNS = {
    'bosch': r'^\d{10}$',           # Exactly 10 digits
    'syskomp': r'^\d{9}$',          # Exactly 9 digits
    'item': r'^\d+\.\d+\.\d+\.\d+$' # Item format: number.number.number.number
}

def detect_number_type(number: str) -> str:
    """Detect the type of article number."""
    if pd.isna(number) or number == '':
        return 'empty'

    number_str = str(number).strip()

    if re.match(PATTERNS['bosch'], number_str):
        return 'bosch'
    elif re.match(PATTERNS['syskomp'], number_str):
        return 'syskomp'
    elif re.match(PATTERNS['item'], number_str):
        return 'item'
    else:
        return 'invalid'

def analyze_excel_file(file_path: str) -> Dict:
    """Analyze the Excel file and validate article numbers."""

    print(f"Reading file: {file_path}")

    # Read the CSV file with semicolon separator
    df = pd.read_csv(file_path, sep=';', header=0, encoding='latin-1')

    print(f"\nTotal rows in file: {len(df)}")
    print(f"Total columns: {len(df.columns)}")
    print(f"Column names: {list(df.columns)}")

    # All rows are article data in this CSV
    article_data = df

    print("\n" + "="*80)
    print("ARTICLE DATA ANALYSIS (Rows 1-3630)")
    print("="*80)

    # Analyze columns A and B
    results = {
        'column_a': {'total': 0, 'bosch': 0, 'syskomp': 0, 'item': 0, 'invalid': 0, 'empty': 0, 'invalid_rows': []},
        'column_b': {'total': 0, 'bosch': 0, 'syskomp': 0, 'item': 0, 'invalid': 0, 'empty': 0, 'invalid_rows': []}
    }

    # Analyze first column (Materialnr.)
    print("\nFirst Column (Materialnr.) Analysis:")
    first_col = article_data.iloc[:, 0]
    for idx, value in enumerate(first_col):
        row_num = idx + 2  # +2 because header is row 1
        number_type = detect_number_type(value)
        results['column_a']['total'] += 1
        results['column_a'][number_type] += 1

        if number_type == 'invalid':
            results['column_a']['invalid_rows'].append((row_num, str(value)))

    print(f"  Total entries: {results['column_a']['total']}")
    print(f"  Bosch (10 digits): {results['column_a']['bosch']}")
    print(f"  Syskomp (9 digits): {results['column_a']['syskomp']}")
    print(f"  Item (X.X.X.X): {results['column_a']['item']}")
    print(f"  Empty: {results['column_a']['empty']}")
    print(f"  Invalid: {results['column_a']['invalid']}")

    # Analyze second column (unnamed - appears to be corresponding number)
    print("\nSecond Column Analysis:")
    second_col = article_data.iloc[:, 1]
    for idx, value in enumerate(second_col):
        row_num = idx + 2  # +2 because header is row 1
        number_type = detect_number_type(value)
        results['column_b']['total'] += 1
        results['column_b'][number_type] += 1

        if number_type == 'invalid':
            results['column_b']['invalid_rows'].append((row_num, str(value)))

    print(f"  Total entries: {results['column_b']['total']}")
    print(f"  Bosch (10 digits): {results['column_b']['bosch']}")
    print(f"  Syskomp (9 digits): {results['column_b']['syskomp']}")
    print(f"  Item (X.X.X.X): {results['column_b']['item']}")
    print(f"  Empty: {results['column_b']['empty']}")
    print(f"  Invalid: {results['column_b']['invalid']}")

    # Show invalid entries
    print("\n" + "="*80)
    print("INVALID ENTRIES")
    print("="*80)

    if results['column_a']['invalid_rows']:
        print(f"\nColumn A - Invalid entries ({len(results['column_a']['invalid_rows'])}):")
        for row, value in results['column_a']['invalid_rows'][:20]:  # Show first 20
            print(f"  Row {row}: '{value}'")
        if len(results['column_a']['invalid_rows']) > 20:
            print(f"  ... and {len(results['column_a']['invalid_rows']) - 20} more")
    else:
        print("\nColumn A: All entries are valid!")

    if results['column_b']['invalid_rows']:
        print(f"\nColumn B - Invalid entries ({len(results['column_b']['invalid_rows'])}):")
        for row, value in results['column_b']['invalid_rows'][:20]:  # Show first 20
            print(f"  Row {row}: '{value}'")
        if len(results['column_b']['invalid_rows']) > 20:
            print(f"  ... and {len(results['column_b']['invalid_rows']) - 20} more")
    else:
        print("\nColumn B: All entries are valid!")

    # Sample data preview
    print("\n" + "="*80)
    print("SAMPLE DATA PREVIEW (First 10 rows)")
    print("="*80)
    for idx in range(min(10, len(article_data))):
        row = article_data.iloc[idx]
        col_a = str(row.iloc[0]) if not pd.isna(row.iloc[0]) else 'empty'
        col_b = str(row.iloc[1]) if not pd.isna(row.iloc[1]) else 'empty'

        type_a = detect_number_type(row.iloc[0])
        type_b = detect_number_type(row.iloc[1])

        # Get descriptions if available
        bez1 = str(row.iloc[2]) if len(row) > 2 and not pd.isna(row.iloc[2]) else ''
        bez2 = str(row.iloc[3]) if len(row) > 3 and not pd.isna(row.iloc[3]) else ''
        warengruppe = str(row.iloc[4]) if len(row) > 4 and not pd.isna(row.iloc[4]) else ''

        print(f"\nRow {idx+2}:")  # +2 because header is row 1
        print(f"  Col1: {col_a} ({type_a})")
        print(f"  Col2: {col_b} ({type_b})")
        if bez1:
            print(f"  Bez1: {bez1[:50]}..." if len(bez1) > 50 else f"  Bez1: {bez1}")
        if bez2:
            print(f"  Bez2: {bez2[:50]}..." if len(bez2) > 50 else f"  Bez2: {bez2}")
        if warengruppe:
            print(f"  Warengruppe: {warengruppe}")

    return results

if __name__ == '__main__':
    file_path = r'D:\OneDrive - Baumann GmbH\Dokumente\VisualStudioCode\Nummern-Umrechnung\Vorlagen\ArtNrn.csv'

    try:
        results = analyze_excel_file(file_path)

        print("\n" + "="*80)
        print("ANALYSIS COMPLETE")
        print("="*80)

    except Exception as e:
        print(f"\nError analyzing file: {e}")
        import traceback
        traceback.print_exc()

"""
Flask backend API for article number conversion
Supports conversion between Bosch, Syskomp, and Item number systems
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import re
from typing import Optional, Dict, List, Tuple
import os
import sys
import shutil
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Global variable to store article data
article_data = None
warengruppe_mapping = {}
article_index = {}  # Index: number -> list of row indices

# Define validation patterns
PATTERNS = {
    'bosch': r'^\d{10}$',           # Exactly 10 digits
    'syskomp': r'^\d{9}$',          # Exactly 9 digits
    'item': r'^\d+\.\d+\.\d+\.\d+$' # Item format: number.number.number.number
}

def load_data():
    """Load article data from CSV file and build index."""
    global article_data, warengruppe_mapping, article_index

    csv_path = os.path.join(os.path.dirname(__file__), '..', 'Vorlagen', 'ArtNrn.csv')

    try:
        df = pd.read_csv(csv_path, sep=';', header=0, encoding='latin-1')

        # Create a clean dataset with the columns we need
        article_data = []
        article_index = {}  # Reset index

        for idx, row in df.iterrows():
            col1 = str(row.iloc[0]).strip() if not pd.isna(row.iloc[0]) else ''
            col2 = str(row.iloc[1]).strip() if not pd.isna(row.iloc[1]) else ''
            bez1 = str(row.iloc[2]).strip() if len(row) > 2 and not pd.isna(row.iloc[2]) else ''
            bez2 = str(row.iloc[3]).strip() if len(row) > 3 and not pd.isna(row.iloc[3]) else ''
            warengruppe = str(row.iloc[4]).strip() if len(row) > 4 and not pd.isna(row.iloc[4]) else ''

            # Skip empty rows
            if col1 == '' and col2 == '':
                continue

            entry_idx = len(article_data)
            article_data.append({
                'number1': col1,
                'number2': col2,
                'bez1': bez1,
                'bez2': bez2,
                'warengruppe': warengruppe,
                'row_index': idx + 2  # +2 for 1-indexed with header
            })

            # Build index for fast lookup
            if col1:
                if col1 not in article_index:
                    article_index[col1] = []
                article_index[col1].append(entry_idx)
            if col2:
                if col2 not in article_index:
                    article_index[col2] = []
                article_index[col2].append(entry_idx)

        print(f"Loaded {len(article_data)} article entries")
        print(f"Built index with {len(article_index)} unique numbers")

        # Load Warengruppe descriptions
        # Read the CSV again without header to get the Warengruppe mapping section
        df_full = pd.read_csv(csv_path, sep=';', header=None, encoding='latin-1')

        # Warengruppe mappings start at index 3643 (after the "Warengruppe" header at 3642)
        for idx in range(3643, len(df_full)):
            row = df_full.iloc[idx]
            if len(row) >= 2:
                code = str(row.iloc[0]).strip() if not pd.isna(row.iloc[0]) else ''
                description = str(row.iloc[1]).strip() if not pd.isna(row.iloc[1]) else ''
                if code and description:
                    warengruppe_mapping[code] = description

        print(f"Loaded {len(warengruppe_mapping)} Warengruppe descriptions")
        return True

    except Exception as e:
        print(f"Error loading data: {e}")
        return False

def detect_number_type(number: str) -> str:
    """Detect the type of article number."""
    if not number or number == '':
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

def normalize_item_number(number: str) -> List[str]:
    """
    Generate possible Item number variations.
    Handles cases where dots are missing.

    Example: "00621 77" or "0062177" could be "0.0.621.77"
    """
    variations = [number.strip()]

    # Remove all dots and spaces to get raw digits
    clean = re.sub(r'[.\s]', '', number)

    # If it has dots already, keep original
    if '.' in number:
        variations.append(number.strip())

    # Try various Item number patterns if we have enough digits
    if clean.isdigit() and len(clean) >= 4:
        # Common Item patterns:
        # 0.0.XXX.XX
        # 0.0.XXXX.XX
        # X.X.XXX.XX

        # Try to match common patterns
        if len(clean) >= 7:
            # Try: X.X.XXX.XX (e.g., 0.0.621.77)
            variations.append(f"{clean[0]}.{clean[1]}.{clean[2:5]}.{clean[5:]}")

        if len(clean) >= 8:
            # Try: X.X.XXXX.XX (e.g., 0.0.1234.56)
            variations.append(f"{clean[0]}.{clean[1]}.{clean[2:6]}.{clean[6:]}")

        if len(clean) == 6:
            # Try: X.X.XX.XX
            variations.append(f"{clean[0]}.{clean[1]}.{clean[2:4]}.{clean[4:]}")

    return list(set(variations))  # Remove duplicates

def search_number(search_term: str) -> List[Dict]:
    """
    Search for an article number and return all matching entries.
    Supports fuzzy matching for Item numbers without dots.
    """
    if not article_data:
        return []

    # Remove all spaces from search term
    search_term = search_term.replace(' ', '').strip()
    results = []

    # Detect the type of the search term
    search_type = detect_number_type(search_term)

    # For Item numbers, generate variations
    search_variations = normalize_item_number(search_term) if search_type in ['item', 'invalid'] else [search_term]

    # Search in both columns
    for entry in article_data:
        for variation in search_variations:
            if entry['number1'] == variation or entry['number2'] == variation:
                # Determine which column matched and what the corresponding number is
                if entry['number1'] == variation:
                    input_number = entry['number1']
                    corresponding_number = entry['number2']
                    input_type = detect_number_type(input_number)
                    corresponding_type = detect_number_type(corresponding_number)
                else:
                    input_number = entry['number2']
                    corresponding_number = entry['number1']
                    input_type = detect_number_type(input_number)
                    corresponding_type = detect_number_type(corresponding_number)

                # Get Warengruppe description
                warengruppe_desc = warengruppe_mapping.get(entry['warengruppe'], '')

                results.append({
                    'input_number': input_number,
                    'input_type': input_type,
                    'corresponding_number': corresponding_number,
                    'corresponding_type': corresponding_type,
                    'bez1': entry['bez1'],
                    'bez2': entry['bez2'],
                    'warengruppe': entry['warengruppe'],
                    'warengruppe_description': warengruppe_desc,
                    'row_index': entry['row_index']
                })
                break  # Found match, no need to check other variations

    return results

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'ok',
        'data_loaded': article_data is not None,
        'total_entries': len(article_data) if article_data else 0
    })

@app.route('/api/search', methods=['POST'])
def search():
    """
    Search for article number.
    Expects JSON: {"number": "415901309"}
    """
    try:
        data = request.get_json()

        if not data or 'number' not in data:
            return jsonify({'error': 'Missing "number" field'}), 400

        # Remove all spaces from the search term
        search_term = str(data['number']).replace(' ', '').strip()

        if not search_term:
            return jsonify({'error': 'Empty search term'}), 400

        # Perform search
        results = search_number(search_term)

        if not results:
            return jsonify({
                'found': False,
                'message': f'No matching article found for: {search_term}',
                'search_term': search_term,
                'search_type': detect_number_type(search_term)
            })

        # If multiple results found (ambiguous)
        if len(results) > 1:
            return jsonify({
                'found': True,
                'ambiguous': True,
                'message': f'Multiple matches found for: {search_term}',
                'count': len(results),
                'results': results
            })

        # Single result found
        return jsonify({
            'found': True,
            'ambiguous': False,
            'result': results[0]
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/validate', methods=['POST'])
def validate():
    """
    Validate article number format.
    Expects JSON: {"number": "415901309"}
    """
    try:
        data = request.get_json()

        if not data or 'number' not in data:
            return jsonify({'error': 'Missing "number" field'}), 400

        # Remove all spaces from the number
        number = str(data['number']).replace(' ', '').strip()
        number_type = detect_number_type(number)

        is_valid = number_type in ['bosch', 'syskomp', 'item']

        return jsonify({
            'number': number,
            'type': number_type,
            'valid': is_valid,
            'message': f'Valid {number_type} number' if is_valid else f'Invalid number format'
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/batch-convert', methods=['POST'])
def batch_convert():
    """
    Convert a batch of article numbers.
    Expects JSON: {
        "numbers": ["415901309", "3842537592", ...],
        "target_system": "syskomp"  # optional
    }
    """
    try:
        data = request.get_json()
        print(f"[batch_convert] Received data: {data}")

        if not data or 'numbers' not in data:
            return jsonify({'error': 'Missing "numbers" field'}), 400

        numbers = data['numbers']
        target_system = data.get('target_system', None)
        print(f"[batch_convert] Numbers count: {len(numbers)}, Target: {target_system}")
        print(f"[batch_convert] Numbers: {numbers}")

        if not isinstance(numbers, list):
            return jsonify({'error': '"numbers" must be an array'}), 400

        results = []
        all_convertible = True

        for idx, number in enumerate(numbers):
            # Remove all spaces from the number
            number_str = str(number).replace(' ', '').strip()
            print(f"[batch_convert] Processing [{idx}]: {number_str}")
            matches = search_number(number_str)
            print(f"[batch_convert] Found {len(matches)} matches")

            match = None

            if not matches:
                results.append({
                    'index': idx,
                    'input': number_str,
                    'status': 'not_found',
                    'message': 'No match found'
                })
                all_convertible = False
            elif len(matches) > 1:
                # Check if all corresponding numbers are identical
                corresponding_numbers = [m['corresponding_number'] for m in matches]
                print(f"[batch_convert] Corresponding numbers: {corresponding_numbers}")
                all_identical = all(num == corresponding_numbers[0] for num in corresponding_numbers)
                print(f"[batch_convert] All identical? {all_identical}")

                if all_identical:
                    # All results have the same corresponding number, use the first match
                    print(f"[batch_convert] Using first match (all identical)")
                    match = matches[0]
                else:
                    # Different corresponding numbers - truly ambiguous
                    print(f"[batch_convert] Truly ambiguous - different numbers")
                    results.append({
                        'index': idx,
                        'input': number_str,
                        'status': 'ambiguous',
                        'message': f'{len(matches)} matches found',
                        'matches': matches
                    })
                    all_convertible = False
            else:
                match = matches[0]

            # Process the match if we have one
            if match is not None:
                # If target system specified, filter result
                converted = match['corresponding_number']
                converted_type = match['corresponding_type']
                print(f"[batch_convert] Converted: {converted} ({converted_type}), Target: {target_system}")

                if target_system and converted_type != target_system:
                    results.append({
                        'index': idx,
                        'input': number_str,
                        'status': 'wrong_target',
                        'message': f'Corresponding number is {converted_type}, not {target_system}',
                        'match': match
                    })
                    all_convertible = False
                else:
                    print(f"[batch_convert] Success! Adding result")
                    results.append({
                        'index': idx,
                        'input': number_str,
                        'output': converted,
                        'status': 'success',
                        'match': match
                    })

        print(f"[batch_convert] Final results count: {len(results)}")
        print(f"[batch_convert] All convertible: {all_convertible}")

        return jsonify({
            'total': len(numbers),
            'all_convertible': all_convertible,
            'results': results
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stats', methods=['GET'])
def stats():
    """Get statistics about the loaded data."""
    if not article_data:
        return jsonify({'error': 'Data not loaded'}), 500

    stats = {
        'total_entries': len(article_data),
        'column1': {'bosch': 0, 'syskomp': 0, 'item': 0, 'invalid': 0, 'empty': 0},
        'column2': {'bosch': 0, 'syskomp': 0, 'item': 0, 'invalid': 0, 'empty': 0}
    }

    for entry in article_data:
        type1 = detect_number_type(entry['number1'])
        type2 = detect_number_type(entry['number2'])
        stats['column1'][type1] += 1
        stats['column2'][type2] += 1

    return jsonify(stats)

@app.route('/api/clean-duplicates', methods=['POST'])
def clean_duplicates():
    """Clean duplicate entries from the CSV file. Only processes rows matching search_term if provided."""
    try:
        data = request.get_json()
        search_term = data.get('search_term', None) if data else None

        csv_path = os.path.join(os.path.dirname(__file__), '..', 'Vorlagen', 'ArtNrn.csv')

        # Create backup
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_path = csv_path.replace('.csv', f'_backup_{timestamp}.csv')
        shutil.copy2(csv_path, backup_path)
        print(f"Created backup: {backup_path}")

        # Read the full CSV
        df = pd.read_csv(csv_path, sep=';', header=0, encoding='latin-1')

        # Store the article data rows (before Warengruppe section)
        article_rows = df.iloc[:3641].copy()  # Up to row 3641 (before Warengruppe header at 3642)
        warengruppe_section = df.iloc[3641:].copy()  # Warengruppe section and beyond

        duplicates_removed = 0

        # If search_term provided, use index for instant lookup (O(1) instead of O(n))
        if search_term:
            search_term = search_term.replace(' ', '').strip()
            search_variations = normalize_item_number(search_term)
            print(f"Cleaning duplicates for: {search_term} (variations: {search_variations})")

            # Use index to find matching row indices instantly - NO ITERATION THROUGH ALL ROWS!
            matching_csv_rows = set()
            for variation in search_variations:
                if variation in article_index:
                    for entry_idx in article_index[variation]:
                        # Convert entry index to CSV row index (entry.row_index gives us CSV line)
                        csv_row_idx = article_data[entry_idx]['row_index'] - 2  # CSV row to df index
                        matching_csv_rows.add(csv_row_idx)

            print(f"Found {len(matching_csv_rows)} rows matching search term (instant index lookup)")

            if matching_csv_rows:
                # Extract only matching rows from dataframe
                matching_rows = article_rows.loc[list(matching_csv_rows)]

                print(f"=== Checking {len(matching_rows)} rows for duplicates ===")

                # Find TRUE duplicates (identical rows) within matching rows only
                seen_rows = set()
                rows_to_delete = []

                for idx, row in matching_rows.iterrows():
                    col1 = str(row.iloc[0]).strip() if not pd.isna(row.iloc[0]) else ''
                    col2 = str(row.iloc[1]).strip() if not pd.isna(row.iloc[1]) else ''
                    bez1 = str(row.iloc[2]).strip() if len(row) > 2 and not pd.isna(row.iloc[2]) else ''
                    bez2 = str(row.iloc[3]).strip() if len(row) > 3 and not pd.isna(row.iloc[3]) else ''
                    warengruppe = str(row.iloc[4]).strip() if len(row) > 4 and not pd.isna(row.iloc[4]) else ''

                    # Check if ENTIRE row is duplicate (all columns must match)
                    row_tuple = (col1, col2, bez1, bez2, warengruppe)

                    print(f"[CHECK] Row {idx+2}: {col1} | {col2} | {bez1} | {bez2} | {warengruppe}")

                    if row_tuple in seen_rows:
                        rows_to_delete.append(idx)
                        duplicates_removed += 1
                        print(f"  >>> DUPLICATE! Will delete this row")
                    else:
                        seen_rows.add(row_tuple)
                        print(f"  >>> First occurrence, keeping")

                print(f"=== End of duplicate check ===")

                # Remove duplicate rows from original dataframe
                if rows_to_delete:
                    article_rows = article_rows.drop(index=rows_to_delete)
                    print(f"Removed {duplicates_removed} duplicate rows")

        rows_to_keep = article_rows

        # Reconstruct the dataframe
        cleaned_articles = pd.DataFrame(rows_to_keep)
        cleaned_df = pd.concat([cleaned_articles, warengruppe_section], ignore_index=True)

        # Save cleaned CSV
        cleaned_df.to_csv(csv_path, sep=';', index=False, encoding='latin-1')
        print(f"Cleaned CSV saved. Removed {duplicates_removed} duplicates.")

        # Reload data
        load_data()

        return jsonify({
            'success': True,
            'duplicates_removed': duplicates_removed,
            'backup_file': os.path.basename(backup_path),
            'total_entries': len(article_data) if article_data else 0
        })

    except Exception as e:
        print(f"Error cleaning duplicates: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("Loading article data...")
    if load_data():
        print("Starting Flask server...")
        app.run(debug=True, host='0.0.0.0', port=5000)
    else:
        print("Failed to load data. Exiting.")

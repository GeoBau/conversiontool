"""
Flask backend API for article number conversion
Adapted for Vercel serverless deployment
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import pandas as pd
import re
from typing import Optional, Dict, List, Tuple
import os
import sys
import shutil
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Configure rate limiting
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

# Global variable to store article data
article_data = None
warengruppe_mapping = {}

# Define validation patterns
PATTERNS = {
    'bosch': r'^\d{10}$',           # Exactly 10 digits
    'syskomp': r'^\d{9}$',          # Exactly 9 digits
    'item': r'^\d+\.\d+\.\d+\.\d+$' # Item format: number.number.number.number
}

def load_data():
    """Load article data from CSV file."""
    global article_data, warengruppe_mapping

    # For Vercel deployment, the CSV should be in the root Vorlagen directory
    # Try multiple possible paths
    possible_paths = [
        os.path.join(os.path.dirname(__file__), '..', 'Vorlagen', 'ArtNrn.csv'),
        os.path.join(os.getcwd(), 'Vorlagen', 'ArtNrn.csv'),
        'Vorlagen/ArtNrn.csv'
    ]

    for csv_path in possible_paths:
        if os.path.exists(csv_path):
            break
    else:
        print(f"CSV file not found in any of the expected locations: {possible_paths}")
        return False

    try:
        df = pd.read_csv(csv_path, sep=';', header=0, encoding='latin-1')

        # Create a clean dataset with the columns we need
        article_data = []

        for idx, row in df.iterrows():
            col1 = str(row.iloc[0]).strip() if not pd.isna(row.iloc[0]) else ''
            col2 = str(row.iloc[1]).strip() if not pd.isna(row.iloc[1]) else ''
            bez1 = str(row.iloc[2]).strip() if len(row) > 2 and not pd.isna(row.iloc[2]) else ''
            bez2 = str(row.iloc[3]).strip() if len(row) > 3 and not pd.isna(row.iloc[3]) else ''
            warengruppe = str(row.iloc[4]).strip() if len(row) > 4 and not pd.isna(row.iloc[4]) else ''

            # Skip empty rows
            if col1 == '' and col2 == '':
                continue

            article_data.append({
                'number1': col1,
                'number2': col2,
                'bez1': bez1,
                'bez2': bez2,
                'warengruppe': warengruppe,
                'row_index': idx + 2  # +2 for 1-indexed with header
            })

        print(f"Loaded {len(article_data)} article entries from {csv_path}")

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
        # 0.0.XXX.XX  (5 digits: 62177 -> 0.0.621.77)
        # 0.0.XXXX.XX (6 digits: 123456 -> 0.0.1234.56)
        # X.X.XXX.XX  (7+ digits: 0062177 -> 0.0.621.77)

        if len(clean) == 5:
            # 5 digits: assume 0.0.XXX.XX format
            variations.append(f"0.0.{clean[0:3]}.{clean[3:]}")

        if len(clean) == 6:
            # 6 digits: try both X.X.XX.XX and 0.0.XXXX.XX
            variations.append(f"{clean[0]}.{clean[1]}.{clean[2:4]}.{clean[4:]}")
            variations.append(f"0.0.{clean[0:4]}.{clean[4:]}")

        if len(clean) >= 7:
            # 7+ digits: X.X.XXX.XX (e.g., 0062177 -> 0.0.621.77)
            variations.append(f"{clean[0]}.{clean[1]}.{clean[2:5]}.{clean[5:]}")

        if len(clean) >= 8:
            # 8+ digits: X.X.XXXX.XX (e.g., 00123456 -> 0.0.1234.56)
            variations.append(f"{clean[0]}.{clean[1]}.{clean[2:6]}.{clean[6:]}")

    return list(set(variations))  # Remove duplicates

def consolidate_duplicates(results: List[Dict]) -> List[Dict]:
    """
    Consolidate duplicate results that have the same article numbers.
    Takes longest bez1, longest bez2, and first warengruppe from each group.
    """
    if len(results) <= 1:
        return results

    # Group results by normalized number pair
    groups = {}
    for result in results:
        num1 = result['input_number']
        num2 = result['corresponding_number']
        # Normalize: always put smaller number first for grouping
        pair_key = tuple(sorted([num1, num2]))

        if pair_key not in groups:
            groups[pair_key] = []
        groups[pair_key].append(result)

    # Consolidate each group
    consolidated = []
    for pair_key, group in groups.items():
        # Take the first result as base
        merged = group[0].copy()

        # Find longest bez1
        longest_bez1 = max(group, key=lambda x: len(x.get('bez1', '')))
        merged['bez1'] = longest_bez1['bez1']

        # Find longest bez2
        longest_bez2 = max(group, key=lambda x: len(x.get('bez2', '')))
        merged['bez2'] = longest_bez2['bez2']

        # Find first non-empty warengruppe
        for item in group:
            if item.get('warengruppe', '').strip():
                merged['warengruppe'] = item['warengruppe']
                merged['warengruppe_description'] = item.get('warengruppe_description', '')
                break

        consolidated.append(merged)

    return consolidated

def search_number(search_term: str) -> List[Dict]:
    """Search for an article number and return all matching entries."""
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
                # Determine which column matched
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
                break

    # Consolidate duplicates before returning
    return consolidate_duplicates(results)

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'ok',
        'data_loaded': article_data is not None,
        'total_entries': len(article_data) if article_data else 0
    })

@app.route('/api/search', methods=['POST'])
@limiter.limit("30 per minute")
def search():
    """Search for article number."""
    try:
        data = request.get_json()

        if not data or 'number' not in data:
            return jsonify({'error': 'Missing "number" field'}), 400

        search_term = str(data['number']).replace(' ', '').strip()

        if not search_term:
            return jsonify({'error': 'Empty search term'}), 400

        results = search_number(search_term)

        if not results:
            return jsonify({
                'found': False,
                'message': f'No matching article found for: {search_term}',
                'search_term': search_term,
                'search_type': detect_number_type(search_term)
            })

        if len(results) > 1:
            return jsonify({
                'found': True,
                'ambiguous': True,
                'message': f'Multiple matches found for: {search_term}',
                'count': len(results),
                'results': results
            })

        return jsonify({
            'found': True,
            'ambiguous': False,
            'result': results[0]
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/validate', methods=['POST'])
def validate():
    """Validate article number format."""
    try:
        data = request.get_json()

        if not data or 'number' not in data:
            return jsonify({'error': 'Missing "number" field'}), 400

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
@limiter.limit("10 per minute")
def batch_convert():
    """Convert a batch of article numbers."""
    try:
        data = request.get_json()

        if not data or 'numbers' not in data:
            return jsonify({'error': 'Missing "numbers" field'}), 400

        numbers = data['numbers']
        target_system = data.get('target_system', None)

        if not isinstance(numbers, list):
            return jsonify({'error': '"numbers" must be an array'}), 400

        results = []
        all_convertible = True

        for idx, number in enumerate(numbers):
            number_str = str(number).replace(' ', '').strip()
            matches = search_number(number_str)

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
                corresponding_numbers = [m['corresponding_number'] for m in matches]
                all_identical = all(num == corresponding_numbers[0] for num in corresponding_numbers)

                if all_identical:
                    match = matches[0]
                else:
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

            if match is not None:
                converted = match['corresponding_number']
                converted_type = match['corresponding_type']

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
                    results.append({
                        'index': idx,
                        'input': number_str,
                        'output': converted,
                        'status': 'success',
                        'match': match
                    })

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

# Load data on module initialization
print("Initializing API...")
load_data()

# For Vercel
app = app

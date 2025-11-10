from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
import os
import csv
from collections import defaultdict
from pathlib import Path
from validators import validate_generic, get_validation_url, validate_url_exists
from file_lock import CSVManager

# Configure Flask to serve frontend
base_dir = os.path.dirname(os.path.dirname(__file__))
frontend_dist = os.path.join(base_dir, 'frontend', 'dist')

app = Flask(__name__, static_folder=frontend_dist, static_url_path='')
CORS(app)

# Data storage
data = defaultdict(dict)
COLUMN_NAMES = {
    'A': 'Syskomp neu',
    'B': 'Syskomp alt',
    'C': 'Beschreibung',
    'D': 'Item',
    'E': 'Bosch',
    'F': 'Alvaris Artnr',
    'G': 'Alvaris Matnr',
    'H': 'ASK'
}

# CSV-Manager initialisieren
csv_path = os.path.join(base_dir, 'Portfolio_Syskomp_pA.csv')
csv_manager = CSVManager(csv_path)

def load_data():
    """Load Portfolio_Syskomp_pA.csv data"""
    filepath = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'Portfolio_Syskomp_pA.csv')

    if not os.path.exists(filepath):
        print(f"ERROR: File not found: {filepath}")
        return

    try:
        with open(filepath, 'r', encoding='utf-8-sig', newline='') as f:
            reader = csv.reader(f, delimiter=';')
            data.clear()

            # Skip header
            next(reader, None)

            row_count = 0
            for row in reader:
                if len(row) < 8:
                    # Pad row with empty strings if necessary
                    row.extend([''] * (8 - len(row)))

                row_dict = {}
                for col_idx, col_letter in enumerate(['A','B','C','D','E','F','G','H']):
                    value = row[col_idx].strip() if col_idx < len(row) else ""
                    row_dict[col_letter] = value if value and value != 'None' else ""

                # Index all searchable columns (all except C which is description)
                for col_letter in ['A','B','D','E','F','G','H']:
                    value = row_dict.get(col_letter, "")
                    if value:
                        data[col_letter][value] = row_dict

                row_count += 1

        print(f"Data loaded from CSV: {row_count} rows, {sum(len(v) for v in data.values())} indexed entries")
    except Exception as e:
        print(f"ERROR loading data: {e}")

def validate_conversion(from_col, to_col, mode):
    """Validate conversion rules based on mode"""
    # Rule: A or B must be involved
    if from_col not in ['A','B'] and to_col not in ['A','B']:
        return False, "Konvertierung muss A oder B beinhalten"

    # External mode: only allow conversions TO A or B
    if mode == "extern" and to_col not in ['A','B']:
        return False, "Extern-Modus: Nur Konvertierung nach A oder B erlaubt"

    # Internal mode: FROM must be A or B
    if mode == "intern" and from_col not in ['A','B']:
        return False, "Intern-Modus: Konvertierung muss von A oder B starten"

    return True, ""

def find_image(artnr, source_type):
    """Find image file for given article number and type"""
    base_dir = os.path.dirname(os.path.dirname(__file__))

    # Define possible image directories
    if source_type == 'alvaris':
        possible_dirs = [
            os.path.join(base_dir, "ALVARIS_CATALOG", "alvaris-a-images"),
            os.path.join(base_dir, "ALVARIS_CATALOG", "alvaris-b-images"),
            os.path.join(base_dir, "ALVARIS_CATALOG", "alvaris-images"),
            os.path.join(base_dir, "ALVARIS_CATALOG", "alvaris-item-images"),
            os.path.join(base_dir, "ALVARIS_CATALOG", "alvaris-bosch-images"),
            os.path.join(base_dir, "alvaris-catalog", "alvaris-bosch-images"),
            os.path.join(base_dir, "alvaris-catalog", "alvaris-item-images"),
        ]
    elif source_type == 'ask':
        possible_dirs = [
            os.path.join(base_dir, "ASK_CATALOG", "ASK-bosch-images"),
            os.path.join(base_dir, "ASK_CATALOG", "ASK-item-images"),
            os.path.join(base_dir, "ASK_CATALOG", "ASKbosch-all-images"),
            os.path.join(base_dir, "ASK_CATALOG", "ASKitem-all-images"),
            os.path.join(base_dir, "ASK-catalog", "ASKbosch-all-images"),
            os.path.join(base_dir, "ASK-catalog", "ASKitem-all-images"),
        ]
    else:
        return None

    # Search for image
    for img_dir in possible_dirs:
        img_path = os.path.join(img_dir, f"{artnr}.png")
        if os.path.exists(img_path):
            return img_path

    return None

@app.route('/api/search', methods=['POST'])
def search_all():
    """Search in all columns and return all matches"""
    try:
        req_data = request.json
        search_value = req_data.get('number', '').strip()

        if not search_value:
            return jsonify({'error': 'Keine Nummer angegeben'}), 400

        # Search in all columns
        matches = []
        seen_rows = set()  # Track unique rows to avoid duplicates

        for col_letter in ['A','B','D','E','F','G','H']:
            row_data = data.get(col_letter, {}).get(search_value)

            if row_data:
                # Create a unique key for this row (using Syskomp A and B)
                row_key = (row_data.get('A', ''), row_data.get('B', ''))

                if row_key not in seen_rows:
                    seen_rows.add(row_key)

                    # Get description
                    description = row_data.get('C', '').replace(';', '\n')

                    # Find image
                    image_info = None
                    alvaris_nr = row_data.get('F', '')
                    ask_nr = row_data.get('H', '')

                    if alvaris_nr and alvaris_nr != '-' and alvaris_nr != 'None':
                        image_info = {
                            'type': 'alvaris',
                            'artnr': alvaris_nr,
                            'crop_top_70': True
                        }
                    elif ask_nr and ask_nr != '-' and ask_nr != 'None':
                        image_info = {
                            'type': 'ask',
                            'artnr': ask_nr,
                            'crop_top_70': False
                        }

                    matches.append({
                        'found_in_col': col_letter,
                        'found_in_col_name': COLUMN_NAMES.get(col_letter, col_letter),
                        'syskomp_neu': row_data.get('A', '-'),
                        'syskomp_alt': row_data.get('B', '-'),
                        'item': row_data.get('D', '-'),
                        'bosch': row_data.get('E', '-'),
                        'alvaris_artnr': row_data.get('F', '-'),
                        'alvaris_matnr': row_data.get('G', '-'),
                        'ask': row_data.get('H', '-'),
                        'description': description,
                        'image': image_info
                    })

        if not matches:
            return jsonify({
                'found': False,
                'search_term': search_value
            })

        return jsonify({
            'found': True,
            'search_term': search_value,
            'count': len(matches),
            'matches': matches
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/convert', methods=['POST'])
def convert_single():
    """Single number conversion"""
    try:
        req_data = request.json
        from_col = req_data.get('from_col', '').upper()
        to_col = req_data.get('to_col', '').upper()
        search_value = req_data.get('number', '').strip()
        mode = req_data.get('mode', 'intern')

        if not search_value:
            return jsonify({'error': 'Keine Nummer angegeben'}), 400

        # Validate conversion
        valid, error = validate_conversion(from_col, to_col, mode)
        if not valid:
            return jsonify({'error': error}), 400

        # Search for number
        row_data = data.get(from_col, {}).get(search_value)

        if not row_data:
            return jsonify({
                'found': False,
                'search_term': search_value,
                'from_col': from_col,
                'to_col': to_col
            })

        # Get result
        if to_col in ['F', 'G']:
            # Special case for Alvaris: show both Artnr and Matnr
            result_value = f"{row_data.get('F', '-')} / {row_data.get('G', '-')}"
        else:
            result_value = row_data.get(to_col, '-')

        # Get description and convert semicolons to newlines
        description = row_data.get('C', '').replace(';', '\n')

        # Find image
        image_info = None
        alvaris_nr = row_data.get('F', '')
        ask_nr = row_data.get('H', '')

        if alvaris_nr and alvaris_nr != '-':
            img_path = find_image(alvaris_nr, 'alvaris')
            if img_path:
                image_info = {
                    'type': 'alvaris',
                    'artnr': alvaris_nr,
                    'crop_top_70': True
                }
        elif ask_nr and ask_nr != '-':
            img_path = find_image(ask_nr, 'ask')
            if img_path:
                image_info = {
                    'type': 'ask',
                    'artnr': ask_nr,
                    'crop_top_70': False
                }

        return jsonify({
            'found': True,
            'from_col': from_col,
            'from_col_name': COLUMN_NAMES.get(from_col, from_col),
            'to_col': to_col,
            'to_col_name': COLUMN_NAMES.get(to_col, to_col),
            'search_value': search_value,
            'result_value': result_value,
            'description': description,
            'row_data': row_data,
            'image': image_info
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/batch-convert', methods=['POST'])
def batch_convert():
    """Batch conversion"""
    try:
        req_data = request.json
        numbers = req_data.get('numbers', [])
        target_col = req_data.get('target_col', 'A').upper()
        mode = req_data.get('mode', 'extern')

        if target_col not in ['A', 'B']:
            return jsonify({'error': 'Batch-Konvertierung nur nach A oder B erlaubt'}), 400

        results = []

        for idx, search_value in enumerate(numbers):
            search_value = str(search_value).strip()

            if not search_value:
                results.append({
                    'index': idx,
                    'input': search_value,
                    'output': None,
                    'status': 'empty'
                })
                continue

            # Search in all columns
            row_data = None
            found_in_col = None

            for col in ['A','B','D','E','F','G','H']:
                if search_value in data.get(col, {}):
                    row_data = data[col][search_value]
                    found_in_col = col
                    break

            if row_data:
                # Validate conversion
                valid, error = validate_conversion(found_in_col, target_col, mode)

                if valid:
                    result_value = row_data.get(target_col, None)
                    results.append({
                        'index': idx,
                        'input': search_value,
                        'output': result_value if result_value else None,
                        'status': 'success' if result_value else 'not_found',
                        'from_col': found_in_col
                    })
                else:
                    results.append({
                        'index': idx,
                        'input': search_value,
                        'output': None,
                        'status': 'invalid_conversion',
                        'message': error
                    })
            else:
                results.append({
                    'index': idx,
                    'input': search_value,
                    'output': None,
                    'status': 'not_found'
                })

        success_count = sum(1 for r in results if r['status'] == 'success')

        return jsonify({
            'total': len(numbers),
            'success': success_count,
            'failed': len(numbers) - success_count,
            'results': results
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/image/<image_type>/<artnr>', methods=['GET'])
def get_image(image_type, artnr):
    """Get image file"""
    try:
        img_path = find_image(artnr, image_type)

        if img_path and os.path.exists(img_path):
            return send_file(img_path, mimetype='image/png')
        else:
            return jsonify({'error': 'Image not found'}), 404

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'rows_loaded': sum(len(v) for v in data.values()),
        'columns': list(COLUMN_NAMES.keys())
    })

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get statistics about the data"""
    return jsonify({
        'syskomp': len(data.get('A', {})),  # Count unique Syskomp neu entries
        'item': len(data.get('D', {})),
        'bosch': len(data.get('E', {})),
        'alvaris': len(data.get('F', {})),
        'ask': len(data.get('H', {}))
    })

@app.route('/api/validate-number', methods=['POST'])
def validate_number():
    """Validiert eine Artikelnummer"""
    try:
        req_data = request.json
        col = req_data.get('col', '').upper()
        number = req_data.get('number', '').strip()
        check_url = req_data.get('check_url', False)

        if not col or not number:
            return jsonify({'error': 'Spalte und Nummer erforderlich'}), 400

        # Format-Validierung
        is_valid, message = validate_generic(number, col)

        if not is_valid:
            return jsonify({
                'valid': False,
                'message': message,
                'format_valid': False
            })

        # Optional: URL-Check
        url_valid = True
        url_message = "Nicht geprüft"

        if check_url:
            validation_url = get_validation_url(col, number)
            if validation_url:
                url_valid, url_message = validate_url_exists(validation_url, col, number)
            else:
                url_message = "Keine URL zum Prüfen verfügbar"

        return jsonify({
            'valid': is_valid and url_valid,
            'message': message if not is_valid else url_message,
            'format_valid': is_valid,
            'url_valid': url_valid
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/update-entry', methods=['POST'])
def update_entry():
    """Aktualisiert eine Zelle in der CSV"""
    try:
        req_data = request.json
        syskomp_neu = req_data.get('syskomp_neu', '').strip()
        col = req_data.get('col', '').upper()
        value = req_data.get('value', '').strip()

        if not syskomp_neu or not col or not value:
            return jsonify({'error': 'Syskomp neu, Spalte und Wert erforderlich'}), 400

        # Validierung
        is_valid, message = validate_generic(value, col)
        if not is_valid:
            return jsonify({'error': f'Validierung fehlgeschlagen: {message}'}), 400

        # Spalten-Index berechnen (A=0, B=1, ..., H=7)
        col_index = ord(col) - ord('A')

        if col_index < 0 or col_index > 7:
            return jsonify({'error': 'Ungültige Spalte'}), 400

        # CSV aktualisieren
        success, result_message = csv_manager.update_cell(syskomp_neu, col_index, value)

        if not success:
            return jsonify({'error': result_message}), 500

        # Daten neu laden
        load_data()

        return jsonify({
            'success': True,
            'message': result_message,
            'syskomp_neu': syskomp_neu,
            'col': col,
            'value': value
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/undo', methods=['POST'])
def undo_last():
    """Macht die letzte Änderung rückgängig (max 3 Min alt)"""
    try:
        success, message = csv_manager.undo_last_action()

        if not success:
            return jsonify({'error': message}), 400

        # Daten neu laden
        load_data()

        return jsonify({
            'success': True,
            'message': message
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/scan-catalogs', methods=['GET'])
def scan_catalogs():
    """Scannt nach Katalog-CSV-Dateien in verschiedenen Verzeichnissen"""
    try:
        catalog_files = []

        # Scan ASK_CATALOG
        ask_catalog_dir = os.path.join(base_dir, "ASK_CATALOG")
        if os.path.exists(ask_catalog_dir):
            for file in sorted(os.listdir(ask_catalog_dir)):
                if file.endswith('.csv') and file.lower() != 'ask-syskomp.csv':
                    catalog_files.append({
                        'path': os.path.join(ask_catalog_dir, file),
                        'name': file,
                        'type': 'ASK'
                    })

        # Scan ALVARIS_CATALOG
        alvaris_catalog_dir = os.path.join(base_dir, "ALVARIS_CATALOG")
        if os.path.exists(alvaris_catalog_dir):
            for file in sorted(os.listdir(alvaris_catalog_dir)):
                if file.endswith('.csv') and file.lower() != 'ask-syskomp.csv':
                    catalog_files.append({
                        'path': os.path.join(alvaris_catalog_dir, file),
                        'name': file,
                        'type': 'ALVARIS'
                    })

        return jsonify({
            'catalogs': catalog_files
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/load-catalog', methods=['POST'])
def load_catalog():
    """Lädt einen Katalog (ASK/ALVARIS) und gibt Produkte zurück"""
    try:
        req_data = request.json
        catalog_path = req_data.get('catalog_path', '')

        if not catalog_path or not os.path.exists(catalog_path):
            return jsonify({'error': 'Katalog-Datei nicht gefunden'}), 400

        products = []
        with open(catalog_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                products.append(row)

        # Determine image directory
        catalog_name = os.path.splitext(os.path.basename(catalog_path))[0]
        parent_dir = os.path.dirname(catalog_path)
        image_dir = os.path.join(parent_dir, f"{catalog_name}-images")

        # Determine catalog type and check appropriate columns
        is_alvaris = 'ALVARIS' in parent_dir.upper() or 'alvaris' in catalog_name.lower()

        # Check which article numbers already exist in Portfolio CSV
        existing_numbers = set()
        portfolio_path = os.path.join(os.path.dirname(__file__), '..', 'Portfolio_Syskomp_pA.csv')
        if os.path.exists(portfolio_path):
            with open(portfolio_path, 'r', encoding='utf-8') as pf:
                portfolio_reader = csv.reader(pf, delimiter=';')
                for row in portfolio_reader:
                    if is_alvaris:
                        # Alvaris: Check column F (AlvarisArtnr, index 5) and G (AlvarisMatnr, index 6)
                        if len(row) > 5 and row[5]:
                            existing_numbers.add(row[5].strip())
                        if len(row) > 6 and row[6]:
                            existing_numbers.add(row[6].strip())
                    else:
                        # ASK: Check column H (index 7)
                        if len(row) > 7 and row[7]:
                            existing_numbers.add(row[7].strip())

        # Mark products that already exist
        for product in products:
            art_nr = product.get('Artikelnummer', '').strip()
            product['already_mapped'] = art_nr in existing_numbers

        return jsonify({
            'success': True,
            'products': products,
            'catalog_name': catalog_name,
            'image_dir': image_dir,
            'total': len(products)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/find-similar', methods=['POST'])
def find_similar():
    """Findet ähnliche Produkte aus Portfolio CSV basierend auf Beschreibung"""
    try:
        from difflib import SequenceMatcher
        import re

        req_data = request.json
        search_description = req_data.get('description', '').strip().lower()
        min_similarity = req_data.get('min_similarity', 0.0)
        filter_type = req_data.get('filter_type', 'all')  # 'all', 'item', 'bosch'

        if not search_description:
            return jsonify({'error': 'Beschreibung erforderlich'}), 400

        matches = []

        # Durchsuche alle Zeilen im Portfolio CSV
        for col_letter in ['A']:  # Nur Syskomp neu
            for syskomp_neu, row_data in data.get(col_letter, {}).items():
                description = row_data.get('C', '').lower()

                if not description:
                    continue

                # Filter nach Typ (Item/Bosch)
                item_nr = row_data.get('D', '')
                bosch_nr = row_data.get('E', '')

                if filter_type == 'item' and not item_nr:
                    continue
                if filter_type == 'bosch' and not bosch_nr:
                    continue

                # Berechne Ähnlichkeit
                similarity = SequenceMatcher(None, search_description, description).ratio()

                # Bonus für "Profil X" <-> "Nut X" Matching
                profil_match = re.search(r'profil\s*(\d+)', search_description)
                nut_match = re.search(r'nut\s*(\d+)', description)

                if profil_match and nut_match:
                    if profil_match.group(1) == nut_match.group(1):
                        similarity = min(1.0, similarity + 0.3)

                # Reverse check
                nut_match1 = re.search(r'nut\s*(\d+)', search_description)
                profil_match2 = re.search(r'profil\s*(\d+)', description)

                if nut_match1 and profil_match2:
                    if nut_match1.group(1) == profil_match2.group(1):
                        similarity = min(1.0, similarity + 0.3)

                if similarity >= min_similarity:
                    matches.append({
                        'syskomp_neu': row_data.get('A', ''),
                        'syskomp_alt': row_data.get('B', ''),
                        'description': row_data.get('C', ''),
                        'item': row_data.get('D', ''),
                        'bosch': row_data.get('E', ''),
                        'alvaris_artnr': row_data.get('F', ''),
                        'alvaris_matnr': row_data.get('G', ''),
                        'ask': row_data.get('H', ''),
                        'similarity': similarity
                    })

        # Sortiere nach Ähnlichkeit (höchste zuerst)
        matches.sort(key=lambda x: x['similarity'], reverse=True)

        return jsonify({
            'success': True,
            'matches': matches[:20],  # Top 20
            'total_found': len(matches)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Serve frontend (must be after all API routes)
@app.route('/')
def serve_frontend():
    """Serve the frontend index.html"""
    if os.path.exists(app.static_folder):
        return send_from_directory(app.static_folder, 'index.html')
    else:
        return jsonify({'error': 'Frontend not built. Run: cd frontend && npm run build'}), 404

@app.route('/<path:path>')
def serve_static(path):
    """Serve static files or fallback to index.html for client-side routing"""
    # Skip API routes
    if path.startswith('api/'):
        return jsonify({'error': 'API endpoint not found'}), 404

    file_path = os.path.join(app.static_folder, path)
    if os.path.exists(file_path):
        return send_from_directory(app.static_folder, path)
    else:
        # For client-side routing, return index.html
        if os.path.exists(app.static_folder):
            return send_from_directory(app.static_folder, 'index.html')
        else:
            return jsonify({'error': 'Frontend not built'}), 404

# Load data on startup
load_data()

if __name__ == '__main__':
    app.run(debug=True, port=5000, host='0.0.0.0')

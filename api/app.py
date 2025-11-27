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
                # Store as list to support multiple rows with same value
                # Support pipe-separated values (e.g., "370010|370011" for multiple article numbers)
                for col_letter in ['A','B','D','E','F','G','H']:
                    value = row_dict.get(col_letter, "")
                    if value:
                        # Split by pipe to support multiple values per cell
                        values = [v.strip() for v in value.split('|') if v.strip()]
                        for single_value in values:
                            if single_value not in data[col_letter]:
                                data[col_letter][single_value] = []
                            data[col_letter][single_value].append(row_dict)

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
            row_list = data.get(col_letter, {}).get(search_value, [])

            for row_data in row_list:
                # Create a unique key for this row (using Syskomp A and B)
                row_key = (row_data.get('A', ''), row_data.get('B', ''))

                if row_key not in seen_rows:
                    seen_rows.add(row_key)

                    # Get description
                    description = row_data.get('C', '').replace(';', '\n')

                    # Find image - check for Syskomp image first, then Item, Bosch, Alvaris, ASK
                    image_info = None
                    syskomp_nr = row_data.get('A', '')
                    item_nr = row_data.get('D', '')
                    bosch_nr = row_data.get('E', '')
                    alvaris_nr = row_data.get('F', '')
                    ask_nr = row_data.get('H', '')

                    images_dir = os.path.join(base_dir, 'frontend', 'public', 'images')

                    # Check in order: Syskomp, Item, Bosch, Alvaris, ASK
                    def check_image_exists(artnr):
                        if not artnr or artnr == '-' or artnr == 'None':
                            return False
                        # Handle pipe-separated values - check first value
                        first_val = artnr.split('|')[0].strip() if '|' in artnr else artnr
                        return os.path.exists(os.path.join(images_dir, f'{first_val}.png'))

                    def get_first_artnr(artnr):
                        if '|' in artnr:
                            return artnr.split('|')[0].strip()
                        return artnr

                    if syskomp_nr and check_image_exists(syskomp_nr):
                        image_info = {
                            'type': 'syskomp',
                            'artnr': get_first_artnr(syskomp_nr),
                            'crop_top_70': False
                        }
                    elif item_nr and check_image_exists(item_nr):
                        image_info = {
                            'type': 'item',
                            'artnr': get_first_artnr(item_nr),
                            'crop_top_70': False
                        }
                    elif bosch_nr and check_image_exists(bosch_nr):
                        image_info = {
                            'type': 'bosch',
                            'artnr': get_first_artnr(bosch_nr),
                            'crop_top_70': False
                        }
                    elif alvaris_nr and alvaris_nr != '-' and alvaris_nr != 'None':
                        image_info = {
                            'type': 'alvaris',
                            'artnr': get_first_artnr(alvaris_nr),
                            'crop_top_70': True
                        }
                    elif ask_nr and ask_nr != '-' and ask_nr != 'None':
                        image_info = {
                            'type': 'ask',
                            'artnr': get_first_artnr(ask_nr),
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

        # Search for number (now returns list)
        row_list = data.get(from_col, {}).get(search_value, [])

        if not row_list:
            return jsonify({
                'found': False,
                'search_term': search_value,
                'from_col': from_col,
                'to_col': to_col
            })

        # Use first match for single conversion (for backwards compatibility)
        row_data = row_list[0]

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
            'image': image_info,
            'multiple_matches': len(row_list) > 1,
            'match_count': len(row_list)
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

            # Search in all columns (now returns list)
            row_list = []
            found_in_col = None

            for col in ['A','B','D','E','F','G','H']:
                if search_value in data.get(col, {}):
                    row_list = data[col][search_value]
                    found_in_col = col
                    break

            if row_list:
                # Use first match for batch conversion
                row_data = row_list[0]

                # Validate conversion
                valid, error = validate_conversion(found_in_col, target_col, mode)

                if valid:
                    result_value = row_data.get(target_col, None)
                    results.append({
                        'index': idx,
                        'input': search_value,
                        'output': result_value if result_value else None,
                        'status': 'success' if result_value else 'not_found',
                        'from_col': found_in_col,
                        'multiple_matches': len(row_list) > 1
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
    """Aktualisiert oder löscht eine Zelle in der CSV"""
    try:
        req_data = request.json
        syskomp_neu = req_data.get('syskomp_neu', '').strip()
        col = req_data.get('col', '').upper()
        value = req_data.get('value', '').strip()
        append_mode = req_data.get('append', False)  # If true, append with | instead of replace

        if not syskomp_neu or not col:
            return jsonify({'error': 'Syskomp neu und Spalte erforderlich'}), 400

        # Validierung nur wenn Wert nicht leer (leer = löschen)
        if value:
            is_valid, message = validate_generic(value, col)
            if not is_valid:
                return jsonify({'error': f'Validierung fehlgeschlagen: {message}'}), 400

        # Spalten-Index berechnen (A=0, B=1, ..., H=7)
        col_index = ord(col) - ord('A')

        if col_index < 0 or col_index > 7:
            return jsonify({'error': 'Ungültige Spalte'}), 400

        # If append mode, get current value and append
        final_value = value
        if append_mode and value:
            # Get current value from data
            row_list = data.get('A', {}).get(syskomp_neu, [])
            if row_list:
                current_value = row_list[0].get(col, '')
                if current_value and current_value != '-':
                    # Check if value already exists in pipe-separated list
                    existing_values = [v.strip() for v in current_value.split('|')]
                    if value not in existing_values:
                        final_value = f"{current_value}|{value}"
                    else:
                        final_value = current_value  # Already exists, don't duplicate

        # CSV aktualisieren
        success, result_message = csv_manager.update_cell(syskomp_neu, col_index, final_value)

        if not success:
            return jsonify({'error': result_message}), 500

        # Daten neu laden
        load_data()

        return jsonify({
            'success': True,
            'message': result_message,
            'syskomp_neu': syskomp_neu,
            'col': col,
            'value': final_value
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/delete-row', methods=['POST'])
def delete_row():
    """Löscht eine komplette Zeile aus der CSV"""
    try:
        req_data = request.json
        syskomp_neu = req_data.get('syskomp_neu', '').strip()

        if not syskomp_neu:
            return jsonify({'error': 'Syskomp neu erforderlich'}), 400

        # Zeile löschen
        success, result_message = csv_manager.delete_row(syskomp_neu)

        if not success:
            return jsonify({'error': result_message}), 500

        # Daten neu laden
        load_data()

        return jsonify({
            'success': True,
            'message': result_message,
            'syskomp_neu': syskomp_neu
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

@app.route('/api/create-entry', methods=['POST'])
def create_entry():
    """Erstellt einen neuen Eintrag in der Portfolio CSV (Neuaufnahme)"""
    try:
        req_data = request.json
        syskomp_neu = req_data.get('syskomp_neu', '').strip()
        syskomp_alt = req_data.get('syskomp_alt', '').strip()
        description = req_data.get('description', '').strip()
        item = req_data.get('item', '').strip()
        bosch = req_data.get('bosch', '').strip()
        alvaris_artnr = req_data.get('alvaris_artnr', '').strip()
        alvaris_matnr = req_data.get('alvaris_matnr', '').strip()
        ask = req_data.get('ask', '').strip()

        # Legacy support for catalog_artnr
        catalog_artnr = req_data.get('catalog_artnr', '').strip()
        catalog_type = req_data.get('catalog_type', '').lower()

        if not syskomp_neu:
            return jsonify({'error': 'Syskomp neu ist erforderlich'}), 400

        # Validiere Format für Syskomp neu (erforderlich)
        if len(syskomp_neu) != 9 or not syskomp_neu.startswith('1') or not syskomp_neu.isdigit():
            return jsonify({'error': 'Syskomp neu: 9 Ziffern, beginnt mit 1'}), 400

        # Validiere Format für Syskomp alt (optional, aber wenn ausgefüllt muss es korrekt sein)
        if syskomp_alt:
            if len(syskomp_alt) != 9 or (not syskomp_alt.startswith('2') and not syskomp_alt.startswith('4')) or not syskomp_alt.isdigit():
                return jsonify({'error': 'Syskomp alt: 9 Ziffern, beginnt mit 2 oder 4'}), 400

        # Neue Zeile erstellen (8 Spalten: A-H)
        new_row = [''] * 8
        new_row[0] = syskomp_neu  # Column A
        new_row[1] = syskomp_alt  # Column B
        new_row[2] = description  # Column C
        new_row[3] = item         # Column D
        new_row[4] = bosch        # Column E
        new_row[5] = alvaris_artnr  # Column F
        new_row[6] = alvaris_matnr  # Column G
        new_row[7] = ask          # Column H

        # Legacy: catalog_artnr in richtige Spalte
        if catalog_artnr and catalog_type:
            col_index_map = {
                'alvaris': 5,
                'bosch': 4,
                'item': 3,
                'ask': 7
            }
            catalog_col_index = col_index_map.get(catalog_type, 7)
            new_row[catalog_col_index] = catalog_artnr

        # CSV aktualisieren
        success, message = csv_manager.append_row(new_row)

        if not success:
            return jsonify({'error': message}), 500

        # Daten neu laden
        load_data()

        return jsonify({
            'success': True,
            'message': 'Neuer Eintrag erfolgreich erstellt',
            'syskomp_neu': syskomp_neu
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/upload-image', methods=['POST'])
def upload_image():
    """Lädt ein Produktbild hoch und speichert es mit der Syskomp-Nummer als Name"""
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'Kein Bild übermittelt'}), 400

        image_file = request.files['image']
        syskomp_neu = request.form.get('syskomp_neu', '').strip()

        if not syskomp_neu:
            return jsonify({'error': 'Syskomp-Nummer erforderlich'}), 400

        if not image_file.filename:
            return jsonify({'error': 'Keine Datei ausgewählt'}), 400

        # Validate file type
        allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
        file_ext = image_file.filename.rsplit('.', 1)[-1].lower() if '.' in image_file.filename else ''
        if file_ext not in allowed_extensions:
            return jsonify({'error': f'Ungültiger Dateityp. Erlaubt: {", ".join(allowed_extensions)}'}), 400

        # Save to frontend/public/images with syskomp_neu as filename
        images_dir = os.path.join(base_dir, 'frontend', 'public', 'images')
        os.makedirs(images_dir, exist_ok=True)

        # Always save as PNG for consistency
        image_path = os.path.join(images_dir, f'{syskomp_neu}.png')

        # Convert to PNG if needed (requires PIL)
        try:
            from PIL import Image
            img = Image.open(image_file)
            # Convert to RGB if necessary (e.g., for RGBA or P mode images)
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')
            img.save(image_path, 'PNG')
        except ImportError:
            # If PIL not available, just save as-is
            image_file.save(image_path)

        return jsonify({
            'success': True,
            'message': 'Bild erfolgreich hochgeladen',
            'image_path': f'/images/{syskomp_neu}.png'
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/update-catalog-artikelnr', methods=['POST'])
def update_catalog_artikelnr():
    """Aktualisiert oder löscht eine Artikelnummer in einer Katalog-CSV-Datei"""
    try:
        req_data = request.json
        catalog_type = req_data.get('catalog_type', '').lower()
        old_artikelnr = req_data.get('old_artikelnr', '').strip()
        new_artikelnr = req_data.get('new_artikelnr', '').strip()  # Can be empty for deletion

        if not catalog_type or not old_artikelnr:
            return jsonify({'error': 'Katalogtyp und alte Artikelnummer erforderlich'}), 400

        # Katalog-Verzeichnis bestimmen
        if catalog_type == 'alvaris':
            catalog_dir = os.path.join(base_dir, "ALVARIS_CATALOG")
        elif catalog_type == 'bosch':
            catalog_dir = os.path.join(base_dir, "BOSCH_CATALOG")
        elif catalog_type == 'item':
            catalog_dir = os.path.join(base_dir, "ITEM_CATALOG")
        elif catalog_type == 'ask':
            catalog_dir = os.path.join(base_dir, "ASK_CATALOG")
        else:
            return jsonify({'error': f'Unbekannter Katalogtyp: {catalog_type}'}), 400

        if not os.path.exists(catalog_dir):
            return jsonify({'error': f'Katalog-Verzeichnis nicht gefunden: {catalog_dir}'}), 404

        # Finde die CSV-Datei im Katalog-Verzeichnis
        csv_files = [f for f in os.listdir(catalog_dir) if f.endswith('.csv')]
        if not csv_files:
            return jsonify({'error': f'Keine CSV-Datei im Katalog-Verzeichnis gefunden'}), 404

        # Verwende die erste gefundene CSV
        catalog_file = os.path.join(catalog_dir, csv_files[0])

        # CSV lesen und Artikelnummer aktualisieren
        updated = False
        rows = []

        with open(catalog_file, 'r', encoding='utf-8-sig', newline='') as f:
            reader = csv.reader(f, delimiter=';')
            for row in reader:
                if len(row) > 0 and row[0] == old_artikelnr:
                    # Artikelnummer in der ersten Spalte aktualisieren
                    row[0] = new_artikelnr
                    updated = True
                rows.append(row)

        if not updated:
            return jsonify({'error': f'Artikelnummer {old_artikelnr} nicht gefunden'}), 404

        # CSV zurückschreiben
        with open(catalog_file, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f, delimiter=';', quoting=csv.QUOTE_MINIMAL)
            writer.writerows(rows)

        message = 'Artikelnummer erfolgreich gelöscht' if not new_artikelnr else 'Artikelnummer erfolgreich aktualisiert'

        return jsonify({
            'success': True,
            'message': message,
            'old_artikelnr': old_artikelnr,
            'new_artikelnr': new_artikelnr,
            'catalog_file': catalog_file
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

        # Check which article numbers already exist in Portfolio CSV and store their Syskomp numbers
        # Now supports multiple Syskomp numbers per article (list instead of single dict)
        existing_numbers = {}  # {artikelnummer: [{'syskomp_neu': ..., 'syskomp_alt': ..., 'other_catalog_nrs': {...}}, ...]}
        portfolio_path = os.path.join(os.path.dirname(__file__), '..', 'Portfolio_Syskomp_pA.csv')
        if os.path.exists(portfolio_path):
            with open(portfolio_path, 'r', encoding='utf-8') as pf:
                portfolio_reader = csv.reader(pf, delimiter=';')
                next(portfolio_reader, None)  # Skip header
                for row in portfolio_reader:
                    syskomp_neu = row[0].strip() if len(row) > 0 else ''
                    syskomp_alt = row[1].strip() if len(row) > 1 else ''
                    item_nr = row[3].strip() if len(row) > 3 else ''
                    bosch_nr = row[4].strip() if len(row) > 4 else ''
                    alvaris_artnr = row[5].strip() if len(row) > 5 else ''
                    alvaris_matnr = row[6].strip() if len(row) > 6 else ''
                    ask_nr = row[7].strip() if len(row) > 7 else ''

                    # Build other catalog numbers dict
                    other_catalog_nrs = {
                        'item': item_nr,
                        'bosch': bosch_nr,
                        'alvaris_artnr': alvaris_artnr,
                        'alvaris_matnr': alvaris_matnr,
                        'ask': ask_nr
                    }

                    mapping_info = {
                        'syskomp_neu': syskomp_neu,
                        'syskomp_alt': syskomp_alt,
                        'other_catalog_nrs': other_catalog_nrs
                    }

                    # Helper to add mapping for an article number (handles pipe-separated values)
                    def add_mapping(artnr_field):
                        if not artnr_field:
                            return
                        # Handle pipe-separated values
                        for artnr in artnr_field.split('|'):
                            artnr = artnr.strip()
                            if artnr:
                                if artnr not in existing_numbers:
                                    existing_numbers[artnr] = []
                                # Avoid duplicates
                                if not any(m['syskomp_neu'] == syskomp_neu for m in existing_numbers[artnr]):
                                    existing_numbers[artnr].append(mapping_info.copy())

                    if is_alvaris:
                        # Alvaris: Check column F (AlvarisArtnr) and G (AlvarisMatnr)
                        add_mapping(alvaris_artnr)
                        add_mapping(alvaris_matnr)
                    else:
                        # ASK: Check column H
                        add_mapping(ask_nr)

        # Mark products that already exist and add Syskomp numbers (now as list)
        for product in products:
            art_nr = product.get('Artikelnummer', '').strip()
            if art_nr in existing_numbers:
                product['already_mapped'] = True
                product['existing_mappings'] = existing_numbers[art_nr]  # List of all mappings
                # For backwards compatibility, also set single values from first mapping
                product['mapped_syskomp_neu'] = existing_numbers[art_nr][0]['syskomp_neu']
                product['mapped_syskomp_alt'] = existing_numbers[art_nr][0]['syskomp_alt']
            else:
                product['already_mapped'] = False
                product['existing_mappings'] = []

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

        # Durchsuche alle Zeilen im Portfolio CSV (now lists)
        for col_letter in ['A']:  # Nur Syskomp neu
            for syskomp_neu, row_list in data.get(col_letter, {}).items():
                for row_data in row_list:
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

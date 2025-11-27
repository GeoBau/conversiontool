"""
Validierungsfunktionen für Artikelnummern
"""

import re
import requests
from typing import Tuple

def validate_item(number: str) -> Tuple[bool, str]:
    """
    Validiert Item-Artikelnummer
    Format: x.x.x.x (genau 3 Punkte, nur Ziffern und Punkte)
    Max. 15 Zeichen
    """
    if not number or not number.strip():
        return False, "Nummer darf nicht leer sein"

    number = number.strip()

    if len(number) > 15:
        return False, "Max. 15 Zeichen erlaubt"

    # Nur Zahlen und Punkte erlaubt
    if not re.match(r'^[\d\.]+$', number):
        return False, "Nur Zahlen und Punkte sind erlaubt (z.B. 0.0.479.76)"

    # Muss genau 3 Punkte enthalten (Format: x.x.x.x)
    if number.count('.') != 3:
        return False, "Format muss x.x.x.x sein (genau 3 Punkte)"

    return True, "OK"


def validate_bosch(number: str) -> Tuple[bool, str]:
    """
    Validiert Bosch-Artikelnummer
    Nur Zahlen erlaubt
    Genau 10 Zeichen
    """
    if not number or not number.strip():
        return False, "Nummer darf nicht leer sein"

    number = number.strip()

    # Muss genau 10 Zeichen lang sein
    if len(number) != 10:
        return False, "Bosch-Nummer muss genau 10 Zeichen haben"

    # Nur Zahlen erlaubt
    if not re.match(r'^\d+$', number):
        return False, "Nur Zahlen sind erlaubt"

    return True, "OK"


def validate_alvaris_artnr(number: str) -> Tuple[bool, str]:
    """
    Validiert Alvaris-Artikelnummer (Spalte F)
    Keine Sonderzeichen (nur Ziffern)
    Genau 7 Zeichen
    """
    if not number or not number.strip():
        return False, "Nummer darf nicht leer sein"

    number = number.strip()

    # Muss genau 7 Zeichen lang sein
    if len(number) != 7:
        return False, "Alvaris Artnr muss genau 7 Zeichen haben"

    # Nur Zahlen erlaubt
    if not re.match(r'^\d+$', number):
        return False, "Nur Zahlen sind erlaubt"

    return True, "OK"


def validate_alvaris_matnr(number: str) -> Tuple[bool, str]:
    """
    Validiert Alvaris-Materialnummer (Spalte G)
    Bis zu 10 Zeichen
    Muss Buchstaben enthalten
    Erlaubt: Buchstaben, Zahlen und Punkt
    """
    if not number or not number.strip():
        return False, "Nummer darf nicht leer sein"

    number = number.strip()

    # Max. 10 Zeichen
    if len(number) > 10:
        return False, "Alvaris Matnr darf max. 10 Zeichen haben"

    # Nur Buchstaben, Zahlen und Punkt erlaubt
    if not re.match(r'^[A-Za-z0-9\.]+$', number):
        return False, "Nur Buchstaben, Zahlen und Punkt sind erlaubt"

    # Muss mindestens einen Buchstaben enthalten
    if not re.search(r'[A-Za-z]', number):
        return False, "Alvaris Matnr muss Buchstaben enthalten"

    return True, "OK"


def validate_ask(number: str) -> Tuple[bool, str]:
    """
    Validiert ASK-Artikelnummer
    Nur Zahlen erlaubt
    6 bis 8 Zeichen
    """
    if not number or not number.strip():
        return False, "Nummer darf nicht leer sein"

    number = number.strip()

    # Muss 6 bis 8 Zeichen lang sein
    if len(number) < 6 or len(number) > 8:
        return False, "ASK-Nummer muss 6-8 Zeichen haben"

    # Nur Zahlen erlaubt
    if not re.match(r'^\d+$', number):
        return False, "Nur Zahlen sind erlaubt"

    return True, "OK"


def validate_syskomp_neu(number: str) -> Tuple[bool, str]:
    """
    Validiert Syskomp neu Artikelnummer (Spalte A)
    Genau 9 Ziffern, beginnt mit 1
    """
    if not number or not number.strip():
        return False, "Nummer darf nicht leer sein"

    number = number.strip()

    # Muss genau 9 Zeichen lang sein
    if len(number) != 9:
        return False, "Syskomp neu muss genau 9 Ziffern haben"

    # Nur Zahlen erlaubt
    if not re.match(r'^\d+$', number):
        return False, "Nur Zahlen sind erlaubt"

    # Muss mit 1 beginnen
    if not number.startswith('1'):
        return False, "Syskomp neu muss mit 1 beginnen"

    return True, "OK"


def validate_syskomp_alt(number: str) -> Tuple[bool, str]:
    """
    Validiert Syskomp alt Artikelnummer (Spalte B)
    Genau 9 Ziffern, beginnt mit 2 oder 4
    """
    if not number or not number.strip():
        return False, "Nummer darf nicht leer sein"

    number = number.strip()

    # Muss genau 9 Zeichen lang sein
    if len(number) != 9:
        return False, "Syskomp alt muss genau 9 Ziffern haben"

    # Nur Zahlen erlaubt
    if not re.match(r'^\d+$', number):
        return False, "Nur Zahlen sind erlaubt"

    # Muss mit 2 oder 4 beginnen
    if not number.startswith('2') and not number.startswith('4'):
        return False, "Syskomp alt muss mit 2 oder 4 beginnen"

    return True, "OK"


def validate_generic(number: str, col: str) -> Tuple[bool, str]:
    """
    Generische Validierung für alle Spalten
    Routet zur spezifischen Validierungsfunktion

    Erlaubt "-" als Platzhalter für "keine Nummer"
    Unterstützt Pipe-getrennte Mehrfachwerte (z.B. "1234567|1234568")
    """
    # Erlaube "-" als gültigen Wert für "keine Nummer"
    if number and number.strip() == '-':
        return True, "OK (keine Nummer)"

    # Erlaube leere Werte
    if not number or not number.strip():
        return True, "OK (leer)"

    # Split by pipe for multiple values
    values = [v.strip() for v in number.split('|') if v.strip()]

    if not values:
        return True, "OK (leer)"

    # Validate each value
    for val in values:
        if col == 'A':  # Syskomp neu
            valid, msg = validate_syskomp_neu(val)
        elif col == 'B':  # Syskomp alt
            valid, msg = validate_syskomp_alt(val)
        elif col == 'D':  # Item
            valid, msg = validate_item(val)
        elif col == 'E':  # Bosch
            valid, msg = validate_bosch(val)
        elif col == 'F':  # Alvaris Artnr
            valid, msg = validate_alvaris_artnr(val)
        elif col == 'G':  # Alvaris Matnr
            valid, msg = validate_alvaris_matnr(val)
        elif col == 'H':  # ASK
            valid, msg = validate_ask(val)
        else:
            return False, f"Spalte {col} kann nicht editiert werden"

        if not valid:
            return False, f"Wert '{val}': {msg}"

    return True, f"OK ({len(values)} Werte)"


def validate_url_exists(url: str, col: str = None, number: str = None, timeout: int = 10) -> Tuple[bool, str]:
    """
    Prüft ob URL erreichbar ist und Artikel gefunden wurde
    Hinweis: Für ASK wird keine URL-Validierung durchgeführt (nur Format)
    """
    try:
        # Für ASK und Bosch: Keine URL-Validierung (nur Format-Check)
        # ASK: CSRF-Schutz blockiert automatisierte Anfragen
        # Bosch: JavaScript-basierte SPA lädt Ergebnisse dynamisch
        if col in ['E', 'H']:
            return True, "Format OK (URL-Prüfung nicht verfügbar)"

        # Für andere Spalten: Vollständige GET-Anfrage um Seiteninhalt zu prüfen
        response = requests.get(url, timeout=timeout, allow_redirects=True)

        if response.status_code != 200:
            if response.status_code == 404:
                return False, "Seite nicht gefunden (404)"
            else:
                return False, f"Fehler beim Laden (Status: {response.status_code})"

        # Für Item (Spalte D): Prüfe auf "0 Treffer" in der Antwort
        if col == 'D':
            if "0 Treffer" in response.text:
                return False, "Artikel nicht gefunden (0 Treffer)"
            else:
                return True, "Artikel gefunden"

        # Für Alvaris (Spalte F/G): Prüfe ob Artikelnummer in uk-link-reset Link erscheint
        if col in ['F', 'G'] and number:
            # Suche nach Link mit class="uk-link-reset" der mit der Artikelnummer beginnt
            pattern = rf'<a class="uk-link-reset" href="[^"]*">{re.escape(number)}[^<]*</a>'
            if re.search(pattern, response.text):
                return True, f"Artikel gefunden (Artikelnummer {number} in Suchergebnissen)"
            else:
                return False, f"Artikel nicht gefunden (Artikelnummer {number} nicht in Suchergebnissen)"

        # Für andere Spalten: Einfacher Erreichbarkeits-Check
        return True, "URL erreichbar"

    except requests.exceptions.Timeout:
        return False, "Timeout beim Laden der URL"
    except requests.exceptions.RequestException as e:
        return False, f"Fehler beim Laden: {str(e)}"


def get_validation_url(col: str, number: str) -> str:
    """
    Gibt die URL für die Link-Validierung zurück
    """
    urls = {
        'D': f'https://www.item24.com/de-de/search/?q={number}',
        'E': f'https://www.boschrexroth.com/de/de/search.html?q={number}&origin=header',
        'F': f'https://www.alvaris.com/de/?s={number}&trp-form-language=de',
        'G': f'https://www.alvaris.com/de/?s={number}&trp-form-language=de',
        'H': 'https://askgmbh.com/auctores/scs/imc'
    }
    return urls.get(col)


if __name__ == '__main__':
    # Test-Fälle
    print("=== Validator Tests ===\n")

    # Item Tests (muss genau 3 Punkte haben, nur Zahlen und Punkte)
    print("Item Tests (Format: x.x.x.x, max 15 Zeichen):")
    print(f"  '0.0.479.76' (OK): {validate_item('0.0.479.76')}")
    print(f"  'ABC' (Fehler - keine Zahlen): {validate_item('ABC')}")
    print(f"  '1.2.3' (Fehler - nur 2 Punkte): {validate_item('1.2.3')}")
    print(f"  '1.2.3.4.5' (Fehler - zu viele Punkte): {validate_item('1.2.3.4.5')}")

    # Bosch Tests (genau 10 Zeichen, Zahlen)
    print("\nBosch Tests (genau 10 Zeichen, nur Zahlen):")
    print(f"  '0820055051' (OK): {validate_bosch('0820055051')}")
    print(f"  '12345' (Fehler - zu kurz): {validate_bosch('12345')}")
    print(f"  '12345678901' (Fehler - zu lang): {validate_bosch('12345678901')}")

    # Alvaris Artnr Tests (genau 7 Zeichen, nur Zahlen)
    print("\nAlvaris Artnr Tests (genau 7 Zeichen, nur Zahlen):")
    print(f"  '1010072' (OK): {validate_alvaris_artnr('1010072')}")
    print(f"  '123' (Fehler - zu kurz): {validate_alvaris_artnr('123')}")
    print(f"  '123ABC4' (Fehler - Buchstaben): {validate_alvaris_artnr('123ABC4')}")

    # Alvaris Matnr Tests (bis zu 10 Zeichen, muss Buchstaben enthalten)
    print("\nAlvaris Matnr Tests (bis zu 10 Zeichen, muss Buchstaben enthalten):")
    print(f"  'ANTSTEP.60' (OK): {validate_alvaris_matnr('ANTSTEP.60')}")
    print(f"  'ABC123' (OK): {validate_alvaris_matnr('ABC123')}")
    print(f"  '1234567890' (Fehler - keine Buchstaben): {validate_alvaris_matnr('1234567890')}")
    print(f"  'ABCDEFGHIJK' (Fehler - zu lang): {validate_alvaris_matnr('ABCDEFGHIJK')}")
    print(f"  'ABC-123' (Fehler - Bindestrich nicht erlaubt): {validate_alvaris_matnr('ABC-123')}")

    # ASK Tests (6-8 Zeichen, Zahlen)
    print("\nASK Tests (6-8 Zeichen, nur Zahlen):")
    print(f"  '123456' (OK - 6 Zeichen): {validate_ask('123456')}")
    print(f"  '1234567' (OK - 7 Zeichen): {validate_ask('1234567')}")
    print(f"  '12345678' (OK - 8 Zeichen): {validate_ask('12345678')}")
    print(f"  '12345' (Fehler - zu kurz): {validate_ask('12345')}")
    print(f"  'ASK-4567' (Fehler - ungültig): {validate_ask('ASK-4567')}")

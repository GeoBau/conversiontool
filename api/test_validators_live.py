"""
Live-Tests für Validatoren mit echten URLs
Testet die Validierung für jeden Artikeltyp
"""

from validators import validate_generic, get_validation_url, validate_url_exists

def test_item():
    """Test für Item-Validierung"""
    print("=== Item-Test (Spalte D) ===")

    # Format-Test
    test_number = "0.0.479.76"
    print(f"\n1. Format-Test mit '{test_number}':")
    is_valid, message = validate_generic(test_number, 'D')
    print(f"   Ergebnis: {is_valid} - {message}")

    # URL-Test
    if is_valid:
        print(f"\n2. URL-Test:")
        validation_url = get_validation_url('D', test_number)
        print(f"   URL: {validation_url}")
        url_valid, url_message = validate_url_exists(validation_url, 'D', test_number)
        print(f"   Ergebnis: {url_valid} - {url_message}")

    print("\n" + "="*50)


def test_bosch():
    """Test für Bosch-Validierung"""
    print("\n=== Bosch-Test (Spalte E) ===")

    # Format-Test
    test_number = "0820055051"
    print(f"\n1. Format-Test mit '{test_number}':")
    is_valid, message = validate_generic(test_number, 'E')
    print(f"   Ergebnis: {is_valid} - {message}")

    # URL-Test
    if is_valid:
        print(f"\n2. URL-Test:")
        validation_url = get_validation_url('E', test_number)
        print(f"   URL: {validation_url}")
        url_valid, url_message = validate_url_exists(validation_url, 'E', test_number)
        print(f"   Ergebnis: {url_valid} - {url_message}")

    print("\n" + "="*50)


def test_alvaris():
    """Test für Alvaris-Validierung"""
    print("\n=== Alvaris-Test (Spalte F/G) ===")

    # Format-Test
    test_number = "1010072"
    print(f"\n1. Format-Test mit '{test_number}':")
    is_valid, message = validate_generic(test_number, 'F')
    print(f"   Ergebnis: {is_valid} - {message}")

    # URL-Test
    if is_valid:
        print(f"\n2. URL-Test:")
        validation_url = get_validation_url('F', test_number)
        print(f"   URL: {validation_url}")
        url_valid, url_message = validate_url_exists(validation_url, 'F', test_number)
        print(f"   Ergebnis: {url_valid} - {url_message}")

    print("\n" + "="*50)


def test_ask():
    """Test für ASK-Validierung"""
    print("\n=== ASK-Test (Spalte H) ===")

    # Format-Test
    test_number = "41800400"
    print(f"\n1. Format-Test mit '{test_number}':")
    is_valid, message = validate_generic(test_number, 'H')
    print(f"   Ergebnis: {is_valid} - {message}")

    # URL-Test mit Formular-Submit
    if is_valid:
        print(f"\n2. URL-Test (Formular-Submit):")
        validation_url = get_validation_url('H', test_number)
        print(f"   URL: {validation_url}")
        print(f"   Formular-Feld: fdSearchterm = '{test_number}'")
        print(f"   Prüfe auf: '1 Artikel gefunden'")
        url_valid, url_message = validate_url_exists(validation_url, 'H', test_number)
        print(f"   Ergebnis: {url_valid} - {url_message}")

    print("\n" + "="*50)


if __name__ == '__main__':
    print("=" * 70)
    print("LIVE-TESTS FÜR VALIDATOREN")
    print("=" * 70)

    # Item-Test
    test_item()

    # Bosch-Test
    test_bosch()

    # Alvaris-Test
    test_alvaris()

    # ASK-Test
    test_ask()

    print("\n" + "=" * 70)
    print("HINWEIS: URL-Tests können langsam sein und hängen von der")
    print("         Verfügbarkeit der externen Websites ab.")
    print("=" * 70)

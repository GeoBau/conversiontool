"""
Debug-Script für ASK-Validierung
Zeigt die Antwort der ASK-Website an
"""

import requests

def debug_ask_search(number: str):
    """Debuggt die ASK-Suche"""
    print(f"=== Debug ASK-Suche für Nummer: {number} ===\n")

    url = 'https://shop.askgmbh.com/auctores/scs/imc'
    form_data = {
        'fdMode': 'PLUGIN_EVENT',
        'fdInf_ID': '283b8aXf563a51e82XY7f01',
        'fdPluginName': 'org.auctores.askgmbh.shop.hp',
        'fdPluginEvent': 'searchArtikel()',
        'fdSearchterm': number
    }

    print(f"URL: {url}")
    print(f"Formular-Daten: {form_data}\n")

    try:
        # Session erstellen um Cookies zu erhalten
        session = requests.Session()

        print("Lade Startseite (für CSRF-Token und Cookies)...")
        initial_response = session.get(url, timeout=10)
        print(f"Initial Status: {initial_response.status_code}")

        # Zeige Cookies
        print(f"Cookies: {session.cookies.get_dict()}\n")

        print("Sende POST-Request mit Session...")
        response = session.post(url, data=form_data, timeout=10, allow_redirects=True)

        print(f"Status Code: {response.status_code}")
        print(f"Final URL: {response.url}")
        print(f"Content-Type: {response.headers.get('Content-Type', 'N/A')}\n")

        # Speichere die Antwort in eine Datei
        with open('ask_response.html', 'w', encoding='utf-8') as f:
            f.write(response.text)
        print("Antwort gespeichert in: ask_response.html\n")

        # Suche nach relevanten Texten
        content = response.text
        print("=== Suche nach relevanten Texten ===")

        search_terms = [
            "1 Artikel gefunden",
            "Artikel gefunden",
            "Treffer",
            "Ergebnis",
            "Keine Artikel",
            "nicht gefunden"
        ]

        for term in search_terms:
            if term in content:
                print(f"[OK] Gefunden: '{term}'")
                # Zeige Kontext
                index = content.find(term)
                start = max(0, index - 100)
                end = min(len(content), index + 100)
                context = content[start:end].replace('\n', ' ').replace('\r', ' ')
                print(f"  Kontext: ...{context}...\n")
            else:
                print(f"[ - ] Nicht gefunden: '{term}'")

        # Zeige ersten Teil der Antwort
        print(f"\n=== Erste 1000 Zeichen der Antwort ===")
        print(content[:1000])

    except Exception as e:
        print(f"Fehler: {e}")


if __name__ == '__main__':
    # Test mit der Nummer 41800400
    debug_ask_search("41800400")

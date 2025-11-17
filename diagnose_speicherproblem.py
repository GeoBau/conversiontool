"""
Diagnose-Script für Speicherprobleme
"""

import os
import sys

# Fix für Windows-Konsole
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# Füge das Projekt-Verzeichnis zum Python-Pfad hinzu
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def diagnose():
    print("=" * 60)
    print("DIAGNOSE: Speicherproblem bei Portfolio-CSV")
    print("=" * 60)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(base_dir, 'Portfolio_Syskomp_pA.csv')
    backup_dir = os.path.join(base_dir, 'backups')

    # 1. CSV-Datei prüfen
    print("\n1. CSV-Datei prüfen:")
    print(f"   Pfad: {csv_path}")

    if os.path.exists(csv_path):
        print("   ✓ Datei existiert")

        # Dateigröße
        size = os.path.getsize(csv_path)
        print(f"   ✓ Größe: {size:,} Bytes ({size/1024:.1f} KB)")

        # Leserechte
        if os.access(csv_path, os.R_OK):
            print("   ✓ Lesbar")
        else:
            print("   ✗ NICHT LESBAR - Berechtigungsproblem!")

        # Schreibrechte
        if os.access(csv_path, os.W_OK):
            print("   ✓ Beschreibbar")
        else:
            print("   ✗ NICHT BESCHREIBBAR - Berechtigungsproblem!")

        # Schreibgeschützt?
        import stat
        mode = os.stat(csv_path).st_mode
        if mode & stat.S_IWRITE:
            print("   ✓ Nicht schreibgeschützt")
        else:
            print("   ✗ SCHREIBGESCHÜTZT - Bitte Schreibschutz entfernen!")

    else:
        print("   ✗ DATEI NICHT GEFUNDEN!")
        return

    # 2. Backup-Verzeichnis prüfen
    print("\n2. Backup-Verzeichnis prüfen:")
    print(f"   Pfad: {backup_dir}")

    if os.path.exists(backup_dir):
        print("   ✓ Verzeichnis existiert")

        # Schreibrechte
        if os.access(backup_dir, os.W_OK):
            print("   ✓ Beschreibbar")
        else:
            print("   ✗ NICHT BESCHREIBBAR - Berechtigungsproblem!")

        # Anzahl Backups
        backups = [f for f in os.listdir(backup_dir) if f.startswith('Portfolio_Syskomp_pA_')]
        print(f"   ✓ {len(backups)} Backup(s) vorhanden")
    else:
        print("   ! Verzeichnis existiert nicht (wird bei Bedarf erstellt)")

        # Prüfe ob Elternverzeichnis beschreibbar ist
        if os.access(base_dir, os.W_OK):
            print("   ✓ Kann Backup-Verzeichnis erstellen")
        else:
            print("   ✗ KANN BACKUP-VERZEICHNIS NICHT ERSTELLEN - Berechtigungsproblem!")

    # 3. CSV-Manager Test
    print("\n3. CSV-Manager Test:")
    try:
        from api.file_lock import CSVManager

        manager = CSVManager(csv_path)
        print("   ✓ CSV-Manager erfolgreich initialisiert")

        # Testzeile finden
        print("   Testing: Zeile finden...")
        rows = manager.read_all()
        print(f"   ✓ CSV gelesen: {len(rows)} Zeilen")

        # Test: Lock acquire
        print("   Testing: File-Lock...")
        acquired = manager.lock.acquire(timeout=2)
        if acquired:
            print("   ✓ File-Lock erfolgreich erworben")
            manager.lock.release()
            print("   ✓ File-Lock freigegeben")
        else:
            print("   ✗ FILE-LOCK KONNTE NICHT ERWORBEN WERDEN!")
            print("   → Möglicherweise wird die Datei von einem anderen Prozess verwendet")

    except Exception as e:
        print(f"   ✗ FEHLER: {e}")
        import traceback
        traceback.print_exc()

    # 4. OneDrive-Check
    print("\n4. OneDrive-Prüfung:")
    if "OneDrive" in csv_path:
        print("   ! WARNUNG: Datei liegt in OneDrive-Ordner")
        print("   → OneDrive-Synchronisation kann zu Sperr-Problemen führen")
        print("   → Empfehlung: Datei in lokalen Ordner verschieben oder OneDrive pausieren")
    else:
        print("   ✓ Datei liegt nicht in OneDrive")

    # 5. Prozess-Check (ob Datei geöffnet ist)
    print("\n5. Prozess-Check:")
    print("   Prüfe ob Datei von einem Prozess geöffnet ist...")
    try:
        # Versuche exklusiven Zugriff
        with open(csv_path, 'r+') as f:
            print("   ✓ Datei ist nicht von einem anderen Programm gesperrt")
    except PermissionError:
        print("   ✗ DATEI IST GESPERRT - Von einem anderen Programm geöffnet!")
        print("   → Bitte Excel, Editor oder andere Programme schließen")
    except Exception as e:
        print(f"   ! Fehler beim Test: {e}")

    print("\n" + "=" * 60)
    print("DIAGNOSE ABGESCHLOSSEN")
    print("=" * 60)

if __name__ == '__main__':
    diagnose()

"""
CSV-Manager mit File-Locking, Backup und Undo-Funktionalität
"""

import csv
import os
import shutil
from threading import Lock
from datetime import datetime, timedelta
from collections import deque
from typing import Dict, List, Optional, Tuple
import time

class UndoManager:
    """Verwaltet Undo-Aktionen (letzte 3 Minuten)"""

    def __init__(self, retention_minutes: int = 3):
        self.history = deque(maxlen=100)  # Max 100 Aktionen
        self.retention_minutes = retention_minutes

    def add_action(self, action_type: str, data: Dict):
        """Fügt eine Aktion zur History hinzu"""
        self.history.append({
            'type': action_type,
            'data': data,
            'timestamp': datetime.now()
        })

    def get_undoable(self) -> List[Dict]:
        """Gibt alle rückgängig machbaren Aktionen zurück (letzte 3 Min)"""
        cutoff = datetime.now() - timedelta(minutes=self.retention_minutes)
        return [
            action for action in self.history
            if action['timestamp'] > cutoff
        ]

    def get_last_action(self) -> Optional[Dict]:
        """Gibt die letzte rückgängig machbare Aktion zurück"""
        undoable = self.get_undoable()
        return undoable[-1] if undoable else None

    def remove_last_action(self):
        """Entfernt die letzte Aktion aus der History"""
        if self.history:
            self.history.pop()


class BackupManager:
    """Verwaltet Backups (behält 1 Tag)"""

    def __init__(self, backup_dir: str, retention_days: int = 1):
        self.backup_dir = backup_dir
        self.retention_days = retention_days

        # Backup-Verzeichnis erstellen wenn nicht vorhanden
        os.makedirs(backup_dir, exist_ok=True)

    def create_backup(self, source_file: str) -> str:
        """Erstellt ein Backup der Datei"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"Portfolio_Syskomp_pA_{timestamp}.csv"
        backup_path = os.path.join(self.backup_dir, backup_name)

        shutil.copy(source_file, backup_path)
        print(f"Backup erstellt: {backup_path}")

        return backup_path

    def cleanup_old_backups(self):
        """Löscht Backups die älter als retention_days sind"""
        cutoff = datetime.now() - timedelta(days=self.retention_days)

        for filename in os.listdir(self.backup_dir):
            if not filename.startswith('Portfolio_Syskomp_pA_'):
                continue

            filepath = os.path.join(self.backup_dir, filename)
            file_time = datetime.fromtimestamp(os.path.getmtime(filepath))

            if file_time < cutoff:
                try:
                    os.remove(filepath)
                    print(f"Altes Backup gelöscht: {filename}")
                except Exception as e:
                    print(f"Fehler beim Löschen von {filename}: {e}")


class CSVManager:
    """Verwaltet CSV-Datei mit Thread-Safe Lock"""

    def __init__(self, csv_path: str, backup_dir: str = None):
        self.csv_path = csv_path
        self.lock = Lock()
        self.undo_manager = UndoManager(retention_minutes=3)

        # Backup-Manager initialisieren
        if backup_dir is None:
            backup_dir = os.path.join(os.path.dirname(csv_path), 'backups')
        self.backup_manager = BackupManager(backup_dir, retention_days=1)

    def read_all(self) -> List[List[str]]:
        """Liest alle Zeilen aus der CSV"""
        with open(self.csv_path, 'r', encoding='utf-8-sig', newline='') as f:
            reader = csv.reader(f, delimiter=';')
            return list(reader)

    def write_all(self, rows: List[List[str]]):
        """Schreibt alle Zeilen in die CSV"""
        with open(self.csv_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f, delimiter=';', quoting=csv.QUOTE_MINIMAL)
            writer.writerows(rows)

    def find_row_by_syskomp(self, syskomp_neu: str) -> Tuple[int, Optional[List[str]]]:
        """Findet eine Zeile anhand der Syskomp neu Nummer"""
        rows = self.read_all()

        for idx, row in enumerate(rows):
            if idx == 0:  # Skip Header
                continue
            if row[0] == syskomp_neu:  # Column A = Syskomp neu
                return idx, row

        return -1, None

    def update_cell(self, syskomp_neu: str, col_index: int, value: str) -> Tuple[bool, str]:
        """
        Aktualisiert eine Zelle in der CSV

        Args:
            syskomp_neu: Syskomp neu Nummer (zur Identifikation der Zeile)
            col_index: Spalten-Index (0=A, 1=B, ..., 7=H)
            value: Neuer Wert

        Returns:
            Tuple[bool, str]: (Erfolg, Nachricht)
        """
        acquired = self.lock.acquire(timeout=5)
        if not acquired:
            return False, "Datei momentan gesperrt. Bitte erneut versuchen."

        try:
            # Backup erstellen
            backup_path = self.backup_manager.create_backup(self.csv_path)

            # CSV lesen
            rows = self.read_all()

            # Zeile finden
            row_idx, old_row = self.find_row_by_syskomp(syskomp_neu)

            if row_idx == -1:
                return False, f"Syskomp-Nummer {syskomp_neu} nicht gefunden"

            # Alte Werte für Undo speichern
            old_value = old_row[col_index] if col_index < len(old_row) else ''

            # Neuen Wert setzen
            while len(rows[row_idx]) <= col_index:
                rows[row_idx].append('')
            rows[row_idx][col_index] = value

            # Zurück in CSV schreiben
            self.write_all(rows)

            # Undo-Aktion speichern
            self.undo_manager.add_action('update_cell', {
                'syskomp_neu': syskomp_neu,
                'col_index': col_index,
                'old_value': old_value,
                'new_value': value,
                'backup_path': backup_path
            })

            # Alte Backups aufräumen
            self.backup_manager.cleanup_old_backups()

            return True, "Erfolgreich gespeichert"

        except Exception as e:
            return False, f"Fehler: {str(e)}"

        finally:
            self.lock.release()

    def undo_last_action(self) -> Tuple[bool, str]:
        """Macht die letzte Aktion rückgängig (wenn < 3 Min alt)"""
        acquired = self.lock.acquire(timeout=5)
        if not acquired:
            return False, "Datei momentan gesperrt"

        try:
            last_action = self.undo_manager.get_last_action()

            if not last_action:
                return False, "Keine rückgängig machbare Aktion gefunden (nur letzte 3 Min)"

            if last_action['type'] == 'update_cell':
                data = last_action['data']

                # Alten Wert wiederherstellen
                rows = self.read_all()
                row_idx, _ = self.find_row_by_syskomp(data['syskomp_neu'])

                if row_idx == -1:
                    return False, "Zeile nicht mehr gefunden"

                rows[row_idx][data['col_index']] = data['old_value']
                self.write_all(rows)

                # Aktion aus History entfernen
                self.undo_manager.remove_last_action()

                return True, f"Änderung rückgängig gemacht (zurück zu: '{data['old_value']}')"

            return False, "Aktion kann nicht rückgängig gemacht werden"

        except Exception as e:
            return False, f"Fehler beim Undo: {str(e)}"

        finally:
            self.lock.release()


if __name__ == '__main__':
    # Test
    print("=== CSV Manager Test ===\n")

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    csv_path = os.path.join(base_dir, 'Portfolio_Syskomp_pA.csv')

    if not os.path.exists(csv_path):
        print(f"FEHLER: CSV nicht gefunden: {csv_path}")
        exit(1)

    manager = CSVManager(csv_path)

    # Test: Zeile finden
    print("Test 1: Zeile finden")
    row_idx, row = manager.find_row_by_syskomp('110000041')
    if row:
        print(f"  Gefunden in Zeile {row_idx}: {row[:3]}")
    else:
        print("  Nicht gefunden")

    # Test: Lesen
    print("\nTest 2: Alle Zeilen lesen")
    rows = manager.read_all()
    print(f"  Zeilen gesamt: {len(rows)}")
    print(f"  Header: {rows[0]}")

    print("\n[OK] Tests abgeschlossen")

from playwright.sync_api import sync_playwright
import csv
import time
import os
from urllib.parse import urlparse
from pathlib import Path
import tkinter as tk
from tkinter import ttk, filedialog, scrolledtext, messagebox
import threading
import re

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; Alvaris-Scraper/1.0)"
}

def extract_artnr_from_url(url):
    """Extract article number from Alvaris product URL
    Examples:
    /de/2022/05/03/1030020-stellfuss-8-60-m10x100/ -> 1030020
    /2022/05/03/1010442-rasterstellfuss-pa/ -> 1010442
    /de/2022/05/10/1010406-profil-5-20x20-1n/ -> 1010406
    """
    # Pattern: /[de/]YYYY/MM/DD/ARTNR-beschreibung/ (de/ is optional)
    # Extract the first number sequence after the date
    pattern = r'/(?:de/)?\d{4}/\d{2}/\d{2}/(\d+)'
    match = re.search(pattern, url)

    if match:
        return match.group(1)

    return None

class AlvarisScraperApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Alvaris Catalog Scraper")
        self.root.geometry("700x650")
        self.is_scraping = False

        # URL Input (Multiple catalogs)
        url_frame = ttk.LabelFrame(root, text="Katalog URLs", padding=10)
        url_frame.pack(fill="both", expand=True, padx=10, pady=5)

        # System selection
        system_select_frame = ttk.Frame(url_frame)
        system_select_frame.pack(fill="x", pady=(0, 5))

        ttk.Label(system_select_frame, text="System auswählen:", font=("", 9, "bold")).pack(side="left", padx=5)
        self.system_var = tk.StringVar(value="a")
        ttk.Radiobutton(system_select_frame, text="System A", variable=self.system_var, value="a", command=self.load_system_urls).pack(side="left", padx=5)
        ttk.Radiobutton(system_select_frame, text="System B", variable=self.system_var, value="b", command=self.load_system_urls).pack(side="left", padx=5)

        ttk.Label(url_frame, text="💡 Jede Zeile = ein Katalog | URLs können manuell bearbeitet werden",
                  font=("", 8), foreground="gray").pack(anchor="w", pady=(0, 5))

        self.url_text = scrolledtext.ScrolledText(url_frame, height=8, wrap="word")
        self.url_text.pack(fill="both", expand=True)

        # Define system URLs
        self.system_a_urls = """https://www.alvaris.com/de/uebersicht-system-a/
https://www.alvaris.com/de/komponenten-uebersicht-a/profileverbinder-a/
https://www.alvaris.com/de/komponenten-uebersicht-a/nutmutter-und-schrauben-a/
https://www.alvaris.com/de/komponenten-uebersicht-a/abdeckelemente-a/
https://www.alvaris.com/de/komponenten-uebersicht-a/flaechen-und-kabelbefestigungen-a/
https://www.alvaris.com/de/komponenten-uebersicht-a/bedienelemente-und-scharniere-a/
https://www.alvaris.com/de/komponenten-uebersicht-a/bodenelemente-a/
"""
        self.system_b_urls = """https://www.alvaris.com/de/uebersicht-system-b/
https://www.alvaris.com/de/komponenten-uebersicht-b/profilverbinder-b/
https://www.alvaris.com/de/komponenten-uebersicht-b/nutmutter-und-schrauben/
https://www.alvaris.com/de/komponenten-uebersicht-b/abdeckelemnete-b/
https://www.alvaris.com/de/komponenten-uebersicht-b/flaechen-und-kabelbefestigungen/
https://www.alvaris.com/de/komponenten-uebersicht-b/bedienelemente-und-scharniere/
"""

        # Load initial system (System A)
        self.url_text.insert("1.0", self.system_a_urls)

        # Output File Selection
        file_frame = ttk.LabelFrame(root, text="Ausgabedatei", padding=10)
        file_frame.pack(fill="x", padx=10, pady=5)

        file_inner = ttk.Frame(file_frame)
        file_inner.pack(fill="x")

        self.file_entry = ttk.Entry(file_inner, width=50)
        self.file_entry.pack(side="left", fill="x", expand=True)

        ttk.Button(file_inner, text="Durchsuchen...", command=self.browse_file).pack(side="left", padx=5)

        # Append/Replace option
        mode_frame = ttk.Frame(file_frame)
        mode_frame.pack(fill="x", pady=(5, 0))

        ttk.Label(mode_frame, text="Wenn Datei existiert:").pack(side="left", padx=5)
        self.file_mode_var = tk.StringVar(value="append")
        ttk.Radiobutton(mode_frame, text="Anhängen (Duplikate überspringen)", variable=self.file_mode_var, value="append").pack(side="left", padx=5)
        ttk.Radiobutton(mode_frame, text="Ersetzen (Datei überschreiben)", variable=self.file_mode_var, value="replace").pack(side="left", padx=5)

        # Settings
        settings_frame = ttk.LabelFrame(root, text="Einstellungen", padding=10)
        settings_frame.pack(fill="x", padx=10, pady=5)

        settings_inner = ttk.Frame(settings_frame)
        settings_inner.pack(fill="x")

        ttk.Label(settings_inner, text="Pause zw. Katalogen (Sek):").pack(side="left")
        self.catalog_pause_entry = ttk.Entry(settings_inner, width=5)
        self.catalog_pause_entry.insert(0, "3")
        self.catalog_pause_entry.pack(side="left", padx=5)

        # Debug mode (default: ON for visibility during 60s wait)
        self.debug_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(settings_inner, text="Browser anzeigen", variable=self.debug_var).pack(side="left", padx=(20, 5))

        # Control Buttons
        button_frame = ttk.Frame(root, padding=10)
        button_frame.pack(fill="x", padx=10)

        self.start_btn = ttk.Button(button_frame, text="▶ Scraping starten", command=self.start_scraping)
        self.start_btn.pack(side="left", padx=5)

        self.stop_btn = ttk.Button(button_frame, text="⏹ Stoppen", command=self.stop_scraping, state="disabled")
        self.stop_btn.pack(side="left", padx=5)

        # Status Display
        status_frame = ttk.Frame(button_frame)
        status_frame.pack(side="left", padx=20, fill="x", expand=True)

        self.status_label = ttk.Label(status_frame, text="Bereit", font=("", 10, "bold"), foreground="blue")
        self.status_label.pack(anchor="w")

        self.last_article_label = ttk.Label(status_frame, text="", font=("", 9), foreground="gray")
        self.last_article_label.pack(anchor="w")

        # Progress Bar
        self.progress = ttk.Progressbar(root, mode="indeterminate")
        self.progress.pack(fill="x", padx=10, pady=5)

        # Log/Status Display
        log_frame = ttk.LabelFrame(root, text="Status Log", padding=10)
        log_frame.pack(fill="both", expand=True, padx=10, pady=5)

        self.log_text = scrolledtext.ScrolledText(log_frame, height=15, wrap="word", state="normal")
        self.log_text.pack(fill="both", expand=True)

        # Make read-only but allow selection/copy
        def on_key(event):
            if event.state & 0x4:  # Control key
                return
            if event.keysym in ('Left', 'Right', 'Up', 'Down', 'Home', 'End', 'Prior', 'Next'):
                return
            return "break"

        self.log_text.bind("<Key>", on_key)

    def browse_file(self):
        # Use asksaveasfilename but with confirmoverwrite=False to allow appending
        filepath = filedialog.asksaveasfilename(
            title="CSV-Datei auswählen (neue oder existierende)",
            defaultextension=".csv",
            filetypes=[("CSV Dateien", "*.csv"), ("Alle Dateien", "*.*")],
            confirmoverwrite=False  # Don't warn about overwriting - we'll append instead
        )
        if filepath:
            self.file_entry.delete(0, tk.END)
            self.file_entry.insert(0, filepath)

    def load_system_urls(self):
        """Load URLs for selected system (A or B)"""
        system = self.system_var.get()

        # Clear current URLs
        self.url_text.delete("1.0", tk.END)

        # Load selected system URLs
        if system == "a":
            self.url_text.insert("1.0", self.system_a_urls)
        elif system == "b":
            self.url_text.insert("1.0", self.system_b_urls)

    def log(self, message):
        self.log_text.insert(tk.END, message + "\n")
        self.log_text.see(tk.END)

    def update_status(self, catalog_num, total_catalogs, last_article=""):
        """Update status display"""
        self.status_label.config(text=f"Katalog: {catalog_num}/{total_catalogs}")
        if last_article:
            self.last_article_label.config(text=f"Letzter Artikel: {last_article}")

    def start_scraping(self):
        urls_text = self.url_text.get("1.0", tk.END).strip()
        filepath = self.file_entry.get().strip()

        if not urls_text:
            messagebox.showerror("Fehler", "Bitte geben Sie mindestens eine URL ein.")
            return

        if not filepath:
            messagebox.showerror("Fehler", "Bitte wählen Sie eine Ausgabedatei.")
            return

        # Parse URLs (one per line)
        urls = [line.strip() for line in urls_text.split("\n") if line.strip()]

        if len(urls) == 0:
            messagebox.showerror("Fehler", "Keine gültigen URLs gefunden.")
            return

        # Start scraping in thread
        self.is_scraping = True
        self.start_btn.config(state="disabled")
        self.stop_btn.config(state="normal")
        self.progress.start()
        self.log_text.delete(1.0, tk.END)

        thread = threading.Thread(target=self.run_scraping, args=(urls, filepath))
        thread.daemon = True
        thread.start()

    def stop_scraping(self):
        self.is_scraping = False
        self.log("⏹ Abbruch angefordert...")

    def run_scraping(self, urls, filepath):
        try:
            self.log(f"🔍 Starte Scraping für {len(urls)} Katalog(e)")

            # Create parent directory if it doesn't exist
            parent_dir = os.path.dirname(filepath)
            if parent_dir and not os.path.exists(parent_dir):
                Path(parent_dir).mkdir(parents=True, exist_ok=True)
                self.log(f"📁 Verzeichnis erstellt: {parent_dir}")

            # Create image folder
            csv_name = os.path.splitext(os.path.basename(filepath))[0]
            img_dir = os.path.join(parent_dir, f"{csv_name}-images")
            Path(img_dir).mkdir(parents=True, exist_ok=True)
            self.log(f"📁 Bild-Verzeichnis: {img_dir}")

            all_products = self.scrape_with_playwright(urls, img_dir)

            if not self.is_scraping:
                self.log("❌ Scraping abgebrochen.")
                self.finish_scraping()
                return

            # Check if file exists and user's preference
            file_exists = os.path.exists(filepath)
            file_mode = self.file_mode_var.get()

            if file_exists and file_mode == "append":
                # APPEND MODE: Load existing products to avoid duplicates
                existing_products = []
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        reader = csv.reader(f)
                        next(reader)  # Skip header
                        existing_products = list(reader)
                    self.log(f"📂 Existierende Datei gefunden mit {len(existing_products)} Produkten")
                except Exception as e:
                    self.log(f"⚠️ Fehler beim Laden existierender Daten: {e}")

                # Filter out duplicates (based on article number)
                existing_artnrs = {row[0] for row in existing_products if len(row) > 0}
                new_products = [p for p in all_products if p[0] not in existing_artnrs]

                if new_products:
                    # Append new products
                    with open(filepath, "a", newline="", encoding="utf-8") as f:
                        writer = csv.writer(f)
                        writer.writerows(new_products)

                    self.log(f"\n✅ Fertig! {len(new_products)} neue Produkte hinzugefügt zu '{filepath}'.")
                    self.log(f"   ({len(all_products) - len(new_products)} Duplikate übersprungen)")
                else:
                    self.log(f"\n✓ Keine neuen Produkte (alle {len(all_products)} bereits vorhanden).")
            else:
                # CREATE NEW FILE or REPLACE MODE
                if file_exists:
                    self.log(f"📂 Existierende Datei wird ersetzt")

                with open(filepath, "w", newline="", encoding="utf-8") as f:
                    writer = csv.writer(f)
                    writer.writerow(["Artikelnummer", "Beschreibung", "Bild", "URL"])
                    writer.writerows(all_products)

                self.log(f"\n✅ Fertig! {len(all_products)} Produkte gespeichert in '{filepath}'.")

            self.log(f"🖼️ Bilder liegen in: '{img_dir}'")
            messagebox.showinfo("Erfolg", f"Scraping erfolgreich abgeschlossen!")

        except Exception as e:
            self.log(f"❌ Fehler: {e}")
            messagebox.showerror("Fehler", f"Scraping fehlgeschlagen: {e}")

        finally:
            self.finish_scraping()

    def scrape_with_playwright(self, urls, img_dir):
        """Scrape multiple Alvaris catalogs using Playwright"""
        all_products = []
        debug_mode = self.debug_var.get()

        try:
            catalog_pause = float(self.catalog_pause_entry.get())
        except:
            catalog_pause = 3.0

        with sync_playwright() as p:
            self.log("🌐 Starte Browser...")
            browser = p.chromium.launch(headless=not debug_mode)
            page = browser.new_page()
            page.set_extra_http_headers(HEADERS)

            # Load first URL to make page visible for manual interactions
            first_page_loaded = False
            if urls:
                self.log(f"📄 Lade erste Seite: {urls[0]}")
                try:
                    page.goto(urls[0], wait_until="networkidle", timeout=60000)
                    first_page_loaded = True
                except Exception as e:
                    self.log(f"❌ Fehler beim Laden der ersten Seite: {e}")
                    self.log("⚠️ Überprüfen Sie die URL und Internetverbindung")
                    browser.close()
                    return []

                # Wait 1 minute on first start for manual interactions (cookies, captcha, etc)
                self.log("⏳ Warte 60 Sekunden für manuelle Abfragen (Cookies, Captcha, etc.)...")
                self.log("   💡 Akzeptieren Sie Cookie-Banner, lösen Sie Captchas, etc.")
                for remaining in range(60, 0, -5):
                    if not self.is_scraping:
                        break
                    self.log(f"   Noch {remaining} Sekunden...")
                    time.sleep(5)
                self.log("✓ Wartezeit beendet, starte Scraping...")

            for idx, catalog_url in enumerate(urls):
                if not self.is_scraping:
                    break

                catalog_num = idx + 1
                total_catalogs = len(urls)

                self.log(f"\n📄 Katalog {catalog_num}/{total_catalogs}: {catalog_url}")
                self.update_status(catalog_num, total_catalogs)

                try:
                    # Load catalog page (skip first if already loaded)
                    if idx == 0 and first_page_loaded:
                        self.log("   (Seite bereits geladen)")
                    else:
                        page.goto(catalog_url, wait_until="networkidle", timeout=60000)

                    # Wait for products
                    try:
                        page.wait_for_selector("a.uk-display-block.uk-panel.uk-link-toggle", timeout=30000)
                    except Exception as e:
                        self.log(f"⚠️ Keine Produkte gefunden: {e}")
                        continue

                    # Wait for images to load
                    time.sleep(3)

                    # Get all product links
                    product_links = page.query_selector_all("a.uk-display-block.uk-panel.uk-link-toggle")
                    self.log(f"📦 {len(product_links)} Produkte gefunden")

                    # Process each product
                    for prod_idx, product_elem in enumerate(product_links):
                        if not self.is_scraping:
                            break

                        try:
                            # Extract article number from href
                            href = product_elem.get_attribute("href") or ""
                            artikelnummer = extract_artnr_from_url(href)

                            if not artikelnummer:
                                self.log(f"  ⚠️ Keine Artikelnummer in URL: {href}")
                                continue

                            # Make absolute URL if relative
                            product_url = href
                            if href and not href.startswith("http"):
                                product_url = f"https://www.alvaris.com{href}"

                            # Extract description from h3
                            title_elem = product_elem.query_selector("h3.el-title")
                            beschreibung = title_elem.inner_text().strip() if title_elem else ""

                            # Screenshot the entire product container (includes image + text)
                            img_filename = ""

                            if artikelnummer:
                                img_filename = f"{artikelnummer}.png"
                                img_path = os.path.join(img_dir, img_filename)

                                try:
                                    # Screenshot the entire product element
                                    # This captures the full product card with image and description
                                    product_elem.screenshot(path=img_path)

                                    self.log(f"  📷 {artikelnummer} - {beschreibung}")

                                except Exception as e:
                                    self.log(f"  ⚠️ Screenshot-Fehler für {artikelnummer}: {e}")
                                    img_filename = ""

                            if artikelnummer:
                                all_products.append([artikelnummer, beschreibung, img_filename, product_url])
                                self.update_status(catalog_num, total_catalogs, f"{artikelnummer} - {beschreibung}")

                        except Exception as e:
                            self.log(f"  ⚠️ Fehler bei Produkt {prod_idx+1}: {e}")

                    # Pause before next catalog
                    if self.is_scraping and catalog_num < total_catalogs:
                        self.log(f"⏸️ Pause {catalog_pause} Sekunden...")
                        time.sleep(catalog_pause)

                except Exception as e:
                    self.log(f"⚠️ Fehler beim Laden des Katalogs: {e}")

            browser.close()
            self.log("🌐 Browser geschlossen.")

        return all_products

    def finish_scraping(self):
        self.is_scraping = False
        self.progress.stop()
        self.start_btn.config(state="normal")
        self.stop_btn.config(state="disabled")

if __name__ == "__main__":
    root = tk.Tk()
    app = AlvarisScraperApp(root)
    root.mainloop()

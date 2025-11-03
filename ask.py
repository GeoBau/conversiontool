from playwright.sync_api import sync_playwright
import csv
import time
import os
from urllib.parse import urlparse, parse_qs
from pathlib import Path
import tkinter as tk
from tkinter import ttk, filedialog, scrolledtext, messagebox
import threading
import re

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; ASK-Scraper/1.3; +https://github.com/ask-scraper)"
}

def extract_page_from_url(url):
    """Extract fdRsPage value from URL"""
    match = re.search(r'fdRsPage=(\d+)', url)
    if match:
        return int(match.group(1))
    return None

class ScraperApp:
    def __init__(self, root):
        self.root = root
        self.root.title("ASK Product Scraper (Playwright)")
        self.root.geometry("700x600")
        self.is_scraping = False
        self.skip_pause = False

        # URL Input
        url_frame = ttk.LabelFrame(root, text="Kategorie URL (beliebige Seite möglich)", padding=10)
        url_frame.pack(fill="x", padx=10, pady=5)

        self.url_entry = ttk.Entry(url_frame, width=60)
        self.url_entry.pack(fill="x")
        self.url_entry.bind("<KeyRelease>", self.on_url_change)

        url_info_frame = ttk.Frame(url_frame)
        url_info_frame.pack(fill="x", pady=(5, 0))

        ttk.Label(url_info_frame, text="💡 Bei Fortsetzung: URL von Seite X direkt eingeben", font=("", 8), foreground="gray").pack(side="left")

        self.url_page_label = ttk.Label(url_info_frame, text="", font=("", 9, "bold"), foreground="blue")
        self.url_page_label.pack(side="right", padx=10)

        # Output File Selection
        file_frame = ttk.LabelFrame(root, text="Ausgabedatei", padding=10)
        file_frame.pack(fill="x", padx=10, pady=5)

        file_inner = ttk.Frame(file_frame)
        file_inner.pack(fill="x")

        self.file_entry = ttk.Entry(file_inner, width=50)
        self.file_entry.pack(side="left", fill="x", expand=True)

        ttk.Button(file_inner, text="Durchsuchen...", command=self.browse_file).pack(side="left", padx=5)

        # Max Pages and Timing Settings
        pages_frame = ttk.LabelFrame(root, text="Einstellungen", padding=10)
        pages_frame.pack(fill="x", padx=10, pady=5)

        pages_inner = ttk.Frame(pages_frame)
        pages_inner.pack(fill="x")

        ttk.Label(pages_inner, text="Startseite (für CSV-Append):").pack(side="left")
        self.start_page_entry = ttk.Entry(pages_inner, width=5)
        self.start_page_entry.insert(0, "1")
        self.start_page_entry.pack(side="left", padx=5)

        ttk.Label(pages_inner, text="Anzahl Seiten (leer = alle):").pack(side="left", padx=(10, 5))
        self.pages_entry = ttk.Entry(pages_inner, width=5)
        self.pages_entry.pack(side="left", padx=5)

        ttk.Label(pages_inner, text="Pause zw. Seiten (Sek):").pack(side="left", padx=(20, 5))
        self.page_pause_entry = ttk.Entry(pages_inner, width=5)
        self.page_pause_entry.insert(0, "120")  # Default 120 seconds (2 minutes)
        self.page_pause_entry.pack(side="left", padx=5)

        # Debug mode
        self.debug_var = tk.BooleanVar()
        ttk.Checkbutton(pages_inner, text="Debug", variable=self.debug_var).pack(side="left", padx=(20, 5))

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

        self.log_text = scrolledtext.ScrolledText(log_frame, height=23, wrap="word", state="normal")
        self.log_text.pack(fill="both", expand=True)

        # Make read-only but allow selection/copy
        def on_key(event):
            # Allow Ctrl+C, Ctrl+A, arrow keys, etc. but block text input
            if event.state & 0x4:  # Control key pressed
                return  # Allow Ctrl+C, Ctrl+A, etc.
            if event.keysym in ('Left', 'Right', 'Up', 'Down', 'Home', 'End', 'Prior', 'Next'):
                return  # Allow navigation
            return "break"  # Block everything else

        self.log_text.bind("<Key>", on_key)

    def browse_file(self):
        filepath = filedialog.asksaveasfilename(
            title="CSV-Datei speichern unter",
            defaultextension=".csv",
            filetypes=[("CSV Dateien", "*.csv"), ("Alle Dateien", "*.*")]
        )
        if filepath:
            self.file_entry.delete(0, tk.END)
            self.file_entry.insert(0, filepath)

    def log(self, message):
        self.log_text.insert(tk.END, message + "\n")
        self.log_text.see(tk.END)

    def update_status(self, page_num, last_article=""):
        """Update status display with current page and last article"""
        self.status_label.config(text=f"Seite: {page_num}")
        if last_article:
            self.last_article_label.config(text=f"Letzter Artikel: {last_article}")

    def on_url_change(self, event=None):
        """Called when URL field changes - extract and display page number"""
        url = self.url_entry.get().strip()
        if url:
            page_num = extract_page_from_url(url)
            if page_num is not None:
                self.url_page_label.config(text=f"📄 URL-Seite: {page_num}")
                # Auto-fill start page if empty or default
                current_start = self.start_page_entry.get().strip()
                if not current_start or current_start == "1":
                    self.start_page_entry.delete(0, tk.END)
                    self.start_page_entry.insert(0, str(page_num))
            else:
                self.url_page_label.config(text="")
        else:
            self.url_page_label.config(text="")

    def start_scraping(self):
        url = self.url_entry.get().strip()
        filepath = self.file_entry.get().strip()

        if not url:
            messagebox.showerror("Fehler", "Bitte geben Sie eine URL ein.")
            return

        if not filepath:
            messagebox.showerror("Fehler", "Bitte wählen Sie eine Ausgabedatei.")
            return

        start_page = 1
        start_page_str = self.start_page_entry.get().strip()
        if start_page_str:
            try:
                start_page = int(start_page_str)
                if start_page < 1:
                    start_page = 1
            except ValueError:
                messagebox.showerror("Fehler", "Ungültige Startseite.")
                return

        max_pages = None
        pages_str = self.pages_entry.get().strip()
        if pages_str:
            try:
                max_pages = int(pages_str)
            except ValueError:
                messagebox.showerror("Fehler", "Ungültige Seitenanzahl.")
                return

        # Start scraping in thread
        self.is_scraping = True
        self.start_btn.config(state="disabled")
        self.stop_btn.config(state="normal")
        self.progress.start()
        self.log_text.delete(1.0, tk.END)

        thread = threading.Thread(target=self.run_scraping, args=(url, filepath, max_pages, start_page))
        thread.daemon = True
        thread.start()

    def stop_scraping(self):
        self.is_scraping = False
        self.log("⏹ Abbruch angefordert...")

    def run_scraping(self, url, filepath, max_pages, start_page=1):
        try:
            base_url = f"{urlparse(url).scheme}://{urlparse(url).netloc}"

            # Check if URL contains page number
            url_page = extract_page_from_url(url)
            if url_page is not None:
                self.log(f"🔍 Starte Scraping für URL (erkannte Seite: {url_page})")
            else:
                self.log(f"🔍 Starte Scraping für: {url}")

            if start_page > 1:
                self.log(f"▶️ Startseite: {start_page}")
            if max_pages:
                end_page = start_page + max_pages - 1
                self.log(f"📄 Scrape {max_pages} Seiten (Seite {start_page} bis {end_page})")

            # Create image folder: /path/to/<csvname>-images
            parent_dir = os.path.dirname(filepath)
            csv_name = os.path.splitext(os.path.basename(filepath))[0]  # Remove .csv extension

            # Image directory: <csvname>-images
            img_dir = os.path.join(parent_dir, f"{csv_name}-images")
            Path(img_dir).mkdir(parents=True, exist_ok=True)

            # CSV stays at original path
            # filepath remains unchanged

            total_products = self.scrape_with_playwright(url, base_url, img_dir, filepath, max_pages, start_page)

            if not self.is_scraping:
                self.log("❌ Scraping abgebrochen.")
                self.finish_scraping()
                return

            self.log(f"\n✅ Fertig! {total_products} Produkte gespeichert in '{filepath}'.")
            self.log(f"🖼️ Bilder liegen in: '{img_dir}'")
            messagebox.showinfo("Erfolg", f"{total_products} Produkte erfolgreich gespeichert!")

        except Exception as e:
            self.log(f"❌ Fehler: {e}")
            messagebox.showerror("Fehler", f"Scraping fehlgeschlagen: {e}")

        finally:
            self.finish_scraping()

    def scrape_with_playwright(self, url, base_url, img_dir, csv_filepath, max_pages=None, start_page=1):
        """Scrape using Playwright browser automation"""
        total_product_count = 0

        # Initialize CSV file - create new or append
        file_exists = os.path.exists(csv_filepath)
        csv_mode = "a" if start_page > 1 and file_exists else "w"

        # Write header if creating new file
        if csv_mode == "w":
            with open(csv_filepath, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow(["Artikelnummer", "Beschreibung", "Bild", "URL"])
            self.log(f"📄 CSV-Datei erstellt: {csv_filepath}")
        else:
            self.log(f"📄 CSV-Datei wird erweitert: {csv_filepath}")

        # Get pause settings
        try:
            page_pause_sec = int(self.page_pause_entry.get())
        except:
            page_pause_sec = 120

        debug_mode = self.debug_var.get()

        with sync_playwright() as p:
            self.log("🌐 Starte Browser...")
            browser = p.chromium.launch(headless=not debug_mode)
            page = browser.new_page()
            page.set_extra_http_headers(HEADERS)

            # Load start page directly
            if start_page > 1:
                self.log(f"📄 Lade Startseite {start_page} direkt: {url}")
                self.log(f"💡 Tipp: Geben Sie die URL von Seite {start_page} ein, falls noch nicht geschehen")
            else:
                self.log(f"📄 Lade erste Seite: {url}")

            page.goto(url, wait_until="networkidle", timeout=60000)

            try:
                page.wait_for_selector(".artikel-element-inner", timeout=60000)
            except Exception as e:
                self.log(f"⚠️ Timeout beim Warten auf Produkte auf Startseite: {e}")
                if debug_mode:
                    screenshot_path = f"debug_start_page.png"
                    page.screenshot(path=screenshot_path)
                    self.log(f"📸 Debug-Screenshot: {screenshot_path}")
                browser.close()
                return []

            # Wait 30 seconds on first page for manual actions (cookie banner, etc.)
            self.log("⏸️ Warte 30 Sekunden... (Zeit für manuelle Aktionen wie Cookie-Banner schließen)")
            for remaining in range(30, 0, -1):
                if not self.is_scraping:
                    browser.close()
                    return []
                self.log(f"⏳ Noch {remaining} Sekunden...")
                time.sleep(1)
            self.log("▶️ Starte jetzt mit dem Scraping...")

            current_page = start_page
            end_page = (start_page + max_pages - 1) if max_pages else None
            last_page_first_article = None  # Track first article of each page

            while self.is_scraping:
                if end_page and current_page > end_page:
                    break

                try:
                    self.log(f"📄 Scanne Seite {current_page}...")
                    self.update_status(current_page)

                    # Make sure we're on the right page
                    try:
                        page.wait_for_selector(".artikel-element-inner", timeout=60000)
                    except Exception as e:
                        self.log(f"⚠️ Timeout beim Warten auf Produkte: {e}")
                        if debug_mode:
                            screenshot_path = f"debug_timeout_page_{current_page}.png"
                            page.screenshot(path=screenshot_path)
                            self.log(f"📸 Debug-Screenshot: {screenshot_path}")
                        break

                    self.log(f"⏳ Warte bis Bilder geladen sind...")
                    # Wait a bit for images to load
                    time.sleep(3)

                    # Get all product elements
                    products = page.query_selector_all(".artikel-element-inner")
                    self.log(f"📦 {len(products)} Produkte gefunden auf Seite {current_page}")

                    if len(products) == 0:
                        self.log(f"⚠️ Keine Produkte gefunden, beende Scraping")
                        break

                    # Check if we're stuck on the same page by comparing first article
                    current_page_first_article = None
                    if len(products) > 0:
                        first_elem = products[0]
                        artnr_elem = first_elem.query_selector(".artikel-element-artikelnummer")
                        if artnr_elem:
                            art_text = artnr_elem.inner_text().strip()
                            current_page_first_article = art_text.replace("Art. Nr.", "").replace("Art.Nr.", "").strip()

                    if current_page > start_page and current_page_first_article and current_page_first_article == last_page_first_article:
                        self.log(f"⚠️ WARNUNG: Seite hat sich nicht geändert! Erster Artikel ist immer noch: {current_page_first_article}")
                        self.log(f"⛔ Beende Scraping, da keine Fortschritt mehr möglich.")
                        break

                    last_page_first_article = current_page_first_article

                    # Remove any hover states before taking screenshots
                    page.evaluate("document.activeElement.blur()")
                    page.locator("body").click(position={"x": 10, "y": 10})
                    time.sleep(0.3)

                    # Process each product on this page
                    page_products = []  # Products from current page
                    last_artikel = ""
                    for idx, product_elem in enumerate(products):
                        if not self.is_scraping:
                            break

                        try:
                            # Extract article number
                            artnr_elem = product_elem.query_selector(".artikel-element-artikelnummer")
                            artikelnummer = ""
                            if artnr_elem:
                                art_text = artnr_elem.inner_text().strip()
                                artikelnummer = art_text.replace("Art. Nr.", "").replace("Art.Nr.", "").strip()

                            # Extract description
                            title_elem = product_elem.query_selector(".artikel-element-titel")
                            beschreibung = title_elem.inner_text().strip() if title_elem else ""

                            # Extract product URL
                            url = ""
                            link_elem = product_elem.query_selector("a.artikel-element-artikelname")
                            if link_elem:
                                url = link_elem.get_attribute("href") or ""

                            # Screenshot the product image
                            img_filename = ""
                            img_elem = product_elem.query_selector(".artikel-element-image img")

                            if img_elem and artikelnummer:
                                # Generate safe filename
                                safe_artnr = artikelnummer.replace(" ", "_").replace("/", "_").replace("\\", "_")
                                img_filename = f"{safe_artnr}.png"
                                img_path = os.path.join(img_dir, img_filename)

                                # Take screenshot of the image element
                                try:
                                    img_elem.screenshot(path=img_path)
                                    self.log(f"  📷 Screenshot: {img_filename}")
                                except Exception as e:
                                    self.log(f"  ⚠️ Screenshot-Fehler für {artikelnummer}: {e}")
                                    img_filename = ""

                            if artikelnummer:
                                page_products.append([artikelnummer, beschreibung, img_filename, url])
                                self.log(f"  ✓ {artikelnummer} - {beschreibung}")
                                last_artikel = f"{artikelnummer} - {beschreibung}"
                                self.update_status(current_page, last_artikel)

                        except Exception as e:
                            self.log(f"⚠️ Fehler bei Produkt {idx+1}: {e}")

                    # Write page products immediately to CSV
                    if page_products:
                        with open(csv_filepath, 'a', newline='', encoding='utf-8') as f:
                            writer = csv.writer(f)
                            writer.writerows(page_products)
                        total_product_count += len(page_products)
                        self.log(f"💾 {len(page_products)} Produkte von Seite {current_page} gespeichert (Gesamt: {total_product_count})")

                    # Check for next page
                    if self.is_scraping and (end_page is None or current_page < end_page):
                        # Debug: List all possible pagination elements
                        if debug_mode:
                            self.log("🔍 Debug: Suche Pagination-Elemente...")
                            all_links = page.query_selector_all("a")
                            for link in all_links:
                                text = link.inner_text().strip()
                                href = link.get_attribute("href") or ""
                                classes = link.get_attribute("class") or ""
                                if "next" in text.lower() or "weiter" in text.lower() or ">" in text or "»" in text or "›" in text or "pagination" in classes:
                                    self.log(f"  🔗 Link: '{text}' | class='{classes}' | href='{href[:50]}'")

                            all_buttons = page.query_selector_all("button")
                            for btn in all_buttons:
                                text = btn.inner_text().strip()
                                classes = btn.get_attribute("class") or ""
                                if "next" in text.lower() or "weiter" in text.lower() or ">" in text or "»" in text or "›" in text or "pagination" in classes:
                                    self.log(f"  🔘 Button: '{text}' | class='{classes}'")

                        # Try to find "next" button by text content (single », not »»)
                        all_next_candidates = page.query_selector_all("a:has-text('»'), button:has-text('»')")
                        next_button = None
                        for idx, candidate in enumerate(all_next_candidates):
                            text = candidate.inner_text().strip()
                            href = candidate.get_attribute("href") or "N/A"
                            classes = candidate.get_attribute("class") or "N/A"

                            if debug_mode:
                                self.log(f"  🔍 Kandidat {idx+1}: Text='{text}' | href='{href}' | class='{classes}'")

                            if text == '»' or (len(text) < 5 and '»' in text and '»»' not in text):
                                next_button = candidate
                                if debug_mode:
                                    self.log(f"  ✓ Weiter-Button gewählt: '{text}' | href='{href}'")
                                break

                        # Fallback to other selectors
                        if not next_button:
                            next_button = page.query_selector(".pagination-next a, a[rel='next'], .next-page a, button.next, .pager-next, a:has-text('›'), a:has-text('>')")
                            if next_button and debug_mode:
                                self.log(f"  ✓ Weiter-Button (Fallback) gefunden")

                        if next_button:
                            # Long pause before next page
                            mins = page_pause_sec // 60
                            secs = page_pause_sec % 60
                            if mins > 0:
                                self.log(f"⏸️ Warte {mins} Min {secs} Sek vor nächster Seite...")
                            else:
                                self.log(f"⏸️ Warte {secs} Sekunden vor nächster Seite...")
                            pause_seconds = page_pause_sec

                            # Countdown in 10-second intervals
                            for remaining in range(pause_seconds, 0, -10):
                                if not self.is_scraping:
                                    break

                                mins = remaining // 60
                                secs = remaining % 60
                                self.log(f"   ⏳ Noch {mins}:{secs:02d} ...")
                                time.sleep(min(10, remaining))

                            if self.is_scraping:
                                self.log(f"➡️ Klicke auf Weiter-Button...")
                                old_url = page.url
                                self.log(f"   📍 Aktuelle URL: {old_url}")
                                try:
                                    # Remove focus from articles to prevent "Details anzeigen" overlay
                                    page.evaluate("document.activeElement.blur()")
                                    # Click on body to remove any hover states
                                    page.locator("body").click(position={"x": 10, "y": 10})
                                    time.sleep(0.3)

                                    # Scroll into view and focus on button
                                    next_button.scroll_into_view_if_needed()
                                    next_button.focus()
                                    next_button.hover()
                                    time.sleep(0.5)  # Brief pause after hover
                                    next_button.click(force=True, timeout=10000)  # Force click to bypass overlays
                                except Exception as e:
                                    self.log(f"   ⚠️ Click-Fehler: {e}, versuche erneut...")
                                    # Remove focus and try again
                                    page.evaluate("document.activeElement.blur()")
                                    next_button.scroll_into_view_if_needed()
                                    next_button.focus()
                                    next_button.click(force=True)

                                # Wait for page to load
                                try:
                                    page.wait_for_load_state("networkidle", timeout=60000)
                                except Exception as e:
                                    self.log(f"   ⚠️ Networkidle Timeout: {e}")

                                new_url = page.url
                                self.log(f"   📍 Neue URL: {new_url}")

                                if old_url == new_url:
                                    self.log(f"   ⚠️ WARNUNG: URL hat sich nicht geändert!")

                                # Wait for products to appear
                                try:
                                    page.wait_for_selector(".artikel-element-inner", timeout=60000)
                                    self.log(f"   ✓ Produkte gefunden auf neuer Seite")
                                except Exception as e:
                                    self.log(f"   ⚠️ FEHLER: Keine Produkte gefunden - {e}")
                                    if debug_mode:
                                        # Save screenshot for debugging
                                        screenshot_path = f"debug_page_{current_page+1}.png"
                                        page.screenshot(path=screenshot_path)
                                        self.log(f"   📸 Debug-Screenshot gespeichert: {screenshot_path}")
                                    self.log(f"   ⏭️ Überspringe diese Seite und fahre fort...")
                                    # Don't break, just continue

                                current_page += 1
                            else:
                                break
                        else:
                            self.log("📄 Keine weitere Seite gefunden.")
                            break
                    else:
                        break

                except Exception as e:
                    self.log(f"⚠️ Fehler beim Laden der Seite: {e}")
                    break

            browser.close()
            self.log("🌐 Browser geschlossen.")

        return total_product_count

    def finish_scraping(self):
        self.is_scraping = False
        self.progress.stop()
        self.start_btn.config(state="normal")
        self.stop_btn.config(state="disabled")
        # Keep status visible after scraping finishes

if __name__ == "__main__":
    root = tk.Tk()
    app = ScraperApp(root)
    root.mainloop()

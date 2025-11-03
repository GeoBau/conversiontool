import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import csv
import os
import re
import webbrowser
from pathlib import Path
from difflib import SequenceMatcher
from PIL import Image, ImageTk

class ProductMapper:
    def __init__(self, root):
        self.root = root
        self.root.title("ASK ↔ Syskomp Product Mapper")
        self.root.geometry("1200x800")

        # Data storage
        self.ask_products = []
        self.filtered_ask_products = []  # Filtered by description
        self.syskomp_products = []
        self.mappings = []
        self.current_index = 0
        self.ask_file = None
        self.syskomp_file = None
        self.ask_dir = None
        self.autosave_file = None
        self.description_filter = ""  # Filter text for ASK description
        self.current_product_url = None  # URL of current ASK product

        self.create_ui()

    def create_ui(self):
        # Top: File selection
        file_frame = ttk.LabelFrame(self.root, text="Dateien auswählen", padding=10)
        file_frame.pack(fill="x", padx=10, pady=5)

        # Scan for CSV files in catalog directories
        self.ask_csv_files = self.scan_catalog_csvs()

        # ASK file dropdown
        ask_frame = ttk.Frame(file_frame)
        ask_frame.pack(fill="x", pady=2)
        ttk.Label(ask_frame, text="ASK CSV:").pack(side="left", padx=5)
        self.ask_file_combo = ttk.Combobox(ask_frame, values=self.ask_csv_files, state="readonly", width=60)
        self.ask_file_combo.pack(side="left", fill="x", expand=True, padx=5)
        if self.ask_csv_files:
            self.ask_file_combo.current(0)  # Select first item
        ttk.Button(ask_frame, text="🔄", command=self.refresh_csv_lists, width=3).pack(side="left", padx=2)
        ttk.Button(ask_frame, text="📁", command=self.browse_ask_file, width=3).pack(side="left")

        # Syskomp file (keep as file browser for now)
        syskomp_frame = ttk.Frame(file_frame)
        syskomp_frame.pack(fill="x", pady=2)
        ttk.Label(syskomp_frame, text="Syskomp CSV:").pack(side="left", padx=5)
        self.syskomp_file_entry = ttk.Entry(syskomp_frame, width=50)
        self.syskomp_file_entry.pack(side="left", fill="x", expand=True, padx=5)
        # Set default to ArtNrn.csv
        default_syskomp = r"\\sys-ts19-1\c$\ArtNrConverter\ArtNrn.csv"
        self.syskomp_file_entry.insert(0, default_syskomp)
        ttk.Button(syskomp_frame, text="Durchsuchen...", command=self.browse_syskomp_file).pack(side="left")

        # Load button
        ttk.Button(file_frame, text="▶ Laden", command=self.load_files).pack(pady=5)

        # Search field for ASK Article Number
        search_frame = ttk.Frame(self.root)
        search_frame.pack(fill="x", padx=10, pady=5)

        self.search_label = ttk.Label(search_frame, text="Gehe zu Zeile in:")
        self.search_label.pack(side="left", padx=5)
        self.search_entry = ttk.Entry(search_frame, width=20)
        self.search_entry.pack(side="left", padx=5)
        ttk.Button(search_frame, text="🔍 Suchen", command=self.search_product).pack(side="left", padx=5)

        # Description filter for ASK products
        ttk.Label(search_frame, text="  |  Filter Beschreibung:").pack(side="left", padx=(20, 5))
        self.desc_filter_entry = ttk.Entry(search_frame, width=30)
        self.desc_filter_entry.pack(side="left", padx=5)
        self.desc_filter_entry.bind("<KeyRelease>", lambda e: self.apply_description_filter())
        ttk.Button(search_frame, text="✖ Löschen", command=self.clear_description_filter).pack(side="left", padx=5)

        # Filter help text
        filter_help = ttk.Label(search_frame, text='💡 "profil " findet auch ALUMINIUMPROFIL | Mehrere Begriffe: Leerzeichen | *=Wildcard',
                                font=("", 8), foreground="gray")
        filter_help.pack(side="left", padx=10)

        # Main content: Split into ASK (left) and Syskomp (right)
        main_frame = ttk.Frame(self.root)
        main_frame.pack(fill="both", expand=True, padx=10, pady=5)

        # Left panel: ASK Product (wider to make right side 15% narrower)
        ask_panel = ttk.LabelFrame(main_frame, text="ASK Produkt", padding=10, width=420)
        ask_panel.pack(side="left", fill="y", padx=(0, 5))
        ask_panel.pack_propagate(False)  # Prevent resizing based on content

        # Image
        self.image_label = ttk.Label(ask_panel, text="Kein Bild", relief="solid", anchor="center")
        self.image_label.pack(pady=10)

        # ASK Info
        info_frame = ttk.Frame(ask_panel)
        info_frame.pack(fill="x", pady=5)

        ttk.Label(info_frame, text="Art. Nr:").grid(row=0, column=0, sticky="w", padx=5)
        self.ask_artnr_label = ttk.Label(info_frame, text="", font=("Arial", 12, "bold"))
        self.ask_artnr_label.grid(row=0, column=1, sticky="w", padx=5)

        ttk.Label(info_frame, text="Beschreibung:").grid(row=1, column=0, sticky="nw", padx=5, pady=5)
        self.ask_desc_label = ttk.Label(info_frame, text="", wraplength=350, justify="left")
        self.ask_desc_label.grid(row=1, column=1, sticky="w", padx=5, pady=5)

        # Shop link button
        self.shop_link_btn = ttk.Button(info_frame, text="🔗 Link zum Shop", command=self.open_shop_link, state="disabled")
        self.shop_link_btn.grid(row=2, column=0, columnspan=2, sticky="w", padx=5, pady=5)

        # Right panel: Syskomp Matching (takes remaining space)
        syskomp_panel = ttk.LabelFrame(main_frame, text="Syskomp Zuordnung", padding=10)
        syskomp_panel.pack(side="right", fill="both", expand=True, padx=(5, 0))

        # Filter selection
        filter_frame = ttk.LabelFrame(syskomp_panel, text="Filter", padding=5)
        filter_frame.pack(fill="x", pady=5)

        # Type filter
        type_filter_frame = ttk.Frame(filter_frame)
        type_filter_frame.pack(fill="x", pady=2)

        self.filter_var = tk.StringVar(value="all")
        ttk.Radiobutton(type_filter_frame, text="Alle", variable=self.filter_var, value="all", command=self.apply_filter).pack(side="left", padx=5)
        ttk.Radiobutton(type_filter_frame, text="Item (x.x.x.x)", variable=self.filter_var, value="item", command=self.apply_filter).pack(side="left", padx=5)
        ttk.Radiobutton(type_filter_frame, text="Bosch (10 Zeichen)", variable=self.filter_var, value="bosch", command=self.apply_filter).pack(side="left", padx=5)

        # Similarity filter
        similarity_frame = ttk.Frame(filter_frame)
        similarity_frame.pack(fill="x", pady=2)

        ttk.Label(similarity_frame, text="Min. Übereinstimmung:").pack(side="left", padx=5)
        self.similarity_var = tk.IntVar(value=0)
        self.similarity_slider = ttk.Scale(similarity_frame, from_=0, to=100, variable=self.similarity_var, orient="horizontal", command=lambda x: self.apply_filter())
        self.similarity_slider.pack(side="left", fill="x", expand=True, padx=5)

        self.similarity_label = ttk.Label(similarity_frame, text="0%", width=5)
        self.similarity_label.pack(side="left", padx=5)

        # Update label when slider changes
        self.similarity_slider.config(command=self.update_similarity_label)

        # Input field with Passt and navigation buttons
        input_frame = ttk.Frame(syskomp_panel)
        input_frame.pack(fill="x", pady=5)
        ttk.Label(input_frame, text="Syskomp Art. Nr:").pack(side="left", padx=5)
        self.syskomp_input = ttk.Entry(input_frame, width=15, font=("Courier", 11))
        self.syskomp_input.pack(side="left", padx=5)
        ttk.Button(input_frame, text="✓ Passt", command=self.save_mapping).pack(side="left", padx=5)
        ttk.Button(input_frame, text="◀ Zurück", command=self.previous_product).pack(side="left", padx=2)
        ttk.Button(input_frame, text="Überspringen", command=self.skip_product).pack(side="left", padx=2)
        self.next_btn = ttk.Button(input_frame, text="Weiter ▶", command=self.next_product)
        self.next_btn.pack(side="left", padx=2)

        # Top 20 matches
        ttk.Label(syskomp_panel, text="Top 20 Matches (Klicken zum Auswählen):").pack(anchor="w", pady=5)

        # Listbox with scrollbar
        list_frame = ttk.Frame(syskomp_panel)
        list_frame.pack(fill="both", expand=True, pady=5)

        scrollbar = ttk.Scrollbar(list_frame)
        scrollbar.pack(side="right", fill="y")

        self.match_listbox = tk.Listbox(list_frame, yscrollcommand=scrollbar.set, font=("Courier", 9))
        self.match_listbox.pack(side="left", fill="both", expand=True)
        scrollbar.config(command=self.match_listbox.yview)

        self.match_listbox.bind('<<ListboxSelect>>', self.on_match_select)

        # Bottom: Navigation and Save
        nav_frame = ttk.Frame(self.root, padding=10)
        nav_frame.pack(fill="x", padx=10, pady=5)

        # Progress
        self.progress_label = ttk.Label(nav_frame, text="0 / 0")
        self.progress_label.pack(side="left", padx=10)

        # Status message
        self.status_label = ttk.Label(nav_frame, text="", foreground="green")
        self.status_label.pack(side="left", padx=10)

        # Autosave file info
        self.autosave_info_label = ttk.Label(nav_frame, text="", foreground="blue", font=("Arial", 9))
        self.autosave_info_label.pack(side="right", padx=10)

        # Export button
        ttk.Button(nav_frame, text="💾 Export CSV", command=self.export_mappings).pack(side="right", padx=5)

    def scan_catalog_csvs(self):
        r"""Scan network path \\sys-ts19-1\c$\ArtNrConverter\*catalog*\ for CSV files"""
        csv_files = []

        # Network base path
        base_path = r"\\sys-ts19-1\c$\ArtNrConverter"

        try:
            if os.path.exists(base_path):
                # List all directories in base path
                for item in os.listdir(base_path):
                    item_path = os.path.join(base_path, item)
                    # Check if it's a directory and contains "catalog" (case-insensitive)
                    if os.path.isdir(item_path) and "catalog" in item.lower():
                        # Scan for CSV files in this catalog directory
                        try:
                            for file in sorted(os.listdir(item_path)):
                                if file.endswith('.csv') and file.lower() != 'ask-syskomp.csv':
                                    full_path = os.path.join(item_path, file)
                                    csv_files.append(full_path)
                        except Exception as e:
                            print(f"Error scanning {item_path}: {e}")
        except Exception as e:
            print(f"Error accessing network path {base_path}: {e}")

        # Fallback: Also scan local directories if network path is unavailable
        script_dir = os.path.dirname(os.path.abspath(__file__))

        # Scan ASK_CATALOG (local)
        ask_catalog_dir = os.path.join(script_dir, "ASK_CATALOG")
        if os.path.exists(ask_catalog_dir):
            for file in sorted(os.listdir(ask_catalog_dir)):
                if file.endswith('.csv') and file.lower() != 'ask-syskomp.csv':
                    full_path = os.path.join(ask_catalog_dir, file)
                    if full_path not in csv_files:  # Avoid duplicates
                        csv_files.append(full_path)

        # Scan ALVARIS_CATALOG (local)
        alvaris_catalog_dir = os.path.join(script_dir, "ALVARIS_CATALOG")
        if os.path.exists(alvaris_catalog_dir):
            for file in sorted(os.listdir(alvaris_catalog_dir)):
                if file.endswith('.csv') and file.lower() != 'ask-syskomp.csv':
                    full_path = os.path.join(alvaris_catalog_dir, file)
                    if full_path not in csv_files:  # Avoid duplicates
                        csv_files.append(full_path)

        return csv_files

    def refresh_csv_lists(self):
        """Refresh the CSV file list"""
        self.ask_csv_files = self.scan_catalog_csvs()
        self.ask_file_combo['values'] = self.ask_csv_files
        if self.ask_csv_files:
            self.ask_file_combo.current(0)

    def browse_ask_file(self):
        """Browse for ASK CSV file manually"""
        # Start in network path
        initial_dir = r"\\sys-ts19-1\c$\ArtNrConverter"
        if not os.path.exists(initial_dir):
            initial_dir = None

        filepath = filedialog.askopenfilename(
            title="ASK CSV Datei auswählen",
            initialdir=initial_dir,
            filetypes=[("CSV Dateien", "*.csv"), ("Alle Dateien", "*.*")]
        )
        if filepath:
            # Add to combo box if not already there
            if filepath not in self.ask_csv_files:
                self.ask_csv_files.append(filepath)
                self.ask_file_combo['values'] = self.ask_csv_files
            # Select the file
            self.ask_file_combo.set(filepath)

    def browse_syskomp_file(self):
        # Start in network path
        initial_dir = r"\\sys-ts19-1\c$\ArtNrConverter"
        if not os.path.exists(initial_dir):
            initial_dir = None

        filepath = filedialog.askopenfilename(
            title="Syskomp CSV Datei auswählen",
            initialdir=initial_dir,
            filetypes=[("CSV Dateien", "*.csv"), ("Alle Dateien", "*.*")]
        )
        if filepath:
            self.syskomp_file_entry.delete(0, tk.END)
            self.syskomp_file_entry.insert(0, filepath)

    def load_files(self):
        ask_file = self.ask_file_combo.get().strip()
        syskomp_file = self.syskomp_file_entry.get().strip()

        if not ask_file or not syskomp_file:
            messagebox.showerror("Fehler", "Bitte beide CSV-Dateien auswählen.")
            return

        try:
            # Load ASK products
            self.ask_products = []
            with open(ask_file, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    self.ask_products.append(row)

            # Determine ASK image directory: <csvname>-images
            parent_dir = os.path.dirname(ask_file)
            csv_name = os.path.splitext(os.path.basename(ask_file))[0]  # Remove .csv extension
            self.ask_dir = os.path.join(parent_dir, f"{csv_name}-images")

            # Load Syskomp products (semicolon delimiter, Windows-1252 encoding for German umlauts)
            self.syskomp_products = []
            # Try different encodings
            for encoding in ['windows-1252', 'iso-8859-1', 'utf-8']:
                try:
                    with open(syskomp_file, 'r', encoding=encoding) as f:
                        reader = csv.DictReader(f, delimiter=';')
                        for row in reader:
                            self.syskomp_products.append(row)
                    break  # Success, exit loop
                except (UnicodeDecodeError, UnicodeError):
                    self.syskomp_products = []  # Reset and try next encoding
                    continue

            self.current_index = 0
            self.mappings = []

            # Initialize filtered list with all products
            self.filtered_ask_products = self.ask_products.copy()

            # Setup autosave file
            ask_dir = os.path.dirname(ask_file)
            self.autosave_file = os.path.join(ask_dir, "ASK-Syskomp.csv")

            # Load existing mappings if autosave file exists
            self.load_existing_mappings()

            # Update search label with filename
            ask_filename = os.path.basename(ask_file)
            self.search_label.config(text=f"Gehe zu Zeile in {ask_filename}:")

            # Show where mappings are saved (in label, not popup)
            autosave_filename = os.path.basename(self.autosave_file)
            self.autosave_info_label.config(text=f"Autosave: {autosave_filename} ({len(self.mappings)} Mappings)")

            self.show_status(f"✓ {len(self.ask_products)} ASK Produkte und {len(self.syskomp_products)} Syskomp Produkte geladen.", "green")

            self.show_current_product()

        except Exception as e:
            messagebox.showerror("Fehler", f"Fehler beim Laden der Dateien: {e}")

    def load_existing_mappings(self):
        """Load existing mappings from autosave file if it exists"""
        if self.autosave_file and os.path.exists(self.autosave_file):
            try:
                with open(self.autosave_file, 'r', encoding='utf-8') as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        self.mappings.append(row)
                if self.mappings:
                    self.show_status(f"✓ {len(self.mappings)} bestehende Mappings geladen.", "blue")
            except Exception as e:
                print(f"Fehler beim Laden existierender Mappings: {e}")

    def search_product(self):
        """Search for ASK product by article number"""
        search_term = self.search_entry.get().strip()
        if not search_term or not self.filtered_ask_products:
            return

        # Search for matching article number in filtered list
        for idx, product in enumerate(self.filtered_ask_products):
            artnr = product.get('Artikelnummer', '')
            if search_term.lower() in artnr.lower():
                self.current_index = idx
                self.show_current_product()
                self.show_status(f"✓ Gefunden: {artnr}", "green")
                return

        self.show_status(f"⚠ Nicht gefunden: {search_term}", "orange")

    def show_current_product(self, set_focus=True):
        print(f"DEBUG show_current_product: current_index={self.current_index}, filtered_len={len(self.filtered_ask_products)}, total_len={len(self.ask_products)}")

        if not self.filtered_ask_products:
            # No products (empty filter result)
            self.progress_label.config(text="0 / 0 (gefiltert)")
            self.ask_artnr_label.config(text="Keine Treffer", foreground="black")
            self.ask_desc_label.config(text="Keine Artikel gefunden mit diesem Filter")
            self.image_label.config(image='', text="Kein Bild")
            self.shop_link_btn.config(state="disabled")
            self.matches_listbox.delete(0, tk.END)
            return

        if self.current_index >= len(self.filtered_ask_products):
            messagebox.showinfo("Fertig", "Alle Produkte wurden bearbeitet!")
            return

        product = self.filtered_ask_products[self.current_index]
        print(f"DEBUG: Showing product: {product.get('Artikelnummer', 'N/A')}")

        # Update progress (show filtered/total)
        filter_info = f" (gefiltert)" if len(self.filtered_ask_products) < len(self.ask_products) else ""
        self.progress_label.config(text=f"{self.current_index + 1} / {len(self.filtered_ask_products)}{filter_info}")

        # Display ASK info
        artnr = product.get('Artikelnummer', '')
        description = product.get('Beschreibung', '')
        image_file = product.get('Bild', '')

        # Fallback: If image column is empty or doesn't exist, try using article number as filename
        if not image_file:
            image_file = artnr

        # Check if this article is already mapped
        is_mapped = any(mapping.get('ASK_Artikelnummer') == artnr for mapping in self.mappings)

        # Set color: red if already mapped, default otherwise
        artnr_color = "red" if is_mapped else "black"
        self.ask_artnr_label.config(
            text=artnr if artnr else "Keine Artikelnummer",
            foreground=artnr_color
        )

        # Show visual indicator in description if mapped
        desc_text = description if description else "Keine Beschreibung"
        if is_mapped:
            desc_text = "✓ BEREITS ERFASST | " + desc_text
            print(f"DEBUG: Article {artnr} is already mapped (shown in red)")

        self.ask_desc_label.config(text=desc_text)

        # Get product URL and enable/disable shop link button
        self.current_product_url = product.get('URL', '')
        if self.current_product_url:
            self.shop_link_btn.config(state="normal")
        else:
            self.shop_link_btn.config(state="disabled")

        # Load and display image (pass article number as fallback)
        self.load_image(image_file, artnr)

        # Clear Syskomp input
        self.syskomp_input.delete(0, tk.END)

        # Find and show top matches
        self.show_matches(description)

        # Set focus to input field to prevent other widgets from graying out
        # Only set focus when navigating products, not when filtering
        if set_focus:
            self.syskomp_input.focus_set()

    def open_shop_link(self):
        """Open the product URL in the default web browser"""
        if self.current_product_url:
            try:
                webbrowser.open(self.current_product_url)
                self.show_status(f"✓ Browser geöffnet: {self.current_product_url[:50]}...", "green")
            except Exception as e:
                messagebox.showerror("Fehler", f"Fehler beim Öffnen der URL: {e}")
        else:
            messagebox.showinfo("Keine URL", "Für dieses Produkt ist keine URL verfügbar.")

    def load_image(self, image_filename, fallback_artnr=None):
        if not image_filename or not self.ask_dir:
            self.image_label.config(image='', text="Kein Bild")
            return

        # Add .png extension if not present
        if not image_filename.endswith('.png'):
            image_filename = image_filename + '.png'

        # self.ask_dir is already <csvname>-images directory
        image_path = os.path.join(self.ask_dir, image_filename)

        # If image doesn't exist, try using article number as fallback
        if not os.path.exists(image_path) and fallback_artnr:
            fallback_filename = fallback_artnr if fallback_artnr.endswith('.png') else fallback_artnr + '.png'
            fallback_path = os.path.join(self.ask_dir, fallback_filename)
            if os.path.exists(fallback_path):
                print(f"DEBUG: Image {image_filename} not found, using fallback {fallback_filename}")
                image_path = fallback_path
                image_filename = fallback_filename

        if not os.path.exists(image_path):
            self.image_label.config(image='', text=f"Bild nicht gefunden:\n{image_filename}")
            return

        try:
            img = Image.open(image_path)
            # Resize to fit (260x260 = 30% bigger than 200x200)
            img.thumbnail((260, 260), Image.Resampling.LANCZOS)
            photo = ImageTk.PhotoImage(img)
            self.image_label.config(image=photo, text='')
            self.image_label.image = photo  # Keep reference
        except Exception as e:
            self.image_label.config(image='', text=f"Fehler beim Laden:\n{e}")

    def is_item_number(self, artnr):
        """Check if article number matches Item format (x.x.x.x)"""
        # Item format: digits separated by dots, e.g., 0.0.123.45
        return bool(artnr and re.match(r'^\d+\.\d+\.\d+\.\d+$', artnr))

    def is_bosch_number(self, artnr):
        """Check if article number is Bosch format (exactly 10 characters)"""
        return artnr and len(artnr) == 10

    def filter_product(self, artnr1, artnr2=""):
        """Check if product matches current filter - checks BOTH article number columns"""
        filter_type = self.filter_var.get()

        if filter_type == "all":
            return True
        elif filter_type == "item":
            # Match if at least one column is Item format AND neither column is Bosch format
            has_item = self.is_item_number(artnr1) or self.is_item_number(artnr2)
            has_bosch = self.is_bosch_number(artnr1) or self.is_bosch_number(artnr2)
            return has_item and not has_bosch
        elif filter_type == "bosch":
            # Match if at least one column is Bosch format AND neither column is Item format
            has_item = self.is_item_number(artnr1) or self.is_item_number(artnr2)
            has_bosch = self.is_bosch_number(artnr1) or self.is_bosch_number(artnr2)
            return has_bosch and not has_item

        return True

    def update_similarity_label(self, value=None):
        """Update the similarity percentage label"""
        percentage = int(self.similarity_var.get())
        self.similarity_label.config(text=f"{percentage}%")
        self.apply_filter()

    def apply_filter(self):
        """Reapply filter when radio button changes"""
        if self.ask_products and self.current_index < len(self.ask_products):
            product = self.ask_products[self.current_index]
            description = product.get('Beschreibung', '')
            self.show_matches(description)

    def show_matches(self, ask_description):
        self.match_listbox.delete(0, tk.END)

        if not ask_description or not self.syskomp_products:
            return

        # Get minimum similarity threshold
        min_similarity = self.similarity_var.get() / 100.0

        # Calculate similarity scores
        matches = []
        for product in self.syskomp_products:
            # Get Syskomp description - column name is "Artikelbezeichnung"
            syskomp_desc = str(product.get('Artikelbezeichnung', '') or '').strip()
            # Get both article numbers
            # Materialnr. can be Item (x.x.x.x) or Bosch (10 char) format
            bosch_item_nr = str(product.get('Materialnr.', '') or '').strip()  # Item/Bosch number
            syskomp_nr = str(product.get('Unnamed: 1', '') or '').strip()      # Syskomp number

            # Use Bosch/Item number for filtering, but show both
            display_artnr = bosch_item_nr or syskomp_nr

            # Only show products that have a valid 9-digit Syskomp number
            if not (syskomp_nr and syskomp_nr.isdigit() and len(syskomp_nr) >= 9):
                continue

            if syskomp_desc and display_artnr:
                # Apply type filter (Item/Bosch) - check BOTH columns
                if not self.filter_product(bosch_item_nr, syskomp_nr):
                    continue

                similarity = self.calculate_similarity(ask_description.lower(), syskomp_desc.lower())

                # Apply similarity filter
                if similarity < min_similarity:
                    continue

                matches.append({
                    'syskomp_nr': syskomp_nr,
                    'bosch_item_nr': bosch_item_nr,
                    'artnr': display_artnr,  # For saving/selecting
                    'description': syskomp_desc,
                    'similarity': similarity
                })

        # Sort by similarity (highest first)
        matches.sort(key=lambda x: x['similarity'], reverse=True)

        # Show top 20
        for match in matches[:20]:
            # Format Bosch/Item number (from Materialnr.)
            formatted_bosch_item = self.format_artnr(match['bosch_item_nr']) if match['bosch_item_nr'] else ''
            # Format Syskomp number (from Unnamed: 1)
            formatted_syskomp = self.format_artnr(match['syskomp_nr']) if match['syskomp_nr'] else ''

            # Display: Item/Bosch-Nr | Syskomp-Nr | Similarity | Description
            if formatted_bosch_item and formatted_syskomp:
                display_text = f"{formatted_bosch_item:15} | {formatted_syskomp:15} ({match['similarity']:.1%}) {match['description']}"
            else:
                # Fallback if one is missing
                display_text = f"{formatted_bosch_item or formatted_syskomp:20} ({match['similarity']:.1%}) {match['description']}"

            self.match_listbox.insert(tk.END, display_text)

    def format_artnr(self, artnr):
        """Format article number with spaces every 3 digits for readability"""
        # For Item numbers (x.x.x.x), keep as is
        if '.' in artnr:
            return artnr

        # For numeric strings, add space every 3 digits from the right
        # e.g., 3842111987 -> 384 211 1987
        if artnr.isdigit() and len(artnr) > 3:
            # Add spaces every 3 digits from right
            parts = []
            for i in range(len(artnr), 0, -3):
                parts.insert(0, artnr[max(0, i-3):i])
            return ' '.join(parts)

        return artnr

    def calculate_similarity(self, text1, text2):
        """Calculate similarity between two strings using SequenceMatcher with special rules"""
        import re

        # Base similarity
        base_similarity = SequenceMatcher(None, text1, text2).ratio()

        # Bonus for "Profil X" matching "Nut X"
        bonus = 0.0

        # Find "profil" followed by a number in text1
        profil_match = re.search(r'profil\s*(\d+)', text1, re.IGNORECASE)
        # Find "nut" followed by a number in text2
        nut_match = re.search(r'nut\s*(\d+)', text2, re.IGNORECASE)

        if profil_match and nut_match:
            # Check if the numbers match
            profil_num = profil_match.group(1)
            nut_num = nut_match.group(1)

            if profil_num == nut_num:
                # Strong bonus if Profil X matches Nut X
                bonus = 0.3  # 30% bonus

        # Also check the reverse: "nut" in text1, "profil" in text2
        nut_match1 = re.search(r'nut\s*(\d+)', text1, re.IGNORECASE)
        profil_match2 = re.search(r'profil\s*(\d+)', text2, re.IGNORECASE)

        if nut_match1 and profil_match2:
            nut_num1 = nut_match1.group(1)
            profil_num2 = profil_match2.group(1)

            if nut_num1 == profil_num2:
                bonus = 0.3

        # Cap final similarity at 1.0
        final_similarity = min(1.0, base_similarity + bonus)

        return final_similarity

    def on_match_select(self, event):
        selection = self.match_listbox.curselection()
        if selection:
            selected_text = self.match_listbox.get(selection[0])
            # Extract article number (everything before the percentage)
            # Format is: "Syskomp-Nr (9-digit) | Item-Nr | (similarity%) description"
            artnr_part = selected_text.split('(')[0].strip()

            if '|' in artnr_part:
                # Format: "Syskomp-Nr | Item/Bosch-Nr"
                # Use the FIRST one (Syskomp 9-digit number on the left)
                artnr = artnr_part.split('|')[0].strip().replace(' ', '')
            else:
                # Single number
                artnr = artnr_part.replace(' ', '')

            # Ensure it's 9 digits and format as xxx xxx xxx
            if artnr.isdigit() and len(artnr) >= 9:
                artnr = artnr[:9]  # Take first 9 digits
                formatted = self.format_artnr(artnr)
                self.syskomp_input.delete(0, tk.END)
                self.syskomp_input.insert(0, formatted)
            elif artnr.isdigit():
                # Less than 9 digits, still format it
                formatted = self.format_artnr(artnr)
                self.syskomp_input.delete(0, tk.END)
                self.syskomp_input.insert(0, formatted)
            else:
                # Not a digit (e.g., Item number), don't insert
                pass

    def save_mapping(self):
        if not self.filtered_ask_products or self.current_index >= len(self.filtered_ask_products):
            return

        # Get article number and remove spaces for storage
        input_artnr = self.syskomp_input.get().strip().replace(' ', '')

        if not input_artnr:
            self.show_status("Bitte eine Syskomp Artikelnummer eingeben oder auswählen.", "red")
            return

        # Find the corresponding 9-digit Syskomp number
        syskomp_artnr = None
        syskomp_desc = ""

        for product in self.syskomp_products:
            # Check both columns for the article number
            bosch_item = str(product.get('Materialnr.', '') or '').strip()
            syskomp_nr = str(product.get('Unnamed: 1', '') or '').strip()

            # If input matches Item/Bosch number, use the 9-digit Syskomp number
            if bosch_item == input_artnr:
                # Must have valid 9-digit Syskomp number
                if syskomp_nr and syskomp_nr.isdigit() and len(syskomp_nr) >= 9:
                    syskomp_artnr = syskomp_nr[:9]
                    syskomp_desc = str(product.get('Artikelbezeichnung', '') or '').strip()
                    break
                else:
                    # Found Bosch/Item match but no valid Syskomp number
                    self.show_status(f"⚠️ Keine gültige 9-stellige Syskomp-Nummer für {input_artnr} gefunden", "red")
                    return
            elif syskomp_nr == input_artnr:
                # Direct match with Syskomp number
                if syskomp_nr.isdigit() and len(syskomp_nr) >= 9:
                    syskomp_artnr = syskomp_nr[:9]
                    syskomp_desc = str(product.get('Artikelbezeichnung', '') or '').strip()
                    break
                else:
                    self.show_status(f"⚠️ Ungültige Syskomp-Nummer (muss 9-stellig sein): {input_artnr}", "red")
                    return

        # Check if valid Syskomp number was found
        if not syskomp_artnr:
            self.show_status(f"⚠️ Keine gültige 9-stellige Syskomp-Nummer gefunden für: {input_artnr}", "red")
            return

        # Save mapping - use filtered_ask_products since current_index refers to filtered list
        ask_product = self.filtered_ask_products[self.current_index]
        mapping = {
            'ASK_Artikelnummer': ask_product.get('Artikelnummer', ''),
            'ASK_Beschreibung': ask_product.get('Beschreibung', ''),
            'Syskomp_Artikelnummer': syskomp_artnr,
            'Syskomp_Beschreibung': syskomp_desc
        }
        self.mappings.append(mapping)

        # Auto-save immediately to file
        self.autosave_mapping()

        self.show_status(f"✓ Gespeichert: {mapping['ASK_Artikelnummer']} → {syskomp_artnr}", "green")

        # Move to next
        self.next_product()

    def autosave_mapping(self):
        """Automatically save all mappings to CSV file after each change"""
        if not self.autosave_file or not self.mappings:
            return

        try:
            with open(self.autosave_file, 'w', newline='', encoding='utf-8') as f:
                fieldnames = ['ASK_Artikelnummer', 'ASK_Beschreibung', 'Syskomp_Artikelnummer', 'Syskomp_Beschreibung']
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(self.mappings)

            # Update autosave info label
            autosave_filename = os.path.basename(self.autosave_file)
            self.autosave_info_label.config(text=f"Autosave: {autosave_filename} ({len(self.mappings)} Mappings)")
        except PermissionError as e:
            error_msg = f"Keine Schreibrechte: {self.autosave_file}\nBitte prüfen Sie die Berechtigung oder wählen Sie ein anderes Verzeichnis."
            messagebox.showerror("Speicherfehler", error_msg)
            print(f"Auto-save Fehler (Berechtigung): {e}")
        except Exception as e:
            error_msg = f"Fehler beim Speichern: {e}\nDatei: {self.autosave_file}"
            messagebox.showerror("Speicherfehler", error_msg)
            print(f"Auto-save Fehler: {e}")

    def show_status(self, message, color="green"):
        """Show a status message that auto-clears after 3 seconds"""
        self.status_label.config(text=message, foreground=color)
        # Clear after 3 seconds
        self.root.after(3000, lambda: self.status_label.config(text=""))

    def next_product(self):
        print(f"DEBUG next_product: current_index={self.current_index}, filtered_len={len(self.filtered_ask_products)}")
        if not self.filtered_ask_products:
            messagebox.showinfo("Keine Produkte", "Keine Produkte zum Anzeigen (Filter aktiv?)")
            return

        if self.current_index < len(self.filtered_ask_products) - 1:
            self.current_index += 1
            print(f"DEBUG: Moving to index {self.current_index}")
            self.show_current_product()
        else:
            messagebox.showinfo("Fertig", "Das war das letzte Produkt!")

    def previous_product(self):
        print(f"DEBUG previous_product: current_index={self.current_index}, filtered_len={len(self.filtered_ask_products)}")
        if not self.filtered_ask_products:
            messagebox.showinfo("Keine Produkte", "Keine Produkte zum Anzeigen (Filter aktiv?)")
            return

        if self.current_index > 0:
            self.current_index -= 1
            print(f"DEBUG: Moving to index {self.current_index}")
            self.show_current_product()
        else:
            messagebox.showinfo("Anfang", "Das ist bereits das erste Produkt!")

    def skip_product(self):
        self.next_product()

    def apply_description_filter(self):
        """Filter ASK products by description text with wildcard support"""
        filter_text = self.desc_filter_entry.get().strip()

        if not filter_text:
            # No filter - show all products
            self.filtered_ask_products = self.ask_products.copy()
            self.current_index = 0
            if self.ask_products:
                self.show_current_product(set_focus=False)
            return

        # Convert filter to regex pattern
        # Support wildcards (*) and multiple keywords (space-separated)
        # All keywords must match (AND logic)
        # Support quoted phrases to preserve spaces: "profil " nut

        # Parse keywords, respecting quoted phrases
        keywords = []
        current_word = []
        in_quotes = False

        for char in filter_text:
            if char == '"':
                if in_quotes:
                    # End of quoted phrase
                    keywords.append(''.join(current_word))
                    current_word = []
                    in_quotes = False
                else:
                    # Start of quoted phrase
                    in_quotes = True
            elif char == ' ' and not in_quotes:
                # Space outside quotes - word separator
                if current_word:
                    keywords.append(''.join(current_word))
                    current_word = []
            else:
                # Regular character
                current_word.append(char)

        # Add last word/phrase
        if current_word:
            keywords.append(''.join(current_word))

        # Auto-expand keywords with leading/trailing spaces
        # "profil " → "*profil " (finds PROFIL, ALUMINIUMPROFIL, etc.)
        # " nut" → " nut*" (finds NUT, NUTENSTEIN, etc.)
        expanded_keywords = []
        for keyword in keywords:
            expanded = keyword

            # Add wildcard before if ends with space and doesn't start with *
            if expanded.endswith(' ') and not expanded.startswith('*'):
                expanded = '*' + expanded

            # Add wildcard after if starts with space and doesn't end with *
            if expanded.startswith(' ') and not expanded.endswith('*'):
                expanded = expanded + '*'

            expanded_keywords.append(expanded)

        keywords = expanded_keywords

        # Debug: Show what we're searching for
        print(f"DEBUG: Filter text: '{filter_text}'")
        print(f"DEBUG: Original keywords: {[kw for kw in filter_text.split()]}")
        print(f"DEBUG: Expanded keywords: {keywords}")

        # Filter products where all keywords match
        self.filtered_ask_products = []
        for idx, product in enumerate(self.ask_products):
            description = product.get('Beschreibung', '')
            description_lower = description.lower()

            # Debug: Show first 3 descriptions
            if idx < 3:
                print(f"DEBUG: Product {idx+1} description: '{description}'")

            # Check if all keywords match (with wildcard support)
            all_match = True
            for keyword in keywords:
                keyword_lower = keyword.lower()
                # Convert wildcard * to regex .*
                # Escape other special regex characters
                pattern = re.escape(keyword_lower).replace(r'\*', '.*')

                # Check if pattern matches
                if not re.search(pattern, description_lower):
                    all_match = False
                    break

            if all_match:
                self.filtered_ask_products.append(product)

        # Debug results
        print(f"DEBUG: Found {len(self.filtered_ask_products)} matches out of {len(self.ask_products)} products")

        # Reset to first product after filtering
        self.current_index = 0

        # Update status
        self.show_status(f"✓ Filter aktiv: {len(self.filtered_ask_products)} von {len(self.ask_products)} Artikeln", "blue")

        # Show current product (or message if no matches)
        # Don't change focus while user is typing in filter
        if self.filtered_ask_products:
            self.show_current_product(set_focus=False)
        else:
            self.show_status(f"⚠ Keine Artikel gefunden mit Filter: '{filter_text}'", "orange")
            self.show_current_product(set_focus=False)  # This will show "Keine Treffer" message

    def clear_description_filter(self):
        """Clear description filter and show all products"""
        self.desc_filter_entry.delete(0, tk.END)
        self.filtered_ask_products = self.ask_products.copy()
        self.current_index = 0
        self.show_status("Filter entfernt - alle Artikel angezeigt", "green")
        if self.ask_products:
            self.show_current_product()

    def export_mappings(self):
        if not self.mappings:
            self.show_status("Keine Mappings zum Exportieren vorhanden.", "orange")
            return

        filepath = filedialog.asksaveasfilename(
            title="Mappings speichern",
            defaultextension=".csv",
            initialfile="ASK-Syskomp.csv",
            filetypes=[("CSV Dateien", "*.csv"), ("Alle Dateien", "*.*")]
        )

        if not filepath:
            return

        try:
            with open(filepath, 'w', newline='', encoding='utf-8') as f:
                fieldnames = ['ASK_Artikelnummer', 'ASK_Beschreibung', 'Syskomp_Artikelnummer', 'Syskomp_Beschreibung']
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(self.mappings)

            self.show_status(f"✓ {len(self.mappings)} Mappings erfolgreich exportiert!", "green")

        except Exception as e:
            messagebox.showerror("Fehler", f"Fehler beim Exportieren: {e}")

if __name__ == "__main__":
    root = tk.Tk()
    app = ProductMapper(root)
    root.mainloop()

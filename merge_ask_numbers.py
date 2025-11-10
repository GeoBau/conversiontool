import csv
import os

# File paths
ask_syskomp_file = 'ASK-Syskomp.csv'
portfolio_file = 'Portfolio_Syskomp_pA copy.csv'
output_file = 'Portfolio_Syskomp_pA_merged.csv'

print(f"Starting merge process...")
print(f"Reading from: {ask_syskomp_file}")
print(f"Updating: {portfolio_file}")
print(f"Output will be saved to: {output_file}")

# Step 1: Read ASK-Syskomp.csv and create a mapping dictionary
# Key: Syskomp_Artikelnummer (column 3), Value: ASK_Artikelnummer (column 1)
syskomp_to_ask = {}

try:
    with open(ask_syskomp_file, 'r', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        header = next(reader)  # Skip header
        print(f"\nASK-Syskomp.csv header: {header}")

        for row in reader:
            if len(row) >= 3:
                ask_nr = row[0].strip()  # ASK_Artikelnummer
                syskomp_nr = row[2].strip()  # Syskomp_Artikelnummer

                if syskomp_nr and ask_nr:
                    # Store the mapping (one Syskomp number can have multiple ASK numbers)
                    if syskomp_nr not in syskomp_to_ask:
                        syskomp_to_ask[syskomp_nr] = []
                    syskomp_to_ask[syskomp_nr].append(ask_nr)

    print(f"Found {len(syskomp_to_ask)} unique Syskomp numbers with ASK mappings")

except Exception as e:
    print(f"Error reading {ask_syskomp_file}: {e}")
    exit(1)

# Step 2: Read Portfolio file and update ASK column (column 8)
updated_rows = []
matches_found = 0
rows_processed = 0

try:
    with open(portfolio_file, 'r', encoding='utf-8-sig') as f:
        reader = csv.reader(f, delimiter=';')
        header = next(reader)
        print(f"\nPortfolio header: {header}")
        updated_rows.append(header)

        for row in reader:
            rows_processed += 1
            if len(row) >= 8:
                alte_nr = row[1].strip()  # alteNr (column 2, index 1)

                # Check if this Syskomp number exists in our mapping
                if alte_nr in syskomp_to_ask:
                    # Get the ASK number(s) - use the first one if multiple exist
                    ask_numbers = syskomp_to_ask[alte_nr]
                    row[7] = ask_numbers[0]  # Column 8 (index 7) - ASK
                    matches_found += 1

                    if len(ask_numbers) > 1:
                        print(f"Note: Multiple ASK numbers for Syskomp {alte_nr}: {ask_numbers}, using {ask_numbers[0]}")

            updated_rows.append(row)

    print(f"\nProcessed {rows_processed} rows")
    print(f"Found and updated {matches_found} matching entries")

except Exception as e:
    print(f"Error reading {portfolio_file}: {e}")
    exit(1)

# Step 3: Write the updated data to output file
try:
    with open(output_file, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f, delimiter=';')
        writer.writerows(updated_rows)

    print(f"\nSuccess! Merged data saved to: {output_file}")
    print(f"Total matches: {matches_found}/{rows_processed} rows updated")

except Exception as e:
    print(f"Error writing {output_file}: {e}")
    exit(1)

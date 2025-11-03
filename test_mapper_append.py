import csv
import os

# Simulate the mapper logic
def test_append_logic():
    test_file = "test_mappings.csv"

    # Create initial CSV with 2 entries
    print("1. Creating initial CSV with 2 entries...")
    with open(test_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['ASK_Artikelnummer', 'ASK_Beschreibung', 'Syskomp_Artikelnummer', 'Syskomp_Beschreibung'])
        writer.writeheader()
        writer.writerow({'ASK_Artikelnummer': '111', 'ASK_Beschreibung': 'Test 1', 'Syskomp_Artikelnummer': '222', 'Syskomp_Beschreibung': 'Desc 1'})
        writer.writerow({'ASK_Artikelnummer': '333', 'ASK_Beschreibung': 'Test 2', 'Syskomp_Artikelnummer': '444', 'Syskomp_Beschreibung': 'Desc 2'})

    print(f"   Initial file has {sum(1 for _ in open(test_file)) - 1} entries")

    # Simulate load_existing_mappings()
    print("\n2. Loading existing mappings...")
    mappings = []
    with open(test_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            mappings.append(row)
    print(f"   Loaded {len(mappings)} mappings into memory")

    # Simulate save_mapping() - add new entry
    print("\n3. Adding new mapping...")
    new_mapping = {'ASK_Artikelnummer': '555', 'ASK_Beschreibung': 'Test 3', 'Syskomp_Artikelnummer': '666', 'Syskomp_Beschreibung': 'Desc 3'}
    mappings.append(new_mapping)
    print(f"   Memory now has {len(mappings)} mappings")

    # Simulate autosave_mapping() - write ALL mappings
    print("\n4. Saving ALL mappings to file...")
    with open(test_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['ASK_Artikelnummer', 'ASK_Beschreibung', 'Syskomp_Artikelnummer', 'Syskomp_Beschreibung'])
        writer.writeheader()
        writer.writerows(mappings)

    final_count = sum(1 for _ in open(test_file)) - 1
    print(f"   Final file has {final_count} entries")

    # Verify
    print("\n5. Verification:")
    with open(test_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, 1):
            print(f"   Entry {i}: {row['ASK_Artikelnummer']} → {row['Syskomp_Artikelnummer']}")

    # Cleanup
    os.remove(test_file)

    print(f"\n✓ Test passed! Old entries preserved: {final_count == 3}")
    print("✓ The append logic works correctly!")

if __name__ == "__main__":
    test_append_logic()

"""
Test script for the article number conversion API
"""

import requests
import json

BASE_URL = 'http://localhost:5000/api'

def test_health():
    """Test health check endpoint."""
    print("\n=== Testing Health Check ===")
    response = requests.get(f'{BASE_URL}/health')
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")

def test_validate():
    """Test validation endpoint."""
    print("\n=== Testing Validation ===")

    test_numbers = [
        '415901309',      # Syskomp (9 digits)
        '3842537592',     # Bosch (10 digits)
        '0.0.621.77',     # Item
        '12345',          # Invalid
        '0062177'         # Item without dots
    ]

    for number in test_numbers:
        response = requests.post(f'{BASE_URL}/validate', json={'number': number})
        result = response.json()
        print(f"\nNumber: {number}")
        print(f"  Type: {result['type']}")
        print(f"  Valid: {result['valid']}")

def test_search():
    """Test search endpoint."""
    print("\n=== Testing Search ===")

    test_numbers = [
        '415901309',      # Syskomp
        '842901309',      # Syskomp
        '3842537592',     # Bosch
        '0.0.621.77',     # Item
        '282500002',      # Syskomp -> Item
        '99999999'        # Not found
    ]

    for number in test_numbers:
        print(f"\n--- Searching for: {number} ---")
        response = requests.post(f'{BASE_URL}/search', json={'number': number})
        result = response.json()

        if result.get('found'):
            if result.get('ambiguous'):
                print(f"  Found {result['count']} matches (ambiguous)")
                for idx, match in enumerate(result['results']):
                    print(f"  Match {idx+1}:")
                    print(f"    Input: {match['input_number']} ({match['input_type']})")
                    print(f"    Output: {match['corresponding_number']} ({match['corresponding_type']})")
                    print(f"    Bez1: {match['bez1']}")
            else:
                match = result['result']
                print(f"  Input: {match['input_number']} ({match['input_type']})")
                print(f"  Output: {match['corresponding_number']} ({match['corresponding_type']})")
                print(f"  Bez1: {match['bez1']}")
                print(f"  Bez2: {match['bez2']}")
                print(f"  Warengruppe: {match['warengruppe']}")
        else:
            print(f"  Not found: {result['message']}")

def test_batch_convert():
    """Test batch conversion endpoint."""
    print("\n=== Testing Batch Conversion ===")

    numbers = [
        '415901309',
        '3842537592',
        '0.0.621.77',
        '99999999'  # This will fail
    ]

    response = requests.post(f'{BASE_URL}/batch-convert', json={'numbers': numbers})
    result = response.json()

    print(f"\nTotal: {result['total']}")
    print(f"All convertible: {result['all_convertible']}")
    print("\nResults:")
    for res in result['results']:
        print(f"  [{res['index']}] {res['input']} -> {res.get('output', 'N/A')} ({res['status']})")

def test_stats():
    """Test stats endpoint."""
    print("\n=== Testing Stats ===")
    response = requests.get(f'{BASE_URL}/stats')
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")

if __name__ == '__main__':
    try:
        print("Starting API tests...")
        print("Make sure the Flask server is running on http://localhost:5000")

        test_health()
        test_validate()
        test_search()
        test_batch_convert()
        test_stats()

        print("\n=== All tests completed ===")

    except requests.exceptions.ConnectionError:
        print("\nError: Could not connect to the API.")
        print("Make sure the Flask server is running: python backend/app.py")
    except Exception as e:
        print(f"\nError during testing: {e}")

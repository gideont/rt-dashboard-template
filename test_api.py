import requests
import json

try:
    response = requests.get('http://localhost:8000/api/metrics', timeout=5)
    print(f"Status: {response.status_code}")
    print(f"Headers: {response.headers}")
    data = response.json()
    print(f"Response keys: {data.keys()}")
    print(f"Data length: {len(data.get('data', []))}")
    print(f"Timestamp: {data.get('timestamp')}")
    if data.get('data'):
        print(f"First item: {data['data'][0]}")
except Exception as e:
    print(f"Error: {e}")

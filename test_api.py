import urllib.request
import base64

url = "http://localhost:8000/api/finance/parties/5/ledger/"
auth_str = "%s:%s" % ("huzai", "POSPassword123")
encoded_auth = base64.b64encode(auth_str.encode()).decode()

req = urllib.request.Request(url)
req.add_header("Authorization", "Basic %s" % encoded_auth)

try:
    with urllib.request.urlopen(req) as response:
        print(f"Status Code: {response.getcode()}")
        print(f"Response Body: {response.read().decode()}")
except urllib.error.HTTPError as e:
    print(f"HTTP Error: {e.code}")
    print(f"Response Body: {e.read().decode()}")
except Exception as e:
    print(f"Error: {e}")

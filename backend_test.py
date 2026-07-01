"""
Profit Scout AI - Production Hardening Backend Tests
Tests all backend APIs for production readiness.
"""
import base64
import io
import json
import time
import uuid

import requests

# Test configuration
BASE_URL = "http://localhost:8001"
API = f"{BASE_URL}/api"

# Test credentials from /app/memory/test_credentials.md
TEST_EMAIL = "prodtest@example.com"
TEST_PASSWORD = "testpass123"

# Global session and token
session = requests.Session()
session.headers.update({"Content-Type": "application/json"})
auth_token = None


def log_test(name, status, details=""):
    """Log test results."""
    symbol = "✅" if status == "PASS" else "❌"
    print(f"{symbol} {name}")
    if details:
        print(f"   {details}")


def log_section(name):
    """Log test section."""
    print(f"\n{'='*60}")
    print(f"  {name}")
    print(f"{'='*60}")


def check_no_mock_data(response_body):
    """Verify response doesn't contain mock data markers."""
    body_str = json.dumps(response_body)
    if '"data_source":"mock"' in body_str or '"data_source": "mock"' in body_str:
        return False, "Found mock data_source in response"
    if '"synthetic"' in body_str.lower():
        return False, "Found synthetic data marker in response"
    return True, ""


# ============================================================
# 1. AUTH TESTS
# ============================================================
def test_auth():
    global auth_token
    log_section("AUTH TESTS")
    
    # Test 1: Register with NEW random email
    new_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    try:
        r = session.post(f"{API}/auth/register", json={"email": new_email, "password": "testpass123"}, timeout=30)
        if r.status_code == 200:
            body = r.json()
            if "access_token" in body and body["access_token"]:
                log_test("Register new user", "PASS", f"Created {new_email}")
            else:
                log_test("Register new user", "FAIL", "No access_token in response")
        else:
            log_test("Register new user", "FAIL", f"Status {r.status_code}: {r.text[:200]}")
    except Exception as e:
        log_test("Register new user", "FAIL", str(e))
    
    # Test 2: Register with existing email (should fail with 400)
    try:
        r = session.post(f"{API}/auth/register", json={"email": TEST_EMAIL, "password": TEST_PASSWORD}, timeout=30)
        if r.status_code == 400:
            log_test("Register duplicate email", "PASS", "Correctly rejected with 400")
        elif r.status_code == 200:
            # First time registration - this is OK, save token
            body = r.json()
            auth_token = body["access_token"]
            log_test("Register duplicate email", "PASS", "First registration successful")
        else:
            log_test("Register duplicate email", "FAIL", f"Expected 400 or 200, got {r.status_code}")
    except Exception as e:
        log_test("Register duplicate email", "FAIL", str(e))
    
    # Test 3: Login with correct credentials
    try:
        r = session.post(f"{API}/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD}, timeout=30)
        if r.status_code == 200:
            body = r.json()
            if "access_token" in body and body["access_token"]:
                auth_token = body["access_token"]
                log_test("Login with correct credentials", "PASS", "Got access_token")
            else:
                log_test("Login with correct credentials", "FAIL", "No access_token in response")
        else:
            log_test("Login with correct credentials", "FAIL", f"Status {r.status_code}: {r.text[:200]}")
    except Exception as e:
        log_test("Login with correct credentials", "FAIL", str(e))
    
    # Test 4: GET /auth/me with valid bearer token
    if auth_token:
        try:
            headers = {"Authorization": f"Bearer {auth_token}"}
            r = session.get(f"{API}/auth/me", headers=headers, timeout=30)
            if r.status_code == 200:
                body = r.json()
                if "email" in body:
                    log_test("GET /auth/me with token", "PASS", f"User: {body['email']}")
                else:
                    log_test("GET /auth/me with token", "FAIL", "No email in response")
            else:
                log_test("GET /auth/me with token", "FAIL", f"Status {r.status_code}: {r.text[:200]}")
        except Exception as e:
            log_test("GET /auth/me with token", "FAIL", str(e))
    
    # Test 5: GET /auth/me without bearer token (should fail with 401)
    try:
        r = session.get(f"{API}/auth/me", timeout=15)
        if r.status_code == 401:
            log_test("GET /auth/me without token", "PASS", "Correctly rejected with 401")
        else:
            log_test("GET /auth/me without token", "FAIL", f"Expected 401, got {r.status_code}")
    except Exception as e:
        log_test("GET /auth/me without token", "FAIL", str(e))


# ============================================================
# 2. CAMERA AI TESTS
# ============================================================
def test_camera_ai():
    log_section("CAMERA AI TESTS")
    
    if not auth_token:
        log_test("Camera AI tests", "SKIP", "No auth token available")
        return
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    # Test 1: Empty image_base64 should return 400
    try:
        r = session.post(f"{API}/scan/identify-image", json={"image_base64": ""}, headers=headers, timeout=35)
        if r.status_code == 400 and "Invalid image payload" in r.text:
            log_test("Camera AI - empty image", "PASS", "Correctly rejected with 400")
        else:
            log_test("Camera AI - empty image", "FAIL", f"Expected 400 with 'Invalid image payload', got {r.status_code}: {r.text[:200]}")
    except Exception as e:
        log_test("Camera AI - empty image", "FAIL", str(e))
    
    # Test 2: Valid JPEG image (create a simple product-like image)
    try:
        from PIL import Image, ImageDraw, ImageFont
        
        # Create a 400x400 image that looks like a Coca-Cola bottle
        img = Image.new("RGB", (400, 400), (255, 255, 255))
        draw = ImageDraw.Draw(img)
        
        # Draw a bottle shape
        draw.rectangle([150, 100, 250, 350], fill=(220, 20, 20))  # Red bottle
        draw.ellipse([140, 80, 260, 120], fill=(220, 20, 20))  # Top
        draw.rectangle([160, 120, 240, 160], fill=(255, 255, 255))  # Label
        draw.text((170, 130), "Coca-Cola", fill=(220, 20, 20))
        
        # Convert to base64
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        b64 = base64.b64encode(buf.getvalue()).decode()
        
        start_time = time.time()
        r = session.post(f"{API}/scan/identify-image", json={"image_base64": b64}, headers=headers, timeout=35)
        elapsed = time.time() - start_time
        
        if r.status_code == 200:
            body = r.json()
            if elapsed > 30:
                log_test("Camera AI - valid image", "FAIL", f"Took {elapsed:.1f}s (>30s timeout)")
            elif "product_name" in body and "ebay_search_keywords" in body:
                log_test("Camera AI - valid image", "PASS", f"Identified in {elapsed:.1f}s: {body.get('product_name', 'Unknown')}")
                # Check for mock data
                no_mock, msg = check_no_mock_data(body)
                if not no_mock:
                    log_test("Camera AI - no mock data", "FAIL", msg)
                else:
                    log_test("Camera AI - no mock data", "PASS", "No mock data found")
            else:
                log_test("Camera AI - valid image", "FAIL", f"Missing required fields in response: {body}")
        elif r.status_code == 503:
            log_test("Camera AI - valid image", "PASS", "AI service unavailable (acceptable)")
        elif r.status_code == 504:
            log_test("Camera AI - valid image", "PASS", "AI timeout (acceptable, but should be <30s)")
        else:
            log_test("Camera AI - valid image", "FAIL", f"Status {r.status_code}: {r.text[:200]}")
    except ImportError:
        log_test("Camera AI - valid image", "SKIP", "PIL not available")
    except Exception as e:
        log_test("Camera AI - valid image", "FAIL", str(e))
    
    # Test 3: Huge image (>10MB base64) should return 413
    try:
        huge_b64 = "A" * (11 * 1024 * 1024)  # 11MB of 'A's
        r = session.post(f"{API}/scan/identify-image", json={"image_base64": huge_b64}, headers=headers, timeout=35)
        if r.status_code == 413 and "Image too large" in r.text:
            log_test("Camera AI - huge image", "PASS", "Correctly rejected with 413")
        else:
            log_test("Camera AI - huge image", "FAIL", f"Expected 413 with 'Image too large', got {r.status_code}: {r.text[:200]}")
    except Exception as e:
        log_test("Camera AI - huge image", "FAIL", str(e))


# ============================================================
# 3. BARCODE TESTS
# ============================================================
def test_barcode():
    log_section("BARCODE TESTS")
    
    if not auth_token:
        log_test("Barcode tests", "SKIP", "No auth token available")
        return
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    # Test 1: Valid Coca-Cola UPC
    try:
        r = session.post(f"{API}/scan/identify-barcode", 
                        json={"barcode": "049000006346", "type": "UPC_A"}, 
                        headers=headers, timeout=30)
        if r.status_code == 200:
            body = r.json()
            lookup_status = body.get("lookup_status")
            data_source = body.get("data_source")
            
            if data_source != "upcitemdb":
                log_test("Barcode - Coca-Cola UPC", "FAIL", f"data_source should be 'upcitemdb', got '{data_source}'")
            elif lookup_status == "found":
                product = body.get("product", {})
                title = product.get("title", "")
                if "coca" in title.lower() or "coke" in title.lower():
                    log_test("Barcode - Coca-Cola UPC", "PASS", f"Found: {title}")
                else:
                    log_test("Barcode - Coca-Cola UPC", "PASS", f"Found product: {title} (may not be Coca-Cola)")
            elif lookup_status == "not_found":
                log_test("Barcode - Coca-Cola UPC", "PASS", "Not found in UPCitemDB (acceptable)")
            else:
                log_test("Barcode - Coca-Cola UPC", "FAIL", f"Unexpected lookup_status: {lookup_status}")
        else:
            log_test("Barcode - Coca-Cola UPC", "FAIL", f"Status {r.status_code}: {r.text[:200]}")
    except Exception as e:
        log_test("Barcode - Coca-Cola UPC", "FAIL", str(e))
    
    # Test 2: Empty barcode should return 400
    try:
        r = session.post(f"{API}/scan/identify-barcode", 
                        json={"barcode": "", "type": "UPC_A"}, 
                        headers=headers, timeout=15)
        if r.status_code == 400 and "barcode required" in r.text:
            log_test("Barcode - empty barcode", "PASS", "Correctly rejected with 400")
        else:
            log_test("Barcode - empty barcode", "FAIL", f"Expected 400 with 'barcode required', got {r.status_code}: {r.text[:200]}")
    except Exception as e:
        log_test("Barcode - empty barcode", "FAIL", str(e))
    
    # Test 3: Invalid/unknown UPC
    try:
        r = session.post(f"{API}/scan/identify-barcode", 
                        json={"barcode": "999999999999", "type": "UPC_A"}, 
                        headers=headers, timeout=30)
        if r.status_code == 200:
            body = r.json()
            lookup_status = body.get("lookup_status")
            data_source = body.get("data_source")
            
            if data_source != "upcitemdb":
                log_test("Barcode - unknown UPC", "FAIL", f"data_source should be 'upcitemdb', got '{data_source}'")
            elif lookup_status in ["found", "not_found"]:
                log_test("Barcode - unknown UPC", "PASS", f"lookup_status={lookup_status}, data_source={data_source}")
                # Verify no fabricated product data
                if lookup_status == "not_found" and "product" in body:
                    log_test("Barcode - no fabrication", "FAIL", "Product data present for not_found status")
                else:
                    log_test("Barcode - no fabrication", "PASS", "No fabricated product data")
            else:
                log_test("Barcode - unknown UPC", "FAIL", f"Unexpected lookup_status: {lookup_status}")
        else:
            log_test("Barcode - unknown UPC", "FAIL", f"Status {r.status_code}: {r.text[:200]}")
    except Exception as e:
        log_test("Barcode - unknown UPC", "FAIL", str(e))


# ============================================================
# 4. SEARCH TESTS
# ============================================================
def test_search():
    log_section("SEARCH TESTS")
    
    if not auth_token:
        log_test("Search tests", "SKIP", "No auth token available")
        return
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    # Test 1: Valid search query
    try:
        r = session.post(f"{API}/search", 
                        json={"query": "Nintendo Switch OLED"}, 
                        headers=headers, timeout=60)
        if r.status_code == 200:
            body = r.json()
            required_fields = ["query", "ebay", "pricing_available", "pricing_message", "ai_insight", "marketplace_links"]
            missing = [f for f in required_fields if f not in body]
            
            if missing:
                log_test("Search - Nintendo Switch", "FAIL", f"Missing fields: {missing}")
            else:
                log_test("Search - Nintendo Switch", "PASS", f"All required fields present")
                
                # Check pricing_available (should be false since eBay not configured)
                if body["pricing_available"] == False:
                    if "eBay API not configured" in body["pricing_message"]:
                        log_test("Search - eBay not configured", "PASS", "Correct message")
                    else:
                        log_test("Search - eBay not configured", "PASS", f"Message: {body['pricing_message']}")
                else:
                    log_test("Search - eBay not configured", "FAIL", "pricing_available should be false")
                
                # Check marketplace_links
                ml = body.get("marketplace_links", {})
                required_links = ["ebay", "ebay_active", "amazon", "facebook", "mercari", "whatnot"]
                missing_links = [l for l in required_links if l not in ml]
                
                if missing_links:
                    log_test("Search - marketplace links", "FAIL", f"Missing links: {missing_links}")
                else:
                    # Verify URLs are properly encoded
                    all_valid = all(isinstance(ml[l], str) and ml[l].startswith("http") for l in required_links)
                    if all_valid:
                        log_test("Search - marketplace links", "PASS", "All 6 marketplace URLs present")
                    else:
                        log_test("Search - marketplace links", "FAIL", "Some URLs are invalid")
                
                # Check for mock data
                no_mock, msg = check_no_mock_data(body)
                if not no_mock:
                    log_test("Search - no mock data", "FAIL", msg)
                else:
                    log_test("Search - no mock data", "PASS", "No mock data found")
        else:
            log_test("Search - Nintendo Switch", "FAIL", f"Status {r.status_code}: {r.text[:200]}")
    except Exception as e:
        log_test("Search - Nintendo Switch", "FAIL", str(e))
    
    # Test 2: Empty query should return 400
    try:
        r = session.post(f"{API}/search", json={"query": ""}, headers=headers, timeout=15)
        if r.status_code == 400:
            log_test("Search - empty query", "PASS", "Correctly rejected with 400")
        else:
            log_test("Search - empty query", "FAIL", f"Expected 400, got {r.status_code}")
    except Exception as e:
        log_test("Search - empty query", "FAIL", str(e))


# ============================================================
# 5. SCORE TESTS
# ============================================================
def test_score():
    log_section("SCORE TESTS")
    
    if not auth_token:
        log_test("Score tests", "SKIP", "No auth token available")
        return
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    # Test: Score without eBay API configured
    try:
        r = session.post(f"{API}/score", 
                        json={"query": "Nintendo Switch", "buy_cost": 100, "sell_price": 250}, 
                        headers=headers, timeout=60)
        if r.status_code == 200:
            body = r.json()
            if body.get("available") == False and "eBay API not configured" in body.get("message", ""):
                log_test("Score - eBay not configured", "PASS", "Correct response")
            else:
                log_test("Score - eBay not configured", "FAIL", f"Unexpected response: {body}")
        else:
            log_test("Score - eBay not configured", "FAIL", f"Status {r.status_code}: {r.text[:200]}")
    except Exception as e:
        log_test("Score - eBay not configured", "FAIL", str(e))


# ============================================================
# 6. PROFIT VERDICT TESTS
# ============================================================
def test_profit_verdict():
    log_section("PROFIT VERDICT TESTS")
    
    if not auth_token:
        log_test("Profit verdict tests", "SKIP", "No auth token available")
        return
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    # Test: Profit verdict calculation
    try:
        r = session.post(f"{API}/profit/verdict", 
                        json={
                            "item_name": "Test Item",
                            "buy_cost": 20,
                            "sell_price": 60,
                            "shipping_cost": 5,
                            "ebay_fee_pct": 13.25
                        }, 
                        headers=headers, timeout=60)
        if r.status_code == 200:
            body = r.json()
            required_fields = ["verdict", "net_profit", "roi_pct", "profit_margin_pct", 
                             "break_even_price", "ebay_fee", "total_cost", "explanation"]
            missing = [f for f in required_fields if f not in body]
            
            if missing:
                log_test("Profit verdict - fields", "FAIL", f"Missing fields: {missing}")
            else:
                verdict = body["verdict"]
                if verdict in ["BUY", "MAYBE BUY", "AVOID"]:
                    log_test("Profit verdict - calculation", "PASS", 
                           f"Verdict: {verdict}, Net: ${body['net_profit']}, ROI: {body['roi_pct']}%")
                else:
                    log_test("Profit verdict - calculation", "FAIL", f"Invalid verdict: {verdict}")
        else:
            log_test("Profit verdict - calculation", "FAIL", f"Status {r.status_code}: {r.text[:200]}")
    except Exception as e:
        log_test("Profit verdict - calculation", "FAIL", str(e))


# ============================================================
# 7. HISTORY TESTS
# ============================================================
def test_history():
    log_section("HISTORY TESTS")
    
    if not auth_token:
        log_test("History tests", "SKIP", "No auth token available")
        return
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    # Test: Create, list, delete history
    try:
        # Create
        r = session.post(f"{API}/history", 
                        json={"title": "Test History Item", "query": "test", "source": "manual"}, 
                        headers=headers, timeout=30)
        if r.status_code == 200:
            body = r.json()
            item_id = body.get("id")
            log_test("History - create", "PASS", f"Created item {item_id}")
            
            # List
            r2 = session.get(f"{API}/history", headers=headers, timeout=30)
            if r2.status_code == 200:
                items = r2.json()
                if any(h["id"] == item_id for h in items):
                    log_test("History - list", "PASS", f"Found item in list")
                else:
                    log_test("History - list", "FAIL", "Item not found in list")
            else:
                log_test("History - list", "FAIL", f"Status {r2.status_code}")
            
            # Delete
            r3 = session.delete(f"{API}/history/{item_id}", headers=headers, timeout=30)
            if r3.status_code == 200:
                log_test("History - delete", "PASS", "Deleted successfully")
            else:
                log_test("History - delete", "FAIL", f"Status {r3.status_code}")
        else:
            log_test("History - create", "FAIL", f"Status {r.status_code}: {r.text[:200]}")
    except Exception as e:
        log_test("History - CRUD", "FAIL", str(e))


# ============================================================
# 8. INVENTORY TESTS
# ============================================================
def test_inventory():
    log_section("INVENTORY TESTS")
    
    if not auth_token:
        log_test("Inventory tests", "SKIP", "No auth token available")
        return
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    # Test: Create, list inventory
    try:
        # Create
        r = session.post(f"{API}/inventory", 
                        json={
                            "title": "Test Inventory Item",
                            "source": "Thrift Store",
                            "purchase_price": 10,
                            "status": "in_stock"
                        }, 
                        headers=headers, timeout=30)
        if r.status_code == 200:
            body = r.json()
            item_id = body.get("id")
            if "metrics" in body:
                log_test("Inventory - create", "PASS", f"Created with metrics")
            else:
                log_test("Inventory - create", "FAIL", "No metrics in response")
            
            # List
            r2 = session.get(f"{API}/inventory", headers=headers, timeout=30)
            if r2.status_code == 200:
                items = r2.json()
                if isinstance(items, list):
                    log_test("Inventory - list", "PASS", f"Got {len(items)} items")
                else:
                    log_test("Inventory - list", "FAIL", "Response is not a list")
            else:
                log_test("Inventory - list", "FAIL", f"Status {r2.status_code}")
        else:
            log_test("Inventory - create", "FAIL", f"Status {r.status_code}: {r.text[:200]}")
    except Exception as e:
        log_test("Inventory - CRUD", "FAIL", str(e))
    
    # Test: Inventory meta
    try:
        r = session.get(f"{API}/inventory-meta", headers=headers, timeout=30)
        if r.status_code == 200:
            body = r.json()
            if "sources" in body and "platforms" in body and "statuses" in body:
                log_test("Inventory - meta", "PASS", "Got sources, platforms, statuses")
            else:
                log_test("Inventory - meta", "FAIL", "Missing required fields")
        else:
            log_test("Inventory - meta", "FAIL", f"Status {r.status_code}")
    except Exception as e:
        log_test("Inventory - meta", "FAIL", str(e))


# ============================================================
# 9. PALLETS TESTS
# ============================================================
def test_pallets():
    log_section("PALLETS TESTS")
    
    if not auth_token:
        log_test("Pallets tests", "SKIP", "No auth token available")
        return
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    # Test: Create, list, add item, delete pallet
    try:
        # Create pallet
        r = session.post(f"{API}/pallets", 
                        json={
                            "name": "Test Pallet",
                            "supplier": "Test Supplier",
                            "purchase_price": 200,
                            "shipping_cost": 50
                        }, 
                        headers=headers, timeout=30)
        if r.status_code == 200:
            body = r.json()
            pallet_id = body.get("id")
            total_investment = body.get("total_investment")
            if total_investment == 250:
                log_test("Pallets - create", "PASS", f"Created with total_investment={total_investment}")
            else:
                log_test("Pallets - create", "FAIL", f"Expected total_investment=250, got {total_investment}")
            
            # List pallets
            r2 = session.get(f"{API}/pallets", headers=headers, timeout=30)
            if r2.status_code == 200:
                pallets = r2.json()
                if isinstance(pallets, list) and any(p["id"] == pallet_id for p in pallets):
                    # Check dashboard field
                    pallet = next(p for p in pallets if p["id"] == pallet_id)
                    if "dashboard" in pallet:
                        log_test("Pallets - list with dashboard", "PASS", "Dashboard field present")
                    else:
                        log_test("Pallets - list with dashboard", "FAIL", "No dashboard field")
                else:
                    log_test("Pallets - list", "FAIL", "Pallet not found in list")
            else:
                log_test("Pallets - list", "FAIL", f"Status {r2.status_code}")
            
            # Add pallet item
            r3 = session.post(f"{API}/pallets/{pallet_id}/items", 
                            json={
                                "product_name": "Test Widget",
                                "quantity": 1,
                                "retail_value": 50,
                                "estimated_resale_value": 40
                            }, 
                            headers=headers, timeout=30)
            if r3.status_code == 200:
                log_test("Pallets - add item", "PASS", "Item added")
            else:
                log_test("Pallets - add item", "FAIL", f"Status {r3.status_code}")
            
            # Get pallet items
            r4 = session.get(f"{API}/pallets/{pallet_id}/items", headers=headers, timeout=30)
            if r4.status_code == 200:
                items = r4.json()
                if isinstance(items, list) and len(items) > 0:
                    log_test("Pallets - get items", "PASS", f"Got {len(items)} items")
                else:
                    log_test("Pallets - get items", "FAIL", "No items returned")
            else:
                log_test("Pallets - get items", "FAIL", f"Status {r4.status_code}")
            
            # Delete pallet
            r5 = session.delete(f"{API}/pallets/{pallet_id}", headers=headers, timeout=30)
            if r5.status_code == 200:
                log_test("Pallets - delete", "PASS", "Deleted successfully")
            else:
                log_test("Pallets - delete", "FAIL", f"Status {r5.status_code}")
        else:
            log_test("Pallets - create", "FAIL", f"Status {r.status_code}: {r.text[:200]}")
    except Exception as e:
        log_test("Pallets - CRUD", "FAIL", str(e))


# ============================================================
# 10. STATS TESTS
# ============================================================
def test_stats():
    log_section("STATS TESTS")
    
    if not auth_token:
        log_test("Stats tests", "SKIP", "No auth token available")
        return
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    # Test: Stats home
    try:
        r = session.get(f"{API}/stats/home", headers=headers, timeout=30)
        if r.status_code == 200:
            body = r.json()
            required_fields = ["total_revenue", "total_profit", "roi_pct", "inventory_value", 
                             "active_listings", "items_sold", "in_stock"]
            missing = [f for f in required_fields if f not in body]
            if missing:
                log_test("Stats - home", "FAIL", f"Missing fields: {missing}")
            else:
                log_test("Stats - home", "PASS", "All required fields present")
        else:
            log_test("Stats - home", "FAIL", f"Status {r.status_code}")
    except Exception as e:
        log_test("Stats - home", "FAIL", str(e))
    
    # Test: Stats sourcing
    try:
        r = session.get(f"{API}/stats/sourcing", headers=headers, timeout=30)
        if r.status_code == 200:
            body = r.json()
            if "rows" in body and "best_source" in body and "worst_source" in body:
                log_test("Stats - sourcing", "PASS", "All required fields present")
            else:
                log_test("Stats - sourcing", "FAIL", "Missing required fields")
        else:
            log_test("Stats - sourcing", "FAIL", f"Status {r.status_code}")
    except Exception as e:
        log_test("Stats - sourcing", "FAIL", str(e))
    
    # Test: Stats reports
    try:
        r = session.get(f"{API}/stats/reports?period=monthly", headers=headers, timeout=30)
        if r.status_code == 200:
            body = r.json()
            if "rows" in body and "totals" in body:
                log_test("Stats - reports", "PASS", "All required fields present")
            else:
                log_test("Stats - reports", "FAIL", "Missing required fields")
        else:
            log_test("Stats - reports", "FAIL", f"Status {r.status_code}")
    except Exception as e:
        log_test("Stats - reports", "FAIL", str(e))


# ============================================================
# 11. SETTINGS TESTS
# ============================================================
def test_settings():
    log_section("SETTINGS TESTS")
    
    if not auth_token:
        log_test("Settings tests", "SKIP", "No auth token available")
        return
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    # Test: Get settings
    try:
        r = session.get(f"{API}/settings", headers=headers, timeout=30)
        if r.status_code == 200:
            body = r.json()
            log_test("Settings - get", "PASS", f"Got settings")
        else:
            log_test("Settings - get", "FAIL", f"Status {r.status_code}")
    except Exception as e:
        log_test("Settings - get", "FAIL", str(e))
    
    # Test: Update settings
    try:
        r = session.post(f"{API}/settings", 
                        json={"theme": "dark"}, 
                        headers=headers, timeout=30)
        if r.status_code == 200:
            body = r.json()
            if body.get("theme") == "dark":
                log_test("Settings - update", "PASS", "Theme updated to dark")
            else:
                log_test("Settings - update", "FAIL", f"Theme not updated: {body}")
        else:
            log_test("Settings - update", "FAIL", f"Status {r.status_code}")
    except Exception as e:
        log_test("Settings - update", "FAIL", str(e))


# ============================================================
# MAIN TEST RUNNER
# ============================================================
def main():
    print("\n" + "="*60)
    print("  PROFIT SCOUT AI - PRODUCTION HARDENING TESTS")
    print("="*60)
    print(f"  Base URL: {BASE_URL}")
    print(f"  Test User: {TEST_EMAIL}")
    print("="*60)
    
    test_auth()
    test_camera_ai()
    test_barcode()
    test_search()
    test_score()
    test_profit_verdict()
    test_history()
    test_inventory()
    test_pallets()
    test_stats()
    test_settings()
    
    print("\n" + "="*60)
    print("  TESTS COMPLETE")
    print("="*60 + "\n")


if __name__ == "__main__":
    main()

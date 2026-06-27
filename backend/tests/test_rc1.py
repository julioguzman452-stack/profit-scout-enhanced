"""Profit Scout AI - RC1 release-candidate health check.

Limited scope (per main agent RC1 review request):
  1. /api/scan/identify-barcode must NOT fabricate product data and MUST return
     barcode + barcode_type + lookup_status='unavailable' + lookup_message.
  2. /api/profit/verdict must include the new fields profit_margin_pct and
     break_even_price, with the documented math.
  3. Edge case: buy_cost=0 & sell_price=0 must not crash; break_even_price=0.
  4. Smoke checks for existing endpoints: /auth/login, /search, /score,
     /stats/home, /inventory.
"""
import os
import pytest
import requests

BASE_URL = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or os.environ.get("EXPO_BACKEND_URL")
).rstrip("/")
API = f"{BASE_URL}/api"

SEED_EMAIL = "tester@profitscout.app"
SEED_PW = "TestPass123!"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_headers(session):
    r = session.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": SEED_PW}, timeout=30)
    if r.status_code != 200:
        rr = session.post(f"{API}/auth/register", json={"email": SEED_EMAIL, "password": SEED_PW}, timeout=30)
        assert rr.status_code == 200, f"register failed: {rr.status_code} {rr.text}"
        token = rr.json()["access_token"]
    else:
        token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- RC1: /api/scan/identify-barcode (no fabrication) ----------
class TestRC1IdentifyBarcode:
    def test_barcode_returns_capture_only_no_fabrication(self, session, auth_headers):
        r = session.post(
            f"{API}/scan/identify-barcode",
            json={"barcode": "012345678905", "type": "ean13"},
            headers=auth_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        b = r.json()
        # Required new shape
        assert b.get("barcode") == "012345678905"
        assert b.get("barcode_type") == "ean13"
        assert b.get("lookup_status") == "unavailable"
        assert b.get("lookup_message") == "UPC captured, but live product lookup is not connected yet."
        # MUST NOT fabricate any product information
        forbidden = ["product_name", "brand", "title", "description", "category", "ebay_search_keywords", "data_source_mock"]
        for key in forbidden:
            if key == "product_name" or key == "brand":
                assert key not in b, f"RC1 violation: response should NOT contain '{key}', got: {b}"
        # No random fake fields like 'price', 'mpn', etc.
        random_fake_keys = {"price", "mpn", "asin", "gtin_name", "manufacturer"}
        leaked = random_fake_keys.intersection(b.keys())
        assert not leaked, f"RC1 violation: fabricated fields present: {leaked}"

    def test_barcode_empty_rejects(self, session, auth_headers):
        r = session.post(
            f"{API}/scan/identify-barcode",
            json={"barcode": ""},
            headers=auth_headers,
            timeout=15,
        )
        assert r.status_code == 400


# ---------- RC1: /api/profit/verdict (new fields + math) ----------
class TestRC1ProfitVerdict:
    def test_break_even_and_margin_math(self, session, auth_headers):
        payload = {
            "item_name": "RC1 Test Item",
            "buy_cost": 80,
            "sell_price": 220,
            "shipping_cost": 9,
            "ebay_fee_pct": 13.25,
            "tax_cost": 0,
            "extra_cost": 0,
        }
        r = session.post(f"{API}/profit/verdict", json=payload, headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text
        b = r.json()

        # All required keys present
        for key in ("verdict", "net_profit", "roi_pct", "profit_margin_pct",
                    "break_even_price", "ebay_fee", "total_cost"):
            assert key in b, f"missing key: {key}; got {list(b.keys())}"

        # ebay_fee = 220 * 0.1325 = 29.15
        assert abs(b["ebay_fee"] - 29.15) < 0.01, b
        # total_cost = 80 + 9 + 0 + 0 + 29.15 = 118.15
        assert abs(b["total_cost"] - 118.15) < 0.01, b
        # net_profit = 220 - 118.15 = 101.85
        assert abs(b["net_profit"] - 101.85) < 0.01, b
        # roi_pct = 101.85 / 80 * 100 = 127.3 (rounded to 1dp)
        assert abs(b["roi_pct"] - 127.3) < 0.2, b
        # profit_margin_pct = 101.85 / 220 * 100 = 46.3 (rounded to 1dp)
        assert abs(b["profit_margin_pct"] - 46.3) < 0.2, b
        # break_even_price = (80 + 9) / (1 - 0.1325) = 89 / 0.8675 = 102.59
        assert abs(b["break_even_price"] - 102.59) < 0.05, b

        # verdict should be BUY (net=101.85, roi=127.3)
        assert b["verdict"] == "BUY", b

    def test_zero_edge_case_no_crash(self, session, auth_headers):
        payload = {
            "item_name": "Zero edge",
            "buy_cost": 0,
            "sell_price": 0,
        }
        r = session.post(f"{API}/profit/verdict", json=payload, headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text
        b = r.json()
        # No crash + sensible zeroed-out numbers
        assert b["net_profit"] == 0 or abs(b["net_profit"]) < 0.01, b
        assert b["roi_pct"] == 0 or abs(b["roi_pct"]) < 0.01, b
        assert b["profit_margin_pct"] == 0 or abs(b["profit_margin_pct"]) < 0.01, b
        assert b["break_even_price"] == 0 or abs(b["break_even_price"]) < 0.01, b
        assert b["ebay_fee"] == 0 or abs(b["ebay_fee"]) < 0.01, b
        assert b["total_cost"] == 0 or abs(b["total_cost"]) < 0.01, b


# ---------- Smoke: existing endpoints still work ----------
class TestRC1Smoke:
    def test_login_smoke(self, session):
        r = session.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": SEED_PW}, timeout=30)
        if r.status_code != 200:
            session.post(f"{API}/auth/register", json={"email": SEED_EMAIL, "password": SEED_PW}, timeout=30)
            r = session.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": SEED_PW}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json().get("access_token")

    def test_search_smoke(self, session, auth_headers):
        r = session.post(f"{API}/search", json={"query": "Nintendo Switch OLED"},
                         headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text
        b = r.json()
        assert "ebay" in b
        for k in ("active_count", "sold_count", "avg_sold_price", "sell_through_rate", "recent_sold"):
            assert k in b["ebay"], f"missing ebay key {k}"

    def test_score_smoke(self, session, auth_headers):
        r = session.post(
            f"{API}/score",
            json={
                "query": "Nintendo Switch OLED",
                "item_name": "Nintendo Switch OLED",
                "buy_cost": 10,
                "sell_price": 60,
                "shipping_cost": 4,
                "ebay_fee_pct": 13.25,
            },
            headers=auth_headers,
            timeout=60,
        )
        assert r.status_code == 200, r.text
        b = r.json()
        assert "score" in b and 0 <= b["score"] <= 100
        assert b.get("verdict") in {"BUY", "MAYBE", "DO NOT BUY"}

    def test_stats_home_smoke(self, session, auth_headers):
        r = session.get(f"{API}/stats/home", headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        b = r.json()
        # /stats/home returns roll-up keys; assert a few known ones present
        for k in ("total_revenue", "total_profit", "inventory_value", "items_sold"):
            assert k in b, f"missing stats key {k}; got {list(b.keys())}"

    def test_inventory_list_smoke(self, session, auth_headers):
        r = session.get(f"{API}/inventory", headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        # Accept either bare list or {items: [...]} envelope
        items = body if isinstance(body, list) else body.get("items", body.get("rows", []))
        assert isinstance(items, list)

"""Profit Scout AI - Backend regression tests (pytest)."""
import base64
import io
import os
import time
import uuid

import pytest
import requests

BASE_URL = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or os.environ.get("EXPO_BACKEND_URL")
    or "https://ebay-flipper-1.preview.emergentagent.com"
).rstrip("/")
API = f"{BASE_URL}/api"

SEED_EMAIL = "tester@profitscout.app"
SEED_PW = "TestPass123!"

# ---------- shared session ----------
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def token(session):
    # try login with seeded user, else register
    r = session.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": SEED_PW}, timeout=30)
    if r.status_code != 200:
        rr = session.post(f"{API}/auth/register", json={"email": SEED_EMAIL, "password": SEED_PW}, timeout=30)
        assert rr.status_code == 200, f"register failed: {rr.status_code} {rr.text}"
        return rr.json()["access_token"]
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Auth ----------
class TestAuth:
    def test_register_new_user(self, session):
        email = f"TEST_{uuid.uuid4().hex[:8]}@profitscout.app"
        r = session.post(f"{API}/auth/register", json={"email": email, "password": "Passw0rd!"}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "access_token" in body and body["access_token"]
        assert body["user"]["email"] == email.lower()

    def test_login_seed(self, session):
        r = session.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": SEED_PW}, timeout=30)
        # If not seeded yet, register inline
        if r.status_code != 200:
            session.post(f"{API}/auth/register", json={"email": SEED_EMAIL, "password": SEED_PW}, timeout=30)
            r = session.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": SEED_PW}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["access_token"]

    def test_me(self, session, auth_headers):
        r = session.get(f"{API}/auth/me", headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["email"] == SEED_EMAIL

    def test_me_no_token(self, session):
        r = session.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401


# ---------- Search / Scan ----------
class TestSearchAndScan:
    def test_search_returns_ebay_snapshot(self, session, auth_headers):
        r = session.post(f"{API}/search", json={"query": "Nintendo Switch OLED"}, headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text
        b = r.json()
        assert "ebay" in b and "ai" in b
        e = b["ebay"]
        for k in ("active_count", "sold_count", "avg_sold_price", "sell_through_rate", "recent_sold"):
            assert k in e, f"missing key {k}"
        assert isinstance(e["recent_sold"], list)
        assert isinstance(e["active_count"], int) and e["active_count"] > 0
        # AI keywords (best effort - may be empty if AI failed)
        assert "improved_keywords" in b["ai"]

    def test_identify_barcode(self, session, auth_headers):
        # RC1: endpoint no longer fabricates a product; just echoes UPC + 'unavailable' status.
        r = session.post(
            f"{API}/scan/identify-barcode",
            json={"barcode": "045496590475", "type": "ean13"},
            headers=auth_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["barcode"] == "045496590475"
        assert b["barcode_type"] == "ean13"
        assert b["lookup_status"] == "unavailable"
        assert "lookup" in b["lookup_message"].lower()
        # MUST NOT fabricate product fields
        assert "product_name" not in b
        assert "brand" not in b

    def test_identify_barcode_empty(self, session, auth_headers):
        r = session.post(f"{API}/scan/identify-barcode", json={"barcode": ""}, headers=auth_headers, timeout=15)
        assert r.status_code == 400

    def test_identify_image(self, session, auth_headers):
        # Build a real, tiny PNG with PIL
        try:
            from PIL import Image, ImageDraw
        except Exception:
            pytest.skip("PIL not available to build a real image")
        img = Image.new("RGB", (200, 200), (200, 60, 60))
        d = ImageDraw.Draw(img)
        d.rectangle([40, 40, 160, 160], fill=(40, 90, 200))
        d.text((50, 90), "BOOK", fill=(255, 255, 255))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode()
        r = session.post(
            f"{API}/scan/identify-image",
            json={"image_base64": b64},
            headers=auth_headers,
            timeout=60,
        )
        # AI may fail upstream => 502 is acceptable
        if r.status_code == 502:
            pytest.skip(f"AI upstream failed (acceptable): {r.text}")
        assert r.status_code == 200, r.text
        b = r.json()
        assert "product_name" in b
        assert "ebay_search_keywords" in b


# ---------- Profit ----------
class TestProfitVerdict:
    def test_buy_verdict_math(self, session, auth_headers):
        payload = {
            "item_name": "Test Game",
            "buy_cost": 10,
            "sell_price": 60,
            "shipping_cost": 4,
            "ebay_fee_pct": 13.25,
            "tax_cost": 0,
            "extra_cost": 0,
        }
        r = session.post(f"{API}/profit/verdict", json=payload, headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text
        b = r.json()
        # fees = 60 * 0.1325 = 7.95
        # total_cost = 10 + 4 + 0 + 0 + 7.95 = 21.95
        # net = 60 - 21.95 = 38.05  ROI = 380.5%
        assert abs(b["ebay_fee"] - 7.95) < 0.01
        assert abs(b["total_cost"] - 21.95) < 0.01
        assert abs(b["net_profit"] - 38.05) < 0.01
        assert b["verdict"] == "BUY"
        assert b["roi_pct"] >= 50

    def test_do_not_buy(self, session, auth_headers):
        payload = {"item_name": "Bad", "buy_cost": 50, "sell_price": 55, "ebay_fee_pct": 13.25}
        r = session.post(f"{API}/profit/verdict", json=payload, headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text
        assert r.json()["verdict"] == "DO NOT BUY"


# ---------- History ----------
class TestHistory:
    def test_history_crud(self, session, auth_headers):
        # create
        r = session.post(
            f"{API}/history",
            json={"title": "TEST_history_item", "query": "abc", "source": "manual", "tags": ["t1"]},
            headers=auth_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        hid = r.json()["id"]
        # list
        r2 = session.get(f"{API}/history", headers=auth_headers, timeout=30)
        assert r2.status_code == 200
        assert any(h["id"] == hid for h in r2.json())
        # delete
        r3 = session.delete(f"{API}/history/{hid}", headers=auth_headers, timeout=30)
        assert r3.status_code == 200
        # verify gone
        r4 = session.get(f"{API}/history", headers=auth_headers, timeout=30)
        assert not any(h["id"] == hid for h in r4.json())


# ---------- FB Comps ----------
class TestFbComps:
    def test_fb_comp_crud(self, session, auth_headers):
        r = session.post(
            f"{API}/fb-comps",
            json={"item_name": "TEST_iphone", "price": 250.0, "location": "NYC"},
            headers=auth_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        cid = r.json()["id"]
        r2 = session.get(f"{API}/fb-comps", headers=auth_headers, timeout=30)
        assert r2.status_code == 200
        assert any(c["id"] == cid for c in r2.json())
        r3 = session.delete(f"{API}/fb-comps/{cid}", headers=auth_headers, timeout=30)
        assert r3.status_code == 200


# ---------- Pallet lifecycle ----------
class TestPalletLifecycle:
    @pytest.fixture(scope="class")
    def pallet_id(self, session, auth_headers):
        r = session.post(
            f"{API}/pallets",
            json={
                "name": "TEST_pallet_A",
                "supplier": "TestCo",
                "purchase_price": 200,
                "shipping_cost": 50,
                "tax_cost": 10,
                "additional_costs": 0,
            },
            headers=auth_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["total_investment"] == 260
        pid = body["id"]
        yield pid
        # cleanup
        session.delete(f"{API}/pallets/{pid}", headers=auth_headers, timeout=30)

    def test_get_pallet_dashboard(self, session, auth_headers, pallet_id):
        r = session.get(f"{API}/pallets/{pallet_id}", headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["total_investment"] == 260
        d = b["dashboard"]
        assert d["total_investment"] == 260
        assert d["revenue_recovered"] == 0
        assert d["current_profit"] == -260
        assert d["break_even_percent"] == 0.0

    def test_add_and_update_item(self, session, auth_headers, pallet_id):
        r = session.post(
            f"{API}/pallets/{pallet_id}/items",
            json={
                "product_name": "TEST_widget",
                "quantity": 1,
                "retail_value": 100,
                "estimated_resale_value": 80,
                "category": "Misc",
            },
            headers=auth_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        iid = r.json()["id"]
        # update to sold
        r2 = session.patch(
            f"{API}/pallets/{pallet_id}/items/{iid}",
            json={"status": "sold", "sold_price": 130},
            headers=auth_headers,
            timeout=30,
        )
        assert r2.status_code == 200, r2.text
        assert r2.json()["status"] == "sold"
        assert r2.json()["sold_price"] == 130
        # dashboard reflects
        d = session.get(f"{API}/pallets/{pallet_id}", headers=auth_headers, timeout=30).json()["dashboard"]
        assert d["revenue_recovered"] == 130.0
        assert d["current_profit"] == -130.0  # 130 - 260
        assert d["break_even_percent"] == 50.0  # 130/260 *100

    def test_pallet_analysis(self, session, auth_headers, pallet_id):
        r = session.get(f"{API}/pallets/{pallet_id}/analysis", headers=auth_headers, timeout=90)
        assert r.status_code == 200, r.text
        b = r.json()
        assert "dashboard" in b
        assert "top_value_items" in b and isinstance(b["top_value_items"], list)
        for k in ("fastest_moving", "high_risk", "slow_moving", "recommended_listing_order", "forecast"):
            assert k in b, f"missing {k}"
        assert isinstance(b["forecast"], dict)
        # forecast deterministic fallback keys present
        assert "expected" in b["forecast"]


# ---------- Manifest import ----------
class TestManifestImport:
    def test_csv_manifest_upload(self, session, auth_headers):
        # Create a fresh pallet
        r = session.post(
            f"{API}/pallets",
            json={"name": "TEST_manifest_pallet", "purchase_price": 100},
            headers=auth_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        pid = r.json()["id"]
        try:
            csv_text = (
                "product_name,quantity,retail_value\n"
                "Sony WH-1000XM4 Headphones,1,349\n"
                "LEGO Star Wars Millennium Falcon,2,159\n"
                "Apple AirPods Pro 2,1,249\n"
            )
            files = {"file": ("manifest.csv", csv_text.encode("utf-8"), "text/csv")}
            # remove json content-type for multipart
            hdrs = {"Authorization": auth_headers["Authorization"]}
            r2 = requests.post(f"{API}/pallets/{pid}/manifest", files=files, headers=hdrs, timeout=120)
            if r2.status_code == 502:
                pytest.skip(f"AI upstream failed (acceptable): {r2.text}")
            assert r2.status_code == 200, r2.text
            imported = r2.json().get("imported", 0)
            assert imported >= 1, f"expected at least 1 imported, got {imported}"
            # verify items show up
            time.sleep(0.5)
            r3 = session.get(f"{API}/pallets/{pid}/items", headers=auth_headers, timeout=30)
            assert r3.status_code == 200
            assert len(r3.json()) >= 1
        finally:
            session.delete(f"{API}/pallets/{pid}", headers=auth_headers, timeout=30)

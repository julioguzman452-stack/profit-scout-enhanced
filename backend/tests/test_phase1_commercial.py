"""
Profit Scout AI — Phase 1 MVP commercial backend tests.

Covers (new):
- Inventory CRUD + metrics math
- Inventory list filtering (status, source)
- Inventory CSV export
- /inventory-meta source & platform vocabularies
- /stats/home, /stats/sourcing, /stats/reports (daily/weekly/monthly/yearly)
- /score (Profit Scout Score)
- /settings GET/POST round-trip
- Regression: prior /api/auth, /api/search, /api/profit/verdict, /api/pallets, /api/history
"""
import os
import uuid

import pytest
import requests

BASE_URL = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or os.environ.get("EXPO_BACKEND_URL")
).rstrip("/")
API = f"{BASE_URL}/api"

SEED_EMAIL = "tester@profitscout.app"
SEED_PW = "TestPass123!"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def token(session):
    r = session.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": SEED_PW}, timeout=30)
    if r.status_code != 200:
        rr = session.post(
            f"{API}/auth/register", json={"email": SEED_EMAIL, "password": SEED_PW}, timeout=30
        )
        assert rr.status_code == 200, f"register failed: {rr.status_code} {rr.text}"
        return rr.json()["access_token"]
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# Use a fresh user for stats-only deterministic tests, so seeded user's
# existing inventory doesn't pollute aggregate assertions.
@pytest.fixture(scope="module")
def fresh_user_headers(session):
    email = f"TEST_{uuid.uuid4().hex[:10]}@profitscout.app"
    r = session.post(f"{API}/auth/register", json={"email": email, "password": "Passw0rd!"}, timeout=30)
    assert r.status_code == 200, r.text
    tok = r.json()["access_token"]
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---------- Inventory CRUD + metrics ----------
class TestInventoryCRUD:
    created_ids: list = []

    def test_create_inventory_metrics_math(self, session, fresh_user_headers):
        payload = {
            "title": "TEST_metrics_item",
            "source": "Whatnot",
            "purchase_price": 80,
            "sale_price": 220,
            "fees": 29,
            "shipping": 9,
            "tax": 0,
            "packaging": 0,
            "misc": 0,
            "status": "sold",
            "platform": "eBay",
            "category": "Games",
        }
        r = session.post(f"{API}/inventory", json=payload, headers=fresh_user_headers, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["id"]
        m = body["metrics"]
        assert m["total_cost"] == 118.0, m
        assert m["net_profit"] == 102.0, m
        assert m["roi_pct"] == 127.5, m
        assert abs(m["profit_margin_pct"] - 46.4) < 0.2, m
        # status sold auto-set date_sold
        assert body.get("status") == "sold"
        TestInventoryCRUD.created_ids.append(body["id"])

    def test_get_returns_same_metrics(self, session, fresh_user_headers):
        iid = TestInventoryCRUD.created_ids[0]
        r = session.get(f"{API}/inventory/{iid}", headers=fresh_user_headers, timeout=30)
        assert r.status_code == 200
        m = r.json()["metrics"]
        assert m["total_cost"] == 118.0
        assert m["net_profit"] == 102.0
        assert m["roi_pct"] == 127.5

    def test_list_and_status_filter(self, session, fresh_user_headers):
        # add an in_stock item
        in_stock = session.post(
            f"{API}/inventory",
            json={
                "title": "TEST_in_stock_a",
                "source": "Garage Sale",
                "purchase_price": 20,
                "fees": 0,
                "shipping": 0,
                "status": "in_stock",
                "category": "Misc",
            },
            headers=fresh_user_headers,
            timeout=30,
        )
        assert in_stock.status_code == 200
        TestInventoryCRUD.created_ids.append(in_stock.json()["id"])

        all_items = session.get(f"{API}/inventory", headers=fresh_user_headers, timeout=30).json()
        assert any(it["title"] == "TEST_in_stock_a" for it in all_items)
        assert any(it["title"] == "TEST_metrics_item" for it in all_items)

        sold = session.get(f"{API}/inventory?status=sold", headers=fresh_user_headers, timeout=30).json()
        assert all(it["status"] == "sold" for it in sold)
        assert any(it["title"] == "TEST_metrics_item" for it in sold)

        stock = session.get(
            f"{API}/inventory?status=in_stock", headers=fresh_user_headers, timeout=30
        ).json()
        assert all(it["status"] == "in_stock" for it in stock)

    def test_patch_status_to_sold_autosets_date_sold(self, session, fresh_user_headers):
        # create in_stock with no date_sold
        r = session.post(
            f"{API}/inventory",
            json={
                "title": "TEST_will_be_sold",
                "source": "Flea Market",
                "purchase_price": 10,
                "sale_price": 30,
                "fees": 4,
                "shipping": 2,
                "status": "in_stock",
            },
            headers=fresh_user_headers,
            timeout=30,
        )
        assert r.status_code == 200
        iid = r.json()["id"]
        TestInventoryCRUD.created_ids.append(iid)
        # patch
        r2 = session.patch(
            f"{API}/inventory/{iid}",
            json={"status": "sold"},
            headers=fresh_user_headers,
            timeout=30,
        )
        assert r2.status_code == 200, r2.text
        body = r2.json()
        assert body["status"] == "sold"
        assert body.get("date_sold"), "PATCH should auto-set date_sold when status becomes sold"

    def test_delete(self, session, fresh_user_headers):
        # delete the in_stock_a from earlier
        target_id = None
        for iid in TestInventoryCRUD.created_ids:
            doc = session.get(f"{API}/inventory/{iid}", headers=fresh_user_headers, timeout=15).json()
            if doc.get("title") == "TEST_in_stock_a":
                target_id = iid
                break
        assert target_id, "expected to find TEST_in_stock_a id"
        r = session.delete(f"{API}/inventory/{target_id}", headers=fresh_user_headers, timeout=30)
        assert r.status_code == 200, r.text
        r2 = session.get(f"{API}/inventory/{target_id}", headers=fresh_user_headers, timeout=15)
        assert r2.status_code == 404

    def test_get_404(self, session, fresh_user_headers):
        r = session.get(f"{API}/inventory/does-not-exist-xyz", headers=fresh_user_headers, timeout=15)
        assert r.status_code == 404


# ---------- Inventory meta ----------
class TestInventoryMeta:
    def test_meta_vocab(self, session, auth_headers):
        r = session.get(f"{API}/inventory-meta", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        b = r.json()
        for s in [
            "Whatnot", "Pallet", "Facebook", "Garage Sale", "Flea Market",
            "Auction", "Thrift Store", "Retail Arbitrage", "Other",
        ]:
            assert s in b["sources"], f"missing source {s}"
        for p in ["eBay", "Whatnot", "Facebook Marketplace", "Mercari", "Local Sale"]:
            assert p in b["platforms"], f"missing platform {p}"


# ---------- CSV Export ----------
class TestInventoryExport:
    def test_export_csv_has_header_and_rows(self, session, fresh_user_headers):
        # ensure at least one item exists
        session.post(
            f"{API}/inventory",
            json={
                "title": "TEST_export_one",
                "source": "Auction",
                "purchase_price": 12,
                "sale_price": 40,
                "fees": 5,
                "shipping": 3,
                "status": "sold",
            },
            headers=fresh_user_headers,
            timeout=30,
        )
        r = session.get(f"{API}/inventory/export", headers=fresh_user_headers, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "csv" in body and isinstance(body["csv"], str)
        lines = [ln for ln in body["csv"].splitlines() if ln.strip()]
        assert len(lines) >= 2, "expected header + at least one data row"
        header = lines[0]
        for col in ["id", "title", "net_profit", "roi_pct", "profit_margin_pct"]:
            assert col in header, f"missing column {col}"
        assert body["count"] >= 1


# ---------- Stats: home ----------
class TestStatsHome:
    def test_home_after_seed(self, session, fresh_user_headers):
        # current fresh_user has metrics-item (sold, net=102, rev=220) and possibly will_be_sold (sale=30 net=14) and TEST_export_one (sale=40, net=20)
        r = session.get(f"{API}/stats/home", headers=fresh_user_headers, timeout=30)
        assert r.status_code == 200
        b = r.json()
        for k in [
            "total_revenue", "total_profit", "roi_pct", "inventory_value",
            "active_listings", "items_sold", "in_stock", "best_category", "best_source",
        ]:
            assert k in b, f"missing {k}"
        # We sold at least 2 items: metrics-item ($220) + export_one ($40) + will_be_sold ($30)
        assert b["items_sold"] >= 2
        assert b["total_revenue"] >= 220.0
        assert b["total_profit"] >= 102.0
        # best_source should be present and a string
        assert isinstance(b["best_source"], str) and b["best_source"]


# ---------- Stats: sourcing ----------
class TestStatsSourcing:
    def test_sourcing_rows(self, session, fresh_user_headers):
        r = session.get(f"{API}/stats/sourcing", headers=fresh_user_headers, timeout=30)
        assert r.status_code == 200
        b = r.json()
        assert "rows" in b and isinstance(b["rows"], list)
        assert "best_source" in b and "worst_source" in b
        assert len(b["rows"]) >= 1
        row = b["rows"][0]
        for k in ["source", "revenue", "profit", "roi_pct", "items", "sold", "avg_days_to_sell"]:
            assert k in row, f"missing {k}"
        # Whatnot row should reflect the metrics-item sold
        whatnot = next((r for r in b["rows"] if r["source"] == "Whatnot"), None)
        assert whatnot is not None, "expected a Whatnot row in sourcing"
        assert whatnot["revenue"] >= 220.0
        assert whatnot["profit"] >= 102.0
        assert whatnot["sold"] >= 1


# ---------- Stats: reports (time bucketed) ----------
class TestStatsReports:
    @pytest.mark.parametrize("period", ["daily", "weekly", "monthly", "yearly"])
    def test_period(self, session, fresh_user_headers, period):
        r = session.get(
            f"{API}/stats/reports?period={period}", headers=fresh_user_headers, timeout=30
        )
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["period"] == period
        assert "rows" in b and isinstance(b["rows"], list)
        assert "totals" in b
        # We have at least one sold item, so rows must be non-empty
        assert len(b["rows"]) >= 1
        for row in b["rows"]:
            for k in ["label", "revenue", "profit", "count"]:
                assert k in row, f"missing {k} in row"
        totals = b["totals"]
        for k in ["revenue", "profit", "count"]:
            assert k in totals
        assert totals["count"] >= 1
        assert totals["revenue"] >= 220.0


# ---------- Profit Scout Score ----------
class TestProfitScoutScore:
    def test_score_shape_and_ranges(self, session, auth_headers):
        payload = {
            "query": "PlayStation 5 console",
            "buy_cost": 200,
            "sell_price": 450,
            "ebay_fee_pct": 13.25,
            "shipping_cost": 15,
            "extra_cost": 0,
        }
        r = session.post(f"{API}/score", json=payload, headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        b = r.json()
        assert 0 <= b["score"] <= 100
        assert b["verdict"] in ("BUY", "MAYBE", "DO NOT BUY")
        ss = b["subscores"]
        for k in ["demand", "competition", "profit", "velocity", "seasonality"]:
            assert k in ss
            assert 0 <= ss[k] <= 100
        # math: fee = 450 * 0.1325 = 59.625, net = 450 - (200+15+0+59.625) = 175.375 -> roi = 87.7%
        assert abs(b["net_profit"] - 175.38) < 0.05
        assert abs(b["roi_pct"] - 87.7) < 0.2
        # ebay snapshot present
        snap = b["ebay_snapshot"]
        for k in ["active_count", "sold_count", "avg_sold_price", "sell_through_rate"]:
            assert k in snap

    def test_score_verdict_bands(self, session, auth_headers):
        # Bad deal: should not be BUY
        r = session.post(
            f"{API}/score",
            json={"query": "obscure thing", "buy_cost": 100, "sell_price": 105, "ebay_fee_pct": 13.25},
            headers=auth_headers,
            timeout=30,
        )
        assert r.status_code == 200
        assert r.json()["verdict"] in ("MAYBE", "DO NOT BUY")


# ---------- Settings ----------
class TestSettings:
    def test_defaults(self, session, fresh_user_headers):
        r = session.get(f"{API}/settings", headers=fresh_user_headers, timeout=15)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["theme"] == "light"
        assert b["currency"] == "USD"
        assert b["notifications_enabled"] is True

    def test_post_then_get_persists(self, session, fresh_user_headers):
        # set dark
        r = session.post(
            f"{API}/settings", json={"theme": "dark"}, headers=fresh_user_headers, timeout=15
        )
        assert r.status_code == 200
        assert r.json()["theme"] == "dark"
        # set EUR
        r2 = session.post(
            f"{API}/settings", json={"currency": "EUR"}, headers=fresh_user_headers, timeout=15
        )
        assert r2.status_code == 200
        assert r2.json()["currency"] == "EUR"
        # set notifications off
        r3 = session.post(
            f"{API}/settings",
            json={"notifications_enabled": False},
            headers=fresh_user_headers,
            timeout=15,
        )
        assert r3.status_code == 200
        assert r3.json()["notifications_enabled"] is False
        # final GET reflects everything
        g = session.get(f"{API}/settings", headers=fresh_user_headers, timeout=15).json()
        assert g["theme"] == "dark"
        assert g["currency"] == "EUR"
        assert g["notifications_enabled"] is False


# ---------- Regression: prior endpoints still work ----------
class TestRegression:
    def test_auth_login(self, session):
        r = session.post(
            f"{API}/auth/login", json={"email": SEED_EMAIL, "password": SEED_PW}, timeout=30
        )
        assert r.status_code == 200, r.text
        assert r.json()["access_token"]

    def test_search_endpoint(self, session, auth_headers):
        r = session.post(
            f"{API}/search", json={"query": "Nintendo Switch OLED"}, headers=auth_headers, timeout=60
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "ebay" in body and "ai" in body
        assert body["ebay"]["active_count"] > 0

    def test_profit_verdict(self, session, auth_headers):
        payload = {
            "item_name": "Test Game",
            "buy_cost": 10,
            "sell_price": 60,
            "shipping_cost": 4,
            "ebay_fee_pct": 13.25,
        }
        r = session.post(f"{API}/profit/verdict", json=payload, headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["verdict"] == "BUY"
        assert abs(b["net_profit"] - 38.05) < 0.01

    def test_pallet_lifecycle(self, session, auth_headers):
        r = session.post(
            f"{API}/pallets",
            json={
                "name": "TEST_reg_pallet",
                "supplier": "X",
                "purchase_price": 200,
                "shipping_cost": 50,
                "tax_cost": 10,
            },
            headers=auth_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        pid = r.json()["id"]
        assert r.json()["total_investment"] == 260
        try:
            d = session.get(f"{API}/pallets/{pid}", headers=auth_headers, timeout=30).json()
            assert d["dashboard"]["total_investment"] == 260
        finally:
            session.delete(f"{API}/pallets/{pid}", headers=auth_headers, timeout=30)

    def test_history_crud(self, session, auth_headers):
        r = session.post(
            f"{API}/history",
            json={"title": "TEST_h_reg", "query": "abc", "source": "manual"},
            headers=auth_headers,
            timeout=30,
        )
        assert r.status_code == 200
        hid = r.json()["id"]
        try:
            rows = session.get(f"{API}/history", headers=auth_headers, timeout=30).json()
            assert any(h["id"] == hid for h in rows)
        finally:
            session.delete(f"{API}/history/{hid}", headers=auth_headers, timeout=30)

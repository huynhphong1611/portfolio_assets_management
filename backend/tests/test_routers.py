import socket

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers import data_io, securities
from app.routers.auth import get_current_user
from tests.test_csv_import import LEGACY


@pytest.fixture()
def client():
    app = FastAPI()
    app.include_router(securities.router)
    app.include_router(data_io.router)
    app.dependency_overrides[get_current_user] = lambda: {"sub": "u1", "type": "guest", "username": "demo"}
    return TestClient(app)


def test_security_crud_and_manual_prices(client):
    r = client.put("/api/securities/nhan9999", json={"name": "Vàng nhẫn 9999", "assetClass": "Vàng", "feed": "MANUAL"})
    assert r.status_code == 200 and r.json()["data"]["ticker"] == "NHAN9999"
    assert client.get("/api/securities").json()["data"][0]["feed"] == "MANUAL"

    r = client.put("/api/securities/NHAN9999/prices", json={"prices": [
        {"date": "2026-09-01", "close": 8400000}, {"date": "2026-09-20", "close": 8450000}]})
    assert r.json()["data"]["saved"] == 2
    assert client.get("/api/securities/prices").json()["data"] == {"NHAN9999": {"2026-09-01": 8400000, "2026-09-20": 8450000}}

    assert client.delete("/api/securities/NHAN9999/prices/2026-09-01").json()["data"]["deleted"] is True
    assert client.get("/api/securities/NHAN9999/prices").json()["data"] == {"2026-09-20": 8450000}

    bad = client.put("/api/securities/NHAN9999/prices", json={"prices": [{"date": "20/09/2026", "close": 1}]})
    assert bad.status_code == 400
    assert client.put("/api/securities/bad ticker!", json={}).status_code == 400

    client.delete("/api/securities/NHAN9999")
    assert client.get("/api/securities").json()["data"] == []
    assert client.get("/api/securities/prices").json()["data"] == {}


def test_json_feed_requires_public_url_and_path(client, monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", lambda *a, **k: [(2, 1, 6, "", ("127.0.0.1", 0))])
    r = client.put("/api/securities/GOLDX", json={"feed": "GENERIC-JSON", "feedURL": "http://localhost/x",
                                                  "feedProperties": {"closePath": "$.sell"}})
    assert r.status_code == 400
    r = client.put("/api/securities/GOLDX", json={"feed": "GENERIC-JSON", "feedURL": "https://example.com/x",
                                                  "feedProperties": {}})
    assert r.status_code == 400
    r = client.post("/api/securities/feed/test", json={"feedURL": "http://localhost/x", "feedProperties": {"closePath": "$.a"}})
    assert r.json()["success"] is False


def test_transactions_import_preview_then_commit(client):
    preview = client.post("/api/data/import/transactions", json={"content": LEGACY}).json()["data"]
    assert preview["dryRun"] is True and preview["validCount"] == 5 and preview["imported"] == 0
    assert preview["errorCount"] == 1 and len(preview["preview"]) == 5

    done = client.post("/api/data/import/transactions", json={"content": LEGACY, "dryRun": False}).json()["data"]
    assert done["imported"] == 5
    again = client.post("/api/data/import/transactions", json={"content": LEGACY, "dryRun": False}).json()["data"]
    assert again["imported"] == 0 and len(again["duplicates"]) == 5

    r = client.post("/api/data/import/transactions", json={"content": "x,y\n1,2"})
    assert r.status_code == 400


def test_prices_import_and_backup_round_trip(client):
    csv = "Ngày,Giá\n01/09/2026,\"8.450.000\"\n02/09/2026,\"8.470.000\"\n"
    r = client.post("/api/data/import/prices", json={"content": csv, "ticker": "NHAN9999", "dryRun": False}).json()["data"]
    assert r["imported"] == 2 and r["tickers"]["NHAN9999"]["lastPrice"] == 8470000
    client.put("/api/securities/NHAN9999", json={"feed": "MANUAL", "assetClass": "Vàng"})
    client.post("/api/data/import/transactions", json={"content": LEGACY, "dryRun": False})

    backup = client.get("/api/data/export").json()["data"]
    assert backup["format"] == "portfolio-manager-backup" and len(backup["transactions"]) == 5
    assert backup["securityPrices"]["NHAN9999"]["2026-09-02"] == 8470000

    from tests import fake_firestore
    fake_firestore.reset()
    check = client.post("/api/data/import/workspace", json={"data": backup}).json()["data"]
    assert check["dryRun"] is True and check["counts"]["transactions"] == 5 and check["errors"] == []
    client.post("/api/data/import/workspace", json={"data": backup, "dryRun": False})
    restored = client.get("/api/data/export").json()["data"]
    assert sorted(t["id"] for t in restored["transactions"]) == sorted(t["id"] for t in backup["transactions"])
    assert restored["securities"][0]["feed"] == "MANUAL"
    assert restored["securityPrices"] == backup["securityPrices"]

    client.post("/api/data/import/workspace", json={"data": backup, "dryRun": False})  # idempotent
    assert len(client.get("/api/data/export").json()["data"]["transactions"]) == 5

    assert client.post("/api/data/import/workspace", json={"data": {"transactions": []}}).status_code == 400

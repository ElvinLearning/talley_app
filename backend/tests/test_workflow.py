import json
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
import pytest
from fastapi.testclient import TestClient
from app import db
from app.main import app
from app.estimating import EstimateIn, calculate

PASSWORD = "Synthetic-test-only!"
HEADERS = {"X-Talley-Request": "1"}

@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", str(tmp_path / "test.db"))
    monkeypatch.setenv("DEMO_MODE", "1")
    monkeypatch.setenv("TALLEY_DEMO_PASSWORD", PASSWORD)
    monkeypatch.setenv("COOKIE_SECURE", "0")
    with TestClient(app, headers=HEADERS) as c:
        login(c)
        yield c

def login(client, username="admin.demo"):
    r = client.post("/api/auth/login", json={"username": username, "password": PASSWORD})
    assert r.status_code == 200, r.text

def fixture_job(client):
    c = client.post("/api/customers", json={"name":"Demo Customer","contact":"Demo Contact","email":"demo@example.test","phone":"215-555-0100"})
    assert c.status_code == 201, c.text
    j = client.post("/api/jobs", json={"customer_id":c.json()["id"],"name":"Demo Kitchen","address":"100 Example Street, Philadelphia","scope":"Synthetic kitchen scope"})
    assert j.status_code == 201, j.text
    return j.json()

def pricing(version=1):
    return dict(version=version, markup_percent="20",tax_percent="6",tax_basis="materials",notes="Demo only",
        sections=[dict(name="Kitchen", lines=[
            dict(description="Install",kind="labor",quantity="8",unit="hour",unit_cost="65"),
            dict(description="Tile",kind="material",quantity="100",unit="sq ft",unit_cost="3.25"),
            dict(description="Electrical",kind="subcontractor",quantity="1",unit="allowance",unit_cost="250")
        ])])

def saved(client):
    j = fixture_job(client)
    e = client.post(f"/api/jobs/{j['id']}/estimates").json()
    r = client.put(f"/api/estimates/{e['id']}",json=pricing())
    assert r.status_code == 200, r.text
    return j, r.json()

def approved(client):
    j,e=saved(client)
    r=client.post(f"/api/estimates/{e['id']}/approve",json={"version":e["version"],"approved_by":"Demo customer","note":"Synthetic approval for test"})
    assert r.status_code == 200, r.text
    return j,r.json()

def test_calculation_rounding_and_tax():
    d=calculate(EstimateIn(**pricing()))
    assert d["totals"] == dict(cost_cents=109500,markup_cents=21900,subtotal_cents=131400,taxable_cents=39000,tax_cents=2340,total_cents=133740)
    p=pricing()
    p["sections"][0]["lines"]=[dict(description="Half cent",kind="material",quantity=".005",unit="unit",unit_cost="1")]
    p["markup_percent"]="50";p["tax_percent"]="25";p["tax_basis"]="all"
    t=calculate(EstimateIn(**p))["totals"]
    assert t["cost_cents"] == 1 and t["markup_cents"] == 1 and t["tax_cents"] == 1 and t["total_cents"] == 3
    p["tax_basis"]="none"
    assert calculate(EstimateIn(**p))["totals"]["tax_cents"] == 0

def test_full_flow_persists_and_preview_redacts(client):
    j,e=saved(client)
    assert client.get(f"/api/estimates/{e['id']}").json() == e
    preview=client.get(f"/api/estimates/{e['id']}/preview").json()
    text=json.dumps(preview)
    assert "unit_cost" not in text and "markup" not in text and "cost_cents" not in text
    assert preview["document"]["totals"]["total_cents"] == 133740
    client.post(f"/api/estimates/{e['id']}/approve",json={"version":2,"approved_by":"Customer","note":"Demo"})
    converted=client.post(f"/api/estimates/{e['id']}/convert").json()
    board=client.get(f"/api/boards/{converted['board_id']}").json()
    assert board["name"] == j["name"] and board["address"] == j["address"] and board["client"] == j["customer"]["name"]
    assert board["contract_value"] == 1337.4
    detail=client.get(f"/api/jobs/{j['id']}").json()
    assert detail["project"]["budget_cents"] == 109500
    # Reinitialize the application/database to exercise persistence, not browser state.
    from app.bootstrap import initialize
    db.init_db(); initialize()
    assert client.get(f"/api/jobs/{j['id']}").json()["project"] == detail["project"]

def test_concurrent_conversion_and_revision_do_not_duplicate(client):
    j,e=approved(client)
    with ThreadPoolExecutor(max_workers=4) as pool:
        results=list(pool.map(lambda _: client.post(f"/api/estimates/{e['id']}/convert").json(), range(8)))
    assert len({r["board_id"] for r in results}) == 1
    assert sum(r["created"] for r in results) == 1
    revision=client.post(f"/api/jobs/{j['id']}/estimates").json()
    assert revision["revision"] == 2
    assert client.post(f"/api/jobs/{j['id']}/estimates").json()["id"] == revision["id"]
    revised=pricing();revised["sections"][0]["lines"][0]["unit_cost"]="70";revised["scope"]="Revised scope including backsplash"
    client.put(f"/api/estimates/{revision['id']}",json=revised)
    client.post(f"/api/estimates/{revision['id']}/approve",json={"version":2,"approved_by":"Customer","note":"Revised demo"})
    assert client.post(f"/api/estimates/{revision['id']}/convert").json()["board_id"] == results[0]["board_id"]
    assert client.get(f"/api/estimates/{e['id']}").json() == e
    assert client.get(f"/api/estimates/{revision['id']}").json()["document"]["job"]["scope"] == revised["scope"]
    assert client.get(f"/api/jobs/{j['id']}").json()["project"]["scope"] == "Synthetic kitchen scope"
    assert client.get(f"/api/jobs/{j['id']}").json()["project"]["budget_cents"] == 109500
    assert client.delete(f"/api/boards/{results[0]['board_id']}").status_code == 409

def test_approval_and_concurrency_guards(client):
    _,e=saved(client)
    assert client.put(f"/api/estimates/{e['id']}",json=pricing(1)).status_code == 409
    assert client.post(f"/api/estimates/{e['id']}/convert").status_code == 409
    assert client.post(f"/api/estimates/{e['id']}/approve",json={"version":1,"approved_by":"C","note":"Demo"}).status_code == 409
    client.post(f"/api/estimates/{e['id']}/approve",json={"version":2,"approved_by":"C","note":"Demo"})
    assert client.put(f"/api/estimates/{e['id']}",json=pricing(3)).status_code == 409
    with closing(db.connect()) as conn:
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute("UPDATE estimates SET document='{}' WHERE id=?",(e["id"],))

def test_worker_isolation_and_cost_restrictions(client):
    j,e=approved(client)
    bid=client.post(f"/api/estimates/{e['id']}/convert").json()["board_id"]
    group=client.get(f"/api/boards/{bid}").json()["groups"][0]["id"]
    workers=client.get("/api/workers").json()
    worker=next(w for w in workers if w["name"]=="Demo field worker")
    client.put(f"/api/boards/{bid}/assignments",json={"user_ids":[worker["id"]]})
    task=client.post(f"/api/groups/{group}/items",json={"name":"Measure site","owner":worker["name"],"due_date":"2026-11-20","cost":500}).json()
    other_task=client.post(f"/api/groups/{group}/items",json={"name":"Admin review","owner":"Demo administrator","cost":100}).json()
    assert "Measure site" in client.get(f"/api/jobs/{j['id']}").json()["next_action"]
    login(client,"worker.demo")
    for path in ["/boards",f"/boards/{bid}","/team","/overview","/customers","/jobs","/workers",f"/estimates/{e['id']}",f"/estimates/{e['id']}/preview"]:
        assert client.get("/api"+path).status_code == 403, path
    assert client.patch(f"/api/items/{task['id']}",json={"cost":0}).status_code == 403
    assert client.post(f"/api/estimates/{e['id']}/convert").status_code == 403
    body=client.get("/api/work").json()
    assert len(body)==1
    assert not any(k in json.dumps(body) for k in ["cost","budget","markup","contract_value"])
    assert client.patch(f"/api/work/{bid}/tasks/{task['id']}",json={"status":"done","notes":"Completed demo"}).status_code == 200
    assert client.patch(f"/api/work/{bid}/tasks/{other_task['id']}",json={"status":"done","notes":""}).status_code == 403
    assert client.patch(f"/api/work/{bid}/tasks/{task['id']}",json={"status":"done","notes":"","cost":100}).status_code == 422
    assert client.get(f"/api/work/{bid+1}").status_code == 404
    login(client,"other.demo")
    assert client.get("/api/work").json() == []
    assert client.get(f"/api/work/{bid}").status_code == 404
    login(client)
    client.put(f"/api/boards/{bid}/assignments",json={"user_ids":[]})
    login(client,"worker.demo")
    assert client.get(f"/api/work/{bid}").status_code == 404

@pytest.mark.parametrize("field,value", [("quantity","-1"),("quantity","0"),("unit_cost","NaN"),("unit_cost","1.001")])
def test_invalid_pricing(client,field,value):
    _,e=saved(client)
    p=pricing(2);p["sections"][0]["lines"][0][field]=value
    assert client.put(f"/api/estimates/{e['id']}",json=p).status_code == 422

def test_sessions_csrf_logout_and_expiry(client):
    assert client.post("/api/jobs",json={},headers={"X-Talley-Request":""}).status_code == 403
    client.post("/api/auth/logout")
    assert client.get("/api/jobs").status_code == 401
    login(client)
    with closing(db.connect()) as conn,conn:
        conn.execute("UPDATE sessions SET expires_at=0")
    assert client.get("/api/jobs").status_code == 401
    for _ in range(5):
        assert client.post("/api/auth/login",json={"username":"admin.demo","password":"wrong"}).status_code == 401
    assert client.post("/api/auth/login",json={"username":"admin.demo","password":PASSWORD}).status_code == 429

def test_old_board_migration_is_additive(client):
    board=client.post("/api/boards",json={"name":"Existing legacy board","contract_value":2000}).json()
    from app.bootstrap import initialize
    initialize(); initialize()
    assert client.get(f"/api/boards/{board['id']}").json()["contract_value"] == 2000

def test_status_cannot_bypass_approval_and_can_resume_project(client):
    j,e=saved(client)
    assert client.patch(f"/api/jobs/{j['id']}/status",json={"status":"active"}).status_code == 409
    client.post(f"/api/estimates/{e['id']}/approve",json={"version":2,"approved_by":"C","note":"Demo"})
    client.post(f"/api/estimates/{e['id']}/convert")
    for status in ("on_hold","active","complete"):
        assert client.patch(f"/api/jobs/{j['id']}/status",json={"status":status}).json()["status"] == status

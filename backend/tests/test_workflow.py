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
    # Pricing data is never cacheable; a missing asset must not be cached as permanent.
    assert client.get("/api/jobs").headers["cache-control"] == "no-store"
    assert client.get("/assets/missing.js").headers["cache-control"] == "no-cache"
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

def test_job_list_is_structured_for_the_workspace(client):
    j,e=approved(client)
    listed=next(x for x in client.get("/api/jobs").json() if x["id"]==j["id"])
    assert listed["next"]["kind"] == "convert" and listed["next"]["estimate_id"] == e["id"]
    assert listed["estimates"][0]["total_cents"] == 133740 and listed["tasks"] is None
    bid=client.post(f"/api/estimates/{e['id']}/convert").json()["board_id"]
    assert client.get(f"/api/jobs/{j['id']}").json()["next"]["kind"] == "plan"
    group=client.get(f"/api/boards/{bid}").json()["groups"][0]["id"]
    client.post(f"/api/groups/{group}/items",json={"name":"Later task","owner":"Demo field worker","due_date":"2026-12-01"})
    stuck=client.post(f"/api/groups/{group}/items",json={"name":"Waiting on permit","status":"blocked"}).json()
    finished=client.post(f"/api/groups/{group}/items",json={"name":"Walkthrough","status":"done"}).json()
    listed=next(x for x in client.get("/api/jobs").json() if x["id"]==j["id"])
    assert listed["next"] == dict(kind="task",label="Unblock: Waiting on permit",task_id=stuck["id"],owner=None,due_date=None,blocked=True)
    assert listed["tasks"] == dict(total=3,done=1,blocked=1,unassigned=1,earliest_due="2026-12-01")
    assert "scope" not in listed["project"] and listed["project"]["board_id"] == bid
    client.patch(f"/api/items/{stuck['id']}",json={"status":"done"})
    detail=client.get(f"/api/jobs/{j['id']}").json()
    assert detail["next"]["label"] == "Later task" and detail["next"]["owner"] == "Demo field worker"
    assert detail["next_action"] == "Later task · Demo field worker · Due 2026-12-01"
    assert detail["project"]["scope"] == "Synthetic kitchen scope"
    assert client.get(f"/api/boards/{bid}").json()["job_id"] == j["id"]
    assert finished["status"] == "done" and client.get("/api/jobs/999999").status_code == 404

def test_price_history_reuses_saved_costs_for_administrators_only(client):
    _,first=saved(client)
    j2=fixture_job(client)
    e2=client.post(f"/api/jobs/{j2['id']}/estimates").json()
    newer=pricing();newer["sections"][0]["lines"][1]["unit_cost"]="4.10"
    client.put(f"/api/estimates/{e2['id']}",json=newer)
    history=client.get("/api/price-history").json()
    tile=next(h for h in history if h["description"]=="Tile")
    assert tile["unit_cost"] == "4.10" and tile["kind"] == "material" and tile["unit"] == "sq ft" and tile["jobs"] == 2
    assert not any(h["description"]=="Describe work" for h in history)
    # The estimate being edited is not its own history.
    assert next(h for h in client.get(f"/api/price-history?exclude={e2['id']}").json() if h["description"]=="Tile")["unit_cost"] == "3.25"
    login(client,"worker.demo")
    assert client.get("/api/price-history").status_code == 403

def test_field_update_returns_only_field_data_and_logs_activity(client):
    j,e=approved(client)
    bid=client.post(f"/api/estimates/{e['id']}/convert").json()["board_id"]
    group=client.get(f"/api/boards/{bid}").json()["groups"][0]["id"]
    worker=next(w for w in client.get("/api/workers").json() if w["name"]=="Demo field worker")
    client.put(f"/api/boards/{bid}/assignments",json={"user_ids":[worker["id"]]})
    task=client.post(f"/api/groups/{group}/items",json={"name":"Measure site","owner":worker["name"],"cost":750}).json()
    client.post(f"/api/groups/{group}/items",json={"name":"Order tile","owner":"Demo administrator","cost":900})
    login(client,"worker.demo")
    mine={t["name"]:t["mine"] for t in client.get(f"/api/work/{bid}").json()["tasks"]}
    assert mine == {"Measure site":True,"Order tile":False}
    r=client.patch(f"/api/work/{bid}/tasks/{task['id']}",json={"status":"blocked","notes":"Gate is locked"})
    assert r.status_code == 200
    body=r.json()
    assert body["status"] == "blocked" and body["notes"] == "Gate is locked" and body["mine"] is True
    assert set(body) == {"id","name","status","owner","due_date","notes","updated_at","section","mine","ok"}
    client.patch(f"/api/work/{bid}/tasks/{task['id']}",json={"status":"blocked","notes":"Gate is still locked"})
    login(client)
    messages=[a["message"] for a in client.get(f"/api/boards/{bid}").json()["activity"]]
    assert "Demo field worker moved Measure site to Blocked" in messages
    assert "Demo field worker added a note on Measure site" in messages
    client.patch(f"/api/items/{task['id']}",json={"owner":"Demo administrator","due_date":"2026-11-20"})
    messages=[a["message"] for a in client.get(f"/api/boards/{bid}").json()["activity"]]
    assert "Measure site assigned to Demo administrator" in messages and "Measure site due Nov 20" in messages
    assert client.patch(f"/api/items/{task['id']}",json={"name":""}).status_code == 422

def test_saved_date_is_frozen_with_the_approved_revision(client):
    j,e=saved(client)
    stamp=e["document"]["saved_at"]
    preview=client.get(f"/api/estimates/{e['id']}/preview").json()
    assert preview["prepared_at"] == stamp and preview["job_id"] == j["id"]
    done=client.post(f"/api/estimates/{e['id']}/approve",json={"version":e["version"],"approved_by":"C","note":"Demo"}).json()
    assert done["document"]["saved_at"] == stamp
    assert client.get(f"/api/estimates/{e['id']}/preview").json()["prepared_at"] == stamp


def test_skip_login_requires_demo_mode_and_preserves_worker_role(client, monkeypatch):
    client.cookies.clear()
    assert client.get('/api/auth/me').status_code == 401
    monkeypatch.setenv('DEMO_SKIP_LOGIN', '1')
    assert client.get('/api/auth/me').json()['demo_access'] is True
    assert client.get('/api/jobs').status_code == 200
    login(client, 'worker.demo')
    assert client.get('/api/auth/me').json()['role'] == 'worker'
    assert client.get('/api/jobs').status_code == 403
    client.cookies.clear()
    monkeypatch.setenv('DEMO_MODE', '0')
    assert client.get('/api/auth/me').status_code == 401
    assert client.get('/api/jobs').status_code == 401

import json
from contextlib import closing
from datetime import datetime, timezone
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field
from .auth import admin, current_user
from .db import connect
from .estimating import StrictModel, EstimateIn, calculate, client_document

router = APIRouter(prefix="/api")

def now():
    return datetime.now(timezone.utc).isoformat()

def require(conn, table, id):
    row = conn.execute(f"SELECT * FROM {table} WHERE id=?", (id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Record not found")
    return dict(row)

class CustomerIn(StrictModel):
    name: str = Field(min_length=1, max_length=200)
    contact: str = Field(min_length=1, max_length=200)
    email: str = Field(default="", max_length=254, pattern=r"^([^\s@]+@[^\s@]+\.[^\s@]+)?$")
    phone: str = Field(default="", max_length=50)

class JobIn(StrictModel):
    customer_id: int
    name: str = Field(min_length=1, max_length=200)
    address: str = Field(min_length=1, max_length=500)
    scope: str = Field(min_length=1, max_length=10000)

class JobStatus(StrictModel):
    status: Literal["lead","estimating","active","on_hold","complete"]

class Approval(StrictModel):
    version: int = Field(ge=1)
    approved_by: str = Field(min_length=1, max_length=200)
    note: str = Field(min_length=1, max_length=2000)

@router.get("/customers", dependencies=[Depends(admin)])
def customers():
    with closing(connect()) as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM customers ORDER BY name")]

@router.post("/customers", status_code=201, dependencies=[Depends(admin)])
def customer_create(payload: CustomerIn):
    with closing(connect()) as conn, conn:
        id = conn.execute("INSERT INTO customers(name,contact,email,phone,created_at) VALUES(?,?,?,?,?)",
                          (*payload.model_dump().values(), now())).lastrowid
        return require(conn, "customers", id)

def job_snapshot(conn, job_id):
    job = require(conn, "jobs", job_id)
    job["customer"] = require(conn, "customers", job["customer_id"])
    return job

def job_detail(conn, job_id):
    job = job_snapshot(conn, job_id)
    job["estimates"] = [dict(r) for r in conn.execute(
        "SELECT id,revision,state,version,approved_by,approved_at FROM estimates WHERE job_id=? ORDER BY revision DESC", (job_id,))]
    origin = conn.execute("SELECT * FROM project_origins WHERE job_id=?", (job_id,)).fetchone()
    job["project"] = {**{k: origin[k] for k in ("board_id","estimate_id","budget_cents","contract_cents")},
                      "scope": json.loads(origin["snapshot"])["job"]["scope"]} if origin else None
    if job["status"] == "complete":
        job["next_action"] = "Job complete"
    elif job["status"] == "on_hold":
        job["next_action"] = "Review hold and resume work"
    elif origin:
        task = conn.execute("""SELECT i.name,i.owner,i.due_date,i.status FROM items i
          JOIN groups g ON g.id=i.group_id WHERE g.board_id=? AND i.status!='done'
          ORDER BY CASE i.status WHEN 'blocked' THEN 0 ELSE 1 END, i.due_date IS NULL, i.due_date, i.id LIMIT 1""",
          (origin["board_id"],)).fetchone()
        job["next_action"] = (("Unblock: " if task["status"] == "blocked" else "") + task["name"]
                              + (" · " + task["owner"] if task["owner"] else " · Assign owner")
                              + (" · Due " + task["due_date"] if task["due_date"] else "")) if task else "Plan tasks or close out job"
    else:
        latest = job["estimates"][0] if job["estimates"] else None
        job["next_action"] = "Convert approved estimate" if latest and latest["state"] == "approved" else (
            "Finish estimate and record approval" if latest else "Build first estimate")
    return job

@router.get("/jobs", dependencies=[Depends(admin)])
def jobs():
    with closing(connect()) as conn:
        return [job_detail(conn, row["id"]) for row in conn.execute("SELECT id FROM jobs ORDER BY id DESC")]

@router.get("/jobs/{job_id}", dependencies=[Depends(admin)])
def job_get(job_id: int):
    with closing(connect()) as conn:
        return job_detail(conn, job_id)

@router.post("/jobs", status_code=201, dependencies=[Depends(admin)])
def job_create(payload: JobIn):
    with closing(connect()) as conn, conn:
        require(conn, "customers", payload.customer_id)
        id = conn.execute("""INSERT INTO jobs(customer_id,name,address,scope,status,created_at,updated_at)
          VALUES(?,?,?,?,'lead',?,?)""", (*payload.model_dump().values(), now(), now())).lastrowid
        return job_detail(conn, id)

@router.patch("/jobs/{job_id}/status", dependencies=[Depends(admin)])
def job_status(job_id: int, payload: JobStatus):
    with closing(connect()) as conn, conn:
        require(conn, "jobs", job_id)
        if payload.status == "active" and not conn.execute("SELECT 1 FROM project_origins WHERE job_id=?", (job_id,)).fetchone():
            raise HTTPException(409, "Convert an approved estimate before activating this job.")
        conn.execute("UPDATE jobs SET status=?,updated_at=? WHERE id=?", (payload.status, now(), job_id))
        return job_detail(conn, job_id)

def estimate_detail(conn, id):
    estimate = require(conn, "estimates", id)
    estimate["document"] = json.loads(estimate["document"])
    return estimate

@router.post("/jobs/{job_id}/estimates", dependencies=[Depends(admin)])
def estimate_create(job_id: int):
    with closing(connect()) as conn, conn:
        conn.execute("BEGIN IMMEDIATE")
        job = job_snapshot(conn, job_id)
        draft = conn.execute("SELECT id FROM estimates WHERE job_id=? AND state='draft'", (job_id,)).fetchone()
        if draft:
            return estimate_detail(conn, draft["id"])
        latest = conn.execute("SELECT * FROM estimates WHERE job_id=? ORDER BY revision DESC LIMIT 1", (job_id,)).fetchone()
        document = json.loads(latest["document"]) if latest else {
            "markup_percent": "0", "tax_percent": "0", "tax_basis": "none", "notes": "",
            "sections": [{"name": "Scope of work", "lines": [
                {"description": "Describe work", "kind": "labor", "quantity": "1", "unit": "hour", "unit_cost": "0",
                 "cost_cents": 0, "markup_cents": 0, "price_cents": 0}], "price_cents": 0}],
            "totals": dict(cost_cents=0, markup_cents=0, subtotal_cents=0, taxable_cents=0, tax_cents=0, total_cents=0)
        }
        if not latest:
            document["job"] = job
        id = conn.execute("""INSERT INTO estimates(job_id,revision,state,document,created_at)
          VALUES(?,?,'draft',?,?)""", (job_id, latest["revision"]+1 if latest else 1, json.dumps(document), now())).lastrowid
        if not conn.execute("SELECT 1 FROM project_origins WHERE job_id=?", (job_id,)).fetchone():
            conn.execute("UPDATE jobs SET status='estimating',updated_at=? WHERE id=?", (now(), job_id))
        return estimate_detail(conn, id)

@router.get("/estimates/{id}", dependencies=[Depends(admin)])
def estimate_get(id: int):
    with closing(connect()) as conn:
        return estimate_detail(conn, id)

@router.put("/estimates/{id}", dependencies=[Depends(admin)])
def estimate_save(id: int, payload: EstimateIn):
    with closing(connect()) as conn, conn:
        conn.execute("BEGIN IMMEDIATE")
        estimate = require(conn, "estimates", id)
        if estimate["state"] != "draft" or estimate["version"] != payload.version:
            raise HTTPException(409, "Estimate changed or is approved. Reopen it before editing.")
        document = calculate(payload)
        document["job"] = job_snapshot(conn, estimate["job_id"])
        if payload.scope is not None:
            document["job"]["scope"] = payload.scope
        conn.execute("UPDATE estimates SET document=?,version=version+1 WHERE id=?", (json.dumps(document), id))
        return estimate_detail(conn, id)

@router.get("/estimates/{id}/preview", dependencies=[Depends(admin)])
def estimate_preview(id: int):
    with closing(connect()) as conn:
        estimate = estimate_detail(conn, id)
        return dict(id=id, revision=estimate["revision"], state=estimate["state"], approved_by=estimate["approved_by"],
                    approved_at=estimate["approved_at"], document=client_document(estimate["document"]))

@router.post("/estimates/{id}/approve")
def estimate_approve(id: int, payload: Approval, user=Depends(admin)):
    with closing(connect()) as conn, conn:
        conn.execute("BEGIN IMMEDIATE")
        estimate = estimate_detail(conn, id)
        if estimate["state"] == "approved":
            return estimate
        if estimate["version"] != payload.version:
            raise HTTPException(409, "Estimate changed. Review the latest version before approval.")
        if estimate["document"]["totals"]["total_cents"] <= 0:
            raise HTTPException(422, "Add priced scope before recording approval.")
        conn.execute("""UPDATE estimates SET state='approved',approved_by=?,approval_note=?,approved_at=?,
          recorded_by=?,version=version+1 WHERE id=?""", (payload.approved_by,payload.note,now(),user["id"],id))
        if not conn.execute("SELECT 1 FROM project_origins WHERE job_id=?", (estimate["job_id"],)).fetchone():
            conn.execute("UPDATE jobs SET status='approved',updated_at=? WHERE id=?", (now(), estimate["job_id"]))
        return estimate_detail(conn, id)

@router.post("/estimates/{id}/convert", dependencies=[Depends(admin)])
def estimate_convert(id: int):
    with closing(connect()) as conn, conn:
        conn.execute("BEGIN IMMEDIATE")
        estimate = estimate_detail(conn, id)
        if estimate["state"] != "approved":
            raise HTTPException(409, "Approve this estimate before creating a project.")
        origin = conn.execute("SELECT * FROM project_origins WHERE job_id=?", (estimate["job_id"],)).fetchone()
        if origin:
            return {"board_id": origin["board_id"], "created": False, "estimate_id": origin["estimate_id"]}
        doc = estimate["document"]
        job = doc["job"]
        board_id = conn.execute("""INSERT INTO boards(name,client,address,contract_value,created_at)
          VALUES(?,?,?,?,?)""", (job["name"],job["customer"]["name"],job["address"],doc["totals"]["total_cents"]/100,now())).lastrowid
        for position, section in enumerate(doc["sections"]):
            conn.execute("INSERT INTO groups(board_id,name,position) VALUES(?,?,?)", (board_id,section["name"],position))
        conn.execute("INSERT INTO project_origins VALUES(?,?,?,?,?,?)",
          (estimate["job_id"],board_id,id,doc["totals"]["cost_cents"],doc["totals"]["total_cents"],json.dumps(doc)))
        conn.execute("UPDATE jobs SET status='active',updated_at=? WHERE id=?", (now(),estimate["job_id"]))
        conn.execute("INSERT INTO activity(board_id,message,kind,created_at) VALUES(?,?,'update',?)",
                     (board_id,f"Created from approved estimate revision {estimate['revision']}",now()))
        return {"board_id": board_id, "created": True, "estimate_id": id}

@router.get("/workers", dependencies=[Depends(admin)])
def workers():
    with closing(connect()) as conn:
        return [dict(r) for r in conn.execute("SELECT id,name,team_id FROM users WHERE role='worker' ORDER BY name")]

class Assignment(StrictModel):
    user_ids: list[int] = Field(max_length=100)

@router.get("/boards/{board_id}/assignments", dependencies=[Depends(admin)])
def assignments(board_id: int):
    with closing(connect()) as conn:
        require(conn, "boards", board_id)
        return [r["user_id"] for r in conn.execute("SELECT user_id FROM board_assignments WHERE board_id=?", (board_id,))]

@router.put("/boards/{board_id}/assignments", dependencies=[Depends(admin)])
def assign(board_id: int, payload: Assignment):
    with closing(connect()) as conn, conn:
        require(conn, "boards", board_id)
        for id in payload.user_ids:
            if require(conn, "users", id)["role"] != "worker":
                raise HTTPException(422, "Select field workers")
        conn.execute("DELETE FROM board_assignments WHERE board_id=?", (board_id,))
        conn.executemany("INSERT INTO board_assignments VALUES(?,?)", [(board_id,id) for id in set(payload.user_ids)])
        return payload.user_ids

def worker_board(conn, board_id, user):
    if user["role"] != "admin" and not conn.execute(
        "SELECT 1 FROM board_assignments WHERE board_id=? AND user_id=?", (board_id,user["id"])).fetchone():
        raise HTTPException(404, "Assigned project not found")
    return require(conn, "boards", board_id)

@router.get("/work")
def my_work(user=Depends(current_user)):
    with closing(connect()) as conn:
        ids = conn.execute("SELECT board_id FROM board_assignments WHERE user_id=?", (user["id"],)).fetchall()
        return [work_detail(conn,row["board_id"],user) for row in ids]

def work_detail(conn, board_id, user):
    board = worker_board(conn,board_id,user)
    result = {k: board[k] for k in ("id","name","address","client")}
    origin = conn.execute("SELECT snapshot FROM project_origins WHERE board_id=?", (board_id,)).fetchone()
    result["scope"] = json.loads(origin["snapshot"])["job"]["scope"] if origin else ""
    result["tasks"] = [dict(r) for r in conn.execute("""SELECT i.id,i.name,i.status,i.owner,i.due_date,i.notes,g.name AS section
      FROM items i JOIN groups g ON g.id=i.group_id WHERE g.board_id=? ORDER BY i.due_date IS NULL,i.due_date,i.id""", (board_id,))]
    return result

@router.get("/work/{board_id}")
def work_get(board_id: int, user=Depends(current_user)):
    with closing(connect()) as conn:
        return work_detail(conn,board_id,user)

class FieldUpdate(StrictModel):
    status: Literal["not_started","in_progress","blocked","review","done"]
    notes: str = Field(max_length=5000)

@router.patch("/work/{board_id}/tasks/{task_id}")
def field_update(board_id: int, task_id: int, payload: FieldUpdate, user=Depends(current_user)):
    with closing(connect()) as conn, conn:
        worker_board(conn,board_id,user)
        item = conn.execute("""SELECT i.* FROM items i JOIN groups g ON g.id=i.group_id
          WHERE i.id=? AND g.board_id=?""", (task_id,board_id)).fetchone()
        if not item:
            raise HTTPException(404, "Task not found")
        team = conn.execute("SELECT name FROM team WHERE id=?", (user["team_id"],)).fetchone()
        if user["role"] != "admin" and (not team or item["owner"] != team["name"]):
            raise HTTPException(403, "Only the assigned task owner can update this task")
        conn.execute("UPDATE items SET status=?,notes=?,updated_at=? WHERE id=?", (payload.status,payload.notes,now(),task_id))
        conn.execute("INSERT INTO activity(board_id,message,kind,created_at) VALUES(?,?,'update',?)",
                     (board_id,f"{user['name']} updated {item['name']} to {payload.status}",now()))
        return {"ok": True}

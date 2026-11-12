import json
from contextlib import closing
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field
from .auth import admin, current_user
from .db import connect
from .estimating import StrictModel, EstimateIn, calculate, client_document
from .events import record_event

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

TASK_LABEL = {"not_started": "Not started", "in_progress": "In progress", "blocked": "Blocked",
              "review": "Review", "done": "Done"}

def next_step(job, estimates, origin, task):
    """The single next step for a job: structured for the list, plus one sentence."""
    if job["status"] == "complete":
        step = dict(kind="complete", label="Job complete")
    elif job["status"] == "on_hold":
        step = dict(kind="hold", label="On hold — review and resume")
    elif origin and task:
        blocked = task["status"] == "blocked"
        step = dict(kind="task", label=("Unblock: " if blocked else "") + task["name"], task_id=task["id"],
                    owner=task["owner"] or None, due_date=task["due_date"], blocked=blocked)
    elif origin:
        step = dict(kind="plan", label="Add tasks or close out the job")
    elif estimates and estimates[0]["state"] == "approved":
        step = dict(kind="convert", label="Create project from approved estimate", estimate_id=estimates[0]["id"])
    elif estimates:
        step = dict(kind="estimate", label="Finish estimate and record approval", estimate_id=estimates[0]["id"])
    else:
        step = dict(kind="start", label="Build the first estimate")
    sentence = step["label"]
    if step["kind"] == "task":
        sentence += " · " + step["owner"] if step["owner"] else " · Assign owner"
        sentence += " · Due " + step["due_date"] if step["due_date"] else ""
    return step, sentence

def job_records(conn, job_id=None):
    """Jobs with customer, estimates, project baseline, task counts and next step.

    Runs a fixed number of queries however many jobs exist.
    """
    where, args = ("WHERE j.id=?", (job_id,)) if job_id is not None else ("", ())
    scope = "WHERE job_id=?" if job_id is not None else ""
    jobs = [dict(r) for r in conn.execute(f"SELECT j.* FROM jobs j {where} ORDER BY j.id DESC", args)]
    customers = {r["id"]: dict(r) for r in conn.execute(
        f"SELECT * FROM customers WHERE id IN (SELECT customer_id FROM jobs j {where})", args)}
    estimates, origins, tasks = {}, {}, {}
    for r in conn.execute(f"""SELECT id,job_id,revision,state,version,approved_by,approved_at,
          json_extract(document,'$.totals.total_cents') AS total_cents,
          COALESCE(json_extract(document,'$.saved_at'),created_at) AS saved_at
          FROM estimates {scope} ORDER BY revision DESC""", args):
        row = dict(r)
        estimates.setdefault(row.pop("job_id"), []).append(row)
    for r in conn.execute(
            f"SELECT job_id,board_id,estimate_id,budget_cents,contract_cents FROM project_origins {scope}", args):
        origins[r["job_id"]] = dict(r)
    for r in conn.execute(f"""SELECT g.board_id,i.id,i.name,i.owner,i.due_date,i.status FROM items i
          JOIN groups g ON g.id=i.group_id
          WHERE g.board_id IN (SELECT board_id FROM project_origins {scope}) ORDER BY i.id""", args):
        tasks.setdefault(r["board_id"], []).append(dict(r))
    for job in jobs:
        job["customer"] = customers[job["customer_id"]]
        job["estimates"] = estimates.get(job["id"], [])
        origin = origins.get(job["id"])
        job["project"] = ({k: origin[k] for k in ("board_id", "estimate_id", "budget_cents", "contract_cents")}
                          if origin else None)
        items = tasks.get(origin["board_id"], []) if origin else []
        pending = sorted((t for t in items if t["status"] != "done"),
                         key=lambda t: (t["status"] != "blocked", t["due_date"] is None, t["due_date"] or "", t["id"]))
        job["tasks"] = dict(
            total=len(items), done=len(items) - len(pending),
            blocked=sum(t["status"] == "blocked" for t in pending),
            unassigned=sum(not t["owner"] for t in pending),
            earliest_due=min((t["due_date"] for t in pending if t["due_date"]), default=None)) if origin else None
        job["next"], job["next_action"] = next_step(job, job["estimates"], origin, pending[0] if pending else None)
    return jobs

def job_detail(conn, job_id):
    found = job_records(conn, job_id)
    if not found:
        raise HTTPException(404, "Record not found")
    job = found[0]
    if job["project"]:
        snapshot = conn.execute("SELECT snapshot FROM project_origins WHERE job_id=?", (job_id,)).fetchone()["snapshot"]
        job["project"]["scope"] = json.loads(snapshot)["job"]["scope"]
    return job

@router.get("/jobs", dependencies=[Depends(admin)])
def jobs():
    with closing(connect()) as conn:
        return job_records(conn)

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
                {"description": "", "kind": "labor", "quantity": "1", "unit": "hour", "unit_cost": "0",
                 "cost_cents": 0, "markup_cents": 0, "price_cents": 0}], "price_cents": 0}],
            "totals": dict(cost_cents=0, markup_cents=0, subtotal_cents=0, taxable_cents=0, tax_cents=0, total_cents=0)
        }
        if not latest:
            document["job"] = job
        document["saved_at"] = now()
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
        # Kept inside the document so an approved revision freezes its own date.
        document["saved_at"] = now()
        conn.execute("UPDATE estimates SET document=?,version=version+1 WHERE id=?", (json.dumps(document), id))
        conn.execute("UPDATE jobs SET updated_at=? WHERE id=?", (document["saved_at"], estimate["job_id"]))
        return estimate_detail(conn, id)

@router.get("/estimates/{id}/preview", dependencies=[Depends(admin)])
def estimate_preview(id: int):
    with closing(connect()) as conn:
        estimate = estimate_detail(conn, id)
        return dict(id=id, job_id=estimate["job_id"], revision=estimate["revision"], state=estimate["state"],
                    approved_by=estimate["approved_by"], approved_at=estimate["approved_at"],
                    prepared_at=estimate["document"].get("saved_at") or estimate["created_at"],
                    document=client_document(estimate["document"]))

@router.get("/price-history", dependencies=[Depends(admin)])
def price_history(exclude: int | None = None):
    """Lines already priced on this company's saved estimates, newest first.

    Nothing is generated. Each entry is the most recent unit cost entered for that
    description, type and unit. These are internal costs: administrators only.
    """
    with closing(connect()) as conn:
        found = {}
        for row in conn.execute("""SELECT e.id,e.job_id,e.revision,e.state,e.document,e.created_at,j.name AS job_name
              FROM estimates e JOIN jobs j ON j.id=e.job_id ORDER BY e.id DESC LIMIT 300"""):
            if row["id"] == exclude:
                continue
            document = json.loads(row["document"])
            for section in document.get("sections", []):
                for line in section.get("lines", []):
                    try:
                        priced = Decimal(str(line["unit_cost"])) > 0
                    except (InvalidOperation, KeyError):
                        priced = False
                    if not priced:
                        continue
                    key = (line["description"].casefold(), line["kind"], line["unit"].casefold())
                    if key in found:
                        found[key]["job_ids"].add(row["job_id"])
                        continue
                    found[key] = dict(description=line["description"], kind=line["kind"], unit=line["unit"],
                                      unit_cost=str(line["unit_cost"]), job_name=row["job_name"],
                                      revision=row["revision"], state=row["state"],
                                      used_at=document.get("saved_at") or row["created_at"], job_ids={row["job_id"]})
        return [{**{k: v for k, v in entry.items() if k != "job_ids"}, "jobs": len(entry["job_ids"])}
                for entry in list(found.values())[:500]]

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
        record_event(conn, "estimate.approved", id,
                     dict(estimate_id=id, job_id=estimate["job_id"], revision=estimate["revision"]),
                     f"estimate.approved:{id}")
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
        record_event(conn, "project.created", board_id,
                     dict(board_id=board_id, job_id=estimate["job_id"], estimate_id=id),
                     f"project.created:{estimate['job_id']}")
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

# The only task fields a field worker ever receives: no prices or internal figures.
FIELD_TASK = """SELECT i.id,i.name,i.status,i.owner,i.due_date,i.notes,i.updated_at,g.name AS section
      FROM items i JOIN groups g ON g.id=i.group_id"""

def work_detail(conn, board_id, user):
    board = worker_board(conn,board_id,user)
    result = {k: board[k] for k in ("id","name","address","client")}
    origin = conn.execute("SELECT snapshot FROM project_origins WHERE board_id=?", (board_id,)).fetchone()
    result["scope"] = json.loads(origin["snapshot"])["job"]["scope"] if origin else ""
    team = conn.execute("SELECT name FROM team WHERE id=?", (user["team_id"],)).fetchone()
    result["tasks"] = [{**dict(r), "mine": bool(team) and r["owner"] == team["name"]} for r in conn.execute(
        FIELD_TASK + " WHERE g.board_id=? ORDER BY i.due_date IS NULL,i.due_date,i.id", (board_id,))]
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
        if payload.status != item["status"]:
            conn.execute("INSERT INTO activity(board_id,message,kind,created_at) VALUES(?,?,?,?)",
                         (board_id, f"{user['name']} moved {item['name']} to {TASK_LABEL[payload.status]}",
                          payload.status if payload.status in ("blocked", "done") else "update", now()))
        elif payload.notes != item["notes"]:
            conn.execute("INSERT INTO activity(board_id,message,kind,created_at) VALUES(?,?,'update',?)",
                         (board_id, f"{user['name']} added a note on {item['name']}", now()))
        saved = conn.execute(FIELD_TASK + " WHERE i.id=?", (task_id,)).fetchone()
        return {**dict(saved), "mine": True, "ok": True}

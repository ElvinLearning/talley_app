"""A.E. Talley Construction — field board API."""

import os
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional
from datetime import date
from typing import Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .db import connect, init_db
from .auth import admin, router as auth_router
from .workflow import router as workflow_router
from .bootstrap import initialize

STATUSES = ["not_started", "in_progress", "blocked", "review", "done"]

BOARD_SELECT = """
SELECT b.*,
    (SELECT COUNT(*) FROM items i JOIN groups g ON i.group_id = g.id WHERE g.board_id = b.id) AS total_items,
    (SELECT COUNT(*) FROM items i JOIN groups g ON i.group_id = g.id WHERE g.board_id = b.id AND i.status = 'done') AS done_items,
    (SELECT COUNT(*) FROM items i JOIN groups g ON i.group_id = g.id WHERE g.board_id = b.id AND i.status = 'blocked') AS blocked_items,
    (SELECT COUNT(*) FROM items i JOIN groups g ON i.group_id = g.id WHERE g.board_id = b.id AND i.status != 'done') AS open_items,
    (SELECT COALESCE(SUM(i.cost), 0) FROM items i JOIN groups g ON i.group_id = g.id WHERE g.board_id = b.id) AS committed,
    (SELECT o.job_id FROM project_origins o WHERE o.board_id = b.id) AS job_id
FROM boards b
"""


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    initialize()
    yield


public_app = FastAPI(title="Talley Operations", lifespan=lifespan)
# Existing cost-bearing board routes are administrator-only.
app = APIRouter(dependencies=[Depends(admin)])

@public_app.middleware("http")
async def security_headers(request: Request, call_next):
    if request.method not in ("GET", "HEAD", "OPTIONS") and request.headers.get("x-talley-request") != "1":
        return JSONResponse({"detail": "Missing same-origin request header"}, status_code=403)
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    return response

public_app.include_router(auth_router)
public_app.include_router(workflow_router)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _short_day(iso: str) -> str:
    day = date.fromisoformat(iso[:10])
    return f"{day:%b} {day.day}"


class BoardIn(BaseModel):
    name: str = Field(min_length=1)
    client: str = ""
    address: str = ""
    contract_value: float = 0
    accent: str = "#6D2431"
    start_date: Optional[str] = None
    target_date: Optional[str] = None


class BoardPatch(BaseModel):
    name: Optional[str] = None
    client: Optional[str] = None
    address: Optional[str] = None
    contract_value: Optional[float] = None
    target_date: Optional[str] = None


class GroupIn(BaseModel):
    name: str = Field(min_length=1)
    color: str = "#6D2431"


class GroupPatch(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


class ItemIn(BaseModel):
    name: str = Field(min_length=1)
    status: Literal["not_started","in_progress","blocked","review","done"] = "not_started"
    owner: str = ""
    start_date: Optional[str] = None
    due_date: Optional[date] = None
    cost: float = Field(default=0, ge=0, le=1e10, allow_inf_nan=False)
    notes: str = ""


class ItemPatch(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=300)
    status: Optional[str] = None
    owner: Optional[str] = Field(default=None, max_length=200)
    start_date: Optional[str] = None
    due_date: Optional[date] = None
    cost: Optional[float] = Field(default=None, ge=0, le=1e10, allow_inf_nan=False)
    notes: Optional[str] = None


def _activity(conn, board_id: int, message: str, kind: str = "update") -> None:
    conn.execute(
        "INSERT INTO activity (board_id, message, kind, created_at) VALUES (?, ?, ?, ?)",
        (board_id, message, kind, _now()),
    )


def _board_or_404(conn, board_id: int):
    row = conn.execute(f"{BOARD_SELECT} WHERE b.id = ?", (board_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Board not found")
    return row


def _board_of_group(conn, group_id: int) -> int:
    row = conn.execute("SELECT board_id FROM groups WHERE id = ?", (group_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Group not found")
    return row["board_id"]


def _board_of_item(conn, item_id: int) -> int:
    row = conn.execute(
        "SELECT g.board_id AS board_id FROM items i JOIN groups g ON i.group_id = g.id WHERE i.id = ?",
        (item_id,),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Item not found")
    return row["board_id"]


@app.get("/api/health")
def health():
    conn = connect()
    try:
        conn.execute("SELECT 1 FROM boards LIMIT 1").fetchone()
    finally:
        conn.close()
    return {"status": "ok"}


@app.get("/api/boards")
def list_boards():
    conn = connect()
    try:
        rows = conn.execute(f"{BOARD_SELECT} ORDER BY b.id").fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


@app.post("/api/boards", status_code=201)
def create_board(payload: BoardIn):
    conn = connect()
    try:
        cursor = conn.execute(
            """INSERT INTO boards (name, client, address, contract_value, accent, start_date, target_date, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                payload.name,
                payload.client,
                payload.address,
                payload.contract_value,
                payload.accent,
                payload.start_date or datetime.now(timezone.utc).date().isoformat(),
                payload.target_date,
                _now(),
            ),
        )
        board_id = cursor.lastrowid
        conn.execute(
            "INSERT INTO groups (board_id, name, color, position) VALUES (?, ?, ?, 0)",
            (board_id, "New scope", payload.accent),
        )
        _activity(conn, board_id, "Project created", "update")
        conn.commit()
        return _board_or_404(conn, board_id) and dict(_board_or_404(conn, board_id))
    finally:
        conn.close()


@app.get("/api/boards/{board_id}")
def get_board(board_id: int):
    conn = connect()
    try:
        board = dict(_board_or_404(conn, board_id))
        groups = conn.execute(
            "SELECT * FROM groups WHERE board_id = ? ORDER BY position, id", (board_id,)
        ).fetchall()
        items = conn.execute(
            """SELECT i.* FROM items i JOIN groups g ON i.group_id = g.id
               WHERE g.board_id = ? ORDER BY i.position, i.id""",
            (board_id,),
        ).fetchall()
        by_group = {}
        for item in items:
            by_group.setdefault(item["group_id"], []).append(dict(item))
        board["groups"] = [
            {**dict(group), "items": by_group.get(group["id"], [])} for group in groups
        ]
        board["activity"] = [
            dict(row)
            for row in conn.execute(
                "SELECT * FROM activity WHERE board_id = ? ORDER BY id DESC LIMIT 20", (board_id,)
            ).fetchall()
        ]
        return board
    finally:
        conn.close()


@app.patch("/api/boards/{board_id}")
def patch_board(board_id: int, payload: BoardPatch):
    fields = payload.model_dump(exclude_unset=True)
    conn = connect()
    try:
        _board_or_404(conn, board_id)
        if fields:
            assignments = ", ".join(f"{key} = ?" for key in fields)
            conn.execute(
                f"UPDATE boards SET {assignments} WHERE id = ?",
                [*fields.values(), board_id],
            )
            conn.commit()
        return dict(_board_or_404(conn, board_id))
    finally:
        conn.close()


@app.delete("/api/boards/{board_id}", status_code=204)
def delete_board(board_id: int):
    conn = connect()
    try:
        _board_or_404(conn, board_id)
        if conn.execute("SELECT 1 FROM project_origins WHERE board_id=?", (board_id,)).fetchone():
            raise HTTPException(409, "Converted projects retain their approved estimate. Mark the job complete instead.")
        conn.execute("DELETE FROM boards WHERE id = ?", (board_id,))
        conn.commit()
    finally:
        conn.close()


@app.post("/api/boards/{board_id}/groups", status_code=201)
def create_group(board_id: int, payload: GroupIn):
    conn = connect()
    try:
        _board_or_404(conn, board_id)
        next_position = conn.execute(
            "SELECT COALESCE(MAX(position), -1) + 1 AS p FROM groups WHERE board_id = ?", (board_id,)
        ).fetchone()["p"]
        cursor = conn.execute(
            "INSERT INTO groups (board_id, name, color, position) VALUES (?, ?, ?, ?)",
            (board_id, payload.name, payload.color, next_position),
        )
        group_id = cursor.lastrowid
        conn.commit()
        row = conn.execute("SELECT * FROM groups WHERE id = ?", (group_id,)).fetchone()
        return {**dict(row), "items": []}
    finally:
        conn.close()


@app.patch("/api/groups/{group_id}")
def patch_group(group_id: int, payload: GroupPatch):
    fields = payload.model_dump(exclude_unset=True)
    conn = connect()
    try:
        _board_of_group(conn, group_id)
        if fields:
            assignments = ", ".join(f"{key} = ?" for key in fields)
            conn.execute(
                f"UPDATE groups SET {assignments} WHERE id = ?", [*fields.values(), group_id]
            )
            conn.commit()
        return dict(conn.execute("SELECT * FROM groups WHERE id = ?", (group_id,)).fetchone())
    finally:
        conn.close()


@app.delete("/api/groups/{group_id}", status_code=204)
def delete_group(group_id: int):
    conn = connect()
    try:
        _board_of_group(conn, group_id)
        conn.execute("DELETE FROM groups WHERE id = ?", (group_id,))
        conn.commit()
    finally:
        conn.close()


@app.post("/api/groups/{group_id}/items", status_code=201)
def create_item(group_id: int, payload: ItemIn):
    conn = connect()
    try:
        board_id = _board_of_group(conn, group_id)
        next_position = conn.execute(
            "SELECT COALESCE(MAX(position), -1) + 1 AS p FROM items WHERE group_id = ?", (group_id,)
        ).fetchone()["p"]
        stamp = _now()
        cursor = conn.execute(
            """INSERT INTO items
               (group_id, name, status, owner, start_date, due_date, cost, notes, position, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                group_id,
                payload.name,
                payload.status,
                payload.owner,
                payload.start_date,
                payload.due_date.isoformat() if payload.due_date else None,
                payload.cost,
                payload.notes,
                next_position,
                stamp,
                stamp,
            ),
        )
        item_id = cursor.lastrowid
        _activity(conn, board_id, f"Task added: {payload.name}", "add")
        conn.commit()
        return dict(conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone())
    finally:
        conn.close()


@app.patch("/api/items/{item_id}")
def patch_item(item_id: int, payload: ItemPatch):
    fields = payload.model_dump(exclude_unset=True, mode="json")
    if "status" in fields and fields["status"] not in STATUSES:
        raise HTTPException(status_code=400, detail="Unknown status")
    conn = connect()
    try:
        board_id = _board_of_item(conn, item_id)
        if fields:
            previous = conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
            fields["updated_at"] = _now()
            assignments = ", ".join(f"{key} = ?" for key in fields)
            conn.execute(
                f"UPDATE items SET {assignments} WHERE id = ?", [*fields.values(), item_id]
            )
            if "status" in fields and fields["status"] != previous["status"]:
                _activity(
                    conn,
                    board_id,
                    f"{previous['name']} moved to {fields['status'].replace('_', ' ')}",
                    "blocked" if fields["status"] == "blocked" else "done" if fields["status"] == "done" else "update",
                )
            if "owner" in fields and fields["owner"] != previous["owner"]:
                _activity(conn, board_id, f"{previous['name']} assigned to {fields['owner']}" if fields["owner"]
                          else f"{previous['name']} is unassigned")
            if "due_date" in fields and fields["due_date"] != previous["due_date"]:
                _activity(conn, board_id, f"{previous['name']} due {_short_day(fields['due_date'])}"
                          if fields["due_date"] else f"{previous['name']} due date cleared")
            conn.commit()
        return dict(conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone())
    finally:
        conn.close()


@app.delete("/api/items/{item_id}", status_code=204)
def delete_item(item_id: int):
    conn = connect()
    try:
        board_id = _board_of_item(conn, item_id)
        row = conn.execute("SELECT name FROM items WHERE id = ?", (item_id,)).fetchone()
        conn.execute("DELETE FROM items WHERE id = ?", (item_id,))
        _activity(conn, board_id, f"Task removed: {row['name']}", "delete")
        conn.commit()
    finally:
        conn.close()


@app.get("/api/team")
def list_team():
    conn = connect()
    try:
        rows = conn.execute(
            """SELECT t.*,
                 (SELECT COUNT(*) FROM items i WHERE i.owner = t.name AND i.status != 'done') AS open_items,
                 (SELECT COUNT(*) FROM items i WHERE i.owner = t.name AND i.status = 'blocked') AS blocked_items
               FROM team t ORDER BY t.id"""
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


@app.get("/api/overview")
def overview():
    conn = connect()
    try:
        boards = [dict(row) for row in conn.execute(f"{BOARD_SELECT} ORDER BY b.id").fetchall()]
        status_rows = conn.execute(
            "SELECT status, COUNT(*) AS count FROM items GROUP BY status"
        ).fetchall()
        by_status = {status: 0 for status in STATUSES}
        for row in status_rows:
            by_status[row["status"]] = row["count"]
        due_soon = [
            dict(row)
            for row in conn.execute(
                """SELECT i.id, i.name, i.status, i.owner, i.due_date, i.cost,
                          b.id AS board_id, b.name AS board_name
                   FROM items i JOIN groups g ON i.group_id = g.id JOIN boards b ON g.board_id = b.id
                   WHERE i.status != 'done' AND i.due_date IS NOT NULL
                     AND date(i.due_date) <= date('now', '+10 days')
                   ORDER BY date(i.due_date), i.id LIMIT 8"""
            ).fetchall()
        ]
        return {
            "boards": boards,
            "by_status": by_status,
            "contract_value": sum(board["contract_value"] for board in boards),
            "committed": sum(board["committed"] for board in boards),
            "due_soon": due_soon,
        }
    finally:
        conn.close()

public_app.include_router(app)

@public_app.get("/healthz")
def readiness():
    return {"ok": True}

# Hash-based frontend routes need only the root HTML. Register after API routes.
static_dir = os.environ.get("STATIC_DIR")
if static_dir:
    public_app.mount("/", StaticFiles(directory=Path(static_dir), html=True), name="frontend")

app = public_app

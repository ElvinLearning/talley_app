"""Local, permission-checked evidence for future AI tools. No model calls."""
import json
import re
from contextlib import closing
from decimal import Decimal, InvalidOperation
from fastapi import APIRouter, Depends, Query
from .auth import admin
from .db import connect

router = APIRouter(prefix="/api", dependencies=[Depends(admin)])


@router.get("/assistant/evidence")
def evidence(q: str = Query(default="", max_length=200), approved_only: bool = True):
    tokens = set(re.findall(r"\w+", q.casefold()))
    matches = []
    with closing(connect()) as conn:
        rows = conn.execute("""SELECT id,job_id,revision,version,state,document,created_at
            FROM estimates WHERE (?=0 OR state='approved') ORDER BY id DESC LIMIT 300""",
            (int(approved_only),)).fetchall()
        for row in rows:
            doc = json.loads(row["document"])
            for section_index, section in enumerate(doc.get("sections", [])):
                for line_index, line in enumerate(section.get("lines", [])):
                    try:
                        if not Decimal(str(line.get("unit_cost", "0"))) > 0:
                            continue
                    except InvalidOperation:
                        continue
                    haystack = " ".join([line.get("description", ""), section["name"],
                                         doc.get("job", {}).get("name", "")]).casefold()
                    if tokens and not all(token in haystack for token in tokens):
                        continue
                    matches.append(dict(
                        source_id=f"estimate:{row['id']}:version:{row['version']}:section:{section_index}:line:{line_index}",
                        estimate_version=row["version"],
                        estimate_id=row["id"], job_id=row["job_id"], revision=row["revision"],
                        state=row["state"], job_name=doc.get("job", {}).get("name", "Saved estimate"),
                        section=section["name"], description=line["description"], kind=line["kind"],
                        unit=line["unit"], unit_cost=line["unit_cost"],
                        saved_at=doc.get("saved_at") or row["created_at"],
                        href=f"#/jobs/{row['job_id']}/estimates/{row['id']}",
                    ))
    return dict(schema_version=1, mode="saved_estimates", generated=False,
                searched_estimates=len(rows), search_limit=300,
                total_matches=len(matches), results=matches[:60])


@router.get("/integrations")
def integrations():
    with closing(connect()) as conn:
        events = conn.execute("SELECT COUNT(*) AS count, MAX(created_at) AS latest FROM integration_events").fetchone()
    return dict(schema_version=1, external_delivery_enabled=False,
                recorded_events=events["count"], latest_event_at=events["latest"],
                connections=[
                    dict(id="ai", name="AI assistance", status="not_connected",
                         description="Historical evidence is available. Generated drafts need a configured model and review workflow."),
                    dict(id="accounting", name="Accounting", status="not_connected",
                         description="Approval and project events are recorded locally. No financial records are sent."),
                    dict(id="phone", name="Calls & lead capture", status="not_connected",
                         description="Phone screening needs a provider connection and a tested human handoff."),
                    dict(id="calendar", name="Calendar", status="not_connected",
                         description="Task dates stay in this workspace until a calendar is connected."),
                ])


@router.get("/integrations/events")
def events(after: int = Query(default=0, ge=0), limit: int = Query(default=50, ge=1, le=100)):
    with closing(connect()) as conn:
        rows = conn.execute("SELECT * FROM integration_events WHERE sequence>? ORDER BY sequence LIMIT ?",
                            (after, limit + 1)).fetchall()
    items = [{**{k: row[k] for k in ("sequence", "event_id", "event_type", "resource_id", "created_at")},
              "schema_version": 1, "payload": json.loads(row["payload"])} for row in rows[:limit]]
    return dict(items=items, next_cursor=items[-1]["sequence"] if items else after, has_more=len(rows) > limit)

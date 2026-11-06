"""SQLite storage for the Talley field board."""

import os
import sqlite3
from datetime import date, datetime, timedelta

DB_PATH = os.environ.get("DATABASE_PATH", "/data/talley.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS team (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    initials TEXT NOT NULL,
    color TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS boards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    client TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    contract_value REAL NOT NULL DEFAULT 0,
    accent TEXT NOT NULL DEFAULT '#6D2431',
    start_date TEXT,
    target_date TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6D2431',
    position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'not_started',
    owner TEXT NOT NULL DEFAULT '',
    start_date TEXT,
    due_date TEXT,
    cost REAL NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'update',
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_groups_board ON groups(board_id);
CREATE INDEX IF NOT EXISTS idx_items_group ON items(group_id);
CREATE INDEX IF NOT EXISTS idx_activity_board ON activity(board_id);
"""

TEAM = [
    ("Randy Talley", "Principal", "RT", "#6D2431", "423-555-0141"),
    ("Dana Fields", "Project Manager", "DF", "#4A6FA5", "423-555-0177"),
    ("Marcus Webb", "Superintendent", "MW", "#A8552F", "423-555-0132"),
    ("Luis Ortega", "Site Foreman", "LO", "#3F5B4A", "423-555-0158"),
    ("Priya Raman", "Estimator", "PR", "#5B4B6E", "423-555-0163"),
    ("Cole Bennett", "MEP Coordinator", "CB", "#8A3444", "423-555-0119"),
    ("Erin Shaw", "Accounting", "ES", "#7A6A4F", "423-555-0186"),
]

# (name, status, owner, start offset, due offset, committed cost, notes)
SEED_BOARDS = [
    {
        "name": "Harbor Point Medical Office",
        "client": "Harbor Health Partners",
        "address": "1420 Harbor Point Drive · Chattanooga, TN",
        "contract_value": 8450000,
        "accent": "#6D2431",
        "start_offset": -128,
        "target_offset": 214,
        "groups": [
            (
                "Pre-Construction",
                "#6D2431",
                [
                    ("Permit set resubmittal — building", "review", "Dana Fields", -6, 3, 12500, "City asked for a revised egress calc on level 2. Drew submitted 11/4."),
                    ("GMP subcontract buyout", "in_progress", "Priya Raman", -14, 12, 0, "Divisions 8, 9, 21 out for signature."),
                    ("Long-lead equipment order (RTUs)", "done", "Cole Bennett", -96, -61, 184000, "Four 25-ton units, confirmed 14-week lead time."),
                ],
            ),
            (
                "Site & Foundation",
                "#A8552F",
                [
                    ("Mass excavation & erosion control", "done", "Luis Ortega", -120, -92, 96500, ""),
                    ("Footings & grade beams", "done", "Luis Ortega", -90, -64, 312000, ""),
                    ("Slab on grade pour — Zones A/B", "in_progress", "Marcus Webb", -30, 4, 268400, "Zone A cured. Zone B pour scheduled for Tuesday, weather permitting."),
                    ("Under-slab plumbing rough-in", "blocked", "Cole Bennett", -26, -2, 74200, "Waiting on the city water tap inspection — rescheduled twice."),
                ],
            ),
            (
                "Structure",
                "#7A6A4F",
                [
                    ("Structural steel erection", "in_progress", "Marcus Webb", -18, 15, 640000, "Ironworkers on site, about 60% erected."),
                    ("Metal deck & pour stops", "not_started", "Luis Ortega", 6, 22, 88000, ""),
                    ("Elevated slab pour — Level 2", "not_started", "Marcus Webb", 24, 38, 214000, ""),
                ],
            ),
            (
                "Exterior Envelope",
                "#4A5B63",
                [
                    ("Storefront & curtain wall install", "not_started", "Dana Fields", 20, 58, 486000, "Shop drawings approved, glass is on the way from Atlanta."),
                    ("Roofing membrane & flashing", "not_started", "Luis Ortega", 30, 52, 198500, ""),
                    ("Masonry veneer — south elevation", "in_progress", "Luis Ortega", -8, 18, 142000, ""),
                ],
            ),
            (
                "MEP Rough-In",
                "#3F5B4A",
                [
                    ("Ductwork mains — Level 1", "in_progress", "Cole Bennett", -12, 9, 156000, ""),
                    ("Electrical rough-in — Level 1", "in_progress", "Cole Bennett", -10, 16, 214800, "Panel schedules updated for the added imaging room."),
                    ("Sprinkler main & riser", "review", "Cole Bennett", -20, 5, 98400, "Shop drawings under fire marshal review."),
                ],
            ),
            (
                "Finish Out & Closeout",
                "#5B4B6E",
                [
                    ("Drywall hang & finish — Wing A", "not_started", "Marcus Webb", 42, 71, 176000, ""),
                    ("Punch list — Wing A", "not_started", "Dana Fields", 86, 96, 0, ""),
                    ("Final inspections & TCO", "not_started", "Dana Fields", 120, 138, 0, "Target TCO two weeks before owner occupancy."),
                ],
            ),
        ],
    },
    {
        "name": "Ridgeline Elementary — Summer Renovation",
        "client": "Hamilton County Schools",
        "address": "88 Ridgeline Road · Soddy-Daisy, TN",
        "contract_value": 2180000,
        "accent": "#4A5B63",
        "start_offset": -34,
        "target_offset": 61,
        "groups": [
            (
                "Mobilization",
                "#6D2431",
                [
                    ("Site fencing & dumpsters", "done", "Luis Ortega", -34, -31, 18400, ""),
                    ("Temporary power & water", "done", "Luis Ortega", -32, -29, 6200, ""),
                ],
            ),
            (
                "Demolition",
                "#A8552F",
                [
                    ("Selective demo — classrooms 101–108", "done", "Marcus Webb", -28, -16, 84000, ""),
                    ("Hazmat abatement (floor tile)", "in_progress", "Marcus Webb", -12, 3, 41500, "Crew in half-masks and containment, second pass on Thursday."),
                ],
            ),
            (
                "Mechanical Upgrade",
                "#4A5B63",
                [
                    ("RTU changeout — roof curbs", "in_progress", "Cole Bennett", -9, 11, 168000, "Crane reserved for the 12th."),
                    ("Duct cleaning & balancing", "not_started", "Cole Bennett", 14, 30, 34000, ""),
                ],
            ),
            (
                "Interior Finishes",
                "#7A6A4F",
                [
                    ("VCT & carpet install", "not_started", "Luis Ortega", 20, 42, 96400, ""),
                    ("Paint — all corridors", "in_progress", "Marcus Webb", -4, 17, 38200, ""),
                    ("Casework & markerboards", "not_started", "Dana Fields", 34, 48, 44800, ""),
                ],
            ),
            (
                "Closeout",
                "#3F5B4A",
                [
                    ("Punch walk with district", "not_started", "Dana Fields", 50, 55, 0, "Facilities director wants it before teachers return."),
                    ("As-builts & O&M manuals", "review", "Dana Fields", 44, 58, 0, ""),
                ],
            ),
        ],
    },
    {
        "name": "Service Crew — Punch & Warranty",
        "client": "A.E. Talley — internal",
        "address": "Shop · 2210 Rossville Boulevard, Chattanooga",
        "contract_value": 0,
        "accent": "#7A6A4F",
        "start_offset": -12,
        "target_offset": 45,
        "groups": [
            (
                "Warranty & Punch",
                "#6D2431",
                [
                    ("Harbor Point punch — 3rd floor", "in_progress", "Marcus Webb", -5, 6, 0, "Owner walked it with Dana on Tuesday."),
                    ("Ridgeline punch — gym roof leak", "blocked", "Luis Ortega", -8, -1, 2400, "Roofing sub has not returned calls; Cole is chasing the warranty claim."),
                ],
            ),
            (
                "Shop & Fleet",
                "#7A6A4F",
                [
                    ("F-250 service & tire rotation", "not_started", "Luis Ortega", 2, 6, 1200, ""),
                    ("Scaffold inventory audit", "not_started", "Priya Raman", 8, 15, 0, ""),
                ],
            ),
        ],
    },
]

SEED_ACTIVITY = [
    ("Harbor Point Medical Office", "Slab on grade — Zone A pour completed", "done", 5),
    ("Harbor Point Medical Office", "Under-slab plumbing marked blocked: water tap inspection", "blocked", 22),
    ("Harbor Point Medical Office", "Structural steel erection hit 60%", "update", 30),
    ("Ridgeline Elementary — Summer Renovation", "Hazmat containment cleared first pass", "done", 8),
    ("Ridgeline Elementary — Summer Renovation", "Crane reservation confirmed for RTU changeout", "update", 19),
    ("Service Crew — Punch & Warranty", "Ridgeline gym roof leak escalated to warranty", "blocked", 3),
]


def connect() -> sqlite3.Connection:
    directory = os.path.dirname(DB_PATH)
    if directory:
        os.makedirs(directory, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _iso(offset_days: int) -> str:
    return (date.today() + timedelta(days=offset_days)).isoformat()


def _stamp(minutes_ago: int) -> str:
    return (datetime.utcnow() - timedelta(minutes=minutes_ago)).strftime("%Y-%m-%dT%H:%M:%S")


def init_db() -> None:
    conn = connect()
    try:
        conn.executescript(SCHEMA)
        conn.commit()
        if conn.execute("SELECT COUNT(*) AS c FROM boards").fetchone()["c"] > 0:
            return
        conn.executemany(
            "INSERT INTO team (name, role, initials, color, phone) VALUES (?, ?, ?, ?, ?)",
            TEAM,
        )
        board_ids = {}
        for board in SEED_BOARDS:
            cursor = conn.execute(
                """INSERT INTO boards (name, client, address, contract_value, accent, start_date, target_date, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    board["name"],
                    board["client"],
                    board["address"],
                    board["contract_value"],
                    board["accent"],
                    _iso(board["start_offset"]),
                    _iso(board["target_offset"]),
                    _stamp(60 * 24 * 40),
                ),
            )
            board_id = cursor.lastrowid
            board_ids[board["name"]] = board_id
            for group_position, (group_name, color, items) in enumerate(board["groups"]):
                group_cursor = conn.execute(
                    "INSERT INTO groups (board_id, name, color, position) VALUES (?, ?, ?, ?)",
                    (board_id, group_name, color, group_position),
                )
                group_id = group_cursor.lastrowid
                for item_position, (name, status, owner, start_off, due_off, cost, notes) in enumerate(items):
                    conn.execute(
                        """INSERT INTO items
                           (group_id, name, status, owner, start_date, due_date, cost, notes, position, created_at, updated_at)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        (
                            group_id,
                            name,
                            status,
                            owner,
                            _iso(start_off),
                            _iso(due_off),
                            cost,
                            notes,
                            item_position,
                            _stamp(60 * 24 * 20),
                            _stamp(60),
                        ),
                    )
        for board_name, message, kind, minutes in SEED_ACTIVITY:
            conn.execute(
                "INSERT INTO activity (board_id, message, kind, created_at) VALUES (?, ?, ?, ?)",
                (board_ids[board_name], message, kind, _stamp(minutes)),
            )
        conn.commit()
    finally:
        conn.close()

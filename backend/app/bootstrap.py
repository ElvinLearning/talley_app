import os
from pathlib import Path
from contextlib import closing
from .db import connect
from .auth import hash_password
from .workflow import now

def initialize():
    with closing(connect()) as conn, conn:
        for path in sorted((Path(__file__).parent.parent / "migrations").glob("*.sql")):
            # Migrations are additive and idempotent, including on the old board schema.
            conn.executescript(path.read_text())
            conn.execute("INSERT OR IGNORE INTO schema_migrations VALUES(?,?)", (path.stem, now()))
        if os.environ.get("DEMO_MODE") != "1":
            return
        password = os.environ.get("TALLEY_DEMO_PASSWORD", "")
        if len(password) < 12:
            raise RuntimeError("Set TALLEY_DEMO_PASSWORD to at least 12 characters for demo seeding")
        for username, name, role in [("admin.demo","Demo administrator","admin"),
                                     ("worker.demo","Demo field worker","worker"),
                                     ("other.demo","Demo unassigned worker","worker")]:
            if conn.execute("SELECT 1 FROM users WHERE username=?", (username,)).fetchone():
                continue
            team_id = conn.execute("INSERT INTO team(name,role,initials,color,phone) VALUES(?,?,?,'#6D2431','')",
                                   (name,role,"AD" if role == "admin" else "FW")).lastrowid
            conn.execute("INSERT INTO users(username,name,role,password_hash,team_id) VALUES(?,?,?,?,?)",
                         (username,name,role,hash_password(password),team_id))

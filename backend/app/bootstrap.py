import os
import logging
import sqlite3
from datetime import datetime, timezone
from uuid import uuid4
from pathlib import Path
from contextlib import closing
from .db import connect
from .auth import hash_password
from .workflow import now

def backup_before_migrations(conn, paths):
    """Keep an on-volume SQLite snapshot before upgrading an existing database.

    This is a migration rollback aid, not an off-site backup policy. Fresh
    databases have no migration ledger and need no snapshot.
    """
    if not conn.execute("SELECT 1 FROM sqlite_master WHERE name='schema_migrations'").fetchone():
        return
    applied = {row[0] for row in conn.execute("SELECT version FROM schema_migrations")}
    if all(path.stem in applied for path in paths):
        return
    database = conn.execute("PRAGMA database_list").fetchone()[2]
    if not database:
        return
    directory = Path(database).parent / "backups"
    directory.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    destination = directory / f"talley-before-migration-{stamp}-{uuid4().hex[:8]}.db"
    with closing(sqlite3.connect(destination)) as backup:
        conn.backup(backup)
        if backup.execute("PRAGMA quick_check").fetchone()[0] != "ok":
            raise RuntimeError("Pre-migration database backup failed integrity verification")
    logging.getLogger("uvicorn.error").info("Verified pre-migration database snapshot: %s", destination.name)

def initialize():
    with closing(connect()) as conn, conn:
        paths = sorted((Path(__file__).parent.parent / "migrations").glob("*.sql"))
        backup_before_migrations(conn, paths)
        for path in paths:
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

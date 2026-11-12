CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('admin','worker')), password_hash TEXT NOT NULL,
 team_id INTEGER REFERENCES team(id)
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS login_attempts (username TEXT PRIMARY KEY, failures INTEGER NOT NULL, blocked_until INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS customers (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL, contact TEXT NOT NULL,
 email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS jobs (
 id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id),
 name TEXT NOT NULL, address TEXT NOT NULL, scope TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('lead','estimating','approved','active','on_hold','complete')),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS estimates (
 id INTEGER PRIMARY KEY, job_id INTEGER NOT NULL REFERENCES jobs(id), revision INTEGER NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('draft','approved')), version INTEGER NOT NULL DEFAULT 1,
 document TEXT NOT NULL, approved_by TEXT, approval_note TEXT,
 approved_at TEXT, recorded_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL,
 UNIQUE(job_id, revision)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_draft_per_job ON estimates(job_id) WHERE state='draft';
CREATE TABLE IF NOT EXISTS project_origins (
 job_id INTEGER PRIMARY KEY REFERENCES jobs(id),
 board_id INTEGER NOT NULL UNIQUE REFERENCES boards(id) ON DELETE RESTRICT,
 estimate_id INTEGER NOT NULL UNIQUE REFERENCES estimates(id),
 budget_cents INTEGER NOT NULL, contract_cents INTEGER NOT NULL, snapshot TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS board_assignments (
 board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
 user_id INTEGER NOT NULL REFERENCES users(id), PRIMARY KEY(board_id,user_id)
);
CREATE TRIGGER IF NOT EXISTS approved_estimate_immutable
 BEFORE UPDATE ON estimates WHEN OLD.state='approved'
 BEGIN SELECT RAISE(ABORT, 'Approved estimates are immutable'); END;
CREATE TRIGGER IF NOT EXISTS approved_estimate_no_delete
 BEFORE DELETE ON estimates WHEN OLD.state='approved'
 BEGIN SELECT RAISE(ABORT, 'Approved estimates cannot be deleted'); END;

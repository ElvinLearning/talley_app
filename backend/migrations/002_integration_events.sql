CREATE TABLE IF NOT EXISTS integration_events (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT,
 event_id TEXT NOT NULL UNIQUE,
 event_type TEXT NOT NULL,
 resource_id INTEGER NOT NULL,
 payload TEXT NOT NULL,
 dedupe_key TEXT NOT NULL UNIQUE,
 created_at TEXT NOT NULL
);

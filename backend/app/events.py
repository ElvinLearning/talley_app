"""Transactional integration journal. No external delivery is enabled.

Call record_event on the same connection/transaction as the business change.
Consumers can checkpoint the sequence and deduplicate using event_id.
Payloads deliberately contain references, never customer details or prices.
"""
import json
from datetime import datetime, timezone
from uuid import uuid4


def record_event(conn, event_type, resource_id, payload, dedupe_key):
    conn.execute(
        """INSERT OR IGNORE INTO integration_events
        (event_id,event_type,resource_id,payload,dedupe_key,created_at)
        VALUES(?,?,?,?,?,?)""",
        (str(uuid4()), event_type, resource_id, json.dumps(payload), dedupe_key,
         datetime.now(timezone.utc).isoformat()),
    )

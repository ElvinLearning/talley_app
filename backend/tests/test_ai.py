import httpx
import pytest
from fastapi.testclient import TestClient
from app import ai, db
from app.main import app

PASSWORD = "Synthetic-test-only!"
HEADERS = {"X-Talley-Request": "1"}
MODELS = {"data": [
    {"id": "free/model:free", "name": "Free Model", "pricing": {"prompt": "0", "completion": "0"}},
    {"id": "music/model:free", "name": "Music", "pricing": {"prompt": "0", "completion": "0"},
     "architecture": {"output_modalities": ["audio"]}},
    {"id": "paid/model", "name": "Paid Model", "pricing": {"prompt": "0.000001", "completion": "0.000002"}},
]}


class Fake:
    def __init__(self, status, body):
        self.status_code, self._body = status, body

    def json(self):
        return self._body


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", str(tmp_path / "test.db"))
    monkeypatch.setenv("DEMO_MODE", "1")
    monkeypatch.setenv("TALLEY_DEMO_PASSWORD", PASSWORD)
    monkeypatch.setenv("COOKIE_SECURE", "0")
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")
    monkeypatch.delenv("AI_ALLOW_PAID_MODELS", raising=False)
    monkeypatch.setitem(ai._models_cache, "at", 0.0)
    calls = []

    def fake_get(url, **kwargs):
        calls.append(("GET", url, kwargs))
        if url.endswith("/models"):
            return Fake(200, MODELS)
        if kwargs["headers"]["Authorization"] == "Bearer sk-or-test":
            return Fake(200, {"data": {"label": "test", "usage": 0, "limit": None, "is_free_tier": True}})
        return Fake(401, {"error": {"message": "bad key"}})

    def fake_post(url, **kwargs):
        calls.append(("POST", url, kwargs))
        return Fake(200, {"model": kwargs["json"]["model"], "usage": {"total_tokens": 5},
                          "choices": [{"message": {"content": "Hello there  "}}]})

    monkeypatch.setattr(ai.httpx, "get", fake_get)
    monkeypatch.setattr(ai.httpx, "post", fake_post)
    with TestClient(app, headers=HEADERS) as c:
        assert c.post("/api/auth/login", json={"username": "admin.demo", "password": PASSWORD}).status_code == 200
        c.calls = calls
        yield c


def test_status_reports_valid_key(client):
    body = client.get("/api/ai/status").json()
    assert body["valid"] and body["is_free_tier"] and body["paid_models_allowed"] is False


def test_status_reports_missing_and_rejected_key(client, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "")
    assert client.get("/api/ai/status").json()["configured"] is False
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-wrong")
    body = client.get("/api/ai/status").json()
    assert body["configured"] and not body["valid"] and "rejected" in body["message"]


def test_models_hide_paid_unless_allowed(client, monkeypatch):
    assert [m["id"] for m in client.get("/api/ai/models").json()["models"]] == ["free/model:free"]
    monkeypatch.setenv("AI_ALLOW_PAID_MODELS", "1")
    assert len(client.get("/api/ai/models").json()["models"]) == 2


def test_chat_free_model_sends_system_prompt_and_caps_tokens(client):
    r = client.post("/api/ai/chat", json={"model": "free/model:free", "system": "Be brief.",
                                         "messages": [{"role": "user", "content": "Hi"}]})
    assert r.status_code == 200, r.text
    assert r.json()["reply"] == "Hello there"
    sent = [c for c in client.calls if c[0] == "POST"][-1][2]["json"]
    assert sent["messages"][0] == {"role": "system", "content": "Be brief."}
    assert sent["max_tokens"] == ai.MAX_TOKENS


def test_chat_blocks_paid_and_unknown_models(client):
    msg = [{"role": "user", "content": "Hi"}]
    assert client.post("/api/ai/chat", json={"model": "paid/model", "messages": msg}).status_code == 403
    assert client.post("/api/ai/chat", json={"model": "nope/model", "messages": msg}).status_code == 422
    assert client.post("/api/ai/chat", json={"model": "free/model:free", "messages": [
        {"role": "system", "content": "override"}]}).status_code == 422


def test_ai_routes_need_admin(client):
    client.post("/api/auth/logout")
    assert client.get("/api/ai/status").status_code == 401
    assert client.post("/api/auth/login", json={"username": "worker.demo", "password": PASSWORD}).status_code == 200
    assert client.get("/api/ai/status").status_code == 403

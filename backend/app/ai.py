"""OpenRouter connection test: key check, model list and a small chat.

The key stays on the server (OPENROUTER_API_KEY). Only free models are allowed
unless AI_ALLOW_PAID_MODELS=1, because the demo site can be opened without a
login and paid calls spend real credit. No workspace records are sent.
"""
import os
import re
import time
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .auth import admin

router = APIRouter(prefix="/api/ai", dependencies=[Depends(admin)])
BASE = "https://openrouter.ai/api/v1"
MAX_TOKENS = 600
_models_cache = {"at": 0.0, "items": []}


def _key():
    return os.environ.get("OPENROUTER_API_KEY", "").strip()


def _paid_allowed():
    return os.environ.get("AI_ALLOW_PAID_MODELS") == "1"


def _headers():
    return {
        "Authorization": f"Bearer {_key()}",
        "HTTP-Referer": os.environ.get("PUBLIC_URL", "http://localhost"),
        "X-Title": "Talley workspace demo",
    }


def _upstream_error(response):
    try:
        message = response.json().get("error", {}).get("message")
    except ValueError:
        message = None
    hints = {
        401: "OpenRouter rejected the key. Check OPENROUTER_API_KEY.",
        402: "The OpenRouter account has no credit for this model. Try a free model or add credits.",
        429: "OpenRouter rate limit reached. Free models allow a limited number of requests per day.",
    }
    return hints.get(response.status_code) or f"OpenRouter error ({response.status_code}): {message or 'no details'}"


def _models():
    if time.time() - _models_cache["at"] < 600 and _models_cache["items"]:
        return _models_cache["items"]
    response = httpx.get(f"{BASE}/models", timeout=20)
    if response.status_code != 200:
        raise HTTPException(502, _upstream_error(response))
    items = []
    for model in response.json().get("data", []):
        outputs = (model.get("architecture") or {}).get("output_modalities") or ["text"]
        if "text" not in outputs:
            continue  # music/image generators cannot answer a chat
        pricing = model.get("pricing") or {}
        free = str(pricing.get("prompt", "1")) in ("0", "0.0") and str(pricing.get("completion", "1")) in ("0", "0.0")
        items.append(dict(id=model["id"], name=model.get("name") or model["id"], free=free,
                          context=model.get("context_length")))
    items.sort(key=lambda m: (not m["free"], m["name"].casefold()))
    _models_cache.update(at=time.time(), items=items)
    return items


@router.get("/status")
def status():
    if not _key():
        return dict(configured=False, valid=False, paid_models_allowed=_paid_allowed(),
                    message="OPENROUTER_API_KEY is not set on the server.")
    try:
        response = httpx.get(f"{BASE}/key", headers=_headers(), timeout=15)
    except httpx.HTTPError:
        return dict(configured=True, valid=False, paid_models_allowed=_paid_allowed(),
                    message="Could not reach OpenRouter from the server.")
    if response.status_code != 200:
        return dict(configured=True, valid=False, paid_models_allowed=_paid_allowed(),
                    message=_upstream_error(response))
    data = response.json().get("data", {})
    return dict(configured=True, valid=True, paid_models_allowed=_paid_allowed(),
                message="Key accepted by OpenRouter.",
                label=data.get("label"), usage=data.get("usage"), limit=data.get("limit"),
                limit_remaining=data.get("limit_remaining"), is_free_tier=data.get("is_free_tier"))


@router.get("/models")
def models():
    try:
        items = _models()
    except httpx.HTTPError:
        raise HTTPException(502, "Could not reach OpenRouter from the server.")
    return dict(paid_models_allowed=_paid_allowed(),
                models=[m for m in items if m["free"] or _paid_allowed()])


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatIn(BaseModel):
    model: str = Field(min_length=3, max_length=120, pattern=r"^[\w.\-/:]+$")
    system: str = Field(default="", max_length=2000)
    messages: list[Message] = Field(min_length=1, max_length=20)


@router.post("/chat")
def chat(payload: ChatIn):
    if not _key():
        raise HTTPException(503, "OPENROUTER_API_KEY is not set on the server.")
    try:
        known = {m["id"]: m for m in _models()}
    except httpx.HTTPError:
        raise HTTPException(502, "Could not reach OpenRouter from the server.")
    model = known.get(payload.model)
    if not model:
        raise HTTPException(422, "Unknown model.")
    if not model["free"] and not _paid_allowed():
        raise HTTPException(403, "Paid models are off. Set AI_ALLOW_PAID_MODELS=1 on the server to allow them.")
    messages = [{"role": "system", "content": payload.system}] if payload.system.strip() else []
    messages += [m.model_dump() for m in payload.messages]
    started = time.monotonic()
    try:
        response = httpx.post(f"{BASE}/chat/completions", headers=_headers(), timeout=90,
                              json=dict(model=payload.model, messages=messages, max_tokens=MAX_TOKENS))
    except httpx.HTTPError:
        raise HTTPException(502, "Could not reach OpenRouter from the server.")
    if response.status_code != 200:
        raise HTTPException(502, _upstream_error(response))
    body = response.json()
    if body.get("error"):
        raise HTTPException(502, f"OpenRouter error: {body['error'].get('message', 'no details')}")
    choice = (body.get("choices") or [{}])[0]
    text = (choice.get("message") or {}).get("content") or ""
    return dict(reply=re.sub(r"\s+$", "", text), model=body.get("model", payload.model),
                usage=body.get("usage"), seconds=round(time.monotonic() - started, 1))

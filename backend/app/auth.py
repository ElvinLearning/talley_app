"""Opaque, revocable server sessions; no browser-controlled roles."""
import hashlib
import hmac
import os
import secrets
import time
from contextlib import closing
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from .db import connect

router = APIRouter(prefix="/api/auth")

def hash_password(password):
    salt = secrets.token_hex(16)
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
    return salt + ":" + digest

def verify_password(password, encoded):
    salt, expected = encoded.split(":")
    actual = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
    return hmac.compare_digest(actual, expected)

def current_user(request: Request):
    token = request.cookies.get("talley_session", "")
    with closing(connect()) as conn:
        row = conn.execute("""SELECT u.id,u.username,u.name,u.role,u.team_id FROM sessions s
          JOIN users u ON u.id=s.user_id WHERE token_hash=? AND expires_at>?""",
          (hashlib.sha256(token.encode()).hexdigest(), int(time.time()))).fetchone()
    # Explicit demo-only access; real sessions retain their assigned role.
    if not row and os.environ.get("DEMO_MODE") == "1" and os.environ.get("DEMO_SKIP_LOGIN") == "1":
        with closing(connect()) as conn:
            row = conn.execute("SELECT id,username,name,role,team_id FROM users WHERE username='admin.demo' AND role='admin'").fetchone()
        if row:
            return {**dict(row), "demo_access": True}
    if not row:
        raise HTTPException(401, "Sign in to continue")
    return dict(row)

def admin(user=Depends(current_user)):
    if user["role"] != "admin":
        raise HTTPException(403, "Administrator access required")
    return user

class Login(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=256)

@router.post("/login")
def login(payload: Login, response: Response):
    username = payload.username.strip().lower()
    now = int(time.time())
    with closing(connect()) as conn:
        attempt = conn.execute("SELECT * FROM login_attempts WHERE username=?", (username,)).fetchone()
        if attempt and attempt["blocked_until"] > now:
            raise HTTPException(429, "Too many attempts. Try again in 5 minutes.")
        user = conn.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
        # Perform the expensive hash for unknown accounts, too.
        valid = verify_password(payload.password, user["password_hash"]) if user else bool(hash_password(payload.password) and False)
        if not valid:
            failures = (attempt["failures"] if attempt and attempt["blocked_until"] == 0 else 0) + 1
            conn.execute("INSERT OR REPLACE INTO login_attempts VALUES (?,?,?)",
                         (username, failures, now + 300 if failures >= 5 else 0))
            conn.commit()
            raise HTTPException(401, "Incorrect username or password")
        conn.execute("DELETE FROM login_attempts WHERE username=?", (username,))
        token = secrets.token_urlsafe(32)
        conn.execute("DELETE FROM sessions WHERE expires_at<=?", (now,))
        conn.execute("INSERT INTO sessions VALUES (?,?,?)",
                     (hashlib.sha256(token.encode()).hexdigest(), user["id"], now + 28800))
        conn.commit()
    response.set_cookie("talley_session", token, httponly=True, samesite="lax",
                        secure=os.environ.get("COOKIE_SECURE", "1") != "0", max_age=28800)
    return {k: user[k] for k in ("id", "username", "name", "role")}

@router.get("/me")
def me(user=Depends(current_user)):
    return user

@router.post("/logout")
def logout(request: Request, response: Response):
    token = request.cookies.get("talley_session", "")
    with closing(connect()) as conn:
        conn.execute("DELETE FROM sessions WHERE token_hash=?", (hashlib.sha256(token.encode()).hexdigest(),))
        conn.commit()
    response.delete_cookie("talley_session")
    return {"ok": True}

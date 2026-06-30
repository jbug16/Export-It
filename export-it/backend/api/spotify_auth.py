# tabs only
"""Spotify OAuth 2.0 with PKCE — token storage for Export-It."""
from __future__ import annotations

import base64
import hashlib
import json
import os
import secrets
import sqlite3
import time
from pathlib import Path
from urllib.parse import urlencode

import httpx

SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize"
SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
SCOPES = "playlist-read-private playlist-read-collaborative user-read-email user-read-private"

_pending: dict[str, dict] = {}


def _data_dir() -> Path:
	root = Path(__file__).resolve().parents[2]
	d = root / "data"
	d.mkdir(parents=True, exist_ok=True)
	return d


def _db_path() -> Path:
	return _data_dir() / "export-it.db"


def _init_db() -> None:
	with sqlite3.connect(_db_path()) as conn:
		conn.execute("""
			CREATE TABLE IF NOT EXISTS spotify_tokens (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				access_token TEXT,
				refresh_token TEXT,
				expires_at REAL,
				scope TEXT
			)
		""")


def _pkce_pair() -> tuple[str, str]:
	verifier = secrets.token_urlsafe(64)[:128]
	digest = hashlib.sha256(verifier.encode("ascii")).digest()
	challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
	return verifier, challenge


def client_config() -> tuple[str, str, str]:
	client_id = os.environ.get("SPOTIFY_CLIENT_ID", "").strip()
	client_secret = os.environ.get("SPOTIFY_CLIENT_SECRET", "").strip()
	redirect_uri = os.environ.get(
		"SPOTIFY_REDIRECT_URI",
		"http://127.0.0.1:3001/api/spotify/callback",
	).strip()
	if not client_id:
		raise RuntimeError("SPOTIFY_CLIENT_ID is not set in .env")
	return client_id, client_secret, redirect_uri


def start_login() -> str:
	_init_db()
	client_id, _, redirect_uri = client_config()
	state = secrets.token_urlsafe(16)
	verifier, challenge = _pkce_pair()
	_pending[state] = {"verifier": verifier, "created": time.time()}
	params = {
		"client_id": client_id,
		"response_type": "code",
		"redirect_uri": redirect_uri,
		"scope": SCOPES,
		"state": state,
		"code_challenge_method": "S256",
		"code_challenge": challenge,
	}
	return f"{SPOTIFY_AUTH_URL}?{urlencode(params)}"


def _save_tokens(access: str, refresh: str | None, expires_in: int, scope: str) -> None:
	_init_db()
	expires_at = time.time() + max(0, expires_in - 60)
	with sqlite3.connect(_db_path()) as conn:
		row = conn.execute("SELECT refresh_token FROM spotify_tokens WHERE id = 1").fetchone()
		stored_refresh = refresh or (row[0] if row else None)
		conn.execute(
			"""INSERT INTO spotify_tokens (id, access_token, refresh_token, expires_at, scope)
			   VALUES (1, ?, ?, ?, ?)
			   ON CONFLICT(id) DO UPDATE SET
			     access_token = excluded.access_token,
			     refresh_token = COALESCE(excluded.refresh_token, spotify_tokens.refresh_token),
			     expires_at = excluded.expires_at,
			     scope = excluded.scope""",
			(access, stored_refresh, expires_at, scope),
		)


def finish_callback(code: str, state: str) -> None:
	pending = _pending.pop(state, None)
	if not pending:
		raise ValueError("Invalid or expired login state. Try connecting again.")
	client_id, client_secret, redirect_uri = client_config()
	data = {
		"grant_type": "authorization_code",
		"code": code,
		"redirect_uri": redirect_uri,
		"client_id": client_id,
		"code_verifier": pending["verifier"],
	}
	headers = {"Content-Type": "application/x-www-form-urlencoded"}
	if client_secret:
		basic = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
		headers["Authorization"] = f"Basic {basic}"
	res = httpx.post(SPOTIFY_TOKEN_URL, data=data, headers=headers, timeout=20.0)
	if res.status_code >= 400:
		try:
			err = res.json()
			msg = err.get("error_description") or err.get("error") or res.text
		except Exception:
			msg = res.text
		raise ValueError(f"Spotify token exchange failed: {msg}")
	body = res.json()
	_save_tokens(body["access_token"], body.get("refresh_token"), int(body.get("expires_in", 3600)), body.get("scope", ""))


def _load_tokens() -> dict | None:
	_init_db()
	with sqlite3.connect(_db_path()) as conn:
		row = conn.execute(
			"SELECT access_token, refresh_token, expires_at, scope FROM spotify_tokens WHERE id = 1"
		).fetchone()
	if not row:
		return None
	return {
		"access_token": row[0],
		"refresh_token": row[1],
		"expires_at": row[2],
		"scope": row[3],
	}


def clear_tokens() -> None:
	_init_db()
	with sqlite3.connect(_db_path()) as conn:
		conn.execute("DELETE FROM spotify_tokens WHERE id = 1")


def is_connected() -> bool:
	tokens = _load_tokens()
	return bool(tokens and tokens.get("refresh_token"))


async def get_access_token() -> str | None:
	tokens = _load_tokens()
	if not tokens:
		return None
	if tokens["expires_at"] and time.time() < tokens["expires_at"]:
		return tokens["access_token"]
	refresh = tokens.get("refresh_token")
	if not refresh:
		return None
	client_id, client_secret, _ = client_config()
	data = {
		"grant_type": "refresh_token",
		"refresh_token": refresh,
		"client_id": client_id,
	}
	headers = {"Content-Type": "application/x-www-form-urlencoded"}
	if client_secret:
		basic = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
		headers["Authorization"] = f"Basic {basic}"
	res = httpx.post(SPOTIFY_TOKEN_URL, data=data, headers=headers, timeout=20.0)
	if res.status_code != 200:
		clear_tokens()
		return None
	body = res.json()
	_save_tokens(
		body["access_token"],
		body.get("refresh_token"),
		int(body.get("expires_in", 3600)),
		body.get("scope", tokens.get("scope") or ""),
	)
	return body["access_token"]

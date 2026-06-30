# tabs only
"""FastAPI server — thin HTTP layer over CSVMusic core."""
from __future__ import annotations

import os
import shutil
import tempfile
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from api import jobs as job_service
from api import spotify_auth
from csvmusic.core.csv_import import load_csv, tracks_from_csv
from csvmusic.core.paths import ffmpeg_path, ytdlp_path
from csvmusic.core.pipeline import PipelineConfig
from csvmusic.core.preflight import run_preflight_checks
from csvmusic.core.settings import load_settings, save_settings
from csvmusic.core.spotify_import import (
	SpotifyApiError,
	get_current_user,
	list_user_playlists,
	resolve_spotify_url,
)

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

ROOT = Path(__file__).resolve().parents[2]
MUSIC_DIR = ROOT / "Music"
MUSIC_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Export-It API")
app.add_middleware(
	CORSMiddleware,
	allow_origins=["*"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)


class ResolveSpotifyBody(BaseModel):
	url: str


class StartJobBody(BaseModel):
	tracks: list[dict]
	playlist: str | None = None
	outDir: str | None = None
	fmt: str = "mp3"
	writeM3u8: bool = False
	writeM3uPlain: bool = True
	embedArt: bool = True
	mp3Quality: int = 0
	forceDownload: bool = False
	sourceType: str | None = None
	cookiesBrowser: str | None = None
	cookiesFile: str | None = None


class AlternativesBody(BaseModel):
	track: dict
	excludeIds: list[str] = Field(default_factory=list)


class DownloadTrackBody(BaseModel):
	match: dict


class SettingsBody(BaseModel):
	data: dict


class PreviewState(BaseModel):
	tracks: list[dict] = Field(default_factory=list)
	playlist: str | None = None
	sourceType: str | None = None
	sourceName: str | None = None
	coverUrl: str | None = None


_preview = PreviewState()


def _default_out_dir() -> str:
	settings = load_settings()
	out = settings.get("output_dir") or settings.get("out_dir")
	if out and Path(out).exists():
		return str(out)
	return str(MUSIC_DIR)


def _pipeline_config(body: StartJobBody) -> PipelineConfig:
	settings = load_settings()
	out_dir = body.outDir or settings.get("output_dir") or str(MUSIC_DIR)
	fmt = body.fmt or settings.get("fmt") or "mp3"
	return PipelineConfig(
		out_dir=out_dir,
		playlist=body.playlist,
		fmt=fmt,
		write_m3u8=body.writeM3u8,
		write_m3u_plain=body.writeM3uPlain,
		embed_art=body.embedArt,
		mp3_quality=body.mp3Quality,
		force_download=body.forceDownload,
		source_type=body.sourceType,
		cookies_browser=body.cookiesBrowser or settings.get("cookies_browser"),
		cookies_file=body.cookiesFile or settings.get("cookies_file"),
		yt_dlp_path=ytdlp_path(),
		ffmpeg_path_override=ffmpeg_path(),
	)


@app.get("/api/health")
def health():
	result = run_preflight_checks()
	return {
		"ok": len(result.errors) == 0,
		"errors": result.errors,
		"warnings": result.warnings,
		"details": result.details,
		"ytdlp": {"installed": "yt-dlp" in result.details, "version": result.details.get("yt-dlp")},
		"ffmpeg": {"installed": "ffmpeg" not in result.errors, "path": result.details.get("ffmpeg")},
		"spotify": {"configured": bool(os.environ.get("SPOTIFY_CLIENT_ID")), "connected": spotify_auth.is_connected()},
		"defaultOutDir": str(MUSIC_DIR),
	}


@app.get("/api/spotify/login")
def spotify_login():
	try:
		url = spotify_auth.start_login()
		return {"url": url}
	except Exception as exc:
		raise HTTPException(500, str(exc)) from exc


@app.get("/api/spotify/callback")
def spotify_callback(code: str = "", state: str = "", error: str = ""):
	if error:
		return RedirectResponse(f"http://127.0.0.1:5173/?spotify_error={error}")
	if not code or not state:
		raise HTTPException(400, "Missing code or state")
	try:
		spotify_auth.finish_callback(code, state)
	except Exception as exc:
		return RedirectResponse(f"http://127.0.0.1:5173/?spotify_error={exc}")
	return RedirectResponse("http://127.0.0.1:5173/?spotify_connected=1")


@app.get("/api/spotify/me")
async def spotify_me():
	token = await spotify_auth.get_access_token()
	if not token:
		return {"connected": False}
	try:
		user = await get_current_user(token)
		return {"connected": True, "user": user}
	except SpotifyApiError as exc:
		if exc.status in (401, 403):
			spotify_auth.clear_tokens()
		raise HTTPException(exc.status, exc.message) from exc
	except Exception as exc:
		raise HTTPException(401, str(exc)) from exc


@app.post("/api/spotify/logout")
def spotify_logout():
	spotify_auth.clear_tokens()
	return {"ok": True}


@app.get("/api/spotify/playlists")
async def spotify_playlists(limit: int = Query(50, ge=1, le=50)):
	token = await spotify_auth.get_access_token()
	if not token:
		raise HTTPException(401, "Connect Spotify first")
	try:
		items = await list_user_playlists(token, limit=limit)
		return {"playlists": items}
	except Exception as exc:
		raise HTTPException(400, str(exc)) from exc


@app.post("/api/spotify/resolve")
async def spotify_resolve(body: ResolveSpotifyBody):
	token = await spotify_auth.get_access_token()
	if not token:
		raise HTTPException(401, "Connect Spotify first")
	try:
		resolved = await resolve_spotify_url(body.url, token)
	except Exception as exc:
		raise HTTPException(400, str(exc)) from exc
	global _preview
	_preview = PreviewState(
		tracks=resolved["tracks"],
		playlist=resolved["playlist"],
		sourceType=resolved["type"],
		sourceName=resolved["name"],
		coverUrl=resolved.get("coverUrl"),
	)
	return resolved


@app.post("/api/import/csv")
async def import_csv(file: UploadFile = File(...)):
	suffix = Path(file.filename or "playlist.csv").suffix or ".csv"
	tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
	try:
		shutil.copyfileobj(file.file, tmp)
		tmp.close()
		df = load_csv(tmp.name)
		tracks = tracks_from_csv(df, None)
		playlist = tracks[0]["playlist"] if tracks else "Playlist"
		global _preview
		_preview = PreviewState(
			tracks=tracks,
			playlist=playlist,
			sourceType="csv",
			sourceName=playlist,
		)
		return {
			"type": "csv",
			"name": playlist,
			"playlist": playlist,
			"trackCount": len(tracks),
			"tracks": tracks,
		}
	finally:
		Path(tmp.name).unlink(missing_ok=True)


@app.get("/api/preview")
def get_preview():
	return _preview.model_dump()


@app.get("/api/settings")
def get_settings():
	return load_settings()


@app.put("/api/settings")
def put_settings(body: SettingsBody):
	save_settings(body.data)
	return load_settings()


@app.post("/api/jobs")
def start_job(body: StartJobBody):
	if not body.tracks:
		raise HTTPException(400, "No tracks to download")
	cfg = _pipeline_config(body)
	if body.playlist:
		cfg.playlist = body.playlist
	elif body.tracks:
		cfg.playlist = body.tracks[0].get("playlist")
	job = job_service.create_job(body.tracks, cfg)
	return job.snapshot()


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str):
	job = job_service.get_job(job_id)
	if not job:
		raise HTTPException(404, "Job not found")
	return job.snapshot()


@app.post("/api/jobs/{job_id}/cancel")
def cancel_job(job_id: str):
	if not job_service.cancel_job(job_id):
		raise HTTPException(400, "Job cannot be cancelled")
	return {"ok": True}


@app.post("/api/alternatives")
def alternatives(body: AlternativesBody):
	try:
		opts = job_service.get_alternatives(body.track, body.excludeIds)
		return {"options": opts}
	except Exception as exc:
		raise HTTPException(400, str(exc)) from exc


@app.post("/api/jobs/{job_id}/tracks/{row_index}/download")
def download_track(job_id: str, row_index: int, body: DownloadTrackBody):
	try:
		result = job_service.download_track_with_match(job_id, row_index, body.match)
		return result
	except ValueError as exc:
		raise HTTPException(400, str(exc)) from exc


def main():
	import uvicorn
	port = int(os.environ.get("PORT", "3001"))
	uvicorn.run("api.server:app", host="0.0.0.0", port=port, reload=False)


if __name__ == "__main__":
	main()

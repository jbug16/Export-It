# tabs only
"""Spotify Web API → CSVMusic track dicts (same shape as csv_import.tracks_from_csv)."""
from __future__ import annotations

import re
from typing import Any, Dict, List, Literal, Tuple

import httpx

SPOTIFY_API = "https://api.spotify.com/v1"

SourceType = Literal["album", "playlist", "track"]


class SpotifyApiError(Exception):
	def __init__(self, status: int, message: str):
		self.status = status
		self.message = message
		super().__init__(message)


def _spotify_error_message(res: httpx.Response) -> str:
	try:
		body = res.json()
		err = body.get("error", body)
		if isinstance(err, dict):
			msg = err.get("message") or err.get("error_description") or str(err)
		else:
			msg = str(err)
	except Exception:
		msg = res.text or res.reason_phrase
	if res.status_code == 403:
		hint = (
			" In Development Mode, add this Spotify account under your app → Settings → "
			"User Management (name + email from Spotify → Edit profile). "
			"The app owner also needs Spotify Premium for dev-mode apps."
		)
		if "not registered" in (msg or "").lower() or "developer" in (msg or "").lower():
			return f"{msg}.{hint}"
		return f"{msg or 'Forbidden'}.{hint}"
	return msg or f"Spotify API error {res.status_code}"


def parse_spotify_url(url: str) -> Tuple[SourceType, str] | None:
	if not url or not isinstance(url, str):
		return None
	text = url.strip()
	album = re.search(r"open\.spotify\.com/album/([a-zA-Z0-9]+)", text)
	if album:
		return ("album", album.group(1))
	playlist = re.search(r"open\.spotify\.com/playlist/([a-zA-Z0-9]+)", text)
	if playlist:
		return ("playlist", playlist.group(1))
	track = re.search(r"open\.spotify\.com/track/([a-zA-Z0-9]+)", text)
	if track:
		return ("track", track.group(1))
	return None


def _artist_names(artists: list[dict] | None) -> str:
	if not artists:
		return ""
	return ", ".join(a.get("name", "") for a in artists if a.get("name"))


def _album_image(album: dict | None) -> str | None:
	if not album:
		return None
	images = album.get("images") or []
	if not images:
		return None
	return images[0].get("url")


def _track_dict(
	*,
	title: str,
	artists: str,
	album: str,
	playlist: str,
	sp_id: str | None,
	isrc: str | None,
	duration_ms: int,
	track_no: int,
	disc_no: int,
	cover_url: str | None,
	year: str | None = None,
	album_artist: str | None = None,
	album_total_tracks: int | None = None,
	source_type: str | None = None,
) -> Dict[str, Any]:
	return {
		"title": title,
		"artists": artists,
		"album": album,
		"album_artist": album_artist or "",
		"album_total_tracks": album_total_tracks or 0,
		"playlist": playlist,
		"source_type": source_type or "",
		"isrc": isrc,
		"sp_id": sp_id,
		"duration_ms": duration_ms,
		"year": year,
		"cover_url": cover_url,
		"track_no": track_no,
		"disc_no": disc_no,
	}


async def _get(client: httpx.AsyncClient, path: str, token: str) -> dict:
	res = await client.get(f"{SPOTIFY_API}{path}", headers={"Authorization": f"Bearer {token}"})
	if res.status_code >= 400:
		raise SpotifyApiError(res.status_code, _spotify_error_message(res))
	return res.json()


async def resolve_spotify_url(url: str, access_token: str) -> dict:
	parsed = parse_spotify_url(url)
	if not parsed:
		raise ValueError("Invalid Spotify URL. Use an album, playlist, or track link.")
	source_type, spotify_id = parsed
	async with httpx.AsyncClient(timeout=30.0) as client:
		if source_type == "album":
			return await _resolve_album(client, spotify_id, access_token)
		if source_type == "track":
			return await _resolve_track(client, spotify_id, access_token)
		return await _resolve_playlist(client, spotify_id, access_token)


async def _resolve_album(client: httpx.AsyncClient, album_id: str, token: str) -> dict:
	album = await _get(client, f"/albums/{album_id}", token)
	name = album.get("name") or "Album"
	artist = _artist_names(album.get("artists"))
	cover = _album_image(album)
	release_year = (album.get("release_date") or "")[:4] or None
	total_tracks = int(album.get("total_tracks") or 0)
	tracks: List[Dict] = []
	items = album.get("tracks", {}).get("items") or []
	for item in items:
		if not item or not item.get("name"):
			continue
		ext = item.get("external_ids") or {}
		tracks.append(_track_dict(
			title=item["name"],
			artists=_artist_names(item.get("artists")) or artist,
			album=name,
			playlist=name,
			sp_id=item.get("id"),
			isrc=ext.get("isrc"),
			duration_ms=int(item.get("duration_ms") or 0),
			track_no=int(item.get("track_number") or 0),
			disc_no=int(item.get("disc_number") or 1),
			cover_url=cover,
			year=release_year,
			album_artist=artist,
			album_total_tracks=total_tracks or len(items),
			source_type="album",
		))
	return {
		"type": "album",
		"name": name,
		"owner": artist,
		"coverUrl": cover,
		"trackCount": len(tracks),
		"playlist": name,
		"tracks": tracks,
	}


async def _resolve_track(client: httpx.AsyncClient, track_id: str, token: str) -> dict:
	item = await _get(client, f"/tracks/{track_id}", token)
	name = item.get("name") or "Track"
	artist = _artist_names(item.get("artists"))
	album = item.get("album") or {}
	album_name = album.get("name") or ""
	cover = _album_image(album)
	release_year = (album.get("release_date") or "")[:4] or None
	ext = item.get("external_ids") or {}
	tracks = [_track_dict(
		title=name,
		artists=artist,
		album=album_name,
		playlist=name,
		sp_id=item.get("id"),
		isrc=ext.get("isrc"),
		duration_ms=int(item.get("duration_ms") or 0),
		track_no=int(item.get("track_number") or 1),
		disc_no=int(item.get("disc_number") or 1),
		cover_url=cover,
		year=release_year,
		album_artist=_artist_names(album.get("artists")),
		album_total_tracks=int(album.get("total_tracks") or 1),
		source_type="track",
	)]
	return {
		"type": "track",
		"name": name,
		"owner": artist,
		"coverUrl": cover,
		"trackCount": 1,
		"playlist": name,
		"tracks": tracks,
	}


async def _resolve_playlist(client: httpx.AsyncClient, playlist_id: str, token: str) -> dict:
	meta = await _get(client, f"/playlists/{playlist_id}", token)
	name = meta.get("name") or "Playlist"
	owner = (meta.get("owner") or {}).get("display_name") or ""
	cover = _album_image(meta)
	tracks: List[Dict] = []
	offset = 0
	while True:
		page = await _get(client, f"/playlists/{playlist_id}/tracks?limit=100&offset={offset}", token)
		for idx, row in enumerate(page.get("items") or []):
			item = row.get("track")
			if not item or item.get("type") != "track" or not item.get("name"):
				continue
			album = item.get("album") or {}
			album_name = album.get("name") or ""
			album_artist = _artist_names(album.get("artists"))
			ext = item.get("external_ids") or {}
			pos = offset + idx + 1
			tracks.append(_track_dict(
				title=item["name"],
				artists=_artist_names(item.get("artists")),
				album=album_name,
				playlist=name,
				sp_id=item.get("id"),
				isrc=ext.get("isrc"),
				duration_ms=int(item.get("duration_ms") or 0),
				track_no=pos,
				disc_no=int(item.get("disc_number") or 1),
				cover_url=_album_image(album) or cover,
				album_artist=album_artist,
				album_total_tracks=int(album.get("total_tracks") or 0),
				source_type="playlist",
			))
		if not page.get("next"):
			break
		offset += 100
	return {
		"type": "playlist",
		"name": name,
		"owner": owner,
		"coverUrl": cover,
		"trackCount": len(tracks),
		"playlist": name,
		"tracks": tracks,
	}


async def list_user_playlists(access_token: str, limit: int = 50) -> list[dict]:
	async with httpx.AsyncClient(timeout=30.0) as client:
		data = await _get(client, f"/me/playlists?limit={min(limit, 50)}", access_token)
		out = []
		for pl in data.get("items") or []:
			out.append({
				"id": pl.get("id"),
				"name": pl.get("name"),
				"trackCount": (pl.get("tracks") or {}).get("total", 0),
				"coverUrl": _album_image(pl),
				"url": pl.get("external_urls", {}).get("spotify"),
			})
		return out


async def get_current_user(access_token: str) -> dict:
	async with httpx.AsyncClient(timeout=15.0) as client:
		data = await _get(client, "/me", access_token)
		return {
			"id": data.get("id"),
			"displayName": data.get("display_name"),
			"email": data.get("email"),
			"imageUrl": (data.get("images") or [{}])[0].get("url") if data.get("images") else None,
		}

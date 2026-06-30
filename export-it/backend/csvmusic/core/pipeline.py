# tabs only
"""UI-agnostic download pipeline extracted from csvmusic.ui.workers.PipelineWorker."""
from __future__ import annotations

import pathlib
import random
import re
import traceback
import unicodedata
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional

import time

from ytmusicapi import YTMusic

from csvmusic.core.csv_import import load_csv, tracks_from_csv
from csvmusic.core.downloader import (
	build_ytdlp_mitigation_args,
	detect_youtube_risk,
	download_m4a,
	download_mp3,
	sanitize_name,
	tag_file,
	write_m3u,
	yt_thumbnail_bytes,
	youtube_batch_mitigation,
	YOUTUBE_MITIGATION_AGGRESSIVE,
	YOUTUBE_MITIGATION_NONE,
	YouTubeMitigationProfile,
)
from csvmusic.core.log import log
from csvmusic.core.ytmusic_match import CONFIDENCE_MIN, RATE_LIMIT_S, find_best, more_candidates

_FORCE_FALLBACK_MIN_SCORE = 0.45


def _legacy_cover_size(legacy_options: Dict | None, *, embed_art: bool) -> int:
	if not embed_art:
		return 0
	mode = str((legacy_options or {}).get("cover_art_mode") or "standard").lower()
	if mode == "off":
		return 0
	if mode == "small":
		return 300
	if mode == "medium":
		return 450
	return 600


def _legacy_cbr_bitrate(legacy_options: Dict | None) -> int | None:
	if not legacy_options or not legacy_options.get("enabled"):
		return None
	mode = str(legacy_options.get("mp3_mode") or "").lower()
	if mode == "cbr_192":
		return 192
	if mode == "cbr_256":
		return 256
	if mode == "cbr_320":
		return 320
	return None


def _norm_text(text: str) -> str:
	return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", (text or "").casefold())).strip()


def _tokens(text: str) -> set[str]:
	return {tok for tok in re.findall(r"\w+", _norm_text(text), flags=re.UNICODE) if any(ch.isalnum() for ch in tok)}


@dataclass
class PipelineConfig:
	out_dir: str
	playlist: str | None = None
	csv_path: str | None = None
	tracks_override: List[Dict] | None = None
	row_indices: List[int] | None = None
	fmt: str = "mp3"
	write_m3u8: bool = False
	write_m3u_plain: bool = True
	embed_art: bool = True
	yt_dlp_path: str | None = None
	ffmpeg_path_override: str | None = None
	cookies_browser: str | None = None
	cookies_file: str | None = None
	audio_processing: Dict | None = None
	mp3_quality: int = 0
	legacy_options: Dict | None = None
	force_download: bool = False
	source_type: str | None = None


@dataclass
class PipelineCallbacks:
	on_log: Callable[[str], None] = field(default=lambda _m: None)
	on_warning: Callable[[str], None] = field(default=lambda _m: None)
	on_total: Callable[[int], None] = field(default=lambda _n: None)
	on_match_stats: Callable[[int, int], None] = field(default=lambda _m, _s: None)
	on_row_status: Callable[[int, str], None] = field(default=lambda _i, _s: None)
	on_progress: Callable[[int, int], None] = field(default=lambda _p, _t: None)
	on_track_result: Callable[[int, dict], None] = field(default=lambda _i, _p: None)
	on_done: Callable[[str, list, list, list], None] = field(default=lambda *_a: None)
	should_stop: Callable[[], bool] = field(default=lambda: False)


class PipelineRunner:
	def __init__(self, config: PipelineConfig, callbacks: PipelineCallbacks | None = None):
		self.config = config
		self.cb = callbacks or PipelineCallbacks()
		self.out_dir = pathlib.Path(config.out_dir)
		self._mitigation = YOUTUBE_MITIGATION_NONE

	def stop(self) -> None:
		"""Legacy hook; prefer callbacks.should_stop."""
		pass

	def _download_with_profile(self, vid: str, dest_dir: pathlib.Path, base: str, profile: YouTubeMitigationProfile):
		cfg = self.config
		extra_args: list[str] = []
		if cfg.cookies_file:
			extra_args += ["--cookies", cfg.cookies_file]
		elif cfg.cookies_browser:
			extra_args += ["--cookies-from-browser", cfg.cookies_browser]
		extra_args += build_ytdlp_mitigation_args(profile)
		if cfg.fmt == "m4a":
			return download_m4a(
				vid, dest_dir, base,
				yt_dlp_bin=cfg.yt_dlp_path,
				ffmpeg_bin=cfg.ffmpeg_path_override,
				extra_yt_dlp_args=extra_args or None,
				audio_processing=cfg.audio_processing,
			)
		return download_mp3(
			vid, dest_dir, base,
			yt_dlp_bin=cfg.yt_dlp_path,
			ffmpeg_bin=cfg.ffmpeg_path_override,
			extra_yt_dlp_args=extra_args or None,
			audio_processing=cfg.audio_processing,
			mp3_quality=cfg.mp3_quality,
			cbr_bitrate_kbps=_legacy_cbr_bitrate(cfg.legacy_options),
		)

	def _apply_mitigation(self, profile: YouTubeMitigationProfile, reason: str | None = None) -> None:
		if profile.label == self._mitigation.label:
			return
		self._mitigation = profile
		if profile.warning:
			msg = profile.warning
			if reason:
				msg = f"{msg}\n\nDetected: {reason}"
			self.cb.on_log(f"[warn] {msg}")
			self.cb.on_warning(msg)

	def _track_pause_s(self) -> float:
		if self._mitigation.track_sleep_s <= 0:
			return RATE_LIMIT_S
		jitter = min(1.0, self._mitigation.track_sleep_s * 0.2)
		return max(RATE_LIMIT_S, random.uniform(self._mitigation.track_sleep_s - jitter, self._mitigation.track_sleep_s + jitter))

	def _is_official_candidate(self, cand: Dict) -> bool:
		source = str(cand.get("source") or "").lower()
		author = str(cand.get("author") or "").lower()
		title = str(cand.get("title") or "").lower()
		if source == "music":
			return True
		return any(term in author for term in ("topic", "official", "vevo")) or "official" in title

	def _candidate_relevant_to_track(self, track: Dict, cand: Dict) -> bool:
		track_artist_tokens = _tokens(track.get("artists", ""))
		track_title_tokens = _tokens(track.get("title", ""))
		cand_author_tokens = _tokens(cand.get("author", ""))
		cand_title_tokens = _tokens(cand.get("title", ""))
		artist_ok = bool(track_artist_tokens & (cand_author_tokens | cand_title_tokens))
		title_overlap = len(track_title_tokens & cand_title_tokens)
		return artist_ok and title_overlap >= max(1, min(2, len(track_title_tokens)))

	def _force_download_candidates(self, track: Dict, options: List[Dict]) -> List[Dict]:
		if not options:
			return []
		relevant = [opt for opt in options if self._candidate_relevant_to_track(track, opt)]
		pool = relevant or options
		official = [opt for opt in pool if self._is_official_candidate(opt)]
		standard = [opt for opt in pool if opt not in official]
		sequence: list[Dict] = []

		def _append_group(group: list[Dict]) -> None:
			if not group:
				return
			sequence.append(group[0])
			if len(group) > 1 and float(group[1].get("score", 0.0) or 0.0) >= _FORCE_FALLBACK_MIN_SCORE:
				sequence.append(group[1])

		_append_group(official)
		_append_group(standard)
		seen: set[str] = set()
		unique: list[Dict] = []
		for opt in sequence:
			vid = opt.get("videoId")
			if not vid or vid in seen:
				continue
			seen.add(vid)
			unique.append(opt)
		return unique

	def _ordered_force_candidates(self, track: Dict, match: Dict | None, options: List[Dict]) -> List[Dict]:
		if not self.config.force_download:
			return [match] if match else []
		ordered = self._force_download_candidates(track, options)
		if match and match.get("videoId"):
			match_vid = match.get("videoId")
			if not ordered:
				return [match]
			if ordered[0].get("videoId") != match_vid:
				ordered = [match] + [opt for opt in ordered if opt.get("videoId") != match_vid]
		return ordered or ([match] if match else [])

	def _attempt_status_text(self, candidate: Dict, attempt_idx: int, total_attempts: int, *, safe_mode: bool = False) -> str:
		source_label = "official result" if self._is_official_candidate(candidate) else "YouTube result"
		if total_attempts <= 1:
			base = f"Trying {source_label} ({self.config.fmt})…"
		elif attempt_idx == 1:
			base = f"Trying {source_label} 1/{total_attempts} ({self.config.fmt})…"
		else:
			base = f"Trying fallback {source_label} {attempt_idx}/{total_attempts} ({self.config.fmt})…"
		if safe_mode:
			return f"Safe mode: {base[0].lower()}{base[1:]}"
		return base

	def run(self) -> None:
		cfg = self.config
		cb = self.cb
		try:
			cb.on_log("[csv] loading…")
			if cfg.tracks_override is not None:
				tracks = list(cfg.tracks_override)
			elif cfg.csv_path:
				df = load_csv(cfg.csv_path)
				tracks = tracks_from_csv(df, cfg.playlist)
			else:
				cb.on_done("No tracks provided.", [], [], [])
				return
			if not tracks:
				cb.on_done("No tracks selected.", [], [], [])
				return
			total = len(tracks)
			cb.on_total(total)
			self._mitigation = youtube_batch_mitigation(total, using_cookies=bool(cfg.cookies_file or cfg.cookies_browser))
			if self._mitigation.warning:
				cb.on_log(f"[warn] {self._mitigation.warning}")
			cb.on_log("[match] searching on YouTube Music…")
			matched = 0
			skipped_count = 0
			cb.on_match_stats(matched, skipped_count)
			try:
				yt = YTMusic()
			except Exception as exc:
				raise RuntimeError(f"Failed to initialize YTMusic client: {exc}") from exc
			playlist_name = cfg.playlist or (tracks[0]["playlist"] if tracks else "Playlist")
			if not playlist_name:
				playlist_name = "Playlist"
			safe_playlist = sanitize_name(playlist_name) or "Playlist"
			dest_dir = self.out_dir / safe_playlist
			dest_dir.mkdir(parents=True, exist_ok=True)
			done_tracks: List[Dict] = []
			failed_tracks: List[Dict] = []
			skipped_tracks: List[Dict] = []
			processed = 0
			row_indices = cfg.row_indices or []
			for idx, track in enumerate(tracks):
				row_idx = row_indices[idx] if idx < len(row_indices) else idx
				if cb.should_stop():
					break
				t = track
				title = t["title"]
				artists = t["artists"]
				search_error = None
				options: List[Dict] = []
				match = None
				confidence = 0.0
				try:
					match, confidence, options = find_best(yt, t)
				except Exception as exc:
					search_error = str(exc)
				payload = {
					"track": t,
					"options": _serialize_options(options),
					"match": _serialize_match(match),
					"confidence": confidence,
					"skipped": False,
					"error": None,
					"playlist_name": playlist_name,
					"file_path": None,
					"downloaded": False,
					"forced_match": False,
				}
				if match is None and cfg.force_download and options:
					forced_candidates = self._force_download_candidates(t, options)
					match = forced_candidates[0] if forced_candidates else options[0]
					confidence = float(match.get("score", confidence or 0.0) or 0.0)
					payload["match"] = _serialize_match(match)
					payload["confidence"] = confidence
					payload["forced_match"] = True
				if match is None:
					if search_error:
						log(f"match skip: query='{t['title']} {t['artists']}' error={search_error}")
					else:
						log(f"match skip: query='{t['title']} {t['artists']}' no candidate >= threshold (confidence={confidence:.2f})")
					payload["skipped"] = True
					payload["error"] = search_error
					reason = search_error or "No confident match"
					skipped_tracks.append({"track": t, "reason": reason, "options": _serialize_options(options)})
					cb.on_row_status(row_idx, "Skipped (no good match)")
					processed += 1
					cb.on_progress(processed, total)
					cb.on_track_result(row_idx, payload)
					skipped_count += 1
					cb.on_match_stats(matched, skipped_count)
					if not cb.should_stop() and idx < total - 1:
						time.sleep(self._track_pause_s())
					continue
				payload["match"] = _serialize_match(match)
				matched += 1
				cb.on_match_stats(matched, skipped_count)
				low_confidence = payload.get("forced_match") or confidence < CONFIDENCE_MIN
				if low_confidence:
					cb.on_row_status(row_idx, f"Downloading low-confidence match ({cfg.fmt})…")
				else:
					cb.on_row_status(row_idx, f"Downloading ({cfg.fmt})…")
				error_msg = None
				candidate_sequence = self._ordered_force_candidates(t, match, options)
				fallback_attempts_enabled = cfg.force_download and len(candidate_sequence) > 1
				fp = None
				try:
					base = f"{artists} - {title}"
					last_err = None
					cover = None
					for attempt_idx, candidate in enumerate(candidate_sequence, start=1):
						vid = candidate["videoId"]
						if fallback_attempts_enabled:
							cb.on_row_status(row_idx, self._attempt_status_text(candidate, attempt_idx, len(candidate_sequence)))
						try:
							fp = self._download_with_profile(vid, dest_dir, base, self._mitigation)
							cb.on_row_status(row_idx, "Tagging…")
							cover = yt_thumbnail_bytes(vid)
							tag_file(fp, t, cover if cfg.embed_art else None, cover_size=_legacy_cover_size(cfg.legacy_options, embed_art=cfg.embed_art))
							payload["match"] = _serialize_match(candidate)
							break
						except Exception as candidate_exc:
							last_err = str(candidate_exc)
					if fp is None:
						raise RuntimeError(last_err or "Download failed.")
					if low_confidence:
						cb.on_row_status(row_idx, f"Low confidence → {fp.name}")
					else:
						cb.on_row_status(row_idx, f"Done → {fp.name}")
					done_tracks.append(t)
				except Exception as e:
					err = str(e)
					risk_reason = detect_youtube_risk(err)
					retried = False
					if risk_reason and self._mitigation.label != YOUTUBE_MITIGATION_AGGRESSIVE.label:
						self._apply_mitigation(YOUTUBE_MITIGATION_AGGRESSIVE, risk_reason)
						try:
							cb.on_row_status(row_idx, "Retrying with YouTube safe mode…")
							last_retry_err = None
							fp = None
							cover = None
							for attempt_idx, candidate in enumerate(candidate_sequence, start=1):
								vid = candidate["videoId"]
								if fallback_attempts_enabled:
									cb.on_row_status(row_idx, self._attempt_status_text(candidate, attempt_idx, len(candidate_sequence), safe_mode=True))
								try:
									fp = self._download_with_profile(vid, dest_dir, base, self._mitigation)
									cb.on_row_status(row_idx, "Tagging…")
									cover = yt_thumbnail_bytes(vid)
									tag_file(fp, t, cover if cfg.embed_art else None, cover_size=_legacy_cover_size(cfg.legacy_options, embed_art=cfg.embed_art))
									payload["match"] = _serialize_match(candidate)
									break
								except Exception as retry_candidate_exc:
									last_retry_err = str(retry_candidate_exc)
							if fp is None:
								raise RuntimeError(last_retry_err or "Download failed.")
							if low_confidence:
								cb.on_row_status(row_idx, f"Low confidence → {fp.name}")
							else:
								cb.on_row_status(row_idx, f"Done → {fp.name}")
							done_tracks.append(t)
							retried = True
						except Exception as retry_exc:
							err = str(retry_exc)
					if not retried:
						log(f"download failure: playlist='{playlist_name}' track='{artists} — {title}' fmt={cfg.fmt} error={err}")
						cb.on_row_status(row_idx, f"Fail: {err[:120]}")
						failed_tracks.append({"track": t, "error": err})
						error_msg = err
				finally:
					processed += 1
					cb.on_progress(processed, total)
				payload["error"] = error_msg
				if error_msg is None:
					payload["downloaded"] = True
					payload["file_path"] = str(fp) if fp else None
				cb.on_track_result(row_idx, payload)
				if not cb.should_stop() and idx < total - 1:
					time.sleep(self._track_pause_s())
				time.sleep(0.02)
			if done_tracks:
				ext = "m4a" if cfg.fmt == "m4a" else "mp3"
				write_lists = (cfg.source_type or "").lower() != "album"
				if write_lists and cfg.write_m3u8:
					m3u = write_m3u(self.out_dir, playlist_name, done_tracks, ext, suffix=".m3u8", encoding="utf-8")
					cb.on_log(f"[m3u] wrote: {m3u}")
				if write_lists and cfg.write_m3u_plain:
					m3u_plain = write_m3u(self.out_dir, playlist_name, done_tracks, ext, suffix=".m3u", encoding="utf-8-sig")
					cb.on_log(f"[m3u] wrote: {m3u_plain}")
			msg = "All tasks finished."
			if cb.should_stop():
				msg = "Stopped (partial results saved)."
			cb.on_done(msg, done_tracks, skipped_tracks, failed_tracks)
		except Exception:
			cb.on_done("Fatal error:\n" + traceback.format_exc(), [], [], [])


def fetch_alternatives(track: Dict, exclude_ids: set[str] | None = None) -> List[Dict]:
	try:
		options = more_candidates(track, exclude_ids=exclude_ids, source_mode="all")
		return _serialize_options(options)
	except Exception as exc:
		log(f"alternatives fetch failure: track='{track.get('artists', '')} — {track.get('title', '')}' error={exc}")
		raise


def download_single_track(
	*,
	row_idx: int,
	track: Dict,
	match: Dict,
	config: PipelineConfig,
	on_status: Callable[[int, str], None] | None = None,
) -> dict:
	status = on_status or (lambda _i, _s: None)
	try:
		out_dir = pathlib.Path(config.out_dir)
		playlist_name = track.get("playlist") or "Playlist"
		safe_playlist = sanitize_name(playlist_name) or "Playlist"
		dest_dir = out_dir / safe_playlist
		dest_dir.mkdir(parents=True, exist_ok=True)
		base = f"{track.get('artists', '')} - {track.get('title', '')}"
		vid = match.get("videoId")
		status(row_idx, f"Downloading ({config.fmt})…")
		if config.cookies_file:
			cookies_args = ["--cookies", config.cookies_file]
		elif config.cookies_browser:
			cookies_args = ["--cookies-from-browser", config.cookies_browser]
		else:
			cookies_args = None
		if config.fmt == "m4a":
			fp = download_m4a(vid, dest_dir, base, yt_dlp_bin=config.yt_dlp_path, ffmpeg_bin=config.ffmpeg_path_override, extra_yt_dlp_args=cookies_args, audio_processing=config.audio_processing)
		else:
			fp = download_mp3(vid, dest_dir, base, yt_dlp_bin=config.yt_dlp_path, ffmpeg_bin=config.ffmpeg_path_override, extra_yt_dlp_args=cookies_args, audio_processing=config.audio_processing, mp3_quality=config.mp3_quality, cbr_bitrate_kbps=_legacy_cbr_bitrate(config.legacy_options))
		status(row_idx, "Tagging…")
		cover = yt_thumbnail_bytes(vid)
		tag_file(fp, track, cover if config.embed_art else None, cover_size=_legacy_cover_size(config.legacy_options, embed_art=config.embed_art))
		status(row_idx, f"Done → {fp.name}")
		return {
			"track": track,
			"match": _serialize_match(match),
			"file_path": str(fp),
			"downloaded": True,
			"error": None,
			"playlist_name": playlist_name,
			"confidence": float(match.get("score", 0) or 0),
		}
	except Exception as e:
		err = str(e)
		log(f"manual download failure: playlist='{track.get('playlist', '')}' track='{track.get('artists', '')} — {track.get('title', '')}' fmt={config.fmt} error={err}")
		status(row_idx, f"Fail: {err[:120]}")
		return {
			"track": track,
			"match": _serialize_match(match),
			"file_path": None,
			"downloaded": False,
			"error": err,
			"playlist_name": track.get("playlist") or "Playlist",
		}


def _serialize_match(match: Dict | None) -> Dict | None:
	if not match:
		return None
	return {
		"videoId": match.get("videoId"),
		"title": match.get("title"),
		"author": match.get("author"),
		"score": match.get("score"),
		"source": match.get("source"),
		"duration_seconds": match.get("duration_seconds"),
	}


def _serialize_options(options: List[Dict]) -> List[Dict]:
	return [_serialize_match(o) for o in options if o]

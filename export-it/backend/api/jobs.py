# tabs only
"""Background job runner wrapping CSVMusic pipeline."""
from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List

from csvmusic.core.pipeline import PipelineCallbacks, PipelineConfig, PipelineRunner, download_single_track, fetch_alternatives


@dataclass
class JobState:
	id: str
	status: str = "queued"
	message: str = ""
	created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
	total: int = 0
	processed: int = 0
	matched: int = 0
	skipped: int = 0
	logs: List[str] = field(default_factory=list)
	tracks: List[Dict[str, Any]] = field(default_factory=list)
	rows: Dict[int, Dict[str, Any]] = field(default_factory=dict)
	config: PipelineConfig | None = None
	_cancel: bool = field(default=False, repr=False)
	_lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

	def snapshot(self) -> dict:
		with self._lock:
			rows = []
			for idx in sorted(self.rows.keys()):
				row = dict(self.rows[idx])
				row["index"] = idx
				rows.append(row)
			return {
				"id": self.id,
				"status": self.status,
				"message": self.message,
				"createdAt": self.created_at,
				"total": self.total,
				"processed": self.processed,
				"matched": self.matched,
				"skipped": self.skipped,
				"logs": list(self.logs[-200:]),
				"tracks": list(self.tracks),
				"rows": rows,
			}


_jobs: Dict[str, JobState] = {}
_jobs_lock = threading.Lock()


def create_job(tracks: List[dict], config: PipelineConfig) -> JobState:
	job_id = str(uuid.uuid4())
	state = JobState(id=job_id, config=config, tracks=tracks, total=len(tracks))
	for i, t in enumerate(tracks):
		state.rows[i] = {
			"index": i,
			"title": t.get("title"),
			"artists": t.get("artists"),
			"album": t.get("album"),
			"status": "Queued",
			"confidence": 0,
			"skipped": False,
			"downloaded": False,
			"lowConfidence": False,
		}
	with _jobs_lock:
		_jobs[job_id] = state
	thread = threading.Thread(target=_run_job, args=(state,), daemon=True)
	thread.start()
	return state


def get_job(job_id: str) -> JobState | None:
	with _jobs_lock:
		return _jobs.get(job_id)


def cancel_job(job_id: str) -> bool:
	job = get_job(job_id)
	if not job or job.status in ("done", "failed", "cancelled"):
		return False
	with job._lock:
		job._cancel = True
		job.status = "cancelled"
		job.message = "Cancelled"
	return True


def _append_log(job: JobState, msg: str) -> None:
	with job._lock:
		job.logs.append(msg)


def _run_job(job: JobState) -> None:
	assert job.config is not None
	cfg = job.config
	cfg.tracks_override = list(job.tracks)
	cfg.row_indices = list(range(len(job.tracks)))

	def should_stop() -> bool:
		with job._lock:
			return job._cancel

	callbacks = PipelineCallbacks(
		on_log=lambda m: _append_log(job, m),
		on_warning=lambda m: _append_log(job, f"[warn] {m}"),
		on_total=lambda n: _set(job, total=n),
		on_match_stats=lambda m, s: _set(job, matched=m, skipped=s),
		on_row_status=lambda i, s: _update_row(job, i, status=s),
		on_progress=lambda p, t: _set(job, processed=p, total=t),
		on_track_result=lambda i, payload: _track_result(job, i, payload),
		on_done=lambda msg, done, skipped, failed: _finish(job, msg, done, skipped, failed),
		should_stop=should_stop,
	)
	with job._lock:
		job.status = "running"
		job.message = "Starting…"
	try:
		PipelineRunner(cfg, callbacks).run()
	except Exception as exc:
		with job._lock:
			job.status = "failed"
			job.message = str(exc)


def _set(job: JobState, **kwargs) -> None:
	with job._lock:
		for k, v in kwargs.items():
			setattr(job, k, v)


def _update_row(job: JobState, idx: int, **kwargs) -> None:
	with job._lock:
		row = job.rows.setdefault(idx, {"index": idx})
		row.update(kwargs)


def _track_result(job: JobState, idx: int, payload: dict) -> None:
	conf = float(payload.get("confidence") or 0)
	low = bool(payload.get("forced_match")) or conf < 0.6
	_update_row(
		job,
		idx,
		confidence=conf,
		skipped=bool(payload.get("skipped")),
		downloaded=bool(payload.get("downloaded")),
		lowConfidence=low,
		match=payload.get("match"),
		options=payload.get("options"),
		error=payload.get("error"),
		filePath=payload.get("file_path"),
	)


def _finish(job: JobState, msg: str, done: list, skipped: list, failed: list) -> None:
	with job._lock:
		if job._cancel:
			job.status = "cancelled"
			job.message = "Cancelled"
		elif failed and not done:
			job.status = "failed"
			job.message = msg
		else:
			job.status = "done"
			job.message = msg


def get_alternatives(track: dict, exclude_ids: list[str] | None = None) -> list[dict]:
	return fetch_alternatives(track, exclude_ids=set(exclude_ids or []))


def download_track_with_match(job_id: str, row_index: int, match: dict) -> dict:
	job = get_job(job_id)
	if not job or not job.config:
		raise ValueError("Job not found")
	if row_index < 0 or row_index >= len(job.tracks):
		raise ValueError("Invalid track index")
	track = job.tracks[row_index]

	def on_status(i: int, s: str) -> None:
		_update_row(job, i, status=s)

	result = download_single_track(
		row_idx=row_index,
		track=track,
		match=match,
		config=job.config,
		on_status=on_status,
	)
	_track_result(job, row_index, {
		**result,
		"skipped": False,
		"options": [],
	})
	return result
